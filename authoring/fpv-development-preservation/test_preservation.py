import hashlib
import io
import json
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest

from pack import safe_relative, privacy_hold, pack_part
from verify_upload import restore_part
from restore import link_target, restore
from build_index import build


class PreservationTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix='preservation-check-'))

    def test_refuses_traversal_and_private_browser_history(self):
        for path in ['../outside', '/absolute', 'a/../../outside', 'a\\outside']:
            with self.assertRaises(ValueError):
                safe_relative(path)
        self.assertTrue(privacy_hold('capture/IndexedDB/records'))
        self.assertTrue(privacy_hold('coupa/private.json'))
        self.assertTrue(privacy_hold('codex-history.json'))
        self.assertIsNone(privacy_hold('game/live-session.mjs'))

    def test_real_part_roundtrip_and_tampered_header_refusal(self):
        source, stage, receipts = [self.root / x for x in ['source', 'parts', 'receipts']]
        for p in [source, stage, receipts]:
            p.mkdir()
        raw = b'actual preservation boundary\0' * 1000
        path = source / 'original.bin'
        path.write_bytes(raw)
        sha = hashlib.sha256(raw).hexdigest()
        row = {'path': path.name, 'bytes': len(raw), 'sha256': sha,
               'mtime_ns': path.stat().st_mtime_ns, 'mode': 0o644}
        plan = [{'sha256': sha, 'bytes': len(raw), 'candidates': [row]}]
        receipt = pack_part(source, stage, receipts, 1, plan)
        result = restore_part(Path(receipt['archive']), self.root / 'restored', receipt['partManifest'])
        self.assertEqual(result['members'], 1)
        self.assertEqual((self.root / 'restored/objects' / sha).read_bytes(), raw)
        bad = dict(receipt['partManifest'], number=2)
        with self.assertRaisesRegex(ValueError, 'header differs'):
            restore_part(Path(receipt['archive']), self.root / 'bad-header', bad)
        with self.assertRaises(FileExistsError):
            restore_part(Path(receipt['archive']), self.root / 'restored', receipt['partManifest'])

    def test_refuses_source_changed_since_inventory(self):
        source, stage, receipts = [self.root / x for x in ['source', 'parts', 'receipts']]
        for p in [source, stage, receipts]:
            p.mkdir()
        path = source / 'original.bin'
        path.write_bytes(b'original')
        row = {'path': path.name, 'bytes': 8, 'sha256': hashlib.sha256(b'original').hexdigest(),
               'mtime_ns': path.stat().st_mtime_ns, 'mode': 0o644}
        path.write_bytes(b'replaced')
        with self.assertRaisesRegex(ValueError, 'unchanged source'):
            pack_part(source, stage, receipts, 1,
                      [{'sha256': row['sha256'], 'bytes': 8, 'candidates': [row]}])
        self.assertFalse((receipts / 'part-0001-local.json').exists())

    def test_rewrites_internal_links_and_reports_external_or_traversing_links(self):
        source = '/old/source'
        self.assertEqual(link_target('a/link', '/old/source/maps/file', source), ('maps/file', None))
        self.assertEqual(link_target('a/link', '../maps/file', source), ('maps/file', None))
        for value in ['/outside/private', '../../outside', '/old/source/a/../../outside']:
            target, reason = link_target('a/link', value, source)
            self.assertIsNone(target)
            self.assertTrue(reason)

    def test_restores_relative_files_and_refuses_existing_output(self):
        cache = self.root / 'cache'
        cache.mkdir()
        raw = b'portable bytes'
        sha = hashlib.sha256(raw).hexdigest()
        asset = {'assetId': 1, 'sha256': sha, 'bytes': len(raw)}
        (cache / ('asset-1-' + sha)).write_bytes(raw)
        index = {'format': 'FPVPreservationIndex.v1', 'repo': 'example/example', 'sourceRoot': '/old/source',
                 'coverageComplete': True,
                 'parts': {}, 'directAssets': {sha: asset},
                 'files': [{'path': 'maps/example.bin', 'bytes': len(raw), 'sha256': sha,
                            'mode': 0o644, 'mtime_ns': 1_000_000_000}],
                 'symlinks': [{'path': 'shortcut', 'target': '/old/source/maps/example.bin'}]}
        destination = self.root / 'portable'
        result = restore(index, cache, destination, self.root / 'restore-receipt.json')
        self.assertTrue(result['complete'])
        self.assertEqual((destination / 'maps/example.bin').read_bytes(), raw)
        self.assertEqual((destination / 'shortcut').read_bytes(), raw)
        self.assertFalse((destination / 'shortcut').readlink().is_absolute())
        with self.assertRaises(FileExistsError):
            restore(index, cache, destination, self.root / 'repeat.json')

    def test_refuses_malicious_part_header_and_cache_symlink_parent(self):
        bad = {'format': 'FPVCASPart.v1', 'number': 1,
               'objects': [{'member': '../outside', 'sha256': 'a' * 64, 'bytes': 1}]}
        with self.assertRaisesRegex(ValueError, 'Unsafe'):
            restore_part(self.root / 'unused.zst', self.root / 'bad', bad)
        actual = self.root / 'actual-cache'
        actual.mkdir()
        link = self.root / 'cache-link'
        link.symlink_to(actual)
        index = {'format': 'FPVPreservationIndex.v1', 'parts': {}, 'files': [], 'repo': 'example/example'}
        with self.assertRaisesRegex(ValueError, 'symlink'):
            restore(index, link / 'child', self.root / 'output', self.root / 'receipt.json')

    def test_partial_inventory_never_claims_complete_restore(self):
        index = {'format': 'FPVPreservationIndex.v1', 'parts': {}, 'files': [], 'repo': 'example/example',
                 'coverageComplete': False, 'inventoryComplete': False}
        result = restore(index, self.root / 'cache', self.root / 'partial', self.root / 'receipt.json')
        self.assertFalse(result['complete'])

    def test_unresolved_internal_link_keeps_restore_incomplete(self):
        index = {'format': 'FPVPreservationIndex.v1', 'parts': {}, 'files': [], 'repo': 'example/example',
                 'coverageComplete': True, 'sourceRoot': '/old/root',
                 'symlinks': [{'path': 'missing-dependency', 'target': '/old/root/not-in-backup'}]}
        result = restore(index, self.root / 'cache', self.root / 'partial', self.root / 'receipt.json')
        self.assertFalse(result['complete'])
        self.assertEqual(len(result['unresolvedInternalLinks']), 1)

    def test_index_reuses_verified_objects_but_holds_unreviewed_duplicate_content(self):
        sha = hashlib.sha256(b'same bytes').hexdigest()
        rows = [{'kind': 'file', 'path': path, 'bytes': 10, 'sha256': sha, 'mode': 420,
                 'mtime_ns': 100, 'review': []} for path in ['safe.bin', 'coupa/unreviewed.bin']]
        inventory, state, catalogue, direct = [self.root / x for x in ['inventory.jsonl', 'state.json', 'catalogue.json', 'library.json']]
        inventory.write_text(''.join(json.dumps(r) + '\n' for r in rows))
        state.write_text(json.dumps({'complete': False}))
        catalogue.write_text(json.dumps({'releases': []}))
        direct.write_text(json.dumps({'archives': [{'preserved': True, 'serverDigest': 'sha256:' + sha,
            'sha256': sha, 'bytes': 10, 'serverBytes': 10, 'assetID': 123, 'assetName': 'original',
            'assetURL': 'https://example.invalid/original', 'fullReadback': {'sha256': sha, 'bytes': 10}}]}))
        result = build([inventory], state, [], [direct], catalogue, '/old/root')
        self.assertEqual(len(result['held']), 2)
        self.assertEqual(len(result['files']), 0)
        approved = [{'path': 'coupa/unreviewed.bin', 'sha256': sha, 'decision': 'allow-app-archive'}]
        result = build([inventory], state, [], [direct], catalogue, '/old/root', approved)
        self.assertEqual(len(result['files']), 2)
        self.assertEqual(len(result['directAssets']), 1)
        self.assertFalse(result['coverageComplete'])


if __name__ == '__main__':
    unittest.main()
