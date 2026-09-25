// Actual solo entry, stored library, native-select adapter and picture handlers.
// Browser focus/default events and canvas painting are modeled boundaries.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, SoloElement, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import {
  preparePack,
  installPack,
  emptyPackLibrary,
  exportPackLibrary,
  resolvePackCampaign,
} from '../packs.mjs';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import { createRun, stepRun, getSummary, FIXED_DT } from '../core/index.mjs';
import { emptyLibrary, recordLibraryCompletion, saveLibrary } from '../library.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

const profileKey = 'revealline.library.dev.v1';
const source = JSON.parse(
  await readFile(new URL('../content/packs/night-shift.json', import.meta.url)),
);
const { pack } = await preparePack({
  ...source,
  id: 'collection-context-fixture',
  name: 'Collection context fixture',
  campaigns: [
    {
      ...source.campaigns[0],
      id: 'collection-earned-chapter',
      title: 'Earned chapter',
      levels: [0, 1, 2].map((i) => ({
        version: 'xonix-level.v1',
        id: `collection-map-${i}`,
        revision: '1',
        name: `Earned map ${i}`,
        width: 48,
        height: 36,
        spawn: { x: 24.5, y: 0.5 },
        walls: [],
        enemies: [],
        objectives: [],
        supplies: [],
        goal: { coverage: 0.5 },
      })),
    },
  ],
});
const entries = createExecutionCatalog([resolvePackCampaign(pack, pack.campaigns[0].id)]).entries;

async function setup(t, modes = ['standard', 'gentle'], { installed = true } = {}) {
  const assets = managedIndexedDB();
  const db = await new Promise((resolve, reject) => {
    const request = assets.indexedDB.open('revealline-assets-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('assets');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise((resolve, reject) => {
    const tx = db.transaction('assets', 'readwrite');
    tx.objectStore('assets').put(
      exportPackLibrary(installed ? installPack(emptyPackLibrary(), pack) : emptyPackLibrary()),
      'revealline.packs.dev.v1',
    );
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
  });
  db.close();
  let library = emptyLibrary();
  for (const mode of modes) {
    const entry = entries.find((item) => item.difficulty === mode);
    const run = createRun(entry.campaign.levels[0], {
      seed: 1,
      classId: 'scout',
      classRecipes: pack.classRecipes,
    });
    for (let i = 0; i < 1000 && run.status === 'running'; i++)
      stepRun(run, { direction: 'down' }, FIXED_DT);
    assert.equal(run.status, 'won', 'Stored context must originate in a legal core completion.');
    library = recordLibraryCompletion(library, {
      campaign: entry.campaign,
      result: getSummary(run),
      runId: `collection-${mode}`,
      themeId: 'retro',
      bodyId: 'retro-craft',
      sourcePackId: pack.id,
      completedAt: `2026-09-13T12:00:0${mode === 'gentle' ? 1 : 0}.000Z`,
    });
  }
  const storage = memoryStorage();
  assert.equal(saveLibrary(storage, profileKey, library).ok, true);
  const modalOrigins = new WeakMap(),
    show = SoloElement.prototype.showModal;
  t.mock.method(SoloElement.prototype, 'showModal', function () {
    if (this.open) return;
    modalOrigins.set(this, this.ownerDocument.activeElement);
    this.emit('beforetoggle', { oldState: 'closed', newState: 'open' });
    show.call(this);
    this.querySelector('button:not(:disabled),select:not(:disabled),input:not(:disabled)')?.focus();
  });
  t.mock.method(SoloElement.prototype, 'close', function () {
    if (!this.open) return;
    this.open = false;
    this.removeAttribute('open');
    const origin = modalOrigins.get(this),
      dialog = origin?.closest('dialog');
    if (origin?.isConnected && !origin.closest('[hidden]') && (!dialog || dialog.open))
      origin.focus();
    else this.ownerDocument.activeElement = this.ownerDocument.body;
    // Native close listeners run after default focus restoration, so the
    // gallery can deliberately focus its newly populated originating card.
    queueMicrotask(() => this.emit('close'));
  });
  t.mock.method(SoloElement.prototype, 'getContext', () => ({ drawImage() {} }));
  t.mock.method(BoardPainter.prototype, 'drawGallery', () => {});
  const page = await soloPage(t, { storage, assetIndexedDB: assets.indexedDB });
  return {
    ...page,
    get rendered() {
      return page.rendered;
    },
    library,
    entries,
    assets,
  };
}
function open(page) {
  page.$('collection-button').focus();
  page.$('collection-button').click();
  page.frame(0);
  assert.equal(page.$('collection-dialog').open, true);
  // These tests browse the explicit secondary progress view.
  page.$('collection-progress').open = true;
  page.$('collection-progress').emit('toggle');
}
function padFor(page, t) {
  let now = 1000;
  const realNow = performance.now.bind(performance);
  t.mock.method(performance, 'now', () => realNow() + now);
  const pad = {
    index: 0,
    id: 'Collection test controller',
    mapping: 'standard',
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  navigator.getGamepads = () => [pad];
  const frame = () => {
    now += 20;
    page.frame(20);
  };
  const pulse = (index) => {
    pad.buttons[index] = { pressed: true, value: 1 };
    frame();
    pad.buttons[index] = { pressed: false, value: 0 };
    frame();
  };
  frame();
  // A neutral sample connects automatically; Confirm is now a real menu action.
  return pulse;
}

test('open Collection translates earned rewards while retaining its context, nodes, focus and progress', async (t) => {
  const locale = getLocale();
  t.after(() => setLocale(locale, { persist: false }));
  setLocale('en', { persist: false });
  const page = await setup(t);
  open(page);
  const select = page.$('collection-context');
  select.focus();
  const selection = select.value;
  const rows = [...page.$('appearance-rewards').children];
  const badges = [...page.$('achievements').children];
  const checkpoint = authoritativeCheckpoint(page.rendered.run);
  const saved = [...page.storage.map];
  const writes = page.storage.writes.length;
  const assetWrites = page.assets.allPuts.length;
  for (const language of ['uk', 'en', 'uk']) {
    setLocale(language, { persist: false });
    assert.equal(
      rows[0].querySelector('h4').textContent,
      language === 'uk' ? 'Перша перемога' : 'First clear',
    );
    assert.equal(
      rows[1].querySelector('h4').textContent,
      language === 'uk' ? 'Дослідник розділу' : 'Chapter explorer',
    );
    assert.match(
      rows[1].querySelector('.reward-detail').textContent,
      language === 'uk' ? /ще 2 місії/ : /2 more missions/,
    );
    assert.match(
      badges[2].querySelector('span').textContent,
      language === 'uk' ? /Пройдіть 3 різні місії/ : /Complete 3 different missions/,
    );
    assert.match(
      page.$('appearance-campaign').textContent,
      /Earned chapter/,
      'Imported chapter names retain their authored text.',
    );
    assert.deepEqual([...page.$('appearance-rewards').children], rows);
    assert.deepEqual([...page.$('achievements').children], badges);
    assert.equal(select.value, selection);
    assert.equal(page.doc.activeElement, select);
    assert.equal(page.$('collection-dialog').open, true);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
    assert.deepEqual([...page.storage.map], saved);
    assert.equal(page.storage.writes.length, writes);
    assert.equal(page.assets.allPuts.length, assetWrites);
  }
  assert.deepEqual(page.errors, []);
});

for (const modes of [['standard'], ['gentle'], ['standard', 'gentle']])
  test(`Collection card labels each earned mode once: ${modes.join(' + ')}`, async (t) => {
    const page = await setup(t, modes);
    open(page);
    const cards = page.$('gallery-grid').querySelectorAll('button');
    assert.equal(cards.length, 1);
    const text = cards[0].children[2].textContent;
    for (const mode of ['Standard', 'Gentle'])
      assert.equal(text.split(mode).length - 1, Number(modes.includes(mode.toLowerCase())), text);
    const selected = modes.includes('standard') ? 'Standard' : 'Gentle';
    const entry = entries.find((item) => item.difficulty === selected.toLowerCase());
    const item = page.library.gallery.find((picture) => picture.campaignKey === entry.executionKey);
    assert.ok(item, 'The selected difficulty supplies its own earned picture.');
    assert.equal(page.library.campaigns[item.campaignKey].clears[item.levelId].medals, 3);
    assert.ok(
      text.endsWith(
        `${selected} · Picture best ${item.score.toLocaleString()} points · Level best GOLD` +
          (modes.length === 2 ? ' · Also earned: Gentle' : ''),
      ),
      text,
    );
    if (modes.length === 2) assert.match(text, /Also earned: Gentle$/);
  });

test('global Collection inspects earned chapter progress independently of the paused current flight', async (t) => {
  const page = await setup(t);
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.key('ArrowDown');
  page.key('ArrowDown', false);
  for (let i = 0; i < 20; i++) page.frame();
  assert.equal(page.rendered.run.player.cutting, true);
  page.key('Escape');
  page.key('Escape', false);
  page.frame(0);
  await settle(
    () =>
      JSON.parse(page.storage.getItem('revealline.suspended.dev.v1') ?? 'null')?.replay?.ticks ===
      20,
    'The existing Pause autosave must finish before taking the no-write baseline.',
  );
  const checkpoint = authoritativeCheckpoint(page.rendered.run),
    run = page.rendered.run;
  open(page);
  // Opening Collection already invokes the existing Pause/save path. Only
  // the new read-only selector is subject to this exact no-write baseline.
  const raw = [...page.storage.map],
    writes = page.storage.writes.length,
    assetWrites = page.assets.allPuts.length;
  const select = page.$('collection-context');
  assert.ok(select, 'Chapter progress must have an explicit native selector.');
  assert.equal(select.tagName, 'SELECT');
  const gentle = entries.find((e) => e.difficulty === 'gentle'),
    standard = entries.find((e) => e.difficulty === 'standard');
  assert.equal(
    select.value,
    gentle.executionKey,
    'Initial context follows the newest resolvable earned picture.',
  );
  assert.match(page.$('achievement-campaign').textContent, /Earned chapter.*Gentle/);
  assert.match(page.$('appearance-campaign').textContent, /Earned chapter/);
  assert.match(
    page.$('appearance-rewards').querySelector('.reward-progress').textContent,
    /1 \/ 1/,
  );
  const current = select.options.find((option) => /First Signal/.test(option.textContent));
  assert.ok(current);
  page.change('collection-context', current.value);
  assert.match(page.$('achievement-campaign').textContent, /First Signal.*Standard/);
  assert.equal(page.$('achievements').querySelectorAll('.earned').length, 0);
  assert.equal(
    page.$('gallery-grid').querySelectorAll('button').length,
    1,
    'Context inspection does not filter or replace earned pictures.',
  );
  page.change('collection-context', standard.executionKey);
  assert.match(page.$('achievement-campaign').textContent, /Earned chapter.*Standard/);
  assert.match(page.$('collection-choose-appearance').textContent, /current flight/i);
  for (let i = 0; i < 10; i++) page.frame();
  assert.equal(page.rendered.run, run);
  assert.equal(page.rendered.paused, true);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  assert.deepEqual([...page.storage.map], raw);
  assert.equal(page.storage.writes.length, writes);
  assert.equal(page.assets.allPuts.length, assetWrites);
  page.$('collection-dialog').close();
  open(page);
  assert.equal(select.value, standard.executionKey, 'Explicit view context survives reopen.');
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  assert.equal(page.storage.getItem(profileKey), new Map(raw).get(profileKey));
  assert.deepEqual(page.errors, []);
});

test('missing historical context stays archived and cannot become the current chapter by title or theme', async (t) => {
  const page = await setup(t, ['standard'], { installed: false });
  const raw = [...page.storage.map];
  open(page);
  const select = page.$('collection-context');
  assert.equal(select.options.length, 1);
  assert.match(select.options[0].textContent, /First Signal.*Standard/);
  assert.equal(page.$('achievements').querySelectorAll('.earned').length, 0);
  const card = page.$('gallery-grid').querySelectorAll('button')[0];
  assert.equal(card.disabled, true);
  assert.match(card.children[2].textContent, /Archived picture/);
  const current = select.value;
  page.change('collection-context', entries[0].executionKey);
  assert.equal(
    select.value,
    current,
    'An unknown supplied value cannot select a historical replacement.',
  );
  assert.deepEqual([...page.storage.map], raw);
  assert.deepEqual(page.errors, []);
});

test('existing controller select draft, cancel and confirm preserve context and picture Back focus', async (t) => {
  const page = await setup(t),
    pulse = padFor(page, t);
  open(page);
  const select = page.$('collection-context');
  assert.ok(select);
  const initial = select.value,
    title = page.$('achievement-campaign').textContent;
  const before = [...page.storage.map],
    checkpoint = authoritativeCheckpoint(page.rendered.run);
  select.focus();
  page.frame(0);
  pulse(0);
  pulse(12);
  pulse(1);
  assert.equal(page.$('collection-dialog').open, true, 'Back cancels only the select draft.');
  assert.equal(select.value, initial);
  assert.equal(page.$('achievement-campaign').textContent, title);
  assert.equal(page.doc.activeElement?.id, select.id);
  pulse(0);
  pulse(12);
  pulse(0);
  assert.notEqual(select.value, initial);
  assert.notEqual(page.$('achievement-campaign').textContent, title);
  const selected = select.value,
    card = page.$('gallery-grid').querySelectorAll('button')[0];
  card.focus();
  card.click();
  await settle(
    () => page.$('gallery-view-dialog').open && !page.$('gallery-replay').disabled,
    `Picture should open: ${page.$('gallery-view-meta').textContent}`,
  );
  page.$('gallery-view-dialog').close();
  await settle(
    () =>
      page.$('collection-dialog').open &&
      page.doc.activeElement?.classList.contains('gallery-card'),
  );
  assert.equal(select.value, selected);
  pulse(1);
  assert.equal(page.$('collection-dialog').open, false);
  assert.equal(page.$('collection-dialog').contains(page.doc.activeElement), false);
  assert.equal(page.rendered.paused, true);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.deepEqual([...page.storage.map], before);
  assert.deepEqual(page.errors, []);
});
