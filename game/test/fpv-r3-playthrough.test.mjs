import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { verifyFpvR3, verifyFpvR3Proof } from '../../scripts/verify-fpv-r3.mjs';
import {
  preparePack,
  resolvePackCampaign,
  scenarioFromPack,
  emptyPackLibrary,
  installPack,
  exportPackLibrary,
  importPackLibrary,
} from '../packs.mjs';
import { prepareScenario } from '../imports.mjs';
import { inspectImageDataUrl } from '../content.mjs';
import { campaignKey } from '../library.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';
import { suspendSession, restoreSession } from '../sessions.mjs';
const load = async (name) => JSON.parse(await readFile(new URL(name, import.meta.url), 'utf8'));
const source = {
  pack: await load('../content/packs/fpv-arcade-r3.json'),
  prior: await load('../content/packs/fpv-arcade-r2.json'),
  priorProof: await load('../replays/fpv-arcade-r2-routes.json'),
  demo: await load('../content/scenarios/line-impact-demo.json'),
  proof: await load('../replays/fpv-arcade-r3-routes.json'),
};
const protectedPaths = [
  'first-light-routes.json',
  'first-light-gentle-routes.json',
  'classic-lab-routes.json',
  'fpv-arcade-r2-routes.json',
];
const hashes = () =>
  Promise.all(
    protectedPaths.map(async (name) =>
      createHash('sha256')
        .update(await readFile(new URL(`../replays/${name}`, import.meta.url)))
        .digest('hex'),
    ),
  );
const known = new Map(
  source.prior.levelVisuals.map(({ visualOverrides }) => {
    const data = visualOverrides.background.dataUrl;
    return [data, inspectImageDataUrl(data)];
  }),
);
// Exact-original/header-only Node decode boundary, not browser image decoding.
const decodeImage = async (data) => {
  const image = known.get(data);
  assert.ok(image, 'Only the exact prior original picture bytes are accepted.');
  return { naturalWidth: image.width, naturalHeight: image.height };
};

test('R3 preserves twelve real Scout wins and demonstrates capture cancellation and actual front arrival under both turns', async () => {
  const before = await hashes();
  const result = await verifyFpvR3();
  assert.equal(result.routes.length, 12);
  assert.equal(new Set(result.routes.map((r) => r.id)).size, 12);
  for (const route of result.routes) {
    assert.equal(route.won, true);
    assert.equal(route.livesLost, 0);
    assert.ok(route.metrics.eventCounts['capture.stopped'] > 0);
    // These retained winning recipes avoid contact. The demo proves the new effect separately.
    assert.equal(route.metrics.maxFronts, 0);
  }
  assert.equal(result.demonstrations.length, 4);
  for (const demo of result.demonstrations) {
    assert.equal(demo.metrics.maxFronts, 2);
    assert.equal(demo.metrics.eventCounts['lineImpact.seeded'], 1);
    assert.equal(demo.metrics.eventCounts['lineImpact.ended'], 1);
    if (demo.id.endsWith('/arrival')) {
      assert.equal(demo.status, 'lost');
      assert.equal(demo.failureCause, 'enemy-trail');
      assert.equal(demo.metrics.eventCounts['lineImpact.arrived'], 1);
    } else {
      assert.equal(demo.status, 'won');
      assert.equal(demo.metrics.eventCounts['lineImpact.arrived'], undefined);
      assert.equal(demo.metrics.eventCounts['lineImpact.cleared'], 1);
    }
  }
  assert.deepEqual(await hashes(), before);
});

test('R3 pack/library and all mission scenarios retain their new authority and exact original picture bytes', async () => {
  const before = structuredClone(source.pack),
    prepared = (await preparePack(source.pack, { decodeImage })).pack,
    entry = resolvePackCampaign(prepared, prepared.campaigns[0].id);
  assert.notEqual(
    campaignKey(entry.campaign),
    campaignKey({ ...source.prior.campaigns[0], classRecipes: source.prior.classRecipes }),
  );
  const library = installPack(emptyPackLibrary(), prepared);
  assert.deepEqual(await importPackLibrary(exportPackLibrary(library), { decodeImage }), library);
  assert.equal(Object.isFrozen(prepared.campaigns[0].levels[0].classic.lineImpact), true);
  for (const level of prepared.campaigns[0].levels) {
    assert.equal(level.revision, '3');
    assert.deepEqual(level.classic.lineImpact, { version: 'line-impact.v1', speed: 24 });
    const original = await readFile(
      new URL(`../../authoring/library/fpv-arcade/backgrounds/${level.id}.png`, import.meta.url),
    );
    const visual = prepared.levelVisuals.find((v) => v.levelId === level.id);
    assert.deepEqual(
      Buffer.from(visual.visualOverrides.background.dataUrl.split(',')[1], 'base64'),
      original,
    );
    for (const turnPolicy of ['immediate', 'grid-center']) {
      const scenario = scenarioFromPack(prepared, prepared.campaigns[0].id, level.id, {
        classId: 'scout',
        turnPolicy,
      });
      const restored = (await prepareScenario(scenario, { decodeImage })).scenario;
      assert.equal(restored.format, 'xonix-playground.v5');
      assert.equal(restored.masteryDefinition, null);
      assert.deepEqual(restored.level, scenario.level);
      assert.deepEqual(restored.visualOverrides, scenario.visualOverrides);
    }
  }
  const demo = (await prepareScenario(source.demo, { decodeImage })).scenario;
  assert.deepEqual(demo.level, { ...source.demo.level, walls: [], objectives: [], supplies: [] });
  assert.deepEqual(source.pack, before);
});

test('R3 rejects missing, duplicate or foreign route and demonstration authority before simulation', () => {
  for (const change of [
    (p) => p.routes.pop(),
    (p) => p.routes.splice(1, 1, structuredClone(p.routes[0])),
    (p) => {
      p.routes[0].difficulty = 'foreign';
    },
    (p) => p.demonstrations.pop(),
    (p) => p.demonstrations.push(structuredClone(p.demonstrations[0])),
    (p) => {
      p.packSha256 = 'fabricated';
    },
    (p) => {
      p.demoSha256 = 'fabricated';
    },
    (p) => {
      p.routes[0].campaignKey = 'foreign';
    },
    (p) => {
      p.routes[0].levelSha256 = 'fabricated';
    },
  ]) {
    const proof = structuredClone(source.proof);
    change(proof);
    assert.throws(() => verifyFpvR3Proof({ ...source, proof }));
  }
});

test('R3 rejects unreleased capture commands and fabricated summary, checkpoint or event evidence', () => {
  for (const change of [
    (p) => {
      const segments = p.routes[0].segments;
      const i = segments.findIndex((s) => s.input.direction === null);
      assert.ok(i > 0);
      segments.splice(i, 1);
    },
    (p) => {
      p.routes[0].expected.score++;
    },
    (p) => {
      p.routes[0].checkpoint.hash = 'fabricated';
    },
    (p) => {
      p.routes[0].metrics.eventCounts['lineImpact.seeded'] = 1;
    },
    (p) => {
      p.routes[0].segments[0].input.action = true;
    },
  ]) {
    const proof = structuredClone(source.proof);
    change(proof);
    assert.throws(() => verifyFpvR3Proof({ ...source, proof }));
  }
});

test('R3 verifier rejects changed source topology and accessor input without consuming the accessor', () => {
  const pack = structuredClone(source.pack);
  pack.campaigns[0].levels[0].rules.moveSpeed += 0.1;
  assert.throws(() => verifyFpvR3Proof({ ...source, pack }), /preserves the authored R2 boards/);
  let calls = 0;
  const hostile = { ...source };
  Object.defineProperty(hostile, 'proof', {
    enumerable: true,
    get() {
      calls++;
      return source.proof;
    },
  });
  assert.throws(() => verifyFpvR3Proof(hostile));
  assert.equal(calls, 0);
});

test('an actual R3 unfinished cut restores its exact queued Grid turn and future direction under the new campaign key', async () => {
  const campaign = { ...source.pack.campaigns[0], classRecipes: source.pack.classRecipes },
    level = campaign.levels[0],
    options = {
      classId: 'scout',
      classRecipes: campaign.classRecipes,
      turnPolicy: 'grid-center',
      seed: 1,
    },
    run = createRun(level, options),
    recorder = createRecorder(level, options);
  const advance = (state, record, direction, count) => {
    for (let i = 0; i < count; i++) {
      const input = { direction, boost: false, action: false, pickup: false };
      stepRun(state, input, FIXED_DT);
      recordInput(record, input);
    }
  };
  advance(run, recorder, 'down', 13);
  advance(run, recorder, 'right', 1);
  assert.equal(run.status, 'running');
  assert.equal(run.player.cutting, true);
  assert.equal(run.player.queuedDirection, 'right');
  const before = authoritativeCheckpoint(run),
    beforeRecording = exportReplay(recorder, run),
    key = campaignKey(campaign);
  const saved = suspendSession({
    run,
    recorder,
    campaignKey: key,
    themeId: source.pack.themes[0].id,
    bodyId: source.pack.themes[0].player,
    runId: 'r3-queued-grid',
    continuation: { direction: 'right' },
  });
  assert.deepEqual(saved.replay, beforeRecording);
  assert.deepEqual(authoritativeCheckpoint(run), before);
  const restored = await restoreSession(saved, { campaign, campaignKey: key });
  assert.deepEqual(authoritativeCheckpoint(restored.run), before);
  assert.equal(restored.run.player.queuedDirection, 'right');
  assert.equal(restored.session.continuation.direction, 'right');
  advance(run, recorder, 'right', 40);
  advance(restored.run, restored.recorder, restored.session.continuation.direction, 40);
  assert.deepEqual(authoritativeCheckpoint(restored.run), authoritativeCheckpoint(run));
  assert.equal(verifyReplay(exportReplay(restored.recorder, restored.run)).match, true);
});
