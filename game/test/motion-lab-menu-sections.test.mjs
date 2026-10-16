import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'parse5';
import { Document } from './helpers/couch-dom.mjs';
import { mountPageInputHost } from '../ui/page-input-host.mjs';

const html = await readFile(
  new URL('../../authoring/motion-lab/index.html', import.meta.url),
  'utf8',
);

function fixture(t) {
  const doc = new Document(),
    win = doc.defaultView;
  doc.parentNode = win;
  const body = parse(html)
    .childNodes.find((node) => node.tagName === 'html')
    .childNodes.find((node) => node.tagName === 'body');
  function append(parent, source) {
    if (!source.tagName) return;
    const node = doc.createElement(source.tagName);
    for (const { name, value } of source.attrs) {
      node.setAttribute(name, value);
      if (['id', 'type', 'value', 'href'].includes(name)) node[name] = value;
      if (['hidden', 'disabled', 'inert'].includes(name)) node[name] = true;
      if (name === 'class') node.className = value;
    }
    node.textContent = (source.childNodes ?? [])
      .filter((child) => child.nodeName === '#text')
      .map((child) => child.value)
      .join('')
      .trim();
    parent.append(node);
    for (const child of source.childNodes ?? []) append(node, child);
  }
  for (const child of body.childNodes) append(doc.body, child);
  let now = 1000,
    serial = 0;
  const frames = new Map();
  const pad = {
    id: 'Motion section test pad',
    index: 0,
    mapping: 'standard',
    connected: true,
    timestamp: now,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  const tick = () => {
    now += 50;
    pad.timestamp = now;
    const pending = [...frames];
    frames.clear();
    for (const [, callback] of pending) callback(now);
  };
  Object.assign(win, {
    location: new URL('https://motion.test/authoring/motion-lab/'),
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    performance: { now: () => now },
    requestAnimationFrame(callback) {
      frames.set(++serial, callback);
      return serial;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
  });
  const $ = (id) => doc.getElementById(id);
  // Model successful application startup; the real app installs this marker.
  $('motion-study').disabled = false;
  $('arena').inert = false;
  $('arena').removeAttribute('inert');
  $('arena').setAttribute('data-controller-editor', 'true');
  $('arena').tabIndex = 0;
  $('ability-stage-legend').hidden = false;
  const host = mountPageInputHost({ document: doc, window: win, readPads: () => [pad] });
  t.after(() => host.destroy());
  host.navigation.sync();
  host.navigation.engage();
  tick();
  const open = () => {
    host.navigation.sync();
    host.navigation.handle({ menu: true });
    const dialog = doc.querySelector('.authoring-sections-dialog');
    assert.equal(dialog.open, true);
    tick();
    return dialog;
  };
  const confirm = () => {
    tick();
    pad.buttons[0] = { pressed: true, value: 1 };
    tick();
    pad.buttons[0] = { pressed: false, value: 0 };
    tick();
  };
  return { doc, host, $, open, confirm };
}

test('actual Motion headings route shared Sections navigation to every study area without changing controls', (t) => {
  const h = fixture(t);
  const destinations = [
    ['motion-preview-heading', 'arena'],
    ['motion-ability-heading', 'ability-enabled'],
    ['ability-stage-heading', 'ability-stage-heading'],
    ['motion-collection-heading', 'collection-context'],
    ['motion-palette-heading', 'theme'],
    ['motion-progression-heading', 'reward-fixture'],
    ['motion-response-heading', 'cruise-speed'],
    ['motion-comfort-heading', 'show-grid'],
  ];
  let changes = 0;
  h.doc.addEventListener('input', () => changes++);
  h.doc.addEventListener('change', () => changes++);
  for (const [headingId, targetId] of destinations) {
    const heading = h.$(headingId);
    assert.equal(heading.tagName, headingId === 'ability-stage-heading' ? 'H3' : 'H2');
    const dialog = h.open();
    const choice = [...dialog.querySelectorAll('button')].find(
      (button) => button.textContent === heading.textContent,
    );
    assert.ok(choice, `Missing section ${headingId}`);
    for (let step = 0; step < 12 && h.doc.activeElement !== choice; step++)
      h.host.navigation.handle({ direction: 'down' });
    assert.equal(h.doc.activeElement, choice, `Unreachable section ${headingId}`);
    h.confirm();
    assert.equal(dialog.open, false, `Section did not close: ${headingId}`);
    assert.equal(h.doc.activeElement, h.$(targetId), `${headingId} destination`);
  }
  assert.equal(changes, 0, 'Section navigation must not activate or edit a study control');
  assert.equal(h.$('cruise-speed').value, '9');
});

test('nested Stage labels stays scoped and is absent while its actual region is hidden', (t) => {
  const h = fixture(t);
  assert.equal(h.$('ability-stage-heading').closest('section'), h.$('ability-stage-legend'));
  h.$('ability-stage-legend').hidden = true;
  const dialog = h.open();
  assert.equal(
    [...dialog.querySelectorAll('button')].some(
      (button) => button.textContent === h.$('ability-stage-heading').textContent,
    ),
    false,
  );
  assert.ok(
    [...dialog.querySelectorAll('button')].some(
      (button) => button.textContent === h.$('motion-ability-heading').textContent,
    ),
  );
});
