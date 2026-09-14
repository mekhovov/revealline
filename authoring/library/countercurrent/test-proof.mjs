import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildCountercurrent, IDS } from './build.mjs';
import { drive } from './controls.mjs';
import { verifyCountercurrent } from './verify.mjs';
import { verifyCountercurrentMechanics } from './mechanics.mjs';
import { resolvePackCampaign } from '../../../game/packs.mjs';
import { createExecutionCatalog } from '../../../game/campaign-contexts.mjs';
import { createMediaIdentityCatalog } from '../../../game/media-library.mjs';
import {
  FLIGHT_MEDIA_PINS_FORMAT,
  snapshotFlightPresentationPins,
} from '../../../game/flight-media-pins.mjs';
import { authoritativeCheckpoint } from '../../../game/replay.mjs';
import { suspendSession, restoreSession } from '../../../game/sessions.mjs';

test('all 198 exact route contexts reproduce 824 nonempty saved suffixes and 12 endpoints', async () => {
  const { summary } = await verifyCountercurrent();
  assert.equal(summary.ordinaryWins, 168);
  assert.equal(summary.firstLifeLossControls, 12);
  assert.equal(summary.recoveredWins, 12);
  assert.equal(summary.separateGameOvers, 6);
  assert.equal(summary.nonemptySavedSuffixes, 824);
  assert.equal(summary.savedEndpointRestores, 12);
});

test('twelve finite mechanic probes reproduce actual wall, bonus, warning, lane and idle behavior', async () => {
  const proof = await verifyCountercurrentMechanics();
  assert.equal(proof.probes.length, 12);
  assert.equal(proof.probes.filter((p) => p.sandbox).length, 1);
});

test('changed proof source, missing context and foreign source refuse before replay', async () => {
  const source = await buildCountercurrent();
  const proof = JSON.parse(await readFile(new URL('./routes.json', import.meta.url)));
  const changed = structuredClone(proof);
  changed.content['controls.mjs'] = '0'.repeat(64);
  await assert.rejects(
    verifyCountercurrent({ candidate: { pack: source.pack, proof: changed } }),
    /Exact content/,
  );
  const missing = structuredClone(proof);
  missing.routes.pop();
  await assert.rejects(
    verifyCountercurrent({ candidate: { pack: source.pack, proof: missing } }),
    /Exact 192-context/,
  );
  const foreign = structuredClone(source.pack);
  foreign.campaigns[0].levels[0].walls[0].x++;
  await assert.rejects(
    verifyCountercurrent({ candidate: { pack: foreign, proof } }),
    /Exact Countercurrent source/,
  );
});

test('an actual unfinished cut restores only its exact execution owner, checkpoint and picture identity', async () => {
  const source = await buildCountercurrent();
  const catalog = createExecutionCatalog([resolvePackCampaign(source.pack, 'countercurrent')]);
  const context = catalog.entries[0],
    gentle = catalog.entries[1];
  const identities = createMediaIdentityCatalog(catalog);
  const level = context.campaign.levels.find((l) => l.id === IDS[0]);
  const { run, recorder } = drive(level, source.pack.classRecipes, 'immediate', [
    { ticks: 64, direction: 'right' },
  ]);
  assert.equal(run.status, 'running');
  assert.equal(run.player.cutting, true);
  assert.ok(run.trail.length > 6);
  const pins = snapshotFlightPresentationPins({
    format: FLIGHT_MEDIA_PINS_FORMAT,
    executionKey: context.executionKey,
    levelId: level.id,
    levelRevision: level.revision,
    choices: [
      {
        picture: {
          kind: 'legacy',
          identity: identities.resolve({
            executionKey: context.executionKey,
            levelId: level.id,
            levelRevision: level.revision,
            themeId: 'fpv',
          }),
        },
        story: null,
      },
    ],
  });
  const session = suspendSession({
    run,
    recorder,
    campaignKey: context.executionKey,
    themeId: 'fpv',
    bodyId: source.pack.themes[0].player,
    runId: 'countercurrent-owner-control',
    savedAt: '2026-09-14T00:00:00.000Z',
    continuation: { direction: 'right' },
    presentationPins: pins,
  });
  const before = JSON.stringify(session),
    checkpoint = authoritativeCheckpoint(run);
  const options = {
    campaign: context.campaign,
    campaignKey: context.executionKey,
    mediaIdentityCatalog: identities,
  };
  const restored = await restoreSession(session, options);
  assert.deepEqual(authoritativeCheckpoint(restored.run), checkpoint);
  assert.deepEqual(restored.session.presentationPins, pins);
  await assert.rejects(
    restoreSession(session, {
      ...options,
      campaign: gentle.campaign,
      campaignKey: gentle.executionKey,
    }),
    /different campaign or rules revision/,
  );
  const corrupted = structuredClone(session);
  corrupted.replay.checkpoint.hash =
    (corrupted.replay.checkpoint.hash[0] === '0' ? '1' : '0') +
    corrupted.replay.checkpoint.hash.slice(1);
  await assert.rejects(
    restoreSession(corrupted, options),
    /Checkpoint root does not match its section checksums/,
  );
  const foreignPicture = structuredClone(session);
  foreignPicture.presentationPins.choices[0].picture.identity.levelId = IDS[1];
  await assert.rejects(restoreSession(foreignPicture, options));
  assert.equal(JSON.stringify(session), before);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
});
