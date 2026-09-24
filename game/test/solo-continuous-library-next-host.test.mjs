import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { preparePack, emptyPackLibrary, installPack, exportPackLibrary } from '../packs.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';
import { loadLibrary } from '../library.mjs';
import { campaignKey } from '../library.mjs';
import { loadAuthoredJourneyRoute } from '../content-design/route-loader.mjs';
import { createCandidateSoloHost } from '../content-design/solo-host.mjs';
import { libraryMissionId } from '../mission-library/library.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { activateMissionCard } from './helpers/library-selection.mjs';

function observeAction(button, activate = () => button.click()) {
  const handler = button.onclick;
  let operation,
    calls = 0;
  button.onclick = function (...args) {
    calls++;
    operation = handler.apply(this, args);
    return operation;
  };
  try {
    activate();
  } finally {
    button.onclick = handler;
  }
  assert.equal(calls, 1, 'The visible action invokes its actual handler once.');
  assert.equal(
    typeof operation?.then,
    'function',
    'The actual action exposes its owned operation.',
  );
  return operation;
}

function beginBoundaryNext(p) {
  const result = p.rendered.run,
    checkpoint = authoritativeCheckpoint(result),
    picture = p.rendered.backdrop;
  const operation = observeAction(p.$('next-button'));
  assert.equal(
    p.$('flight-preparation-status').querySelector('[role="status"]').getAttribute('aria-live'),
    'polite',
  );
  assert.match(
    p.$('flight-preparation-status').textContent,
    /Finding the next mission.*Your result is kept/,
  );
  assert.equal(p.$('next-button').disabled, true);
  assert.equal(p.$('flight-preparation-cancel').hidden, false);
  assert.equal(p.doc.activeElement, p.$('flight-preparation-cancel'));
  p.frame(0);
  assert.equal(p.rendered.run, result);
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), checkpoint);
  assert.equal(p.rendered.backdrop, picture);
  return operation;
}

async function setup(t, { holdIndex = null } = {}) {
  const recipe = JSON.parse(
    await readFile(new URL('../content/packs/night-shift.json', import.meta.url), 'utf8'),
  );
  const packs = [];
  for (const [packIndex, campaignCount] of [2, 1].entries()) {
    const source = structuredClone(recipe);
    source.id = `continuous-${packIndex}`;
    source.campaigns = Array.from({ length: campaignCount }, (_, campaignIndex) => ({
      ...structuredClone(recipe.campaigns[0]),
      id: `campaign-${packIndex}-${campaignIndex}`,
      levels: [
        {
          ...retryFixture('self-contact').level,
          id: `level-${packIndex}-${campaignIndex}`,
          name: 'Same name',
          goal: { coverage: 0.1 },
          rules: { lives: 3 },
        },
      ],
    }));
    source.levelVisuals = [];
    source.visualOverrides = {};
    packs.push((await preparePack(source)).pack);
  }
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
      exportPackLibrary(
        packs.reduce((library, pack) => installPack(library, pack), emptyPackLibrary()),
      ),
      'revealline.packs.dev.v1',
    );
    tx.oncomplete = resolve;
    tx.onabort = tx.onerror = () => reject(tx.error);
  });
  db.close();
  const p = await soloPage(t, {
    titleScreen: true,
    assetIndexedDB: assets.indexedDB,
    fetchResponse: holdIndex,
  });
  const initial = p.rendered.run,
    picture = p.rendered.backdrop;
  const opening = observeAction(p.$('shell-play'));
  assert.equal(p.$('mission-library-opening-status').getAttribute('role'), 'status');
  assert.equal(p.$('mission-library-opening-status').textContent, 'Preparing missions…');
  assert.equal(p.rendered.run, initial);
  assert.equal(p.rendered.backdrop, picture);
  await opening;
  assert.equal(p.$('journey-chooser').open, true);
  assert.ok(p.$('journey-collection'));
  p.$('journey-collection').value = 'Custom';
  p.$('journey-collection').emit('change');
  const card = [...p.$('journey-cards').children].find(
    (row) => JSON.parse(row.dataset.missionId)[3] === 'level-0-0',
  );
  assert.ok(card);
  await activateMissionCard(card);
  await running(p, 'level-0-0');
  return { p, packs };
}
async function running(p, id) {
  await settle(() => {
    p.frame(0);
    return p.rendered.run.levelId === id && p.doc.body.dataset.flightState === 'running';
  });
}
async function win(p) {
  p.key('ArrowDown');
  p.key('ArrowDown', false);
  for (let tick = 0; tick < 900 && p.rendered.run.status !== 'won'; tick++) p.frame();
  assert.equal(p.rendered.run.status, 'won');
  if (!p.$('skip-celebration').hidden) p.$('skip-celebration').click();
  if (p.$('game-overlay').hidden) p.$('show-result').click();
  await settle(() => !p.$('next-button').disabled);
}
test(
  'Solo Next crosses Custom campaign and pack boundaries without a summary or picker',
  { timeout: 120000 },
  async (t) => {
    const { p, packs } = await setup(t);
    for (const next of ['level-0-1', 'level-1-0']) {
      await win(p);
      const previous = p.rendered.run;
      p.$('next-button').focus();
      await beginBoundaryNext(p);
      await running(p, next);
      assert.notEqual(p.rendered.run, previous);
      assert.equal(p.$('journey-chooser').open, false);
      assert.equal(p.$('game-overlay').hidden, true);
      assert.equal(p.doc.activeElement.id, 'game-canvas');
    }
    await win(p);
    const final = p.rendered.run;
    await beginBoundaryNext(p);
    assert.match(p.$('flight-preparation-status').textContent, /End of the Solo mission library/);
    p.frame(0);
    assert.equal(p.rendered.run, final);
    assert.equal(p.$('journey-chooser').open, false);
    const profile = loadLibrary(p.storage, 'revealline.library.dev.v1', {
      campaigns: packs.flatMap((pack) => pack.campaigns),
    }).library;
    assert.equal(
      Object.values(profile.campaigns).flatMap((campaign) => Object.keys(campaign.clears)).length,
      3,
    );
    assert.deepEqual(p.errors, []);
  },
);

for (const action of ['failure', 'cancel'])
  test(
    `Solo boundary metadata ${action} preserves the earned result and allows retry`,
    { timeout: 120000 },
    async (t) => {
      const base = JSON.parse(
        await readFile(new URL('../content/campaign.json', import.meta.url), 'utf8'),
      );
      base.levels = [
        {
          ...retryFixture('self-contact').level,
          id: 'boundary-clear',
          name: 'Boundary clear',
          goal: { coverage: 0.1 },
          rules: { lives: 3 },
        },
      ];
      base.briefs = [];
      const index = JSON.parse(
        await readFile(new URL('../content/mission-library-index.json', import.meta.url), 'utf8'),
      );
      index.missions = [
        {
          ...index.missions[0],
          campaignKey: campaignKey(base),
          levelId: base.levels[0].id,
          levelRevision: base.levels[0].revision,
          levelIndex: 0,
        },
      ];
      let release,
        entered = false,
        failed = action === 'failure';
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      t.after(release);
      const p = await soloPage(t, {
        campaign: base,
        fetchResponse: async (path) => {
          if (path !== 'content/mission-library-index.json') return;
          entered = true;
          if (action === 'cancel') await gate;
          if (failed) return new Response('Network unavailable', { status: 503 });
          return new Response(JSON.stringify(index));
        },
      });
      p.$('start-button').click();
      await running(p, 'boundary-clear');
      await win(p);
      const result = p.rendered.run,
        picture = p.rendered.backdrop;
      p.$('next-button').focus();
      const preparation = beginBoundaryNext(p);
      await settle(() => entered);
      if (action === 'cancel') {
        p.$('flight-preparation-cancel').click();
        release();
        await preparation;
        assert.match(p.$('flight-preparation-status').textContent, /cancelled.*result is kept/);
      } else {
        await preparation;
        assert.match(
          p.$('flight-preparation-status').textContent,
          /Could not prepare.*result is kept/,
        );
        failed = false;
      }
      p.frame(0);
      assert.equal(p.rendered.run, result);
      assert.equal(p.rendered.backdrop, picture);
      assert.equal(p.$('next-button').disabled, false);
      assert.equal(p.$('game-overlay').dataset.kind, 'won');
      await beginBoundaryNext(p);
      assert.match(p.$('flight-preparation-status').textContent, /End of the Solo mission library/);
      assert.equal(p.$('journey-chooser').open, false);
      assert.deepEqual(p.errors, []);
    },
  );

test('Solo final Journey result retains the picture while Browse permits a deliberate exact Classic handoff', async (t) => {
  const route = await loadAuthoredJourneyRoute('opening');
  const host = createCandidateSoloHost(route.source, {
    themes: JSON.parse(await readFile(new URL('../content-design/themes.json', import.meta.url)))
      .themes,
  });
  const last = host.catalog.missions.at(-1);
  const mission = libraryMissionId({
    owner: 'journey:opening',
    edition: 'opening',
    campaign: JSON.stringify([last.source, last.packId, last.campaignId]),
    mission: last.id,
  });
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
  const p = await soloPage(t, {
    search: `?${new URLSearchParams({ journey: 'opening', 'library-mission': mission })}`,
    titleScreen: true,
    journeyIndexedDB: managedIndexedDB().indexedDB,
    pictures: { Image: Picture },
    fetchResponse: async (path) =>
      String(path).includes('/content-design/assets/')
        ? new Response(await readFile(path))
        : undefined,
  });
  await running(p, 'horizon-remix');
  p.$('pause-button').click();
  // Controlled result boundary: tests navigation and ownership, not an earned
  // clear, a balance route or progression receipt for this final mission.
  p.rendered.run.status = 'won';
  p.$('show-result').click();
  const result = p.rendered.run,
    picture = p.rendered.backdrop;
  assert.equal(p.$('next-button').textContent, 'Browse missions →');
  p.$('next-button').focus();
  p.$('next-button').click();
  await settle(() => p.$('journey-chooser')?.open && p.$('journey-collection'));
  assert.equal(new URL(globalThis.location.href).searchParams.get('journey'), 'opening');
  assert.equal(p.rendered.run, result);
  assert.equal(p.rendered.backdrop, picture);
  p.$('journey-back').click();
  assert.equal(p.doc.activeElement, p.$('next-button'));
  assert.equal(p.$('game-overlay').dataset.kind, 'won');
  p.$('next-button').click();
  await settle(() => p.$('journey-chooser')?.open);
  p.change('journey-collection', 'Classic');
  const firstClassic = [...p.$('journey-cards').children].find((card) => {
    const [owner, , , missionId] = JSON.parse(card.dataset.missionId);
    return owner === '["classic","base",null]' && missionId === 'signal-01';
  });
  assert.ok(firstClassic, 'The compatible Classic mission remains available in the same browser.');
  firstClassic.click();
  await settle(
    () => new URL(globalThis.location.href).searchParams.get('journey') === 'legacy',
    'The exact Legacy host receives this continuation.',
  );
  const selected = JSON.parse(
    new URL(globalThis.location.href).searchParams.get('library-mission'),
  );
  assert.equal(selected[0], '["classic","base",null]');
  assert.equal(selected[3], 'signal-01');
  p.frame(0);
  assert.equal(p.rendered.run, result);
  assert.equal(p.rendered.backdrop, picture);
  assert.equal(p.$('journey-chooser').open, false);
  assert.deepEqual(p.errors, []);
});
