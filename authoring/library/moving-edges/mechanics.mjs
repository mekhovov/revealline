import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { buildMovingEdges, IDS } from './build.mjs';
import { drive, ownCommands } from './controls.mjs';
import { digest, ordinaryFile } from '../sentinel-circuit/files.mjs';
import { boundedJSON, exactKeys, plainObject } from '../../../game/data-json.mjs';
import { resolvePackCampaign } from '../../../game/packs.mjs';
import { createExecutionCatalog } from '../../../game/campaign-contexts.mjs';
import { createMediaIdentityCatalog } from '../../../game/media-library.mjs';
import {
  snapshotFlightPresentationPins,
  FLIGHT_MEDIA_PINS_FORMAT,
} from '../../../game/flight-media-pins.mjs';
import { stepRun, FIXED_DT } from '../../../game/core/index.mjs';
import {
  authoritativeCheckpoint,
  verifyReplay,
  recordInput,
  exportReplay,
} from '../../../game/replay.mjs';
import { suspendSession, restoreSession, SESSION_STORAGE_BYTES } from '../../../game/sessions.mjs';

const ORDINARY_SHA = '19d9be49c5db2b1b5235213896b0f100e6cc48988a00566aea68a65ef7e152a6';
const PROOF = new URL('./mechanics-proof.json', import.meta.url);
const KINDS = [
  'recovered-win',
  'game-over',
  'warning-return',
  'life-win',
  'slow-expiry',
  'actor-loss',
];
const TERMINAL = ['won', 'lost'];

/** Authenticate the retained ordinary proof without replaying its 24 passing routes. */
export async function readMechanicsInputs() {
  const source = await buildMovingEdges();
  const raw = await ordinaryFile(new URL('./routes.json', import.meta.url), 8 * 1024 * 1024);
  assert.equal(digest(raw), ORDINARY_SHA, 'Retain the exact already-qualified ordinary proof.');
  const ordinary = JSON.parse(raw);
  for (const [file, hash] of Object.entries(ordinary.content))
    assert.equal(digest(await readFile(new URL(file, import.meta.url))), hash);
  assert.deepEqual(ordinary.inputPins, source.inputPins);
  assert.equal(ordinary.packSha256, digest(source.pack));
  assert.equal(ordinary.summary.ordinaryWins, 24);
  assert.equal(ordinary.summary.nonemptySavedSuffixes, 208);
  const cases = JSON.parse(
    await ordinaryFile(new URL('./mechanic-cases.json', import.meta.url), 128 * 1024),
  );
  exactKeys(cases, ['format', 'classId', 'seed', 'turnPolicies', 'cases'], 'Mechanic cases');
  assert.equal(cases.format, 'revealline-moving-edges-mechanic-cases.v1');
  assert.equal(cases.classId, 'scout');
  assert.equal(cases.seed, 1);
  assert.deepEqual(cases.turnPolicies, ['immediate', 'grid-center']);
  assert.equal(cases.cases.length, 26);
  assert.equal(new Set(cases.cases.map((c) => c.id)).size, 26);
  for (const c of cases.cases) {
    exactKeys(
      c,
      [
        'id',
        'kind',
        'difficulty',
        'levelId',
        'commands',
        'status',
        'livesLost',
        'actorId',
        'cause',
      ],
      'Mechanic case',
    );
    assert.ok(KINDS.includes(c.kind) && IDS.includes(c.levelId));
    assert.ok(['standard', 'gentle'].includes(c.difficulty));
    assert.ok(['running', 'won', 'lost'].includes(c.status));
    assert.ok(Number.isSafeInteger(c.livesLost) && c.livesLost >= 0 && c.livesLost <= 5);
    ownCommands(c.commands);
  }
  // Ordinary erosion/rover/topology facts come from that pinned proof, not a new run.
  const observations = ordinary.routes.map((r) => ({
    id: r.id,
    captureStops: r.metrics.stopChecks,
    captures: r.metrics.captures.length,
    actorModes: r.metrics.actorModes,
    events: r.metrics.events,
    erosion: r.metrics.erosion,
    recaptures: r.metrics.recaptures,
    savedBoundaryLabels: r.saved.map((s) => s.label),
  }));
  for (const r of observations) {
    assert.ok(r.captureStops > 0);
    if (r.id.includes('terrace-stitch')) {
      assert.equal(r.events['rover.warning'], 1);
      assert.equal(r.events['rover.activated'], 1);
      assert.ok(r.actorModes['terrace-contour'].patrolling > 0);
    }
    if (r.id.includes('survey-wheel')) {
      for (const id of ['wheel-clockwise', 'wheel-counterclockwise'])
        assert.ok(r.actorModes[id].patrolling > 0);
    }
    if (r.id.includes('breakwater-return') && r.id.endsWith('/north')) {
      assert.ok(r.erosion.length > 0 && r.recaptures.length > 0);
      assert.ok(r.savedBoundaryLabels.includes('recapture'));
      assert.ok(r.savedBoundaryLabels.some((s) => s.startsWith('erosion.warning-')));
    }
  }
  return { source, cases, observations };
}

async function executeCase(source, context, identities, c, turnPolicy) {
  const level = context.campaign.levels.find((l) => l.id === c.levelId);
  assert.ok(level);
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
  const boundaries = new Map(),
    observations = [];
  let warning = null,
    returnDistance = 0,
    previousPlayer = null;
  let captures = 0,
    collectedSlow = null;
  const result = drive(level, source.pack.classRecipes, turnPolicy, c.commands, {
    onTick({ run, recorder, input }) {
      const labels = [];
      if (run.player.cutting && run.trail.length >= 6) labels.push('unfinished');
      if (warning && previousPlayer && !warning.closed)
        returnDistance += Math.hypot(
          run.player.x - previousPlayer.x,
          run.player.y - previousPlayer.y,
        );
      for (const e of run.events) {
        if (e.type === 'cells.claimed' && ++captures <= 2) labels.push(`capture-${captures}`);
        if (
          [
            'player.failed',
            'player.respawned',
            'rover.warning',
            'rover.activated',
            'pressure.warning',
            'pressure.committed',
            'pressure.cancelled',
            'pressure.ended',
            'erosion.warning',
            'cells.eroded',
            'powerup.collected',
          ].includes(e.type)
        ) {
          labels.push(`${e.type}-${e.id ?? e.actorId ?? 'player'}`);
          observations.push({ ...structuredClone(e), livesLost: run.classic.livesLost });
        }
        if (e.type === 'pressure.warning' && !warning)
          warning = {
            tick: run.tick,
            warningUntil: e.warningUntil,
            player: { x: run.player.x, y: run.player.y },
            closed: null,
          };
        if (
          e.type === 'pressure.cancelled' &&
          e.reason === 'trail-closed' &&
          warning &&
          !warning.closed
        )
          warning.closed = {
            tick: run.tick,
            player: { x: run.player.x, y: run.player.y },
            travelledCells: returnDistance,
          };
        if (e.type === 'powerup.collected' && e.kind === 'enemy-slow')
          collectedSlow = structuredClone(e);
      }
      if (collectedSlow) {
        const effect = run.classic.effects['enemy-slow'];
        if (run.tick === collectedSlow.untilTick - 1 || run.tick === collectedSlow.untilTick) {
          labels.push(run.tick === collectedSlow.untilTick ? 'slow-expiry' : 'slow-last-active');
          observations.push({
            type: 'observed.slow-effect',
            tick: run.tick,
            actorTick: run.classic.actorTick,
            effect: structuredClone(effect),
            active: run.tick >= effect.from && run.tick < effect.until,
          });
        }
      }
      previousPlayer = { x: run.player.x, y: run.player.y };
      if (TERMINAL.includes(run.status)) return;
      for (const label of labels)
        if (!boundaries.has(label)) {
          const checkpoint = authoritativeCheckpoint(run);
          const session = suspendSession({
            run,
            recorder,
            campaignKey: context.executionKey,
            themeId: 'fpv',
            bodyId: source.pack.themes[0].player,
            runId: `me-${c.id}-${turnPolicy}`,
            savedAt: '2026-09-14T00:00:00.000Z',
            continuation: { direction: input.direction },
            presentationPins: pins,
          });
          assert.deepEqual(
            authoritativeCheckpoint(run),
            checkpoint,
            'Saving cannot alter a mechanic.',
          );
          boundaries.set(label, { label, tick: run.tick, checkpoint, session });
        }
    },
  });
  const { run, replay, expected, metrics } = result;
  assert.equal(run.status, c.status, c.id);
  assert.equal(run.classic.livesLost, c.livesLost, c.id);
  assert.equal(run.classId, 'scout');
  assert.equal(run.activeClassId, 'scout');
  const failures = observations.filter((e) => e.type === 'player.failed');
  assert.equal(failures.length, c.livesLost);
  for (const e of failures) {
    assert.equal(e.cause, c.cause, `${c.id}: actual failure cause`);
    assert.equal(e.actorId, c.actorId, `${c.id}: actual responsible actor`);
  }
  if (c.kind === 'game-over') {
    assert.equal(run.lives, 0);
    assert.equal(c.livesLost, c.difficulty === 'gentle' ? 5 : 3);
    assert.equal(metrics.events['player.respawned'], c.livesLost - 1);
  }
  if (c.kind === 'recovered-win' || c.kind === 'life-win') {
    assert.equal(expected.won, true);
    assert.equal(expected.livesLost, 1);
    assert.notEqual(expected.medal, 'gold', 'An extra life cannot erase a loss for clean Gold.');
  }
  if (c.kind === 'life-win') {
    const pickup = observations.filter((e) => e.type === 'powerup.collected');
    assert.equal(pickup.length, 1);
    assert.equal(pickup[0].id, 'terrace-life');
    assert.equal(pickup[0].gain, 1);
    assert.equal(pickup[0].livesLost, 1);
    assert.equal(run.lives, c.difficulty === 'gentle' ? 5 : 3);
  } else if (c.kind !== 'slow-expiry') assert.equal(metrics.events['powerup.collected'] ?? 0, 0);
  if (c.kind === 'warning-return') {
    assert.ok(warning?.closed && warning.closed.tick < warning.warningUntil);
    assert.ok(warning.closed.travelledCells > 0 && warning.closed.travelledCells < 20);
    assert.equal(metrics.events['pressure.committed'] ?? 0, 0, 'Escape cancels before commitment.');
    assert.ok(
      observations.some((e) => e.type === 'pressure.cancelled' && e.reason === 'trail-closed'),
    );
  }
  if (c.actorId === 'terrace-rover') {
    const activation = observations.find((e) => e.type === 'rover.activated');
    const warned = observations.find((e) => e.type === 'rover.warning');
    assert.ok(
      activation &&
        warned &&
        activation.tick === warned.activationTick &&
        activation.tick < failures[0].tick,
    );
  }
  if (c.kind === 'actor-loss' && c.actorId === 'wheel-interceptor') {
    assert.ok(observations.some((e) => e.type === 'pressure.committed'));
    assert.ok(metrics.pressureTicks.cooldown > 0);
  }
  if (c.kind === 'slow-expiry') {
    assert.ok(collectedSlow && collectedSlow.untilTick - collectedSlow.activationTick === 720);
    assert.deepEqual(
      observations.filter((e) => e.type === 'observed.slow-effect').map((e) => e.active),
      [true, false],
    );
    assert.ok(boundaries.has('slow-last-active') && boundaries.has('slow-expiry'));
  }
  assert.equal(verifyReplay(replay).match, true);
  const checkpoint = authoritativeCheckpoint(run),
    saved = [];
  for (const b of boundaries.values()) {
    const raw = JSON.stringify(b.session);
    assert.ok(Buffer.byteLength(raw) <= SESSION_STORAGE_BYTES);
    const restored = await restoreSession(JSON.parse(raw), {
      campaign: context.campaign,
      campaignKey: context.executionKey,
      mediaIdentityCatalog: identities,
    });
    assert.deepEqual(authoritativeCheckpoint(restored.run), b.checkpoint);
    assert.deepEqual(restored.session.presentationPins, pins);
    assert.deepEqual(restored.session.continuation, b.session.continuation);
    let consumed = 0;
    for (const segment of replay.segments) {
      assert.equal(segment.releaseBefore, false);
      for (let n = 0; n < segment.ticks; n++) {
        if (++consumed <= b.tick) continue;
        recordInput(restored.recorder, segment.input);
        stepRun(restored.run, segment.input, FIXED_DT);
      }
    }
    assert.deepEqual(authoritativeCheckpoint(restored.run), checkpoint);
    assert.deepEqual(exportReplay(restored.recorder, restored.run), replay);
    assert.equal(JSON.stringify(b.session), raw);
    saved.push({
      label: b.label,
      tick: b.tick,
      suffixTicks: run.tick - b.tick,
      bytes: Buffer.byteLength(raw),
      sessionSha256: digest(raw),
      checkpointSha256: digest(b.checkpoint),
      finalCheckpointSha256: digest(checkpoint),
      continuation: b.session.continuation,
      presentationPins: pins,
      exactRestoredSuffix: true,
    });
  }
  assert.ok(
    saved.some((s) => s.suffixTicks > 0),
    'Every case requires a nonempty saved suffix.',
  );
  if (c.livesLost) assert.ok(saved.some((s) => s.label.startsWith('player.failed-')));
  const { notable, ...counts } = metrics;
  return {
    id: `${c.id}/${turnPolicy}`,
    kind: c.kind,
    difficulty: c.difficulty,
    turnPolicy,
    levelId: c.levelId,
    executionKey: context.executionKey,
    classId: 'scout',
    expected,
    observations,
    warningReturn: c.kind === 'warning-return' ? warning : null,
    metrics: { ...counts, notableSha256: digest(notable) },
    checkpointSha256: digest(checkpoint),
    replaySha256: digest(replay),
    segments: replay.segments,
    saved,
  };
}

/** Replay only the separate finite mechanic controls; ordinary proof remains byte-exact. */
export async function verifyMovingEdgesMechanics({ candidate, record = false } = {}) {
  assert.equal(typeof record, 'boolean');
  assert.ok(!(record && candidate !== undefined), 'Explicit candidate cannot record.');
  assert.ok(candidate === undefined || plainObject(candidate), 'Candidate must be an object.');
  const expected =
    candidate === undefined
      ? record
        ? null
        : JSON.parse(await ordinaryFile(PROOF, 8 * 1024 * 1024))
      : boundedJSON(candidate, {
          maxBytes: 8 * 1024 * 1024,
          maxNodes: 500000,
          maxDepth: 28,
          maxArray: 10000,
          maxString: 16384,
        });
  const { source, cases, observations } = await readMechanicsInputs();
  const content = {};
  for (const file of ['mechanics.mjs', 'mechanic-cases.json'])
    content[file] = digest(await readFile(new URL(file, import.meta.url)));
  const header = {
    format: 'revealline-moving-edges-mechanics-proof.v1',
    ordinaryProofSha256: ORDINARY_SHA,
    content,
    inputPins: source.inputPins,
    packSha256: digest(source.pack),
    ordinaryObservations: observations,
  };
  const ids = cases.cases.flatMap((c) => cases.turnPolicies.map((t) => `${c.id}/${t}`));
  if (expected) {
    exactKeys(expected, [...Object.keys(header), 'cases', 'summary'], 'Mechanics proof');
    for (const k of Object.keys(header))
      assert.deepEqual(expected[k], header[k], `Exact ${k} required.`);
    assert.deepEqual(
      expected.cases?.map((c) => c.id),
      ids,
      'Exact52 mechanic contexts required.',
    );
  }
  const catalog = createExecutionCatalog([resolvePackCampaign(source.pack, 'moving-edges')]);
  const identities = createMediaIdentityCatalog(catalog),
    results = [];
  for (const c of cases.cases)
    for (const policy of cases.turnPolicies) {
      results.push(
        await executeCase(
          source,
          catalog.entries.find((e) => e.difficulty === c.difficulty),
          identities,
          c,
          policy,
        ),
      );
    }
  const saved = results.flatMap((r) => r.saved);
  const proof = {
    ...header,
    cases: results,
    summary: {
      contexts: results.length,
      kinds: Object.fromEntries(KINDS.map((k) => [k, results.filter((r) => r.kind === k).length])),
      ticks: results.reduce((n, r) => n + r.expected.tick, 0),
      savedChecks: saved.length,
      nonemptySavedSuffixes: saved.filter((s) => s.suffixTicks > 0).length,
      endpointRestores: saved.filter((s) => s.suffixTicks === 0).length,
      replayedClasses: ['scout'],
      ordinaryContextsReexecuted: 0,
      limits:
        'Finite core/input/replay/session controls for Scout only. Timed waiting belongs only to negative contact or fixed bonus-expiry demonstrations, never ordinary wins. Prior24 ordinary routes remain pinned separately. No other-class, native, art, production approval or release qualification.',
    },
  };
  if (expected)
    assert.deepEqual(
      proof,
      expected,
      'Exact actual mechanic outcomes and saved suffixes required.',
    );
  if (record) await writeFile(PROOF, JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
  return proof;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  assert.ok(args.length === 0 || (args.length === 1 && args[0] === '--record'));
  console.log(
    JSON.stringify(
      (await verifyMovingEdgesMechanics({ record: args[0] === '--record' })).summary,
      null,
      2,
    ),
  );
}
