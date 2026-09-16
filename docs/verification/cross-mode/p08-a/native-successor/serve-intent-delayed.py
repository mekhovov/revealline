"""Bounded local source preview; no build, extraction, or original-file copies."""
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote, urlsplit
import hashlib
import json
import mimetypes
import shutil
import subprocess
import threading
import time

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / '.cache/p08a'
BINDING = json.loads((CACHE / 'preview-intent-delayed-binding.json').read_text())
BASE = BINDING['base']
assert BASE == 'f047a46a9a1bb9982600bd7e2682d765a75cb9cc'
OVERLAY = {row['path']: row for row in BINDING['runtime']}
assert set(OVERLAY) == {
    'game/couch/couch.mjs', 'game/couch/index.html',
    'game/couch/couch-static-pictures.mjs', 'game/presentation/page.mjs',
}
DELAYED = {row['path']: row for row in BINDING['delayedResponses']}
SLOTS = threading.BoundedSemaphore(4)

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        route = unquote(urlsplit(self.path).path).lstrip('/')
        if not route or route.endswith('/'):
            route += 'index.html'
        if (any(part in ('.', '..', '.git', 'node_modules') for part in route.split('/'))
                or not route.startswith(('game/', 'authoring/', 'docs/'))):
            self.send_error(404)
            return
        with SLOTS:
            process = None
            try:
                if route in OVERLAY:
                    body = (ROOT / route).read_bytes()
                    expected = OVERLAY[route]
                    if (len(body) != expected['bytes'] or
                            hashlib.sha256(body).hexdigest() != expected['sha256']):
                        self.send_error(409, 'Held source changed')
                        return
                    size = len(body)
                else:
                    identity = BASE + ':' + route
                    size = int(subprocess.check_output(
                        ['git', 'cat-file', '-s', identity], cwd=ROOT, stderr=subprocess.DEVNULL))
                    if size > 64 * 1024 * 1024:
                        raise ValueError('Preview member limit')
                    if route in DELAYED:
                        if size != DELAYED[route]['bytes']:
                            raise ValueError('Delayed original size changed')
                        time.sleep(DELAYED[route]['delayMs'] / 1000)
                    process = subprocess.Popen(
                        ['git', 'cat-file', 'blob', identity], cwd=ROOT,
                        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
                kind = mimetypes.guess_type(route)[0] or 'application/octet-stream'
                if route.endswith('.mjs'):
                    kind = 'text/javascript'
                self.send_response(200)
                self.send_header('Content-Type', kind)
                self.send_header('Content-Length', str(size))
                self.send_header('Cache-Control', 'no-store')
                if route in DELAYED:
                    self.send_header('X-RevealLine-Preview-Delay-Ms', str(DELAYED[route]['delayMs']))
                self.end_headers()
                if process:
                    shutil.copyfileobj(process.stdout, self.wfile, length=64 * 1024)
                else:
                    self.wfile.write(body)
            except (OSError, ValueError, subprocess.CalledProcessError):
                if process is None:
                    self.send_error(404)
            finally:
                if process:
                    process.stdout.close()
                    process.wait()

    def log_message(self, format, *args):
        print(format % args, flush=True)

server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
(CACHE / 'server-intent-delayed.json').write_text(json.dumps({
    'port': server.server_port, 'base': BASE,
    'bindingSha256': hashlib.sha256((CACHE / 'preview-intent-delayed-binding.json').read_bytes()).hexdigest(),
    'scope': BINDING['scope']
}, indent=2) + '\n')
print(f'http://127.0.0.1:{server.server_port}/game/couch/', flush=True)
server.serve_forever()
