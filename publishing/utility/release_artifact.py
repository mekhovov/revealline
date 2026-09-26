#!/usr/bin/env python3
"""Explicit hosted inspection/upload of an existing frozen artifact; never rebuild.

The caller supplies a reviewed binding. Inspection has no release writes. Upload
requires an existing draft, immutable tag and seven already reviewed small assets.
The only writes to GitHub are one POST per absent original; exact completed assets are retained.
"""
import argparse
import contextlib
import hashlib
import io
import json
import os
from pathlib import Path
import re
import selectors
import shutil
import subprocess
import sys
import time
from types import SimpleNamespace
import zipfile

import inspect_qualified_artifact as inspector
import upload_source
import upload_distribution
from release_limits import MAX_DISTRIBUTION_BYTES

MIB = 1024**2
RESERVE = 512 * MIB
SMALL_NAMES = {'manifest.json', 'release.json', 'distribution.zip.sha256',
               'source-qualification.json', 'source-qualification-evidence.zip',
               'verification.json', 'qualification-evidence-record.json'}
NAMES = SMALL_NAMES | {'source.tar', 'distribution.zip'}
HEX = re.compile(r'[0-9a-f]{64}')
COMMIT = re.compile(r'[0-9a-f]{40}')
WORKFLOW = '.github/workflows/qualify-release-source.yml'
GATES = ['validate', 'lint', 'format', 'native-format', 'motion-syntax', 'test']
COMMANDS = ['npm run validate', 'npm run lint', 'npm run format:check',
            'npm run format:native:check', 'node --check authoring/motion-lab/app.js']
WAIVER_FORMAT = 'revealline-source-qualification.v2'
POLICY_PATH = 'publishing/test-policy.json'
WAIVER_AUTHORIZATION = 'explicit-user-request-20260922'


def require(ok, why):
    if not ok:
        raise ValueError(why)


def sha(body):
    return hashlib.sha256(body).hexdigest()


def parse(body):
    return inspector.json_read(body, 'bounded utility JSON')


def write(path, body):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('xb') as file:
        file.write(body)
        file.flush()
        os.fsync(file.fileno())


def record(path, value):
    write(path, (json.dumps(value, indent=2) + '\n').encode())


def pin(path):
    body = path.read_bytes()
    return {'path': str(path.resolve()), 'bytes': len(body), 'sha256': sha(body)}


def positive(value, maximum):
    return type(value) is int and 0 < value <= maximum


def validate_binding(body, mode, repository):
    require(len(body) <= 32768, 'Binding exceeds 32 KiB')
    binding = parse(body)
    require(set(binding) == {'format', 'reviewed', 'repository', 'source', 'artifact', 'release'},
            'Unexpected or missing binding fields')
    require(binding['format'] == 'revealline-release-utility-binding.v1' and binding['reviewed'] is True,
            'Explicit reviewed utility binding required')
    require(binding['repository'] == repository and upload_source.REPO.fullmatch(repository) and
            not any(p in ('.', '..') for p in repository.split('/')), 'Repository differs')
    source, artifact = binding['source'], binding['artifact']
    require(set(source) == {'commit', 'tree', 'version'} and COMMIT.fullmatch(source['commit']) and
            COMMIT.fullmatch(source['tree']) and upload_source.TAG.fullmatch(source['version']),
            'Exact full source/tree/stable version required')
    require(set(artifact) == {'id', 'runId', 'bytes', 'sha256'} and
            all(positive(artifact[k], 10**14) for k in ['id', 'runId']) and
            positive(artifact['bytes'], 4_000_000_000) and HEX.fullmatch(artifact['sha256']),
            'Exact artifact id/run/length/digest required')
    require(mode in ['inspect-artifact', 'upload-originals'], 'Explicit utility operation required')
    release = binding['release']
    if mode == 'inspect-artifact':
        require(release is None, 'Read-only inspection accepts no release target')
    else:
        require(isinstance(release, dict) and set(release) == {'id', 'tag', 'assets'} and
                positive(release['id'], 10**14) and release['tag'] == source['version'], 'Exact draft id/tag required')
        rows = release['assets']
        require(isinstance(rows, list) and len(rows) == 9 and {r['name'] for r in rows} == NAMES,
                'Exactly nine unique reviewed asset descriptors required')
        for row in rows:
            limit = 64 * MIB if row['name'] == 'source-qualification-evidence.zip' else (
                2_000_000_000 if row['name'] == 'source.tar' else
                MAX_DISTRIBUTION_BYTES if row['name'] == 'distribution.zip' else 4 * MIB)
            require(set(row) == {'name', 'bytes', 'sha256'} and positive(row['bytes'], limit) and
                    HEX.fullmatch(row['sha256']), 'Invalid asset descriptor or bounded length')
    return binding


class RecordedGitHub(upload_source.GitHub):
    """Fixed API host, bounded raw originals; no tokens or signed URLs in evidence."""
    def __init__(self, token, out):
        super().__init__(token)
        self.out, self.sequence = out, 0

    def upload(self, path, stream, size, expected_hash):
        if path.endswith('/assets?name=distribution.zip'):
            return upload_distribution.GitHub.upload(self, path, stream, size, expected_hash)
        require(path.endswith('/assets?name=source.tar'), 'Only the two original member POSTs are permitted')
        return super().upload(path, stream, size, expected_hash)

    def get(self, path):
        require(path.startswith('/repos/') and '\n' not in path, 'Unexpected API path')
        connection = self.connection()
        try:
            connection.request('GET', path, headers=self.headers())
            response = connection.getresponse()
            require(response.status == 200, 'GitHub metadata request failed: HTTP ' + str(response.status))
            body = response.read(4 * MIB + 1)
            require(len(body) <= 4 * MIB, 'API original exceeds metadata bound')
            value = parse(body)
            self.sequence += 1
            target = self.out / f'{self.sequence:03d}.json'
            write(target, body)
            record(self.out / f'{self.sequence:03d}.request.json', {'method': 'GET', 'path': path, 'original': pin(target)})
            return value
        finally:
            connection.close()


def test_policy(body):
    policy = parse(body)
    require(isinstance(policy, dict) and set(policy) == {
        'format', 'mode', 'authorization', 'scope', 'reason', 'restoration'}, 'Invalid test policy fields')
    require(policy['format'] == 'revealline-release-test-policy.v1' and
            policy['mode'] in ['required', 'waived'] and policy['authorization'] == WAIVER_AUTHORIZATION and
            policy['scope'] == 'automated-test-suites' and
            all(isinstance(policy[k], str) and policy[k].strip() and len(policy[k]) <= 2000
                for k in ['reason', 'restoration']), 'Invalid temporary test policy')
    return policy


def committed_test_policy(repo, source):
    """Missing policy preserves the legacy requirement; Git errors never enable a waiver."""
    args = ['git', '-C', str(repo)]
    row = subprocess.check_output(args + ['ls-tree', source['commit'], '--', POLICY_PATH], timeout=30)
    if not row:
        return None
    require(row.startswith(b'100644 blob ') and row.endswith(b'\t' + POLICY_PATH.encode() + b'\n'),
            'Test policy must be an ordinary committed file')
    size = subprocess.check_output(args + ['cat-file', '-s', source['commit'] + ':' + POLICY_PATH], timeout=30)
    require(size.strip().isdigit() and 0 < int(size) <= 16384, 'Test policy exceeds bound')
    body = subprocess.check_output(args + ['show', source['commit'] + ':' + POLICY_PATH], timeout=30)
    require(len(body) == int(size), 'Test policy size differs')
    test_policy(body)
    return body


def source_jobs_check(jobs, source, waived=False):
    required = ['qualify', 'freeze'] if waived else ['qualify', 'test (1)', 'test (2)', 'test (3)', 'test (4)', 'freeze']
    for name in required:
        matched = [j for j in jobs if j.get('name') == name]
        require(len(matched) == 1 and matched[0].get('status') == 'completed' and
                matched[0].get('conclusion') == 'success' and matched[0].get('head_sha') == source,
                'Actual successful source/freeze job missing: ' + name)
    if waived:
        tests = [j for j in jobs if j.get('name') == 'test' or str(j.get('name', '')).startswith('test (')]
        names = [j.get('name') for j in tests]
        require(names == ['test'] or len(names) == 4 and set(names) == {'test (1)', 'test (2)', 'test (3)', 'test (4)'},
                'Actual skipped test job inventory missing')
        require(all(j.get('status') == 'completed' and j.get('conclusion') == 'skipped' and
                    j.get('head_sha') == source for j in tests), 'Waived test jobs must actually be skipped')


def artifact_authority(api, binding, policy_body=None):
    repo, expected = binding['repository'], binding['artifact']
    item = api.get(f'/repos/{repo}/actions/artifacts/{expected["id"]}')
    allowed_names = {'qualified-release-snapshot',
                     f'qualified-release-{binding["source"]["version"]}-{binding["source"]["commit"]}'}
    require(item.get('id') == expected['id'] and item.get('name') in allowed_names and
            item.get('expired') is False and item.get('size_in_bytes') == expected['bytes'] and
            item.get('digest') == 'sha256:' + expected['sha256'] and
            item.get('workflow_run', {}).get('id') == expected['runId'] and
            item.get('workflow_run', {}).get('head_sha') == binding['source']['commit'], 'Artifact authority differs')
    run = api.get(f'/repos/{repo}/actions/runs/{expected["runId"]}')
    require(run.get('id') == expected['runId'] and run.get('event') == 'workflow_dispatch' and
            run.get('path') == WORKFLOW and run.get('head_sha') == binding['source']['commit'] and
            run.get('status') == 'completed' and run.get('conclusion') == 'success',
            'Original manual source/freeze run is not completed successfully')
    jobs = []
    for page in range(1, 11):
        response = api.get(f'/repos/{repo}/actions/runs/{expected["runId"]}/jobs?per_page=100&page={page}')
        rows = response.get('jobs')
        require(isinstance(rows, list) and len(rows) <= 100, 'Malformed jobs response')
        jobs.extend(rows)
        if len(rows) < 100:
            break
    else:
        raise ValueError('Jobs exceed pagination bound')
    waived = policy_body is not None and test_policy(policy_body)['mode'] == 'waived'
    # A policy permits skipping; an explicitly opted-in successful test run remains valid.
    skipped = any(j.get('name') in ['test', 'test (1)'] and
                  j.get('conclusion') == 'skipped' for j in jobs)
    source_jobs_check(jobs, binding['source']['commit'], waived=waived and skipped)
    return item


def receive(path, endpoint, size, digest, *, accept='application/vnd.github+json'):
    """One bounded gh GET stream. A failed/partial original remains; never retries."""
    require(shutil.disk_usage(path.parent).free >= size + RESERVE, 'Disk reserve insufficient before transfer')
    process = None
    total, hash_value = 0, hashlib.sha256()
    start = last = time.monotonic()
    try:
        with path.open('xb') as output, contextlib.ExitStack() as stack:
            process = subprocess.Popen(['gh', 'api', endpoint, '-H', 'Accept: ' + accept],
                                       stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
            selector = stack.enter_context(selectors.DefaultSelector())
            selector.register(process.stdout, selectors.EVENT_READ)
            while True:
                now = time.monotonic()
                require(now - start <= 7200 and now - last <= 180, 'Transfer deadline exceeded')
                require(shutil.disk_usage(path.parent).free >= (size - total) + RESERVE,
                        'Disk reserve exhausted during transfer')
                if not selector.select(timeout=1):
                    continue
                block = os.read(process.stdout.fileno(), MIB)
                if not block:
                    break
                total += len(block)
                require(total <= size, 'Response exceeds reviewed byte length')
                hash_value.update(block)
                output.write(block)
                last = time.monotonic()
            output.flush()
            os.fsync(output.fileno())
            require(process.wait(timeout=30) == 0, 'Transfer subprocess failed')
        require(total == size and hash_value.hexdigest() == digest, 'Original response byte/hash mismatch')
    finally:
        if process:
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=5)
            process.stdout.close()


def source_identity(repo, source):
    def git(*args):
        return subprocess.check_output(['git', '-C', str(repo), *args], text=True).strip()
    require(git('rev-parse', 'HEAD') == source['commit'] and git('rev-parse', 'HEAD^{tree}') == source['tree'],
            'Qualified checkout source/tree differs')
    require(not git('status', '--porcelain', '--untracked-files=no'), 'Qualified tracked checkout changed')
    return {'sourceRevision': source['commit'], 'sourceTree': source['tree'], 'trackedCheckoutClean': True}


def inspect_original(binding, repo, out, api, policy_body=None):
    item = artifact_authority(api, binding, policy_body)
    source, artifact = binding['source'], binding['artifact']
    original = out / 'qualified-artifact-original.zip'
    record(out / 'evidence/artifact-authority.json', item)
    receive(original, f'repos/{binding["repository"]}/actions/artifacts/{artifact["id"]}/zip',
            artifact['bytes'], artifact['sha256'])
    record(out / 'qualified-artifact-original.download.json', {
        'status': 'ORIGINAL_RECEIVED_VERIFIED', 'exitCode': 0, 'sourceRevision': source['commit'],
        'artifactId': artifact['id'], 'bytes': artifact['bytes'], 'sha256': artifact['sha256'],
        'output': str(original.resolve()), 'expectedBytes': artifact['bytes'], 'expectedSha256': artifact['sha256'],
        'metadataSha256': pin(out / 'evidence/artifact-authority.json')['sha256'], 'automaticRetry': False})
    verified = out / 'qualified-artifact-verified'
    with (out / 'evidence/inspection.log').open('xb') as log:
        subprocess.run([sys.executable, str(Path(__file__).with_name('inspect_qualified_artifact.py')), str(original),
                        '--repo', str(repo), '--expected-commit', source['commit'], '--expected-version', source['version'],
                        '--artifact-sha256', artifact['sha256'], '--max-distribution-bytes',
                        str(MAX_DISTRIBUTION_BYTES), '--out', str(verified)],
                       stdout=log, stderr=subprocess.STDOUT, check=True, timeout=7200)
    inspection = parse((verified / 'inspection.json').read_bytes())
    require(inspection['gitTree'] == source['tree'], 'Inspected Git tree differs')
    with (out / 'evidence/offline-review.log').open('xb') as log:
        subprocess.run([sys.executable, str(Path(__file__).with_name('verify_frozen_offline.py')),
                        '--repo', str(repo), '--base', str(out), '--source', source['commit'], '--tree', source['tree'],
                        '--version', source['version'], '--inspection-sha256', pin(verified / 'inspection.json')['sha256'],
                        '--download-sha256', pin(out / 'qualified-artifact-original.download.json')['sha256'],
                        '--manifest-sha256', pin(verified / 'manifest.json')['sha256']],
                       stdout=log, stderr=subprocess.STDOUT, check=True, timeout=300)
    return inspection


def successful(step):
    return step.get('status') == 'completed' and step.get('conclusion') == 'success'


def counts_pass(counts):
    require(set(counts) == {'tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'} and
            all(type(v) is int and v >= 0 for v in counts.values()) and counts['tests'] > 0 and
            counts['tests'] == counts['pass'] and not any(counts[k] for k in ['fail', 'cancelled', 'skipped', 'todo']),
            'Incomplete or failing test counts')


def qualification_check(q, binding):
    if q.get('format') == WAIVER_FORMAT:
        return waiver_qualification_check(q, binding)
    source = binding['source']
    require(q.get('format') == 'revealline-source-qualification.v1' and q.get('passed') is True and
            q.get('sourceRevision') == q.get('actualCheckoutCommit') == source['commit'] and
            q.get('sourceTree') == q.get('actualCheckoutTree') == source['tree'] and
            q.get('version') == source['version'] and q.get('allTrackedSourceContentsAndModesMatch') is True,
            'Reviewed qualification identity/result differs')
    gates = q['gates']
    require([g['gate'] for g in gates] == GATES and all(successful(g['step']) for g in gates) and
            [g['command'] for g in gates[:5]] == COMMANDS, 'All six actual source gates required')
    counts_pass(q['tests'])
    require(positive(q['testFiles'], 10000), 'Actual test-file count missing')
    families = [gates[-1]['actualJobSteps'], q['additionalManualQualification']['shards']]
    require(len({s['jobId'] for family in families for s in family}) == 8, 'Source families must use eight distinct actual jobs')
    for shards in families:
        require(len(shards) == 4 and {s['shard'] for s in shards} == {1, 2, 3, 4} and
                len({s['jobId'] for s in shards}) == 4, 'Both actual four-shard families required')
        for shard in shards:
            require(successful(shard['step']), 'Unsuccessful shard')
            counts_pass(shard['counts'])
        require({k: sum(s['counts'][k] for s in shards) for k in q['tests']} == q['tests'], 'Test family total differs')
    require(successful(q['ordinaryBuildCorroboration']['step']) and
            q['ordinaryBuildCorroboration']['command'] == 'npm run build', 'Actual successful ordinary build missing')
    frozen = q['frozenArtifactCorroboration']
    require(frozen['artifactId'] == binding['artifact']['id'] and
            all(frozen.get(k) is True for k in ['wholeOriginalArtifactVerifiedBeforeQualification',
                'sourceTarGitBlobTypeModeAndPaxCommitVerified', 'allInnerZipManifestBytesVerified',
                'frozenOfflineInventoryAndBindingsVerified']), 'Qualification frozen original coverage missing')


def waiver_qualification_check(q, binding):
    source = binding['source']
    require(q.get('status') == 'qualified-with-test-waiver' and q.get('releaseEligible') is True and
            not any(k in q for k in ['passed', 'testFiles', 'additionalManualQualification', 'shards', 'testShards']) and
            q.get('tests') == {'status': 'waived', 'counts': None}, 'Waiver must not assert passing tests')
    require(q.get('sourceRevision') == q.get('actualCheckoutCommit') == source['commit'] and
            q.get('sourceTree') == q.get('actualCheckoutTree') == source['tree'] and
            q.get('version') == source['version'] and q.get('allTrackedSourceContentsAndModesMatch') is True,
            'Reviewed qualification identity/result differs')
    gates = q['gates']
    require([g['gate'] for g in gates] == GATES[:5] and [g['command'] for g in gates] == COMMANDS and
            all(successful(g['step']) and 'actualJobSteps' not in g for g in gates),
            'All five actual non-test source gates required')
    policy = q['testPolicy']
    require(set(policy) == {'mode', 'authorization', 'reason', 'policyEvidence'} and
            policy['mode'] == 'waived' and policy['authorization'] == WAIVER_AUTHORIZATION and
            isinstance(policy['reason'], str) and policy['reason'].strip() and len(policy['reason']) <= 2000,
            'Explicit test waiver authorization required')
    proof = q['waiverEvidence']
    require(set(proof) == {'runId', 'runEvidence', 'jobsEvidence'} and
            proof['runId'] == binding['artifact']['runId'] and positive(proof['runId'], 10**14),
            'Waiver must bind the actual frozen-source run')
    for item in [policy['policyEvidence'], proof['runEvidence'], proof['jobsEvidence']]:
        require(isinstance(item, dict) and set(item) == {'path', 'bytes', 'sha256'} and
                isinstance(item['path'], str) and positive(item['bytes'], 4 * MIB) and
                isinstance(item['sha256'], str) and HEX.fullmatch(item['sha256']) and
                item in q['evidencePins'], 'Waiver original pin missing')
    require(policy['policyEvidence']['path'] == POLICY_PATH, 'Waiver policy must use its canonical evidence path')
    require(policy['policyEvidence']['bytes'] <= 16384, 'Waiver policy exceeds its 16 KiB bound')
    premerge = q.get('preMergeValidationCorroboration')
    legacy_build = q.get('ordinaryBuildCorroboration')
    focused = q.get('focusedAdmissionCorroboration')
    focused_valid = (isinstance(focused, dict) and
        set(focused) == {'runId', 'jobId', 'aggregateJobId', 'classificationSteps', 'sourceRevision',
                         'sourceTree', 'genericBuild', 'fullTests', 'scope'} and
        positive(focused.get('runId'), 10**14) and positive(focused.get('jobId'), 10**14) and
        positive(focused.get('aggregateJobId'), 10**14) and
        isinstance(focused.get('classificationSteps'), list) and len(focused['classificationSteps']) == 2 and
        [row.get('name') for row in focused['classificationSteps']] ==
            ['Capture the reviewed changed-path set', 'Select the fail-closed focused gate'] and
        all(successful(row) for row in focused['classificationSteps']) and
        isinstance(focused.get('sourceRevision'), str) and COMMIT.fullmatch(focused['sourceRevision']) and
        isinstance(focused.get('sourceTree'), str) and COMMIT.fullmatch(focused['sourceTree']) and
        set(focused.get('genericBuild', {})) == {'status', 'jobId'} and
        focused['genericBuild'].get('status') == 'skipped-by-fast-release-policy' and
        positive(focused['genericBuild'].get('jobId'), 10**14) and
        focused.get('fullTests') == {'status': 'waived-and-skipped'} and
        isinstance(focused.get('scope'), str) and focused['scope'].strip())
    require(sum(row is not None for row in (premerge, legacy_build, focused)) == 1 and
            ((isinstance(premerge, dict) and set(premerge) == {'runId', 'jobId', 'command', 'step',
              'sourceRevision', 'sourceTree', 'artifactBuild', 'scope'} and
              positive(premerge.get('runId'), 10**14) and positive(premerge.get('jobId'), 10**14) and
              premerge.get('command') == 'npm run validate' and
              successful(premerge.get('step', {})) and
              isinstance(premerge.get('sourceRevision'), str) and COMMIT.fullmatch(premerge['sourceRevision']) and
              isinstance(premerge.get('sourceTree'), str) and COMMIT.fullmatch(premerge['sourceTree']) and
              isinstance(premerge.get('scope'), str) and premerge['scope'].strip() and
              set(premerge.get('artifactBuild', {})) == {'status', 'step'} and
              premerge['artifactBuild'].get('status') == 'deferred-to-frozen-source' and
              successful(premerge['artifactBuild'].get('step', {}))) or
             (isinstance(legacy_build, dict) and legacy_build.get('command') == 'npm run build' and
              successful(legacy_build.get('step', {}))) or focused_valid),
            'Actual successful PR validation and explicit artifact deferral missing')
    frozen = q['frozenArtifactCorroboration']
    require(frozen['artifactId'] == binding['artifact']['id'] and
            all(frozen.get(k) is True for k in ['wholeOriginalArtifactVerifiedBeforeQualification',
                'sourceTarGitBlobTypeModeAndPaxCommitVerified', 'allInnerZipManifestBytesVerified',
                'frozenOfflineInventoryAndBindingsVerified']), 'Qualification frozen original coverage missing')


def sensitive_check(body):
    patterns = [rb'gh[pousr]_[A-Za-z0-9]{20,}', rb'(?i)Bearer\s+[a-zA-Z0-9._-]{20,}',
                rb'(?i)[?&](?:sig|signature|X-Amz-Signature|token)=[^\s"<>]{8,}']
    require(not any(re.search(pattern, body) for pattern in patterns),
            'Sensitive token or signed URL pattern in release evidence')


def verify_evidence(body, qualification, source, policy_body=None):
    """Every stored original is bounded, path-safe and checked by CRC/length/hash."""
    with zipfile.ZipFile(io.BytesIO(body)) as archive:
        inventory = inspector.zip_inventory(archive, 2001)
        require(all(not info.is_dir() for info in inventory.values()), 'Evidence uses file members only')
        require('evidence-manifest.json' in inventory and inventory['evidence-manifest.json'].file_size <= 2 * MIB,
                'Bounded evidence manifest missing')
        manifest_body = archive.read('evidence-manifest.json')
        manifest = parse(manifest_body)
        require(manifest.get('sourceRevision') == source['commit'] and manifest.get('sourceTree') == source['tree'] and
                manifest.get('version') == source['version'], 'Evidence source differs')
        rows = manifest['files']
        require(len(rows) <= 2000 and len({r['path'] for r in rows}) == len(rows) and
                set(inventory) == {r['path'] for r in rows} | {'evidence-manifest.json'} and
                sum(r['bytes'] for r in rows) <= 64 * MIB, 'Evidence inventory/byte bound differs')
        for row in rows:
            info = inventory[row['path']]
            require(type(row['bytes']) is int and 0 <= row['bytes'] <= 64 * MIB and HEX.fullmatch(row['sha256']) and
                    info.file_size == row['bytes'], 'Evidence member length differs')
            original = archive.read(info)  # bounded above; zipfile checks CRC
            require(sha(original) == row['sha256'], 'Evidence member hash differs')
            sensitive_check(original)
        index = {r['path']: r for r in rows}
        require(isinstance(qualification['evidencePins'], list) and 0 < len(qualification['evidencePins']) <= 2000,
                'Qualification must reference its retained original evidence')
        for item in qualification['evidencePins']:
            require(item['path'] in index and all(index[item['path']][k] == item[k] for k in ['bytes', 'sha256']),
                    'Qualification pin has no exact archived original')
        if qualification.get('format') == WAIVER_FORMAT:
            waiver = qualification['waiverEvidence']
            policy_pin = qualification['testPolicy']['policyEvidence']
            policy_original = archive.read(policy_pin['path'])
            policy = test_policy(policy_original)
            require(policy['mode'] == 'waived' and all(policy[k] == qualification['testPolicy'][k]
                    for k in ['mode', 'authorization', 'reason']), 'Archived policy differs from waiver')
            if policy_body is not None:
                require(policy_original == policy_body, 'Waiver policy differs from the exact committed source')
            run = parse(archive.read(waiver['runEvidence']['path']))
            jobs = parse(archive.read(waiver['jobsEvidence']['path']))
            require(run.get('id') == waiver['runId'] and run.get('event') == 'workflow_dispatch' and
                    run.get('path') == WORKFLOW and run.get('head_sha') == source['commit'] and successful(run),
                    'Waiver original run identity/result differs')
            job_rows = jobs.get('jobs')
            require(isinstance(job_rows, list) and 0 < len(job_rows) <= 1000 and jobs.get('total_count') == len(job_rows) and
                    all(j.get('run_id') == run['id'] and positive(j.get('id'), 10**14) for j in job_rows) and
                    len({j['id'] for j in job_rows}) == len(job_rows), 'Waiver original jobs incomplete or borrowed')
            source_jobs_check(job_rows, source['commit'], waived=True)
            qualify = next(j for j in job_rows if j.get('name') == 'qualify')
            names = ['Validate source', 'Lint source', 'Check formatting',
                     'Check native formatting', 'Check motion lab syntax']
            for gate, name in zip(qualification['gates'], names):
                matched = [s for s in qualify.get('steps', []) if s.get('name') == name]
                require(gate.get('jobId') == qualify['id'] and len(matched) == 1 and
                        all(gate['step'].get(k) == matched[0].get(k) for k in ['name', 'number', 'status', 'conclusion']) and
                        successful(matched[0]), 'Waiver mandatory gate lacks its actual job/step original')
            premerge = qualification.get('preMergeValidationCorroboration')
            if premerge is not None:
                pr_run = parse(archive.read('runs/pr/run.json'))
                pr_jobs = parse(archive.read('runs/pr/jobs.json'))
                equivalence = parse(archive.read('preparation/source-equivalence.json'))
                require(pr_run.get('id') == premerge['runId'] and pr_run.get('event') == 'pull_request' and
                        pr_run.get('path') == '.github/workflows/deploy-pages.yml' and
                        pr_run.get('head_sha') == premerge['sourceRevision'] and successful(pr_run),
                        'PR validation original run identity/result differs')
                pr_rows = pr_jobs.get('jobs')
                require(isinstance(pr_rows, list) and 0 < len(pr_rows) <= 1000 and
                        pr_jobs.get('total_count') == len(pr_rows) and
                        all(j.get('run_id') == pr_run['id'] and positive(j.get('id'), 10**14) for j in pr_rows) and
                        len({j['id'] for j in pr_rows}) == len(pr_rows),
                        'PR validation original jobs incomplete or borrowed')
                builds = [j for j in pr_rows if j.get('name') == 'build']
                require(len(builds) == 1 and builds[0]['id'] == premerge['jobId'] and successful(builds[0]) and
                        builds[0].get('head_sha') == premerge['sourceRevision'],
                        'PR validation build job identity/result differs')
                build_steps = builds[0].get('steps', [])
                for retained, name in [(premerge['step'], 'Validate release-critical source'),
                                       (premerge['artifactBuild']['step'],
                                        'Defer full artifact build to merged-source qualification')]:
                    matched = [s for s in build_steps if s.get('name') == name]
                    require(len(matched) == 1 and all(retained.get(k) == matched[0].get(k)
                            for k in ['name', 'number', 'status', 'conclusion']) and successful(matched[0]),
                            'PR validation step lacks its actual job original')
                for name in ['Verify exact tracked source before commands',
                             'Verify tracked source after fast release gate']:
                    matched = [s for s in build_steps if s.get('name') == name]
                    require(len(matched) == 1 and successful(matched[0]),
                            'PR validation source identity step missing')
                pr_equivalence, frozen_equivalence = equivalence.get('prSource', {}), equivalence.get('frozenSource', {})
                require(all(pr_equivalence.get(k) == v for k, v in
                            [('commit', premerge['sourceRevision']), ('tree', premerge['sourceTree'])]) and
                        all(frozen_equivalence.get(k) == source[k] for k in ['commit', 'tree']),
                        'PR validation/source equivalence identity differs')
            focused = qualification.get('focusedAdmissionCorroboration')
            if focused is not None:
                pr_run = parse(archive.read('runs/pr/run.json'))
                pr_jobs = parse(archive.read('runs/pr/jobs.json'))
                equivalence = parse(archive.read('preparation/source-equivalence.json'))
                require(pr_run.get('id') == focused['runId'] and pr_run.get('event') == 'pull_request' and
                        pr_run.get('path') == '.github/workflows/deploy-pages.yml' and
                        pr_run.get('head_sha') == focused['sourceRevision'] and successful(pr_run),
                        'Focused admission original run identity/result differs')
                pr_rows = pr_jobs.get('jobs')
                require(isinstance(pr_rows, list) and 0 < len(pr_rows) <= 1000 and
                        pr_jobs.get('total_count') == len(pr_rows) and
                        all(j.get('run_id') == pr_run['id'] and positive(j.get('id'), 10**14) for j in pr_rows) and
                        len({j['id'] for j in pr_rows}) == len(pr_rows),
                        'Focused admission original jobs incomplete or borrowed')
                by_name = {name: [job for job in pr_rows if job.get('name') == name]
                           for name in ('preflight', 'focused', 'release-ready', 'build', 'test')}
                require(all(len(rows) == 1 for rows in by_name.values()),
                        'Focused admission job family missing or duplicated')
                preflight, focused_job, ready, build, tests = [by_name[name][0] for name in
                    ('preflight', 'focused', 'release-ready', 'build', 'test')]
                require(successful(preflight) and successful(focused_job) and successful(ready) and
                        focused_job['id'] == focused['jobId'] and ready['id'] == focused['aggregateJobId'] and
                        build['id'] == focused['genericBuild']['jobId'] and
                        build.get('conclusion') == tests.get('conclusion') == 'skipped' and
                        all(job.get('head_sha') == focused['sourceRevision']
                            for rows in by_name.values() for job in rows),
                        'Focused admission job identity/result differs')
                for retained in focused['classificationSteps']:
                    matched = [row for row in focused_job.get('steps', []) if row.get('name') == retained['name']]
                    require(len(matched) == 1 and all(retained.get(key) == matched[0].get(key)
                            for key in ['name', 'number', 'status', 'conclusion']) and successful(matched[0]),
                            'Focused admission classification step lacks its actual original')
                pr_equivalence, frozen_equivalence = equivalence.get('prSource', {}), equivalence.get('frozenSource', {})
                require(all(pr_equivalence.get(k) == v for k, v in
                            [('commit', focused['sourceRevision']), ('tree', focused['sourceTree'])]) and
                        all(frozen_equivalence.get(k) == source[k] for k in ['commit', 'tree']),
                        'Focused admission/source equivalence identity differs')
        return {'files': len(rows), 'originalBytes': sum(r['bytes'] for r in rows),
                'manifestSha256': sha(manifest_body), 'everyMemberCRCAndHashVerified': True,
                'allQualificationPinsResolved': True}


def asset_set(api, binding, expected_names, optional_names=frozenset()):
    release, repo = binding['release'], binding['repository']
    assets = upload_source.release_assets(api, repo, release['id'], release['tag'])
    names = {a.get('name') for a in assets}
    require(len(assets) == len(names) and expected_names <= names <= expected_names | optional_names,
            'Draft assets differ; missing, duplicate or unexpected assets cannot be recovered automatically')
    expected = {r['name']: r for r in release['assets']}
    for asset in assets:
        row = expected[asset['name']]
        require(positive(asset.get('id'), 10**14) and asset.get('state') == 'uploaded' and
                asset.get('url') == f'https://api.github.com/repos/{repo}/releases/assets/{asset["id"]}' and
                asset.get('size') == row['bytes'] and asset.get('digest') == 'sha256:' + row['sha256'],
                'Release asset id/state/size/server digest differs')
    upload_source.verify_tag(api, repo, release['tag'], binding['source']['commit'])
    return assets


class DraftUploadAPI:
    """Keep the unchanged upload engines behind one final complete-draft POST guard."""
    def __init__(self, api, binding):
        self.api, self.binding = api, binding

    def get(self, path):
        return self.api.get(path)

    def upload(self, path, stream, size, digest):
        binding = self.binding
        prefix = f'/repos/{binding["repository"]}/releases/{binding["release"]["id"]}/assets?name='
        name = next((name for name in NAMES - SMALL_NAMES if path == prefix + name), None)
        require(name is not None, 'Only original payload uploads are permitted')
        expected = next(row for row in binding['release']['assets'] if row['name'] == name)
        require(size == expected['bytes'] and digest == expected['sha256'], 'POST descriptor differs')
        assets = asset_set(self.api, binding, SMALL_NAMES, NAMES - SMALL_NAMES)
        require(not any(asset['name'] == name for asset in assets), 'Original appeared before POST; refusing overwrite')
        return self.api.upload(path, stream, size, digest)


def small_assets_check(binding, bodies, inspection, policy_body=None, *, require_committed_policy=False):
    source = binding['source']
    for name, body in bodies.items():
        if name != 'source-qualification-evidence.zip':
            sensitive_check(body)
    q = parse(bodies['source-qualification.json'])
    if q.get('format') == WAIVER_FORMAT and require_committed_policy:
        require(policy_body is not None and test_policy(policy_body)['mode'] == 'waived',
                'Waiver upload requires the exact committed policy')
    qualification_check(q, binding)
    prior = parse(bodies['verification.json'])
    for key in ['format', 'status', 'gitHead', 'gitTree', 'version', 'manifestSha256', 'releaseHashChainVerified']:
        require(prior[key] == inspection[key], 'Reviewed inspection differs: ' + key)
    for role in ['artifact', 'sourceTar', 'distribution']:
        require(all(prior[role][k] == inspection[role][k] for k in ['bytes', 'sha256']), 'Reviewed original payload differs')
    require(prior['distribution']['allManifestBytesVerified'] is True and
            prior['distribution']['innerManifestIdentical'] is True, 'Prior whole byte verification missing')
    record_value = parse(bodies['qualification-evidence-record.json'])
    require(record_value['sourceRevision'] == source['commit'] and record_value['sourceTree'] == source['tree'] and
            record_value['version'] == source['version'] and record_value['sourceQualified'] is True and
            record_value['originalFrozenPayloadVerified'] is True, 'Evidence record source/result differs')
    waived = q.get('format') == WAIVER_FORMAT
    require((record_value['sourceGateCounts'] is None and record_value.get('testStatus') == 'waived'
             if waived else record_value['sourceGateCounts'] == q['tests']) and
            all(record_value['frozenArtifact'][k] == binding['artifact'][k] for k in ['bytes', 'sha256']) and
            record_value['frozenArtifact'].get('externallyExpectedDigestSupplied') is True,
            'Evidence record gate totals or original artifact binding differs')
    inputs = q['frozenArtifactCorroboration']['inputs']
    for role, name in [('inspection', 'verification.json'), ('manifest', 'manifest.json'),
                       ('releaseRecord', 'release.json'), ('checksum', 'distribution.zip.sha256')]:
        require(inputs[role]['bytes'] == len(bodies[name]) and inputs[role]['sha256'] == sha(bodies[name]),
                'Qualification frozen input differs from reviewed original: ' + role)
    descriptors = {r['name']: r for r in binding['release']['assets']}
    rows = record_value['attachments']
    require(len(rows) == 8 and {r['name'] for r in rows} == NAMES - {'qualification-evidence-record.json'},
            'Evidence record must bind the other eight attachments')
    for row in rows:
        require(all(row[k] == descriptors[row['name']][k] for k in ['bytes', 'sha256']), 'Attachment record differs')
    for name, role, member in [('source.tar', 'sourceTar', 'source.tar'),
                               ('distribution.zip', 'distribution', 'site/distribution.zip')]:
        row = next(r for r in rows if r['name'] == name)
        require(row.get('originalMember') == inspection[role]['outerMember'] == source['version'] + '/' + member and
                row.get('copiedToDisk') is False and all(descriptors[name][k] == inspection[role][k] for k in ['bytes', 'sha256']),
                'Original source/distribution member binding differs')
    return verify_evidence(bodies['source-qualification-evidence.zip'], q, source, policy_body)


def upload_originals(binding, out, inspection, api, policy_body=None):
    assets = asset_set(api, binding, SMALL_NAMES, NAMES - SMALL_NAMES)
    bodies = {}
    small = out / 'evidence/reviewed-small-assets'
    small.mkdir()
    for asset in assets:
        if asset['name'] not in SMALL_NAMES:
            continue
        path = small / asset['name']
        receive(path, f'repos/{binding["repository"]}/releases/assets/{asset["id"]}',
                asset['size'], asset['digest'].removeprefix('sha256:'), accept='application/octet-stream')
        bodies[asset['name']] = path.read_bytes()
    for name in ['release.json', 'manifest.json', 'distribution.zip.sha256']:
        require(bodies[name] == (out / 'qualified-artifact-verified' / name).read_bytes(), 'Small original differs: ' + name)
    evidence_review = small_assets_check(binding, bodies, inspection, policy_body, require_committed_policy=True)
    record(out / 'evidence/attachment-preflight.json', evidence_review)
    descriptors = {r['name']: r for r in binding['release']['assets']}
    common = dict(outer_zip=str(out / 'qualified-artifact-original.zip'),
                  inspection=str(out / 'qualified-artifact-verified/inspection.json'),
                  inspection_sha256=pin(out / 'qualified-artifact-verified/inspection.json')['sha256'],
                  outer_sha256=binding['artifact']['sha256'], outer_bytes=binding['artifact']['bytes'],
                  source_commit=binding['source']['commit'], tag=binding['release']['tag'])
    # Fully verify BOTH held payload descriptors before either single-attempt POST.
    with contextlib.ExitStack() as stack:
        holders = []
        for module, name, cls in [(upload_source, 'source.tar', upload_source.PinnedSource),
                                  (upload_distribution, 'distribution.zip', upload_distribution.PinnedDistribution)]:
            prefix = 'source' if name == 'source.tar' else 'member'
            args = SimpleNamespace(**common, **{prefix + '_bytes': descriptors[name]['bytes'],
                                               prefix + '_sha256': descriptors[name]['sha256']})
            holder = cls(args)
            stack.callback(holder.close)
            holders.append((module, name, holder))
        for module, name, holder in holders:
            # Recheck the complete draft before each decision, including a no-POST recovery.
            current = asset_set(api, binding, SMALL_NAMES, NAMES - SMALL_NAMES)
            existing = next((asset for asset in current if asset['name'] == name), None)
            if existing is not None:
                holder.unchanged()
                record(out / 'evidence' / (name + '.upload-result.json'), {
                    'status': 'EXISTING_VERIFIED', 'repository': binding['repository'],
                    'releaseId': binding['release']['id'], 'tag': binding['release']['tag'],
                    'tagCommit': binding['source']['commit'], 'assetId': existing['id'], 'assetName': name,
                    'bytes': existing['size'], 'sha256': descriptors[name]['sha256'],
                    'serverDigest': existing['digest'], 'postCount': 0, 'readBackVerified': True})
                continue
            pending = out / 'evidence' / (name + '.upload-started.json')
            record(pending, {'status': 'IN_PROGRESS_REREAD_ASSETS_IF_INTERRUPTED', 'assetName': name,
                             'automaticRetry': False, 'requiresAssetReread': True})
            # Original helpers retain exact no-retry POST/readback behavior.
            result = module.perform(holder, DraftUploadAPI(api, binding), binding['repository'],
                                    binding['release']['id'], binding['release']['tag'])
            record(out / 'evidence' / (name + '.upload-result.json'), result)
        final_assets = asset_set(api, binding, NAMES)
        record(out / 'evidence/all-nine-assets.json', {'status': 'VERIFIED_RELEASE_ASSETS', 'assets': final_assets,
               'releaseId': binding['release']['id'], 'sourceCommit': binding['source']['commit'], 'tag': binding['release']['tag']})


def preserve_small_outputs(out):
    for name in ['qualified-artifact-original.download.json', 'qualified-artifact-verified', 'frozen-offline-review']:
        path = out / name
        if path.is_file():
            write(out / 'evidence' / name, path.read_bytes())
        elif path.is_dir():
            for source in sorted(path.rglob('*')):
                if source.is_file() and not source.is_symlink():
                    require(source.stat().st_size <= 4 * MIB, 'Unexpected large evidence output')
                    write(out / 'evidence' / name / source.relative_to(path), source.read_bytes())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['validate', 'run'])
    parser.add_argument('--mode', choices=['inspect-artifact', 'upload-originals'], required=True)
    parser.add_argument('--repository', required=True)
    parser.add_argument('--repo', type=Path)
    parser.add_argument('--out', type=Path)
    args = parser.parse_args()
    body = os.environ.get('UTILITY_BINDING', '').encode()
    binding = validate_binding(body, args.mode, args.repository)
    if args.command == 'validate':
        require(os.environ.get('GITHUB_OUTPUT'), 'Validation requires the workflow output file')
        with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
            output.write('source=' + binding['source']['commit'] + '\n')
        return
    require(args.repo and args.out and os.environ.get('GITHUB_ACTIONS') == 'true' and
            os.environ.get('GITHUB_EVENT_NAME') == 'workflow_dispatch', 'Only explicit hosted utility execution permitted')
    out = args.out.resolve()
    out.mkdir(mode=0o700)  # Exclusive: never overwrite a failed or ambiguous attempt.
    (out / 'evidence').mkdir()
    write(out / 'evidence/binding.json', body)
    api = RecordedGitHub(os.environ.get('GH_TOKEN', ''), out / 'evidence/api')
    result = {'status': 'REFUSED', 'operation': args.mode, 'source': binding['source'],
              'artifact': binding['artifact'], 'automaticRetry': False,
              'scope': 'Frozen bytes and optional draft uploads only; no public/P01 acceptance, rebuild or local test claim.'}
    try:
        before = source_identity(args.repo, binding['source'])
        record(out / 'evidence/source-before.json', before)
        helper_root = Path(__file__).resolve().parent
        workflow_sha = os.environ.get('UTILITY_WORKFLOW_SHA', '')
        require(COMMIT.fullmatch(workflow_sha) and subprocess.check_output(
                ['git', '-C', str(helper_root), 'rev-parse', 'HEAD'], text=True).strip() == workflow_sha,
                'Actual utility checkout differs from executed workflow revision')
        require(not subprocess.check_output(['git', '-C', str(helper_root), 'status', '--porcelain', '--untracked-files=no'], text=True).strip(),
                'Tracked utility checkout changed before authenticated work')
        automation_tree = subprocess.check_output(['git', '-C', str(helper_root), 'rev-parse', 'HEAD^{tree}'], text=True).strip()
        record(out / 'evidence/execution.json', {
            'workflowSha': workflow_sha, 'workflowTree': automation_tree, 'runId': os.environ.get('GITHUB_RUN_ID'),
            'runAttempt': os.environ.get('GITHUB_RUN_ATTEMPT'), 'sourceCheckout': before,
            'helpers': [pin(p) for p in sorted(helper_root.glob('*.py'))]})
        policy_body = committed_test_policy(args.repo, binding['source'])
        inspection = inspect_original(binding, args.repo, out, api, policy_body)
        if args.mode == 'upload-originals':
            upload_originals(binding, out, inspection, api, policy_body)
        artifact_authority(api, binding, policy_body)
        require(source_identity(args.repo, binding['source']) == before, 'Source identity changed')
        record(out / 'evidence/source-after.json', before)
        result['status'] = 'INSPECTED_VERIFIED' if args.mode == 'inspect-artifact' else 'ALL_NINE_VERIFIED'
    except (upload_source.Ambiguous, upload_distribution.Ambiguous) as error:
        result.update(status='UNCONFIRMED_REREAD_ASSETS', requiresAssetReread=True)
        if error.diagnostics is not None:
            result['uploadDiagnostics'] = error.diagnostics
        raise
    finally:
        api.token = ''
        preserve_small_outputs(out)
        record(out / 'evidence/result.json', result)
        records = [pin(p) for p in sorted((out / 'evidence').rglob('*')) if p.is_file()]
        record(out / 'evidence/retained-manifest.json', {'files': records, 'count': len(records),
                                                       'bytes': sum(p['bytes'] for p in records)})


if __name__ == '__main__':
    main()
