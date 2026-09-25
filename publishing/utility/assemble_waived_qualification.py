#!/usr/bin/env python3
"""Offline, explicit-input waived qualification adapter. See ASSEMBLE-WAIVED.md.

Retained API originals are operator-supplied evidence, not authenticated signatures.
No network, release mutation, large payload extraction, or approval is performed.
"""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import zipfile

LIMIT = 64 * 1024**2
WORKFLOW = '.github/workflows/qualify-release-source.yml'
POLICY = 'publishing/test-policy.json'
GATES = [('validate', 'npm run validate', 'Validate source'),
         ('lint', 'npm run lint', 'Lint source'),
         ('format', 'npm run format:check', 'Check formatting'),
         ('native-format', 'npm run format:native:check', 'Check native formatting'),
         ('motion-syntax', 'node --check authoring/motion-lab/app.js', 'Check motion lab syntax')]


def require(value, message):
    if not value:
        raise ValueError(message)


def unique(pairs):
    value = {}
    for key, item in pairs:
        require(key not in value, 'Duplicate JSON key')
        value[key] = item
    return value


def parse(body):
    return json.loads(body, object_pairs_hook=unique)


def encoded(value):
    return (json.dumps(value, indent=2, sort_keys=True) + '\n').encode()


def sha(body):
    return hashlib.sha256(body).hexdigest()


def pin(name, body):
    return {'path': name, 'bytes': len(body), 'sha256': sha(body)}


def safe(name):
    require(isinstance(name, str) and name and not name.startswith('/') and '\\' not in name and
            all(p not in ('', '.', '..') for p in name.split('/')), 'Unsafe evidence path')
    return name


def read(path, limit=LIMIT):
    path = Path(path)
    require(not any(p.is_symlink() for p in [path, *path.parents]), 'Symlink input refused')
    before = path.lstat()
    require(stat.S_ISREG(before.st_mode) and before.st_size <= limit, 'Ordinary bounded file required')
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, 'rb') as stream:
        opened = os.fstat(stream.fileno())
        body = stream.read(limit + 1)
        after = os.fstat(stream.fileno())
    identity = lambda s: (s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns)
    require(identity(before) == identity(opened) == identity(after) and len(body) == before.st_size,
            'Input changed or exceeded bound')
    return body


def below(root):
    root = Path(root)
    require(root.is_dir() and not root.is_symlink(), 'Ordinary evidence directory required')
    result = {}
    total = 0
    for path in sorted(root.rglob('*')):
        require(not path.is_symlink(), 'Symlink evidence refused')
        if path.is_dir():
            continue
        body = read(path, LIMIT - total)
        total += len(body)
        result[safe(path.relative_to(root).as_posix())] = body
        require(len(result) <= 2000 and total <= LIMIT, 'Evidence inventory bound')
    return result


def git(repo, *args):
    result = subprocess.run(['git', '-C', str(repo), *args], check=True, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, timeout=30)
    require(len(result.stdout) <= LIMIT, 'Git evidence bound')
    return result.stdout


def blob(repo, commit, name):
    safe(name)
    object_name = commit + ':' + name
    size = int(git(repo, 'cat-file', '-s', object_name))
    require(0 <= size <= 4 * 1024**2, 'Source helper bound')
    return git(repo, 'show', object_name)


def step(job, name):
    rows = [s for s in job.get('steps', []) if s.get('name') == name]
    require(len(rows) == 1 and rows[0].get('status') == 'completed' and
            rows[0].get('conclusion') == 'success', 'Required successful step missing: ' + name)
    row = rows[0]
    require(type(row.get('number')) is int and row['number'] > 0, 'Step number missing')
    return {k: row[k] for k in ('name', 'number', 'status', 'conclusion')}


def family(run, jobs, workflow, event, commit):
    require(run.get('status') == 'completed' and run.get('conclusion') == 'success' and
            run.get('path') == workflow and run.get('event') == event and run.get('head_sha') == commit and
            type(run.get('id')) is int and run['id'] > 0, 'Run identity/result differs')
    rows = jobs.get('jobs', [])
    require(type(jobs.get('total_count')) is int and jobs['total_count'] == len(rows) and
            0 < len(rows) <= 1000 and len({j['id'] for j in rows}) == len(rows), 'Incomplete jobs inventory')
    for job in rows:
        require(type(job.get('id')) is int and job['id'] > 0 and job.get('run_id') == run['id'] and
                job.get('head_sha') == commit and job.get('status') == 'completed' and
                job.get('conclusion') in ('success', 'skipped'), 'Job identity/result differs')
    return rows


def named(rows, name):
    selected = [j for j in rows if j.get('name') == name]
    require(len(selected) == 1 and selected[0]['conclusion'] == 'success', 'Successful job missing: ' + name)
    return selected[0]


def inspect(config, evidence, repo, source, manual):
    originals = below(config['inspectionDirectory'])
    get = lambda name: parse(originals[name])
    rows = get('retained-manifest.json')['files']
    retained = []
    for row in rows:
        require(row['path'].count('/utility-output/evidence/') == 1, 'Retained root differs')
        name = safe(row['path'].split('/utility-output/evidence/')[1])
        require(row['bytes'] == len(originals[name]) and row['sha256'] == sha(originals[name]), 'Retained pin differs')
        retained.append(name)
    require(len(set(retained)) == len(retained) and set(originals) == set(retained) | {'retained-manifest.json'},
            'Inspection closure missing/extra originals')
    binding = get('binding.json')
    require(binding['source'] == source and binding['repository'] == config['repository'] and
            binding['reviewed'] is True and binding['release'] is None, 'Inspection binding differs')
    artifact = binding['artifact']
    require(artifact['runId'] == manual['id'], 'Frozen run differs')
    result = get('result.json')
    require(result['status'] == 'INSPECTED_VERIFIED' and result['operation'] == 'inspect-artifact' and
            result['source'] == source and result['artifact'] == artifact, 'Inspection result differs')
    verify = get('qualified-artifact-verified/inspection.json')
    require(verify['status'] == 'PASS' and verify['gitHead'] == source['commit'] and
            verify['gitTree'] == source['tree'] and verify['version'] == source['version'] and
            verify['releaseHashChainVerified'] is True, 'Frozen identity/chain differs')
    require(all(verify['artifact'][k] == artifact[k] for k in ('bytes', 'sha256')) and
            verify['artifact']['externallyExpectedDigestSupplied'] is True, 'Outer artifact pin differs')
    require(verify['sourceTar']['paxCommitPresent'] is True and verify['sourceTar']['copiedToDisk'] is False and
            verify['sourceTar']['outerMember'] == source['version'] + '/source.tar', 'Source TAR proof differs')
    require(verify['distribution']['allManifestBytesVerified'] is True and
            verify['distribution']['innerManifestIdentical'] is True and verify['distribution']['copiedToDisk'] is False and
            verify['distribution']['outerMember'] == source['version'] + '/site/distribution.zip', 'ZIP proof differs')
    require(verify['manifestSha256'] == sha(originals['qualified-artifact-verified/manifest.json']), 'Manifest pin differs')
    offline = get('frozen-offline-review/review.json')
    require(offline['status'] == 'PASS' and offline['sourceRevision'] == source['commit'] and
            offline['sourceTree'] == source['tree'] and offline['version'] == source['version'], 'Offline identity differs')
    for key in ('allOfflineRowsMatchFrozenManifest', 'allOfflineBytesVerified', 'offlineBudgetVerified',
                'workerInventoryBindingVerified', 'entryMetaBindingVerified', 'entryIncluded'):
        require(offline['offline'].get(key) is True, 'Offline proof incomplete')
    require(0 < offline['offline']['files'] <= 2000 and 0 < offline['offline']['bytes'] <= LIMIT, 'Offline bound')
    for key, name in [('inspectionPin', 'qualified-artifact-verified/inspection.json'),
                      ('manifestPin', 'qualified-artifact-verified/manifest.json')]:
        require(offline[key]['bytes'] == len(originals[name]) and offline[key]['sha256'] == sha(originals[name]),
                'Offline prerequisite differs')
    for row in offline['originals']:
        body = originals['frozen-offline-review/originals/' + safe(row['archivePath'])]
        require(row['bytes'] == len(body) and row['sha256'] == sha(body), 'Offline original differs')
    for name in ('source-before.json', 'source-after.json'):
        identity = get(name)
        require(identity['sourceRevision'] == source['commit'] and identity['sourceTree'] == source['tree'] and
                identity['trackedCheckoutClean'] is True, 'Inspection source changed')
    run = parse(evidence['runs/inspection/run.json'])
    jobs = parse(evidence['runs/inspection/jobs.json'])
    execution = get('execution.json')
    named(family(run, jobs, WORKFLOW, 'workflow_dispatch', execution['workflowSha']), 'inspect-artifact')
    require(str(run['id']) == execution['runId'] and execution['sourceCheckout'] == get('source-before.json'),
            'Inspection execution differs')
    require(execution['helpers'], 'Inspection helper identities missing')
    for row in execution['helpers']:
        require('/automation/' in row['path'], 'Helper path differs')
        name = safe(row['path'].split('/automation/', 1)[1])
        body = blob(repo, execution['workflowSha'], name)
        require(row['bytes'] == len(body) and row['sha256'] == sha(body), 'Inspection helper differs')
        evidence['inspection-authorities/' + name] = body
    authority = [get(n) for n in originals if n.startswith('api/') and n.endswith('.json') and
                 not n.endswith('.request.json')]
    authority = [a for a in authority if isinstance(a, dict) and a.get('id') == artifact['id'] and
                 a.get('name') == 'qualified-release-snapshot']
    require(authority, 'Artifact API original missing')
    for row in authority:
        require(row['expired'] is False and row['size_in_bytes'] == artifact['bytes'] and
                row['digest'] == 'sha256:' + artifact['sha256'] and row['workflow_run']['id'] == manual['id'] and
                row['workflow_run']['head_sha'] == source['commit'], 'Artifact API binding differs')
    evidence.update({'inspection/' + n: b for n, b in originals.items()})
    return originals, verify, artifact, run


def exact_consumer(repo, source, context, small, verify, policy, parent):
    """Execute only the reviewed commit's consumer, never the mutable checkout copy."""
    listing = git(repo, 'ls-tree', '-r', '--name-only', source['commit'], '--', 'publishing/utility').decode().splitlines()
    helpers = {}
    for name in listing:
        if name.endswith('.py') and not Path(name).name.startswith('test_'):
            body = blob(repo, source['commit'], name)
            require(len(helpers) < 2000 and sum(map(len, helpers.values())) + len(body) <= LIMIT,
                    'Exact-source helper inventory bound')
            helpers[name] = body
    require('publishing/utility/release_artifact.py' in helpers and sum(map(len, helpers.values())) <= LIMIT,
            'Exact-source consumer unavailable/bounded')
    with tempfile.TemporaryDirectory(prefix='waiver-consumer-', dir=parent) as temporary:
        root = Path(temporary)
        for name, body in helpers.items():
            path = root / safe(name)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(body)
        (root / 'input.json').write_bytes(encoded({'context': context, 'inspection': verify}))
        (root / 'policy.json').write_bytes(policy)
        (root / 'small').mkdir()
        for name, body in small.items():
            (root / 'small' / name).write_bytes(body)
        command = ('import json,pathlib,release_artifact as r; p=pathlib.Path(__import__("sys").argv[1]); '
                   'v=json.loads((p/"input.json").read_bytes()); '
                   'b={x.name:x.read_bytes() for x in (p/"small").iterdir()}; '
                   'print(json.dumps(r.small_assets_check(v["context"],b,v["inspection"],'
                   '(p/"policy.json").read_bytes(),require_committed_policy=True)))')
        result = subprocess.run([sys.executable, '-B', '-c', command, str(root)],
                                cwd=root / 'publishing/utility', env={**os.environ, 'PYTHONPATH': '',
                                'PYTHONDONTWRITEBYTECODE': '1'}, capture_output=True, check=True, timeout=60)
        return parse(result.stdout)


def assemble(config, output):
    require(config.get('format') == 'revealline-waived-qualification-inputs.v1' and config.get('reviewed') is True and
            config.get('repository') == 'mekhovov/revealline', 'Reviewed explicit inputs required')
    output = Path(output).absolute()
    receipt = output.with_name(output.name + '-review.json')
    require(not output.exists() and not receipt.exists() and output.parent.is_dir() and
            not any(p.is_symlink() for p in [output, receipt, *output.parents]), 'Fresh ordinary output required')
    require(shutil.disk_usage(output.parent).free >= 1024**3 + 3 * LIMIT, 'One GiB reserve required')
    source, pr_source, repo = config['source'], config['prSource'], config['repositoryPath']
    require(type(config.get('sourcePR')) is int and config['sourcePR'] > 0, 'Positive source PR required')
    for identity in (source, pr_source):
        require(all(re.fullmatch('[0-9a-f]{40}', identity[k]) for k in ('commit', 'tree')), 'Full immutable IDs required')
        require(git(repo, 'rev-parse', identity['commit'] + '^{tree}').decode().strip() == identity['tree'], 'Git tree differs')
    require(re.fullmatch(r'v\d+\.\d+\.\d+', source['version']), 'Version required')
    for name in ('package.json', 'package-lock.json'):
        require(parse(blob(repo, source['commit'], name))['version'] == source['version'][1:], 'Version alignment differs')
    policy_body = blob(repo, source['commit'], POLICY)
    policy = parse(policy_body)
    require(policy.get('mode') == 'waived', 'Exact-source policy must explicitly waive tests')
    names = git(repo, 'diff', '--no-renames', '--name-only', '-z', pr_source['commit'], source['commit']).decode().split('\0')[:-1]
    allowed = config.get('approvedNonSourceChanges', [])
    require(allowed == sorted(set(allowed)) and sorted(names) == allowed and
            all(safe(n).startswith(('docs/', 'publishing/pages-controller/')) for n in allowed),
            'Unapproved PR/source difference')
    difference = git(repo, 'diff', '--no-ext-diff', '--no-renames', '--binary', pr_source['commit'], source['commit'])
    evidence = {POLICY: policy_body, 'preparation/inputs.json': encoded(config),
                'preparation/source-equivalence.json': encoded({'prSource': pr_source, 'frozenSource': source,
                    'approvedNonSourceChanges': allowed, 'allOtherTrackedContentsTypesModesIdentical': True,
                    'rawDiff': {'bytes': len(difference), 'sha256': sha(difference), 'retained': bool(difference)},
                    'scope': 'PR build corroboration only; not reuse of a predecessor source verdict.'})}
    if difference:
        evidence['preparation/pr-to-source.diff'] = difference
    for role in ('pr', 'manual', 'inspection'):
        for kind in ('run', 'jobs'):
            evidence[f'runs/{role}/{kind}.json'] = read(config[role][kind], 4 * 1024**2)
    pr_run, manual = [parse(evidence[f'runs/{r}/run.json']) for r in ('pr', 'manual')]
    require(pr_run['id'] != manual['id'], 'Separate PR/manual runs required')
    pr_jobs = family(pr_run, parse(evidence['runs/pr/jobs.json']), '.github/workflows/deploy-pages.yml',
                     'pull_request', pr_source['commit'])
    manual_jobs = family(manual, parse(evidence['runs/manual/jobs.json']), WORKFLOW, 'workflow_dispatch', source['commit'])
    qualify, freeze, build = named(manual_jobs, 'qualify'), named(manual_jobs, 'freeze'), named(pr_jobs, 'build')
    named(pr_jobs, 'preflight')
    step(qualify, 'Record source identity')
    step(qualify, 'Require reviewed production slots in the committed ledger')
    step(qualify, 'Verify qualified tracked source is unchanged')
    step(freeze, 'Freeze the exact qualified commit')
    step(freeze, 'Retain original release assets')
    step(build, 'Verify exact tracked source before commands')
    step(build, 'Verify tracked source after fast release gate')
    originals, verify, artifact, inspection_run = inspect(config, evidence, repo, source, manual)
    for row in config.get('extraEvidence', []):
        name = safe(row['name'])
        require(name not in evidence, 'Duplicate evidence')
        evidence[name] = read(row['path'], max(0, LIMIT - sum(map(len, evidence.values()))))
    require(len(evidence) <= 2000 and all(evidence.values()) and
            sum(map(len, evidence.values())) <= LIMIT, 'Evidence bound exceeded or empty evidence original')
    small = {n: originals['qualified-artifact-verified/' + n] for n in
             ('manifest.json', 'release.json', 'distribution.zip.sha256')}
    small['verification.json'] = originals['qualified-artifact-verified/inspection.json']
    qualification = {'format': 'revealline-source-qualification.v2', 'status': 'qualified-with-test-waiver',
        'releaseEligible': True, 'version': source['version'], 'sourceRevision': source['commit'],
        'sourceTree': source['tree'], 'actualCheckoutCommit': source['commit'], 'actualCheckoutTree': source['tree'],
        'allTrackedSourceContentsAndModesMatch': True, 'sourcePR': config['sourcePR'],
        'qualifiedAt': manual.get('updated_at'), 'runId': manual['id'], 'workflowPath': WORKFLOW,
        'tests': {'status': 'waived', 'counts': None},
        'gates': [{'gate': g, 'command': c, 'jobId': qualify['id'], 'step': step(qualify, n)} for g, c, n in GATES],
        'testPolicy': {**{k: policy[k] for k in ('mode', 'authorization', 'reason')}, 'policyEvidence': pin(POLICY, policy_body)},
        'waiverEvidence': {'runId': manual['id'], 'runEvidence': pin('runs/manual/run.json', evidence['runs/manual/run.json']),
                          'jobsEvidence': pin('runs/manual/jobs.json', evidence['runs/manual/jobs.json'])},
        'preMergeValidationCorroboration': {'runId': pr_run['id'], 'jobId': build['id'],
            'command': 'npm run validate', 'step': step(build, 'Validate release-critical source'),
            'sourceRevision': pr_source['commit'], 'sourceTree': pr_source['tree'],
            'artifactBuild': {'status': 'deferred-to-frozen-source',
                'step': step(build, 'Defer full artifact build to merged-source qualification')},
            'scope': 'Exact PR source validation only; the complete artifact is built once from frozen merged source.'},
        'frozenArtifactCorroboration': {'artifactId': artifact['id'], 'runId': artifact['runId'],
            'inspectionRunId': inspection_run['id'], 'wholeOriginalArtifactVerifiedBeforeQualification': True,
            'sourceTarGitBlobTypeModeAndPaxCommitVerified': True, 'allInnerZipManifestBytesVerified': True,
            'frozenOfflineInventoryAndBindingsVerified': True,
            'inputs': {k: pin(n, small[n]) for k, n in [('inspection', 'verification.json'), ('manifest', 'manifest.json'),
                ('releaseRecord', 'release.json'), ('checksum', 'distribution.zip.sha256')]}},
        'evidencePins': [pin(n, b) for n, b in sorted(evidence.items())],
        'limits': ['Automated test suites were waived, not passed. No test totals are asserted.',
                   'Retained API originals are operator-provided evidence, not cryptographic authentication.',
                   'Public deployment, browser acceptance, and release permission are not established.']}
    small['source-qualification.json'] = encoded(qualification)
    manifest = encoded({'format': 'revealline-release-evidence.v1', 'version': source['version'],
                        'sourceRevision': source['commit'], 'sourceTree': source['tree'],
                        'files': qualification['evidencePins']})
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for name, body in sorted({**evidence, 'evidence-manifest.json': manifest}.items()):
            info = zipfile.ZipInfo(safe(name), (2026, 9, 22, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, body)
    small['source-qualification-evidence.zip'] = buffer.getvalue()
    asset = lambda n, b: {'name': n, 'bytes': len(b), 'sha256': sha(b)}
    large = [{'name': n, 'bytes': verify[r]['bytes'], 'sha256': verify[r]['sha256'],
              'originalMember': verify[r]['outerMember'], 'copiedToDisk': False}
             for n, r in [('source.tar', 'sourceTar'), ('distribution.zip', 'distribution')]]
    small['qualification-evidence-record.json'] = encoded({'format': 'revealline-qualification-evidence-record.v1',
        'sourceRevision': source['commit'], 'sourceTree': source['tree'], 'version': source['version'],
        'sourceQualified': True, 'originalFrozenPayloadVerified': True, 'sourceGateCounts': None, 'testStatus': 'waived',
        'attachments': large + [asset(n, b) for n, b in sorted(small.items())],
        'frozenArtifact': {**artifact, 'externallyExpectedDigestSupplied': True}})
    descriptors = large + [asset(n, b) for n, b in sorted(small.items())]
    require(len(small) == 7 and len(descriptors) == 9, 'Attachment inventory differs')
    context = {'source': source, 'artifact': artifact, 'release': {'assets': descriptors}}
    checked = exact_consumer(repo, source, context, small, verify, policy_body, output.parent)
    require(shutil.disk_usage(output.parent).free >= 1024**3 + sum(map(len, small.values())), 'One GiB reserve required')
    output.mkdir()
    for name, body in sorted(small.items()):
        with (output / name).open('xb') as stream:
            stream.write(body)
    report = {'status': 'OFFLINE_CONSUMER_VERIFIED_SMALL_PACKAGE', 'source': source, 'tests': qualification['tests'],
        'artifacts': descriptors, 'consumer': checked, 'releaseAuthority': None, 'remoteWrites': False,
        'scope': 'Offline metadata only; independent review and owner publication authority still required.'}
    with receipt.open('xb') as stream:
        stream.write(encoded(report))
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('inputs')
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    print(encoded(assemble(parse(read(args.inputs, 4 * 1024**2)), args.output)).decode())
