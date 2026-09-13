import assert from 'node:assert/strict';
import { lstat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ROOT,
  ID,
  IDS,
  INPUTS,
  SOURCE_PROOF,
  SOURCE_PACK_SHA,
  readPinned,
  digest,
  buildFractureChapter,
} from './build.mjs';
import { drive } from '../fracture-lines/controls.mjs';
import { routeCommands } from '../fracture-lines/verify.mjs';
import { boundedJSON, exactKeys, plainObject } from '../../../game/data-json.mjs';
import { createMediaIdentityCatalog } from '../../../game/media-library.mjs';
import { resolvePackCampaign } from '../../../game/packs.mjs';
import { createExecutionCatalog } from '../../../game/campaign-contexts.mjs';
import { createPresentationPins, resolvePinnedPicture } from '../../../game/presentation-pins.mjs';
import {
  FLIGHT_MEDIA_PINS_FORMAT,
  snapshotFlightPresentationPins,
  presentationPicturePins,
} from '../../../game/flight-media-pins.mjs';
import { suspendSession, restoreSession, SESSION_STORAGE_BYTES } from '../../../game/sessions.mjs';
import {
  authoritativeCheckpoint,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../../../game/replay.mjs';
import { stepRun, FIXED_DT } from '../../../game/core/index.mjs';

export const PROOF_FILE = 'authoring/library/fracture-lines-chapter/routes.json';
export const DESCRIPTOR_FILE = 'authoring/library/fracture-lines-chapter/descriptor.json';
function compareExecution(actual, prior) {
  const a = authoritativeCheckpoint(actual),
    b = authoritativeCheckpoint(prior);
  assert.equal(a.algorithm, b.algorithm);
  // Gentle revisions intentionally include the authored campaign owner. Compare
  // every physical section; compare the result separately with that exact remap.
  for (const name of Object.keys(b.sections))
    if (!['identity', 'result'].includes(name))
      assert.equal(a.sections[name], b.sections[name], name);
  assert.deepEqual(
    actual.result && { ...actual.result, revision: prior.result.revision },
    prior.result,
  );
  for (const key of [
    'ruleset',
    'levelId',
    'seed',
    'turnPolicy',
    'classId',
    'classRevision',
    'loadoutHash',
    'activeClassId',
    'rosterHash',
    'width',
    'height',
  ])
    assert.deepEqual(actual[key], prior[key], key);
}
async function execute(world, context, source, baseContext) {
  const pack = world.prepared.pack,
    level = context.campaign.levels.find((l) => l.id === source.levelId);
  assert.ok(level);
  const baseLevel = baseContext.campaign.levels.find((l) => l.id === source.levelId);
  assert.deepEqual({ ...level, revision: baseLevel.revision }, baseLevel);
  const baseline = new Map();
  const baseResult = drive(
    baseLevel,
    world.sourcePack.classRecipes,
    source.turnPolicy,
    routeCommands(baseLevel.id, source.route, baseContext.difficulty),
    {
      onTick({ run }) {
        for (const boundary of source.saved.filter((s) => s.tick === run.tick)) {
          assert.equal(digest(authoritativeCheckpoint(run)), boundary.checkpointSha256);
          baseline.set(boundary.tick, structuredClone(run));
        }
      },
    },
  );
  assert.deepEqual(baseResult.expected, source.expected);
  assert.equal(digest(authoritativeCheckpoint(baseResult.run)), source.checkpointSha256);
  assert.equal(digest(baseResult.replay), source.replaySha256);
  const { notable: baseNotable, ...baseCounts } = baseResult.metrics;
  assert.deepEqual({ ...baseCounts, notableSha256: digest(baseNotable) }, source.metrics);
  const identities = createMediaIdentityCatalog(world.prepared.executionCatalog);
  const library = world.prepared.imported.document.library;
  const choices = createPresentationPins({
    library,
    identityCatalog: identities,
    executionKey: context.executionKey,
    levelId: level.id,
    levelRevision: level.revision,
    themeIds: ['fpv'],
  });
  const pins = snapshotFlightPresentationPins({
    ...choices,
    format: FLIGHT_MEDIA_PINS_FORMAT,
    choices: choices.choices.map((picture) => ({ picture, story: null })),
  });
  const original = world.descriptor.originals.find((o) => o.levelId === level.id);
  assert.equal(pins.choices.length, 1);
  assert.equal(pins.choices[0].picture.kind, 'still');
  assert.equal(pins.choices[0].picture.sha256, original.sha256);
  assert.equal(pins.choices[0].picture.identity.baseCampaignKey, world.descriptor.campaignKey);
  const saves = [];
  const result = drive(
    level,
    pack.classRecipes,
    source.turnPolicy,
    routeCommands(level.id, source.route, context.difficulty),
    {
      onTick({ run, recorder, input }) {
        for (const boundary of source.saved.filter((s) => s.tick === run.tick)) {
          const checkpoint = authoritativeCheckpoint(run);
          compareExecution(run, baseline.get(boundary.tick));
          assert.deepEqual(run.player, boundary.player);
          assert.equal(run.trail.length, boundary.trailCells);
          const session = suspendSession({
            run,
            recorder,
            campaignKey: context.executionKey,
            themeId: 'fpv',
            bodyId: pack.themes[0].player,
            runId: `${ID}-${source.id.replaceAll('/', '-')}`,
            savedAt: '2026-09-14T00:00:00.000Z',
            continuation: { direction: input.direction },
            presentationPins: pins,
          });
          assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
          saves.push({ boundary, checkpoint, session });
        }
      },
    },
  );
  const checkpoint = authoritativeCheckpoint(result.run);
  assert.deepEqual({ ...result.expected, revision: source.expected.revision }, source.expected);
  compareExecution(result.run, baseResult.run);
  assert.deepEqual(result.replay.segments, source.segments);
  assert.equal(verifyReplay(result.replay).match, true);
  const { notable, ...counts } = result.metrics;
  assert.deepEqual(counts, baseCounts);
  assert.deepEqual(
    notable.map((event) =>
      event.type === 'run.completed' ? { ...event, revision: baseLevel.revision } : event,
    ),
    baseNotable,
  );
  assert.equal(saves.length, source.saved.length);
  const saved = [];
  for (const { boundary, checkpoint: before, session } of saves) {
    const raw = JSON.stringify(session);
    assert.ok(Buffer.byteLength(raw) <= SESSION_STORAGE_BYTES);
    assert.equal(session.format, 'xonix-session.v4');
    const restored = await restoreSession(JSON.parse(raw), {
      campaign: context.campaign,
      campaignKey: context.executionKey,
      mediaIdentityCatalog: identities,
    });
    assert.deepEqual(authoritativeCheckpoint(restored.run), before);
    assert.deepEqual(restored.session.presentationPins, pins);
    assert.deepEqual(restored.session.continuation, session.continuation);
    const poster = resolvePinnedPicture(
      presentationPicturePins(restored.session.presentationPins),
      'fpv',
      library,
    );
    assert.equal(poster.kind, 'still');
    assert.equal(poster.asset.id, original.assetId);
    assert.equal(poster.asset.sha256, original.sha256);
    assert.equal(poster.asset.bytes, original.bytes);
    let consumed = 0;
    for (const segment of result.replay.segments)
      for (let n = 0; n < segment.ticks; n++) {
        if (++consumed <= boundary.tick) continue;
        recordInput(restored.recorder, segment.input);
        stepRun(restored.run, segment.input, FIXED_DT);
      }
    assert.deepEqual(authoritativeCheckpoint(restored.run), checkpoint);
    assert.deepEqual(exportReplay(restored.recorder, restored.run), result.replay);
    assert.equal(JSON.stringify(session), raw);
    saved.push({
      label: boundary.label,
      tick: boundary.tick,
      bytes: Buffer.byteLength(raw),
      sha256: digest(raw),
      checkpointSha256: digest(before),
      finalCheckpointSha256: digest(checkpoint),
      suffixTicks: result.run.tick - boundary.tick,
    });
  }
  return {
    id: source.id,
    baseTraceSha256: digest(source),
    authoredKey: context.baseCampaignKey,
    executionKey: context.executionKey,
    presentationPins: pins,
    expected: result.expected,
    checkpointSha256: digest(checkpoint),
    replaySha256: digest(result.replay),
    metricsSha256: digest({ ...counts, notableSha256: digest(notable) }),
    saved,
  };
}

/** Executes pinned existing controls with exact new still ownership; no search or host mutation. */
export async function verifyFractureChapter({ candidate, record = false } = {}) {
  assert.equal(typeof record, 'boolean');
  assert.ok(!(candidate !== undefined && record), 'An explicit candidate cannot record.');
  assert.ok(
    candidate === undefined || plainObject(candidate),
    'Explicit candidate must be an object.',
  );
  const owned =
    candidate === undefined
      ? null
      : boundedJSON(candidate, {
          maxBytes: 2 * 1024 * 1024,
          maxNodes: 100000,
          maxDepth: 24,
          maxArray: 1000,
          maxString: 4096,
        });
  if (owned) {
    exactKeys(owned, ['descriptor', 'proof'], 'Fracture chapter request');
    assert.ok(plainObject(owned.descriptor) && plainObject(owned.proof));
  }
  if (record)
    for (const file of [PROOF_FILE, DESCRIPTOR_FILE])
      await assert.rejects(lstat(path.join(ROOT, file)), { code: 'ENOENT' });
  const base = JSON.parse(await readPinned(SOURCE_PROOF, 2 * 1024 * 1024, INPUTS[SOURCE_PROOF]));
  assert.equal(base.format, 'revealline-fracture-proof.v1');
  assert.equal(base.packSha256, SOURCE_PACK_SHA);
  assert.deepEqual([base.routes.length, base.gameOverControls.length], [48, 6]);
  const world = await buildFractureChapter();
  if (owned) assert.deepEqual(owned.descriptor, world.descriptor);
  const proof = owned
    ? owned.proof
    : record
      ? null
      : JSON.parse(await readPinned(PROOF_FILE, 2 * 1024 * 1024));
  const header = {
    format: 'revealline-fracture-chapter-proof.v1',
    sourceProof: { path: SOURCE_PROOF, sha256: INPUTS[SOURCE_PROOF] },
    sourcePackSha256: SOURCE_PACK_SHA,
    descriptorSha256: digest(world.descriptor),
    inputPins: world.inputPins,
  };
  if (proof) {
    exactKeys(
      proof,
      [...Object.keys(header), 'routes', 'gameOverControls', 'summary'],
      'Fracture chapter proof',
    );
    for (const key of Object.keys(header))
      assert.deepEqual(proof[key], header[key], `Exact ${key} required.`);
    assert.deepEqual(
      proof.routes.map((r) => r.id),
      base.routes.map((r) => r.id),
      'Exact48 route IDs required.',
    );
    assert.deepEqual(
      proof.gameOverControls.map((r) => r.id),
      base.gameOverControls.map((r) => r.id),
      'Exact6 gameover IDs required.',
    );
  }
  if (!record && !owned)
    assert.deepEqual(JSON.parse(await readPinned(DESCRIPTOR_FILE, 16384)), world.descriptor);
  const contexts = world.prepared.executionCatalog.entries;
  const baseContexts = createExecutionCatalog([
    resolvePackCampaign(world.sourcePack, world.sourcePack.id),
  ]).entries;
  assert.deepEqual(
    contexts.map((c) => c.difficulty),
    ['standard', 'gentle'],
  );
  assert.deepEqual(
    world.prepared.pack.campaigns[0].levels.map((l) => l.id),
    IDS,
  );
  const routes = [],
    gameOverControls = [];
  for (const [sourceRows, target] of [
    [base.routes, routes],
    [base.gameOverControls, gameOverControls],
  ])
    for (const source of sourceRows) {
      const context = contexts.find((c) => c.difficulty === source.difficulty);
      assert.ok(context && ['immediate', 'grid-center'].includes(source.turnPolicy));
      target.push(
        await execute(
          world,
          context,
          source,
          baseContexts.find((c) => c.difficulty === source.difficulty),
        ),
      );
    }
  const all = [...routes, ...gameOverControls],
    saves = all.flatMap((r) => r.saved);
  const summary = {
    contexts: routes.length,
    ordinaryWins: 24,
    firstLifeLossControls: 12,
    recoveredWins: 12,
    separateGameOvers: gameOverControls.length,
    ticks: all.reduce((n, r) => n + r.expected.tick, 0),
    savedChecks: saves.length,
    nonemptySavedSuffixes: saves.filter((s) => s.suffixTicks > 0).length,
    savedEndpointRestores: saves.filter((s) => s.suffixTicks === 0).length,
    originalCount: world.descriptor.originals.length,
    originalBytes: world.descriptor.originals.reduce((n, o) => n + o.bytes, 0),
    pairBytes: world.payloads.pack.size + world.payloads.media.size,
  };
  for (const key of [
    'contexts',
    'ordinaryWins',
    'firstLifeLossControls',
    'recoveredWins',
    'separateGameOvers',
    'ticks',
    'savedChecks',
    'nonemptySavedSuffixes',
    'savedEndpointRestores',
  ])
    assert.equal(summary[key], base.summary[key]);
  const actual = { ...header, routes, gameOverControls, summary };
  if (proof) assert.deepEqual(actual, proof);
  if (record) {
    await writeFile(
      path.join(ROOT, DESCRIPTOR_FILE),
      JSON.stringify(world.descriptor, null, 2) + '\n',
      { flag: 'wx' },
    );
    await writeFile(path.join(ROOT, PROOF_FILE), JSON.stringify(actual, null, 2) + '\n', {
      flag: 'wx',
    });
  }
  return actual;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(
    process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === '--record'),
  );
  const proof = await verifyFractureChapter({ record: process.argv[2] === '--record' });
  console.log(JSON.stringify(proof.summary, null, 2));
}
