import test from 'node:test';
import assert from 'node:assert/strict';
import { attachLibraryPanel } from '../ui/library-panel.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { advanceCelebration } from '../ui/celebration.mjs';
import { campaignKey, emptyLibrary } from '../library.mjs';
import { CLASSES } from '../core/index.mjs';

class Element {
  constructor() {
    this.children = [];
    this.listeners = new Map();
    this.style = {};
    this.value = '';
    this.textContent = '';
    this.open = false;
    this.isConnected = true;
  }
  append(...children) {
    this.children.push(...children);
  }
  replaceChildren(...children) {
    this.children = children;
  }
  setAttribute() {}
  getContext() {
    return {
      drawImage: (...args) => {
        (this.copies ??= []).push(args);
      },
    };
  }
  querySelectorAll() {
    return [];
  }
  addEventListener(type, callback) {
    this.listeners.set(type, callback);
  }
  showModal() {
    this.open = true;
  }
  close() {
    this.open = false;
    this.listeners.get('close')?.();
  }
  focus() {}
}

async function setup(t, { saved, getReducedEffects, load = async () => {} }) {
  const globals = ['document', 'fetch', 'requestAnimationFrame', 'cancelAnimationFrame'];
  const previous = globals.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  const nodes = new Map();
  const node = (id) => {
    if (!nodes.has(id)) nodes.set(id, new Element());
    return nodes.get(id);
  };
  const frames = new Map();
  let nextFrame = 0;
  const replacements = {
    document: {
      getElementById: node,
      createElement: () => new Element(),
      querySelectorAll: () => [],
      hidden: false,
    },
    fetch: async () => ({ ok: true, json: async () => ({ packs: [] }) }),
    requestAnimationFrame: (callback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
  };
  for (const [key, value] of Object.entries(replacements))
    Object.defineProperty(globalThis, key, { configurable: true, value });
  t.after(() => {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const starts = [],
    draws = [],
    deltas = [];
  let painter;
  t.mock.method(BoardPainter.prototype, 'drawGallery', () => {});
  t.mock.method(BoardPainter.prototype, 'setLook', async function (theme) {
    painter = this;
    this.theme = theme;
    await load();
  });
  t.mock.method(BoardPainter.prototype, 'setLevel', () => {});
  const start = BoardPainter.prototype.startCelebration;
  t.mock.method(BoardPainter.prototype, 'startCelebration', function (options) {
    starts.push(options);
    return start.call(this, options);
  });
  // Exercise the real gallery handler and actual finale clock without pretending
  // this DOM/image adapter paints pixels or tests browser image decoding.
  t.mock.method(BoardPainter.prototype, 'draw', function (_context, _state, dt, options) {
    draws.push(options);
    deltas.push(dt);
    this.celebration = advanceCelebration(this.celebration, dt, {
      reduced: options.reduced,
      paused: options.celebrationPaused,
    });
  });
  const level = {
    version: 'xonix-level.v1',
    id: 'reduced-gallery',
    revision: '1',
    name: 'Gallery presentation fixture',
    width: 48,
    height: 36,
    spawn: { x: 24.5, y: 0.5 },
    walls: [],
    enemies: [],
    objectives: [],
    supplies: [],
    goal: { coverage: 0.5 },
  };
  const entry = {
    campaign: { id: 'reduced-gallery', revision: '1', levels: [level] },
    themes: [{ id: 'retro', name: 'Retro', player: 'retro-craft' }],
    classRecipes: CLASSES,
    visualOverrides: {},
  };
  const library = emptyLibrary();
  library.preferences.reducedEffects = saved;
  library.gallery = [
    {
      key: 'local-presentation-fixture',
      campaignKey: campaignKey(entry.campaign),
      levelId: level.id,
      levelName: level.name,
      themeId: 'retro',
      medal: 'gold',
      score: 100,
      seed: 1,
    },
  ];
  const before = structuredClone(library);
  const panel = attachLibraryPanel({
    get: () => ({ library, presets: {} }),
    catalog: () => [entry],
    ...(getReducedEffects ? { getReducedEffects } : {}),
  });
  panel.populateGallery();
  node('collection-dialog').showModal();
  await node('gallery-grid').children[0].onclick();
  let clock = 0;
  return {
    starts,
    draws,
    deltas,
    frames,
    play: () => node('gallery-animate').onclick(),
    close: () => node('gallery-view-dialog').close(),
    hidden: (value) => (replacements.document.hidden = value),
    advance(now = clock + 16) {
      const [id, callback] = frames.entries().next().value || [];
      assert.equal(typeof callback, 'function', 'the actual handler scheduled a gallery frame');
      frames.delete(id);
      if (Number.isFinite(now)) clock = now;
      callback(now);
    },
    elapsed: () => painter.celebrationStatus.elapsed,
    finished: () => painter.celebrationStatus.finished,
    unchanged: () => assert.deepEqual(library, before, 'presentation must not persist a choice'),
  };
}

test('a first frame behind the startup clock begins at zero and completes through real finale progression', async (t) => {
  const h = await setup(t, { saved: false });
  const beforePlay = performance.now();
  await h.play();
  assert.ok(beforePlay > 0, 'the supplied first frame predates the separately sampled clock');
  assert.doesNotThrow(() => h.advance(0));
  assert.equal(h.elapsed(), 0);
  h.advance(16);
  assert.equal(h.elapsed(), 0.016);
  for (let now = 32; h.frames.size && now <= 5000; now += 16) h.advance(now);
  assert.equal(h.finished(), true);
  assert.equal(h.frames.size, 0, 'the completed finale stops scheduling');
  assert.equal(h.deltas[0], 0);
  h.unchanged();
});

test('defensive equal, backward and nonfinite timestamps cannot double-count or poison gallery time', async (t) => {
  const h = await setup(t, { saved: false });
  await h.play();
  h.advance(NaN);
  assert.equal(h.elapsed(), 0);
  h.advance(1000);
  assert.equal(h.elapsed(), 0, 'the first finite frame establishes the baseline');
  h.advance(1016);
  assert.equal(h.elapsed(), 0.016);
  // These ordering/nonfinite values are deliberate host-boundary injections,
  // not evidence that a browser supplied them in the frozen failure.
  for (const now of [1016, 1000, NaN, Infinity, -Infinity, 1016]) {
    h.advance(now);
    assert.equal(h.elapsed(), 0.016);
  }
  h.advance(1032);
  assert.equal(h.elapsed(), 0.032, 'catching up did not replay a previously counted interval');
  h.advance(100000);
  assert.ok(Math.abs(h.elapsed() - 0.132) < 1e-12, 'a long delivered gap advances at most 0.1s');
  assert.ok(h.deltas.every((dt) => Number.isFinite(dt) && dt >= 0 && dt <= 0.1));
  assert.equal(h.frames.size, 1, 'valid progression still has one live callback');
  h.unchanged();
});

test('restart establishes a fresh clock and retained restart or close callbacks stay inert', async (t) => {
  const h = await setup(t, { saved: false });
  await h.play();
  h.advance(1000);
  h.advance(1016);
  assert.equal(h.elapsed(), 0.016);
  const stale = h.frames.values().next().value,
    beforeRestart = h.draws.length;
  await h.play();
  assert.equal(h.starts.length, 2);
  assert.equal(h.elapsed(), 0);
  assert.equal(h.frames.size, 1);
  stale(1032);
  assert.equal(h.draws.length, beforeRestart, 'a cancelled old invocation does not paint');
  assert.equal(h.frames.size, 1, 'a cancelled old invocation does not reschedule');
  h.advance(0);
  assert.equal(h.elapsed(), 0, 'restart does not inherit the previous invocation clock');
  h.advance(16);
  assert.equal(h.elapsed(), 0.016);
  const closed = h.frames.values().next().value,
    beforeClose = h.draws.length;
  h.close();
  assert.equal(h.frames.size, 0);
  closed(32);
  assert.equal(h.draws.length, beforeClose);
  assert.equal(h.frames.size, 0);
  h.unchanged();
});

test('delivered hidden frames pause the finale while keeping the visible return interval current', async (t) => {
  const h = await setup(t, { saved: false });
  await h.play();
  h.advance(1000);
  h.hidden(true);
  h.advance(2000);
  assert.equal(h.elapsed(), 0);
  assert.equal(h.draws.at(-1).celebrationPaused, true);
  h.hidden(false);
  h.advance(2016);
  assert.equal(h.elapsed(), 0.016, 'the delivered hidden interval was not added on return');
  assert.equal(h.draws.at(-1).celebrationPaused, false);
  h.unchanged();
});

test('effective reduced effects suppress gallery animation even when the saved preference is false', async (t) => {
  const h = await setup(t, { saved: false, getReducedEffects: () => true });
  await h.play();
  assert.equal(h.starts[0].reduced, true);
  h.advance();
  assert.equal(h.draws[0].reduced, true);
  assert.equal(h.deltas[0], 0, 'reduced mode completes even with the initial zero delta');
  assert.equal(h.finished(), true);
  assert.equal(h.frames.size, 0);
  h.unchanged();
});

test('an explicit effective unchecked choice overrides a saved true value without persisting it', async (t) => {
  let effective = false;
  const h = await setup(t, { saved: true, getReducedEffects: () => effective });
  await h.play();
  assert.equal(h.starts[0].reduced, false);
  h.advance();
  assert.equal(h.draws[0].reduced, false);
  assert.equal(h.finished(), false);
  effective = true;
  h.advance();
  assert.equal(h.draws[1].reduced, true, 'each frame reads the current effective choice');
  assert.equal(h.finished(), true);
  assert.equal(h.frames.size, 0);
  h.unchanged();
});

test('gallery reads the effective choice after asynchronous artwork preparation', async (t) => {
  let release,
    effective = false;
  const h = await setup(t, {
    saved: false,
    getReducedEffects: () => effective,
    load: () => new Promise((resolve) => (release = resolve)),
  });
  const playing = h.play();
  assert.equal(h.starts.length, 0);
  effective = true;
  release();
  await playing;
  assert.equal(h.starts[0].reduced, true);
  h.advance();
  assert.equal(h.finished(), true);
  h.unchanged();
});

test('callers without an effective getter retain the saved-preference fallback', async (t) => {
  for (const saved of [false, true])
    await t.test(`saved ${saved}`, async (t) => {
      const h = await setup(t, { saved });
      await h.play();
      assert.equal(h.starts[0].reduced, saved);
      h.advance();
      assert.equal(h.draws[0].reduced, saved);
      assert.equal(h.finished(), saved);
      h.unchanged();
    });
});
