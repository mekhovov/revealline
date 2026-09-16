from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote, urlsplit
import subprocess, mimetypes, hashlib, json, time

ROOT = Path.cwd()
BASE = 'bb372a012ec2d12cf89bba1b251a4721e30b3c13'
OVERLAYS = {
 'game/couch/relay-rescue.mjs': (ROOT / 'game/couch/relay-rescue.mjs', '892e065c39a1c9afbf62d5c7a8b032177cc04e6c8f5c4c7916e076bac9e51ca1'),
 'game/couch/relay-rescue.html': (ROOT / 'game/couch/relay-rescue.html', 'c0654cb5f3f52843e371ffbcb203a3e680d0bd89e9887a21609ac304c2f51a56'),
 'game/couch/relay-rescue.css': (ROOT / 'game/couch/relay-rescue.css', 'd640e6bcbb3c72b3fc6f9a9297740a6636862ea0c1b0432c33e609688b632409'),
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

server = ThreadingHTTPServer(('127.0.0.1', 61341), Handler)
binding = {'base': BASE, 'overlays': {key: {'path': str(value[0]), 'sha256': value[1]} for key, value in OVERLAYS.items()}, 'port': server.server_port, 'scope': 'Team departure source-held-03 over exact bb372; three exact runtime overlays, no timing or state fixtures.'}
(ROOT / '.cache/p03i-team-departure/native-preview-binding.json').write_text(json.dumps(binding, indent=2) + '\n')
print('Held Team departure preview: http://127.0.0.1:61341/game/', flush=True)
server.serve_forever()
