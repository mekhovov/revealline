import test from 'node:test';
import assert from 'node:assert/strict';
import { createSoloRadioInput, SOLO_RADIO_PROFILE_KEY } from '../ui/solo-radio-input.mjs';
import { createControllerRouter } from '../ui/controller-router.mjs';
import { emptyProfile, createProfileStore, PROFILE_KEY } from '../couch/controller-profiles.mjs';
import { DEFAULT_CONTROLLER_BINDINGS } from '../controller-bindings.mjs';

function fixture(bindings = null) {
  let scope = 'settings';
  const pad = {
    index: 0,
    id: 'TX15',
    connected: true,
    mapping: '',
    axes: [0, 0, -1, 0, 0, 0, 0, 0],
    buttons: Array.from({ length: 24 }, () => ({ value: 0 })),
  };
  pad.buttons[6].value = 1; // Unmapped switch must not prevent neutral.
  let pads = [pad];
  const input = createSoloRadioInput({
    readPads: () => pads,
    eventTarget: null,
    getScope: () => scope,
  });
  const router = createControllerRouter({
    ...input,
    eventTarget: null,
    autoJoin: true,
    navigationAliases: true,
    bindings,
  });
  input.readPads();
  const profile = emptyProfile(pad, 'tx15', 'TX15');
  const axis = (index, end) => ({
    kind: 'axis',
    index,
    center: 0,
    end,
    press: 0.35,
    release: 0.25,
  });
  profile.flight.up = [axis(3, -1)];
  profile.flight.down = [axis(3, 1)];
  profile.flight.right = [axis(0, 1)];
  profile.flight.left = [axis(0, -1)];
  profile.menu.up = [axis(3, -1)];
  profile.menu.down = [axis(3, 1)];
  const button = (index) => ({ kind: 'button', index, threshold: 0.5, invert: false });
  profile.flight.action = [button(23)];
  profile.flight.boost = [button(22)];
  profile.flight.pause = [button(21)];
  profile.menu.confirm = [button(20)];
  assert.equal(input.session.apply(0, profile), true);
  scope = 'flight';
  const sample = () => router.sample({ scope });
  return {
    pad,
    profile,
    input,
    router,
    sample,
    scope: (value) => {
      scope = value;
    },
    pads: (value) => {
      pads = value;
    },
  };
}

test('Solo radio maps chosen axes, ignores unmapped throttle/switch, preserves raw snapshots', () => {
  const f = fixture();
  const before = structuredClone(f.pad);
  assert.equal(f.sample().status.code, 'joined');
  assert.deepEqual(f.pad, before);
  f.pad.axes[3] = -0.8;
  assert.equal(f.sample().flight.direction, 'up');
  f.pad.axes[3] = -0.3;
  assert.equal(f.sample().flight.direction, 'up');
  f.pad.axes[3] = -0.2;
  assert.equal(f.sample().flight.direction, null);
  f.pad.buttons[23].value = 1;
  assert.equal(f.sample().flight.action, true);
  f.pad.buttons[23].value = 0;
  f.pad.axes[2] = 1;
  assert.equal(f.sample().flight.direction, null);
});

test('Solo radio uses semantic actions with remapped standard bindings and guarded menu confirms', () => {
  const bindings = structuredClone(DEFAULT_CONTROLLER_BINDINGS);
  [bindings.flight.buttons.ability, bindings.flight.buttons.pickup] = [2, 0];
  [bindings.menu.buttons.confirm, bindings.menu.buttons.back] = [1, 0];
  const f = fixture(bindings);
  f.sample();
  f.pad.buttons[23].value = 1;
  assert.equal(f.sample().flight.action, true);
  assert.equal(f.sample().flight.pickup, false);
  f.pad.buttons[23].value = 0;
  f.scope('settings');
  f.sample();
  f.pad.buttons[20].value = 1;
  assert.equal(f.router.readMenuConfirm({ scope: 'settings' }).held, true);
  assert.equal(f.sample().ui.confirm, true);
  assert.equal(f.sample().ui.confirm, false);
});

test('Capture, scope transitions and reconnect require release; reconnect requires reapplying raw profile', () => {
  const f = fixture();
  f.sample();
  f.pad.axes[3] = -1;
  assert.equal(f.sample().flight.direction, 'up');
  f.router.clear();
  assert.equal(f.sample().flight.direction, null);
  f.pad.axes[3] = 0;
  f.sample();
  f.scope('settings');
  f.sample();
  f.input.session.capture(true);
  assert.equal(f.sample().disconnected, true);
  f.input.session.capture(false);
  assert.equal(f.sample().status.code, 'joined');
  f.pads([]);
  assert.equal(f.sample().disconnected, true);
  f.pads([f.pad]);
  assert.equal(f.sample().status.code, 'unsupported');
  f.input.session.apply(0, f.profile);
  assert.equal(f.sample().status.code, 'joined');
});

test('Standard gamepads pass through unchanged and profile stores remain isolated', () => {
  const f = fixture();
  f.pad.mapping = 'standard';
  assert.equal(f.input.readPads()[0], f.pad);
  assert.equal(f.input.rawProfile(0), undefined);
  f.pad.axes[2] = 0;
  f.pad.buttons[6].value = 0;
  assert.equal(f.sample().status.code, 'joined');
  f.pad.axes[0] = 1;
  assert.equal(f.sample().flight.direction, 'right');
  const data = new Map([
    [PROFILE_KEY, 'original multiplayer bytes'],
    ['RadioProfile.v1', 'original radio bytes'],
  ]);
  const store = createProfileStore(
    { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) },
    SOLO_RADIO_PROFILE_KEY,
  );
  assert.equal(store.put(f.profile), true);
  assert.equal(data.get(PROFILE_KEY), 'original multiplayer bytes');
  assert.equal(data.get('RadioProfile.v1'), 'original radio bytes');
});
