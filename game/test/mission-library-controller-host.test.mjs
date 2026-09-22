import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, memoryStorage } from './helpers/solo-dom.mjs';
import { couchPage } from './helpers/couch-host.mjs';
import { page as teamPage } from './helpers/coop-host.mjs';
import { Element } from './helpers/couch-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { waitFor } from './helpers/wait-for.mjs';

const settle = (predicate) => waitFor(predicate, { timeoutMs: 15000 });
const device = () => ({
  index: 0,
  id: 'Modeled mission library controller',
  connected: true,
  mapping: 'standard',
  axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
});

async function host(t, mode, { fetchResponse } = {}) {
  // Native SUMMARY activation is the only missing browser default modeled here.
  // Real host routing, gamepad polling, navigation and callbacks stay installed.
  const click = Element.prototype.click;
  t.mock.method(Element.prototype, 'click', function () {
    if (this.tagName !== 'SUMMARY') return click.call(this);
    const event = this.emit('click');
    if (!event.defaultPrevented) {
      this.parentElement.open = !this.parentElement.open;
      this.parentElement.emit('toggle');
    }
  });

  const session = memoryStorage({
    [`revealline.mission-library.selector.v1.${mode}`]: JSON.stringify({
      mode,
      search: 'saved query with no matching mission',
      collection: 'Classic',
      campaign: '',
      selectedId: '',
      scroll: 0,
    }),
  });
  const pads = [],
    databases = new Map();
  const indexedDB = {
    open(name, ...args) {
      if (!databases.has(name)) databases.set(name, managedIndexedDB());
      return databases.get(name).indexedDB.open(name, ...args);
    },
  };
  let p;
  if (mode === 'solo')
    p = await soloPage(t, {
      titleScreen: true,
      search: '?journey=legacy',
      previewStorage: session,
      readPads: () => pads,
      assetIndexedDB: indexedDB,
    });
  else if (mode === 'versus')
    p = await couchPage(t, {
      pads,
      initialLevel: null,
      previewStorage: session,
      storage: memoryStorage(),
      lockManager: { request: async (_key, _options, work) => work({}) },
      assetDatabase: indexedDB,
      fetchResponse: async (path) => {
        const response = await fetchResponse?.(path);
        if (response !== undefined) return response;
        if (String(path).includes('/content-design/assets/'))
          return new Response(await readFile(path));
        if (path === '../content/packs/fpv-arcade-r5.json')
          return new Response('', { status: 503 });
      },
    });
  else p = await teamPage(t, { returnStorage: session, nativeFocus: true, nativeVisibility: true });
  p.doc.defaultView.matchMedia = () => ({ matches: true });
  const pad = device();
  (mode === 'team' ? p.pads : pads).push(pad);
  let now = 1000;
  t.mock.method(performance, 'now', () => now);
  const frame = () => {
    now += 30;
    mode === 'team' ? p.tick(2) : p.frame(30);
  };
  const pulse = (index) => {
    pad.buttons[index] = { pressed: true, value: 1 };
    frame();
    pad.buttons[index] = { pressed: false, value: 0 };
    frame();
  };
  frame();
  frame();
  if (mode !== 'solo') pulse(0); // Couch adoption is not an action.
  function reach(target, direction = 13) {
    for (let i = 0; i < 260 && p.doc.activeElement !== target; i++) pulse(direction);
    assert.equal(
      p.doc.activeElement,
      target,
      `Controller reaches ${target?.id || target?.textContent}; current ${p.doc.activeElement?.id}`,
    );
  }
  const opener = p.$(
    mode === 'solo'
      ? 'shell-play'
      : mode === 'versus'
        ? 'race-library-switch'
        : 'coop-discovery-open',
  );
  reach(opener);
  pulse(0);
  await settle(() => p.$('journey-chooser')?.open);
  frame();
  return { p, pulse, reach, frame, opener };
}

test('Versus controller Play and replacement Stay preserve both paused boards and the real opener', async (t) => {
  const { p, pulse, reach, frame, opener } = await host(t, 'versus');
  reach(p.$('journey-search-clear'));
  pulse(0);
  const first = p.$('journey-cards').children[0];
  assert.equal(p.doc.activeElement, first);
  pulse(0);
  await settle(() => {
    p.frame(0);
    return p.state() === 'running';
  });
  assert.equal(p.renders[0].level.id, 'signal-01');
  assert.equal(p.renders[1].level.id, 'signal-01');
  pulse(9);
  assert.equal(p.state(), 'paused');
  const before = p.checkpoint();
  reach(opener);
  pulse(0);
  await settle(() => p.$('journey-chooser').open);
  frame();
  const second = [...p.$('journey-cards').children].find(
    (card) => JSON.parse(card.dataset.missionId)[3] === 'signal-02',
  );
  reach(second);
  pulse(0);
  await settle(() => p.$('race-library-replace')?.open);
  frame();
  assert.equal(p.doc.activeElement.id, 'race-library-stay');
  pulse(0);
  await settle(() => p.$('journey-chooser').open);
  frame();
  assert.deepEqual(p.checkpoint(), before);
  assert.equal(p.state(), 'paused');
  assert.equal(p.doc.activeElement.dataset.missionId, second.dataset.missionId);
  pulse(1);
  assert.equal(p.$('journey-chooser').open, false);
  assert.equal(p.doc.activeElement, opener);
  assert.deepEqual(p.checkpoint(), before);
});

test('Versus controller Download, Retry and Cancel keep the attempt and require separate Play', async (t) => {
  const bytes = await readFile(new URL('../content/packs/night-shift.json', import.meta.url));
  let release,
    requests = 0;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  t.after(() => release());
  const { p, pulse, reach, frame } = await host(t, 'versus', {
    fetchResponse: async (path) => {
      if (!String(path).endsWith('/content/packs/night-shift.json')) return;
      requests++;
      if (requests === 1) return new Response('Controlled unavailable chapter', { status: 503 });
      if (requests === 2) await held;
      return new Response(bytes, { headers: { 'content-length': String(bytes.length) } });
    },
  });
  reach(p.$('journey-search-clear'));
  pulse(0);
  const card = [...p.$('journey-cards').children].find(
    (item) => JSON.parse(item.dataset.missionId)[3] === 'night-shift-03',
  );
  const action = () => card.querySelector('.journey-card-action').textContent;
  const before = p.checkpoint();
  reach(card);
  pulse(0);
  await settle(() => /Retry/.test(action()));
  assert.equal(requests, 1);
  assert.equal(p.doc.activeElement, card);
  frame();
  pulse(0);
  await settle(() => requests === 2 && /Preparing.*Cancel/.test(action()));
  frame();
  pulse(0);
  await settle(() => /^Download/.test(action()));
  release();
  await new Promise((resolve) => setImmediate(resolve));
  frame();
  pulse(0);
  await settle(() => action() === 'Play');
  assert.equal(requests, 3);
  assert.equal(p.$('journey-chooser').open, true);
  assert.equal(p.doc.activeElement, card);
  assert.deepEqual(p.checkpoint(), before);
  assert.notEqual(p.state(), 'running');
});

for (const mode of ['solo', 'versus', 'team'])
  test(`${mode} actual controller wiring opens compact filters, edits selects, clears saved no-match and returns to its opener`, async (t) => {
    const { p, pulse, reach, opener } = await host(t, mode);
    assert.equal(p.$('journey-filter-details').open, false);
    assert.equal(p.$('journey-cards').children.length, 0);
    reach(p.$('journey-filter-summary'));
    pulse(0);
    assert.equal(p.$('journey-filter-details').open, true);
    reach(p.$('journey-collection'));
    pulse(0);
    pulse(13);
    pulse(1);
    assert.equal(p.$('journey-collection').value, 'Classic', 'East cancels select draft only.');
    assert.equal(p.$('journey-chooser').open, true);
    pulse(0);
    pulse(12);
    pulse(0);
    assert.equal(
      p.$('journey-collection').value,
      'Journey',
      'South confirms the edited collection.',
    );
    pulse(0);
    pulse(13);
    pulse(0);
    assert.equal(p.$('journey-collection').value, 'Classic');
    reach(p.$('journey-filter-summary'), 12);
    pulse(0);
    assert.equal(p.$('journey-filter-details').open, false);
    reach(p.$('journey-search-clear'));
    pulse(0);
    assert.equal(p.$('journey-search').value, '');
    assert.equal(p.$('journey-collection').value, 'Classic');
    assert(p.$('journey-cards').children.length > 0);
    assert.equal(p.doc.activeElement, p.$('journey-cards').children[0]);
    pulse(1);
    assert.equal(p.$('journey-chooser').open, false);
    assert.equal(p.doc.activeElement, opener);
  });
