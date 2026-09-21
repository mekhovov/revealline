import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { couchPage } from './helpers/couch-host.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { playKeyboardRoute } from './helpers/keyboard-route.mjs';
import { createJourneyBackend } from '../journey/profile.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { foundationCompatibleView } from '../ui/foundation-view.mjs';

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
const fetchResponse = async (path) =>
  String(path).includes('/content-design/assets/') ? new Response(await readFile(path)) : undefined;
const arrows = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
const wasd = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' };
const inputs = JSON.parse(
  await readFile(new URL('./fixtures/timed-taking-routes.json', import.meta.url)),
).rows;
const pins = JSON.parse(
  await readFile(new URL('./fixtures/trail-aware-taking.json', import.meta.url)),
).rows;
const key = (r) => [r.policy, r.id, r.difficulty, r.turnPolicy, r.seed, r.purpose].join('/');
const selected = inputs.find(
  (r) =>
    r.policy === 'v2' &&
    r.id === 'behind-the-patrol' &&
    r.difficulty === 'standard' &&
    r.turnPolicy === 'immediate' &&
    r.seed === 1 &&
    r.purpose === 'ordinary',
);
const row = { ...selected, checkpoint: pins.find((r) => r.key === key(selected)).checkpoint };
const runningSolo = (p, id) =>
  settle(() => {
    p.frame(0);
    return p.doc.body.dataset.flightState === 'running' && p.rendered.run.levelId === id;
  });
const runningRace = (p, id) =>
  settle(() => {
    p.frame(0);
    return p.renders[0]?.levelId === id && !p.$('race-pause').disabled;
  });
const choose = (p, button) => {
  p.$(button).click();
  const card = p
    .$('journey-cards')
    .children.find((n) => n.dataset.missionId.endsWith('/behind-the-patrol'));
  assert(card);
  card.click();
  return card.dataset.missionId;
};
async function waitForReceipt(backend, mode, id) {
  let persisted = false;
  await settle(() => {
    void backend.read().then((p) => {
      persisted = !!p.clears[mode][id];
    });
    return persisted;
  });
}

test('actual timed Solo collection/clear records only v3 and Next preserves direct campaign flow', async (t) => {
  const disk = managedIndexedDB();
  const backend = createJourneyBackend({ ...disk, profileKey: 'journey-whole-spatial-v3' });
  const p = await soloPage(t, {
    search: '?journey=whole-spatial-v3',
    titleScreen: true,
    storage: memoryStorage(),
    journeyIndexedDB: disk.indexedDB,
    pictures: { Image: Picture },
    fetchResponse,
  });
  const id = choose(p, 'shell-packs');
  await runningSolo(p, row.id);
  assert.equal(p.rendered.run.level.classic.timedBonuses.version, 'timed-bonuses.v2');
  assert.equal(p.$('theme-select').value, 'border-bloom-actors-v1');
  playKeyboardRoute(p, () => [p.rendered.run], [arrows], row);
  assert.equal(p.rendered.run.classic.timedBonuses.schedules[0].collections, 1);
  await waitForReceipt(backend, 'solo', id);
  p.$('next-button').click();
  await runningSolo(p, 'second-landing');
  assert.equal(p.$('journey-chooser').open, false);
  assert.equal(p.rendered.run.player.speed, 0);
  assert.equal(p.rendered.run.classic.timedBonuses.schedules[0].collections, 0);
  assert.deepEqual(Object.keys((await backend.read()).clears.solo), [id]);
  assert.deepEqual(
    Object.keys(
      (await createJourneyBackend({ ...disk, profileKey: 'journey-whole-spatial-v2' }).read())
        .clears.solo,
    ),
    [],
  );
  assert.deepEqual(p.errors, []);
});

test('actual timed Versus taking path keeps independently owned bonuses and equal final checkpoints', async (t) => {
  const disk = managedIndexedDB();
  const backend = createJourneyBackend({ ...disk, profileKey: 'journey-whole-spatial-v3' });
  const p = await couchPage(t, {
    href: 'http://localhost/game/couch/?journey=whole-spatial-v3',
    initialLevel: null,
    storage: memoryStorage(),
    assetDatabase: disk.indexedDB,
    fetchResponse,
  });
  const id = choose(p, 'race-journey-find');
  await runningRace(p, row.id);
  assert.notEqual(p.renders[0].classic.timedBonuses, p.renders[1].classic.timedBonuses);
  playKeyboardRoute(p, () => p.renders, [wasd, arrows], row);
  assert(p.renders.every((r) => r.classic.timedBonuses.schedules[0].collections === 1));
  await waitForReceipt(backend, 'versus', id);
  p.$('race-journey-next').click();
  await runningRace(p, 'second-landing');
  assert(p.renders.every((r) => r.classic.timedBonuses.schedules[0].collections === 0));
  assert.equal(p.$('journey-chooser').open, false);
  const profile = await backend.read();
  assert.deepEqual(Object.keys(profile.clears.versus), [id]);
  assert.deepEqual(Object.keys(profile.clears.solo), []);
});

test('v3 saved visible window resumes exactly, pauses its countdown and later expires without a grant', async (t) => {
  const disk = managedIndexedDB(),
    storage = memoryStorage();
  const options = {
    search: '?journey=whole-spatial-v3',
    titleScreen: true,
    storage,
    journeyIndexedDB: disk.indexedDB,
    pictures: { Image: Picture },
    fetchResponse,
  };
  let checkpoint, bonus;
  await t.test('save an available window through the actual menu action', async (t) => {
    const p = await soloPage(t, options);
    choose(p, 'shell-packs');
    await runningSolo(p, row.id);
    const run = p.rendered.run;
    for (let i = 0; i < 300 && run.classic.timedBonuses.schedules[0].phase !== 'available'; i++)
      p.frame(50);
    assert.equal(run.classic.timedBonuses.schedules[0].phase, 'available');
    assert.equal(foundationCompatibleView(run).powerups.filter((b) => b.timed).length, 1);
    p.$('shell-menu').click();
    p.frame(0);
    checkpoint = authoritativeCheckpoint(run);
    bonus = structuredClone(run.classic.timedBonuses);
    assert(storage.getItem('revealline.suspended.journey-whole-spatial.v3'));
    assert.equal(storage.getItem('revealline.suspended.journey-whole-spatial.v2'), null);
  });
  await t.test(
    'one Continue preserves exact schedule, pause freezes it, then expiry is contact-free',
    async (t) => {
      const p = await soloPage(t, options);
      p.$('shell-continue').click();
      await runningSolo(p, row.id);
      const run = p.rendered.run;
      assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
      p.$('pause-button').click();
      for (let i = 0; i < 50; i++) p.frame(50);
      assert.deepEqual(run.classic.timedBonuses, bonus);
      p.$('start-button').click();
      await runningSolo(p, row.id);
      for (let i = 0; i < 300 && run.classic.timedBonuses.schedules[0].phase === 'available'; i++)
        p.frame(50);
      assert.equal(run.classic.timedBonuses.schedules[0].phase, 'cooldown');
      assert.equal(run.classic.timedBonuses.schedules[0].collections, 0);
      assert.equal(foundationCompatibleView(run).powerups.filter((b) => b.timed).length, 0);
      assert.deepEqual(p.errors, []);
    },
  );
});
