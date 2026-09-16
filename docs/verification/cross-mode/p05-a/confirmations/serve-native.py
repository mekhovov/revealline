from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote, urlsplit
import subprocess, mimetypes, hashlib, json

ROOT = Path.cwd()
BASE = 'b67a739a5acc495f2b7aca0905d1a2de5e91e8a7'
P03 = ROOT.parent / 'p03a-navigation'
OVERLAYS = {
    'game/app.mjs': (ROOT / '.cache/p05-confirmation-dialogs/held-p03/app.mjs', '20ef09459f865b10d3ecee6d082476800f9ddb7a6e3c2432e325116f117c2aca'),
    'game/index.html': (ROOT / '.cache/p05-confirmation-dialogs/held-p03/index.html', '6e2087e9d2f5b4c6f560f2ebb7ea3484cc9f00406813058c55d55f9c834618d5'),
    'game/ui/pixel-theme.css': (ROOT / 'game/ui/pixel-theme.css', 'de78f169100bd13c83bc16a4b95eca19e754b83ff95c2b73a1c59cbda20b8d98'),
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

server = ThreadingHTTPServer(('127.0.0.1', 53903), Handler)
binding = {'base': BASE, 'overlays': {key: {'path': str(value[0]), 'sha256': value[1]} for key, value in OVERLAYS.items()}, 'port': server.server_port, 'scope': 'Root native confirmation geometry only. Exact Git fallback; no game-state hooks.'}
(ROOT / '.cache/p05-confirmation-dialogs/native-preview-binding.json').write_text(json.dumps(binding, indent=2) + '\n')
print('Held confirmation layout preview: http://127.0.0.1:53903/game/', flush=True)
server.serve_forever()
