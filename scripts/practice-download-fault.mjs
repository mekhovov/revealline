import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';

// Real wall-clock faults only. These bounds are not caller-overridable.
export const PRACTICE_DOWNLOAD_FAULT_MODES = Object.freeze({
  idle: Object.freeze({ deadlineMs: 45000, chunkIntervalMs: null }),
  'cancel-hold': Object.freeze({ deadlineMs: 45000, chunkIntervalMs: null }),
  'overall-trickle': Object.freeze({ deadlineMs: 325000, chunkIntervalMs: 5000 }),
});
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const packages = new Set(['civilian-flight', 'civilian-fpv', 'fpv-worlds']);

export function validatePracticeDownloadFault(input) {
  assert(input && typeof input === 'object' && !Array.isArray(input));
  assert.deepEqual(Object.keys(input).sort(), ['body', 'dependency', 'mode', 'origin']);
  const { origin, dependency, body, mode } = input;
  assert(Object.hasOwn(PRACTICE_DOWNLOAD_FAULT_MODES, mode), 'Unknown download fault mode.');
  const url = new URL(origin);
  assert(
    url.protocol === 'http:' &&
      url.hostname === '127.0.0.1' &&
      url.port &&
      url.origin === origin &&
      !url.username &&
      !url.password,
    'Fault origin must be an exact owned IPv4 loopback HTTP origin.',
  );
  assert(dependency && typeof dependency === 'object' && !Array.isArray(dependency));
  assert.deepEqual(Object.keys(dependency).sort(), ['bytes', 'pathname', 'sha256']);
  const pathname = dependency.pathname;
  assert(typeof pathname === 'string' && pathname.length <= 1024);
  const match = /^\/revealline\/practice\/([a-z-]+)\/releases\/(v\d+\.\d+\.\d+)\/site\/(.+)$/.exec(
    pathname,
  );
  assert(
    match && packages.has(match[1]),
    'Fault target must be one admitted package release member.',
  );
  assert(
    match[3].split('/').every((part) => /^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(part)),
    'Fault target must have canonical non-private path segments.',
  );
  assert(
    Number.isSafeInteger(dependency.bytes) &&
      dependency.bytes >= 128 &&
      dependency.bytes <= 64 * 1024 * 1024,
    'Dependency must be between 128 bytes and 64 MiB.',
  );
  assert.match(dependency.sha256, /^[a-f0-9]{64}$/);
  assert(Buffer.isBuffer(body) || body instanceof Uint8Array, 'Exact dependency bytes required.');
  assert.equal(body.byteLength, dependency.bytes, 'Dependency size mismatch.');
  assert.equal(digest(body), dependency.sha256, 'Dependency hash mismatch.');
  return { origin: url.origin, host: url.host, dependency: { ...dependency }, mode };
}

/** Wrap one already-listening, exclusively owned local preview server. The caller
 * must supply a dependency pin from its admitted bundle. This helper verifies
 * those bytes, not admission/review eligibility. It never edits served files.
 *
 * Before arm(), and for every nonmatching request, the original handler runs.
 * Once armed, exactly one GET receives original bytes slowly without EOF. A
 * second matching request is delegated and recorded, not silently faulted again.
 * The response is intentionally incomplete: bytesSent means server writes, not
 * proof that the browser received them. A safety deadline is an observation
 * failure, never evidence that the app's timeout/cancel worked.
 */
export function attachPracticeDownloadFault(input) {
  assert(input && typeof input === 'object' && !Array.isArray(input));
  assert.deepEqual(Object.keys(input).sort(), ['body', 'dependency', 'mode', 'origin', 'server']);
  const { server, origin, dependency, body, mode } = input;
  const spec = validatePracticeDownloadFault({ origin, dependency, body, mode });
  const address = server.address();
  assert(
    address &&
      typeof address === 'object' &&
      address.address === '127.0.0.1' &&
      String(address.port) === new URL(origin).port,
    'Server does not own the declared loopback origin.',
  );
  const original = server.listeners('request');
  assert.equal(original.length, 1, 'Exactly one owned request handler is required.');
  const bytes = Buffer.from(body); // Caller mutation cannot change fault bytes.
  const bounds = PRACTICE_DOWNLOAD_FAULT_MODES[mode];
  const started = performance.now();
  const state = {
    format: 'PracticeDownloadFault.v1',
    origin,
    dependency: spec.dependency,
    mode,
    bounds,
    armed: false,
    matched: false,
    closed: false,
    bytesSent: 0,
    delegatedTargetRequests: 0,
    outcome: null,
    events: [],
    cleanupErrors: [],
  };
  const timers = new Set();
  let response,
    ended = false;
  const event = (kind, detail = {}) => {
    if (state.events.length >= 128) return;
    state.events.push({ kind, elapsedMs: performance.now() - started, ...detail });
  };
  const clearTimers = () => {
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
  };
  const finish = (outcome, destroy = false) => {
    if (ended) return;
    ended = true;
    clearTimers();
    state.outcome = outcome;
    event('ended', { outcome });
    if (destroy && response && !response.destroyed) {
      try {
        response.destroy();
      } catch {
        state.cleanupErrors.push('Owned response destruction failed.');
      }
    }
  };
  const schedule = (callback, ms) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (!ended && !state.closed) callback();
    }, ms);
    timer.unref?.();
    timers.add(timer);
  };
  const writeByte = () => {
    if (ended || state.closed) return;
    try {
      assert(state.bytesSent < bytes.length - 1, 'Fault must never send the full dependency.');
      const offset = state.bytesSent;
      const accepted = response.write(bytes.subarray(offset, offset + 1));
      state.bytesSent++;
      event('body-byte-written', { offset, bytesSent: state.bytesSent, writable: accepted });
      if (!accepted) return finish('server-backpressure', true);
      if (bounds.chunkIntervalMs) schedule(writeByte, bounds.chunkIntervalMs);
    } catch {
      finish('server-write-failed', true);
    }
  };
  const handler = (request, res) => {
    const target =
      request.method === 'GET' &&
      request.url === spec.dependency.pathname &&
      request.headers.host === spec.host &&
      request.socket.localAddress === '127.0.0.1' &&
      request.socket.remoteAddress === '127.0.0.1';
    if (!target || !state.armed || state.matched || state.closed) {
      if (target) {
        state.delegatedTargetRequests++;
        event('target-delegated', { armed: state.armed, matched: state.matched });
      }
      return original[0].call(server, request, res);
    }
    state.matched = true;
    response = res;
    event('request-matched');
    res.once('close', () => {
      if (!ended) finish('client-disconnect');
    });
    res.once('error', () => finish('response-error', true));
    request.once('aborted', () => finish('request-aborted', true));
    schedule(() => finish('fault-safety-deadline', true), bounds.deadlineMs);
    try {
      res.writeHead(200, {
        'Content-Type': spec.dependency.pathname.endsWith('.md')
          ? 'text/markdown; charset=utf-8'
          : 'application/octet-stream',
        'Content-Length': bytes.length,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      res.flushHeaders();
      event('headers-sent');
      writeByte();
    } catch {
      finish('server-write-failed', true);
    }
  };
  server.removeListener('request', original[0]);
  server.on('request', handler);
  event('attached');
  return Object.freeze({
    arm() {
      assert(!state.armed && !state.closed && !ended, 'Fault can be armed only once before close.');
      state.armed = true;
      event('armed');
    },
    snapshot() {
      return structuredClone({ ...state, activeTimers: timers.size });
    },
    close() {
      if (state.closed) return this.snapshot();
      state.closed = true;
      finish('observer-cleanup', true);
      clearTimers();
      // Remove only our listener; do not erase another owner's later changes.
      const listeners = server.listeners('request');
      if (listeners.length !== 1 || listeners[0] !== handler)
        state.cleanupErrors.push('Request handler ownership changed before cleanup.');
      server.removeListener('request', handler);
      if (!server.listeners('request').includes(original[0])) server.on('request', original[0]);
      event('closed');
      return this.snapshot();
    },
  });
}
