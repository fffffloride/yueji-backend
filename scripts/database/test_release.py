import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('release', ROOT/'deploy/aliyun-swas/database-release.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class HistoryTests(unittest.TestCase):
    def setUp(self):
        self.entries = [{'id': '202609160001_baseline', 'checksum': 'abc'}]

    def test_pending_migration_blocks_check(self):
        with self.assertRaisesRegex(RuntimeError, 'Unapplied'):
            release.check_history([], self.entries)

    def test_modified_failed_unknown_migrations_block_even_migrate(self):
        for row in [['202609160001_baseline', 'wrong', 'applied'],
                    ['202609160001_baseline', 'abc', 'running'],
                    ['209901010001_unknown', 'abc', 'applied']]:
            with self.subTest(row=row), self.assertRaises(RuntimeError):
                release.check_history([row], self.entries, allow_pending=True)

    def test_out_of_order_history_blocked(self):
        with self.assertRaises(RuntimeError):
            release.check_history([['202609160002_later', 'def', 'applied']], self.entries, True)

    def test_missing_column_is_detected_even_on_empty_table(self):
        contract = {'tables': [{'name': 'appointment_config', 'columns': [{'name': 'slot_capacity'}], 'indexes': []}]}
        with patch.object(release, 'rows', return_value=[]):
            self.assertEqual(release.contract_errors('test', contract), ['missing column: appointment_config.slot_capacity'])


if __name__ == '__main__':
    unittest.main()
