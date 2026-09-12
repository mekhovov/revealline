#!/usr/bin/env node
/** Browser QA fixtures generated from legal recorded input, never synthetic wins. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRun, stepRun, getSummary, releaseInputs, FIXED_DT } from '../game/core/index.mjs';
import {
  createRecorder,
  recordInput,
  recordRelease,
  authoritativeCheckpoint,
  exportReplay,
  verifyReplay,
} from '../game/replay.mjs';
import {
  emptyLibrary,
  recordLibraryCompletion,
  campaignKey,
  updatePreferences,
  exportLibrary,
  progressFor,
} from '../game/library.mjs';
import { suspendSession, restoreSession } from '../game/sessions.mjs';
import { preparePack, resolvePackCampaign, PACK_LIBRARY_VERSION } from '../game/packs.mjs';
import { exportBackup } from '../game/backup.mjs';
import { buildHomewardPack } from './build-homeward-pack.mjs';
import { digest } from './verify-campaign.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const OUT = path.join(ROOT, '.cache/round-14/homeward-fixtures');
const ID = 'revealline-homeward-browser-fixtures.v1';
const STAMP = '2026-09-12T14:00:00.000Z';
const REMAINING_PROOF_TICKS = 24;
const sha = (value) => createHash('sha256').update(value).digest('hex');

function replayPrefix(pack, route, limit) {
  const level = pack.campaigns[0].levels.find((entry) => entry.id === route.levelId);
  assert.equal(route.levelSha256, digest(level), 'Route geometry must match actual pack content.');
  assert.equal(route.classesSha256, digest(pack.classRecipes));
  const options = {
    classId: route.classId,
    classRecipes: pack.classRecipes,
    seed: route.seed,
    turnPolicy: route.turnPolicy,
  };
  const run = createRun(level, options),
    recorder = createRecorder(level, options, 'round-14-legal-replay-fixture');
  for (const segment of route.segments) {
    if (run.tick >= limit) break;
    if (segment.releaseBefore) {
      releaseInputs(run);
      recordRelease(recorder);
    }
    for (let tick = 0; tick < segment.ticks && run.tick < limit; tick++) {
      assert.ok(
        ['running', 'respawning'].includes(run.status),
        'Fixture input must never continue after a terminal state.',
      );
      stepRun(run, segment.input, FIXED_DT);
      recordInput(recorder, segment.input);
    }
  }
  assert.equal(run.tick, limit);
  assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
  return { run, recorder };
}

async function finish(session, campaign, direction, boost) {
  const { run, recorder } = await restoreSession(session, {
    campaign,
    campaignKey: campaignKey(campaign),
  });
  const start = run.tick,
    input = { direction, boost };
  for (let ticks = 0; ticks < 240 && run.status === 'running'; ticks++) {
    stepRun(run, input, FIXED_DT);
    recordInput(recorder, input);
  }
  assert.equal(run.status, 'won', 'One ordinary direction must finish the suspended cut.');
  assert.equal(run.lives, 3);
  const replay = exportReplay(recorder, run);
  assert.equal(verifyReplay(replay).match, true);
  assert.equal(replay.summary.objectives.captured, replay.summary.objectives.required);
  return {
    ticks: run.tick - start,
    seconds: (run.tick - start) * FIXED_DT,
    summary: replay.summary,
    checkpoint: replay.checkpoint,
  };
}

export async function createHomewardFixtures({ replace = false } = {}) {
  const { pack, report: artwork } = await buildHomewardPack();
  const proofBytes = await readFile(path.join(ROOT, 'game/replays/homeward-routes.json'));
  const proof = JSON.parse(proofBytes);
  assert.equal(proof.packSha256, digest(pack));
  // This adapter checks already verified source/header dimensions only. It does
  // not stand in for Image.decode: browser UI import must still decode the PNGs.
  const knownImages = new Map(
    pack.levelVisuals.map((entry, index) => [
      entry.visualOverrides.background.dataUrl,
      artwork.backgrounds[index],
    ]),
  );
  const decodeImage = async (dataUrl) => {
    const image = knownImages.get(dataUrl);
    assert.ok(image, 'Fixture may only include the reviewed original pack images.');
    return { naturalWidth: image.width, naturalHeight: image.height };
  };
  const prepared = (await preparePack(pack, { decodeImage })).pack;
  const { campaign } = resolvePackCampaign(prepared, 'homeward-skies');
  const packs = { format: PACK_LIBRARY_VERSION, packs: [prepared] };
  const output = [],
    attempts = [],
    completed = [];
  const push = (name, text, kind) => {
    assert.ok(!output.some((entry) => entry.name === name));
    output.push({ name, text, kind });
  };
  for (const policy of ['immediate', 'grid-center']) {
    let library = updatePreferences(emptyLibrary(), { turnPolicy: policy, tapSteering: true });
    for (const [index, level] of campaign.levels.entries()) {
      const route = proof.routes.find(
        (entry) =>
          entry.levelId === level.id &&
          entry.turnPolicy === policy &&
          entry.variant === 'specialty',
      );
      assert.ok(route);
      const totalTicks = route.segments.reduce((sum, segment) => sum + segment.ticks, 0);
      assert.ok(route.segments.at(-1).ticks > REMAINING_PROOF_TICKS);
      const won = replayPrefix(pack, route, totalTicks);
      assert.equal(won.run.status, 'won');
      assert.deepEqual(getSummary(won.run), route.expected);
      assert.deepEqual(authoritativeCheckpoint(won.run), route.checkpoint);
      const near = replayPrefix(pack, route, totalTicks - REMAINING_PROOF_TICKS);
      assert.equal(near.run.status, 'running');
      assert.ok(near.run.player.cutting && near.run.trail.length > 0);
      const activeClassId = getSummary(near.run).activeClassId;
      const bodyId = prepared.themes[0].classBodies[activeClassId];
      library = updatePreferences(library, { classId: route.classId, bodyId });
      assert.equal(Object.keys(progressFor(library, campaign).clears).length, index);
      assert.equal(library.gallery.length, index);
      const runId = `round14-legal-${policy}-${level.id}`;
      const session = suspendSession({
        ...near,
        campaignKey: campaignKey(campaign),
        themeId: 'fpv',
        bodyId,
        runId,
        savedAt: STAMP,
      });
      const direction = route.segments.at(-1).input.direction;
      const unboosted = await finish(session, campaign, direction, false);
      const boosted = await finish(session, campaign, direction, true);
      assert.equal(boosted.ticks, REMAINING_PROOF_TICKS);
      assert.deepEqual(boosted.checkpoint, route.checkpoint);
      const stem = `${level.id}-${policy}-near-finish`;
      const backup = await exportBackup({ library, packs, session }, { decodeImage });
      push(`${stem}.backup.json`, backup, 'near-finish-backup');
      push(`${stem}.session.json`, JSON.stringify(session), 'suspended-session');
      attempts.push({
        levelId: level.id,
        levelName: level.name,
        turnPolicy: policy,
        classId: route.classId,
        activeClassId,
        backupFile: `${stem}.backup.json`,
        sessionFile: `${stem}.session.json`,
        earlierLegalClears: index,
        earlierGalleryPictures: index,
        stoppedTick: near.run.tick,
        proofWinningTick: totalTicks,
        liveTrailCells: near.run.trail.length,
        coverageBefore: getSummary(near.run).coverage,
        finishDirection: direction,
        unboostedButton: { ticks: unboosted.ticks, seconds: unboosted.seconds },
        boostedRecordedInput: {
          ticks: boosted.ticks,
          seconds: boosted.seconds,
          matchesOriginalFinalCheckpoint: true,
        },
        expectedAfterButton: unboosted.summary,
      });
      library = recordLibraryCompletion(library, {
        campaign,
        result: getSummary(won.run),
        runId,
        themeId: 'fpv',
        bodyId,
        completedAt: new Date(Date.parse(STAMP) + index * 60000).toISOString(),
        sourcePackId: 'homeward-skies',
      });
      assert.equal(Object.keys(progressFor(library, campaign).clears).length, index + 1);
      assert.equal(library.gallery.length, index + 1);
    }
    const stem = `homeward-completed-${policy}`;
    push(
      `${stem}.backup.json`,
      await exportBackup({ library, packs, session: null }, { decodeImage }),
      'completed-backup',
    );
    push(`${stem}.library.json`, exportLibrary(library), 'completed-player-library');
    completed.push({
      turnPolicy: policy,
      backupFile: `${stem}.backup.json`,
      libraryFile: `${stem}.library.json`,
      legalClears: 3,
      galleryPictures: 3,
      suspendedSession: null,
    });
  }
  assert.equal(digest(pack), proof.packSha256, 'Fixture generation must not alter source content.');
  const manifest = {
    format: ID,
    generatedFrom:
      'Actual legal Homeward role replay inputs; automated QA fixtures, not manual gameplay.',
    timestampPolicy: `Fixed fixture metadata ${STAMP}; not a claimed playtest time.`,
    script: 'scripts/create-homeward-fixtures.mjs',
    packId: pack.id,
    packVersion: pack.version,
    packSemanticSha256: proof.packSha256,
    proofFileSha256: sha(proofBytes),
    imageValidation:
      'Exact reviewed source bytes and PNG headers verified in Node. Full artwork decoding must occur through real browser UI pack/backup import.',
    gameplayValidation:
      'Normal createRun/stepRun/recordInput, suspendSession/restoreSession, recordLibraryCompletion and exportBackup APIs only; no assigned cells, actor positions, timers, lives, summaries or wins.',
    uiInstructions:
      'Install the actual Homeward pack through Library. Load near-finish sessions in map order to retain genuine UI completions. Load pauses the flight; choose Resume, then hold the indicated direction for at least 0.5 seconds without Boost. Full backups additionally supply earlier generated clear records and original artwork. Imported full-backup preferences enable tap steering, so one direction-button tap is sufficient. Completed fixtures are separate imported QA profiles.',
    attempts,
    completed,
    files: output.map(({ name, text, kind }) => ({
      name,
      kind,
      bytes: Buffer.byteLength(text),
      sha256: sha(text),
    })),
  };
  const previous = await lstat(OUT).catch(() => null);
  if (previous) {
    assert.ok(
      previous.isDirectory() && !previous.isSymbolicLink(),
      'Fixture output must be a real directory.',
    );
    assert.ok(
      replace,
      'Fixture output already exists; use --replace to regenerate only this owned fixture set.',
    );
    const marker = JSON.parse(await readFile(path.join(OUT, 'manifest.json'), 'utf8'));
    assert.equal(marker.format, ID, 'Existing directory is not owned by this fixture generator.');
  } else await mkdir(OUT, { recursive: true });
  for (const { name, text } of output) {
    const file = path.join(OUT, name),
      info = await lstat(file).catch(() => null);
    assert.ok(
      !info || (replace && info.isFile() && !info.isSymbolicLink()),
      'Fixture target must be a regular owned file.',
    );
    await writeFile(file, text, { flag: replace ? 'w' : 'wx' });
  }
  await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', {
    flag: replace ? 'w' : 'wx',
  });
  return {
    out: OUT,
    files: manifest.files.length,
    attempts: attempts.map(
      ({ levelId, turnPolicy, finishDirection, unboostedButton, earlierLegalClears }) => ({
        levelId,
        turnPolicy,
        finishDirection,
        unboostedButton,
        earlierLegalClears,
      }),
    ),
    completed: completed.map(({ turnPolicy, legalClears }) => ({ turnPolicy, legalClears })),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--replace'))
    throw new Error('Usage: node scripts/create-homeward-fixtures.mjs [--replace]');
  console.log(
    JSON.stringify(await createHomewardFixtures({ replace: args[0] === '--replace' }), null, 2),
  );
}
