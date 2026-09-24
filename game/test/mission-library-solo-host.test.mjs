import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage } from './helpers/solo-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { classicLibrarySources } from '../mission-library/classic-source.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { preparePack, emptyPackLibrary, installPack, exportPackLibrary } from '../packs.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';
import { loadLibrary } from '../library.mjs';

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
async function journeyPage(t, search = '') {
  return soloPage(t, {
    search,
    titleScreen: true,
    journeyIndexedDB: managedIndexedDB().indexedDB,
    pictures: { Image: Picture },
    fetchResponse: async (path) => {
      if (String(path).includes('/content-design/assets/'))
        return new Response(await readFile(path));
    },
  });
}

const index = JSON.parse(
  await readFile(new URL('../content/mission-library-index.json', import.meta.url), 'utf8'),
);
const model = createMissionLibrary(
  classicLibrarySources(index, {
    availability: () => ({ state: 'ready' }),
    launch: () => true,
  }),
);
const lateBase = model.missions[11];

async function installedAssets(pack) {
  const assets = managedIndexedDB();
  const db = await new Promise((resolve, reject) => {
    const request = assets.indexedDB.open('revealline-assets-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('assets');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction('assets', 'readwrite');
      tx.objectStore('assets').put(
        exportPackLibrary(installPack(emptyPackLibrary(), pack)),
        'revealline.packs.dev.v1',
      );
      tx.oncomplete = resolve;
      tx.onabort = tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
  return assets;
}

test('installed Custom late mission in a second campaign launches its exact authored identity', async (t) => {
  const source = JSON.parse(
    await readFile(new URL('../content/packs/night-shift.json', import.meta.url), 'utf8'),
  );
  source.id = 'library-custom-host';
  const second = structuredClone(source.campaigns[0]);
  second.id = 'custom-second';
  second.levels.forEach((level, index) => {
    level.id = `custom-second-${index}`;
  });
  source.campaigns.push(second);
  const { pack } = await preparePack(source);
  const assets = await installedAssets(pack);
  const p = await soloPage(t, { titleScreen: true, assetIndexedDB: assets.indexedDB });
  await open(p);
  p.$('journey-collection').value = 'Custom';
  p.$('journey-collection').emit('change');
  assert.equal(
    p.$('journey-cards').children.length,
    source.campaigns.reduce((n, c) => n + c.levels.length, 0),
  );
  const card = [...p.$('journey-cards').children].find(
    (button) => JSON.parse(button.dataset.missionId)[3] === second.levels.at(-1).id,
  );
  assert.match(card.textContent, /Custom.*Authored rules.*Play/);
  card.click();
  await running(p, second.levels.at(-1).id);
  assert.equal(p.$('pack-select').value, source.id);
  assert.equal(p.$('journey-chooser').open, false);
  assert.deepEqual(p.errors, []);
});

test('late Custom clear follows authored Next, ends truthfully, and never grants skipped clears', async (t) => {
  const source = JSON.parse(
    await readFile(new URL('../content/packs/night-shift.json', import.meta.url), 'utf8'),
  );
  source.id = 'library-authored-next';
  source.campaigns = [source.campaigns[0]];
  source.campaigns[0].id = 'library-authored-next-campaign';
  source.campaigns[0].levels = [0, 1, 2].map((index) => ({
    ...retryFixture('self-contact').level,
    id: `authored-next-${index}`,
    name: `Authored next ${index}`,
    goal: { coverage: 0.1 },
    rules: { lives: 3 },
  }));
  source.levelVisuals = [];
  source.visualOverrides = {};
  const { pack } = await preparePack(source);
  const assets = await installedAssets(pack);
  const p = await soloPage(t, { titleScreen: true, assetIndexedDB: assets.indexedDB });
  await open(p);
  p.$('journey-collection').value = 'Custom';
  p.$('journey-collection').emit('change');
  const selected = [...p.$('journey-cards').children].find(
    (card) => JSON.parse(card.dataset.missionId)[3] === 'authored-next-1',
  );
  selected.click();
  await running(p, 'authored-next-1');
  async function clear() {
    p.key('ArrowDown');
    p.key('ArrowDown', false);
    for (let tick = 0; tick < 900 && p.rendered.run.status !== 'won'; tick++) p.frame();
    assert.equal(p.rendered.run.status, 'won');
    if (!p.$('skip-celebration').hidden) p.$('skip-celebration').click();
  }
  await clear();
  p.$('next-button').click();
  await running(p, 'authored-next-2');
  await clear();
  const last = p.rendered.run;
  p.$('next-button').click();
  await settle(() =>
    /End of the Solo mission library/.test(p.$('flight-preparation-status').textContent),
  );
  p.frame(0);
  assert.equal(p.rendered.run, last, 'Sequence end never wraps to the first uncleared mission.');
  assert.equal(p.$('game-overlay').dataset.kind, 'won');
  const profile = loadLibrary(p.storage, 'revealline.library.dev.v1', {
    campaigns: pack.campaigns,
  }).library;
  const progress = Object.values(profile.campaigns).find(
    (entry) => entry.clears['authored-next-1'],
  );
  assert.deepEqual(Object.keys(progress.clears).sort(), ['authored-next-1', 'authored-next-2']);
  p.$('choose-mission').click();
  await settle(() => p.$('journey-chooser').open);
  assert.equal(p.$('journey-collection').value, 'Custom');
  assert.deepEqual(p.errors, []);
});
const settle = (predicate) => waitFor(predicate, { timeoutMs: 15000 });
async function open(p) {
  p.$('shell-play').click();
  try {
    await settle(() => p.$('journey-chooser')?.open && p.$('journey-collection'));
  } catch (error) {
    error.message += ` ${p.$('run-message').textContent} ${p.errors.map(String).join(';')}`;
    throw error;
  }
}
async function running(p, id) {
  try {
    await settle(() => {
      p.frame(0);
      return p.rendered.run.levelId === id && p.doc.body.dataset.flightState === 'running';
    });
  } catch (error) {
    error.message += `\n${JSON.stringify({
      expectedLevel: id,
      url: globalThis.location.href,
      level: p.rendered.run.levelId,
      boot: p.doc.documentElement.dataset.bootState,
      bootStatus: p.$('boot-status')?.textContent,
      flight: p.doc.body.dataset.flightState,
      picture: p.doc.body.dataset.pictureState,
      paused: p.rendered.paused,
      focus: p.doc.activeElement?.id,
      loading: p.$('mission-library-opening-status')?.textContent,
      message: p.$('run-message').textContent,
      home: p.$('shell-home').open,
      chooser: p.$('journey-chooser')?.open,
      errors: p.errors.map(String),
    })}`;
    throw error;
  }
}

test('Classic Solo mounts all91 Journey, 110 Original and 78 compatible Current Classic missions', async (t) => {
  const p = await soloPage(t, { titleScreen: true });
  await open(p);
  assert.equal(p.$('journey-cards').children.length, 279);
  assert.equal(p.$('journey-collection').value, '');
  const cards = [...p.$('journey-cards').children];
  assert.match(cards[0].textContent, /Journey/);
  assert.match(cards[0].textContent, /Arcade.*Band 1\/12 · Standard.*Optional challenge:/);
  assert.equal(
    cards.filter((card) => card.querySelector('.journey-card-tags').textContent.includes('Classic'))
      .length,
    188,
  );
  assert.match(cards.find((card) => card.dataset.missionId === lateBase.id).textContent, /Play/);
  assert.deepEqual(p.errors, []);
});

test('unified Solo retains native setup without a second mission picker', async (t) => {
  const p = await soloPage(t, { titleScreen: true });
  const steering = p.$('turn-select');
  await open(p);
  const setup = p.$('mission-picker-setup');
  assert.equal(p.$('journey-chooser').contains(setup), true);
  assert.equal(setup.open, false);
  assert.match(setup.querySelector('summary').textContent, /Current Solo flight setup/);
  assert.equal(p.$('turn-select'), steering, 'Existing guarded control, not a duplicate.');
  for (const id of ['pack-select', 'level-select', 'campaign-select'])
    assert.equal(p.$(id).closest('label').hidden, true);
  for (const id of ['difficulty-select', 'turn-select', 'body-select'])
    assert.equal(setup.contains(p.$(id)), true);
  assert.deepEqual(p.errors, []);
});

test('appearance opens the unified Solo setup and focuses its existing control', async (t) => {
  const p = await soloPage(t, { titleScreen: true });
  p.$('choose-appearance').focus();
  p.$('choose-appearance').click();
  await settle(() => p.$('journey-chooser')?.open && p.$('journey-collection'));
  assert.equal(p.$('mission-picker-setup').open, true);
  assert.equal(p.doc.activeElement, p.$('body-select'));
  assert.equal(p.$('shell-missions').open, false);
  assert.deepEqual(p.errors, []);
});

test('Journey setup changes next preset and library details without replacing the controls', async (t) => {
  const p = await journeyPage(t, '?journey=whole-spatial-v5');
  await open(p);
  const difficulty = p.$('difficulty-select');
  p.$('mission-picker-setup').open = true;
  difficulty.focus();
  difficulty.value = 'expert';
  difficulty.emit('change');
  await settle(() => p.$('journey-cards').children[0].textContent.includes('Expert'));
  assert.equal(p.$('difficulty-select'), difficulty);
  assert.equal(p.doc.activeElement, difficulty);
  assert.equal(p.$('journey-chooser').open, true);
  assert.deepEqual(p.errors, []);
});

test('unified Solo Download becomes Play inline and launches the selected late installed Classic', async (t) => {
  const p = await soloPage(t, { titleScreen: true });
  await open(p);
  p.$('journey-collection').value = 'Classic';
  p.$('journey-collection').emit('change');
  p.$('journey-search').value = 'night';
  p.$('journey-search').emit('input');
  const row = model.missions.filter((mission) => mission.ownerId.includes('night-shift')).at(-1);
  assert.ok(row);
  const card = [...p.$('journey-cards').children].find(
    (button) => button.dataset.missionId === row.id,
  );
  assert.ok(card);
  assert.match(card.textContent, /Download/);
  card.focus();
  card.click();
  await settle(() => card.textContent.endsWith('Play'));
  assert.equal(p.$('journey-chooser').open, true);
  assert.equal(p.$('journey-search').value, 'night');
  assert.equal(p.doc.activeElement, card);
  assert.notEqual(p.doc.body.dataset.flightState, 'running');
  card.click();
  await running(p, row.runtimeId);
  assert.equal(p.$('journey-chooser').open, false);
  assert.deepEqual(p.errors, []);
});

test('unified Solo failed Download retries inline and Back restores Missions without replacing the prepared flight', async (t) => {
  let available = false,
    requests = 0;
  const p = await soloPage(t, {
    titleScreen: true,
    fetchResponse: async (path) => {
      if (path === 'content/packs/night-shift.json') {
        requests++;
        if (!available) throw new TypeError('Download temporarily unavailable');
      }
    },
  });
  const initial = p.rendered.run,
    checkpoint = authoritativeCheckpoint(initial);
  await open(p);
  p.$('journey-collection').value = 'Classic';
  p.$('journey-collection').emit('change');
  p.$('journey-search').value = 'night';
  p.$('journey-search').emit('input');
  const row = model.missions.filter((mission) => mission.ownerId.includes('night-shift')).at(-1),
    selected = () =>
      [...p.$('journey-cards').children].find((card) => card.dataset.missionId === row.id);
  const card = selected();
  assert.match(card.textContent, /Download/);
  card.focus();
  card.click();
  await settle(() => /Could not prepare/.test(p.$('journey-chooser-status').textContent));
  assert.equal(requests, 1);
  assert.match(card.querySelector('.journey-card-action').textContent, /Unavailable.*Retry$/);
  assert.equal(card.disabled, false, 'The same visible card permits an explicit retry.');
  assert.equal(p.$('journey-chooser').open, true);
  assert.equal(p.doc.activeElement, card);
  assert.equal(p.rendered.run, initial);
  assert.deepEqual(authoritativeCheckpoint(initial), checkpoint);
  available = true;
  card.click();
  await settle(() => card.textContent.endsWith('Play'));
  assert.equal(requests, 2);
  assert.equal(p.doc.activeElement, card);
  assert.notEqual(p.doc.body.dataset.flightState, 'running');
  p.$('journey-back').click();
  assert.equal(p.$('journey-chooser').open, false);
  assert.equal(p.$('shell-home').open, true);
  assert.equal(p.doc.activeElement.id, 'shell-play');
  assert.equal(p.rendered.run, initial);
  assert.deepEqual(authoritativeCheckpoint(initial), checkpoint);
  await open(p);
  assert.equal(p.$('journey-search').value, 'night');
  assert.equal(p.doc.activeElement, selected());
  assert.match(selected().textContent, /Play/);
  assert.deepEqual(p.errors, []);
});

test('empty-profile Classic selection starts the exact late Base mission, without awarding a clear', async (t) => {
  const p = await soloPage(t, { titleScreen: true });
  await open(p);
  const card = [...p.$('journey-cards').children].find(
    (card) => card.dataset.missionId === lateBase.id,
  );
  card.click();
  await running(p, lateBase.runtimeId);
  assert.equal(p.$('journey-chooser').open, false);
  assert.equal(p.$('shell-home').open, false);
  const profile = JSON.parse(p.storage.getItem('revealline.library.dev.v1'));
  assert.ok(
    Object.values(profile?.campaigns ?? {}).every(
      (progress) => Object.keys(progress.clears).length === 0,
    ),
  );
  assert.deepEqual(p.errors, []);
});

test('incoming opaque Classic handoff starts its exact late mission without showing another picker', async (t) => {
  const search = new URLSearchParams({ journey: 'legacy', 'library-mission': lateBase.id });
  const p = await soloPage(t, { titleScreen: true, search: `?${search}` });
  await running(p, lateBase.runtimeId);
  assert.equal(p.$('journey-chooser').open, false);
  assert.equal(p.$('shell-home').open, false);
  assert.deepEqual(p.errors, []);
});

for (const transition of ['finish', 'newer input', 'failed initial picture'])
  test(`incoming Classic handoff serializes initial picture preparation: ${transition}`, async (t) => {
    const compiled = JSON.parse(
      await readFile(new URL('../presentation/compiled/runtime.json', import.meta.url)),
    );
    const pictureHash = (level) =>
      Object.values(compiled.resolved.assets).find(
        (asset) => asset.kind === 'image' && asset.description === `scene-${level}`,
      ).file.sha256;
    const initialHash = pictureHash('signal-01'),
      targetHash = pictureHash(lateBase.runtimeId);
    let release,
      initialRequested = false,
      targetRequests = 0;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    t.after(() => release());
    const search = new URLSearchParams({ journey: 'legacy', 'library-mission': lateBase.id });
    const page = soloPage(t, {
      titleScreen: true,
      search: `?${search}`,
      waitForPictures: false,
      fetchResponse: async (path) => {
        if (String(path).includes(targetHash)) targetRequests++;
        if (!String(path).includes(initialHash)) return;
        initialRequested = true;
        await gate;
        if (transition === 'failed initial picture')
          return new Response('Deliberate initial picture outage', { status: 503 });
      },
    });
    await settle(
      () => initialRequested && globalThis.document.getElementById('journey-collection'),
    );
    const doc = globalThis.document;
    assert.notEqual(doc.body.dataset.flightState, 'running');
    assert.equal(
      targetRequests,
      0,
      'The requested original waits for the captured initial writer.',
    );
    if (transition === 'newer input') {
      doc.getElementById('start-button').emit('pointerdown');
      doc.getElementById('start-button').focus();
    }
    const focused = doc.activeElement;
    release();
    const p = await page;
    if (transition === 'newer input') {
      await settle(() => p.doc.body.dataset.pictureState === 'ready');
      await new Promise((resolve) => setImmediate(resolve));
      p.frame(0);
      assert.equal(
        targetRequests,
        0,
        'A retired incoming action must never prepare its destination.',
      );
      assert.equal(p.rendered.run.levelId, 'signal-01');
      assert.equal(p.rendered.run.tick, 0);
      assert.equal(p.rendered.paused, true);
      assert.equal(p.doc.activeElement, focused);
      assert.notEqual(p.doc.body.dataset.flightState, 'running');
    } else {
      await running(p, lateBase.runtimeId);
      assert.ok(targetRequests > 0);
      assert.equal(p.$('shell-home').open, false);
    }
    assert.equal(p.$('journey-chooser').open, false);
    assert.deepEqual(p.errors, []);
  });

test('unknown incoming identity reports failure and never starts a different mission', async (t) => {
  const p = await soloPage(t, {
    titleScreen: true,
    search: '?journey=legacy&library-mission=unknown',
  });
  await settle(() => p.$('run-message').textContent.includes('exact mission edition'));
  p.frame(0);
  assert.notEqual(p.doc.body.dataset.flightState, 'running');
  assert.equal(p.$('shell-home').open, false);
  assert.deepEqual(p.errors, []);
});

test('default Journey mounts201 missions and hands the exact Classic selection to its own host', async (t) => {
  const p = await journeyPage(t);
  await open(p);
  assert.equal(p.$('journey-cards').children.length, 201);
  [...p.$('journey-cards').children].find((card) => card.dataset.missionId === lateBase.id).click();
  await settle(() => globalThis.location.href.includes('library-mission='));
  const destination = new URL(globalThis.location.href);
  assert.equal(destination.searchParams.get('journey'), 'legacy');
  assert.equal(destination.searchParams.get('library-mission'), lateBase.id);
  assert.equal(destination.pathname, '/game/');
  assert.deepEqual(p.errors, []);
});

test('Classic hands a Journey card directly to its new-edition host', async (t) => {
  const p = await soloPage(t, { titleScreen: true });
  await open(p);
  const card = p.$('journey-cards').children[1],
    id = card.dataset.missionId;
  card.click();
  await settle(() => globalThis.location.href.includes('library-mission='));
  const destination = new URL(globalThis.location.href);
  assert.equal(destination.searchParams.get('journey'), 'whole-spatial-v5');
  assert.equal(destination.searchParams.get('library-mission'), id);
  assert.deepEqual(p.errors, []);
});

test('Solo mode filter exposes the same qualified Journey identities in Versus without duplicates', async (t) => {
  const p = await soloPage(t, { titleScreen: true });
  await open(p);
  const original = [...p.$('journey-cards').children].map((card) => card.dataset.missionId);
  p.$('journey-mode').value = 'versus';
  p.$('journey-mode').emit('change');
  const cards = [...p.$('journey-cards').children];
  assert.deepEqual(
    cards.map((card) => card.dataset.missionId),
    original,
  );
  assert.equal(new Set(original).size, 201);
  const target = cards[1];
  assert.match(target.textContent, /Journey.*Band 1\/12.*Play/);
  target.click();
  await settle(() => globalThis.location.href.includes('library-mission='));
  const destination = new URL(globalThis.location.href);
  assert.equal(destination.pathname, '/game/couch/');
  assert.equal(destination.searchParams.get('journey'), 'whole-spatial-v5');
  assert.equal(destination.searchParams.get('library-mission'), target.dataset.missionId);
  assert.deepEqual(p.errors, []);
});

for (const collection of ['Journey', 'Classic'])
  test(`Solo Team filter hands an exact ${collection} mission to its Team host`, async (t) => {
    const p = await soloPage(t, { titleScreen: true });
    await open(p);
    p.$('journey-mode').value = 'team';
    p.$('journey-mode').emit('change');
    const cards = [...p.$('journey-cards').children];
    assert.equal(cards.length, 14);
    assert.equal(new Set(cards.map((card) => card.dataset.missionId)).size, 14);
    const target = cards.find((card) =>
      card.querySelector('.journey-card-tags').textContent.includes(collection),
    );
    assert.match(target.textContent, /Play/);
    target.click();
    await settle(() => globalThis.location.href.includes('library-mission='));
    const destination = new URL(globalThis.location.href);
    assert.equal(destination.pathname, '/game/couch/relay-rescue.html');
    assert.equal(
      destination.searchParams.get('journey'),
      collection === 'Journey' ? 'team-trail-impact-originals-1' : 'legacy',
    );
    assert.equal(destination.searchParams.get('library-mission'), target.dataset.missionId);
    assert.deepEqual(p.errors, []);
  });

test('incoming Journey selection starts exactly its requested mission without another picker', async (t) => {
  const id = JSON.stringify([
    'journey:whole-spatial-v5',
    'whole-spatial-v5',
    JSON.stringify(['candidate', 'journey-opening', 'prologue']),
    'candidate/journey-opening/prologue/choose-your-share',
    '',
  ]);
  const search = new URLSearchParams({ journey: 'whole-spatial-v5', 'library-mission': id });
  const p = await journeyPage(t, `?${search}`);
  await running(p, 'choose-your-share');
  assert.equal(p.$('journey-chooser').open, false);
  assert.deepEqual(p.errors, []);
});

test('unfinished Classic attempt keeps its exact cut through Stay and returns to the selected card', async (t) => {
  const p = await soloPage(t, { titleScreen: true });
  p.$('shell-featured').click();
  await running(p, model.missions[0].runtimeId);
  p.key('ArrowDown');
  p.key('ArrowDown', false);
  for (let i = 0; i < 13; i++) p.frame();
  assert.equal(p.rendered.run.player.cutting, true);
  p.$('shell-menu').click();
  await open(p);
  const old = p.rendered.run,
    checkpoint = authoritativeCheckpoint(old);
  [...p.$('journey-cards').children].find((card) => card.dataset.missionId === lateBase.id).click();
  await settle(
    () => p.$('mission-replace-dialog').open && !p.$('mission-replace-confirm').disabled,
  );
  assert.equal(p.$('journey-chooser').open, false);
  p.$('mission-replace-stay').click();
  assert.equal(p.$('journey-chooser').open, true);
  assert.equal(p.doc.activeElement.dataset.missionId, lateBase.id);
  p.frame(0);
  assert.equal(p.rendered.run, old);
  assert.deepEqual(authoritativeCheckpoint(old), checkpoint);
  assert.deepEqual(p.errors, []);
});
