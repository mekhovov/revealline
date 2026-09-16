from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote, urlsplit
import subprocess, mimetypes, hashlib, json, time

ROOT = Path.cwd()
BASE = 'f61a249277944a5fdd50cf7d545cbb18dbd0eaf8'
OVERLAYS = {
 'game/couch/couch-shell.mjs': (ROOT / 'game/couch/couch-shell.mjs', '7daec46b0c6a891ca238e5f0926dbdf7eb1910062da0b348e00d480473e46cee'),
 'game/couch/couch.mjs': (ROOT / 'game/couch/couch.mjs', '6975c9eca56f906f3420fd774d85edda40926cf145c0bdf74eca17dcd2e52d5c'),
 'game/couch/index.html': (ROOT / 'game/couch/index.html', '9c21a4f14edc0da7915936504802336893a7c95aabf58862b745dcdfaddcbb07'),
 'game/couch/relay-rescue.mjs': (ROOT / 'game/couch/relay-rescue.mjs', 'e67e22afd7da53113a32299ce23c239c7e0956ce6919be3ec56bd4fe1e9b12b3'),
 'game/couch/relay-rescue.html': (ROOT / 'game/couch/relay-rescue.html', '7d65375b24aa80947021f7c3d61d3b5711ffd2cdf07720f36c81aaaff7a776c6'),
 'game/couch/relay-rescue.css': (ROOT / 'game/couch/relay-rescue.css', 'f5cd2a3018b7924d6deebaabd8bfac19bea2dbf9ee93048679466c28c1848807'),
}
for path, expected in OVERLAYS.values():
    assert hashlib.sha256(path.read_bytes()).hexdigest() == expected, path

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = unquote(urlsplit(self.path).path).lstrip('/')
        if not path or path.endswith('/'):
            path += 'index.html'
        if any(p in ('.', '..', '.git', 'node_modules') for p in Path(path).parts) or not path.startswith(('game/', 'authoring/', 'docs/')):
            self.send_error(404)
            return
        try:
            if path in OVERLAYS:
                local, expected = OVERLAYS[path]
                body = local.read_bytes()
                if hashlib.sha256(body).hexdigest() != expected:
                    raise ValueError('Held preview input changed')
            else:
                size = int(subprocess.check_output(['git', 'cat-file', '-s', BASE + ':' + path], stderr=subprocess.DEVNULL))
                if size > 64 * 1024 * 1024:
                    raise ValueError('Bounded preview file limit')
                body = subprocess.check_output(['git', 'show', BASE + ':' + path], stderr=subprocess.DEVNULL)
            kind = mimetypes.guess_type(path)[0] or 'application/octet-stream'
            if path.endswith('.mjs'):
                kind = 'text/javascript'
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

server = ThreadingHTTPServer(('127.0.0.1', 58731), Handler)
binding = {'base': BASE, 'overlays': {key: {'path': str(value[0]), 'sha256': value[1]} for key, value in OVERLAYS.items()}, 'port': server.server_port, 'scope': 'Six held Couch mode-departure inputs over exactf61. No P08/P05 overlay, timing or game-state fixture.'}
(ROOT / '.cache/p03a1-mode-departure/native-preview-binding.json').write_text(json.dumps(binding, indent=2) + '\n')
print('Held Couch departure preview: http://127.0.0.1:58731/game/', flush=True)
server.serve_forever()
