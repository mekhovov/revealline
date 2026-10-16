// Run against the optional FPV feature checkout (or this checkout once it is merged).
// node scripts/check-couch-radio-compat.mjs /path/to/revealline-with-fpv
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createControllerSession } from '../game/couch/controller-session.mjs';
import { createProfileStore, emptyProfile } from '../game/couch/controller-profiles.mjs';
const root = path.resolve(process.argv[2] || '.');
const moduleURL = (name) => pathToFileURL(path.join(root, 'optional-practice/civilian-fpv', name));
const {
  validateRadioProfile,
  radioDeviceIdentity,
  normalizeRadioInput,
  exportRadioProfile,
  createFlightProfileStore,
  DEFAULT_RESPONSE,
} = await import(moduleURL('radio-profile.mjs'));
const { createRadioRuntime } = await import(moduleURL('radio-runtime.mjs'));
const pad = {
  index: 3,
  id: 'EdgeTX Classic',
  mapping: '',
  connected: true,
  axes: [0, 0, 0, 0, -1, 0, 0, 0],
  buttons: Array.from({ length: 24 }, () => ({ value: 0 })),
  timestamp: 0,
};
const profile = validateRadioProfile({
  format: 'RadioProfile.v1',
  id: 'compat-radio',
  name: 'Compatibility radio',
  device: radioDeviceIdentity(pad),
  stickMode: 2,
  throttleStyle: 'full-travel',
  verified: true,
  channels: Object.fromEntries(
    ['roll', 'pitch', 'yaw', 'throttle'].map((name, i) => [
      name,
      {
        axis: [6, 2, 0, 4][i],
        min: -1,
        max: 1,
        center: name === 'throttle' ? null : 0,
        invert: name === 'pitch',
        deadZone: name === 'throttle' ? 0 : 0.02,
      },
    ]),
  ),
  switches: { arm: null, pause: null, reset: null },
});
const bytes = exportRadioProfile(profile);
const values = new Map();
const storage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
};
const flightStore = createFlightProfileStore({ storage });
// Preserve a real serialized FPV profile, including its independent response profile.
flightStore.save({ format: 'FlightProfiles.v1', radio: profile, response: DEFAULT_RESPONSE });
const saved = storage.getItem('revealline.flight-profiles.v1');
assert.ok(saved);
const couch = createControllerSession({ eventTarget: null });
couch.sample([pad]);
const recipe = emptyProfile(pad, 'couch-radio', 'Couch radio');
recipe.flight.right = [{ kind: 'axis', index: 6, center: 0, end: 1, press: 0.35, release: 0.25 }];
recipe.menu.confirm = [{ kind: 'button', index: 23, threshold: 0.5, invert: false }];
couch.apply(3, recipe);
couch.assign(3, 0);
createProfileStore(storage).put(recipe);
assert.equal(storage.getItem('revealline.flight-profiles.v1'), saved);
const radio = createRadioRuntime({ getGamepads: () => [pad] });
radio.select(3);
radio.setProfile(profile);
radio.verify();
radio.poll();
assert.equal(radio.requestArm(), true);
for (const throttle of [-1, -0.5, 0, 0.5, 1]) {
  pad.axes[4] = throttle;
  pad.axes[6] = 0.7;
  const before = JSON.stringify(pad),
    expected = normalizeRadioInput(profile, pad);
  couch.sample([pad], { active: true });
  assert.equal(JSON.stringify(pad), before);
  assert.deepEqual(radio.poll(), expected);
  assert.equal(expected.throttle, (throttle + 1) / 2);
}
assert.equal(exportRadioProfile(profile), bytes);
radio.freeze('paused');
pad.axes[4] = -1;
pad.axes[6] = 0;
couch.clear();
couch.sample([pad]);
assert.equal(radio.requestArm(), false);
assert.equal(radio.status().reason, 'pickup-controls');
pad.axes[4] = 1;
pad.axes[6] = 0.7;
assert.equal(radio.requestArm(), true);
radio.disconnect(3);
assert.equal(radio.status().active, false);
assert.equal(storage.getItem('revealline.flight-profiles.v1'), saved);
couch.dispose();
console.log(
  'Couch / FPV compatibility passed: separate storage, unchanged raw channels, full throttle travel, arm and airborne pickup.',
);
