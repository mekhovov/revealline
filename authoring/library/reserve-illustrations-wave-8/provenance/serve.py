"""Serve only the wave 7/wave 8 comparison and eight selected original PNGs."""
import argparse
import json
import stat
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


def main():
    cohort = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--previous', type=Path, default=cohort.parent / 'reserve-illustrations-wave-7')
    args = parser.parse_args()
    current = json.loads((cohort / 'manifest.json').read_text())
    previous = json.loads((args.previous / 'manifest.json').read_text())
    if current['wave'] != 8 or previous['wave'] != 7:
        raise ValueError('Expected exact wave 7 / wave 8 manifests')
    if len(current['entries']) != 4 or len(previous['entries']) != 4:
        raise ValueError('Expected four selected works per wave')
    routes = {'/': (cohort / 'provenance/index.html', 'text/html; charset=utf-8')}
    for prefix, base, manifest in [('current', cohort, current), ('previous', args.previous, previous)]:
        for row in manifest['entries']:
            path = base / row['file']
            if path.parent != base / 'originals' or path.suffix != '.png':
                raise ValueError('Expected direct original PNG')
            if path.stat().st_size != row['bytes']:
                raise ValueError('Original size changed')
            routes[f'/{prefix}/{row["id"]}.png'] = (path, 'image/png')
    for path, _ in routes.values():
        if not stat.S_ISREG(path.lstat().st_mode) or path.is_symlink():
            raise ValueError(f'Expected ordinary retained file: {path}')

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            item = routes.get(urlsplit(self.path).path)
            if item is None:
                self.send_error(404)
                return
            path, mime = item
            raw = path.read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', mime)
            self.send_header('Content-Length', str(len(raw)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'")
            self.end_headers()
            self.wfile.write(raw)

    with ThreadingHTTPServer(('127.0.0.1', 0), Handler) as server:
        print(f'http://127.0.0.1:{server.server_port}/', flush=True)
        server.serve_forever()


if __name__ == '__main__':
    main()
