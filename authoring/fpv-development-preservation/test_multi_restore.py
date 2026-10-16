import copy
import hashlib
import json
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from multi_restore_check import EXPECTED, estimate_set, load_set, verify_set
from portable_restore_check import verify
from verify_upload import REPO


class MultiRestoreTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix='multi-preservation-check-'))
        self.raw = b'actual shared immutable object'
        self.sha = hashlib.sha256(self.raw).hexdigest()
        self.rollup = {'format': 'FPVPublicPayloadRestoreSet.v1', 'rootConfirmedPublicInputSet': True, 'indexes': []}
        for name, (filename, source_root) in EXPECTED.items():
            index = {'format': 'FPVPreservationIndex.v1', 'repo': REPO, 'sourceRoot': source_root,
                     'coverageComplete': True, 'inventoryComplete': True, 'inventorySetFinal': True,
                     'parts': {}, 'directAssets': {self.sha: {'assetId': 1, 'sha256': self.sha, 'bytes': len(self.raw)}},
                     'files': [{'path': 'payload/file.bin', 'sha256': self.sha, 'bytes': len(self.raw),
                                'mode': 0o644, 'mtime_ns': 1_500_000_000_000_000_000}],
                     'symlinks': [{'path': 'alias', 'target': source_root + '/payload/file.bin'}]}
            sha = self.write_json(filename, index)
            self.rollup['indexes'].append({'name': name, 'file': filename, 'sourceRoot': source_root, 'sha256': sha})
        self.write_json('preservation-rollup.json', self.rollup)

    def write_json(self, filename, value):
        path = self.root / filename
        raw = (json.dumps(value, sort_keys=True) + '\n').encode()
        path.write_bytes(raw)
        os.utime(path, ns=(1_500_000_000_000_000_000, 1_500_000_000_000_000_000))
        return hashlib.sha256(raw).hexdigest()

    def download(self, command, stdout):
        self.assertEqual(command[-1], 'repos/' + REPO + '/releases/assets/1')
        stdout.write(self.raw)
        return SimpleNamespace(returncode=0)

    def test_two_real_namespace_restores_download_shared_asset_only_once(self):
        entries, sha = load_set(self.root / 'preservation-rollup.json')
        estimate = estimate_set(entries)
        self.assertEqual(estimate['uniqueAssetCacheFiles'], 1)
        self.assertEqual(estimate['cacheEstimatedBytes'], len(self.raw))
        self.assertEqual(estimate['logicalCopyEstimatedBytes'], 2 * len(self.raw))
        with patch('restore.subprocess.run', side_effect=self.download) as network:
            result = verify_set(entries, sha, self.root / 'output', self.root / 'verified.json')
        self.assertEqual(network.call_count, 1)
        self.assertTrue(result['allApprovedPublicPayloadIndexesRestored'])
        self.assertFalse(result['overallDisconnectSafetyClaimed'])
        for name in EXPECTED:
            self.assertEqual((self.root / 'output' / name / 'logical-files/alias').read_bytes(), self.raw)
        self.assertTrue(all(r['sharedVerifiedCacheUsed'] for r in result['indexes']))

    def test_set_rejects_hash_namespace_approval_and_partial_index_before_download(self):
        for change in ['hash', 'path', 'namespace', 'approval', 'partial']:
            rollup = copy.deepcopy(self.rollup)
            if change == 'hash':
                rollup['indexes'][0]['sha256'] = 'a' * 64
            elif change == 'path':
                rollup['indexes'][0]['file'] = '../not-an-approved-index.json'
            elif change == 'namespace':
                rollup['indexes'][0]['name'] = 'outside'
            elif change == 'approval':
                rollup['rootConfirmedPublicInputSet'] = False
            else:
                index = json.loads((self.root / 'preservation-index.json').read_text())
                index['inventorySetFinal'] = False
                rollup['indexes'][0]['sha256'] = self.write_json('preservation-index.json', index)
            self.write_json('candidate.json', rollup)
            with patch('restore.subprocess.run') as network:
                with self.assertRaises(ValueError):
                    load_set(self.root / 'candidate.json')
                network.assert_not_called()

    def test_combined_space_and_asset_conflicts_refuse_before_work_or_network(self):
        entries, sha = load_set(self.root / 'preservation-rollup.json')
        with patch('multi_restore_check.shutil.disk_usage') as disk, patch('restore.subprocess.run') as network:
            disk.return_value.free = 1
            with self.assertRaisesRegex(ValueError, 'Insufficient'):
                verify_set(entries, sha, self.root / 'low-space', self.root / 'no.json')
            network.assert_not_called()
            self.assertFalse((self.root / 'low-space').exists())
        bad = copy.deepcopy(entries)
        asset = bad[1]['index']['directAssets'].pop(self.sha)
        asset['sha256'] = 'b' * 64
        bad[1]['index']['directAssets']['b' * 64] = asset
        with self.assertRaisesRegex(ValueError, 'contradictory'):
            estimate_set(bad)

    def test_tampered_shared_cache_is_rejected_without_overwrite(self):
        entries, sha = load_set(self.root / 'preservation-rollup.json')
        counter = 0

        def actual_then_tamper(*args, **kwargs):
            nonlocal counter
            result = verify(*args, **kwargs)
            counter += 1
            if counter == 1:
                (self.root / 'output/shared-cache' / ('asset-1-' + self.sha)).write_bytes(b'corrupt')
            return result

        with (patch('restore.subprocess.run', side_effect=self.download) as network,
              patch('multi_restore_check.verify', side_effect=actual_then_tamper)):
            with self.assertRaisesRegex(ValueError, 'cache differs'):
                verify_set(entries, sha, self.root / 'output', self.root / 'no-global-success.json')
        self.assertEqual(network.call_count, 1)
        self.assertFalse((self.root / 'no-global-success.json').exists())
        self.assertEqual((self.root / 'output/shared-cache' / ('asset-1-' + self.sha)).read_bytes(), b'corrupt')


if __name__ == '__main__':
    unittest.main()
