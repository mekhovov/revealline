import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadBenchmarkCatalog } from '../../authoring/playable-benchmark/catalog.mjs';
import {
  createBenchmarkSession,
  createBenchmarkSelection,
} from '../../authoring/playable-benchmark/session.mjs';
import { resolveJourneyRequest } from '../content-design/default-entry.mjs';
import { FIXED_DT } from '../core/index.mjs';
import { acquireCandidatePicture, isCandidatePictureFor } from '../content-design/picture.mjs';
import { loadPreviewArtwork } from '../content-design/assets.mjs';
import { prepareBenchmarkScene } from '../../authoring/playable-benchmark/scene.mjs';
import {
  createReadyCue,
  createResultFocusCue,
  attachDeliberateButton,
} from '../../authoring/playable-benchmark/result-controls.mjs';
import { attachBenchmarkInput } from '../../authoring/playable-benchmark/controls.mjs';
import { installActorAppearanceTransport } from './helpers/actor-appearance-transport.mjs';
import { ACTOR_APPEARANCE_RELEASES } from '../presentation/actor-appearance-lease.mjs';

const catalog = await loadBenchmarkCatalog();
const manifest = (id) => catalog.entries.find((entry) => entry.id === id).manifest;
function play(session, segments) {
  session.start();
  for (const [ticks, direction] of segments)
    for (let tick = 0; tick < ticks; tick++)
      session.advance(direction ? { direction } : {}, FIXED_DT);
}

test('bounded cohort resolves exact current default Solo source identities and original pins', async () => {
  assert.equal(catalog.routeId, resolveJourneyRequest(new URLSearchParams(), { mode: 'solo' }));
  assert.match(catalog.sourceSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(
    catalog.entries.map((entry) => [entry.id, entry.manifest.simulationIdentity]),
    [
      ['first-return', 'fa30f146920d0226'],
      ['return-in-reserve', '333026ffd20dc1eb'],
      ['crossed-bands', '3964a7a5dada959d'],
    ],
  );
  for (const entry of catalog.entries) {
    const { background } = entry.manifest;
    const bytes = await readFile(new URL(`../${background.path}`, import.meta.url));
    assert.equal(bytes.length, background.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), background.sha256);
    assert.equal(background.review, 'candidate', 'source art approval is not promoted');
    assert.equal(entry.manifest.officialProgressEligible, false);
    assert.equal(entry.manifest.difficulty, 'standard');
    assert.equal(entry.manifest.mode, 'solo');
  }
});

test('real introductory capture wins and Retry exactly repeats setup and result without changing source', () => {
  const source = manifest('first-return');
  const before = JSON.stringify(source);
  const events = [];
  const session = createBenchmarkSession(source, {
    onStep: (items) => events.push(...structuredClone(items)),
  });
  const initial = session.summary;
  assert.equal(session.playing, false);
  session.advance({ direction: 'down' }, 0.1);
  assert.equal(session.run.tick, 0);
  play(session, [[414, 'down']]);
  const won = session.summary;
  assert.equal(won.status, 'won');
  assert.equal(won.tick, 414);
  assert.equal(won.claimedCount, 816);
  assert.equal(won.totalClaimable, 2380);
  assert.equal(won.score, 8160);
  assert.equal(won.lives, 3);
  assert.equal(session.playing, false);
  assert.equal(session.start(), false, 'terminal run cannot restart through Resume');
  assert.equal(events.filter((event) => event.type === 'cells.claimed')[0].indices.length, 816);
  const retired = session.run;
  session.retry();
  assert.notEqual(session.run, retired);
  assert.deepEqual(session.summary, initial);
  assert.equal(session.playing, false);
  assert.deepEqual(session.events, []);
  play(session, [[414, 'down']]);
  assert.deepEqual(session.summary, won);
  assert.equal(retired.status, 'won');
  assert.equal(JSON.stringify(source), before);
  session.dispose();
});

test('real self-contact failure consumes lives and reaches loss before a fresh deterministic Retry', () => {
  const failures = [];
  const session = createBenchmarkSession(manifest('first-return'), {
    onStep: (events) => failures.push(...events.filter((event) => event.type === 'player.failed')),
  });
  play(session, [
    [60, 'down'],
    [1, 'up'],
    [200, null],
    [60, 'down'],
    [1, 'up'],
    [200, null],
    [60, 'down'],
    [1, 'up'],
  ]);
  assert.equal(session.run.status, 'lost');
  assert.equal(session.run.tick, 583);
  assert.equal(session.run.failureCause, 'self-contact');
  assert.equal(session.run.lives, 0);
  assert.deepEqual(
    failures.map((event) => [event.tick, event.actorId]),
    [
      [61, 'player'],
      [322, 'player'],
      [583, 'player'],
    ],
  );
  assert.ok(session.events.length <= 12);
  assert.equal(
    session.events.findLast((event) => event.type === 'player.failed').actorId,
    'player',
  );
  session.retry();
  assert.equal(session.run.tick, 0);
  assert.equal(session.run.lives, 3);
  assert.equal(session.run.classic.lineImpact.fronts.length, 0);
  session.dispose();
  assert.equal(session.start(), false);
  assert.equal(session.retry(), false);
  assert.equal(session.advance({ direction: 'down' }, FIXED_DT), 0);
});

test('native pursuit and interception warnings, impacts and captures come from their actual source missions', () => {
  const pursuitEvents = [];
  const pursuit = createBenchmarkSession(manifest('return-in-reserve'), {
    onStep: (events) => pursuitEvents.push(...structuredClone(events)),
  });
  play(pursuit, [
    [78, 'down'],
    [180, 'right'],
    [180, 'down'],
    [180, 'left'],
  ]);
  assert.equal(pursuit.run.tick, 618);
  assert.equal(pursuit.run.claimedCount, 60);
  assert.equal(pursuit.run.score, 600);
  assert.equal(pursuit.run.lives, 3);
  assert.ok(
    pursuitEvents.some((event) => event.type === 'lineImpact.seeded' && event.tick === 555),
  );
  assert.equal(pursuit.run.classic.lineImpact.fronts.length, 0);
  const interceptionEvents = [];
  const interception = createBenchmarkSession(manifest('crossed-bands'), {
    onStep: (events) => interceptionEvents.push(...structuredClone(events)),
  });
  play(interception, [
    [90, 'up'],
    [110, 'right'],
    [90, 'down'],
    [60, 'left'],
  ]);
  assert.equal(interception.run.claimedCount, 52);
  assert.equal(interception.run.score, 520);
  assert.equal(interception.run.lives, 3);
  assert.ok(
    interceptionEvents.some((event) => event.tick === 322 && event.type === 'cells.claimed'),
  );
  assert.ok(
    interceptionEvents.some((event) => event.tick === 322 && event.reason === 'trail-closed'),
  );
  pursuit.dispose();
  interception.dispose();
});

test('pause and render-frame partitioning do not advance or retime the real fixed-step simulation', () => {
  const one = createBenchmarkSession(manifest('first-return'));
  const two = createBenchmarkSession(manifest('first-return'));
  one.start();
  two.start();
  for (let index = 0; index < 120; index++) one.advance({ direction: 'down' }, FIXED_DT);
  for (let index = 0; index < 60; index++) two.advance({ direction: 'down' }, 1 / 60);
  assert.deepEqual(two.summary, one.summary);
  const paused = structuredClone(two.run);
  two.pause();
  two.advance({ direction: 'up' }, 0.25);
  assert.deepEqual(structuredClone(two.run), paused);
  for (const seconds of [-1, 0.251, NaN]) assert.throws(() => two.advance({}, seconds), /250 ms/);
  one.dispose();
  two.dispose();
});

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function prepared(id) {
  let releases = 0;
  return {
    id,
    get releases() {
      return releases;
    },
    dispose() {
      releases++;
    },
  };
}

test('selection retains the old run through loading/failure and disposes superseded or departed work', async () => {
  const requests = [];
  const statuses = [];
  const adopted = [];
  const selection = createBenchmarkSelection({
    prepare(entry, { signal }) {
      const request = { entry, signal, ...deferred() };
      requests.push(request);
      return request.promise;
    },
    onStatus: (...args) => statuses.push(args),
    onAdopt: (value) => adopted.push(value.id),
  });
  const initial = selection.select('first');
  const first = prepared('first');
  requests[0].resolve(first);
  assert.equal(await initial, true);
  const fail = selection.select('second');
  assert.equal(selection.current, first);
  assert.equal(statuses.at(-1)[0], 'loading');
  requests[1].reject(new Error('Original digest mismatch.'));
  assert.equal(await fail, false);
  assert.equal(selection.current, first);
  assert.equal(first.releases, 0);
  assert.equal(statuses.at(-1)[0], 'error');
  const oldRequest = selection.select('second');
  const newRequest = selection.select('third');
  assert.equal(requests[2].signal.aborted, true);
  const third = prepared('third');
  requests[3].resolve(third);
  assert.equal(await newRequest, true);
  assert.equal(first.releases, 1);
  const late = prepared('second');
  requests[2].resolve(late);
  assert.equal(await oldRequest, false);
  assert.equal(late.releases, 1);
  assert.equal(selection.current, third);
  assert.deepEqual(adopted, ['first', 'third']);
  const departing = selection.select('fourth');
  selection.dispose();
  const notifications = statuses.length;
  const departed = prepared('fourth');
  requests[4].resolve(departed);
  assert.equal(await departing, false);
  assert.equal(departed.releases, 1);
  assert.equal(third.releases, 1);
  assert.equal(statuses.length, notifications);
  assert.equal(await selection.select('first'), false);
});

test('explicit cancellation keeps the prior scene and rejects even an abort-ignoring loader', async () => {
  const request = deferred();
  const selection = createBenchmarkSelection({ prepare: () => request.promise });
  const pending = selection.select('first');
  selection.cancel();
  const stale = prepared('first');
  request.resolve(stale);
  assert.equal(await pending, false);
  assert.equal(selection.current, null);
  assert.equal(selection.pending, false);
  assert.equal(stale.releases, 1);
});

test('the existing picture boundary verifies and decodes the exact original before ownership', async () => {
  const asset = manifest('first-return').background;
  const bytes = await readFile(new URL(`../${asset.path}`, import.meta.url));
  let closed = 0;
  let decoded = 0;
  const options = {
    loadArtwork: (pin, { signal }) =>
      loadPreviewArtwork(pin, { signal, fetchAsset: async () => new Response(bytes) }),
    decodeImage: async () => {
      decoded++;
      return {
        width: asset.width,
        height: asset.height,
        close() {
          closed++;
        },
      };
    },
  };
  const picture = await acquireCandidatePicture(asset, options);
  assert.equal(decoded, 1);
  assert.equal(isCandidatePictureFor(asset, picture), true);
  assert.equal(picture.assetRevision.sha256, asset.sha256);
  picture.release();
  assert.equal(closed, 1);
  assert.equal(isCandidatePictureFor(asset, picture), false);
  await assert.rejects(
    acquireCandidatePicture({ ...asset, sha256: '0'.repeat(64) }, options),
    /digest/,
  );
  assert.equal(decoded, 1, 'a mismatched original is never decoded or substituted');
});

test('adoption failure rolls back and releases only the failed replacement', async () => {
  const first = prepared('first');
  const second = prepared('second');
  const selection = createBenchmarkSelection({
    prepare: async (entry) => entry,
    onAdopt: (entry) => {
      if (entry === second) throw new Error('Painter rejected scene.');
    },
  });
  assert.equal(await selection.select(first), true);
  assert.equal(await selection.select(second), false);
  assert.equal(selection.current, first);
  assert.equal(first.releases, 0);
  assert.equal(second.releases, 1);
  selection.dispose();
  assert.equal(first.releases, 1);
});

test('600 ms ready cue never advances simulation and starts exactly one owned retry', () => {
  const session = createBenchmarkSession(manifest('first-return'));
  let starts = 0;
  const cue = createReadyCue((owner) => {
    starts++;
    owner.start();
  });
  cue.begin(session);
  for (let index = 0; index < 35; index++) cue.advance(1 / 60, session);
  assert.equal(session.playing, false);
  assert.equal(session.run.tick, 0);
  cue.advance(1 / 60, session);
  assert.equal(session.playing, true);
  assert.equal(session.run.tick, 0, 'cue completion itself runs no simulation tick');
  cue.advance(0.25, session);
  assert.equal(starts, 1);
  session.pause();
  cue.begin(session);
  cue.cancel();
  cue.advance(0.25, session);
  assert.equal(starts, 1);
  cue.begin(session);
  cue.advance(0.25, {});
  assert.equal(cue.active, false, 'replacement invalidates the old ready owner');
  session.dispose();
});

class Target {
  constructor(parent = null) {
    this.parent = parent;
    this.listeners = new Map();
    this.dataset = {};
    this.captures = new Set();
    this.classList = { toggle() {} };
  }
  addEventListener(type, fn, options) {
    const list = this.listeners.get(type) ?? [];
    list.push({ fn, capture: options === true || options?.capture === true });
    this.listeners.set(type, list);
  }
  removeEventListener(type, fn) {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((item) => item.fn !== fn),
    );
  }
  emit(type, values = {}) {
    const event = {
      type,
      target: this,
      key: '',
      code: '',
      repeat: false,
      button: 0,
      detail: 0,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      ...values,
    };
    const path = [];
    for (let target = this; target; target = target.parent) path.push(target);
    for (const target of [...path].reverse())
      for (const item of target.listeners.get(type) ?? []) if (item.capture) item.fn(event);
    for (const target of type === 'blur' ? [this] : path)
      for (const item of target.listeners.get(type) ?? []) if (!item.capture) item.fn(event);
    return event;
  }
  closest() {
    return null;
  }
  focus() {}
  setAttribute() {}
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 156, height: 96 };
  }
  setPointerCapture(id) {
    this.captures.add(id);
  }
  hasPointerCapture(id) {
    return this.captures.has(id);
  }
  releasePointerCapture(id) {
    this.captures.delete(id);
  }
}

test('Retry requires a fresh matching press/release after terminal focus moves', () => {
  const window = new Target();
  const arena = new Target(window);
  const retry = new Target(window);
  let activations = 0;
  const guard = attachDeliberateButton(retry, {
    window,
    enabled: () => true,
    activate: () => activations++,
  });
  arena.emit('keydown', { key: 'Enter' });
  retry.focus();
  retry.emit('keydown', { key: 'Enter', repeat: true });
  retry.emit('click');
  retry.emit('keyup', { key: 'Enter' });
  assert.equal(activations, 0, 'held confirmation across focus transfer does not retry');
  retry.emit('keydown', { key: 'Enter' });
  assert.equal(activations, 0, 'keydown alone does not retry');
  retry.emit('keyup', { key: 'Enter' });
  assert.equal(activations, 1);
  retry.emit('pointerup', { pointerId: 5 });
  retry.emit('click', { detail: 1 });
  assert.equal(activations, 1, 'an old pointer press cannot be inherited');
  retry.emit('pointerdown', { pointerId: 6 });
  retry.emit('pointerup', { pointerId: 6 });
  retry.emit('click', { detail: 1 });
  assert.equal(activations, 2);
  guard.destroy();
  retry.emit('click');
  assert.equal(activations, 2);
});

test('terminal focus wait respects intervening navigation and final departure', () => {
  const document = new Target();
  const arena = new Target(document);
  const picker = new Target(document);
  const owner = {};
  let offered = 0;
  const cue = createResultFocusCue({
    document,
    isPlayFocus: (element) => element === arena,
    onReady: () => offered++,
  });
  const focus = (element) => {
    document.activeElement = element;
    element.emit('focusin');
  };
  focus(arena);
  cue.begin(owner);
  cue.advance(0.3, owner);
  focus(picker);
  focus(arena);
  cue.advance(0.3, owner);
  assert.equal(offered, 0, 'leaving and returning during the cue does not steal focus');
  focus(picker);
  cue.begin(owner);
  cue.advance(0.6, owner);
  assert.equal(offered, 0, 'a terminal event cannot claim focus already outside play controls');
  focus(arena);
  cue.begin(owner);
  cue.advance(0.3, owner);
  assert.equal(offered, 0);
  cue.advance(0.3, owner);
  assert.equal(offered, 1, 'unchanged play focus receives one delayed Retry offer');
  cue.begin(owner);
  cue.destroy();
  cue.advance(0.6, owner);
  assert.equal(offered, 1);
  assert.equal(document.listeners.get('focusin').length, 0);
});

test('native D-pad and chosen swipe mode steer the actual run, with fresh-key gating after Retry', (t) => {
  const window = new Target();
  const arena = new Target(window);
  const pad = new Target(window);
  const buttons = ['up', 'left', 'down', 'right'].map((direction) => {
    const button = new Target(pad);
    button.dataset.move = direction;
    return button;
  });
  const boost = new Target(window);
  const globals = new Map();
  for (const [key, value] of Object.entries({
    window,
    document: {
      querySelectorAll: () => buttons,
      querySelector: (selector) =>
        ({ '.direction-controls': pad, '#boost-button': boost })[selector] ?? null,
    },
    navigator: { getGamepads: () => [] },
  })) {
    globals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  const session = createBenchmarkSession(manifest('first-return'));
  let mode = 'dpad';
  const input = attachBenchmarkInput({
    arena,
    active: () => session.playing,
    onPause: () => session.pause(),
    touchMode: () => mode,
  });
  t.after(() => {
    input.destroy();
    session.dispose();
    for (const [key, old] of globals)
      old ? Object.defineProperty(globalThis, key, old) : delete globalThis[key];
  });
  session.start();
  buttons[2].emit('pointerdown', { pointerId: 1, clientX: 78, clientY: 72, pointerType: 'touch' });
  assert.equal(input.poll().direction, 'down');
  session.advance(input.poll(), 0.1);
  assert.ok(session.run.player.y > session.run.level.spawn.y);
  buttons[2].emit('pointerup', { pointerId: 1 });
  input.clear();
  session.retry();
  session.start();
  mode = 'swipe';
  arena.emit('pointerdown', { pointerId: 2, clientX: 30, clientY: 30, pointerType: 'touch' });
  arena.emit('pointermove', { pointerId: 2, clientX: 30, clientY: 60, pointerType: 'touch' });
  assert.equal(input.poll().direction, 'down');
  arena.emit('pointerup', { pointerId: 2 });
  input.clear();
  session.retry();
  session.start();
  arena.emit('keydown', { key: 'ArrowDown', code: 'ArrowDown' });
  assert.equal(input.poll().direction, 'down');
  input.clear();
  session.retry();
  session.start();
  arena.emit('keydown', { key: 'ArrowDown', code: 'ArrowDown', repeat: true });
  assert.equal(input.poll().direction, null, 'held key does not steer a fresh retry');
  arena.emit('keyup', { key: 'ArrowDown', code: 'ArrowDown' });
  arena.emit('keydown', { key: 'ArrowDown', code: 'ArrowDown' });
  assert.equal(input.poll().direction, 'down');
});

test('scene owns the exact approved actor lease, resets visual phase on Retry, and releases resources', async (t) => {
  const originals = new Map();
  const actorBaseURL = 'https://game.test/game/presentation/compiled/';
  const transport = installActorAppearanceTransport({
    baseURL: actorBaseURL,
    install(key, descriptor) {
      originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      Object.defineProperty(globalThis, key, { configurable: true, ...descriptor });
    },
  });
  t.after(() => {
    for (const [key, old] of originals)
      old ? Object.defineProperty(globalThis, key, old) : delete globalThis[key];
  });
  let picturesReleased = 0;
  const painters = [];
  const dependencies = {
    catalog,
    actorBaseURL,
    signal: new AbortController().signal,
    loadTheme: async () => ({ player: 'test-body' }),
    acquirePicture: async () => ({
      release() {
        picturesReleased++;
      },
    }),
    makePainter() {
      const painter = {
        loadToken: 0,
        images: {},
        enemyBodies: { clear() {} },
        setLook: async () => {},
        setLevel() {},
        effectsFor() {},
      };
      painters.push(painter);
      return painter;
    },
  };
  const scene = await prepareBenchmarkScene(catalog.entries[0], dependencies);
  assert.deepEqual(scene.actors.pin().presentation, ACTOR_APPEARANCE_RELEASES[0].presentation);
  assert.equal(
    scene.actors.pin().content.level.simulationIdentity,
    manifest('first-return').simulationIdentity,
  );
  assert.ok(scene.actors.snapshot.image('player.scout.compact'));
  const initialAnimation = structuredClone(painters[0].animation);
  painters[0].animation.elapsed = 999;
  scene.session.retry();
  scene.resetPresentation();
  assert.deepEqual(painters[0].animation, initialAnimation);
  assert.equal(picturesReleased, 0, 'Retry retains the exact loaded artwork');
  scene.dispose();
  scene.dispose();
  assert.equal(picturesReleased, 1);
  assert.ok(transport.decoded.length > 0);
  assert.ok(
    transport.decoded.every((image) => image.closes === 1),
    'every owned bitmap closes once',
  );
  assert.throws(() => scene.actors.pin(), /released/);
  let actorReleases = 0;
  await assert.rejects(
    prepareBenchmarkScene(catalog.entries[0], {
      ...dependencies,
      acquireActors: async () => ({
        release() {
          actorReleases++;
        },
      }),
      makePainter: () => ({
        loadToken: 0,
        images: {},
        enemyBodies: { clear() {} },
        setLook: async () => {
          throw new Error('Decode failed.');
        },
      }),
    }),
    /Decode failed/,
  );
  assert.equal(actorReleases, 1);
  assert.equal(picturesReleased, 2, 'partial preparation releases the prior decoded original');
});
