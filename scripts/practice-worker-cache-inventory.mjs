/** Read-only inventory extraction from a worker already admitted by the caller.
 * This is not worker admission: its executable function is never evaluated here.
 */
import assert from 'node:assert/strict';
import { parse } from 'acorn';

export function practiceWorkerCacheInventory({ workerBytes, baseURL, cacheName }) {
  assert(
    Buffer.isBuffer(workerBytes) && workerBytes.length > 0 && workerBytes.length <= 1024 * 1024,
  );
  assert.equal(typeof baseURL, 'string');
  const base = new URL(baseURL);
  assert(
    base.protocol === 'http:' &&
      base.hostname === '127.0.0.1' &&
      !base.username &&
      !base.password &&
      !base.search &&
      !base.hash &&
      base.href === baseURL,
    'Require a canonical owned loopback base URL.',
  );
  const route = base.pathname.match(
    /^(\/(?:[A-Za-z0-9_-]+\/)*practice\/(civilian-flight|civilian-fpv|fpv-worlds)\/)(app\/|releases\/(v[0-9]+\.[0-9]+\.[0-9]+)\/site\/optional-practice\/([^/]+)\/)$/,
  );
  assert(route, 'Require an exact package runtime or launcher scope.');
  const [, root, packageId, suffix, version, runtimeId] = route;
  if (runtimeId) assert.equal(runtimeId, packageId);
  const allowedPath = version ? `${root}releases/${version}/site/` : `${root}${suffix}`;
  const source = workerBytes.toString('utf8');
  assert(Buffer.from(source).equals(workerBytes), 'Worker must contain valid UTF-8.');
  const program = parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
  assert.equal(program.body.length, 1);
  const statement = program.body[0],
    call = statement.expression;
  assert.equal(statement.type, 'ExpressionStatement');
  assert.equal(call?.type, 'CallExpression');
  assert.equal(call.callee.type, 'FunctionExpression');
  assert(!call.optional && !call.callee.async && !call.callee.generator);
  assert.equal(call.arguments.length, 3);
  const [scope, pinsNode, revisionNode] = call.arguments;
  assert(scope.type === 'Identifier' && scope.name === 'self');
  assert.equal(pinsNode.type, 'ArrayExpression');
  assert.equal(revisionNode.type, 'Literal');
  // JSON parsing the exact argument slices rejects calls, spreads, getters,
  // comments, computed fields and other executable argument expressions.
  const pins = JSON.parse(source.slice(pinsNode.start, pinsNode.end));
  const revision = JSON.parse(source.slice(revisionNode.start, revisionNode.end));
  assert.match(revision, /^[a-f0-9]{64}$/);
  const namespace = packageId === 'civilian-flight' ? 'civilian-flight' : 'package';
  assert.equal(cacheName, `revealline.optional.${namespace}.v1:${base.pathname}:${revision}`);
  assert(Array.isArray(pins) && pins.length > 0 && pins.length <= 512);
  let total = 0;
  const seen = new Set();
  const files = pins.map((pin) => {
    assert(pin && typeof pin === 'object' && !Array.isArray(pin));
    assert.deepEqual(Object.keys(pin).sort(), ['bytes', 'path', 'sha256']);
    assert(typeof pin.path === 'string' && pin.path.length > 0 && pin.path.length <= 2048);
    assert(!/[\\%?#\s]/.test(pin.path) && !pin.path.startsWith('/') && !pin.path.includes(':'));
    assert(Number.isSafeInteger(pin.bytes) && pin.bytes >= 0 && pin.bytes <= 64 * 1024 * 1024);
    assert.match(pin.sha256, /^[a-f0-9]{64}$/);
    const url = new URL(pin.path, base);
    assert(url.origin === base.origin && url.pathname.startsWith(allowedPath));
    assert(!seen.has(url.href), 'Duplicate resolved cache URL.');
    seen.add(url.href);
    total += pin.bytes;
    assert(total <= 256 * 1024 * 1024, 'Worker inventory exceeds total bound.');
    return { url: url.href, bytes: pin.bytes, sha256: pin.sha256 };
  });
  return { name: cacheName, files };
}
