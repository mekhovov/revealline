import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { couchPage } from './helpers/couch-host.mjs';
import { page as teamPage } from './helpers/coop-host.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { JOURNEY_REACTION_PREFERENCES_KEY as preferenceKey } from '../journey/reaction-preferences.mjs';

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

test('a real released Sentinel uses its caption only after victory, with exact physics and objective facts', async (t) => {
  const p = await soloPage(t, {
    search: '?journey=whole-originals-v3',
    titleScreen: true,
    storage: memoryStorage(),
    journeyIndexedDB: managedIndexedDB().indexedDB,
    pictures: { Image: Picture },
    fetchResponse,
  });
  p.$('shell-play').click();
  p.$('journey-cards')
    .children.find((card) => card.dataset.missionId.endsWith('/first-relay'))
    .click();
  await settle(() => {
    p.frame(0);
    return p.rendered.run.levelId === 'first-relay' && p.doc.body.dataset.flightState === 'running';
  });
  assert.equal(p.$('journey-reactions').hidden, true);
  const reference = createRun(p.rendered.run.level, { seed: 1, classId: 'scout' });
  const fixture = JSON.parse(
    await readFile(new URL('./fixtures/sentinel-clear-routes.json', import.meta.url)),
  );
  const row = fixture.sets
    .find((set) => set.difficulty === 'standard' && set.turnPolicy === 'immediate')
    .rows.find((row) => row[0] === 'first-relay');
  const keys = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
  for (const [direction, ticks] of row[3]) {
    if (direction) {
      p.key(keys[direction]);
      p.key(keys[direction], false);
    }
    let frames = 0;
    for (let tick = 0; tick < ticks; tick++) {
      stepRun(reference, { direction }, FIXED_DT);
      frames++;
      const closure = reference.events.some((event) => event.type === 'capture.stopped');
      if (closure || frames === 12 || tick === ticks - 1) {
        p.frame(frames * FIXED_DT * 1000);
        frames = 0;
        if (p.rendered.run.status !== 'won') assert.equal(p.$('journey-reactions').hidden, true);
        if (closure && tick < ticks - 1 && p.rendered.run.status !== 'won') {
          p.key(keys[direction]);
          p.key(keys[direction], false);
        }
      }
    }
  }
  assert.equal(p.rendered.run.status, 'won');
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), authoritativeCheckpoint(reference));
  assert.equal(p.$('journey-reactions').hidden, false);
  assert.match(p.$('journey-reactions').textContent, /^Sentinel — /);
  assert.match(p.$('overlay-copy').textContent, /captured.*points/);
  assert.equal(p.$('next-button').hidden, false);
  assert.deepEqual(p.errors, []);
});

test('Solo result has a silent optional Guide caption; changing the choice preserves result and Next', async (t) => {
  const storage = memoryStorage();
  const p = await soloPage(t, {
    search: '?journey=opening',
    titleScreen: true,
    storage,
    journeyIndexedDB: managedIndexedDB().indexedDB,
    pictures: { Image: Picture },
    fetchResponse,
  });
  assert.equal(p.$('journey-reactions').hidden, true);
  p.$('shell-featured').click();
  await settle(() => p.doc.body.dataset.flightState === 'running');
  assert.equal(p.$('journey-reactions').hidden, true);
  p.key('ArrowDown');
  p.key('ArrowDown', false);
  for (let i = 0; i < 414; i++) p.frame();
  assert.equal(p.rendered.run.status, 'won');
  assert.equal(p.$('journey-reactions').hidden, false);
  assert.match(p.$('journey-reactions').textContent, /^Guide — /);
  assert.equal(p.$('next-button').hidden, false);
  const checkpoint = authoritativeCheckpoint(p.rendered.run),
    copy = p.$('run-message').textContent;
  p.$('journey-reactions-enabled').checked = false;
  p.$('journey-reactions-enabled').emit('change');
  assert.equal(p.$('journey-reactions').hidden, true);
  assert.equal(JSON.parse(storage.getItem(preferenceKey)).enabled, false);
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), checkpoint);
  assert.equal(p.$('run-message').textContent, copy);
  p.$('next-button').click();
  await settle(() => {
    p.frame(0);
    return (
      p.rendered.run.levelId === 'choose-your-share' && p.doc.body.dataset.flightState === 'running'
    );
  });
  assert.equal(p.$('journey-reactions').hidden, true);
  assert.deepEqual(p.errors, []);
});

test('actual authored equal Versus completion uses Rival without changing race result or Next', async (t) => {
  const p = await couchPage(t, {
    href: 'http://localhost/game/couch/?journey=opening',
    initialLevel: null,
    storage: memoryStorage(),
    assetDatabase: managedIndexedDB().indexedDB,
    fetchResponse,
  });
  assert.equal(p.$('race-journey-reactions').hidden, true);
  p.$('race-start').click();
  await settle(() => {
    p.frame(0);
    return !p.$('race-pause').disabled;
  });
  p.key('KeyS');
  p.key('ArrowDown');
  for (let i = 0; i < 1000 && p.renders[0].status !== 'won'; i++) p.frame();
  p.key('KeyS', false);
  p.key('ArrowDown', false);
  assert.equal(p.renders[0].status, 'won');
  assert.equal(p.renders[1].status, 'won');
  assert.match(p.$('race-message').textContent, /Draw/);
  assert.match(p.$('race-journey-reactions').textContent, /^Rival — /);
  assert.equal(p.$('race-journey-reactions').hidden, false);
  const before = p.renders.map(authoritativeCheckpoint);
  p.$('race-journey-reactions-enabled').checked = false;
  p.$('race-journey-reactions-enabled').emit('change');
  assert.deepEqual(p.renders.map(authoritativeCheckpoint), before);
  p.$('race-journey-next').click();
  await settle(() => {
    p.frame(0);
    return p.renders[0].levelId === 'choose-your-share';
  });
  assert.equal(p.$('race-journey-reactions').hidden, true);
});

test('real authored Team victory uses Engineer and does not replace completion facts or Next', async (t) => {
  const storage = memoryStorage();
  const f = await teamPage(t, {
    href: 'http://localhost/game/couch/relay-rescue.html?journey=team-greybox',
    nativeFocus: true,
    nativeVisibility: true,
    retainInitialDifficulty: true,
    beforeImport({ install }) {
      install('localStorage', { value: storage });
    },
  });
  assert.equal(f.$('coop-journey-reactions').hidden, true);
  f.$('coop-start').focus();
  f.tap('Enter');
  f.tick(2);
  const route = JSON.parse(
    await readFile(new URL('./fixtures/team-opening-routes.json', import.meta.url)),
  ).routes.find((row) => row.missionId === 'twin-landings' && row.difficulty === 'standard');
  const keys = [
    { up: 'KeyW', right: 'KeyD', down: 'KeyS', left: 'KeyA' },
    { up: 'ArrowUp', right: 'ArrowRight', down: 'ArrowDown', left: 'ArrowLeft' },
  ];
  for (const segment of route.log) {
    for (const [seat, direction] of [segment.a, segment.b].entries())
      if (direction) f.tap(keys[seat][direction]);
    for (let tick = 0; tick < segment.ticks && f.$('coop-overlay').hidden; tick++) f.tick();
    if (!f.$('coop-overlay').hidden) break;
  }
  assert.equal(f.$('coop-overlay-kicker').textContent, 'A WORLD YOU REVEALED TOGETHER');
  assert.match(f.$('coop-overlay-copy').textContent, /Joint Cuts.*rescues/);
  assert.match(f.$('coop-journey-reactions').textContent, /^Engineer — /);
  assert.equal(f.$('coop-journey-reactions').hidden, false);
  assert.equal(f.$('coop-next').hidden, false);
  const result = f.$('coop-overlay-copy').textContent;
  f.$('coop-journey-reactions-enabled').checked = false;
  f.$('coop-journey-reactions-enabled').emit('change');
  assert.equal(f.$('coop-journey-reactions').hidden, true);
  assert.equal(f.$('coop-overlay-copy').textContent, result);
  f.$('coop-next').focus();
  f.tap('Enter');
  await settle(() => f.$('coop-overlay').hidden);
  assert.equal(f.$('coop-journey-reactions').hidden, true);
});
