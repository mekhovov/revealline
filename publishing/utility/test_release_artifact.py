import copy
import hashlib
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile

import release_artifact as utility
import inspect_qualified_artifact as inspector


def encoded(value):
    return json.dumps(value, separators=(',', ':')).encode()


def binding(mode='inspect-artifact'):
    value = {'format': 'revealline-release-utility-binding.v1', 'reviewed': True,
             'repository': 'example/project', 'source': {'commit': 'a' * 40, 'tree': 'b' * 40, 'version': 'v1.2.3'},
             'artifact': {'id': 17, 'runId': 18, 'bytes': 100, 'sha256': 'c' * 64}, 'release': None}
    if mode == 'upload-originals':
        value['release'] = {'id': 19, 'tag': 'v1.2.3',
                            'assets': [{'name': n, 'bytes': 1, 'sha256': 'd' * 64} for n in sorted(utility.NAMES)]}
    return value


def counts(n=1):
    return {'tests': n, 'pass': n, 'fail': 0, 'cancelled': 0, 'skipped': 0, 'todo': 0}


def qualification(value):
    step = {'status': 'completed', 'conclusion': 'success'}
    shards = [{'shard': i, 'jobId': i, 'step': step.copy(), 'counts': counts()} for i in range(1, 5)]
    gates = [{'gate': name, 'command': command, 'step': step.copy()}
             for name, command in zip(utility.GATES, utility.COMMANDS)]
    gates.append({'gate': 'test', 'step': step.copy(), 'actualJobSteps': copy.deepcopy(shards)})
    return {'format': 'revealline-source-qualification.v1', 'passed': True,
            'sourceRevision': value['source']['commit'], 'actualCheckoutCommit': value['source']['commit'],
            'sourceTree': value['source']['tree'], 'actualCheckoutTree': value['source']['tree'],
            'version': value['source']['version'], 'allTrackedSourceContentsAndModesMatch': True,
            'gates': gates, 'tests': counts(4), 'testFiles': 4,
            'additionalManualQualification': {'shards': [dict(s, jobId=s['jobId'] + 10) for s in shards]}, 'evidencePins': [],
            'ordinaryBuildCorroboration': {'step': step.copy(), 'command': 'npm run build'},
            'frozenArtifactCorroboration': {'artifactId': value['artifact']['id'],
                **{k: True for k in ['wholeOriginalArtifactVerifiedBeforeQualification',
                    'sourceTarGitBlobTypeModeAndPaxCommitVerified', 'allInnerZipManifestBytesVerified',
                    'frozenOfflineInventoryAndBindingsVerified']}}}


class BindingTests(unittest.TestCase):
    def test_modes_require_exact_bindings_and_nine_unique_descriptors(self):
        for mode in ['inspect-artifact', 'upload-originals']:
            value = binding(mode)
            self.assertEqual(utility.validate_binding(encoded(value), mode, 'example/project'), value)
        bad_values = []
        for field, replacement in [('reviewed', False), ('repository', 'other/project')]:
            value = binding('upload-originals'); value[field] = replacement; bad_values.append(value)
        value = binding('upload-originals'); value['release']['assets'][0] = value['release']['assets'][1]; bad_values.append(value)
        value = binding('upload-originals'); value['source']['commit'] = 'main'; bad_values.append(value)
        value = binding('upload-originals'); value['release']['tag'] = 'v1.2.4'; bad_values.append(value)
        value = binding('upload-originals'); value['artifact']['bytes'] = True; bad_values.append(value)
        for value in bad_values:
            with self.subTest(value=value), self.assertRaises(ValueError):
                utility.validate_binding(encoded(value), 'upload-originals', 'example/project')
        large = binding('upload-originals')
        next(row for row in large['release']['assets'] if row['name'] == 'distribution.zip')['bytes'] = 600 * utility.MIB
        self.assertEqual(utility.validate_binding(encoded(large), 'upload-originals', 'example/project'), large)
        next(row for row in large['release']['assets'] if row['name'] == 'distribution.zip')['bytes'] = 1024 * utility.MIB + 1
        with self.assertRaises(ValueError):
            utility.validate_binding(encoded(large), 'upload-originals', 'example/project')
        with self.assertRaises(ValueError):
            utility.validate_binding(encoded(binding('upload-originals')), 'inspect-artifact', 'example/project')
        with self.assertRaises(ValueError):
            utility.validate_binding(b'{"format":1,"format":2}', 'inspect-artifact', 'example/project')

    def test_distribution_descriptor_uses_exact_pages_cap(self):
        self.assertEqual(utility.MAX_DISTRIBUTION_BYTES, 950_000_000)
        value = binding('upload-originals')
        row = next(row for row in value['release']['assets'] if row['name'] == 'distribution.zip')
        row['bytes'] = utility.MAX_DISTRIBUTION_BYTES
        self.assertEqual(utility.validate_binding(encoded(value), 'upload-originals', 'example/project'), value)
        row['bytes'] += 1
        with self.assertRaisesRegex(ValueError, 'bounded length'):
            utility.validate_binding(encoded(value), 'upload-originals', 'example/project')

    def test_qualification_refuses_incomplete_failed_or_different_family(self):
        value = binding(); q = qualification(value)
        utility.qualification_check(q, value)
        mutations = [lambda q: q.update(passed=False),
                     lambda q: q.update(sourceRevision='f' * 40),
                     lambda q: q['gates'].pop(),
                     lambda q: q['gates'][0]['step'].update(conclusion='skipped'),
                     lambda q: q['additionalManualQualification']['shards'].pop(),
                     lambda q: q['additionalManualQualification']['shards'][0]['counts'].update(fail=1),
                     lambda q: q['additionalManualQualification']['shards'][0].update(counts=counts(2)),
                     lambda q: q['ordinaryBuildCorroboration']['step'].update(conclusion='failure'),
                     lambda q: q['frozenArtifactCorroboration'].update(artifactId=99)]
        for mutate in mutations:
            candidate = copy.deepcopy(q); mutate(candidate)
            with self.assertRaises((ValueError, KeyError)):
                utility.qualification_check(candidate, value)

    def test_artifact_authority_requires_original_completed_freeze_and_all_jobs(self):
        value = binding()
        artifact = {'id': 17, 'name': 'qualified-release-snapshot', 'expired': False, 'size_in_bytes': 100,
                    'digest': 'sha256:' + 'c' * 64, 'workflow_run': {'id': 18, 'head_sha': 'a' * 40}}
        run = {'id': 18, 'event': 'workflow_dispatch', 'path': utility.WORKFLOW, 'head_sha': 'a' * 40,
               'status': 'completed', 'conclusion': 'success'}
        jobs = {'jobs': [{'name': n, 'head_sha': 'a' * 40, 'status': 'completed', 'conclusion': 'success'}
                        for n in ['qualify', 'test (1)', 'test (2)', 'test (3)', 'test (4)', 'freeze']]}
        class API:
            def __init__(self, rows): self.rows = iter(rows)
            def get(self, _path): return next(self.rows)
        self.assertEqual(utility.artifact_authority(API([artifact, run, jobs]), value), artifact)
        for position, key, replacement in [(0, 'expired', True), (1, 'head_sha', 'b' * 40),
                                            (1, 'conclusion', 'failure'), (1, 'event', 'push')]:
            rows = copy.deepcopy([artifact, run, jobs]); rows[position][key] = replacement
            with self.assertRaises(ValueError): utility.artifact_authority(API(rows), value)
        broken = copy.deepcopy(jobs); broken['jobs'][-1]['conclusion'] = 'skipped'
        with self.assertRaises(ValueError): utility.artifact_authority(API([artifact, run, broken]), value)

    def test_disk_refusal_happens_before_subprocess_or_output(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(utility.shutil, 'disk_usage') as disk, \
                patch.object(utility.subprocess, 'Popen') as process:
            disk.return_value.free = utility.RESERVE
            path = Path(tmp) / 'original.zip'
            with self.assertRaisesRegex(ValueError, 'reserve'):
                utility.receive(path, 'repos/example/project/actions/artifacts/17/zip', 100, 'c' * 64)
            process.assert_not_called(); self.assertFalse(path.exists())

    def test_upload_methods_keep_member_mime_and_forbid_other_names(self):
        api = utility.RecordedGitHub('x' * 30, Path('unused'))
        with patch.object(utility.upload_distribution.GitHub, 'upload', return_value='zip') as zipped:
            self.assertEqual(api.upload('/repos/e/p/releases/1/assets?name=distribution.zip', None, 1, 'a' * 64), 'zip')
            zipped.assert_called_once()
        with self.assertRaises(ValueError): api.upload('/repos/e/p/releases/1/assets?name=other', None, 1, 'a' * 64)


class InspectionCommandTests(unittest.TestCase):
    def test_utility_sparse_checkouts_include_policy_module_and_data(self):
        workflow = (Path(__file__).parents[2] / '.github/workflows/qualify-release-source.yml').read_text()
        policy_pair = '            publishing/test-policy.mjs\n            publishing/test-policy.json\n'
        self.assertEqual(workflow.count(policy_pair), 2)

    def test_release_utility_passes_exact_distribution_cap(self):
        text = Path(utility.__file__).read_text()
        self.assertIn("'--max-distribution-bytes'", text)
        self.assertIn('str(MAX_DISTRIBUTION_BYTES)', text)


class EvidenceTests(unittest.TestCase):
    def evidence(self, source, contents, *, extra=None):
        rows = [{'path': n, 'bytes': len(b), 'sha256': utility.sha(b)} for n, b in contents.items()]
        manifest = {'sourceRevision': source['commit'], 'sourceTree': source['tree'], 'version': source['version'], 'files': rows}
        output = io.BytesIO()
        with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
            for name, body in contents.items(): archive.writestr(name, body)
            archive.writestr('evidence-manifest.json', encoded(manifest))
            if extra: archive.writestr(*extra)
        return output.getvalue(), rows

    def test_every_pin_and_member_and_sensitive_pattern_is_checked(self):
        source = binding()['source']
        body, rows = self.evidence(source, {'logs/pass.log': b'actual fixture\n', 'empty.log': b''})
        q = {'evidencePins': rows}
        result = utility.verify_evidence(body, q, source)
        self.assertEqual(result['files'], 2)
        q['evidencePins'] = [{'path': 'missing.log', 'bytes': 0, 'sha256': utility.sha(b'')}]
        with self.assertRaises(ValueError): utility.verify_evidence(body, q, source)
        for name, contents in [('unsafe', {'../escape': b'x'}), ('secret', {'log.txt': b'Bearer ' + b'x' * 30})]:
            bad, _ = self.evidence(source, contents)
            with self.subTest(name=name), self.assertRaises(ValueError):
                utility.verify_evidence(bad, {'evidencePins': []}, source)
        bad, _ = self.evidence(source, {'log.txt': b'first'}, extra=('log.txt', b'second'))
        with self.assertRaises(ValueError): utility.verify_evidence(bad, {'evidencePins': []}, source)
        wrong = dict(source, commit='f' * 40)
        with self.assertRaises(ValueError): utility.verify_evidence(body, {'evidencePins': []}, wrong)


class OriginalFixtureTests(unittest.TestCase):
    def test_default_distribution_envelope_accepts_large_soundtrack_builds_but_remains_bounded(self):
        self.assertEqual(inspector.DEFAULT_MAX_DISTRIBUTION_MIB, 1024)
        self.assertLess(inspector.DEFAULT_MAX_DISTRIBUTION_MIB, inspector.MAX_DISTRIBUTION_MIB)
        self.assertTrue(inspector.distribution_within_limit(600 * inspector.CHUNK))
        self.assertFalse(inspector.distribution_within_limit(1024 * inspector.CHUNK + 1))
        self.assertFalse(inspector.distribution_within_limit(-1))

    def test_real_git_tar_zip_offline_roundtrip_and_source_hash_rejection(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); repo = root / 'repo'; repo.mkdir()
            def git(*args):
                return subprocess.check_output(['git', '-C', str(repo), *args], stderr=subprocess.DEVNULL).strip()
            git('init'); git('config', 'user.email', 'fixture@example.invalid'); git('config', 'user.name', 'Fixture')
            worker = repo / 'game/offline/service-worker.template.js'; worker.parent.mkdir(parents=True)
            worker.write_bytes(b'const config=__XONIX_OFFLINE_CONFIG__;\n')
            (repo / 'run.sh').write_bytes(b'#!/bin/sh\nexit 0\n'); (repo / 'run.sh').chmod(0o755)
            git('add', '.'); git('commit', '-m', 'local fixture')
            commit, tree = git('rev-parse', 'HEAD').decode(), git('rev-parse', 'HEAD^{tree}').decode()
            version = 'v1.2.3'; build_id = 'd' * 64
            marker = {'format': 'revealline-offline.v1', 'version': version, 'buildId': build_id}
            index = b'<meta name="revealline-offline" content=\'' + encoded(marker) + b"'>"
            files = {'game/index.html': index, 'game/build-info.json': encoded({'formatVersion': 1,
                     'version': version, 'sourceRevision': commit, 'entry': 'game/index.html'})}
            def rows(contents): return [{'path': n, 'bytes': len(b), 'sha256': utility.sha(b)} for n, b in contents.items()]
            offline = {**marker, 'files': rows(files)}
            files['offline-cache.json'] = encoded(offline)
            files['service-worker.js'] = worker.read_bytes().replace(b'__XONIX_OFFLINE_CONFIG__', encoded(offline))
            manifest = encoded({'formatVersion': 1, 'version': version, 'sourceRevision': commit,
                       'entry': 'game/index.html', 'files': rows(files), 'totalBytes': sum(map(len, files.values()))})
            inner = io.BytesIO()
            with zipfile.ZipFile(inner, 'w') as archive:
                for name, body in files.items(): archive.writestr(name, body)
                archive.writestr('manifest.json', manifest)
            tar = subprocess.check_output(['git', '-C', str(repo), 'archive', '--format=tar', 'HEAD'])
            release = encoded({'formatVersion': 1, 'version': version, 'sourceRevision': commit,
                       'sourceArchiveSha256': utility.sha(tar), 'distributionSha256': utility.sha(inner.getvalue()),
                       'manifestSha256': utility.sha(manifest), 'play': version + '/site/game/',
                       'download': version + '/site/distribution.zip'})
            base = root / 'out'; base.mkdir(); original = base / 'qualified-artifact-original.zip'
            with zipfile.ZipFile(original, 'w') as archive:
                for name, body in {'release.json': release, 'source.tar': tar, 'site/manifest.json': manifest,
                       'site/distribution.zip': inner.getvalue(),
                       'distribution.zip.sha256': (utility.sha(inner.getvalue()) + '  distribution.zip\n').encode()}.items():
                    archive.writestr(version + '/' + name, body)
            digest = utility.sha(original.read_bytes())
            inspector = Path(utility.__file__).with_name('inspect_qualified_artifact.py')
            verified = base / 'qualified-artifact-verified'
            result = subprocess.run([sys.executable, str(inspector), str(original), '--repo', str(repo),
                       '--expected-commit', commit, '--expected-version', version, '--artifact-sha256', digest,
                       '--max-distribution-bytes', str(len(inner.getvalue())), '--out', str(verified)],
                       capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            inspection = json.loads((verified / 'inspection.json').read_text())
            self.assertTrue(inspection['distribution']['allManifestBytesVerified'])
            self.assertFalse((verified / 'distribution.zip').exists())
            self.assertFalse((verified / 'source.tar').exists())
            download = base / 'qualified-artifact-original.download.json'
            utility.record(download, {'status': 'ORIGINAL_RECEIVED_VERIFIED', 'exitCode': 0,
                    'sourceRevision': commit, 'bytes': original.stat().st_size, 'sha256': digest, 'output': str(original)})
            command = [sys.executable, str(inspector.with_name('verify_frozen_offline.py')), '--repo', str(repo),
                    '--base', str(base), '--source', commit, '--tree', tree, '--version', version,
                    '--inspection-sha256', utility.pin(verified / 'inspection.json')['sha256'],
                    '--download-sha256', utility.pin(download)['sha256'], '--manifest-sha256', utility.sha(manifest)]
            result = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertEqual(json.loads((base / 'frozen-offline-review/review.json').read_text())['offline']['files'], 2)
            # Wrong immutable source and wrong original SHA must not produce a passing output.
            for option, value in [('--expected-commit', 'f' * 40), ('--artifact-sha256', 'f' * 64)]:
                bad = [sys.executable, str(inspector), str(original), '--repo', str(repo), '--expected-commit', commit,
                       '--expected-version', version, '--artifact-sha256', digest, '--out', str(base / 'refused')]
                bad[bad.index(option) + 1] = value
                rejected = subprocess.run(bad, capture_output=True)
                self.assertNotEqual(rejected.returncode, 0); self.assertFalse((base / 'refused/inspection.json').exists())
            too_small = [sys.executable, str(inspector), str(original), '--repo', str(repo),
                         '--expected-commit', commit, '--expected-version', version, '--artifact-sha256', digest,
                         '--max-distribution-bytes', str(len(inner.getvalue()) - 1), '--out', str(base / 'refused')]
            rejected = subprocess.run(too_small, capture_output=True)
            self.assertNotEqual(rejected.returncode, 0); self.assertFalse((base / 'refused/inspection.json').exists())


class WorkflowTests(unittest.TestCase):
    def test_only_explicit_upload_job_has_write_permission_and_default_keeps_gates(self):
        root = Path(__file__).resolve().parents[2]
        text = (root / utility.WORKFLOW).read_text()
        inspect_job = text.split('\n  inspect-artifact:\n')[1].split('\n  upload-originals:\n')[0]
        upload_job = text.split('\n  upload-originals:\n')[1]
        regular = text.split('\n  inspect-artifact:\n')[0]
        self.assertEqual(text.count('contents: write'), 1)
        self.assertIn("inputs.operation == 'inspect-artifact'", inspect_job)
        self.assertIn('contents: read', inspect_job)
        self.assertIn("inputs.operation == 'upload-originals'", upload_job)
        self.assertIn('contents: write', upload_job)
        for section in [inspect_job, upload_job]:
            self.assertIn('ref: ${{ github.workflow_sha }}', section)
            self.assertIn('ref: ${{ steps.binding.outputs.source }}', section)
            self.assertIn('persist-credentials: false', section)
            self.assertIn('path: utility-output/evidence/', section)
            self.assertNotIn('release-snapshot', section)
            self.assertNotIn('npm run build', section)
            self.assertNotIn('gh release', section)
        self.assertIn('default: qualify', regular)
        for command in utility.COMMANDS:
            self.assertIn('run: ' + command, regular)
        self.assertIn('node scripts/run-test-shard.mjs --shard ${{ matrix.shard }}/4', regular)
        self.assertIn('needs: [qualify, test]', regular)
        self.assertIn("inputs.operation == 'qualify' && inputs.freeze_snapshot", regular)


class UploadBoundaryTests(unittest.TestCase):
    def run_case(self, failure=None):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp); (out / 'evidence').mkdir(); (out / 'qualified-artifact-verified').mkdir()
            for name in ['inspection.json', 'manifest.json', 'release.json', 'distribution.zip.sha256']:
                (out / 'qualified-artifact-verified' / name).write_bytes(b'x')
            value = binding('upload-originals')
            assets = [{'name': n, 'id': i + 1, 'size': 1, 'digest': 'sha256:' + utility.sha(b'x')}
                      for i, n in enumerate(sorted(utility.SMALL_NAMES))]
            events = []
            class Held:
                def __init__(self, args, name):
                    events.append('prepare ' + name)
                    if failure == 'distribution-preflight' and name == 'distribution':
                        raise ValueError('Second member failed before POST')
                    self.name = name
                def close(self): events.append('close ' + self.name)
            def source_perform(*_args):
                events.append('POST source')
                if failure == 'ambiguous-source': raise utility.upload_source.Ambiguous('unconfirmed synthetic response')
                return {'status': 'UPLOADED_VERIFIED'}
            def distribution_perform(*_args):
                events.append('POST distribution'); return {'status': 'UPLOADED_VERIFIED'}
            def receive(path, *_args, **_kwargs): path.write_bytes(b'x')
            with patch.object(utility, 'asset_set', return_value=assets), patch.object(utility, 'receive', side_effect=receive), \
                 patch.object(utility, 'small_assets_check', return_value={}), \
                 patch.object(utility.upload_source, 'PinnedSource', side_effect=lambda args: Held(args, 'source')), \
                 patch.object(utility.upload_distribution, 'PinnedDistribution', side_effect=lambda args: Held(args, 'distribution')), \
                 patch.object(utility.upload_source, 'perform', side_effect=source_perform), \
                 patch.object(utility.upload_distribution, 'perform', side_effect=distribution_perform):
                if failure:
                    with self.assertRaises((ValueError, utility.upload_source.Ambiguous)):
                        utility.upload_originals(value, out, {}, object())
                else:
                    utility.upload_originals(value, out, {}, object())
            if failure == 'distribution-preflight':
                self.assertNotIn('POST source', events)
                self.assertFalse((out / 'evidence/source.tar.upload-started.json').exists())
            elif failure == 'ambiguous-source':
                self.assertNotIn('POST distribution', events)
                pending = json.loads((out / 'evidence/source.tar.upload-started.json').read_text())
                self.assertTrue(pending['requiresAssetReread'])
                self.assertFalse((out / 'evidence/all-nine-assets.json').exists())
            else:
                self.assertLess(events.index('prepare distribution'), events.index('POST source'))
                self.assertEqual(events.count('POST source'), 1)
                self.assertEqual(events.count('POST distribution'), 1)
                self.assertTrue((out / 'evidence/all-nine-assets.json').exists())
            self.assertIn('close source', events)

    def test_both_members_preflight_before_post(self): self.run_case()
    def test_second_member_preflight_failure_has_zero_posts(self): self.run_case('distribution-preflight')
    def test_ambiguous_source_never_posts_distribution(self): self.run_case('ambiguous-source')


class ResumeUploadTests(unittest.TestCase):
    """Exercise real draft/tag validators and both perform engines with finite in-memory I/O."""
    def run_case(self, existing=(), *, mutate=None, late_mutate=None, failed_member=None,
                 tag_commit=None, expect_failure=False, late_read=2, expected_started=frozenset()):
        value = binding('upload-originals')
        bodies = {name: name.encode() for name in utility.NAMES}
        value['release']['assets'] = [dict(name=name, bytes=len(body), sha256=utility.sha(body))
                                     for name, body in sorted(bodies.items())]
        descriptors = {row['name']: row for row in value['release']['assets']}
        def asset(name):
            row = descriptors[name]; asset_id = sorted(utility.NAMES).index(name) + 1
            return {'id': asset_id, 'name': name, 'state': 'uploaded', 'size': row['bytes'],
                    'digest': 'sha256:' + row['sha256'],
                    'url': f'https://api.github.com/repos/example/project/releases/assets/{asset_id}'}
        assets = [asset(name) for name in sorted(utility.SMALL_NAMES | set(existing))]
        if mutate: mutate(assets)
        events, downloads = [], []
        class API:
            reads = 0
            def get(self, path):
                if path == '/repos/example/project/releases/19':
                    return {'id': 19, 'tag_name': 'v1.2.3', 'draft': True, 'published_at': None,
                            'url': 'https://api.github.com' + path,
                            'assets_url': 'https://api.github.com' + path + '/assets',
                            'upload_url': 'https://uploads.github.com' + path + '/assets{?name,label}'}
                if path == '/repos/example/project/releases/19/assets?per_page=100&page=1':
                    self.reads += 1
                    if self.reads == late_read and late_mutate: late_mutate(assets)
                    return copy.deepcopy(assets)
                if path == '/repos/example/project/git/ref/tags/v1.2.3':
                    return {'ref': 'refs/tags/v1.2.3',
                            'object': {'type': 'commit', 'sha': tag_commit or value['source']['commit']}}
                raise AssertionError('Unexpected API request: ' + path)
            def upload(self, path, stream, size, expected_hash):
                name = path.split('?name=')[1]
                events.append('POST ' + name)
                body = stream.read()
                self_test.assertEqual((len(body), utility.sha(body)), (size, expected_hash))
                result = asset(name); assets.append(result)
                return copy.deepcopy(result), size, expected_hash
        self_test = self
        class Held:
            def __init__(self, args, name):
                events.append('prepare ' + name)
                if failed_member == name: raise ValueError('Held original preflight failed')
                prefix = 'source' if name == 'source.tar' else 'member'
                self_test.assertEqual(getattr(args, prefix + '_sha256'), descriptors[name]['sha256'])
                self_test.assertEqual(getattr(args, prefix + '_bytes'), descriptors[name]['bytes'])
                self.name, self.commit = name, args.source_commit
                self.size, self.sha256 = descriptors[name]['bytes'], descriptors[name]['sha256']
            def unchanged(self): events.append('unchanged ' + self.name)
            def open(self): return io.BytesIO(bodies[self.name])
            def close(self): events.append('close ' + self.name)
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp); (out / 'evidence').mkdir(); (out / 'qualified-artifact-verified').mkdir()
            (out / 'qualified-artifact-verified/inspection.json').write_bytes(b'fixture inspection')
            for name in ['manifest.json', 'release.json', 'distribution.zip.sha256']:
                (out / 'qualified-artifact-verified' / name).write_bytes(bodies[name])
            def receive(path, _request, size, digest, **_kwargs):
                downloads.append(path.name)
                self.assertEqual((size, digest), (len(bodies[path.name]), utility.sha(bodies[path.name])))
                path.write_bytes(bodies[path.name])
            with patch.object(utility, 'receive', side_effect=receive), \
                 patch.object(utility, 'small_assets_check', return_value={'fixture': True}) as checked, \
                 patch.object(utility.upload_source, 'PinnedSource', side_effect=lambda args: Held(args, 'source.tar')), \
                 patch.object(utility.upload_distribution, 'PinnedDistribution', side_effect=lambda args: Held(args, 'distribution.zip')):
                if expect_failure:
                    with self.assertRaises((ValueError, utility.upload_source.Refusal,
                                            utility.upload_source.Ambiguous, utility.upload_distribution.Ambiguous)):
                        utility.upload_originals(value, out, {}, API())
                else:
                    utility.upload_originals(value, out, {}, API())
                    self.assertEqual(set(checked.call_args.args[1]), utility.SMALL_NAMES)
            receipts = {p.name: json.loads(p.read_text()) for p in (out / 'evidence').glob('*.json')}
            started = {p.name for p in (out / 'evidence').glob('*.upload-started.json')}
        posts = [event.removeprefix('POST ') for event in events if event.startswith('POST ')]
        if expect_failure:
            self.assertEqual(posts, [])
            self.assertEqual(started, expected_started)
            self.assertNotIn('all-nine-assets.json', receipts)
        else:
            self.assertEqual(set(downloads), utility.SMALL_NAMES)
            self.assertEqual(len(downloads), 7)
            self.assertEqual(posts, [name for name in ['source.tar', 'distribution.zip'] if name not in existing])
            for name in ['source.tar', 'distribution.zip']:
                result = receipts[name + '.upload-result.json']
                retained = name in existing
                self.assertEqual(result['status'], 'EXISTING_VERIFIED' if retained else 'UPLOADED_VERIFIED')
                self.assertEqual(result['postCount'], 0 if retained else 1)
                self.assertEqual((result['assetId'], result['bytes'], result['sha256']),
                                 (asset(name)['id'], descriptors[name]['bytes'], descriptors[name]['sha256']))
                self.assertTrue(result['readBackVerified'])
                self.assertEqual(name + '.upload-started.json' in started, not retained)
                self.assertIn('prepare ' + name, events)
                self.assertIn('unchanged ' + name, events)
                self.assertIn('close ' + name, events)
                for posted in posts:
                    self.assertLess(events.index('prepare ' + name), events.index('POST ' + posted))
            self.assertEqual({a['name'] for a in receipts['all-nine-assets.json']['assets']}, utility.NAMES)
        return events

    def test_seven_small_assets_upload_both_originals_once(self): self.run_case()
    def test_complete_source_uploads_only_missing_distribution(self): self.run_case(('source.tar',))
    def test_complete_distribution_uploads_only_missing_source(self): self.run_case(('distribution.zip',))
    def test_both_complete_are_verified_without_any_post(self): self.run_case(('source.tar', 'distribution.zip'))

    def test_invalid_existing_original_refuses_before_any_post(self):
        for name in ['source.tar', 'distribution.zip']:
            for field, wrong in [('state', 'starter'), ('digest', None), ('digest', 'sha256:' + 'f' * 64),
                                 ('size', 0), ('size', 999), ('id', 0), ('url', 'https://elsewhere.invalid/asset')]:
                def mutate(rows): next(row for row in rows if row['name'] == name)[field] = wrong
                with self.subTest(name=name, field=field, wrong=wrong):
                    self.run_case((name,), mutate=mutate, expect_failure=True)

    def test_duplicate_or_unexpected_asset_refuses_before_any_post(self):
        def duplicate(rows): rows.append(copy.deepcopy(rows[-1]))
        def unexpected(rows): rows.append(dict(rows[-1], id=98, name='extra.zip'))
        for mutate in [duplicate, unexpected]:
            with self.subTest(mutate=mutate.__name__):
                self.run_case(('source.tar',), mutate=mutate, expect_failure=True)

    def test_every_small_asset_remains_mandatory_and_exact(self):
        for name in sorted(utility.SMALL_NAMES):
            def missing(rows): rows.remove(next(row for row in rows if row['name'] == name))
            def corrupt(rows): next(row for row in rows if row['name'] == name)['digest'] = 'sha256:' + 'f' * 64
            for mutate in [missing, corrupt]:
                with self.subTest(name=name, mutate=mutate.__name__):
                    self.run_case(('source.tar', 'distribution.zip'), mutate=mutate, expect_failure=True)

    def test_changed_tag_refuses_before_any_post(self):
        self.run_case(('source.tar',), tag_commit='f' * 40, expect_failure=True)

    def test_invalid_asset_appearing_during_preflight_refuses_before_any_post(self):
        def duplicate(rows): rows.append(copy.deepcopy(rows[-1]))
        self.run_case(('source.tar',), late_mutate=duplicate, expect_failure=True)

    def test_newer_helper_read_cannot_bypass_complete_draft_post_guard(self):
        def corrupt_small(rows): rows[0]['digest'] = 'sha256:' + 'f' * 64
        def duplicate(rows): rows.append(copy.deepcopy(rows[0]))
        def unexpected(rows): rows.append(dict(rows[0], id=98, name='extra.zip'))
        def starter(rows): rows.append(dict(rows[0], id=99, name='distribution.zip', state='starter'))
        for mutate in [corrupt_small, duplicate, unexpected, starter]:
            with self.subTest(mutate=mutate.__name__):
                # Read 1: initial inventory; 2: outer decision; 3: unchanged engine's own reread.
                self.run_case(late_mutate=mutate, late_read=3, expect_failure=True,
                              expected_started={'source.tar.upload-started.json'})

    def test_recovery_still_preflights_both_held_originals(self):
        for existing in [('source.tar',), ('distribution.zip',), ('source.tar', 'distribution.zip')]:
            for name in ['source.tar', 'distribution.zip']:
                with self.subTest(existing=existing, failed_member=name):
                    self.run_case(existing, failed_member=name, expect_failure=True)


class AttachmentTests(unittest.TestCase):
    def test_nine_descriptors_bind_original_members_and_prior_qualification(self):
        value = binding('upload-originals'); source = value['source']
        body, evidence_rows = EvidenceTests().evidence(source, {'proof.log': b'synthetic evidence'})
        inspected = {'format': 'revealline-qualified-artifact-offline-inspection.v1', 'status': 'PASS',
            'gitHead': source['commit'], 'gitTree': source['tree'], 'version': source['version'],
            'manifestSha256': utility.sha(b'manifest'), 'releaseHashChainVerified': True,
            'artifact': dict(value['artifact']),
            'sourceTar': {'bytes': 1, 'sha256': utility.sha(b't'), 'outerMember': 'v1.2.3/source.tar'},
            'distribution': {'bytes': 1, 'sha256': utility.sha(b'z'), 'outerMember': 'v1.2.3/site/distribution.zip',
                             'allManifestBytesVerified': True, 'innerManifestIdentical': True}}
        bodies = {'manifest.json': b'manifest', 'release.json': b'release', 'distribution.zip.sha256': b'checksum',
                  'verification.json': encoded(inspected), 'source-qualification-evidence.zip': body}
        q = qualification(value); q['evidencePins'] = evidence_rows
        q['frozenArtifactCorroboration']['inputs'] = {
            role: {'bytes': len(bodies[name]), 'sha256': utility.sha(bodies[name])}
            for role, name in [('inspection', 'verification.json'), ('manifest', 'manifest.json'),
                               ('releaseRecord', 'release.json'), ('checksum', 'distribution.zip.sha256')]}
        bodies['source-qualification.json'] = encoded(q)
        rows = [{'name': name, 'bytes': len(body), 'sha256': utility.sha(body)} for name, body in bodies.items()]
        for name, role in [('source.tar', 'sourceTar'), ('distribution.zip', 'distribution')]:
            rows.append({'name': name, **{k: inspected[role][k] for k in ['bytes', 'sha256']},
                         'originalMember': inspected[role]['outerMember'], 'copiedToDisk': False})
        record = {'sourceRevision': source['commit'], 'sourceTree': source['tree'], 'version': source['version'],
                  'sourceQualified': True, 'originalFrozenPayloadVerified': True, 'attachments': rows,
                  'sourceGateCounts': counts(4), 'frozenArtifact': {**value['artifact'], 'externallyExpectedDigestSupplied': True}}
        bodies['qualification-evidence-record.json'] = encoded(record)
        value['release']['assets'] = [{k: row[k] for k in ['name', 'bytes', 'sha256']} for row in rows] + [
            {'name': 'qualification-evidence-record.json', 'bytes': len(bodies['qualification-evidence-record.json']),
             'sha256': utility.sha(bodies['qualification-evidence-record.json'])}]
        self.assertTrue(utility.small_assets_check(value, bodies, inspected)['allQualificationPinsResolved'])
        for mutation in ['member', 'frozen-hash', 'counts', 'qualification-pin']:
            bad_bodies = dict(bodies); bad_record = copy.deepcopy(record); bad_q = copy.deepcopy(q)
            if mutation == 'member': bad_record['attachments'][-1]['originalMember'] = 'other/distribution.zip'
            elif mutation == 'frozen-hash': bad_record['frozenArtifact']['sha256'] = 'f' * 64
            elif mutation == 'counts': bad_record['sourceGateCounts'] = counts(5)
            else: bad_q['frozenArtifactCorroboration']['inputs']['manifest']['sha256'] = 'f' * 64
            bad_bodies['qualification-evidence-record.json'] = encoded(bad_record)
            bad_bodies['source-qualification.json'] = encoded(bad_q)
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                utility.small_assets_check(value, bad_bodies, inspected)


if __name__ == '__main__':
    unittest.main()
