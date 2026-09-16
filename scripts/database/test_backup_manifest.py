"""Exercise the whole restore verifier while replacing external containers."""
import ast
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
import types
import unittest
from unittest.mock import MagicMock, patch

ROOT = Path(__file__).resolve().parents[2]


class BackupManifestTests(unittest.TestCase):
    def test_migration_rehearsal_preserves_backup_manifest_for_upload(self):
        # Load the real main function without importing Linux-only backup helpers.
        tree = ast.parse((ROOT/'deploy/aliyun-swas/verify-backup.py').read_text())
        main = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == 'main')
        inventory = {'database': [['appointment', 90, 'checksum']], 'minio': [],
                     'mysql_image': 'mysql:test', 'minio_image': 'minio:test'}
        backup = types.SimpleNamespace(
            run=MagicMock(return_value=json.dumps([{'Config': {'Env': ['MINIO_ROOT_USER=test', 'MINIO_ROOT_PASSWORD=test']},
                'NetworkSettings': {'Networks': {}}}]).encode()),
            sql=MagicMock(return_value='1'), db_inventory=MagicMock(return_value=inventory['database']),
            minio_inventory=MagicMock(return_value=[]), digest=lambda _: 'sha', MINIO='test-minio')
        migration_manifest = {'format': 1, 'baseline': {'id': 'baseline'}, 'migrations': []}
        migrations = types.SimpleNamespace(HISTORY='yueji_schema_history',
            load_release=MagicMock(return_value=(Path('/release'), migration_manifest, [])),
            migrate=MagicMock())
        namespace = dict(globals(), backup=backup)
        exec(compile(ast.Module(body=[main], type_ignores=[]), '<real-verify-main>', 'exec'), namespace)
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder)/'full-20260916T000000Z'
            target.mkdir()
            original = {'created_utc': '20260916T000000Z', 'files': {'database.sql.gz': {'sha256': 'sha'}},
                        'production_health': 'passed', 'restore_verification': 'pending'}
            (target/'manifest.json').write_text(json.dumps(original))
            (target/'source-inventory.json').write_text(json.dumps(inventory))
            with gzip.open(target/'database.sql.gz', 'wb') as dump:
                dump.write(b'-- synthetic backup')
            archive = MagicMock()
            archive.__enter__.return_value = archive
            def extract(destination, **_):
                destination = Path(destination)
                (destination/'opt/yueji/shared').mkdir(parents=True, exist_ok=True)
                (destination/'opt/yueji/shared/backend.env').write_text('TEST=true')
            archive.extractall.side_effect = extract
            original_read = Path.read_text
            def read(path, *args, **kwargs):
                if str(path).replace('\\', '/') == '/proc/meminfo':
                    return 'MemAvailable: 99999999 kB'
                return original_read(path, *args, **kwargs)
            def run(args, **_):
                if args[:2] == ['docker', 'inspect']:
                    if args[2] == 'test-minio':
                        return json.dumps([{'Config': {'Env': ['MINIO_ROOT_USER=test', 'MINIO_ROOT_PASSWORD=test']}}]).encode()
                    return json.dumps([{'NetworkSettings': {'Networks': {namespace['last_network']: {'IPAddress': '127.0.0.1'}}}}]).encode()
                if args[:3] == ['docker', 'network', 'create']:
                    namespace['last_network'] = args[-1]
                return b''
            backup.run.side_effect = run
            with patch.object(sys, 'argv', ['verify', str(target), '/release']), \
                 patch.object(os, 'geteuid', return_value=0, create=True), \
                 patch.object(os, 'umask'), patch.object(signal, 'signal'), \
                 patch.object(re, 'fullmatch', return_value=True), \
                 patch.object(Path, 'read_text', read), \
                 patch.object(tarfile, 'open', return_value=archive), \
                 patch.object(importlib.util, 'spec_from_file_location', return_value=MagicMock()), \
                 patch.object(importlib.util, 'module_from_spec', return_value=migrations):
                namespace['main']()
            expected = dict(original, restore_verification='passed')
            self.assertEqual(json.loads((target/'manifest.json').read_text()), expected)
            self.assertEqual(migrations.migrate.call_count, 2)
            self.assertNotIn('restore_verification', migration_manifest)


if __name__ == '__main__':
    unittest.main()
