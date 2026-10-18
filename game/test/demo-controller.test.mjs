import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoControllerFrame } from '../ui/demo-controller.mjs';
import { createControllerRouter } from '../ui/controller-router.mjs';
import { attachDemoInput } from '../ui/demo-input.mjs';
import { attachSurvivalDemoInput } from '../demo-modes/survival.mjs';
import { createOverflightController } from '../overflight/controller.mjs';
import { resolveControllerBindings } from '../controller-bindings.mjs';
import { emptyProfile } from '../couch/controller-profiles.mjs';
import { SOLO_RESTORE_KEY } from '../couch/controller-restore.mjs';
import { Document } from './helpers/couch-dom.mjs';

const gamepad = () => ({
  index: 0,
  id: 'Shared demo test pad',
  mapping: 'standard',
  connected: true,
  axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 24 }, () => ({ pressed: false, value: 0 })),
});
const flightScope = (modeId) => ({
  modeId,
  scope: 'flight',
  spectator: true,
  toggleBoostEligible: false,
});

for (const origin of ['sim', 'snake']) {
  for (const modeId of ['solo', 'snake', 'survival']) {
    test(`${origin}-origin captured pads enter ${modeId} practice only after fresh movement`, (t) => {
      const document = new Document(),
        root = document.createElement('div'),
        canvas = document.createElement('canvas');
      document.body.append(root);
      root.append(canvas);
      canvas.focus();
      const intents = [],
        menus = [],
        pad = gamepad();
      const normalizer = createDemoControllerFrame();
      let paused = 0,
        session = null;
      const input =
        modeId === 'survival'
          ? attachSurvivalDemoInput({
              root,
              canvas,
              practice: () => session,
              onTakeover: (intent) => intents.push({ ...intent }),
              menu: (ui) => menus.push(ui),
            })
          : attachDemoInput({
              root,
              canvas,
              active: () => true,
              watching: () => !session,
              practice: () => !!session,
              getBindings: () => null,
              takeover: (intent) => intents.push(intent),
              interrupt() {},
              back() {},
              steer() {},
              pause: () => paused++,
              menu: (ui) => menus.push(ui),
            });
      t.after(() => {
        (input.destroy ?? input.dispose)();
        normalizer.dispose();
      });
      const sample = (pads = [pad]) => {
        const frame = { gamepads: pads, now: 1000 };
        if (origin === 'snake')
          Object.assign(frame, {
            flight: { direction: pad.axes[0] > 0.55 ? 'right' : null, pause: false },
            ui: { direction: null, confirm: false, back: false, menu: false },
            status: { code: 'connected' },
          });
        input.controller(normalizer.sample(frame, flightScope(modeId)));
      };
      pad.axes[0] = 0.9;
      sample();
      sample();
      assert.equal(intents.length, 0, 'entering with a held stick cannot take over');
      pad.axes[0] = 0.13;
      sample();
      assert.equal(intents.length, 0, 'controller drift cannot take over');
      pad.axes[0] = 0.8;
      sample();
      assert.equal(intents.length, 1);
      assert.equal(
        modeId === 'survival' ? intents[0].x : intents[0].direction,
        modeId === 'survival' ? 1 : 'right',
      );
      session = { phase: 'playing', steer() {}, pause: () => paused++ };
      sample([]);
      assert.equal(paused, 1, 'disconnect pauses the isolated practice');
      assert.equal(menus.length, 0);
    });
  }
}

test('raw samples retain configured actions, menu edges, and clear their release gate without persistence', () => {
  const bindings = resolveControllerBindings();
  bindings.flight.buttons.boost = 7;
  bindings.menu.buttons.confirm = 2;
  const preferences = Object.freeze({ controllerBindings: bindings, controllerBoostMode: 'hold' });
  const before = JSON.stringify(preferences),
    pad = gamepad();
  const normalizer = createDemoControllerFrame({ getPreferences: () => preferences });
  const sample = (scope = 'flight') =>
    normalizer.sample({ gamepads: [pad], now: 1000 }, { ...flightScope('solo'), scope });
  sample();
  pad.buttons[7].pressed = true;
  assert.equal(sample().flight.boost, true);
  assert.equal(sample().flight.boost, false, 'watching boost is a fresh edge');
  normalizer.clear();
  assert.equal(sample().flight.boost, false, 'clearing cannot turn held boost into a new action');
  pad.buttons[7].pressed = false;
  sample();
  pad.buttons[7].pressed = true;
  assert.equal(sample().flight.boost, true);
  pad.buttons[7].pressed = false;
  sample('menu:demo');
  pad.buttons[2].pressed = true;
  assert.equal(sample('menu:demo').ui.confirm, true);
  assert.equal(sample('menu:demo').ui.confirm, false);
  pad.buttons[2].pressed = false;
  sample('menu:demo');
  pad.buttons[1].pressed = true;
  assert.equal(sample('menu:demo').ui.back, true);
  pad.buttons[1].pressed = false;
  sample('menu:demo');
  pad.buttons[9].pressed = true;
  assert.equal(sample('menu:demo').ui.menu, true);
  assert.equal(JSON.stringify(preferences), before);
  normalizer.dispose();
});

test('authoritative Solo frames retain mapped controls and the native Confirm owner', () => {
  const pad = gamepad(),
    bindings = resolveControllerBindings();
  bindings.flight.buttons.boost = 7;
  const router = createControllerRouter({
    readPads: () => [pad],
    eventTarget: null,
    autoJoin: true,
    bindings,
  });
  const normalizer = createDemoControllerFrame();
  const sample = (scope = 'flight') => {
    const frame = router.sample({ scope, spectator: true, timeMs: 1000 });
    const captured = { ...frame, gamepads: [pad], now: 1000, ui: { ...frame.ui, confirm: false } };
    return normalizer.sample(captured, { ...flightScope('survival'), scope });
  };
  sample();
  pad.buttons[7].pressed = true;
  assert.equal(sample().flight.boost, true, 'the authoritative remap beats generic defaults');
  pad.buttons[7].pressed = false;
  sample('menu:demo');
  pad.buttons[0].pressed = true;
  assert.equal(sample('menu:demo').ui.confirm, false, 'shared native release owner keeps Confirm');
  normalizer.clear();
  pad.buttons[0].pressed = false;
  pad.axes[0] = 0.8;
  assert.equal(sample().flight.direction, null, 'new scene requires physical neutral');
  pad.axes[0] = 0;
  sample();
  pad.axes[0] = 0.8;
  assert.equal(sample().flight.direction, 'right');
  normalizer.dispose();
  router.destroy();
});

test('Survival-origin frames share exact bindings while retaining analog movement and Confirm release', () => {
  const pad = gamepad(),
    document = new Document(),
    bindings = resolveControllerBindings();
  Object.assign(bindings.flight.stick, { xAxis: 2, yAxis: 3, invertX: true });
  bindings.flight.buttons.boost = 7;
  let reads = 0,
    samples = 0;
  const controller = createOverflightController({
    window: document.defaultView,
    bindings,
    readPads: () => {
      reads++;
      return [pad];
    },
  });
  const normalizer = createDemoControllerFrame({
    getPreferences: () => ({ controllerBindings: bindings }),
  });
  const sample = (modeId, scope = 'flight') => {
    samples++;
    const controls = controller.sample({ scope, spectator: true, timeMs: samples * 20 });
    return normalizer.sample(
      {
        ...controls,
        flight: controls,
        ui: { ...controls.ui, confirm: controls.ui.confirmCommit },
        sharedController: controller.sharedFrame,
        sharedRawProfile: controller.rawProfile,
        gamepads: controller.gamepads,
        now: samples * 20,
      },
      { ...flightScope(modeId), scope },
    );
  };
  sample('snake');
  pad.axes[2] = 0.8;
  assert.equal(sample('snake').flight.direction, 'left');
  pad.axes[2] = 0;
  sample('snake');
  pad.buttons[1].pressed = true;
  assert.equal(sample('snake').ui.back, true, 'watching Back retains the shared menu meaning');
  pad.buttons[1].pressed = false;
  sample('survival');
  pad.axes[2] = 0.6;
  pad.axes[3] = -0.5;
  const movement = sample('survival').flight;
  assert.deepEqual(
    { x: movement.x, y: movement.y, direction: movement.direction },
    { x: -0.6, y: -0.5, direction: null },
  );
  pad.axes = [0, 0, 0, 0];
  sample('survival', 'menu:demo');
  pad.buttons[0].pressed = true;
  assert.equal(sample('survival', 'menu:demo').ui.confirm, false);
  pad.buttons[0].pressed = false;
  assert.equal(sample('survival', 'menu:demo').ui.confirm, true);
  assert.equal(reads, samples, 'normalization performs no additional hardware poll');
  normalizer.dispose();
  controller.destroy();
});

for (const modeId of ['solo', 'snake']) {
  test(`Survival-origin ${modeId} practice honors shared RB and toggle boost while native Survival keeps its momentary RT dash`, (t) => {
    const pad = gamepad(),
      document = new Document();
    let reads = 0,
      samples = 0;
    const controller = createOverflightController({
      window: document.defaultView,
      readPads: () => {
        reads++;
        return [pad];
      },
    });
    const preferences = Object.freeze({ controllerBoostMode: 'toggle', controllerBindings: null });
    const normalizer = createDemoControllerFrame({ getPreferences: () => preferences });
    t.after(() => {
      normalizer.dispose();
      controller.destroy();
    });
    const sample = (mode = modeId) => {
      samples++;
      const controls = controller.sample({
        scope: 'flight',
        spectator: false,
        timeMs: samples * 20,
      });
      return normalizer.sample(
        {
          flight: controls,
          ui: controls.ui,
          sharedController: controller.sharedFrame,
          sharedRawProfile: controller.rawProfile,
          gamepads: controller.gamepads,
          now: samples * 20,
        },
        { modeId: mode, scope: 'flight', spectator: false, toggleBoostEligible: true },
      );
    };
    sample();
    sample();
    pad.buttons[7].pressed = true;
    assert.equal(sample().flight.boost, false, 'native RT default is not the shared Boost action');
    pad.buttons[7].pressed = false;
    sample();
    pad.buttons[5].pressed = true;
    assert.equal(sample().flight.boost, true);
    pad.buttons[5].pressed = false;
    assert.equal(sample().flight.boost, true, 'saved toggle remains on after release');
    normalizer.clear();
    assert.equal(sample().flight.boost, false, 'return/scene changes disarm the toggle');
    sample('survival');
    sample('survival');
    pad.buttons[7].pressed = true;
    assert.equal(sample('survival').flight.boost, true);
    pad.buttons[7].pressed = false;
    assert.equal(sample('survival').flight.boost, false, 'native Survival remains momentary');
    assert.equal(reads, samples, 'only the originating owner polls hardware');
    assert.deepEqual(preferences, { controllerBoostMode: 'toggle', controllerBindings: null });
  });
}

test('Survival-origin shared flight retains admitted raw radio calibration and rejects other captured devices', (t) => {
  const pad = gamepad(),
    document = new Document();
  pad.mapping = '';
  pad.id = 'Configured shared radio';
  pad.axes[2] = -1;
  const profile = emptyProfile(pad, 'radio', 'Radio'),
    axis = (index, end) => ({ kind: 'axis', index, center: 0, end, press: 0.35, release: 0.25 });
  profile.flight.right = [axis(0, 1)];
  profile.flight.left = [axis(0, -1)];
  profile.flight.up = [axis(3, -1)];
  profile.flight.down = [axis(3, 1)];
  profile.flight.boost = [{ kind: 'button', index: 22, threshold: 0.5, invert: false }];
  profile.menu.confirm = [{ kind: 'button', index: 20, threshold: 0.5, invert: false }];
  const saved = JSON.stringify({
    format: 'RadioSetup.v1',
    entries: [{ profiles: [profile], seats: [null] }],
  });
  let writes = 0,
    reads = 0,
    samples = 0;
  document.defaultView.localStorage = {
    getItem: (key) => (key === SOLO_RESTORE_KEY ? saved : null),
    setItem() {
      writes++;
    },
  };
  const controller = createOverflightController({
    window: document.defaultView,
    readPads: () => {
      reads++;
      return [pad];
    },
  });
  const normalizer = createDemoControllerFrame({
    getPreferences: () => ({ controllerBoostMode: 'toggle' }),
  });
  t.after(() => {
    normalizer.dispose();
    controller.destroy();
  });
  const extra = { ...gamepad(), index: 1 };
  const sample = (scope = 'flight') => {
    samples++;
    const controls = controller.sample({ scope, spectator: false, timeMs: samples * 20 });
    return normalizer.sample(
      {
        flight: controls,
        ui: { ...controls.ui, confirm: controls.ui.confirmCommit },
        sharedController: controller.sharedFrame,
        sharedRawProfile: controller.rawProfile,
        gamepads: [...controller.gamepads, extra],
        now: samples * 20,
      },
      { modeId: 'solo', scope, spectator: false, toggleBoostEligible: true },
    );
  };
  sample();
  sample();
  extra.axes[0] = 0.9;
  assert.equal(sample().flight.direction, null, 'unassigned captured pad cannot steer');
  pad.axes[0] = 0.7;
  assert.equal(sample().flight.direction, 'right');
  pad.axes[0] = 0;
  sample();
  pad.buttons[22].value = 1;
  assert.equal(sample().flight.boost, true);
  pad.buttons[22].value = 0;
  assert.equal(sample().flight.boost, true, 'radio Boost also uses saved shared toggle policy');
  sample('menu:demo');
  pad.buttons[20].value = 1;
  assert.equal(sample('menu:demo').ui.confirm, false, 'native press still waits for release');
  pad.buttons[20].value = 0;
  assert.equal(sample('menu:demo').ui.confirm, true);
  pad.id = 'Unknown radio with same counts';
  assert.equal(sample().flight.direction, null);
  assert.equal(sample().assigned, null, 'raw calibration is never reused for a different identity');
  assert.equal(reads, samples);
  assert.equal(writes, 0);
});

test('SIM receives its original raw frame for native throttle and verified radio handling', () => {
  const normalizer = createDemoControllerFrame();
  const frame = { gamepads: [gamepad()], now: 1234 };
  assert.equal(normalizer.sample(frame, flightScope('sim')), frame);
  normalizer.dispose();
});
