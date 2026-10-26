/** Unit-only synthetic observation records; never native acceptance evidence. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  PACK,
  verifyC4ImportBytes,
  expectedC4AssetFingerprint,
  assertC4ImportedWorld,
  assertC4OfflineFlight,
} from './practice-imported-world-check.mjs';
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const store = (name, rows) => ({ name, count: rows.length, rows, sha256: digest(rows) });
const row = (n) => ({ key: digest(n), sha256: digest({ n }) });
const state = () => ({
  card: { id: PACK.id, title: PACK.title, digestPrefix: PACK.sha256.slice(0, 12) },
  database: {
    name: 'revealline-fpv-worlds-v1',
    version: 1,
    stores: [
      store('projects', [row(1), row(2)]),
      store('revisions', [row(3), row(4)]),
      store('assets', [expectedC4AssetFingerprint()]),
    ],
  },
});
const flight = () => ({
  networkProbeFailed: true,
  processRestartConfirmed: true,
  explicitArm: true,
  replay: false,
  before: { visible: true, gauge: 'Height', height: 0 },
  after: { visible: true, gauge: 'Height', height: 0.2 },
  explicitPause: true,
  paused: [0, 200, 400, 600].map((at) => ({
    at,
    height: 0.3,
    visible: true,
    gauge: 'Height',
    phase: 'paused',
  })),
});
test('rejects substituted or missing committed pack bytes', () => {
  assert.throws(() => verifyC4ImportBytes(Buffer.alloc(PACK.bytes)));
  assert.throws(() => verifyC4ImportBytes(Buffer.alloc(1)));
});
test('requires exact imported asset and full retained database fingerprints', () => {
  const before = state();
  assert.equal(assertC4ImportedWorld(state(), before), true);
  for (const change of [
    (s) => (s.card.id = 'template'),
    (s) => s.database.stores.pop(),
    (s) => (s.database.stores[2] = store('assets', [row(7)])),
    (s) => (s.database.stores[0].sha256 = '0'.repeat(64)),
    (s) => (s.database.stores[0] = store('projects', [row(8), row(9)])),
  ]) {
    const changed = state();
    change(changed);
    assert.throws(() => assertC4ImportedWorld(changed, before));
  }
});
test('requires actual positive movement and stable public paused measurements', () => {
  assert.deepEqual(assertC4OfflineFlight(flight()), {
    observed: true,
    exerciseCompleted: false,
    machineWideOutageQualified: false,
  });
  for (const change of [
    (w) => (w.networkProbeFailed = false),
    (w) => (w.processRestartConfirmed = false),
    (w) => (w.explicitArm = false),
    (w) => (w.replay = true),
    (w) => (w.after.visible = false),
    (w) => (w.after.gauge = 'Speed'),
    (w) => (w.before.height = 0.4),
    (w) => (w.after.height = 1),
    (w) => (w.paused[3].height = 0.4),
    (w) => (w.paused[3].at = 599),
    (w) => (w.paused[3].phase = 'active'),
  ]) {
    const changed = flight();
    change(changed);
    assert.throws(() => assertC4OfflineFlight(changed));
  }
});
