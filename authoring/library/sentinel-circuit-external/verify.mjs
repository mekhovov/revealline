import assert from 'node:assert/strict';
import { lstat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import {
  ROOT,
  SOURCE_LEVEL_IDS,
  SOURCE_PROOF,
  SOURCE_PROOF_SHA,
  SOURCE_PACK_SHA,
  boundedFile,
  buildExternalSentinel,
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

export const PROOF_FILE = 'authoring/library/sentinel-circuit-external/routes.json';
export const DESCRIPTOR_FILE = 'authoring/library/sentinel-circuit-external/descriptor.json';
const sha = (value) =>
  createHash('sha256')
    .update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value))
    .digest('hex');
const physicalSummary = (summary) =>
  summary === null
    ? null
    : Object.fromEntries(
        Object.entries(summary).filter(([k]) => !['levelId', 'revision'].includes(k)),
      );
const physicalSections = (checkpoint) =>
  Object.fromEntries(
    Object.entries(checkpoint.sections).filter(([k]) => !['identity', 'result'].includes(k)),
  );

async function execute(world, context, level, source, image) {
  const pack = world.prepared.pack;
  assert.deepEqual(source.setup.classRecipes, pack.classRecipes);
  const setup = { ...source.setup, classRecipes: pack.classRecipes };
  const run = createRun(level, setup),
    recorder = createRecorder(level, setup, 'sentinel-external-proof');
  const identities = createMediaIdentityCatalog(world.prepared.executionCatalog);
  const pictures = createPresentationPins({
    library: world.prepared.imported.document.library,
    identityCatalog: identities,
    executionKey: context.executionKey,
    levelId: level.id,
    levelRevision: level.revision,
    themeIds: ['fpv'],
  });
  const presentationPins = snapshotFlightPresentationPins({
    ...pictures,
    format: FLIGHT_MEDIA_PINS_FORMAT,
    choices: pictures.choices.map((picture) => ({ picture, story: null })),
  });
  assert.equal(presentationPins.choices.length, 1);
  assert.equal(presentationPins.choices[0].picture.kind, 'still');
  assert.equal(presentationPins.choices[0].picture.sha256, image.sha256);
  const metrics = {
    eventCounts: {},
    events: [],
    signalTicks: 0,
    resistantTicks: 0,
    slowedTicks: 0,
    stunnedEnemyTicks: 0,
    fieldTicks: 0,
    scanTicks: 0,
    pressureTicks: 0,
  };
  let prefix = null,
    saved = null;
  for (const segment of source.segments) {
    exactKeys(segment, ['ticks', 'input', 'releaseBefore'], 'Sentinel segment');
    assert.equal(segment.releaseBefore, false);
    exactKeys(
      segment.input,
      ['direction', 'boost', 'action', 'pickup', 'switchClass'],
      'Sentinel input',
    );
    assert.ok(Number.isSafeInteger(segment.ticks) && segment.ticks > 0 && segment.ticks <= 18000);
    for (let n = 0; n < segment.ticks; n++) {
      assert.ok(run.tick < 18000 && !['won', 'lost'].includes(run.status));
      recordInput(recorder, segment.input);
      stepRun(run, segment.input, FIXED_DT);
      for (const event of run.events) {
        metrics.eventCounts[event.type] = (metrics.eventCounts[event.type] ?? 0) + 1;
        if (event.type !== 'player.moved') metrics.events.push(structuredClone(event));
      }
      if (run.signal.zoneIds.length) metrics.signalTicks++;
      if (run.signal.zoneIds.length && run.signal.resistant) metrics.resistantTicks++;
      if (run.signal.speedFactor < 1) metrics.slowedTicks++;
      if (run.enemies.some((e) => e.stunnedUntil > run.time)) metrics.stunnedEnemyTicks++;
      if (run.ability.fields.some((f) => f.until > run.time)) metrics.fieldTicks++;
      if (run.ability.scanUntil > run.time) metrics.scanTicks++;
      if (run.enemies.some((e) => e.classic?.pressure?.phase === 'committed'))
        metrics.pressureTicks++;
      if (run.tick === source.savedPrefix.tick) {
        assert.ok(run.status === 'running' && run.player.cutting && run.trail.length >= 6);
        prefix = {
          tick: run.tick,
          checkpoint: authoritativeCheckpoint(run),
          player: structuredClone(run.player),
          trailCells: run.trail.length,
          signal: structuredClone(run.signal),
          ability: structuredClone(run.ability),
          encounter: structuredClone(run.encounter ?? null),
        };
        saved = suspendSession({
          run,
          recorder,
          campaignKey: context.executionKey,
          themeId: 'fpv',
          bodyId: pack.themes[0].player,
          runId: `sentinel-external-${source.id.replaceAll('/', '-')}`,
          savedAt: '2026-09-13T00:00:00.000Z',
          continuation: { direction: segment.input.direction },
          presentationPins,
        });
        assert.deepEqual(authoritativeCheckpoint(run), prefix.checkpoint);
      }
    }
  }
  assert.ok(saved, 'A real unfinished cut must be saved for every route.');
  const expected = getSummary(run),
    checkpoint = authoritativeCheckpoint(run);
  assert.deepEqual(physicalSummary(expected), physicalSummary(source.expected));
  assert.deepEqual(
    physicalSummary(run.result),
    source.expected.won ? physicalSummary(source.expected) : null,
  );
  assert.deepEqual(physicalSections(checkpoint), physicalSections(source.checkpoint));
  if (!source.expected.won)
    assert.equal(checkpoint.sections.result, source.checkpoint.sections.result);
  // run.completed includes the edition identity; retain that exact identity in the
  // new proof while comparing every other event and metric to the source.
  for (const event of metrics.events.filter((e) => e.type === 'run.completed')) {
    assert.equal(event.levelId, level.id);
    assert.equal(event.revision, level.revision);
  }
  const physicalMetrics = (value) => ({
    ...value,
    events: value.events.map((e) => (e.type === 'run.completed' ? physicalSummary(e) : e)),
  });
  assert.deepEqual(physicalMetrics(metrics), physicalMetrics(source.metrics));
  for (const key of ['tick', 'player', 'trailCells', 'signal', 'ability', 'encounter'])
    assert.deepEqual(prefix[key], source.savedPrefix[key]);
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
  assert.equal(saved.format, 'xonix-session.v4');
  const restored = await restoreSession(JSON.parse(raw), {
    campaign: context.campaign,
    campaignKey: context.executionKey,
    mediaIdentityCatalog: identities,
  });
  assert.deepEqual(authoritativeCheckpoint(restored.run), prefix.checkpoint);
  assert.deepEqual(restored.session.continuation, saved.continuation);
  assert.deepEqual(restored.session.presentationPins, presentationPins);
  const found = resolvePinnedPicture(
    presentationPicturePins(restored.session.presentationPins),
    'fpv',
    world.prepared.imported.document.library,
  );
  assert.equal(found.kind, 'still');
  assert.equal(found.asset.sha256, image.sha256);
  assert.equal(found.asset.bytes, image.bytes);
  let consumed = 0;
  for (const segment of replay.segments)
    for (let n = 0; n < segment.ticks; n++) {
      if (++consumed <= prefix.tick) continue;
      recordInput(restored.recorder, segment.input);
      stepRun(restored.run, segment.input, FIXED_DT);
    }
  assert.deepEqual(authoritativeCheckpoint(restored.run), checkpoint);
  const continued = exportReplay(restored.recorder, restored.run);
  assert.deepEqual(continued, replay);
  assert.equal(verifyReplay(continued).match, true);
  assert.equal(JSON.stringify(saved), raw);
  return {
    expected,
    checkpoint,
    metrics,
    segments: replay.segments,
    replaySha256: sha(replay),
    savedPrefix: {
      ...prefix,
      format: saved.format,
      continuation: saved.continuation,
      presentationPins,
      bytes: Buffer.byteLength(raw),
      sha256: sha(raw),
      restoredFinalCheckpoint: authoritativeCheckpoint(restored.run),
      replaySuffixByteIdentical: true,
    },
  };
}

export async function verifyExternalSentinel({ candidate, record = false } = {}) {
  assert.equal(typeof record, 'boolean');
  assert.ok(
    !(candidate !== undefined && record),
    'Explicit candidates cannot record source proof.',
  );
  assert.ok(
    candidate === undefined || plainObject(candidate),
    'Explicit candidate must be an object.',
  );
  const owned =
    candidate === undefined
      ? null
      : boundedJSON(candidate, {
          maxBytes: 8 * 1024 * 1024,
          maxNodes: 300000,
          maxDepth: 32,
          maxArray: 20000,
          maxString: 65536,
        });
  if (owned) {
    exactKeys(owned, ['descriptor', 'proof'], 'External Sentinel request');
    assert.ok(
      plainObject(owned.descriptor) && plainObject(owned.proof),
      'Explicit candidate requires descriptor and proof.',
    );
  }
  if (record)
    for (const file of [PROOF_FILE, DESCRIPTOR_FILE])
      await assert.rejects(lstat(path.join(ROOT, file)), { code: 'ENOENT' });
  const source = JSON.parse(await boundedFile(SOURCE_PROOF, 2 * 1024 * 1024, SOURCE_PROOF_SHA));
  assert.equal(source.format, 'revealline-sentinel-circuit-proof.v1');
  assert.equal(source.packSha256, SOURCE_PACK_SHA);
  assert.deepEqual(
    [
      source.routes.length,
      source.summary.wins,
      source.summary.lifeLossControls,
      source.summary.unfinishedClosureControls,
    ],
    [56, 32, 16, 8],
  );
  const world = await buildExternalSentinel();
  if (owned) assert.deepEqual(owned.descriptor, world.descriptor);
  const proof = owned
    ? owned.proof
    : record
      ? null
      : JSON.parse(await boundedFile(PROOF_FILE, 8 * 1024 * 1024));
  const header = {
    format: 'revealline-sentinel-external-proof.v1',
    sourceProof: { path: SOURCE_PROOF, sha256: SOURCE_PROOF_SHA },
    descriptor: world.descriptor,
    inputPins: world.inputPins,
    images: world.imageProofs,
    geometry:
      'Three existing Sentinel Circuit geometries; unchanged physical configurations in this art-binding edition.',
  };
  if (proof) {
    exactKeys(proof, [...Object.keys(header), 'routes', 'summary'], 'External Sentinel proof');
    for (const [key, value] of Object.entries(header)) assert.deepEqual(proof[key], value);
    assert.deepEqual(
      proof.routes.map((r) => r.id),
      source.routes.map((r) => `fpv/${r.id}`),
    );
  }
  const routes = [];
  for (const route of source.routes) {
    const index = SOURCE_LEVEL_IDS.indexOf(route.expected.levelId);
    assert.ok(index >= 0);
    const context = world.prepared.executionCatalog.select(
        world.descriptor.campaignKey,
        route.difficulty,
      ),
      level = context.campaign.levels[index];
    const identity = {
      id: `fpv/${route.id}`,
      sourceRouteId: route.id,
      sourceSegmentsSha256: sha(route.segments),
      route: route.route,
      difficulty: route.difficulty,
      executionKey: context.executionKey,
      authoredKey: context.baseCampaignKey,
      setup: route.setup,
      levelId: level.id,
      levelRevision: level.revision,
      imageSha256: world.descriptor.originals[index].sha256,
    };
    const actual = {
      ...identity,
      ...(await execute(world, context, level, route, world.descriptor.originals[index])),
    };
    if (proof)
      assert.deepEqual(
        proof.routes.find((r) => r.id === actual.id),
        actual,
      );
    routes.push(actual);
  }
  const summary = {
    contexts: routes.length,
    wins: routes.filter((r) => r.expected.won).length,
    lifeLossControls: routes.filter((r) => r.expected.status === 'respawning').length,
    unfinishedClosureControls: routes.filter((r) => r.expected.status === 'running').length,
    ticks: routes.reduce((n, r) => n + r.expected.tick, 0),
    savedContinuations: routes.length,
    exactOriginals: 3,
    nullStoryPins: routes.every((r) =>
      r.savedPrefix.presentationPins.choices.every((c) => c.story === null),
    ),
  };
  assert.deepEqual(
    [
      summary.contexts,
      summary.wins,
      summary.lifeLossControls,
      summary.unfinishedClosureControls,
      summary.ticks,
    ],
    [56, 32, 16, 8, 101713],
  );
  assert.equal(summary.nullStoryPins, true);
  const result = { ...header, routes, summary };
  if (record)
    for (const [file, value] of [
      [PROOF_FILE, result],
      [DESCRIPTOR_FILE, world.descriptor],
    ])
      await writeFile(path.join(ROOT, file), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  else {
    assert.deepEqual(proof, result);
    assert.deepEqual(JSON.parse(await boundedFile(DESCRIPTOR_FILE, 16384)), world.descriptor);
  }
  return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  assert.ok(args.length === 0 || (args.length === 1 && args[0] === '--record'));
  const result = await verifyExternalSentinel({ record: args.length === 1 });
  console.log(
    JSON.stringify(
      {
        passed: true,
        ...result.summary,
        limits:
          'Actual core/replay/saved-pin proofs only; no host, install, Collection, browser, offline, public or hardware qualification.',
      },
      null,
      2,
    ),
  );
}
