import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { buildFractureLines, IDS } from './build.mjs';
import { CONTROLS, drive } from './controls.mjs';
import { digest, ordinaryFile } from '../sentinel-circuit/files.mjs';
import { boundedJSON, exactKeys, plainObject } from '../../../game/data-json.mjs';
import { resolvePackCampaign } from '../../../game/packs.mjs';
import { createExecutionCatalog } from '../../../game/campaign-contexts.mjs';
import { createMediaIdentityCatalog } from '../../../game/media-library.mjs';
import {
  FLIGHT_MEDIA_PINS_FORMAT,
  snapshotFlightPresentationPins,
} from '../../../game/flight-media-pins.mjs';
import { stepRun, FIXED_DT } from '../../../game/core/index.mjs';
import {
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../../../game/replay.mjs';
import { suspendSession, restoreSession, SESSION_STORAGE_BYTES } from '../../../game/sessions.mjs';

export const ROUTES = Object.freeze(['north', 'south', 'loss', 'recovered']);
const PROOF = new URL('./routes.json', import.meta.url);
const contentFiles = ['build.mjs', 'layouts.json', 'controls.mjs'];
export function routeCommands(levelId, which, difficulty) {
  assert.ok(
    IDS.includes(levelId) && [...ROUTES, 'gameover'].includes(which),
    'Exact map and route required.',
  );
  assert.ok(['standard', 'gentle'].includes(difficulty), 'Exact implemented difficulty required.');
  const controls = CONTROLS[levelId];
  if (which === 'gameover') {
    assert.equal(difficulty, 'standard', 'Game-over probes are separately authored for Standard.');
    return Array.from({ length: 3 }, () => [...controls.loss, { recover: true }]).flat();
  }
  const selected =
    controls[which] ??
    (which === 'recovered' ? [...controls.loss, { recover: true }, ...controls.north] : null);
  return Array.isArray(selected) ? selected : selected[difficulty];
}
export async function executeFractureRoute(
  source,
  context,
  identities,
  levelId,
  which,
  turnPolicy,
) {
  const level = context.campaign.levels.find((l) => l.id === levelId);
  assert.ok(level, 'Exact execution level required.');
  const boundaries = new Map();
  const picture = {
    kind: 'legacy',
    identity: identities.resolve({
      executionKey: context.executionKey,
      levelId,
      levelRevision: level.revision,
      themeId: 'fpv',
    }),
  };
  const pins = snapshotFlightPresentationPins({
    format: FLIGHT_MEDIA_PINS_FORMAT,
    executionKey: context.executionKey,
    levelId,
    levelRevision: level.revision,
    choices: [{ picture, story: null }],
  });
  const result = drive(
    level,
    source.pack.classRecipes,
    turnPolicy,
    routeCommands(levelId, which, context.difficulty),
    {
      onTick({ run, recorder, input, reclaimed }) {
        const labels = [];
        if (run.status === 'running' && run.player.cutting && run.trail.length >= 6)
          labels.push('unfinished');
        if (run.enemies.some((e) => e.classic?.pressure?.phase === 'warning'))
          labels.push('pressure-warning');
        if (run.enemies.some((e) => e.classic?.pressure?.phase === 'committed'))
          labels.push('pressure-commit');
        if (run.events.some((e) => e.type === 'capture.stopped')) labels.push('capture-stop');
        if (run.status === 'respawning') labels.push('recovery');
        if (run.events.some((e) => e.type === 'erosion.warning')) labels.push('erosion-warning');
        if (reclaimed > 0) labels.push('recapture');
        if (['won', 'lost'].includes(run.status)) return;
        for (const label of labels)
          if (!boundaries.has(label)) {
            const checkpoint = authoritativeCheckpoint(run);
            const session = suspendSession({
              run,
              recorder,
              campaignKey: context.executionKey,
              themeId: 'fpv',
              bodyId: source.pack.themes[0].player,
              runId: `fracture-${context.difficulty}-${turnPolicy}-${levelId}-${which}`,
              savedAt: '2026-09-13T00:00:00.000Z',
              continuation: { direction: input.direction },
              presentationPins: pins,
            });
            assert.deepEqual(
              authoritativeCheckpoint(run),
              checkpoint,
              'Saving must not change a route.',
            );
            boundaries.set(label, {
              label,
              tick: run.tick,
              checkpoint,
              session,
              player: structuredClone(run.player),
              trailCells: run.trail.length,
            });
          }
      },
    },
  );
  const { run, replay, expected, metrics } = result;
  assert.equal(
    run.status,
    which === 'loss' ? 'respawning' : which === 'gameover' ? 'lost' : 'won',
    `${levelId}/${context.difficulty}/${turnPolicy}/${which}`,
  );
  assert.equal(
    run.classic.livesLost,
    which === 'gameover' ? 3 : ['loss', 'recovered'].includes(which) ? 1 : 0,
  );
  assert.ok(boundaries.has('unfinished'), 'Actual unfinished prefix is required.');
  assert.equal(verifyReplay(replay).match, true);
  const checkpoint = authoritativeCheckpoint(run),
    saved = [];
  for (const boundary of boundaries.values()) {
    const raw = JSON.stringify(boundary.session);
    assert.ok(Buffer.byteLength(raw) <= SESSION_STORAGE_BYTES);
    assert.equal(boundary.session.format, 'xonix-session.v4');
    const restored = await restoreSession(JSON.parse(raw), {
      campaign: context.campaign,
      campaignKey: context.executionKey,
      mediaIdentityCatalog: identities,
    });
    assert.deepEqual(authoritativeCheckpoint(restored.run), boundary.checkpoint);
    assert.deepEqual(restored.session.presentationPins, pins);
    assert.deepEqual(restored.session.continuation, boundary.session.continuation);
    let consumed = 0;
    for (const segment of replay.segments) {
      assert.equal(segment.releaseBefore, false);
      for (let n = 0; n < segment.ticks; n++) {
        if (++consumed <= boundary.tick) continue;
        recordInput(restored.recorder, segment.input);
        stepRun(restored.run, segment.input, FIXED_DT);
      }
    }
    assert.deepEqual(authoritativeCheckpoint(restored.run), checkpoint);
    assert.deepEqual(exportReplay(restored.recorder, restored.run), replay);
    assert.equal(JSON.stringify(boundary.session), raw);
    saved.push({
      label: boundary.label,
      tick: boundary.tick,
      player: boundary.player,
      trailCells: boundary.trailCells,
      format: boundary.session.format,
      bytes: Buffer.byteLength(raw),
      sha256: digest(raw),
      checkpointSha256: digest(boundary.checkpoint),
      finalCheckpointSha256: digest(checkpoint),
      suffixTicks: run.tick - boundary.tick,
      continuation: boundary.session.continuation,
      presentationPins: pins,
    });
  }
  const { notable, ...counts } = metrics;
  return {
    id: `${context.difficulty}/${turnPolicy}/${levelId}/${which}`,
    levelId,
    route: which,
    difficulty: context.difficulty,
    turnPolicy,
    authoredKey: context.baseCampaignKey,
    executionKey: context.executionKey,
    loadoutHash: run.loadoutHash,
    expected,
    checkpointSha256: digest(checkpoint),
    replaySha256: digest(replay),
    segments: replay.segments,
    metrics: { ...counts, notableSha256: digest(notable) },
    saved,
  };
}

/** Finite authored matrix, no search; explicit candidates are owned before awaits. */
export async function verifyFractureLines({ candidate, record = false } = {}) {
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
          maxBytes: 4 * 1024 * 1024,
          maxNodes: 250000,
          maxDepth: 28,
          maxArray: 10000,
          maxString: 16384,
        });
  if (owned) {
    exactKeys(owned, ['pack', 'proof'], 'Fracture request');
    assert.ok(plainObject(owned.pack) && plainObject(owned.proof));
  }
  const source = await buildFractureLines();
  if (owned) assert.deepEqual(owned.pack, source.pack, 'Exact Fracture source required.');
  const expected = owned
    ? owned.proof
    : record
      ? null
      : JSON.parse(await ordinaryFile(PROOF, 4 * 1024 * 1024));
  const content = {};
  for (const file of contentFiles)
    content[file] = digest(await readFile(new URL(file, import.meta.url)));
  const header = {
    format: 'revealline-fracture-proof.v1',
    inputPins: source.inputPins,
    content,
    packSha256: digest(source.pack),
    scenarioSha256: source.scenarios.map(digest),
    topologyFacts: source.topologyFacts,
  };
  const ids = ['standard', 'gentle'].flatMap((d) =>
    ['immediate', 'grid-center'].flatMap((t) =>
      IDS.flatMap((l) => ROUTES.map((r) => `${d}/${t}/${l}/${r}`)),
    ),
  );
  if (expected) {
    exactKeys(
      expected,
      [...Object.keys(header), 'routes', 'gameOverControls', 'summary'],
      'Fracture proof',
    );
    for (const key of Object.keys(header))
      assert.deepEqual(expected[key], header[key], `Exact ${key} required.`);
    assert.deepEqual(
      expected.routes?.map((r) => r.id),
      ids,
      'Exact 48-context matrix required.',
    );
    assert.deepEqual(
      expected.gameOverControls?.map((r) => r.id),
      ['immediate', 'grid-center'].flatMap((t) => IDS.map((l) => `standard/${t}/${l}/gameover`)),
      'Exact six separate game-over controls required.',
    );
  }
  const catalog = createExecutionCatalog([resolvePackCampaign(source.pack, 'fracture-lines')]);
  const identities = createMediaIdentityCatalog(catalog),
    routes = [];
  for (const context of catalog.entries)
    for (const policy of ['immediate', 'grid-center'])
      for (const levelId of IDS)
        for (const which of ROUTES)
          routes.push(
            await executeFractureRoute(source, context, identities, levelId, which, policy),
          );
  const gameOverControls = [];
  for (const policy of ['immediate', 'grid-center'])
    for (const levelId of IDS)
      gameOverControls.push(
        await executeFractureRoute(
          source,
          catalog.entries[0],
          identities,
          levelId,
          'gameover',
          policy,
        ),
      );
  const all = [...routes, ...gameOverControls];
  const proof = {
    ...header,
    routes,
    gameOverControls,
    summary: {
      contexts: routes.length,
      ordinaryWins: routes.filter((r) => ['north', 'south'].includes(r.route)).length,
      firstLifeLossControls: routes.filter((r) => r.route === 'loss').length,
      recoveredWins: routes.filter((r) => r.route === 'recovered').length,
      separateGameOvers: gameOverControls.length,
      ticks: all.reduce((n, r) => n + r.expected.tick, 0),
      savedChecks: all.reduce((n, r) => n + r.saved.length, 0),
      nonemptySavedSuffixes: all.reduce(
        (n, r) => n + r.saved.filter((s) => s.suffixTicks > 0).length,
        0,
      ),
      savedEndpointRestores: all.reduce(
        (n, r) => n + r.saved.filter((s) => s.suffixTicks === 0).length,
        0,
      ),
      limits:
        'Core/input/replay/session proofs only. No native play, human balance, finished media, Expert, registry, build or public qualification.',
    },
  };
  if (expected)
    assert.deepEqual(
      proof,
      expected,
      'Exact actual Fracture outcomes and saved suffixes required.',
    );
  if (record) await writeFile(PROOF, JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
  return proof;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  assert.ok(
    args.length === 0 || (args.length === 1 && args[0] === '--record'),
    'Use verify.mjs [--record].',
  );
  console.log(
    JSON.stringify(
      (await verifyFractureLines({ record: args[0] === '--record' })).summary,
      null,
      2,
    ),
  );
}
