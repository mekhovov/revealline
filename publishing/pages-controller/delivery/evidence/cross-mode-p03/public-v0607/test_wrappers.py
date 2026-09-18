"""Mock-only wrapper tests. All output goes to temporary local fixture directories."""
from pathlib import Path
import base64
import copy
import hashlib
import importlib.util
import io
import json
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
import zipfile

import wrapper_contract as contract


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).parent / file)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


intake = module('intake_wrapper', 'intake-live.py')
refresh = module('refresh_wrapper', 'refresh-after-http.py')


class WrapperTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.home = Path(temporary.name)
        self.calls = []
        self.publisher = 'c' * 40
        self.tree = 'd' * 40
        self.authorities = {
            'metadata/v0.60.7/manifest.json': contract.encode({'mock': 'manifest'}),
            'metadata/v0.60.7/release.json': contract.encode({'mock': 'record'}),
            'evidence/current-v0602/source-qualification.json': contract.encode({'mock': 'qualification'}),
            'catalog.json': contract.encode({'releases': [{'version': contract.VERSION, 'tagObject': 'e' * 40}]}),
            'publication.json': contract.encode({'currentVersion': contract.VERSION,
                'currentSourceQualification': {'path': 'evidence/current-v0602/source-qualification.json'}}),
        }
        receipt = {'controllerCommit': self.publisher, 'controllerTree': self.tree,
                   'currentVersion': contract.VERSION, 'gameSourceRevision': contract.SOURCE,
                   'qualifiedSourceTree': contract.TREE, 'publishable': True, 'totalBytes': 1,
                   'files': [{'path': 'mock.txt', 'bytes': 1, 'sha256': contract.sha(b'x')}]}
        self.zip = self.archive({'artifact-receipt.json': contract.encode(receipt),
                                 'zip-receipt.json': contract.encode({'mock': True})})
        assets = []
        for index, name in enumerate(sorted(contract.ASSETS)):
            path = {'manifest.json': 'metadata/v0.60.7/manifest.json',
                    'release.json': 'metadata/v0.60.7/release.json',
                    'source-qualification.json': 'evidence/current-v0602/source-qualification.json'}.get(name)
            body = self.authorities[path] if path else ('mock original ' + name).encode()
            assets.append({'id': 200 + index, 'name': name, 'size': len(body),
                           'digest': 'sha256:' + contract.sha(body), 'state': 'uploaded',
                           'browser_download_url': f'https://github.com/mekhovov/revealline/releases/download/v0.60.7/{name}'})
        self.release = {'id': 300, 'tag_name': contract.VERSION, 'draft': False, 'prerelease': False,
                        'published_at': '2000-01-01T00:00:00Z', 'assets': assets}
        self.models = {
            'main': {'object': {'sha': self.publisher}},
            'wrapper': {'sha': self.publisher, 'tree': {'sha': self.tree}},
            'run': {'id': 101, 'head_sha': self.publisher, 'head_branch': 'main', 'status': 'completed',
                    'conclusion': 'success', 'event': 'push', 'path': '.github/workflows/publish-frozen-pages.yml'},
            'deployment': {'id': 102, 'sha': self.publisher, 'ref': 'main', 'environment': 'github-pages'},
            'statuses': [{'id': 103, 'state': 'success', 'environment_url': contract.BASE,
                          'log_url': 'https://github.com/mekhovov/revealline/actions/runs/101'}],
            'jobs': {'jobs': [{'conclusion': 'success'}]}, 'deployments': [],
            'artifacts': {'artifacts': [{'id': 104, 'name': 'frozen-pages-receipts', 'expired': False,
                'size_in_bytes': len(self.zip), 'digest': 'sha256:' + contract.sha(self.zip),
                'workflow_run': {'id': 101, 'head_sha': self.publisher}}]},
        }
        pins = [self.write('observation/' + name + '.json', contract.encode(value)) for name, value in self.models.items()]
        for pin in pins:
            pin['path'] = Path(pin['path']).name
        observation = self.write('observation/record.json', contract.encode({'at': '2000-01-03T00:00:00Z', 'pins': pins}))
        self.request = {'format': 'revealline-public-intake-request.v1', 'reviewed': True, 'outputLabel': 'mock',
            'currentVersion': contract.VERSION, 'gameSourceRevision': contract.SOURCE, 'qualifiedSourceTree': contract.TREE,
            'controllerCommit': self.publisher, 'controllerTree': self.tree, 'runId': 101, 'deploymentId': 102,
            'latestSuccessStatusId': 103, 'receiptArtifact': {'id': 104, 'bytes': len(self.zip), 'sha256': contract.sha(self.zip)},
            'hostedObservation': observation, 'publishedRelease': self.write('published.json', contract.encode(self.release))}

    def write(self, name, body):
        path = self.home / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(body)
        return {'path': name, 'bytes': len(body), 'sha256': contract.sha(body)}

    def archive(self, members):
        result = io.BytesIO()
        with zipfile.ZipFile(result, 'w') as archive:
            for name, body in members.items():
                archive.writestr(name, body)
        return result.getvalue()

    def call(self, request=None, runner=None):
        pin = self.write('intake-request.json', contract.encode(request or self.request))
        return intake.intake(self.home, self.home / pin['path'], pin['sha256'], runner or self.runner)

    def runner(self, command, **kwargs):
        self.calls.append(command)
        if 'stdout' in kwargs:
            kwargs['stdout'].write(self.zip)
            return SimpleNamespace(returncode=0)
        path = command[2].split('contents/publishing/pages-controller/', 1)[1].split('?ref=', 1)[0]
        body = self.authorities[path]
        value = {'encoding': 'base64', 'type': 'file', 'path': 'publishing/pages-controller/' + path,
                 'content': base64.b64encode(body).decode(), 'size': len(body),
                 'sha': hashlib.sha1(b'blob ' + str(len(body)).encode() + b'\0' + body).hexdigest()}
        return SimpleNamespace(returncode=0, stdout=contract.encode(value), stderr=b'')

    def test_intake_requires_explicit_review_identity_and_request_hash_before_network(self):
        for key, value in [('reviewed', False), ('runId', None), ('controllerCommit', None),
                           ('currentVersion', 'v0.59.1'), ('qualifiedSourceTree', '0' * 40)]:
            request = copy.deepcopy(self.request)
            request[key] = value
            with self.subTest(key=key), self.assertRaises((ValueError, TypeError)):
                self.call(request)
        with self.assertRaises(ValueError):
            intake.intake(self.home, self.home / 'intake-request.json', '0' * 64, self.runner)
        self.assertEqual(self.calls, [])

    def test_missing_actual_field_and_changed_observation_refuse_before_network(self):
        request = copy.deepcopy(self.request)
        del request['receiptArtifact']
        with self.assertRaises(ValueError):
            self.call(request)
        (self.home / 'observation/run.json').write_bytes(b'changed')
        with self.assertRaises(ValueError):
            self.call()
        self.assertEqual(self.calls, [])

    def test_original_receipt_and_git_bodies_produce_only_unreviewed_binding(self):
        result = self.call()
        path = Path(result['binding'])
        binding = json.loads(path.read_bytes())
        self.assertFalse(binding['reviewed'])
        self.assertFalse((path.parent / 'binding.json').exists())
        self.assertFalse(result['publicAcceptance'])
        self.assertEqual(len(binding['pins']), 9)
        self.assertEqual(len(self.calls), 6)
        self.assertTrue((self.home / 'receipt-intake-mock/original.zip').is_file())
        with self.assertRaises(ValueError):
            self.call()
        self.assertEqual(len(self.calls), 6)

    def test_bad_download_digest_retains_original_without_binding(self):
        self.zip += b'changed'
        with self.assertRaises(ValueError):
            self.call()
        self.assertTrue((self.home / 'receipt-intake-mock/original.zip').exists())
        self.assertFalse((self.home / 'tools/inputs').exists())

    def test_unsafe_zip_member_refuses_without_binding(self):
        self.zip = self.archive({'../artifact-receipt.json': b'{}', 'zip-receipt.json': b'{}'})
        self.request['receiptArtifact'].update(bytes=len(self.zip), sha256=contract.sha(self.zip))
        artifact = self.models['artifacts']['artifacts'][0]
        artifact.update(size_in_bytes=len(self.zip), digest='sha256:' + contract.sha(self.zip))
        pin = self.write('observation/artifacts.json', contract.encode(self.models['artifacts']))
        record = json.loads((self.home / 'observation/record.json').read_bytes())
        record['pins'] = [dict(pin, path='artifacts.json') if p['path'] == 'artifacts.json' else p for p in record['pins']]
        self.request['hostedObservation'] = self.write('observation/record.json', contract.encode(record))
        with self.assertRaises(ValueError):
            self.call()
        self.assertFalse((self.home / 'tools/inputs').exists())

    def test_git_api_failure_is_retained_and_cannot_expose_binding(self):
        def runner(command, **kwargs):
            if 'stdout' in kwargs:
                return self.runner(command, **kwargs)
            raise subprocess.TimeoutExpired(command, 35, output=b'{partial', stderr=b'fixture timeout')
        with self.assertRaises(ValueError):
            self.call(runner=runner)
        self.assertTrue((self.home / 'receipt-intake-mock/authority-api-originals/configuration.json.partial').exists())
        self.assertFalse((self.home / 'tools/inputs').exists())

    def refresh_request(self):
        result = self.call()
        body = json.loads(Path(result['binding']).read_bytes())
        body['reviewed'] = True  # Mock-only independent review inside a temporary fixture.
        binding = self.write('reviewed/binding.json', contract.encode(body))
        for pin in body['pins'].values():
            self.write('reviewed/' + pin['path'], (Path(result['binding']).parent / pin['path']).read_bytes())
        report = {**{k: body[k] for k in ['base', 'currentVersion', 'gameSourceRevision', 'qualifiedSourceTree',
                  'controllerCommit', 'controllerTree', 'deploymentId', 'runId']},
                  'status': 'PASS', 'mode': 'full', 'bindingSha256': binding['sha256'],
                  'expectedInventorySha256': body['inventorySha256'], 'allArtifactBodiesVerified': True,
                  'sourcePinsUnchanged': True, 'failedFiles': 0, 'uninspectedFiles': 0,
                  'files': 1, 'completedFiles': 1, 'fullInventoryFiles': 1,
                  'verifiedBytes': 1, 'expectedBytes': 1, 'failures': [], 'skipped': [], 'changedAuthorities': [],
                  'finishedAt': '2000-01-02T00:00:00Z'}
        report_pin = self.write('report.json', contract.encode(report))
        row_review = self.write('row-review.json', contract.encode({'status': 'PASS_ALL_PUBLIC_RESULT_ROWS_RECONCILED',
                    'reportSha256': report_pin['sha256'], 'controllerCommit': self.publisher, 'files': 1, 'bytes': 1}))
        return {'format': 'revealline-public-refresh-request.v1', 'reviewed': True, 'outputLabel': 'mock',
                'binding': binding, 'report': report_pin, 'rowReview': row_review,
                'hostedObservation': self.request['hostedObservation'], 'publishedRelease': self.request['publishedRelease']}

    def refresh_runner(self, command, **kwargs):
        self.calls.append(command)
        endpoint = command[2].split('repos/mekhovov/revealline/', 1)[1]
        values = {'releases/latest': self.release, 'releases/tags/v0.60.7': self.release,
                  'git/ref/tags/v0.60.7': {'object': {'type': 'tag', 'sha': 'e' * 40}},
                  'git/tags/' + 'e' * 40: {'sha': 'e' * 40, 'object': {'type': 'commit', 'sha': contract.SOURCE}},
                  'deployments?environment=github-pages&per_page=10': [{'id': 102, 'sha': self.publisher}],
                  'git/commits/' + contract.SOURCE: {'sha': contract.SOURCE, 'tree': {'sha': contract.TREE}}}
        return SimpleNamespace(returncode=0, stdout=contract.encode(values[endpoint]), stderr=b'')

    def refresh_call(self, request, runner=None):
        pin = self.write('refresh-request.json', contract.encode(request))
        return refresh.refresh(self.home, self.home / pin['path'], pin['sha256'], runner or self.refresh_runner)

    def test_refresh_uses_actual_bound_release_and_keeps_original_responses(self):
        result = self.refresh_call(self.refresh_request())
        self.assertEqual(result['status'], 'PASS_LIVE_AUTHORITIES_UNCHANGED_AFTER_FULL_AUDIT')
        self.assertEqual(result['releaseId'], 300)
        self.assertEqual(len(self.calls), 12)
        self.assertFalse(result['phaseAccepted'])

    def test_refresh_rejects_partial_audit_and_stale_observation_before_network(self):
        request = self.refresh_request()
        before = len(self.calls)
        report = json.loads((self.home / 'report.json').read_bytes())
        report['mode'] = 'critical'
        request['report'] = self.write('report.json', contract.encode(report))
        with self.assertRaises(ValueError):
            self.refresh_call(request)
        report['mode'] = 'full'
        report['finishedAt'] = '2000-01-04T00:00:00Z'
        request['report'] = self.write('report.json', contract.encode(report))
        review = json.loads((self.home / 'row-review.json').read_bytes())
        review['reportSha256'] = request['report']['sha256']
        request['rowReview'] = self.write('row-review.json', contract.encode(review))
        with self.assertRaises(ValueError):
            self.refresh_call(request)
        self.assertEqual(len(self.calls), before)

    def test_refresh_changed_published_asset_never_writes_acceptance(self):
        request = self.refresh_request()
        self.release['assets'][0]['digest'] = 'sha256:' + '0' * 64
        with self.assertRaises(ValueError):
            self.refresh_call(request)
        self.assertFalse((self.home / 'after-http-authorities-mock/result.json').exists())
        self.assertTrue((self.home / 'after-http-authorities-mock/release.json').exists())


if __name__ == '__main__':
    unittest.main()
