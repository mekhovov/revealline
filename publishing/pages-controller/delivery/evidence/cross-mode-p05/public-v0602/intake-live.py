"""Prepare an UNREVIEWED audit binding from explicitly reviewed actual originals."""
from pathlib import Path
import argparse
import base64
import concurrent.futures
import hashlib
import json
import stat
import subprocess
import zipfile

from wrapper_contract import (SOURCE, TREE, VERSION, BASE, api, encode, identity,
                              observation, positive, published, read_request, require, sha, stamp)

KEYS = {'currentVersion', 'gameSourceRevision', 'qualifiedSourceTree', 'controllerCommit',
        'controllerTree', 'runId', 'deploymentId', 'latestSuccessStatusId', 'receiptArtifact',
        'hostedObservation', 'publishedRelease'}


def intake(home, request_path, request_sha, runner=subprocess.run):
    request, request_body = read_request(home, request_path, request_sha,
                                        'revealline-public-intake-request.v1', KEYS)
    identity(request)
    models = observation(home, request['hostedObservation'], request, request['latestSuccessStatusId'])
    release, assets, release_body = published(home, request['publishedRelease'])
    descriptor = request['receiptArtifact']
    require(set(descriptor) == {'id', 'bytes', 'sha256'} and positive(descriptor['id']) and
            positive(descriptor['bytes']) and descriptor['bytes'] < 10_485_760,
            'Explicit bounded original receipt artifact required')
    matches = [item for item in models['artifacts']['artifacts'] if item['id'] == descriptor['id']]
    require(len(matches) == 1, 'Actual receipt artifact is absent or duplicated')
    artifact = matches[0]
    require(artifact['name'] == 'frozen-pages-receipts' and artifact['expired'] is False and
            artifact['size_in_bytes'] == descriptor['bytes'] and
            artifact['digest'] == 'sha256:' + descriptor['sha256'] and
            artifact['workflow_run']['id'] == request['runId'] and
            artifact['workflow_run']['head_sha'] == request['controllerCommit'],
            'Actual receipt artifact pin/run differs')
    output = home / ('receipt-intake-' + request['outputLabel'])
    destination = home / 'tools/inputs' / request['controllerCommit']
    require(not destination.exists() and not destination.is_symlink(), 'Binding destination already exists')
    output.mkdir()  # Exclusive attempt; failed originals are never overwritten.
    (output / 'request.original.json').write_bytes(request_body)
    (output / 'published-release.original.json').write_bytes(release_body)
    command = ['gh', 'api', f"repos/mekhovov/revealline/actions/artifacts/{artifact['id']}/zip"]
    timed_out = False
    with (output / 'original.zip').open('xb') as stream, (output / 'download.stderr').open('xb') as error:
        try:
            code = runner(command, stdout=stream, stderr=error, timeout=60).returncode
        except subprocess.TimeoutExpired:
            timed_out, code = True, None
    (output / 'download-exit.json').write_bytes(encode({'at': stamp(), 'command': command,
                                                      'exitCode': code, 'timedOut': timed_out}))
    require(not timed_out and code == 0, 'Receipt download failure retained')
    raw = (output / 'original.zip').read_bytes()
    require(len(raw) == descriptor['bytes'] < 10_485_760 and sha(raw) == descriptor['sha256'],
            'Original receipt ZIP digest or compressed size differs')
    with zipfile.ZipFile(output / 'original.zip') as archive:
        names, total = set(), 0
        for item in archive.infolist():
            require(item.filename and not item.is_dir() and item.filename not in names and
                    '/' not in item.filename and '\\' not in item.filename and
                    item.filename not in ('.', '..') and not item.flag_bits & 1 and
                    stat.S_IFMT(item.external_attr >> 16) in (0, stat.S_IFREG), 'Unsafe ZIP member')
            names.add(item.filename)
            total += item.file_size
            require(total <= 64_000_000, 'Expanded receipt budget exceeded')
        require(names == {'artifact-receipt.json', 'zip-receipt.json'}, 'Unexpected receipt members')
        for item in archive.infolist():
            body = archive.read(item)
            require(len(body) == item.file_size, 'Receipt member length differs')
            with (output / item.filename).open('xb') as target:
                target.write(body)
    authority = output / 'authority-api-originals'
    authority.mkdir()
    prepared = output / 'prepared-inputs'
    prepared.mkdir()

    def get(pair):
        name, path = pair
        value = api(authority, name, 'contents/publishing/pages-controller/' + path +
                    '?ref=' + request['controllerCommit'], runner)
        require(value['encoding'] == 'base64' and value['type'] == 'file' and
                value['path'] == 'publishing/pages-controller/' + path, 'Wrong content API file')
        body = base64.b64decode(value['content'], validate=False)
        require(len(body) == value['size'] <= 16_000_000 and
                hashlib.sha1(b'blob ' + str(len(body)).encode() + b'\0' + body).hexdigest() == value['sha'],
                'Original Git blob differs')
        with (prepared / (name + '.json')).open('xb') as target:
            target.write(body)
        return name, body

    _, config_body = get(('configuration', 'publication.json'))
    config = json.loads(config_body)
    qualification_path = config['currentSourceQualification']['path']
    require(config['currentVersion'] == VERSION and qualification_path.startswith('evidence/') and
            qualification_path.endswith('/source-qualification.json') and '..' not in qualification_path and
            not any(char in qualification_path for char in '\\?#:'), 'Actual selector path differs')
    paths = {'manifest': f'metadata/{VERSION}/manifest.json', 'record': f'metadata/{VERSION}/release.json',
             'qualification': qualification_path, 'catalog': 'catalog.json'}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        bodies = dict(pool.map(get, paths.items()))
    for name, original_name in [('manifest', 'manifest.json'), ('record', 'release.json'),
                                ('qualification', 'source-qualification.json')]:
        require(len(bodies[name]) == assets[original_name]['size'] and
                'sha256:' + sha(bodies[name]) == assets[original_name]['digest'],
                'Committed authority differs from published original asset')
    (prepared / 'receipt.json').write_bytes((output / 'artifact-receipt.json').read_bytes())
    observation_dir = home / Path(request['hostedObservation']['path']).parent
    for name in ['run', 'deployment', 'statuses']:
        (prepared / (name + '.json')).write_bytes((observation_dir / (name + '.json')).read_bytes())
    receipt = json.loads((prepared / 'receipt.json').read_bytes())
    require(receipt['controllerCommit'] == request['controllerCommit'] and
            receipt['controllerTree'] == request['controllerTree'] and receipt['currentVersion'] == VERSION and
            receipt['gameSourceRevision'] == SOURCE and receipt['qualifiedSourceTree'] == TREE and
            receipt['publishable'] is True, 'Hosted receipt is not the actual publishable game/controller')
    require(all(row['path'].isascii() for row in receipt['files']), 'Inventory encoding needs review')
    binding = {'format': 'revealline-final-main-public-binding.v1', 'reviewed': False, 'base': BASE,
               **{key: request[key] for key in ['currentVersion', 'gameSourceRevision', 'qualifiedSourceTree',
                                                'controllerCommit', 'controllerTree', 'deploymentId', 'runId']},
               'inventorySha256': sha(encode(receipt['files'])), 'pins': {}}
    for name in ['receipt', 'deployment', 'statuses', 'run', 'manifest', 'record',
                 'qualification', 'catalog', 'configuration']:
        body = (prepared / (name + '.json')).read_bytes()
        binding['pins'][name] = {'path': name + '.json', 'bytes': len(body), 'sha256': sha(body)}
    # Recheck caller-owned inputs before exposing an unreviewed candidate.
    read_request(home, request_path, request_sha, 'revealline-public-intake-request.v1', KEYS)
    observation(home, request['hostedObservation'], request, request['latestSuccessStatusId'])
    published(home, request['publishedRelease'])
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.mkdir()
    for path in prepared.iterdir():
        with (destination / path.name).open('xb') as target:
            target.write(path.read_bytes())
    (destination / 'binding.unreviewed.json').write_bytes(encode(binding))
    result = {'status': 'ACTUAL_PUBLIC_BINDING_PREPARED_UNREVIEWED', 'at': stamp(),
              'requestSha256': request_sha, 'binding': str(destination / 'binding.unreviewed.json'),
              'bindingSha256': sha(encode(binding)), 'controllerCommit': request['controllerCommit'],
              'deploymentId': request['deploymentId'], 'runId': request['runId'], 'releaseId': release['id'],
              'files': len(receipt['files']), 'bytes': receipt['totalBytes'], 'publicAcceptance': False,
              'productionAuditExecuted': False, 'phaseAccepted': False}
    (output / 'result.json').write_bytes(encode(result))
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('request', type=Path)
    parser.add_argument('request_sha256')
    args = parser.parse_args()
    print(json.dumps(intake(Path(__file__).resolve().parent, args.request, args.request_sha256), indent=2))
