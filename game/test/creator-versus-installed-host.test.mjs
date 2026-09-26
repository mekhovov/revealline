import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { couchPage } from './helpers/couch-host.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { pngBytes } from './helpers/media-fixtures.mjs';
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

async function creatorCampaign() {
  const first = generateCreatorProject({ id: 'versus-installed', name: 'Picture race', seed: 8 });
  const second = generateCreatorProject({ id: 'versus-next', name: 'Picture race', seed: 9 });
  const project = structuredClone(first.project);
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
      provenance: [first.provenance, { ...second.provenance, missionId: secondMission.id }],
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
    .find((entry) => entry.missionId === first.provenance.missionId)
    .routes.find((entry) => entry.difficulty === 'standard' && entry.turnPolicy === 'immediate');
  assert(route?.replay, 'the installed mission needs its verified route recording');
  return { pack, route };
}

async function openCreatorHost(t, indexedDB, storage) {
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
  });
}

async function fixture(t) {
  const indexedDB = indexedDatabases(),
    local = new Map(),
    storage = {
      getItem: (key) => local.get(key) ?? null,
      setItem: (key, value) => local.set(key, value),
      removeItem: (key) => local.delete(key),
    },
    { pack, route } = await creatorCampaign(),
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
  const page = await openCreatorHost(t, indexedDB, storage);
  return { page, pack, route, indexedDB, storage };
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
    page.frames(segment.ticks);
  }
  if (heldDirection) page.key(directionKeys[heldDirection], false);
}

async function openMissionLibrary(page) {
  const opener = page.$('race-library-switch'),
    listeners = opener.listeners.get('click'),
    pending = [];
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

test('installed creator campaigns launch, award and continue in the real two-board Versus host', async (t) => {
  const { page, pack, route } = await fixture(t);
  await openMissionLibrary(page);
  const cards = [...page.$('journey-cards').children].filter((card) => {
    const [owner, edition] = JSON.parse(card.dataset.missionId);
    return owner === `creator:${pack.editionId}` && edition === pack.editionId;
  });
  assert.equal(cards.length, 2);
  assert.match(cards[0].textContent, /Custom/);
  await activateMissionCard(cards[0]);
  page.frame(0);
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

  // The host consumes one neutral resume tick before accepting player input.
  page.frame();
  replayPlayerOne(page, route.replay);
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
    `${page.$('race-message').textContent} ${page.$('journey-chooser-status').textContent}`,
  );
  page.frame(0);
  assert.equal(
    page.renders[0].level.id,
    'picture-2',
    `${page.$('race-message').textContent} ${page.$('journey-chooser-status').textContent}`,
  );
  assert.equal(page.renders[1].level.id, 'picture-2');
  assert.equal(page.state(), 'running');

  await openMissionLibrary(page);
  const cleared = [...page.$('journey-cards').children].find(
    (card) => card.dataset.missionId === cards[0].dataset.missionId,
  );
  assert.equal(cleared.dataset.pictureState, 'earned');
  assert.match(cleared.textContent, /Cleared/);
});
