"""Fixed-origin full deployed Pages inventory audit. --prepare never contacts a server."""
import argparse
import concurrent.futures
import datetime
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import threading
import time
import urllib.error
import urllib.request
from urllib.parse import quote
import uuid

import binding

BASE_DIR = Path(__file__).resolve().parents[1]
BASE = binding.BASE
COMMIT = BINDING = INVENTORY_SHA = EXPECTED_FILES = EXPECTED_BYTES = None
SOCKET_TIMEOUT = 25
ATTEMPT_SECONDS = 90
AUDIT_SECONDS = 1800
MAX_ATTEMPTS = 3
CHUNK_BYTES = 65536
WORKERS = 4
MIMES = {
    '.html': {'text/html'},
    '.mjs': {'text/javascript', 'application/javascript'},
    '.js': {'text/javascript', 'application/javascript'},
    '.css': {'text/css'},
    '.json': {'application/json'},
    '.webmanifest': {'application/manifest+json', 'application/json'},
    '.png': {'image/png'},
    '.jpg': {'image/jpeg'},
    '.svg': {'image/svg+xml'},
    '.woff2': {'font/woff2'},
    '.ttf': {'font/ttf', 'application/x-font-ttf', 'application/font-sfnt'},
    '.txt': {'text/plain'},
    '.md': {'text/plain', 'text/markdown', 'text/x-markdown', 'application/octet-stream'},
    '.pb': {'application/octet-stream', 'text/plain'},
    '.rlmedia': {'application/octet-stream'},
    '.rlstory': {'application/octet-stream'},
    '.sha256': {'application/octet-stream', 'text/plain'},
    '': {'application/octet-stream', 'text/plain'},
}


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def digest(data):
    return hashlib.sha256(data).hexdigest()


def validate_row(row):
    if set(row) != {'path', 'bytes', 'sha256'}:
        raise ValueError('Unexpected inventory descriptor fields')
    name = row['path']
    if not isinstance(name, str) or not name or len(name) > 1024:
        raise ValueError('Invalid inventory path')
    if (PurePosixPath(name).is_absolute() or
            re.search(r'[\\\x00-\x1f\x7f:%?#]', name) or
            any(part in ['', '.', '..'] for part in name.split('/'))):
        raise ValueError('Unsafe inventory path')
    if type(row['bytes']) is not int or not 0 <= row['bytes'] <= binding.MAX_FILE:
        raise ValueError('Invalid inventory byte count')
    if not isinstance(row['sha256'], str) or not re.fullmatch('[a-f0-9]{64}', row['sha256']):
        raise ValueError('Invalid inventory SHA-256')
    if PurePosixPath(name).suffix.lower() not in MIMES:
        raise ValueError('No reviewed MIME policy for ' + name)
    return row


def pinned_inventory():
    global COMMIT, BINDING, INVENTORY_SHA, EXPECTED_FILES, EXPECTED_BYTES
    BINDING = binding.validate_execution_binding()
    COMMIT = BINDING['request']['controllerCommit']
    raw, rows = BINDING['raw'], [validate_row(row) for row in BINDING['rows']]
    INVENTORY_SHA = digest(raw)
    EXPECTED_FILES, EXPECTED_BYTES = len(rows), sum(row['bytes'] for row in rows)
    return raw, rows


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Never follow a response to any unreviewed destination, even another
        # path on the same host. This audit requires exact canonical final URLs.
        raise urllib.error.HTTPError(req.full_url, code, 'Redirect refused', headers, fp)


def fetch_once(row, attempt, opener, *, deadline, clock=time.monotonic):
    validate_row(row)
    url = BASE + quote(row['path'], safe='/')
    result = {
        'path': row['path'], 'url': url, 'attempt': attempt,
        'expectedBytes': row['bytes'], 'expectedSha256': row['sha256'],
        'at': now(), 'requestStarted': False, 'bytes': 0,
    }
    started = clock()
    attempt_deadline = min(deadline, started + ATTEMPT_SECONDS)
    try:
        if started >= deadline:
            raise TimeoutError('Audit deadline reached before request')
        request = urllib.request.Request(url, headers={
            'Accept-Encoding': 'identity', 'Cache-Control': 'no-cache',
            'User-Agent': 'RevealLine-v0821-main-byte-audit/1.0',
        })
        result['requestStarted'] = True
        with opener.open(request, timeout=min(SOCKET_TIMEOUT, max(0.1, attempt_deadline - started))) as response:
            result.update({
                'statusCode': response.status, 'finalURL': response.geturl(),
                'contentType': response.headers.get('Content-Type', ''),
                'contentEncoding': response.headers.get('Content-Encoding', 'identity'),
                'contentLength': response.headers.get('Content-Length'),
            })
            if response.status != 200 or response.geturl() != url:
                raise ValueError('HTTP status/final URL mismatch')
            if result['contentEncoding'].strip().lower() not in ['', 'identity']:
                raise ValueError('Unexpected content encoding')
            declared = result['contentLength']
            if declared is not None and (not re.fullmatch(r'\d+', declared.strip()) or int(declared) != row['bytes']):
                raise ValueError('Content-Length differs from pinned body size')
            actual = hashlib.sha256()
            read_body = getattr(response, 'read1', None)
            result['bodyReadMethod'] = 'read1' if callable(read_body) else 'read'
            if not callable(read_body):
                read_body = response.read
            while True:
                if clock() >= attempt_deadline:
                    raise TimeoutError('HTTP body deadline exceeded')
                # Read no more than one byte beyond the pin, including empty files.
                # HTTPResponse.read1 avoids read(n)'s accumulation loop. A
                # blocking transport operation can still overrun the deadline;
                # never accept its result, including delayed EOF, afterward.
                block = read_body(min(CHUNK_BYTES, row['bytes'] - result['bytes'] + 1))
                if block:
                    result['bytes'] += len(block)
                    if result['bytes'] > row['bytes']:
                        raise ValueError('Body exceeds pinned size')
                    actual.update(block)
                if clock() >= attempt_deadline:
                    raise TimeoutError('HTTP body deadline exceeded after read')
                if not block:
                    break
            result['sha256'] = actual.hexdigest()
            if result['bytes'] != row['bytes'] or result['sha256'] != row['sha256']:
                raise ValueError('Body size/SHA-256 mismatch')
            suffix = PurePosixPath(row['path']).suffix.lower()
            if result['contentType'].split(';', 1)[0].strip().lower() not in MIMES[suffix]:
                raise ValueError('Unexpected MIME for ' + (suffix or row['path']))
            result['status'] = 'PASS'
    except Exception as error:
        result['status'] = 'FAIL'
        result['errorType'] = type(error).__name__
        result['error'] = str(error)
        if isinstance(error, urllib.error.HTTPError):
            result['statusCode'] = error.code
            error.close()
    finished = clock()
    if result.get('status') == 'PASS' and finished >= attempt_deadline:
        result.update(status='FAIL', errorType='TimeoutError', error='HTTP verification completed after deadline')
    result['elapsedSeconds'] = round(finished - started, 3)
    return result


def check_row(row, opener, record_attempt, *, deadline, clock=time.monotonic, sleep=time.sleep):
    final = None
    for number in range(1, MAX_ATTEMPTS + 1):
        final = fetch_once(row, number, opener, deadline=deadline, clock=clock)
        # Persist every attempt as it happens, including unsuccessful retries.
        record_attempt(final)
        if final['status'] == 'PASS' or clock() >= deadline:
            break
        if number < MAX_ATTEMPTS:
            sleep(min(number, max(0, deadline - clock())))
    return final


def helper_pins():
    return {name: digest(binding.bounded(Path(__file__).with_name(name))) for name in ('http_audit.py', 'binding.py')}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--prepare', action='store_true', help='Check held original metadata only; no requests')
    parser.add_argument('--run', action='store_true', help='Audit only after actual reviewed deployment binding validates')
    args = parser.parse_args()
    if args.prepare:
        if args.run:
            parser.error('--prepare cannot authorize --run')
        binding.pinned_metadata()
        print(json.dumps({'status': 'PREPARED_ACTUAL_DEPLOYMENT_BINDING_REQUIRED', 'version': binding.VERSION,
                          'inventory': None, 'networkRequests': 0, 'workers': WORKERS, 'helpers': helper_pins()}))
        return 0
    raw, rows = pinned_inventory()
    if not args.run:
        print(json.dumps({'status': 'READY', 'files': EXPECTED_FILES, 'bytes': EXPECTED_BYTES,
                          'inventorySha256': INVENTORY_SHA, 'networkRequests': 0, 'helpers': helper_pins()}))
        return 0
    if shutil.disk_usage(BASE_DIR).free < 1024**3:
        raise ValueError('At least 1 GiB local free space required')
    original_helpers = helper_pins()
    out_parent = BASE_DIR / 'http'
    if out_parent.is_symlink():
        raise ValueError('Symlink output directory refused')
    out_parent.mkdir(exist_ok=True)
    out = out_parent / ('http-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:8])
    out.mkdir(exist_ok=False)
    (out / 'expected-inventory.json').write_bytes(raw)
    for name in original_helpers:
        (out / name).write_bytes(binding.bounded(Path(__file__).with_name(name)))
    (out / 'execution-request.json').write_bytes(BINDING['requestRaw'])
    (out / 'authority-originals').mkdir()
    for role, body in BINDING['evidenceBodies'].items():
        (out / 'authority-originals' / (role + ('.zip' if role == 'receiptZIP' else '.json'))).write_bytes(body)
    (out / 'source-metadata').mkdir()
    for name, body in binding.pinned_metadata()[0].items():
        (out / 'source-metadata' / name).write_bytes(body)
    admitted = BINDING
    deadline = time.monotonic() + AUDIT_SECONDS
    started = now()
    finished = []
    trial_count = attempt_failures = 0
    write_lock = threading.Lock()
    with (out / 'http-results.jsonl').open('x') as results, (out / 'http-attempts.jsonl').open('x') as attempts:
        def record_attempt(result):
            nonlocal trial_count, attempt_failures
            with write_lock:
                attempts.write(json.dumps(result) + '\n')
                attempts.flush()
                trial_count += 1
                attempt_failures += result['status'] != 'PASS'

        def worker(row):
            return check_row(row, urllib.request.build_opener(NoRedirect()), record_attempt, deadline=deadline)

        print(json.dumps({'status': 'RUNNING', 'directory': str(out), 'files': len(rows), 'workers': WORKERS}), flush=True)
        with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as pool:
            futures = [pool.submit(worker, row) for row in rows]
            for future in concurrent.futures.as_completed(futures):
                result = future.result()
                finished.append(result)
                results.write(json.dumps(result) + '\n')
                results.flush()
                if len(finished) % 100 == 0:
                    print(json.dumps({'checked': len(finished), 'total': len(rows),
                                      'failed': sum(r['status'] != 'PASS' for r in finished)}), flush=True)
    if len(finished) != len(rows) or {r['path'] for r in finished} != {r['path'] for r in rows}:
        raise AssertionError('Full deployed inventory was not audited')
    failed = [r for r in finished if r['status'] != 'PASS']
    authority_error = None
    try:
        after = binding.validate_execution_binding()
        if after['requestSha256'] != admitted['requestSha256'] or helper_pins() != original_helpers:
            raise ValueError('Bound authority/helper inputs changed during audit')
    except Exception as error:
        authority_error = str(error)
    report = {
        'format': 'revealline-main-public-http-audit.v1',
        'status': 'FAIL' if failed or authority_error else 'PASS', 'base': BASE,
        'version': binding.VERSION, 'gameSourceRevision': binding.SOURCE, 'qualifiedSourceTree': binding.TREE,
        'controllerCommit': COMMIT, 'controllerTree': admitted['request']['controllerTree'],
        'files': len(finished), 'expectedFiles': len(rows), 'expectedBytes': EXPECTED_BYTES,
        'verifiedBytes': sum(r['bytes'] for r in finished if r['status'] == 'PASS'),
        'failedFiles': len(failed), 'failures': failed,
        'skipped': [r['path'] for r in finished if not r['requestStarted']],
        'expectedInventorySha256': INVENTORY_SHA, 'startedAt': started, 'verifiedAt': now(),
        'attempts': trial_count, 'failedAttempts': attempt_failures,
        'retriedFiles': sum(r['attempt'] > 1 for r in finished), 'workers': WORKERS,
        'maxAttemptsPerFile': MAX_ATTEMPTS, 'socketTimeoutSeconds': SOCKET_TIMEOUT,
        'attemptDeadlineSeconds': ATTEMPT_SECONDS, 'auditDeadlineSeconds': AUDIT_SECONDS,
        'deadlineSemantics': 'Checked before/after body reads and after response close. Expired completions fail. Blocking transport operations may overrun; socket timeout is an inactivity bound, not a strict process wall limit.',
        'allFinalURLsExact': all(r.get('finalURL') == r['url'] for r in finished),
        'payloadFilesPersisted': False, 'sourcePinsUnchanged': authority_error is None,
        'authorityError': authority_error, 'helperPins': original_helpers,
        'runId': admitted['request']['runId'], 'deploymentId': admitted['request']['deploymentId'],
        'deploymentStatusId': admitted['request']['deploymentStatusId'],
        'receiptArtifactId': admitted['request']['receiptArtifactId'],
        'executionRequestSha256': admitted['requestSha256'],
        'scope': 'Every actual frozen-pages-receipts artifact inventory row, including main aliases, canonical graph and historical bridges. No browser/offline/listening acceptance.',
    }
    (out / 'http-report.json').write_bytes(binding.encoded(report))
    print(json.dumps({'directory': str(out), 'report': report}), flush=True)
    return 0 if report['status'] == 'PASS' else 1


if __name__ == '__main__':
    raise SystemExit(main())
