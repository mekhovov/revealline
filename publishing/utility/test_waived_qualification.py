"""Temporary waiver admission tests; historical qualification fixtures stay unchanged."""
import copy
import unittest
from unittest.mock import patch

import release_artifact as utility
import test_release_artifact as legacy
from test_release_artifact import binding, qualification, encoded


def fixture():
    value = binding('upload-originals')
    q = qualification(value)
    for key in ['passed', 'testFiles', 'additionalManualQualification']:
        del q[key]
    q.update(format=utility.WAIVER_FORMAT, status='qualified-with-test-waiver', releaseEligible=True,
             tests={'status': 'waived', 'counts': None})
    q.pop('ordinaryBuildCorroboration')
    q['preMergeValidationCorroboration'] = {
        'runId': 19, 'jobId': 104, 'command': 'npm run validate',
        'sourceRevision': value['source']['commit'],
        'sourceTree': value['source']['tree'],
        'step': {'name': 'Validate release-critical source', 'number': 20,
                 'status': 'completed', 'conclusion': 'success'},
        'artifactBuild': {'status': 'deferred-to-frozen-source',
                          'step': {'name': 'Defer full artifact build to merged-source qualification',
                                   'number': 21, 'status': 'completed', 'conclusion': 'success'}},
        'scope': 'Exact PR source validation; artifact deferred to frozen source'}
    q['gates'].pop()
    names = ['Validate source', 'Lint source', 'Check formatting', 'Check native formatting', 'Check motion lab syntax']
    for index, (gate, name) in enumerate(zip(q['gates'], names), 1):
        gate.update(jobId=101)
        gate['step'].update(name=name, number=index)
    policy = {'format': 'revealline-release-test-policy.v1', 'mode': 'waived',
              'authorization': utility.WAIVER_AUTHORIZATION, 'scope': 'automated-test-suites',
              'reason': 'Explicit temporary user exception', 'restoration': 'Restore required mode when user revokes exception'}
    run = {'id': 18, 'event': 'workflow_dispatch', 'path': utility.WORKFLOW,
           'head_sha': 'a' * 40, 'status': 'completed', 'conclusion': 'success'}
    jobs = {'total_count': 3, 'jobs': [
        {'id': 101, 'run_id': 18, 'name': 'qualify', 'head_sha': 'a' * 40, 'status': 'completed',
         'conclusion': 'success', 'steps': [copy.deepcopy(g['step']) for g in q['gates']]},
        {'id': 102, 'run_id': 18, 'name': 'test', 'head_sha': 'a' * 40, 'status': 'completed', 'conclusion': 'skipped'},
        {'id': 103, 'run_id': 18, 'name': 'freeze', 'head_sha': 'a' * 40, 'status': 'completed', 'conclusion': 'success'}]}
    pr_run = {'id': 19, 'event': 'pull_request', 'path': '.github/workflows/deploy-pages.yml',
              'head_sha': value['source']['commit'], 'status': 'completed', 'conclusion': 'success'}
    before = {'name': 'Verify exact tracked source before commands', 'number': 19,
              'status': 'completed', 'conclusion': 'success'}
    after = {'name': 'Verify tracked source after fast release gate', 'number': 22,
             'status': 'completed', 'conclusion': 'success'}
    pr_job = {'id': 104, 'run_id': 19, 'name': 'build', 'head_sha': value['source']['commit'],
              'status': 'completed', 'conclusion': 'success',
              'steps': [before, copy.deepcopy(q['preMergeValidationCorroboration']['step']),
                        copy.deepcopy(q['preMergeValidationCorroboration']['artifactBuild']['step']), after]}
    pr_jobs = {'total_count': 1, 'jobs': [pr_job]}
    equivalence = {'prSource': {'commit': value['source']['commit'], 'tree': value['source']['tree']},
                   'frozenSource': {'commit': value['source']['commit'], 'tree': value['source']['tree']}}
    originals = {'publishing/test-policy.json': encoded(policy), 'runs/manual/run.json': encoded(run),
                 'runs/manual/jobs.json': encoded(jobs), 'runs/pr/run.json': encoded(pr_run),
                 'runs/pr/jobs.json': encoded(pr_jobs),
                 'preparation/source-equivalence.json': encoded(equivalence)}
    pins = {name: {'path': name, 'bytes': len(body), 'sha256': utility.sha(body)} for name, body in originals.items()}
    q['testPolicy'] = {k: policy[k] for k in ['mode', 'authorization', 'reason']}
    q['testPolicy']['policyEvidence'] = pins['publishing/test-policy.json']
    q['waiverEvidence'] = {'runId': 18, 'runEvidence': pins['runs/manual/run.json'],
                          'jobsEvidence': pins['runs/manual/jobs.json']}
    q['evidencePins'] = list(pins.values())
    return value, q, originals, policy, run, jobs


def archive(value, originals):
    return legacy.EvidenceTests().evidence(value['source'], originals)[0]


class WaiverTests(unittest.TestCase):
    def test_truthful_waiver_and_complete_originals(self):
        value, q, originals, policy, _, _ = fixture()
        utility.qualification_check(q, value)
        result = utility.verify_evidence(archive(value, originals), q, value['source'], encoded(policy))
        self.assertTrue(result['allQualificationPinsResolved'])

    def test_no_fabricated_pass_counts_shards_or_missing_required_gates(self):
        value, q, _, _, _, _ = fixture()
        mutations = [lambda x: x.update(passed=True), lambda x: x.update(passed=False),
            lambda x: x.update(testFiles=0), lambda x: x.update(shards=[]), lambda x: x.update(testShards=[]),
            lambda x: x.update(additionalManualQualification={'shards': []}),
            lambda x: x['tests'].update(counts={'tests': 0, 'pass': 0}),
            lambda x: x['tests'].update(extra=True), lambda x: x.update(releaseEligible=False),
            lambda x: x['gates'].pop(), lambda x: x['gates'][0]['step'].update(conclusion='skipped'),
            lambda x: x['gates'][0].update(command='true'), lambda x: x.update(sourceTree='f' * 40),
            lambda x: x['preMergeValidationCorroboration']['step'].update(conclusion='failure'),
            lambda x: x['preMergeValidationCorroboration']['artifactBuild']['step'].update(conclusion='failure'),
            lambda x: x['preMergeValidationCorroboration']['artifactBuild'].update(status='built-on-pr'),
            lambda x: x['preMergeValidationCorroboration'].update(sourceRevision='short'),
            lambda x: x.update(ordinaryBuildCorroboration={'command': 'npm run build',
                'step': {'status': 'completed', 'conclusion': 'success'}}),
            lambda x: x['frozenArtifactCorroboration'].update(allInnerZipManifestBytesVerified=False),
            lambda x: x['testPolicy'].update(authorization='agent-inferred'),
            lambda x: x['testPolicy']['policyEvidence'].update(bytes=16385),
            lambda x: x['waiverEvidence'].update(runId=19),
            lambda x: x.update(evidencePins=[p for p in x['evidencePins']
                if p['path'] != 'runs/manual/jobs.json'])]
        for index, mutate in enumerate(mutations):
            bad = copy.deepcopy(q); mutate(bad)
            with self.subTest(index=index), self.assertRaises((ValueError, KeyError)):
                utility.qualification_check(bad, value)

    def test_policy_requires_exact_authorization_scope_mode_and_restoration(self):
        _, _, _, policy, _, _ = fixture()
        for key, replacement in [('format', 'other'), ('mode', 'optional'), ('authorization', ''),
                                 ('scope', 'all-checks'), ('reason', ' '), ('restoration', ''), ('extra', True)]:
            bad = dict(policy); bad[key] = replacement
            with self.subTest(key=key), self.assertRaises(ValueError):
                utility.test_policy(encoded(bad))

    def test_missing_borrowed_or_changed_originals_refused_even_with_fresh_pins(self):
        value, q, originals, policy, run, jobs = fixture()
        cases = []
        wrong = copy.deepcopy(policy); wrong['mode'] = 'required'; cases.append(('publishing/test-policy.json', wrong))
        wrong = copy.deepcopy(run); wrong['head_sha'] = 'f' * 40; cases.append(('runs/manual/run.json', wrong))
        wrong = copy.deepcopy(run); wrong['conclusion'] = 'failure'; cases.append(('runs/manual/run.json', wrong))
        for mutation in [lambda x: x.update(total_count=4), lambda x: x['jobs'].pop(),
                         lambda x: x['jobs'][1].update(conclusion='success'),
                         lambda x: x['jobs'][1].update(conclusion='failure'),
                         lambda x: x['jobs'][1].update(conclusion='cancelled'),
                         lambda x: x['jobs'][0].update(run_id=19),
                         lambda x: x['jobs'][0].update(id=102),
                         lambda x: x['jobs'][0]['steps'][0].update(conclusion='failure'),
                         lambda x: x['jobs'][0]['steps'].pop()]:
            wrong = copy.deepcopy(jobs); mutation(wrong); cases.append(('runs/manual/jobs.json', wrong))
        for index, (name, replacement) in enumerate(cases):
            bad_q = copy.deepcopy(q); bad_originals = dict(originals); bad_originals[name] = encoded(replacement)
            for pin in bad_q['evidencePins']:
                if pin['path'] == name: pin.update(bytes=len(bad_originals[name]), sha256=utility.sha(bad_originals[name]))
            with self.subTest(index=index), self.assertRaises((ValueError, KeyError)):
                utility.verify_evidence(archive(value, bad_originals), bad_q, value['source'], encoded(policy))
        missing = dict(originals); missing.pop('runs/manual/jobs.json')
        with self.assertRaises(ValueError): utility.verify_evidence(archive(value, missing), q, value['source'])

    def test_exact_committed_policy_comparison(self):
        value, q, originals, policy, _, _ = fixture()
        changed = dict(policy); changed['reason'] = 'Another reason'
        with self.assertRaisesRegex(ValueError, 'exact committed source'):
            utility.verify_evidence(archive(value, originals), q, value['source'], encoded(changed))

    def test_actual_four_skipped_matrix_shape(self):
        _, _, _, _, _, jobs = fixture()
        rows = [jobs['jobs'][0], jobs['jobs'][2]] + [dict(jobs['jobs'][1], id=200+i, name=f'test ({i})') for i in range(1, 5)]
        utility.source_jobs_check(rows, 'a' * 40, waived=True)
        with self.assertRaises(ValueError): utility.source_jobs_check(rows, 'a' * 40)
        with self.assertRaises(ValueError): utility.source_jobs_check(rows + [rows[-1]], 'a' * 40, waived=True)

    def test_artifact_authority_waiver_is_not_inferred_from_skipped_jobs(self):
        value, _, _, policy, run, jobs = fixture()
        item = {'id': 17, 'name': 'qualified-release-snapshot', 'expired': False, 'size_in_bytes': 100,
                'digest': 'sha256:' + 'c' * 64, 'workflow_run': {'id': 18, 'head_sha': 'a' * 40}}
        class API:
            def __init__(self): self.rows = iter([item, run, jobs])
            def get(self, _path): return next(self.rows)
        self.assertEqual(utility.artifact_authority(API(), value, encoded(policy)), item)
        with self.assertRaises(ValueError): utility.artifact_authority(API(), value)
        required = dict(policy, mode='required')
        with self.assertRaises(ValueError): utility.artifact_authority(API(), value, encoded(required))

    def test_committed_policy_missing_preserves_legacy_and_oversize_refuses_before_read(self):
        value, _, _, policy, _, _ = fixture()
        with patch.object(utility.subprocess, 'check_output', return_value=b''):
            self.assertIsNone(utility.committed_test_policy('repo', value['source']))
        row = b'100644 blob ' + b'a' * 40 + b'\tpublishing/test-policy.json\n'
        with patch.object(utility.subprocess, 'check_output', side_effect=[row, b'16385\n']) as command:
            with self.assertRaisesRegex(ValueError, 'bound'):
                utility.committed_test_policy('repo', value['source'])
            self.assertEqual(command.call_count, 2)
        body = encoded(policy)
        with patch.object(utility.subprocess, 'check_output', side_effect=[row, str(len(body)).encode(), body]):
            self.assertEqual(utility.committed_test_policy('repo', value['source']), body)

    def test_waiver_policy_still_accepts_opted_in_successful_matrix(self):
        value, _, _, policy, run, jobs = fixture()
        item = {'id': 17, 'name': 'qualified-release-snapshot', 'expired': False, 'size_in_bytes': 100,
                'digest': 'sha256:' + 'c' * 64, 'workflow_run': {'id': 18, 'head_sha': 'a' * 40}}
        jobs['jobs'] = [jobs['jobs'][0], jobs['jobs'][2]] + [
            dict(jobs['jobs'][1], id=200+i, name=f'test ({i})', conclusion='success') for i in range(1, 5)]
        jobs['total_count'] = len(jobs['jobs'])
        class API:
            def __init__(self): self.rows = iter([item, run, jobs])
            def get(self, _path): return next(self.rows)
        self.assertEqual(utility.artifact_authority(API(), value, encoded(policy)), item)

    def test_complete_small_package_requires_matching_explicit_waiver_record(self):
        value, q, originals, policy, _, _ = fixture()
        source = value['source']
        inspected = {'format': 'revealline-qualified-artifact-offline-inspection.v1', 'status': 'PASS',
            'gitHead': source['commit'], 'gitTree': source['tree'], 'version': source['version'],
            'manifestSha256': utility.sha(b'manifest'), 'releaseHashChainVerified': True,
            'artifact': dict(value['artifact']),
            'sourceTar': {'bytes': 1, 'sha256': utility.sha(b't'), 'outerMember': 'v1.2.3/source.tar'},
            'distribution': {'bytes': 1, 'sha256': utility.sha(b'z'), 'outerMember': 'v1.2.3/site/distribution.zip',
                             'allManifestBytesVerified': True, 'innerManifestIdentical': True}}
        bodies = {'manifest.json': b'manifest', 'release.json': b'release', 'distribution.zip.sha256': b'checksum',
                  'verification.json': encoded(inspected), 'source-qualification-evidence.zip': archive(value, originals)}
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
                  'sourceGateCounts': None, 'testStatus': 'waived',
                  'frozenArtifact': {**value['artifact'], 'externallyExpectedDigestSupplied': True}}
        bodies['qualification-evidence-record.json'] = encoded(record)
        value['release']['assets'] = [{k: row[k] for k in ['name', 'bytes', 'sha256']} for row in rows] + [
            {'name': 'qualification-evidence-record.json', 'bytes': len(bodies['qualification-evidence-record.json']),
             'sha256': utility.sha(bodies['qualification-evidence-record.json'])}]
        self.assertTrue(utility.small_assets_check(value, bodies, inspected, encoded(policy),
                        require_committed_policy=True)['allQualificationPinsResolved'])
        with self.assertRaisesRegex(ValueError, 'exact committed policy'):
            utility.small_assets_check(value, bodies, inspected, require_committed_policy=True)
        for key, replacement in [('sourceGateCounts', legacy.counts(4)), ('testStatus', 'passed')]:
            bad_record = dict(record); bad_record[key] = replacement
            bad_bodies = dict(bodies); bad_bodies['qualification-evidence-record.json'] = encoded(bad_record)
            with self.subTest(key=key), self.assertRaises(ValueError):
                utility.small_assets_check(value, bad_bodies, inspected, encoded(policy))


if __name__ == '__main__':
    unittest.main()
