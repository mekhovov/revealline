"""Synthetic bounded fixtures only; they are never release evidence."""
import copy
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

import assemble_full_qualification as full
import assemble_waived_qualification as common
import test_assemble_waived_qualification as prior


def command(command, output):
    return ('##[group]Run ' + command.splitlines()[0] + '\n' + command +
            '\n##[endgroup]\n' + output + '\n').encode()


def clean_tap(number=1):
    return ('TAP version 13\n# Subtest: actual fixture\nok 1 - actual fixture\n1..1\n'
            '# tests ' + str(number) + '\n# suites 0\n# pass ' + str(number) +
            '\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 1\n')


class FullTests(unittest.TestCase):
    def setUp(self):
        self.fixture = prior.AdapterTests()
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        f = self.fixture
        self.root = f.root
        self.source = f.source
        f.policy['mode'] = 'required'
        self.binding = {'format': full.FORMAT, 'reviewed': True, 'repository': 'mekhovov/revealline',
                        'source': f.source, 'prSource': {k: f.source[k] for k in ('commit', 'tree')},
                        'sourcePR': 999, 'prRun': 20, 'manualRun': 18, 'inspectionRun': 21,
                        'prWorkflowCommit': f.source['commit'],
                        'inspectionArtifact': {'id': 24, 'bytes': 1, 'sha256': 'c' * 64}}
        self.config = {k: v for k, v in f.config.items() if k in
                       ('repositoryPath', 'inspectionDirectory', 'pr', 'manual', 'inspection')}
        self.config['binding'] = self.binding
        self.partition = [['game/test/case-' + str(i) + '.test.mjs'] for i in range(1, 5)]
        self.manual = copy.deepcopy(f.manual)
        self.manual['run_attempt'] = 1
        self.pr_run = copy.deepcopy(f.pr_run)
        self.pr_run['run_attempt'] = 1
        self.pr_run['pull_requests'] = [{'number': 999, 'head': {'sha': self.source['commit']}}]
        self.jobs = {'manual': copy.deepcopy(f.jobs), 'pr': copy.deepcopy(f.pr_jobs)}
        self.jobs['manual']['jobs'] = [self.jobs['manual']['jobs'][0], self.jobs['manual']['jobs'][2]]
        self.jobs['manual']['jobs'][0]['steps'] += [f.step('Check hosted artifact utility locally', 31),
            f.step('Reproduce production collection when available', 32)]
        preflight = self.jobs['pr']['jobs'][1]
        preflight['steps'] = [f.step(n, i + 1) for i, n in enumerate([
            'Verify exact tracked source before commands', 'Validate, lint, and format source',
            'Verify Field Kit production ledger and compiled output', 'Verify immutable production sources first',
            'Verify tracked source after preflight'])]
        build = self.jobs['pr']['jobs'][0]
        build['steps'] = [f.step(n, i + 1) for i, n in enumerate([
            'Verify exact tracked source before commands', 'Build pull-request artifact',
            'Verify tracked source after build'])]
        for role in ('pr', 'manual'):
            run = self.pr_run if role == 'pr' else self.manual
            for i in range(1, 5):
                names = (['Verify exact tracked source before commands', 'Run test shard ' + str(i) + '/4',
                          'Verify tracked source after test shard'] if role == 'pr' else
                         ['Record source identity', 'Record exact shard files', 'Run test shard ' + str(i) + '/4',
                          'Verify tested tracked source is unchanged'])
                self.jobs[role]['jobs'].append({'id': (400 if role == 'pr' else 500) + i,
                    'run_id': run['id'], 'head_sha': self.source['commit'], 'name': 'test (' + str(i) + ')',
                    'status': 'completed', 'conclusion': 'success', 'steps': [f.step(n, j + 1) for j, n in enumerate(names)]})
            for job in self.jobs[role]['jobs']:
                job['run_attempt'] = 1
            self.jobs[role]['total_count'] = len(self.jobs[role]['jobs'])
            self.write(self.config[role]['run'], common.encoded(run))
            self.write(self.config[role]['jobs'], common.encoded(self.jobs[role]))
            self.config[role]['runAttempt'] = 1
            self.config[role]['logs'] = {}
            for job in self.jobs[role]['jobs']:
                self.log(role, job, self.job_log(role, job))
        self.config['pullRequest'] = str(self.root / 'pull.json')
        self.pull = {'number': 999, 'merged': True, 'head': {'sha': self.source['commit']},
                     'base': {'repo': {'full_name': 'mekhovov/revealline'}}, 'merge_commit_sha': self.source['commit']}
        self.write(self.config['pullRequest'], common.encoded(self.pull))
        self.config['workflowAuthority'] = str(self.root / 'authority.json')
        self.write(self.config['workflowAuthority'], common.encoded({role: {'sha': self.source['commit'],
            'tree': {'sha': self.source['tree']}} for role in ('pr', 'manual')}))
        self.config['inspectionArtifactMetadata'] = str(self.root / 'artifact.json')
        self.config['inspectionArchive'] = str(self.root / 'inspection.zip')
        self.repack()
        self.real_git = f.git
        self.real_blob = f.blob
        self.patches = [
            patch.object(common, 'git', side_effect=self.git),
            patch.object(common, 'blob', side_effect=self.blob),
            patch.object(full, 'expected_partition', return_value=self.partition),
            patch.object(full.shutil, 'disk_usage', return_value=type('Usage', (), {'free': 8 * 1024**3})())]
        for p in self.patches:
            p.start()
            self.addCleanup(p.stop)

    def write(self, path, body):
        Path(path).write_bytes(body)

    def git(self, repo, *args):
        if args == ('rev-parse', 'HEAD'):
            return (self.source['commit'] + '\n').encode()
        return self.real_git(repo, *args)

    def blob(self, repo, revision, name):
        if name == 'package-lock.json':
            return common.encoded({'version': '1.2.3', 'packages': {'': {'version': '1.2.3'}}})
        if name == 'game/build-config.json':
            return common.encoded({'version': '1.2.3'})
        if name.startswith(('.github/', 'scripts/')):
            return b'fixture pinned helper'
        return self.real_blob(repo, revision, name)

    def repack(self):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w') as archive:
            for path in sorted((self.root / 'inspection').rglob('*')):
                if path.is_file():
                    archive.writestr(path.relative_to(self.root / 'inspection').as_posix(), path.read_bytes())
        body = buffer.getvalue()
        self.write(self.config['inspectionArchive'], body)
        item = self.binding['inspectionArtifact']
        item.update(bytes=len(body), sha256=common.sha(body))
        self.write(self.config['inspectionArtifactMetadata'], common.encoded({
            'id': item['id'], 'name': 'inspect-artifact-evidence', 'expired': False,
            'size_in_bytes': item['bytes'], 'digest': 'sha256:' + item['sha256'],
            'workflow_run': {'id': 21}}))

    def log(self, role, job, body):
        path = self.root / (role + '-' + str(job['id']) + '.log')
        self.write(path, body)
        self.config[role]['logs'][str(job['id'])] = str(path)

    def pr_identity(self, job):
        script = ('node ../automation/scripts/check-source-identity.mjs --root .' if job['name'].startswith('test ')
                  else 'node .source-gate-automation/scripts/check-source-identity.mjs --root .')
        value = {'format': 'revealline-source-identity.v1', 'sourceRevision': self.source['commit'],
                 'sourceTree': self.source['tree'], 'allTrackedSourceContentsAndModesMatch': True,
                 'files': 5, 'bytes': 10, 'aggregateSha256': 'd' * 64}
        return command(script, json.dumps(value, separators=(',', ':')))

    def job_log(self, role, job):
        if role == 'pr':
            before = ('##[group]Run actions/checkout@v4\n  ref: ' + self.source['commit'] +
                      '\n  path: automation\n##[endgroup]\n' + self.source['commit'] + '\n').encode() + self.pr_identity(job)
            after = self.pr_identity(job)
        else:
            before = command("git rev-parse HEAD 'HEAD^{tree}'", self.source['commit'] + '\n' + self.source['tree'])
            after = command('git diff --exit-code', '')
        if not job['name'].startswith('test '):
            return before + after
        i = int(job['name'][6])
        header = 'Running 1/4 test files in shard ' + str(i) + '/4.\n'
        listing = command('node scripts/run-test-shard.mjs --shard ' + str(i) + '/4 --list',
                          header + self.partition[i - 1][0]) if role == 'manual' else b''
        run = ('node ../automation/scripts/run-test-shard.mjs --shard ' + str(i) + '/4 --root .' if role == 'pr'
               else 'node scripts/run-test-shard.mjs --shard ' + str(i) + '/4')
        return before + listing + command('mkdir -p .cache\n' + run, header + clean_tap()) + after

    def assemble(self):
        return full.assemble(self.config, self.root / 'out')

    def test_complete_package_executes_exact_frozen_consumer(self):
        with patch.object(common, 'consumer_helpers', wraps=common.consumer_helpers) as helpers:
            result = self.assemble()
        helpers.assert_called_once_with(str(self.root), self.source['commit'])
        self.assertEqual(result['tests'], {'tests': 4, 'pass': 4, 'fail': 0, 'cancelled': 0, 'skipped': 0, 'todo': 0})
        self.assertEqual(len(list((self.root / 'out').iterdir())), 7)
        self.assertEqual(len(result['artifacts']), 9)
        self.assertTrue(result['consumer']['allQualificationPinsResolved'])
        q = json.loads((self.root / 'out/source-qualification.json').read_bytes())
        self.assertEqual(q['format'], 'revealline-source-qualification.v1')
        self.assertTrue(q['passed'])
        self.assertEqual(q['testFiles'], 4)
        self.assertEqual(len(q['gates']), 6)
        self.assertNotIn('waiverEvidence', q)
        self.assertFalse((self.root / 'out/source.tar').exists())
        with self.assertRaisesRegex(ValueError, 'Fresh ordinary'):
            self.assemble()

    def test_missing_or_failed_shard_and_partial_inventory_refuse(self):
        for mutation in [lambda j: j['jobs'].pop(), lambda j: j['jobs'][-1].update(conclusion='failure'),
                         lambda j: j['jobs'][-1].update(run_attempt=2), lambda j: j['jobs'][-1].update(id=j['jobs'][-2]['id'])]:
            bad = copy.deepcopy(self.jobs['manual'])
            mutation(bad)
            self.write(self.config['manual']['jobs'], common.encoded(bad))
            with self.assertRaises(ValueError):
                self.assemble()
            self.assertFalse((self.root / 'out').exists())
        self.write(self.config['manual']['jobs'], common.encoded(self.jobs['manual']))

    def test_corrupt_or_nonpassing_tap_never_qualifies(self):
        path = Path(self.config['pr']['logs']['401'])
        original = path.read_bytes()
        for old, new in [(b'# fail 0', b'# fail 1'), (b'# skipped 0', b'# skipped 1'),
                         (b'# cancelled 0', b'# cancelled 1'), (b'# todo 0', b'# todo 1'),
                         (b'# tests 1', b'# tests 1\n# tests 1'), (b'# pass 1', b''),
                         (b'1..1', b'1..2'), (b'ok 1 - actual fixture', b'not ok 1 - actual fixture'),
                         (b'ok 1 - actual fixture', b'ok 1 - actual fixture # SKIP unsupported'),
                         (b'# tests 1', b'  # tests 1'), (b'Running 1/4 test files', b'Running 2/4 test files')]:
            path.write_bytes(original.replace(old, new))
            with self.subTest(new=new), self.assertRaises(ValueError):
                self.assemble()
        path.write_bytes(original)

    def test_raw_identity_cannot_be_moved_outside_its_step(self):
        path = Path(self.config['pr']['logs']['401'])
        original = path.read_bytes()
        identity = self.pr_identity(self.jobs['pr']['jobs'][2])
        path.write_bytes(original.replace(identity, b'') + identity.split(b'##[endgroup]\n')[1])
        with self.assertRaisesRegex(ValueError, 'before/after'):
            self.assemble()

    def test_wrong_automation_checkout_or_manual_list_refuses(self):
        path = Path(self.config['pr']['logs']['401'])
        original = path.read_bytes()
        path.write_bytes(original.replace(b'  ref: ' + self.source['commit'].encode(), b'  ref: ' + b'f' * 40))
        with self.assertRaisesRegex(ValueError, 'automation checkout'):
            self.assemble()
        path.write_bytes(original)
        path = Path(self.config['manual']['logs']['501'])
        path.write_bytes(path.read_bytes().replace(b'game/test/case-1.test.mjs', b'game/test/other.test.mjs'))
        with self.assertRaisesRegex(ValueError, 'membership'):
            self.assemble()

    def test_manual_listing_cannot_move_to_another_step_or_add_rows(self):
        path = Path(self.config['manual']['logs']['501'])
        original = path.read_bytes()
        expected = b'game/test/case-1.test.mjs'
        for bad in (original.replace(expected, expected + b'\ngame/test/extra.test.mjs'),
                    original.replace(expected, b'') + command('node unrelated.mjs', expected.decode()),
                    original.replace(b'Running 1/4 test files in shard 1/4.',
                                     b'') + command('node unrelated.mjs', 'Running 1/4 test files in shard 1/4.')):
            path.write_bytes(bad)
            with self.assertRaises(ValueError):
                self.assemble()
        path.write_bytes(original)

    def test_mismatched_run_pr_merge_or_policy_refuses(self):
        self.fixture.policy['mode'] = 'waived'
        with self.assertRaisesRegex(ValueError, 'require full'):
            self.assemble()
        self.fixture.policy['mode'] = 'required'
        for key, value in [('merged', False), ('merge_commit_sha', 'bad'), ('number', 998)]:
            bad = dict(self.pull)
            bad[key] = value
            self.write(self.config['pullRequest'], common.encoded(bad))
            with self.assertRaisesRegex(ValueError, 'Merged source PR'):
                self.assemble()
        self.write(self.config['pullRequest'], common.encoded(self.pull))
        run = dict(self.manual, head_sha='f' * 40)
        self.write(self.config['manual']['run'], common.encoded(run))
        with self.assertRaisesRegex(ValueError, 'Run identity'):
            self.assemble()

    def test_run_for_another_pr_cannot_qualify_this_source_pr(self):
        run = dict(self.pr_run, pull_requests=[{'number': 998, 'head': {'sha': self.source['commit']}}])
        self.write(self.config['pr']['run'], common.encoded(run))
        with self.assertRaisesRegex(ValueError, 'reviewed source PR'):
            self.assemble()

    def test_source_diff_and_capacity_block_before_outputs(self):
        with patch.object(common, 'git', side_effect=lambda repo, *args:
                          b'changed' if args[:2] == ('diff', '--no-ext-diff') else self.git(repo, *args)):
            with self.assertRaisesRegex(ValueError, 'contents differ'):
                self.assemble()
        with patch.object(full.shutil, 'disk_usage', return_value=type('Usage', (), {'free': 1})()):
            with self.assertRaisesRegex(ValueError, 'reserve'):
                self.assemble()

    def test_inspection_zip_or_authority_change_is_rejected(self):
        path = Path(self.config['inspectionArchive'])
        original = path.read_bytes()
        path.write_bytes(original + b'changed')
        with self.assertRaisesRegex(ValueError, 'archive authority'):
            self.assemble()
        path.write_bytes(original)
        metadata = json.loads(Path(self.config['inspectionArtifactMetadata']).read_bytes())
        metadata['workflow_run']['id'] = 22
        self.write(self.config['inspectionArtifactMetadata'], common.encoded(metadata))
        with self.assertRaisesRegex(ValueError, 'archive authority'):
            self.assemble()

    def test_changed_frozen_inspection_still_refuses_when_repacked(self):
        path = self.root / 'inspection/qualified-artifact-verified/manifest.json'
        path.write_bytes(b'changed')
        self.repack()
        with self.assertRaisesRegex(ValueError, 'Retained pin'):
            self.assemble()

    def test_other_step_summary_cannot_supply_missing_shard_summary(self):
        path = Path(self.config['pr']['logs']['401'])
        original = path.read_bytes()
        path.write_bytes(original.replace(b'# pass 1\n', b'') + command('node unrelated.mjs', clean_tap()))
        with self.assertRaisesRegex(ValueError, 'TAP counter'):
            self.assemble()

    def test_bounded_collector_round_trip_uses_original_authorities(self):
        inspection_run = json.loads(Path(self.config['inspection']['run']).read_bytes())
        inspection_run['run_attempt'] = 1
        data = {
            'pulls/999': Path(self.config['pullRequest']).read_bytes(),
            'git/commits/' + self.source['commit']: common.encoded({'sha': self.source['commit'], 'tree': {'sha': self.source['tree']}}),
            'actions/artifacts/24': Path(self.config['inspectionArtifactMetadata']).read_bytes(),
            'actions/artifacts/24/zip': Path(self.config['inspectionArchive']).read_bytes()}
        for role, run in [('pr', self.pr_run), ('manual', self.manual), ('inspection', inspection_run)]:
            data['actions/runs/' + str(run['id'])] = common.encoded(run)
            data['actions/runs/' + str(run['id']) + '/attempts/1/jobs?per_page=100'] = Path(self.config[role]['jobs']).read_bytes()
            for job_id, path in self.config[role].get('logs', {}).items():
                data['actions/jobs/' + job_id + '/logs'] = Path(path).read_bytes()
        with patch.object(full, 'api', side_effect=lambda repository, path, *args, **kwargs: data[path]):
            collected = full.collect(self.binding, self.root, self.root / 'collected')
        self.assertEqual(collected['binding'], self.binding)
        self.assertEqual(len(collected['pr']['logs']), 6)
        result = full.assemble(collected, self.root / 'out')
        self.assertEqual(result['tests']['pass'], 4)

    def test_collector_refuses_running_family_without_creating_a_package(self):
        with patch.object(full, 'api', return_value=common.encoded(dict(self.pr_run, status='in_progress'))):
            with self.assertRaisesRegex(ValueError, 'Completed successful run'):
                full.collect(self.binding, self.root, self.root / 'collected')
        self.assertFalse((self.root / 'collected/assemble-inputs.json').exists())


class ParsingTests(unittest.TestCase):
    def test_nested_cases_have_top_plan_distinct_from_total(self):
        text = ('TAP version 13\n# Subtest: parent\n    # Subtest: child\n    ok 1 - child\n    1..1\n'
                'ok 1 - parent\n1..1\n# tests 2\n# suites 0\n# pass 2\n# fail 0\n# cancelled 0\n'
                '# skipped 0\n# todo 0\n')
        self.assertEqual(full.tap_counts(command('node test.mjs', text), 'node test.mjs')['tests'], 2)

    def test_reviewed_binding_rejects_inferred_ids_and_extra_fields(self):
        for value in ({}, {'format': full.FORMAT, 'reviewed': True}):
            with self.assertRaises(ValueError):
                full.reviewed(value)

    def test_partition_discovery_rejects_untracked_or_nonordinary_tests(self):
        def child(args, **kwargs):
            index = int(args[3].split('/')[0])
            return ('Running 1/4 test files in shard ' + str(index) + '/4.\ngame/case-' +
                    str(index) + '.test.mjs\n').encode()
        records = b''.join(('100644 blob ' + 'd' * 40 + '\tgame/case-' + str(i) + '.test.mjs\0').encode()
                           for i in range(1, 5))
        with patch.object(common, 'blob', return_value=b'runner'), \
             patch.object(full.subprocess, 'check_output', side_effect=child), \
             patch.object(common, 'git', return_value=records):
            self.assertEqual(len(full.expected_partition('.', 'a' * 40, 'b' * 40)), 4)
        for bad in (records.replace(b'case-4', b'other'), records.replace(b'100644', b'120000', 1)):
            with patch.object(common, 'blob', return_value=b'runner'), \
                 patch.object(full.subprocess, 'check_output', side_effect=child), \
                 patch.object(common, 'git', return_value=bad), self.assertRaises(ValueError):
                full.expected_partition('.', 'a' * 40, 'b' * 40)


if __name__ == '__main__':
    unittest.main()
