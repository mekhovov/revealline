"""The sparse preview serves a bounded UI closure, never a repository fallback."""
import importlib.util
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


class ControllerRoutes(unittest.TestCase):
    def test_current_literal_module_and_style_dependencies_are_explicit(self):
        routes = catalog.controller_routes()
        pending = [catalog.ROOT / name for name in (
            'game/ui/authoring-reference-entry.mjs',
            'game/ui/direct-tool-launch.js',
            'game/ui/operation-status.css',
            'authoring/library/reserve-illustrations-catalog/catalog.mjs',
        )]
        seen = set()
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
                self.assertIn(route, routes, f'{source.name} requires {route}')
                pending.append(target)
        self.assertEqual(len(routes), len(catalog.CONTROLLER_FILES))
        self.assertTrue(all(not path.endswith(('.png', '.jpg', '.webp', '.mp4')) for path in routes))

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
                ('game/ui/authoring-reference-entry.mjs', 'text/javascript'),
                ('game/ui/authoring-input.css', 'text/css'),
                ('game/ui/fonts/departure-mono/DepartureMono-Regular.woff2', 'font/woff2'),
            ):
                with urlopen(base + '/' + path) as response:
                    self.assertEqual(response.headers.get_content_type(), mime)
                    self.assertEqual(response.read(), (catalog.ROOT / path).read_bytes())
            for path in ('/game/app.mjs', '/game/content/campaign.json', '/.git/config', '/game/ui/../../app.mjs', '/game/ui/%2e%2e/app.mjs'):
                with self.assertRaises(HTTPError) as error:
                    urlopen(base + path)
                self.assertEqual(error.exception.code, 404)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == '__main__':
    unittest.main()
