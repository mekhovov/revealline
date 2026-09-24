import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { createJourneyBackend } from '../journey/profile.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

// Actual app handlers, profile persistence and registered picture bytes; only
// browser decoding/DOM are modeled. No native layout or image-decoding claim.
class Picture {
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

const page = (t, options = {}) =>
  soloPage(t, {
    search: '',
    titleScreen: true,
    journeyIndexedDB: managedIndexedDB().indexedDB,
    pictures: { Image: Picture },
    fetchResponse: async (path) =>
      String(path).includes('/content-design/assets/')
        ? new Response(await readFile(path))
        : undefined,
    ...options,
  });
const running = (p, id) =>
  settle(() => {
    p.frame(0);
    return p.doc.body.dataset.flightState === 'running' && p.rendered.run.levelId === id;
  });
async function openMissions(p) {
  p.$('shell-play').focus();
  p.$('shell-play').click();
  await settle(() => p.$('journey-chooser')?.open && p.$('journey-collection'));
}

test('default v6 two-activation Skip persists without a fabricated clear, then reload Continue restores the exact flight', async (t) => {
  const disk = managedIndexedDB();
  const storage = memoryStorage();
  const backend = createJourneyBackend({ ...disk, profileKey: 'journey-whole-spatial-v6' });
  const previous = createJourneyBackend({ ...disk, profileKey: 'journey-whole-spatial-v5' });
  const old = await previous.read();
  const first = 'candidate/journey-opening/prologue/first-return';
  const next = 'candidate/journey-opening/prologue/choose-your-share';
  const options = { storage, journeyIndexedDB: disk.indexedDB };
  let checkpoint;
  await t.test('Skip starts the next mission and saves its actual unfinished run', async (t) => {
    const p = await page(t, options);
    p.$('shell-featured').click();
    await running(p, 'first-return');
    p.$('journey-skip').click();
    assert.equal(p.rendered.run.levelId, 'first-return');
    assert.equal((await backend.read()).skipped.solo.length, 0);
    p.$('journey-skip').click();
    await running(p, 'choose-your-share');
    assert.equal(p.$('journey-chooser').open, false);
    p.key('ArrowDown');
    for (let i = 0; i < 12; i++) p.frame();
    p.key('ArrowDown', false);
    p.$('shell-menu').click();
    p.frame(0);
    assert.equal(p.rendered.run.status, 'running');
    checkpoint = authoritativeCheckpoint(p.rendered.run);
    assert(storage.getItem('revealline.suspended.journey-whole-spatial.v6'));
    const profile = await backend.read();
    assert.equal(profile.cursors.solo, next);
    assert.deepEqual(profile.skipped.solo, [first]);
    assert.deepEqual(profile.clears.solo, {});
    assert.deepEqual(await previous.read(), old);
    assert.deepEqual(p.errors, []);
  });
  await t.test('a fresh default host Continue restores the same v6 checkpoint', async (t) => {
    const p = await page(t, options);
    assert.equal(p.$('shell-continue').hidden, false);
    p.$('shell-continue').click();
    await running(p, 'choose-your-share');
    assert.deepEqual(authoritativeCheckpoint(p.rendered.run), checkpoint);
    assert.equal(p.$('journey-chooser').open, false);
    const profile = await backend.read();
    assert.deepEqual(profile.skipped.solo, [first]);
    assert.deepEqual(profile.clears.solo, {});
    assert.deepEqual(await previous.read(), old);
    assert.deepEqual(p.errors, []);
  });
});

for (const id of [
  'two-bays',
  'neon-remix',
  'broken-yard',
  'read-the-arrows',
  'twin-receivers',
  'crossing-complete',
])
  test(`v6 selector returns to its opener and hands off exact previous-v5 ${id} without rewriting progress`, async (t) => {
    const disk = managedIndexedDB();
    const backend = createJourneyBackend({ ...disk, profileKey: 'journey-whole-spatial-v6' });
    const previous = createJourneyBackend({ ...disk, profileKey: 'journey-whole-spatial-v5' });
    const before = await backend.read();
    const old = await previous.read();
    const p = await page(t, { journeyIndexedDB: disk.indexedDB });
    await openMissions(p);
    p.$('journey-search').value = 'Previous Journey · v5';
    p.$('journey-search').emit('input');
    assert.equal(p.$('journey-cards').children.length, 6);
    p.$('journey-back').click();
    assert.equal(p.$('journey-chooser').open, false);
    assert.equal(p.$('shell-home').open, true);
    assert.equal(p.doc.activeElement, p.$('shell-play'));
    await openMissions(p);
    assert.equal(p.$('journey-search').value, 'Previous Journey · v5');
    const cards = [...p.$('journey-cards').children];
    assert.equal(cards.length, 6);
    const selected = cards.find((card) => JSON.parse(card.dataset.missionId)[3].endsWith(`/${id}`));
    assert(selected);
    const identity = JSON.parse(selected.dataset.missionId);
    assert.equal(identity[0], 'journey:whole-spatial-v5');
    assert.equal(identity[1], 'whole-spatial-v5');
    selected.click();
    await settle(() => new URL(globalThis.location.href).searchParams.has('library-mission'));
    const target = new URL(globalThis.location.href);
    assert.equal(target.origin + target.pathname, 'http://localhost/game/');
    assert.equal(target.searchParams.get('journey'), 'whole-spatial-v5');
    assert.equal(target.searchParams.get('library-mission'), selected.dataset.missionId);
    assert.deepEqual(await backend.read(), before);
    assert.deepEqual(await previous.read(), old);
    assert.deepEqual(p.errors, []);
    // Navigation is the native boundary in this source-host fixture. This does
    // not claim receiving-host launch/decoding of the six previous backgrounds.
  });
