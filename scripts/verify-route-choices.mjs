import assert from 'node:assert/strict';
import { writeFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildRouteChoices,
  ROOT,
  CHAPTER_ROOT,
  SOURCE_PINS,
  ASSIGNMENTS,
  ordinaryFile,
  sha,
} from '../authoring/library/fpv-route-choices/build.mjs';
import { decodeOriginalPNG } from '../authoring/library/four-worlds-chapters/verify-images.mjs';
import { verifyTacticalChallenges } from './verify-tactical-challenges.mjs';
import { boundedJSON, exactKeys, plainObject } from '../game/data-json.mjs';
import { preparePack, scenarioFromPack, PACK_LIMITS } from '../game/packs.mjs';
import { CONTENT_LIMITS } from '../game/content.mjs';
import { createDifficultyContext } from '../game/campaign-difficulty.mjs';
import { createRun, stepRun, FIXED_DT, getSummary } from '../game/core/index.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../game/replay.mjs';
import { suspendSession, restoreSession } from '../game/sessions.mjs';

export const PROOF_FILE = `${CHAPTER_ROOT}/routes.json`;
const digest = (value) => sha(JSON.stringify(value));
const routeKey = (difficulty, source) => `${difficulty}/${source.id}`;
const physicalSummary = (value) =>
  Object.fromEntries(
    Object.entries(value).filter(([key]) => !['levelId', 'revision', 'rosterHash'].includes(key)),
  );

async function execute(pack, context, level, source) {
  const setup = {
    classId: source.classId,
    classRecipes: pack.classRecipes,
    turnPolicy: source.turnPolicy,
    seed: source.seed,
  };
  const run = createRun(level, setup),
    recorder = createRecorder(level, setup, 'route-choices-chapter-proof');
  const metrics = {
    eventCounts: {},
    signalTicks: 0,
    resistantTicks: 0,
    slowedTicks: 0,
    stunnedEnemyTicks: 0,
    captures: [],
  };
  let saved = null,
    prefix = null;
  for (const segment of source.segments) {
    exactKeys(segment, ['ticks', 'input', 'releaseBefore'], 'source challenge segment');
    assert.equal(segment.releaseBefore, false);
    exactKeys(
      segment.input,
      ['direction', 'action', 'pickup', 'boost', 'switchClass'],
      'source challenge input',
    );
    assert.ok(Number.isInteger(segment.ticks) && segment.ticks > 0 && segment.ticks <= 4000);
    for (let i = 0; i < segment.ticks && run.status === 'running'; i++) {
      assert.ok(run.tick < 4000);
      recordInput(recorder, segment.input);
      stepRun(run, segment.input, FIXED_DT);
      for (const e of run.events)
        metrics.eventCounts[e.type] = (metrics.eventCounts[e.type] ?? 0) + 1;
      if (run.signal.zoneIds.length) metrics.signalTicks++;
      if (run.signal.zoneIds.length && run.signal.resistant) metrics.resistantTicks++;
      if (run.signal.speedFactor < 1) metrics.slowedTicks++;
      if (run.enemies.some((e) => e.stunnedUntil > run.time)) metrics.stunnedEnemyTicks++;
      if (run.events.some((e) => e.type === 'capture.stopped'))
        metrics.captures.push({
          tick: run.tick,
          coverage: getSummary(run).coverage,
          x: run.player.x,
          y: run.player.y,
        });
      if (run.tick === source.savedPrefix.tick) {
        assert.equal(run.status, 'running');
        prefix = {
          tick: run.tick,
          checkpoint: authoritativeCheckpoint(run),
          player: structuredClone(run.player),
          pressure: run.enemies
            .filter((e) => e.classic?.pressure)
            .map((e) => structuredClone(e.classic.pressure)),
          signal: structuredClone(run.signal),
        };
        saved = suspendSession({
          run,
          recorder,
          campaignKey: context.campaignKey,
          themeId: 'fpv',
          bodyId: pack.themes[0].player,
          runId: `route-choices-${context.mode}-${source.id.split('/').slice(1).join('-')}`,
          savedAt: '2026-09-13T00:00:00.000Z',
          continuation: { direction: segment.input.direction },
        });
        assert.deepEqual(authoritativeCheckpoint(run), prefix.checkpoint);
      }
    }
  }
  assert.ok(saved, 'Each route crosses an actual unfinished saved prefix.');
  assert.equal(run.status, context.mode === 'standard' ? source.expected.status : 'won');
  const expected = getSummary(run),
    checkpoint = authoritativeCheckpoint(run);
  if (context.mode === 'standard')
    assert.deepEqual(
      physicalSummary(expected),
      physicalSummary(source.expected),
      'Original Standard mechanics/outcomes are preserved under the new full campaign identity.',
    );
  const replay = exportReplay(recorder, run),
    verified = verifyReplay(replay);
  assert.equal(verified.match, true);
  assert.deepEqual(authoritativeCheckpoint(verified.state), checkpoint);
  const raw = JSON.stringify(saved),
    restored = await restoreSession(JSON.parse(raw), {
      campaign: context.campaign,
      campaignKey: context.campaignKey,
    });
  assert.deepEqual(authoritativeCheckpoint(restored.run), prefix.checkpoint);
  assert.equal(restored.session.themeId, 'fpv');
  let consumed = 0;
  for (const segment of replay.segments)
    for (let i = 0; i < segment.ticks; i++) {
      if (++consumed <= prefix.tick) continue;
      assert.equal(restored.run.status, 'running');
      recordInput(restored.recorder, segment.input);
      stepRun(restored.run, segment.input, FIXED_DT);
    }
  assert.deepEqual(authoritativeCheckpoint(restored.run), checkpoint);
  const continued = exportReplay(restored.recorder, restored.run);
  assert.deepEqual(continued, replay);
  assert.equal(verifyReplay(continued).match, true);
  assert.equal(JSON.stringify(saved), raw);
  return {
    segments: replay.segments,
    expected,
    checkpoint,
    metrics,
    savedPrefix: {
      ...prefix,
      sessionSha256: sha(raw),
      restoredCheckpoint: authoritativeCheckpoint(restored.run),
    },
  };
}

/** Own caller JSON before asynchronous source/decoder work. No library or browser storage writes. */
export async function verifyRouteChoices({ candidate, write = false } = {}) {
  assert.equal(typeof write, 'boolean', 'Route Choices write flag must be boolean.');
  assert.ok(!(candidate !== undefined && write), 'Explicit candidate cannot write proof output.');
  assert.ok(
    candidate === undefined || plainObject(candidate),
    'Explicit Route Choices candidate must be an object.',
  );
  const owned =
    candidate === undefined
      ? null
      : boundedJSON(candidate, {
          maxBytes: PACK_LIMITS.maxBytes + 2 * 1024 * 1024,
          maxDepth: 32,
          maxNodes: 250000,
          maxArray: 10000,
          maxString: CONTENT_LIMITS.maxEncodedImageChars,
        });
  if (owned !== null) {
    exactKeys(owned, ['pack', 'proof'], 'Route Choices request');
    assert.ok(
      Object.hasOwn(owned, 'pack') &&
        Object.hasOwn(owned, 'proof') &&
        plainObject(owned.pack) &&
        plainObject(owned.proof),
      'Explicit Route Choices candidate requires non-null pack and proof objects.',
    );
  }
  const source = await buildRouteChoices();
  const pack = owned === null ? source.pack : owned.pack;
  assert.equal(
    digest(pack),
    digest(source.pack),
    'Exact compiled art, roster, layouts and Tactical policy required.',
  );
  const proof =
    owned !== null
      ? owned.proof
      : !write
        ? JSON.parse(await ordinaryFile(PROOF_FILE, null, 2 * 1024 * 1024))
        : null;
  const header = {
    format: 'revealline-route-choices-proof.v1',
    sources: SOURCE_PINS,
    packSha256: digest(pack),
    sourceProofSha256: digest(source.sourceProof),
    mode: 'Tactical',
  };
  const planned = ['standard', 'gentle'].flatMap((difficulty) =>
    source.sourceProof.routes
      .filter((r) => difficulty === 'standard' || r.expected.won)
      .map((r) => ({ difficulty, source: r })),
  );
  assert.equal(planned.length, 38);
  if (!write) {
    exactKeys(proof, [...Object.keys(header), 'images', 'routes'], 'Route Choices proof');
    for (const [key, value] of Object.entries(header)) assert.deepEqual(proof[key], value);
    assert.deepEqual(
      proof.routes.map((r) => r.id).sort(),
      planned.map((p) => routeKey(p.difficulty, p.source)).sort(),
    );
  }
  const base = { ...pack.campaigns[0], classRecipes: pack.classRecipes };
  const executions = planned.map((plan) => {
    const index = ASSIGNMENTS.findIndex((a) => a.sourceLevelId === plan.source.expected.levelId);
    assert.ok(index >= 0);
    const context = createDifficultyContext(base, plan.difficulty),
      level = context.campaign.levels[index];
    const identity = {
      id: routeKey(plan.difficulty, plan.source),
      packId: pack.id,
      difficulty: plan.difficulty,
      baseCampaignKey: context.baseCampaignKey,
      campaignKey: context.campaignKey,
      levelId: level.id,
      revision: level.revision,
      levelSha256: digest(level),
      classId: plan.source.classId,
      seed: plan.source.seed,
      turnPolicy: plan.source.turnPolicy,
      sourceRouteId: plan.source.id,
      sourceSegmentsSha256: digest(plan.source.segments),
      imageSha256: source.images[index].record.sha256,
    };
    const existing = proof?.routes.find((r) => r.id === identity.id);
    if (!write) {
      for (const [key, value] of Object.entries(identity)) assert.deepEqual(existing[key], value);
      if (plan.difficulty === 'standard')
        assert.deepEqual(physicalSummary(existing.expected), physicalSummary(plan.source.expected));
    }
    return { plan, context, level, identity, existing };
  });
  // Exact identity and Standard verdict checks reject substitutions before decoder
  // allocation. Valid requests still re-execute every preserved source route.
  await verifyTacticalChallenges({ scenarios: source.scenarios, proof: source.sourceProof });
  const decoded = new Map();
  const prepared = (
    await preparePack(pack, {
      decodeImage: async (dataUrl) => {
        if (!decoded.has(dataUrl)) decoded.set(dataUrl, decodeOriginalPNG(dataUrl));
        return decoded.get(dataUrl);
      },
    })
  ).pack;
  const images = [];
  for (const [index, assignment] of ASSIGNMENTS.entries()) {
    const scene = scenarioFromPack(prepared, prepared.campaigns[0].id, assignment.levelId, {
      classId: assignment.classId,
    });
    const background = scene.visualOverrides.background,
      original = source.images[index];
    assert.equal(background.dataUrl, original.dataUrl);
    assert.equal(background.fit, 'contain');
    const bytes = Buffer.from(background.dataUrl.slice(22), 'base64');
    assert.equal(sha(bytes), original.record.sha256);
    assert.equal(bytes.length, original.record.bytes);
    images.push({
      levelId: assignment.levelId,
      imageId: assignment.imageId,
      sourceSha256: original.record.sha256,
      sourceBytes: original.record.bytes,
      fit: background.fit,
      ...decoded.get(background.dataUrl),
    });
  }
  assert.equal(decoded.size, 3);
  const routes = [];
  for (const { plan, context, level, identity, existing } of executions) {
    const route = { ...identity, ...(await execute(prepared, context, level, plan.source)) };
    if (!write) assert.deepEqual(existing, route);
    routes.push(route);
  }
  if (!write) assert.deepEqual(proof.images, images);
  const result = { ...header, images, routes };
  if (write) {
    await assert.rejects(lstat(path.join(ROOT, PROOF_FILE)), { code: 'ENOENT' });
    await writeFile(path.join(ROOT, PROOF_FILE), JSON.stringify(result, null, 2) + '\n', {
      flag: 'wx',
    });
  }
  return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  assert.ok(args.length === 0 || (args.length === 1 && args[0] === '--record'));
  const result = await verifyRouteChoices({ write: args.length === 1 });
  console.log(
    JSON.stringify({
      pass: true,
      routes: result.routes.length,
      wins: result.routes.filter((r) => r.expected.won).length,
      failures: result.routes.filter((r) => !r.expected.won).length,
      ticks: result.routes.reduce((sum, r) => sum + r.expected.tick, 0),
      savedContinuations: result.routes.length,
      decodedOriginals: result.images.length,
    }),
  );
}
