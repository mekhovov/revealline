import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import {
  createProductionMemory,
  selectProductionMemoryMode,
  PRODUCTION_MEMORY_POLICY,
} from './practice-production-memory.mjs';
const sha = (b) => createHash('sha256').update(b).digest('hex');
const pin = (name, b) => ({ path: name, bytes: b.length, sha256: sha(b) });
test('explicit production-v2 opt-in only', () => {
  assert.equal(selectProductionMemoryMode(undefined, false), false);
  assert.equal(selectProductionMemoryMode('bounded-original-memory-v1', true), true);
  for (const value of ['', '0', 'all', 'file'])
    assert.throws(() => selectProductionMemoryMode(value, true));
  assert.throws(() => selectProductionMemoryMode('bounded-original-memory-v1', false));
});
test('deterministic bounded selection independent of manifest order, no large payload cache', () => {
  const rows = [
    { path: 'z.png', bytes: 300000, sha256: 'a'.repeat(64) },
    { path: 'a.mjs', bytes: 100, sha256: 'b'.repeat(64) },
    { path: 'a.json', bytes: 600000, sha256: 'c'.repeat(64) },
    { path: 'b.woff2', bytes: 50, sha256: 'd'.repeat(64) },
  ];
  const a = {},
    b = {};
  createProductionMemory(rows, a);
  createProductionMemory([...rows].reverse(), b);
  assert.deepEqual(a.selected, b.selected);
  assert.deepEqual(
    a.selected.map((x) => x.path),
    ['a.mjs', 'b.woff2'],
  );
  const large = Array.from({ length: 20 }, (_, i) => ({
      path: `${String(i).padStart(2, '0')}.mjs`,
      bytes: 8 * 1024 * 1024,
      sha256: 'a'.repeat(64),
    })),
    r = {};
  createProductionMemory(large, r);
  assert.equal(r.selectedBytes, PRODUCTION_MEMORY_POLICY.maxBytes);
  assert.equal(r.selected.length, 16);
});
test('private copies reject changed bytes/metadata and cannot be mutated through reads', () => {
  const bytes = Buffer.from('original'),
    p = pin('game/a.mjs', bytes),
    r = {},
    c = createProductionMemory([p], r);
  assert.throws(() => c.ready());
  assert.throws(() => c.read(p.path));
  assert.throws(() => c.retain(p.path, Buffer.from('modified')));
  c.retain(p.path, bytes);
  bytes.fill(0);
  p.sha256 = '0'.repeat(64);
  r.selected[0].sha256 = '0'.repeat(64);
  assert(c.ready());
  const read = c.read('game/a.mjs');
  assert.equal(read.toString(), 'original');
  read.fill(0);
  assert.equal(c.read('game/a.mjs').toString(), 'original');
  assert.throws(() => c.retain('game/a.mjs', Buffer.from('original')));
  c.delivered('game/a.mjs', 'verified-memory', c.read('game/a.mjs'));
  assert.equal(r.memoryRequests, 1);
  assert.throws(() => c.delivered('game/a.mjs', 'verified-original-file', c.read('game/a.mjs')));
  c.clear();
  assert(r.cleared && r.remainingBytes === 0);
  assert.throws(() => c.read('game/a.mjs'));
});
test('nonselected original falls back, unknown path and tampered fallback rejected', () => {
  const body = Buffer.from('payload'),
    r = {},
    c = createProductionMemory([pin('game/a.zip', body)], r);
  assert(c.ready());
  assert.equal(c.read('game/a.zip'), null);
  c.delivered('game/a.zip', 'verified-original-file', body);
  assert.equal(r.fileRequests, 1);
  assert.throws(() => c.read('game/unknown.mjs'));
  assert.throws(() => c.delivered('game/a.zip', 'verified-original-file', Buffer.from('changed')));
});
test('unsafe, duplicate, oversized or noncanonical manifest pins rejected', () => {
  const p = pin('game/a.mjs', Buffer.from('a'));
  for (const rows of [
    [p, p],
    [{ ...p, path: '../a' }],
    [{ ...p, path: 'x%2fa' }],
    [{ ...p, bytes: -1 }],
    [{ ...p, sha256: 'bad' }],
    [{ ...p, extra: 1 }],
  ])
    assert.throws(() => createProductionMemory(rows, {}));
});
async function serverFixture(readOriginal) {
  const s = await readFile(
    new URL('./observe-practice-directory-journey.mjs', import.meta.url),
    'utf8',
  );
  const code = s.slice(
    s.indexOf('export async function directoryJourneyServer('),
    s.indexOf('const closeServer ='),
  );
  const body = Buffer.from('original'),
    other = Buffer.from('binary'),
    receipt = {},
    memory = createProductionMemory([pin('game/a.mjs', body), pin('game/a.zip', other)], receipt);
  memory.retain('game/a.mjs', body);
  memory.ready();
  const report = { requestFailures: [], servedSources: [] };
  const factory = Function(
    'assert',
    'createServer',
    'PUBLIC_SECURITY_HEADERS',
    'PREVIEW_SECURITY_HEADERS',
    'directorySourcePath',
    'readDirectoryDistributionFile',
    'pin',
    'path',
    'PRODUCTION_MIME',
    'MIME',
    code.replace('export async', 'async') + '\nreturn directoryJourneyServer;',
  );
  const start = factory(
    assert,
    createServer,
    { 'content-security-policy': "default-src 'self'" },
    {},
    (raw) => raw.slice(1),
    readOriginal,
    pin,
    { extname: () => '.mjs' },
    { '.mjs': 'text/javascript' },
    {},
  );
  const server = await start(new Map(), new Map(), report, { memory });
  return { server, body, other, report, receipt, memory };
}
async function closeServer(s) {
  s.stop();
  s.server.closeAllConnections();
  await new Promise((resolve, reject) => s.server.close((e) => (e ? reject(e) : resolve())));
  await s.settled();
}
test('actual observer server uses cloned original cache and verified fallback with original CSP', async () => {
  const reads = [];
  const f = await serverFixture(async (_, name) => {
    reads.push(name);
    return Buffer.from(name === 'manifest.json' ? 'manifest' : 'binary');
  });
  try {
    for (const [name, text] of [
      ['game/a.mjs', 'original'],
      ['game/a.zip', 'binary'],
      ['manifest.json', 'manifest'],
    ]) {
      const res = await fetch(f.server.url + name);
      assert.equal(res.status, 200);
      assert.equal(await res.text(), text);
      assert.equal(res.headers.get('content-security-policy'), "default-src 'self'");
    }
    assert.deepEqual(reads, ['game/a.zip', 'manifest.json']);
    assert.equal(f.receipt.memoryRequests, 1);
    assert.equal(f.receipt.fileRequests, 1);
    assert.equal((await fetch(f.server.url + 'game/unknown.mjs')).status, 404);
    assert.equal(reads.length, 2);
  } finally {
    await closeServer(f.server);
    f.memory.clear();
  }
  assert.equal(f.server.pending(), 0);
});
test('actual observer pending read remains owned across response close and prevents late response', async () => {
  let release;
  const f = await serverFixture(
    () =>
      new Promise((resolve) => {
        release = () => resolve(Buffer.from('binary'));
      }),
  );
  const request = fetch(f.server.url + 'game/a.zip').catch(() => null);
  while (!release) await new Promise((resolve) => setTimeout(resolve, 1));
  assert.equal(f.server.pending(), 1);
  let settled = false;
  const closing = closeServer(f.server).then(() => {
    settled = true;
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(settled, false);
  assert.equal(f.server.pending(), 1);
  release();
  await closing;
  await request;
  assert.equal(f.server.pending(), 0);
  f.memory.clear();
});
test('integration keeps full before/after verification and unchanged journey deadlines', async () => {
  const s = await readFile(
    new URL('./observe-practice-directory-journey.mjs', import.meta.url),
    'utf8',
  );
  assert(
    s.includes(
      'distribution = await verifyDirectoryDistribution(plan, ioPhase, report.productionDelivery)',
    ),
  );
  assert(s.includes('await verifyDirectoryDistribution(plan, ioPhase);'));
  assert(s.includes('await io.members([...files.values()]'));
  for (const v of ['caseMs: 90_000', 'overallMs: 600_000', 'actionMs: 10_000'])
    assert(s.includes(v));
  assert(s.includes('if (memoryDelivery) {\n        server.stop();'));
});
