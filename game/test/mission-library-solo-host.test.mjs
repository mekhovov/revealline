import { createHash } from 'node:crypto';
import { includedChapterPage } from './helpers/included-chapter-host.mjs';
import { includedChapterFixture } from './fixtures/included-bundled.mjs';
import { verifyIndexedInstalledPack } from '../mission-library/pack-identity.mjs';
import {
  isIncludedBundledMission,
  INCLUDED_BUNDLED_PACK_MAX_BYTES,
} from '../mission-library/included-bundled-pack.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  presentationSoloPage as soloPage,
  createPresentationResponses,
  loadPresentationResponses,
} from './helpers/presentation-responses.mjs';
import { activateHostAction } from './helpers/host-action.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import {
  classicLibrarySources,
  prepareMissionLibraryIndex,
} from '../mission-library/classic-source.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { createRemoteTeamLibrarySources } from '../mission-library/remote-team.mjs';
import { duelExpeditionLibrarySources } from '../mission-library/multiplayer-expeditions.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { preparePack, emptyPackLibrary, installPack, exportPackLibrary } from '../packs.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';
import { loadLibrary } from '../library.mjs';
import { inspectImageDataUrl } from '../content.mjs';

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
const currentPressure = model.missions.find(
  (mission) =>
    mission.name === 'Orchard Crossing' &&
    mission.ownerId.includes('fpv-arcade-r5') &&
    mission.ownerId.includes('current-line-impact.v1'),
);

function assertReadyCard(card, name = card.querySelector('.journey-card-title').textContent) {
  assert.equal(card.tagName, 'BUTTON');
  assert.equal(card.type, 'button');
  assert.equal(card.disabled, false);
  assert.equal(card.dataset.availabilityState, 'ready');
  assert.ok(name.length > 0, 'The ready mission has a readable name.');
  assert.ok(
    card.getAttribute('aria-label').includes(name),
    'Its accessible name identifies the mission.',
  );
}

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
  const { pack } = await preparePack(source, {
    // Modeled Node boundary only. Production browser decoding stays unchanged.
    decodeImage: async (dataUrl) => {
      const image = inspectImageDataUrl(dataUrl);
      assert.equal(image.valid, true);
      return { naturalWidth: image.width, naturalHeight: image.height };
    },
  });
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
  assert.match(card.textContent, /Custom.*Authored rules/);
  assertReadyCard(card, second.levels.at(-1).name);
  card.click();
  await startPrepared(p, second.levels.at(-1).id);
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
  await startPrepared(p, 'authored-next-1');
  async function clear() {
    p.key('ArrowDown');
    p.key('ArrowDown', false);
    for (let tick = 0; tick < 900 && p.rendered.run.status !== 'won'; tick++) p.frame();
    assert.equal(p.rendered.run.status, 'won');
    assert.equal(p.$('game-overlay').hidden, true, 'Earned picture precedes result actions.');
    p.$('skip-celebration').onclick();
    assert.equal(p.$('show-result').hidden, false);
    p.$('show-result').click();
    assert.equal(p.$('game-overlay').hidden, false);
    assert.equal(p.$('skip-celebration').hidden, true);
    p.frame(0);
    assert.equal(p.$('game-overlay').dataset.kind, 'won');
    assert.equal(p.$('next-button').hidden, false);
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
  assert.equal(p.$('overlay-menu').hidden, false);
  p.$('overlay-menu').click();
  await settle(() => p.$('shell-home').open);
  p.$('shell-play').click();
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
function showAllLifecycles(p) {
  p.$('journey-lifecycle').value = '';
  p.$('journey-lifecycle').emit('change');
}
async function startPrepared(p, id) {
  // Selection prepares this exact attempt; only a fresh Start authorizes play.
  // Retry and Next continue to use running() directly, without another prompt.
  await settle(() => {
    p.frame(0);
    return (
      p.rendered.run.levelId === id &&
      p.doc.body.dataset.pictureState === 'ready' &&
      p.doc.body.dataset.flightState === 'briefing'
    );
  });
  const prepared = p.rendered.run;
  const preparedCheckpoint = authoritativeCheckpoint(prepared);
  assert.equal(p.rendered.paused, true);
  assert.equal(prepared.tick, 0);
  assert.equal(p.doc.activeElement, p.$('start-button'));
  assert.equal(p.$('journey-chooser').open, false);
  assert.equal(p.$('shell-home').open, false);
  p.frame(100);
  assert.equal(p.rendered.run, prepared);
  assert.deepEqual(
    authoritativeCheckpoint(prepared),
    preparedCheckpoint,
    'Viewing a prepared briefing must not simulate or replace the accepted attempt.',
  );
  await activateHostAction(p.$('start-button'));
  await running(p, id);
  assert.equal(p.rendered.run, prepared, 'Explicit Start activates the same accepted mission.');
  assert.deepEqual(authoritativeCheckpoint(prepared), preparedCheckpoint);
  assert.equal(p.rendered.paused, false);
  assert.equal(p.$('game-overlay').hidden, true);
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

test('Classic Solo mounts all 139 Journey and 296 retained Classic missions', async (t) => {
  const p = await soloPage(t, { titleScreen: true });
  await open(p);
  assert.equal(p.$('journey-lifecycle').value, 'current');
  assert.equal(p.$('journey-cards').children.length, 240);
  showAllLifecycles(p);
  assert.equal(p.$('journey-cards').children.length, 435);
  assert.equal(p.$('journey-collection').value, '');
  const cards = [...p.$('journey-cards').children];
  assert.match(cards[0].textContent, /Journey/);
  assert.match(cards[0].textContent, /Arcade.*Band 1\/12 · Standard.*Optional challenge:/);
  assert.equal(
    cards.filter((card) => card.querySelector('.journey-card-tags').textContent.includes('Classic'))
      .length,
    296,
  );
  assertReadyCard(
    cards.find((card) => card.dataset.missionId === lateBase.id),
    lateBase.name,
  );
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

test('unified Solo validates and directly launches the included late Classic', async (t) => {
  const { p, row } = await includedChapterPage(t);
  await open(p);
  p.$('journey-collection').value = 'Classic';
  p.$('journey-collection').emit('change');
  p.$('journey-search').value = 'Included fixture';
  p.$('journey-search').emit('input');
  assert.ok(row);
  const card = [...p.$('journey-cards').children].find(
    (button) => button.dataset.missionId === row.id,
  );
  assert.ok(card);
  assert.equal(card.dataset.availabilityState, 'included');
  assert.equal(card.querySelector('.journey-card-action').hidden, true);
  assert.equal(card.disabled, false);
  card.focus();
  card.click();
  await startPrepared(p, row.runtimeId);
  assert.equal(p.$('journey-chooser').open, false);
  assert.equal(p.$('journey-search').value, 'Included fixture');
  assert.deepEqual(p.errors, []);
});

test('unified Solo failed included-chapter read retries inline and preserves the flight until retry succeeds', async (t) => {
  let available = false,
    requests = 0;
  const { p, row } = await includedChapterPage(t, {
    request: () => {
      requests++;
      if (!available) throw new TypeError('Download temporarily unavailable');
    },
  });
  const initial = p.rendered.run,
    checkpoint = authoritativeCheckpoint(initial);
  await open(p);
  p.$('journey-collection').value = 'Classic';
  p.$('journey-collection').emit('change');
  p.$('journey-search').value = 'Included fixture';
  p.$('journey-search').emit('input');
  const selected = () =>
    [...p.$('journey-cards').children].find((card) => card.dataset.missionId === row.id);
  const card = selected();
  assert.equal(card.dataset.availabilityState, 'included');
  assert.equal(card.querySelector('.journey-card-action').hidden, true);
  assert.equal(card.disabled, false);
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
  await startPrepared(p, row.runtimeId);
  assert.equal(requests, 2);
  assert.equal(p.$('journey-chooser').open, false);
  assert.notEqual(p.rendered.run, initial);
  await open(p);
  assert.equal(p.$('journey-search').value, 'Included fixture');
  assert.equal(p.doc.activeElement, selected());
  assertReadyCard(selected(), row.name);
  assert.deepEqual(p.errors, []);
});

test('empty-profile Classic selection directly launches its exact late mission without awarding a clear', async (t) => {
  const p = await soloPage(t, { titleScreen: true });
  await open(p);
  const card = [...p.$('journey-cards').children].find(
    (card) => card.dataset.missionId === lateBase.id,
  );
  card.click();
  await startPrepared(p, lateBase.runtimeId);
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

test('incoming opaque Classic handoff launches its exact late mission without another picker', async (t) => {
  const search = new URLSearchParams({ journey: 'legacy', 'library-mission': lateBase.id });
  const p = await soloPage(t, { titleScreen: true, search: `?${search}` });
  await startPrepared(p, lateBase.runtimeId);
  assert.equal(p.$('journey-chooser').open, false);
  assert.equal(p.$('shell-home').open, false);
  assert.deepEqual(p.errors, []);
});

test('incoming Current-rules Classic handoff retains its original picture owner', async (t) => {
  assert.ok(currentPressure);
  const source = JSON.parse(
    await readFile(new URL('../content/packs/fpv-arcade-r5.json', import.meta.url), 'utf8'),
  );
  const { pack } = await preparePack(source, {
    decodeImage: async (dataUrl) => {
      const image = inspectImageDataUrl(dataUrl);
      return { naturalWidth: image.width, naturalHeight: image.height };
    },
  });
  const assets = await installedAssets(pack);
  const search = new URLSearchParams({
    journey: 'legacy',
    'library-mission': currentPressure.id,
  });
  const p = await soloPage(t, {
    titleScreen: true,
    search: `?${search}`,
    assetIndexedDB: assets.indexedDB,
  });
  await startPrepared(p, currentPressure.runtimeId);
  assert.equal(p.rendered.run.level.classic.lineImpact.version, 'line-impact.v1');
  assert.ok(Math.abs(p.rendered.run.level.classic.lineImpact.speed - 38.4) < 1e-9);
  assert.equal(p.$('journey-chooser').open, false);
  assert.doesNotMatch(p.$('run-message').textContent, /Picture choice.*execution catalog/);
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
      await startPrepared(p, lateBase.runtimeId);
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

test('default Journey mounts335 missions and hands the exact Classic selection to its own host', async (t) => {
  const p = await journeyPage(t);
  await open(p);
  showAllLifecycles(p);
  assert.equal(p.$('journey-cards').children.length, 435);
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
  assert.equal(destination.searchParams.get('journey'), 'whole-spatial-v25');
  assert.equal(destination.searchParams.get('library-mission'), id);
  assert.deepEqual(p.errors, []);
});

test('Solo mode filter retains Solo identities and adds only owned Duel lessons and expeditions without duplicates', async (t) => {
  const p = await soloPage(t, { titleScreen: true });
  await open(p);
  showAllLifecycles(p);
  const original = [...p.$('journey-cards').children].map((card) => card.dataset.missionId);
  p.$('journey-mode').value = 'versus';
  p.$('journey-mode').emit('change');
  const cards = [...p.$('journey-cards').children];
  const themes = JSON.parse(
    await readFile(new URL('../content-design/themes.json', import.meta.url), 'utf8'),
  ).themes;
  const sources = duelExpeditionLibrarySources({ themes, launch: () => true });
  assert.deepEqual(
    sources.map((source) => source.id),
    ['journey:humanoid-hunt-v1', 'journey:duel-expedition-v1'],
  );
  const admitted = createMissionLibrary(sources).missions;
  assert.ok(admitted.every((mission) => mission.modes.includes('versus')));
  const expected = [...original, ...admitted.map((mission) => mission.id)];
  assert.equal(
    new Set(expected).size,
    expected.length,
    'Registered owners do not alias Solo rows.',
  );
  assert.deepEqual(cards.map((card) => card.dataset.missionId).sort(), expected.sort());
  assert.equal(new Set(original).size, 435);
  assert.equal(new Set(cards.map((card) => card.dataset.missionId)).size, cards.length);
  const target = cards.find((card) => card.dataset.missionId === original[1]);
  assert.match(target.textContent, /Journey.*Band 1\/12/);
  assertReadyCard(target);
  target.click();
  await settle(() => globalThis.location.href.includes('library-mission='));
  const destination = new URL(globalThis.location.href);
  assert.equal(destination.pathname, '/game/couch/');
  assert.equal(destination.searchParams.get('journey'), 'whole-spatial-v25');
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
    const sources = createRemoteTeamLibrarySources({ launch: () => true });
    assert.deepEqual(
      sources.map((source) => source.id),
      [
        'journey:team-expedition-v1',
        'team-journey:humanoid-hunt-v1',
        'journey:team-cultural-specialist-originals-2',
        'team-classic:relay-rescue-starter',
      ],
    );
    const admitted = createMissionLibrary(sources).missions;
    assert.ok(admitted.every((mission) => mission.modes.includes('team')));
    assert.deepEqual(
      cards.map((card) => card.dataset.missionId).sort(),
      admitted.map((mission) => mission.id).sort(),
    );
    assert.equal(new Set(cards.map((card) => card.dataset.missionId)).size, cards.length);
    const retained = admitted.filter((mission) =>
      [
        'journey:team-cultural-specialist-originals-2',
        'team-classic:relay-rescue-starter',
      ].includes(mission.ownerId),
    );
    assert.equal(retained.length, 14, 'Every original Team Journey and Classic identity remains.');
    const exact = retained.find((mission) => mission.collection === collection);
    assert.ok(exact);
    const target = cards.find((card) => card.dataset.missionId === exact.id);
    assertReadyCard(target);
    target.click();
    await settle(() => globalThis.location.href.includes('library-mission='));
    const destination = new URL(globalThis.location.href);
    assert.equal(destination.pathname, '/game/couch/relay-rescue.html');
    assert.equal(
      destination.searchParams.get('journey'),
      collection === 'Journey' ? 'team-cultural-specialist-originals-2' : 'legacy',
    );
    assert.equal(destination.searchParams.get('library-mission'), target.dataset.missionId);
    assert.deepEqual(p.errors, []);
  });

test('incoming Journey selection launches exactly its requested mission without another picker', async (t) => {
  const id = JSON.stringify([
    'journey:whole-spatial-v5',
    'whole-spatial-v5',
    JSON.stringify(['candidate', 'journey-opening', 'prologue']),
    'candidate/journey-opening/prologue/choose-your-share',
    '',
  ]);
  const search = new URLSearchParams({ journey: 'whole-spatial-v5', 'library-mission': id });
  const p = await journeyPage(t, `?${search}`);
  await startPrepared(p, 'choose-your-share');
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

test('procedural included chapter has actual bounded bytes and authenticated runtime owners', async () => {
  const fixture = await includedChapterFixture();
  assert.equal(INCLUDED_BUNDLED_PACK_MAX_BYTES, 65536);
  assert.ok(fixture.bytes.length > 0 && fixture.bytes.length <= INCLUDED_BUNDLED_PACK_MAX_BYTES);
  assert.equal(
    createHash('sha256').update(fixture.bytes).digest('hex'),
    fixture.rows[0].sourceFile.sha256,
  );
  assert.equal(fixture.rows[0].sourceFile.bytes, fixture.bytes.length);
  assert.equal(fixture.rows.length, 3);
  const index = prepareMissionLibraryIndex({
    format: 'revealline-mission-library-index.v1',
    missions: fixture.rows,
  });
  for (const row of index.missions) {
    assert.equal(isIncludedBundledMission(row), true);
    assert.equal(await verifyIndexedInstalledPack(fixture.pack, row), true);
    assert.deepEqual(row.modes, ['solo', 'versus']);
    assert.ok(row.difficultiesByMode.solo.includes('standard'));
  }
  assert.deepEqual(fixture.source.visualOverrides, {});
  assert.deepEqual(fixture.source.levelVisuals, []);
  assert.deepEqual(fixture.source.music, []);
});

test('included fixture refuses a false prepared-pack identity and a false byte classification', async () => {
  const fixture = await includedChapterFixture();
  const row = fixture.rows[2];
  assert.equal(
    await verifyIndexedInstalledPack(fixture.pack, {
      ...row,
      packIdentity: { ...row.packIdentity, sha256: '0'.repeat(64) },
    }),
    false,
  );
  assert.equal(
    isIncludedBundledMission({ ...row, sourceFile: { ...row.sourceFile, bytes: 65537 } }),
    false,
  );
  assert.equal(isIncludedBundledMission({ ...row, source: 'optional' }), false);
});

test('the real Night Shift source remains large and must not be classified as included', async () => {
  const bytes = await readFile(new URL('../content/packs/night-shift.json', import.meta.url));
  const index = JSON.parse(
    await readFile(new URL('../content/mission-library-index.json', import.meta.url), 'utf8'),
  );
  const rows = index.missions.filter((row) => row.packId === 'night-shift');
  assert.ok(rows.length > 0);
  assert.ok(bytes.length > INCLUDED_BUNDLED_PACK_MAX_BYTES);
  for (const row of rows) {
    assert.equal(row.sourceFile.bytes, bytes.length);
    assert.equal(row.sourceFile.sha256, createHash('sha256').update(bytes).digest('hex'));
    assert.equal(isIncludedBundledMission(row), false);
  }
});

const responsePath =
  '/game/presentation/compiled/assets/' +
  createHash('sha256')
    .update(new Uint8Array([1, 2, 3]))
    .digest('hex') +
  '.png';
const requestURL = `http://localhost${responsePath}`;
const entries = () => new Map([[responsePath, new Uint8Array([1, 2, 3])]]);

test('presentation fixture responses own byte copies, never mutable caller or prior response buffers', async () => {
  const input = new Uint8Array([1, 2, 3]);
  const fixture = createPresentationResponses(new Map([[responsePath, input]]));
  input[0] = 9;
  const first = new Uint8Array(await (await fixture.wrap()(requestURL)).arrayBuffer());
  assert.deepEqual([...first], [1, 2, 3]);
  first[1] = 9;
  assert.deepEqual(
    [...new Uint8Array(await (await fixture.wrap()(requestURL)).arrayBuffer())],
    [1, 2, 3],
  );
});
test('presentation fixture preserves explicit custom failures, values and callback argument identities', async () => {
  const fixture = createPresentationResponses(entries()),
    url = new URL(requestURL),
    controller = new AbortController();
  controller.abort();
  const options = { signal: controller.signal };
  const failure = new Response('Deliberate outage', { status: 503 });
  assert.equal(
    await fixture.wrap(async (path, init) => {
      assert.equal(path, url);
      assert.equal(init, options);
      return failure;
    })(url, options),
    failure,
  );
  assert.equal(await fixture.wrap(() => false)(url), false);
  const thrown = new Error('Deliberate request failure');
  await assert.rejects(
    fixture.wrap(() => {
      throw thrown;
    })(url),
    (error) => error === thrown,
  );
});
test('presentation fixture cannot bypass a held custom original request', async () => {
  const fixture = createPresentationResponses(entries());
  let release,
    entered = false,
    completed = false;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const pending = fixture
    .wrap(async () => {
      entered = true;
      await gate;
    })(requestURL)
    .then((response) => {
      completed = true;
      return response;
    });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(entered, true);
  assert.equal(completed, false);
  release();
  assert.deepEqual([...new Uint8Array(await (await pending).arrayBuffer())], [1, 2, 3]);
});
test('presentation fixture honors cancellation after an empty custom callback and before cached response', async () => {
  const fixture = createPresentationResponses(entries()),
    controller = new AbortController();
  const options = { signal: controller.signal };
  await assert.rejects(
    fixture.wrap(() => {
      controller.abort();
    })(requestURL, options),
    (error) => error.name === 'AbortError',
  );
});
test('presentation fixture falls through unknown resources and rejects a foreign origin for known bytes', async () => {
  const fixture = createPresentationResponses(entries());
  assert.equal(await fixture.wrap()('content/packs/night-shift.json'), undefined);
  assert.equal(await fixture.wrap()(requestURL + '?different=1'), undefined);
  await assert.rejects(fixture.wrap()('https://other.invalid' + responsePath), /origin/i);
  assert.throws(
    () => createPresentationResponses(new Map([['/outside', new Uint8Array([1])]])),
    /path/i,
  );
});
test('presentation fixture preloader rejects altered bytes rather than trusting the declared digest', async () => {
  let payloadReads = 0;
  await assert.rejects(
    loadPresentationResponses({
      read: async (url) => {
        const bytes = await readFile(url);
        if (new URL(url).pathname.endsWith('/runtime.json')) return bytes;
        payloadReads++;
        const altered = Buffer.from(bytes);
        altered[0] ^= 1;
        return altered;
      },
    }),
    /hash|digest/i,
  );
  assert.equal(payloadReads, 1);
});
