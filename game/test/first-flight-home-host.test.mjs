// Actual Solo title/course/retention owners; DOM, Phaser and document navigation
// are finite browser boundaries. No course transition or saved checkpoint is mocked.
import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';
import { nativeCaptureSession } from '../capture-presentation-session.mjs';
import { FIRST_FLIGHT_LESSONS } from '../first-flight.mjs';
import { getLocale, setLocale, translateDOM } from '../i18n/index.mjs';

const slot = 'revealline.suspended.dev.v1';
function navigation(page) {
  const destinations = [];
  page.win.location.assign = (url) => destinations.push(url);
  return destinations;
}
async function pausedFlight(t, storage) {
  const page = await soloPage(t, { titleScreen: true, storage });
  page.$('shell-featured').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.key('ArrowDown');
  for (let i = 0; i < 12; i++) page.frame();
  page.key('ArrowDown', false);
  assert.equal(page.rendered.run.player.cutting, true);
  page.$('shell-menu').click();
  page.frame(0);
  assert.equal(page.rendered.paused, true);
  return page;
}

test('fresh Capture Home exposes optional First Flight in EN/UK without replacing normal Start', async (t) => {
  const prior = getLocale();
  t.after(() => setLocale(prior, { persist: false }));
  setLocale('en', { persist: false });
  const page = await soloPage(t, { titleScreen: true, search: '', waitForPictures: false });
  const entry = page.$('first-flight-home-enter');
  // The finite DOM is created after the process-wide browser bootstrap. Bind
  // this real static label through that same HTML translator before switching.
  translateDOM(entry);
  assert.equal(entry.hidden, false);
  assert.ok(entry.closest('dialog') === page.$('shell-home'));
  assert.match(entry.textContent, /First Flight.*Learn by playing/s);
  assert.equal(page.$('shell-featured').hidden, false);
  assert.ok(page.doc.activeElement === page.$('shell-featured'));
  const destinations = navigation(page),
    before = [...page.storage.map];
  entry.focus();
  entry.emit('pointerdown');
  assert.deepEqual(destinations, []);
  setLocale('uk', { persist: false });
  assert.match(entry.textContent, /Перший політ.*Навчатися в грі/s);
  assert.ok(page.doc.activeElement === entry);
  entry.click();
  await settle(() => destinations.length === 1);
  const target = new URL(destinations[0]);
  assert.equal(target.searchParams.get('course'), 'first-flight');
  assert.equal(target.searchParams.get('lesson'), FIRST_FLIGHT_LESSONS[0].id);
  assert.equal(target.searchParams.get('turn-policy'), page.rendered.run.turnPolicy);
  assert.deepEqual(
    [...page.storage.map],
    before,
    'An unstarted title does not overwrite stored play.',
  );
  assert.deepEqual(page.errors, []);
});

test('Home First Flight retains the exact paused Capture attempt before its one course departure', async (t) => {
  const page = await pausedFlight(t),
    destinations = navigation(page),
    checkpoint = authoritativeCheckpoint(page.rendered.run),
    previous = nativeCaptureSession(JSON.parse(page.storage.getItem(slot))),
    entry = page.$('first-flight-home-enter');
  assert.equal(entry.hidden, false);
  entry.focus();
  entry.click();
  assert.equal(entry.disabled, true);
  entry.click();
  await settle(() => destinations.length === 1);
  const retained = nativeCaptureSession(JSON.parse(page.storage.getItem(slot)));
  assert.deepEqual(retained.replay.checkpoint, previous.replay.checkpoint);
  assert.deepEqual(retained.presentationPins, previous.presentationPins);
  assert.deepEqual(retained.continuation, previous.continuation);
  assert.equal(verifyReplay(retained.replay).match, true);
  page.frame(0);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.equal(page.rendered.paused, true);
  assert.deepEqual(page.errors, []);
});

test('Home introduction preserves a saved attempt that has not been resumed', async (t) => {
  let savedProfile;
  await t.test('retain a real paused attempt', async (t) => {
    const page = await pausedFlight(t);
    savedProfile = Object.fromEntries(page.storage.map);
    assert.ok(savedProfile[slot]);
  });
  await t.test('enter from the next title without overwriting that attempt', async (t) => {
    const storage = memoryStorage(savedProfile),
      page = await soloPage(t, { titleScreen: true, storage }),
      destinations = navigation(page);
    assert.equal(page.$('continue-saved').hidden, false);
    assert.equal(page.$('first-flight-home-enter').hidden, false);
    const before = [...storage.map];
    page.$('first-flight-home-enter').click();
    await settle(() => destinations.length === 1);
    assert.deepEqual([...storage.map], before);
    assert.equal(storage.getItem(slot), savedProfile[slot]);
    assert.deepEqual(page.errors, []);
  });
});

test('Home course entry keeps the flight and prior save when retention cannot write', async (t) => {
  const storage = memoryStorage(),
    page = await pausedFlight(t, storage),
    destinations = navigation(page),
    checkpoint = authoritativeCheckpoint(page.rendered.run),
    saved = storage.getItem(slot),
    write = storage.setItem;
  storage.setItem = (key, value) => {
    if (key === slot) throw new DOMException('Modeled full storage', 'QuotaExceededError');
    write(key, value);
  };
  page.$('first-flight-home-enter').click();
  await settle(() => /remains paused/.test(page.$('first-flight-entry-status').textContent));
  assert.deepEqual(destinations, []);
  assert.equal(storage.getItem(slot), saved);
  assert.equal(page.$('help-dialog').open, true);
  assert.equal(page.$('first-flight-home-enter').disabled, false);
  assert.equal(page.$('first-flight-help-enter').disabled, false);
  page.frame(0);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.equal(page.rendered.paused, true);
  assert.deepEqual(page.errors, []);
});

test('existing First Flight can be skipped, replayed and left for normal play without awarding progress', async (t) => {
  const storage = memoryStorage({ sentinel: 'Keep existing profile' });
  const page = await soloPage(t, { storage, search: '?course=first-flight&lesson=close-line' }),
    destinations = navigation(page),
    before = [...storage.map];
  assert.equal(page.$('first-flight-home-enter').hidden, true);
  page.$('first-flight-skip').click();
  assert.equal(page.$('first-flight-select').value, FIRST_FLIGHT_LESSONS[1].id);
  page.change('first-flight-select', FIRST_FLIGHT_LESSONS[0].id);
  await settle(() => page.$('first-flight-select').value === FIRST_FLIGHT_LESSONS[0].id);
  assert.equal(page.$('start-button').hidden, false);
  page.$('first-flight-exit').click();
  assert.equal(destinations.length, 1);
  const target = new URL(destinations[0]);
  assert.equal(target.pathname, '/game/');
  assert.equal(target.searchParams.has('course'), false);
  assert.deepEqual([...storage.map], before);
  assert.deepEqual(page.errors, []);
});

for (const route of ['humanoid-hunt-v1', 'snake-hunt-v1'])
  test(`the Capture introduction is not presented as ${route} onboarding`, async (t) => {
    const page = await soloPage(t, {
      titleScreen: true,
      search: `?journey=${route}${route === 'snake-hunt-v1' ? '&snake-style=capture' : ''}`,
      waitForPictures: false,
    });
    assert.equal(page.$('first-flight-home-enter').hidden, true);
    assert.equal(page.$('first-flight-help-enter').hidden, false);
    assert.deepEqual(page.errors, []);
  });
