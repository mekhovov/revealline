import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { couchPage } from './helpers/couch-host.mjs';
import { memoryStorage } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { ACTOR_STYLE_PREFERENCES_KEY } from '../actor-style-preferences.mjs';
import { createCouchInstalledChapters } from '../couch/couch-installed-chapters.mjs';
import { verifyIndexedInstalledPack } from '../mission-library/pack-identity.mjs';

async function setup(t, { beforeRequest, classic = false, ...options } = {}) {
  const storage = memoryStorage();
  const page = await couchPage(t, {
    href: `http://localhost/game/couch/?journey=${classic ? 'legacy' : 'opening'}`,
    initialLevel: classic ? undefined : null,
    storage,
    assetDatabase: managedIndexedDB().indexedDB,
    beforeActorRequest: beforeRequest,
    fetchResponse: async (url) => {
      if (String(url).includes('/content-design/assets/')) {
        try {
          return new Response(await readFile(url));
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
          const path = `game/content-design/assets/${String(url).split('/content-design/assets/')[1]}`;
          return new Response(
            execFileSync('git', ['show', `HEAD:${path}`], {
              cwd: fileURLToPath(new URL('../../', import.meta.url)),
              maxBuffer: 4 * 1024 * 1024,
            }),
          );
        }
      }
    },
    ...options,
  });
  page.frame(0);
  return Object.assign(page, { transport: page.actorTransport, storage });
}
const change = (p, id, value) => {
  p.$(id).value = value;
  return p.$(id).onchange();
};
async function start(p) {
  p.$('race-start').focus();
  p.$('race-start').click();
  await waitFor(
    () => {
      p.frame();
      return p.state() === 'running';
    },
    { message: p.$('race-message').textContent, timeoutMs: 15000 },
  );
}
async function clearOpening(p) {
  await start(p);
  p.key('KeyS');
  p.key('ArrowDown');
  for (let tick = 0; tick < 1400 && !p.renders.some((run) => run.status === 'won'); tick++)
    p.frame();
  p.key('KeyS', false);
  p.key('ArrowDown', false);
  p.frame(0);
  assert(
    p.renders.some((run) => run.status === 'won'),
    p.$('race-message').textContent,
  );
}

test('Versus defaults to one exact FPV actor snapshot for both Journey boards without world mutation', async (t) => {
  const p = await setup(t);
  assert.equal(p.$('race-actor-style').value, 'fpv');
  assert.equal(p.$('race-start').disabled, false, p.$('race-message').textContent);
  const appearance = p.drawOptions[0].actorAppearance;
  assert.equal(appearance, p.drawOptions[1].actorAppearance);
  assert.equal(appearance.style, 'fpv');
  assert.equal(appearance.snapshot.resolved.theme.id, 'fpv');
  assert.equal(
    appearance.snapshot.manifestSha256,
    'b4a7285520550e4cd04c7b9e80b4c6468c0a914faac77c05fa7f86a72c8a3c8f',
  );
  assert.equal(appearance.snapshot.canvas, undefined);
  assert.equal(p.drawOptions[0].backdrop, p.drawOptions[1].backdrop);
  assert.notEqual(p.$('race-theme').value, 'fpv');
  assert.deepEqual(p.checkpoint()[0], p.checkpoint()[1]);
});

test('Versus Resume and Rematch retain accepted FPV while the following Journey mission adopts Campaign', async (t) => {
  const p = await setup(t);
  const original = p.drawOptions[0].actorAppearance;
  await start(p);
  p.frames(10);
  p.$('race-pause').click();
  p.frame(0);
  const paused = p.checkpoint();
  change(p, 'race-actor-style', 'campaign');
  assert.equal(JSON.parse(p.storage.getItem(ACTOR_STYLE_PREFERENCES_KEY)).actorStyle, 'campaign');
  p.frame(0);
  assert.deepEqual(p.checkpoint(), paused);
  await start(p);
  assert.equal(p.drawOptions[0].actorAppearance, original);
  p.key('KeyS');
  p.key('ArrowDown');
  for (let tick = 0; tick < 1400 && !p.renders.some((run) => run.status === 'won'); tick++)
    p.frame();
  p.key('KeyS', false);
  p.key('ArrowDown', false);
  p.frame(0);
  assert(p.renders.some((run) => run.status === 'won'));
  await start(p); // Journey result's ordinary Start is the same-mission Rematch.
  assert.equal(p.drawOptions[0].actorAppearance, original);
  p.key('KeyS');
  p.key('ArrowDown');
  for (let tick = 0; tick < 1400 && !p.renders.some((run) => run.status === 'won'); tick++)
    p.frame();
  p.key('KeyS', false);
  p.key('ArrowDown', false);
  p.$('race-journey-next').focus();
  p.$('race-journey-next').click();
  await waitFor(
    () => {
      p.frame(0);
      return p.renders[0].levelId === 'choose-your-share';
    },
    { timeoutMs: 15000 },
  );
  assert.deepEqual(p.drawOptions[0].actorAppearance, { style: 'campaign', snapshot: null });
  assert.equal(p.drawOptions[0].actorAppearance, p.drawOptions[1].actorAppearance);
});

test('failed fresh FPV actor acquisition keeps both previous boards, picture and actor lease', async (t) => {
  let fail = false,
    rejected = 0;
  const p = await setup(t, {
    beforeRequest: ({ relative }) => {
      if (fail && relative.startsWith('runtime')) {
        rejected++;
        return new Response('', { status: 503 });
      }
    },
  });
  const original = p.drawOptions[0].actorAppearance,
    runs = [...p.renders],
    picture = p.drawOptions[0].backdrop;
  fail = true;
  const next = p.$('race-level').options.find((option) => option.value !== p.$('race-level').value);
  await change(p, 'race-level', next.value);
  p.frame(0);
  assert.deepEqual(p.renders, runs);
  assert.equal(p.drawOptions[0].actorAppearance, original);
  assert.equal(p.drawOptions[1].actorAppearance, original);
  assert.equal(p.drawOptions[0].backdrop, picture);
  assert.equal(p.$('race-start').disabled, false);
  assert.match(p.$('race-message').textContent, /kept/);
  assert.equal(rejected, 1);
  assert(original.snapshot.image('player.scout.compact'));
});

test('Next prepares a fresh FPV snapshot; preference changes cancel without half adoption', async (t) => {
  let hold = false,
    entered = false,
    resume;
  const pending = new Promise((resolve) => {
    resume = resolve;
  });
  const p = await setup(t, {
    beforeRequest: async ({ relative }) => {
      if (hold && relative.startsWith('runtime')) {
        entered = true;
        await pending;
      }
    },
  });
  await clearOpening(p);
  const original = p.drawOptions[0].actorAppearance,
    runs = [...p.renders],
    picture = p.drawOptions[0].backdrop;
  hold = true;
  p.$('race-journey-next').focus();
  p.$('race-journey-next').click();
  await waitFor(() => entered);
  change(p, 'race-actor-style', 'campaign');
  resume();
  await waitFor(
    () =>
      !p.$('race-picture-cancel').getClientRects().length || p.$('race-picture-cancel').disabled,
    { timeoutMs: 15000 },
  );
  p.frame(0);
  assert.deepEqual(p.renders, runs);
  assert.equal(p.drawOptions[0].actorAppearance, original);
  assert.equal(p.drawOptions[1].actorAppearance, original);
  assert.equal(p.drawOptions[0].backdrop, picture);
});

test('Classic Base menu race adopts Campaign on fresh Start without modifying the world', async (t) => {
  const p = await setup(t, { classic: true });
  assert.equal(p.$('race-start').disabled, false, p.$('race-message').textContent);
  const theme = p.$('race-theme').value;
  assert.equal(p.drawOptions[0].actorAppearance.style, 'fpv');
  change(p, 'race-actor-style', 'campaign');
  await start(p);
  assert.equal(p.$('race-theme').value, theme);
  assert.deepEqual(p.drawOptions[0].actorAppearance, { style: 'campaign', snapshot: null });
  assert.equal(p.drawOptions[0].actorAppearance, p.drawOptions[1].actorAppearance);
});

test('ready setup changes release their temporary focus observers without starting either board', async (t) => {
  const p = await setup(t);
  change(p, 'race-actor-style', 'campaign');
  const counts = () => [
    p.doc.listeners.get('focusin')?.size ?? 0,
    p.doc.listeners.get('visibilitychange')?.size ?? 0,
    p.win.listeners.get('blur')?.size ?? 0,
  ];
  const initial = counts();
  for (const value of ['first-to-two', 'single']) {
    await change(p, 'race-format', value);
    p.frame(0);
    assert.equal(p.state(), 'ready');
    assert.deepEqual(counts(), initial);
    assert.equal(p.drawOptions[0].actorAppearance, p.drawOptions[1].actorAppearance);
  }
});

async function installedFixture({ custom = false } = {}) {
  const source = JSON.parse(
    await readFile(new URL('../content/packs/night-shift.json', import.meta.url)),
  );
  if (custom) source.description += ' Player-authored variation.';
  const database = managedIndexedDB();
  const db = await new Promise((resolve, reject) => {
    const request = database.indexedDB.open('revealline-assets-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('assets');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise((resolve, reject) => {
    const tx = db.transaction('assets', 'readwrite');
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
    tx.objectStore('assets').put(
      JSON.stringify({ format: 'xonix-pack-library.v1', packs: [source] }),
      'revealline.packs.dev.v1',
    );
  });
  db.close();
  const databases = new Map([['revealline-assets-v1', database]]);
  const indexedDB = {
    open(name, ...args) {
      if (!databases.has(name)) databases.set(name, managedIndexedDB());
      return databases.get(name).indexedDB.open(name, ...args);
    },
  };
  return {
    database,
    indexedDB,
    source,
    locks: { request: async (_name, _options, action) => action({}) },
  };
}

test('installed actor owner exposes only an exact current prepared entry and pack', async (t) => {
  const f = await installedFixture();
  const reader = createCouchInstalledChapters({
    channel: 'dev',
    registeredEntries: [],
    indexedDB: f.indexedDB,
    storage: memoryStorage(),
    lockManager: f.locks,
  });
  t.after(() => reader.dispose());
  const rows = await reader.refresh();
  assert.equal(rows.length, f.source.campaigns[0].levels.length);
  const owned = reader.presentationOwner(rows[0]);
  assert(Object.isFrozen(owned));
  assert(Object.isFrozen(owned.pack));
  assert.equal(owned.entry.campaign.levels[0], rows[0].level);
  const index = JSON.parse(
    await readFile(new URL('../content/mission-library-index.json', import.meta.url)),
  );
  const original = index.missions.find(
    (row) => row.packId === owned.pack.id && row.levelId === rows[0].level.id,
  );
  assert(await verifyIndexedInstalledPack(owned.pack, original));
  assert.throws(() => reader.presentationOwner({ ...rows[0] }), /current installed/);
  await reader.refresh();
  assert.throws(() => reader.presentationOwner(rows[0]), /current installed/);
});

for (const custom of [false, true])
  test(`installed ${custom ? 'same-ID modified Custom' : 'exact indexed Classic'} uses ${custom ? 'authored' : 'FPV'} actors`, async (t) => {
    const f = await installedFixture({ custom });
    const p = await setup(t, { classic: true, assetDatabase: f.indexedDB, lockManager: f.locks });
    const option = p.$('race-level').options.find((row) => row.value.startsWith('installed/'));
    assert(option, p.$('race-message').textContent);
    await change(p, 'race-level', option.value);
    p.frame(0);
    assert.equal(p.$('race-start').disabled, false, p.$('race-message').textContent);
    assert.equal(p.renders[0].levelId, f.source.campaigns[0].levels[0].id);
    assert.equal(p.drawOptions[0].actorAppearance?.style ?? null, custom ? null : 'fpv');
    assert.equal(p.drawOptions[0].actorAppearance, p.drawOptions[1].actorAppearance);
  });

test('cold same-ID Custom stays playable with authored actors when optional index authority is offline', async (t) => {
  const f = await installedFixture({ custom: true });
  let refused = 0;
  const p = await setup(t, {
    classic: true,
    assetDatabase: f.indexedDB,
    lockManager: f.locks,
    fetchResponse: async (path) => {
      if (path === '../content/mission-library-index.json') {
        refused++;
        return new Response('', { status: 503 });
      }
      if (path === '../content/packs/fpv-arcade-r5.json') return new Response('', { status: 503 });
    },
  });
  const option = p.$('race-level').options.find((row) => row.value.startsWith('installed/'));
  const actorRequests = p.transport.requests.length;
  await change(p, 'race-level', option.value);
  p.frame(0);
  assert.equal(refused, 1);
  assert.equal(p.renders[0].levelId, f.source.campaigns[0].levels[0].id);
  assert.equal(p.drawOptions[0].actorAppearance, null);
  assert.equal(p.drawOptions[1].actorAppearance, null);
  assert.match(
    p.$('race-actor-style-status').textContent,
    /eligibility could not be checked.*authored actors are kept/,
  );
  assert.equal(
    p.transport.requests.length,
    actorRequests,
    'Unknown authority never acquires FPV assets.',
  );
  await start(p);
  assert.equal(p.state(), 'running');
});
