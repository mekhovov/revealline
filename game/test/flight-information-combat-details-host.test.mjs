import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { combatLevel, patrol, combat } from './helpers/combat-fixture.mjs';
import { createCombatCandidates } from '../content-design/combat-candidates.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { prepareScenario } from '../imports.mjs';
import { readFlightInformation } from '../ui/flight-information-host.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';
import { FIXED_DT } from '../core/index.mjs';

const readJSON = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const classes = await readJSON('../content/classes.json');
const theme = (await readJSON('../content-design/themes.json')).themes.find(
  (candidate) => candidate.id === 'horizon',
);
const previewKey = 'revealline.playground.current';
const savedKey = 'revealline.suspended.dev.v1';
const information = (page) => readFlightInformation(page.$('run-message'));
const campaign = (level) => ({
  version: 'xonix-campaign.v1',
  id: 'optional-patrol-details-host',
  revision: '1',
  title: 'Optional patrol Details host',
  themeId: theme.id,
  levels: [level],
});

async function ordinaryPage(t, level) {
  // The base campaign is legacy. Load this newer simulation through a real
  // compatible catalog pack, including its explicit empty mastery roster.
  const source = campaign(level);
  const pack = {
    format: 'xonix-pack.v6',
    id: 'optional-patrol-details',
    version: '1.0.0',
    name: 'Optional patrol Details',
    description: 'Compatible host fixture for paused optional patrol information.',
    engine: 'xonix-core.v6',
    dependencies: [],
    themes: [theme],
    classRecipes: classes,
    campaigns: [source],
    visualOverrides: {},
    levelVisuals: [],
    music: [],
    masteries: [],
  };
  const catalog = {
    format: 'xonix-pack-catalog.v1',
    packs: [
      {
        id: pack.id,
        path: `${pack.id}.json`,
        name: pack.name,
        campaigns: [
          {
            id: source.id,
            revision: source.revision,
            title: source.title,
            levels: [{ id: level.id, name: level.name }],
          },
        ],
      },
    ],
  };
  const page = await soloPage(t, {
    fetchJSON: (path) =>
      path === 'content/packs/catalog.json'
        ? catalog
        : path === `content/packs/${pack.id}.json`
          ? pack
          : undefined,
  });
  page.$('pack-select').value = pack.id;
  await page.$('pack-select').onchange();
  await settle(
    () =>
      page.$('level-select').value === level.id && page.doc.body.dataset.pictureState === 'ready',
    'The compatible optional-patrol pack must finish loading.',
  );
  page.frame(0);
  assert.equal(page.$('pack-select').value, pack.id);
  assert.equal(page.rendered.run.ruleset, 'xonix-core.v6');
  return page;
}

function frames(page, count) {
  for (let i = 0; i < count; i++) page.frame(FIXED_DT * 1000);
}
function tap(page, code) {
  page.key(code);
  page.key(code, false);
}
async function start(page) {
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
}
function advanceUntil(page, predicate, description) {
  for (let i = 0; i < 600 && !predicate(); i++) {
    assert.equal(page.rendered.run.status, 'running', description);
    page.frame(FIXED_DT * 1000);
  }
  assert.ok(predicate(), description);
}
function keyboard(page, code) {
  const target = page.doc.activeElement;
  const event = target.emit('keydown', { code, key: code, repeat: false });
  // Native activation/close are browser defaults; app navigation stays real.
  if (!event.defaultPrevented && code === 'Enter' && ['BUTTON', 'SUMMARY'].includes(target.tagName))
    target.click();
  if (!event.defaultPrevented && code === 'Escape') {
    const dialog = target.closest('dialog[open]');
    if (dialog && dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) dialog.close();
  }
  target.emit('keyup', { code, key: code });
}
function openDetails(page) {
  assert.equal(page.$('game-overlay').dataset.kind, 'pause');
  if (!page.$('pause-mission-info').open) {
    page.$('pause-mission-info-toggle').focus();
    keyboard(page, 'Enter');
  }
  assert.equal(page.$('pause-mission-info').open, true);
  page.$('overlay-field-details').focus();
  keyboard(page, 'Enter');
  assert.equal(page.$('flight-details-dialog').open, true);
  assert.equal(page.doc.activeElement.id, 'flight-details-read');
  return page.$('flight-details-content').textContent;
}
function downloadsDoNotKeepNodeAlive(t) {
  const schedule = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (callback, delay, ...args) => {
    const timer = schedule(callback, delay, ...args);
    if (delay === 60000) timer.unref();
    return timer;
  });
}
async function exportedReplay(page) {
  await page.$('export-replay').onclick();
  const replay = JSON.parse(page.$('replay-json').value);
  assert.equal(verifyReplay(replay).match, true);
  page.$('replay-dialog').close();
  return replay;
}
async function readWithoutChangingFlight(page, checkText, previewStorage) {
  const replay = await exportedReplay(page);
  const before = authoritativeCheckpoint(page.rendered.run);
  const owner = information(page).owner;
  const beforeOpenBytes = [...page.storage.map];
  const beforeOpenWrites = [...page.storage.writes];
  const previewBytes = previewStorage && [...previewStorage.map];
  const previewWrites = previewStorage && [...previewStorage.writes];
  const replayText = page.$('replay-json').value;
  const text = openDetails(page);
  if (page.storage.getItem(savedKey) !== null) {
    // Existing ordinary pause(true) persists even when already paused. Both
    // the Details opener and an explicit Replay export use that same path.
    // Allow exactly the opener's timestamp refresh; all saved flight data stays
    // identical, and reading/Back must cause no further writes.
    const savedBytes = page.storage.getItem(savedKey);
    const prior = JSON.parse(new Map(beforeOpenBytes).get(savedKey));
    const saved = JSON.parse(savedBytes);
    assert.ok(Number.isFinite(Date.parse(saved.savedAt)));
    assert.deepEqual({ ...saved, savedAt: prior.savedAt }, prior);
    assert.deepEqual(page.storage.writes.slice(beforeOpenWrites.length), [[savedKey, savedBytes]]);
    assert.deepEqual(
      [...page.storage.map],
      beforeOpenBytes.map(([key, value]) => [key, key === savedKey ? savedBytes : value]),
    );
    assert.equal(verifyReplay(saved.replay).match, true);
    assert.deepEqual(saved.replay.checkpoint, before);
  } else {
    assert.deepEqual([...page.storage.map], beforeOpenBytes);
    assert.deepEqual(page.storage.writes, beforeOpenWrites);
  }
  const playerBytes = [...page.storage.map];
  const playerWrites = [...page.storage.writes];
  checkText(text);
  assert.doesNotMatch(text, /optionalPatrolDetails\.|undefined|NaN/);
  const reading = page.$('flight-details-reading');
  reading.clientHeight = 100;
  reading.scrollHeight = 600;
  keyboard(page, 'Enter');
  assert.equal(page.doc.activeElement, reading);
  keyboard(page, 'ArrowDown');
  assert.ok(reading.scrollTop > 0);
  frames(page, 12);
  assert.equal(page.$('flight-details-content').textContent, text);
  keyboard(page, 'Escape');
  assert.equal(page.$('flight-details-dialog').open, true);
  assert.equal(page.doc.activeElement.id, 'flight-details-read');
  keyboard(page, 'Escape');
  await Promise.resolve();
  assert.equal(page.$('flight-details-dialog').open, false);
  assert.equal(page.doc.activeElement.id, 'overlay-field-details');
  assert.equal(page.$('pause-mission-info').open, true);
  frames(page, 12);
  assert.equal(page.doc.activeElement.id, 'overlay-field-details');
  assert.equal(page.$('game-overlay').dataset.kind, 'pause');
  assert.equal(information(page).snapshot.paused, true);
  assert.deepEqual(information(page).owner, owner);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), before);
  assert.deepEqual([...page.storage.map], playerBytes);
  assert.deepEqual(page.storage.writes, playerWrites);
  if (previewStorage) {
    assert.deepEqual([...previewStorage.map], previewBytes);
    assert.deepEqual(previewStorage.writes, previewWrites);
  }
  assert.equal(page.$('replay-json').value, replayText);
  assert.deepEqual(JSON.parse(page.$('replay-json').value), replay);
  if (previewStorage) {
    assert.deepEqual(await exportedReplay(page), replay);
    assert.deepEqual([...page.storage.map], playerBytes);
    assert.deepEqual(page.storage.writes, playerWrites);
    assert.deepEqual([...previewStorage.map], previewBytes);
    assert.deepEqual(previewStorage.writes, previewWrites);
  }
  assert.deepEqual(page.errors, []);
}

test('ordinary compatible flight exposes real sentry warning and live recovery in paused Details only', async (t) => {
  const page = await ordinaryPage(t, combatLevel());
  downloadsDoNotKeepNodeAlive(t);
  await start(page);
  tap(page, 'ArrowRight');
  advanceUntil(page, () => patrol(page.rendered.run).phase === 'warning', 'Real sentry locks aim');
  assert.equal(Object.hasOwn(information(page).snapshot, 'combat'), false);
  page.$('pause-button').click();
  assert.equal(page.$('pause-mission-info').open, false);
  const warning = information(page).snapshot.combat;
  assert.equal(warning.valid, true);
  assert.equal(warning.actors[0].phase, 'warning');
  assert.equal(warning.projectiles.length, 0);
  const seconds = (Math.ceil(warning.actors[0].warningTicks * FIXED_DT * 10) / 10).toFixed(1);
  await readWithoutChangingFlight(page, (text) => {
    assert.match(text, /Optional patrols/);
    assert.match(text, /Scouts: 0 · Sentries: 1\./);
    assert.ok(text.includes(`Aiming sentries: 1 · earliest shot in ${seconds}s.`), text);
    assert.match(text, /Move off the dashed ray or close your cut before firing/);
    assert.doesNotMatch(text, /Live sentry shots: [1-9]/);
  });
  const savedWarning = JSON.parse(page.storage.getItem(savedKey));
  assert.equal(verifyReplay(savedWarning.replay).match, true);
  assert.deepEqual(savedWarning.replay.checkpoint, authoritativeCheckpoint(page.rendered.run));

  await start(page);
  tap(page, 'ArrowDown');
  advanceUntil(
    page,
    () => patrol(page.rendered.run).phase === 'recovery',
    'Locked sentry fires while the craft changes heading',
  );
  assert.equal(combat(page.rendered.run).projectiles.length, 1);
  assert.equal(Object.hasOwn(information(page).snapshot, 'combat'), false);
  page.$('pause-button').click();
  await readWithoutChangingFlight(page, (text) => {
    assert.match(text, /Recovering sentries: 1\. Already fired shots can remain\./);
    assert.match(text, /Live sentry shots: 1\./);
    assert.match(text, /they threaten exposed craft, not its trail/);
    assert.doesNotMatch(text, /Aiming sentries: [1-9]|safe to approach|harmless/i);
  });
  assert.equal(page.rendered.run.lives, 3);
});

test('compiled practice Details keeps optional roles separate without changing scenario, saves or export', async (t) => {
  const project = createCombatCandidates();
  project.missions.find((mission) => mission.id === 'two-bay-service').presentation.themeId =
    theme.id;
  const authored = JSON.stringify(project);
  const preview = prepareContentPreview(project, 'two-bay-service', { theme });
  const scenario = (await prepareScenario(preview.scenario)).scenario;
  const bytes = JSON.stringify(scenario);
  const storage = memoryStorage({ 'retained-player-data': 'unchanged' });
  const previewStorage = memoryStorage({ [previewKey]: bytes });
  const page = await soloPage(t, {
    storage,
    previewStorage,
    search: '?practice=1',
  });
  downloadsDoNotKeepNodeAlive(t);
  assert.equal(page.$('shell-edition').textContent, 'PRACTICE');
  await start(page);
  tap(page, 'ArrowUp');
  frames(page, 12);
  assert.equal(Object.hasOwn(information(page).snapshot, 'combat'), false);
  page.$('pause-button').click();
  assert.equal(page.$('pause-mission-info').open, false);
  const paused = information(page).snapshot;
  assert.equal(paused.combat.valid, true);
  assert.deepEqual(paused.combat.actors.map((actor) => actor.role).sort(), ['scout', 'sentry']);
  assert.equal(paused.classic.enemies.length, 4, 'Ordinary keepers remain their own threat group.');
  await readWithoutChangingFlight(
    page,
    (text) => {
      assert.match(text, /Optional patrols/);
      assert.match(text, /Scouts: 1 · Sentries: 1\./);
      assert.match(text, /Actors and line danger/);
      assert.match(text, /Controls after Resume/);
    },
    previewStorage,
  );
  assert.deepEqual([...storage.map], [['retained-player-data', 'unchanged']]);
  assert.deepEqual(storage.writes, []);
  assert.equal(previewStorage.getItem(previewKey), bytes);
  assert.deepEqual(previewStorage.writes, []);
  assert.equal(JSON.stringify(project), authored);
  assert.equal(JSON.stringify(scenario), bytes);
});

test('an ordinary flight without optional actors keeps its existing paused Details', async (t) => {
  const level = combatLevel();
  delete level.classic.combatPatrols;
  const page = await ordinaryPage(t, level);
  downloadsDoNotKeepNodeAlive(t);
  await start(page);
  tap(page, 'ArrowRight');
  frames(page, 20);
  page.$('pause-button').click();
  assert.equal(page.$('pause-mission-info').open, false);
  assert.equal(Object.hasOwn(information(page).snapshot, 'combat'), false);
  await readWithoutChangingFlight(page, (text) => {
    assert.doesNotMatch(
      text,
      /Optional patrols|Aiming sentries|Live sentry shots|Recovering sentries/,
    );
    assert.match(text, /Actors and line danger/);
    assert.match(text, /unfinished line remains exposed/);
    assert.match(text, /Controls after Resume/);
  });
});
