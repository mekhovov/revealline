"""Read-only, fail-closed intake of the actual Archive31 v0.64.0 appended deployment receipts."""
import hashlib
import io
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
AUTHORITY_ROOT = ROOT.parent / 'intake'
INFRA = Path(os.environ['REVEALLINE_ARCHIVE_SOURCE'])
REQUEST = ROOT / 'execution-request.reviewed.json'
BASE = 'https://mekhovov.github.io/revealline-archive-31/'
REPO = 'mekhovov/revealline-archive-31'
TREE = '8c3ca7ed1accb04afcb8a92063bb412e05ecc833'
INVENTORY_SHA = '0ffe35d0cfbeb53b200c3cd1d62749f23fb625bfb82cf3a1d84b649e9c3284db'
LOCK_SHA = 'c36f25e5a7289a0c2930f0d18841df83585d3103f7195caba263768ea17ea7d3'
PRIOR_INVENTORY_SHA = '285232581d22b530a309eae608a75cb6826bf688bd8604b179b6258f64748da6'
PRIOR_COMMIT = 'f476c311e0050b47d7408db51d57239fba7bece6'
ROLES = {'main', 'commit', 'run', 'deployment', 'statuses', 'artifacts', 'receiptZIP'}


def require(value, message):
    if not value:
        raise ValueError(message)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def local_bytes(path, limit=2 * 1024**2):
    require(not path.is_symlink() and stat.S_ISREG(path.stat().st_mode), 'Not an ordinary evidence file')
    require(path.stat().st_size <= limit, 'Evidence file exceeds bounded size')
    return path.read_bytes()


def original(pin):
    require(set(pin) == {'path', 'bytes', 'sha256'}, 'Invalid evidence descriptor')
    name = pin['path']
    require(isinstance(name, str) and name and not Path(name).is_absolute(), 'Evidence path must be relative')
    require(not re.search(r'[\\\x00-\x1f]', name) and all(p not in ['', '.', '..'] for p in name.split('/')), 'Unsafe evidence path')
    path = AUTHORITY_ROOT
    for part in name.split('/'):
        path = path / part
        require(not path.is_symlink(), 'Symlink evidence path')
    raw = local_bytes(path)
    require(type(pin['bytes']) is int and len(raw) == pin['bytes'] and sha(raw) == pin['sha256'], 'Evidence pin changed: ' + name)
    return raw


def git(*args):
    return subprocess.check_output(['git', '-C', str(INFRA), *args])


def candidate_inventory():
    raw = local_bytes(ROOT / 'inputs/expected-inventory.json')
    lock_raw = local_bytes(ROOT / 'inputs/source-lock.json')
    require(sha(raw) == INVENTORY_SHA and sha(lock_raw) == LOCK_SHA, 'Prepared input pin changed')
    value, lock = json.loads(raw), json.loads(lock_raw)
    require(set(value) == {'base', 'files'} and value['base'] == BASE, 'Wrong inventory envelope')
    rows = value['files']; current = {r['path']: r for r in rows}
    require(len(rows) == len(current) == 1420 and sum(r['bytes'] for r in rows) == 627122610, 'Wrong finite inventory')
    require([r['version'] for r in lock['releases']] == ['v0.63.0', 'v0.64.0'], 'Wrong locked cohorts')
    preservation_metadata(rows)
    return raw, rows, lock



def derive_preservation(current_rows, prior_rows):
    """Classify actual path descriptors; root support is separate from release payload."""
    current = {r['path']: r for r in current_rows}
    prior = {r['path']: r for r in prior_rows}
    require(len(current) == len(current_rows) and len(prior) == len(prior_rows), 'Duplicate inventory path')
    require(set(prior) <= set(current), 'Prior inventory path removed')
    unchanged = {p for p, row in prior.items() if current[p] == row}
    changed = sorted(set(prior) - unchanged)
    release = {p for p in unchanged if re.match(r'^releases/v\d+\.\d+\.\d+/', p)}
    support = unchanged - release
    require(support <= {'.nojekyll', 'releases/index.html'}, 'Unexpected preserved root support path')
    require(set(changed) <= {'index.html'}, 'Previously accepted payload changed')
    added = set(current) - set(prior)
    require(all(re.match(r'^releases/v\d+\.\d+\.\d+/', p) for p in added) if prior else True, 'Unexpected appended root path')
    return {
        'priorInventoryRows': len(prior), 'preservedOldCanonicalRows': len(unchanged),
        'preservedPriorReleaseRows': len(release), 'preservedRootSupportRows': len(support),
        'preservedRootSupportPaths': sorted(support), 'changedPriorPaths': changed,
        'newRows': len(added), 'newBytes': sum(current[p]['bytes'] for p in added),
    }


def preservation_metadata(rows):
    prior_raw = local_bytes(ROOT / 'inputs/prior-expected-inventory.json')
    require(sha(prior_raw) == PRIOR_INVENTORY_SHA, 'Prior inventory pin changed')
    prior = json.loads(prior_raw)
    require(set(prior) == {'base', 'files'} and prior['base'] == BASE, 'Wrong prior inventory envelope')
    value = derive_preservation(rows, prior['files'])
    require(value == {
        'priorInventoryRows': 711, 'preservedOldCanonicalRows': 710,
        'preservedPriorReleaseRows': 708, 'preservedRootSupportRows': 2,
        'preservedRootSupportPaths': ['.nojekyll', 'releases/index.html'],
        'changedPriorPaths': ['index.html'], 'newRows': 709, 'newBytes': 313564618,
    }, 'Appended cohort or preserved prior path identity differs')
    current = {r['path']: r for r in rows}; previous = {r['path']: r for r in prior['files']}
    require(current['index.html']['bytes'] - previous['index.html']['bytes'] == 79, 'Unexpected archive index delta')
    return value


def validate_tag_fetch_cohorts(workflow, lock):
    # The append failed when the lock grew but this explicit fetch list did not.
    # Compare both sides of every immutable tag refspec before public execution.
    refs = re.findall(r'refs/tags/(v\d+\.\d+\.\d+):refs/tags/(v\d+\.\d+\.\d+)', workflow)
    require(refs and all(left == right for left, right in refs), 'Mismatched immutable tag refspec')
    require({left for left, _ in refs} == {row['version'] for row in lock['releases']}, 'Workflow tag-fetch cohorts differ from source-lock')


def validate_execution_binding():
    raw, rows, lock = candidate_inventory()
    request_raw = local_bytes(REQUEST, 32768)
    request = json.loads(request_raw)
    require(set(request) == {'format', 'reviewed', 'archiveCommit', 'archiveTree', 'sourceCheckoutCommit', 'runId', 'deploymentId', 'deploymentStatusId', 'receiptArtifactId', 'pins'}, 'Unexpected execution request fields')
    require(request['format'] == 'revealline-archive31-http-request.v1' and request['reviewed'] is True, 'Actual request requires explicit review')
    for key in ['archiveCommit', 'sourceCheckoutCommit']:
        require(isinstance(request[key], str) and re.fullmatch('[a-f0-9]{40}', request[key]), 'Actual commit required: ' + key)
    require(isinstance(TREE, str) and re.fullmatch('[a-f0-9]{40}', TREE) and request['archiveTree'] == TREE, 'Unreviewed archive tree')
    require(isinstance(INFRA, Path), 'Actual held source checkout must be bound')
    for key in ['runId', 'deploymentId', 'deploymentStatusId', 'receiptArtifactId']:
        require(type(request[key]) is int and request[key] > 0, 'Actual positive identity required: ' + key)
    require(set(request['pins']) == ROLES, 'Complete original authority and receipt pins required')
    bodies = {key: original(pin) for key, pin in request['pins'].items()}
    values = {key: json.loads(body) for key, body in bodies.items() if key != 'receiptZIP'}
    commit = request['archiveCommit']; run_id = request['runId']; dep_id = request['deploymentId']
    api = 'https://api.github.com/repos/' + REPO
    require(values['main']['object']['sha'] == commit and values['main']['ref'] == 'refs/heads/main', 'Main does not name successor')
    c = values['commit']
    require(c['sha'] == commit and c['tree']['sha'] == TREE and c['url'] == api + '/git/commits/' + commit, 'Commit/tree original mismatch')
    run = values['run']
    require(run['id'] == run_id and run['head_sha'] == commit and run['head_branch'] == 'main' and run['run_attempt'] == 1 and run['status'] == 'completed' and run['conclusion'] == 'success', 'Run is not the completed successful successor')
    require(run['repository']['full_name'] == REPO and run['path'] == '.github/workflows/deploy.yml', 'Wrong run repository/workflow')
    dep = values['deployment']
    require(dep['id'] == dep_id and dep['sha'] == commit and dep['ref'] == 'main' and dep['environment'] == 'github-pages' and dep['repository_url'] == api, 'Wrong deployment')
    statuses = values['statuses']; require(isinstance(statuses, list) and statuses, 'Missing deployment statuses')
    status = max(statuses, key=lambda item: item['id'])
    require(status['id'] == request['deploymentStatusId'] and status['state'] == 'success' and status['environment_url'] == BASE and status['deployment_url'] == api + '/deployments/' + str(dep_id), 'Latest deployment status is not this successful site')
    require(status['log_url'].startswith('https://github.com/' + REPO + '/actions/runs/' + str(run_id) + '/'), 'Status is not linked to the actual run')
    matches = [a for a in values['artifacts']['artifacts'] if a['id'] == request['receiptArtifactId']]
    require(len(matches) == 1, 'Receipt artifact identity missing/duplicated')
    artifact = matches[0]; zip_raw = bodies['receiptZIP']
    require(artifact['name'] == 'archive31-verification-receipts' and artifact['expired'] is False and artifact['workflow_run']['id'] == run_id and artifact['workflow_run']['head_sha'] == commit, 'Wrong receipt artifact run')
    require(artifact['size_in_bytes'] == len(zip_raw) and artifact['digest'] == 'sha256:' + sha(zip_raw), 'Original receipt ZIP digest differs')
    require(git('rev-parse', 'HEAD').decode().strip() == request['sourceCheckoutCommit'] and git('rev-parse', 'HEAD^{tree}').decode().strip() == TREE, 'Held source checkout changed')
    require(git('show', request['sourceCheckoutCommit'] + ':expected-inventory.json') == raw and local_bytes(INFRA / 'expected-inventory.json') == raw, 'Inventory not from held exact source')
    require(git('show', request['sourceCheckoutCommit'] + ':source-lock.json') == local_bytes(ROOT / 'inputs/source-lock.json'), 'Source-lock differs from reviewed source')
    require(git('show', PRIOR_COMMIT + ':expected-inventory.json') == local_bytes(ROOT / 'inputs/prior-expected-inventory.json'), 'Accepted prior inventory Git bytes changed')
    validate_tag_fetch_cohorts(git('show', request['sourceCheckoutCommit'] + ':.github/workflows/deploy.yml').decode(), lock)
    with zipfile.ZipFile(io.BytesIO(zip_raw)) as archive:
        names = ['receipt.json', 'expected-inventory.json', 'zip-receipt-v0.63.0.json', 'zip-receipt-v0.64.0.json']
        require(sorted(archive.namelist()) == sorted(names), 'Receipt ZIP has unexpected/duplicate members')
        require(sum(i.file_size for i in archive.infolist()) <= 1024**2 and all(i.file_size <= 512*1024 for i in archive.infolist()), 'Receipt members exceed bounds')
        require(archive.testzip() is None and archive.read('expected-inventory.json') == raw, 'Hosted receipt inventory differs')
        receipt = json.loads(archive.read('receipt.json'))
        require(receipt['status'] == 'PASS' and receipt['files'] == 1420 and receipt['bytes'] == 627122610 and receipt['archiveId'] == 'archive-31' and receipt['archiveCommit'] == commit and receipt['archiveTree'] == TREE and receipt['expectedInventorySha256'] == INVENTORY_SHA and receipt['noHistoricalBuilds'] is True, 'Hosted complete-inventory receipt differs')
        require(receipt['toolingCommit'] == lock['toolingCommit'] and len(receipt['releases']) == 2, 'Hosted source cohort differs')
        for expected in lock['releases']:
            versions = [r for r in receipt['releases'] if r['version'] == expected['version']]
            require(len(versions) == 1, 'Wrong receipt edition')
            release = versions[0]; extraction = json.loads(archive.read('zip-receipt-' + expected['version'] + '.json'))
            require(release['sourceRevision'] == expected['sourceRevision'] and release['tagObject'] == expected['tagObject'] and release['originalZipExtraction'] == extraction, 'Original source/tag/extraction differs')
            require(extraction['distributionSha256'] == expected['distributionSha256'] and extraction['manifestSha256'] == expected['metadata']['manifest.json'] and extraction['gameSourceRevision'] == expected['sourceRevision'] and extraction['version'] == expected['version'] and extraction['crcAndHashesVerified'] is True, 'Original ZIP verification differs')
    return {'request': request, 'requestRaw': request_raw, 'requestSha256': sha(request_raw), 'raw': raw, 'rows': rows, 'receipt': receipt, 'evidenceBodies': bodies}
