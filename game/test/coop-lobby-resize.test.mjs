import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';

async function lobby(t) {
  const f = await page(t, {
    nativeFocus: true,
    nativeVisibility: true,
    beforeImport({ doc, win }) {
      Object.assign(win, doc.defaultView, { innerWidth: 844, innerHeight: 390 });
      doc.defaultView = win;
      doc.documentElement.clientWidth = 844;
      doc.documentElement.clientHeight = 390;
    },
  });
  const panel = f.$('coop-menu'),
    target = f.$('coop-settings-open'),
    calls = [];
  panel._rect = { x: 12, y: -549, width: 820, height: 1469 };
  Object.assign(panel, { clientLeft: 0, clientTop: 0, clientWidth: 820, clientHeight: 1469 });
  target._rect = { x: 302, y: 612, width: 111, height: 47 };
  target.focus();
  t.mock.method(target, 'scrollIntoView', (options) => calls.push(options));
  t.mock.method(target, 'focus', () => assert.fail('Resize must not refocus or activate.'));
  return { ...f, panel, target, calls };
}

test('rotation reveals the focused Team lobby control without starting or refocusing', async (t) => {
  const f = await lobby(t);
  f.win.emit('resize');
  assert.deepEqual(f.calls, [{ block: 'nearest', inline: 'nearest', behavior: 'instant' }]);
  assert.equal(f.doc.activeElement, f.target);
  assert.equal(f.$('coop-play').hidden, true);
  assert.equal(f.panel.hidden, false);
});

test('rotation leaves a fully visible Team lobby control alone', async (t) => {
  const f = await lobby(t);
  f.target._rect.y = 220;
  f.win.emit('resize');
  assert.deepEqual(f.calls, []);
});

test('background rotation cannot scroll the Team lobby', async (t) => {
  const f = await lobby(t);
  f.doc.hidden = true;
  f.win.emit('resize');
  assert.deepEqual(f.calls, []);
});

test('a newer focus during lobby measurement vetoes the old resize reveal', async (t) => {
  const f = await lobby(t);
  t.mock.method(f.target, 'getBoundingClientRect', () => {
    f.$('coop-discovery-open').focus();
    return { x: 302, y: 612, left: 302, top: 612, right: 413, bottom: 659, width: 111, height: 47 };
  });
  f.win.emit('resize');
  assert.deepEqual(f.calls, []);
  assert.equal(f.doc.activeElement.id, 'coop-discovery-open');
});
