import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import { soloPage, memoryStorage } from './helpers/solo-dom.mjs';
import { couchPage } from './helpers/couch-host.mjs';
import { page as teamPage } from './helpers/coop-host.mjs';
import { Element } from './helpers/couch-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { createTeamImpactOriginalCandidates } from '../content-design/team-impact-originals.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const settle = (predicate) => waitFor(predicate, { timeoutMs: 15000 });
const device = () => ({
  index: 0,
  id: 'Modeled mission library controller',
  connected: true,
  mapping: 'standard',
  axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
});

// Registered picture bytes cross the real host boundary; this finite image
// decoder is not a native artwork or physical-controller qualification.
class JourneyPicture {
  width = 1774;
  height = 887;
  naturalWidth = 1774;
  naturalHeight = 887;
  set src(value) {
    this.source = value;
    queueMicrotask(() => this.onload?.());
  }
  async decode() {}
  removeAttribute() {
    this.source = '';
  }
}

async function host(t, mode, { fetchResponse, defaultEntry = false } = {}) {
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

  const session = memoryStorage(
    defaultEntry
      ? {}
      : {
          [`revealline.mission-library.selector.v1.${mode}`]: JSON.stringify({
            mode,
            search: 'saved query with no matching mission',
            collection: 'Classic',
            campaign: '',
            selectedId: '',
            scroll: 0,
          }),
        },
  );
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
      search: defaultEntry ? '' : '?journey=legacy',
      previewStorage: session,
      readPads: () => pads,
      assetIndexedDB: indexedDB,
      ...(defaultEntry
        ? {
            journeyIndexedDB: indexedDB,
            pictures: { Image: JourneyPicture },
            fetchResponse: async (path) =>
              String(path).includes('/content-design/assets/')
                ? new Response(await readFile(path))
                : undefined,
          }
        : {}),
    });
  else if (mode === 'versus')
    p = await couchPage(t, {
      pads,
      ...(defaultEntry ? { href: 'http://localhost/game/couch/' } : {}),
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
  else {
    const source = defaultEntry ? createTeamImpactOriginalCandidates() : null;
    const originals = new Map(
      await Promise.all(
        (source?.assets ?? []).map(async (asset) => [
          asset.path,
          await readFile(new URL('../' + asset.path, import.meta.url)),
        ]),
      ),
    );
    p = await teamPage(t, {
      returnStorage: session,
      nativeFocus: true,
      nativeVisibility: true,
      ...(defaultEntry
        ? {
            href: 'http://localhost/game/couch/relay-rescue.html',
            beforeImport({ install }) {
              const BaseImage = globalThis.Image,
                actorFetch = globalThis.fetch;
              install('Image', {
                value: class extends BaseImage {
                  async decode() {
                    if (!this.source.startsWith('data:image/png;base64,')) return super.decode();
                    const bytes = Buffer.from(this.source.split(',')[1], 'base64');
                    this.width = this.naturalWidth = bytes.readUInt32BE(16);
                    this.height = this.naturalHeight = bytes.readUInt32BE(20);
                    this.sha256 = createHash('sha256').update(bytes).digest('hex');
                  }
                },
              });
              install('crypto', { value: webcrypto });
              install('fetch', {
                value: async (url) => {
                  const asset = source.assets.find((row) =>
                    new URL(url).pathname.endsWith('/' + row.path),
                  );
                  if (!asset) return actorFetch(url);
                  return new Response(originals.get(asset.path));
                },
              });
            },
          }
        : {}),
    });
  }
  const snapshot = () =>
    mode === 'solo'
      ? { run: authoritativeCheckpoint(p.rendered.run), state: p.doc.body.dataset.flightState }
      : mode === 'versus'
        ? { run: p.checkpoint(), state: p.state() }
        : {
            level: p.$('coop-level').value,
            clock: p.$('coop-clock').textContent,
            stage: p.$('coop-stage').textContent,
            overlay: p.$('coop-overlay').hidden,
            menu: p.$('coop-menu').hidden,
          };
  const before = snapshot();
  p.doc.defaultView.matchMedia = () => ({ matches: true });
  const pad = device();
  (mode === 'team' ? p.pads : pads).push(pad);
  // Continue from the host clock already sampled during startup. Rewinding to
  // an arbitrary small value would prevent time-based Confirm rearming.
  let now = performance.now() + 1000;
  t.mock.method(performance, 'now', () => now);
  function layoutMissionCards() {
    // Finite three-column browser geometry. A shared default rectangle would
    // incorrectly model every mission as an overlapping control in one row.
    for (const [index, card] of [...(p.$('journey-cards')?.children ?? [])].entries())
      card._rect = {
        x: (index % 3) * 180,
        y: Math.floor(index / 3) * 150,
        width: 160,
        height: 130,
      };
  }
  const frame = () => {
    layoutMissionCards();
    now += 30;
    mode === 'team' ? p.tick(2) : p.frame(30);
  };
  const pulse = (index) => {
    pad.buttons[index] = { pressed: true, value: 1 };
    frame();
    pad.buttons[index] = { pressed: false, value: 0 };
    frame();
    // This helper models separate deliberate taps, not Steam's duplicate
    // release pulse. Let Solo's Confirm lifecycle fully rearm between them.
    if (mode === 'solo' && index === 0) for (let i = 0; i < 4; i++) frame();
  };
  frame();
  frame();
  if (mode !== 'solo') pulse(0); // Couch adoption is not an action.
  function reach(target, direction = 13) {
    for (let i = 0; i < 260 && p.doc.activeElement !== target; i++) {
      layoutMissionCards();
      const grid = p.$('journey-cards'),
        current = p.doc.activeElement;
      if (grid?.contains(current) && grid.contains(target)) {
        const from = current.getBoundingClientRect(),
          to = target.getBoundingClientRect();
        pulse(to.y < from.y ? 12 : to.y > from.y ? 13 : to.x < from.x ? 14 : 15);
      } else pulse(direction);
    }
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
  return { p, pulse, reach, frame, opener, before, snapshot };
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
  const card = [...p.$('journey-cards').children].find((item) => {
    const identity = JSON.parse(item.dataset.missionId);
    return JSON.parse(identity[0])[0] === 'classic' && identity[3] === 'night-shift-03';
  });
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

for (const mode of ['solo', 'versus', 'team'])
  test(`${mode} queryless default entry controller browses a ready New Journey mission and returns without starting`, async (t) => {
    const { p, pulse, reach, frame, opener, before, snapshot } = await host(t, mode, {
      defaultEntry: true,
    });
    assert.equal(
      new URL(globalThis.location.href).search,
      '',
      'Actual entry uses no Journey override.',
    );
    if (mode === 'solo') assert.equal(p.rendered.run.level.id, 'first-return');
    else if (mode === 'versus') {
      assert.equal(p.renders[0].level.id, 'first-return');
      assert.equal(p.renders[1].level.id, 'first-return');
    } else assert.equal(p.$('coop-level').value, 'twin-landings');
    const edition = mode === 'team' ? 'team-trail-impact-originals-1' : 'whole-spatial-v25';
    const card = [...p.$('journey-cards').children].find((row) => {
      const identity = JSON.parse(row.dataset.missionId);
      return identity[0] === `journey:${edition}` && identity[1] === edition;
    });
    assert(card, 'The normal host offers its current, not Classic, mission edition.');
    if (mode !== 'team') {
      const priorV11 = [...p.$('journey-cards').children].filter((row) => {
        const identity = JSON.parse(row.dataset.missionId);
        return (
          identity[0] === 'journey:whole-spatial-v11' &&
          identity[1] === 'whole-spatial-v11' &&
          ['second-landing', 'long-rail', 'new-frontier'].includes(identity[3].split('/').at(-1))
        );
      });
      const priorV10 = [...p.$('journey-cards').children].filter((row) => {
        const identity = JSON.parse(row.dataset.missionId);
        return (
          identity[0] === 'journey:whole-spatial-v10' &&
          identity[1] === 'whole-spatial-v10' &&
          ['island-outpost', 'long-way-home', 'horizon-remix'].includes(
            identity[3].split('/').at(-1),
          )
        );
      });
      const priorV9 = [...p.$('journey-cards').children].filter((row) => {
        const identity = JSON.parse(row.dataset.missionId);
        return (
          identity[0] === 'journey:whole-spatial-v9' &&
          identity[1] === 'whole-spatial-v9' &&
          ['stepping-stones', 'return-pocket', 'neutral-ground'].includes(
            identity[3].split('/').at(-1),
          )
        );
      });
      assert.equal(
        priorV11.length,
        3,
        'The normal selector exposes exactly three prior v11 cards.',
      );
      assert.equal(
        priorV10.length,
        3,
        'The normal selector exposes exactly three prior v10 cards.',
      );
      assert.equal(priorV9.length, 3, 'The normal selector retains the three prior v9 cards.');
    }
    assert.equal(card.querySelector('.journey-card-action').textContent, 'Play');
    assert.equal(card.disabled, false);
    reach(card);
    assert.deepEqual(snapshot(), before, 'Browsing must not start or advance a mission.');
    pulse(1);
    assert.equal(p.$('journey-chooser').open, false);
    assert.equal(p.doc.activeElement, opener, 'East returns to the exact Missions opener.');
    for (let index = 0; index < 6; index++) frame();
    assert.deepEqual(snapshot(), before, 'Controller confirm/back input must not leak into play.');
    if (mode === 'team') {
      assert.equal(p.$('coop-menu').hidden, false, 'The Team lobby remains open, not a live run.');
      assert.deepEqual(p.visits, []);
    } else assert.notEqual(snapshot().state, 'running');
  });
