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
import {
  acquireScoutComparison,
  SCOUT_COMPARISON_COHORTS,
} from '../../authoring/playable-benchmark/candidate-appearance.mjs';
import {
  createSceneComparison,
  COMPARISON_BODIES,
} from '../../authoring/playable-benchmark/comparison.mjs';
import { FIELD_KIT_CANDIDATE_RIGS } from '../presentation/rotor-candidate-art.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { collectBuildFiles } from '../../scripts/game-cli.mjs';
import { selectOfflineCore } from '../../scripts/offline-core-closure.mjs';
import { fileURLToPath } from 'node:url';

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
  const candidateFiles = candidateTransport();
  const painters = [];
  const dependencies = {
    catalog,
    actorBaseURL,
    acquireComparison: (snapshot, options) =>
      acquireScoutComparison(snapshot, { ...options, ...candidateFiles.options }),
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
  const approvedPin = scene.actors.pin();
  const approvedScout = scene.actors.snapshot.image('player.scout.compact');
  assert.equal(await scene.comparison.select('v3-detailed'), true);
  assert.notEqual(scene.comparison.snapshot.image('player.scout.compact'), approvedScout);
  assert.equal(scene.comparison.snapshot.image('player.scout.compact').image.width, 64);
  assert.deepEqual(
    scene.actors.pin(),
    approvedPin,
    'a source preview cannot change the approved pin',
  );
  assert.equal(scene.actors.snapshot.image('player.scout.compact'), approvedScout);
  await verifyCandidateBoardPaint(scene);
  const initialAnimation = structuredClone(painters[0].animation);
  painters[0].animation.elapsed = 999;
  scene.session.retry();
  scene.resetPresentation();
  assert.deepEqual(painters[0].animation, initialAnimation);
  assert.equal(picturesReleased, 0, 'Retry retains the exact loaded artwork');
  assert.equal(
    scene.comparison.body,
    'v4-detailed',
    'Retry retains the accepted comparison revision',
  );
  assert.ok(candidateFiles.decoded.slice(-2).every((image) => image.closes === 0));
  assert.ok(candidateFiles.decoded.slice(0, -2).every((image) => image.closes === 1));
  scene.dispose();
  scene.dispose();
  assert.equal(picturesReleased, 1);
  assert.ok(
    candidateFiles.decoded.every((image) => image.closes === 1),
    'scene disposal closes candidate images once',
  );
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

function candidateTransport(transform = (_path, bytes) => bytes) {
  const decoded = [],
    requests = [];
  return {
    decoded,
    requests,
    options: {
      fetch: async (url) => {
        const path = new URL(url).pathname;
        requests.push(path);
        return new Response(await transform(path, await readFile(url)));
      },
      decodeImage: async (dataUrl) => {
        const bytes = Buffer.from(dataUrl.split(',')[1], 'base64');
        const image = {
          width: bytes.readUInt32BE(16),
          height: bytes.readUInt32BE(20),
          closes: 0,
          close() {
            this.closes++;
          },
        };
        decoded.push(image);
        return image;
      },
    },
  };
}

test('native Scout loader verifies both treatments and exposes only source provenance with delegated actors', async () => {
  const original = Object.freeze({ image: { id: 'approved-unmodified' } });
  const approved = Object.freeze({ image: () => original });
  const files = candidateTransport();
  const candidate = await acquireScoutComparison(approved, files.options);
  assert.deepEqual(Object.keys(candidate.snapshot), ['image']);
  assert.equal(candidate.pin, undefined);
  assert.equal(candidate.provenance.productionRegistered, false);
  assert.equal(candidate.provenance.status, 'source-candidate-not-runtime-default');
  assert.equal(
    candidate.provenance.construction,
    'reference-v3',
    'omitted construction preserves v3 API behavior',
  );
  assert.match(candidate.provenance.manifest.sha256, /^[a-f0-9]{64}$/);
  assert.equal(candidate.snapshot.image('enemy.border-patrol'), original);
  assert.equal(candidate.snapshot.image('player.bomber.compact'), original);
  assert.equal(approved.image('player.scout.compact'), original);
  for (const [treatment, side] of [
    ['compact', 32],
    ['detailed', 64],
  ]) {
    const frame = candidate.snapshot.image(`player.scout.${treatment}`);
    assert.equal(frame.image.width, side);
    assert.equal(frame.image.height, side);
    assert.deepEqual(frame.asset.geometry.rotorAnchors, FIELD_KIT_CANDIDATE_RIGS.scout);
    assert.deepEqual(
      frame.geometry.rotors.map((rotor) => [rotor.direction, rotor.phaseDegrees]),
      [
        [1, 0],
        [-1, 23],
        [-1, 46],
        [1, 69],
      ],
    );
    assert.ok(Object.isFrozen(frame.geometry));
    assert.equal(
      candidate.provenance.assets.find((asset) => asset.slot.endsWith(treatment)).assetRevision,
      frame.asset,
    );
  }
  candidate.release();
  candidate.release();
  assert.ok(files.decoded.every((image) => image.closes === 1));
  assert.throws(() => candidate.snapshot.image('player.scout.compact'), /released/);
});

test('explicit v4 Scout cohort remains separate from unchanged v3 images and delegated approval', async () => {
  const original = { image: { id: 'approved' } };
  const approved = { image: () => original };
  const files = candidateTransport();
  const v3 = await acquireScoutComparison(approved, files.options);
  const v4 = await acquireScoutComparison(approved, {
    ...files.options,
    construction: 'reference-v4',
  });
  assert.equal(v4.provenance.construction, 'reference-v4');
  assert.equal(
    v4.provenance.manifest.path,
    'authoring/library/fpv-body-contrast-candidates/manifest.json',
  );
  assert.equal(v4.provenance.productionRegistered, false);
  assert.equal(v4.pin, undefined);
  assert.equal(v4.snapshot.image('enemy.border-patrol'), original);
  const oldHashes = {
    compact: '4ac554d9d481c56ad12fc839d62188f89b4ca23fd430f0dc19921de268f450fb',
    detailed: '31de37c929886b60580a1f38b166bebd3da6cc1ebbab68b786cbf2a41fd0c72a',
  };
  for (const treatment of ['compact', 'detailed']) {
    const a = v3.snapshot.image(`player.scout.${treatment}`);
    const b = v4.snapshot.image(`player.scout.${treatment}`);
    assert.equal(a.asset.file.sha256, oldHashes[treatment]);
    assert.notEqual(b.asset.file.sha256, a.asset.file.sha256);
    assert.equal(b.asset.id, `candidate.reference-v4.scout.${treatment}`);
    assert.equal(b.asset.revision, 1);
    assert.deepEqual(b.geometry, a.geometry, 'contrast cannot move the frame, pivot or rotors');
  }
  v4.release();
  v3.release();
  assert.ok(files.decoded.every((image) => image.closes === 1));
});

test('known cohort table rejects aliases, cross-cohort manifests and extra or redirected entries before file reads', async () => {
  const approved = { image: () => null };
  for (const construction of [
    'latest',
    'reference-v5',
    '__proto__',
    '../reference-v4',
    { construction: 'reference-v4' },
  ]) {
    let reads = 0;
    await assert.rejects(
      acquireScoutComparison(approved, {
        construction,
        fetch: () => {
          reads++;
        },
      }),
      /Unknown candidate construction/,
    );
    assert.equal(reads, 0);
  }
  for (const construction of ['reference-v3', 'reference-v4']) {
    for (const fault of [
      'construction',
      'format',
      'sources',
      'extra',
      'duplicate',
      'path',
      'revision',
    ]) {
      const files = candidateTransport((path, bytes) => {
        if (!path.endsWith('/manifest.json')) return bytes;
        const manifest = JSON.parse(bytes);
        if (fault === 'construction')
          manifest.construction = construction === 'reference-v3' ? 'reference-v4' : 'reference-v3';
        if (fault === 'format') manifest.format = 'revealline-compiled-presentation.v1';
        if (fault === 'sources')
          manifest.sources['https://invalid.example/source.mjs'] = '0'.repeat(64);
        if (fault === 'extra')
          manifest.assets.push({ ...manifest.assets[0], slot: 'player.bomber.compact' });
        if (fault === 'duplicate') manifest.assets[1] = structuredClone(manifest.assets[0]);
        if (fault === 'path') manifest.assets[0].path = 'https://invalid.example/scout.compact.png';
        if (fault === 'revision') manifest.assets[0].assetRevision.revision = 2;
        return Buffer.from(JSON.stringify(manifest));
      });
      await assert.rejects(
        acquireScoutComparison(approved, { ...files.options, construction }),
        /manifest|Candidate/,
      );
      assert.equal(
        files.requests.length,
        1,
        `${construction}/${fault} rejects at the named manifest`,
      );
      assert.equal(files.decoded.length, 0);
    }
  }
});

test('candidate byte, source, native geometry and decode mismatches fail without admitting images', async () => {
  const approved = { image: () => null };
  for (const fault of ['png-digest', 'png-length', 'source', 'geometry', 'header', 'decode']) {
    const files = candidateTransport((path, bytes) => {
      if (fault === 'source' && path.endsWith('/rotor-body-detail-art.mjs'))
        return Buffer.concat([bytes, Buffer.from(' ')]);
      if (path.endsWith('/manifest.json') && ['geometry', 'header'].includes(fault)) {
        const manifest = JSON.parse(bytes);
        const asset = manifest.assets[0];
        if (fault === 'geometry') {
          asset.geometry.rotorAnchors[0].direction = -1;
          asset.assetRevision.geometry.rotorAnchors[0].direction = -1;
        } else {
          const png = Buffer.from('not a PNG');
          asset.bytes = asset.assetRevision.file.bytes = png.length;
          asset.sha256 = asset.assetRevision.file.sha256 = createHash('sha256')
            .update(png)
            .digest('hex');
        }
        return Buffer.from(JSON.stringify(manifest));
      }
      if (path.endsWith('/scout.compact.png')) {
        if (fault === 'png-digest') {
          const changed = Buffer.from(bytes);
          changed[50] ^= 1;
          return changed;
        }
        if (fault === 'png-length') return bytes.subarray(0, -1);
        if (fault === 'header') return Buffer.from('not a PNG');
      }
      return bytes;
    });
    const options = { ...files.options };
    if (fault === 'decode')
      options.decodeImage = async () => {
        const image = {
          width: 17,
          height: 17,
          closes: 0,
          close() {
            this.closes++;
          },
        };
        files.decoded.push(image);
        return image;
      };
    await assert.rejects(acquireScoutComparison(approved, options), /Candidate|candidate/);
    assert.ok(
      files.decoded.every((image) => image.closes === 1),
      `${fault} releases staged images`,
    );
    if (fault !== 'decode') assert.equal(files.decoded.length, 0, `${fault} rejects before decode`);
  }
});

test('candidate cancellation rejects promptly and closes a decoder that returns late', async () => {
  const files = candidateTransport();
  const controller = new AbortController();
  let releaseDecode, started;
  const decoding = new Promise((resolve) => {
    started = resolve;
  });
  const work = acquireScoutComparison(
    { image: () => null },
    {
      ...files.options,
      signal: controller.signal,
      decodeImage: () => {
        started();
        return new Promise((resolve) => {
          releaseDecode = resolve;
        });
      },
    },
  );
  await decoding;
  controller.abort();
  await assert.rejects(work, { name: 'AbortError' });
  const late = {
    width: 32,
    height: 32,
    closes: 0,
    close() {
      this.closes++;
    },
  };
  releaseDecode(late);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(late.closes, 1);
});

test('comparison replacement pauses without changing the real run and releases failed, stale or retired candidates', async () => {
  const session = createBenchmarkSession(manifest('first-return'));
  const original = { image: () => ({ image: 'approved' }) };
  const pending = [],
    statuses = [];
  const comparison = createSceneComparison({
    actors: { snapshot: original },
    session,
    acquire: (_snapshot, options) =>
      new Promise((resolve, reject) => pending.push({ resolve, reject, options })),
    onStatus: (kind) => statuses.push(kind),
  });
  const candidate = (id) => ({
    snapshot: { image: () => id },
    provenance: { id },
    releases: 0,
    release() {
      this.releases++;
    },
  });
  // Acquisition handles expose release closures, as the production loader does.
  const owned = (id) => {
    const item = candidate(id);
    item.release = item.release.bind(item);
    return item;
  };
  session.start();
  session.advance({ direction: 'down' }, 0.1);
  const before = authoritativeCheckpoint(session.run),
    run = session.run;
  const first = comparison.select('v3-auto');
  assert.equal(pending[0].options.construction, 'reference-v3');
  assert.equal(pending[0].options.treatment, 'auto');
  assert.equal(session.playing, false);
  assert.equal(comparison.snapshot, original);
  session.advance({ direction: 'down' }, 0.1);
  assert.deepEqual(authoritativeCheckpoint(session.run), before);
  const accepted = owned('accepted');
  pending[0].resolve(accepted);
  assert.equal(await first, true);
  const failed = comparison.select('v3-compact');
  pending[1].reject(new Error('bad PNG'));
  assert.equal(await failed, false);
  assert.equal(comparison.snapshot, accepted.snapshot);
  assert.equal(accepted.releases, 0);
  const stale = comparison.select('v3-detailed');
  const next = comparison.select('v4-compact');
  assert.equal(pending[3].options.construction, 'reference-v4');
  assert.equal(pending[3].options.treatment, 'compact');
  const newer = owned('newer');
  pending[3].resolve(newer);
  assert.equal(await next, true);
  const old = owned('stale');
  pending[2].resolve(old);
  assert.equal(await stale, false);
  assert.equal(old.releases, 1);
  assert.equal(accepted.releases, 1);
  comparison.setReduced(false);
  comparison.setFeedback({ captureAccent: false, eventAccents: true });
  assert.equal(comparison.reduced, false);
  assert.deepEqual(comparison.feedback, { captureAccent: false, eventAccents: true });
  assert.equal(session.run, run);
  assert.deepEqual(authoritativeCheckpoint(session.run), before);
  assert.equal(await comparison.select('approved'), true);
  assert.equal(newer.releases, 1);
  assert.equal(comparison.snapshot, original);
  const departed = comparison.select('v3-auto');
  comparison.dispose();
  const late = owned('late');
  pending[4].resolve(late);
  assert.equal(await departed, false);
  assert.equal(late.releases, 1);
  assert.ok(statuses.includes('error'));
  assert.equal(session.playing, false);
  session.dispose();
});

test('the shipped Scout option has exact dependencies and adds no mode core files', async () => {
  const root = new URL('../../', import.meta.url);
  const files = await collectBuildFiles(fileURLToPath(root));
  const candidatePaths = [];
  for (const [construction, cohort] of Object.entries(SCOUT_COMPARISON_COHORTS)) {
    const paths = ['manifest.json', 'scout.compact.png', 'scout.detailed.png'].map(
      (name) => `${cohort.directory}/${name}`,
    );
    candidatePaths.push(...paths);
    assert.deepEqual(
      files.filter((path) => path.startsWith(`${cohort.directory}/`)),
      paths,
      `${construction}: only the manifest and two selected Scout rasters are added`,
    );
    const candidateManifest = JSON.parse(await readFile(new URL(paths[0], root)));
    assert.equal(candidateManifest.construction, construction);
    assert.deepEqual(Object.keys(candidateManifest.sources).sort(), [...cohort.sources].sort());
    for (const [path, sha256] of Object.entries(candidateManifest.sources)) {
      assert.ok(files.includes(path), `${path} is shipped without substituting a source`);
      assert.equal(
        createHash('sha256')
          .update(await readFile(new URL(path, root)))
          .digest('hex'),
        sha256,
      );
    }
  }
  // This executes the real source collector and closure classifier, without
  // building snapshots, archives or output directories. Binary payload contents
  // cannot contain dependency references, so they need no read or duplicate buffer.
  const entries = await Promise.all(
    files.map(async (name) => ({
      name,
      bytes: /\.(m?js|json|html|css)$/.test(name)
        ? await readFile(new URL(name, root))
        : Buffer.alloc(0),
    })),
  );
  const added = new Set([...candidatePaths, 'game/presentation/rotor-body-contrast-art.mjs']);
  const previous = entries.filter((entry) => !added.has(entry.name));
  for (const mode of ['solo', 'versus', 'team']) {
    const before = selectOfflineCore(previous, new Set(), { mode });
    const after = selectOfflineCore(entries, new Set(), { mode });
    assert.deepEqual(
      [...after.retained].sort(),
      [...before.retained].sort(),
      `${mode}: no core expansion`,
    );
    for (const path of [
      ...candidatePaths,
      'game/presentation/rotor-body-contrast-art.mjs',
      'game/presentation/rotor-body-detail-art.mjs',
      'game/presentation/rotor-candidate-art.mjs',
    ]) {
      assert.ok(after.optional.includes(path), `${mode}: ${path} remains optional tooling`);
      assert.equal(after.retained.has(path), false);
    }
    assert.ok(
      before.retained.has('game/presentation/pixel-art.mjs'),
      'the common pixel source was already core',
    );
  }
});

async function verifyCandidateBoardPaint(scene) {
  const presets = JSON.parse(
    await readFile(new URL('../../authoring/motion-lab/presets.json', import.meta.url)),
  );
  const theme = JSON.parse(
    await readFile(new URL('../content/themes.json', import.meta.url)),
  ).themes.find((item) => item.id === 'fpv');
  const run = scene.session.run;
  const before = authoritativeCheckpoint(run);
  const original = {
    image: { id: 'accepted-mission-original', width: 1774, height: 887 },
    fit: 'contain',
  };
  for (const body of COMPARISON_BODIES) {
    assert.equal(await scene.comparison.select(body), true);
    for (const width of [390, 1152])
      for (const reduced of [false, true])
        for (const paused of [false, true]) {
          const calls = [],
            values = {},
            stack = [];
          const ctx = new Proxy(
            { canvas: { width: 1152, height: 576, clientWidth: width } },
            {
              get(target, name) {
                if (name in target) return target[name];
                if (name in values) return values[name];
                return (...args) => {
                  calls.push({ name, args });
                  if (name === 'save') stack.push({ ...values });
                  if (name === 'restore') Object.assign(values, stack.pop());
                };
              },
              set(_target, name, value) {
                values[name] = value;
                return true;
              },
            },
          );
          const painter = new BoardPainter(presets);
          painter.theme = theme;
          painter.bodyId = 'fpv-scout-v1';
          painter.body = presets.characters[painter.bodyId];
          painter.recipe = presets.animationRecipes[painter.body.animationRecipe];
          painter.makeArt = () => null; // The accepted original is supplied as the backdrop.
          painter.setLevel(run.level, { seed: 1 });
          const slot = `player.scout.${width < 480 ? 'compact' : 'detailed'}`;
          const frame = scene.comparison.snapshot.image(slot);
          painter.draw(ctx, run, 1 / 60, {
            paused,
            reduced,
            displayCSSWidth: width,
            backdrop: original,
            actorAppearance: { style: 'fpv', snapshot: scene.comparison.snapshot },
          });
          assert.equal(calls.find((call) => call.name === 'drawImage').args[0], original.image);
          assert.ok(
            calls.some((call) => call.name === 'drawImage' && call.args[0] === frame.image),
          );
          assert.ok(
            calls.some(
              (call) => call.name === 'arc' && call.args[2] === run.rules.playerRadius * 16,
            ),
            'contact radius survives each candidate/effect state',
          );
          assert.equal(
            painter.presentation,
            null,
            'candidate cannot become the scene presentation',
          );
          assert.deepEqual(authoritativeCheckpoint(run), before);
        }
  }
}
