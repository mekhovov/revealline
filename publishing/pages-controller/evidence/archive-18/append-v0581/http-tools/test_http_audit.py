"""Offline transport fixtures; no public network calls and no payload files."""
import hashlib
import io
import unittest
from unittest.mock import patch
import urllib.error
import urllib.request

import http_audit as audit


def row(path='releases/v0.57.0/site/game/example.json', body=b'{"ok":true}'):
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
    def fetch(self, response, expected=None):
        return audit.fetch_once(expected or row(), 1, Opener(response), deadline=100, clock=lambda: 0)

    def test_pinned_inventory_validates_without_network(self):
        raw, rows = audit.pinned_inventory()
        self.assertEqual(len(rows), 1327)
        self.assertEqual(sum(item['bytes'] for item in rows), 625402709)
        self.assertEqual(audit.digest(raw), audit.INVENTORY_SHA)

    def test_changed_hosted_authority_pin_refuses(self):
        with patch.object(audit, 'AUTHORITY_SHA', '0' * 64):
            with self.assertRaises(ValueError):
                audit.pinned_inventory()

    def test_changed_source_tree_refuses(self):
        with patch.object(audit, 'SOURCE_TREE', '0' * 40):
            with self.assertRaises(ValueError):
                audit.pinned_inventory()

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
        for key, value in [('bytes', -1), ('bytes', True), ('bytes', audit.EXPECTED_BYTES + 1), ('sha256', 'abc')]:
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


if __name__ == '__main__':
    unittest.main()
