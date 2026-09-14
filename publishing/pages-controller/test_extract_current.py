import hashlib
import importlib.util
import io
import json
import pathlib
import stat
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('extract_current', pathlib.Path(__file__).with_name('extract-current.py'))
extractor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(extractor)

class ExtractCurrentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root = pathlib.Path(self.temp.name)

    def fixture(self, mutation=None):
        payloads = {'index.html': b'root', 'game/index.html': b'game', 'service-worker.js': b'original worker'}
        manifest = {'formatVersion': 1, 'version': 'v0.44.0', 'sourceRevision': 'a' * 40, 'entry': 'game/index.html', 'totalBytes': sum(map(len, payloads.values())), 'files': [{'path': name, 'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest()} for name, body in payloads.items()]}
        manifest_bytes = (json.dumps(manifest, indent=2) + '\n').encode()
        payloads['manifest.json'] = manifest_bytes
        if mutation: mutation(payloads)
        zip_path = self.root / 'original.zip'
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as archive:
            for name, body in payloads.items(): archive.writestr(name, body)
        record = {'version': manifest['version'], 'sourceRevision': manifest['sourceRevision'], 'manifestSha256': hashlib.sha256(manifest_bytes).hexdigest(), 'distributionSha256': extractor.sha_file(zip_path)}
        return zip_path, record, manifest_bytes, (record['distributionSha256'] + '  distribution.zip\n').encode()

    def test_exact_original_members_and_worker(self):
        args = self.fixture(); output = self.root / 'current'
        receipt = extractor.extract_current(args[0], output, *args[1:])
        self.assertEqual(receipt['membersVerified'], 4)
        self.assertEqual((output / 'service-worker.js').read_bytes(), b'original worker')
        self.assertEqual((output / 'manifest.json').read_bytes(), args[2])
        self.assertEqual((output / '.xonix-build.json').read_bytes(), extractor.MARKER)
        with self.assertRaises(ValueError): extractor.extract_current(args[0], output, *args[1:])

    def test_extra_traversal_missing_and_wrong_original_fail_atomically(self):
        for mutation in [lambda p: p.update({'../escape.html': b'bad'}), lambda p: p.update({'extra.html': b'bad'}), lambda p: p.pop('game/index.html'), lambda p: p.update({'game/index.html': b'evil'})]:
            args = self.fixture(mutation); output = self.root / 'current'
            with self.assertRaises(ValueError): extractor.extract_current(args[0], output, *args[1:])
            self.assertFalse(output.exists()); self.assertFalse(list(self.root.glob('.current-unzip-*')))

    def test_symlink_members_rejected_before_writing(self):
        args = self.fixture()
        with zipfile.ZipFile(args[0]) as archive: payloads = {i.filename: archive.read(i) for i in archive.infolist()}
        with zipfile.ZipFile(args[0], 'w') as archive:
            for name, body in payloads.items():
                info = zipfile.ZipInfo(name)
                if name == 'game/index.html': info.create_system = 3; info.external_attr = (stat.S_IFLNK | 0o777) << 16
                archive.writestr(info, body)
        args[1]['distributionSha256'] = extractor.sha_file(args[0]); checksum = (args[1]['distributionSha256'] + '  distribution.zip\n').encode()
        with self.assertRaises(ValueError): extractor.extract_current(args[0], self.root / 'current', args[1], args[2], checksum)
        self.assertFalse((self.root / 'current').exists())

    def test_crc_or_body_corruption_rejected_even_with_new_outer_digest(self):
        args = self.fixture()
        raw = bytearray(args[0].read_bytes()); raw[44] ^= 1; args[0].write_bytes(raw)
        args[1]['distributionSha256'] = extractor.sha_file(args[0]); checksum = (args[1]['distributionSha256'] + '  distribution.zip\n').encode()
        with self.assertRaises((ValueError, zipfile.BadZipFile, RuntimeError)):
            extractor.extract_current(args[0], self.root / 'current', args[1], args[2], checksum)
        self.assertFalse((self.root / 'current').exists())

if __name__ == '__main__': unittest.main()
