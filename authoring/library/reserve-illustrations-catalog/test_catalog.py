"""The sparse preview serves a bounded UI closure, never a repository fallback."""
import importlib.util
from html.parser import HTMLParser
from pathlib import Path
import re
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import urlopen

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('reserve_catalog', HERE / 'catalog.py')
catalog = importlib.util.module_from_spec(spec)
spec.loader.exec_module(catalog)


class RuntimeEntries(HTMLParser):
    """Read the actual launcher/module/style roots, including its data-module entry."""
    def __init__(self):
        super().__init__()
        self.references = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'script':
            self.references.extend(attrs[key] for key in ('src', 'data-module') if attrs.get(key))
        elif tag == 'link' and 'stylesheet' in attrs.get('rel', '').split():
            self.references.append(attrs['href'])


class ControllerRoutes(unittest.TestCase):
    def test_current_literal_module_and_style_dependencies_are_explicit(self):
        routes = catalog.controller_routes()
        local = {'/' + catalog.PREFIX + name: (HERE / name, mime) for name, mime in catalog.LOCAL.items()}
        allowed = {**routes, **local}
        html = RuntimeEntries()
        html.feed((HERE / 'index.html').read_text())
        self.assertTrue(html.references, 'The live HTML must declare its runtime entries')
        pending = []
        for reference in html.references:
            target = (HERE / reference).resolve()
            route = '/' + target.relative_to(catalog.ROOT).as_posix()
            self.assertIn(route, allowed, f'index.html requires {route}')
            pending.append(target)
        seen = set()
        edges = set()
        while pending:
            source = pending.pop()
            if source in seen:
                continue
            seen.add(source)
            if source.suffix not in ('.mjs', '.js', '.css'):
                continue
            text = source.read_text()
            references = re.findall(r'''(?:\b(?:import|export)\s+(?:[^;]*?\s+from\s*)?|\bimport\s*\()\s*['"](\.[^'"]+)['"]''', text)
            references += re.findall(r'''new URL\(\s*['"](\.[^'"]+\.(?:css|js|mjs|woff2|ttf))['"]\s*,\s*import.meta.url''', text)
            if source.suffix == '.css':
                references += re.findall(r'''url\(\s*['"]?(\.[^'"\s)]+)''', text)
            for reference in references:
                target = (source.parent / reference).resolve()
                route = '/' + target.relative_to(catalog.ROOT).as_posix()
                self.assertIn(route, allowed, f'{source.name} requires {route}')
                edges.add((source.relative_to(catalog.ROOT).as_posix(), route))
                pending.append(target)
        self.assertIn(('game/ui/controller-router.mjs', '/game/couch/controller-profiles.mjs'), edges)
        self.assertEqual(len(routes), len(catalog.CONTROLLER_FILES))
        self.assertEqual(
            [path for path in routes if path.endswith(('.png', '.jpg', '.webp', '.mp4'))],
            ['/game/ui/art/identity/fpv-line/icon-192.png'],
        )

    def test_live_server_serves_exact_ui_bytes_and_rejects_outside_paths(self):
        server = catalog.create_server({}, 0)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f'http://127.0.0.1:{server.server_port}'
        try:
            original = (HERE / 'index.html').read_bytes()
            marker = f'<meta name="revealline-reference-home" content="/{catalog.PREFIX}index.html">'.encode()
            with urlopen(base + '/' + catalog.PREFIX + 'index.html') as response:
                self.assertEqual(response.read(), original.replace(b'</head>', marker + b'\n</head>', 1))
            self.assertEqual((HERE / 'index.html').read_bytes(), original)
            for path, mime in (
                ('authoring/design-atlas/reveal-audit-viewer.mjs', 'text/javascript'),
                ('authoring/production/model.mjs', 'text/javascript'),
                ('authoring/production/preview.mjs', 'text/javascript'),
                ('game/ui/authoring-reference-entry.mjs', 'text/javascript'),
                ('game/couch/controller-profiles.mjs', 'text/javascript'),
                ('game/ui/authoring-input.css', 'text/css'),
                ('game/ui/brand-identity.css', 'text/css'),
                ('game/ui/art/identity/fpv-line/icon-192.png', 'image/png'),
                ('game/ui/fonts/departure-mono/DepartureMono-Regular.woff2', 'font/woff2'),
            ):
                with urlopen(base + '/' + path) as response:
                    self.assertEqual(response.headers.get_content_type(), mime)
                    self.assertEqual(response.read(), (catalog.ROOT / path).read_bytes())
            for path in ('/game/app.mjs', '/game/couch/app.mjs', '/game/content/campaign.json', '/authoring/production/app.mjs', '/authoring/design-atlas/reveal-audit.html', '/.git/config', '/game/ui/../../app.mjs', '/game/ui/%2e%2e/app.mjs'):
                with self.assertRaises(HTTPError) as error:
                    urlopen(base + path)
                self.assertEqual(error.exception.code, 404)
                error.exception.close()
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == '__main__':
    unittest.main()
