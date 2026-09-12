import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BoardPainter } from '../ui/render.mjs';
import { encounterView } from '../ui/encounter-view.mjs';

const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const pack = await read('../content/packs/sentinel-relay.json');
const proofs = await read('../replays/sentinel-routes.json');
const html = await readFile(new URL('../couch/index.html', import.meta.url), 'utf8');

class Element {
  constructor(id = '') {
    this.id = id;
    this.value = '';
    this.textContent = '';
    this.hidden = false;
    this.checked = false;
    this.dataset = {};
    this.children = [];
    this.listeners = new Map();
    this.classes = new Set();
    this.classList = {
      contains: (name) => this.classes.has(name),
      toggle: (name, enabled) => (enabled ? this.classes.add(name) : this.classes.delete(name)),
    };
  }
  append(option) {
    this.children.push(option);
    if (!this.value) this.value = option.value;
  }
  replaceChildren(...children) {
    this.children = children;
    this.value = children[0]?.value ?? '';
  }
  addEventListener(type, callback) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), callback]);
  }
  removeEventListener(type, callback) {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((fn) => fn !== callback),
    );
  }
  emit(type, event = {}) {
    for (const callback of this.listeners.get(type) ?? []) callback(event);
  }
  removeAttribute() {}
  closest() {
    return null;
  }
  focus() {}
  getContext() {
    return { id: this.id };
  }
}

async function page(t, { campaign = pack.campaigns[0], turnPolicy = 'immediate' } = {}) {
  const elements = Object.fromEntries(
    [...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => [id, new Element(id)]),
  );
  const doc = new Element();
  doc.getElementById = (id) => elements[id];
  doc.querySelector = () => null;
  doc.querySelectorAll = () => [];
  doc.body = new Element();
  doc.hidden = false;
  doc.hasFocus = () => true;
  const win = new Element();
  const renders = [];
  const originals = new Map();
  let paint;
  let now = 1000;
  elements['race-turn'].value = turnPolicy;
  elements['race-time'].value = '90';
  const globals = {
    document: doc,
    window: win,
    navigator: { getGamepads: () => [] },
    indexedDB: undefined,
    location: { href: 'http://localhost/game/couch/', search: '' },
    matchMedia: () => ({ matches: false }),
    Option: class {
      constructor(label, value) {
        this.textContent = label;
        this.value = value;
      }
    },
    fetch: async (path) => ({
      ok: true,
      json: async () =>
        path === '../content/campaign.json'
          ? structuredClone(campaign)
          : JSON.parse(
              await readFile(new URL(path, new URL('../couch/', import.meta.url)), 'utf8'),
            ),
    }),
    requestAnimationFrame: (callback) => {
      paint = callback;
    },
  };
  for (const [key, value] of Object.entries(globals)) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  // The actual page, input, two simulations and cue renderer run. Raster/audio audition is outside this test.
  const methods = new Map();
  for (const key of [
    'setLook',
    'setLevel',
    'skipCelebration',
    'startCelebration',
    'effectsFor',
    'draw',
  ]) {
    methods.set(key, BoardPainter.prototype[key]);
    BoardPainter.prototype[key] =
      key === 'draw'
        ? (context, run) => {
            renders[Number(context.id.slice(-1))] = run;
          }
        : () => {};
  }
  t.after(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    for (const [key, value] of methods) BoardPainter.prototype[key] = value;
  });
  await import(`../couch/couch.mjs?encounter-test=${campaign.id}-${turnPolicy}`);
  assert.equal(typeof paint, 'function', elements['race-message'].textContent);
  paint(now);
  const frame = (ms = 1000 / 120) => {
    now += ms;
    paint(now);
  };
  const key = (type, direction) => {
    if (!direction) return;
    const code = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' }[direction];
    win.emit(type, {
      code,
      key: code.slice(-1).toLowerCase(),
      target: elements['race-canvas-0'],
      preventDefault() {},
    });
  };
  const cue = (player) => ({
    hidden: elements[`racer-encounter-${player}`].hidden,
    phase: elements[`racer-encounter-${player}`].dataset.phase,
    title: elements[`racer-encounter-title-${player}`].textContent,
    instruction: elements[`racer-encounter-instruction-${player}`].textContent,
  });
  return { elements, renders, frame, key, cue };
}

for (const turnPolicy of ['immediate', 'grid-center']) {
  test(`${turnPolicy}: actual couch inputs keep both phase cues independent and freeze them on pause/finish`, async (t) => {
    const app = await page(t, { turnPolicy });
    assert.match(app.cue(0).title, /^READY · 1 \/ 2/);
    assert.deepEqual(app.cue(0), app.cue(1));
    app.elements['race-start'].onclick();
    const route = proofs.routes.find(
      (r) => r.variant === 'ordinary' && r.classId === 'scout' && r.turnPolicy === turnPolicy,
    );
    let direction = null;
    let paused = false;
    let divergent = false;
    for (const segment of route.segments) {
      app.key('keyup', direction);
      direction = segment.input.direction;
      app.key('keydown', direction);
      for (let n = 0; n < segment.ticks; n++) {
        app.frame();
        const run = app.renders[0];
        if (run.tick === 1084) {
          assert.equal(app.cue(0).phase, 'transition');
          assert.equal(app.cue(1).phase, 'warning');
          divergent = true;
          app.elements['race-pause'].onclick();
          app.frame();
          const cues = [app.cue(0), app.cue(1)];
          assert.match(cues[0].title, /^PAUSED/);
          const states = app.renders.map((r) => JSON.stringify(r));
          app.frame(1000);
          assert.deepEqual([app.cue(0), app.cue(1)], cues);
          assert.deepEqual(
            app.renders.map((r) => JSON.stringify(r)),
            states,
          );
          app.elements['race-start'].onclick();
          app.key('keydown', direction);
          paused = true;
        }
        if (run.tick === 1791) {
          const expected = encounterView(run);
          assert.ok(expected.cutCells >= 8);
          assert.equal(app.cue(0).instruction, expected.instruction);
          assert.match(app.cue(1).instruction, /Capture the shield relay/);
        }
      }
    }
    assert.ok(paused && divergent);
    assert.equal(app.renders[0].status, 'won');
    assert.equal(app.renders[0].tick, 1792);
    assert.equal(app.renders[1].status, 'running');
    assert.match(app.cue(0).title, /ROUND ENDED.*CORE RELEASED/);
    assert.match(app.cue(0).instruction, /picture is yours/);
    assert.match(app.cue(1).title, /^ROUND ENDED/);
    assert.match(app.cue(1).instruction, /^Frozen at round end/);
    assert.doesNotMatch(app.cue(1).instruction, /Capture|Close|Return/);
    const ended = [app.cue(0), app.cue(1)];
    const ticks = app.renders.map((run) => run.tick);
    app.frame(2000);
    assert.deepEqual([app.cue(0), app.cue(1)], ended);
    assert.deepEqual(
      app.renders.map((run) => run.tick),
      ticks,
    );
  });
}

test('ordinary couch boards hide both empty encounter groups before and during a round', async (t) => {
  const campaign = await read('../content/campaign.json');
  const app = await page(t, { campaign });
  const empty = { hidden: true, phase: undefined, title: '', instruction: '' };
  assert.deepEqual(app.cue(0), empty);
  assert.deepEqual(app.cue(1), empty);
  app.elements['race-start'].onclick();
  for (let n = 0; n < 250; n++) app.frame();
  assert.deepEqual(app.cue(0), empty);
  assert.deepEqual(app.cue(1), empty);
});
