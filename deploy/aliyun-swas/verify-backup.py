#!/usr/bin/env python3
"""Restore a backup into disposable, isolated containers; never restore production."""
import gzip
import importlib.util
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import signal
import sys
import tarfile
import tempfile
import time

spec = importlib.util.spec_from_file_location('backup', Path(__file__).with_name('backup.py'))
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


def main():
    assert os.geteuid() == 0 and len(sys.argv) in (2, 3), 'Root, backup directory and optional database release required'
    os.umask(0o077)
    def interrupted(signum, frame):
        raise RuntimeError('Restore verification interrupted')
    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    target = Path(sys.argv[1])
    assert re.fullmatch(r'/opt/yueji/shared/backups/full-\d{8}T\d{6}Z', str(target))
    assert target.resolve(strict=True) == target
    manifest = json.loads((target/'manifest.json').read_text())
    inventory = json.loads((target/'source-inventory.json').read_text())
    for name, entry in manifest['files'].items():
        assert '/' not in name and backup.digest(target/name) == entry['sha256'], 'Backup checksum mismatch'
    uploaded = (target/'upload-receipt.json').exists()
    memory = dict(line.split(':', 1) for line in Path('/proc/meminfo').read_text().splitlines())
    assert int(memory['MemAvailable'].split()[0]) >= 768 * 1024, 'Not enough memory for isolated restore'
    required = 512 * 1024**2
    for name in ['uploads.tar.gz', 'configuration.tar.gz']:
        with tarfile.open(target/name) as archive:
            required += sum(member.size for member in archive)
    required += (target/'database.sql.gz').stat().st_size * 20
    assert shutil.disk_usage(target).free > required, 'Not enough disk for isolated restore'
    root = Path(tempfile.mkdtemp(prefix='.verify-', dir=target.parent))
    suffix = secrets.token_hex(6)
    mysql = 'yueji-verify-mysql-' + suffix
    minio = 'yueji-verify-minio-' + suffix
    network = 'yueji-verify-' + suffix
    containers = []
    network_created = False
    try:
        with tarfile.open(target/'configuration.tar.gz') as archive:
            archive.extractall(root/'configuration', filter='data')
        assert (root/'configuration/opt/yueji/shared/backend.env').is_file()
        env = dict(os.environ, MYSQL_ROOT_PASSWORD=secrets.token_hex(24))
        backup.run(['docker','run','-d','--pull','never','--name',mysql,'--network','none',
                    '--memory','512m','--memory-swap','512m','--cpus','0.5',
                    '--env','MYSQL_ROOT_PASSWORD',
                    inventory['mysql_image'],'--innodb-buffer-pool-size=64M',
                    '--skip-log-bin','--max-connections=10'], env=env)
        containers.append(mysql)
        for attempt in range(120):
            try:
                backup.sql('SELECT 1;', mysql)
                break
            except RuntimeError:
                if attempt == 119:
                    raise
                time.sleep(1)
        with gzip.open(target/'database.sql.gz', 'rb') as dump:
            backup.run(['docker','exec','-i',mysql,'sh','-c',
                        'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; exec mysql -u root'],
                       input=dump.read(), timeout=180)
        assert backup.db_inventory(mysql) == inventory['database'], 'Restored database differs'
        if len(sys.argv) == 3:
            migration_spec = importlib.util.spec_from_file_location('database_release', Path(__file__).with_name('database-release.py'))
            migrations = importlib.util.module_from_spec(migration_spec)
            migration_spec.loader.exec_module(migrations)
            migration_root, manifest, entries = migrations.load_release(sys.argv[2])
            migrations.migrate(mysql, migration_root, manifest, entries)
            migrations.migrate(mysql, migration_root, manifest, entries)
            after = {table: count for table, count, _ in backup.db_inventory(mysql)}
            allowed_increases = {table for entry in entries for table in entry.get('allowRowIncrease', [])}
            for table, count, _ in inventory['database']:
                if table != migrations.HISTORY:
                    actual = after.get(table, -1)
                    assert actual >= count if table in allowed_increases else actual == count, 'Migration changed existing table row counts: '+table
            print('DATABASE_MIGRATION_REHEARSAL_OK', flush=True)
        backup.run(['docker','rm','-f','-v',mysql])
        containers.remove(mysql)
        with tarfile.open(target/'uploads.tar.gz') as archive:
            archive.extractall(root, filter='data')
        source = json.loads(backup.run(['docker','inspect',backup.MINIO]))[0]
        values = dict(item.split('=',1) for item in source['Config']['Env'] if '=' in item)
        env = dict(os.environ, MINIO_ROOT_USER=values['MINIO_ROOT_USER'],
                   MINIO_ROOT_PASSWORD=values['MINIO_ROOT_PASSWORD'])
        backup.run(['docker','network','create','--internal',network])
        network_created = True
        backup.run(['docker','run','-d','--pull','never','--name',minio,'--network',network,
                    '--memory','256m','--memory-swap','256m','--cpus','0.5',
                    '--env','MINIO_ROOT_USER','--env','MINIO_ROOT_PASSWORD',
                    '--mount',f'type=bind,src={root}/minio-data,dst=/data',
                    inventory['minio_image'],'server','/data'], env=env)
        containers.append(minio)
        info = json.loads(backup.run(['docker','inspect',minio]))[0]
        host = info['NetworkSettings']['Networks'][network]['IPAddress']
        for attempt in range(30):
            try:
                objects = backup.minio_inventory(info, host)
                break
            except RuntimeError:
                if attempt == 29:
                    raise
                time.sleep(1)
        assert objects == inventory['minio'], 'Restored files differ'
        result = {'restore':'passed','tables':len(inventory['database']),
                  'rows':sum(row[1] for row in inventory['database']),
                  'buckets':len(objects),'objects':sum(len(bucket[1]) for bucket in objects)}
        if not uploaded:
            (target/'restore-verification.json').write_text(json.dumps(result, indent=2)+'\n')
            manifest['restore_verification'] = 'passed'
            (target/'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
        print(json.dumps(result), flush=True)
    finally:
        # Remove only resources created by this invocation, including anonymous MySQL volumes.
        cleanup_errors = []
        for name in containers:
            try:
                backup.run(['docker','rm','-f','-v',name])
            except Exception:
                cleanup_errors.append(name)
        if network_created:
            try:
                backup.run(['docker','network','rm',network])
            except Exception:
                cleanup_errors.append(network)
        if not cleanup_errors:
            shutil.rmtree(root)
        else:
            raise RuntimeError('Temporary restore resources need cleanup')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'restore':'failed','error_type':type(error).__name__}), file=sys.stderr)
        sys.exit(1)
