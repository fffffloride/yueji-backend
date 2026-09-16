#!/usr/bin/env python3
"""Trusted host-side migration runner. SQL is data; no release code runs as root.

MySQL DDL auto-commits. A failed migration remains 'running' and blocks retries;
an operator must inspect and explicitly repair it, never automatically restore DB.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

DB = 'youlai_admin'
HISTORY = 'yueji_schema_history'


def quote(value):
    return "'" + value.replace("'", "''") + "'"


def sql(container, query):
    result = subprocess.run(['docker', 'exec', '-i', container, 'sh', '-c',
        ': "${MYSQL_ROOT_PASSWORD:?}"; export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; '
        'exec mysql -uroot --batch --skip-column-names --binary-mode --default-character-set=utf8mb4 youlai_admin'],
        input=query.encode(), capture_output=True, timeout=300)
    if result.returncode:
        # Do not print SQL payloads, credentials or business rows from errors.
        codes = re.findall(rb'ERROR (\d+)', result.stderr)
        raise RuntimeError('MySQL command failed' + (': '+codes[0].decode() if codes else ''))
    return result.stdout.decode().strip()


def rows(container, query):
    output = sql(container, query)
    return [line.split('\t') for line in output.splitlines()] if output else []


def digest(data):
    return hashlib.sha256(data).hexdigest()


def load_release(directory):
    root = Path(directory).resolve(strict=True)
    manifest = json.loads((root/'manifest.json').read_text(encoding='utf-8'))
    assert manifest['format'] == 1
    entries = [manifest['baseline'], *manifest['migrations']]
    ids = [item['id'] for item in entries]
    assert ids == sorted(set(ids)), 'Migration IDs must be unique and ordered'
    for entry in entries:
        assert re.fullmatch(r'\d{12}_[a-z0-9_]+', entry['id'])
        assert entry['backwardCompatible'] is True, 'Automatic releases require backward-compatible migrations'
        assert entry['files'], 'Empty migration'
        for item in entry['files']:
            target = (root/item['path']).resolve(strict=True)
            assert target.is_relative_to(root) and target.is_file(), 'Invalid migration path'
            assert digest(target.read_bytes()) == item['sha256'], 'Migration checksum mismatch: '+item['path']
        entry['checksum'] = digest(json.dumps(entry, sort_keys=True, separators=(',', ':')).encode())
    return root, manifest, entries


def contract_errors(container, contract):
    columns = rows(container, "SELECT TABLE_NAME,COLUMN_NAME,DATA_TYPE,COALESCE(CHARACTER_MAXIMUM_LENGTH,0),IS_NULLABLE,COLUMN_KEY,EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE();")
    actual = {(r[0], r[1]): r for r in columns}
    indexes = rows(container, "SELECT TABLE_NAME,INDEX_NAME,NON_UNIQUE,GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() GROUP BY TABLE_NAME,INDEX_NAME,NON_UNIQUE;")
    index_map = {(r[0], r[1]): r for r in indexes}
    errors = []
    aliases = {'integer': 'int', 'bool': 'tinyint', 'boolean': 'tinyint'}
    for table in contract['tables']:
        name = table['name']
        for col in table['columns']:
            label = name+'.'+col['name']
            found = actual.get((name, col['name']))
            if not found:
                errors.append('missing column: '+label)
                continue
            expected = aliases.get(col['type'], col['type'])
            # Wider integer/text storage is compatible with the entity's reads.
            integer_width = {'tinyint': 1, 'smallint': 2, 'mediumint': 3, 'int': 4, 'bigint': 8}
            wider_integer = expected in integer_width and found[2] in integer_width and integer_width[found[2]] >= integer_width[expected]
            enum_text = expected == 'enum' and found[2] in ('varchar', 'text')
            if found[2] != expected and not wider_integer and not enum_text:
                errors.append('column type: '+label+' expected '+expected+' found '+found[2])
            if col['length'] and int(found[3]) < col['length']:
                errors.append('column length: '+label)
            # Legacy template null/default differences are not auto-normalized.
            # This gate checks query compatibility, not full DDL equivalence.
            if col['primary'] and found[5] != 'PRI':
                errors.append('primary key: '+label)
            if col['generated'] and 'GENERATED' not in found[6]:
                errors.append('generated column: '+label)
        for index in table['indexes']:
            found = index_map.get((name, index['name']))
            if not found or found[3].split(',') != index['columns'] or (found[2] == '0') != index['unique']:
                errors.append('index: '+name+'.'+index['name'])
    return errors


def validate(container, root, contract_path='contract.json'):
    contract = json.loads((root/contract_path).read_text(encoding='utf-8'))
    errors = contract_errors(container, contract)
    if errors:
        raise RuntimeError('Schema mismatch:\n'+'\n'.join(errors))
    # Assertions are explicit read-only scalar queries; each must return 1.
    assertions_path = 'baseline/assertions.json' if contract_path.startswith('baseline/') else 'assertions.json'
    for assertion in json.loads((root/assertions_path).read_text(encoding='utf-8')):
        query = assertion['sql'].strip()
        assert query.upper().startswith('SELECT ') and ';' not in query
        if sql(container, query) != '1':
            raise RuntimeError('Required data missing: '+assertion['name'])


def history(container):
    exists = sql(container, f"SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='{HISTORY}';")
    if exists == '0':
        return []
    return rows(container, f'SELECT version,checksum,status FROM {HISTORY} ORDER BY version;')


def check_history(recorded, entries, allow_pending=False):
    for position, row in enumerate(recorded):
        if position >= len(entries) or row != [entries[position]['id'], entries[position]['checksum'], 'applied']:
            raise RuntimeError('Unknown, modified or incomplete migration: '+row[0])
    if not allow_pending and len(recorded) != len(entries):
        raise RuntimeError('Unapplied database migrations')


def migrate(container, root, manifest, entries, bootstrap=False):
    recorded = history(container)
    if bootstrap:
        assert not recorded, 'Bootstrap requires an empty database'
    check_history(recorded, entries, allow_pending=True)
    if not recorded:
        count = int(sql(container, f"SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME<>'{HISTORY}';"))
        if bootstrap:
            assert count == 0, 'Bootstrap requires an empty database'
        else:
            assert count > 0, 'Empty DB requires explicit --bootstrap'
            # Only the reviewed additive adoption SQL may run on legacy data.
    sql(container, f'''CREATE TABLE IF NOT EXISTS {HISTORY} (
      version varchar(100) PRIMARY KEY, checksum char(64) NOT NULL,
      status varchar(16) NOT NULL, started_at datetime NOT NULL,
      applied_at datetime NULL) ENGINE=InnoDB;''')
    for entry in entries[len(recorded):]:
        version = quote(entry['id'])
        sql(container, f"INSERT INTO {HISTORY}(version,checksum,status,started_at) VALUES ({version},{quote(entry['checksum'])},'running',NOW());")
        for item in entry['files']:
            should_run = entry != entries[0] or bootstrap or item.get('mode') == 'adopt'
            if item['path'].endswith('.sql') and should_run:
                sql(container, 'SET SESSION lock_wait_timeout=30; SET SESSION innodb_lock_wait_timeout=30;\n'+(root/item['path']).read_text(encoding='utf-8'))
        if entry == entries[0]:
            validate(container, root, 'baseline/contract.json')
        sql(container, f"UPDATE {HISTORY} SET status='applied',applied_at=NOW() WHERE version={version};")
    validate(container, root)
    check_history(history(container), entries)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('operation', choices=['audit', 'check', 'migrate', 'verify-files'])
    parser.add_argument('release')
    parser.add_argument('--container', default='yueji-mysql-1')
    parser.add_argument('--bootstrap', action='store_true')
    args = parser.parse_args()
    assert re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_.-]*', args.container), 'Invalid container name'
    lock = None
    if args.operation == 'migrate' and os.name == 'posix':
        import fcntl
        # Separate from the outer release lock; direct CLI invocations must also
        # serialize writes. Restore rehearsals use unique, isolated containers.
        lock = open('/run/lock/yueji-schema-'+args.container+'.lock', 'a')
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    root, manifest, entries = load_release(args.release)
    if args.operation == 'verify-files':
        print('DATABASE_RELEASE_FILES_OK')
        return
    if args.operation == 'migrate':
        migrate(args.container, root, manifest, entries, args.bootstrap)
    else:
        validate(args.container, root)
        if args.operation == 'check':
            check_history(history(args.container), entries)
    print('DATABASE_'+args.operation.upper()+'_OK')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
