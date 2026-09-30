import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'parse5';
import { mountCivilianPractice } from '../../optional-practice/civilian-flight/app.mjs';
import { replayPractice } from '../../optional-practice/civilian-flight/model.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';

async function fixture(t) {
  const doc = new Document(),
    win = new Events();
  const html = parse(
    await readFile(
      new URL('../../optional-practice/civilian-flight/index.html', import.meta.url),
      'utf8',
    ),
  );
  const body = html.childNodes
    .find((node) => node.tagName === 'html')
    .childNodes.find((node) => node.tagName === 'body');
  function copy(source, parent) {
    if (!source.tagName) return;
    const node = doc.createElement(source.tagName);
    for (const attribute of source.attrs ?? []) {
      node.setAttribute(attribute.name, attribute.value);
      if (attribute.name === 'class') node.className = attribute.value;
    }
    for (const text of source.childNodes ?? [])
      if (text.nodeName === '#text') node.textContent += text.value;
    parent.append(node);
    for (const child of source.childNodes ?? []) copy(child, node);
  }
  for (const child of body.childNodes) copy(child, doc.body);
  doc.getElementById('board').getContext = () => null;
  const frames = new Map();
  let frameId = 0,
    now = 0;
  win.requestAnimationFrame = (fn) => {
    frames.set(++frameId, fn);
    return frameId;
  };
  win.cancelAnimationFrame = (id) => frames.delete(id);
  win.navigator = { getGamepads: () => [] };
  win.location = new URL('https://example.test/optional-practice/civilian-flight/');
  Object.defineProperty(win, 'localStorage', {
    get() {
      throw new Error('Practice cannot use player storage');
    },
  });
  const view = mountCivilianPractice({ document: doc, window: win });
  t.after(() => view.dispose());
  const tick = (count = 1) => {
    for (let index = 0; index < count; index++) {
      const [id, callback] = frames.entries().next().value;
      frames.delete(id);
      callback(now);
      now += 50;
    }
  };
  return {
    doc,
    win,
    view,
    frames,
    tick,
    key(code, type = 'keydown', repeat = false) {
      win.emit(type, {
        code,
        repeat,
        key: code.startsWith('Key') ? code.slice(3).toLowerCase() : code,
      });
    },
  };
}
test('actual optional page is playable with canvas fallback and verifies a complete keyboard practice transcript', async (t) => {
  const f = await fixture(t);
  const $ = (id) => f.doc.getElementById(id);
  assert.equal($('drill').children.length, 12);
  assert.equal($('fallback').hidden, false);
  $('start').click();
  assert.equal(f.doc.activeElement, $('arena'));
  f.key('KeyR');
  f.tick(21);
  f.key('KeyR', 'keyup');
  f.tick(30);
  assert.equal(f.view.snapshot().checkpoint, 1);
  f.key('KeyF');
  f.tick(20);
  f.key('KeyF', 'keyup');
  f.tick(30);
  assert.equal(f.view.snapshot().status, 'complete');
  assert.equal(replayPractice(f.view.catalogue(), f.view.trace()).status, 'complete');
  assert.ok($('discovery').textContent.length > 0);
  assert.equal($('start').disabled, true);
  assert.match($('drill').children[0].textContent, /✓/);
  $('drill').value = 'square';
  $('drill').emit('change');
  assert.equal(f.view.snapshot().status, 'ready');
  assert.equal(f.view.snapshot().ticks, 0);
});
test('reading and failed imports pause the gym and cannot grant completions or resume a held control', async (t) => {
  const f = await fixture(t);
  const $ = (id) => f.doc.getElementById(id);
  $('start').click();
  f.key('KeyW');
  f.tick(3);
  $('help').click();
  const paused = f.view.snapshot();
  f.tick(20);
  assert.deepEqual(f.view.snapshot(), paused);
  assert.equal($('help-dialog').open, true);
  $('export').click();
  const exported = $('catalogue').value;
  assert.equal(JSON.parse(exported).drills.length, 12);
  $('catalogue').value = '{"completed":true}';
  $('import').click();
  assert.deepEqual(f.view.snapshot(), paused);
  $('close-help').click();
  assert.equal(f.view.snapshot().status, 'paused');
  $('start').click();
  f.key('KeyW', 'keydown', true);
  f.tick(3);
  assert.equal(f.view.snapshot().z, paused.z);
  assert.ok($('drill').children.every((option) => !option.textContent.includes('✓')));
  f.win.emit('blur');
  assert.equal(f.view.snapshot().status, 'paused');
  f.view.dispose();
  assert.equal(f.frames.size, 0);
});
