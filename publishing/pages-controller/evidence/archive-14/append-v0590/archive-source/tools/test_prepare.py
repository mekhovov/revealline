"""Tiny local cohorts: no release downloads, game builds or network access."""
import copy
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from prepare import MIN_FREE_BYTES, prepare
from verify import LIMIT, ROOT, digest, locked_inputs, metadata_inventory, verify


def encoded(value):
    return (json.dumps(value, indent=2) + '\n').encode()


def sha(value):
    return hashlib.sha256(value).hexdigest()


def git(directory, *args):
    return subprocess.check_output(['git', '-C', str(directory), *args], stderr=subprocess.DEVNULL, text=True).strip()


def init(directory):
    directory.mkdir()
    git(directory, 'init', '-q')
    git(directory, 'config', 'user.name', 'Archive fixture')
    git(directory, 'config', 'user.email', 'fixture@example.invalid')


# Exercises the real orchestration/subprocess protocol, not ZIP integrity.
# The production workflow separately runs the pinned extractor's ZIP tests.
EXTRACTOR = '''import argparse, json, pathlib, subprocess
p=argparse.ArgumentParser()
for name in ('metadata','output','receipt'): p.add_argument('--'+name,required=True)
a=p.parse_args(); m=pathlib.Path(a.metadata); out=pathlib.Path(a.output)
r=json.loads((m/'release.json').read_bytes())
BEHAVIOR
out.mkdir(); (out/'body.txt').write_text(r['version'])
(out/'manifest.json').write_bytes((m/'manifest.json').read_bytes())
(out/'distribution.zip.sha256').write_bytes((m/'distribution.zip.sha256').read_bytes())
(out/'.xonix-build.json').write_text('{\\n  "tool": "xonix-game-cli",\\n  "formatVersion": 1\\n}\\n')
pathlib.Path(a.receipt).write_text(json.dumps(dict(version=r['version'],gameSourceRevision=r['sourceRevision'],distributionSha256=r['distributionSha256'],manifestSha256=r['manifestSha256'],crcAndHashesVerified=True)))
'''


class CohortTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.base = Path(temp.name)
        self.source = self.base / 'source'
        self.archive = self.base / 'archive'
        self.output = self.base / 'output'

    def fixture(self, behavior='pass'):
        init(self.source)
        (self.source / 'extractor.py').write_text(EXTRACTOR.replace('BEHAVIOR', behavior))
        git(self.source, 'add', '.')
        git(self.source, 'commit', '-qm', 'local fixture')
        revision = git(self.source, 'rev-parse', 'HEAD')
        init(self.archive)
        (self.archive / 'index.html').write_bytes(b'fixture index')
        (self.archive / 'releases').mkdir()
        (self.archive / 'releases/index.html').write_bytes(b'fixture explorer')
        releases = []
        for version in ('v0.1.0', 'v0.2.0'):
            git(self.source, 'tag', '-a', version, '-m', 'fixture')
            directory = self.archive / 'metadata' / version
            directory.mkdir(parents=True)
            manifest = {'version': version, 'sourceRevision': revision, 'totalBytes': len(version), 'files': [{'path': 'body.txt', 'bytes': len(version), 'sha256': sha(version.encode())}]}
            manifest_bytes = encoded(manifest)
            record = {'version': version, 'sourceRevision': revision, 'distributionSha256': sha(version.encode()), 'manifestSha256': sha(manifest_bytes)}
            (directory / 'release.json').write_bytes(encoded(record))
            (directory / 'manifest.json').write_bytes(manifest_bytes)
            (directory / 'distribution.zip.sha256').write_text(record['distributionSha256'] + '  distribution.zip\n')
            releases.append({**{key: record[key] for key in ('version', 'sourceRevision', 'distributionSha256')}, 'tagObject': git(self.source, 'rev-parse', 'refs/tags/' + version), 'metadata': {name: digest(directory / name) for name in ('release.json', 'manifest.json', 'distribution.zip.sha256')}})
        self.lock = {'format': 'revealline-archive-originals.v2', 'archiveId': 'fixture', 'toolingCommit': revision, 'extractorPath': 'extractor.py', 'extractorSha256': digest(self.source / 'extractor.py'), 'releases': releases, 'budgetBytes': LIMIT}
        rows = [row for release in releases for row in metadata_inventory(self.archive, release)]
        rows += [{'path': 'index.html', 'bytes': 13, 'sha256': sha(b'fixture index')}, {'path': '.nojekyll', 'bytes': 0, 'sha256': sha(b'')}]
        rows.append({'path': 'releases/index.html', 'bytes': 16, 'sha256': sha(b'fixture explorer')})
        rows.sort(key=lambda row: row['path'])
        self.expected = {'base': 'https://example.invalid/', 'files': rows}
        (self.archive / 'expected-inventory.json').write_bytes(encoded(self.expected))
        self.lock.update(expectedInventorySha256=digest(self.archive / 'expected-inventory.json'), expectedFiles=len(rows), expectedBytes=sum(row['bytes'] for row in rows))
        self.write_lock()
        git(self.archive, 'add', '.')
        git(self.archive, 'commit', '-qm', 'local metadata fixture')

    def write_lock(self):
        (self.archive / 'source-lock.json').write_bytes(encoded(self.lock))

    def assemble(self):
        with patch('prepare.shutil.disk_usage', return_value=SimpleNamespace(free=MIN_FREE_BYTES)):
            return prepare(self.source, self.output, self.archive)

    def test_two_original_cohorts_and_independent_artifact_reread(self):
        self.fixture()
        result = self.assemble()
        self.assertEqual(result['status'], 'PASS')
        self.assertEqual([r['version'] for r in result['releases']], ['v0.1.0', 'v0.2.0'])
        self.assertEqual(result['files'], 13)
        self.assertEqual((self.output / 'artifact/releases/index.html').read_bytes(), b'fixture explorer')
        self.assertEqual(verify(self.output / 'artifact', self.expected['files'])['bytes'], result['bytes'])
        for version in ('v0.1.0', 'v0.2.0'):
            self.assertEqual((self.output / 'artifact/releases' / version / 'release.json').read_bytes(), (self.archive / 'metadata' / version / 'release.json').read_bytes())
            self.assertTrue((self.output / ('zip-receipt-' + version + '.json')).is_file())

    def test_pinned_qualification_copied_without_changing_original_cohort(self):
        self.fixture()
        release = self.lock['releases'][1]
        tree = git(self.source, 'rev-parse', 'HEAD^{tree}')
        proof = {'format': 'revealline-source-qualification.v1', 'version': release['version'], 'sourceRevision': release['sourceRevision'], 'actualCheckoutCommit': release['sourceRevision'], 'sourceTree': tree, 'actualCheckoutTree': tree, 'passed': True, 'allTrackedSourceContentsAndModesMatch': True, 'gates': [{'gate': name, 'step': {'conclusion': 'success'}} for name in ['test', 'lint', 'format', 'native-format', 'validate', 'motion-syntax']]}
        source = self.archive / 'metadata/v0.2.0/source-qualification.json'
        source.write_bytes(encoded(proof))
        release['sourceTree'] = tree
        release['sourceQualification'] = {'bytes': source.stat().st_size, 'sha256': digest(source)}
        self.expected['files'].append({'path': 'releases/v0.2.0/source-qualification.json', 'bytes': source.stat().st_size, 'sha256': digest(source)})
        self.expected['files'].sort(key=lambda row: row['path'])
        (self.archive / 'expected-inventory.json').write_bytes(encoded(self.expected))
        self.lock.update(expectedInventorySha256=digest(self.archive / 'expected-inventory.json'), expectedFiles=len(self.expected['files']), expectedBytes=sum(row['bytes'] for row in self.expected['files']))
        self.write_lock()
        result = self.assemble()
        self.assertEqual(result['files'], 14)
        self.assertEqual((self.output / 'artifact/releases/v0.2.0/source-qualification.json').read_bytes(), source.read_bytes())
        self.assertEqual((self.output / 'artifact/releases/v0.1.0/site/body.txt').read_text(), 'v0.1.0')

    def test_capacity_refuses_before_output_or_source_access(self):
        with patch('prepare.shutil.disk_usage', return_value=SimpleNamespace(free=MIN_FREE_BYTES - 1)):
            with self.assertRaisesRegex(ValueError, '3 GiB'):
                prepare(self.source, self.output, self.archive)
        self.assertFalse(self.output.exists())

    def test_existing_output_is_never_overwritten(self):
        self.fixture()
        self.output.mkdir()
        sentinel = self.output / 'keep'
        sentinel.write_bytes(b'unchanged')
        with self.assertRaises(FileExistsError):
            self.assemble()
        self.assertEqual(list(self.output.iterdir()), [sentinel])
        self.assertEqual(sentinel.read_bytes(), b'unchanged')

    def test_bad_second_metadata_refuses_before_first_extraction(self):
        self.fixture()
        (self.archive / 'metadata/v0.2.0/release.json').write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError, 'metadata bytes changed'):
            self.assemble()
        self.assertFalse(self.output.exists())

    def test_missing_release_explorer_bridge_refuses_before_extraction(self):
        self.fixture()
        (self.archive / 'releases/index.html').unlink()
        with self.assertRaises(FileNotFoundError):
            self.assemble()
        self.assertFalse(self.output.exists())

    def test_inventory_cannot_omit_the_release_explorer_route(self):
        self.fixture()
        self.expected['files'] = [r for r in self.expected['files'] if r['path'] != 'releases/index.html']
        (self.archive / 'expected-inventory.json').write_bytes(encoded(self.expected))
        self.lock.update(expectedInventorySha256=digest(self.archive / 'expected-inventory.json'), expectedFiles=len(self.expected['files']), expectedBytes=sum(r['bytes'] for r in self.expected['files']))
        self.write_lock()
        with self.assertRaisesRegex(ValueError, 'Canonical inventory'):
            self.assemble()
        self.assertFalse(self.output.exists())

    def test_duplicate_version_and_cohort_inventory_omission_refuse(self):
        self.fixture()
        original = copy.deepcopy(self.lock)
        self.lock['releases'].append(copy.deepcopy(self.lock['releases'][0]))
        self.write_lock()
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            self.assemble()
        self.lock = original
        self.lock['releases'].pop()
        self.write_lock()
        with self.assertRaisesRegex(ValueError, 'Canonical inventory'):
            self.assemble()
        self.assertFalse(self.output.exists())

    def test_manifest_source_disagreement_refuses_even_with_rehashed_pin(self):
        self.fixture()
        release = self.lock['releases'][1]
        manifest_path = self.archive / 'metadata/v0.2.0/manifest.json'
        manifest = json.loads(manifest_path.read_bytes())
        manifest['sourceRevision'] = '0' * 40
        manifest_path.write_bytes(encoded(manifest))
        release['metadata']['manifest.json'] = digest(manifest_path)
        with self.assertRaisesRegex(ValueError, 'manifest identity'):
            metadata_inventory(self.archive, release)

    def test_second_extraction_failure_cannot_emit_combined_success(self):
        self.fixture("if r['version']=='v0.2.0': raise ValueError('fixture second failure')")
        with self.assertRaises(subprocess.CalledProcessError):
            self.assemble()
        self.assertTrue((self.output / 'zip-receipt-v0.1.0.json').is_file())
        self.assertFalse((self.output / 'receipt.json').exists())

    def test_mismatched_extraction_receipt_cannot_emit_combined_success(self):
        self.fixture("r['distributionSha256']='0'*64")
        with self.assertRaisesRegex(ValueError, 'extraction receipt identity'):
            self.assemble()
        self.assertTrue((self.output / 'zip-receipt-v0.1.0.json').is_file())
        self.assertFalse((self.output / 'zip-receipt-v0.2.0.json').exists())
        self.assertFalse((self.output / 'receipt.json').exists())

    def test_tag_identity_changed_before_or_during_extraction_refuses(self):
        self.fixture("if r['version']=='v0.2.0': subprocess.run(['git','-C',str(pathlib.Path(__file__).parent),'tag','-d','v0.1.0'],check=True,stdout=subprocess.DEVNULL)")
        with self.assertRaises(subprocess.CalledProcessError):
            self.assemble()
        self.assertFalse((self.output / 'receipt.json').exists())
        self.output = self.base / 'next-output'
        with self.assertRaises(subprocess.CalledProcessError):
            self.assemble()
        self.assertFalse(self.output.exists())

    def test_changed_extracted_body_fails_full_inventory(self):
        self.fixture()
        result = self.assemble()
        body = self.output / 'artifact/releases/v0.2.0/site/body.txt'
        body.write_bytes(b'corrupt')
        with self.assertRaisesRegex(ValueError, 'missing, extra or changed'):
            verify(self.output / 'artifact', self.expected['files'])
        self.assertTrue(result['noHistoricalBuilds'])


class CommittedMetadataTests(unittest.TestCase):
    def test_exact_v057_metadata_and_source_qualification(self):
        lock, inventory = locked_inputs(ROOT)
        self.assertEqual((lock['expectedFiles'], lock['expectedBytes']), (1342, 625582144))
        self.assertEqual([r['version'] for r in lock['releases']], ['v0.57.0', 'v0.59.0'])
        release = lock['releases'][0]
        self.assertEqual(release['version'], 'v0.57.0')
        self.assertEqual(release['tagObject'], 'c3fd6145392491748c4578eef15b51983af84f9e')
        self.assertEqual(release['sourceRevision'], 'b7db0134d4ede3452dc90b5d3f7ffb1491a0579b')
        self.assertEqual(release['sourceQualification'], {'sha256': 'fa7619fb0633fb20e45def339ff94421b4862eaccd2386ff608c0d0a1f8344bb', 'bytes': 51091})
        rows = [row for row in inventory['files'] if row['path'].endswith('/source-qualification.json')]
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]['bytes'], 51091)
        successor = lock['releases'][1]
        self.assertEqual(successor['tagObject'], '4444c3d8479fb0a30a9dd38a360261f5166e7613')
        self.assertEqual(successor['sourceRevision'], '76dc4bf36baec11ce4dff6ca49773d3b9d6c0ae5')
        self.assertEqual(successor['sourceTree'], '68a1ee7c6668464282703ac2b5aeb91231cf290f')
        self.assertEqual(successor['sourceQualification'], {'sha256': '65322d7765c92c3ae16b71ac95d0109c34294946e4a93a31bb2269511dd0bbc3', 'bytes': 64871})
        self.assertEqual(rows[1]['bytes'], 64871)


    def test_changed_or_wrong_identity_qualification_refuses(self):
        import shutil
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            shutil.copytree(ROOT / 'metadata', root / 'metadata')
            original = json.loads((ROOT / 'source-lock.json').read_bytes())['releases'][0]
            path = root / 'metadata/v0.57.0/source-qualification.json'
            data = path.read_bytes()
            for change in ('bytes', 'source', 'gates'):
                with self.subTest(change=change):
                    release = copy.deepcopy(original)
                    proof = json.loads(data)
                    if change == 'bytes':
                        path.write_bytes(b'changed')
                    else:
                        if change == 'source': proof['actualCheckoutCommit'] = '0' * 40
                        if change == 'gates': proof['gates'].pop()
                        path.write_bytes(encoded(proof))
                        release['sourceQualification'] = {'sha256': digest(path), 'bytes': path.stat().st_size}
                    with self.assertRaisesRegex(ValueError, 'qualification'):
                        metadata_inventory(root, release)
                    path.write_bytes(data)

    def test_release_explorer_has_an_accessible_fallback_and_main_destination(self):
        class Links(HTMLParser):
            def __init__(self):
                super().__init__()
                self.refreshes = []
                self.links = []
                self.current = None

            def handle_starttag(self, tag, attrs):
                attrs = dict(attrs)
                if tag == 'meta' and attrs.get('http-equiv', '').lower() == 'refresh':
                    self.refreshes.append(attrs.get('content', ''))
                if tag == 'a':
                    self.current = [attrs.get('href'), '']
                    self.links.append(self.current)

            def handle_data(self, data):
                if self.current is not None:
                    self.current[1] += data

            def handle_endtag(self, tag):
                if tag == 'a':
                    self.current = None

        parser = Links()
        parser.feed((ROOT / 'releases/index.html').read_text())
        destination = 'https://mekhovov.github.io/revealline/releases/'
        self.assertEqual(len(parser.refreshes), 1)
        delay, target = parser.refreshes[0].split(';', 1)
        self.assertEqual((delay.strip(), target.strip()), ('0', 'url=' + destination))
        self.assertEqual(len(parser.links), 1)
        self.assertEqual(parser.links[0][0], destination)
        self.assertIn('release explorer', parser.links[0][1].lower())


if __name__ == '__main__':
    unittest.main()
