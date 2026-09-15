"""Validate the committed reserve references; optionally serve them without a checkout."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlsplit

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SOURCE = '091936e27c3b9f1c061081ca93827014a927d963'
PREFIX = 'authoring/library/reserve-illustrations-catalog/'
INVENTORY = 'authoring/library/reserve-illustrations-wave-10/provenance/selected-inventory-40.json'
THEMES = {'fpv': 'FPV Front', 'ukraine': 'Ukraine Atlas', 'retro': '1994 Forever', 'coupa': 'Spend Network'}
LOCAL = {'index.html': 'text/html', 'catalog.css': 'text/css', 'catalog.mjs': 'text/javascript', 'manifest.json': 'application/json', 'README.md': 'text/plain'}


def git(*args):
    return subprocess.check_output(['git', '--no-replace-objects', '-C', str(ROOT), *args])


def source_text(path):
    return git('show', f'{SOURCE}:{path}')


def expected_manifest():
    rows = {}
    for raw in git('ls-tree', '-rlz', SOURCE, '--', 'authoring/library').split(b'\0'):
        if not raw:
            continue
        meta, path = raw.decode().split('\t')
        mode, kind, oid, size = meta.split()
        rows[path] = (mode, kind, oid, int(size))

    def pin(path, recorded_sha=None):
        mode, kind, oid, size = rows[path]
        assert mode == '100644' and kind == 'blob', path
        assert re.fullmatch(r'authoring/library/[A-Za-z0-9./_-]+', path) and '..' not in path.split('/')
        sha = recorded_sha
        if sha is None:
            assert size <= 256 * 1024, path
            body = source_text(path)
            assert len(body) == size
            sha = hashlib.sha256(body).hexdigest()
        assert re.fullmatch('[0-9a-f]{64}', sha)
        return {'path': path, 'url': '../' + path.removeprefix('authoring/library/'), 'bytes': size, 'gitBlob': oid, 'sha256': sha}

    inventory = json.loads(source_text(INVENTORY))
    assert inventory['selectedWorks'] == 40 and len(inventory['entries']) == 40
    entries = []
    for wave in range(1, 11):
        directory = f'authoring/library/reserve-illustrations-wave-{wave}/'
        notes = pin(directory + 'README.md')
        if wave == 1:
            source_path = directory + 'provenance/originals.json'
            sources = json.loads(source_text(source_path))['rows']
            titles = dict(re.findall(r'\[([^\]]+)\]\(originals/([^()]+)\.png\)', source_text(notes['path']).decode()))
            titles = {filename: title for title, filename in titles.items()}
        else:
            manifest = json.loads(source_text(directory + 'manifest.json'))
            source_path = directory + manifest['selectionProvenance']
            sources = manifest['entries']
        provenance = pin(source_path)
        for original in [x for x in inventory['entries'] if x['wave'] == wave]:
            record = next(x for x in sources if x['id'] == original['id'])
            path = directory + record['file']
            assert path == original['path']
            for field in ['bytes', 'sha256', 'width', 'height']:
                assert record[field] == original[field], (path, field)
            image = pin(path, original['sha256'])
            assert image['bytes'] == original['bytes']
            if 'gitBlob' in original:
                assert image['gitBlob'] == original['gitBlob']
            prompts = [pin(directory + record['prompt'])]
            if record.get('cleanupPrompt'):
                prompts.append(pin(directory + record['cleanupPrompt']))
            entries.append({'id': original['id'], 'title': titles[original['id']] if wave == 1 else record['title'], 'themeId': original['themeId'], 'wave': wave, 'width': original['width'], 'height': original['height'], 'sourceOnly': True, 'original': image, 'prompts': prompts, 'provenance': provenance, 'notes': notes})
    assert len({x['id'] for x in entries}) == 40
    assert len({x['original']['path'] for x in entries}) == 40
    assert all(sum(x['themeId'] == theme for x in entries) == 10 for theme in THEMES)
    excluded = inventory['otherRetainedOriginalOutputs']
    for row in excluded:
        mode, kind, oid, size = rows[row['path']]
        assert (mode, kind, oid, size) == ('100644', 'blob', row['gitBlob'], row['bytes'])
        assert row['path'] not in {x['original']['path'] for x in entries}
    assert len(excluded) == 2
    return {'format': 'revealline-reserve-catalog.v1', 'sourceRevision': SOURCE, 'sourceOnly': True, 'selectedWorks': 40, 'selectedOriginalBytes': sum(x['original']['bytes'] for x in entries), 'themes': THEMES, 'inventory': pin(INVENTORY), 'verificationScope': 'Original SHA-256 and dimensions come from committed inspection records. Git modes, blob IDs and lengths plus all linked text hashes are checked here; this command does not decode or rehash PNG bodies.', 'excludedRetainedOriginals': excluded, 'entries': entries}


def check():
    expected = expected_manifest()
    actual = json.loads((HERE / 'manifest.json').read_text())
    assert actual == expected, 'Manifest differs from the pinned selected-source records'
    pins = {expected['inventory']['path']: expected['inventory']}
    for entry in expected['entries']:
        for pin in [entry['original'], *entry['prompts'], entry['provenance'], entry['notes']]:
            assert pin['path'] not in pins or pins[pin['path']] == pin
            pins[pin['path']] = pin
    return expected, pins


def serve(pins, port):
    routes = {'/' + path: pin for path, pin in pins.items()}
    local = {'/' + PREFIX + name: (HERE / name, mime) for name, mime in LOCAL.items()}

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.respond(False)

        def do_HEAD(self):
            self.respond(True)

        def respond(self, head):
            path = urlsplit(self.path).path
            if path in ('/', '/' + PREFIX, '/' + PREFIX.rstrip('/')):
                self.send_response(302)
                self.send_header('Location', '/' + PREFIX + 'index.html')
                self.end_headers()
                return
            if path in local:
                source, mime = local[path]
                body = source.read_bytes()
            elif path in routes:
                pin = routes[path]
                mime = 'image/png' if path.endswith('.png') else 'application/json' if path.endswith('.json') else 'text/plain'
                body = None if head else git('cat-file', 'blob', pin['gitBlob'])
                if body is not None and (len(body) != pin['bytes'] or hashlib.sha256(body).hexdigest() != pin['sha256']):
                    self.send_error(500, 'Pinned source identity mismatch')
                    return
            else:
                self.send_error(404)
                return
            self.send_response(200)
            self.send_header('Content-Type', mime + ('' if mime == 'image/png' else '; charset=utf-8'))
            self.send_header('Content-Length', str(len(body) if body is not None else routes[path]['bytes']))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.end_headers()
            if not head:
                try:
                    self.wfile.write(body)
                except (BrokenPipeError, ConnectionResetError):
                    pass

    server = HTTPServer(('127.0.0.1', port), Handler)
    print(json.dumps({'url': f'http://127.0.0.1:{server.server_port}/{PREFIX}index.html', 'sourceRevision': SOURCE, 'routes': len(routes) + len(local), 'imageRoutes': 40, 'writesOriginals': False}), flush=True)
    try:
        server.serve_forever()
    finally:
        server.server_close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--serve', action='store_true', help='Serve only catalog files and selected Git blobs on loopback; no checkout or disk cache')
    parser.add_argument('--port', type=int, default=0)
    args = parser.parse_args()
    manifest, pins = check()
    print(json.dumps({'status': 'verified', 'selectedWorks': 40, 'originalBytes': manifest['selectedOriginalBytes'], 'linkedGitBlobs': len(pins), 'excludedOriginals': 2, 'sourceRevision': SOURCE}), flush=True)
    if args.serve:
        serve(pins, args.port)
