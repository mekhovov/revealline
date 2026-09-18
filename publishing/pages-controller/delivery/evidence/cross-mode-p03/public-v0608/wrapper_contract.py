"""Bounded local contracts for two release-specific, read-only API wrappers."""
from pathlib import Path
import datetime
import hashlib
import json
import re
import stat
import subprocess

VERSION = 'v0.60.8'
SOURCE = 'a7fd646e40bd93268f56b714fdc5d8aa9b0b1f67'
TREE = 'fffcf886b4f1a0000fbfd062a931bbe1cb0fef64'
BASE = 'https://mekhovov.github.io/revealline/'
API_LIMIT = 2_000_000
ASSETS = {'distribution.zip', 'distribution.zip.sha256', 'manifest.json', 'release.json',
          'qualification-evidence-record.json', 'source-qualification-evidence.zip',
          'source-qualification.json', 'source.tar', 'verification.json'}


def require(ok, message):
    if not ok:
        raise ValueError(message)


def sha(body):
    return hashlib.sha256(body).hexdigest()


def encode(value):
    return (json.dumps(value, indent=2, ensure_ascii=False) + '\n').encode()


def stamp():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def commit(value):
    return isinstance(value, str) and re.fullmatch(r'[a-f0-9]{40}', value) is not None


def positive(value):
    return type(value) is int and 0 < value <= 9007199254740991


def relative(value):
    require(isinstance(value, str) and 0 < len(value) < 1024 and
            not re.search(r'[\\\x00-\x1f\x7f:?#]', value) and
            all(part and part not in ('.', '..') for part in value.split('/')),
            'Unsafe relative evidence path')
    return value


def ordinary(root, name, limit):
    path = root
    for part in relative(name).split('/'):
        path = path / part
        require(not path.is_symlink(), 'Evidence path contains a symlink')
    info = path.stat()
    require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and info.st_size <= limit,
            'Evidence must be a bounded ordinary single-link file')
    body = path.read_bytes()
    require(len(body) == info.st_size, 'Evidence changed while reading')
    return body


def read_pin(root, pin, limit=16_000_000):
    require(isinstance(pin, dict) and set(pin) == {'path', 'bytes', 'sha256'} and
            type(pin['bytes']) is int and 0 <= pin['bytes'] <= limit and
            isinstance(pin['sha256'], str) and re.fullmatch(r'[a-f0-9]{64}', pin['sha256']),
            'Incomplete actual evidence pin')
    body = ordinary(root, pin['path'], limit)
    require(len(body) == pin['bytes'] and sha(body) == pin['sha256'], 'Pinned evidence changed')
    return body


def read_request(root, file, expected_sha, format_name, keys):
    path = Path(file).absolute()
    require(path.is_relative_to(root.absolute()), 'Request must be inside this audit cache')
    body = ordinary(root, path.relative_to(root).as_posix(), 64_000)
    require(isinstance(expected_sha, str) and re.fullmatch(r'[a-f0-9]{64}', expected_sha)
            and sha(body) == expected_sha, 'Explicit reviewed request SHA is required')
    value = json.loads(body)
    require(set(value) == set(keys) | {'format', 'reviewed', 'outputLabel'} and
            value['format'] == format_name and value['reviewed'] is True,
            'Actual reviewed request fields are required; no defaults')
    require(isinstance(value['outputLabel'], str) and
            re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,47}', value['outputLabel']), 'Invalid output label')
    return value, body


def identity(value):
    require(value['currentVersion'] == VERSION and value['gameSourceRevision'] == SOURCE and
            value['qualifiedSourceTree'] == TREE and commit(value['controllerCommit']) and
            commit(value['controllerTree']) and positive(value['runId']) and
            positive(value['deploymentId']), 'Actual publication identity differs')


def observation(root, pin, expected, status_id):
    record = json.loads(read_pin(root, pin))
    directory = Path(pin['path']).parent.as_posix()
    files = {}
    for item in record['pins']:
        require(item['path'] not in files and '/' not in item['path'], 'Invalid observation member')
        files[item['path']] = read_pin(root, dict(item, path=directory + '/' + item['path']))
    required = {'main', 'wrapper', 'run', 'jobs', 'artifacts', 'deployments', 'deployment', 'statuses'}
    require(all(name + '.json' in files for name in required), 'Incomplete hosted observation')
    models = {name: json.loads(files[name + '.json']) for name in required}
    run, deployment, statuses = models['run'], models['deployment'], models['statuses']
    require(models['main']['object']['sha'] == models['wrapper']['sha'] == run['head_sha'] ==
            expected['controllerCommit'] and models['wrapper']['tree']['sha'] == expected['controllerTree'],
            'Hosted main/run/tree differs')
    require(run['id'] == expected['runId'] and run['head_branch'] == 'main' and
            run['status'] == 'completed' and run['conclusion'] == 'success' and
            run['event'] in ('push', 'workflow_dispatch') and
            run['path'] == '.github/workflows/publish-frozen-pages.yml', 'Not a successful actual Pages run')
    require(deployment['id'] == expected['deploymentId'] and deployment['sha'] == expected['controllerCommit']
            and deployment['environment'] == 'github-pages' and deployment['ref'] == 'main',
            'Actual deployment differs')
    require(positive(status_id) and statuses and statuses[0]['id'] == status_id and
            statuses[0]['state'] == 'success' and statuses[0]['environment_url'].rstrip('/') + '/' == BASE,
            'Latest successful status differs')
    expected_run = f"https://github.com/mekhovov/revealline/actions/runs/{expected['runId']}"
    log_url = statuses[0].get('log_url', '')
    require(log_url == expected_run or log_url.startswith(expected_run + '/') or
            str(deployment.get('payload', {}).get('workflow_run_id')) == str(expected['runId']),
            'Deployment/run linkage missing')
    require(models['jobs']['jobs'] and all(job['conclusion'] == 'success' for job in models['jobs']['jobs']),
            'Pages jobs are not all successful')
    models['_observedAt'] = record['at']
    return models


def published(root, pin):
    raw = read_pin(root, pin, API_LIMIT - 1)
    value = json.loads(raw)
    require(positive(value['id']) and value['tag_name'] == VERSION and value['draft'] is False and
            value['prerelease'] is False and value['published_at'] and len(value['assets']) == 9,
            'Expected actual published stable release with nine original assets')
    assets = {item['name']: item for item in value['assets']}
    require(set(assets) == ASSETS and len({item['id'] for item in value['assets']}) == 9,
            'Original release assets differ')
    for name, item in assets.items():
        require(positive(item['id']) and positive(item['size']) and item['state'] == 'uploaded' and
                re.fullmatch(r'sha256:[a-f0-9]{64}', item['digest']) and item['browser_download_url'] ==
                f'https://github.com/mekhovov/revealline/releases/download/{VERSION}/{name}',
                'Original asset descriptor invalid')
    return value, assets, raw


def api(output, name, endpoint, runner=subprocess.run):
    command = ['gh', 'api', 'repos/mekhovov/revealline/' + endpoint]
    timed_out = False
    try:
        result = runner(command, capture_output=True, timeout=35)
        stdout, stderr, code = result.stdout, result.stderr, result.returncode
    except subprocess.TimeoutExpired as error:
        timed_out = True
        stdout, stderr, code = error.output or b'', error.stderr or b'', None
    oversized = len(stdout) >= API_LIMIT or len(stderr) >= API_LIMIT
    suffix = '.partial' if timed_out or oversized else ''
    for extension, body in [('json', stdout), ('stderr', stderr)]:
        with (output / (name + '.' + extension + suffix)).open('xb') as target:
            target.write(body[:API_LIMIT - 1])
    with (output / (name + '.exit.json')).open('xb') as target:
        target.write(encode({'at': stamp(), 'command': command, 'exitCode': code,
                             'timedOut': timed_out, 'stdoutBytes': len(stdout), 'stderrBytes': len(stderr),
                             'acceptedBytesLessThan': API_LIMIT, 'timeoutSeconds': 35}))
    require(not timed_out and not oversized and code == 0, 'API failure retained; no acceptance')
    return json.loads(stdout)
