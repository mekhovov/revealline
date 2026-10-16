import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { attachDownloadsNavigation } from '../ui/downloads-navigation.mjs';

function fixture(t) {
  const doc = new Document(),
    win = doc.defaultView,
    frames = new Map();
  doc.parentNode = win;
  let time = 1000,
    serial = 0,
    activations = 0,
    reads = 0;
  Object.assign(win, {
    requestAnimationFrame(callback) {
      frames.set(++serial, callback);
      return serial;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
  });
  const button = doc.createElement('button');
  button.id = 'download-game';
  button.onclick = () => activations++;
  doc.body.append(button);
  const pad = {
    id: 'Downloads virtual pad',
    index: 0,
    mapping: 'standard',
    connected: true,
    timestamp: time,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  const owner = attachDownloadsNavigation({
    document: doc,
    window: win,
    now: () => time,
    readPads: () => {
      reads++;
      return [pad];
    },
  });
  t.after(() => owner.dispose());
  const tick = (ms = 16) => {
    time += ms;
    pad.timestamp = time;
    assert.equal(frames.size, 1);
    const [id, callback] = frames.entries().next().value;
    frames.delete(id);
    callback(time);
  };
  const held = (value) => {
    pad.buttons[0] = { pressed: value, value: Number(value) };
  };
  tick();
  return {
    doc,
    win,
    button,
    owner,
    frames,
    tick,
    held,
    activations: () => activations,
    reads: () => reads,
  };
}

test('Downloads Confirm waits for release and suppresses compatibility clicks', (t) => {
  const h = fixture(t);
  assert.equal(h.doc.activeElement, h.button);
  h.held(true);
  h.tick();
  assert.equal(h.activations(), 0);
  h.button.emit('click', { isTrusted: true });
  h.tick(5000);
  assert.equal(h.activations(), 0, 'native events cannot commit a held controller press');
  h.held(false);
  h.tick();
  assert.equal(h.activations(), 1);
  h.button.emit('click', { isTrusted: true });
  h.tick();
  assert.equal(h.activations(), 1, 'one controller gesture has one activation');
});

test('Downloads captures a complete native Confirm tap between frames', (t) => {
  const h = fixture(t);
  h.held(true);
  assert.equal(h.button.emit('keydown', { key: 'Enter', isTrusted: true }).defaultPrevented, true);
  assert.equal(h.activations(), 0);
  h.held(false);
  assert.equal(h.button.emit('keyup', { key: 'Enter', isTrusted: true }).defaultPrevented, true);
  assert.equal(h.activations(), 1);
  h.button.emit('click', { isTrusted: true });
  h.tick();
  assert.equal(h.activations(), 1);
});

test('Downloads hidden ownership cancels a held action and disposal retires its poller', (t) => {
  const h = fixture(t);
  h.held(true);
  h.tick();
  h.owner.setVisible(false);
  const reads = h.reads();
  h.tick();
  assert.equal(h.reads(), reads);
  h.owner.setVisible(true);
  h.tick();
  h.held(false);
  h.tick();
  assert.equal(h.activations(), 0, 'visibility handoff cannot commit the old target');
  h.held(true);
  h.tick();
  h.held(false);
  h.tick();
  assert.equal(h.activations(), 1, 'a fresh neutral-gated gesture remains available');
  h.owner.dispose();
  assert.equal(h.frames.size, 0);
});

test('Downloads can Confirm again after activation synchronously blurs the page', (t) => {
  const h = fixture(t);
  let clicks = 0;
  h.button.onclick = () => {
    clicks++;
    if (clicks === 1) h.win.emit('blur');
  };
  h.held(true);
  h.tick();
  h.held(false);
  h.tick();
  assert.equal(clicks, 1);
  h.win.emit('focus');
  h.tick();
  h.held(true);
  h.tick();
  h.held(false);
  h.tick();
  assert.equal(clicks, 2, 'a fresh gesture still commits after the activation handed away focus');
  h.button.emit('click', { isTrusted: true });
  assert.equal(clicks, 2, 'the new gesture still suppresses its compatibility click');
});
