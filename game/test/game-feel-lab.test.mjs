import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  authoredSnapshot,
  createSequenceClock,
  sequenceFrame,
  SEQUENCE_TICKS,
} from '../../authoring/game-feel-lab/sequence.mjs';
import {
  actorVariant,
  canvasPixelBytes,
  containImage,
  drawBenchmark,
  measureRenderCost,
} from '../../authoring/game-feel-lab/render.mjs';
import {
  createPreviewLifecycle,
  retainControlFocus,
} from '../../authoring/game-feel-lab/lifecycle.mjs';
import {
  createBackgroundSelection,
  loadSynevyrPhoto,
} from '../../authoring/game-feel-lab/background.mjs';

function surface() {
  const calls = [];
  const stack = [];
  let state = { globalAlpha: 1 };
  const ctx = new Proxy(
    {},
    {
      get(_, name) {
        if (name in state) return state[name];
        return (...args) => {
          calls.push({ name, args, ...state });
          if (name === 'save') stack.push({ ...state });
          if (name === 'restore') state = stack.pop();
        };
      },
      set(_, name, value) {
        state[name] = value;
        return true;
      },
    },
  );
  return { ctx, calls, stack };
}
function paint(scene, options) {
  const { ctx, calls, stack } = surface();
  drawBenchmark(ctx, scene, options);
  assert.equal(stack.length, 0);
  return calls;
}

test('clock holds, steps, seeks and repeats exactly without wall-clock dependencies', () => {
  const clock = createSequenceClock();
  assert.equal(clock.advance(10), 0);
  clock.play();
  for (let i = 0; i < 144; i++) clock.advance(1 / 144);
  assert.equal(clock.tick, 60);
  clock.pause();
  clock.advance(100);
  assert.equal(clock.tick, 60);
  clock.seek(359);
  clock.step();
  assert.equal(clock.tick, 0);
  assert.equal(clock.playing, false);
  clock.play();
  clock.advance(6);
  assert.equal(clock.tick, 0);
  clock.restart();
  assert.equal(clock.playing, false);
  for (const bad of [-1, 360, 0.5, NaN]) assert.throws(() => clock.seek(bad));
  assert.throws(() => clock.advance(-1));
});

test('seek and repeat share exact fixed-step poses; authored events are not toggle-dependent', () => {
  for (const reduced of [false, true]) {
    const first = structuredClone(sequenceFrame(162, { reduced }));
    sequenceFrame(359, { reduced });
    sequenceFrame(0, { reduced });
    assert.deepEqual(sequenceFrame(162, { reduced }), first);
  }
  assert.equal(authoredSnapshot(149).newlySecured.length, 0);
  assert.equal(authoredSnapshot(150).newlySecured.length, 120);
  assert.equal(authoredSnapshot(150).trailSegments.length, 0);
  assert.equal(authoredSnapshot(150).front, null);
  assert.equal(sequenceFrame(162).actorFrame.stunned, false, 'capture does not fabricate stun');
  assert.equal(sequenceFrame(222).actorFrame.stunned, true);
  assert.equal(sequenceFrame(288).actorFrame.stunned, false);
});

test('actor toggle removes only accents, retaining heading, contact and status', () => {
  for (const tick of [180, 222, 288]) {
    const frame = sequenceFrame(tick).actorFrame;
    const variant = actorVariant(frame, false);
    for (const key of ['x', 'y', 'heading', 'radius', 'diameter', 'stunned', 'dormant', 'locked'])
      assert.deepEqual(variant[key], frame[key], key);
    assert.equal(variant.bank, 0);
    assert.equal(variant.rotorPhase, 0);
    assert.deepEqual(variant.tail, []);
    assert.equal(actorVariant(frame, true), frame);
  }
});

test('capture is an independent underlay and no toggle rewrites scene inputs', () => {
  const scene = sequenceFrame(162);
  const original = structuredClone(scene);
  const actorStart = (calls) => {
    const translate = calls.findIndex((call) => call.name === 'translate');
    return calls.slice(0, translate).findLastIndex((call) => call.name === 'save');
  };
  const withPulse = paint(scene, { capture: true });
  const withoutPulse = paint(scene, { capture: false });
  assert.notDeepEqual(withPulse, withoutPulse);
  assert.deepEqual(
    withPulse.slice(actorStart(withPulse)),
    withoutPulse.slice(actorStart(withoutPulse)),
  );
  for (const capture of [false, true])
    for (const actors of [false, true])
      for (const trail of [false, true]) {
        paint(scene, { capture, actors, trail });
        assert.deepEqual(scene, original);
      }
  const noActorAccents = paint(scene, { actors: false });
  assert.deepEqual(
    withPulse.slice(0, actorStart(withPulse)),
    noActorAccents.slice(0, actorStart(noActorAccents)),
  );
});

test('reduced effects suppresses capture decoration while retaining live-line and threat paint', () => {
  const capture = sequenceFrame(162, { reduced: true });
  assert.deepEqual(
    paint(capture, { reduced: true, capture: true }),
    paint(capture, { reduced: true, capture: false }),
  );
  const warning = sequenceFrame(96, { reduced: true });
  const calls = paint(warning, { reduced: true, actors: false, trail: false, capture: false });
  assert.ok(
    calls.some((call) => call.name === 'stroke'),
    'live-line/contact strokes remain',
  );
  assert.ok(
    calls.some((call) => call.name === 'fill' && call.fillStyle === '#ff815c'),
    'threat diamond remains',
  );
  assert.ok(
    calls.some((call) => call.name === 'fillRect' && call.fillStyle === '#f1f7ed'),
    'head and contact cues remain',
  );
  assert.deepEqual(
    calls,
    paint(warning, { reduced: true, actors: false, trail: false, capture: false }),
  );
});

test('capture toggle has no output outside the pulse lifetime; all samples remain bounded', () => {
  for (const tick of [0, 96, 149, 189, 222, SEQUENCE_TICKS - 1]) {
    const scene = sequenceFrame(tick);
    assert.deepEqual(paint(scene, { capture: true }), paint(scene, { capture: false }));
    assert.ok(Object.isFrozen(scene));
  }
});

test('draw-cost measurement excludes warmups, bounds work and reports pixel bytes separately', async () => {
  let time = 0;
  let draws = 0;
  let yields = 0;
  const result = await measureRenderCost(
    () => {
      draws++;
      time += draws;
    },
    {
      now: () => time,
      yieldTask: async () => {
        yields++;
      },
      warmup: 20,
      samples: 20,
    },
  );
  assert.equal(draws, 40);
  assert.equal(yields, 2);
  assert.equal(result.minimumMs, 21);
  assert.equal(result.medianMs, 30);
  assert.equal(result.p95Ms, 39);
  assert.equal(
    canvasPixelBytes([
      { width: 384, height: 224 },
      { width: 384, height: 224 },
    ]),
    688128,
  );
  for (const options of [{ samples: 241 }, { warmup: 61 }, { samples: 0 }])
    await assert.rejects(
      measureRenderCost(() => {}, options),
      /sample budget/,
    );
});

test('measurement departure aborts before another draw or result can be published', async () => {
  const controller = new AbortController();
  let draws = 0;
  await assert.rejects(
    measureRenderCost(
      () => {
        draws++;
      },
      {
        signal: controller.signal,
        now: () => 1,
        yieldTask: async () => {
          controller.abort();
        },
      },
    ),
    { name: 'AbortError' },
  );
  assert.equal(draws, 20, 'abort after a cohort prevents all measured draws');
  await assert.rejects(
    measureRenderCost(
      () => {
        draws++;
      },
      { signal: controller.signal },
    ),
    { name: 'AbortError' },
  );
  assert.equal(draws, 20, 'already aborted work never draws');
});

test('preview lifecycle cancels RAF and tasks, restores paused once, and rejects stale callbacks', () => {
  const pending = new Map();
  let next = 0;
  let frames = 0;
  const clock = createSequenceClock();
  const lifecycle = createPreviewLifecycle({
    requestFrame(callback) {
      pending.set(++next, callback);
      return next;
    },
    cancelFrame(id) {
      pending.delete(id);
    },
    onFrame() {
      frames++;
      clock.advance(1 / 60);
    },
    onSuspend() {
      clock.pause();
    },
    onResume() {
      clock.pause();
    },
  });
  clock.play();
  const staleFrame = pending.values().next().value;
  const oldTask = lifecycle.beginTask();
  lifecycle.suspend();
  assert.equal(pending.size, 0);
  assert.equal(clock.playing, false);
  assert.equal(oldTask.signal.aborted, true);
  lifecycle.resume();
  lifecycle.resume();
  assert.equal(pending.size, 1, 'pageshow plus visibility return cannot duplicate RAF');
  assert.equal(oldTask.current(), false, 'old completion stays invalid after BFCache return');
  staleFrame(100);
  assert.equal(frames, 0);
  assert.equal(pending.size, 1, 'stale callback cannot replace the resumed loop');
  const [id, currentFrame] = pending.entries().next().value;
  pending.delete(id);
  currentFrame(200);
  assert.equal(frames, 1);
  assert.equal(clock.tick, 0, 'BFCache return remains paused');
  assert.equal(pending.size, 1);
  const currentTask = lifecycle.beginTask();
  assert.equal(currentTask.current(), true);
  lifecycle.dispose();
  lifecycle.dispose();
  lifecycle.resume();
  assert.equal(pending.size, 0);
  assert.equal(currentTask.current(), false);
  assert.equal(currentTask.signal.aborted, true);
  assert.throws(() => lifecycle.beginTask(), /inactive/);
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

test('measurement restores lost button focus only while owned and without intervening navigation', () => {
  for (const scenario of ['lost', 'moved', 'moved-away-and-back', 'departed', 'not-initiator']) {
    const listeners = new Set();
    let focuses = 0;
    const control = {
      focus(options) {
        assert.equal(options.preventScroll, true);
        focuses++;
      },
    };
    const document = {
      body: {},
      activeElement: scenario === 'not-initiator' ? {} : control,
      addEventListener(name, callback) {
        assert.equal(name, 'focusin');
        listeners.add(callback);
      },
      removeEventListener(name, callback) {
        assert.equal(name, 'focusin');
        listeners.delete(callback);
      },
    };
    const finish = retainControlFocus(control, document);
    document.activeElement = document.body;
    if (scenario.startsWith('moved')) {
      document.activeElement = {};
      for (const listener of listeners) listener({ target: document.activeElement });
      if (scenario === 'moved-away-and-back') document.activeElement = document.body;
    }
    finish(scenario !== 'departed');
    assert.equal(focuses, scenario === 'lost' ? 1 : 0, scenario);
    assert.equal(listeners.size, 0, 'completion always removes the temporary listener');
  }
});
function photograph() {
  let closes = 0;
  return {
    image: {
      width: 5312,
      height: 2988,
      close() {
        closes++;
      },
    },
    decodedBytes: 63489024,
    get closes() {
      return closes;
    },
  };
}

test('photo selection is lazy, preserves the prior view, and rejects superseded completion', async () => {
  const requests = [];
  const changes = [];
  const statuses = [];
  const selection = createBackgroundSelection({
    loadPhoto(signal) {
      const request = { ...deferred(), signal };
      requests.push(request);
      return request.promise;
    },
    onChange: (value) => changes.push(value.key),
    onStatus: (value) => statuses.push(value),
  });
  assert.equal(requests.length, 0, 'opening the fixture does not fetch the photograph');
  await selection.select('light');
  const first = selection.select('synevyr');
  assert.equal(selection.current.key, 'light');
  assert.match(statuses.at(-1), /Loading/);
  const second = selection.select('synevyr');
  assert.equal(requests[0].signal.aborted, true);
  const stale = photograph();
  requests[0].resolve(stale);
  assert.equal(await first, false);
  assert.equal(stale.closes, 1);
  assert.equal(selection.current.key, 'light');
  const accepted = photograph();
  requests[1].resolve(accepted);
  assert.equal(await second, true);
  assert.equal(selection.current.photo, accepted);
  assert.deepEqual(changes, ['light', 'synevyr']);
  await selection.select('synevyr');
  assert.equal(requests.length, 2, 'already-selected photo reuses its decoded bitmap');
  await selection.select('dark');
  assert.equal(accepted.closes, 1, 'switching away releases decoded pixels');
  await selection.select('light');
  const failing = selection.select('synevyr');
  requests[2].reject(new Error('Decode failed.'));
  assert.equal(await failing, false);
  assert.equal(selection.current.key, 'light');
  assert.equal(changes.at(-1), 'light');
  assert.match(statuses.at(-1), /unavailable.*previous view is preserved/);
  selection.dispose();
});

test('departure releases a photo and invalidates late decodes across return and disposal', async () => {
  const requests = [];
  let updates = 0;
  const selection = createBackgroundSelection({
    loadPhoto(signal) {
      const request = { ...deferred(), signal };
      requests.push(request);
      return request.promise;
    },
    onChange() {
      updates++;
    },
    onStatus() {
      updates++;
    },
  });
  const first = selection.select('synevyr');
  const loaded = photograph();
  requests[0].resolve(loaded);
  await first;
  const beforeSuspend = updates;
  selection.suspend();
  assert.equal(loaded.closes, 1);
  assert.equal(updates, beforeSuspend, 'departed page is not updated');
  assert.equal(selection.current.key, 'dark');
  selection.resume();
  assert.equal(requests.length, 1, 'return does not reload without explicit selection');
  const pending = selection.select('synevyr');
  selection.suspend();
  assert.equal(requests[1].signal.aborted, true);
  selection.resume();
  const afterResume = updates;
  const stale = photograph();
  requests[1].resolve(stale);
  assert.equal(await pending, false);
  assert.equal(stale.closes, 1);
  assert.equal(updates, afterResume, 'old generation cannot update restored page');
  const terminal = selection.select('synevyr');
  selection.dispose();
  const afterDispose = updates;
  const late = photograph();
  requests[2].resolve(late);
  assert.equal(await terminal, false);
  selection.resume();
  assert.equal(await selection.select('synevyr'), false);
  assert.equal(late.closes, 1);
  assert.equal(updates, afterDispose, 'disposed page is never updated');
});

test('photo loader checks local provenance and releases a decode completed after cancellation', async () => {
  const provenance = JSON.parse(
    await readFile(
      new URL(
        '../../authoring/library/real-world-references/synevyr-lake-rafts.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const requests = [];
  const controller = new AbortController();
  const decoded = deferred();
  const started = deferred();
  const source = new Blob([
    await readFile(
      new URL(
        '../../authoring/library/real-world-references/synevyr-lake-rafts.jpg',
        import.meta.url,
      ),
    ),
  ]);
  const loading = loadSynevyrPhoto(controller.signal, {
    async fetchResource(url, options) {
      requests.push(url.pathname);
      assert.equal(options.signal, controller.signal);
      return requests.length === 1
        ? { ok: true, json: async () => provenance }
        : { ok: true, blob: async () => source };
    },
    decode() {
      started.resolve();
      return decoded.promise;
    },
  });
  await started.promise;
  assert.match(requests[0], /synevyr-lake-rafts\.json$/);
  assert.match(requests[1], /synevyr-lake-rafts\.jpg$/);
  const late = photograph();
  controller.abort();
  decoded.resolve(late.image);
  await assert.rejects(loading, { name: 'AbortError' });
  assert.equal(late.closes, 1);
  const image = photograph().image;
  const ready = await loadSynevyrPhoto(new AbortController().signal, {
    fetchResource: async (url) =>
      url.pathname.endsWith('.json')
        ? { ok: true, json: async () => provenance }
        : { ok: true, blob: async () => source },
    decode: async () => image,
  });
  assert.equal(ready.decodedBytes, 63489024);
  assert.equal(ready.provenance.license, 'CC0-1.0');
  image.close();
  let decodes = 0;
  const wrongDigest = { ...provenance, file: { ...provenance.file, sha256: '0'.repeat(64) } };
  await assert.rejects(
    loadSynevyrPhoto(new AbortController().signal, {
      fetchResource: async (url) =>
        url.pathname.endsWith('.json')
          ? { ok: true, json: async () => wrongDigest }
          : { ok: true, blob: async () => source },
      decode: async () => {
        decodes++;
        return image;
      },
    }),
    /SHA-256/,
  );
  assert.equal(decodes, 0, 'same size and dimensions cannot admit different source bytes');
});

test('photograph is contained without source cropping and clipped only to secured cells', () => {
  const fit = containImage(5312, 2988, 384, 224);
  assert.deepEqual(fit, { x: 0, y: 4, width: 384, height: 216 });
  const portrait = containImage(100, 200, 384, 224);
  for (const [key, value] of Object.entries({ x: 136, y: 0, width: 112, height: 224 }))
    assert.ok(Math.abs(portrait[key] - value) < 1e-10, key);
  assert.throws(() => containImage(0, 200, 384, 224));
  const scene = sequenceFrame(96, { reduced: true });
  const photo = photograph().image;
  const options = { reduced: true, actors: false, trail: false, capture: false };
  const plain = paint(scene, options);
  const calls = paint(scene, { ...options, photo });
  const clip = calls.findIndex((call) => call.name === 'clip');
  const draw = calls.findIndex((call) => call.name === 'drawImage');
  assert.ok(clip > 0 && draw > clip);
  const mask = calls
    .slice(0, clip)
    .filter((call) => call.name === 'rect')
    .map((call) => call.args);
  assert.deepEqual(
    mask,
    scene.cells.flatMap((cell, index) =>
      cell ? [[(index % 24) * 16, Math.floor(index / 24) * 16, 16, 16]] : [],
    ),
  );
  assert.deepEqual(
    calls[draw].args,
    [photo, 0, 4, 384, 216],
    'five arguments use the whole source',
  );
  const hiddenCells = (commands) =>
    commands.filter((call) => call.name === 'fillRect' && call.fillStyle === '#203647');
  assert.deepEqual(hiddenCells(calls), hiddenCells(plain), 'unrevealed field stays identical');
  const actors = (commands) =>
    commands.slice(commands.findIndex((call) => call.name === 'translate')).map((call) => {
      const { fillStyle, ...other } = call;
      return ['fill', 'fillRect'].includes(call.name) ? { ...other, fillStyle } : other;
    });
  assert.deepEqual(
    actors(calls),
    actors(plain),
    'actors, live trail and warning remain above the photograph',
  );
});
