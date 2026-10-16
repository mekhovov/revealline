"""Local review of unchanged framework ZIP entries; no source-tree fallback."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit
import json, mimetypes, sys, zipfile

archive = Path(sys.argv[1]).resolve()
port = int(sys.argv[2])
package = zipfile.ZipFile(archive)
entries = set(package.namelist())
mimetypes.add_type('text/javascript', '.mjs')
mimetypes.add_type('application/manifest+json', '.webmanifest')
headers = {
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob: https:; font-src 'self'; connect-src 'self' https:; worker-src 'self'; manifest-src 'self'; frame-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'none'; form-action 'none'",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'Cache-Control': 'no-cache',
}

class Handler(BaseHTTPRequestHandler):
    def do_HEAD(self): self.respond(False)
    def do_GET(self): self.respond(True)
    def respond(self, body):
        name = unquote(urlsplit(self.path).path)
        if not name.startswith('/') or '\\' in name or any(ord(c) < 32 for c in name):
            self.send_error(400); return
        parts = name.split('/')[1:]
        if any(p == '..' or p.startswith('.') for p in parts if p):
            self.send_error(403); return
        name = '/'.join(parts)
        if name == 'distribution.zip':
            size, stream = archive.stat().st_size, lambda: archive.open('rb')
        else:
            if not name or name.endswith('/'):
                name += 'index.html'
            elif name not in entries and name + '/index.html' in entries:
                self.send_response(308); self.send_header('Location', '/' + name + '/'); self.end_headers(); return
            if name not in entries:
                self.send_error(404); return
            info = package.getinfo(name)
            size, stream = info.file_size, lambda: package.open(name)
        self.send_response(200)
        self.send_header('Content-Type', mimetypes.guess_type(name)[0] or 'application/octet-stream')
        self.send_header('Content-Length', str(size))
        for key, value in headers.items(): self.send_header(key, value)
        self.end_headers()
        if body:
            try:
                with stream() as source:
                    while chunk := source.read(1024 * 1024): self.wfile.write(chunk)
            except (BrokenPipeError, ConnectionResetError): pass
    def log_message(self, *_): pass

print(json.dumps({'archive': str(archive), 'entries': len(entries), 'url': f'http://127.0.0.1:{port}', 'sourceFallback': False}), flush=True)
ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
