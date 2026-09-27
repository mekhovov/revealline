import copy
import unittest
from verify_frozen_offline import verify_optional_inventory

class OptionalInventoryTests(unittest.TestCase):
    def setUp(self):
        self.rows = {'game/tool.html': {'path': 'game/tool.html', 'bytes': 30000, 'sha256': 'a' * 64}}
        self.offline = {'downloadFiles': [{**self.rows['game/tool.html'], 'kind': 'gameplay'}],
                        'optionalPacks': [{'path': 'game/tool.html', 'sha256': 'a' * 64}]}

    def test_exact_final_rows(self):
        self.assertEqual(verify_optional_inventory(self.offline, self.rows), 1)

    def test_stale_html_bytes_or_hash_fail(self):
        for key, value in [('bytes', 2119), ('sha256', 'b' * 64), ('bytes', True), ('bytes', 0)]:
            with self.subTest(key=key, value=value):
                bad = copy.deepcopy(self.offline)
                bad['downloadFiles'][0][key] = value
                with self.assertRaisesRegex(ValueError, 'Optional download differs'):
                    verify_optional_inventory(bad, self.rows)

    def test_missing_duplicate_and_wrong_kind_fail(self):
        for change in ['missing', 'duplicate', 'kind', 'absent', 'malformed']:
            with self.subTest(change=change):
                bad = copy.deepcopy(self.offline)
                if change == 'missing': bad['downloadFiles'][0]['path'] = 'missing'
                if change == 'duplicate': bad['downloadFiles'] *= 2
                if change == 'kind': bad['downloadFiles'][0]['kind'] = 'soundtrack'
                if change == 'absent': del bad['downloadFiles']
                if change == 'malformed': bad['downloadFiles'] = [None]
                with self.assertRaises(ValueError): verify_optional_inventory(bad, self.rows)

    def test_optional_pack_pins_fail_closed(self):
        for change in ['hash', 'missing', 'duplicate']:
            with self.subTest(change=change):
                bad = copy.deepcopy(self.offline)
                if change == 'hash': bad['optionalPacks'][0]['sha256'] = 'b' * 64
                if change == 'missing': bad['optionalPacks'][0]['path'] = 'missing'
                if change == 'duplicate': bad['optionalPacks'] *= 2
                with self.assertRaises(ValueError): verify_optional_inventory(bad, self.rows)

if __name__ == '__main__':
    unittest.main()
