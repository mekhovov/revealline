"""Offline transport fixtures; no public network calls and no payload files."""
import hashlib
import io
import json
import zipfile
import warnings
import unittest
from unittest.mock import patch
import urllib.error
import urllib.request

import http_audit as audit
import audit_binding as binding
from pathlib import Path


def row(path='releases/v0.62.0/site/game/example.json', body=b'{"ok":true}'):
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

    def test_prepared_append_inventory_is_exact_without_network(self):
        raw, rows, _ = binding.candidate_inventory()
        for item in rows:
            audit.validate_row(item)
        self.assertEqual(len(rows), 1408)
        self.assertEqual(sum(item['bytes'] for item in rows), 627086405)
        self.assertEqual(audit.digest(raw), audit.INVENTORY_SHA)

    def test_changed_source_lock_pin_refuses(self):
        with patch.object(binding, 'LOCK_SHA', '0' * 64):
            with self.assertRaises(ValueError):
                binding.candidate_inventory()

    def test_locked_immutable_tag_refspec_pass(self):
        binding.validate_tag_fetch_cohorts('git fetch origin refs/tags/v0.62.0:refs/tags/v0.62.0 refs/tags/v0.61.24:refs/tags/v0.61.24', {'releases': [{'version': 'v0.62.0'}, {'version': 'v0.61.24'}]})

    def test_missing_locked_tag_refspec_refuses(self):
        with self.assertRaises(ValueError):
            binding.validate_tag_fetch_cohorts('git fetch origin refs/tags/v0.62.0:refs/tags/v0.62.0', {'releases': [{'version': 'v0.62.0'}, {'version': 'v0.61.24'}]})

    def test_crosswired_tag_refspec_refuses(self):
        with self.assertRaises(ValueError):
            binding.validate_tag_fetch_cohorts('git fetch origin refs/tags/v0.62.0:refs/tags/v0.61.4', {'releases': [{'version': 'v0.62.0'}]})

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


class AppendPreservationTests(unittest.TestCase):
    def setUp(self):
        self.current = json.loads((binding.ROOT/'inputs/expected-inventory.json').read_bytes())['files']
        self.prior = json.loads((binding.ROOT/'inputs/prior-expected-inventory.json').read_bytes())['files']

    def test_exact_prior_cohort_is_preserved_with_only_index_change(self):
        result = binding.preservation_metadata(self.current)
        self.assertEqual(result, {
            'priorInventoryRows': 705, 'preservedOldCanonicalRows': 704,
            'preservedPriorReleaseRows': 702, 'preservedRootSupportRows': 2,
            'preservedRootSupportPaths': ['.nojekyll', 'releases/index.html'],
            'changedPriorPaths': ['index.html'], 'newRows': 703, 'newBytes': 313522906,
        })
        old = {r['path']:r for r in self.prior}
        new = {r['path']:r for r in self.current}
        self.assertEqual(new['index.html']['bytes']-old['index.html']['bytes'],79)
        self.assertTrue(all(p.startswith('releases/v0.62.1/') for p in new.keys()-old.keys()))

    def test_missing_prior_path_is_rejected(self):
        missing = self.prior[0]['path']
        with self.assertRaisesRegex(ValueError,'removed'):
            binding.derive_preservation([r for r in self.current if r['path']!=missing],self.prior)

    def test_modified_prior_payload_or_support_is_rejected(self):
        release = next(r['path'] for r in self.prior if r['path'].startswith('releases/v0.62.0/'))
        for target in [release,'.nojekyll','releases/index.html']:
            changed = [{**r,'sha256':'0'*64} if r['path']==target else r for r in self.current]
            with self.subTest(target=target),self.assertRaisesRegex(ValueError,'payload changed'):
                binding.derive_preservation(changed,self.prior)

    def test_duplicate_current_or_prior_path_is_rejected(self):
        for current,prior in [(self.current+self.current[:1],self.prior),(self.current,self.prior+self.prior[:1])]:
            with self.assertRaisesRegex(ValueError,'Duplicate'):
                binding.derive_preservation(current,prior)

    def test_extra_root_path_is_rejected(self):
        with self.assertRaisesRegex(ValueError,'appended root'):
            binding.derive_preservation(self.current+[row('extra.json')],self.prior)

    def test_unchanged_index_does_not_satisfy_exact_append(self):
        prior_index = next(r for r in self.prior if r['path']=='index.html')
        changed = [prior_index if r['path']=='index.html' else r for r in self.current]
        with self.assertRaises(ValueError):
            binding.preservation_metadata(changed)

    def test_prior_inventory_pin_is_required(self):
        with patch.object(binding,'PRIOR_INVENTORY_SHA','0'*64):
            with self.assertRaisesRegex(ValueError,'Prior inventory pin'):
                binding.preservation_metadata(self.current)


class AppendReceiptMemberTests(unittest.TestCase):
    names = ['receipt.json','expected-inventory.json','zip-receipt-v0.62.0.json','zip-receipt-v0.62.1.json']
    def archive(self,names):
        stream = io.BytesIO()
        with warnings.catch_warnings():
            warnings.simplefilter('ignore',UserWarning)
            with zipfile.ZipFile(stream,'w') as out:
                for name in names:
                    out.writestr(name,b'{}')
        stream.seek(0)
        return zipfile.ZipFile(stream)

    def test_exact_two_cohort_members_are_accepted(self):
        with self.archive(self.names) as archive:
            binding.validate_receipt_members(archive)

    def test_initial_only_extra_duplicate_or_wrong_cohort_is_rejected(self):
        for names in [self.names[:-1],self.names+['extra.json'],self.names+[self.names[-1]],self.names[:-1]+['zip-receipt-v0.62.2.json']]:
            with self.subTest(names=names),self.archive(names) as archive,self.assertRaisesRegex(ValueError,'unexpected/duplicate'):
                binding.validate_receipt_members(archive)

    def test_member_and_total_uncompressed_bounds_are_enforced(self):
        for sizes in [[524289,0,0,0],[300000,300000,300000,300000]]:
            with self.subTest(sizes=sizes),self.archive(self.names) as archive:
                for info,size in zip(archive.infolist(),sizes):
                    info.file_size=size
                with self.assertRaisesRegex(ValueError,'exceed bounds'):
                    binding.validate_receipt_members(archive)


if __name__ == '__main__':
    unittest.main()
