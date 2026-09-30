import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { attachLauncherNavigation } from '../ui/launcher-navigation.mjs';

function fixture() {
  const doc = new Document(),
    win = doc.defaultView,
    frames = new Map(),
    calls = [];
  let sequence = 0,
    now = 0;
  win.requestAnimationFrame = (fn) => {
    frames.set(++sequence, fn);
    return sequence;
  };
  win.cancelAnimationFrame = (id) => frames.delete(id);
  const pad = {
    index: 0,
    id: 'Launcher test pad',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  for (const id of ['play', 'install', 'updates', 'previous', 'prepare']) {
    const button = doc.createElement('button');
    button.id = id;
    button.textContent = id;
    button.onclick = () => calls.push(id);
    doc.body.append(button);
  }
  const host = attachLauncherNavigation({
    document: doc,
    window: win,
    readPads: () => [pad],
    now: () => now,
  });
  const tick = () => {
    const pending = [...frames.values()];
    frames.clear();
    now += 20;
    pending.forEach((fn) => fn(now));
  };
  const press = (index) => {
    pad.buttons[index] = { pressed: true, value: 1 };
    tick();
    pad.buttons[index] = { pressed: false, value: 0 };
    tick();
  };
  return { doc, win, frames, calls, host, pad, tick, press };
}

test('launcher controller reaches visible actions and activates each original handler once', () => {
  const f = fixture();
  f.doc.getElementById('play').hidden = true;
  f.doc.getElementById('install').hidden = true;
  f.doc.getElementById('previous').disabled = true;
  f.tick();
  f.tick();
  f.press(0);
  assert.equal(f.doc.activeElement.id, 'prepare');
  assert.deepEqual(f.calls, ['prepare']);
  f.press(12);
  assert.equal(f.doc.activeElement.id, 'updates');
  f.press(0);
  assert.deepEqual(f.calls, ['prepare', 'updates']);
  f.press(1);
  assert.equal(f.doc.activeElement.id, 'prepare');
  assert.deepEqual(f.calls, ['prepare', 'updates'], 'Back never starts installation or play.');
  f.host.dispose();
});

test('launcher pagehide and blur fence held confirmation; pageshow resumes through neutral input', () => {
  const f = fixture();
  f.tick();
  f.tick();
  f.win.emit('pagehide', { persisted: true });
  assert.equal(f.frames.size, 0);
  f.pad.buttons[0] = { pressed: true, value: 1 };
  f.win.emit('pageshow', { persisted: true });
  f.tick();
  f.tick();
  assert.deepEqual(f.calls, []);
  f.pad.buttons[0] = { pressed: false, value: 0 };
  f.tick();
  f.press(0);
  assert.deepEqual(f.calls, ['play']);
  f.doc.focused = false;
  f.win.emit('blur');
  f.press(0);
  assert.deepEqual(f.calls, ['play']);
  f.host.dispose();
  assert.equal(f.frames.size, 0);
  f.win.emit('pageshow');
  assert.equal(f.frames.size, 0);
});

test('launcher keyboard arrows and Back reach actions without activating them', () => {
  const f = fixture();
  f.doc.getElementById('updates').focus();
  const down = f.doc.activeElement.emit('keydown', { key: 'ArrowDown', code: 'ArrowDown' });
  assert.equal(down.defaultPrevented, true);
  assert.equal(f.doc.activeElement.id, 'previous');
  f.doc.activeElement.emit('keydown', { key: 'Escape', code: 'Escape' });
  assert.equal(f.doc.activeElement.id, 'play');
  assert.deepEqual(f.calls, []);
  f.host.dispose();
});

test('launcher consumes native Confirm echoes and commits only the controller release', () => {
  const f = fixture();
  f.tick();
  f.tick();
  f.pad.buttons[0] = { pressed: true, value: 1 };
  f.tick();
  const target = f.doc.activeElement;
  assert.equal(target.id, 'play');
  assert.equal(
    target.emit('keydown', { key: 'Enter', code: 'Enter', isTrusted: true }).defaultPrevented,
    true,
  );
  assert.equal(
    target.emit('click', { button: 0, detail: 0, isTrusted: true }).defaultPrevented,
    true,
  );
  assert.deepEqual(f.calls, []);
  f.pad.buttons[0] = { pressed: false, value: 0 };
  f.tick();
  assert.deepEqual(f.calls, ['play']);
  assert.equal(
    target.emit('click', { button: 0, detail: 0, isTrusted: true }).defaultPrevented,
    true,
  );
  assert.deepEqual(f.calls, ['play']);
  f.host.dispose();
});

test('company launcher defaults and Back focus its Check action until preparation is available', () => {
  const f = fixture();
  for (const id of ['play', 'prepare', 'updates', 'install', 'previous'])
    f.doc.getElementById(id).hidden = true;
  const check = f.doc.createElement('button');
  check.id = 'check';
  check.textContent = 'Check available edition';
  check.onclick = () => f.calls.push('check');
  f.doc.body.append(check);
  f.tick();
  f.tick();
  f.press(0);
  assert.equal(f.doc.activeElement.id, 'check');
  assert.deepEqual(f.calls, ['check']);
  const prepare = f.doc.getElementById('prepare');
  prepare.hidden = false;
  f.press(1);
  assert.equal(f.doc.activeElement.id, 'prepare');
  assert.deepEqual(f.calls, ['check'], 'Back changes focus without starting preparation.');
  f.host.dispose();
});

test('launcher native Confirm probes the held pad before the next animation frame', () => {
  const f = fixture();
  f.tick();
  f.tick();
  const target = f.doc.getElementById('play');
  target.focus();
  f.pad.buttons[0] = { pressed: true, value: 1 };
  assert.equal(
    target.emit('keydown', { key: 'Enter', code: 'Enter', isTrusted: true }).defaultPrevented,
    true,
  );
  assert.equal(
    target.emit('click', { button: 0, detail: 0, isTrusted: true }).defaultPrevented,
    true,
  );
  assert.deepEqual(f.calls, []);
  f.pad.buttons[0] = { pressed: false, value: 0 };
  f.tick();
  assert.deepEqual(f.calls, ['play']);
  f.tick();
  assert.deepEqual(f.calls, ['play']);
  f.host.dispose();
});
