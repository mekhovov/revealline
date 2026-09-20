import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { authoritativeCheckpoint } from '../replay.mjs';
import { normalizedLevel } from '../core/level.mjs';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { waitForChapterSelection } from './helpers/chapter-install-wait.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

const load = async (name) =>
  JSON.parse(await readFile(new URL(`../content/packs/${name}.json`, import.meta.url), 'utf8'));
const original = await load('fpv-arcade');
const featured = await load('fpv-arcade-r5');

function chapterFetch(t, intercept) {
  const actual = globalThis.fetch;
  globalThis.fetch = (url, ...args) => intercept(url, () => actual(url, ...args));
  t.after(() => {
    globalThis.fetch = actual;
  });
}

// Optional downloads belong to an explicit Missions choice. Title Start now
// prepares the named current mission; it does not install a different chapter.
function chooseChapter(page, id) {
  const button = page.doc.querySelector(`[data-pack="${id}"]`);
  assert.ok(button);
  const disclosure = button.closest('details');
  if (disclosure && !disclosure.open) {
    // Native summary expansion is the only modeled disclosure boundary.
    disclosure.open = true;
    disclosure.emit('toggle');
  }
  const select = page.$('pack-select'),
    handler = select.onchange;
  let pending;
  select.onchange = function (...args) {
    pending = handler.apply(this, args);
    return pending;
  };
  try {
    button.focus();
    button.click();
  } finally {
    select.onchange = handler;
  }
  return { button, pending: Promise.resolve(pending) };
}
async function confirmReplacement(page, beforeConfirm = () => {}) {
  await settle(
    () => page.$('mission-replace-dialog').open && !page.$('mission-replace-confirm').disabled,
  );
  beforeConfirm();
  page.$('mission-replace-confirm').click();
}
async function selectedChapter(t, page, id) {
  await waitForChapterSelection(
    t,
    page,
    () =>
      page.$('pack-select').value === id &&
      !page.$('pack-select').disabled &&
      !page.$('mission-replace-dialog').open &&
      page.doc.body.dataset.pictureState === 'ready',
    `${id} chapter install and exact picture must become ready`,
  );
  page.frame(0);
}

function originalImageBoundary(t) {
  const sizes = new Map(
    original.levelVisuals.map(({ visualOverrides }) => {
      const url = visualOverrides.background.dataUrl;
      const bytes = Buffer.from(url.split(',')[1], 'base64');
      assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
      return [url, [bytes.readUInt32BE(16), bytes.readUInt32BE(20)]];
    }),
  );
  const previous = globalThis.Image;
  globalThis.Image = class {
    async decode() {
      assert.ok(this.width > 0 && this.height > 0);
    }
    set src(url) {
      const size = sizes.get(url);
      assert.ok(size, 'Only the exact existing First Light originals may decode');
      [this.width, this.height] = size;
      [this.naturalWidth, this.naturalHeight] = size;
      queueMicrotask(() => this.onload());
    }
  };
  t.after(() => {
    if (previous === undefined) delete globalThis.Image;
    else globalThis.Image = previous;
  });
}

test('uncached optional chapter failure preserves the real cut; explicit retry installs it and later offline selection uses stored content', async (t) => {
  originalImageBoundary(t);
  const page = await soloPage(t);
  let available = false,
    requests = 0;
  chapterFetch(t, async (url, request) => {
    if (url === 'content/packs/fpv-arcade.json') {
      requests++;
      if (!available) throw new TypeError('Failed to fetch');
    }
    return request();
  });
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.key('ArrowDown');
  page.key('ArrowDown', false);
  for (let i = 0; i < 13; i++) page.frame();
  const run = page.rendered.run,
    checkpoint = authoritativeCheckpoint(run),
    selected = page.$('pack-select').value;
  assert.equal(run.player.cutting, true);
  page.$('shell-packs').click();
  page.frame(0);
  assert.equal(page.rendered.paused, true);
  const pausedStorage = new Map(page.storage.map);
  let requestStored, requestWrites;
  chooseChapter(page, original.id);
  await confirmReplacement(page, () => {
    // Checked replacement may refresh only savedAt. The subsequent download
    // must preserve its exact verified bytes and every other storage entry.
    const slot = 'revealline.suspended.dev.v1',
      beforeSave = JSON.parse(pausedStorage.get(slot)),
      checkedRaw = page.storage.getItem(slot),
      checkedSave = JSON.parse(checkedRaw);
    assert.equal(typeof checkedSave.savedAt, 'string');
    assert.ok(Date.parse(checkedSave.savedAt) >= Date.parse(beforeSave.savedAt));
    assert.deepEqual({ ...checkedSave, savedAt: beforeSave.savedAt }, beforeSave);
    requestStored = new Map(pausedStorage).set(slot, checkedRaw);
    assert.deepEqual(page.storage.map, requestStored);
    requestWrites = page.storage.writes.length;
  });
  await settle(() => !page.$('mission-replace-dialog').open && !page.$('pack-select').disabled);
  page.frame(0);
  assert.equal(page.rendered.run, run);
  assert.equal(page.rendered.paused, true);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  assert.equal(page.$('pack-select').value, selected);
  assert.deepEqual(page.storage.map, requestStored);
  assert.equal(page.storage.writes.length, requestWrites);
  assert.match(page.$('content-select-status').textContent, /First Light/);
  assert.match(page.$('content-select-status').textContent, /Connect to the internet/);
  assert.match(page.$('content-select-status').textContent, /choose this chapter again/);
  assert.equal(requests, 1);

  available = true;
  chooseChapter(page, original.id);
  await confirmReplacement(page);
  await selectedChapter(t, page, original.id);
  assert.equal(page.$('pack-select').value, original.id);
  assert.deepEqual(page.rendered.run.level, normalizedLevel(original.campaigns[0].levels[0]));
  assert.equal(page.rendered.run.tick, 0);
  assert.equal(requests, 2);
  page.$('shell-prepare').click();
  assert.equal(page.$('mission-picker-setup').open, true);
  page.change('pack-select', '');
  await settle(() => !page.$('pack-select').disabled);
  available = false;
  page.change('pack-select', original.id);
  await waitForChapterSelection(
    t,
    page,
    () => !page.$('pack-select').disabled,
    'Stored First Light chapter selection must settle without a new download',
  );
  page.frame(0);
  assert.equal(page.$('pack-select').value, original.id);
  assert.deepEqual(page.rendered.run.level, normalizedLevel(original.campaigns[0].levels[0]));
  assert.equal(requests, 2, 'Already-installed chapter selection does not require another fetch');
  assert.deepEqual(page.errors, []);
});

test('explicit chapter download failure stays visible on return to Title and Missions can deliberately retry', async (t) => {
  originalImageBoundary(t);
  const page = await soloPage(t, { titleScreen: true });
  let available = false,
    requests = 0;
  chapterFetch(t, async (url, request) => {
    if (url === 'content/packs/fpv-arcade-r5.json') {
      requests++;
      if (!available) throw new TypeError('Failed to fetch');
    }
    return request();
  });
  const run = page.rendered.run,
    checkpoint = authoritativeCheckpoint(run),
    stored = new Map(page.storage.map);
  page.$('shell-play').click();
  const first = chooseChapter(page, featured.id);
  await first.pending;
  page.frame(0);
  assert.equal(requests, 1);
  assert.equal(page.rendered.run, run);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  assert.deepEqual(page.storage.map, stored);
  page.$('shell-missions-back').click();
  assert.equal(page.$('shell-home').open, true);
  const status = page.$('shell-featured-status');
  assert.ok(page.$('shell-home').contains(status));
  assert.equal(status.hidden, false);
  assert.equal(status.querySelector('.operation-status-label').getAttribute('role'), 'status');
  assert.match(status.textContent, /Pressure Lines/);
  assert.match(status.textContent, /choose this chapter again/);
  available = true;
  page.$('shell-play').click();
  chooseChapter(page, featured.id);
  await selectedChapter(t, page, featured.id);
  assert.equal(requests, 2);
  assert.equal(page.$('shell-home').open, false);
  assert.deepEqual(page.rendered.run.level, normalizedLevel(featured.campaigns[0].levels[0]));
  assert.equal(page.rendered.run.tick, 0, 'Installing a chapter prepares it without starting');
  assert.deepEqual(page.errors, []);
});

test('a late failed chapter request cannot replace the status or run from a newer confirmed restart', async (t) => {
  const page = await soloPage(t);
  let rejectRequest;
  chapterFetch(t, (url, request) =>
    url === 'content/packs/fpv-arcade.json'
      ? new Promise((resolve, reject) => {
          rejectRequest = reject;
        })
      : request(),
  );
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  const originalRun = page.rendered.run;
  page.$('shell-packs').click();
  chooseChapter(page, original.id);
  await confirmReplacement(page);
  await settle(() => typeof rejectRequest === 'function');
  assert.equal(page.$('pack-select').disabled, true);
  page.$('mission-replace-stay').click();
  assert.equal(page.$('pack-select').disabled, false);
  page.$('shell-missions-back').click();
  page.$('overlay-restart').click();
  assert.equal(page.$('restart-dialog').open, true);
  assert.equal(page.rendered.run, originalRun);
  page.$('restart-confirm').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.$('pause-button').click();
  page.frame(0);
  const newerRun = page.rendered.run,
    checkpoint = authoritativeCheckpoint(newerRun),
    message = page.$('content-select-status').textContent,
    titleMessage = page.$('shell-featured-status').textContent,
    titleHidden = page.$('shell-featured-status').hidden,
    stored = new Map(page.storage.map);
  assert.notEqual(newerRun, originalRun);
  rejectRequest(new TypeError('Failed to fetch'));
  await new Promise((resolve) => setImmediate(resolve));
  page.frame(0);
  assert.equal(page.rendered.run, newerRun);
  assert.deepEqual(authoritativeCheckpoint(newerRun), checkpoint);
  assert.deepEqual(page.storage.map, stored);
  assert.equal(page.$('content-select-status').textContent, message);
  assert.equal(page.$('shell-featured-status').textContent, titleMessage);
  assert.equal(page.$('shell-featured-status').hidden, titleHidden);
  assert.doesNotMatch(message, /Chapter download unavailable/);
  assert.deepEqual(page.errors, []);
});

test('a successful delayed chapter choice leaves a newer Settings visit in place', async (t) => {
  originalImageBoundary(t);
  const page = await soloPage(t, { titleScreen: true });
  let release;
  chapterFetch(t, (url, request) =>
    url === 'content/packs/fpv-arcade-r5.json'
      ? new Promise((resolve) => {
          release = () => resolve(request());
        })
      : request(),
  );
  page.$('shell-play').click();
  const { button, pending } = chooseChapter(page, featured.id),
    label = button.querySelector('.mission-picker-card-label'),
    originalLabel = label.textContent;
  await settle(() => typeof release === 'function');
  assert.equal(page.$('pack-select').disabled, true);
  assert.equal(page.$('content-select-status').dataset.state, 'busy');
  assert.equal(button.querySelector('.mission-picker-card-label'), label);
  page.$('shell-missions-back').click();
  page.$('shell-options').click();
  assert.equal(page.$('settings-dialog').open, true);
  const settingsFocus = page.doc.activeElement;
  release();
  await pending;
  await selectedChapter(t, page, featured.id);
  assert.equal(button.querySelector('.mission-picker-card-label'), label);
  assert.equal(label.textContent, originalLabel);
  assert.equal(page.$('settings-dialog').open, true);
  assert.equal(page.doc.activeElement, settingsFocus);
  assert.equal(page.$('shell-missions').open, false);
  assert.equal(page.$('shell-home').open, true);
  assert.notEqual(
    page.$('shell-featured-status').dataset.kind,
    'error',
    page.$('shell-featured-status').textContent,
  );
  assert.deepEqual(page.rendered.run.level, normalizedLevel(featured.campaigns[0].levels[0]));
  assert.equal(page.rendered.run.tick, 0);
  assert.deepEqual(page.errors, []);
});

test('blur announces a deferred Missions download cancellation and its late response cannot adopt or persist the chapter', async (t) => {
  const database = managedIndexedDB();
  const page = await soloPage(t, { titleScreen: true, assetIndexedDB: database.indexedDB });
  let releaseRequest;
  chapterFetch(t, (url, request) =>
    url === 'content/packs/fpv-arcade-r5.json'
      ? new Promise((resolve) => {
          releaseRequest = () => resolve(request());
        })
      : request(),
  );
  const run = page.rendered.run,
    checkpoint = authoritativeCheckpoint(run),
    selected = page.$('pack-select').value,
    stored = new Map(page.storage.map),
    writes = page.storage.writes.length,
    installed = database.contents(),
    puts = database.allPuts.length;
  page.$('shell-play').click();
  const { pending } = chooseChapter(page, featured.id);
  await settle(() => typeof releaseRequest === 'function');
  page.$('shell-missions-back').click();
  let message;
  try {
    assert.equal(typeof releaseRequest, 'function', 'The actual selected chapter fetch is pending');
    assert.equal(page.$('pack-select').disabled, true);
    assert.match(page.$('shell-featured-status').textContent, /Installing/);
    page.win.emit('blur');
    page.frame(0);
    message = page.$('shell-featured-status').textContent;
    assert.match(message, /Pending pack launch cancelled/);
    assert.doesNotMatch(message, /Installing/);
    assert.equal(page.$('shell-featured-status').hidden, false);
    assert.equal(page.$('content-select-status').textContent, message);
    assert.equal(page.$('pack-select').disabled, false);
    assert.equal(
      page.$('shell-featured').disabled,
      false,
      'Cancelled download does not disable Start',
    );
    assert.equal(page.$('shell-home').open, true);
    assert.equal(page.rendered.run, run);
    assert.equal(page.rendered.paused, true);
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    assert.equal(page.$('pack-select').value, selected);
    assert.deepEqual(page.storage.map, stored);
    assert.equal(page.storage.writes.length, writes);
    assert.deepEqual(database.contents(), installed);
    assert.equal(database.allPuts.length, puts);
  } finally {
    releaseRequest?.();
    await pending;
  }
  page.frame(0);
  assert.equal(page.$('shell-featured').disabled, false);
  assert.equal(page.$('shell-home').open, true);
  assert.equal(page.$('shell-featured-status').textContent, message);
  assert.equal(page.$('content-select-status').textContent, message);
  assert.equal(page.rendered.run, run);
  assert.equal(page.rendered.paused, true);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  assert.equal(page.$('pack-select').value, selected);
  assert.deepEqual(page.storage.map, stored);
  assert.equal(page.storage.writes.length, writes);
  assert.deepEqual(database.contents(), installed);
  assert.equal(database.allPuts.length, puts);
  page.win.emit('blur');
  assert.equal(page.$('shell-featured-status').textContent, message, 'Idle blur preserves status');
  assert.deepEqual(page.errors, []);
});
