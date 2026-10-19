import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { emittedEvidenceSnapshot, closeOwnedPreview } from './demo-probe-evidence.mjs';
import { finishQualification } from '../scripts/shared-demo-browser-report.mjs';
import { fingerprintDemoSources } from '../scripts/demo-source-fingerprint.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'demo-evidence-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'capture'));
  await mkdir(path.join(root, 'docs'));
  await writeFile(path.join(root, 'capture/manifest.json'), JSON.stringify({ auditReportPath: 'docs/audit.json', inventorySHA256: 'a'.repeat(64), sourceRevision: 'b'.repeat(40), sourceFingerprint: { sha256: 'c'.repeat(64) }, buildInputFingerprint: { sha256: 'd'.repeat(64) } }));
  await writeFile(path.join(root, 'docs/audit.json'), '{"complete":true}');
  await writeFile(path.join(root, 'docs/audit.inventory.json'), '{"files":[]}');
  return root;
}
test('capture, audit and inventory bytes are independently bound, including formatting-only mutation', async t => {
  const root = await fixture(t);
  const before = await emittedEvidenceSnapshot(root, 'capture');
  for (const relative of ['capture/manifest.json', 'docs/audit.json', 'docs/audit.inventory.json']) {
    const file = path.join(root, relative), original = await readFile(file);
    await writeFile(file, Buffer.concat([original, Buffer.from('\n')]));
    const after = await emittedEvidenceSnapshot(root, 'capture');
    assert.notDeepEqual(after, before, relative);
    await writeFile(file, original);
    assert.deepEqual(await emittedEvidenceSnapshot(root, 'capture'), before);
  }
});
test('canonical scripts and authoring fingerprint detects an unlisted helper or authored JSON mutation', async t => {
  const root = await fixture(t);
  await mkdir(path.join(root, 'scripts')); await mkdir(path.join(root, 'authoring'));
  await writeFile(path.join(root, 'scripts/other-helper.mjs'), 'export const value = 1;');
  await writeFile(path.join(root, 'authoring/data.json'), '{"value":1}');
  const before = await fingerprintDemoSources(root, ['scripts','authoring']);
  assert.equal(before.files, 2);
  for (const relative of ['scripts/other-helper.mjs', 'authoring/data.json']) {
    const file = path.join(root, relative), original = await readFile(file);
    await writeFile(file, Buffer.concat([original, Buffer.from('\n')]));
    assert.notDeepEqual(await fingerprintDemoSources(root, ['scripts','authoring']), before);
    await writeFile(file, original);
  }
});
test('preview cleanup follows browser cleanup and saves exactly once', async () => {
  const order = [], report = { complete: true, checks: [] };
  await finishQualification({ report, reportPath: 'unused', browser: { close: async () => order.push('browser') }, emit() {},
    writeReport: async () => {
      await closeOwnedPreview({ server: { closeAllConnections: () => order.push('connections'), close: done => { order.push('server'); done(); } } }, report, 10);
      order.push('report');
    },
  });
  assert.deepEqual(order, ['browser','connections','server','report']);
  assert.equal(report.complete, true); assert.equal(report.serverCleanup.complete, true); assert.equal(report.serverClosed, true);
});
test('server callback failure preserves primary error while recording explicit failed cleanup', async () => {
  const report = { complete: false, failure: 'original functional failure' };
  await closeOwnedPreview({ server: { closeAllConnections() {}, close: done => done(new Error('close failed')) } }, report, 10);
  assert.equal(report.failure, 'original functional failure'); assert.equal(report.serverCleanup.complete, false);
  assert.match(report.serverCleanup.error, /close failed/); assert.equal(report.secondaryDiagnostics[0].stage, 'preview-close');
});
test('stalled preview close times out, saves failure, and late callback cannot rewrite the result', async () => {
  const report = { complete: true, checks: [] }; let late, writes = 0;
  const result = await finishQualification({ report, reportPath:'unused', browser:{ close:async()=>{} }, emit(){}, writeReport:async()=>{
    await closeOwnedPreview({ server:{ closeAllConnections(){}, close:done=>{ late=done; } } }, report, 5); writes++;
  }});
  assert.equal(writes,1); assert.equal(result.complete,false); assert.equal(report.serverCleanup.complete,false);
  assert.match(report.failure,/exceeded 5ms/); assert.equal(report.serverCleanup.timeoutMs,5);
  const snapshot=structuredClone(report); late(); await Promise.resolve(); assert.deepEqual(report,snapshot);
});
