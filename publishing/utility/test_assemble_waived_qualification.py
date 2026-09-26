"""Tiny offline adapter fixtures. They do not qualify any real release."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import assemble_waived_qualification as adapter
import test_waived_qualification as waived


class AdapterTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        value, _, _, self.policy, self.manual, jobs = waived.fixture()
        self.source, self.artifact = value['source'], value['artifact']
        self.manual['updated_at'] = '2026-09-22T00:00:00Z'
        extra = ['Record source identity', 'Require reviewed production slots in the committed ledger',
                 'Verify qualified tracked source is unchanged']
        jobs['jobs'][0]['steps'] += [self.step(n, i + 10) for i, n in enumerate(extra)]
        jobs['jobs'][2]['steps'] = [self.step(n, i + 1) for i, n in enumerate(
            ['Freeze the exact qualified commit', 'Retain original release assets'])]
        self.jobs = jobs
        self.pr_run = dict(self.manual, id=20, event='pull_request', path='.github/workflows/deploy-pages.yml')
        build = dict(jobs['jobs'][0], id=201, run_id=20, name='build', steps=[self.step(n, i + 1) for i, n in enumerate(
            ['Verify exact tracked source before commands', 'Validate release-critical source',
             'Defer full artifact build to merged-source qualification',
             'Verify tracked source after fast release gate'])])
        self.pr_jobs = {'total_count': 2, 'jobs': [build, dict(build, name='preflight', id=202)]}
        self.inspection_run = dict(self.manual, id=21)
        inspection_jobs = {'total_count': 1, 'jobs': [dict(build, id=301, run_id=21, name='inspect-artifact')]}
        self.config = {'format': 'revealline-waived-qualification-inputs.v1', 'reviewed': True,
            'repository': 'mekhovov/revealline', 'repositoryPath': str(self.root), 'source': self.source,
            'prSource': {k: self.source[k] for k in ('commit', 'tree')}, 'sourcePR': 999,
            'approvedNonSourceChanges': [], 'inspectionDirectory': str(self.root / 'inspection')}
        for role, run, job in [('manual', self.manual, jobs), ('pr', self.pr_run, self.pr_jobs),
                               ('inspection', self.inspection_run, inspection_jobs)]:
            self.config[role] = {}
            for name, value in [('run', run), ('jobs', job)]:
                path = self.root / (role + '-' + name + '.json')
                path.write_bytes(adapter.encoded(value))
                self.config[role][name] = str(path)
        self.inspection()
        self.helper_root = Path(__file__).parent
        self.git_patch = patch.object(adapter, 'git', side_effect=self.git)
        self.blob_patch = patch.object(adapter, 'blob', side_effect=self.blob)
        self.git_patch.start()
        self.blob_patch.start()
        self.addCleanup(self.git_patch.stop)
        self.addCleanup(self.blob_patch.stop)

    @staticmethod
    def step(name, number):
        return {'name': name, 'number': number, 'status': 'completed', 'conclusion': 'success'}

    def blob(self, repo, revision, name):
        self.assertEqual(revision, self.source['commit'])
        if name == adapter.POLICY:
            return adapter.encoded(self.policy)
        if name in ('package.json', 'package-lock.json'):
            return adapter.encoded({'version': '1.2.3'})
        return (self.helper_root / Path(name).name).read_bytes()

    def git(self, repo, *args):
        if args[0] == 'rev-parse':
            return (self.source['tree'] + '\n').encode()
        if args[0] == 'diff':
            return b''
        if args[0] == 'ls-tree':
            return ('\n'.join('publishing/utility/' + p.name for p in self.helper_root.glob('*.py')) + '\n').encode()
        self.fail('Unexpected Git operation: ' + repr(args))

    def inspection(self):
        s = self.source
        verify = {'format': 'revealline-qualified-artifact-offline-inspection.v1', 'status': 'PASS',
            'gitHead': s['commit'], 'gitTree': s['tree'], 'version': s['version'],
            'manifestSha256': adapter.sha(b'manifest'), 'releaseHashChainVerified': True,
            'artifact': {**self.artifact, 'externallyExpectedDigestSupplied': True},
            'sourceTar': {'bytes': 1, 'sha256': adapter.sha(b't'), 'outerMember': 'v1.2.3/source.tar',
                          'paxCommitPresent': True, 'copiedToDisk': False},
            'distribution': {'bytes': 1, 'sha256': adapter.sha(b'z'), 'outerMember': 'v1.2.3/site/distribution.zip',
                'allManifestBytesVerified': True, 'innerManifestIdentical': True, 'copiedToDisk': False}}
        identity = {'sourceRevision': s['commit'], 'sourceTree': s['tree'], 'trackedCheckoutClean': True}
        helper = Path(__file__).with_name('release_limits.py').read_bytes()
        self.originals = {
            'binding.json': adapter.encoded({'source': s, 'artifact': self.artifact, 'repository': 'mekhovov/revealline',
                                             'reviewed': True, 'release': None}),
            'result.json': adapter.encoded({'source': s, 'artifact': self.artifact, 'status': 'INSPECTED_VERIFIED',
                                            'operation': 'inspect-artifact'}),
            'qualified-artifact-verified/inspection.json': adapter.encoded(verify),
            'qualified-artifact-verified/manifest.json': b'manifest',
            'qualified-artifact-verified/release.json': b'release',
            'qualified-artifact-verified/distribution.zip.sha256': b'checksum',
            'source-before.json': adapter.encoded(identity), 'source-after.json': adapter.encoded(identity),
            'execution.json': adapter.encoded({'runId': '21', 'workflowSha': s['commit'], 'sourceCheckout': identity,
                'helpers': [adapter.pin('/runner/automation/publishing/utility/release_limits.py', helper)]}),
            'api/artifact.json': adapter.encoded({'id': self.artifact['id'], 'name': 'qualified-release-snapshot',
                'expired': False, 'size_in_bytes': self.artifact['bytes'], 'digest': 'sha256:' + self.artifact['sha256'],
                'workflow_run': {'id': 18, 'head_sha': s['commit']}}),
            'frozen-offline-review/originals/offline.json': b'{}'}
        self.originals['frozen-offline-review/review.json'] = adapter.encoded({'status': 'PASS',
            'sourceRevision': s['commit'], 'sourceTree': s['tree'], 'version': s['version'],
            'offline': {**{k: True for k in ['allOfflineRowsMatchFrozenManifest', 'allOfflineBytesVerified',
                'offlineBudgetVerified', 'workerInventoryBindingVerified', 'entryMetaBindingVerified', 'entryIncluded']},
                'files': 1, 'bytes': 2},
            'inspectionPin': adapter.pin('inspection.json', self.originals['qualified-artifact-verified/inspection.json']),
            'manifestPin': adapter.pin('manifest.json', b'manifest'),
            'originals': [{'archivePath': 'offline.json', 'bytes': 2, 'sha256': adapter.sha(b'{}')}]})
        self.write_inspection()

    def write_inspection(self):
        directory = self.root / 'inspection'
        for name, body in self.originals.items():
            path = directory / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(body)
        (directory / 'retained-manifest.json').write_bytes(adapter.encoded({'files': [
            adapter.pin('/runner/utility-output/evidence/' + n, b) for n, b in sorted(self.originals.items())]}))

    def test_complete_package_runs_fresh_consumer_and_truthful_seven_nine_inventory(self):
        output = self.root / 'out'
        result = adapter.assemble(self.config, output)
        self.assertEqual(len(list(output.iterdir())), 7)
        self.assertEqual(len(result['artifacts']), 9)
        self.assertTrue(result['consumer']['allQualificationPinsResolved'])
        q = json.loads((output / 'source-qualification.json').read_bytes())
        self.assertEqual(q['tests'], {'status': 'waived', 'counts': None})
        self.assertNotIn('passed', q)
        self.assertEqual(len(q['gates']), 5)
        self.assertFalse((output / 'source.tar').exists())
        with self.assertRaisesRegex(ValueError, 'Fresh ordinary output'):
            adapter.assemble(self.config, output)

    def test_previous_successful_pr_build_generation_is_retained_truthfully(self):
        jobs = copy.deepcopy(self.pr_jobs)
        jobs['jobs'][0]['steps'] = [self.step(n, i + 1) for i, n in enumerate([
            'Verify exact tracked source before commands', 'Validate release-critical source',
            'Build pull-request artifact',
            'Verify tracked source after build'])]
        for name in ('Defer full artifact build to merged-source qualification',
                     'Verify tracked source after fast release gate'):
            skipped = self.step(name, len(jobs['jobs'][0]['steps']) + 1)
            skipped['conclusion'] = 'skipped'
            jobs['jobs'][0]['steps'].append(skipped)
        Path(self.config['pr']['jobs']).write_bytes(adapter.encoded(jobs))
        output = self.root / 'out'
        adapter.assemble(self.config, output)
        qualification = json.loads((output / 'source-qualification.json').read_bytes())
        self.assertNotIn('preMergeValidationCorroboration', qualification)
        self.assertEqual(qualification['ordinaryBuildCorroboration']['command'], 'npm run build')
        self.assertEqual(qualification['ordinaryBuildCorroboration']['step']['name'],
                         'Build pull-request artifact')

    def test_current_fast_generation_allows_skipped_historical_steps(self):
        jobs = copy.deepcopy(self.pr_jobs)
        for name in ('Build pull-request artifact', 'Verify tracked source after build'):
            skipped = self.step(name, len(jobs['jobs'][0]['steps']) + 1)
            skipped['conclusion'] = 'skipped'
            jobs['jobs'][0]['steps'].append(skipped)
        Path(self.config['pr']['jobs']).write_bytes(adapter.encoded(jobs))
        output = self.root / 'out'
        adapter.assemble(self.config, output)
        qualification = json.loads((output / 'source-qualification.json').read_bytes())
        self.assertNotIn('ordinaryBuildCorroboration', qualification)
        self.assertEqual(qualification['preMergeValidationCorroboration']['command'], 'npm run validate')

    def test_current_focused_gate_generation_requires_successful_aggregate_and_skipped_long_jobs(self):
        jobs = copy.deepcopy(self.pr_jobs)
        jobs['jobs'][0]['conclusion'] = 'skipped'
        focused = dict(jobs['jobs'][0], id=203, name='focused', conclusion='success', steps=[
            self.step('Capture the reviewed changed-path set', 1),
            self.step('Select the fail-closed focused gate', 2),
        ])
        release_ready = dict(focused, id=204, name='release-ready', steps=[])
        test_job = dict(focused, id=205, name='test', conclusion='skipped', steps=[])
        jobs['jobs'].extend([focused, release_ready, test_job])
        jobs['total_count'] = len(jobs['jobs'])
        Path(self.config['pr']['jobs']).write_bytes(adapter.encoded(jobs))
        output = self.root / 'out'
        adapter.assemble(self.config, output)
        qualification = json.loads((output / 'source-qualification.json').read_bytes())
        focused_evidence = qualification['focusedAdmissionCorroboration']
        self.assertEqual(focused_evidence['genericBuild']['status'], 'skipped-by-fast-release-policy')
        self.assertEqual(focused_evidence['fullTests']['status'], 'waived-and-skipped')
        self.assertNotIn('preMergeValidationCorroboration', qualification)

        for job_name in ('focused', 'release-ready'):
            bad = copy.deepcopy(jobs)
            next(job for job in bad['jobs'] if job['name'] == job_name)['conclusion'] = 'skipped'
            Path(self.config['pr']['jobs']).write_bytes(adapter.encoded(bad))
            with self.subTest(job=job_name), self.assertRaisesRegex(ValueError, 'Successful job missing'):
                adapter.assemble(self.config, self.root / ('out-' + job_name))

    def test_pr_build_modes_cannot_be_partial_or_both_successful(self):
        jobs = copy.deepcopy(self.pr_jobs)
        jobs['jobs'][0]['steps'].append(self.step('Build pull-request artifact', 99))
        Path(self.config['pr']['jobs']).write_bytes(adapter.encoded(jobs))
        with self.assertRaisesRegex(ValueError, 'Incomplete historical PR build corroboration'):
            adapter.assemble(self.config, self.root / 'out-partial')
        jobs = copy.deepcopy(self.pr_jobs)
        jobs['jobs'][0]['steps'].extend([self.step('Build pull-request artifact', 98),
                                        self.step('Verify tracked source after build', 99)])
        Path(self.config['pr']['jobs']).write_bytes(adapter.encoded(jobs))
        with self.assertRaisesRegex(ValueError, 'Exactly one successful PR build corroboration mode required'):
            adapter.assemble(self.config, self.root / 'out-both')

    def test_missing_failed_cancelled_or_success_instead_of_skipped_test_refused(self):
        for conclusion in ('failure', 'cancelled', 'success'):
            jobs = copy.deepcopy(self.jobs)
            jobs['jobs'][1]['conclusion'] = conclusion
            Path(self.config['manual']['jobs']).write_bytes(adapter.encoded(jobs))
            with self.subTest(conclusion=conclusion), self.assertRaises((ValueError, __import__('subprocess').CalledProcessError)):
                adapter.assemble(self.config, self.root / 'out')
            self.assertFalse((self.root / 'out').exists())

    def test_gate_and_pr_validation_must_be_actual_successful_steps(self):
        for role, raw, job_index, step_index in [('manual', self.jobs, 0, 0), ('pr', self.pr_jobs, 0, 1)]:
            bad = copy.deepcopy(raw)
            bad['jobs'][job_index]['steps'][step_index]['conclusion'] = 'skipped'
            Path(self.config[role]['jobs']).write_bytes(adapter.encoded(bad))
            with self.subTest(role=role), self.assertRaisesRegex(ValueError, 'successful step'):
                adapter.assemble(self.config, self.root / 'out')
            Path(self.config[role]['jobs']).write_bytes(adapter.encoded(raw))

    def test_inspection_original_tamper_and_extra_file_refused(self):
        path = self.root / 'inspection/qualified-artifact-verified/manifest.json'
        path.write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError, 'Retained pin'):
            adapter.assemble(self.config, self.root / 'out')
        path.write_bytes(b'manifest')
        (self.root / 'inspection/extra').write_bytes(b'x')
        with self.assertRaisesRegex(ValueError, 'closure'):
            adapter.assemble(self.config, self.root / 'out')

    def test_rehashed_false_offline_proof_still_refused(self):
        name = 'frozen-offline-review/review.json'
        value = json.loads(self.originals[name])
        value['offline']['entryIncluded'] = False
        self.originals[name] = adapter.encoded(value)
        self.write_inspection()
        with self.assertRaisesRegex(ValueError, 'Offline proof'):
            adapter.assemble(self.config, self.root / 'out')

    def test_unreviewed_policy_and_source_difference_refused(self):
        self.policy['mode'] = 'required'
        with self.assertRaisesRegex(ValueError, 'explicitly waive'):
            adapter.assemble(self.config, self.root / 'out')
        self.policy['mode'] = 'waived'
        self.config['approvedNonSourceChanges'] = ['game/main.js']
        with self.assertRaisesRegex(ValueError, 'PR/source difference'):
            adapter.assemble(self.config, self.root / 'out')

    def test_resource_and_ordinary_file_guards(self):
        with patch.object(adapter.shutil, 'disk_usage', return_value=type('Usage', (), {'free': 1})()):
            with self.assertRaisesRegex(ValueError, 'reserve'):
                adapter.assemble(self.config, self.root / 'out')
        path = self.root / 'link'
        path.symlink_to(Path(self.config['pr']['run']))
        with self.assertRaisesRegex(ValueError, 'Symlink'):
            adapter.read(path)
        with self.assertRaisesRegex(ValueError, 'bounded'):
            adapter.read(self.config['pr']['run'], 1)
        with self.assertRaisesRegex(ValueError, 'Duplicate JSON'):
            adapter.parse(b'{"a":1,"a":2}')


if __name__ == '__main__':
    unittest.main()
