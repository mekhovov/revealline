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
  win.getComputedStyle = doc.defaultView.getComputedStyle;
  win.Event = Event;
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
  const completedState = f.view.snapshot(),
    completedTrace = f.view.trace(),
    discovery = $('discovery');
  for (const action of ['results', 'back']) {
    $('gym-shell-action-menu').click();
    if (action === 'results') $('gym-shell-action-home-results').click();
    else $('gym-shell-home-dialog').emit('cancel');
    assert.equal($('gym-shell-home-dialog').open, false);
    assert.equal($('gym-shell-results-dialog').open, false);
    assert.equal($('discovery'), discovery);
    assert.equal(f.doc.activeElement, discovery);
    f.tick(3);
    assert.deepEqual(f.view.snapshot(), completedState);
    assert.deepEqual(f.view.trace(), completedTrace);
  }
  $('gym-shell-action-menu').click();
  $('gym-shell-action-primary').click();
  assert.equal(f.view.snapshot().status, 'active', 'Only explicit Retry starts a fresh drill.');
  assert.equal(f.view.snapshot().ticks, 0);
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

test('gym title and settings reuse the accepted drill without starting or resuming it', async (t) => {
  const f = await fixture(t),
    $ = (id) => f.doc.getElementById(id);
  assert.equal($('gym-shell-home-dialog').open, true);
  assert.equal(f.view.snapshot().status, 'ready');
  $('gym-shell-action-settings').click();
  assert.equal($('gym-shell-settings-dialog').open, true);
  f.tick(3);
  assert.equal(f.view.snapshot().ticks, 0);
  $('gym-shell-action-settings-back').click();
  $('gym-shell-action-primary').click();
  assert.equal($('gym-shell-briefing-dialog').open, true);
  $('gym-shell-action-start').click();
  assert.equal(f.view.snapshot().status, 'active');
  f.tick(3);
  $('gym-shell-action-menu').click();
  const paused = f.view.snapshot();
  assert.equal(paused.status, 'paused');
  f.tick(4);
  assert.deepEqual(f.view.snapshot(), paused);
  $('gym-shell-action-primary').click();
  assert.equal(f.view.snapshot().status, 'active');
});

test('a gym Pause pointer keeps its intent when moving focus first pauses flight input', async (t) => {
  const f = await fixture(t),
    $ = (id) => f.doc.getElementById(id);
  $('gym-shell-action-primary').click();
  $('gym-shell-action-start').click();
  f.tick(3);
  const button = $('gym-shell-action-pause');
  button.emit('pointerdown', { pointerId: 1, button: 0 });
  button.focus();
  assert.equal(f.view.snapshot().status, 'paused');
  button.emit('click', { detail: 1 });
  assert.equal($('gym-shell-home-dialog').open, true);
  const paused = f.view.snapshot();
  f.tick(4);
  assert.deepEqual(f.view.snapshot(), paused);
});

function controller(f) {
  const pad = {
    index: 0,
    id: 'Standard fixture controller',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  let reads = 0;
  f.win.navigator.getGamepads = () => {
    reads++;
    return [pad];
  };
  const set = (index, pressed) => {
    pad.buttons[index] = { pressed, value: pressed ? 1 : 0 };
  };
  return {
    pad,
    set,
    get reads() {
      return reads;
    },
    pulse(index) {
      f.tick();
      set(index, true);
      f.tick();
      set(index, false);
      f.tick();
    },
  };
}

test('gym reuses neutral controller menu navigation without arming on device join', async (t) => {
  const f = await fixture(t),
    $ = (id) => f.doc.getElementById(id),
    pad = controller(f);
  pad.set(0, true);
  f.tick(4);
  assert.equal(f.view.snapshot().ticks, 0, 'A held on arrival cannot activate the title.');
  pad.set(0, false);
  f.tick();
  pad.pulse(0);
  assert.equal(
    $('gym-shell-home-dialog').open,
    true,
    'The first fresh A only joins menu ownership.',
  );
  assert.equal(f.doc.activeElement, $('gym-shell-action-primary'));
  pad.pulse(13);
  assert.equal(f.doc.activeElement, $('gym-shell-action-missions'));
  pad.pulse(13);
  assert.equal(f.doc.activeElement, $('gym-shell-action-settings'));
  pad.pulse(0);
  assert.equal($('gym-shell-settings-dialog').open, true);
  assert.equal(f.view.snapshot().status, 'ready');
  pad.pulse(1);
  assert.equal($('gym-shell-home-dialog').open, true);
  assert.equal($('gym-shell-settings-dialog').open, false);
  assert.equal(f.view.snapshot().ticks, 0);
});

test('gym controller Pause requires a fresh explicit Continue and samples hardware once per frame', async (t) => {
  const f = await fixture(t),
    $ = (id) => f.doc.getElementById(id),
    pad = controller(f);
  pad.pulse(0); // neutral, then join without activation
  $('connect').click();
  $('gym-shell-action-primary').click();
  $('gym-shell-action-start').click();
  f.tick(3);
  assert.equal(f.view.snapshot().status, 'active');
  const reads = pad.reads;
  f.tick(5);
  assert.equal(pad.reads - reads, 5, 'The existing frame loop owns the only hardware read.');
  pad.set(9, true);
  f.tick();
  assert.equal($('gym-shell-home-dialog').open, true);
  assert.equal(f.view.snapshot().status, 'paused');
  const paused = f.view.snapshot();
  pad.set(0, true);
  f.tick(4);
  assert.deepEqual(f.view.snapshot(), paused, 'Menu handoff never resumes a held action.');
  pad.set(9, false);
  pad.set(0, false);
  f.tick();
  pad.pulse(0);
  assert.equal(f.view.snapshot().status, 'active');
  assert.equal($('gym-shell-home-dialog').open, false);
});

test('gym menu keyboard navigation owns arrows and returns from nested help without flight input', async (t) => {
  const f = await fixture(t),
    $ = (id) => f.doc.getElementById(id);
  const arrow = () => {
    f.doc.emit('keydown', { key: 'ArrowDown', code: 'ArrowDown', target: f.doc.activeElement });
    f.doc.emit('keyup', { key: 'ArrowDown', code: 'ArrowDown', target: f.doc.activeElement });
  };
  arrow();
  assert.equal(f.doc.activeElement, $('gym-shell-action-missions'));
  arrow();
  assert.equal(f.doc.activeElement, $('gym-shell-action-settings'));
  $('gym-shell-action-settings').click();
  $('gym-shell-action-help').click();
  assert.equal($('help-dialog').open, true);
  f.doc.emit('keydown', { key: 'Escape', code: 'Escape', target: f.doc.activeElement });
  f.doc.emit('keyup', { key: 'Escape', code: 'Escape', target: f.doc.activeElement });
  assert.equal($('help-dialog').open, false);
  assert.equal($('gym-shell-settings-dialog').open, true);
  f.tick(4);
  assert.equal(f.view.snapshot().status, 'ready');
  assert.equal(f.view.snapshot().ticks, 0);
});

test('gym Select Mission uses one Review mission action and briefs the selected drill', async (t) => {
  const f = await fixture(t),
    $ = (id) => f.doc.getElementById(id);
  $('gym-shell-action-missions').click();
  assert.equal(f.doc.querySelector('[data-copy="prepare"]'), null);
  $('drill').value = 'square';
  $('drill').emit('change');
  $('gym-shell-action-review').click();
  assert.equal($('gym-shell-briefing-dialog').open, true);
  assert.equal(f.view.snapshot().status, 'ready');
  assert.equal(f.view.snapshot().ticks, 0);
  const drill = f.view.catalogue().drills.find((item) => item.id === 'square');
  assert.equal(
    $('gym-shell-briefing-title').textContent,
    drill.locales[f.doc.documentElement.lang].title,
  );
});

test('a flight arrow released inside a controller menu is usable on the first press after Resume', async (t) => {
  const f = await fixture(t),
    $ = (id) => f.doc.getElementById(id);
  // Model the browser window → document capture chain for consumed keyup.
  f.doc.parentNode = f.win;
  const key = (target, type, code) => target.emit(type, { key: code, code, bubbles: true });
  $('start').click();
  key($('arena'), 'keydown', 'ArrowUp');
  f.tick(2);
  $('gym-shell-action-menu').click();
  f.tick();
  key($('gym-shell-action-primary'), 'keyup', 'ArrowUp');
  $('gym-shell-action-primary').click();
  const before = f.view.snapshot().z;
  key($('arena'), 'keydown', 'ArrowUp');
  f.tick(3);
  assert.notEqual(f.view.snapshot().z, before, 'Menu keyup cannot leave the physical key latched.');
  key($('arena'), 'keyup', 'ArrowUp');
});
