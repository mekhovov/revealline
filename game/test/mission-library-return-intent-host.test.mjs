import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, SoloElement, memoryStorage } from './helpers/solo-dom.mjs';
import { couchPage } from './helpers/couch-host.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { PNGImage } from './helpers/png-image.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { teamReturnHref } from '../mode-return.mjs';
import { readVersusSoloReturnToken } from '../mode-return-v2.mjs';
import { readMissionLibraryReturn } from '../mission-library/handoff.mjs';
import { JOURNEY_PREFERENCES_KEY, JOURNEY_PREFERENCES_VERSION } from '../journey/preferences.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { activateMissionCard, openMissionLibrary } from './helpers/library-selection.mjs';

const settle = (condition) => waitFor(condition, { timeoutMs: 10000 });
// Compiling the real Journey before the held request is a boot precondition,
// not the post-action response under test. Keep those action waits at ten seconds.
const settleBoot = (condition) =>
  waitFor(condition, {
    timeoutMs: 45000,
    message: 'The real host must finish boot preparation and reach the held metadata request.',
  });
const expert = JSON.stringify({ format: JOURNEY_PREFERENCES_VERSION, difficulty: 'expert' });
// Native boot keeps controls inert until ready. This is the same finite focus
// boundary used by the existing checked mode-return host tests.
function nativeSoloBoot(t) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'RevealLineBoot');
  const focus = SoloElement.prototype.focus;
  let ready = false;
  t.mock.method(SoloElement.prototype, 'focus', function (...args) {
    if (
      ready &&
      !this.disabled &&
      !this.closest('[hidden],[inert]') &&
      this.getClientRects().length
    )
      focus.apply(this, args);
  });
  globalThis.RevealLineBoot = {
    progress() {},
    fail(error) {
      throw error;
    },
    ready() {
      ready = true;
      globalThis.document.documentElement.dataset.bootState = 'ready';
      for (const element of globalThis.document.querySelectorAll('[data-boot-inert]'))
        element.inert = false;
      globalThis.document.getElementById('boot-screen').hidden = true;
    },
  };
  t.after(() =>
    original
      ? Object.defineProperty(globalThis, 'RevealLineBoot', original)
      : delete globalThis.RevealLineBoot,
  );
}
async function solo(t, options = {}) {
  return soloPage(t, {
    titleScreen: true,
    journeyIndexedDB: managedIndexedDB().indexedDB,
    pictures: { Image: PNGImage },
    fetchResponse: async (path) => {
      if (String(path).includes('/content-design/assets/'))
        return new Response(await readFile(path));
    },
    ...options,
  });
}
async function versus(t, options = {}) {
  const databases = new Map();
  return couchPage(t, {
    initialLevel: null,
    assetDatabase: {
      open(name, ...args) {
        if (!databases.has(name)) databases.set(name, managedIndexedDB());
        return databases.get(name).indexedDB.open(name, ...args);
      },
    },
    fetchResponse: async (path) => {
      if (String(path).includes('/content-design/assets/'))
        return new Response(await readFile(path));
      if (path === '../content/packs/fpv-arcade-r5.json')
        return new Response('Base fixture', { status: 503 });
    },
    ...options,
  });
}
async function open(p, host, mode) {
  if (host === 'solo') await openMissionLibrary(p, 'shell-play');
  else {
    const opener = p.$('race-library-switch'),
      listeners = opener.listeners.get('click'),
      pending = [];
    opener.listeners.set(
      'click',
      new Set(
        [...listeners].map((listener) => (event) => {
          const result = listener.call(opener, event);
          if (result instanceof Promise) pending.push(result);
          return result;
        }),
      ),
    );
    try {
      opener.focus();
      opener.click();
    } finally {
      opener.listeners.set('click', listeners);
    }
    assert.equal(pending.length, 1, 'The visible Missions action owns preparation.');
    assert.match(p.$('race-message').textContent, /Preparing missions/);
    await pending[0];
    assert.equal(p.$('journey-chooser').open, true);
  }
  p.$('journey-mode').value = mode;
  p.$('journey-mode').emit('change');
  return [...p.$('journey-cards').children];
}

function incomingSoloSearch() {
  const mission = JSON.stringify([
    'journey:whole-spatial-v5',
    'whole-spatial-v5',
    JSON.stringify(['candidate', 'journey-opening', 'prologue']),
    'candidate/journey-opening/prologue/choose-your-share',
    '',
  ]);
  return `?${new URLSearchParams({
    journey: 'whole-spatial-v5',
    'library-mission': mission,
    return: 'team',
    'journey-return': 'team-spatial-originals-1',
  })}`;
}

test('native inert boot cannot cancel exact Team-to-Solo handoff with its own fallback focus', async (t) => {
  nativeSoloBoot(t);
  const p = await solo(t, { search: incomingSoloSearch() });
  await settle(() => {
    p.frame(0);
    return p.doc.body.dataset.flightState === 'running';
  });
  assert.equal(p.rendered.run.levelId, 'choose-your-share');
  assert.equal(p.$('journey-chooser').open, false);
  assert.equal(p.doc.activeElement.id, 'game-canvas');
  assert.deepEqual(p.errors, []);
});

for (const interruption of ['focus', 'hidden'])
  test(`native incoming Solo handoff still yields to newer ${interruption} while metadata waits`, async (t) => {
    nativeSoloBoot(t);
    let release,
      entered = false;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const page = solo(t, {
      search: incomingSoloSearch(),
      fetchResponse: async (path) => {
        if (String(path).includes('/content-design/assets/'))
          return new Response(await readFile(path));
        if (path === 'content/mission-library-index.json') {
          entered = true;
          await gate;
        }
      },
    });
    const pageSettled = page.catch(() => {});
    try {
      await settleBoot(() => entered);
      const doc = globalThis.document;
      assert.equal(doc.activeElement, doc.body, 'The boot surface has not claimed focus.');
      if (interruption === 'focus') {
        doc.getElementById('overlay-menu').focus();
        assert.equal(
          doc.activeElement.id,
          'overlay-menu',
          'Newer focus must reach a visible control.',
        );
      } else {
        doc.hidden = true;
        doc.emit('visibilitychange');
      }
      release();
      const p = await page;
      p.frame(0);
      assert.equal(p.rendered.run.levelId, 'first-return');
      assert.notEqual(p.doc.body.dataset.flightState, 'running');
      assert.equal(p.$('journey-chooser').open, false);
      if (interruption === 'focus') assert.equal(doc.activeElement.id, 'overlay-menu');
      assert.deepEqual(p.errors, []);
    } finally {
      // Settle the original page before its fixture restores global DOM state,
      // even when interception or an assertion fails. Keep the original failure.
      release();
      await pageSettled;
    }
  });

test('Team-to-Versus incoming selection finishes before normal lobby focus and starts both exact boards', async (t) => {
  const p = await versus(t, {
    href: `http://localhost/game/couch/${incomingSoloSearch()}`,
  });
  await settle(() => {
    p.frame(0);
    return p.state() === 'running';
  });
  assert.equal(p.renders[0].level.id, 'choose-your-share');
  assert.equal(p.renders[1].level.id, 'choose-your-share');
  assert.equal(p.$('journey-chooser').open, false);
  assert.equal(p.doc.activeElement.id, 'race-canvas-0');
  assert.equal(p.doc.documentElement.dataset.toolState, 'ready');
});

test('Team-to-Versus incoming selection cannot start while hidden after held metadata', async (t) => {
  let release,
    entered = false;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const page = versus(t, {
    href: `http://localhost/game/couch/${incomingSoloSearch()}`,
    fetchResponse: async (path) => {
      if (String(path).includes('/content-design/assets/'))
        return new Response(await readFile(path));
      if (path === '../content/mission-library-index.json') {
        entered = true;
        await gate;
      }
    },
  });
  const pageSettled = page.catch(() => {});
  try {
    await settleBoot(() => entered);
    globalThis.document.hidden = true;
    globalThis.document.emit('visibilitychange');
    release();
    const p = await page;
    p.frame(0);
    assert.equal(p.renders[0].level.id, 'first-return');
    assert.equal(p.renders[1].level.id, 'first-return');
    assert.equal(p.state(), 'ready');
    assert.equal(p.$('journey-chooser').open, false);
    assert.equal(p.doc.documentElement.dataset.toolState, 'ready');
  } finally {
    release();
    await pageSettled;
  }
});

for (const source of ['legacy', 'whole-spatial-v5', 'opening'])
  test(`Solo ${source} → selected Team owner retains source route and exact mission`, async (t) => {
    const storage = memoryStorage(),
      previewStorage = memoryStorage();
    storage.setItem(JOURNEY_PREFERENCES_KEY, expert);
    const p = await solo(t, { search: `?journey=${source}`, storage, previewStorage });
    const cards = await open(p, 'solo', 'team');
    assert.equal(cards.length, 14);
    assert.equal(p.$('mission-picker-setup').contains(p.$('shell-mode-choice')), true);
    assert.equal(
      p
        .$('mission-picker-setup')
        .querySelector('.mission-picker-setup-fields')
        .contains(p.$('shell-mode-choice')),
      true,
    );
    assert.equal(p.doc.querySelectorAll('#shell-mode-choice').length, 1);
    assert.equal(
      p.$('mission-picker-setup').open,
      false,
      'Optional native mode controls stay collapsed.',
    );
    assert.match(cards[0].textContent, /Expert/);
    const card = source === 'legacy' ? cards[0] : cards.at(-1);
    const selected = card.dataset.missionId;
    card.click();
    await settle(() => globalThis.location.href.includes('relay-rescue.html'));
    const target = new URL(globalThis.location.href);
    assert.equal(target.searchParams.get('library-mission'), selected);
    assert.equal(
      target.searchParams.get('journey'),
      source === 'legacy' ? 'team-spatial-originals-1' : 'legacy',
    );
    assert.deepEqual(readMissionLibraryReturn(target.searchParams, { mode: 'team' }), {
      mode: 'solo',
      journey: source,
    });
    if (source === 'legacy') {
      assert.match(target.searchParams.get('return-token'), /^[0-9a-f]{32}$/);
      assert.match(
        teamReturnHref({ href: target.href, storage: previewStorage }),
        /^\.\.\/\?mode-return=/,
      );
    } else assert.equal(target.searchParams.has('return-token'), false);
    assert.equal(
      storage.getItem(JOURNEY_PREFERENCES_KEY),
      expert,
      'Browsing cannot change the receiving preset.',
    );
    assert.deepEqual(p.errors, []);
  });

for (const source of ['legacy', 'opening'])
  test(`Versus ${source} Team cards use saved Expert and retain source edition`, async (t) => {
    const storage = memoryStorage();
    storage.setItem(JOURNEY_PREFERENCES_KEY, expert);
    const p = await versus(t, { href: `http://localhost/game/couch/?journey=${source}`, storage });
    const cards = await open(p, 'versus', 'team');
    assert.equal(cards.length, 14);
    assert.match(cards[0].textContent, /Expert/);
    const selected = cards[0].dataset.missionId;
    cards[0].click();
    await settle(() => globalThis.location.href.includes('relay-rescue.html'));
    const target = new URL(globalThis.location.href);
    assert.deepEqual(readMissionLibraryReturn(target.searchParams, { mode: 'team' }), {
      mode: 'versus',
      journey: source,
    });
    assert.equal(target.searchParams.get('library-mission'), selected);
    assert.equal(storage.getItem(JOURNEY_PREFERENCES_KEY), expert);
  });

test('Legacy Solo → Journey Versus → Solo restores browsing independently of the checked retained runtime', async (t) => {
  const storage = memoryStorage(),
    previewStorage = memoryStorage();
  let target, selected, returnHref, originalSelection, browse;
  await t.test('depart actual Solo library', async (t) => {
    const p = await solo(t, { storage, previewStorage });
    const cards = await open(p, 'solo', 'versus');
    const card = cards.find((row) =>
      JSON.parse(row.dataset.missionId)[3].endsWith('/choose-your-share'),
    );
    assert(card);
    selected = card.dataset.missionId;
    p.$('journey-collection').value = 'Journey';
    p.$('journey-collection').emit('change');
    const campaign = JSON.stringify(JSON.parse(selected).slice(0, 3));
    assert([...p.$('journey-campaign').children].some((option) => option.value === campaign));
    p.$('journey-campaign').value = campaign;
    p.$('journey-campaign').emit('change');
    p.$('journey-search').value = 'Choose your share';
    p.$('journey-search').emit('input');
    p.$('journey-cards').scrollTop = 120;
    assert(p.$('journey-cards').contains(card), 'Activate the visible filtered card.');
    card.click();
    await settle(() => globalThis.location.href.includes('/couch/'));
    target = globalThis.location.href;
    originalSelection = JSON.parse(
      previewStorage.getItem('revealline.mode-return.v2:/game/'),
    ).selection;
    browse = JSON.parse(previewStorage.getItem('revealline.mission-library.selector.v1.solo'));
    assert.equal(browse.selectedId, selected);
    assert.equal(browse.mode, 'versus');
    assert.equal(new URL(target).searchParams.get('library-mission'), selected);
    assert.equal(new URL(target).searchParams.get('journey'), 'whole-spatial-v5');
    assert.match(new URL(target).searchParams.get('return-token-v2'), /^[0-9a-f]{32}$/);
  });
  await t.test(
    'selected Journey Versus preserves Solo token despite its own different edition',
    async (t) => {
      const p = await versus(t, { href: target, storage, previewStorage });
      await settle(() => {
        p.frame(0);
        return p.state() === 'running';
      });
      p.$('race-pause').click();
      p.$('race-solo-return').emit('click');
      assert.equal(p.$('race-leave-panel').hidden, false);
      returnHref = p.$('race-leave').getAttribute('href');
      assert.equal(
        returnHref,
        `../?mode-return-v2=${readVersusSoloReturnToken({ href: target, storage: previewStorage })}`,
      );
    },
  );
  await t.test(
    'Solo consumes only its original selection record without starting a mission',
    async (t) => {
      const search = new URL(returnHref, target).search;
      nativeSoloBoot(t);
      const p = await solo(t, { search, storage, previewStorage });
      assert.equal(
        p.$('journey-chooser')?.open,
        true,
        JSON.stringify({
          focus: p.doc.activeElement.id,
          status: p.$('run-message').textContent,
          errors: p.errors.map((error) => error.message),
          record: previewStorage.getItem('revealline.mode-return.v2:/game/'),
          search,
        }),
      );
      assert.equal(
        p.doc.activeElement.classList.contains('journey-card'),
        true,
        JSON.stringify({
          focus: p.doc.activeElement.id,
          originalSelection,
          candidates: [...p.$('journey-cards').children]
            .filter((card) => card.textContent.includes('Classic'))
            .slice(0, 2)
            .map((card) => [card.dataset.missionId, card.textContent]),
        }),
      );
      assert.equal(p.doc.activeElement.dataset.missionId, selected);
      assert.equal(p.$('journey-mode').value, browse.mode);
      assert.equal(p.$('journey-search').value, browse.search);
      assert.equal(p.$('journey-collection').value, browse.collection);
      assert.equal(p.$('journey-campaign').value, browse.campaign);
      assert.equal(p.$('journey-cards').scrollTop, browse.scroll);
      assert.equal(p.$('level-select').value, originalSelection.levelId);
      assert.equal(p.rendered.run.levelId, originalSelection.levelId);
      assert.equal(p.rendered.run.tick, 0);
      assert.equal(previewStorage.getItem('revealline.mode-return.v2:/game/'), null);
      assert.deepEqual(p.errors, []);
    },
  );
});

test('denied library return-token storage needs deliberate warned departure and keeps exact destination/source', async (t) => {
  const previewStorage = {
    getItem: () => null,
    setItem() {
      throw new Error('Denied');
    },
    removeItem() {},
  };
  const p = await solo(t, { previewStorage });
  const cards = await open(p, 'solo', 'team');
  const id = cards[0].dataset.missionId;
  cards[0].click();
  await settle(() => p.$('mode-leave-dialog').open && !p.$('mode-leave-confirm').disabled);
  assert.equal(globalThis.location.href, 'http://localhost/game/?journey=legacy');
  assert.match(p.$('mode-leave-status').textContent, /Return selection could not be saved/);
  p.$('mode-leave-confirm').click();
  const target = new URL(globalThis.location.href);
  assert.equal(target.searchParams.get('library-mission'), id);
  assert.equal(target.searchParams.has('return-token'), false);
  assert.deepEqual(readMissionLibraryReturn(target.searchParams, { mode: 'team' }), {
    mode: 'solo',
    journey: 'legacy',
  });
});

test('unfinished Legacy library departure checks its saved attempt before minting the Team return token', async (t) => {
  const storage = memoryStorage(),
    previewStorage = memoryStorage();
  const p = await solo(t, { storage, previewStorage, titleScreen: false });
  p.$('start-button').click();
  await settle(() => p.doc.body.dataset.flightState === 'running');
  p.key('ArrowDown');
  for (let index = 0; index < 24; index++) p.frame();
  p.key('ArrowDown', false);
  assert.equal(p.rendered.run.tick, 24);
  assert.ok(p.rendered.run.trail.length > 0, 'Departure must protect a genuine unfinished cut.');
  p.$('overlay-menu').click();
  const cards = await open(p, 'solo', 'team');
  const checkpoint = authoritativeCheckpoint(p.rendered.run);
  cards[0].click();
  await settle(() => p.$('mode-leave-dialog').open && !p.$('mode-leave-confirm').disabled);
  assert.match(p.$('mode-leave-status').textContent, /saved and verified/);
  assert.equal(previewStorage.getItem('revealline.mode-return.v1:/game/'), null);
  const saved = storage.getItem('revealline.suspended.dev.v1');
  assert.ok(saved);
  p.$('mode-leave-stay').click();
  assert.equal(p.$('journey-chooser').open, true);
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), checkpoint);
  cards[0].click();
  await settle(() => p.$('mode-leave-dialog').open && !p.$('mode-leave-confirm').disabled);
  p.$('mode-leave-confirm').click();
  assert.match(
    new URL(globalThis.location.href).searchParams.get('return-token'),
    /^[0-9a-f]{32}$/,
  );
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), checkpoint);
  assert.ok(storage.getItem('revealline.suspended.dev.v1'));
});

for (const host of ['solo', 'versus'])
  test(`Legacy ${host} refreshes visible remote preset cards on storage/pageshow without writing or moving focus`, async (t) => {
    const storage = memoryStorage();
    const p =
      host === 'solo'
        ? await solo(t, { storage })
        : await versus(t, { storage, href: 'http://localhost/game/couch/?journey=legacy' });
    const cards = await open(p, host, 'team');
    const focused = cards[0];
    focused.focus();
    const checkpoint = host === 'solo' ? authoritativeCheckpoint(p.rendered.run) : p.checkpoint();
    assert.match(focused.textContent, /Standard/);
    const set = storage.setItem.bind(storage);
    let preferenceWrites = 0;
    storage.setItem = (key, raw) => {
      if (key === JOURNEY_PREFERENCES_KEY) preferenceWrites++;
      set(key, raw);
    };
    set(JOURNEY_PREFERENCES_KEY, expert);
    p.win.emit('storage', { key: JOURNEY_PREFERENCES_KEY, storageArea: storage, newValue: expert });
    assert.match(focused.textContent, /Expert/);
    assert.equal(p.doc.activeElement, focused);
    const gentle = JSON.stringify({ format: JOURNEY_PREFERENCES_VERSION, difficulty: 'gentle' });
    set(JOURNEY_PREFERENCES_KEY, gentle);
    p.win.emit('pageshow', { persisted: true });
    assert.match(focused.textContent, /Gentle/);
    assert.equal(p.doc.activeElement, focused);
    assert.equal(preferenceWrites, 0);
    assert.deepEqual(
      host === 'solo' ? authoritativeCheckpoint(p.rendered.run) : p.checkpoint(),
      checkpoint,
    );
  });

test('late Classic checked return without saved browse state uses the retained mission as a focus fallback', async (t) => {
  const storage = memoryStorage(),
    previewStorage = memoryStorage();
  let target, missionId, before;
  await t.test(
    'play the late selectable Base mission and depart through its actual library',
    async (t) => {
      const p = await solo(t, { storage, previewStorage });
      const cards = await open(p, 'solo', 'solo');
      const card = cards.find((item) => JSON.parse(item.dataset.missionId)[3] === 'signal-12');
      assert.ok(card);
      missionId = card.dataset.missionId;
      await activateMissionCard(card);
      await settle(() => {
        p.frame(0);
        return (
          p.rendered.run.levelId === 'signal-12' && p.doc.body.dataset.flightState === 'running'
        );
      });
      p.$('overlay-menu').click();
      const teams = await open(p, 'solo', 'team');
      teams[0].click();
      await settle(() => p.$('mode-leave-dialog').open && !p.$('mode-leave-confirm').disabled);
      assert.match(p.$('mode-leave-status').textContent, /saved and verified/);
      p.$('mode-leave-confirm').click();
      target = globalThis.location.href;
      const record = JSON.parse(previewStorage.getItem('revealline.mode-return.v1:/game/'));
      assert.equal(record.selection.levelId, 'signal-12');
      before = storage.getItem('revealline.library.dev.v1');
      assert.equal(
        before,
        null,
        'Playing an uncleared mission must not invent a stored progress record.',
      );
    },
  );
  await t.test(
    'checked return focuses that exact late edition, keeping progress bytes and attempt untouched',
    async (t) => {
      nativeSoloBoot(t);
      const search = new URL(teamReturnHref({ href: target, storage: previewStorage }), target)
        .search;
      previewStorage.removeItem('revealline.mission-library.selector.v1.solo');
      const p = await solo(t, { search, storage, previewStorage });
      assert.equal(p.$('journey-chooser').open, true);
      assert.equal(p.doc.activeElement.dataset.missionId, missionId);
      assert.equal(p.$('level-select').value, 'signal-12');
      assert.equal(p.rendered.run.levelId, 'signal-12');
      assert.equal(p.rendered.run.tick, 0);
      assert.equal(storage.getItem('revealline.library.dev.v1'), before);
      assert.equal(previewStorage.getItem('revealline.mode-return.v1:/game/'), null);
    },
  );
});
