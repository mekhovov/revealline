"""Bounded real-Git/HTTP contracts; these fixtures do not measure native performance."""
import hashlib
import http.client
import importlib.util
import json
import os
from pathlib import Path
import select
import signal
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch

HELPER = Path(__file__).with_name('serve-pinned-game-review.py')
SPEC = importlib.util.spec_from_file_location('pinned_game_review', HELPER)
review = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(review)


class RepositoryFixture(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixture = tempfile.TemporaryDirectory(prefix='pinned-game-source-')
        cls.repo = Path(cls.fixture.name)
        cls.git('init', '-q', '--object-format=sha1')
        cls.git('config', 'user.name', 'Review Fixture')
        cls.git('config', 'user.email', 'fixture@example.invalid')
        cls.binary = bytes(range(256)) * 2 + b'\x00\xff\r\n'
        cls.write('game/index.html', b'<script src="app.mjs" type="module"></script>baseline')
        cls.write('game/app.mjs', b'export const source = "baseline";')
        cls.write('game/art/binary.bin', cls.binary)
        cls.write('game/empty.bin', b'')
        cls.write('game/test/private.mjs', b'not public')
        cls.write('game/.private', b'not public')
        cls.write('private.txt', b'not public')
        cls.write('docs/verification/private.html', b'not an observer')
        cls.write('authoring/tool.mjs', b'export const editor = true;')
        cls.write('game/executable.js', b'// regular executable blob')
        (cls.repo / 'game/executable.js').chmod(0o755)
        (cls.repo / 'game/link.bin').symlink_to('art/binary.bin')
        for path in review.OBSERVER_PATHS:
            cls.write(path, b'old observer')
        cls.baseline = cls.commit()
        cls.write('game/index.html', b'<script src="app.mjs" type="module"></script>candidate')
        cls.write('game/app.mjs', b'export const source = "candidate";')
        cls.observer_bytes = {}
        for path in review.OBSERVER_PATHS:
            cls.observer_bytes[path] = ('candidate observer ' + path).encode()
            cls.write(path, cls.observer_bytes[path])
        cls.candidate = cls.commit()
        (cls.repo / review.OBSERVER_PATHS[1]).unlink()
        (cls.repo / review.OBSERVER_PATHS[1]).symlink_to('../../game/app.mjs')
        cls.symlink_observer = cls.commit()
        cls.git('rm', '-q', review.OBSERVER_PATHS[1])
        cls.missing_observer = cls.commit()
        # A dirty worktree must never substitute for either pinned source.
        cls.write('game/index.html', b'DIRTY WORKTREE, DO NOT SERVE')
        cls.write('game/generated-only.mjs', b'UNTRACKED, DO NOT SERVE')

    @classmethod
    def tearDownClass(cls):
        cls.fixture.cleanup()

    @classmethod
    def git(cls, *args):
        env = {key: value for key, value in os.environ.items() if not key.startswith('GIT_')}
        env.update(GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_GLOBAL=os.devnull)
        return subprocess.check_output(
            ['git', '-c', 'core.hooksPath=' + os.devnull, *args], cwd=cls.repo,
            env=env, stderr=subprocess.DEVNULL, timeout=10,
        ).decode().strip()

    @classmethod
    def write(cls, path, body):
        target = cls.repo / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(body)

    @classmethod
    def commit(cls):
        cls.git('add', '-A')
        cls.git('commit', '-qm', 'Fixture', '--no-gpg-sign')
        return cls.git('rev-parse', 'HEAD')


class SourceContracts(RepositoryFixture):
    def test_exact_commit_and_tree_authority(self):
        reader = review.GitReader(self.repo)
        sources, observer, pins = review.prepare_sources(
            reader, self.baseline, self.candidate, self.candidate)
        self.assertEqual(sources['baseline']['commit'], self.baseline)
        self.assertEqual(sources['candidate']['tree'], self.git('rev-parse', self.candidate + '^{tree}'))
        self.assertIs(observer, sources['candidate'])
        for path, body in self.observer_bytes.items():
            self.assertEqual(pins[path], {
                'blob': self.git('rev-parse', self.candidate + ':' + path),
                'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest(),
            })

    def test_moving_refs_blob_pins_unknown_objects_and_wrong_observer_rejected(self):
        reader = review.GitReader(self.repo)
        blob = self.git('rev-parse', self.candidate + ':game/index.html')
        for pin in ['HEAD', self.candidate[:12], self.candidate.upper(), blob, '0' * 40]:
            with self.subTest(pin=pin), self.assertRaises(review.ReviewError):
                reader.snapshot(pin)
        for baseline, candidate, observer in [
            (self.baseline, self.candidate, self.baseline),
            (self.candidate, self.candidate, self.candidate),
            (self.baseline, self.symlink_observer, self.symlink_observer),
            (self.baseline, self.missing_observer, self.missing_observer),
        ]:
            with self.subTest(candidate=candidate, observer=observer), self.assertRaises(review.ReviewError):
                review.prepare_sources(reader, baseline, candidate, observer)

    def test_allowlist_admits_only_regular_public_source_and_two_observers(self):
        paths = review.GitReader(self.repo).snapshot(self.candidate)['paths']
        self.assertIn('game/executable.js', paths)
        self.assertIn('authoring/tool.mjs', paths)
        self.assertTrue(set(review.OBSERVER_PATHS) <= paths.keys())
        for name in ['game/link.bin', 'game/.private', 'game/test/private.mjs',
                     'private.txt', 'docs/verification/private.html', 'game/generated-only.mjs']:
            with self.subTest(name=name):
                self.assertNotIn(name, paths)

    def test_member_bound_is_checked_before_reading_body(self):
        reader = review.GitReader(self.repo, max_member_bytes=8)
        oid = self.git('rev-parse', self.candidate + ':game/art/binary.bin')
        with patch.object(reader, 'git', wraps=reader.git) as command:
            with self.assertRaisesRegex(review.ReviewError, 'byte bound'):
                reader.blob(oid)
        self.assertEqual([call.args[:2] for call in command.call_args_list], [('cat-file', '-s')])
        self.assertEqual(reader.cached_bytes, 0)

    def test_git_output_bound_and_blob_identity_fail_closed(self):
        reader = review.GitReader(self.repo)
        oid = self.git('rev-parse', self.candidate + ':game/art/binary.bin')
        with self.assertRaisesRegex(review.ReviewError, 'byte bound'):
            reader.git('cat-file', 'blob', oid, limit=4)
        with patch.object(reader, 'git', side_effect=[b'3\n', b'bad']):
            with self.assertRaisesRegex(review.ReviewError, 'differ from their pin'):
                reader.blob(oid)
        self.assertEqual(reader.cache, {})

    def test_lru_retains_only_bounded_verified_payloads(self):
        reader = review.GitReader(self.repo, cache_bytes=70)
        baseline_oid = self.git('rev-parse', self.baseline + ':game/app.mjs')
        candidate_oid = self.git('rev-parse', self.candidate + ':game/app.mjs')
        html_oid = self.git('rev-parse', self.candidate + ':game/index.html')
        reader.blob(baseline_oid)
        reader.blob(candidate_oid)
        reader.blob(baseline_oid)
        self.assertEqual(list(reader.cache), [candidate_oid, baseline_oid])
        reader.blob(html_oid)
        self.assertEqual(list(reader.cache), [html_oid])
        self.assertLessEqual(reader.cached_bytes, 70)
        binary_oid = self.git('rev-parse', self.candidate + ':game/art/binary.bin')
        body, digest = reader.blob(binary_oid)
        self.assertEqual((body, digest), (self.binary, review.sha256(self.binary)))
        self.assertNotIn(binary_oid, reader.cache)
        with patch.object(review, 'MAX_CACHE_ENTRIES', 1):
            reader.blob(baseline_oid)
            reader.blob(candidate_oid)
            self.assertEqual(list(reader.cache), [candidate_oid])

    def test_reader_cannot_raise_limits_or_use_environment_git_override(self):
        for limits in [{'cache_bytes': -1}, {'cache_bytes': review.MAX_CACHE_BYTES + 1},
                       {'max_member_bytes': 0}, {'max_member_bytes': review.MAX_MEMBER_BYTES + 1}]:
            with self.subTest(limits=limits), self.assertRaises(review.ReviewError):
                review.GitReader(self.repo, **limits)
        with patch.dict(os.environ, {'GIT_DIR': '/not/this/repository', 'GIT_OBJECT_DIRECTORY': '/missing'}):
            reader = review.GitReader(self.repo)
        self.assertNotIn('GIT_DIR', reader.env)
        self.assertNotIn('GIT_OBJECT_DIRECTORY', reader.env)
        self.assertEqual(reader.snapshot(self.candidate)['commit'], self.candidate)


class HttpContracts(RepositoryFixture):
    def setUp(self):
        self.output = tempfile.TemporaryDirectory(prefix='pinned-game-receipts-')
        self.reader = review.GitReader(self.repo)
        self.sources, self.observer, _ = review.prepare_sources(
            self.reader, self.baseline, self.candidate, self.candidate)
        self.instances = []

    def tearDown(self):
        for server, thread, _ in self.instances:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)
            self.assertFalse(thread.is_alive())
        for _, _, log in self.instances:
            log.close()
        self.output.cleanup()

    def start(self, role='candidate', **log_limits):
        path = Path(self.output.name) / f'{role}-{len(self.instances)}.jsonl'
        log = review.ReceiptLog(path, **log_limits)
        server = review.ReviewServer(self.reader, self.sources[role], self.observer, log)
        thread = threading.Thread(target=server.serve_forever, kwargs={'poll_interval': 0.01})
        thread.start()
        self.instances.append((server, thread, log))
        self.assertEqual(server.server_address[0], '127.0.0.1')
        return server, path

    @staticmethod
    def request(server, path, method='GET', headers=None):
        connection = http.client.HTTPConnection('127.0.0.1', server.server_port, timeout=10)
        try:
            connection.request(method, path, headers=headers or {})
            response = connection.getresponse()
            return response.status, dict(response.getheaders()), response.read()
        finally:
            connection.close()

    def test_same_transport_serves_each_pin_and_identical_candidate_observers(self):
        for role, commit, label in [('baseline', self.baseline, b'baseline'),
                                    ('candidate', self.candidate, b'candidate')]:
            server, receipt = self.start(role)
            status, headers, body = self.request(server, '/game/?journey=fixture')
            self.assertEqual(status, 200)
            self.assertEqual(body, b'<script src="app.mjs" type="module"></script>' + label)
            self.assertEqual(headers['Cache-Control'], 'no-store')
            self.assertEqual(headers['X-Content-Type-Options'], 'nosniff')
            for path, expected in self.observer_bytes.items():
                status, _, body = self.request(server, '/' + path)
                self.assertEqual((status, body), (200, expected))
            rows = [json.loads(line) for line in receipt.read_text().splitlines()]
            self.assertEqual(len(rows), 3)
            self.assertTrue(all(row['sourceCommit'] == commit for row in rows))
            self.assertTrue(all(row['sourceTree'] == self.sources[role]['tree'] for row in rows))
            self.assertEqual(rows[0]['servedCommit'], commit)
            self.assertFalse(rows[0]['observerOverlay'])
            for row in rows[1:]:
                self.assertEqual(row['event'], 'response-prepared')
                self.assertEqual(row['servedCommit'], self.candidate)
                self.assertEqual(row['servedTree'], self.observer['tree'])
                self.assertTrue(row['observerOverlay'])
                self.assertEqual(row['sha256'], review.sha256(self.observer_bytes[row['path']]))

    def test_binary_bytes_and_closed_open_suffix_clamped_ranges(self):
        server, receipt = self.start()
        status, headers, body = self.request(server, '/game/art/binary.bin')
        self.assertEqual((status, body), (200, self.binary))
        self.assertEqual(headers['Content-Length'], str(len(self.binary)))
        for value, low, high in [('bytes=0-3', 0, 4), ('bytes=255-', 255, len(self.binary)),
                                 ('bytes=-4', len(self.binary) - 4, len(self.binary)),
                                 ('bytes=500-9999', 500, len(self.binary)),
                                 ('bytes=-9999', 0, len(self.binary))]:
            with self.subTest(value=value):
                status, headers, body = self.request(server, '/game/art/binary.bin', headers={'Range': value})
                self.assertEqual((status, body), (206, self.binary[low:high]))
                self.assertEqual(headers['Content-Length'], str(high - low))
                self.assertEqual(headers['Content-Range'], f'bytes {low}-{high - 1}/{len(self.binary)}')
        rows = [json.loads(line) for line in receipt.read_text().splitlines()]
        self.assertTrue(all(row['sha256'] == review.sha256(self.binary) for row in rows))
        self.assertEqual(rows[1]['range'], [0, 4])
        self.assertEqual(rows[1]['responseBytes'], 4)

    def test_head_has_correct_headers_and_no_payload_including_range(self):
        server, receipt = self.start()
        for headers, status, length in [({}, 200, len(self.binary)), ({'Range': 'bytes=1-3'}, 206, 3)]:
            actual, response_headers, body = self.request(server, '/game/art/binary.bin', 'HEAD', headers)
            self.assertEqual((actual, body), (status, b''))
            self.assertEqual(response_headers['Content-Length'], str(length))
        rows = [json.loads(line) for line in receipt.read_text().splitlines()]
        self.assertTrue(all(row['responseBytes'] == 0 and row['method'] == 'HEAD' for row in rows))

    def test_invalid_unsatisfiable_and_duplicate_ranges_refused(self):
        server, _ = self.start()
        for value in ['bytes=1-0', 'bytes=9999-', 'bytes=-0', 'bytes=-', 'bytes=1-2,4-5',
                      'items=1-2', 'bytes=' + '9' * 5000 + '-']:
            with self.subTest(value=value[:40]):
                status, headers, body = self.request(server, '/game/art/binary.bin', headers={'Range': value})
                self.assertEqual((status, body), (416, b''))
                self.assertEqual(headers['Content-Range'], f'bytes */{len(self.binary)}')
        connection = http.client.HTTPConnection('127.0.0.1', server.server_port, timeout=10)
        try:
            connection.putrequest('GET', '/game/art/binary.bin')
            connection.putheader('Range', 'bytes=0-1')
            connection.putheader('Range', 'bytes=2-3')
            connection.endheaders()
            response = connection.getresponse()
            self.assertEqual(response.status, 416)
            response.read()
        finally:
            connection.close()
        self.assertEqual(self.request(server, '/game/empty.bin')[::2], (200, b''))
        self.assertEqual(self.request(server, '/game/empty.bin', headers={'Range': 'bytes=0-0'})[0], 416)

    def test_host_service_worker_and_mutating_requests_refused(self):
        server, receipt = self.start()
        for headers in [{'Host': 'localhost:' + str(server.server_port)}, {'Host': 'example.invalid'},
                        {'Service-Worker': 'script'}]:
            with self.subTest(headers=headers):
                self.assertEqual(self.request(server, '/game/', headers=headers)[0], 403)
        for method in ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'TRACE', 'CONNECT']:
            with self.subTest(method=method):
                status, headers, body = self.request(server, '/game/', method)
                self.assertEqual((status, body), (405, b''))
                self.assertEqual(headers['Allow'], 'GET, HEAD')
        connection = http.client.HTTPConnection('127.0.0.1', server.server_port, timeout=10)
        try:
            connection.putrequest('GET', '/game/')
            connection.putheader('Host', '127.0.0.1:' + str(server.server_port))
            connection.endheaders()
            response = connection.getresponse()
            self.assertEqual(response.status, 403)
            response.read()
        finally:
            connection.close()
        self.assertEqual(receipt.read_bytes(), b'')

    def test_traversal_symlinks_hidden_private_and_generated_files_refused(self):
        server, _ = self.start()
        for path in ['/game/../private.txt', '/game/%2e%2e/private.txt', '/game/%2eprivate',
                     '/game/art%5cbinary.bin', '/game/%00', '/game/link.bin',
                     '/game/test/private.mjs', '/game/generated-only.mjs',
                     '/docs/verification/private.html', '/private.txt', '/game/missing.mjs']:
            with self.subTest(path=path):
                self.assertEqual(self.request(server, path)[0], 404)
        self.assertEqual(self.request(server, '/game/%ff')[0], 413)
        self.assertEqual(self.request(server, '/game/' + 'a' * 2048)[0], 414)
        self.assertEqual(self.request(server, 'http://example.invalid/game/', headers={
            'Host': '127.0.0.1:' + str(server.server_port)})[0], 413)

    def test_javascript_mime_redirect_and_member_failure_are_explicit(self):
        server, _ = self.start()
        status, headers, body = self.request(server, '/')
        self.assertEqual((status, headers['Location'], body), (308, '/game/', b''))
        status, headers, body = self.request(server, '/game/app.mjs')
        self.assertEqual((status, headers['Content-Type'], body),
                         (200, 'text/javascript', b'export const source = "candidate";'))
        with patch.object(self.reader, 'blob', side_effect=review.ReviewError('unavailable')):
            self.assertEqual(self.request(server, '/game/app.mjs')[0], 413)

    def test_receipt_exhaustion_fails_before_offering_source_bytes(self):
        server, receipt = self.start(max_events=1)
        self.assertEqual(self.request(server, '/game/app.mjs')[0], 200)
        status, _, body = self.request(server, '/game/app.mjs')
        self.assertEqual(status, 503)
        self.assertNotIn(b'export const source', body)
        self.assertEqual(len(receipt.read_text().splitlines()), 1)
        with self.assertRaises(FileExistsError):
            review.ReceiptLog(receipt)
        other, receipt = self.start(max_bytes=1)
        self.assertEqual(self.request(other, '/game/app.mjs')[0], 503)
        self.assertEqual(receipt.read_bytes(), b'')

    def test_cli_records_exact_bindings_and_shuts_down_owned_servers(self):
        out = Path(self.output.name) / 'cli'
        command = [sys.executable, '-B', str(HELPER), '--repo', str(self.repo),
                   '--baseline', self.baseline, '--candidate', self.candidate,
                   '--observer-ref', self.candidate, '--out', str(out)]
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        try:
            self.assertTrue(select.select([process.stdout], [], [], 10)[0], 'CLI did not start')
            binding = json.loads(process.stdout.readline())
            self.assertEqual(json.loads((out / 'binding.json').read_text()), binding)
            self.assertEqual(binding['helperSha256'], review.sha256(HELPER.read_bytes()))
            self.assertEqual(binding['observer']['commit'], self.candidate)
            self.assertEqual(binding['sources']['baseline']['commit'], self.baseline)
            self.assertEqual(binding['sources']['candidate']['commit'], self.candidate)
            urls = [row['url'] for row in binding['sources'].values()]
            self.assertNotEqual(urls[0], urls[1])
            self.assertTrue(all(url.startswith('http://127.0.0.1:') for url in urls))
            self.assertIn('not confirmed browser consumption', binding['receiptSemantics'])
        finally:
            process.send_signal(signal.SIGINT)
            _, error = process.communicate(timeout=10)
        self.assertEqual(process.returncode, 0, error)
        duplicate = subprocess.run(command, capture_output=True, text=True, timeout=10)
        self.assertNotEqual(duplicate.returncode, 0)
        self.assertIn('FileExistsError', duplicate.stderr)


if __name__ == '__main__':
    unittest.main()
