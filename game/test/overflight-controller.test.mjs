import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOverflightController,
  loadOverflightControllerPreferences,
  overflightControllerBindings,
} from '../overflight/controller.mjs';
import { resolveControllerBindings } from '../controller-bindings.mjs';
import { emptyProfile } from '../couch/controller-profiles.mjs';
import { SOLO_RESTORE_KEY } from '../couch/controller-restore.mjs';
import { emptyLibrary, exportLibrary } from '../library.mjs';

const standardPad = () => ({
  index: 0,
  id: 'Test Xbox',
  mapping: 'standard',
  connected: true,
  axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 24 }, () => ({ value: 0, pressed: false })),
});
function environment(data = new Map()) {
  const events = new Map();
  let writes = 0;
  return {
    location: { href: 'http://localhost/game/overflight/play.html' },
    localStorage: {
      getItem: (key) => data.get(key) ?? null,
      setItem: () => {
        writes++;
      },
    },
    addEventListener(type, handler) {
      if (!events.has(type)) events.set(type, new Set());
      events.get(type).add(handler);
    },
    removeEventListener(type, handler) {
      events.get(type)?.delete(handler);
    },
    events,
    writes: () => writes,
  };
}
function fixture(
  t,
  { bindings = null, pad = standardPad(), window = environment(), enabled = true } = {},
) {
  let pads = [pad],
    reads = 0,
    time = 0;
  const controller = createOverflightController({
    window,
    bindings,
    enabled,
    readPads: () => {
      reads++;
      return pads;
    },
  });
  t.after(() => controller.destroy());
  return {
    controller,
    pad,
    window,
    sample: (scope = 'flight') => controller.sample({ scope, timeMs: (time += 20) }),
    pads: (next) => {
      pads = next;
    },
    reads: () => reads,
  };
}
const vector = (frame) => ({ x: frame.x, y: frame.y, boost: frame.boost });
const zero = { x: 0, y: 0, boost: false };

test('mode RT default applies only when shared controller bindings are absent', (t) => {
  assert.equal(overflightControllerBindings().flight.buttons.boost, 7);
  const saved = resolveControllerBindings();
  assert.equal(overflightControllerBindings(saved).flight.buttons.boost, 5);
  const f = fixture(t, { bindings: saved });
  f.sample();
  f.pad.buttons[7].value = 1;
  assert.equal(f.sample().boost, false);
  f.pad.buttons[7].value = 0;
  f.pad.buttons[5].value = 1;
  assert.equal(f.sample().boost, true);
  assert.equal(f.controller.labels().confirm, 'A');
});

test('saved axes, inversions, dead-zone hysteresis and button directions preserve 2D analog flight', (t) => {
  const bindings = resolveControllerBindings();
  Object.assign(bindings.flight.stick, { xAxis: 2, yAxis: 3, invertX: true });
  bindings.deadZone = { press: 0.4, release: 0.2 };
  const f = fixture(t, { bindings });
  assert.equal(f.sample().status.code, 'joined');
  f.pad.axes = [0.9, -0.9, 0.6, -0.5];
  assert.deepEqual(vector(f.sample()), { x: -0.6, y: -0.5, boost: false });
  f.pad.axes = [0, 0, 0.3, -0.25];
  assert.deepEqual(vector(f.sample()), { x: -0.3, y: -0.25, boost: false });
  f.pad.axes = [0, 0, 0.2, 0];
  assert.deepEqual(vector(f.sample()), zero);
  f.pad.buttons[15].value = 1;
  f.pad.buttons[12].pressed = true;
  assert.deepEqual(vector(f.sample()), { x: 1, y: -1, boost: false });
  assert.equal(f.reads(), 5, 'router and analog adaptation share one hardware snapshot');
});

test('mapped menu confirm is a paired press/release and cannot boost through a modal transition', (t) => {
  const bindings = resolveControllerBindings();
  bindings.flight.buttons.boost = 7;
  bindings.menu.buttons.confirm = 7;
  const f = fixture(t, { bindings });
  f.sample('menu:upgrade');
  f.pad.buttons[7].value = 1;
  assert.equal(f.sample('menu:upgrade').ui.confirmStart, true);
  assert.equal(f.sample('menu:upgrade').ui.confirmCommit, false);
  assert.deepEqual(vector(f.sample('flight')), zero, 'held confirm is blocked after resume');
  f.pad.buttons[7].value = 0;
  assert.deepEqual(vector(f.sample('flight')), zero);
  f.pad.buttons[7].value = 1;
  assert.equal(f.sample().boost, true, 'fresh press dashes after release');
  f.pad.buttons[7].value = 0;
  f.sample('menu:upgrade');
  f.pad.buttons[7].value = 1;
  assert.equal(f.sample('menu:upgrade').ui.confirmStart, true);
  f.pad.buttons[7].value = 0;
  assert.equal(f.sample('menu:upgrade').ui.confirmCommit, true);
  assert.equal(f.sample('menu:upgrade').ui.confirmCommit, false);
  f.pad.buttons[7].value = 1;
  f.sample('menu:upgrade');
  f.pad.buttons[7].value = 0;
  assert.equal(
    f.sample('menu:settings').ui.confirmCommit,
    false,
    'release cannot commit another dialog',
  );
});

test('pause remapping, disconnect and same-slot identity replacement require fresh neutral', (t) => {
  const bindings = resolveControllerBindings();
  bindings.flight.buttons.pause = 8;
  const f = fixture(t, { bindings });
  f.sample();
  f.pad.buttons[9].value = 1;
  assert.equal(f.sample().pause, false);
  f.pad.buttons[9].value = 0;
  f.pad.buttons[8].value = 1;
  assert.equal(f.sample().pause, true);
  assert.equal(f.sample().pause, false);
  f.pad.buttons[8].value = 0;
  f.sample();
  f.pad.axes[0] = 0.8;
  assert.equal(f.sample().x, 0.8);
  const replacement = standardPad();
  replacement.id = 'Other device at same browser index';
  replacement.axes[0] = 1;
  f.pads([replacement]);
  assert.equal(f.sample().disconnected, true);
  assert.deepEqual(vector(f.sample()), zero);
  replacement.axes[0] = 0;
  assert.equal(f.sample().status.code, 'joined');
  replacement.axes[0] = -0.7;
  assert.equal(f.sample().x, -0.7);
  f.pads([]);
  assert.equal(f.sample().disconnected, true);
  assert.equal(f.sample().disconnected, false);
});

test('unknown raw devices never steer or block keyboard; exact saved radio profile keeps analog calibration', (t) => {
  const pad = standardPad();
  pad.mapping = '';
  pad.id = 'Configured radio';
  pad.axes = [0, 0, -1, 0];
  pad.buttons[6].value = 1;
  const unknown = fixture(t, { pad });
  assert.equal(unknown.sample().status.code, 'unsupported');
  assert.equal(unknown.sample().neutral, true);
  assert.deepEqual(vector(unknown.sample()), zero);
  const profile = emptyProfile(pad, 'radio', 'Radio');
  const axis = (index, end) => ({
    kind: 'axis',
    index,
    center: 0,
    end,
    press: 0.35,
    release: 0.25,
  });
  profile.flight.right = [axis(0, 1)];
  profile.flight.left = [axis(0, -1)];
  profile.flight.up = [axis(3, -1)];
  profile.flight.down = [axis(3, 1)];
  profile.flight.boost = [{ kind: 'button', index: 22, threshold: 0.5, invert: false }];
  profile.menu.confirm = [{ kind: 'button', index: 20, threshold: 0.5, invert: false }];
  const data = new Map([
    [
      SOLO_RESTORE_KEY,
      JSON.stringify({
        format: 'RadioSetup.v1',
        entries: [{ profiles: [profile], seats: [null] }],
      }),
    ],
  ]);
  const f = fixture(t, { pad, window: environment(data) });
  assert.equal(f.sample().status.code, 'joined');
  const snapshot = structuredClone(pad);
  assert.equal(f.window.writes(), 0);
  pad.axes[0] = 0.6;
  pad.axes[3] = -0.8;
  assert.deepEqual(vector(f.sample()), { x: 0.6, y: -0.8, boost: false });
  pad.axes[0] = 0.3;
  pad.axes[3] = -0.3;
  assert.deepEqual(vector(f.sample()), { x: 0.3, y: -0.3, boost: false });
  pad.buttons[22].value = 1;
  assert.equal(f.sample().boost, true);
  pad.axes = snapshot.axes;
  pad.buttons[22].value = 0;
  f.sample('menu:upgrade');
  pad.buttons[20].value = 1;
  assert.equal(f.sample('menu:upgrade').ui.confirmStart, true);
  pad.buttons[20].value = 0;
  assert.equal(f.sample('menu:upgrade').ui.confirmCommit, true);
  assert.equal(pad.buttons[6].value, 1, 'unmapped switch is untouched');
  assert.equal(pad.axes[2], -1, 'unmapped throttle is untouched');
  assert.equal(f.window.writes(), 0, 'restoring never rewrites saved setup');
  pad.id = 'Unknown radio with matching counts';
  assert.equal(f.sample().disconnected, true);
  assert.equal(f.sample().status.code, 'unsupported');
});

test('preference loading uses the native release/edition key without writes and rejects corrupt settings', async () => {
  const saved = emptyLibrary();
  saved.preferences.controllerBindings = resolveControllerBindings();
  saved.preferences.controllerBindings.flight.buttons.boost = 6;
  const key = 'revealline.library.edition-droneaid-nl-community.release-1.2.3.v1';
  const data = new Map([[key, exportLibrary(saved)]]);
  const window = environment(data);
  window.location.href =
    'https://example.org/editions/droneaid/releases/v1.2.3/site/game/overflight/play.html';
  window.fetch = async () => ({ ok: true, json: async () => ({ version: '1.2.3' }) });
  const loaded = await loadOverflightControllerPreferences({ window });
  assert.equal(loaded.profileKey, key);
  assert.equal(loaded.enabled, true);
  assert.equal(loaded.bindings.flight.buttons.boost, 6);
  data.set(key, '{invalid');
  assert.equal((await loadOverflightControllerPreferences({ window })).enabled, false);
  assert.equal(data.get(key), '{invalid');
  assert.equal(window.writes(), 0);
  const source = environment();
  source.fetch = async () => ({ ok: false });
  const defaults = await loadOverflightControllerPreferences({ window: source });
  assert.equal(defaults.profileKey, 'revealline.library.dev.v1');
  assert.equal(defaults.bindings, null);
  assert.equal(defaults.enabled, true);
});

test('adopting changed preferences and clearing input do not turn held controls into actions; disposal releases listeners', (t) => {
  const f = fixture(t);
  f.sample();
  f.pad.buttons[7].value = 1;
  assert.equal(f.sample().boost, true);
  f.controller.clear();
  assert.equal(f.sample().boost, false);
  const bindings = resolveControllerBindings();
  bindings.flight.buttons.boost = 7;
  f.controller.setPreferences({ bindings, enabled: true });
  assert.equal(f.sample().boost, false);
  f.pad.buttons[7].value = 0;
  f.sample();
  f.pad.buttons[7].value = 1;
  assert.equal(f.sample().boost, true);
  f.controller.setPreferences({ bindings, enabled: false });
  assert.deepEqual(vector(f.sample()), zero);
  f.controller.destroy();
  assert.equal(
    [...f.window.events.values()].reduce((count, set) => count + set.size, 0),
    0,
  );
  const reads = f.reads();
  assert.deepEqual(vector(f.sample()), zero);
  assert.equal(f.reads(), reads);
});
