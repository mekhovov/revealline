#!/usr/bin/env python3
"""Loopback-only refusal endpoint. It has no upstream socket or DNS code."""
import argparse
import datetime
import http.server
import json
import os
from pathlib import Path
import threading
import time
import urllib.parse


class Events:
    def __init__(self, stream, limit=1000):
        self.stream, self.limit, self.count = stream, limit, 0
        self.lock = threading.Lock()

    def record(self, **facts):
        with self.lock:
            if self.count > self.limit:
                return
            if self.count == self.limit:
                facts = {'event': 'log-capped', 'status': 'still-refusing'}
            self.count += 1
            row = {'sequence': self.count, 'time': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                   'monotonicSeconds': time.monotonic(), **facts}
            self.stream.write(json.dumps(row, separators=(',', ':')) + '\n')
            self.stream.flush()


def target_host(target, connect=False):
    try:
        parsed = urllib.parse.urlsplit('//' + target if connect else target)
        host = parsed.hostname or '<unspecified>'
        # Never retain userinfo, URL paths, query strings, headers or body bytes.
        if len(host) > 253 or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-:[]' for c in host):
            return '<invalid>'
        return host.lower()
    except ValueError:
        return '<invalid>'


class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    server_version = 'P01Refusal/1'
    sys_version = ''

    def setup(self):
        super().setup()
        self.connection.settimeout(3)

    def log_message(self, *args):
        pass

    def refuse(self):
        raw_method = getattr(self, 'command', '')
        method = raw_method if raw_method in {'GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'TRACE', 'CONNECT'} else 'OTHER'
        self.server.events.record(event='refused', method=method,
                                  host=target_host(getattr(self, 'path', ''), method == 'CONNECT'),
                                  status=502)
        body = b'P01 task proxy: outbound traffic refused.\n'
        self.close_connection = True
        self.send_response(502, 'P01 outbound traffic refused')
        self.send_header('Content-Type', 'text/plain; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Connection', 'close')
        self.end_headers()
        if method != 'HEAD':
            self.wfile.write(body)

    def send_error(self, code, message=None, explain=None):
        self.refuse()

    def handle_expect_100(self):
        self.refuse()
        return False

    def __getattr__(self, name):
        if name.startswith('do_'):
            return self.refuse
        raise AttributeError(name)


class Server(http.server.ThreadingHTTPServer):
    daemon_threads = True
    request_queue_size = 16

    def handle_error(self, request, client_address):
        self.events.record(event='connection-ended', status='refused-or-closed')


def create_server(events, port=0):
    server = Server(('127.0.0.1', port), Handler)
    server.events = events
    return server


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=0)
    parser.add_argument('--events', type=Path, required=True)
    parser.add_argument('--ready', type=Path, required=True)
    parser.add_argument('--max-events', type=int, default=1000)
    args = parser.parse_args()
    if not 0 <= args.port <= 65535 or not 10 <= args.max_events <= 10000:
        parser.error('Invalid bounded port/event limit')
    if args.events.exists() or args.ready.exists():
        parser.error('Output exists; use fresh attempt-specific event/ready paths')
    with args.events.open('x') as stream:
        events = Events(stream, args.max_events)
        with create_server(events, args.port) as server:
            host, port = server.server_address
            ready = {'pid': os.getpid(), 'host': host, 'port': port,
                     'proxy': f'http://{host}:{port}', 'upstreamConnections': 'none-by-construction',
                     'events': str(args.events.resolve()), 'maxEvents': args.max_events}
            with args.ready.open('x') as output:
                json.dump(ready, output, indent=2)
                output.write('\n')
            events.record(event='listening', host=host, status='refusal-only')
            try:
                server.serve_forever(poll_interval=0.2)
            except KeyboardInterrupt:
                pass
            finally:
                events.record(event='stopped', status='closed')


if __name__ == '__main__':
    main()
