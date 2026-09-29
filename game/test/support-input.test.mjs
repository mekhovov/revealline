import test from 'node:test';
import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { Document, Events } from './helpers/couch-dom.mjs';
import { mountSupportInput } from '../ui/support-input.mjs';

function fixture() {
  const doc = new Document(),
    win = new Events(),
    frames = new Map(),
    calls = [];
  let serial = 0,
    now = 0;
  Object.assign(win, {
    location: new URL('http://localhost/game/controller-lab/'),
    File,
    Event,
    performance: { now: () => now },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    requestAnimationFrame(callback) {
      frames.set(++serial, callback);
      return serial;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
  });
  doc.defaultView = { ...doc.defaultView, ...win };
  doc.body.prepend = (...nodes) => doc.body.append(...nodes);
  const node = (tag, id) => {
    const element = doc.createElement(tag);
    element.id = id;
    element.textContent = id;
    doc.body.append(element);
    return element;
  };
  const home = node('a', 'home');
  home.href = '../';
  home.setAttribute('href', '../');
  home.setAttribute('data-support-return', '');
  home.onclick = () => calls.push('home');
  const search = node('input', 'search');
  search.type = 'search';
  const refresh = node('button', 'refresh');
  refresh.onclick = () => calls.push('refresh');
  const frame = node('iframe', 'game-frame');
  const pad = {
    index: 0,
    id: 'Support test pad',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  const host = mountSupportInput({ document: doc, window: win, readPads: () => [pad] });
  const tick = () => {
    const pending = [...frames.values()];
    frames.clear();
    now += 20;
    pending.forEach((callback) => callback(now));
  };
  const press = (index) => {
    pad.buttons[index] = { pressed: true, value: 1 };
    tick();
    pad.buttons[index] = { pressed: false, value: 0 };
    tick();
  };
  tick();
  tick();
  return { doc, win, home, search, refresh, frame, pad, node, calls, host, tick, press, frames };
}

test('support pages mount the shared owner and preserve their own home/preview links', async () => {
  for (const route of ['community', 'controller-lab']) {
    const html = await readFile(new URL(`../${route}/index.html`, import.meta.url), 'utf8');
    assert.match(html, /src="\.\.\/ui\/support-input-entry\.mjs"/);
    assert.match(html, /data-support-return/);
  }
  const f = fixture();
  assert.equal(f.doc.querySelector('.authoring-preview-enter'), null);
  assert.equal(f.doc.querySelector('.authoring-source-dialog'), null);
  f.refresh.focus();
  f.press(1);
  assert.deepEqual(f.calls, ['home']);
  f.host.destroy();
  assert.equal(f.frames.size, 0);
});

test('support file controls retain the native platform picker boundary without authoring samples', () => {
  const f = fixture();
  const input = f.node('input', 'publish-pack');
  input.type = 'file';
  input.setAttribute('type', 'file');
  input.accept = '.rlpack';
  input.onclick = () => f.calls.push('platform-picker');
  input.focus();
  input.click();
  assert.deepEqual(f.calls, ['platform-picker']);
  f.calls.length = 0;
  f.press(0);
  assert.deepEqual(
    f.calls,
    [],
    'A sampled pad event does not synthesize platform user activation.',
  );
  assert.equal(f.doc.querySelector('.authoring-source-dialog'), null);
  assert.equal(f.doc.querySelector('.authoring-source-open'), null);
  f.host.destroy();
});

test('dynamic catalog actions are reachable without re-registering the page', () => {
  const f = fixture();
  const install = f.node('button', 'install-local-fixture');
  install.onclick = () => f.calls.push('install-local-fixture');
  f.refresh._rect.y = 100;
  install._rect.y = 200;
  const hidden = f.node('button', 'unavailable');
  hidden.hidden = true;
  f.refresh.focus();
  for (let step = 0; step < 4 && f.doc.activeElement !== install; step++) f.press(13);
  assert.equal(f.doc.activeElement, install);
  f.press(0);
  assert.deepEqual(f.calls, ['install-local-fixture']);
  f.host.destroy();
});

test('controller search opens the shared field editor and Back restores the original draft', () => {
  const f = fixture();
  f.search.value = 'Сигнал';
  f.search.focus();
  f.press(0);
  assert.equal(f.doc.querySelectorAll('[role="dialog"]').length, 1);
  f.press(1);
  assert.equal(f.doc.querySelectorAll('[role="dialog"]').length, 0);
  assert.equal(f.search.value, 'Сигнал');
  assert.equal(f.doc.activeElement, f.search);
  assert.deepEqual(f.calls, []);
  f.host.destroy();
});

test('parent controller owner is neutral while the practice frame owns focus', () => {
  const f = fixture();
  f.frame.focus();
  f.press(0);
  f.press(1);
  assert.deepEqual(f.calls, []);
  assert.equal(f.doc.activeElement, f.frame);
  f.refresh.focus();
  f.tick();
  f.tick();
  f.press(0);
  assert.deepEqual(f.calls, ['refresh']);
  f.host.destroy();
});

test('support Confirm suppresses a native compatibility click and commits on release once', () => {
  const f = fixture();
  f.refresh.focus();
  f.pad.buttons[0] = { pressed: true, value: 1 };
  f.tick();
  const event = f.refresh.emit('click', { button: 0, detail: 0, isTrusted: true });
  assert.equal(event.defaultPrevented, true);
  assert.deepEqual(f.calls, []);
  f.pad.buttons[0] = { pressed: false, value: 0 };
  f.tick();
  assert.deepEqual(f.calls, ['refresh']);
  f.host.destroy();
});

test('Confirm can enter the practice frame, then activate a parent action after neutral return', () => {
  const f = fixture();
  f.refresh.onclick = () => {
    f.calls.push('enter-practice');
    f.frame.focus();
    f.win.emit('blur');
  };
  f.refresh.focus();
  f.press(0);
  assert.equal(f.doc.activeElement, f.frame);
  assert.deepEqual(f.calls, ['enter-practice']);
  f.refresh.onclick = () => f.calls.push('returned-parent-action');
  f.refresh.focus();
  f.tick();
  f.tick();
  f.press(0);
  assert.deepEqual(f.calls, ['enter-practice', 'returned-parent-action']);
  f.host.destroy();
});

test('keyboard preserves search caret movement and routes page Back through the home action', () => {
  const f = fixture();
  f.search.focus();
  const left = f.search.emit('keydown', { key: 'ArrowLeft', code: 'ArrowLeft' });
  assert.equal(left.defaultPrevented, false);
  assert.equal(f.doc.activeElement, f.search);
  f.refresh.focus();
  const back = f.refresh.emit('keydown', { key: 'Escape', code: 'Escape' });
  assert.equal(back.defaultPrevented, true);
  assert.deepEqual(f.calls, ['home']);
  f.host.destroy();
});
