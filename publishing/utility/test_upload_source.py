import contextlib
import copy
import hashlib
import http.server
import io
import json
from pathlib import Path
import socket
import subprocess
import sys
import tarfile
import tempfile
import threading
import types
import unittest
import zipfile

import upload_source as u

REPO, RELEASE, TAG = 'fixture/project', 17, 'v1.2.3'
PREFIX = f'/repos/{REPO}/releases/{RELEASE}'


class FixtureServer:
    def __init__(self, mode='ok'):
        self.mode, self.posts, self.gets, self.assets = mode, [], [], []
        owner = self

        class Handler(http.server.BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def send_json(self, status, data):
                body = json.dumps(data).encode()
                try:
                    self.send_response(status)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Content-Length', str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
                except (BrokenPipeError, ConnectionResetError):
                    pass

            def do_GET(self):
                owner.gets.append(self.path)
                if self.path == PREFIX:
                    obj = {'id': RELEASE, 'url': 'https://api.github.com' + PREFIX,
                           'draft': owner.mode != 'published', 'published_at': None,
                           'tag_name': TAG, 'assets_url': 'https://api.github.com' + PREFIX + '/assets',
                           'upload_url': 'https://uploads.github.com' + PREFIX + '/assets{?name,label}'}
                    if owner.mode == 'wrong-repository':
                        obj['url'] = 'https://api.github.com/repos/other/repo/releases/17'
                    if owner.mode == 'redirect-upload-host':
                        obj['upload_url'] = 'https://other.invalid/assets{?name,label}'
                    self.send_json(200, obj)
                elif self.path == f'/repos/{REPO}/git/ref/tags/{TAG}':
                    obj = {'type': 'commit', 'sha': 'a' * 40}
                    if owner.mode == 'wrong-tag-commit' or (owner.mode == 'tag-changed-after-send' and owner.posts):
                        obj['sha'] = 'b' * 40
                    if owner.mode in ('annotated-tag', 'tag-cycle'):
                        obj = {'type': 'tag', 'sha': 'c' * 40}
                    self.send_json(200, {'ref': 'refs/tags/' + TAG, 'object': obj})
                elif self.path == f'/repos/{REPO}/git/tags/' + 'c' * 40:
                    obj = {'type': 'commit', 'sha': 'a' * 40}
                    if owner.mode == 'tag-cycle':
                        obj = {'type': 'tag', 'sha': 'c' * 40}
                    self.send_json(200, {'sha': 'c' * 40, 'object': obj})
                elif self.path.startswith(PREFIX + '/assets?'):
                    page = int(self.path.rsplit('page=', 1)[1])
                    if owner.mode == 'duplicate-page2':
                        rows = [{'name': f'other-{i}'} for i in range(100)] if page == 1 else [{'name': 'source.tar'}]
                    else:
                        rows = owner.assets
                    self.send_json(200, rows)
                else:
                    self.send_json(404, {})

            def do_POST(self):
                size = int(self.headers['Content-Length'])
                body = self.rfile.read(size)
                owner.posts.append({'path': self.path, 'declared': size, 'bytes': len(body),
                                    'sha256': hashlib.sha256(body).hexdigest(),
                                    'type': self.headers.get('Content-Type'),
                                    'chunked': self.headers.get('Transfer-Encoding')})
                asset = {'id': 27, 'url': f'https://api.github.com/repos/{REPO}/releases/assets/27',
                         'name': 'source.tar', 'state': 'uploaded', 'size': len(body),
                         'digest': 'sha256:' + hashlib.sha256(body).hexdigest()}
                owner.assets = [asset]
                if owner.mode == 'server-failure':
                    self.send_json(502, {'message': 'ignored sensitive server details'})
                elif owner.mode == 'lost-response':
                    self.connection.shutdown(socket.SHUT_RDWR)
                    self.connection.close()
                elif owner.mode == 'bad-response-digest':
                    self.send_json(201, {**asset, 'digest': 'sha256:' + '0' * 64})
                elif owner.mode == 'redirect-response':
                    self.send_json(302, {'location': 'https://other.invalid/'})
                else:
                    self.send_json(201, asset)

        self.server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def api(self):
        return u.GitHub('synthetic-local-credential', _loopback=self.server.server_address, timeout=2)

    def close(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()


class UploaderTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.dir = Path(self.temp.name)
        data = io.BytesIO()
        with tarfile.open(fileobj=data, mode='w') as tar:
            payload = b'original fixture source\n'
            info = tarfile.TarInfo('fixture.txt')
            info.size = len(payload)
            tar.addfile(info, io.BytesIO(payload))
        self.tar = data.getvalue()
        self.outer = self.dir / 'qualified.zip'
        with zipfile.ZipFile(self.outer, 'w', compression=zipfile.ZIP_DEFLATED) as z:
            z.writestr(TAG + '/source.tar', self.tar)
        self.args = types.SimpleNamespace(outer_zip=str(self.outer), outer_bytes=self.outer.stat().st_size,
                    outer_sha256=hashlib.sha256(self.outer.read_bytes()).hexdigest(), source_bytes=len(self.tar),
                    source_sha256=hashlib.sha256(self.tar).hexdigest(), source_commit='a' * 40, tag=TAG,
                    inspection=str(self.dir / 'inspection.json'))
        self.inspection = {'format': 'revealline-qualified-artifact-offline-inspection.v1', 'status': 'PASS',
            'releaseHashChainVerified': True, 'gitHead': 'a' * 40, 'version': TAG,
            'artifact': {'prefix': TAG + '/', 'bytes': self.args.outer_bytes, 'sha256': self.args.outer_sha256,
                         'externallyExpectedDigestSupplied': True},
            'sourceTar': {'outerMember': TAG + '/source.tar', 'bytes': len(self.tar),
                          'sha256': self.args.source_sha256, 'copiedToDisk': False}}
        self.receipt()

    def receipt(self):
        path = Path(self.args.inspection)
        path.write_text(json.dumps(self.inspection))
        self.args.inspection_sha256 = hashlib.sha256(path.read_bytes()).hexdigest()

    def tearDown(self):
        self.assertFalse(any(p.name == 'source.tar' for p in self.dir.rglob('*')))
        self.temp.cleanup()

    @contextlib.contextmanager
    def server(self, mode='ok'):
        server = FixtureServer(mode)
        try:
            yield server
        finally:
            server.close()

    def test_stream_upload_exact_length_hash_and_readback(self):
        with self.server() as server, contextlib.closing(u.PinnedSource(self.args)) as source:
            result = u.perform(source, server.api(), REPO, RELEASE, TAG)
            self.assertEqual(result['status'], 'UPLOADED_VERIFIED')
            self.assertEqual(len(server.posts), 1)
            self.assertEqual(server.posts[0], {'path': PREFIX + '/assets?name=source.tar',
                'declared': len(self.tar), 'bytes': len(self.tar), 'sha256': self.args.source_sha256,
                'type': 'application/x-tar', 'chunked': None})
            self.assertEqual(len(server.gets), 6)

    def test_annotated_tag_resolves_exact_commit(self):
        with self.server('annotated-tag') as server, contextlib.closing(u.PinnedSource(self.args)) as source:
            self.assertEqual(u.perform(source, server.api(), REPO, RELEASE, TAG)['tagCommit'], 'a' * 40)
            self.assertEqual(len(server.posts), 1)

    def test_wrong_or_cyclic_tag_refused_before_post(self):
        for mode in ['wrong-tag-commit', 'tag-cycle']:
            with self.subTest(mode=mode), self.server(mode) as server, contextlib.closing(u.PinnedSource(self.args)) as source:
                with self.assertRaises(u.Refusal):
                    u.perform(source, server.api(), REPO, RELEASE, TAG)
                self.assertEqual(server.posts, [])

    def test_tag_change_after_send_is_ambiguous(self):
        with self.server('tag-changed-after-send') as server, contextlib.closing(u.PinnedSource(self.args)) as source:
            with self.assertRaises(u.Ambiguous):
                u.perform(source, server.api(), REPO, RELEASE, TAG)
            self.assertEqual(len(server.posts), 1)

    def test_inspected_root_member_layout_supported(self):
        with zipfile.ZipFile(self.outer, 'w') as z:
            z.writestr('source.tar', self.tar)
        self.args.outer_bytes = self.outer.stat().st_size
        self.args.outer_sha256 = hashlib.sha256(self.outer.read_bytes()).hexdigest()
        self.inspection['artifact'].update(prefix='', bytes=self.args.outer_bytes, sha256=self.args.outer_sha256)
        self.inspection['sourceTar']['outerMember'] = 'source.tar'
        self.receipt()
        with contextlib.closing(u.PinnedSource(self.args)) as source:
            self.assertEqual(source.member, 'source.tar')

    def test_bad_outer_hash_refused_locally(self):
        self.args.outer_sha256 = '0' * 64
        self.inspection['artifact']['sha256'] = self.args.outer_sha256
        self.receipt()
        with self.assertRaisesRegex(u.Refusal, 'Outer ZIP hash'):
            u.PinnedSource(self.args)

    def test_bad_source_hash_refused_before_http(self):
        self.args.source_sha256 = '0' * 64
        self.inspection['sourceTar']['sha256'] = self.args.source_sha256
        self.receipt()
        with self.server() as server:
            with self.assertRaisesRegex(u.Refusal, 'Source preflight hash'):
                u.PinnedSource(self.args)
            self.assertEqual(server.gets + server.posts, [])

    def test_wrong_source_length_and_receipt_pin_refused(self):
        wrong = copy.copy(self.args)
        wrong.source_bytes += 1
        with self.assertRaises(u.Refusal):
            u.PinnedSource(wrong)
        wrong = copy.copy(self.args)
        wrong.inspection_sha256 = '0' * 64
        with self.assertRaises(u.Refusal):
            u.PinnedSource(wrong)

    def test_duplicate_on_second_page_no_post(self):
        with self.server('duplicate-page2') as server, contextlib.closing(u.PinnedSource(self.args)) as source:
            with self.assertRaisesRegex(u.Refusal, 'already exists'):
                u.perform(source, server.api(), REPO, RELEASE, TAG)
            self.assertEqual(server.posts, [])
            self.assertTrue(server.gets[-1].endswith('page=2'))

    def test_published_wrong_repo_or_upload_host_refused(self):
        for mode in ['published', 'wrong-repository', 'redirect-upload-host']:
            with self.subTest(mode=mode), self.server(mode) as server, contextlib.closing(u.PinnedSource(self.args)) as source:
                with self.assertRaises(u.Refusal):
                    u.perform(source, server.api(), REPO, RELEASE, TAG)
                self.assertEqual(server.posts, [])

    def test_short_stream_is_ambiguous_never_retried(self):
        with self.server() as server:
            with self.assertRaisesRegex(u.Ambiguous, 'reread'):
                server.api().upload(PREFIX + '/assets?name=source.tar', io.BytesIO(b'abc'), 10, '0' * 64)
            # shutdown waits for the finite request handler before checking its result.
            server.server.shutdown()
            self.assertEqual(len(server.posts), 1)
            self.assertEqual(server.posts[0]['bytes'], 3)

    def test_server_failure_lost_response_or_redirect_never_retried(self):
        for mode in ['server-failure', 'lost-response', 'redirect-response', 'bad-response-digest']:
            with self.subTest(mode=mode), self.server(mode) as server, contextlib.closing(u.PinnedSource(self.args)) as source:
                with self.assertRaisesRegex(u.Ambiguous, 'reread'):
                    u.perform(source, server.api(), REPO, RELEASE, TAG)
                self.assertEqual(len(server.posts), 1)
                # Explicit second invocation rereads assets and refuses; no duplicate POST.
                with self.assertRaisesRegex(u.Refusal, 'already exists'):
                    u.perform(source, server.api(), REPO, RELEASE, TAG)
                self.assertEqual(len(server.posts), 1)

    def test_zip_changed_after_preflight_refused_before_post(self):
        with self.server() as server, contextlib.closing(u.PinnedSource(self.args)) as source:
            with self.outer.open('ab') as out:
                out.write(b'changed')
            with self.assertRaisesRegex(u.Refusal, 'changed'):
                u.perform(source, server.api(), REPO, RELEASE, TAG)
            self.assertEqual(server.posts, [])

    def test_cli_default_local_only_without_auth_or_tar_copy(self):
        command = [sys.executable, str(Path(u.__file__).resolve())]
        for key, value in vars(self.args).items():
            command += ['--' + key.replace('_', '-'), str(value)]
        command += ['--repository', REPO, '--release-id', str(RELEASE), '--receipt', str(self.dir / 'result.json')]
        result = subprocess.run(command, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)['status'], 'LOCAL_VERIFIED_NO_NETWORK')
        self.assertNotIn('credential', result.stdout + result.stderr)
        repeated = subprocess.run(command, capture_output=True, text=True)
        self.assertNotEqual(repeated.returncode, 0)  # Receipt cannot be silently replaced.


if __name__ == '__main__':
    unittest.main(verbosity=2)
