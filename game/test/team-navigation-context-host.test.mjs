import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { waitFor } from './helpers/coop-presentation-fixture.mjs';
import { memoryStorage } from './helpers/solo-dom.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import { TEAM_HUNT_ATTEMPT_KEY } from '../coop/hunt-attempts.mjs';
import { RUNNING_ENEMY_PREFERENCES_KEY } from '../hunt/running-enemy-preferences.mjs';

// Real Team entry, controls and simulation; finite DOM/image boundaries do not
// qualify native layout, original artwork, browser input or physical devices.
const options = { nativeFocus: true, nativeVisibility: true };
function english(t) {
  const locale = getLocale();
  setLocale('en', { persist: false });
  t.after(() => setLocale(locale, { persist: false }));
}
function enter(f, button) {
  button.focus();
  f.tap('Enter');
}
async function browse(f, paused = false) {
  enter(f, f.$(paused ? 'coop-discovery-paused' : 'coop-discovery-open'));
  await waitFor(() => f.$('journey-chooser')?.open);
}

test('Team Home identifies the selected arena and keeps card focus separate from launch', async (t) => {
  english(t);
  const f = await page(t, options);
  const context = f.$('coop-navigation-context');
  assert.equal(context.parentNode.className, 'landing-commands');
  assert.equal(context.hidden, false);
  assert.equal(context.textContent, 'Capture · Team · Relay Rescue · First Connection');
  await browse(f);
  assert.match(f.$('journey-chooser-status').textContent, /Browsing Team · from Capture · Team/);
  const target = [...f.$('journey-cards').querySelectorAll('.journey-card')].find(
    (card) => card.querySelector('strong').textContent === 'Relay Yard',
  );
  assert.ok(target);
  target.focus();
  f.tick(5);
  assert.equal(f.$('coop-level').value, 'first-connection');
  assert.equal(f.$('coop-menu').hidden, false);
  assert.equal(context.textContent, 'Capture · Team · Relay Rescue · First Connection');
  enter(f, f.$('journey-back'));
  assert.equal(f.doc.activeElement, f.$('coop-discovery-open'));
  await browse(f);
  const launch = [...f.$('journey-cards').querySelectorAll('.journey-card')].find(
    (card) => card.querySelector('strong').textContent === 'Relay Yard',
  );
  enter(f, launch);
  await waitFor(() => !f.$('journey-chooser').open && f.$('coop-menu').hidden);
  assert.equal(f.$('coop-level').value, 'relay-yard');
  assert.equal(context.textContent, 'Capture · Team · Relay Rescue · Relay Yard');
});

test('Team browsing and live translation preserve a paused accepted hunt and its Back owner', async (t) => {
  english(t);
  const storage = memoryStorage({
    [RUNNING_ENEMY_PREFERENCES_KEY]: JSON.stringify({
      format: 'RunningEnemyPreferencesV1',
      enabled: true,
    }),
  });
  const f = await page(t, {
    ...options,
    beforeImport: ({ install }) => install('localStorage', { value: storage }),
  });
  enter(f, f.$('coop-start'));
  assert.equal(f.$('coop-menu').hidden, true, f.$('coop-boot').textContent);
  assert.equal(f.$('coop-overlay').hidden, true, f.$('coop-overlay-title').textContent);
  f.tick(240);
  assert.equal(f.$('coop-overlay').hidden, true, f.$('coop-overlay-title').textContent);
  enter(f, f.$('coop-pause'));
  assert.notEqual(f.$('coop-clock').textContent, '0:00');
  const saved = storage.getItem(TEAM_HUNT_ATTEMPT_KEY);
  assert.ok(saved, 'A real paused hunt has a recoverable checkpoint.');
  const clock = f.$('coop-clock').textContent;
  await browse(f, true);
  f.$('journey-filter-details').open = true;
  f.$('journey-mode').focus();
  f.$('journey-mode').value = 'solo';
  f.$('journey-mode').emit('change');
  assert.match(f.$('journey-chooser-status').textContent, /Browsing Solo · from Capture · Team/);
  // Other-mode metadata uses a separate network owner. Returning to Team must
  // retain the accepted attempt even while that read-only request is pending.
  const reset = f.$('journey-filters-reset');
  assert.equal(f.$('coop-library-preview').hidden, true);
  reset.focus();
  reset.click();
  assert.equal(f.$('journey-mode').value, 'team');
  assert.equal(f.$('coop-library-remote-status').hidden, true);
  assert.equal(f.$('coop-library-remote-feedback').hidden, true);
  assert.equal(f.$('coop-library-preview').hidden, false);
  f.$('journey-filter-details').querySelector('summary').focus();
  f.$('journey-filter-details').open = false;
  const card = [...f.$('journey-cards').querySelectorAll('.journey-card')].find(
    (entry) => !entry.disabled,
  );
  assert.ok(card);
  card.focus();
  setLocale('uk', { persist: false });
  assert.equal(f.doc.activeElement, card);
  assert.match(f.$('coop-navigation-context').textContent, /^Захоплення · Команда · /);
  assert.match(f.$('journey-chooser-status').textContent, /з Захоплення · Команда/);
  f.tick(12);
  enter(f, f.$('journey-back'));
  assert.equal(f.$('journey-chooser').open, false);
  assert.equal(f.doc.activeElement, f.$('coop-discovery-paused'));
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.$('coop-clock').textContent, clock);
  assert.equal(storage.getItem(TEAM_HUNT_ATTEMPT_KEY), saved);
});

for (const [route, label] of [
  ['humanoid-hunt-v1', 'Hunt lessons · six missions'],
  ['snake-hunt-v1', 'Team Snake Hunt'],
]) {
  test(`Team keeps the authored ${route} identity`, async (t) => {
    english(t);
    const f = await page(t, {
      ...options,
      href: `http://localhost/game/couch/relay-rescue.html?journey=${route}`,
      // This fixture does not supply authored Hunt originals. Entry/menu
      // identity is independent of picture admission and cannot claim play.
      waitPicture: false,
    });
    const context = f.$('coop-navigation-context');
    assert.ok(context.textContent.startsWith(`${label} · Team · `), context.textContent);
    assert.doesNotMatch(context.textContent, /^Capture/);
    assert.equal(f.$('coop-start').disabled, true, 'Caption does not bypass picture admission.');
    setLocale('uk', { persist: false });
    assert.ok(context.textContent.includes(' · Команда · '));
    assert.doesNotMatch(context.textContent, /^Захоплення/);
  });
}

test('an imported Team pack keeps its own identity instead of borrowing the authored edition', async (t) => {
  english(t);
  const f = await page(t, {
    ...options,
    href: 'http://localhost/game/couch/relay-rescue.html?journey=team-greybox',
  });
  const imported = structuredClone(COOP_STARTER_PACK);
  imported.id = 'navigation-context-import';
  imported.name = 'Local arena collection';
  await f.selectFile(JSON.stringify(imported));
  assert.equal(
    f.$('coop-navigation-context').textContent,
    'Local arena collection · Team · First Connection',
  );
  await browse(f);
  assert.match(
    f.$('journey-chooser-status').textContent,
    /Browsing Team · from Local arena collection · Team/,
  );
});

test('default Team Home uses concise Capture identity in English and Ukrainian', async (t) => {
  english(t);
  const f = await page(t, {
    ...options,
    href: 'http://localhost/game/couch/relay-rescue.html',
    waitPicture: false,
  });
  const context = f.$('coop-navigation-context');
  assert.equal(context.textContent, 'Capture · Team · Foundation specialists · Twin landings');
  // This fixture supplies no original picture. It qualifies the actual public
  // title's identity and translation, not artwork readiness or launch.
  setLocale('uk', { persist: false });
  assert.match(context.textContent, /^Захоплення · Команда · /);
  assert.doesNotMatch(
    context.textContent,
    /enemy speed|shared reserves|швидкість ворогів|спільний резерв/,
  );
  assert.equal(f.$('coop-menu').hidden, false, 'Changing labels never launches the flight.');
});

for (const [route, en, uk] of [
  [
    'team-cultural-specialist-originals-2',
    'Ukrainian spatial specialists II',
    'Українські просторові спеціалісти II',
  ],
  ['team-pressure-originals-1', 'Shared pressure', 'Спільний тиск'],
  ['team-timed-originals', 'Shared windows', 'Спільні вікна'],
]) {
  test(`explicit ${route} keeps its short owned navigation identity`, async (t) => {
    english(t);
    const f = await page(t, {
      ...options,
      href: `http://localhost/game/couch/relay-rescue.html?journey=${route}`,
      waitPicture: false,
    });
    const context = f.$('coop-navigation-context');
    assert.ok(context.textContent.startsWith(`${en} · Team · `), context.textContent);
    assert.doesNotMatch(context.textContent, /enemy speed|shared reserves/);
    setLocale('uk', { persist: false });
    assert.ok(context.textContent.startsWith(`${uk} · Команда · `), context.textContent);
    assert.doesNotMatch(context.textContent, /швидкість ворогів|спільний резерв/);
  });
}

for (const [route, label] of [
  ['pursuit-pilots-v1', 'Pursuit partners · prototypes'],
  ['pursuit-campaigns-v1', 'Pursuit partners · six prototype chapters'],
]) {
  test(`explicit ${route} retains the source-owned Pursuit identity`, async (t) => {
    english(t);
    const f = await page(t, {
      ...options,
      href: `http://localhost/game/couch/relay-rescue.html?journey=${route}`,
      waitPicture: false,
    });
    assert.ok(f.$('coop-navigation-context').textContent.startsWith(`${label} · Team · `));
    assert.doesNotMatch(f.$('coop-navigation-context').textContent, /^Capture/);
    // Let this route's async picture attempt settle before removing its DOM.
    await waitFor(() => ['ready', 'error'].includes(f.$('coop-picture-status').dataset.state));
  });
}
