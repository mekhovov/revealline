"""Offline transport fixtures; no public network calls and no payload files."""
import hashlib
import io
import unittest
from unittest.mock import patch
import urllib.error
import urllib.request

import http_audit as audit
import binding
from pathlib import Path
from types import SimpleNamespace


def row(path='releases/v0.82.0/site/game/example.json', body=b'{"ok":true}'):
    return {'path': path, 'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest()}


class Response(io.BytesIO):
    def __init__(self, body, *, url=None, content_type='application/json', status=200, headers=None):
        super().__init__(body)
        self.status = status
        self.url = url or audit.BASE + row()['path']
        self.headers = {'Content-Type': content_type, **(headers or {})}
        self.read_sizes = []

    def geturl(self):
        return self.url

    def read(self, size):
        self.read_sizes.append(size)
        return super().read(size)

    def read1(self, size):
        return self.read(size)


class Opener:
    def __init__(self, *responses):
        self.responses = list(responses)
        self.requests = []

    def open(self, request, timeout):
        self.requests.append((request.full_url, timeout, dict(request.header_items())))
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


class AuditTests(unittest.TestCase):
    def test_low_capacity_refuses_before_output_or_transport(self):
        with patch.object(audit, 'pinned_inventory', return_value=(b'{}', [row()])), \
                patch.object(audit.shutil, 'disk_usage', return_value=SimpleNamespace(free=0)), \
                patch.object(audit.urllib.request, 'build_opener', side_effect=AssertionError('no transport')), \
                patch('sys.argv', ['http_audit.py', '--run']):
            with self.assertRaisesRegex(ValueError, '1 GiB'):
                audit.main()

    def test_absent_actual_binding_refuses_without_transport(self):
        with patch.object(binding, 'REQUEST', binding.ROOT / 'never-created-request.json'), \
                patch.object(audit.urllib.request, 'build_opener', side_effect=AssertionError('no transport')):
            with self.assertRaises(FileNotFoundError):
                audit.pinned_inventory()

    def fetch(self, response, expected=None):
        return audit.fetch_once(expected or row(), 1, Opener(response), deadline=100, clock=lambda: 0)





    def test_full_body_hash_size_mime_and_final_url(self):
        response = Response(b'{"ok":true}', headers={'Content-Length': '11'})
        result = self.fetch(response)
        self.assertEqual(result['status'], 'PASS')
        self.assertEqual(result['bytes'], 11)
        self.assertTrue(response.closed)

    def test_zero_byte_hidden_file_is_read_and_verified(self):
        expected = row('.nojekyll', b'')
        response = Response(b'', url=audit.BASE + '.nojekyll', content_type='application/octet-stream')
        result = self.fetch(response, expected)
        self.assertEqual(result['status'], 'PASS')
        self.assertEqual(response.read_sizes, [1])

    def test_unsafe_paths_and_unsupported_mime_never_request(self):
        for path in ['../x.json', '/x.json', 'x//y.json', 'x/./y.json', 'x%2Fy.json', 'x?y.json', 'x\\y.json', 'x.bin']:
            with self.subTest(path=path), self.assertRaises(ValueError):
                audit.validate_row(row(path))

    def test_malformed_size_and_hash_are_rejected(self):
        for key, value in [('bytes', -1), ('bytes', True), ('bytes', binding.MAX_FILE + 1), ('sha256', 'abc')]:
            expected = row()
            expected[key] = value
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                audit.validate_row(expected)

    def test_oversized_body_stops_one_byte_beyond_pin(self):
        response = Response(b'{"ok":true}' + b'x' * 100000)
        result = self.fetch(response)
        self.assertEqual(result['status'], 'FAIL')
        self.assertEqual(result['bytes'], 12)
        self.assertEqual(response.read_sizes, [12])

    def test_truncation_and_equal_length_hash_mismatch_fail(self):
        for body in [b'{}', b'{"no":true}']:
            with self.subTest(body=body):
                self.assertEqual(self.fetch(Response(body))['status'], 'FAIL')

    def test_mime_failure_occurs_after_full_body_verification(self):
        result = self.fetch(Response(b'{"ok":true}', content_type='text/html'))
        self.assertEqual(result['status'], 'FAIL')
        self.assertEqual(result['sha256'], row()['sha256'])
        self.assertIn('MIME', result['error'])

    def test_encoding_and_declared_length_mismatch_fail(self):
        for headers in [{'Content-Encoding': 'gzip'}, {'Content-Length': '10'}, {'Content-Length': 'unknown'}]:
            with self.subTest(headers=headers):
                self.assertEqual(self.fetch(Response(b'{"ok":true}', headers=headers))['status'], 'FAIL')

    def test_wrong_status_and_final_url_fail(self):
        for response in [Response(b'{"ok":true}', status=206), Response(b'{"ok":true}', url='https://example.com/')]:
            self.assertEqual(self.fetch(response)['status'], 'FAIL')

    def test_redirect_handler_refuses_without_following(self):
        with self.assertRaises(urllib.error.HTTPError) as caught:
            audit.NoRedirect().redirect_request(urllib.request.Request(audit.BASE), None, 302, 'Found', {}, 'https://example.com/')
        caught.exception.close()

    def test_failure_retry_preserves_every_attempt(self):
        opener = Opener(urllib.error.URLError('offline fixture'), Response(b'{"ok":true}'))
        attempts = []
        result = audit.check_row(row(), opener, attempts.append, deadline=100, clock=lambda: 0, sleep=lambda _: None)
        self.assertEqual([attempt['status'] for attempt in attempts], ['FAIL', 'PASS'])
        self.assertEqual(result['attempt'], 2)
        self.assertEqual(len(opener.requests), 2)
        self.assertTrue(all(request[0].startswith(audit.BASE) for request in opener.requests))

    def test_retries_are_bounded(self):
        opener = Opener(*[urllib.error.URLError('offline fixture') for _ in range(3)])
        attempts = []
        result = audit.check_row(row(), opener, attempts.append, deadline=100, clock=lambda: 0, sleep=lambda _: None)
        self.assertEqual(result['status'], 'FAIL')
        self.assertEqual(len(attempts), 3)
        self.assertEqual(len(opener.requests), 3)

    def test_expired_deadline_makes_no_request_and_records_failure(self):
        opener = Opener()
        result = audit.fetch_once(row(), 1, opener, deadline=100, clock=lambda: 101)
        self.assertEqual(result['status'], 'FAIL')
        self.assertFalse(result['requestStarted'])
        self.assertEqual(opener.requests, [])

    def test_body_deadline_is_checked_during_stream(self):
        ticks = iter([0, 91, 91])
        result = audit.fetch_once(row(), 1, Opener(Response(b'{"ok":true}')), deadline=100, clock=lambda: next(ticks))
        self.assertEqual(result['status'], 'FAIL')
        self.assertEqual(result['errorType'], 'TimeoutError')

    def test_exact_body_with_eof_after_attempt_or_global_deadline_cannot_pass(self):
        for deadline, delayed in [(100, 120), (20, 25)]:
            with self.subTest(deadline=deadline):
                ticks = [0]
                class DelayedEOF(Response):
                    def read(self, size):
                        body = super().read(size)
                        if not body:
                            ticks[0] = delayed
                        return body
                response = DelayedEOF(b'{"ok":true}')
                result = audit.fetch_once(row(), 1, Opener(response), deadline=deadline, clock=lambda: ticks[0])
                self.assertEqual(result['status'], 'FAIL')
                self.assertEqual(result['errorType'], 'TimeoutError')
                self.assertEqual(result['bytes'], 11)
                self.assertEqual(result['elapsedSeconds'], delayed)
                self.assertTrue(response.closed)

    def test_delayed_nonempty_block_is_counted_but_not_accepted(self):
        ticks = [0]
        class DelayedBody(Response):
            def read(self, size):
                body = super().read(size)
                ticks[0] = 120
                return body
        result = audit.fetch_once(row(), 1, Opener(DelayedBody(b'{"ok":true}')), deadline=100, clock=lambda: ticks[0])
        self.assertEqual(result['status'], 'FAIL')
        self.assertEqual(result['errorType'], 'TimeoutError')
        self.assertEqual(result['bytes'], 11)

    def test_http_read1_is_preferred_over_accumulating_read(self):
        class SingleRead(Response):
            def read(self, size):
                raise AssertionError('Accumulating read must not be selected when read1 exists')
            def read1(self, size):
                self.read_sizes.append(size)
                return io.BytesIO.read(self, size)
        response = SingleRead(b'{"ok":true}')
        result = self.fetch(response)
        self.assertEqual(result['status'], 'PASS')
        self.assertEqual(response.read_sizes, [12, 1])

    def test_late_response_close_cannot_return_a_pass_after_deadline(self):
        ticks = [0]
        class LateClose(Response):
            def __exit__(self, *args):
                result = super().__exit__(*args)
                ticks[0] = 120
                return result
        result = audit.fetch_once(row(), 1, Opener(LateClose(b'{"ok":true}')), deadline=100, clock=lambda: ticks[0])
        self.assertEqual(result['status'], 'FAIL')
        self.assertEqual(result['errorType'], 'TimeoutError')
        self.assertEqual(result['elapsedSeconds'], 120)


if __name__ == '__main__':
    unittest.main()
