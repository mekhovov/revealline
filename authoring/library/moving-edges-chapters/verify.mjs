import assert from 'node:assert/strict';
import { lstat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ROOT,
  THEME_IDS,
  physicalLevel,
  IDS,
  INPUTS,
  SOURCE_PROOF,
  MECHANICS_PROOF,
  MECHANIC_CASES,
  SOURCE_PACK_SHA,
  readPinned,
  digest,
  buildMovingEdgesTheme,
} from './build.mjs';
import { drive } from '../moving-edges/controls.mjs';
import { routeCommands } from '../moving-edges/controls.mjs';
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

export const PROOF_FILE = 'authoring/library/moving-edges-chapters/routes.json';
export const descriptorFile = (themeId) =>
  `authoring/library/moving-edges-chapters/descriptors/${themeId}.json`;
function commandsFor(source, levelId, difficulty, mechanicCases) {
  if (source.sourceCertificate === SOURCE_PROOF)
    return routeCommands(levelId, source.route, difficulty);
  const definition = mechanicCases.cases.find((c) => `${c.id}/${source.turnPolicy}` === source.id);
  assert.ok(definition, 'Exact selected mechanic commands required.');
  assert.equal(definition.levelId, levelId);
  assert.equal(definition.difficulty, difficulty);
  assert.equal(definition.kind, source.kind);
  return definition.commands;
}
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
async function execute(world, context, source, baseContext, baseCache, mechanicCases) {
  const pack = world.prepared.pack,
    level = context.campaign.levels.find((l) => l.id === source.levelId);
  assert.ok(level);
  const baseLevel = baseContext.campaign.levels.find((l) => l.id === source.levelId);
  assert.deepEqual(
    physicalLevel({ ...level, revision: baseLevel.revision }),
    physicalLevel(baseLevel),
  );
  const authored = pack.campaigns[0].levels.find((l) => l.id === level.id);
  assert.equal(level.name, authored.name);
  assert.equal(level.themeId, world.descriptor.themeId);
  for (const key of ['title', 'description', 'rightsStatus'])
    assert.equal(level.metadata[key], authored.metadata[key]);
  if (context.difficulty === 'standard') assert.equal(level.revision, baseLevel.revision);
  else assert.notEqual(level.revision, baseLevel.revision);
  if (!baseCache.has(source.id))
    baseCache.set(
      source.id,
      (() => {
        const baseline = new Map();
        const baseResult = drive(
          baseLevel,
          world.sourcePack.classRecipes,
          source.turnPolicy,
          commandsFor(source, baseLevel.id, baseContext.difficulty, mechanicCases),
          {
            classId: source.classId,
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
        return { baseline, baseResult, baseCounts, baseNotable };
      })(),
    );
  const { baseline, baseResult, baseCounts, baseNotable } = baseCache.get(source.id);
  const identities = createMediaIdentityCatalog(world.prepared.executionCatalog);
  const library = world.prepared.imported.document.library;
  const choices = createPresentationPins({
    library,
    identityCatalog: identities,
    executionKey: context.executionKey,
    levelId: level.id,
    levelRevision: level.revision,
    themeIds: [world.descriptor.themeId],
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
    commandsFor(source, level.id, context.difficulty, mechanicCases),
    {
      classId: source.classId,
      onTick({ run, recorder, input }) {
        for (const boundary of source.saved.filter((s) => s.tick === run.tick)) {
          const checkpoint = authoritativeCheckpoint(run);
          compareExecution(run, baseline.get(boundary.tick));
          if (Object.hasOwn(boundary, 'player')) assert.deepEqual(run.player, boundary.player);
          if (Object.hasOwn(boundary, 'trailCells'))
            assert.equal(run.trail.length, boundary.trailCells);
          assert.deepEqual({ direction: input.direction }, boundary.continuation);
          assert.equal(
            run.status === 'won' || run.status === 'lost',
            false,
            'Terminal results are not resumable sessions.',
          );
          const session = suspendSession({
            run,
            recorder,
            campaignKey: context.executionKey,
            themeId: world.descriptor.themeId,
            bodyId: pack.themes[0].player,
            runId: `${world.descriptor.id}-${source.id.replaceAll('/', '-')}`,
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
      world.descriptor.themeId,
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
    sourceCertificate: source.sourceCertificate,
    baseTraceSha256: source.sourceRowSha256,
    sourceRoute: source.route,
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

/** Replays retained controls for distinct scenic owners; never searches or mutates a host. */
export async function verifyMovingEdgesThemes({ candidate, record = false } = {}) {
  assert.equal(typeof record, 'boolean');
  assert.ok(!(candidate !== undefined && record), 'An explicit candidate cannot record.');
  assert.ok(
    candidate === undefined || plainObject(candidate),
    'Explicit candidate must be an object.',
  );
  // Snapshot the entire request before the first asynchronous read.
  const owned =
    candidate === undefined
      ? null
      : boundedJSON(candidate, {
          maxBytes: 6 * 1024 * 1024,
          maxNodes: 300000,
          maxDepth: 24,
          maxArray: 1000,
          maxString: 4096,
        });
  if (owned) {
    exactKeys(owned, ['descriptors', 'proof'], 'Moving Edges theme request');
    assert.ok(
      Array.isArray(owned.descriptors) &&
        owned.descriptors.length === 4 &&
        owned.descriptors.every(plainObject),
    );
    assert.ok(plainObject(owned.proof));
  }
  if (record)
    for (const file of [PROOF_FILE, ...THEME_IDS.map(descriptorFile)])
      await assert.rejects(lstat(path.join(ROOT, file)), { code: 'ENOENT' });
  const base = JSON.parse(await readPinned(SOURCE_PROOF, 4 * 1024 * 1024, INPUTS[SOURCE_PROOF]));
  assert.equal(base.format, 'revealline-moving-edges-scout-proof.v1');
  assert.equal(base.packSha256, SOURCE_PACK_SHA);
  assert.equal(base.routes.length, 24);
  const mechanics = JSON.parse(
    await readPinned(MECHANICS_PROOF, 4 * 1024 * 1024, INPUTS[MECHANICS_PROOF]),
  );
  const mechanicCases = JSON.parse(
    await readPinned(MECHANIC_CASES, 128 * 1024, INPUTS[MECHANIC_CASES]),
  );
  assert.equal(mechanics.format, 'revealline-moving-edges-mechanics-proof.v1');
  assert.equal(mechanics.ordinaryProofSha256, INPUTS[SOURCE_PROOF]);
  assert.equal(mechanics.packSha256, SOURCE_PACK_SHA);
  assert.equal(mechanics.cases.length, 52);
  assert.equal(mechanicCases.format, 'revealline-moving-edges-mechanic-cases.v1');
  assert.equal(mechanicCases.classId, 'scout');
  assert.equal(mechanicCases.seed, 1);
  assert.deepEqual(mechanicCases.turnPolicies, ['immediate', 'grid-center']);
  assert.equal(mechanicCases.cases.length, 26);
  assert.equal(new Set(mechanicCases.cases.map((c) => c.id)).size, 26);
  assert.deepEqual(
    mechanics.cases.map((c) => c.id),
    mechanicCases.cases.flatMap((c) => mechanicCases.turnPolicies.map((t) => `${c.id}/${t}`)),
  );
  const annotate = (row, sourceCertificate, route = row.route) => ({
    ...row,
    route,
    sourceCertificate,
    sourceRowSha256: digest(row),
  });
  const selected = {
    routes: [
      ...base.routes.map((row) => annotate(row, SOURCE_PROOF)),
      ...mechanics.cases
        .filter((row) => row.kind === 'recovered-win')
        .map((row) => annotate(row, MECHANICS_PROOF, 'recovered')),
    ],
    gameOverControls: mechanics.cases
      .filter((row) => row.kind === 'game-over')
      .map((row) => annotate(row, MECHANICS_PROOF, 'game-over')),
  };
  assert.deepEqual([selected.routes.length, selected.gameOverControls.length], [36, 12]);
  const sourceRows = [...selected.routes, ...selected.gameOverControls];
  assert.equal(new Set(sourceRows.map((r) => r.id)).size, 48);
  assert(sourceRows.every((r) => r.classId === 'scout'));
  const sourceSaved = sourceRows.flatMap((r) => r.saved);
  const selectedSummary = {
    contexts: selected.routes.length,
    ordinaryWins: selected.routes.filter(
      (r) => ['north', 'south'].includes(r.route) && r.expected.status === 'won',
    ).length,
    firstLifeLossControls: selected.routes.filter(
      (r) => r.route === 'loss' && r.expected.status === 'respawning',
    ).length,
    recoveredWins: selected.routes.filter(
      (r) => r.route === 'recovered' && r.expected.status === 'won',
    ).length,
    separateGameOvers: selected.gameOverControls.filter((r) => r.expected.status === 'lost').length,
    ticks: sourceRows.reduce((n, r) => n + r.expected.tick, 0),
    savedChecks: sourceSaved.length,
    nonemptySavedSuffixes: sourceSaved.filter((s) => s.suffixTicks > 0).length,
    savedEndpointRestores: sourceSaved.filter((s) => s.suffixTicks === 0).length,
  };
  const proof = owned
    ? owned.proof
    : record
      ? null
      : JSON.parse(await readPinned(PROOF_FILE, 2 * 1024 * 1024));
  const header = {
    format: 'revealline-moving-edges-chapters-proof.v1',
    sourceProof: { path: SOURCE_PROOF, sha256: INPUTS[SOURCE_PROOF] },
    mechanicProof: { path: MECHANICS_PROOF, sha256: INPUTS[MECHANICS_PROOF] },
    sourcePackSha256: SOURCE_PACK_SHA,
    selection: {
      classId: 'scout',
      routes: selected.routes.map((r) => r.id),
      gameOverControls: selected.gameOverControls.map((r) => r.id),
      authenticatedBaseRecords: 76,
      unexecutedDedicatedMechanics: 28,
    },
  };
  if (proof) {
    exactKeys(proof, [...Object.keys(header), 'editions', 'summary'], 'Moving Edges theme proof');
    for (const key of Object.keys(header))
      assert.deepEqual(proof[key], header[key], `Exact ${key} required.`);
    assert.deepEqual(
      proof.editions.map((e) => e.themeId),
      THEME_IDS,
    );
    // Reject a missing/reordered trace in any theme before executing any trace.
    for (const edition of proof.editions) {
      exactKeys(
        edition,
        ['themeId', 'descriptorSha256', 'inputPins', 'routes', 'gameOverControls', 'summary'],
        'MovingEdges proof edition',
      );
      for (const key of ['routes', 'gameOverControls'])
        assert.deepEqual(
          edition[key].map((r) => r.id),
          selected[key].map((r) => r.id),
          `Exact ${key} IDs required.`,
        );
    }
  }
  const editions = [],
    descriptors = [],
    baseCache = new Map();
  for (const [i, themeId] of THEME_IDS.entries()) {
    const world = await buildMovingEdgesTheme(themeId);
    descriptors.push(world.descriptor);
    if (owned) assert.deepEqual(owned.descriptors[i], world.descriptor);
    if (!record && !owned)
      assert.deepEqual(
        JSON.parse(await readPinned(descriptorFile(themeId), 16384)),
        world.descriptor,
      );
    const expected = proof?.editions[i];
    const editionHeader = {
      themeId,
      descriptorSha256: digest(world.descriptor),
      inputPins: world.inputPins,
    };
    if (expected)
      for (const key of Object.keys(editionHeader))
        assert.deepEqual(expected[key], editionHeader[key]);
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
      [selected.routes, routes],
      [selected.gameOverControls, gameOverControls],
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
            baseCache,
            mechanicCases,
          ),
        );
      }
    const all = [...routes, ...gameOverControls],
      saves = all.flatMap((r) => r.saved);
    const summary = {
      contexts: routes.length,
      ordinaryWins: routes.filter(
        (r) => ['north', 'south'].includes(r.sourceRoute) && r.expected.status === 'won',
      ).length,
      firstLifeLossControls: routes.filter(
        (r) => r.sourceRoute === 'loss' && r.expected.status === 'respawning',
      ).length,
      recoveredWins: routes.filter(
        (r) => r.sourceRoute === 'recovered' && r.expected.status === 'won',
      ).length,
      separateGameOvers: gameOverControls.filter((r) => r.expected.status === 'lost').length,
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
      assert.equal(summary[key], selectedSummary[key], key);
    const actual = { ...editionHeader, routes, gameOverControls, summary };
    if (expected) assert.deepEqual(actual, expected);
    editions.push(actual);
  }
  assert.equal(new Set(descriptors.map((d) => d.campaignKey)).size, 4);
  assert.equal(new Set(descriptors.flatMap((d) => d.originals.map((o) => o.sha256))).size, 12);
  assert.equal(baseCache.size, 48);
  const summary = Object.fromEntries(
    Object.keys(editions[0].summary).map((key) => [
      key,
      editions.reduce((n, e) => n + e.summary[key], 0),
    ]),
  );
  const actual = { ...header, editions, summary };
  if (proof) assert.deepEqual(actual, proof);
  if (record) {
    for (const [i, themeId] of THEME_IDS.entries())
      await writeFile(
        path.join(ROOT, descriptorFile(themeId)),
        JSON.stringify(descriptors[i], null, 2) + '\n',
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
  const proof = await verifyMovingEdgesThemes({ record: process.argv[2] === '--record' });
  console.log(JSON.stringify(proof.summary, null, 2));
}
