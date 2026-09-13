import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Events, Document } from './helpers/couch-dom.mjs';
import { SoloElement, soloPage, memoryStorage } from './helpers/solo-dom.mjs';
import {
  attachEnemyWorkshopReturn,
  attachEnemyWorkshopReturnHost,
} from '../ui/enemy-workshop-return.mjs';
import { attachEnemyCatalogPanel } from '../ui/enemy-catalog-panel.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { createControllerRouter } from '../ui/controller-router.mjs';
import { createEnemyCatalogInput } from '../ui/enemy-catalog-input.mjs';
import { createEnemyCatalogScenario } from '../enemy-catalog-scenarios.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const themes = JSON.parse(readFileSync(new URL('../content/themes.json', import.meta.url))).themes;
const format = 'revealline.enemy-workshop-return.v1';
function parentHost() {
  const host = new Events();
  host.location = { href: 'http://localhost/authoring/enemy-catalog/' };
  host.crypto = globalThis.crypto;
  return host;
}
const session = (url) => new URL(url).searchParams.get('enemy-workshop-session');

test('return authority rejects outsiders, stale launches, malformed messages and repeats', () => {
  const host = parentHost(),
    frame = { contentWindow: {}, hidden: false, src: '' };
  let returned = 0;
  const bridge = attachEnemyWorkshopReturnHost({ window: host, frame, onReturn: () => returned++ });
  const first = bridge.launchURL(),
    second = bridge.launchURL(),
    valid = { format, session: session(second) };
  assert.notEqual(session(first), session(second));
  const send = (data, source = frame.contentWindow, origin = 'http://localhost') =>
    host.emit('message', { data, source, origin });
  send(valid, {});
  send(valid, frame.contentWindow, 'https://outsider.example');
  send({ format, session: session(first) });
  send({ ...valid, action: 'write-profile' });
  send({ format, session: null });
  send({
    get format() {
      throw new Error('Do not invoke getters.');
    },
    session: valid.session,
  });
  assert.equal(returned, 0);
  assert.equal(frame.hidden, false);
  send(valid);
  assert.equal(returned, 1);
  assert.equal(frame.hidden, true);
  assert.equal(frame.src, 'about:blank');
  send(valid);
  assert.equal(returned, 1);
  const third = bridge.launchURL();
  bridge.dispose();
  send({ format, session: session(third) });
  assert.equal(returned, 1);
  assert.throws(() => bridge.launchURL(), /closed/);
});

function parentPanel(t, readPads) {
  const doc = new Document(),
    host = parentHost();
  doc.createElement = (tag) => {
    const el = new SoloElement(doc, tag);
    el.getContext = () => null;
    el.prepend = (child) => {
      el.append(child);
      el.children.unshift(el.children.pop());
    };
    return el;
  };
  const opener = doc.createElement('button'),
    frame = doc.createElement('iframe');
  opener.id = 'open-catalog';
  doc.body.append(opener, frame);
  opener.focus();
  let launch;
  const panel = attachEnemyCatalogPanel({
    document: doc,
    onPreview: () => {
      launch = bridge.launchURL();
      frame.src = launch;
      frame.hidden = false;
    },
  });
  const router = createControllerRouter({ readPads, eventTarget: doc });
  const navigation = attachControllerNavigation({
    document: doc,
    getScope: () => (panel.dialog.open ? 'catalog' : 'catalog-page'),
    getRoot: () => (panel.dialog.open ? panel.dialog : doc),
    getDefaultFocus: () => doc.getElementById('enemy-catalog-role'),
    onBack: () => panel.close(),
  });
  const input = createEnemyCatalogInput({
    document: doc,
    frame,
    router,
    navigation,
    getScope: () => (panel.dialog.open ? 'catalog' : 'catalog-page'),
  });
  const bridge = attachEnemyWorkshopReturnHost({
    window: host,
    frame,
    onReturn: () => {
      input.clear();
      opener.focus();
      panel.open();
      navigation.sync();
    },
  });
  panel.open();
  t.after(() => {
    bridge.dispose();
    navigation.destroy();
    router.destroy();
    panel.dispose();
  });
  return {
    doc,
    host,
    frame,
    panel,
    input,
    opener,
    get launch() {
      return launch;
    },
    $: (name) => doc.getElementById(`enemy-catalog-${name}`),
  };
}

test('actual practice controller pause and Return reopens the unsaved parent draft with no flight progress', async (t) => {
  const pad = {
    index: 0,
    id: 'Workshop roundtrip',
    mapping: 'standard',
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  const h = parentPanel(t, () => [pad]);
  h.$('role').value = 'eroder';
  h.$('role').onchange();
  h.$('skin').value = 'ukraine';
  h.$('skin').onchange();
  const draft = h.panel.snapshot();
  await h.$('play').onclick();
  h.panel.close();
  h.frame.focus();
  h.input.poll(0);
  const scenario = createEnemyCatalogScenario('eroder', draft, themes);
  let page,
    sent = 0;
  h.host.postMessage = (data, targetOrigin) => {
    assert.equal(targetOrigin, 'http://localhost');
    sent++;
    queueMicrotask(() =>
      h.host.emit('message', {
        data,
        origin: 'http://localhost',
        source: page.win,
      }),
    );
  };
  page = await soloPage(t, {
    search: new URL(h.launch).search,
    parentWindow: h.host,
    previewStorage: memoryStorage({ 'revealline.playground.current': JSON.stringify(scenario) }),
  });
  h.frame.contentWindow = page.win;
  assert.ok(page.$('enemy-workshop-return'));
  page.$('start-button').click();
  page.key('ArrowDown');
  for (let i = 0; i < 12; i++) page.frame();
  page.key('ArrowDown', false);
  let now = 1000;
  const previous = Object.getOwnPropertyDescriptor(performance, 'now');
  Object.defineProperty(performance, 'now', { configurable: true, value: () => now });
  t.after(() =>
    previous ? Object.defineProperty(performance, 'now', previous) : delete performance.now,
  );
  navigator.getGamepads = () => [pad];
  const frame = () => {
    now += 16;
    page.frame(16);
  };
  const press = (index, held) => {
    pad.buttons[index] = { pressed: held, value: Number(held) };
    frame();
  };
  frame();
  press(9, true);
  press(9, false);
  assert.equal(page.$('game-overlay').hidden, true, 'joining consumes the first Menu press');
  press(9, true);
  press(9, false);
  assert.equal(page.$('game-overlay').dataset.kind, 'pause');
  const checkpoint = authoritativeCheckpoint(page.rendered.run);
  for (let i = 0; i < 20 && page.doc.activeElement.id !== 'enemy-workshop-return'; i++) {
    press(13, true);
    press(13, false);
  }
  assert.equal(page.doc.activeElement.id, 'enemy-workshop-return');
  press(0, true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(sent, 1);
  assert.equal(h.frame.hidden, true);
  assert.equal(h.frame.src, 'about:blank');
  assert.equal(h.panel.dialog.open, true);
  assert.deepEqual(h.panel.snapshot(), draft);
  assert.equal(h.doc.activeElement, h.$('role'));
  h.input.poll(now + 1);
  h.input.poll(now + 500);
  assert.equal(h.doc.activeElement, h.$('role'), 'held child Confirm cannot edit the parent');
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.equal(page.storage.writes.length, 0, 'practice never writes the player library');
  assert.deepEqual(page.errors, []);
  page.win.emit('pagehide', { persisted: false });
  assert.equal(page.$('enemy-workshop-return'), null, 'terminal page disposal removes the action');
});

test('ordinary and unrelated embedded game pages never receive a workshop return action', async (t) => {
  const page = await soloPage(t);
  assert.equal(page.$('enemy-workshop-return'), null);
  const host = {
    parent: {
      postMessage() {
        throw new Error('Unexpected return');
      },
    },
    location: { href: 'http://localhost/game/?practice=1&enemy-workshop-session=invalid' },
  };
  attachEnemyWorkshopReturn({ enabled: true, window: host, document: page.doc, onReturn() {} });
  assert.equal(page.$('enemy-workshop-return'), null);
  host.location.href = `http://localhost/game/?practice=1&enemy-workshop-session=${'a'.repeat(32)}&enemy-workshop-session=${'b'.repeat(32)}`;
  attachEnemyWorkshopReturn({ enabled: true, window: host, document: page.doc, onReturn() {} });
  assert.equal(page.$('enemy-workshop-return'), null);
  host.location.href = `http://localhost/game/?practice=0&enemy-workshop-session=${'a'.repeat(32)}`;
  attachEnemyWorkshopReturn({ enabled: true, window: host, document: page.doc, onReturn() {} });
  assert.equal(page.$('enemy-workshop-return'), null);
});
