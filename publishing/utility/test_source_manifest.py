import copy
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

import source_manifest as manifest


class SourceManifestTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.repo = Path(self.temporary.name)
        self.git('init', '-q')
        self.git('config', 'user.email', 'fixture@example.invalid')
        self.git('config', 'user.name', 'Fixture')
        (self.repo / 'plain.txt').write_bytes(b'hello\x00world')
        (self.repo / 'executable').write_text('#!/bin/sh\nexit 0\n')
        os.chmod(self.repo / 'executable', 0o755)
        (self.repo / 'link').symlink_to('plain.txt')
        self.git('add', '.')
        self.git('commit', '-qm', 'fixture')
        self.commit = self.git('rev-parse', 'HEAD').strip()
        self.value = manifest.source_manifest(self.repo, self.commit)

    def git(self, *args):
        return subprocess.check_output(['git', '-C', str(self.repo), *args], text=True)

    def test_deterministic_modes_symlink_and_dirty_checkout(self):
        rows = {row['path']: row for row in self.value['files']}
        self.assertEqual(rows['executable']['mode'], '100755')
        self.assertEqual(rows['link']['mode'], '120000')
        self.assertEqual(rows['link']['bytes'], len('plain.txt'))
        (self.repo / 'plain.txt').write_text('unrelated dirty checkout')
        body = manifest.encoded(self.value)
        self.assertTrue(manifest.verify_manifest(body, self.repo, self.commit)['allGitBlobContentsAndModesVerified'])
        self.assertEqual(body, manifest.encoded(manifest.source_manifest(self.repo, self.commit)))

    def test_missing_extra_modified_modes_and_order_fail(self):
        variants = []
        value = copy.deepcopy(self.value); value['files'].pop(); variants.append(value)
        value = copy.deepcopy(self.value); value['files'].append(value['files'][0]); variants.append(value)
        value = copy.deepcopy(self.value); value['files'][0]['sha256'] = '0' * 64; variants.append(value)
        value = copy.deepcopy(self.value); value['files'][0]['mode'] = '100644'; variants.append(value)
        value = copy.deepcopy(self.value); value['files'].reverse(); variants.append(value)
        value = copy.deepcopy(self.value); value['extra'] = True; variants.append(value)
        for value in variants:
            with self.subTest(value=value), self.assertRaises(ValueError):
                manifest.verify_manifest(manifest.encoded(value), self.repo, self.commit)

    def test_wrong_commit_tree_and_gitlinks_fail(self):
        with self.assertRaises(ValueError):
            manifest.verify_manifest(manifest.encoded(self.value), self.repo, self.commit, '0' * 40)
        self.git('update-index', '--add', '--cacheinfo', f'160000,{self.commit},external')
        self.git('commit', '-qm', 'gitlink')
        with self.assertRaisesRegex(ValueError, 'Unsupported Git mode'):
            manifest.source_manifest(self.repo, self.git('rev-parse', 'HEAD').strip())


if __name__ == '__main__':
    unittest.main()
