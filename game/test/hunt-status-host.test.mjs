import test from 'node:test';
import assert from 'node:assert/strict';
import { combatLevel } from './helpers/combat-fixture.mjs';
import { prepareHuntLevel } from '../hunt/level.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { HUNT_RECORDS_KEY } from '../hunt/records.mjs';

// Real application adapters and input/core calls with finite DOM/media boundaries.
// This does not qualify browser layout, artwork, audio or physical controllers.
function campaign() {
  const source = combatLevel('scout');
  source.classic.combatPatrols.actors[0].turnTicks = 60;
  const level = prepareHuntLevel(source, {
    id: 'hunt-status-native-fixture',
    revision: '1',
    actors: structuredClone(source.classic.combatPatrols.actors),
    hunt: {
      version: 'humanoid-hunt.v1',
      mode: 'hunt',
      quota: 1,
      targets: [{ id: 'patrol', kind: 'runner' }],
    },
  });
  return {
    version: 'xonix-campaign.v1',
    id: 'hunt-status-test',
    revision: '1',
    title: 'Hunt status native fixture',
    levels: [level],
  };
}
function english(t) {
  const locale = getLocale();
  setLocale('en', { persist: false });
  t.after(() => setLocale(locale, { persist: false }));
}
const huntWrites = (storage) => storage.writes.filter(([key]) => key === HUNT_RECORDS_KEY).length;
function sameLocaleState({ doc, node, button, unchanged }) {
  const original = node.textContent;
  button.focus();
  setLocale('uk', { persist: false });
  assert.equal(doc.activeElement, button);
  assert.match(node.title, /Ця спроба:/);
  assert.match(node.title, /Особистий прогрес для цього точного набору умов:/);
  unchanged();
  setLocale('en', { persist: false });
  assert.equal(doc.activeElement, button);
  assert.equal(node.textContent, original);
  unchanged();
}

test('Solo actual Hunt live/result adapters retain the paused accepted attempt on translation', async (t) => {
  english(t);
  const { soloPage, memoryStorage } = await import('./helpers/solo-dom.mjs');
  const { RUNNING_ENEMY_PREFERENCES_KEY } = await import('../hunt/running-enemy-preferences.mjs');
  const storage = memoryStorage({
    [RUNNING_ENEMY_PREFERENCES_KEY]: JSON.stringify({
      format: 'RunningEnemyPreferencesV1',
      enabled: true,
    }),
  });
  const p = await soloPage(t, { storage });
  p.$('start-button').click();
  p.key('ArrowDown');
  for (let i = 0; i < 12; i++) p.frame();
  p.key('ArrowDown', false);
  p.$('shell-menu').click();
  p.frame(0);
  const run = p.rendered.run;
  assert.equal(run.status, 'running');
  assert.equal(p.rendered.paused, true);
  assert.ok(run.runningEnemies?.hunt || run.classic?.hunt);
  const nodes = [
    p.$('hunt-feedback').querySelector('.hunt-status'),
    p.$('journey-reactions').parentElement.querySelector('.hunt-status'),
  ];
  const checkpoint = authoritativeCheckpoint(run),
    saved = storage.getItem(HUNT_RECORDS_KEY),
    writes = huntWrites(storage);
  for (const node of nodes) {
    assert.ok(node && !node.hidden);
    assert.match(node.title, /^This attempt:/);
    sameLocaleState({
      doc: p.doc,
      node,
      button: p.$('shell-play'),
      unchanged: () => {
        assert.equal(p.rendered.run, run);
        assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
        assert.equal(storage.getItem(HUNT_RECORDS_KEY), saved);
        assert.equal(huntWrites(storage), writes);
      },
    });
  }
  assert.deepEqual(p.errors, []);
});

test('Versus both actual seat adapters retain exact accepted runs and records across live translation', async (t) => {
  english(t);
  const { couchPage } = await import('./helpers/couch-host.mjs');
  const { memoryStorage } = await import('./helpers/solo-dom.mjs');
  const storage = memoryStorage();
  const p = await couchPage(t, { campaign: campaign(), storage });
  p.$('race-start').click();
  p.frame();
  const nodes = [0, 1].flatMap((seat) => [
    p.$(`racer-stats-${seat}`).parentElement.querySelector('.hunt-status'),
    p.$(`race-result-${seat}`).parentElement.querySelector('.hunt-status'),
  ]);
  assert.ok(nodes.every((node) => node && !node.hidden));
  const runs = [...p.renders],
    checkpoint = p.checkpoint(),
    saved = storage.getItem(HUNT_RECORDS_KEY),
    writes = huntWrites(storage);
  for (const node of nodes) {
    assert.match(node.title, /^This attempt:/);
    sameLocaleState({
      doc: p.doc,
      node,
      button: p.$('race-pause'),
      unchanged: () => {
        assert.deepEqual(p.renders, runs);
        assert.deepEqual(p.checkpoint(), checkpoint);
        assert.equal(storage.getItem(HUNT_RECORDS_KEY), saved);
        assert.equal(huntWrites(storage), writes);
      },
    });
  }
});

test('Team actual Hunt live/result adapters retain a paused accepted attempt and record storage on translation', async (t) => {
  english(t);
  const { page } = await import('./helpers/coop-host.mjs');
  const { memoryStorage } = await import('./helpers/solo-dom.mjs');
  const { RUNNING_ENEMY_PREFERENCES_KEY } = await import('../hunt/running-enemy-preferences.mjs');
  const storage = memoryStorage({
    [RUNNING_ENEMY_PREFERENCES_KEY]: JSON.stringify({
      format: 'RunningEnemyPreferencesV1',
      enabled: true,
    }),
  });
  const p = await page(t, {
    nativeFocus: true,
    beforeImport: ({ install }) => install('localStorage', { value: storage }),
  });
  p.$('coop-start').click();
  p.tick(24);
  p.$('coop-pause').click();
  const nodes = ['coop-hunt-status', 'coop-hunt-result'].map((id) =>
    p.$(id).querySelector('.hunt-status'),
  );
  const clock = p.$('coop-clock').textContent,
    saved = storage.getItem(HUNT_RECORDS_KEY),
    writes = huntWrites(storage);
  for (const node of nodes) {
    assert.ok(node && !node.hidden);
    assert.match(node.title, /^This attempt:/);
    sameLocaleState({
      doc: p.doc,
      node,
      button: p.$('coop-resume'),
      unchanged: () => {
        assert.equal(p.$('coop-clock').textContent, clock);
        assert.equal(storage.getItem(HUNT_RECORDS_KEY), saved);
        assert.equal(huntWrites(storage), writes);
        assert.equal(p.$('coop-overlay').hidden, false);
      },
    });
  }
});
