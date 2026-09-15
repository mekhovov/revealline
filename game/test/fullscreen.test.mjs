import test from 'node:test';
import assert from 'node:assert/strict';
import { attachFullscreen } from '../ui/fullscreen.mjs';
import { Events, Element } from './helpers/couch-dom.mjs';

const settle = () => new Promise((resolve) => setImmediate(resolve));
function fixture({ supported = false, standalone = false, ios = false, rejected = false } = {}) {
  const doc = new Events(),
    media = new Events(),
    nodes = new Map();
  const node = (id) => {
    const result = new Element(doc, 'button', { id });
    result.focus = () => {
      doc.activeElement = result;
    };
    nodes.set(id, result);
    return result;
  };
  const button = node('shell-fullscreen'),
    settings = node('settings-fullscreen');
  for (const id of [
    'fullscreen-dialog',
    'fullscreen-message',
    'fullscreen-home-steps',
    'fullscreen-home-note',
    'fullscreen-retry',
  ])
    node(id);
  const dialog = nodes.get('fullscreen-dialog');
  dialog.showModal = () => {
    dialog.open = true;
  };
  dialog.close = () => {
    dialog.open = false;
  };
  doc.getElementById = (id) => nodes.get(id);
  doc.querySelectorAll = () => [settings, nodes.get('fullscreen-retry')];
  media.matches = standalone;
  doc.defaultView = { matchMedia: () => media, navigator: { standalone: ios } };
  doc.fullscreenEnabled = supported;
  let requests = 0,
    helpCalls = 0;
  doc.documentElement = {
    requestFullscreen: supported
      ? async (options) => {
          requests++;
          assert.equal(options.navigationUI, 'hide');
          if (rejected) throw new Error('Denied by browser policy');
          doc.fullscreenElement = doc.documentElement;
          doc.emit('fullscreenchange');
        }
      : undefined,
  };
  doc.exitFullscreen = async () => {
    doc.fullscreenElement = null;
    doc.emit('fullscreenchange');
  };
  const detach = attachFullscreen(button, doc, {
    onHelp: () => {
      helpCalls++;
    },
  });
  const click = async (control = button) => {
    control.emit('click', { currentTarget: control });
    await settle();
  };
  return {
    doc,
    media,
    nodes,
    button,
    settings,
    dialog,
    click,
    detach,
    requests: () => requests,
    helpCalls: () => helpCalls,
  };
}

test('unsupported fullscreen stays visible and offers optional Home Screen help', async () => {
  const f = fixture();
  assert.equal(f.button.hidden, false);
  assert.equal(f.button.getAttribute('aria-label'), 'Fullscreen options');
  await f.click();
  assert.equal(f.dialog.open, true);
  assert.equal(f.helpCalls(), 1);
  assert.equal(f.requests(), 0);
  assert.match(f.nodes.get('fullscreen-message').textContent, /cannot hide its tabs/);
  assert.equal(f.nodes.get('fullscreen-home-steps').hidden, false);
  assert.equal(f.nodes.get('fullscreen-retry').hidden, true);
});

test('supported fullscreen follows real enter, exit and external exit state', async () => {
  const f = fixture({ supported: true });
  await f.click();
  assert.equal(f.requests(), 1);
  assert.equal(f.button.getAttribute('aria-pressed'), 'true');
  assert.equal(f.button.getAttribute('aria-label'), 'Exit fullscreen');
  assert.equal(f.helpCalls(), 0);
  await f.click();
  assert.equal(f.doc.fullscreenElement, null);
  await f.click();
  f.doc.fullscreenElement = null;
  f.doc.emit('fullscreenchange');
  assert.equal(f.button.getAttribute('aria-pressed'), 'false');
  assert.equal(f.button.getAttribute('aria-label'), 'Enter fullscreen');
});

test('rejected fullscreen opens readable help, preserves the opener and allows retry', async () => {
  const f = fixture({ supported: true, rejected: true });
  await f.click();
  assert.equal(f.dialog.open, true);
  assert.match(f.nodes.get('fullscreen-message').textContent, /could not enter fullscreen/);
  assert.equal(f.nodes.get('fullscreen-retry').hidden, false);
  assert.equal(f.doc.activeElement, f.button);
  assert.equal(f.button.getAttribute('aria-pressed'), 'false');
});

for (const option of ['standalone', 'ios']) {
  test(`${option} app mode omits installation instructions and does not make a redundant request`, async () => {
    const f = fixture({ supported: true, [option]: true });
    await f.click();
    assert.equal(f.requests(), 0);
    assert.match(f.nodes.get('fullscreen-message').textContent, /already playing/);
    assert.equal(f.nodes.get('fullscreen-home-steps').hidden, true);
    assert.equal(f.nodes.get('fullscreen-home-note').hidden, true);
    assert.equal(f.nodes.get('fullscreen-retry').hidden, true);
  });
}

test('display-mode changes update the screen action and listeners are removed on disposal', async () => {
  const f = fixture({ supported: true });
  f.media.matches = true;
  f.media.emit('change');
  assert.equal(f.button.getAttribute('aria-label'), 'Fullscreen options');
  f.detach();
  await f.click();
  assert.equal(f.dialog.open, false);
  assert.equal(f.requests(), 0);
  assert.equal(f.doc.listeners.get('fullscreenchange').size, 0);
  assert.equal(f.media.listeners.get('change').size, 0);
});

test('Settings offers Home Screen guidance even when native fullscreen is supported', async () => {
  const f = fixture({ supported: true });
  await f.click(f.settings);
  assert.equal(f.dialog.open, true);
  assert.equal(f.requests(), 0);
  assert.equal(f.doc.activeElement, f.settings);
  assert.equal(f.nodes.get('fullscreen-retry').hidden, false);
  assert.match(f.nodes.get('fullscreen-message').textContent, /Enter fullscreen/);
  await f.click(f.nodes.get('fullscreen-retry'));
  assert.equal(f.requests(), 1);
  assert.equal(f.dialog.open, false);
});
