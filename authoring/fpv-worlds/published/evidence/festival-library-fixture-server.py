#!/usr/bin/env python3
"""Manual Festival listing fixture: read-through admitted ZIP, no extracted copy."""
import hashlib
import json
import mimetypes
import pathlib
import sys
import threading
import urllib.parse
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = pathlib.Path(__file__).resolve().parent
BUNDLE = pathlib.Path('/Users/oleksandr.mekhovov/.codex/worktrees/fpv-stadium-structures/go_test/.cache/fpv-graphical-hud-qualification-614adef/optional-bundle')
CATALOGUE = pathlib.Path('/private/tmp/fpv-festival-library-20261005/authoring/fpv-worlds/published/surface-coating-v1/index.json')
ZIP_SHA = '286e891978b48c8b8a007803cf3f00c491520b10c53da57a9a9060e1950e9e41'
MANIFEST_SHA = '9cea7dc1fa5b8ef9cc275e24b272ab8ad5f3734b1e46bfb3d8ebe5bbb5e5b4f7'
INDEX_URL = 'https://raw.githubusercontent.com/mekhovov/revealline/main/authoring/fpv-worlds/published/surface-coating-v1/index.json'
ENTRY = 'optional-practice/fpv-worlds/index.html'
FIXTURE_ENTRY = '/optional-practice/fpv-worlds/festival-fixture.html'
sha = lambda data: hashlib.sha256(data).hexdigest()
zip_path = BUNDLE / 'distribution-optional-fpv-worlds.zip'
assert sha(zip_path.read_bytes()) == ZIP_SHA, 'admitted ZIP changed'
manifest_bytes = (BUNDLE / 'manifest-optional-fpv-worlds.json').read_bytes()
assert sha(manifest_bytes) == MANIFEST_SHA, 'admitted manifest changed'
manifest = json.loads(manifest_bytes)
package = zipfile.ZipFile(zip_path)
lock = threading.Lock()
pins = {f['path']: f for f in manifest['files']}
assert len(package.namelist()) == len(set(package.namelist()))
assert set(package.namelist()) == set(pins) | {'optional-package.json'}
assert package.read('optional-package.json') == manifest_bytes
for name, pin in pins.items():
    data = package.read(name)
    assert len(data) == pin['bytes'] and sha(data) == pin['sha256'], name
catalogue = CATALOGUE.read_bytes()
rows = json.loads(catalogue)['worlds']
assert [row['id'] for row in rows] == ['mountain-reservoir', 'festival-grounds']
assert rows[1]['sha256'] == '87baca276e174f31ba19c02f4f2359c97affa07eefd4a5f4912b4d8664450f51'
assert INDEX_URL.encode() in package.read('optional-practice/fpv-worlds/worker.js')
provenance = {
    'format': 'FestivalLibraryManualBrowserFixture.v1',
    'sourceRevision': manifest['engineCommit'],
    'sourceTree': manifest['engineTree'],
    'packageRevision': manifest['revision'],
    'zipSHA256': ZIP_SHA,
    'manifestSHA256': MANIFEST_SHA,
    'validatedManifestMembers': len(pins),
    'catalogueHead': '6bdf8ca523e6e777a333fe262dc9324a289fce00',
    'catalogueSHA256': sha(catalogue),
    'catalogueBytes': len(catalogue),
    'interceptedURL': INDEX_URL,
    'catalogue': json.loads(catalogue),
    'scope': 'Native player and native Worker; only pending catalogue HTTPS response intercepted. Packs use original immutable HTTPS URLs, request options, hash checks, importer and atomic persistence. Fresh origin; no profile, clock, simulator or offline qualification overrides.',
}
(HERE / 'fixture.json').write_text(json.dumps(provenance, indent=2) + '\n')
bootstrap = (HERE / 'bootstrap.js').read_text().replace('__FIXTURE_CONFIG__', json.dumps({'indexURL': INDEX_URL, 'indexText': catalogue.decode(), 'provenance': provenance}))

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.respond(False)

    def do_HEAD(self):
        self.respond(True)

    def respond(self, head):
        path = urllib.parse.urlsplit(self.path).path
        if path == '/':
            self.send_response(302)
            self.send_header('Location', FIXTURE_ENTRY)
            self.end_headers()
            return
        if path == FIXTURE_ENTRY:
            data = package.read(ENTRY).replace(b'<head>', b'<head>\n    <script src="/fixture-bootstrap.js"></script>', 1)
            kind = 'text/html; charset=utf-8'
        elif path == '/fixture-bootstrap.js':
            data, kind = bootstrap.encode(), 'text/javascript; charset=utf-8'
        elif path == '/fixture-worker.js':
            data, kind = (HERE / 'worker.js').read_bytes(), 'text/javascript; charset=utf-8'
        elif path == '/fixture.json':
            data, kind = (HERE / 'fixture.json').read_bytes(), 'application/json'
        elif path == '/catalogue.json':
            data, kind = catalogue, 'application/json'
        else:
            name = path.removeprefix('/')
            if name not in pins and name != 'optional-package.json':
                self.send_error(404)
                return
            with lock:
                data = package.read(name)
            if name in pins:
                assert len(data) == pins[name]['bytes'] and sha(data) == pins[name]['sha256']
            kind = 'text/javascript' if name.endswith(('.mjs', '.js')) else (mimetypes.guess_type(name)[0] or 'application/octet-stream')
        self.send_response(200)
        self.send_header('Content-Type', kind)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        if not head:
            self.wfile.write(data)

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8991
print(json.dumps({'url': f'http://127.0.0.1:{port}{FIXTURE_ENTRY}', 'provenance': provenance}), flush=True)
ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
