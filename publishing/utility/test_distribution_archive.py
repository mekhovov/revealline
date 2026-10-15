import hashlib
import io
import json
from pathlib import Path
import struct
import subprocess
import tempfile
import unittest
import zipfile
import zlib

import inspect_qualified_artifact as inspector
import test_release_artifact as legacy


CONTRACT = {'format': inspector.ARCHIVE_FORMAT, 'maxExpandedBytes': 1024 * inspector.CHUNK}
COMMIT, VERSION = 'a' * 40, 'v1.2.3'
encoded = lambda value: json.dumps(value, separators=(',', ':')).encode()
sha = lambda body: hashlib.sha256(body).hexdigest()


def raw_deflate(body):
    compressor = zlib.compressobj(9, zlib.DEFLATED, -15, 8, 0)
    return compressor.compress(body) + compressor.flush()


def canonical_zip(files, adaptive=True, alter=None):
    """Independent ZIP32 producer for negative cases, not the Node writer."""
    local, central, offset = [], [], 0
    for name, body in sorted(files.items()):
        filename = name.encode()
        compressed = raw_deflate(body)
        method = 8 if adaptive and len(compressed) < len(body) else 0
        if method == 0:
            compressed = body
        if alter:
            compressed = alter(name, body, compressed, method)
        crc = zlib.crc32(body)
        header = struct.pack('<I5H3I2H', 0x04034b50, 20, 0x800, method, 0, 33,
                             crc, len(compressed), len(body), len(filename), 0)
        directory = struct.pack('<I6H3I5H2I', 0x02014b50, 20, 20, 0x800, method, 0, 33,
                                crc, len(compressed), len(body), len(filename), 0, 0, 0, 0, 0, offset)
        local.extend([header, filename, compressed]); central.extend([directory, filename])
        offset += len(header) + len(filename) + len(compressed)
    directory = b''.join(central)
    end = struct.pack('<I4H2IH', 0x06054b50, 0, 0, len(files), len(files), len(directory), offset, 0)
    return b''.join(local) + directory + end


def fixture(contract=CONTRACT):
    marker = {'distributionArchive': contract} if contract is not None else {}
    files = {'game/index.html': b'<main>' + b'original content ' * 10000 + b'</main>',
             'game/build-info.json': encoded({'formatVersion': 1, 'version': VERSION,
                 'sourceRevision': COMMIT, 'entry': 'game/index.html', **marker}),
             'game/build-config.json': encoded(marker),
             'licenses/original.txt': b'Retained original license.'}
    manifest = {'formatVersion': 1, 'version': VERSION, 'sourceRevision': COMMIT,
                'entry': 'game/index.html', 'totalBytes': sum(map(len, files.values())),
                'files': [{'path': name, 'bytes': len(body), 'sha256': sha(body)} for name, body in files.items()], **marker}
    manifest_bytes = encoded(manifest)
    return {**files, 'manifest.json': manifest_bytes}, manifest_bytes, manifest


class DistributionArchiveTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)

    def verify(self, files, manifest_bytes, manifest, body=None, contract=CONTRACT):
        target = self.root / 'distribution.zip'
        target.write_bytes(body if body is not None else canonical_zip(files))
        return inspector.verify_distribution(target, manifest_bytes, manifest, COMMIT, VERSION, contract)

    def test_independent_mixed_archive_preserves_exact_manifest_and_expanded_accounting(self):
        files, raw, manifest = fixture()
        result = self.verify(files, raw, manifest)
        self.assertTrue(result['allManifestBytesVerified'])
        self.assertTrue(result['strictZip32LayoutVerified'])
        self.assertEqual(result['expandedBytesVerified'], sum(map(len, files.values())))
        self.assertLess((self.root / 'distribution.zip').stat().st_size, manifest['totalBytes'])

    def test_oversized_directory_is_refused_before_eager_parser_allocates_it(self):
        _, raw, manifest = fixture()
        directory_size = 33 * inspector.CHUNK
        end = struct.pack('<I4H2IH', 0x06054b50, 0, 0, 5, 5, directory_size, 0, 0)
        class SparseReadSpy:
            position = 0
            reads = []
            def seek(self, offset, whence=0):
                self.position = offset if whence == 0 else self.position + offset if whence == 1 else directory_size + 22 + offset
                return self.position
            def tell(self):
                return self.position
            def read(self, length=-1):
                self.reads.append(length)
                if length != 22 or self.position != directory_size:
                    raise AssertionError('Eager read before ZIP directory admission')
                self.position += length
                return end
        spy = SparseReadSpy()
        view = inspector.VerifiedMemberView(spy, directory_size + 22)
        with self.assertRaisesRegex(ValueError, 'directory bound'):
            inspector.verify_distribution(view, raw, manifest, COMMIT, VERSION, CONTRACT)
        self.assertEqual(spy.reads, [22])

    def test_extra_deflate_data_hidden_output_and_truncated_stream_fail(self):
        files, raw, manifest = fixture()
        for transform in [lambda body, compressed: compressed + b'hidden',
                          lambda body, compressed: raw_deflate(body + b'hidden output'),
                          lambda body, compressed: compressed[:-1]]:
            with self.subTest(transform=transform), self.assertRaises((ValueError, zlib.error, zipfile.BadZipFile)):
                body = canonical_zip(files, alter=lambda name, original, compressed, method:
                                     transform(original, compressed) if name == 'game/index.html' else compressed)
                self.verify(files, raw, manifest, body)

    def test_unknown_methods_header_disagreement_crc_overlap_trailing_and_zip64_fail(self):
        files, raw, manifest = fixture()
        original = canonical_zip(files)
        central = struct.unpack_from('<I', original, len(original) - 6)[0]
        for offset, fmt, value in [(8, '<H', 99), (6, '<H', 0), (14, '<I', 0),
                                   (central + 42, '<I', 5), (central + 10, '<H', 99),
                                   (len(original) - 12, '<H', 65535)]:
            bad = bytearray(original); struct.pack_into(fmt, bad, offset, value)
            with self.subTest(offset=offset), self.assertRaises((ValueError, zipfile.BadZipFile)):
                self.verify(files, raw, manifest, bytes(bad))
        for bad in [original + b'trailing', original[:-1]]:
            with self.assertRaises((ValueError, zipfile.BadZipFile)):
                self.verify(files, raw, manifest, bad)

    def test_unmarked_stored_legacy_remains_valid_but_cannot_admit_compression(self):
        files, raw, manifest = fixture(None)
        result = self.verify(files, raw, manifest, canonical_zip(files, adaptive=False), None)
        self.assertTrue(result['allManifestBytesVerified'])
        self.assertNotIn('distributionArchive', result)
        with self.assertRaises(ValueError):
            self.verify(files, raw, manifest, canonical_zip(files), None)
        marked, raw_marked, marked_manifest = fixture()
        with self.assertRaisesRegex(ValueError, 'marker differs'):
            self.verify(marked, raw_marked, marked_manifest, contract=None)

    def test_missing_extra_corrupt_and_unsafe_members_fail(self):
        files, raw, manifest = fixture()
        variants = []
        missing = dict(files); del missing['licenses/original.txt']; variants.append(missing)
        extra = dict(files); extra['unexpected'] = b'extra'; variants.append(extra)
        corrupt = dict(files); corrupt['licenses/original.txt'] = b'corrupt'; variants.append(corrupt)
        unsafe = dict(files); unsafe['../escape'] = b'unsafe'; variants.append(unsafe)
        duplicate = dict(files); duplicate['GAME/index.html'] = files['game/index.html']; variants.append(duplicate)
        for value in variants:
            with self.assertRaises(ValueError):
                self.verify(value, raw, manifest)

    def test_expanded_envelope_includes_manifest_and_never_exceeds_existing_default(self):
        files, raw, manifest = fixture()
        restricted = {**CONTRACT, 'maxExpandedBytes': manifest['totalBytes']}
        files, raw, manifest = fixture(restricted)
        with self.assertRaisesRegex(ValueError, 'totalBytes'):
            self.verify(files, raw, manifest, contract=restricted)
        for value in [None, {}, {**CONTRACT, 'maxExpandedBytes': 1024 * inspector.CHUNK + 1},
                      {**CONTRACT, 'maxExpandedBytes': True}, {**CONTRACT, 'format': 'future'},
                      {**CONTRACT, 'extra': True}]:
            with self.assertRaises(ValueError):
                inspector.validate_archive_contract(value)

    def test_source_commit_admits_only_its_exact_marker(self):
        def git(*args):
            return subprocess.check_output(['git', '-C', str(self.root), *args], stderr=subprocess.DEVNULL).decode().strip()
        git('init'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid')
        (self.root / 'game').mkdir()
        (self.root / 'game/build-config.json').write_bytes(encoded({'distributionArchive': CONTRACT}))
        git('add', '.'); git('commit', '-m', 'admitted fixture')
        commit = git('rev-parse', 'HEAD')
        self.assertEqual(inspector.source_archive_contract(self.root, commit, {'distributionArchive': CONTRACT}), CONTRACT)
        for release in [{}, {'distributionArchive': None}, {'distributionArchive': {**CONTRACT, 'maxExpandedBytes': 100}}]:
            with self.assertRaisesRegex(ValueError, 'exact source'):
                inspector.source_archive_contract(self.root, commit, release)

    def test_node_writer_original_git_tar_and_frozen_offline_consumers_roundtrip(self):
        legacy.OriginalFixtureTests().source_contract_roundtrip(False, adaptive=True)

    def test_node_writer_original_git_manifest_and_frozen_offline_consumers_roundtrip(self):
        legacy.OriginalFixtureTests().source_contract_roundtrip(True, adaptive=True)


if __name__ == '__main__':
    unittest.main()
