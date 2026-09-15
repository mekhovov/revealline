"""Read every hash-pinned Archive14 HTTP body without persisting payloads.

Adapted from the Archive11 auditor. Public execution requires an explicit --run;
there is no URL, inventory, or output-path override. Tests use an injected local
in-memory transport and never contact the public site.
"""
import argparse
import concurrent.futures
import datetime
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import threading
import time
import urllib.error
import urllib.request
from urllib.parse import quote
import uuid

BASE_DIR = Path(__file__).resolve().parents[1]
INFRA = BASE_DIR / 'repository'
BASE = 'https://mekhovov.github.io/revealline-archive-14/'
COMMIT = '740878b685b08edb40db5494f7ebbe71536b523a'
INVENTORY_SHA = 'f24adf62b38808725c834d92ea7b1e2475a6318eb0294051313e06f54fab5c27'
EXPECTED_FILES = 662
EXPECTED_BYTES = 312553884
SOCKET_TIMEOUT = 25
ATTEMPT_SECONDS = 90
AUDIT_SECONDS = 1800
MAX_ATTEMPTS = 3
CHUNK_BYTES = 65536
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
    if type(row['bytes']) is not int or not 0 <= row['bytes'] <= EXPECTED_BYTES:
        raise ValueError('Invalid inventory byte count')
    if not isinstance(row['sha256'], str) or not re.fullmatch('[a-f0-9]{64}', row['sha256']):
        raise ValueError('Invalid inventory SHA-256')
    if PurePosixPath(name).suffix.lower() not in MIMES:
        raise ValueError('No reviewed MIME policy for ' + name)
    return row


def pinned_inventory():
    raw = (INFRA / 'expected-inventory.json').read_bytes()
    if digest(raw) != INVENTORY_SHA:
        raise ValueError('Archive14 inventory pin changed')
    head = subprocess.check_output(['git', '-C', str(INFRA), 'rev-parse', 'HEAD'], text=True).strip()
    committed = subprocess.check_output(['git', '-C', str(INFRA), 'show', COMMIT + ':expected-inventory.json'])
    if head != COMMIT or committed != raw:
        raise ValueError('Archive14 inventory is not from its pinned infrastructure commit')
    value = json.loads(raw)
    if set(value) != {'base', 'files'} or value['base'] != BASE:
        raise ValueError('Archive14 base or inventory format changed')
    rows = [validate_row(row) for row in value['files']]
    if (len(rows) != EXPECTED_FILES or len({row['path'] for row in rows}) != EXPECTED_FILES or
            sum(row['bytes'] for row in rows) != EXPECTED_BYTES):
        raise ValueError('Archive14 finite inventory changed')
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
    try:
        if started >= deadline:
            raise TimeoutError('Audit deadline reached before request')
        request = urllib.request.Request(url, headers={
            'Accept-Encoding': 'identity', 'Cache-Control': 'no-cache',
            'User-Agent': 'RevealLine-archive14-byte-audit/2.0',
        })
        result['requestStarted'] = True
        with opener.open(request, timeout=min(SOCKET_TIMEOUT, max(0.1, deadline - started))) as response:
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
            while True:
                if clock() >= min(deadline, started + ATTEMPT_SECONDS):
                    raise TimeoutError('HTTP body deadline exceeded')
                # Read no more than one byte beyond the pin, including empty files.
                block = response.read(min(CHUNK_BYTES, row['bytes'] - result['bytes'] + 1))
                if not block:
                    break
                result['bytes'] += len(block)
                if result['bytes'] > row['bytes']:
                    raise ValueError('Body exceeds pinned size')
                actual.update(block)
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
    result['elapsedSeconds'] = round(clock() - started, 3)
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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run', action='store_true', help='Audit the fixed public Archive14 inventory')
    parser.add_argument('--workers', type=int, choices=range(4, 9), default=6)
    args = parser.parse_args()
    raw, rows = pinned_inventory()
    if not args.run:
        print(json.dumps({'status': 'READY', 'base': BASE, 'files': len(rows), 'bytes': EXPECTED_BYTES,
                          'inventorySha256': INVENTORY_SHA, 'networkRequests': 0}))
        return 0
    out = BASE_DIR / 'http' / ('http-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:8])
    out.mkdir(exist_ok=False)
    (out / 'expected-inventory.json').write_bytes(raw)
    (out / 'auditor.py').write_bytes(Path(__file__).read_bytes())
    deadline = time.monotonic() + AUDIT_SECONDS
    started = now()
    finished = []
    trial_count = 0
    attempt_failures = 0
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
            opener = urllib.request.build_opener(NoRedirect())
            return check_row(row, opener, record_attempt, deadline=deadline)

        print(json.dumps({'status': 'RUNNING', 'directory': str(out), 'files': len(rows), 'workers': args.workers}), flush=True)
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
            futures = [pool.submit(worker, row) for row in rows]
            for future in concurrent.futures.as_completed(futures):
                result = future.result()
                finished.append(result)
                results.write(json.dumps(result) + '\n')
                results.flush()
                if len(finished) % 25 == 0:
                    print(json.dumps({'checked': len(finished), 'total': len(rows),
                                      'failed': sum(row['status'] != 'PASS' for row in finished)}), flush=True)
    if len(finished) != len(rows) or {row['path'] for row in finished} != {row['path'] for row in rows}:
        raise AssertionError('Audit result inventory is incomplete')
    failed = [row for row in finished if row['status'] != 'PASS']
    unrequested = [row['path'] for row in finished if not row['requestStarted']]
    report = {
        'status': 'FAIL' if failed else 'PASS', 'base': BASE, 'archiveCommit': COMMIT,
        'files': len(finished), 'expectedBytes': EXPECTED_BYTES,
        'verifiedBytes': sum(row['bytes'] for row in finished if row['status'] == 'PASS'),
        'failedFiles': len(failed), 'failures': failed, 'skipped': unrequested,
        'expectedInventorySha256': INVENTORY_SHA, 'startedAt': started, 'verifiedAt': now(),
        'attempts': trial_count, 'failedAttempts': attempt_failures,
        'retriedFiles': sum(row['attempt'] > 1 for row in finished), 'workers': args.workers,
        'socketTimeoutSeconds': SOCKET_TIMEOUT, 'attemptDeadlineSeconds': ATTEMPT_SECONDS,
        'auditDeadlineSeconds': AUDIT_SECONDS, 'maxAttemptsPerFile': MAX_ATTEMPTS,
        'allFinalURLsExact': all(row.get('finalURL') == row['url'] for row in finished),
        'payloadFilesPersisted': False,
        'scope': 'Every pinned canonical HTTP body and explicit MIME, including hidden metadata. Independent of browser/offline or physical-device acceptance.',
    }
    with (out / 'http-report.json').open('x') as stream:
        json.dump(report, stream, indent=2)
        stream.write('\n')
    print(json.dumps({'directory': str(out), 'report': report}), flush=True)
    return 1 if failed else 0


if __name__ == '__main__':
    raise SystemExit(main())
