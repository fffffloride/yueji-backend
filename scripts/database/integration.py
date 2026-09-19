#!/usr/bin/env python3
"""Disposable real-MySQL tests; never connect to a user or production database."""
import importlib.util
import json
from pathlib import Path
import secrets
import subprocess
import tempfile
import time
import shutil
import os

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('release', ROOT/'deploy/aliyun-swas/database-release.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


def rejected(action, message):
    try:
        action()
    except (RuntimeError, AssertionError):
        print('EXPECTED_REJECTION '+message, flush=True)
    else:
        raise AssertionError('Gate did not reject: '+message)


def main():
    name = 'yueji-schema-test-'+secrets.token_hex(6)
    redis = name+'-redis'
    password = secrets.token_hex(24)
    root, manifest, entries = release.load_release(ROOT/'dist/database-release')
    subprocess.run(['docker', 'run', '-d', '--name', name, '-p', '127.0.0.1::3306',
                    '--memory', '768m', '--env', 'MYSQL_ROOT_PASSWORD='+password,
                    '--env', 'MYSQL_DATABASE=youlai_admin', 'mysql:8.0',
                    '--innodb-buffer-pool-size=64M', '--skip-log-bin'], check=True, capture_output=True)
    try:
        for attempt in range(90):
            try:
                release.sql(name, 'SELECT 1;')
                break
            except RuntimeError:
                if attempt == 89:
                    raise
                time.sleep(1)
        release.migrate(name, root, manifest, entries, bootstrap=True)
        print('EMPTY_DATABASE_UPGRADE_OK', flush=True)
        release.sql(name, 'UPDATE appointment_config SET slot_capacity=7 WHERE id=1;')
        release.migrate(name, root, manifest, entries)
        assert release.sql(name, 'SELECT slot_capacity FROM appointment_config WHERE id=1;') == '7'
        # Simulate legacy state, including the historical missing audit columns.
        release.sql(name, 'DROP TABLE yueji_schema_history,decoration_home_cards,decoration_promo_cards,agreement; ALTER TABLE sys_user_social DROP COLUMN create_by, DROP COLUMN update_by, DROP COLUMN is_deleted;')
        release.migrate(name, root, manifest, entries)
        release.migrate(name, root, manifest, entries)
        assert release.sql(name, 'SELECT slot_capacity FROM appointment_config WHERE id=1;') == '7'
        print('LEGACY_ADOPTION_PRESERVES_DATA_OK', flush=True)
        subprocess.run(['docker', 'run', '-d', '--name', redis, '-p', '127.0.0.1::6379', 'redis:7.2.3'], check=True, capture_output=True)
        def port(container, internal):
            info = json.loads(subprocess.check_output(['docker', 'inspect', container]))[0]
            return info['NetworkSettings']['Ports'][internal+'/tcp'][0]['HostPort']
        release.sql(name, "INSERT INTO member(id,openid,nickname) VALUES(90001,'schema-test','schema-test'); INSERT INTO biz_order(id,order_no,member_id,beneficiary_member_id,status) VALUES(90001,'schema-test',90001,90001,4);")
        with tempfile.TemporaryDirectory() as local_storage:
            env = dict(os.environ, NODE_ENV='prod', DATABASE_SMOKE_TEST='disposable',
                       MYSQL_HOST='127.0.0.1', MYSQL_PORT=port(name,'3306'), MYSQL_USER='root',
                       MYSQL_PASSWORD=password, MYSQL_DB='youlai_admin',
                       REDIS_HOST='127.0.0.1', REDIS_PORT=port(redis,'6379'), REDIS_PASSWORD='',
                       REDIS_DB='0', JWT_SECRET_KEY=secrets.token_hex(32), JWT_EXPIRES_IN='3600',
                       JWT_ISSUER='schema-test', SESSION_TYPE='jwt', PAYMENT_DRIVER='disabled',
                       MOCK_LOGIN_ENABLED='false', SWAGGER_ENABLED='false', OSS_TYPE='local',
                       OSS_LOCAL_STORAGE_PATH=local_storage, TYPEORM_LOGGING='false')
            subprocess.run(['node', str(ROOT/'scripts/database/smoke.cjs')], env=env, cwd=ROOT, check=True, timeout=90)
        rejected(lambda: release.migrate(name, root, manifest, entries, bootstrap=True), 'bootstrap on populated database')
        release.sql(name, "UPDATE yueji_schema_history SET status='running';")
        rejected(lambda: release.migrate(name, root, manifest, entries), 'incomplete DDL')
        release.sql(name, "UPDATE yueji_schema_history SET status='applied';")
        release.sql(name, "ALTER TABLE appointment DROP INDEX uk_appointment_active_order;")
        rejected(lambda: release.validate(name, root), 'missing required unique index')
        release.sql(name, "ALTER TABLE appointment ADD UNIQUE INDEX uk_appointment_active_order(active_order_id);")
        release.sql(name, 'RENAME TABLE appointment_config TO appointment_config_missing;')
        rejected(lambda: release.validate(name, root), 'missing appointment_config')
        release.sql(name, 'RENAME TABLE appointment_config_missing TO appointment_config;')
        release.sql(name, 'ALTER TABLE biz_order RENAME COLUMN beneficiary_member_id TO beneficiary_missing;')
        rejected(lambda: release.validate(name, root), 'missing order column')
        release.sql(name, 'ALTER TABLE biz_order RENAME COLUMN beneficiary_missing TO beneficiary_member_id;')
        with tempfile.TemporaryDirectory() as temp:
            upgraded = Path(temp)/'release'
            shutil.copytree(root, upgraded)
            (upgraded/'migrations').mkdir(exist_ok=True)
            migration_path = 'migrations/202609200001_probe.sql'
            payload = b'CREATE TABLE schema_upgrade_probe(id int PRIMARY KEY); INSERT INTO schema_upgrade_probe VALUES(1);'
            (upgraded/migration_path).write_bytes(payload)
            changed = json.loads((upgraded/'manifest.json').read_text())
            changed['migrations'].append({'id':'202609200001_probe','backwardCompatible':True,
                'files':[{'path':migration_path,'sha256':release.digest(payload)}]})
            (upgraded/'manifest.json').write_text(json.dumps(changed))
            new_root, new_manifest, new_entries = release.load_release(upgraded)
            rejected(lambda: release.check_history(release.history(name),new_entries), 'unapplied new migration')
            release.migrate(name,new_root,new_manifest,new_entries)
            release.migrate(name,new_root,new_manifest,new_entries)
            assert release.sql(name,'SELECT COUNT(*) FROM schema_upgrade_probe;') == '1'
            print('VERSIONED_INCREMENTAL_UPGRADE_OK', flush=True)
        release.sql(name, 'DELETE FROM appointment_config;')
        rejected(lambda: release.validate(name, root), 'missing seed configuration')
        with tempfile.TemporaryDirectory() as temp:
            shutil.copytree(root, Path(temp)/'release')
            schema = Path(temp)/'release/baseline/schema.sql'
            schema.write_bytes(schema.read_bytes()+b'\n-- tampered\n')
            rejected(lambda: release.load_release(Path(temp)/'release'), 'modified immutable migration')
        print('DATABASE_INTEGRATION_OK', flush=True)
    finally:
        subprocess.run(['docker', 'rm', '-f', '-v', redis], capture_output=True)
        subprocess.run(['docker', 'rm', '-f', '-v', name], check=True, capture_output=True)


if __name__ == '__main__':
    main()
