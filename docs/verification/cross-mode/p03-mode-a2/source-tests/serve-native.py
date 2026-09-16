from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote, urlsplit
import subprocess, mimetypes, hashlib, json

ROOT = Path(__file__).resolve().parents[2]
BASE = 'c7f4faae318d58eacab140c1b2913e620e15efb7'
CACHE = ROOT / '.cache/p03a2-mode-return'
PIN = '55756dc7ea57b33b68cb8e8f53d8e6b3fa3ba7d3210fb3038bb378e2c63d49a6'
raw = (CACHE / 'source-held.json').read_bytes()
if hashlib.sha256(raw).hexdigest() != PIN:
    raise RuntimeError('Source hold changed')
held = json.loads(raw)
if held['base'] != BASE:
    raise RuntimeError('Wrong preview base')
OVERLAYS = {row['path']: row for row in held['inputs'] if row['path'] in {
    'game/app.mjs', 'game/index.html', 'game/mode-return-v2.mjs',
    'game/couch/couch.mjs', 'game/couch/couch-shell.mjs',
}}
if len(OVERLAYS) != 5:
    raise RuntimeError('Expected exactly five production overlays')

def overlay(row):
    body = (ROOT / row['path']).read_bytes()
    if len(body) != row['bytes'] or hashlib.sha256(body).hexdigest() != row['sha256']:
        raise ValueError('Held preview input changed')
    return body
for row in OVERLAYS.values():
    overlay(row)

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = unquote(urlsplit(self.path).path).lstrip('/')
        if not path or path.endswith('/'):
            path += 'index.html'
        if any(part in ('.', '..', '.git', 'node_modules') for part in Path(path).parts) or not path.startswith(('game/', 'authoring/', 'docs/')):
            self.send_error(404)
            return
        try:
            if path in OVERLAYS:
                body = overlay(OVERLAYS[path])
            else:
                spec = BASE + ':' + path
                size = int(subprocess.check_output(['git', 'cat-file', '-s', spec], cwd=ROOT, stderr=subprocess.DEVNULL))
                if size > 64 * 1024 * 1024:
                    raise ValueError('Bounded per-file preview limit')
                body = subprocess.check_output(['git', 'show', spec], cwd=ROOT, stderr=subprocess.DEVNULL)
            kind = 'text/javascript' if path.endswith('.mjs') else mimetypes.guess_type(path)[0] or 'application/octet-stream'
            self.send_response(200)
            self.send_header('Content-Type', kind)
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(body)
        except (OSError, ValueError, subprocess.CalledProcessError):
            self.send_error(404)
    def log_message(self, format, *args):
        pass

server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
binding = {'base': BASE, 'sourceHoldSha256': PIN, 'overlays': list(OVERLAYS.values()), 'port': server.server_port,
           'scope': 'Five held A2 production overlays over exact c7f4faa. No P08/P05/R5/title/R3 overlay, timing fixture or game-state injection.'}
(CACHE / 'native-preview-binding.json').write_text(json.dumps(binding, indent=2) + '\n')
print(f'Held A2 preview: http://127.0.0.1:{server.server_port}/game/', flush=True)
server.serve_forever()
