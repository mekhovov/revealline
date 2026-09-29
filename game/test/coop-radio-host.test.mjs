import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';

const radio = (index = 0) =>
  Object.create({
    index,
    id: 'TX15 Joystick (Vendor: 1209 Product: 4f54)',
    mapping: '',
    connected: true,
    axes: Array(8).fill(0),
    buttons: Array.from({ length: 24 }, () => ({ value: 0, pressed: false })),
  });
const controller = () => ({
  index: 3,
  id: 'Standard gamepad',
  connected: true,
  mapping: 'standard',
  axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, () => ({ value: 0, pressed: false })),
});

for (const layout of ['shared radio', 'two radios', 'radio and gamepad']) {
  test(`Team host assigns ${layout}, preserves touch fallback and pauses on loss`, async (t) => {
    const f = await page(t, { touch: true });
    const a = radio();
    f.pads.push(a);
    if (layout !== 'shared radio') f.pads.push(layout === 'two radios' ? radio(3) : controller());
    f.tick(2);
    f.$('coop-settings-open').click();
    f.$('coop-settings-tab-controls').click();
    f.tick();
    const click = (key) => f.doc.querySelector(`[data-controller-action="${key}"]`).click();
    const area = f.doc.querySelector('.multiplayer-controllers');
    const choose = (index) => {
      const select = area.querySelector('select');
      select.value = String(index);
      select.emit('change');
      f.tick();
    };
    if (layout === 'shared radio') {
      click('tx15Shared');
    } else {
      click('tx15Right');
      click('join1');
      choose(3);
      if (layout === 'two radios') click('tx15Right');
      click('join2');
    }
    f.tick(2);
    assert.match(area.textContent, /Player 1: TX15/);
    assert.match(
      area.textContent,
      layout === 'radio and gamepad' ? /Player 2:.*Standard/ : /Player 2: TX15/,
    );
    f.$('coop-settings-close').click();
    f.$('coop-start').click();
    f.tick(3);
    assert.equal(f.$('coop-overlay').hidden, true);
    assert.equal(f.touchPads[0].hidden, false, 'movement-only radio keeps touch actions');
    assert.equal(f.touchPads[1].hidden, layout === 'radio and gamepad');
    a.connected = false;
    f.tick(2);
    assert.equal(f.$('coop-overlay').hidden, false, 'assigned radio loss pauses the real host');
    const time = f.$('coop-clock').textContent;
    f.tick(60);
    assert.equal(f.$('coop-clock').textContent, time);
  });
}
