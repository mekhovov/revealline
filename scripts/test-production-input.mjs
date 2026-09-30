import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Document } from '../game/test/helpers/couch-dom.mjs';
import { attachProductionPanel } from '../authoring/production/panel.mjs';
import { mountProductionInput } from '../authoring/production/input.mjs';

const seed = JSON.parse(
  await readFile(new URL('../authoring/production/register.json', import.meta.url)),
);
const settle = async () => {
  for (let i = 0; i < 4; i++) await new Promise((resolve) => setImmediate(resolve));
};
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

async function host(t, services = {}) {
  const doc = new Document(),
    win = doc.defaultView,
    frames = new Map(),
    observers = new Set();
  let frameId = 0,
    now = 0;
  const pad = {
    id: 'Production test pad',
    index: 0,
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  Object.assign(win, {
    location: new URL('http://localhost/authoring/production/'),
    performance: { now: () => now },
    requestAnimationFrame(fn) {
      frames.set(++frameId, fn);
      return frameId;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
    MutationObserver: class {
      constructor(callback) {
        this.callback = callback;
      }
      observe() {
        observers.add(this);
      }
      disconnect() {
        observers.delete(this);
      }
    },
  });
  const create = doc.createElement.bind(doc);
  doc.createElement = (tag) => {
    const node = create(tag);
    node.before = (other) => {
      other.remove();
      const siblings = node.parentNode.children;
      siblings.splice(siblings.indexOf(node), 0, other);
      other.parentNode = node.parentNode;
    };
    return node;
  };
  doc.body.prepend = (...nodes) => {
    for (const node of nodes.reverse()) {
      node.remove();
      doc.body.children.unshift(node);
      node.parentNode = doc.body;
    }
  };
  const root = doc.createElement('main');
  root.id = 'production-panel';
  doc.body.append(root);
  const input = mountProductionInput({ document: doc, window: win, readPads: () => [pad] });
  const api = attachProductionPanel({
    root,
    rootURL: win.location.origin + '/',
    loadRegister: async () => seed,
    loadPreview: async () => {
      throw new Error('Unavailable');
    },
    navigation: input.navigation,
    ...services,
  });
  input.attach(api);
  const tick = () => {
    now += 50;
    pad.timestamp = now;
    const pending = [...frames];
    frames.clear();
    pending.forEach(([, fn]) => fn(now));
    [...observers].forEach((observer) => observer.callback([]));
  };
  const pulse = async (index) => {
    tick();
    pad.buttons[index] = { pressed: true, value: 1 };
    tick();
    pad.buttons[index] = { pressed: false, value: 0 };
    tick();
    await settle();
  };
  t.after(() => {
    api.dispose();
    input.destroy();
  });
  await settle();
  tick();
  tick();
  return {
    doc,
    win,
    root,
    input,
    api,
    tick,
    pulse,
    frames,
    observers,
    $: (id) => doc.getElementById(id),
    row: () => root.querySelector('tbody button'),
  };
}

test('actual controller row Confirm and Back survive neutral polls; native Escape has one owner', async (t) => {
  const h = await host(t),
    row = h.row();
  row.focus();
  await h.pulse(0);
  assert.equal(h.doc.activeElement, h.$('production-back'));
  h.tick();
  h.tick();
  assert.equal(h.doc.activeElement, h.$('production-back'));
  assert.equal(h.$('production-detail').dataset.productionSlot, row.dataset.productionSlot);
  await h.pulse(1);
  assert.equal(h.$('production-detail').hidden, true);
  assert.equal(h.doc.activeElement, row);
  assert.equal(h.doc.querySelector('dialog[open]'), null);
  await h.pulse(0);
  h.$('production-back').emit('keydown', { key: 'Escape' });
  assert.equal(h.doc.activeElement, row);
  assert.equal(h.$('production-detail').hidden, true);
  assert.equal(h.doc.querySelector('dialog[open]'), null);
  await h.pulse(1);
  assert.equal(h.doc.querySelector('dialog[open]').className, 'authoring-sections-dialog');
});

test('page changes focus the new first row and Sections targets actual filter/list controls', async (t) => {
  const h = await host(t),
    old = h.row();
  h.$('production-next').focus();
  await h.pulse(0);
  h.tick();
  assert.equal(old.isConnected, false);
  assert.equal(h.doc.activeElement, h.row());
  assert.notEqual(h.row().dataset.productionSlot, old.dataset.productionSlot);
  h.$('production-previous').focus();
  await h.pulse(0);
  assert.equal(h.doc.activeElement.dataset.productionSlot, old.dataset.productionSlot);
  await h.pulse(9);
  const sections = h.doc.querySelector('dialog[open]');
  const jump = sections
    .querySelectorAll('button')
    .find((b) => b.textContent === 'Production slots');
  jump.focus();
  await h.pulse(0);
  h.tick();
  assert.equal(h.doc.activeElement, h.row());
});

for (const outcome of ['resolve', 'reject'])
  test(`newer row selection retires pending reload before its late ${outcome}`, async (t) => {
    const pending = deferred();
    let request = 0,
      signal;
    const h = await host(t, {
      loadRegister: ({ signal: next }) => {
        signal = next;
        return ++request === 1 ? Promise.resolve(seed) : pending.promise;
      },
    });
    h.$('production-reload').focus();
    await h.pulse(0);
    const row = h.row();
    row.focus();
    await h.pulse(0);
    assert.equal(signal.aborted, true);
    assert.equal(h.doc.activeElement, h.$('production-back'));
    const status = h.root.querySelector('.operation-status');
    assert.equal(status.dataset.state, 'cancelled');
    if (outcome === 'resolve') pending.resolve(seed);
    else pending.reject(new Error('Late source failure'));
    await settle();
    h.tick();
    assert.equal(status.dataset.state, 'cancelled');
    assert.equal(row.isConnected, true);
    assert.equal(h.$('production-detail').hidden, false);
    assert.equal(h.doc.activeElement, h.$('production-back'));
    await h.pulse(1);
    assert.equal(h.doc.activeElement, row);
  });

test('reload cancellation after a filter edit preserves current rows and cannot publish an old error', async (t) => {
  const pending = deferred();
  let request = 0;
  const h = await host(t, {
    loadRegister: () => (++request === 1 ? Promise.resolve(seed) : pending.promise),
  });
  const run = h.api.refresh();
  h.$('production-search').focus();
  h.$('production-search').value = 'sentinel';
  h.$('production-search').emit('input');
  const rows = h.root.querySelectorAll('tbody button');
  assert.equal(rows.length, 12);
  pending.reject(new Error('Old read'));
  await run;
  assert.deepEqual(h.root.querySelectorAll('tbody button'), rows);
  assert.equal(h.doc.activeElement, h.$('production-search'));
  assert.equal(h.root.querySelector('.operation-status').dataset.state, 'cancelled');
});

test('empty slot results still provide a real Sections destination and one shared input owner', async (t) => {
  const h = await host(t);
  assert.equal(mountProductionInput({ document: h.doc }), h.input);
  assert.equal(h.frames.size, 1);
  h.$('production-search').value = 'no matching production slot';
  h.$('production-search').emit('input');
  assert.equal(h.row(), null);
  await h.pulse(9);
  const sections = h.doc.querySelector('dialog[open]');
  sections
    .querySelectorAll('button')
    .find((button) => button.textContent === 'Production slots')
    .focus();
  await h.pulse(0);
  h.tick();
  assert.equal(h.doc.activeElement, h.$('production-search'));
  assert.equal(h.$('production-previous').disabled, true);
  assert.equal(h.$('production-next').disabled, true);
});

for (const id of ['checklist', 'history', 'provenance'])
  test(`${id} reader scrolls within bounds and Back returns to its exact entry without closing detail`, async (t) => {
    const h = await host(t);
    h.row().focus();
    await h.pulse(0);
    if (id !== 'checklist') h.$(`production-${id}`).querySelector('summary').click();
    const entry = h.$(`production-read-${id}`),
      region = h.$(`production-${id}-region`);
    region.clientHeight = 100;
    region.scrollHeight = 180;
    entry.focus();
    await h.pulse(0);
    assert.equal(h.input.navigation.readingState().regionId, region.id);
    await h.pulse(13);
    await h.pulse(13);
    await h.pulse(13);
    assert.equal(region.scrollTop, 80);
    await h.pulse(1);
    h.tick();
    assert.equal(h.doc.activeElement, entry);
    assert.equal(h.input.navigation.readingState(), null);
    assert.equal(region.hasAttribute('data-controller-reading'), false);
    assert.equal(entry.getAttribute('aria-pressed'), 'false');
    assert.equal(h.$('production-detail').hidden, false);
    entry.focus();
    await h.pulse(0);
    assert.equal(h.input.navigation.readingState().regionId, region.id);
    region.emit('keydown', { key: 'Escape' });
    assert.equal(h.doc.activeElement, entry);
    assert.equal(
      h.$('production-detail').hidden,
      false,
      'Consumed reader Escape cannot reach panel Back.',
    );
  });

test('consumed Escape, newer focus, collapsed disclosure and disposal preserve reader ownership boundaries', async (t) => {
  const h = await host(t);
  h.row().click();
  const detail = h.$('production-detail');
  h.$('production-back').emit('keydown', { key: 'Escape', defaultPrevented: true });
  assert.equal(detail.hidden, false);
  const disclosure = h.$('production-history');
  disclosure.querySelector('summary').click();
  const entry = h.$('production-read-history');
  entry.focus();
  entry.click();
  h.$('production-back').focus();
  h.tick();
  assert.equal(h.input.navigation.readingState(), null);
  assert.equal(h.doc.activeElement, h.$('production-back'));
  entry.focus();
  entry.click();
  disclosure.open = false;
  h.tick();
  assert.equal(h.input.navigation.readingState(), null);
  disclosure.open = true;
  entry.focus();
  entry.click();
  h.doc.hidden = true;
  h.api.cancel();
  h.tick();
  assert.equal(h.input.navigation.readingState(), null);
  h.api.dispose();
  h.input.destroy();
  assert.equal(h.frames.size, 0);
  assert.equal(h.observers.size, 0);
});

test('clear or lifecycle cancellation cannot adopt a late decoded image or steal newer focus', async (t) => {
  const pending = deferred();
  let signal,
    released = 0;
  const h = await host(t, {
    loadPreview: (_entry, options) => {
      signal = options.signal;
      return pending.promise;
    },
  });
  h.row().focus();
  await h.pulse(0);
  h.$('production-preview').focus();
  await h.pulse(0);
  h.$('production-clear-preview').focus();
  await h.pulse(0);
  assert.equal(signal.aborted, true);
  const image = h.doc.createElement('img');
  pending.resolve({ image, dispose: () => released++ });
  await settle();
  assert.equal(released, 1);
  assert.equal(image.isConnected, false);
  assert.equal(h.doc.activeElement, h.$('production-clear-preview'));
  assert.match(h.$('production-detail').textContent, /Preview cleared/);
  assert.deepEqual(seed.assessments, []);
});
