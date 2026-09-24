#!/usr/bin/env python3
"""Assemble full-test release evidence from retained originals; never publish.

The collector only reads GitHub metadata/logs and the bounded inspection artifact.
The assembler is offline. Raw API originals are evidence, not signatures.
Historical waived assembly and the frozen source's consumer remain unchanged.
"""
import argparse
import io
import json
import os
from pathlib import Path
import re
import selectors
import shutil
import subprocess
import sys
import tempfile
import time
import zipfile

import assemble_waived_qualification as common
import release_artifact as consumer

FORMAT = 'revealline-full-qualification-inputs.v1'
PR_WORKFLOW = '.github/workflows/deploy-pages.yml'
WORKFLOW = common.WORKFLOW
COUNTS = ('tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo')
HEX = re.compile(r'[0-9a-f]{40}')
TIMESTAMP = re.compile(r'^\d{4}-\d\d-\d\dT\S+ ')
ANSI = re.compile(r'\x1b\[[0-9;]*m')
MAX_LOG = 16 * 1024**2
require, parse, encoded, sha, pin = common.require, common.parse, common.encoded, common.sha, common.pin


def reviewed(value):
    keys = {'format', 'reviewed', 'repository', 'source', 'prSource', 'sourcePR',
            'prRun', 'manualRun', 'inspectionRun', 'prWorkflowCommit', 'inspectionArtifact'}
    require(set(value) == keys and value['format'] == FORMAT and value['reviewed'] is True and
            value['repository'] == 'mekhovov/revealline', 'Reviewed full-test binding required')
    for key in ('source', 'prSource'):
        item = value[key]
        require(set(item) == ({'commit', 'tree', 'version'} if key == 'source' else {'commit', 'tree'}) and
                all(isinstance(item[k], str) and HEX.fullmatch(item[k]) for k in ('commit', 'tree')),
                'Full source and tree identities required')
    require(re.fullmatch(r'v\d+\.\d+\.\d+', value['source']['version']), 'Stable version required')
    require(HEX.fullmatch(value['prWorkflowCommit']), 'Exact PR workflow commit required')
    require(all(type(value[k]) is int and value[k] > 0 for k in
                ('sourcePR', 'prRun', 'manualRun', 'inspectionRun')), 'Positive run and PR IDs required')
    require(len({value[k] for k in ('prRun', 'manualRun', 'inspectionRun')}) == 3, 'Distinct runs required')
    item = value['inspectionArtifact']
    require(set(item) == {'id', 'bytes', 'sha256'} and type(item['id']) is int and item['id'] > 0 and
            type(item['bytes']) is int and 0 < item['bytes'] <= common.LIMIT and
            isinstance(item['sha256'], str) and re.fullmatch('[0-9a-f]{64}', item['sha256']),
            'Bounded exact inspection artifact required')
    return value


def lines(body):
    require(len(body) <= MAX_LOG, 'Job log exceeds bound')
    return [ANSI.sub('', TIMESTAMP.sub('', row)) for row in body.decode('utf-8', errors='strict').splitlines()]


def command_outputs(body, command):
    """Extract actual output for an exact displayed script command, not another step."""
    rows = lines(body)
    result = []
    for start, row in enumerate(rows):
        if not row.startswith('##[group]Run '):
            continue
        close = next((i for i in range(start + 1, len(rows)) if rows[i] == '##[endgroup]'), None)
        require(close is not None, 'Truncated job command metadata')
        if command not in rows[start + 1:close]:
            continue
        end = next((i for i in range(close + 1, len(rows)) if rows[i].startswith('##[group]Run ')), len(rows))
        result.append(rows[close + 1:end])
    return result


def tap_counts(body, command):
    """Only the exact shard step's terminal, top-level Node TAP summary counts."""
    outputs = command_outputs(body, command)
    require(len(outputs) == 1, 'Missing or duplicate actual shard command')
    rows = outputs[0]
    totals, positions = {}, []
    for key in COUNTS:
        values = [(i, int(m[1])) for i, row in enumerate(rows)
                  if (m := re.fullmatch(r'# ' + key + r' (\d+)', row))]
        require(len(values) == 1, 'Missing or duplicate final TAP counter: ' + key)
        positions.append(values[0][0])
        totals[key] = values[0][1]
    consumer.counts_pass(totals)
    require(positions == sorted(positions), 'TAP summary order differs')
    plans = [(i, int(m[1])) for i, row in enumerate(rows) if (m := re.fullmatch(r'1\.\.(\d+)', row))]
    require(len(plans) == 1 and plans[0][0] < positions[0], 'Missing/duplicate terminal top-level TAP plan')
    top_cases = [int(m[1]) for row in rows if (m := re.match(r'ok (\d+) - ', row))]
    require(top_cases == list(range(1, plans[0][1] + 1)) and top_cases, 'Incomplete top-level TAP results')
    suites = [int(m[1]) for row in rows if (m := re.fullmatch(r'# suites (\d+)', row))]
    require(len(suites) == 1, 'Suite count missing')
    all_cases = [row for row in rows if re.match(r'\s*ok \d+ - ', row)]
    require(len(all_cases) == totals['tests'] + suites[0], 'TAP case count differs')
    require(not any(re.match(r'\s*(?:not ok\b|Bail out!)', row) or
                    re.search(r' # (?:SKIP|TODO)(?: |$)', row) for row in rows),
            'Failed, skipped or aborted TAP output')
    require(not any(re.match(r'(?:ok |not ok |1\.\.|# (?:tests|pass|fail|cancelled|skipped|todo) )', row)
                    for row in rows[positions[-1] + 1:]), 'TAP output continues after summary')
    return totals


def checkout_authority(body, commit, tree, role, workflow_commit=None, source_command=None):
    if role == 'pr':
        outputs = command_outputs(body, source_command)
        require(len(outputs) == 2, 'PR needs exact before/after source command regions')
        observations = []
        for output in outputs:
            items = [parse(row) for row in output
                     if row.startswith('{') and '"format":"revealline-source-identity.v1"' in row]
            require(len(items) == 1, 'Source observation missing or duplicated within its command')
            item = items[0]
            require(item.get('sourceRevision') == commit and item.get('sourceTree') == tree and
                    item.get('allTrackedSourceContentsAndModesMatch') is True and
                    type(item.get('files')) is int and item['files'] > 0 and
                    type(item.get('bytes')) is int and item['bytes'] > 0 and
                    re.fullmatch('[0-9a-f]{64}', item.get('aggregateSha256', '')),
                    'PR raw tracked-source identity differs')
            observations.append(item)
        require(all(observations[0][k] == observations[1][k]
                    for k in ('files', 'bytes', 'aggregateSha256')), 'PR tracked source changed')
        rows = lines(body)
        found = []
        for start, row in enumerate(rows):
            if row != '##[group]Run actions/checkout@v4':
                continue
            close = next((i for i in range(start + 1, len(rows)) if rows[i] == '##[endgroup]'), None)
            require(close is not None, 'Truncated checkout inputs')
            metadata = rows[start + 1:close]
            if not any(r in metadata for r in ('  path: automation', '  path: .source-gate-automation')):
                continue
            end = next((i for i in range(close + 1, len(rows)) if rows[i].startswith('##[group]Run ')), len(rows))
            require(('  ref: ' + workflow_commit) in metadata and workflow_commit in rows[close + 1:end],
                    'Specific PR automation checkout differs')
            found.append(start)
        require(len(found) == 1, 'One actual PR automation checkout required')
        return {k: observations[0][k] for k in
                ('sourceRevision', 'sourceTree', 'files', 'bytes', 'aggregateSha256')}
    outputs = command_outputs(body, "git rev-parse HEAD 'HEAD^{tree}'")
    require(len(outputs) == 1 and commit in outputs[0] and tree in outputs[0], 'Manual source identity output missing')
    return {'sourceRevision': commit, 'sourceTree': tree}


def expected_partition(repo, commit, helper_commit):
    runner = common.blob(repo, helper_commit, 'scripts/run-test-shard.mjs')
    require(runner == common.blob(repo, commit, 'scripts/run-test-shard.mjs'),
            'Reviewed PR/source test-runner bytes differ')
    # List-only operation on the immutable checked-out source; never executes tests.
    with tempfile.TemporaryDirectory(prefix='full-partition-') as temporary:
        script = Path(temporary) / 'run-test-shard.mjs'
        script.write_bytes(runner)
        result = []
        for index in range(1, 5):
            body = subprocess.check_output(['node', str(script), '--shard', str(index) + '/4',
                                           '--root', str(repo), '--list'], timeout=60)
            rows = body.decode().splitlines()
            match = re.fullmatch(r'Running (\d+)/(\d+) test files in shard ' + str(index) + r'/4\.', rows[0])
            require(match and int(match[1]) == len(rows) - 1 and rows[1:] == sorted(set(rows[1:])),
                    'Invalid pinned shard inventory')
            result.append(rows[1:])
        union = [p for part in result for p in part]
        require(len(union) == len(set(union)) and len(union) == int(match[2]), 'Incomplete test partitions')
        tracked = []
        for row in common.git(repo, 'ls-tree', '-rz', '--full-tree', commit).split(b'\0'):
            if not row:
                continue
            metadata, name = row.split(b'\t', 1)
            name = name.decode()
            if name.startswith(('scripts/', 'game/', 'authoring/motion-lab/', 'platforms/desktop/test/', 'platforms/ios/test/')) and \
                    re.search(r'(?:^|/)(?:test-[^/]+|[^/]+\.test)\.mjs$', name):
                require(metadata.startswith((b'100644 blob ', b'100755 blob ')), 'Test must be an ordinary tracked source file')
                tracked.append(name)
        require(sorted(union) == sorted(tracked), 'Discovered tests differ from exact tracked source')
        return result


def qualify_family(role, run, jobs, binding, repo, evidence, inputs, partition):
    identity = binding['prSource'] if role == 'pr' else binding['source']
    rows = common.family(run, jobs, PR_WORKFLOW if role == 'pr' else WORKFLOW,
                         'pull_request' if role == 'pr' else 'workflow_dispatch', identity['commit'])
    expected_id = binding[role + 'Run']
    require(run['id'] == expected_id and run.get('run_attempt') == inputs['runAttempt'],
            'Run attempt differs')
    output, identities = [], []
    for index in range(1, 5):
        job = common.named(rows, 'test (' + str(index) + ')')
        require(job.get('run_attempt') == run['run_attempt'], 'Borrowed shard attempt')
        before = 'Verify exact tracked source before commands' if role == 'pr' else 'Record source identity'
        after = 'Verify tracked source after test shard' if role == 'pr' else 'Verify tested tracked source is unchanged'
        common.step(job, before)
        common.step(job, after)
        if role == 'manual':
            common.step(job, 'Record exact shard files')
        step = common.step(job, 'Run test shard ' + str(index) + '/4')
        name = 'runs/' + role + '/job-' + str(job['id']) + '.log'
        body = common.read(inputs['logs'][str(job['id'])], MAX_LOG)
        evidence[name] = body
        identities.append(checkout_authority(body, identity['commit'], identity['tree'], role,
                                             binding['prWorkflowCommit'], 'node ../automation/scripts/check-source-identity.mjs --root .'))
        inventory = 'Running ' + str(len(partition[index - 1])) + '/' + str(sum(map(len, partition))) + \
                    ' test files in shard ' + str(index) + '/4.'
        run_command = ('node ../automation/scripts/run-test-shard.mjs --shard ' + str(index) + '/4 --root .'
                       if role == 'pr' else 'node scripts/run-test-shard.mjs --shard ' + str(index) + '/4')
        run_outputs = command_outputs(body, run_command)
        require(len(run_outputs) == 1 and run_outputs[0].count(inventory) == 1, 'Shard inventory count differs')
        if role == 'manual':
            listing = command_outputs(body, 'node scripts/run-test-shard.mjs --shard ' + str(index) + '/4 --list')
            require(len(listing) == 1 and [row for row in listing[0] if row.strip()] ==
                    [inventory, *partition[index - 1]], 'Manual shard membership differs')
        output.append({'shard': index, 'jobId': job['id'], 'step': step, 'counts': tap_counts(body, run_command),
                       'log': pin(name, body), 'files': partition[index - 1]})
    require(len({tuple(sorted(i.items())) for i in identities}) == 1, 'Source differs across shards')
    return rows, output, identities[0]


def assemble(config, output):
    require(set(config) == {'binding', 'repositoryPath', 'inspectionDirectory', 'pr', 'manual',
                            'inspection', 'pullRequest', 'workflowAuthority', 'inspectionArchive', 'inspectionArtifactMetadata'}, 'Assembly input shape differs')
    b = reviewed(config['binding'])
    source, pr, repo = b['source'], b['prSource'], config['repositoryPath']
    output = Path(output).absolute()
    receipt = output.with_name(output.name + '-review.json')
    require(not output.exists() and not receipt.exists() and output.parent.is_dir() and
            not any(p.is_symlink() for p in [output, receipt, *output.parents]), 'Fresh ordinary output required')
    require(shutil.disk_usage(output.parent).free >= 1024**3 + 3 * common.LIMIT, 'One GiB reserve required')
    require(common.git(repo, 'rev-parse', 'HEAD').decode().strip() == source['commit'], 'Checkout is not frozen source')
    for identity in (source, pr):
        require(common.git(repo, 'rev-parse', identity['commit'] + '^{tree}').decode().strip() == identity['tree'],
                'Source tree differs')
    # Strict equality of tracked bytes/types/modes avoids borrowing a predecessor's tests.
    require(common.git(repo, 'diff', '--no-ext-diff', '--no-renames', '--binary', pr['commit'], source['commit']) == b'',
            'PR and frozen source contents differ')
    require(common.git(repo, 'diff', '--exit-code') == b'' and common.git(repo, 'diff', '--cached', '--exit-code') == b'',
            'Tracked checkout changed')
    package = parse(common.blob(repo, source['commit'], 'package.json'))
    lock = parse(common.blob(repo, source['commit'], 'package-lock.json'))
    build = parse(common.blob(repo, source['commit'], 'game/build-config.json'))
    require([package['version'], lock['version'], lock['packages']['']['version'], build['version']] ==
            [source['version'][1:]] * 4, 'All package/build versions must agree')
    policy_body = common.blob(repo, source['commit'], common.POLICY)
    require(consumer.test_policy(policy_body)['mode'] == 'required', 'Exact source must require full tests')
    pull_body = common.read(config['pullRequest'], 4 * 1024**2)
    pull = parse(pull_body)
    require(pull.get('number') == b['sourcePR'] and pull.get('merged') is True and
            pull.get('head', {}).get('sha') == pr['commit'] and
            pull.get('base', {}).get('repo', {}).get('full_name') == b['repository'] and
            HEX.fullmatch(pull.get('merge_commit_sha', '')) and
            source['commit'] in (pr['commit'], pull['merge_commit_sha']), 'Merged source PR identity differs')
    evidence = {'preparation/inputs.json': encoded(config), 'runs/pull-request.json': pull_body,
                common.POLICY: policy_body}
    authorities = parse(common.read(config['workflowAuthority'], 4 * 1024**2))
    require(set(authorities) == {'pr', 'manual'} and authorities['pr']['sha'] == b['prWorkflowCommit'] and
            authorities['manual']['sha'] == source['commit'], 'Workflow commit authorities differ')
    for role, commit, path in [('pr', b['prWorkflowCommit'], PR_WORKFLOW), ('manual', source['commit'], WORKFLOW)]:
        authority = authorities[role]
        require(authority['tree']['sha'] == common.git(repo, 'rev-parse', commit + '^{tree}').decode().strip(),
                'Workflow tree authority differs')
        for name in (path, 'scripts/run-test-shard.mjs', 'scripts/check-source-identity.mjs', common.POLICY):
            evidence['automation/' + role + '/' + name] = common.blob(repo, commit, name)
    require(common.blob(repo, b['prWorkflowCommit'], 'scripts/check-source-identity.mjs') ==
            common.blob(repo, source['commit'], 'scripts/check-source-identity.mjs'), 'PR source verifier differs')
    evidence['automation/commits.json'] = encoded(authorities)
    for role in ('pr', 'manual', 'inspection'):
        for kind in ('run', 'jobs'):
            evidence['runs/' + role + '/' + kind + '.json'] = common.read(config[role][kind], 4 * 1024**2)
    partition = expected_partition(repo, source['commit'], b['prWorkflowCommit'])
    pr_run = parse(evidence['runs/pr/run.json'])
    manual_run = parse(evidence['runs/manual/run.json'])
    require(any(row.get('number') == b['sourcePR'] and row.get('head', {}).get('sha') == pr['commit']
                for row in pr_run.get('pull_requests', [])), 'PR run does not bind the reviewed source PR')
    pr_jobs, pr_shards, identity = qualify_family('pr', pr_run, parse(evidence['runs/pr/jobs.json']),
                                                 b, repo, evidence, config['pr'], partition)
    manual_jobs, manual_shards, _ = qualify_family('manual', manual_run, parse(evidence['runs/manual/jobs.json']),
                                                   b, repo, evidence, config['manual'], partition)
    totals = lambda rows: {k: sum(s['counts'][k] for s in rows) for k in COUNTS}
    require(totals(pr_shards) == totals(manual_shards), 'PR/manual TAP totals differ')
    require(len({r['jobId'] for r in pr_shards + manual_shards}) == 8, 'Eight distinct shard jobs required')
    preflight, build_job = common.named(pr_jobs, 'preflight'), common.named(pr_jobs, 'build')
    qualify, freeze = common.named(manual_jobs, 'qualify'), common.named(manual_jobs, 'freeze')
    required_steps = {
        'preflight': ['Verify exact tracked source before commands', 'Validate, lint, and format source',
                      'Verify Field Kit production ledger and compiled output', 'Verify immutable production sources first',
                      'Verify tracked source after preflight'],
        'build': ['Verify exact tracked source before commands', 'Build pull-request artifact', 'Verify tracked source after build'],
        'qualify': ['Record source identity', 'Check hosted artifact utility locally',
                    *[s[2] for s in common.GATES], 'Reproduce production collection when available',
                    'Require reviewed production slots in the committed ledger', 'Verify qualified tracked source is unchanged'],
        'freeze': ['Freeze the exact qualified commit', 'Retain original release assets']}
    for role, job in [('pr', preflight), ('pr', build_job), ('manual', qualify), ('manual', freeze)]:
        require(job.get('run_attempt') == (pr_run if role == 'pr' else manual_run)['run_attempt'], 'Borrowed job attempt')
        for step_name in required_steps[job['name']]:
            common.step(job, step_name)
        name = 'runs/' + role + '/job-' + str(job['id']) + '.log'
        body = common.read(config[role]['logs'][str(job['id'])], MAX_LOG)
        evidence[name] = body
        if job['name'] != 'freeze':
            seen = checkout_authority(body, (pr if role == 'pr' else source)['commit'],
                                      (pr if role == 'pr' else source)['tree'], role, b['prWorkflowCommit'],
                                      'node .source-gate-automation/scripts/check-source-identity.mjs --root .')
            if role == 'pr':
                require(seen == identity, 'Preflight/build source differs from tests')
        else:
            require(source['commit'] in '\n'.join(lines(body)), 'Freeze source output missing')
    archive_body = common.read(config['inspectionArchive'], common.LIMIT)
    artifact_meta_body = common.read(config['inspectionArtifactMetadata'], 4 * 1024**2)
    artifact_meta = parse(artifact_meta_body)
    expected = b['inspectionArtifact']
    require(len(archive_body) == expected['bytes'] and sha(archive_body) == expected['sha256'] and
            artifact_meta.get('id') == expected['id'] and artifact_meta.get('name') == 'inspect-artifact-evidence' and
            artifact_meta.get('expired') is False and artifact_meta.get('size_in_bytes') == expected['bytes'] and
            artifact_meta.get('digest') == 'sha256:' + expected['sha256'] and
            artifact_meta.get('workflow_run', {}).get('id') == b['inspectionRun'], 'Inspection archive authority differs')
    originals_from_disk = common.below(config['inspectionDirectory'])
    with zipfile.ZipFile(io.BytesIO(archive_body)) as archive:
        archive_names = [info.filename for info in archive.infolist() if not info.is_dir()]
        require(len(archive_names) == len(set(archive_names)) and set(archive_names) == set(originals_from_disk),
                'Inspection archive closure differs')
        for name in archive_names:
            require(archive.getinfo(name).file_size == len(originals_from_disk[name]) and
                    archive.read(name) == originals_from_disk[name], 'Inspection extracted original differs')
    evidence['inspection-artifact/api.json'] = artifact_meta_body
    evidence['inspection-artifact/download.json'] = encoded({'bytes': len(archive_body), 'sha256': sha(archive_body),
        'artifactId': expected['id'], 'allExtractedBytesCompared': True})
    inspect_config = {**config, 'repository': b['repository']}
    originals, verify, artifact, inspection_run = common.inspect(inspect_config, evidence, repo, source, manual_run)
    require(inspection_run['id'] == b['inspectionRun'], 'Inspection run differs')
    require(len(evidence) <= 2000 and sum(map(len, evidence.values())) <= common.LIMIT, 'Evidence inventory bound')
    small = {n: originals['qualified-artifact-verified/' + n] for n in
             ('manifest.json', 'release.json', 'distribution.zip.sha256')}
    small['verification.json'] = originals['qualified-artifact-verified/inspection.json']
    q = {'format': 'revealline-source-qualification.v1', 'passed': True, 'version': source['version'],
         'sourceRevision': source['commit'], 'sourceTree': source['tree'],
         'actualCheckoutCommit': source['commit'], 'actualCheckoutTree': source['tree'],
         'allTrackedSourceContentsAndModesMatch': True, 'sourcePR': b['sourcePR'],
         'runId': pr_run['id'], 'runAttempt': pr_run['run_attempt'], 'sourceIdentity': identity,
         'workflowRevision': b['prWorkflowCommit'], 'qualifiedAt': manual_run['updated_at'],
         'tests': totals(pr_shards), 'testFiles': sum(map(len, partition)),
         'gates': [{'gate': g, 'command': c, 'jobId': qualify['id'], 'step': common.step(qualify, n)}
                   for g, c, n in common.GATES] +
                  [{'gate': 'test', 'jobId': pr_shards[0]['jobId'], 'step': pr_shards[0]['step'],
                    'actualJobSteps': pr_shards, 'counts': totals(pr_shards)}],
         'additionalManualQualification': {'runId': manual_run['id'], 'runAttempt': manual_run['run_attempt'],
                                           'shards': manual_shards, 'counts': totals(manual_shards)},
         'ordinaryBuildCorroboration': {'runId': pr_run['id'], 'jobId': build_job['id'], 'command': 'npm run build',
             'step': common.step(build_job, 'Build pull-request artifact'), 'sourceRevision': pr['commit'], 'sourceTree': pr['tree']},
         'frozenArtifactCorroboration': {'artifactId': artifact['id'], 'runId': artifact['runId'],
             'inspectionRunId': inspection_run['id'], 'wholeOriginalArtifactVerifiedBeforeQualification': True,
             'sourceTarGitBlobTypeModeAndPaxCommitVerified': True, 'allInnerZipManifestBytesVerified': True,
             'frozenOfflineInventoryAndBindingsVerified': True,
             'inputs': {k: pin(n, small[n]) for k, n in [('inspection', 'verification.json'), ('manifest', 'manifest.json'),
                        ('releaseRecord', 'release.json'), ('checksum', 'distribution.zip.sha256')]}},
         'evidencePins': [pin(n, body) for n, body in sorted(evidence.items())],
         'limits': ['Hosted exact-source evidence; no local full suite or build claimed.',
                    'API originals are evidence, not cryptographic signatures.',
                    'Public play, physical hardware and publication acceptance remain separate.']}
    small['source-qualification.json'] = encoded(q)
    manifest = encoded({'format': 'revealline-release-evidence.v1', 'version': source['version'],
                        'sourceRevision': source['commit'], 'sourceTree': source['tree'], 'files': q['evidencePins']})
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for name, body in sorted({**evidence, 'evidence-manifest.json': manifest}.items()):
            info = zipfile.ZipInfo(common.safe(name), (2026, 9, 24, 0, 0, 0))
            info.compress_type, info.external_attr = zipfile.ZIP_DEFLATED, 0o100644 << 16
            archive.writestr(info, body)
    small['source-qualification-evidence.zip'] = buffer.getvalue()
    asset = lambda n, body: {'name': n, 'bytes': len(body), 'sha256': sha(body)}
    large = [{'name': n, 'bytes': verify[r]['bytes'], 'sha256': verify[r]['sha256'],
              'originalMember': verify[r]['outerMember'], 'copiedToDisk': False}
             for n, r in [('source.tar', 'sourceTar'), ('distribution.zip', 'distribution')]]
    small['qualification-evidence-record.json'] = encoded({'format': 'revealline-qualification-evidence-record.v1',
        'sourceRevision': source['commit'], 'sourceTree': source['tree'], 'version': source['version'],
        'sourceQualified': True, 'originalFrozenPayloadVerified': True, 'sourceGateCounts': q['tests'],
        'attachments': large + [asset(n, body) for n, body in sorted(small.items())],
        'frozenArtifact': {**artifact, 'externallyExpectedDigestSupplied': True}})
    descriptors = large + [asset(n, body) for n, body in sorted(small.items())]
    require(len(small) == 7 and len(descriptors) == 9, 'Seven/nine attachment closure differs')
    context = {'source': source, 'artifact': artifact, 'release': {'assets': descriptors}}
    checked = common.exact_consumer(repo, source, context, small, verify, policy_body, output.parent)
    require(sum(map(len, small.values())) <= common.LIMIT and
            shutil.disk_usage(output.parent).free >= 1024**3 + sum(map(len, small.values())), 'Output reserve/bound')
    output.mkdir()
    for name, body in sorted(small.items()):
        with (output / name).open('xb') as stream:
            stream.write(body)
    result = {'status': 'OFFLINE_CONSUMER_VERIFIED_SMALL_PACKAGE', 'source': source, 'tests': q['tests'],
              'artifacts': descriptors, 'consumer': checked, 'remoteWrites': False, 'releaseAuthority': None}
    with receipt.open('xb') as stream:
        stream.write(encoded(result))
    return result


def api(repository, path, limit=4 * 1024**2, binary=False):
    """Read-only bounded gh pipe. No shell, credentials, signed URL or stderr is retained."""
    command = ['gh', 'api']
    if binary:
        command += ['-H', 'Accept: application/octet-stream']
    command += ['repos/' + repository + '/' + path]
    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    body, deadline = bytearray(), time.monotonic() + 120
    try:
        with selectors.DefaultSelector() as selector:
            selector.register(process.stdout, selectors.EVENT_READ)
            while True:
                require(time.monotonic() < deadline, 'GitHub read deadline')
                if not selector.select(min(1, max(0, deadline - time.monotonic()))):
                    continue
                chunk = os.read(process.stdout.fileno(), 65536)
                if not chunk:
                    break
                body.extend(chunk)
                require(len(body) <= limit, 'GitHub original exceeds bound')
        require(process.wait(timeout=5) == 0, 'GitHub read failed')
        return bytes(body)
    finally:
        if process.poll() is None:
            process.kill()
            process.wait()
        process.stdout.close()


def collect(binding, repo, output):
    b = reviewed(binding)
    out = Path(output).absolute()
    require(not out.exists() and out.parent.is_dir(), 'Fresh collection directory required')
    out.mkdir()
    used = 0
    def retain(name, body):
        nonlocal used
        used += len(body)
        require(used <= common.LIMIT, 'Collected evidence exceeds bound')
        target = out / common.safe(name)
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open('xb') as stream:
            stream.write(body)
        return str(target)
    config = {'binding': b, 'repositoryPath': str(Path(repo).resolve())}
    for role, run_id in [('pr', b['prRun']), ('manual', b['manualRun']), ('inspection', b['inspectionRun'])]:
        run_body = api(b['repository'], 'actions/runs/' + str(run_id))
        run = parse(run_body)
        require(run['status'] == 'completed' and run['conclusion'] == 'success', 'Completed successful run required')
        attempt = run['run_attempt']
        require(type(attempt) is int and attempt > 0, 'Run attempt missing')
        jobs_body = api(b['repository'], 'actions/runs/' + str(run_id) + '/attempts/' + str(attempt) + '/jobs?per_page=100')
        jobs = parse(jobs_body)
        require(jobs['total_count'] == len(jobs['jobs']) <= 100, 'Complete bounded job inventory required')
        config[role] = {'run': retain('runs/' + role + '/run.json', run_body),
                        'jobs': retain('runs/' + role + '/jobs.json', jobs_body), 'runAttempt': attempt, 'logs': {}}
        if role != 'inspection':
            expected = {'preflight', 'build'} if role == 'pr' else {'qualify', 'freeze'}
            expected |= {'test (' + str(i) + ')' for i in range(1, 5)}
            for job in jobs['jobs']:
                if job['name'] in expected:
                    body = api(b['repository'], 'actions/jobs/' + str(job['id']) + '/logs', MAX_LOG)
                    config[role]['logs'][str(job['id'])] = retain('runs/' + role + '/job-' + str(job['id']) + '.log', body)
    config['pullRequest'] = retain('pull-request.json', api(b['repository'], 'pulls/' + str(b['sourcePR'])))
    authorities = {role: parse(api(b['repository'], 'git/commits/' + commit)) for role, commit in
                   [('pr', b['prWorkflowCommit']), ('manual', b['source']['commit'])]}
    config['workflowAuthority'] = retain('workflow-commits.json', encoded(authorities))
    item = b['inspectionArtifact']
    metadata = api(b['repository'], 'actions/artifacts/' + str(item['id']))
    value = parse(metadata)
    require(value['id'] == item['id'] and value['name'] == 'inspect-artifact-evidence' and
            value['expired'] is False and value['size_in_bytes'] == item['bytes'] and
            value['digest'] == 'sha256:' + item['sha256'] and value['workflow_run']['id'] == b['inspectionRun'],
            'Inspection artifact authority differs')
    config['inspectionArtifactMetadata'] = retain('inspection-artifact.json', metadata)
    archive_body = api(b['repository'], 'actions/artifacts/' + str(item['id']) + '/zip', common.LIMIT)
    require(len(archive_body) == item['bytes'] and sha(archive_body) == item['sha256'], 'Inspection artifact bytes differ')
    config['inspectionArchive'] = retain('inspection-evidence.zip', archive_body)
    names = set()
    with zipfile.ZipFile(io.BytesIO(archive_body)) as archive:
        for info in archive.infolist():
            if info.is_dir():
                continue
            name = common.safe(info.filename)
            require(name not in names and len(names) < 2000 and info.file_size <= common.LIMIT - used and
                    not info.flag_bits & 1 and (info.external_attr >> 16) & 0o170000 in (0, 0o100000),
                    'Unsafe/duplicate/oversize inspection member')
            names.add(name)
            retain('inspection/' + name, archive.read(info))
    config['inspectionDirectory'] = str(out / 'inspection')
    retain('assemble-inputs.json', encoded(config))
    return config


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=['validate', 'collect', 'assemble'])
    parser.add_argument('inputs')
    parser.add_argument('--repo')
    parser.add_argument('--output')
    args = parser.parse_args()
    value = parse(common.read(args.inputs, 4 * 1024**2))
    if args.operation == 'validate':
        reviewed(value)
        if os.environ.get('GITHUB_OUTPUT'):
            with open(os.environ['GITHUB_OUTPUT'], 'a') as stream:
                stream.write('source=' + value['source']['commit'] + '\npr_workflow=' + value['prWorkflowCommit'] + '\npr_source=' + value['prSource']['commit'] + '\n')
        print('Reviewed full-test input shape accepted; no source qualification inferred.')
    elif args.operation == 'collect':
        require(args.repo and args.output, 'Repo and output required')
        collect(value, args.repo, args.output)
        print('Read-only evidence collection complete; assembly/independent review still required.')
    else:
        require(args.output, 'Output required')
        print(encoded(assemble(value, args.output)).decode())
