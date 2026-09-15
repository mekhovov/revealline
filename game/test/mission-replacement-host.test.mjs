import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, SoloElement, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { emptyLibrary, setCampaignProgress, saveLibrary, updatePreferences } from '../library.mjs';
import { emptyProgress } from '../progress.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
const campaign = JSON.parse(await readFile(new URL('../content/campaign.json', import.meta.url)));
const slot = 'revealline.suspended.dev.v1';
const profile = 'revealline.library.dev.v1';
const first = campaign.levels[0].id,
  second = campaign.levels[1].id;
function storageFixture() {
  const storage = memoryStorage(),
    progress = emptyProgress(campaign);
  // An explicit synthetic prior-clear fixture unlocks the second mission; this
  // is navigation coverage, never evidence of an earned player achievement.
  const stats = { score: 100, time: 20, medals: 1, clean: false };
  progress.clears[first] = {
    ...stats,
    variants: { 'grid-center/scout/1/loadout-v1-12345678/1': stats },
  };
  const library = updatePreferences(setCampaignProgress(emptyLibrary(), campaign, progress), {
    turnPolicy: 'grid-center',
  });
  assert.equal(saveLibrary(storage, profile, library).ok, true);
  return storage;
}
function action(element, type = 'click') {
  const fn = element[`on${type}`];
  let result;
  element[`on${type}`] = function (...args) {
    result = fn.apply(this, args);
    return result;
  };
  try {
    type === 'click' ? element.click() : element.emit(type);
  } finally {
    element[`on${type}`] = fn;
  }
  return Promise.resolve(result);
}
async function change(h, id, value) {
  h.$(id).focus();
  h.$(id).value = value;
  await action(h.$(id), 'change');
}
function checkpoint(h) {
  h.frame(0);
  return authoritativeCheckpoint(h.rendered.run);
}
function preserved(h, run, before) {
  for (let n = 0; n < 12; n++) h.frame();
  assert.equal(h.rendered.run === run, true);
  assert.deepEqual(authoritativeCheckpoint(h.rendered.run), before);
  assert.equal(h.rendered.paused, true);
  assert.deepEqual(h.errors, []);
}
async function setup(t, options = {}) {
  const h = await soloPage(t, { storage: storageFixture(), ...options });
  await change(h, 'level-select', first);
  return h;
}
async function flight(h, paused = true) {
  await settle(() => h.doc.body.dataset.pictureState === 'ready');
  h.$('start-button').click();
  h.key('ArrowDown');
  for (let n = 0; n < 27; n++) h.frame();
  h.key('ArrowDown', false);
  h.key('ArrowRight');
  h.frame();
  h.key('ArrowRight', false);
  assert.equal(
    h.rendered.run.player.cutting,
    true,
    JSON.stringify({
      player: h.rendered.run.player,
      paused: h.rendered.paused,
      state: h.doc.body.dataset.flightState,
      dialogs: h.doc.querySelectorAll('dialog[open]').map((e) => e.id),
    }),
  );
  assert.equal(h.rendered.run.player.queuedDirection, 'right');
  if (paused) {
    h.$('overlay-menu').click();
    h.$('shell-packs').click();
    h.$('mission-picker-setup').open = true;
  }
  h.frame(0);
}
async function requestLevel(h, id = second) {
  await change(h, 'level-select', id);
  assert.equal(h.$('mission-replace-dialog').open, true);
  assert.equal(h.$('mission-replace-confirm').disabled, false);
}
for (const entry of ['level', 'card', 'campaign', 'pack'])
  test(`actual ${entry} selection asks once; Stay keeps the queued flight, Replace prepares without Resume`, async (t) => {
    const h = await setup(t);
    // Install a small original pack while ready, preserving the public internal
    // install/selection contract, then return to the base before the live case.
    if (entry === 'campaign') {
      await change(h, 'pack-select', 'night-shift');
      await change(h, 'pack-select', '');
      await change(h, 'level-select', first);
    }
    await flight(h);
    const run = h.rendered.run,
      before = checkpoint(h);
    let opener, value;
    if (entry === 'card') {
      opener = h.$('missions').children[1];
      const focus = SoloElement.prototype.focus;
      t.mock.method(SoloElement.prototype, 'focus', function (...args) {
        // This journey opens the replacement after its Missions parent; DOM
        // order is not native top-layer order. Model that actual opening order.
        const top = h.$('mission-replace-dialog').open
          ? h.$('mission-replace-dialog')
          : h.$('shell-missions').open
            ? h.$('shell-missions')
            : null;
        if (!top || top.contains(this)) focus.apply(this, args);
      });
    } else {
      opener = h.$(
        `${entry === 'level' ? 'level' : entry === 'pack' ? 'pack' : 'campaign'}-select`,
      );
      value =
        entry === 'level'
          ? second
          : entry === 'pack'
            ? 'night-shift'
            : opener.options.find((o) => o.value.startsWith('night-shift/')).value;
    }
    const request = async () => {
      opener.focus();
      if (entry !== 'card') opener.value = value;
      await action(opener, entry === 'card' ? 'click' : 'change');
    };
    await request();
    assert.equal(h.$('mission-replace-dialog').open, true);
    assert.equal(h.doc.activeElement.id, 'mission-replace-stay');
    assert.match(h.$('mission-replace-status').textContent, /saved and verified/);
    assert.equal(h.$('level-select').value, first);
    assert.equal(h.$('pack-select').value, '');
    assert.equal(h.$('campaign-select').value.startsWith(campaign.id + '/'), true);
    preserved(h, run, before);
    const saved = h.storage.getItem(slot);
    assert.deepEqual(JSON.parse(saved).replay.checkpoint, before);
    await request(); // another native change does not queue or replace a prompt
    assert.equal(h.storage.getItem(slot), saved);
    h.$('mission-replace-stay').click();
    assert.equal(h.doc.activeElement === opener, true);
    preserved(h, run, before);
    await request();
    const retained = h.storage.getItem(slot);
    await action(h.$('mission-replace-confirm'));
    await settle(() => h.doc.body.dataset.pictureState === 'ready');
    h.frame(0);
    assert.equal(h.$('mission-replace-dialog').open, false);
    assert.equal(h.rendered.run === run, false);
    assert.equal(h.rendered.run.tick, 0);
    if (entry === 'card')
      assert.equal(h.doc.activeElement === h.$('missions').querySelector('.selected'), true);
    assert.equal(h.rendered.paused, true);
    assert.equal(h.storage.getItem(slot), retained);
    if (entry === 'card')
      assert.equal(
        h.$('content-select-status').textContent,
        `${campaign.levels[1].name} selected. Deploy when ready.`,
      );
    assert.equal(
      h.$('level-select').value,
      entry === 'card' || entry === 'level' ? second : 'night-shift-01',
    );
    assert.deepEqual(h.errors, []);
  });

test('same mission card/level/campaign/base pack preserves a running attempt without pause, write or restart', async (t) => {
  const h = await setup(t);
  await flight(h, false);
  const run = h.rendered.run,
    before = checkpoint(h),
    writes = h.storage.writes.length;
  await change(h, 'level-select', first);
  await change(h, 'campaign-select', h.$('campaign-select').value);
  await change(h, 'pack-select', '');
  await action(h.$('missions').children[0]);
  h.frame(0);
  assert.equal(h.rendered.run === run, true);
  assert.deepEqual(authoritativeCheckpoint(h.rendered.run), before);
  assert.equal(h.rendered.paused, false);
  assert.equal(h.storage.writes.length, writes);
  assert.equal(h.$('mission-replace-dialog').open, false);
});

for (const method of ['button', 'Escape', 'controller'])
  test(`${method} Stay cancels a pending check and restores the exact opener without late save or Resume`, async (t) => {
    const h = await setup(t);
    await flight(h);
    const before = checkpoint(h),
      run = h.rendered.run,
      raw = h.storage.getItem(slot);
    let grant;
    navigator.locks.request = async (_name, _options, work) => {
      await new Promise((resolve) => {
        grant = resolve;
      });
      return work();
    };
    h.$('level-select').focus();
    h.$('level-select').value = second;
    const pending = action(h.$('level-select'), 'change');
    await settle(() => !!grant);
    assert.equal(h.$('mission-replace-confirm').disabled, true);
    if (method === 'button') h.$('mission-replace-stay').click();
    else if (method === 'Escape') {
      const e = h.$('mission-replace-stay').emit('keydown', { key: 'Escape', code: 'Escape' });
      if (!e.defaultPrevented) {
        const cancel = h.$('mission-replace-dialog').emit('cancel', { bubbles: false });
        if (!cancel.defaultPrevented) h.$('mission-replace-dialog').close();
      }
    } else {
      const pad = {
        index: 0,
        id: 'Replacement controller',
        connected: true,
        mapping: 'standard',
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
      };
      navigator.getGamepads = () => [pad];
      h.frame();
      pad.buttons[1] = { pressed: true, value: 1 };
      h.frame();
      pad.buttons[1] = { pressed: false, value: 0 };
      h.frame();
    }
    assert.equal(h.$('mission-replace-dialog').open, false);
    assert.equal(h.doc.activeElement.id, 'level-select');
    grant();
    await pending;
    preserved(h, run, before);
    assert.equal(h.storage.getItem(slot), raw);
    h.$('shell-missions').close();
    const heldTick = run.tick;
    h.$('start-button').click();
    h.frame();
    h.frame();
    assert.equal(h.rendered.paused, false);
    assert.ok(h.rendered.run.tick > heldTick);
  });

for (const failure of ['quota', 'readback', 'newer-before'])
  test(`${failure} keeps truthful loss warning and the old attempt until explicit Replace`, async (t) => {
    const h = await setup(t);
    await flight(h);
    const run = h.rendered.run,
      before = checkpoint(h),
      raw = h.storage.getItem(slot);
    const get = h.storage.getItem.bind(h.storage),
      set = h.storage.setItem.bind(h.storage);
    let written = false;
    if (failure === 'newer-before') set(slot, raw + ' ');
    h.storage.setItem = (key, value) => {
      if (key === slot && failure === 'quota') throw new Error('quota');
      set(key, value);
      if (key === slot) written = true;
    };
    h.storage.getItem = (key) =>
      key === slot && written && failure === 'readback' ? '{}' : get(key);
    await requestLevel(h);
    assert.match(h.$('mission-replace-status').textContent, /not verified.*may lose/);
    assert.doesNotMatch(
      h.$('mission-replace-status').textContent,
      /saved and verified|older.*unchanged/i,
    );
    if (failure === 'readback') assert.equal(written, true);
    else assert.equal(get(slot), failure === 'quota' ? raw : raw + ' ');
    preserved(h, run, before);
    h.$('mission-replace-stay').click();
    assert.equal(h.$('level-select').value, first);
    preserved(h, run, before);
  });

test('new saved slot after verification requires a second deliberate Replace and is never overwritten', async (t) => {
  const h = await setup(t);
  await flight(h);
  const run = h.rendered.run,
    before = checkpoint(h);
  await requestLevel(h);
  const newer = h.storage.getItem(slot) + ' ';
  h.storage.setItem(slot, newer);
  await action(h.$('mission-replace-confirm'));
  assert.equal(h.$('mission-replace-dialog').open, true);
  assert.match(h.$('mission-replace-status').textContent, /changed.*Replace again/);
  preserved(h, run, before);
  await action(h.$('mission-replace-confirm'));
  h.frame(0);
  assert.equal(h.rendered.run.levelId, second);
  assert.equal(h.rendered.paused, true);
  assert.equal(h.storage.getItem(slot), newer);
});

for (const stage of ['download', 'save', 'cancel-download'])
  test(`different pack ${stage} leaves an installed live run/recorder intact through pagehide`, async (t) => {
    const db = managedIndexedDB();
    const h = await setup(t, { assetIndexedDB: db.indexedDB });
    await change(h, 'pack-select', 'night-shift');
    await settle(() => h.doc.body.dataset.pictureState === 'ready');
    h.$('start-button').click();
    h.key('ArrowDown');
    for (let n = 0; n < 20; n++) h.frame();
    h.key('ArrowDown', false);
    assert.ok(h.rendered.run.tick > 0);
    h.$('overlay-menu').click();
    h.$('shell-packs').click();
    h.frame(0);
    const run = h.rendered.run,
      before = checkpoint(h),
      currentLevel = h.$('level-select').value;
    const fetch = globalThis.fetch;
    let release;
    if (stage !== 'save')
      globalThis.fetch = async (url, options) => {
        if (url === 'content/packs/living-threads.json') {
          if (stage === 'cancel-download')
            await new Promise((resolve) => {
              release = resolve;
            });
          throw new Error('Download unavailable');
        }
        return fetch(url, options);
      };
    if (stage === 'save') db.failAnyPutAt = 1;
    await change(h, 'pack-select', 'living-threads');
    const saved = h.storage.getItem(slot);
    assert.equal(h.$('mission-replace-dialog').open, true);
    assert.match(h.$('mission-replace-status').textContent, /saved and verified/);
    assert.deepEqual(JSON.parse(saved).replay.checkpoint, before);
    const pending = action(h.$('mission-replace-confirm'));
    if (stage === 'cancel-download') {
      await settle(() => !!release);
      h.$('mission-replace-stay').click();
      release();
    }
    await pending;
    if (stage === 'download')
      assert.match(h.$('content-select-status').textContent, /Chapter download unavailable/);
    if (stage === 'save') assert.match(h.$('content-select-status').textContent, /storage failed/);
    assert.equal(h.$('pack-select').value, 'night-shift');
    assert.equal(h.$('level-select').value, currentLevel);
    preserved(h, run, before);
    assert.equal(h.storage.getItem(slot), saved);
    h.win.emit('pagehide', { persisted: false });
    assert.equal(h.storage.getItem(slot), saved);
  });

test('successful different-pack install adopts a fresh paused run and leaves the previous run unchanged', async (t) => {
  const db = managedIndexedDB();
  const h = await setup(t, { assetIndexedDB: db.indexedDB });
  await change(h, 'pack-select', 'night-shift');
  await settle(() => h.doc.body.dataset.pictureState === 'ready');
  h.$('start-button').click();
  for (let n = 0; n < 5; n++) h.frame();
  assert.ok(h.rendered.run.tick > 0);
  h.$('overlay-menu').click();
  h.$('shell-packs').click();
  const run = h.rendered.run,
    before = checkpoint(h);
  await change(h, 'pack-select', 'living-threads');
  // Observe actual storage commit, followed by one explicit fresh selection.
  let committed = false;
  db.afterAnyCommit = () => {
    committed = true;
  };
  await action(h.$('mission-replace-confirm'));
  assert.equal(committed, true);
  h.frame(0);
  assert.equal(h.rendered.paused, true);
  assert.equal(h.rendered.run === run, false);
  assert.equal(h.rendered.run.tick, 0);
  assert.deepEqual(authoritativeCheckpoint(run), before);
});

test('chapter card uses the existing pack change adapter but Stay returns to that visible card', async (t) => {
  const h = await setup(t);
  await flight(h);
  h.$('mission-picker-setup').open = false;
  const card = [...h.$('mission-picker-cards').children].find(
    (node) => node.getAttribute('data-pack') === 'night-shift',
  );
  assert.ok(card);
  const before = checkpoint(h),
    run = h.rendered.run;
  card.focus();
  card.click();
  await settle(
    () => h.$('mission-replace-dialog').open && !h.$('mission-replace-confirm').disabled,
  );
  assert.equal(h.doc.activeElement.id, 'mission-replace-stay');
  assert.equal(h.$('pack-select').value, '');
  h.$('mission-replace-stay').click();
  assert.equal(h.doc.activeElement === card, true);
  preserved(h, run, before);
});

test('restored paused unfinished flight is guarded and Stay preserves its exact saved continuation', async (t) => {
  const storage = storageFixture();
  let before, raw;
  await t.test('create a real saved queued turn', async (t) => {
    const h = await setup(t, { storage });
    await flight(h);
    before = checkpoint(h);
    raw = storage.getItem(slot);
  });
  raw = storage.getItem(slot);
  await t.test('reload, explicitly Continue, then choose another mission', async (t) => {
    const h = await soloPage(t, { storage, titleScreen: true });
    h.$('shell-continue').click();
    await settle(() => {
      h.frame(0);
      return h.rendered.run.tick > 0;
    });
    assert.deepEqual(checkpoint(h), before);
    assert.equal(h.rendered.paused, true);
    h.$('overlay-menu').click();
    h.$('shell-packs').click();
    h.$('mission-picker-setup').open = true;
    const run = h.rendered.run;
    await requestLevel(h);
    h.$('mission-replace-stay').click();
    preserved(h, run, before);
    assert.deepEqual(
      JSON.parse(storage.getItem(slot)).replay.checkpoint,
      JSON.parse(raw).replay.checkpoint,
    );
  });
});

test('unavailable IDs and locked missions do not create prompts or adopt an arbitrary target', async (t) => {
  const h = await setup(t);
  await flight(h);
  const run = h.rendered.run,
    before = checkpoint(h),
    saved = h.storage.getItem(slot);
  for (const [id, value] of [
    ['level-select', 'not-a-map'],
    ['campaign-select', 'https://invalid.example/path'],
    ['pack-select', '../unowned.json'],
    ['level-select', campaign.levels.at(-1).id],
  ]) {
    await change(h, id, value);
    assert.equal(h.$('mission-replace-dialog').open, false);
    preserved(h, run, before);
    assert.equal(h.storage.getItem(slot), saved);
  }
});
