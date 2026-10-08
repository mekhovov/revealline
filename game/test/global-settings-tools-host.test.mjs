import test from 'node:test';
import assert from 'node:assert/strict';
import { couchPage } from './helpers/couch-host.mjs';
import { page as teamPage } from './helpers/coop-host.mjs';
const settle = () => new Promise((resolve) => setImmediate(resolve));

test('paused Versus opens shared recovery and returns through keyboard Back without replacing either run', async (t) => {
  const page = await couchPage(t, { nativeKeyboard: true });
  page.$('race-start').click();
  page.frame();
  page.$('race-pause').click();
  page.frame();
  const before = page.checkpoint();
  page.$('race-options').click();
  page.$('race-settings-tab-data').click();
  const opener = page.$('profile-recovery-open');
  assert.ok(page.$('race-settings-panel-data').contains(opener));
  opener.focus();
  opener.click();
  assert.equal(page.$('profile-recovery-dialog').open, true);
  assert.equal(page.$('race-options-panel').hidden, false);
  page.key('Escape', true, page.doc.activeElement);
  page.key('Escape', false, page.doc.activeElement);
  await settle();
  assert.equal(page.$('profile-recovery-dialog').open, false);
  assert.equal(page.doc.activeElement, opener);
  page.frames(3);
  assert.equal(page.state(), 'paused');
  assert.deepEqual(page.checkpoint(), before);
});

test('Team shared tool dialog is inside the controller/keyboard scope and Back keeps Settings above Pause', async (t) => {
  const page = await teamPage(t, { nativeFocus: true, nativeVisibility: true });
  page.$('coop-start').click();
  page.tick(2);
  page.$('coop-pause').click();
  const clock = page.$('coop-clock').textContent;
  page.$('coop-settings-open').click();
  assert.equal(page.$('coop-options').open, true, 'Settings opens after the paused run.');
  page.$('coop-settings-tab-controls').click();
  const opener = page.$('coop-global-controllerTools');
  assert.ok(page.$('coop-settings-panel-controls').contains(opener));
  opener.focus();
  opener.click();
  assert.equal(page.$('coop-global-tool-dialog').open, true);
  assert.equal(page.$('coop-options').open, true);
  page.tap('Escape');
  await settle();
  assert.equal(page.$('coop-global-tool-dialog').open, false);
  assert.equal(page.$('coop-options').open, true);
  assert.equal(page.doc.activeElement, opener);
  opener.click();
  const tool = page.$('coop-global-tool-dialog');
  assert.equal(tool.open, true);
  assert.equal(page.$('coop-options').open, true);
  tool.querySelector('iframe').focus();
  const pad = {
    index: 0,
    id: 'Global tools controller',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  page.pads.push(pad);
  const pulse = (index) => {
    pad.buttons[index] = { pressed: true, value: 1 };
    page.tick();
    pad.buttons[index] = { pressed: false, value: 0 };
    page.tick();
  };
  page.tick(2);
  pulse(0);
  page.tick(20);
  page.tick(2);
  pulse(1);
  assert.equal(tool.open, false, 'Controller Back closes a child whose frame owns focus.');
  assert.equal(page.$('coop-options').open, true);
  assert.equal(page.doc.activeElement, opener);
  page.tick(20);
  assert.equal(page.$('coop-clock').textContent, clock);
  assert.equal(page.$('coop-overlay').hidden, false);
});
