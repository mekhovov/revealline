import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRun, stepRun, releaseInputs, FIXED_DT } from '../core/index.mjs';
import { versionsForLevel } from '../core/versions.mjs';
import {
  createRecorder,
  recordInput,
  recordRelease,
  exportReplay,
  verifyReplay,
  MAX_REPLAY_TICKS,
} from '../replay.mjs';
import { validatePack } from '../packs.mjs';
import { createDifficultyContext, GENTLE_POLICY_VERSION } from '../campaign-difficulty.mjs';

const readJSON = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [
  base,
  classRecipes,
  packIndex,
  proof,
  firstLightProof,
  r2Proof,
  r3Proof,
  archiveIndex,
  r4Proof,
  r5Proof,
] = await Promise.all([
  readJSON('../content/campaign.json'),
  readJSON('../content/classes.json'),
  readJSON('../content/packs/index.json'),
  readJSON('../replays/gentle-routes.json'),
  readJSON('../replays/first-light-gentle-routes.json'),
  readJSON('../replays/fpv-arcade-r2-routes.json'),
  readJSON('../replays/fpv-arcade-r3-routes.json'),
  readJSON('../content/packs/archive-index.json'),
  readJSON('../replays/fpv-arcade-r4-routes.json'),
  readJSON('../replays/fpv-arcade-r5-routes.json'),
]);
const originals = [{ packId: null, campaign: { ...base, classRecipes } }];
for (const ref of [...packIndex.packs, ...archiveIndex.packs]) {
  const pack = await readJSON(`../content/packs/${ref.path}`);
  const check = validatePack(pack);
  assert.equal(check.valid, true, check.errors.join('; '));
  assert.equal(pack.id, ref.id);
  // This is structural/core evidence, not installation or image decoding. Use
  // the declared filtered roster in pack order, as resolvePackCampaign does.
  for (const campaign of pack.campaigns)
    originals.push({
      packId: pack.id,
      campaign: {
        ...campaign,
        classRecipes: pack.classRecipes.filter(
          (recipe) => !campaign.classIds || campaign.classIds.includes(recipe.id),
        ),
      },
    });
}
const sources = originals.map(({ packId, campaign }) => ({
  packId,
  campaignId: campaign.id,
  context: createDifficultyContext(campaign, 'gentle'),
}));
const byKey = new Map(sources.map((source) => [source.context.campaignKey, source.context]));
const routeKey = (route) => JSON.stringify([route.campaignKey, route.levelId, route.turnPolicy]);

test('Gentle proofs cover every shipped map and policy while preserving the legacy oracle', () => {
  assert.equal(proof.format, 'xonix-gentle-proof.v1');
  assert.equal(proof.policyVersion, GENTLE_POLICY_VERSION);
  assert.equal(byKey.size, sources.length);
  assert.deepEqual(
    proof.sources,
    sources
      .filter(
        (source) =>
          ![
            'fpv-arcade',
            'fpv-arcade-r2',
            'fpv-arcade-r3',
            'fpv-arcade-r4',
            'fpv-arcade-r5',
            'fpv-pressure-frontier',
          ].includes(source.packId),
      )
      .map(({ packId, campaignId, context }) => ({
        packId,
        campaignId,
        baseCampaignKey: context.baseCampaignKey,
        campaignKey: context.campaignKey,
      })),
  );
  const expected = sources.flatMap(({ context }) =>
    context.campaign.levels.flatMap((level) =>
      ['immediate', 'grid-center'].map((turnPolicy) =>
        routeKey({ campaignKey: context.campaignKey, levelId: level.id, turnPolicy }),
      ),
    ),
  );
  assert.equal(proof.routes.length, 58, 'The 29-map legacy oracle remains unchanged.');
  const firstLight = sources.filter((source) => source.packId === 'fpv-arcade');
  assert.equal(firstLight.length, 1);
  assert.equal(firstLightProof.campaignId, firstLight[0].campaignId);
  assert.equal(firstLightProof.campaignKey, firstLight[0].context.campaignKey);
  assert.equal(firstLightProof.baseCampaignKey, firstLight[0].context.baseCampaignKey);
  assert.equal(firstLightProof.policyVersion, GENTLE_POLICY_VERSION);
  assert.equal(firstLightProof.difficulty, 'gentle');
  const r2 = sources.filter((source) => source.packId === 'fpv-arcade-r2');
  assert.equal(r2.length, 1);
  assert.equal(r2Proof.baseCampaignKey, r2[0].context.baseCampaignKey);
  const r2Gentle = r2Proof.routes.filter((route) => route.difficulty === 'gentle');
  assert.equal(r2Gentle.length, 6);
  assert.ok(r2Gentle.every((route) => route.campaignKey === r2[0].context.campaignKey));
  const r3 = sources.filter((source) => source.packId === 'fpv-arcade-r3');
  assert.equal(r3.length, 1);
  assert.equal(r3Proof.baseCampaignKey, r3[0].context.baseCampaignKey);
  const r3Gentle = r3Proof.routes.filter((route) => route.difficulty === 'gentle');
  assert.equal(r3Gentle.length, 6);
  assert.ok(r3Gentle.every((route) => route.campaignKey === r3[0].context.campaignKey));
  const r4 = sources.filter((source) => source.packId === 'fpv-arcade-r4');
  assert.equal(r4.length, 1);
  assert.equal(r4Proof.baseCampaignKey, r4[0].context.baseCampaignKey);
  const r4Gentle = r4Proof.routes.filter((route) => route.difficulty === 'gentle');
  assert.equal(r4Gentle.length, 6);
  assert.ok(r4Gentle.every((route) => route.campaignKey === r4[0].context.campaignKey));
  const pressure = sources.filter((source) =>
    ['fpv-arcade-r5', 'fpv-pressure-frontier'].includes(source.packId),
  );
  assert.equal(pressure.length, 2);
  const r5Gentle = r5Proof.routes.filter((route) => route.difficulty === 'gentle');
  assert.equal(r5Gentle.length, 12);
  for (const source of pressure) {
    assert.equal(
      r5Proof.packs.find((pack) => pack.id === source.packId)?.campaignKey,
      source.context.baseCampaignKey,
    );
    const routes = r5Gentle.filter((route) => route.packId === source.packId);
    assert.equal(routes.length, 6);
    assert.ok(routes.every((route) => route.campaignKey === source.context.campaignKey));
  }
  const combined = [
    ...r5Gentle,
    ...r4Gentle,
    ...r3Gentle,
    ...r2Gentle,
    ...proof.routes,
    ...firstLightProof.routes.map((route) => ({
      ...route,
      campaignKey: firstLightProof.campaignKey,
    })),
  ];
  assert.equal(
    expected.length,
    94,
    'All 47 base, active and archived maps need both real steering routes.',
  );
  assert.deepEqual(combined.map(routeKey).sort(), expected.sort());
});

for (const route of proof.routes)
  test(`Gentle ${route.levelId}/${route.turnPolicy}: legal inputs reproduce the exact win`, () => {
    const context = byKey.get(route.campaignKey);
    assert.ok(context, 'Route needs its exact shipped campaign context.');
    const level = context.campaign.levels.find((candidate) => candidate.id === route.levelId);
    assert.ok(level, 'Route needs a declared map.');
    const options = {
      classId: route.classId,
      seed: route.seed,
      turnPolicy: route.turnPolicy,
      classRecipes: context.campaign.classRecipes,
    };
    const run = createRun(level, options);
    const recorder = createRecorder(level, options, 'gentle-routes-proof');
    assert.ok(Number.isInteger(route.expected.tick) && route.expected.tick > 0);
    assert.ok(route.expected.tick <= MAX_REPLAY_TICKS);
    assert.equal(
      route.segments.reduce((ticks, segment) => {
        assert.ok(Number.isInteger(segment.ticks) && segment.ticks > 0);
        return ticks + segment.ticks;
      }, 0),
      route.expected.tick,
    );
    for (const segment of route.segments) {
      if (segment.releaseBefore) {
        releaseInputs(run);
        recordRelease(recorder);
      }
      for (let tick = 0; tick < segment.ticks; tick++) {
        assert.ok(
          run.status === 'running' || run.status === 'respawning',
          'No recorded command may advance an already terminal run.',
        );
        stepRun(run, segment.input, FIXED_DT);
        recordInput(recorder, segment.input);
      }
    }
    if (route.releaseAfter) {
      releaseInputs(run);
      recordRelease(recorder);
    }
    const replay = exportReplay(recorder, run);
    const versions = versionsForLevel(level);
    assert.equal(replay.version, versions.replayVersion);
    assert.equal(replay.checkpoint.algorithm, versions.checkpointAlgorithm);
    assert.deepEqual(replay.segments, route.segments);
    assert.equal(replay.releaseAfter, route.releaseAfter);
    assert.deepEqual(replay.summary, route.expected);
    assert.deepEqual(replay.checkpoint, route.checkpoint);
    assert.equal(run.status, 'won');
    assert.ok(run.coverage >= level.goal.coverage);
    assert.ok(run.objectives.filter((objective) => objective.required).every((o) => o.captured));
    const verified = verifyReplay(replay);
    assert.equal(verified.match, true, JSON.stringify(verified.diagnostics));
  });

test('First Light Gentle routes reproduce six exact wins with their own source and checkpoints', async () => {
  const { verifyFirstLight } = await import('../../scripts/verify-first-light.mjs');
  const result = await verifyFirstLight({ difficulty: 'gentle' });
  assert.equal(result.routes.length, 6);
  assert.ok(result.routes.every((route) => route.lives === 5));
});

test('R2 Gentle coverage is backed by the complete strict twelve-route release-gesture verifier', async () => {
  const { verifyFpvR2 } = await import('../../scripts/verify-fpv-r2.mjs');
  const result = await verifyFpvR2();
  const gentle = result.routes.filter((route) => route.difficulty === 'gentle');
  assert.equal(gentle.length, 6);
  assert.ok(gentle.every((route) => route.lives >= 5 && route.livesLost === 0));
});

test('R3 Gentle coverage is backed by twelve route wins and four real impact demonstrations', async () => {
  const { verifyFpvR3 } = await import('../../scripts/verify-fpv-r3.mjs');
  const result = await verifyFpvR3();
  const gentle = result.routes.filter((route) => route.id.startsWith('gentle/'));
  assert.equal(gentle.length, 6);
  assert.ok(gentle.every((route) => route.lives === 5 && route.livesLost === 0));
  assert.equal(result.demonstrations.length, 4);
});

test('R4 Gentle coverage is backed by twelve direction-only exact core and replay wins', async () => {
  const { verifyFpvR4 } = await import('../../scripts/verify-fpv-r4.mjs');
  const result = await verifyFpvR4();
  const gentle = result.routes.filter((route) => route.id.startsWith('gentle/'));
  assert.equal(gentle.length, 6);
  assert.ok(gentle.every((route) => route.lives === 5 && route.livesLost === 0));
});

test('both pressure chapters supply twelve Gentle wins within the exact twenty-four-route verifier', async () => {
  const { verifyFpvR5 } = await import('../../scripts/verify-fpv-r5.mjs');
  const result = await verifyFpvR5();
  assert.equal(result.routes.length, 24);
  const gentle = result.routes.filter((route) => route.difficulty === 'gentle');
  assert.equal(gentle.length, 12);
  assert.ok(gentle.every((route) => route.lives === 5 && route.livesLost === 0));
  for (const id of ['fpv-arcade-r5', 'fpv-pressure-frontier'])
    assert.equal(gentle.filter((route) => route.packId === id).length, 6);
  assert.equal(
    result.ordinaryProbes.length,
    24,
    'Probes are separate from winning-route coverage.',
  );
});
