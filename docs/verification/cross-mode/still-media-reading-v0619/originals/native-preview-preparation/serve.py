from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit, unquote
from collections import OrderedDict
from datetime import datetime, timezone
import subprocess, hashlib, json, mimetypes, threading, os, shutil

ROOT = Path('/Users/oleksandr.mekhovov/work/my_projects/go_test')
OUT = Path(__file__).resolve().parent
SPEC_BYTES = (OUT / 'runtime-overrides.json').read_bytes()
SPEC = json.loads(SPEC_BYTES)
COMMIT = SPEC['base']
LIMITS = SPEC['limits']


def git(*args):
    return subprocess.check_output(
        ['git', '--no-optional-locks', *args], cwd=ROOT,
        env={**os.environ, 'GIT_NO_LAZY_FETCH': '1'}, timeout=15,
    )


TREE = git('rev-parse', COMMIT + '^{tree}').decode().strip()
assert COMMIT == '0ae4330b8a87d332051db112f5e09b7c3cbef9fa'
assert TREE == SPEC['tree'] == 'bea7eebf35befcae0362b19f7ecfbb75a3942b00'
assert set(SPEC['files']) == {'authoring/still-media/index.html'}
assert shutil.disk_usage(ROOT).free >= LIMITS['reserveBytes']
paths = {}
for row in git('ls-tree', '-r', '-z', COMMIT).split(b'\0'):
    if not row:
        continue
    info, name = row.split(b'\t', 1)
    mode, kind, oid = info.decode().split()
    name = name.decode()
    if mode in ('100644', '100755') and kind == 'blob' and name.startswith(('game/', 'authoring/', 'site/')):
        paths[name] = oid
overrides = {}
for name, row in SPEC['files'].items():
    body = Path(row['path']).read_bytes()
    assert len(body) == row['bytes'] and hashlib.sha256(body).hexdigest() == row['sha256']
    assert name in paths
    overrides[name] = body

cache = OrderedDict()
lock = threading.RLock()
log = (OUT / 'requests.jsonl').open('x')
log_bytes = 0
log_events = 0


def record(event):
    global log_bytes, log_events
    event['at'] = datetime.now(timezone.utc).isoformat()
    line = json.dumps(event) + '\n'
    size = len(line.encode())
    with lock:
        if log_bytes + size > LIMITS['requestLogBytes'] or log_events >= LIMITS['requestEvents']:
            raise ValueError('Request log budget exhausted')
        if shutil.disk_usage(ROOT).free < LIMITS['reserveBytes']:
            raise ValueError('Free-space reserve reached')
        log.write(line)
        log.flush()
        log_bytes += size
        log_events += 1


def blob(name):
    if name in overrides:
        return overrides[name]
    with lock:
        if name in cache:
            body = cache.pop(name)
            cache[name] = body
            return body
        oid = paths[name]
        size = int(git('cat-file', '-s', oid))
        if size > LIMITS['singleBlobBytes']:
            raise ValueError('Asset exceeds the scoped single-blob budget')
        body = git('cat-file', 'blob', oid)
        if len(body) != size or hashlib.sha1(b'blob ' + str(size).encode() + b'\0' + body).hexdigest() != oid:
            raise ValueError('Git object bytes differ')
        while cache and sum(map(len, cache.values())) + size > LIMITS['memoryCacheBytes']:
            cache.popitem(last=False)
        cache[name] = body
        return body


class Handler(BaseHTTPRequestHandler):
    def do_HEAD(self):
        self.serve(False)

    def do_GET(self):
        self.serve(True)

    def log_message(self, *args):
        pass

    def serve(self, send):
        if self.headers.get('Host') != '127.0.0.1:' + str(self.server.server_port):
            self.send_error(403)
            return
        if len(self.path) > 2048:
            self.send_error(414)
            return
        name = unquote(urlsplit(self.path).path).lstrip('/')
        if not name:
            name = 'authoring/still-media/'
        if name.endswith('/'):
            name += 'index.html'
        if name not in paths:
            try:
                record({'path': name, 'method': self.command, 'status': 404})
            except ValueError:
                pass
            self.send_error(404)
            return
        try:
            body = blob(name)
        except (ValueError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
            try:
                record({'path': name, 'method': self.command, 'status': 413, 'error': str(error)})
            except ValueError:
                pass
            self.send_error(413)
            return
        kind = 'text/javascript' if name.endswith(('.mjs', '.js')) else mimetypes.guess_type(name)[0] or 'application/octet-stream'
        try:
            record({'path': name, 'method': self.command, 'status': 200, 'bytes': len(body),
                    'sha256': hashlib.sha256(body).hexdigest(),
                    'source': 'pinned-candidate' if name in overrides else 'exact-git',
                    'gitBlob': paths[name] if name not in overrides else None})
        except ValueError:
            self.send_error(503, 'Scoped verification capacity reached')
            return
        self.send_response(200)
        self.send_header('Content-Type', kind)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        if send:
            try:
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError):
                pass


server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
server.daemon_threads = True
binding = {'commit': COMMIT, 'tree': TREE, 'pid': os.getpid(), 'port': server.server_port,
           'url': 'http://127.0.0.1:' + str(server.server_port) + '/authoring/still-media/',
           'scope': SPEC['scope'], 'runtimeOverrides': SPEC['files'], 'limits': LIMITS,
           'overrideSpecSHA256': hashlib.sha256(SPEC_BYTES).hexdigest(),
           'serverSHA256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
with (OUT / 'binding.json').open('x') as file:
    file.write(json.dumps(binding, indent=2) + '\n')
print(json.dumps(binding), flush=True)
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
    log.close()
    (OUT / 'closed-receipt.json').write_text(json.dumps({
        'pid': os.getpid(), 'port': server.server_port, 'closed': True,
        'requestLogSHA256': hashlib.sha256((OUT / 'requests.jsonl').read_bytes()).hexdigest(),
    }, indent=2) + '\n')
