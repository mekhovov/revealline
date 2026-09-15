"""Local socket tests only: no browser or external network."""
import io
import json
import socket
import threading
import unittest
from unittest.mock import patch
from refusal_proxy import Events, create_server


class RefusalTests(unittest.TestCase):
    def setUp(self):
        self.log = io.StringIO()
        self.server = create_server(Events(self.log, 10))
        self.thread = threading.Thread(target=self.server.serve_forever, kwargs={'poll_interval': 0.01})
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(2)
        self.assertFalse(self.thread.is_alive())

    def request(self, raw):
        # Connect only to the numeric loopback address; forbid DNS/upstream helper calls.
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as client:
            client.settimeout(2)
            client.connect(self.server.server_address)
            with patch('socket.create_connection', side_effect=AssertionError('Upstream attempted')), \
                 patch('socket.getaddrinfo', side_effect=AssertionError('DNS attempted')):
                client.sendall(raw)
                result = b''
                while True:
                    part = client.recv(4096)
                    if not part:
                        break
                    result += part
                return result

    def test_absolute_http_is_refused_without_upstream_or_secret_log(self):
        response = self.request(b'GET http://user:private@never-contact.invalid/secret?token=private HTTP/1.1\r\nHost: ignored.invalid\r\nAuthorization: private\r\n\r\n')
        self.assertTrue(response.startswith(b'HTTP/1.1 502'))
        rows = [json.loads(line) for line in self.log.getvalue().splitlines()]
        self.assertEqual(rows[0]['host'], 'never-contact.invalid')
        for sensitive in ['private', 'secret', 'token', 'Authorization', 'ignored.invalid']:
            self.assertNotIn(sensitive, self.log.getvalue())

    def test_connect_never_opens_tunnel(self):
        response = self.request(b'CONNECT never-contact.invalid:443 HTTP/1.1\r\nHost: never-contact.invalid:443\r\n\r\n')
        self.assertTrue(response.startswith(b'HTTP/1.1 502'))
        self.assertNotIn(b'200 Connection', response)
        self.assertEqual(json.loads(self.log.getvalue().splitlines()[0])['method'], 'CONNECT')

    def test_other_methods_expect_continue_and_head_are_refused(self):
        for request in [b'POST http://never-contact.invalid/ HTTP/1.1\r\nContent-Length: 99\r\nExpect: 100-continue\r\n\r\n',
                        b'CUSTOM http://never-contact.invalid/ HTTP/1.1\r\n\r\n',
                        b'HEAD http://never-contact.invalid/ HTTP/1.1\r\n\r\n']:
            response = self.request(request)
            self.assertTrue(response.startswith(b'HTTP/1.1 502'))
            self.assertNotIn(b'100 Continue', response)
        self.assertTrue(response.endswith(b'\r\n\r\n'))

    def test_event_log_is_bounded_but_requests_still_refused(self):
        for _ in range(15):
            response = self.request(b'GET http://never-contact.invalid/ HTTP/1.1\r\n\r\n')
            self.assertTrue(response.startswith(b'HTTP/1.1 502'))
        rows = [json.loads(line) for line in self.log.getvalue().splitlines()]
        self.assertEqual(len(rows), 11)
        self.assertEqual(rows[-1]['event'], 'log-capped')


if __name__ == '__main__':
    unittest.main(verbosity=2)
