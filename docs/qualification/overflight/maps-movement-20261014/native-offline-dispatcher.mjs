import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

// This host only routes the authentic immutable outputs of native-offline-server.
// It never rewrites an application, worker, manifest or response body.
const port = Number(process.env.OVERFLIGHT_DISPATCHER_PORT ?? 8936);
assert.ok(Number.isInteger(port) && port > 1024 && port < 65536);
const upstreamPorts = new Set([8935, 8937, 8938]);
const previous = process.env.OVERFLIGHT_DISPATCHER_RESTORE
  ? JSON.parse(await readFile(process.env.OVERFLIGHT_DISPATCHER_RESTORE, 'utf8'))
  : null;
let upstreamPort = previous?.upstreamPort ?? 8935;
let online = previous?.online ?? true;
let failedPath = previous?.failedPath ?? null;
let requests = previous?.requests ?? 0;
let rejected = previous?.rejected ?? 0;
const events = previous?.events ?? [];
assert.ok(upstreamPorts.has(upstreamPort));
assert.equal(typeof online, 'boolean');
assert.ok(failedPath === null || /^\/game\/[a-zA-Z0-9_./-]+\.mjs$/.test(failedPath));
assert.ok(Number.isSafeInteger(requests) && requests >= 0);
assert.ok(Number.isSafeInteger(rejected) && rejected >= 0);
assert.ok(Array.isArray(events) && events.length <= 1000);
const record = (action, details = {}) => {
  const event = { at: new Date().toISOString(), action, ...details };
  events.push(event);
  console.log(JSON.stringify(event));
};
const upstreamStatus = async (candidate) => {
  const response = await fetch(`http://127.0.0.1:${candidate}/_qualification/status`);
  assert.equal(response.status, 200, 'The authentic generation must be ready.');
  const status = await response.json();
  assert.match(status.version, /^v?\d+\.\d+\.\d+$/);
  assert.match(status.buildId, /^[a-f0-9]{64}$/);
  return status;
};
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  const send = (status, body, headers = {}) => {
    res.writeHead(status, { 'Cache-Control': 'no-store', ...headers });
    res.end(req.method === 'HEAD' ? undefined : body);
  };
  const json = (status, value) =>
    send(status, JSON.stringify(value), { 'Content-Type': 'application/json' });
  try {
    if (url.pathname === '/_qualification/status') {
      let generation;
      try {
        generation = await upstreamStatus(upstreamPort);
      } catch (error) {
        generation = { error: error.message };
      }
      return json(200, {
        evidence: 'Stable origin forwarding unmodified authentic production generations.',
        origin: `http://127.0.0.1:${port}`,
        upstreamPort,
        online,
        failedPath,
        requests,
        rejected,
        generation,
        events,
      });
    }
    if (url.pathname === '/_qualification/upstream' && req.method === 'POST') {
      const candidate = Number(url.searchParams.get('port'));
      assert.ok(upstreamPorts.has(candidate), 'Only the task-owned generations are allowed.');
      const generation = await upstreamStatus(candidate);
      upstreamPort = candidate;
      record('generation-selected', {
        upstreamPort,
        buildId: generation.buildId,
        commit: generation.observedCommit,
      });
      return json(200, { upstreamPort, buildId: generation.buildId });
    }
    if (url.pathname === '/_qualification/network' && req.method === 'POST') {
      const state = url.searchParams.get('state');
      assert.ok(['online', 'offline'].includes(state));
      online = state === 'online';
      record('origin-network', { online });
      return json(200, { online });
    }
    if (url.pathname === '/_qualification/fault' && req.method === 'POST') {
      const value = url.searchParams.get('path');
      assert.ok(value === null || /^\/game\/[a-zA-Z0-9_./-]+\.mjs$/.test(value));
      failedPath = value;
      record('candidate-resource-fault', { failedPath });
      return json(200, { failedPath });
    }
    requests++;
    if (!online || url.pathname === failedPath) {
      rejected++;
      return send(503, 'Qualification origin resource unavailable');
    }
    if (!['GET', 'HEAD'].includes(req.method)) return send(405, 'Method not allowed');
    const upstream = await fetch(`http://127.0.0.1:${upstreamPort}${url.pathname}${url.search}`, {
      method: req.method,
      redirect: 'manual',
    });
    // Refuse a redirect instead of leaking a different browser origin.
    assert.ok(upstream.status < 300 || upstream.status >= 400, 'Unexpected generated redirect.');
    const headers = Object.fromEntries(upstream.headers);
    delete headers.connection;
    delete headers['keep-alive'];
    res.writeHead(upstream.status, headers);
    res.end(req.method === 'HEAD' ? undefined : Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    record('host-error', { path: url.pathname, error: error.message });
    if (!res.headersSent) return json(502, { error: error.message });
    res.destroy(error);
  }
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(port, '127.0.0.1', resolve);
});
record('dispatcher-ready', { port, upstreamPort, restoredHistory: Boolean(previous) });
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => {
    server.close();
    server.closeAllConnections();
  });
