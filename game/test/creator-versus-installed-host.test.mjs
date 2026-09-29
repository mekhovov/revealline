import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { couchPage } from './helpers/couch-host.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { pngBytes, deferred } from './helpers/media-fixtures.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { activateMissionCard } from './helpers/library-selection.mjs';
import { PNGImage } from './helpers/png-image.mjs';
import { generateCreatorProject } from '../creator/templates.mjs';
import { creatorSHA256 } from '../creator/bytes.mjs';
import { approveCreatorBundle, prepareCreatorBundle } from '../creator/bundle.mjs';
import {
  createCreatorStore,
  installPreparedCreatorBundle,
  reviewCreatorInstallation,
} from '../creator/installed.mjs';
import { creatorProfileKey } from '../creator/runtime.mjs';
import { createJourneyBackend } from '../journey/profile.mjs';

const themes = JSON.parse(
  await readFile(new URL('../content-design/themes.json', import.meta.url)),
).themes;

class Locks {
  held = new Set();
  async request(name, _options, work) {
    if (this.held.has(name)) return work(null);
    this.held.add(name);
    try {
      return await work({ name });
    } finally {
      this.held.delete(name);
    }
  }
}

function indexedDatabases() {
  const databases = new Map();
  return {
    open(name, ...args) {
      if (!databases.has(name)) databases.set(name, managedIndexedDB());
      return databases.get(name).indexedDB.open(name, ...args);
    },
  };
}

async function creatorCampaign({ firstMissionId = 'picture-1' } = {}) {
  const first = generateCreatorProject({ id: 'versus-installed', name: 'Picture race', seed: 8 });
  const second = generateCreatorProject({ id: 'versus-next', name: 'Picture race', seed: 9 });
  const project = structuredClone(first.project);
  const firstMission = project.missions[0];
  firstMission.id = firstMissionId;
  if (firstMissionId !== 'picture-1') firstMission.name = 'Custom first return';
  project.campaigns[0].missionIds = [firstMission.id];
  const firstProvenance = { ...first.provenance, missionId: firstMission.id };
  const secondMap = structuredClone(second.project.maps[0]);
  secondMap.id = 'picture-map-2';
  const secondMission = structuredClone(second.project.missions[0]);
  secondMission.id = 'picture-2';
  secondMission.name = 'Second picture';
  secondMission.map.id = secondMap.id;
  project.maps.push(secondMap);
  project.missions.push(secondMission);
  project.campaigns[0].missionIds.push(secondMission.id);
  const blob = new Blob([pngBytes()], { type: 'image/png' });
  const sha256 = await creatorSHA256(await blob.arrayBuffer());
  project.assets = [
    {
      format: 'AssetRevisionV1',
      id: 'picture',
      revision: '1',
      kind: 'reveal-background',
      path: `content-design/assets/creator/${sha256}.png`,
      sha256,
      bytes: blob.size,
      width: 1,
      height: 1,
      alt: 'Installed creator race picture',
      review: 'candidate',
    },
  ];
  for (const mission of project.missions) mission.presentation.backgroundAssetId = 'picture';
  const pack = await prepareCreatorBundle(
    {
      project,
      packId: 'collection',
      themes,
      provenance: [firstProvenance, { ...second.provenance, missionId: secondMission.id }],
      credits: {
        creator: 'Creator host fixture',
        picture: 'Original fixture',
        license: 'Fixture sharing permission',
      },
    },
    [{ sha256, blob }],
    { decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }) },
  );
  const route = pack.manifest.evidence
    .find((entry) => entry.missionId === firstProvenance.missionId)
    .routes.find((entry) => entry.difficulty === 'standard' && entry.turnPolicy === 'immediate');
  assert(route?.replay, 'the installed mission needs its verified route recording');
  return { pack, route };
}

async function openCreatorHost(t, indexedDB, storage, options = {}) {
  return couchPage(t, {
    initialLevel: null,
    storage,
    previewStorage: storage,
    lockManager: new Locks(),
    assetDatabase: indexedDB,
    ImageClass: PNGImage,
    fetchResponse: async (path) => {
      if (String(path).includes('/content-design/assets/'))
        return new Response(await readFile(path));
      if (path === '../content/packs/fpv-arcade-r5.json')
        return new Response('Fixture isolates installed creator content', { status: 503 });
    },
    ...options,
  });
}

async function fixture(options) {
  const indexedDB = indexedDatabases(),
    local = new Map(),
    storage = {
      getItem: (key) => local.get(key) ?? null,
      setItem: (key, value) => local.set(key, value),
      removeItem: (key) => local.delete(key),
    },
    { pack, route } = await creatorCampaign(options),
    store = createCreatorStore({ indexedDB }),
    approval = approveCreatorBundle(pack);
  await installPreparedCreatorBundle(
    store,
    pack,
    approval,
    await reviewCreatorInstallation(store, pack, approval),
    { decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }) },
  );
  store.close();
  return { pack, route, indexedDB, storage };
}

function reachMissionGo(page) {
  assert.equal(page.$('race-start-cue').hidden, false);
  assert.equal(page.$('race-start-cue').dataset.kind, 'mission');
  assert.equal(page.$('race-start-cue-label').textContent, '3');
  page.frame(0, { preserveStartCue: true });
  assert.equal(page.tick(), 0);
  page.frame(700, { preserveStartCue: true });
  assert.equal(page.$('race-start-cue-label').textContent, '2');
  page.frame(700, { preserveStartCue: true });
  assert.equal(page.$('race-start-cue-label').textContent, '1');
  page.frame(700, { preserveStartCue: true });
  assert.equal(page.$('race-start-cue-label').textContent, 'GO');
  assert.equal(page.tick(), 0);
  page.frame(1000 / 120, { preserveStartCue: true });
  assert.equal(page.tick(), 1);
}
function finishMissionCue(page) {
  for (let tick = 1; tick < 42; tick++) page.frame(1000 / 120, { preserveStartCue: true });
  assert.equal(page.$('race-start-cue').hidden, true);
  assert.equal(page.tick(), 42);
}

function replayPlayerOne(page, replay) {
  const directionKeys = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' };
  let heldDirection = null;
  for (const segment of replay.segments) {
    if (segment.releaseBefore && heldDirection) {
      page.key(directionKeys[heldDirection], false);
      heldDirection = null;
    }
    const direction = segment.input.direction;
    if (direction !== heldDirection) {
      if (heldDirection) page.key(directionKeys[heldDirection], false);
      if (direction) page.key(directionKeys[direction]);
      heldDirection = direction;
    }
    for (let tick = 0; tick < segment.ticks; tick++)
      page.frame(1000 / 120, { preserveStartCue: true });
  }
  if (heldDirection) page.key(directionKeys[heldDirection], false);
}

async function openMissionLibrary(page) {
  page.$('race-options').click();
  page.$('race-settings-tab-content').click();
  const opener = page.$('race-library-switch'),
    listeners = opener.listeners.get('click'),
    pending = [];
  assert(opener.getClientRects().length, 'the moved library action is visible in Settings');
  opener.listeners.set(
    'click',
    new Set(
      [...listeners].map((listener) => (event) => {
        const result = listener.call(opener, event);
        if (result instanceof Promise) pending.push(result);
        return result;
      }),
    ),
  );
  try {
    opener.focus();
    opener.click();
  } finally {
    opener.listeners.set('click', listeners);
  }
  assert.equal(pending.length, 1);
  await pending[0];
  assert.equal(page.$('journey-chooser').open, true);
}

test('installed Creator launch does not evaluate an absent authored Journey route', async (t) => {
  const { pack, indexedDB, storage } = await fixture(),
    page = await openCreatorHost(t, indexedDB, storage);
  await openMissionLibrary(page);
  const card = [...page.$('journey-cards').children].find((candidate) => {
    const [owner, edition] = JSON.parse(candidate.dataset.missionId);
    return owner === 'creator:' + pack.editionId && edition === pack.editionId;
  });
  assert(card, 'the installed Creator mission must be selectable without a Journey route');
  await activateMissionCard(card);
  page.frame(0);
  assert.equal(
    page.renders[0].level.id,
    'picture-1',
    page.$('race-message').textContent + ' ' + page.$('journey-chooser-status').textContent,
  );
});

for (const interruption of ['Settings Back', 'foreground loss'])
  test(`installed Creator launch from Settings retires after ${interruption} during picture preparation`, async (t) => {
    const { pack, indexedDB, storage } = await fixture(),
      gate = deferred();
    let held = null,
      armed = false;
    class HeldPicture extends PNGImage {
      async decode() {
        await super.decode();
        if (
          armed &&
          !held &&
          globalThis.document.getElementById('race-preparation')?.dataset.state === 'busy'
        ) {
          held = this;
          await gate.promise;
        }
      }
    }
    t.after(() => gate.resolve());
    const page = await openCreatorHost(t, indexedDB, storage, { ImageClass: HeldPicture });
    page.frame(0);
    const before = [...page.renders],
      wasStartDisabled = page.$('race-start').disabled;
    await openMissionLibrary(page);
    const card = [...page.$('journey-cards').children].find((candidate) => {
      const [owner, edition] = JSON.parse(candidate.dataset.missionId);
      return owner === `creator:${pack.editionId}` && edition === pack.editionId;
    });
    assert(card);
    armed = true;
    const pending = activateMissionCard(card);
    await waitFor(() => held, { message: 'Installed picture preparation did not begin.' });
    assert.equal(page.$('journey-chooser').open, false);
    assert.equal(page.$('race-options-panel').hidden, false);
    if (interruption === 'Settings Back') {
      page.$('race-options-back').focus();
      page.$('race-options-back').click();
    } else {
      page.doc.focused = false;
      page.win.emit('blur');
    }
    const focused = page.doc.activeElement;
    gate.resolve();
    await pending;
    page.frame(0);
    assert.notEqual(page.state(), 'running');
    assert.ok(page.renders[0] === before[0], 'Player one keeps the preceding board.');
    assert.ok(page.renders[1] === before[1], 'Player two keeps the preceding board.');
    assert.equal(page.$('race-start').disabled, wasStartDisabled);
    assert.equal(page.doc.activeElement, focused);
    assert.equal(page.$('journey-chooser').open, false);
  });

test('installed creator campaigns continue and restore their earned state in a fresh Versus host', async (t) => {
  const { pack, route, indexedDB, storage } = await fixture();
  let firstMissionId;

  await t.test('a pointer-style Next click advances to the second mission', async (t) => {
    const page = await openCreatorHost(t, indexedDB, storage);
    await openMissionLibrary(page);
    const cards = [...page.$('journey-cards').children].filter((card) => {
      const [owner, edition] = JSON.parse(card.dataset.missionId);
      return owner === `creator:${pack.editionId}` && edition === pack.editionId;
    });
    assert.equal(cards.length, 2);
    assert.match(cards[0].textContent, /Custom/);
    firstMissionId = cards[0].dataset.missionId;
    await activateMissionCard(cards[0]);
    reachMissionGo(page);
    assert.equal(
      page.renders[0].level.id,
      'picture-1',
      `${page.$('race-message').textContent} ${page.$('journey-chooser-status').textContent}`,
    );
    assert.equal(page.renders[1].level.id, 'picture-1');
    assert.notEqual(page.renders[0].cells, page.renders[1].cells);
    assert.match(page.$('race-clock').textContent, /No countdown/);
    const exactRevision = page.renders[0].level.revision;
    assert.equal(page.$('race-journey-difficulty').disabled, true);
    page.$('race-journey-difficulty').value = 'expert';
    page.$('race-journey-difficulty').onchange();
    assert.equal(page.$('race-journey-difficulty').value, 'standard');
    assert.equal(page.renders[0].level.revision, exactRevision);

    replayPlayerOne(page, route.replay);
    assert.equal(page.$('race-start-cue').hidden, true);
    assert.equal(
      page.renders[0].status,
      'won',
      JSON.stringify({
        tick: page.renders[0].tick,
        position: [page.renders[0].player.x, page.renders[0].player.y],
        status: page.renders[0].status,
      }),
    );
    assert.equal(page.renders[1].status, 'running');
    assert.equal(page.$('race-journey-next').hidden, false);
    assert.match(page.$('race-message').textContent, /Choose Next mission/);
    assert.match(page.$('race-start').textContent, /^Next mission:/);

    const next = page.$('race-start'),
      nextHandler = next.onclick;
    let continuation;
    // Element.click() intentionally does not focus in this DOM fixture. This is
    // the prominent results-screen pointer path; the separate navigation bar is
    // hidden outside the board view in the physical browser.
    page.$('race-canvas-0').focus();
    assert.notEqual(page.doc.activeElement, next);
    next.onclick = (...args) => (continuation = nextHandler.apply(next, args));
    try {
      next.click();
    } finally {
      next.onclick = nextHandler;
    }
    assert(continuation instanceof Promise);
    assert.equal(
      await continuation,
      undefined,
      `${page.$('race-message').textContent} ${page.$('journey-chooser-status').textContent}`,
    );
    reachMissionGo(page);
    finishMissionCue(page);
    assert.equal(
      page.renders[0].level.id,
      'picture-2',
      `${page.$('race-message').textContent} ${page.$('journey-chooser-status').textContent}`,
    );
    assert.equal(page.renders[1].level.id, 'picture-2');
    assert.equal(page.state(), 'running');

    const profile = await createJourneyBackend({
      indexedDB,
      profileKey: creatorProfileKey(pack.editionId),
    }).readState();
    assert(profile.profile.clears.versus['picture-1']);
    assert.equal(profile.pictures.records.length, 1);
  });

  await t.test('a fresh host reloads the installed clear and earned picture', async (t) => {
    const page = await openCreatorHost(t, indexedDB, storage);
    await openMissionLibrary(page);
    const cleared = [...page.$('journey-cards').children].find(
      (card) => card.dataset.missionId === firstMissionId,
    );
    assert(cleared, 'the exact installed Creator mission remains available after reload');
    assert.equal(cleared.dataset.pictureState, 'earned');
    assert.match(cleared.textContent, /Cleared/);
  });
});

test('installed Creator mission identity collision cannot resolve a Journey successor', async (t) => {
  const { pack, route, indexedDB, storage } = await fixture({ firstMissionId: 'first-return' });
  const page = await openCreatorHost(t, indexedDB, storage, {
    href: 'http://localhost/game/couch/?journey=opening',
  });
  await openMissionLibrary(page);
  const lifecycle = page.$('journey-lifecycle');
  assert.equal(lifecycle.value, 'archive');
  lifecycle.value = 'current';
  lifecycle.emit('change');
  const card = [...page.$('journey-cards').children].find((candidate) => {
    const identity = JSON.parse(candidate.dataset.missionId);
    return (
      identity[0] === 'creator:' + pack.editionId &&
      identity[1] === pack.editionId &&
      identity.includes('first-return')
    );
  });
  assert(card, 'the colliding installed mission remains separately selectable');
  await activateMissionCard(card);
  reachMissionGo(page);
  assert.equal(page.renders[0].level.id, 'first-return');

  replayPlayerOne(page, route.replay);
  assert.equal(page.renders[0].status, 'won');
  assert.equal(page.renders[1].status, 'running');
  assert.equal(page.$('race-journey-next').hidden, false);
  assert.equal(page.$('race-journey-next').textContent, 'Next mission');
  assert.doesNotMatch(page.$('race-journey-next').textContent, /Choose your share/);

  const next = page.$('race-journey-next'),
    nextHandler = next.onclick;
  let continuation;
  next.onclick = (...args) => (continuation = nextHandler.apply(next, args));
  try {
    next.click();
  } finally {
    next.onclick = nextHandler;
  }
  assert(continuation instanceof Promise);
  assert.equal(
    await continuation,
    undefined,
    page.$('race-message').textContent + ' ' + page.$('journey-chooser-status').textContent,
  );
  reachMissionGo(page);
  finishMissionCue(page);
  assert.equal(page.renders[0].level.id, 'picture-2');
  assert.notEqual(page.renders[0].level.id, 'choose-your-share');
  assert.equal(page.renders[1].level.id, 'picture-2');
});
