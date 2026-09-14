import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import {
  buildFractureLines,
  exportFractureLines,
  inspectTopology,
  IDS,
} from '../../authoring/library/fracture-lines/build.mjs';
import {
  verifyFractureLines,
  routeCommands,
} from '../../authoring/library/fracture-lines/verify.mjs';
import { drive } from '../../authoring/library/fracture-lines/controls.mjs';
import { ROOT, digest } from '../../authoring/library/sentinel-circuit/files.mjs';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import { preparePack, resolvePackCampaign } from '../packs.mjs';
import { arcadeActionCapabilities } from '../core/arcade-actions.mjs';
import { classicEffectActive } from '../core/classic-state.mjs';
import { CELL } from '../core/index.mjs';
import { createMediaIdentityCatalog } from '../media-library.mjs';
import { suspendSession, restoreSession } from '../sessions.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const source = await buildFractureLines();
const proof = JSON.parse(
  await readFile(new URL('../../authoring/library/fracture-lines/routes.json', import.meta.url)),
);
const catalog = createExecutionCatalog([resolvePackCampaign(source.pack, 'fracture-lines')]);
test('Fracture wall topologies validate with one connected play space and refuse reflected old geometry', () => {
  assert.deepEqual(
    source.scenarios.map((s) => s.level.id),
    IDS,
  );
  assert.deepEqual(
    source.topologyFacts.map((f) => f.wallComponents.length),
    [4, 1, 3],
  );
  for (const facts of source.topologyFacts) assert.equal(facts.traversableComponents.length, 1);
  const level = source.scenarios[0].level;
  const reflected = {
    ...structuredClone(level),
    id: 'same-ring-reflected',
    walls: level.walls.map((r) => ({ ...r, x: level.width - r.x - r.w })),
  };
  assert.throws(() => inspectTopology(level, [reflected]), /Repeated\/reflected wall mask/);
  const catalog = createExecutionCatalog([resolvePackCampaign(source.pack, 'fracture-lines')]);
  assert.deepEqual(
    catalog.entries.map((e) => e.difficulty),
    ['standard', 'gentle'],
  );
  assert.notEqual(catalog.entries[0].executionKey, catalog.entries[1].executionKey);
  assert.equal(catalog.entries[0].baseCampaignKey, catalog.entries[1].baseCampaignKey);
  for (const { level } of source.scenarios) {
    assert.deepEqual(arcadeActionCapabilities(level), {
      manualAbility: false,
      manualPickup: false,
      manualBoost: false,
    });
    assert.equal(level.rules.stopOnCapture, true);
    assert.equal(level.encounter, null);
    assert.equal(level.width, 72);
    assert.equal(level.height, 36);
  }
  assert.deepEqual(source.pack.levelVisuals, []);
  assert.deepEqual(source.pack.music, []);
});

test('explicit compiler output is exact, finite and refuses overwriting the prior candidate', async (t) => {
  const parent = await mkdtemp(path.join(ROOT, '.cache/fracture-export-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const out = path.relative(ROOT, path.join(parent, 'candidate'));
  const result = await exportFractureLines(out);
  assert.equal(result.files.length, 4);
  assert.deepEqual(
    (await readdir(result.directory)).sort(),
    result.files.map((f) => f.name).sort(),
  );
  for (const pin of result.files) {
    const bytes = await readFile(path.join(result.directory, pin.name));
    assert.equal(bytes.length, pin.bytes);
    assert.equal(digest(bytes), pin.sha256);
    assert.deepEqual(
      JSON.parse(bytes),
      pin.name === 'fracture-lines.json'
        ? source.pack
        : source.scenarios.find((s) => s.level.id + '.json' === pin.name),
    );
  }
  await assert.rejects(exportFractureLines(out), /EEXIST/);
});

test('explicit invalid requests cannot fall back or write an unreviewed proof', async () => {
  for (const candidate of [
    null,
    false,
    [],
    {},
    { pack: source.pack },
    { pack: source.pack, proof: {}, extra: true },
  ])
    await assert.rejects(verifyFractureLines({ candidate }));
  await assert.rejects(
    verifyFractureLines({ record: true, candidate: { pack: source.pack, proof: {} } }),
    /cannot record/,
  );
  const pack = structuredClone(source.pack);
  pack.campaigns[0].levels[0].walls[0].x++;
  await assert.rejects(
    verifyFractureLines({ candidate: { pack, proof: {} } }),
    /Exact Fracture source/,
  );
});

test('48 route contexts plus six separate game overs reproduce real outcomes and exact saved suffixes', async () => {
  const actual = await verifyFractureLines();
  assert.equal(actual.summary.contexts, 48);
  assert.equal(actual.summary.ordinaryWins, 24);
  assert.equal(actual.summary.firstLifeLossControls, 12);
  assert.equal(actual.summary.recoveredWins, 12);
  assert.equal(actual.summary.separateGameOvers, 6);
  assert.equal(actual.summary.nonemptySavedSuffixes, 192);
  assert.equal(actual.summary.savedEndpointRestores, 12);
  for (const context of catalog.entries)
    for (const policy of ['immediate', 'grid-center'])
      for (const levelId of IDS) {
        const routes = actual.routes.filter(
          (r) =>
            r.difficulty === context.difficulty && r.turnPolicy === policy && r.levelId === levelId,
        );
        assert.equal(routes.length, 4);
        const north = routes.find((r) => r.route === 'north'),
          south = routes.find((r) => r.route === 'south');
        assert.notEqual(north.replaySha256, south.replaySha256);
        assert.ok(north.metrics.pressureTicks > 0 && south.metrics.pressureTicks > 0);
        for (const r of routes)
          for (const s of r.saved) {
            assert.equal(s.presentationPins.choices[0].story, null);
            assert.equal(
              s.presentationPins.choices[0].picture.identity.baseCampaignKey,
              context.baseCampaignKey,
            );
            assert.equal(s.finalCheckpointSha256, r.checkpointSha256);
            assert.equal(s.suffixTicks, r.expected.tick - s.tick);
          }
        if (levelId.endsWith('frayed-causeway')) {
          const recapture = routes.find((r) => r.metrics.recapturedCells > 0);
          assert.ok(recapture && recapture.metrics.events['cells.eroded'] > 0);
          assert.ok(
            recapture.saved.some((s) => s.label === 'erosion-warning' && s.suffixTicks > 0),
          );
          assert.ok(recapture.saved.some((s) => s.label === 'recapture' && s.suffixTicks > 0));
          for (const event of recapture.metrics.recaptureScores) {
            assert.ok(event.firstClaims < event.claimed);
            assert.equal(event.scoreDelta, event.firstClaims * 10);
          }
        }
      }
});

test('enclosing the Ring speed pickup does not collect it and a capture stays stopped through neutral input', () => {
  for (const policy of ['immediate', 'grid-center']) {
    const level = catalog.entries[0].campaign.levels[0];
    const result = drive(level, source.pack.classRecipes, policy, [
      { to: ['down', 35.5] },
      { to: ['right', 12.5] },
      { to: ['up', 18.5] },
      { to: ['left', 0.5] },
    ]);
    const pickup = result.run.classic.powerups[0],
      index = Math.floor(pickup.y) * 72 + Math.floor(pickup.x);
    assert.equal(result.run.cells[index], CELL.SAFE);
    assert.equal(pickup.collectedTick, null);
    assert.equal(result.metrics.events['powerup.collected'], undefined);
    const route = proof.routes.find(
      (r) => r.id === `standard/${policy}/fracture-lines-split-ring/north`,
    );
    let remaining = route.saved.find((s) => s.label === 'capture-stop').tick;
    const prefix = [];
    for (const segment of route.segments) {
      if (!remaining) break;
      const ticks = Math.min(segment.ticks, remaining);
      prefix.push({ ticks, direction: segment.input.direction });
      remaining -= ticks;
    }
    let stopped;
    const stationary = drive(level, source.pack.classRecipes, policy, [...prefix, { ticks: 120 }], {
      onTick({ run }) {
        if (run.events.some((e) => e.type === 'capture.stopped'))
          stopped = { x: run.player.x, y: run.player.y, claimed: run.claimedCount };
      },
    });
    assert.ok(stopped);
    assert.equal(stationary.run.player.x, stopped.x);
    assert.equal(stationary.run.player.y, stopped.y);
    assert.equal(stationary.run.claimedCount, stopped.claimed);
    assert.equal(stationary.run.player.cutting, false);
  }
});

test('a direct freeze pickup remains active when lethal terrain causes the actual first loss', () => {
  for (const context of catalog.entries)
    for (const policy of ['immediate', 'grid-center']) {
      const level = context.campaign.levels[1];
      let activeAtFailure = false;
      const result = drive(
        level,
        source.pack.classRecipes,
        policy,
        [
          { to: ['down', 35.5] },
          { to: ['left', 9.5] },
          { to: ['up', 20.5] },
          { to: ['right', 26.5] },
          { to: ['down', 24.5] },
        ],
        {
          onTick({ run }) {
            if (run.events.some((e) => e.type === 'player.failed'))
              activeAtFailure = classicEffectActive(run, 'enemy-freeze');
          },
        },
      );
      assert.equal(result.expected.failureCause, 'lethal-terrain');
      assert.equal(result.expected.livesLost, 1);
      assert.equal(result.metrics.events['powerup.collected'], 1);
      assert.equal(activeAtFailure, true);
    }
});

test('an unfinished Fracture session requires its exact authored owner, even with identical foreign geometry', async () => {
  const context = catalog.entries[0],
    level = context.campaign.levels[0];
  const result = drive(level, source.pack.classRecipes, 'immediate', [
    { ticks: 48, direction: 'right' },
  ]);
  assert.equal(result.run.player.cutting, true);
  const pins = proof.routes.find(
    (r) => r.id === 'standard/immediate/fracture-lines-split-ring/north',
  ).saved[0].presentationPins;
  const session = suspendSession({
    run: result.run,
    recorder: result.recorder,
    campaignKey: context.executionKey,
    themeId: 'fpv',
    bodyId: source.pack.themes[0].player,
    runId: 'fracture-owner-control',
    savedAt: '2026-09-13T00:00:00.000Z',
    continuation: { direction: 'right' },
    presentationPins: pins,
  });
  const identities = createMediaIdentityCatalog(catalog);
  const restored = await restoreSession(session, {
    campaign: context.campaign,
    campaignKey: context.executionKey,
    mediaIdentityCatalog: identities,
  });
  assert.deepEqual(authoritativeCheckpoint(restored.run), authoritativeCheckpoint(result.run));
  const foreign = structuredClone(source.pack);
  foreign.id = 'fracture-foreign';
  foreign.campaigns[0].id = 'fracture-foreign';
  const preparedForeign = (await preparePack(foreign)).pack;
  const foreignCatalog = createExecutionCatalog([
    resolvePackCampaign(preparedForeign, 'fracture-foreign'),
  ]);
  await assert.rejects(
    restoreSession(session, {
      campaign: context.campaign,
      campaignKey: context.executionKey,
      mediaIdentityCatalog: createMediaIdentityCatalog(foreignCatalog),
    }),
  );
  const forged = structuredClone(session);
  forged.presentationPins.choices[0].picture.identity.baseCampaignKey =
    foreignCatalog.entries[0].baseCampaignKey;
  await assert.rejects(
    restoreSession(forged, {
      campaign: context.campaign,
      campaignKey: context.executionKey,
      mediaIdentityCatalog: identities,
    }),
  );
  assert.equal(session.presentationPins.choices[0].story, null);
});

test('missing contexts and changed proof authority refuse before replay work', async () => {
  const missing = structuredClone(proof);
  missing.routes.pop();
  await assert.rejects(
    verifyFractureLines({ candidate: { pack: source.pack, proof: missing } }),
    /Exact 48-context/,
  );
  const altered = structuredClone(proof);
  altered.packSha256 = '0'.repeat(64);
  await assert.rejects(
    verifyFractureLines({ candidate: { pack: source.pack, proof: altered } }),
    /Exact packSha256/,
  );
  assert.throws(() => routeCommands(IDS[0], 'north', 'expert'), /implemented difficulty/);
});
