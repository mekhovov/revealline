"""Offline admission of the exact future v0.97.0 main Pages receipt inventory."""
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
INFRA = ROOT / 'repository'
REQUEST = ROOT / 'execution-request.reviewed.json'
BASE = 'https://mekhovov.github.io/revealline/'
REPO = 'mekhovov/revealline'
VERSION = 'v0.97.0'
SOURCE = '1518e15e248b59c6470cc6931023eaf6f1ac363c'
TREE = 'c618b5d01fd0742a5dfc8c55c9d851d1d21d58e8'
ZIP_SHA = '1b87a11577263b909b8ce06024938c4b67c459ea645abe5d7cd0ace6d6ad1dda'
METADATA = {'release.json': (465, '04496b2fb369194f4d34a9d089a458a61c3e5c85896b88354ea05c23c8be7c84'), 'manifest.json': (203316, 'c24422d298192f6de4d79d01188790c7d1d603a6737d6673e7efc4ba8685bad4'), 'distribution.zip.sha256': (83, 'bc40d573a83049dba50f2794aec6a73ac52cc2244122a1031c7c93382ddbf62d')}
ROLES = {'main', 'commit', 'run', 'jobs', 'deployment', 'statuses', 'artifacts', 'receiptZIP', 'publication', 'catalog'}
MAX_TOTAL = 950_000_000
MAX_FILE = 100_000_000
MAX_FILES = 20_000
MAX_ZIP = 8 * 1024**2
MAX_JSON = 8 * 1024**2


def require(value, message):
    if not value:
        raise ValueError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def encoded(value):
    return (json.dumps(value, indent=2) + '\n').encode()


def safe_path(name):
    require(isinstance(name, str) and 0 < len(name) <= 1024 and
            not PurePosixPath(name).is_absolute() and
            not re.search(r'[\\\x00-\x1f\x7f:%?#]', name) and
            all(p not in ('', '.', '..') for p in name.split('/')), 'Unsafe relative path')
    return name


def bounded(path, limit=MAX_JSON):
    path = Path(path).absolute()
    for ancestor in (path, *path.parents):
        require(not ancestor.is_symlink(), 'Symlink input ancestry refused')
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_size <= limit, 'Input must be bounded regular file')
    flags = os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0) | getattr(os, 'O_NONBLOCK', 0)
    fd = os.open(path, flags)
    with os.fdopen(fd, 'rb') as stream:
        opened = os.fstat(stream.fileno())
        require(stat.S_ISREG(opened.st_mode) and opened.st_size <= limit and
                (opened.st_dev, opened.st_ino) == (info.st_dev, info.st_ino), 'Input changed before read')
        data = stream.read(limit + 1)
    require(len(data) == info.st_size and len(data) <= limit, 'Input size changed during read')
    return data


def git(*args):
    return subprocess.check_output(['git', '-C', str(INFRA), *args], timeout=30, env={**os.environ, 'GIT_NO_LAZY_FETCH': '1'})


def pinned_metadata():
    bodies = {}
    for name, (size, digest) in METADATA.items():
        raw = bounded(ROOT / 'inputs' / name)
        require(len(raw) == size and sha(raw) == digest, 'Original release metadata changed: ' + name)
        bodies[name] = raw
    record = json.loads(bodies['release.json'])
    manifest = json.loads(bodies['manifest.json'])
    require(record['version'] == manifest['version'] == VERSION and
            record['sourceRevision'] == manifest['sourceRevision'] == SOURCE and
            record['manifestSha256'] == METADATA['manifest.json'][1] and
            record['distributionSha256'] == ZIP_SHA and
            bodies['distribution.zip.sha256'].decode().split()[0] == ZIP_SHA, 'Frozen metadata chain differs')
    return bodies, record, manifest


def original(pin, role):
    require(set(pin) == {'path', 'bytes', 'sha256'}, 'Exact authority descriptor required')
    name = safe_path(pin['path'])
    require(name.startswith('authority/'), 'Authority must be retained beneath authority/')
    raw = bounded(ROOT / name, MAX_ZIP if role == 'receiptZIP' else MAX_JSON)
    require(type(pin['bytes']) is int and len(raw) == pin['bytes'] and sha(raw) == pin['sha256'], 'Authority byte pin differs: ' + role)
    return raw


def receipt_inventory(receipt, extraction, request, metadata):
    require(receipt.get('format') == 'revealline-metadata-pages-artifact.v1' and
            receipt.get('currentVersion') == VERSION and receipt.get('gameSourceRevision') == SOURCE and
            receipt.get('qualifiedSourceTree') == TREE and receipt.get('publishable') is True and
            receipt.get('browserAdmissionsRequired') is True and
            receipt.get('currentGraphLayout') == 'single-canonical-with-root-metadata-v1', 'Wrong/unpublishable main artifact receipt')
    require(receipt.get('controllerCommit') == request['controllerCommit'] and
            receipt.get('controllerTree') == request['controllerTree'], 'Receipt belongs to another controller')
    require(extraction.get('distributionSha256') == ZIP_SHA and
            extraction.get('manifestSha256') == METADATA['manifest.json'][1] and
            extraction.get('version') == VERSION and extraction.get('gameSourceRevision') == SOURCE and
            extraction.get('crcAndHashesVerified') is True, 'Original ZIP extraction receipt differs')
    rows = receipt.get('files')
    require(isinstance(rows, list) and 0 < len(rows) <= MAX_FILES, 'Missing/oversize full artifact inventory')
    by_path = {}
    for row in rows:
        require(isinstance(row, dict) and set(row) == {'path', 'bytes', 'sha256'}, 'Exact artifact file descriptor required')
        name = safe_path(row['path'])
        require(name not in by_path and type(row['bytes']) is int and 0 <= row['bytes'] <= MAX_FILE and
                isinstance(row['sha256'], str) and re.fullmatch('[a-f0-9]{64}', row['sha256']), 'Invalid/duplicate artifact row')
        by_path[name] = row
    total = sum(r['bytes'] for r in rows)
    require(0 < total <= MAX_TOTAL and receipt.get('totalBytes') == total and receipt.get('budgetBytes') == MAX_TOTAL, 'Artifact total/budget differs')
    essential = {'.nojekyll', 'index.html', 'release.json', 'manifest.json', 'archive-routing.json',
                 'current-entry-routing.json', 'releases/index.html', f'releases/{VERSION}/site/game/index.html'}
    require(essential <= by_path.keys(), 'Inventory is missing aliases/canonical/routing files')
    bodies, _, manifest = metadata
    originals = [(f'releases/{VERSION}/site/' + row['path'], row['bytes'], row['sha256']) for row in manifest['files']]
    originals += [(f'releases/{VERSION}/site/{name}', len(bodies[name]), sha(bodies[name])) for name in ('manifest.json', 'distribution.zip.sha256')]
    originals.append((f'releases/{VERSION}/release.json', len(bodies['release.json']), sha(bodies['release.json'])))
    for name, size, digest in originals:
        require(by_path.get(name) == {'path': name, 'bytes': size, 'sha256': digest}, 'Original canonical member missing/changed: ' + name)
    raw = encoded({'base': BASE, 'files': rows})
    require(request['inventory'] == {'files': len(rows), 'bytes': total, 'sha256': sha(raw)}, 'Reviewed finite inventory differs')
    return raw, rows


def validate_execution_binding():
    metadata = pinned_metadata()
    request_raw = bounded(REQUEST, 65536)
    req = json.loads(request_raw)
    require(set(req) == {'format', 'reviewed', 'controllerCommit', 'controllerTree', 'runId', 'deploymentId',
                         'deploymentStatusId', 'receiptArtifactId', 'inventory', 'pins'}, 'Unexpected execution request fields')
    require(req['format'] == 'revealline-main-v097-http-request.v1' and req['reviewed'] is True, 'Actual reviewed request required')
    for key in ('controllerCommit', 'controllerTree'):
        require(isinstance(req[key], str) and re.fullmatch('[a-f0-9]{40}', req[key]), 'Actual controller identity required')
    for key in ('runId', 'deploymentId', 'deploymentStatusId', 'receiptArtifactId'):
        require(type(req[key]) is int and req[key] > 0, 'Actual positive identity required: ' + key)
    require(set(req['pins']) == ROLES, 'Complete raw authority roles required')
    bodies = {role: original(pin, role) for role, pin in req['pins'].items()}
    v = {role: json.loads(raw) for role, raw in bodies.items() if role != 'receiptZIP'}
    api = 'https://api.github.com/repos/' + REPO
    commit, tree, run_id = req['controllerCommit'], req['controllerTree'], req['runId']
    require(v['main']['ref'] == 'refs/heads/main' and v['main']['object']['sha'] == commit, 'Main no longer names admitted controller')
    require(v['commit']['sha'] == commit and v['commit']['tree']['sha'] == tree and
            v['commit']['url'] == api + '/git/commits/' + commit, 'Controller commit/tree authority differs')
    run = v['run']
    require(run['id'] == run_id and run['head_sha'] == commit and run['head_branch'] == 'main' and
            run['event'] in ('push', 'workflow_dispatch') and run['status'] == 'completed' and run['conclusion'] == 'success' and
            run['repository']['full_name'] == REPO and run['path'] == '.github/workflows/publish-frozen-pages.yml' and
            run['name'] == 'Publish selected frozen game', 'Wrong/incomplete main publication run')
    jobs = v['jobs']['jobs']
    require(v['jobs']['total_count'] == len(jobs) == 2 and {j['name'] for j in jobs} == {'assemble', 'deploy'}, 'Complete publication job inventory required')
    for job in jobs:
        require(job['run_id'] == run_id and job['head_sha'] == commit and job['status'] == 'completed' and job['conclusion'] == 'success', 'Publication job did not succeed')
        names = (['Independently reread every prepared artifact byte', 'Upload verified Pages artifact'] if job['name'] == 'assemble'
                 else ['Recheck latest stable selection after any deployment wait', 'Deploy verified frozen edition to GitHub Pages'])
        for name in names:
            steps = [s for s in job['steps'] if s['name'] == name]
            require(len(steps) == 1 and steps[0]['status'] == 'completed' and steps[0]['conclusion'] == 'success', 'Required publication step did not succeed: ' + name)
    dep = v['deployment']
    require(dep['id'] == req['deploymentId'] and dep['sha'] == commit and dep['ref'] == 'main' and
            dep['environment'] == 'github-pages' and dep['repository_url'] == api, 'Wrong Pages deployment')
    require(isinstance(v['statuses'], list) and v['statuses'], 'Missing deployment statuses')
    status = max(v['statuses'], key=lambda s: s['id'])
    require(status['id'] == req['deploymentStatusId'] and status['state'] == 'success' and
            status['environment_url'] == BASE and status['deployment_url'] == api + '/deployments/' + str(dep['id']) and
            status['log_url'].startswith('https://github.com/' + REPO + '/actions/runs/' + str(run_id) + '/'), 'Latest deployment status/run differs')
    matches = [a for a in v['artifacts']['artifacts'] if a['id'] == req['receiptArtifactId']]
    require(len(matches) == 1, 'Receipt artifact missing/duplicated')
    artifact = matches[0]
    require(artifact['name'] == 'frozen-pages-receipts' and artifact['expired'] is False and
            artifact['workflow_run']['id'] == run_id and artifact['workflow_run']['head_sha'] == commit and
            artifact['size_in_bytes'] == len(bodies['receiptZIP']) and artifact['digest'] == 'sha256:' + sha(bodies['receiptZIP']), 'Receipt ZIP is not the exact admitted artifact')
    require(git('rev-parse', commit + '^{tree}').decode().strip() == tree and
            git('rev-parse', SOURCE + '^{tree}').decode().strip() == TREE, 'Retained Git objects differ from controller/source trees')
    for role, path in [('publication', 'publishing/pages-controller/publication.json'), ('catalog', 'publishing/pages-controller/catalog.json')]:
        require(git('show', commit + ':' + path) == bodies[role], 'Controller input is not exact committed bytes: ' + role)
    with zipfile.ZipFile(io.BytesIO(bodies['receiptZIP'])) as z:
        require(sorted(z.namelist()) == ['artifact-receipt.json', 'zip-receipt.json'], 'Unexpected/duplicate receipt ZIP members')
        for item in z.infolist():
            mode = item.external_attr >> 16
            require(not item.is_dir() and stat.S_IFMT(mode) in (0, stat.S_IFREG) and item.file_size <= MAX_JSON and
                    item.compress_type in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED) and not item.flag_bits & 1, 'Unsafe receipt ZIP member')
        require(sum(i.file_size for i in z.infolist()) <= MAX_JSON and z.testzip() is None, 'Receipt ZIP budget/CRC failure')
        receipt = json.loads(z.read('artifact-receipt.json'))
        extraction = json.loads(z.read('zip-receipt.json'))
    require(receipt['catalogSha256'] == sha(bodies['catalog']) and receipt['configurationSha256'] == sha(bodies['publication']), 'Hosted controller input pins differ')
    require(v['publication']['currentVersion'] == VERSION and v['publication']['deploymentEnabled'] is True and
            v['publication']['catalogSha256'] == sha(bodies['catalog']), 'Controller does not select this stable release')
    raw, rows = receipt_inventory(receipt, extraction, req, metadata)
    return {'request': req, 'requestRaw': request_raw, 'requestSha256': sha(request_raw), 'raw': raw,
            'rows': rows, 'receipt': receipt, 'evidenceBodies': bodies}
