import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveNativeSurvivalRecording } from '../../scripts/qualify-survival-native.mjs';
import { OVERFLIGHT_BATTLEFIELDS } from '../overflight/battlefields.mjs';
import { createOverflightRun, startOverflight } from '../overflight/core.mjs';
import { survivalDemoInventory, survivalDemoCompiled } from '../demo-modes/survival-catalog.mjs';
import { createSurvivalDemoAdapter, attachSurvivalDemoInput } from '../demo-modes/survival.mjs';
import {
  prepareSurvivalDemoPlayer,
  createSurvivalDemoPractice,
  verifySurvivalDemo,
  survivalDemoStateIdentity,
  SURVIVAL_DEMO_CHECKPOINT_TICKS,
} from '../demo-modes/survival-replay.mjs';

const inventory = survivalDemoInventory();
const readDefaultProof = (entry) =>
  readFile(
    new URL(`../demo-data/survival/${entry.levelId}.replay.json`, import.meta.url),
    'utf8',
  ).then(JSON.parse);

const verifiedProofs = new Map();
const readProof = async (entry) => {
  if (!verifiedProofs.has(entry.id))
    verifiedProofs.set(
      entry.id,
      resolveNativeSurvivalRecording(entry).then(({ recording }) => recording),
    );
  return structuredClone(await verifiedProofs.get(entry.id));
};

test('Survival sources lazily cover exactly the ordinary authored mission inventory', async () => {
  let requests = 0;
  const adapter = createSurvivalDemoAdapter({
    fetch() {
      requests++;
      throw new Error('Unexpected eager load');
    },
  });
  const sources = await adapter.enumerateSources();
  assert.equal(requests, 0);
  assert.deepEqual(
    sources.map((entry) => entry.levelId),
    OVERFLIGHT_BATTLEFIELDS.map((entry) => entry.id),
  );
  assert.equal(new Set(sources.map((entry) => entry.id)).size, sources.length);
  for (const source of sources) {
    const proof = await readDefaultProof(source);
    assert.equal(source.modeId, 'survival');
    assert.equal(source.kind, 'replay');
    assert.equal(source.variantId, 'standard');
    assert.equal(proof.contentIdentity, survivalDemoCompiled(source).projectIdentity);
    assert.ok(['won', 'lost'].includes(proof.outcome));
    assert.ok(
      proof.summary.stats.kills > 0 &&
        proof.summary.stats.xpCollected > 0 &&
        proof.summary.stats.upgradesChosen > 0,
    );
    assert.equal(
      proof.checkpoints.length,
      Math.floor(proof.ticks / SURVIVAL_DEMO_CHECKPOINT_TICKS),
    );
    assert.equal(new URL(source.launchURL).searchParams.get('layout'), source.levelId);
  }
});

test('verified native playback pauses, forks exactly, and practice cannot mutate the performance', async () => {
  const proof = await readProof(inventory[0]);
  const player = await prepareSurvivalDemoPlayer(inventory[0], proof, { yieldEvery: Infinity });
  assert.equal(player.phase, 'paused');
  player.play();
  while (player.state.tick < 600) player.advance(0.25);
  player.pause();
  const before = survivalDemoStateIdentity(player.state),
    tick = player.state.tick;
  player.advance(0.25);
  assert.equal(player.state.tick, tick);
  const fork = await player.forkForPractice();
  assert.equal(survivalDemoStateIdentity(fork.run), before);
  assert.notEqual(fork.run, player.state);
  const practice = createSurvivalDemoPractice(fork);
  practice.start({ x: 1, y: 0, boost: true });
  practice.advance(0.25);
  assert.equal(survivalDemoStateIdentity(player.state), before);
  assert.equal(practice.state.tick, tick + 15);
  practice.pause();
  practice.advance(0.25);
  assert.equal(practice.state.tick, tick + 15);
  practice.start();
  practice.advance(1);
  assert.equal(practice.phase, 'paused');
  await practice.dispose();
  await player.dispose();
  assert.equal(player.phase, 'disposed');
});

test('sparse diagnostics report the first differing checkpoint and reject stale content', async () => {
  const proof = await readProof(inventory[0]);
  proof.checkpoints[0][1] = '0000000000000000';
  await assert.rejects(
    verifySurvivalDemo(inventory[0], proof, { yieldEvery: Infinity }),
    (error) => error.tick === 300 && error.code === 'demo-content-mismatch',
  );
  proof.contentIdentity = 'stale';
  await assert.rejects(verifySurvivalDemo(inventory[0], proof), /identity or shape/);
});

test('cancelled preparation cannot adopt a Survival player', async () => {
  const controller = new AbortController();
  controller.abort(new DOMException('Cancelled', 'AbortError'));
  await assert.rejects(
    prepareSurvivalDemoPlayer(inventory[0], await readProof(inventory[0]), {
      signal: controller.signal,
    }),
    { name: 'AbortError' },
  );
});

test('one prefetched payload can fall back only to another fully verified runtime performance', async () => {
  const original = await readProof(inventory[0]);
  const requests = [];
  const preparation = [];
  const adapter = createSurvivalDemoAdapter({
    fetch: async (url) => {
      requests.push(url.pathname);
      return {
        ok: true,
        text: async () =>
          requests.length === 1 ? '{ corrupt recording' : JSON.stringify(original),
      };
    },
  });
  const [source] = adapter.enumerateSources();
  const payload = await source.loadPayload();
  assert.equal(requests.length, 1);
  const player = await source.create({
    payload,
    reportPreparation: (stage, details) => preparation.push({ stage, details }),
  });
  assert.equal(requests.length, 2);
  assert.equal(player.state.tick, 0);
  assert.equal(player.phase, 'paused');
  assert.equal(preparation.filter((row) => row.stage === 'candidate').length, 2);
  assert.equal(preparation.find((row) => row.stage === 'candidate').details.prefetched, true);
  assert.equal(
    preparation.find((row) => row.stage === 'candidate-failed').details.code,
    'demo-content-mismatch',
  );
  assert.equal(
    preparation.findLast((row) => row.stage === 'progress').details.tick,
    original.ticks,
  );
  assert.equal(preparation.at(-1).stage, 'candidate-verified');
  await player.dispose();
});

test('a failed preparation diagnostic observer cannot alter native verification', async () => {
  const proof = await readProof(inventory[0]);
  const summary = await verifySurvivalDemo(inventory[0], proof, {
    yieldEvery: Infinity,
    reportPreparation() {
      throw new Error('Unavailable diagnostics');
    },
  });
  assert.equal(summary.tick, proof.ticks);
  assert.equal(summary.outcome, proof.outcome);
});

for (const prefetch of [false, true])
  test(`the browser-preferred Survival recording is strictly checked before fallback${prefetch ? ' with prefetch' : ''}`, async () => {
    const proof = await readProof(inventory[0]);
    const damaged = structuredClone(proof);
    damaged.checkpoints[0][1] = '0000000000000000';
    for (const badPreferred of [false, true]) {
      const requested = [];
      const adapter = createSurvivalDemoAdapter({
        engineHint: 'webkit', // A hint is not trusted: these native checks run in Node.
        fetch: async (url) => {
          requested.push(url.pathname);
          const preferred = url.pathname.endsWith('.webkit.replay.json');
          return {
            ok: true,
            text: async () => JSON.stringify(preferred && badPreferred ? damaged : proof),
          };
        },
      });
      const [source] = adapter.enumerateSources();
      const payload = prefetch ? await source.loadPayload() : undefined;
      const player = await source.create({ payload });
      try {
        assert.ok(requested[0].endsWith('.webkit.replay.json'));
        assert.equal(requested.length, badPreferred ? 2 : 1);
        if (badPreferred) assert.ok(requested[1].endsWith(`/${source.levelId}.replay.json`));
        assert.equal(player.phase, 'paused');
        assert.equal(player.state.tick, 0);
      } finally {
        await player.dispose();
      }
    }
  });

class Target {
  listeners = new Map();
  addEventListener(name, listener) {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]);
  }
  removeEventListener(name, listener) {
    this.listeners.set(
      name,
      (this.listeners.get(name) ?? []).filter((item) => item !== listener),
    );
  }
  send(name, event = {}) {
    for (const listener of this.listeners.get(name) ?? [])
      listener({ preventDefault() {}, stopImmediatePropagation() {}, ...event });
  }
}

test('fresh keyboard or neutral-then-moved controller input is required for takeover', () => {
  const window = new Target(),
    document = new Target();
  document.defaultView = window;
  document.hasFocus = () => true;
  document.hidden = false;
  const root = { ownerDocument: document };
  const intents = [];
  const input = attachSurvivalDemoInput({
    root,
    practice: () => null,
    onTakeover: (intent) => intents.push(intent),
  });
  input.controller({ flight: { x: 0.7, y: 0 } });
  input.controller({ flight: { x: 0.1, y: 0.1 } });
  assert.equal(intents.length, 0);
  input.controller({ flight: { x: 0.7, y: 0 } });
  assert.equal(intents.length, 1);
  assert.equal(intents[0].x, 0.7);
  input.dispose();
  assert.ok([...window.listeners.values()].every((items) => !items.length));
  assert.ok([...document.listeners.values()].every((items) => !items.length));
  const fresh = attachSurvivalDemoInput({
    root,
    practice: () => null,
    onTakeover: (intent) => intents.push(intent),
  });
  window.send('keydown', { code: 'KeyW', repeat: true });
  assert.equal(intents.length, 1);
  window.send('keydown', { code: 'KeyW', repeat: false });
  assert.equal(intents.length, 2);
  assert.equal(intents[1].y, -1);
  fresh.dispose();
});

test('fresh movement resumes paused native practice through the shared host', () => {
  const window = new Target(),
    document = new Target();
  document.defaultView = window;
  document.hasFocus = () => true;
  document.hidden = false;
  const root = { ownerDocument: document };
  const resumed = [];
  const session = { phase: 'paused', steer() {} };
  const input = attachSurvivalDemoInput({
    root,
    practice: () => session,
    onResume: (intent) => resumed.push(intent),
    onTakeover() {
      throw Error('Already practicing');
    },
  });
  window.send('keydown', { code: 'ArrowRight', repeat: true });
  assert.equal(resumed.length, 0);
  window.send('keydown', { code: 'ArrowRight', repeat: false });
  assert.equal(resumed.length, 1);
  assert.equal(resumed[0].x, 1);
  input.clear();
  input.controller({ flight: { x: 0.7, y: 0 } });
  assert.equal(resumed.length, 1);
  input.controller({ flight: { x: 0, y: 0 } });
  input.controller({ flight: { x: 0.7, y: 0 } });
  assert.equal(resumed.length, 2);
  input.dispose();
});

function handoffFixture({ delayed = false, duringHandoff = () => {} } = {}) {
  const window = new Target(),
    document = new Target(),
    canvas = new Target();
  document.defaultView = window;
  document.hasFocus = () => true;
  document.hidden = false;
  const steered = [],
    started = [];
  let session = null,
    finish = () => {};
  const input = attachSurvivalDemoInput({
    root: { ownerDocument: document },
    canvas,
    practice: () => session,
    onTakeover(intent) {
      input.clear(); // The shared host interrupts watching synchronously.
      duringHandoff({ window, document });
      const adopt = () => {
        session = {
          phase: 'playing',
          steer: (next) => steered.push({ ...next }),
          pause() {
            this.phase = 'paused';
          },
        };
        started.push({ ...intent });
      };
      if (!delayed) return adopt();
      return new Promise((resolve) => {
        finish = () => {
          adopt();
          resolve();
        };
      });
    },
  });
  return { window, document, canvas, input, steered, started, finish: () => finish() };
}

test('the initiating key remains owned through host handoff and its release stops movement', async () => {
  const fixture = handoffFixture();
  fixture.window.send('keydown', { code: 'KeyD', repeat: false });
  assert.deepEqual(fixture.started, [{ x: 1, y: 0, boost: false }]);
  fixture.window.send('keydown', { code: 'KeyD', repeat: true });
  assert.equal(fixture.steered.length, 0);
  await Promise.resolve();
  fixture.window.send('keyup', { code: 'KeyD' });
  assert.deepEqual(fixture.steered, [{ x: 0, y: 0, boost: false }]);
  fixture.input.dispose();
});

test('a takeover touch keeps its origin through reconstruction and releases normally', async () => {
  const fixture = handoffFixture({ delayed: true });
  fixture.canvas.send('pointerdown', { pointerId: 7, clientX: 10, clientY: 20, button: 0 });
  fixture.window.send('pointermove', { pointerId: 7, clientX: 58, clientY: 20 });
  fixture.finish();
  await Promise.resolve();
  assert.deepEqual(fixture.started, [{ x: 1, y: 0 }]);
  fixture.window.send('pointermove', { pointerId: 7, clientX: 10, clientY: 68 });
  fixture.window.send('pointerup', { pointerId: 7 });
  assert.deepEqual(fixture.steered, [
    { x: 0, y: 1, boost: false },
    { x: 0, y: 0, boost: false },
  ]);
  fixture.input.dispose();
});

test('release during reconstruction updates movement and retains only the initiating action', async () => {
  const fixture = handoffFixture({ delayed: true });
  fixture.window.send('keydown', { code: 'Space', repeat: false });
  fixture.window.send('keydown', { code: 'KeyD', repeat: false });
  fixture.window.send('keyup', { code: 'KeyD' });
  fixture.window.send('keyup', { code: 'Space' });
  fixture.finish();
  await Promise.resolve();
  assert.deepEqual(fixture.started, [{ x: 0, y: 0, boost: true }]);
  assert.deepEqual(fixture.steered, []);
  fixture.window.send('keyup', { code: 'Space' });
  assert.deepEqual(fixture.steered, []);
  fixture.input.dispose();
});

test('foreground loss fully clears a handoff gesture even during the synchronous interrupt', () => {
  const fixture = handoffFixture({
    duringHandoff: ({ window }) => window.send('blur'),
  });
  fixture.window.send('keydown', { code: 'KeyD', repeat: false });
  assert.deepEqual(fixture.started, [{ x: 0, y: 0, boost: false }]);
  fixture.window.send('keyup', { code: 'KeyD' });
  assert.deepEqual(fixture.steered, []);
  fixture.canvas.send('pointerdown', { pointerId: 9, clientX: 0, clientY: 0, button: 0 });
  fixture.document.hidden = true;
  fixture.document.send('visibilitychange');
  const count = fixture.steered.length;
  fixture.document.hidden = false;
  fixture.window.send('pointermove', { pointerId: 9, clientX: 48, clientY: 0 });
  assert.equal(fixture.steered.length, count);
  fixture.input.controller({ flight: { x: 0.8, y: 0 } });
  assert.equal(fixture.steered.length, count);
  fixture.input.dispose();
});

test('practice consumes the initiating boost once despite controller samples before its first tick', async () => {
  const run = createOverflightRun(survivalDemoCompiled(inventory[0]));
  startOverflight(run);
  const practice = createSurvivalDemoPractice({ modeId: 'survival', run });
  practice.start({ x: 1, boost: true });
  practice.steer({ x: 1, boost: true });
  practice.advance(1 / 60);
  assert.equal(run.stats.boostsUsed, 1);
  for (let frame = 0; frame < 180; frame++) {
    practice.steer({ x: 1, boost: true });
    practice.advance(1 / 60);
  }
  assert.equal(run.stats.boostsUsed, 1, 'holding the action cannot retrigger after cooldown');
  practice.steer({ x: 1, boost: false });
  practice.steer({ x: 1, boost: true });
  practice.steer({ x: 1, boost: false });
  practice.advance(1 / 60);
  assert.equal(run.stats.boostsUsed, 2, 'a short fresh press survives release before the tick');
  await practice.dispose();
});
