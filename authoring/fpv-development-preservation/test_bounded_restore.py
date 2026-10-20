import copy
import hashlib
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from bounded_restore import canonical_sha, collect, graph, plan, probe_links, run
from github_dependencies import from_reviewed_recipe, git_identity, manifest_tree
from restore import restore, disk_preflight
from portable_restore_check import verify


class BoundedRestoreTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix='bounded-preservation-check-'))
        self.raw = b'known immutable bytes'
        self.sha = hashlib.sha256(self.raw).hexdigest()
        self.index = {'format': 'FPVPreservationIndex.v1', 'repo': 'example/example',
                      'sourceRoot': '/historical/source', 'coverageComplete': False, 'parts': {},
                      'directAssets': {self.sha: {'assetId': 1, 'sha256': self.sha, 'bytes': len(self.raw)}},
                      'files': [{'path': 'payload/' + str(n), 'bytes': len(self.raw), 'sha256': self.sha,
                                 'mode': 0o644, 'mtime_ns': 1_500_000_000_000_000_000} for n in range(5)],
                      'symlinks': [{'path': 'links/alias', 'target': '/historical/source/payload'},
                                   {'path': 'chain', 'target': 'links/alias'}]}

    def test_bounded_split_restores_every_path_once_and_checks_collection(self):
        budget = 256 * 1024 ** 2 + len(self.raw) + 2 * (len(self.raw) + 8192)
        sealed = plan(self.index, 'a' * 64, budget)
        self.assertEqual([len(p['paths']) for p in sealed['partitions']], [2, 2, 1])
        source = self.root / 'actual-fixture'
        source.write_bytes(self.raw)
        receipts = []
        for part in sealed['partitions']:
            work = self.root / part['id']
            with patch('restore.obtain_asset', return_value=source):
                receipts.append(run(self.index, 'a' * 64, sealed, part['id'], work,
                                    self.root / (part['id'] + '.json')))
            for path in part['paths']:
                self.assertEqual((work / 'logical-files' / path).read_bytes(), self.raw)
        result = collect(self.index, 'a' * 64, sealed, receipts)
        self.assertTrue(result['everyIndexedLogicalFileRestoredAndRehashed'])
        self.assertFalse(result['oneShotMaterializationPerformed'])
        self.assertFalse(result['inventoryCoverageComplete'])
        for broken in [receipts[:-1], receipts + [receipts[0]],
                       [dict(receipts[0], selectedRowsSHA256='b' * 64), *receipts[1:]]]:
            with self.assertRaises(ValueError):
                collect(self.index, 'a' * 64, sealed, broken)

    def test_disk_guard_and_tampered_plan_refuse_before_any_download(self):
        sealed = plan(self.index, 'a' * 64)
        with patch('bounded_restore.shutil.disk_usage') as disk, patch('restore.obtain_asset') as download:
            disk.return_value.free = 1
            with self.assertRaisesRegex(ValueError, 'Insufficient'):
                run(self.index, 'a' * 64, sealed, 'partition-0000', self.root / 'no-space', self.root / 'no.json')
            download.assert_not_called()
            self.assertFalse((self.root / 'no-space').exists())
        tampered = copy.deepcopy(sealed)
        tampered['partitions'][0]['paths'].pop()
        with self.assertRaisesRegex(ValueError, 'differs'):
            run(self.index, 'a' * 64, tampered, 'partition-0000', self.root / 'tampered', self.root / 'bad.json')
        with self.assertRaisesRegex(ValueError, 'single path'):
            plan(self.index, 'a' * 64, 1)

    def test_whole_restore_checks_space_before_download_or_destination_creation(self):
        with patch('restore.shutil.disk_usage') as disk, patch('restore.obtain_asset') as download:
            disk.return_value.free = 1
            with self.assertRaisesRegex(ValueError, 'Insufficient'):
                restore(self.index, self.root / 'low-cache', self.root / 'low-target', self.root / 'no.json')
            download.assert_not_called()
            self.assertFalse((self.root / 'low-cache').exists())
            self.assertFalse((self.root / 'low-target').exists())
        checked = disk_preflight(self.index, self.root / 'cache', self.root / 'target')
        self.assertEqual(checked['cacheEstimatedBytes'], len(self.raw))
        self.assertEqual(checked['logicalCopyEstimatedBytes'], len(self.raw) * 5)
        self.assertGreater(checked['estimatedPeakBytes'], len(self.raw) * 6)

    def test_full_restore_requires_final_inventory_and_checks_actual_all_path_layout(self):
        with patch('restore.obtain_asset') as download:
            with self.assertRaisesRegex(ValueError, 'root-confirmed'):
                verify(self.index, 'a' * 64, self.root / 'unfinished', self.root / 'no.json')
            download.assert_not_called()
            self.assertFalse((self.root / 'unfinished').exists())
        final = dict(self.index, coverageComplete=True, inventorySetFinal=True, inventoryComplete=True)
        source = self.root / 'actual-fixture'
        source.write_bytes(self.raw)
        with patch('restore.obtain_asset', return_value=source):
            result = verify(final, 'a' * 64, self.root / 'full', self.root / 'full.json')
        self.assertTrue(result['oneShotPayloadMaterializationPerformed'])
        self.assertTrue(result['inventoriedPayloadPortableRestoreComplete'])
        self.assertEqual(result['logicalFilePaths'], 5)
        self.assertEqual(result['actualRelativeLinksVerified'], 2)
        self.assertEqual(result['linkDispositionsSHA256'], graph(final)['linkDispositionsSHA256'])
        self.assertFalse(result['overallDisconnectSafetyClaimed'])
        with patch('restore.obtain_asset', return_value=source), patch('restore.os.utime'):
            with self.assertRaisesRegex(ValueError, 'metadata differs'):
                restore(final, self.root / 'metadata-cache', self.root / 'metadata-target', self.root / 'bad.json')

    def test_actual_relative_link_layout_and_conflict_loop_escape_refusals(self):
        checked = graph(self.index)
        self.assertEqual(checked['symlinks'], 2)
        self.assertEqual(checked['linkDispositionsSHA256'], canonical_sha(checked['linkDispositions']))
        self.assertNotIn('pathAndLinkGraphSHA256', checked)
        result = probe_links(self.index, 'a' * 64, self.root / 'layout')
        self.assertTrue(result['allLinksResolveWithinChosenRoot'])
        self.assertFalse(result['payloadBytesVerifiedByThisProbe'])
        self.assertEqual((self.root / 'layout/chain/0').read_bytes(), b'')
        for links in [[{'path': 'payload', 'target': 'elsewhere'}],
                      [{'path': 'cycle-a', 'target': 'cycle-b'}, {'path': 'cycle-b', 'target': 'cycle-a'}],
                      [{'path': 'outside', 'target': '/private/missing'}],
                      [{'path': 'missing', 'target': 'not-selected'}]]:
            bad = copy.deepcopy(self.index)
            bad['symlinks'] = links
            with self.assertRaises(ValueError):
                graph(bad)

    def test_recipe_binds_captured_target_and_published_commit_subtree(self):
        target = '/outside/reviewed-original'
        target_sha = hashlib.sha256(target.encode()).hexdigest()
        row = {'path': 'known.bin', 'bytes': len(self.raw), 'sha256': self.sha,
               'gitBlobSHA1': git_identity('blob', self.raw), 'mode': '100644'}
        tree, _ = manifest_tree([row])
        source = {'repository': 'example/example', 'commit': 'a' * 40, 'subtree': 'reviewed/tree',
                  'treeGitSHA1': tree, 'files': 1, 'bytes': len(self.raw)}
        recipe = {'format': 'FPVAppReviewPortableLinkMapping.v1',
                  'mapping': {'linkPathRelativeToNewRestoreRoot': 'review/link',
                              'newTargetRelativeToNewRestoreRoot': 'dependencies/known',
                              'originalTargetSHA256': target_sha, 'payloadSource': source}}
        coverage = {'allFilesTrackedAndMatchPublishedGitHubTree': True, 'sourceRepository': 'example/example',
                    'sourceCommit': 'b' * 40, 'sourceSubtree': 'reviewed/tree', 'sourceTreeGitSHA1': tree,
                    'files': [row], 'targetFiles': 1, 'originalTargetSHA256': target_sha,
                    'additionalPublishedExactTreeBindings': [{'commit': 'a' * 40, 'subtree': 'reviewed/tree',
                                                              'treeGitSHA1': tree, 'exactTreeMatch': True}]}
        links = [{'path': 'review/link', 'target': target}]
        self.assertEqual(from_reviewed_recipe(recipe, coverage, links)['originalTargetExact'], target)
        for bad_links, bad_coverage in [([dict(links[0], target='/wrong/captured-target')], coverage),
                                       (links, dict(coverage, originalTargetSHA256='c' * 64)),
                                       (links, dict(coverage, sourceSubtree='wrong/subtree')),
                                       (links, dict(coverage, additionalPublishedExactTreeBindings=[]))]:
            with self.assertRaisesRegex(ValueError, 'disagree'):
                from_reviewed_recipe(recipe, bad_coverage, bad_links)


if __name__ == '__main__':
    unittest.main()
