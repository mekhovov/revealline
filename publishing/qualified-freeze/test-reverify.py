"""Bounded pure/flat-ZIP checks for the separate hosted verification controller."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

BASE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('hosted_reverify', BASE / 'reverify.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ReverifyTests(unittest.TestCase):
    def pins(self):
        return json.loads((BASE / 'reverify-pins/v0.50.0.json').read_bytes())

    def run_record(self):
        return {'id': module.FREEZE_RUN, 'head_sha': module.FREEZE_CONTROLLER,
                'head_branch': 'codex/hosted-qualified-freezes',
                'repository': {'full_name': module.REPOSITORY},
                'head_repository': {'full_name': module.REPOSITORY},
                'event': 'push', 'path': '.github/workflows/freeze-qualified-sources.yml',
                'status': 'completed', 'conclusion': 'success', 'run_attempt': 1}

    def wrapper(self, folder, extra=None):
        verifier = module.load_verifier()
        path = folder / 'metadata.zip'
        with zipfile.ZipFile(path, 'w') as archive:
            for name in sorted(verifier.METADATA_NAMES):
                archive.writestr(name, b'{}\n')
            if extra:
                archive.writestr(extra, b'extra')
        row = self.pins()['artifacts']['metadata']
        row.update(digest='sha256:' + hashlib.sha256(path.read_bytes()).hexdigest(), size_in_bytes=path.stat().st_size)
        return verifier, path, row

    def test_pinned_source_and_verifier_copies_are_exact(self):
        module.load_verifier()
        expected = {
            'v0.49.0': 'a6c655b415c6c774391ecbba55f2f774b7901972e0d176bbe34a9e389bdcfec7',
            'v0.50.0': 'cf8c80fd91ad272525dcff9d3deb4064463c2bf8827b134e8c3eb48a17a1b7b3',
            'v0.51.0': '578f3c7646ddfc87f385fdef9a31bc9779519a2ba06be418da80091a6ceda492',
        }
        for version, digest in expected.items():
            self.assertEqual(hashlib.sha256((BASE / 'reverify-pins' / (version + '.json')).read_bytes()).hexdigest(), digest)

    def test_run_identity_success_and_attempt_are_required(self):
        module.validate_run(self.run_record())
        for key, value in [('id', 1), ('head_sha', 'b' * 40), ('head_branch', 'main'),
                           ('event', 'pull_request'), ('path', '.github/workflows/other.yml'),
                           ('status', 'in_progress'), ('conclusion', 'failure'), ('run_attempt', 2)]:
            with self.subTest(key=key):
                record = self.run_record()
                record[key] = value
                with self.assertRaises(ValueError):
                    module.validate_run(record)

    def test_artifact_digest_size_run_and_repository_are_required(self):
        expected = self.pins()['artifacts']['source']
        module.validate_artifact(expected, expected, 'source', 'v0.50.0')
        for key, value in [('id', 1), ('name', 'different'), ('digest', 'sha256:' + 'b' * 64),
                           ('size_in_bytes', 1), ('expired', True)]:
            with self.subTest(key=key):
                actual = copy.deepcopy(expected)
                actual[key] = value
                with self.assertRaises(ValueError):
                    module.validate_artifact(actual, expected, 'source', 'v0.50.0')
        for key, value in [('id', 1), ('head_sha', 'b' * 40), ('repository_id', 1), ('head_repository_id', 1)]:
            with self.subTest(owner_key=key):
                actual = copy.deepcopy(expected)
                actual['workflow_run'][key] = value
                with self.assertRaises(ValueError):
                    module.validate_artifact(actual, expected, 'source', 'v0.50.0')

    def test_flat_metadata_extracts_only_expected_members(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            verifier, path, row = self.wrapper(folder)
            target = folder / 'metadata'
            module.extract_metadata(verifier, path, target, row, 'v0.50.0')
            self.assertEqual({p.name for p in target.iterdir()}, verifier.METADATA_NAMES)
            self.assertTrue(all(p.read_bytes() == b'{}\n' for p in target.iterdir()))
            with self.assertRaises(ValueError):
                module.extract_metadata(verifier, path, target, row, 'v0.50.0')

    def test_extra_traversal_and_oversized_metadata_are_refused_before_extraction(self):
        for extra in ['extra.json', '../escape.json']:
            with self.subTest(extra=extra), tempfile.TemporaryDirectory() as temp:
                folder = Path(temp)
                verifier, path, row = self.wrapper(folder, extra)
                with self.assertRaises(ValueError):
                    module.extract_metadata(verifier, path, folder / 'metadata', row, 'v0.50.0')
                self.assertFalse((folder / 'metadata').exists())
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            verifier, path, row = self.wrapper(folder)
            with patch.object(module, 'METADATA_TOTAL_LIMIT', 1), self.assertRaises(ValueError):
                module.extract_metadata(verifier, path, folder / 'metadata', row, 'v0.50.0')
            self.assertFalse((folder / 'metadata').exists())

    def test_exact_source_qualification_and_three_identities_are_bound(self):
        pin = next(row for row in json.loads((BASE / 'sources.json').read_bytes())['sources'] if row['version'] == 'v0.50.0')
        pins = self.pins()
        with tempfile.TemporaryDirectory() as temp:
            metadata = Path(temp)
            for name in ('source-qualification.json', 'receipt-qualified.json'):
                (metadata / name).write_bytes((BASE / 'qualifications/v0.50.0' / name).read_bytes())
            invocation = {'sourceRevision': pin['sourceRevision'], 'sourceTree': pin['sourceTree'],
                          'sourceRunId': pin['runId'], 'qualificationSha256': pin['qualificationSha256'],
                          'node': pin['node'], 'runId': module.FREEZE_RUN, 'runAttempt': 1,
                          'controllerRevision': module.FREEZE_CONTROLLER}
            (metadata / 'freeze-invocation.json').write_text(json.dumps(invocation))
            module.validate_metadata(metadata, pin, pins)
            invocation['controllerRevision'] = pin['sourceRevision']
            (metadata / 'freeze-invocation.json').write_text(json.dumps(invocation))
            with self.assertRaises(ValueError):
                module.validate_metadata(metadata, pin, pins)
            invocation['controllerRevision'] = module.FREEZE_CONTROLLER
            (metadata / 'freeze-invocation.json').write_text(json.dumps(invocation))
            with (metadata / 'receipt-qualified.json').open('ab') as output:
                output.write(b'changed')
            with self.assertRaises(ValueError):
                module.validate_metadata(metadata, pin, pins)


if __name__ == '__main__':
    unittest.main()
