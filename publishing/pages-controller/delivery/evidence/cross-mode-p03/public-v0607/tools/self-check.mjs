import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, symlink, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCE, TREE, VERSION, RETAINED_CATALOG_SHA, sha, safePath, validateRows, validateModels, auditRows, isTransient, loadAuthority } from './audit-main.mjs';
import { inspect, expectedTypes } from './http-engine.mjs';
const home = path.dirname(fileURLToPath(import.meta.url));
assert.equal(SOURCE, 'a36d62f2fc3af67e3fffcafda3656c413ca77341');
assert.equal(TREE, 'eaa76580e442311e87e6761a7d442f38f8f06652');
assert.equal(VERSION, 'v0.60.7');
const retainedRaw = await readFile(path.join(home, 'retained-catalog.json'));
assert.equal(sha(retainedRaw), RETAINED_CATALOG_SHA);
assert.equal(JSON.parse(retainedRaw).releases.length, 77);
for (const candidate of [{reviewed:false}, {}]) assert.throws(() => validateModels(candidate, {}, {}, {}), /Explicitly reviewed binding required/);
for (const p of ['../x.json', '/x.json', 'x//y.json', 'x/./y.json', 'x/../y.json', 'x\\y.json', 'x\0.json']) assert.throws(() => safePath(p));
assert.equal(safePath('.nojekyll'), '.nojekyll');
const bytes = Buffer.from('test\n'), file = { path: 'game/check.txt', bytes: bytes.length, sha256: sha(bytes) };
assert.deepEqual(validateRows([file]), [file]);
assert.throws(() => validateRows([file, file]));
assert.throws(() => validateRows([{ ...file, bytes: -1 }]));
assert.throws(() => validateRows([{ ...file, path: 'game/check.unreviewed' }]));
assert.throws(() => expectedTypes('x.unreviewed'));
let requests = 0;
const fetchImpl = async (url, options) => {
  requests++;
  assert.equal(url, 'https://mekhovov.github.io/revealline/game/check.txt');
  assert.equal(options.redirect, 'manual');
  assert.equal(options.cache, 'no-store');
  return new Response(bytes, { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } });
};
assert.equal((await inspect(file, 1, { fetchImpl })).ok, true);
for (const [body, status, mime] of [[bytes,302,'text/plain'],[bytes,404,'text/plain'],[bytes,200,'text/html'],[Buffer.from('wrong'),200,'text/plain'],[Buffer.from('oversized'),200,'text/plain']]) {
 const result = await inspect(file, 1, { fetchImpl: async () => new Response(body, { status, headers: { 'content-type': mime } }) });
 assert.equal(result.ok, false);
 assert.equal(isTransient(result), false);
}
const saved = [];
const result = await auditRows([file], {
 inspectImpl: async (row, attempt) => ({ path: row.path, attempt, status: attempt === 1 ? 503 : 200, ok: attempt > 1, bytes: row.bytes }),
 append: async (name, row) => saved.push({ name, ...row }), delay: async () => {},
});
assert.equal(result.attempts.length, 2);
assert.equal(saved.filter(x => x.name === 'attempts.jsonl' && x.ok === false).length, 1);
const bad = await auditRows([file], { inspectImpl: async (row, attempt) => ({ path: row.path, attempt, status: 200, ok: false, error: 'wrong hash' }), delay: async () => { throw Error('Nontransient retry'); } });
assert.equal(bad.attempts.length, 1);
// Test symlink refusal using empty directories only: no synthetic publication binding is created.
const scratch = await mkdtemp(path.join(home, 'self-check-'));
try {
 await mkdir(path.join(scratch, 'ordinary'));
 await symlink(path.join(scratch, 'ordinary'), path.join(scratch, 'inputs'));
 await assert.rejects(loadAuthority(path.join(scratch, 'inputs', 'absent.json'), 'a'.repeat(64), { home: scratch }), /Symlink authority component/);
} finally { await rm(scratch, { recursive: true }); }
const provenance = JSON.parse(await readFile(path.join(home, 'preparation-provenance.json')));
assert.equal(sha(await readFile(path.join(home, 'http-engine.mjs'))), provenance.upstream.find(x => x.path.endsWith('/http-engine.mjs')).sha256);
console.log(JSON.stringify({status:'HELPER_SELF_CHECK_PASS',realNetworkRequests:0,mockedFetchCalls:requests,productionBindingsCreated:0,publicAcceptance:false}));
