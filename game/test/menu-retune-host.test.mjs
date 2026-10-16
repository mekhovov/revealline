import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage } from './helpers/solo-dom.mjs';
import { couchPage } from './helpers/couch-host.mjs';

test(
  'actual Solo title waits for committed Missions and keeps the real chooser focus',
  { timeout: 120000 },
  async (t) => {
    const page = await soloPage(t, { titleScreen: true });
    assert.equal(page.doc.querySelector('.menu-retune-layer'), null, 'Boot does not retune.');
    const action = page.$('shell-play'),
      handler = action.onclick;
    let opening;
    action.onclick = (...args) => (opening = handler.apply(action, args));
    try {
      action.focus();
      action.click();
    } finally {
      action.onclick = handler;
    }
    assert.ok(opening instanceof Promise);
    await opening;
    assert.equal(page.$('journey-chooser')?.open, true);
    const chooser = page.$('journey-chooser'),
      layer = chooser.querySelector('.menu-retune-layer');
    assert.ok(layer, 'The real native landing opts its committed picker into decoration.');
    assert.ok(chooser.contains(page.doc.activeElement));
    assert.notEqual(page.doc.activeElement, layer);
    assert.equal(layer.getAttribute('inert'), '');
    page.$('journey-back').click();
    assert.equal(page.$('shell-home').open, true);
    assert.deepEqual(page.errors, []);
  },
);

test('actual Versus ready setup retunes while Settings, Start and Pause do not', async (t) => {
  const page = await couchPage(t);
  assert.equal(page.doc.querySelector('.menu-retune-layer'), null);
  page.$('race-focus').click();
  assert.equal(page.$('race-setup').hidden, false);
  assert.ok(page.$('race-setup').querySelector('.menu-retune-layer'));
  page.$('race-setup-back').click();
  page.$('race-options').click();
  assert.equal(page.$('race-options-panel').querySelector('.menu-retune-layer'), null);
  page.$('race-options-back').click();
  page.$('race-start').click();
  page.frame();
  page.frame();
  assert.equal(page.$('race-pause').disabled, false);
  page.$('race-pause').click();
  page.frame(0);
  assert.equal(page.state(), 'paused');
  assert.equal(page.$('race-main').querySelector('.menu-retune-layer'), null);
});
