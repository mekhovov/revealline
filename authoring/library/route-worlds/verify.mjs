import assert from 'node:assert/strict';
import { lstat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import {
  ROOT,
  THEME_IDS,
  SOURCE_LEVEL_IDS,
  SOURCE,
  SOURCE_SHA,
  boundedFile,
  buildRouteWorld,
  physicalLevel,
} from './build.mjs';
import { boundedJSON, exactKeys, plainObject } from '../../../game/data-json.mjs';
import { createRun, stepRun, FIXED_DT, getSummary } from '../../../game/core/index.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../../../game/replay.mjs';
import { suspendSession, restoreSession, SESSION_STORAGE_BYTES } from '../../../game/sessions.mjs';
import { createMediaIdentityCatalog } from '../../../game/media-library.mjs';
import { createPresentationPins, resolvePinnedPicture } from '../../../game/presentation-pins.mjs';
import {
  FLIGHT_MEDIA_PINS_FORMAT,
  snapshotFlightPresentationPins,
  presentationPicturePins,
} from '../../../game/flight-media-pins.mjs';

export const PROOF_FILE = 'authoring/library/route-worlds/routes.json';
export const SOURCE_PROOF = 'authoring/library/fpv-route-choices/routes.json';
export const SOURCE_PROOF_SHA = 'd6af87beb11f55b81cf33b6b07254c51d19923d8823d2d80c17606db0e4c1245';
const sha = (value) =>
  createHash('sha256')
    .update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value))
    .digest('hex');
const physicalSummary = (summary) =>
  Object.fromEntries(
    Object.entries(summary).filter(([key]) => !['levelId', 'revision'].includes(key)),
  );
// Terminal result embeds getSummary's edition identity; compare its other fields
// explicitly below. Configuration and every physical section remain exact.
const physicalSections = (checkpoint) =>
  Object.fromEntries(
    Object.entries(checkpoint.sections).filter(([key]) => !['identity', 'result'].includes(key)),
  );

async function execute(world, context, level, source, image) {
  const pack = world.prepared.pack;
  const setup = {
    classId: source.classId,
    classRecipes: pack.classRecipes,
    turnPolicy: source.turnPolicy,
    seed: source.seed,
  };
  const run = createRun(level, setup),
    recorder = createRecorder(level, setup, 'route-worlds-authoring-proof');
  const identityCatalog = createMediaIdentityCatalog(world.prepared.executionCatalog);
  const pictures = createPresentationPins({
    library: world.prepared.imported.document.library,
    identityCatalog,
    executionKey: context.executionKey,
    levelId: level.id,
    levelRevision: level.revision,
    themeIds: [world.descriptor.themeId],
  });
  const presentationPins = snapshotFlightPresentationPins({
    ...pictures,
    format: FLIGHT_MEDIA_PINS_FORMAT,
    choices: pictures.choices.map((picture) => ({ picture, story: null })),
  });
  assert.equal(presentationPins.choices[0].picture.sha256, image.sha256);
  assert.equal(presentationPins.choices[0].picture.kind, 'still');
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
    exactKeys(segment, ['ticks', 'input', 'releaseBefore'], 'source route segment');
    assert.equal(segment.releaseBefore, false);
    exactKeys(
      segment.input,
      ['direction', 'action', 'pickup', 'boost', 'switchClass'],
      'source route input',
    );
    assert.ok(Number.isSafeInteger(segment.ticks) && segment.ticks > 0 && segment.ticks <= 4000);
    for (let n = 0; n < segment.ticks && run.status === 'running'; n++) {
      assert.ok(run.tick < 4000);
      recordInput(recorder, segment.input);
      stepRun(run, segment.input, FIXED_DT);
      for (const event of run.events)
        metrics.eventCounts[event.type] = (metrics.eventCounts[event.type] ?? 0) + 1;
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
          campaignKey: context.executionKey,
          themeId: world.descriptor.themeId,
          bodyId: pack.themes[0].player,
          runId: `route-worlds-${world.descriptor.themeId}-${source.id.replaceAll('/', '-')}`,
          savedAt: '2026-09-13T00:00:00.000Z',
          continuation: { direction: segment.input.direction },
          presentationPins,
        });
        assert.deepEqual(authoritativeCheckpoint(run), prefix.checkpoint);
      }
    }
  }
  assert.ok(saved, 'Every route must cross an actual unfinished saved prefix.');
  assert.equal(saved.format, 'xonix-session.v4');
  const expected = getSummary(run),
    checkpoint = authoritativeCheckpoint(run);
  assert.deepEqual(
    physicalSummary(expected),
    physicalSummary(source.expected),
    'Unchanged physical outcomes in each Standard/Gentle context.',
  );
  assert.deepEqual(physicalSummary(run.result), physicalSummary(source.expected));
  assert.deepEqual(physicalSections(checkpoint), physicalSections(source.checkpoint));
  assert.deepEqual(metrics, source.metrics);
  assert.deepEqual(prefix.player, source.savedPrefix.player);
  assert.deepEqual(prefix.pressure, source.savedPrefix.pressure);
  assert.deepEqual(prefix.signal, source.savedPrefix.signal);
  assert.deepEqual(
    physicalSections(prefix.checkpoint),
    physicalSections(source.savedPrefix.checkpoint),
  );
  assert.equal(prefix.checkpoint.sections.result, source.savedPrefix.checkpoint.sections.result);
  const replay = exportReplay(recorder, run),
    verified = verifyReplay(replay);
  assert.equal(verified.match, true);
  assert.deepEqual(authoritativeCheckpoint(verified.state), checkpoint);
  assert.deepEqual(replay.segments, source.segments);
  const raw = JSON.stringify(saved);
  assert.ok(Buffer.byteLength(raw) <= SESSION_STORAGE_BYTES);
  const restored = await restoreSession(JSON.parse(raw), {
    campaign: context.campaign,
    campaignKey: context.executionKey,
    mediaIdentityCatalog: identityCatalog,
  });
  assert.deepEqual(authoritativeCheckpoint(restored.run), prefix.checkpoint);
  assert.equal(restored.session.themeId, world.descriptor.themeId);
  assert.deepEqual(restored.session.continuation, saved.continuation);
  assert.deepEqual(restored.session.presentationPins, presentationPins);
  const found = resolvePinnedPicture(
    presentationPicturePins(restored.session.presentationPins),
    world.descriptor.themeId,
    world.prepared.imported.document.library,
  );
  assert.equal(found.kind, 'still');
  assert.equal(found.asset.sha256, image.sha256);
  assert.equal(found.asset.bytes, image.bytes);
  let consumed = 0;
  for (const segment of replay.segments)
    for (let n = 0; n < segment.ticks; n++) {
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
    replaySha256: sha(replay),
    savedPrefix: {
      ...prefix,
      sessionFormat: saved.format,
      sessionBytes: Buffer.byteLength(raw),
      sessionSha256: sha(raw),
      themeId: saved.themeId,
      bodyId: saved.bodyId,
      continuation: saved.continuation,
      presentationPins,
      restoredCheckpoint: authoritativeCheckpoint(restored.run),
      replaySuffixByteIdentical: true,
    },
  };
}

/** Finite source qualification. A caller candidate is owned before asynchronous reads. */
export async function verifyRouteWorlds({ candidate, record = false } = {}) {
  assert.equal(typeof record, 'boolean');
  assert.ok(!(candidate !== undefined && record), 'Explicit proof cannot write records.');
  assert.ok(candidate === undefined || plainObject(candidate), 'Explicit proof must be an object.');
  const owned =
    candidate === undefined
      ? null
      : boundedJSON(candidate, {
          maxBytes: 2 * 1024 * 1024,
          maxNodes: 100000,
          maxArray: 1000,
          maxString: 1024,
          maxDepth: 32,
        });
  const destinations = [
    PROOF_FILE,
    ...THEME_IDS.map((id) => `authoring/library/route-worlds/descriptors/${id}.json`),
  ];
  if (record)
    for (const file of destinations)
      await assert.rejects(lstat(path.join(ROOT, file)), { code: 'ENOENT' });
  const source = JSON.parse(await boundedFile(SOURCE_PROOF, 1024 * 1024, SOURCE_PROOF_SHA));
  assert.equal(source.format, 'revealline-route-choices-proof.v1');
  assert.equal(source.mode, 'Tactical');
  assert.equal(source.routes.length, 38);
  assert.equal(new Set(source.routes.map((r) => r.id)).size, 38);
  assert.equal(source.routes.filter((r) => r.expected.won).length, 28);
  const proof = record
    ? null
    : (owned ?? JSON.parse(await boundedFile(PROOF_FILE, 2 * 1024 * 1024)));
  const header = {
    format: 'revealline-route-worlds-proof.v1',
    sourcePack: { path: SOURCE, sha256: SOURCE_SHA },
    sourceProof: { path: SOURCE_PROOF, sha256: SOURCE_PROOF_SHA },
    mode: 'Tactical',
    themes: THEME_IDS,
    layoutsReused: 3,
    newlyAuthoredGeometry: 0,
  };
  if (!record) {
    exactKeys(proof, [...Object.keys(header), 'worlds', 'routes', 'totals'], 'route worlds proof');
    for (const [key, value] of Object.entries(header)) assert.deepEqual(proof[key], value);
    assert.deepEqual(
      proof.routes.map((r) => r.id),
      THEME_IDS.flatMap((theme) => source.routes.map((r) => `${theme}/${r.id}`)),
      'Exact114 distinct contexts required.',
    );
  }
  const worlds = [],
    routes = [];
  for (const themeId of THEME_IDS) {
    const world = await buildRouteWorld(themeId);
    const { pack, executionCatalog } = world.prepared;
    const entry = {
      descriptor: world.descriptor,
      originalInputs: world.inputPins,
      images: world.imageProofs,
    };
    if (!record)
      assert.deepEqual(
        proof.worlds.find((w) => w.descriptor.themeId === themeId),
        entry,
      );
    worlds.push(entry);
    for (const route of source.routes) {
      const index = SOURCE_LEVEL_IDS.indexOf(route.levelId);
      assert.ok(index >= 0);
      const context = executionCatalog.select(world.descriptor.campaignKey, route.difficulty),
        level = context.campaign.levels[index];
      const priorContext = world.prior.campaigns[0];
      assert.deepEqual(
        physicalLevel(pack.campaigns[0].levels[index]),
        physicalLevel(priorContext.levels[index]),
      );
      const identity = {
        id: `${themeId}/${route.id}`,
        sourceRouteId: route.id,
        sourceSegmentsSha256: sha(route.segments),
        packId: pack.id,
        difficulty: route.difficulty,
        baseCampaignKey: context.baseCampaignKey,
        campaignKey: context.executionKey,
        levelId: level.id,
        revision: level.revision,
        levelSha256: sha(level),
        classId: route.classId,
        seed: route.seed,
        turnPolicy: route.turnPolicy,
        themeId,
        imageSha256: world.descriptor.originals[index].sha256,
      };
      const existing = proof?.routes.find((r) => r.id === identity.id);
      if (!record) {
        for (const [key, value] of Object.entries(identity)) assert.deepEqual(existing[key], value);
        assert.deepEqual(physicalSummary(existing.expected), physicalSummary(route.expected));
      }
      const actual = {
        ...identity,
        ...(await execute(world, context, level, route, world.descriptor.originals[index])),
      };
      if (!record) assert.deepEqual(existing, actual);
      routes.push(actual);
    }
  }
  const totals = {
    contexts: routes.length,
    wins: routes.filter((r) => r.expected.won).length,
    failures: routes.filter((r) => !r.expected.won).length,
    ticks: routes.reduce((n, r) => n + r.expected.tick, 0),
    savedContinuations: routes.length,
    originalPictures: worlds.reduce((n, w) => n + w.images.length, 0),
  };
  assert.deepEqual(
    [totals.contexts, totals.wins, totals.failures, totals.originalPictures],
    [114, 84, 30, 9],
  );
  assert.deepEqual([...new Set(routes.map((r) => r.turnPolicy))].sort(), [
    'grid-center',
    'immediate',
  ]);
  const result = { ...header, worlds, routes, totals };
  if (record) {
    const outputs = [
      [PROOF_FILE, result],
      ...worlds.map((w) => [
        `authoring/library/route-worlds/descriptors/${w.descriptor.themeId}.json`,
        w.descriptor,
      ]),
    ];
    for (const [file, value] of outputs)
      await writeFile(path.join(ROOT, file), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  } else {
    assert.deepEqual(proof, result);
    for (const world of worlds)
      assert.deepEqual(
        JSON.parse(
          await boundedFile(
            `authoring/library/route-worlds/descriptors/${world.descriptor.themeId}.json`,
            16384,
          ),
        ),
        world.descriptor,
      );
  }
  return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  assert.ok(args.length === 0 || (args.length === 1 && args[0] === '--record'));
  const result = await verifyRouteWorlds({ record: args.length === 1 });
  console.log(
    JSON.stringify({
      passed: true,
      ...result.totals,
      physicalOutcomesMatchSource: true,
      limits:
        'Source/core/replay/serialized-pin proofs; no native host, install, Collection, browser, public, hardware or enjoyment qualification.',
    }),
  );
}
