"""Offline transport fixtures; no public network calls and no payload files."""
import hashlib
import io
import unittest
from unittest.mock import patch
import urllib.error
import urllib.request

import http_audit as audit
import audit_binding as binding
from pathlib import Path


def row(path='releases/v0.96.0/site/game/example.json', body=b'{"ok":true}'):
    return {'path': path, 'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest()}


class Response(io.BytesIO):
    def __init__(self, body, *, url=None, content_type='application/json', status=200, headers=None):
        super().__init__(body)
        self.status = status
        self.url = url or audit.BASE + row()['path']
        self.headers = {'Content-Type': content_type, **(headers or {})}
        self.read_sizes = []

    def read1(self, size):
        return self.read(size)

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

    def test_prepared_initial_inventory_is_exact_without_network(self):
        raw, rows, _ = binding.candidate_inventory()
        for item in rows:
            audit.validate_row(item)
        self.assertEqual(len(rows), 1120)
        self.assertEqual(sum(item['bytes'] for item in rows), 594895002)
        self.assertEqual(audit.digest(raw), audit.INVENTORY_SHA)

    def test_actual_held_checkout_matches_prepared_tree_and_inventory(self):
        raw, _, _ = binding.candidate_inventory()
        self.assertEqual(binding.git('rev-parse', 'HEAD^{tree}').decode().strip(), binding.TREE)
        self.assertEqual((binding.INFRA / 'expected-inventory.json').read_bytes(), raw)

    def test_missing_actual_request_refuses(self):
        with patch.object(binding, 'REQUEST', Path('/nonexistent/actual-reviewed-request.json')):
            with self.assertRaises((ValueError, FileNotFoundError)):
                audit.pinned_inventory()

    def test_changed_prepared_inventory_pin_refuses(self):
        with patch.object(binding, 'INVENTORY_SHA', '0' * 64):
            with self.assertRaises(ValueError):
                binding.candidate_inventory()

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



    def test_overall_deadline_expiring_during_final_authority_check_refuses(self):
        import contextlib
        import json
        import tempfile
        from types import SimpleNamespace
        expected = row()
        request = {key: 'fixture' for key in ['archiveTree', 'sourceCheckoutCommit', 'runId', 'deploymentId', 'deploymentStatusId', 'receiptArtifactId']}
        bound = {'requestRaw': b'{}', 'requestSha256': 'fixture', 'evidenceBodies': {}, 'request': request}
        ticks = [0]
        def late_authority():
            ticks[0] = audit.AUDIT_SECONDS + 1
            return bound
        def completed(row, opener, record, **kwargs):
            result = dict(row, status='PASS', attempt=1, requestStarted=True, url='fixture', finalURL='fixture')
            record(result)
            return result
        with tempfile.TemporaryDirectory() as directory, \
                patch.object(audit, 'BASE_DIR', Path(directory)), \
                patch.object(audit, 'BINDING', bound), \
                patch.object(audit, 'pinned_inventory', return_value=(b'{}', [expected])), \
                patch.object(audit, 'validate_execution_binding', side_effect=late_authority), \
                patch.object(audit, 'check_row', side_effect=completed), \
                patch.object(audit.shutil, 'disk_usage', return_value=SimpleNamespace(free=2 * 1024**3)), \
                patch.object(audit.time, 'monotonic', side_effect=lambda: ticks[0]), \
                patch.object(audit.urllib.request, 'build_opener', return_value=object()), \
                patch('sys.argv', ['http_audit.py', '--run']), contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(audit.main(), 1)
            report = json.loads(next(Path(directory).glob('http/*/http-report.json')).read_bytes())
            self.assertEqual(report['status'], 'FAIL')
            self.assertTrue(report['auditDeadlineExceeded'])
            self.assertEqual(report['failedFiles'], 0)


class MetadataCapacityTests(unittest.TestCase):
    def test_worst_case_three_attempts_all_rows_fits_below_free_guard(self):
        self.assertEqual(audit.MAX_WORST_CASE_METADATA_BYTES, 26738688)
        self.assertLess(audit.MAX_WORST_CASE_METADATA_BYTES, audit.MAX_PERSISTED_METADATA_BYTES)
        self.assertLess(audit.MAX_PERSISTED_METADATA_BYTES, audit.MIN_FREE_METADATA_BYTES)

    def test_overlong_record_refuses_before_write(self):
        output = io.StringIO()
        with self.assertRaisesRegex(ValueError, 'item exceeds'):
            audit.MetadataBudget().line(output, {'message': 'x' * audit.MAX_LOG_LINE_BYTES})
        self.assertEqual(output.getvalue(), '')

    def test_total_budget_refuses_without_overwriting_prior_record(self):
        output = io.StringIO()
        budget = audit.MetadataBudget()
        budget.line(output, {'ok': True})
        previous = output.getvalue()
        budget.used = audit.MAX_PERSISTED_METADATA_BYTES
        with self.assertRaisesRegex(ValueError, 'total persisted'):
            budget.line(output, {'ok': True})
        self.assertEqual(output.getvalue(), previous)

    def test_disk_full_and_short_writes_propagate_instead_of_pass(self):
        import errno
        for short in (False, True):
            class Broken:
                def write(self, _text):
                    if short: return 0
                    raise OSError(errno.ENOSPC, 'fixture metadata disk full')
                def flush(self): pass
            with self.assertRaises(OSError):
                audit.MetadataBudget().line(Broken(), {'ok': True})

    def test_insufficient_free_metadata_refuses_before_output(self):
        import tempfile
        from types import SimpleNamespace
        with tempfile.TemporaryDirectory() as directory, \
                patch.object(audit, 'BASE_DIR', Path(directory)), \
                patch.object(audit, 'pinned_inventory', return_value=(b'{}', [])), \
                patch.object(audit.shutil, 'disk_usage', return_value=SimpleNamespace(free=audit.MIN_FREE_METADATA_BYTES-1)), \
                patch('sys.argv', ['http_audit.py', '--run']):
            with self.assertRaisesRegex(ValueError, '32 MiB'):
                audit.main()
            self.assertEqual(list(Path(directory).iterdir()), [])

if __name__ == '__main__':
    unittest.main()
