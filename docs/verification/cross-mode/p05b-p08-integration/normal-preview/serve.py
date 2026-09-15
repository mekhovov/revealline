from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote, urlsplit
from collections import OrderedDict
import subprocess, mimetypes, hashlib, json, os, threading, re, shutil

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
BASE = 'fcc40321d6d584b94c98aab5ead31bddc6b85a47'
HOLD = 'b1e8d58a209f1baf4942573bda4e45d45a624371703348937e59eaf9fec43194'
LIMIT = 64 * 1024 * 1024
if shutil.disk_usage(OUT).free < 256 * 1024 * 1024:
    raise RuntimeError('Insufficient metadata reserve')
raw = (OUT.parent / 'source-held-01.json').read_bytes()
if hashlib.sha256(raw).hexdigest() != HOLD:
    raise RuntimeError('Source hold changed')
held = json.loads(raw)
if held['parents'] != [BASE, '1817377c00049874eb8ab3f47f0b630894ba28f8']:
    raise RuntimeError('Wrong preview base')
rows = {row['path']: row for row in held['files']}
overlays = {}
for name in sorted(name for name in rows if name.startswith('game/') and not name.startswith('game/test/')):
    body = (ROOT / name).read_bytes()
    if len(body) != rows[name]['bytes'] or hashlib.sha256(body).hexdigest() != rows[name]['sha256']:
        raise RuntimeError('Overlay pin mismatch')
    overlays[name] = body
tree = subprocess.check_output(['git', 'rev-parse', BASE + '^{tree}'], cwd=ROOT, text=True).strip()
regular = {}
for line in subprocess.check_output(['git', 'ls-tree', '-r', '-z', BASE], cwd=ROOT).split(b'\0'):
    if not line:
        continue
    meta, name = line.split(b'\t', 1)
    mode, kind, oid = meta.decode().split()
    name = name.decode()
    if mode in ('100644', '100755') and name.startswith(('game/', 'authoring/', 'docs/')):
        regular[name] = oid
regular.update({name: None for name in overlays})
cache = OrderedDict()
cache_bytes = 0
cache_lock = threading.Lock()
requests = threading.BoundedSemaphore(4)

def git_body(name):
    global cache_bytes
    if name in overlays:
        return overlays[name]
    with cache_lock:
        if name in cache:
            body = cache.pop(name)
            cache[name] = body
            return body
        oid = regular[name]
        size = int(subprocess.check_output(['git', 'cat-file', '-s', oid], cwd=ROOT, stderr=subprocess.DEVNULL))
        if size > LIMIT:
            raise ValueError('Per-file limit')
        while cache and cache_bytes + size > LIMIT:
            _, old = cache.popitem(last=False)
            cache_bytes -= len(old)
        body = subprocess.check_output(['git', 'cat-file', 'blob', oid], cwd=ROOT, stderr=subprocess.DEVNULL)
        if len(body) != size:
            raise ValueError('Git body size mismatch')
        cache[name] = body
        cache_bytes += size
        return body

class Handler(BaseHTTPRequestHandler):
    def do_HEAD(self):
        self.serve(False)
    def do_GET(self):
        self.serve(True)
    def serve(self, send_body):
        with requests:
            if self.headers.get('Host') != '127.0.0.1:' + str(self.server.server_port):
                self.send_error(403)
                return
            name = unquote(urlsplit(self.path).path).lstrip('/')
            if not name:
                self.send_response(302)
                self.send_header('Location', '/game/')
                self.send_header('Content-Length', '0')
                self.end_headers()
                return
            if name.endswith('/'):
                name += 'index.html'
            if '\\' in name or any(ord(ch) < 32 for ch in name) or any(part in ('.', '..', '.git', 'node_modules') for part in name.split('/')) or name not in regular:
                self.send_error(404)
                return
            try:
                body = git_body(name)
                length = len(body)
                start, end, status = 0, length - 1, 200
                requested = self.headers.get('Range')
                if requested:
                    match = re.fullmatch(r'bytes=(\d*)-(\d*)', requested)
                    if not match or not any(match.groups()):
                        raise ValueError('Invalid range')
                    low, high = match.groups()
                    if low:
                        start = int(low)
                        end = min(int(high), length - 1) if high else length - 1
                    else:
                        start = max(0, length - int(high))
                    if start > end or start >= length:
                        self.send_response(416)
                        self.send_header('Content-Range', 'bytes */' + str(length))
                        self.send_header('Content-Length', '0')
                        self.end_headers()
                        return
                    status = 206
                kind = 'text/javascript' if name.endswith('.mjs') else mimetypes.guess_type(name)[0] or 'application/octet-stream'
                self.send_response(status)
                self.send_header('Content-Type', kind)
                self.send_header('Content-Length', str(end - start + 1))
                self.send_header('Cache-Control', 'no-store')
                self.send_header('Accept-Ranges', 'bytes')
                if status == 206:
                    self.send_header('Content-Range', f'bytes {start}-{end}/{length}')
                self.end_headers()
                if send_body:
                    for offset in range(start, end + 1, 65536):
                        self.wfile.write(memoryview(body)[offset:min(offset + 65536, end + 1)])
            except (KeyError, ValueError, subprocess.CalledProcessError):
                self.send_error(404)
            except (BrokenPipeError, ConnectionResetError):
                pass
    def log_message(self, format, *args):
        pass

server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
server.daemon_threads = True
binding = {'base': BASE, 'baseTree': tree, 'sourceHoldSha256': HOLD,
           'overlays': [rows[name] for name in overlays], 'candidateMenuStaticComposition': True, 'compositionTree': held['tree'], 'parents': held['parents'],
           'pid': os.getpid(), 'port': server.server_port, 'url': f'http://127.0.0.1:{server.server_port}/game/',
           'gitBlobCacheBytes': LIMIT, 'maxConcurrentRequests': 4,
           'helperSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
           'scope': 'Exact Gitfcc4032 P05-B baseline with fourteen immutable held production overlays (five differ from the base), composing P08 static1817377 and the separate Team pause-slot spacing. All other regular assets come from the stated Git commit. Fresh normal origin; no app state, game-clock or response-delay fixture. Source binding is not native/phase/public acceptance. Later P03 operation-focus/row correction, Team picture binding and new P02/P01 history are absent. Large is a preset, not browser zoom. LRU cap describes stored Git blobs, not total RSS.'}
with (OUT / 'binding.json').open('x') as file:
    json.dump(binding, file, indent=2)
    file.write('\n')
print(json.dumps(binding), flush=True)
server.serve_forever()
