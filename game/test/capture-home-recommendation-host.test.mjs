import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, settle, memoryStorage } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { openMissionLibrary } from './helpers/library-selection.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { DEFAULT_JOURNEY_ROUTES } from '../content-design/default-entry.mjs';
import { loadAuthoredJourneyRoute } from '../content-design/route-loader.mjs';
import { createJourneyBackend } from '../journey/profile.mjs';

const route = await loadAuthoredJourneyRoute(DEFAULT_JOURNEY_ROUTES.solo);
async function capturePage(t, options) {
  const reads = [];
  const p = await soloPage(t, {
    ...options,
    // The shared fixture's fallback is JSON. Like the existing authored Journey
    // tests, provide real registered image bytes at this finite fetch boundary.
    fetchResponse: async (path) => {
      if (String(path).includes('/content-design/assets/')) {
        reads.push(String(path));
        return new Response(await readFile(path));
      }
    },
  });
  return Object.assign(p, { recommendationAssetReads: reads });
}

test('Capture Home explains its actual first mission without another action, preparation or write', async (t) => {
  const prior = getLocale();
  t.after(() => setLocale(prior, { persist: false }));
  setLocale('en', { persist: false });
  const p = await capturePage(t, { search: '', titleScreen: true });
  const explanation = p.$('capture-home-recommendation');
  assert.ok(explanation, 'The actual Home has one explanation, not another launch action');
  assert.equal(explanation.hidden, false);
  assert.equal(explanation.closest('dialog'), p.$('shell-home'));
  assert.equal(explanation.querySelector('button,a'), null);
  assert.ok(explanation.textContent.includes(p.rendered.run.level.name));
  assert.match(explanation.textContent, /first mission in this Journey/);
  assert.equal(p.$('shell-featured').hidden, false);
  assert.equal(p.$('shell-continue').hidden, true);
  assert.equal(p.$('shell-play').hidden, false);
  assert.equal(p.$('first-flight-home-enter').hidden, false);
  assert.equal(p.doc.activeElement, p.$('shell-featured'));
  assert.ok(p.$('shell-featured').getAttribute('aria-describedby').includes(explanation.id));
  const checkpoint = authoritativeCheckpoint(p.rendered.run),
    stored = [...p.storage.map],
    reads = [...p.recommendationAssetReads],
    focus = p.doc.activeElement;
  setLocale('uk', { persist: false });
  assert.match(explanation.textContent, /перша місія цієї Подорожі/);
  assert.equal(p.doc.activeElement, focus);
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), checkpoint);
  assert.deepEqual([...p.storage.map], stored);
  assert.deepEqual(p.recommendationAssetReads, reads);
  assert.deepEqual(p.errors, []);
});

async function start(p) {
  p.$('shell-featured').click();
  await settle(() => {
    p.frame(0);
    return p.doc.body.dataset.flightState === 'running';
  });
}

test('in-memory and saved Resume keep priority and remove next-mission descriptions', async (t) => {
  const storage = memoryStorage();
  let checkpoint;
  await t.test('real paused flight', async (t) => {
    const p = await capturePage(t, { search: '', titleScreen: true, storage });
    await start(p);
    p.key('ArrowDown');
    for (let i = 0; i < 12; i++) p.frame();
    p.key('ArrowDown', false);
    p.$('shell-menu').click();
    p.frame(0);
    checkpoint = authoritativeCheckpoint(p.rendered.run);
    assert.equal(p.$('capture-home-recommendation').hidden, true);
    assert.equal(p.$('capture-home-recommendation').textContent, '');
    assert.equal(p.$('shell-continue').hidden, false);
    assert.equal(p.$('shell-featured').hidden, true);
    assert.equal(p.doc.activeElement, p.$('shell-continue'));
    assert.doesNotMatch(
      p.$('shell-continue').getAttribute('aria-describedby') || '',
      /capture-home/,
    );
    const saved = [...storage.map];
    setLocale('uk', { persist: false });
    setLocale('en', { persist: false });
    assert.deepEqual(authoritativeCheckpoint(p.rendered.run), checkpoint);
    assert.deepEqual([...storage.map], saved);
    assert.deepEqual(p.errors, []);
  });
  await t.test('native saved-flight preview and one guarded Continue', async (t) => {
    const p = await capturePage(t, { search: '', titleScreen: true, storage });
    assert.equal(p.$('continue-saved').hidden, false);
    assert.equal(p.$('capture-home-recommendation').hidden, true);
    assert.equal(p.doc.activeElement, p.$('shell-continue'));
    p.$('shell-continue').click();
    await settle(() => {
      p.frame(0);
      return p.doc.body.dataset.flightState === 'running';
    });
    assert.deepEqual(authoritativeCheckpoint(p.rendered.run), checkpoint);
    assert.equal(p.$('shell-home').open, false);
    assert.deepEqual(p.errors, []);
  });
});

test('real Journey win explains the owned successor and Browse all returns without replacing that result', async (t) => {
  const database = managedIndexedDB();
  const p = await capturePage(t, {
    search: '',
    titleScreen: true,
    journeyIndexedDB: database.indexedDB,
  });
  await start(p);
  const firstName = p.rendered.run.level.name;
  p.key('ArrowDown');
  for (let i = 0; i < 1800 && p.rendered.run.status === 'running'; i++) p.frame();
  p.key('ArrowDown', false);
  p.frame(0);
  assert.equal(p.rendered.run.status, 'won');
  if (!p.$('skip-celebration').hidden) p.$('skip-celebration').click();
  if (!p.$('show-result').hidden) p.$('show-result').click();
  p.$('shell-menu').click();
  p.frame(0);
  const explanation = p.$('capture-home-recommendation');
  assert.equal(explanation.hidden, false);
  assert.match(explanation.textContent, /follows your recorded completion/);
  assert.ok(explanation.textContent.includes(firstName));
  assert.match(p.$('shell-destination').textContent, /Choose your share/);
  assert.ok(explanation.textContent.includes('Choose your share'));
  assert.equal(p.$('shell-continue').hidden, false);
  assert.equal(p.$('shell-featured').hidden, true);
  const completed = p.rendered.run,
    checkpoint = authoritativeCheckpoint(completed);
  await openMissionLibrary(p, 'shell-play');
  p.$('journey-back').click();
  assert.equal(p.$('shell-home').open, true);
  assert.equal(p.doc.activeElement, p.$('shell-play'));
  assert.equal(p.rendered.run, completed);
  assert.deepEqual(authoritativeCheckpoint(completed), checkpoint);
  assert.match(explanation.textContent, /follows your recorded completion/);
  p.$('shell-continue').click();
  await settle(() => {
    p.frame(0);
    return (
      p.doc.body.dataset.flightState === 'running' && p.rendered.run.levelId === 'choose-your-share'
    );
  });
  assert.notEqual(p.rendered.run, completed);
  assert.deepEqual(p.errors, []);
});

test('real terminal loss explains retrying this same mission without adding coaching or changing the attempt', async (t) => {
  const p = await capturePage(t, { search: '', titleScreen: true });
  await start(p);
  const initialLives = p.rendered.run.lives;
  for (let life = 0; life < initialLives && p.rendered.run.status !== 'lost'; life++) {
    const lives = p.rendered.run.lives;
    // Cross the vertical leg of a small loop with ordinary public controls.
    // A one-tick reverse is not a guaranteed turn at the saved steering policy.
    for (const [direction, frames] of [
      ['ArrowDown', 60],
      ['ArrowRight', 60],
      ['ArrowUp', 30],
      ['ArrowLeft', 90],
    ]) {
      if (p.rendered.run.status !== 'running') break;
      p.key(direction);
      for (let i = 0; i < frames && p.rendered.run.status === 'running'; i++) p.frame();
      p.key(direction, false);
    }
    assert.equal(p.rendered.run.lives, lives - 1, 'The real loop must lose exactly one life');
    for (let i = 0; i < 240 && p.rendered.run.status === 'respawning'; i++) p.frame();
    // The native recovery grace stops a cut at the safe edge. Wait for that
    // observed protection to end before making the next fresh direction press.
    for (
      let i = 0;
      i < 240 &&
      p.rendered.run.status === 'running' &&
      p.rendered.run.time < p.rendered.run.player.graceUntil;
      i++
    )
      p.frame();
  }
  assert.equal(p.rendered.run.status, 'lost');
  p.$('shell-menu').click();
  p.frame(0);
  const checkpoint = authoritativeCheckpoint(p.rendered.run),
    saved = [...p.storage.map];
  assert.equal(p.$('capture-home-recommendation').hidden, false);
  assert.match(p.$('capture-home-recommendation').textContent, /last attempt here ended/);
  assert.ok(p.$('capture-home-recommendation').textContent.includes(p.rendered.run.level.name));
  setLocale('uk', { persist: false });
  assert.match(p.$('capture-home-recommendation').textContent, /остання спроба тут завершилася/);
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), checkpoint);
  assert.deepEqual([...p.storage.map], saved);
  assert.deepEqual(p.errors, []);
  setLocale('en', { persist: false });
});

test('corrupt saved bytes retain recovery priority and never advertise a replacement mission', async (t) => {
  const storage = memoryStorage({ [route.sessionKey]: '{not-json' });
  const p = await capturePage(t, { search: '', titleScreen: true, storage });
  assert.equal(p.$('capture-home-recommendation').hidden, true);
  assert.equal(storage.getItem(route.sessionKey), '{not-json');
  assert.equal(p.$('shell-play').hidden, false);
  assert.deepEqual(p.errors, []);
});

test('a stale persisted Journey cursor keeps Browse all and never implies a replacement recommendation or progress write', async (t) => {
  const database = managedIndexedDB(),
    backend = createJourneyBackend({ ...database, profileKey: route.profileKey });
  await backend.commit([{ type: 'select', mode: 'solo', missionId: 'retired/exact-mission' }]);
  const before = await backend.read();
  const p = await capturePage(t, {
    search: '',
    titleScreen: true,
    journeyIndexedDB: database.indexedDB,
  });
  assert.equal(p.$('capture-home-recommendation').hidden, true);
  assert.equal(p.$('shell-play').hidden, false);
  assert.deepEqual(await backend.read(), before);
  const puts = [...database.allPuts],
    reads = [...p.recommendationAssetReads];
  setLocale('uk', { persist: false });
  assert.equal(p.$('capture-home-recommendation').hidden, true);
  assert.deepEqual(await backend.read(), before);
  assert.deepEqual(database.allPuts, puts);
  assert.deepEqual(p.recommendationAssetReads, reads);
  assert.deepEqual(p.errors, []);
  setLocale('en', { persist: false });
});

test('unavailable save storage clears the explanation on refresh without writing or moving focus', async (t) => {
  const p = await capturePage(t, { search: '', titleScreen: true });
  const read = p.storage.getItem,
    checkpoint = authoritativeCheckpoint(p.rendered.run),
    stored = [...p.storage.map],
    reads = [...p.recommendationAssetReads],
    focus = p.doc.activeElement;
  assert.equal(p.$('capture-home-recommendation').hidden, false);
  p.storage.getItem = (key) => {
    if (key === route.sessionKey)
      throw new DOMException('Modeled storage unavailable', 'SecurityError');
    return read(key);
  };
  setLocale('uk', { persist: false });
  assert.equal(p.$('capture-home-recommendation').hidden, true);
  assert.equal(p.$('capture-home-recommendation').textContent, '');
  assert.equal(p.doc.activeElement, focus);
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), checkpoint);
  assert.deepEqual([...p.storage.map], stored);
  assert.deepEqual(p.recommendationAssetReads, reads);
  p.storage.getItem = read;
  setLocale('en', { persist: false });
  assert.equal(p.$('capture-home-recommendation').hidden, false);
  assert.deepEqual(p.errors, []);
});

for (const search of [
  '?journey=legacy',
  '?course=first-flight&lesson=close-line',
  '?journey=humanoid-hunt-v1',
])
  test(`the bounded Capture recommendation does not claim authority over ${search}`, async (t) => {
    const p = await soloPage(t, { search, titleScreen: true, waitForPictures: false });
    assert.equal(p.$('capture-home-recommendation').hidden, true);
    assert.equal(p.$('capture-home-recommendation').textContent, '');
    assert.deepEqual(p.errors, []);
  });
