from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote, urlsplit
import hashlib, json, mimetypes, subprocess, sys, threading, time

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / '.cache/r5-adaptation'
CONFIG_PATH = CACHE / 'preview-inputs.json'
CONFIG_HASH = '0d3ec400349aaca1a702acf96adb2b92c27a98dbaa5fb226f015d51b5c4c928c'
raw = CONFIG_PATH.read_bytes()
if hashlib.sha256(raw).hexdigest() != CONFIG_HASH:
    raise RuntimeError('Preview binding changed')
config = json.loads(raw)
BASE = config['base']
if len(config['overlays']) != 1 or set(config['overlays']) != {'game/couch/couch.mjs'}:
    raise RuntimeError('One exact Couch runtime overlay is required')
DELAY = 6 if sys.argv[1:] == ['delayed'] else 0
if sys.argv[1:] not in ([], ['delayed']):
    raise RuntimeError('Only normal or delayed fixture is supported')
OVERLAYS = config['overlays']
for name, row in OVERLAYS.items():
    body = (ROOT / name).read_bytes()
    if len(body) != row['bytes'] or hashlib.sha256(body).hexdigest() != row['sha256']:
        raise RuntimeError('Held overlay changed: ' + name)
SLOTS = threading.BoundedSemaphore(4)

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = unquote(urlsplit(self.path).path).lstrip('/')
        if not path or path.endswith('/'):
            path += 'index.html'
        if any(p in ('.', '..', '.git', 'node_modules') for p in path.split('/')) or not path.startswith(('game/', 'authoring/', 'docs/')):
            self.send_error(404)
            return
        with SLOTS:
            self.send_file(path)
    def send_file(self, path):
        process = None
        sent = False
        try:
            if path in OVERLAYS:
                row = OVERLAYS[path]
                body = (ROOT / path).read_bytes()
                if len(body) != row['bytes'] or hashlib.sha256(body).hexdigest() != row['sha256']:
                    self.send_error(409, 'Held preview input changed')
                    return
                size = len(body)
            else:
                size = int(subprocess.check_output(['git', 'cat-file', '-s', BASE + ':' + path], cwd=ROOT, stderr=subprocess.DEVNULL))
                if size > 64 * 1024 * 1024:
                    raise ValueError('Bounded preview member limit')
                body = None
            if DELAY and path == config['delayedOriginal']['path']:
                time.sleep(DELAY)
            kind = 'text/javascript' if path.endswith('.mjs') else mimetypes.guess_type(path)[0] or 'application/octet-stream'
            if body is None:
                process = subprocess.Popen(['git', 'show', BASE + ':' + path], cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
            self.send_response(200)
            self.send_header('Content-Type', kind)
            self.send_header('Content-Length', str(size))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            sent = True
            if body is not None:
                self.wfile.write(body)
            else:
                while True:
                    chunk = process.stdout.read(65536)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except (OSError, ValueError, subprocess.CalledProcessError):
            if not sent:
                self.send_error(404)
        finally:
            if process is not None:
                process.stdout.close()
                process.wait()
    def log_message(self, format, *args):
        pass

server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
server.daemon_threads = True
binding = {**config, 'port': server.server_port, 'delaySeconds': DELAY,
           'configurationSha256': CONFIG_HASH,
           'helperSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
           'transfer': 'At most4 body readers;64KiB Git streaming;64MiB member bound; SHA-bound local overlays only.'}
name = 'preview-delayed.json' if DELAY else 'preview-normal.json'
with (CACHE / name).open('x') as out:
    out.write(json.dumps(binding, indent=2) + '\n')
print('P03 Ready focus source preview: http://127.0.0.1:' + str(server.server_port) + '/game/couch/ delay=' + str(DELAY), flush=True)
server.serve_forever()
