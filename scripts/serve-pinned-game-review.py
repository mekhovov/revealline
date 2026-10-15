#!/usr/bin/env python3
"""Development-only, exact-Git source review. No build, runtime injection or input driver."""
import argparse
from collections import OrderedDict
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import mimetypes
import os
from pathlib import Path
import re
import selectors
import subprocess
import threading
import time
from urllib.parse import unquote, urlsplit

OBSERVER_PATHS = (
    'docs/verification/journey-performance.html',
    'docs/verification/journey-performance.mjs',
)
SOURCE_PREFIXES = ('game/', 'authoring/', 'site/', 'optional-practice/', 'vendor/')
MAX_MEMBER_BYTES = 64 * 1024 * 1024
MAX_CACHE_BYTES = 64 * 1024 * 1024
MAX_CACHE_ENTRIES = 512
MAX_TREE_BYTES = 32 * 1024 * 1024
MAX_LOG_BYTES = 4 * 1024 * 1024
MAX_LOG_EVENTS = 10000
HASH = re.compile(r'[a-f0-9]{40}')


class ReviewError(ValueError):
    pass


def sha256(body):
    return hashlib.sha256(body).hexdigest()


def allowed_path(name):
    return (isinstance(name, str) and name.startswith(SOURCE_PREFIXES) and
            not any(part in ('', '.', '..', 'test', 'tests', 'node_modules') or
                    part.startswith('.') for part in name.split('/')) and
            '\\' not in name and not any(ord(c) < 32 or ord(c) == 127 for c in name))


class GitReader:
    def __init__(self, repo, *, max_member_bytes=MAX_MEMBER_BYTES, cache_bytes=MAX_CACHE_BYTES):
        self.repo = Path(repo).resolve(strict=True)
        if not 0 <= cache_bytes <= MAX_CACHE_BYTES or not 0 < max_member_bytes <= MAX_MEMBER_BYTES:
            raise ReviewError('Invalid bounded reader limits')
        self.max_member_bytes = max_member_bytes
        self.cache_bytes = cache_bytes
        self.cached_bytes = 0
        self.cache = OrderedDict()
        self.lock = threading.Lock()
        self.env = {key: value for key, value in os.environ.items() if not key.startswith('GIT_')}
        self.env.update(GIT_NO_LAZY_FETCH='1', GIT_OPTIONAL_LOCKS='0', GIT_TERMINAL_PROMPT='0',
                        GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_GLOBAL=os.devnull)

    def git(self, *args, limit=MAX_TREE_BYTES):
        """Bound stdout while reading it; do not allocate an unbounded command result."""
        process = subprocess.Popen(
            ['git', '--no-optional-locks', '-c', 'core.fsmonitor=false', *args],
            cwd=self.repo, env=self.env, stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=0,
        )
        body = bytearray()
        deadline = time.monotonic() + 30
        try:
            with selectors.DefaultSelector() as selector:
                selector.register(process.stdout, selectors.EVENT_READ)
                while True:
                    remaining = deadline - time.monotonic()
                    if remaining <= 0:
                        raise ReviewError('Git read timed out')
                    if not selector.select(remaining):
                        raise ReviewError('Git read timed out')
                    chunk = os.read(process.stdout.fileno(), min(65536, limit + 1 - len(body)))
                    if not chunk:
                        break
                    body.extend(chunk)
                    if len(body) > limit:
                        raise ReviewError('Git output exceeds its byte bound')
            if process.wait(timeout=max(0.1, deadline - time.monotonic())) != 0:
                raise ReviewError('Pinned Git object is unavailable')
            return bytes(body)
        finally:
            process.stdout.close()
            if process.poll() is None:
                process.kill()
            process.wait()

    def snapshot(self, commit):
        if not isinstance(commit, str) or not HASH.fullmatch(commit):
            raise ReviewError('Use an exact 40-character commit, not a moving ref')
        if self.git('cat-file', '-t', commit, limit=32).strip() != b'commit':
            raise ReviewError('Source pin must name a commit')
        tree = self.git('rev-parse', commit + '^{tree}', limit=80).decode().strip()
        if not HASH.fullmatch(tree):
            raise ReviewError('Invalid source tree')
        paths = {}
        for row in self.git('ls-tree', '-r', '-z', commit).split(b'\0'):
            if not row:
                continue
            metadata, raw_name = row.split(b'\t', 1)
            mode, kind, oid = metadata.decode('ascii').split()
            name = raw_name.decode('utf-8', errors='strict')
            if (allowed_path(name) or name in OBSERVER_PATHS) and kind == 'blob' and \
                    mode in ('100644', '100755'):
                if not HASH.fullmatch(oid) or name in paths:
                    raise ReviewError('Invalid source inventory')
                paths[name] = oid
        return {'commit': commit, 'tree': tree, 'paths': paths}

    def blob(self, oid):
        if not HASH.fullmatch(oid):
            raise ReviewError('Invalid blob pin')
        with self.lock:
            if oid in self.cache:
                result = self.cache.pop(oid)
                self.cache[oid] = result
                return result
            size = int(self.git('cat-file', '-s', oid, limit=32).strip())
            if size < 0 or size > self.max_member_bytes:
                raise ReviewError('Pinned member exceeds its byte bound')
            body = self.git('cat-file', 'blob', oid, limit=size)
            if len(body) != size or hashlib.sha1(b'blob ' + str(size).encode() + b'\0' + body).hexdigest() != oid:
                raise ReviewError('Git blob bytes differ from their pin')
            result = (body, sha256(body))
            if size <= self.cache_bytes:
                while self.cache and (self.cached_bytes + size > self.cache_bytes or
                                      len(self.cache) >= MAX_CACHE_ENTRIES):
                    _, (old, _) = self.cache.popitem(last=False)
                    self.cached_bytes -= len(old)
                self.cache[oid] = result
                self.cached_bytes += size
            return result


class ReceiptLog:
    def __init__(self, path, *, max_bytes=MAX_LOG_BYTES, max_events=MAX_LOG_EVENTS):
        if not 0 < max_bytes <= MAX_LOG_BYTES or not 0 < max_events <= MAX_LOG_EVENTS:
            raise ReviewError('Invalid receipt limits')
        self.file = Path(path).open('xb')
        self.max_bytes, self.max_events = max_bytes, max_events
        self.bytes = self.events = 0
        self.lock = threading.Lock()

    def record(self, event):
        body = (json.dumps(event, sort_keys=True) + '\n').encode()
        with self.lock:
            if self.bytes + len(body) > self.max_bytes or self.events >= self.max_events:
                raise ReviewError('Review receipt limit exhausted')
            self.file.write(body)
            self.file.flush()
            self.bytes += len(body)
            self.events += 1

    def close(self):
        self.file.close()


def byte_range(header, length):
    if header is None:
        return 0, length, 200
    match = re.fullmatch(r'bytes=(\d*)-(\d*)', header)
    if (not match or not any(match.groups()) or not length or
            any(len(part) > 20 for part in match.groups())):
        raise ReviewError('Unsupported or unsatisfiable byte range')
    low, high = match.groups()
    if low:
        start = int(low)
        end = min(int(high) + 1, length) if high else length
    else:
        suffix = int(high)
        if suffix <= 0:
            raise ReviewError('Unsupported or unsatisfiable byte range')
        start, end = max(0, length - suffix), length
    if start >= end or start >= length:
        raise ReviewError('Unsupported or unsatisfiable byte range')
    return start, end, 206


class ReviewServer(ThreadingHTTPServer):
    daemon_threads = False

    def __init__(self, reader, source, observer, log, port=0):
        if type(port) is not int or not 0 <= port <= 65535:
            raise ReviewError('Invalid localhost port')
        self.reader, self.source, self.observer, self.receipt = reader, source, observer, log
        self.slots = threading.BoundedSemaphore(4)
        super().__init__(('127.0.0.1', port), ReviewHandler)

    def process_request(self, request, client_address):
        request.settimeout(5)
        if not self.slots.acquire(timeout=5):
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except BaseException:
            self.slots.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self.slots.release()


class ReviewHandler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_GET(self):
        self.serve()

    def do_HEAD(self):
        self.serve()

    def unsupported(self):
        self.send_response(405)
        self.send_header('Allow', 'GET, HEAD')
        self.send_header('Content-Length', '0')
        self.end_headers()

    do_POST = do_PUT = do_PATCH = do_DELETE = do_OPTIONS = do_TRACE = do_CONNECT = unsupported

    def serve(self):
        expected_host = f'127.0.0.1:{self.server.server_port}'
        if self.headers.get_all('Host') != [expected_host] or self.headers.get('Service-Worker') is not None:
            self.send_error(403)
            return
        if len(self.path) > 2048:
            self.send_error(414)
            return
        try:
            url = urlsplit(self.path)
            if url.scheme or url.netloc or not url.path.startswith('/'):
                raise ValueError('Absolute or invalid request target')
            name = unquote(url.path, errors='strict').lstrip('/')
            if not name:
                self.send_response(308)
                self.send_header('Location', '/game/')
                self.send_header('Content-Length', '0')
                self.end_headers()
                return
            if name.endswith('/'):
                name += 'index.html'
            if not allowed_path(name) and name not in OBSERVER_PATHS:
                self.send_error(404)
                return
            snapshot = self.server.observer if name in OBSERVER_PATHS else self.server.source
            oid = snapshot['paths'].get(name)
            if oid is None:
                self.send_error(404)
                return
            body, digest = self.server.reader.blob(oid)
        except (ValueError, UnicodeError, subprocess.SubprocessError):
            self.send_error(413, 'Pinned source unavailable or beyond its bound')
            return
        ranges = self.headers.get_all('Range') or []
        try:
            if len(ranges) > 1:
                raise ReviewError('Multiple ranges')
            start, end, status = byte_range(ranges[0] if ranges else None, len(body))
        except ReviewError:
            self.send_response(416)
            self.send_header('Content-Range', f'bytes */{len(body)}')
            self.send_header('Content-Length', '0')
            self.end_headers()
            return
        try:
            self.server.receipt.record({
                'event': 'response-prepared', 'method': self.command, 'path': name,
                'sourceCommit': self.server.source['commit'], 'sourceTree': self.server.source['tree'],
                'servedCommit': snapshot['commit'], 'servedTree': snapshot['tree'],
                'observerOverlay': name in OBSERVER_PATHS, 'blob': oid,
                'bytes': len(body), 'sha256': digest, 'status': status,
                'range': [start, end], 'responseBytes': end - start if self.command == 'GET' else 0,
            })
        except (ReviewError, OSError):
            self.send_error(503, 'Review receipt unavailable or exhausted')
            return
        mime = ('text/javascript' if name.endswith(('.mjs', '.js')) else
                mimetypes.guess_type(name)[0] or 'application/octet-stream')
        self.send_response(status)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(end - start))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Accept-Ranges', 'bytes')
        if status == 206:
            self.send_header('Content-Range', f'bytes {start}-{end - 1}/{len(body)}')
        self.end_headers()
        if self.command == 'GET':
            try:
                self.wfile.write(memoryview(body)[start:end])
            except (BrokenPipeError, ConnectionResetError):
                pass


def prepare_sources(reader, baseline, candidate, observer_ref):
    if baseline == candidate or observer_ref != candidate:
        raise ReviewError('Use distinct source commits and the explicit candidate observer ref')
    sources = {name: reader.snapshot(commit) for name, commit in
               [('baseline', baseline), ('candidate', candidate)]}
    observer = sources['candidate']
    pins = {}
    for name in OBSERVER_PATHS:
        oid = observer['paths'].get(name)
        if oid is None:
            raise ReviewError('Candidate observer must contain both regular files')
        body, digest = reader.blob(oid)
        pins[name] = {'blob': oid, 'bytes': len(body), 'sha256': digest}
    return sources, observer, pins


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', required=True)
    parser.add_argument('--baseline', required=True)
    parser.add_argument('--candidate', required=True)
    parser.add_argument('--observer-ref', required=True)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    reader = GitReader(args.repo)
    sources, observer, pins = prepare_sources(reader, args.baseline, args.candidate, args.observer_ref)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=False)
    servers, logs, threads = [], [], []
    try:
        binding = {
            'format': 'revealline-pinned-game-review.v1', 'observer': {
                'commit': observer['commit'], 'tree': observer['tree'], 'files': pins},
            'sources': {}, 'limits': {
                'memberBytes': reader.max_member_bytes, 'sharedBlobCacheBytes': reader.cache_bytes,
                'sharedBlobCacheEntries': MAX_CACHE_ENTRIES,
                'readersPerOrigin': 4, 'receiptBytesPerOrigin': MAX_LOG_BYTES,
                'receiptEventsPerOrigin': MAX_LOG_EVENTS},
            'scope': 'Exact Git source with identical observer-only overlay; not a packaged build, native result or budget verdict.',
            'receiptSemantics': 'Response-prepared pins identify offered bytes, not confirmed browser consumption.',
        }
        for role, source in sources.items():
            log = ReceiptLog(out / (role + '-requests.jsonl'))
            logs.append(log)
            server = ReviewServer(reader, source, observer, log)
            servers.append(server)
            binding['sources'][role] = {
                'commit': source['commit'], 'tree': source['tree'],
                'url': f'http://127.0.0.1:{server.server_port}/docs/verification/journey-performance.html',
            }
        binding['helperSha256'] = sha256(Path(__file__).read_bytes())
        with (out / 'binding.json').open('x') as target:
            target.write(json.dumps(binding, indent=2) + '\n')
        for server in servers:
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            threads.append(thread)
        print(json.dumps(binding), flush=True)
        while all(thread.is_alive() for thread in threads):
            time.sleep(0.5)
    except KeyboardInterrupt:
        pass
    finally:
        for server, thread in zip(servers, threads):
            if thread.is_alive():
                server.shutdown()
        for server in servers:
            server.server_close()
        for log in logs:
            log.close()


if __name__ == '__main__':
    main()
