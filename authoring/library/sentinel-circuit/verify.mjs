import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { buildSentinelCircuit, SOURCE_PINS } from './build.mjs';
import { digest, ordinaryFile, writeProof } from './files.mjs';
import { boundedJSON, exactKeys, plainObject } from '../../../game/data-json.mjs';
import { resolvePackCampaign } from '../../../game/packs.mjs';
import { createExecutionCatalog } from '../../../game/campaign-contexts.mjs';
import { createMediaIdentityCatalog } from '../../../game/media-library.mjs';
import {
  FLIGHT_MEDIA_PINS_FORMAT,
  snapshotFlightPresentationPins,
} from '../../../game/flight-media-pins.mjs';
import { createRun, stepRun, FIXED_DT, getSummary } from '../../../game/core/index.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../../../game/replay.mjs';
import { suspendSession, restoreSession, SESSION_STORAGE_BYTES } from '../../../game/sessions.mjs';

export const ROUTES = Object.freeze([
  'court-upper',
  'court-lower',
  'yard-field',
  'yard-rim',
  'boss-fiber',
  'boss-rim',
  'court-blocked',
  'yard-empty',
  'yard-early',
  'boss-scout-band',
  'boss-short',
  'boss-early',
  'boss-missed',
  'boss-recovered',
]);
const PROOF = new URL('./routes.json', import.meta.url);
const MAX_TICKS = 18000;

/** Read-only controllers issue cardinal/stop/equipment commands to the real core. */
async function execute(pack, context, identities, which, turnPolicy) {
  const index = which.startsWith('court') ? 0 : which.startsWith('yard') ? 1 : 2;
  const level = context.campaign.levels[index];
  const classId =
    which.startsWith('yard') && which !== 'yard-rim'
      ? 'bomber'
      : which.startsWith('boss') && !['boss-rim', 'boss-scout-band'].includes(which)
        ? 'fiber'
        : 'scout';
  const setup = { classId, classRecipes: pack.classRecipes, turnPolicy, seed: 1 };
  const run = createRun(level, setup),
    recorder = createRecorder(level, setup, 'sentinel-circuit-proof');
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
  let saved = null,
    prefix = null;
  const finished = () => ['won', 'lost'].includes(run.status);
  function tick(direction = null, extra = {}) {
    assert.ok(run.tick < MAX_TICKS, 'Finite Sentinel route budget.');
    assert.ok(!finished(), 'No commands after a terminal result.');
    const input = {
      direction,
      action: false,
      pickup: false,
      boost: false,
      switchClass: null,
      ...extra,
    };
    recordInput(recorder, input);
    stepRun(run, input, FIXED_DT);
    for (const e of run.events) {
      metrics.eventCounts[e.type] = (metrics.eventCounts[e.type] ?? 0) + 1;
      if (!['player.moved'].includes(e.type)) metrics.events.push(structuredClone(e));
    }
    if (run.signal.zoneIds.length) metrics.signalTicks++;
    if (run.signal.zoneIds.length && run.signal.resistant) metrics.resistantTicks++;
    if (run.signal.speedFactor < 1) metrics.slowedTicks++;
    if (run.enemies.some((e) => e.stunnedUntil > run.time)) metrics.stunnedEnemyTicks++;
    if (run.ability.fields.some((f) => f.until > run.time)) metrics.fieldTicks++;
    if (run.ability.scanUntil > run.time) metrics.scanTicks++;
    if (run.enemies.some((e) => e.classic?.pressure?.phase === 'committed'))
      metrics.pressureTicks++;
    const prefixReady =
      run.status === 'running' &&
      run.player.cutting &&
      run.trail.length >= 6 &&
      (which === 'yard-field'
        ? run.ability.fields.length > 0
        : which.startsWith('boss') && which !== 'boss-rim'
          ? run.signal.zoneIds.length > 0
          : true);
    if (!saved && prefixReady) {
      prefix = {
        tick: run.tick,
        checkpoint: authoritativeCheckpoint(run),
        player: structuredClone(run.player),
        trailCells: run.trail.length,
        signal: structuredClone(run.signal),
        ability: structuredClone(run.ability),
        encounter: structuredClone(run.encounter ?? null),
      };
      const presentationPins = snapshotFlightPresentationPins({
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
      saved = suspendSession({
        run,
        recorder,
        campaignKey: context.executionKey,
        themeId: 'fpv',
        bodyId: pack.themes[0].player,
        runId: `circuit-${context.difficulty}-${turnPolicy}-${which}`,
        savedAt: '2026-09-13T00:00:00.000Z',
        continuation: { direction },
        presentationPins,
      });
      assert.deepEqual(
        authoritativeCheckpoint(run),
        prefix.checkpoint,
        'Saving cannot alter the live cut.',
      );
    }
  }
  function to(direction, target) {
    const key = ['left', 'right'].includes(direction) ? 'x' : 'y';
    const sign = ['right', 'down'].includes(direction) ? 1 : -1;
    let ticks = 0;
    while (sign * (target - run.player[key]) > 1e-6 && !finished()) {
      assert.ok(++ticks <= 6000, `Blocked route: ${direction} to ${target}.`);
      tick(direction);
      // An ordinary stop then fresh direction acknowledges the capture stop.
      if (!finished() && run.events.some((e) => e.type === 'capture.stopped')) tick();
    }
  }
  function wait(predicate) {
    let ticks = 0;
    while (!predicate() && !finished()) {
      assert.ok(++ticks <= 6000, 'Finite wait for a visible encounter phase.');
      tick();
    }
  }
  if (which === 'court-upper') {
    tick(null, { action: true });
    to('right', 34.5);
    to('up', 0.5);
    to('right', 45.5);
    to('down', 35.5);
  }
  if (which === 'court-lower') {
    to('down', 35.5);
    to('right', 46.5);
    to('up', 0.5);
  }
  if (which === 'yard-field') {
    tick(null, { pickup: true });
    to('up', 30.5);
    tick('up', { action: true });
    to('up', 0.5);
  }
  if (which === 'yard-rim') {
    to('right', 71.5);
    to('up', 26.5);
    to('left', 28.5);
    to('up', 0.5);
  }
  if (which === 'court-blocked') {
    tick(null, { action: true });
    to('right', 34.5);
    while (run.lives === level.rules.lives && !finished()) tick('down');
  }
  if (['yard-empty', 'yard-early'].includes(which)) {
    if (which === 'yard-early') {
      tick(null, { pickup: true });
      tick(null, { action: true });
    }
    to('up', 30.5);
    if (which === 'yard-empty') tick('up', { action: true });
    while (run.lives === level.rules.lives && !finished()) tick('up');
  }
  if (which.startsWith('boss')) {
    const bandRoute = which !== 'boss-rim',
      x = bandRoute ? 30.5 : 20.5;
    to('left', x);
    wait(() => run.encounter.phase === 'rest');
    if (which === 'boss-scout-band') {
      while (run.lives === level.rules.lives && !finished()) tick('up');
    } else {
      to('up', 0.5);
      to('down', bandRoute ? 18.5 : 32.5);
      const open = () => run.encounter.stage === 'exposed' && run.encounter.phase === 'open';
      if (which === 'boss-early') {
        to('right', x + 5);
        to('down', 22.5);
        to('left', x);
      } else {
        if (which === 'boss-recovered') {
          wait(() => run.encounter.stage === 'exposed' && run.encounter.phase === 'warning');
          to('right', x + 1);
          while (run.lives === level.rules.lives && !finished()) tick();
          wait(() => run.status === 'running');
          to('left', x);
          to('up', 18.5);
          // Wait for a complete new opening, not the end of one during recovery.
          wait(() => !open());
        }
        wait(open);
        if (which === 'boss-missed') {
          wait(() => !open());
          wait(open);
        }
        const short = which === 'boss-short';
        to('right', x + (short ? 2 : 8));
        to('down', short ? 20.5 : bandRoute ? 24.5 : 34.5);
        to('left', x);
      }
    }
  }
  const expected = getSummary(run),
    checkpoint = authoritativeCheckpoint(run);
  const failedControl = ['court-blocked', 'yard-empty', 'yard-early', 'boss-scout-band'].includes(
    which,
  );
  const closureControl = ['boss-short', 'boss-early'].includes(which);
  assert.equal(run.status, failedControl ? 'respawning' : closureControl ? 'running' : 'won');
  assert.equal(
    run.lives,
    level.rules.lives - (failedControl || which === 'boss-recovered' ? 1 : 0),
  );
  if (failedControl) assert.equal(metrics.eventCounts['player.failed'], 1);
  if (closureControl) {
    assert.equal(run.encounter.stage, 'exposed');
    assert.equal(run.encounter.phase, which === 'boss-short' ? 'open' : 'warning');
    assert.ok(expected.score > 0 && run.objectives.filter((o) => o.captured).length === 1);
  }
  if (which === 'court-upper') assert.ok(metrics.scanTicks > 0 && metrics.pressureTicks > 0);
  if (which === 'court-lower') assert.equal(metrics.scanTicks, 0);
  if (which === 'yard-field') assert.ok(metrics.stunnedEnemyTicks > 0 && metrics.fieldTicks > 0);
  if (which === 'yard-empty') assert.ok(metrics.eventCounts['ability.rejected'] > 0);
  if (which === 'boss-scout-band') assert.ok(metrics.slowedTicks > 0 && !metrics.resistantTicks);
  if (which === 'boss-fiber') assert.ok(metrics.resistantTicks > 0 && !metrics.slowedTicks);
  assert.ok(saved && prefix.player.cutting, 'Every context contains a real unfinished cut.');
  const replay = exportReplay(recorder, run),
    verified = verifyReplay(replay);
  assert.equal(verified.match, true);
  assert.deepEqual(authoritativeCheckpoint(verified.state), checkpoint);
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
  assert.deepEqual(restored.session.presentationPins, saved.presentationPins);
  let consumed = 0;
  for (const segment of replay.segments) {
    assert.equal(segment.releaseBefore, false);
    for (let i = 0; i < segment.ticks; i++) {
      if (++consumed <= prefix.tick) continue;
      recordInput(restored.recorder, segment.input);
      stepRun(restored.run, segment.input, FIXED_DT);
    }
  }
  assert.deepEqual(authoritativeCheckpoint(restored.run), checkpoint);
  assert.deepEqual(exportReplay(restored.recorder, restored.run), replay);
  assert.equal(JSON.stringify(saved), raw);
  return {
    id: `${context.difficulty}/${turnPolicy}/${which}`,
    route: which,
    difficulty: context.difficulty,
    executionKey: context.executionKey,
    authoredKey: context.baseCampaignKey,
    setup,
    expected,
    checkpoint,
    metrics,
    segments: replay.segments,
    replaySha256: digest(replay),
    savedPrefix: {
      ...prefix,
      format: saved.format,
      continuation: saved.continuation,
      presentationPins: saved.presentationPins,
      bytes: Buffer.byteLength(raw),
      sha256: digest(raw),
      restoredFinalCheckpoint: authoritativeCheckpoint(restored.run),
    },
  };
}

/** Explicit candidates are owned before awaits; only the fixed source can record. */
export async function verifySentinelCircuit({ candidate, record = false } = {}) {
  assert.equal(typeof record, 'boolean');
  assert.ok(
    !(candidate !== undefined && record),
    'An explicit candidate cannot record source proofs.',
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
    exactKeys(owned, ['pack', 'proof'], 'Sentinel request');
    assert.ok(
      plainObject(owned.pack) && plainObject(owned.proof),
      'Explicit candidate requires pack and proof.',
    );
  }
  const source = await buildSentinelCircuit();
  if (owned) assert.deepEqual(owned.pack, source.pack, 'Exact new source pack required.');
  const pack = source.pack;
  const expected = owned
    ? owned.proof
    : record
      ? null
      : JSON.parse(await ordinaryFile(PROOF, 8 * 1024 * 1024));
  const header = {
    format: 'revealline-sentinel-circuit-proof.v1',
    sources: SOURCE_PINS,
    packSha256: digest(pack),
    scenarioSha256: source.scenarios.map(digest),
  };
  if (expected) {
    exactKeys(expected, [...Object.keys(header), 'routes', 'summary'], 'Sentinel proof');
    for (const key of Object.keys(header)) assert.deepEqual(expected[key], header[key]);
    assert.deepEqual(
      expected.routes?.map((r) => r.id),
      ['standard', 'gentle'].flatMap((d) =>
        ['immediate', 'grid-center'].flatMap((t) => ROUTES.map((r) => `${d}/${t}/${r}`)),
      ),
      'Exact difficulty, turn-policy and control coverage required.',
    );
  }
  const catalog = createExecutionCatalog([resolvePackCampaign(pack, 'sentinel-circuit')]);
  const identities = createMediaIdentityCatalog(catalog),
    routes = [];
  for (const context of catalog.entries)
    for (const policy of ['immediate', 'grid-center'])
      for (const route of ROUTES)
        routes.push(await execute(pack, context, identities, route, policy));
  const summary = {
    contexts: routes.length,
    wins: routes.filter((r) => r.expected.won).length,
    lifeLossControls: routes.filter((r) => r.expected.status === 'respawning').length,
    unfinishedClosureControls: routes.filter((r) => r.expected.status === 'running').length,
    ticks: routes.reduce((n, r) => n + r.expected.tick, 0),
    savedContinuations: routes.length,
    boundaries:
      'Real core inputs, replay and serialized v4 continuation. No browser, human balance, new art, host registration or public delivery.',
  };
  const proof = { ...header, routes, summary };
  if (expected)
    assert.deepEqual(
      proof,
      expected,
      'Exact recorded routes/outcomes/metrics/continuations required.',
    );
  if (record) await writeProof(PROOF, proof);
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
      (await verifySentinelCircuit({ record: args[0] === '--record' })).summary,
      null,
      2,
    ),
  );
}
