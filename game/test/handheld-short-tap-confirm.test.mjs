import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, SoloElement } from './helpers/solo-dom.mjs';

function steamDeckController() {
  return {
    index: 0,
    id: 'Steam Deck Controller',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
}

test('actual host: a Steam Deck short-tap release pulse toggles Home Sound exactly once', async (t) => {
  t.mock.method(SoloElement.prototype, 'getContext', () => null);
  const pad = steamDeckController();
  const page = await soloPage(t, { titleScreen: true, readPads: () => [pad] });
  const sound = page.$('shell-sound');

  page.frame(121);
  sound.focus();
  const before = sound.getAttribute('aria-pressed');

  pad.buttons[0].pressed = true;
  pad.buttons[0].value = 1;
  page.frame(8);
  const afterPress = sound.getAttribute('aria-pressed');
  assert.notEqual(afterPress, before, 'the initial A press activates Sound');

  pad.buttons[0].pressed = false;
  pad.buttons[0].value = 0;
  page.frame(8);
  pad.buttons[2].pressed = true;
  pad.buttons[2].value = 1;
  page.frame(8);
  assert.equal(
    sound.getAttribute('aria-pressed'),
    afterPress,
    'the release-side Confirm pulse cannot undo Sound',
  );

  pad.buttons[2].pressed = false;
  pad.buttons[2].value = 0;
  page.frame(8);
  await new Promise((resolve) => setTimeout(resolve, 130));
  page.frame(0);
  assert.equal(sound.getAttribute('aria-pressed'), afterPress);

  pad.buttons[0].pressed = true;
  pad.buttons[0].value = 1;
  page.frame(8);
  assert.equal(
    sound.getAttribute('aria-pressed'),
    before,
    'a separate press after stable neutral remains usable',
  );
  assert.deepEqual(page.errors, []);
});
