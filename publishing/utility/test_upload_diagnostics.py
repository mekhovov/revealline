"""Real loopback transport failures; no external API, credentials or payloads."""
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import io
import json
from pathlib import Path
import select
import socket
import ssl
import struct
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch

import release_artifact as utility
import upload_distribution
import upload_source
from test_release_artifact import binding, encoded


SECRET = 'synthetic-sensitive-value'
BODY = bytes(range(256)) * 8
ENGINES = (upload_source, upload_distribution)


class Server:
    def __init__(self, mode):
        self.posts = []
        self.closed = threading.Event()
        owner = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_args):
                pass

            def do_POST(self):
                owner.posts.append({'length': int(self.headers['Content-Length']),
                                    'mime': self.headers['Content-Type']})
                if mode == 'mid-send':
                    owner.posts[-1]['body'] = self.rfile.read(1024)
                    # Close a real accepted socket with RST before the next send.
                    self.connection.setsockopt(socket.SOL_SOCKET, socket.SO_LINGER,
                                               struct.pack('ii', 1, 0))
                    self.rfile.close()
                    self.connection.close()
                    owner.closed.set()
                    return
                owner.posts[-1]['body'] = self.rfile.read(owner.posts[-1]['length'])
                if mode == 'lost-response':
                    self.close_connection = True
                    return
                body = (b'not-json-' + SECRET.encode() if mode == 'invalid-json'
                        else json.dumps({'message': SECRET}).encode())
                self.send_response(502 if mode == 'http-502' else 201)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)

        self.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)

    def __enter__(self):
        self.thread.start()
        return self

    def __exit__(self, *_args):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=3)

    def api(self, module):
        owner = self

        class API(module.GitHub):
            def connection(self, upload=False):
                result = super().connection(upload)
                owner.connection = result
                return result

        return API(SECRET, _loopback=self.server.server_address, timeout=2)

    def mid_send_stream(self):
        owner = self

        class Stream(io.BytesIO):
            def read(self, size=-1):
                if self.tell() == 1024:
                    if not owner.closed.wait(2):
                        raise AssertionError('Server did not close the real socket')
                    if not select.select([owner.connection.sock], [], [], 2)[0]:
                        raise AssertionError('Reset did not reach the client socket')
                return super().read(min(size, 1024))

        return Stream(BODY)


class TransportTests(unittest.TestCase):
    def check_diagnostics(self, error, phase, sent, status):
        value = error.diagnostics
        self.assertEqual(set(value), {'phase', 'sentBytes', 'sentBytesMeaning',
                                     'exceptionType', 'httpStatus'})
        self.assertEqual((value['phase'], value['sentBytes'], value['httpStatus']),
                         (phase, sent, status))
        self.assertIn('not server receipt', value['sentBytesMeaning'])
        self.assertIn('may transmit additional bytes', value['sentBytesMeaning'])
        serialized = json.dumps(value) + str(error)
        for secret in (SECRET, 'Authorization', 'Bearer ', '127.0.0.1', '?name='):
            self.assertNotIn(secret, serialized)
        return value

    def test_real_mid_send_reset_excludes_failed_chunk_and_never_retries(self):
        for module in ENGINES:
            with self.subTest(module=module.__name__), Server('mid-send') as server:
                with self.assertRaises(module.Ambiguous) as caught:
                    server.api(module).upload('/assets', server.mid_send_stream(),
                                              len(BODY), hashlib.sha256(BODY).hexdigest())
                value = self.check_diagnostics(caught.exception, 'send-body', 1024, None)
                self.assertIn(value['exceptionType'], ('ConnectionResetError', 'BrokenPipeError'))
                self.assertEqual(len(server.posts), 1)
                self.assertEqual(server.posts[0]['body'], BODY[:1024])

    def test_real_missing_response_is_not_an_observed_http_status(self):
        for module in ENGINES:
            with self.subTest(module=module.__name__), Server('lost-response') as server:
                with self.assertRaises(module.Ambiguous) as caught:
                    server.api(module).upload('/assets', io.BytesIO(BODY), len(BODY),
                                              hashlib.sha256(BODY).hexdigest())
                value = self.check_diagnostics(caught.exception, 'response-headers', len(BODY), None)
                self.assertEqual(value['exceptionType'], 'RemoteDisconnected')
                self.assertEqual(len(server.posts), 1)
                self.assertEqual(server.posts[0]['body'], BODY)

    def test_real_response_error_retains_only_observed_numeric_status(self):
        for module in ENGINES:
            for mode, status in (('http-502', 502), ('invalid-json', 201)):
                with self.subTest(module=module.__name__, mode=mode), Server(mode) as server:
                    with self.assertRaises(module.Ambiguous) as caught:
                        server.api(module).upload('/assets', io.BytesIO(BODY), len(BODY),
                                                  hashlib.sha256(BODY).hexdigest())
                    value = self.check_diagnostics(caught.exception, 'validate-response', len(BODY), status)
                    self.assertEqual(value['exceptionType'], 'Refusal')
                    self.assertEqual(len(server.posts), 1)

    def test_recorded_dispatch_keeps_both_engine_diagnostics_and_member_mime(self):
        for name, module, mime in (('source.tar', upload_source, 'application/x-tar'),
                                   ('distribution.zip', upload_distribution, 'application/zip')):
            with self.subTest(name=name), tempfile.TemporaryDirectory() as temp, Server('http-502') as server:
                api = utility.RecordedGitHub(SECRET, Path(temp))
                api.loopback, api.timeout = server.server.server_address, 2
                with self.assertRaises(module.Ambiguous) as caught:
                    api.upload('/assets?name=' + name, io.BytesIO(BODY), len(BODY),
                               hashlib.sha256(BODY).hexdigest())
                self.check_diagnostics(caught.exception, 'validate-response', len(BODY), 502)
                self.assertEqual(server.posts[0]['mime'], mime)
                self.assertEqual(len(server.posts), 1)

    def test_reviewed_shared_operation_budget_keeps_socket_timeout(self):
        for module in ENGINES:
            with self.subTest(module=module.__name__), patch.object(module.time, 'monotonic', return_value=100):
                api = module.GitHub(SECRET)
                self.assertEqual(api.deadline, 100 + 5400)
                self.assertEqual(api.timeout, 120)

    def test_standard_ssl_subtypes_keep_only_fixed_safe_labels(self):
        error_types = (ssl.SSLError, ssl.SSLEOFError, ssl.SSLZeroReturnError,
                       ssl.SSLSyscallError, ssl.SSLWantReadError,
                       ssl.SSLWantWriteError, ssl.SSLCertVerificationError)
        for module in ENGINES:
            for error_type in error_types:
                with self.subTest(module=module.__name__, error=error_type.__name__):
                    diagnostic = module.upload_diagnostics('send-body', 1024,
                                                           error_type(1, SECRET))
                    error = module.Ambiguous('Upload outcome unconfirmed.', diagnostics=diagnostic)
                    value = self.check_diagnostics(error, 'send-body', 1024, None)
                    self.assertEqual(value['exceptionType'], error_type.__name__)

    def test_arbitrary_ssl_subclass_names_and_text_remain_suppressed(self):
        secret_type = type(SECRET, (ssl.SSLError,), {})
        for module in ENGINES:
            with self.subTest(module=module.__name__):
                diagnostic = module.upload_diagnostics('send-body', 1024,
                                                       secret_type(1, SECRET))
                error = module.Ambiguous('Upload outcome unconfirmed.', diagnostics=diagnostic)
                value = self.check_diagnostics(error, 'send-body', 1024, None)
                self.assertEqual(value['exceptionType'], 'OtherError')

    def test_deadline_phase_and_unknown_exception_names_do_not_leak(self):
        for module in ENGINES:
            with self.subTest(module=module.__name__), Server('lost-response') as server:
                api = server.api(module)

                class ExpiredStream(io.BytesIO):
                    def read(self, size=-1):
                        api.deadline = 0
                        return super().read(size)

                with self.assertRaises(module.Ambiguous) as caught:
                    api.upload('/assets', ExpiredStream(BODY), len(BODY), hashlib.sha256(BODY).hexdigest())
                self.check_diagnostics(caught.exception, 'check-deadline', 0, None)
                self.assertEqual(caught.exception.diagnostics['exceptionType'], 'Refusal')
            secret_error = type(SECRET, (Exception,), {})(SECRET)
            value = module.upload_diagnostics('read-body', None, secret_error)
            self.assertEqual(value['exceptionType'], 'OtherError')
            self.assertNotIn(SECRET, json.dumps(value))


class RetentionTests(unittest.TestCase):
    def test_hosted_terminal_receipt_and_manifest_keep_safe_diagnostics(self):
        for module in ENGINES:
            with self.subTest(module=module.__name__), tempfile.TemporaryDirectory() as temporary:
                out = Path(temporary) / 'out'
                value = binding('upload-originals')
                diagnostic = module.upload_diagnostics('response-headers', len(BODY),
                                                       ConnectionResetError(SECRET))
                error = module.Ambiguous('Upload outcome unconfirmed.', diagnostics=diagnostic)
                arguments = ['utility', 'run', '--mode', 'upload-originals', '--repository',
                             value['repository'], '--repo', temporary, '--out', str(out)]
                env = {'UTILITY_BINDING': encoded(value).decode(), 'GITHUB_ACTIONS': 'true',
                       'GITHUB_EVENT_NAME': 'workflow_dispatch', 'UTILITY_WORKFLOW_SHA': 'e' * 40,
                       'GH_TOKEN': SECRET}
                with patch.object(sys, 'argv', arguments), patch.dict(utility.os.environ, env), \
                        patch.object(utility, 'source_identity', return_value=value['source']), \
                        patch.object(utility.subprocess, 'check_output', side_effect=['e' * 40, '', 'f' * 40]), \
                        patch.object(utility, 'inspect_original', return_value={}), \
                        patch.object(utility, 'upload_originals', side_effect=error):
                    with self.assertRaises(module.Ambiguous):
                        utility.main()
                result_path = out / 'evidence/result.json'
                result = json.loads(result_path.read_text())
                self.assertEqual(result['status'], 'UNCONFIRMED_REREAD_ASSETS')
                self.assertTrue(result['requiresAssetReread'])
                self.assertFalse(result['automaticRetry'])
                self.assertEqual(result['uploadDiagnostics'], diagnostic)
                manifest = json.loads((out / 'evidence/retained-manifest.json').read_text())
                self.assertIn(utility.pin(result_path), manifest['files'])
                for path in (out / 'evidence').rglob('*'):
                    if path.is_file():
                        self.assertNotIn(SECRET.encode(), path.read_bytes())


if __name__ == '__main__':
    unittest.main()
