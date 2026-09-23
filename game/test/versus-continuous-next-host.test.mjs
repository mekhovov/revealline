import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { couchPage } from './helpers/couch-host.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { preparePack, installPack } from '../packs.mjs';
import { createExternalChapterHost } from '../external-chapter-host.mjs';
import { claimProfileWriter } from '../profile-writer.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { libraryMissionId } from '../mission-library/library.mjs';
import { loadAuthoredJourneyRoute } from '../content-design/route-loader.mjs';
import { createCandidateVersusHost } from '../content-design/versus-host.mjs';
import { mountPresentationPage } from '../presentation/page.mjs';

const index = JSON.parse(
  await readFile(new URL('../content/mission-library-index.json', import.meta.url)),
);
class Locks {
  async request(_name, _options, work) {
    return work({ name: _name });
  }
}
async function fixture(t, { fetchResponse, installedSource, ...options } = {}) {
  const databases = new Map(),
    values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const lockManager = new Locks(),
    assetDatabase = {
      open(name, ...args) {
        if (!databases.has(name)) databases.set(name, managedIndexedDB());
        return databases.get(name).indexedDB.open(name, ...args);
      },
    };
  if (installedSource) {
    let media;
    const { pack } = await preparePack(installedSource);
    const writer = await claimProfileWriter(lockManager, 'revealline.library.dev.v1.writer');
    const installer = createExternalChapterHost({
      indexedDB: assetDatabase,
      profileKey: 'revealline.library.dev.v1',
      packsKey: 'revealline.packs.dev.v1',
      storage,
      lockManager,
      writer,
      registeredEntries: [],
      knownDescriptors: [],
      getManagedStore: () =>
        (media ??= createManagedMediaStore({
          indexedDB: assetDatabase,
          soundtrackCatalogue: true,
        })),
    });
    const before = await installer.inspect();
    await installer.commitMutation(
      await installer.prepareMutation(before, installPack(before.packs, pack)),
    );
    installer.close();
    media?.close();
    writer.release();
  }
  return couchPage(t, {
    initialLevel: null,
    storage,
    previewStorage: storage,
    lockManager,
    assetDatabase,
    fetchResponse: async (path, request) => {
      const response = await fetchResponse?.(path, request);
      if (response !== undefined) return response;
      if (String(path).includes('/content-design/assets/'))
        return new Response(await readFile(path));
      if (String(path).includes('fpv-arcade-r5.json'))
        return new Response('Offline chapter', { status: 503 });
    },
    ...options,
  });
}
const settle = (predicate) => waitFor(predicate, { timeoutMs: 10000 });
async function start(p) {
  p.$('race-start').click();
  await settle(() => {
    p.frame(0);
    return p.state() === 'running';
  });
}
function finish(p) {
  p.renders[0].status = 'won';
  p.frame(1000 / 120);
  assert.equal(p.state(), 'finished');
  assert.equal(p.$('race-journey-next').hidden, false);
}

test('Classic Next starts the exact next mission once, retaining setup and leaving series Rematch independent', async (t) => {
  const p = await fixture(t);
  p.$('race-format').value = 'first-to-two';
  p.$('race-format').emit('change');
  await settle(() => !p.$('race-start').disabled);
  await start(p);
  finish(p);
  assert.match(p.$('race-start').textContent, /Next round/);
  p.$('race-journey-next').click();
  p.$('race-journey-next').click();
  await settle(() => {
    p.frame(0);
    return p.state() === 'running' && p.renders[0].levelId === 'signal-02';
  });
  assert.equal(p.renders[1].levelId, 'signal-02');
  assert.equal(p.$('series-score').textContent, '0 : 0');
  assert.equal(p.$('race-format').value, 'first-to-two');
  assert.equal(p.$('journey-chooser').open, false);
  finish(p);
  p.$('race-start').click();
  await settle(() => {
    p.frame(0);
    return p.state() === 'running';
  });
  assert.equal(p.renders[0].levelId, 'signal-02');
  assert.equal(p.$('series-score').textContent, '1 : 0');
});

test('Classic campaign boundary continues into exact Custom owner and ends without wrapping', async (t) => {
  const source = JSON.parse(
    await readFile(new URL('../content/packs/night-shift.json', import.meta.url)),
  );
  source.name = 'Player night shift';
  source.campaigns[0].levels = source.campaigns[0].levels.slice(0, 2);
  const p = await fixture(t, {
    initialLevel: 'signal-12',
    installedSource: source,
    fetchResponse: (path) =>
      path === '../content/mission-library-index.json'
        ? new Response(
            JSON.stringify({
              ...index,
              missions: index.missions.filter((row) => row.source === 'base'),
            }),
          )
        : undefined,
  });
  await start(p);
  finish(p);
  p.$('race-journey-next').click();
  await settle(() => {
    p.frame(0);
    return p.state() === 'running' && p.renders[0].levelId === 'night-shift-01';
  });
  assert.equal(p.renders[1].levelId, 'night-shift-01');
  assert.equal(p.$('journey-chooser').open, false);
  finish(p);
  p.$('race-journey-next').click();
  await settle(() => {
    p.frame(0);
    return p.state() === 'running' && p.renders[0].levelId === 'night-shift-02';
  });
  finish(p);
  const before = p.checkpoint(),
    picture = p.drawOptions[0].backdrop;
  p.$('race-journey-next').click();
  await settle(() => p.$('race-message').textContent.includes('Versus library complete'));
  p.frame(0);
  assert.deepEqual(p.checkpoint(), before);
  assert.equal(p.drawOptions[0].backdrop, picture);
  assert.equal(p.$('race-journey-next').hidden, true);
  assert.equal(p.doc.activeElement, p.$('race-start'));
  assert.equal(p.$('journey-chooser').open, false);
  p.$('race-start').click();
  await settle(() => {
    p.frame(0);
    return p.state() === 'running';
  });
  assert.equal(p.renders[0].levelId, 'night-shift-02');
});

test('same-ID modified Custom edition keeps its exact owner through Rematch and final Next', async (t) => {
  const source = JSON.parse(
    await readFile(new URL('../content/packs/night-shift.json', import.meta.url)),
  );
  source.name = 'Player night shift';
  const p = await fixture(t, { installedSource: source });
  p.$('race-library-switch').click();
  await settle(() => p.$('journey-chooser')?.open);
  p.$('journey-collection').value = 'Custom';
  p.$('journey-collection').emit('change');
  const card = [...p.$('journey-cards').children].find(
    (card) => JSON.parse(card.dataset.missionId)[3] === 'night-shift-03',
  );
  assert(card);
  card.click();
  await settle(() => {
    p.frame(0);
    return p.state() === 'running' && p.renders[0].levelId === 'night-shift-03';
  });
  finish(p);
  await start(p);
  finish(p);
  p.$('race-journey-next').click();
  await settle(() => p.$('race-message').textContent.includes('Versus library complete'));
  assert.equal(p.$('journey-chooser').open, false);
  assert.equal(p.renders[0].levelId, 'night-shift-03');
});

test('exact cross-host continuation restores Versus setup and difficulty before launch', async (t) => {
  const row = index.missions.find((row) => row.levelId === 'signal-02');
  const mission = libraryMissionId({
    owner: JSON.stringify(['classic', 'base', null]),
    edition: row.sourceFile.sha256,
    campaign: row.campaignKey,
    mission: row.levelId,
    revision: row.levelRevision,
  });
  const params = new URLSearchParams({
    journey: 'legacy',
    'library-mission': mission,
    'versus-next': JSON.stringify({
      mission,
      format: 'first-to-two',
      turnPolicy: 'grid-center',
      seconds: 180,
      difficulty: 'expert',
      tap: true,
      slots: [2, 0],
    }),
  });
  const pad = (index) => ({
    index,
    connected: true,
    mapping: 'standard',
    axes: [0, 0],
    buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
  });
  const p = await fixture(t, {
    href: `http://localhost/game/couch/?${params}`,
    pads: [pad(0), null, pad(2)],
  });
  p.frame(0);
  assert.equal(p.state(), 'running');
  assert.equal(p.renders[0].levelId, 'signal-02');
  assert.equal(p.renders[1].levelId, 'signal-02');
  assert.equal(p.$('race-format').value, 'first-to-two');
  assert.equal(p.$('race-turn').value, 'grid-center');
  assert.equal(p.$('race-time').value, '180');
  assert.equal(p.$('race-journey-difficulty').value, 'expert');
  assert.equal(p.$('race-tap').checked, true);
  assert.match(p.$('race-pad-status').textContent, /Player 1: pad slot 2 · Player 2: pad slot 0/);
  assert.equal(p.$('journey-chooser').open, false);
});

test('final Journey mission hands directly to exact first Classic without chooser and carries setup', async (t) => {
  const route = await loadAuthoredJourneyRoute('opening');
  const host = createCandidateVersusHost(route.source, {
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
  const params = new URLSearchParams({ journey: 'opening', 'library-mission': mission });
  const p = await fixture(t, {
    href: `http://localhost/game/couch/?${params}`,
    seconds: '180',
    turnPolicy: 'grid-center',
  });
  p.frame(0);
  assert.equal(p.state(), 'running', p.$('race-message').textContent);
  assert.equal(p.renders[0].levelId, 'horizon-remix');
  finish(p);
  const before = p.checkpoint(),
    picture = p.drawOptions[0].backdrop;
  p.$('race-journey-next').click();
  await settle(() => new URL(globalThis.location.href).searchParams.get('journey') === 'legacy');
  const destination = new URL(globalThis.location.href);
  const exact = JSON.parse(destination.searchParams.get('library-mission'));
  assert.equal(exact[0], JSON.stringify(['classic', 'base', null]));
  assert.equal(exact[3], 'signal-01');
  const settings = JSON.parse(destination.searchParams.get('versus-next'));
  assert.equal(settings.mission, destination.searchParams.get('library-mission'));
  assert.equal(settings.turnPolicy, 'grid-center');
  assert.equal(settings.seconds, 180);
  p.frame(0);
  assert.deepEqual(p.checkpoint(), before);
  assert.equal(p.drawOptions[0].backdrop, picture);
  assert.equal(p.$('journey-chooser').open, false);
});

test('failed or cancelled cross-host target picture preflight keeps Journey results before navigation', async (t) => {
  const route = await loadAuthoredJourneyRoute('opening');
  const host = createCandidateVersusHost(route.source, {
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
  const params = new URLSearchParams({ journey: 'opening', 'library-mission': mission });
  const href = `http://localhost/game/couch/?${params}`;
  const compiled = JSON.parse(
    await readFile(new URL('../presentation/compiled/runtime.json', import.meta.url)),
  );
  const snapshot = { resolved: compiled.resolved, images: new Map(), canvas: {} };
  let reads = 0,
    hold = null,
    release;
  const p = await fixture(t, {
    href,
    beforeImport({ document, window }) {
      const page = mountPresentationPage({
        document,
        window,
        createHost: () => ({
          load: async () => snapshot,
          apply() {},
          close() {},
          async readPicture(_slot, { snapshot: expected }) {
            assert.equal(expected, snapshot);
            reads++;
            if (hold) await hold;
            throw new Error('Target original is unavailable.');
          },
        }),
      });
      t.after(() => page.close());
    },
  });
  p.frame(0);
  assert.equal(p.state(), 'running', p.$('race-message').textContent);
  finish(p);
  const before = p.checkpoint(),
    picture = p.drawOptions[0].backdrop;
  p.$('race-journey-next').click();
  await settle(() => p.$('race-message').textContent.includes('Next mission could not open'));
  assert.equal(reads, 1);
  p.frame(0);
  assert.equal(globalThis.location.href, href);
  assert.deepEqual(p.checkpoint(), before);
  assert.equal(p.drawOptions[0].backdrop, picture);
  assert.equal(p.$('journey-chooser').open, false);
  hold = new Promise((resolve) => {
    release = resolve;
  });
  t.after(() => release());
  const activate = p.$('race-journey-next').onclick;
  let pending;
  p.$('race-journey-next').onclick = () => (pending = activate());
  p.$('race-journey-next').click();
  await settle(() => reads === 2);
  p.$('race-picture-cancel').click();
  release();
  await pending;
  await settle(() => !p.$('race-journey-next').disabled);
  p.frame(0);
  assert.equal(globalThis.location.href, href);
  assert.deepEqual(p.checkpoint(), before);
  assert.equal(p.drawOptions[0].backdrop, picture);
  assert.equal(picture.image.released, undefined);
  assert.match(p.$('race-message').textContent, /cancelled.*Results are kept/);
  assert.equal(p.$('journey-chooser').open, false);
});

test('Journey boundary preflights an exact installed Classic pack without adopting its boards', async (t) => {
  const route = await loadAuthoredJourneyRoute('opening');
  const host = createCandidateVersusHost(route.source, {
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
  const params = new URLSearchParams({ journey: 'opening', 'library-mission': mission });
  const installedSource = JSON.parse(
    await readFile(new URL('../content/packs/night-shift.json', import.meta.url)),
  );
  const p = await fixture(t, {
    href: `http://localhost/game/couch/?${params}`,
    installedSource,
    fetchResponse: (path) =>
      path === '../content/mission-library-index.json'
        ? new Response(
            JSON.stringify({
              ...index,
              missions: index.missions.filter((row) => row.packId === 'night-shift'),
            }),
          )
        : undefined,
  });
  p.frame(0);
  assert.equal(p.state(), 'running', p.$('race-message').textContent);
  finish(p);
  const before = p.checkpoint(),
    picture = p.drawOptions[0].backdrop;
  p.$('race-journey-next').click();
  await settle(() => new URL(globalThis.location.href).searchParams.get('journey') === 'legacy');
  const target = JSON.parse(new URL(globalThis.location.href).searchParams.get('library-mission'));
  assert.equal(target[0], JSON.stringify(['classic', 'bundled', 'night-shift']));
  assert.equal(target[3], 'night-shift-01');
  p.frame(0);
  assert.deepEqual(p.checkpoint(), before);
  assert.equal(p.drawOptions[0].backdrop, picture);
  assert.equal(p.$('journey-chooser').open, false);
});

test('boundary download failure keeps both result boards and picture with retry on Next', async (t) => {
  const p = await fixture(t, { initialLevel: 'signal-12' });
  await start(p);
  finish(p);
  const before = p.checkpoint(),
    picture = p.drawOptions[0].backdrop;
  p.$('race-journey-next').click();
  await settle(() => p.$('race-message').textContent.includes('Next mission could not open'));
  p.frame(0);
  assert.deepEqual(p.checkpoint(), before);
  assert.equal(p.drawOptions[0].backdrop, picture);
  assert.equal(p.$('journey-chooser').open, false);
  assert.equal(p.$('race-journey-next').disabled, false);
  assert.equal(p.state(), 'finished');
});

test('cancelled boundary metadata does not adopt or clear the result and Next can retry', async (t) => {
  let release,
    entered = false;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  t.after(release);
  const p = await fixture(t, {
    fetchResponse: async (path) => {
      if (path !== '../content/mission-library-index.json') return;
      entered = true;
      await gate;
      return new Response(JSON.stringify(index));
    },
  });
  await start(p);
  finish(p);
  const before = p.checkpoint(),
    picture = p.drawOptions[0].backdrop;
  p.$('race-journey-next').click();
  await settle(() => entered);
  p.$('race-picture-cancel').click();
  release();
  await settle(() => !p.$('race-journey-next').disabled);
  p.frame(0);
  assert.deepEqual(p.checkpoint(), before);
  assert.equal(p.drawOptions[0].backdrop, picture);
  assert.match(p.$('race-message').textContent, /cancelled.*Results are kept/);
  p.$('race-journey-next').click();
  await settle(() => {
    p.frame(0);
    return p.state() === 'running' && p.renders[0].levelId === 'signal-02';
  });
});
