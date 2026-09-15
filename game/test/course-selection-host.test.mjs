// The actual Solo host, course and selection decision run here. DOM/Phaser and
// physical devices are modeled; no lesson transition or authoritative run is stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

function frames(h, count = 8) {
  for (let i = 0; i < count; i++) h.frame();
}
function checkpoint(h) {
  h.frame(0);
  return authoritativeCheckpoint(h.rendered.run);
}
function choose(h, id) {
  const select = h.$('first-flight-select');
  select.focus();
  select.value = id;
  select.emit('change');
}
function key(h, value, repeat = false) {
  const target = h.doc.activeElement;
  const event = target.emit('keydown', { key: value, code: value, repeat });
  if (!event.defaultPrevented && value === 'Enter' && target.tagName === 'BUTTON') target.click();
  target.emit('keyup', { key: value, code: value });
  return event;
}
async function click(h, id) {
  const node = h.$(id),
    original = node.onclick;
  let pending;
  node.onclick = function (...args) {
    pending = original.apply(this, args);
    return pending;
  };
  try {
    node.click();
  } finally {
    node.onclick = original;
  }
  await pending;
}
async function setup(t, turnPolicy = 'grid-center', active = true) {
  const storage = memoryStorage({ sentinel: 'keep original player data' });
  const h = await soloPage(t, {
    storage,
    search: `?course=first-flight&lesson=close-line&turn-policy=${turnPolicy}`,
  });
  if (active) {
    h.$('start-button').click();
    await settle(() => h.doc.body.dataset.flightState === 'running');
    h.key('ArrowDown');
    frames(h, 27);
    h.key('ArrowDown', false);
    h.key('ArrowRight');
    h.frame();
    h.key('ArrowRight', false);
    assert.equal(h.rendered.run.player.cutting, true);
    if (turnPolicy === 'grid-center') assert.equal(h.rendered.run.player.queuedDirection, 'right');
  }
  return h;
}
function assertKept(h, run, before, bytes, writes) {
  frames(h);
  assert.equal(h.rendered.run, run);
  assert.deepEqual(checkpoint(h), before);
  assert.equal(h.rendered.paused, true);
  assert.equal(h.$('first-flight-select').value, 'close-line');
  assert.deepEqual([...h.storage.map], bytes);
  assert.equal(h.storage.writes.length, writes);
  assert.deepEqual(h.errors, []);
}
for (const policy of ['immediate', 'grid-center'])
  for (const method of ['Stay', 'Escape', 'controller'])
    test(`${policy}: live lesson choice ${method} preserves the exact cut and returns to its selector`, async (t) => {
      const h = await setup(t, policy),
        run = h.rendered.run,
        before = checkpoint(h),
        bytes = [...h.storage.map],
        writes = h.storage.writes.length;
      choose(h, 'empty-side');
      assert.equal(h.$('mission-replace-dialog').open, true);
      assert.equal(h.doc.activeElement.id, 'mission-replace-stay');
      assert.equal(h.$('mission-replace-confirm').textContent, 'Prepare fresh lesson');
      assert.match(h.$('mission-replace-status').textContent, /session-only.*not saved/);
      assert.doesNotMatch(h.$('mission-replace-status').textContent, /saved and verified/);
      assertKept(h, run, before, bytes, writes);
      if (method === 'Stay') h.$('mission-replace-stay').click();
      else if (method === 'Escape') {
        const e = key(h, 'Escape');
        if (!e.defaultPrevented) {
          const cancel = h.$('mission-replace-dialog').emit('cancel', { bubbles: false });
          if (!cancel.defaultPrevented) h.$('mission-replace-dialog').close();
        }
      } else {
        const pad = {
          index: 0,
          id: 'Course choice',
          connected: true,
          mapping: 'standard',
          axes: [0, 0, 0, 0],
          buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
        };
        navigator.getGamepads = () => [pad];
        h.frame();
        pad.buttons[1] = { pressed: true, value: 1 };
        h.frame();
        pad.buttons[1] = { pressed: false, value: 0 };
        h.frame();
      }
      assert.equal(h.$('mission-replace-dialog').open, false);
      assert.equal(h.doc.activeElement.id, 'first-flight-select');
      assertKept(h, run, before, bytes, writes);
    });
for (const policy of ['immediate', 'grid-center'])
  test(`${policy}: only Prepare adopts the requested lesson, paused at tick zero without awards`, async (t) => {
    const h = await setup(t, policy),
      run = h.rendered.run,
      bytes = [...h.storage.map],
      writes = h.storage.writes.length;
    choose(h, 'empty-side');
    // A second modeled native change cannot replace the current decision's choice.
    choose(h, 'picture-home');
    assert.equal(h.$('first-flight-select').value, 'close-line');
    await click(h, 'mission-replace-confirm');
    h.frame(0);
    assert.notEqual(h.rendered.run, run);
    assert.equal(h.rendered.run.levelId, 'first-flight-empty-side');
    assert.equal(h.rendered.run.turnPolicy, policy);
    assert.equal(h.rendered.run.tick, 0);
    assert.equal(h.rendered.paused, true);
    assert.equal(h.$('first-flight-select').value, 'empty-side');
    assert.equal(h.$('mission-replace-dialog').open, false);
    assert.equal(h.doc.activeElement.id, 'start-button');
    assert.equal(key(h, 'Enter', true).defaultPrevented, true);
    frames(h);
    assert.equal(h.rendered.run.tick, 0, 'Held Prepare cannot start the next lesson.');
    assert.deepEqual([...h.storage.map], bytes);
    assert.equal(h.storage.writes.length, writes);
    key(h, 'Enter');
    frames(h);
    assert.equal(h.rendered.paused, false, 'A fresh explicit Start still works.');
    assert.deepEqual(h.errors, []);
  });
for (const active of [false, true])
  test(`same lesson selection in ${active ? 'flight' : 'ready'} is inert`, async (t) => {
    const h = await setup(t, 'grid-center', active),
      run = h.rendered.run,
      before = checkpoint(h),
      bytes = [...h.storage.map],
      writes = h.storage.writes.length;
    choose(h, 'close-line');
    assert.equal(h.rendered.run, run);
    assert.deepEqual(checkpoint(h), before);
    assert.equal(h.$('mission-replace-dialog').open, false);
    assert.equal(h.rendered.paused, !active);
    assert.deepEqual([...h.storage.map], bytes);
    assert.equal(h.storage.writes.length, writes);
  });
test('fresh Ready choice remains direct; unknown lesson cannot replace it', async (t) => {
  const h = await setup(t, 'immediate', false),
    before = h.rendered.run,
    bytes = [...h.storage.map],
    writes = h.storage.writes.length;
  choose(h, 'empty-side');
  h.frame(0);
  assert.notEqual(h.rendered.run, before);
  assert.equal(h.rendered.run.levelId, 'first-flight-empty-side');
  assert.equal(h.rendered.run.tick, 0);
  assert.equal(h.rendered.paused, true);
  const ready = h.rendered.run;
  choose(h, '../unregistered');
  h.frame(0);
  assert.equal(h.rendered.run, ready);
  assert.equal(h.$('first-flight-select').value, 'empty-side');
  assert.equal(h.$('mission-replace-dialog').open, false);
  assert.deepEqual([...h.storage.map], bytes);
  assert.equal(h.storage.writes.length, writes);
});
test('pending choice cannot be bypassed by Skip or Exit; cancelled choice releases those deliberate actions', async (t) => {
  const h = await setup(t),
    run = h.rendered.run,
    before = checkpoint(h),
    bytes = [...h.storage.map],
    writes = h.storage.writes.length;
  const destinations = [];
  globalThis.location.assign = (url) => destinations.push(url);
  choose(h, 'picture-home');
  h.$('first-flight-skip').click();
  h.$('first-flight-exit').click();
  assertKept(h, run, before, bytes, writes);
  assert.deepEqual(destinations, []);
  h.$('mission-replace-stay').click();
  h.$('first-flight-skip').click();
  h.frame(0);
  assert.equal(h.rendered.run.levelId, 'first-flight-empty-side');
  assert.equal(h.$('first-flight-select').value, 'empty-side');
  assert.equal(h.rendered.paused, true);
  assert.equal(h.storage.writes.length, writes);
  h.$('first-flight-exit').click();
  assert.deepEqual(destinations, ['http://localhost/game/']);
});
test('page departure invalidates a pending lesson choice before a delayed Confirm can act', async (t) => {
  const h = await setup(t),
    run = h.rendered.run,
    before = checkpoint(h),
    bytes = [...h.storage.map],
    writes = h.storage.writes.length;
  choose(h, 'empty-side');
  h.win.emit('pagehide', { persisted: true });
  await click(h, 'mission-replace-confirm');
  assertKept(h, run, before, bytes, writes);
});
