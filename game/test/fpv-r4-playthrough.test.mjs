import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { verifyFpvR4, verifyFpvR4Proof } from '../../scripts/verify-fpv-r4.mjs';
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
import { createDifficultyContext } from '../campaign-difficulty.mjs';
import { arcadeActionCapabilities } from '../core/arcade-actions.mjs';
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
  pack: await load('../content/packs/fpv-arcade-r4.json'),
  prior: await load('../content/packs/fpv-arcade-r3.json'),
  priorProof: await load('../replays/fpv-arcade-r3-routes.json'),
  proof: await load('../replays/fpv-arcade-r4-routes.json'),
};
const known = new Map(
  source.prior.levelVisuals.map(({ visualOverrides }) => {
    const data = visualOverrides.background.dataUrl;
    return [data, inspectImageDataUrl(data)];
  }),
);
// Only exact original image headers are inspected in Node; this is not browser decoding.
const decodeImage = async (data) => {
  const image = known.get(data);
  assert.ok(image, 'R4 may only reuse its exact original picture bytes.');
  return { naturalWidth: image.width, naturalHeight: image.height };
};
const protectedFiles = [
  [
    '../content/packs/fpv-arcade-r3.json',
    'af6387ab382e4f614832b1b96abaddbd23c8330a44cc96f64e50271cfe081848',
  ],
  [
    '../replays/fpv-arcade-r3-routes.json',
    'b8ea3fb9998aba9131561f4424fea090549049480065d215c6d2b87285f07e69',
  ],
];
async function assertOriginals() {
  for (const [file, hash] of protectedFiles)
    assert.equal(
      createHash('sha256')
        .update(await readFile(new URL(file, import.meta.url)))
        .digest('hex'),
      hash,
    );
}

test('R4 proves twelve real direction-only wins matching the prior boosted outcomes without rewriting R3', async () => {
  await assertOriginals();
  const result = await verifyFpvR4();
  assert.equal(result.routes.length, 12);
  assert.equal(new Set(result.routes.map((r) => r.id)).size, 12);
  for (const route of result.routes) {
    assert.equal(route.won, true);
    assert.equal(route.livesLost, 0);
    assert.ok(route.metrics.eventCounts['capture.stopped'] > 0);
    assert.equal(route.metrics.eventCounts['ability.used'], undefined);
    assert.equal(route.metrics.eventCounts['pickup.collected'], undefined);
  }
  assert.ok(result.routes.some((r) => r.metrics.eventCounts['powerup.collected'] > 0));
  for (const route of source.proof.routes)
    for (const { input } of route.segments) assert.deepEqual(Object.keys(input), ['direction']);
  await assertOriginals();
});

test('R4 pack, library and both-policy scenario roundtrips retain explicit Arcade authority and exact original pictures', async () => {
  const before = structuredClone(source.pack),
    prepared = (await preparePack(source.pack, { decodeImage })).pack;
  const entry = resolvePackCampaign(prepared, prepared.campaigns[0].id);
  assert.notEqual(
    campaignKey(entry.campaign),
    campaignKey({ ...source.prior.campaigns[0], classRecipes: source.prior.classRecipes }),
  );
  const library = installPack(emptyPackLibrary(), prepared);
  assert.deepEqual(await importPackLibrary(exportPackLibrary(library), { decodeImage }), library);
  assert.deepEqual(prepared.levelVisuals, source.prior.levelVisuals);
  assert.equal(prepared.themes[0].subtitle, 'First Light R4 · Arcade');
  for (const level of prepared.campaigns[0].levels) {
    assert.equal(level.revision, '4');
    assert.equal(level.rules.moveSpeed, 15);
    assert.equal(level.rules.boostMultiplier, 1);
    assert.equal(Object.isFrozen(level.classic.arcadeActions), true);
    assert.deepEqual(arcadeActionCapabilities(level), {
      manualAbility: false,
      manualPickup: false,
      manualBoost: false,
    });
    assert.deepEqual(level.classic.lineImpact, { version: 'line-impact.v1', speed: 24 });
    const original = await readFile(
      new URL(`../../authoring/library/fpv-arcade/backgrounds/${level.id}.png`, import.meta.url),
    );
    const data = prepared.levelVisuals.find((v) => v.levelId === level.id).visualOverrides
      .background.dataUrl;
    assert.deepEqual(Buffer.from(data.split(',')[1], 'base64'), original);
    for (const turnPolicy of ['immediate', 'grid-center']) {
      const scenario = scenarioFromPack(prepared, entry.campaign.id, level.id, {
        classId: 'scout',
        turnPolicy,
      });
      const restored = (await prepareScenario(scenario, { decodeImage })).scenario;
      assert.equal(restored.format, 'xonix-playground.v5');
      assert.deepEqual(restored.level, scenario.level);
      assert.deepEqual(restored.visualOverrides, scenario.visualOverrides);
    }
  }
  assert.deepEqual(source.pack, before);
  assert.equal(Object.hasOwn(source.prior.campaigns[0].levels[0].classic, 'arcadeActions'), false);
});

test('R4 verifier rejects incomplete, foreign, manual-action or unreleased command proofs and unowned input', () => {
  for (const change of [
    (p) => p.routes.pop(),
    (p) => p.routes.splice(1, 1, structuredClone(p.routes[0])),
    (p) => {
      p.packSha256 = 'fabricated';
    },
    (p) => {
      p.r3ProofSha256 = 'fabricated';
    },
    (p) => {
      p.routes[0].campaignKey = 'foreign';
    },
    (p) => {
      p.routes[0].segments[0].input.boost = true;
    },
    (p) => {
      p.routes[0].segments[0].input.action = true;
    },
    (p) => {
      p.routes[0].segments[0].input.pickup = true;
    },
    (p) => {
      const i = p.routes[0].segments.findIndex((s) => s.input.direction === null);
      assert.ok(i > 0);
      p.routes[0].segments.splice(i, 1);
    },
  ]) {
    const proof = structuredClone(source.proof);
    change(proof);
    assert.throws(() => verifyFpvR4Proof({ ...source, proof }));
  }
  const pack = structuredClone(source.pack);
  delete pack.campaigns[0].levels[0].classic.arcadeActions;
  assert.throws(() => verifyFpvR4Proof({ ...source, pack }), /declared immutable R3 derivation/);
  let reads = 0;
  const hostile = { ...source };
  Object.defineProperty(hostile, 'proof', {
    enumerable: true,
    get() {
      reads++;
      return source.proof;
    },
  });
  assert.throws(() => verifyFpvR4Proof(hostile));
  assert.equal(reads, 0);
});

test('R4 verifier recomputes rather than trusting summaries, checkpoints and pickup evidence', () => {
  for (const change of [
    (p) => {
      p.routes[0].expected.score++;
    },
    (p) => {
      p.routes[0].checkpoint.hash = 'fabricated';
    },
    (p) => {
      p.routes[0].metrics.eventCounts['powerup.collected'] = 99;
    },
  ]) {
    const proof = structuredClone(source.proof);
    change(proof);
    assert.throws(() => verifyFpvR4Proof({ ...source, proof }));
  }
});

test('an actual Gentle R4 cut resumes with its queued Grid direction and rejects the R3 campaign context', async () => {
  const base = { ...source.pack.campaigns[0], classRecipes: source.pack.classRecipes };
  const context = createDifficultyContext(base, 'gentle'),
    { campaign } = context;
  const options = {
    classId: 'scout',
    classRecipes: campaign.classRecipes,
    turnPolicy: 'grid-center',
    seed: 1,
  };
  const run = createRun(campaign.levels[0], options),
    recorder = createRecorder(campaign.levels[0], options);
  const advance = (state, record, direction, count) => {
    for (let i = 0; i < count; i++) {
      const input = { direction };
      recordInput(record, input);
      stepRun(state, input, FIXED_DT);
    }
  };
  advance(run, recorder, 'down', 13);
  advance(run, recorder, 'right', 1);
  assert.equal(run.player.cutting, true);
  assert.equal(run.player.queuedDirection, 'right');
  const checkpoint = authoritativeCheckpoint(run);
  const saved = suspendSession({
    run,
    recorder,
    campaignKey: context.campaignKey,
    themeId: source.pack.themes[0].id,
    bodyId: source.pack.themes[0].player,
    runId: 'r4-gentle-queued-grid',
    continuation: { direction: 'right' },
  });
  const restored = await restoreSession(saved, { campaign, campaignKey: context.campaignKey });
  assert.deepEqual(authoritativeCheckpoint(restored.run), checkpoint);
  assert.equal(restored.session.continuation.direction, 'right');
  const prior = createDifficultyContext(
    { ...source.prior.campaigns[0], classRecipes: source.prior.classRecipes },
    'gentle',
  );
  await assert.rejects(() =>
    restoreSession(saved, { campaign: prior.campaign, campaignKey: prior.campaignKey }),
  );
  advance(run, recorder, 'right', 40);
  advance(restored.run, restored.recorder, restored.session.continuation.direction, 40);
  assert.deepEqual(authoritativeCheckpoint(restored.run), authoritativeCheckpoint(run));
  assert.equal(verifyReplay(exportReplay(restored.recorder, restored.run)).match, true);
});
