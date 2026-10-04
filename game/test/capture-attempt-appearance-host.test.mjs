import { createPursuitCampaignCandidates } from '../content-design/pursuit-campaign-candidates.mjs';
import { createContentExecutionCatalog } from '../content-design/execution.mjs';
import { acceptAttemptAppearance } from '../presentation/attempt-appearance.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { couchPage } from './helpers/couch-host.mjs';
import { page as teamPage } from './helpers/coop-host.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { activateHostAction } from './helpers/host-action.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { THEME_PREFERENCES_KEY, DEFAULT_THEME_PREFERENCES } from '../presentation/theme-system.mjs';
import { JOURNEY_PREFERENCES_KEY } from '../journey/preferences.mjs';
import {
  resolveIndustrialEnvironment,
  prepareIndustrialEnvironmentSource,
} from '../presentation/industrial-environments.mjs';
import { nativeCaptureSession } from '../capture-presentation-session.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { TEAM_HUNT_ATTEMPT_KEY } from '../coop/hunt-attempts.mjs';

const sessionKey = 'revealline.suspended.journey-pursuit-campaigns.v1';
function preferences() {
  return memoryStorage({
    [THEME_PREFERENCES_KEY]: JSON.stringify({
      ...DEFAULT_THEME_PREFERENCES,
      familyId: 'military-field',
    }),
    [JOURNEY_PREFERENCES_KEY]: JSON.stringify({
      format: 'JourneyPreferencesV1',
      difficulty: 'standard',
    }),
  });
}
function databases(t) {
  const stores = new Map();
  t.after(() => {
    for (const db of stores.values()) db.close?.();
  });
  return {
    open(name, ...args) {
      if (!stores.has(name)) stores.set(name, managedIndexedDB());
      return stores.get(name).indexedDB.open(name, ...args);
    },
  };
}
function observeAppearances(t) {
  const seen = [],
    original = BoardPainter.prototype.setAttemptAppearance;
  t.mock.method(BoardPainter.prototype, 'setAttemptAppearance', function (value) {
    seen.push({ painter: this, value });
    return original.call(this, value);
  });
  return seen;
}
function nextAppearance(page, storage, familyId = 'industrial-workshop') {
  const newValue = JSON.stringify({ ...DEFAULT_THEME_PREFERENCES, familyId });
  storage.setItem(THEME_PREFERENCES_KEY, newValue);
  page.win.emit('storage', { key: THEME_PREFERENCES_KEY, newValue, storageArea: storage });
}
const isRunning = (page) =>
  settle(() => {
    page.frame(0);
    return page.doc.body.dataset.flightState === 'running';
  });

test('native Solo accepts exact chapter appearance on Start and keeps it for confirmed Restart and saved Continue', async (t) => {
  const storage = preferences(),
    seen = observeAppearances(t);
  const page = await soloPage(t, {
    storage,
    titleScreen: true,
    search: '?journey=pursuit-campaigns-v1&artReview=industrial-roster-v3',
  });
  page.$('shell-featured').click();
  await isRunning(page);
  const accepted = seen.at(-1).value;
  assert.ok(accepted.environmentPin, 'The authenticated chapter source is admitted.');
  assert.equal(
    resolveIndustrialEnvironment(accepted.environmentPin).collection.id,
    'military-field',
  );
  page.frame();
  page.$('pause-button').click();
  page.frame(0);
  const saved = JSON.parse(storage.getItem(sessionKey));
  assert.deepEqual(saved.appearance, accepted);
  const checkpoint = authoritativeCheckpoint(page.rendered.run);
  assert.deepEqual(nativeCaptureSession(saved).replay.checkpoint, checkpoint);
  nextAppearance(page, storage);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  await activateHostAction(page.$('overlay-restart'));
  await activateHostAction(page.$('restart-confirm'));
  await isRunning(page);
  assert.equal(
    seen.at(-1).value,
    accepted,
    'Confirmed Restart retains the accepted appearance object.',
  );
  page.$('pause-button').click();
  page.frame(0);
  assert.deepEqual(JSON.parse(storage.getItem(sessionKey)).appearance, accepted);
  // Registered artwork from a different official level remains invalid for this save.
  const originalRaw = storage.getItem(sessionKey),
    originalRun = page.rendered.run;
  const originalCheckpoint = authoritativeCheckpoint(originalRun);
  const project = createPursuitCampaignCandidates();
  const entry = createContentExecutionCatalog(project, { mode: 'solo' }).entries.find(
    (value) => value.difficulty === 'standard',
  );
  const other = await prepareIndustrialEnvironmentSource({
    engine: 'capture',
    mode: 'solo',
    source: entry.campaign.levels[1],
    origin: {
      kind: 'builtin',
      catalogueId: project.id,
      catalogueRevision: project.revision,
      sourceForm: `compiled-native-v1:${entry.policyVersion}:standard`,
    },
  });
  assert.ok(other);
  const altered = JSON.parse(originalRaw);
  altered.appearance = acceptAttemptAppearance(other, accepted);
  storage.setItem(sessionKey, JSON.stringify(altered));
  await page.$('continue-saved').onclick();
  page.frame(0);
  assert.equal(page.rendered.run, originalRun);
  assert.deepEqual(authoritativeCheckpoint(originalRun), originalCheckpoint);
  assert.deepEqual(JSON.parse(storage.getItem(sessionKey)), altered);
  assert.match(page.$('run-message').textContent, /native source/);
  storage.setItem(sessionKey, originalRaw);
  // Same-owner restore handler: visible fresh-page Continue is covered below.
  const continuation = page.$('continue-saved');
  assert.equal(continuation.hidden, true);
  await continuation.onclick();
  page.frame(0);
  assert.deepEqual(seen.at(-1).value, accepted);
  assert.notEqual(seen.at(-1).value.environmentPin, accepted.environmentPin);
  assert.ok(resolveIndustrialEnvironment(seen.at(-1).value.environmentPin));
  assert.deepEqual(page.errors, []);
});

test('native paired Versus accepts one source-owned appearance and Retry ignores next-attempt preference', async (t) => {
  const storage = preferences(),
    seen = observeAppearances(t);
  const page = await couchPage(t, {
    storage,
    assetDatabase: databases(t),
    initialLevel: null,
    href: 'http://localhost/game/couch/?journey=pursuit-campaigns-v1&artReview=industrial-roster-v3',
  });
  await activateHostAction(page.$('race-start'));
  page.frame();
  const owners = seen.slice(-2);
  assert.equal(owners.length, 2);
  assert.equal(owners[0].value, owners[1].value);
  const accepted = owners[0].value;
  assert.ok(accepted.environmentPin);
  assert.equal(
    resolveIndustrialEnvironment(accepted.environmentPin).collection.id,
    'military-field',
  );
  page.$('race-pause').click();
  nextAppearance(page, storage);
  assert.equal(page.$('race-retry').hidden, false);
  assert.equal(page.$('race-retry').disabled, false);
  page.$('race-retry').click();
  if (page.$('race-discard-confirm')?.closest('dialog').open)
    await activateHostAction(page.$('race-discard-confirm'));
  await waitFor(() => {
    page.frame();
    return page.renders.every((run) => run.status === 'running');
  });
  assert.ok(seen.slice(-2).every(({ value }) => value === accepted));
});

test('native Team saves exact chapter appearance and Retry retains it after preference changes', async (t) => {
  const storage = preferences();
  const page = await teamPage(t, {
    href: 'http://localhost/game/couch/relay-rescue.html?journey=pursuit-campaigns-v1&artReview=industrial-roster-v3',
    beforeImport: ({ install }) => {
      install('localStorage', { value: storage });
      install('indexedDB', { value: databases(t) });
    },
  });
  await activateHostAction(page.$('coop-start'));
  page.tick(4);
  page.$('coop-pause').click();
  const saved = JSON.parse(storage.getItem(TEAM_HUNT_ATTEMPT_KEY));
  assert.ok(saved?.appearance?.environmentPin, page.$('coop-message').textContent);
  const accepted = saved.appearance;
  nextAppearance(page, storage);
  await activateHostAction(page.$('coop-retry'));
  await activateHostAction(page.$('coop-discard-confirm'));
  page.tick(4);
  page.$('coop-pause').click();
  assert.deepEqual(JSON.parse(storage.getItem(TEAM_HUNT_ATTEMPT_KEY)).appearance, accepted);
});

test('fresh-page visible Continue restores saved appearance after the menu preference changes', async (t) => {
  const storage = preferences();
  let savedAppearance, checkpoint, savedTick;
  await t.test('save the accepted source-owned flight', async (t) => {
    const page = await soloPage(t, {
      storage,
      titleScreen: true,
      search: '?journey=pursuit-campaigns-v1&artReview=industrial-roster-v3',
    });
    page.$('shell-featured').click();
    await isRunning(page);
    page.frame();
    page.$('pause-button').click();
    page.frame(0);
    const saved = JSON.parse(storage.getItem(sessionKey));
    savedAppearance = saved.appearance;
    checkpoint = nativeCaptureSession(saved).replay.checkpoint;
    savedTick = page.rendered.run.tick;
    assert.ok(savedAppearance.environmentPin);
  });
  storage.setItem(
    THEME_PREFERENCES_KEY,
    JSON.stringify({ ...DEFAULT_THEME_PREFERENCES, familyId: 'industrial-workshop' }),
  );
  await t.test('resume through the actual title Continue control', async (t) => {
    const seen = observeAppearances(t);
    const page = await soloPage(t, {
      storage,
      titleScreen: true,
      search: '?journey=pursuit-campaigns-v1',
    });
    assert.equal(page.$('shell-continue').hidden, false);
    await activateHostAction(page.$('shell-continue'));
    await settle(() => {
      page.frame(0);
      return (
        page.rendered.run.tick === savedTick && seen.some(({ value }) => value?.environmentPin)
      );
    }).catch((error) => {
      error.message += JSON.stringify({
        tick: page.rendered.run.tick,
        expected: savedTick,
        appearances: seen.map(({ value }) => value),
        info: page.$('run-message').textContent,
        title: page.$('shell-flight-status')?.textContent,
        errors: page.errors,
      });
      throw error;
    });
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
    assert.deepEqual(seen.at(-1).value, savedAppearance);
    assert.ok(resolveIndustrialEnvironment(seen.at(-1).value.environmentPin));
    assert.deepEqual(page.errors, []);
  });
});
