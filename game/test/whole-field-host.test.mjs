import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { createJourneyBackend } from '../journey/profile.mjs';
import { playKeyboardRoute } from './helpers/keyboard-route.mjs';
import { couchPage } from './helpers/couch-host.mjs';

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
const directions = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
const wasd = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' };
const fetchResponse = async (path) =>
  String(path).includes('/content-design/assets/') ? new Response(await readFile(path)) : undefined;
const fixture = JSON.parse(
  await readFile(new URL('./fixtures/apex-field-clear-routes.json', import.meta.url)),
);
const row = fixture.rows.find(
  (item) => item.difficulty === 'standard' && item.turnPolicy === 'immediate',
);

test('actual Solo field-finale chooser, clear and voluntary ending retain the exact reviewed run', async (t) => {
  const disk = managedIndexedDB();
  const backend = createJourneyBackend({ ...disk, profileKey: 'journey-whole-spatial-v2' });
  const p = await soloPage(t, {
    search: '?journey=whole-spatial-v2',
    titleScreen: true,
    storage: memoryStorage(),
    journeyIndexedDB: disk.indexedDB,
    pictures: { Image: Picture },
    fetchResponse,
  });
  p.$('shell-packs').click();
  const card = p
    .$('journey-cards')
    .children.find((node) => node.dataset.missionId.endsWith('/home-signal'));
  assert(card);
  const missionId = card.dataset.missionId;
  card.click();
  await settle(() => {
    p.frame(0);
    return p.doc.body.dataset.flightState === 'running' && p.rendered.run.levelId === 'home-signal';
  });
  assert.equal(p.rendered.run.encounter, null);
  assert.equal(p.rendered.run.level.revision, 'home-field-2');
  assert.equal(p.$('theme-select').value, 'apex-aurora-actors-v1');
  assert.equal(p.rendered.run.tick, 0);
  assert(playKeyboardRoute(p, () => [p.rendered.run], [directions], row).freshCaptureGestures > 0);
  let persisted = false;
  await settle(() => {
    void backend.read().then((profile) => {
      persisted = !!profile.clears.solo[missionId];
    });
    return persisted;
  });
  assert.match(p.$('next-button').textContent, /Journey complete/);
  const run = p.rendered.run;
  p.$('next-button').click();
  assert.equal(p.$('journey-chooser').open, true);
  p.frame(0);
  assert.equal(p.rendered.run, run, 'No automatically assigned Remix or restart');
  const profile = await backend.read();
  assert.deepEqual(Object.keys(profile.clears.solo), [missionId]);
  assert.equal(profile.cursors.solo, missionId);
  assert.deepEqual(profile.skipped.solo, []);
  assert.deepEqual(p.errors, []);
});

test('actual Versus finale clears on equal independent boards and offers Rematch without assigning a Remix', async (t) => {
  const disk = managedIndexedDB();
  const backend = createJourneyBackend({ ...disk, profileKey: 'journey-whole-spatial-v2' });
  const p = await couchPage(t, {
    href: 'http://localhost/game/couch/?journey=whole-spatial-v2',
    initialLevel: null,
    storage: memoryStorage(),
    assetDatabase: disk.indexedDB,
    fetchResponse,
  });
  p.$('race-journey-find').click();
  const card = p
    .$('journey-cards')
    .children.find((node) => node.dataset.missionId.endsWith('/home-signal'));
  assert(card);
  const missionId = card.dataset.missionId;
  card.click();
  await settle(() => {
    p.frame(0);
    return p.renders[0]?.levelId === 'home-signal' && !p.$('race-pause').disabled;
  });
  assert.notEqual(p.renders[0], p.renders[1]);
  assert.notEqual(p.renders[0].cells, p.renders[1].cells);
  assert.equal(p.renders[0].encounter, null);
  assert.equal(p.$('race-theme').value, 'apex-aurora-actors-v1');
  assert(playKeyboardRoute(p, () => p.renders, [wasd, directions], row).freshCaptureGestures > 0);
  assert.equal(p.$('race-journey-next').hidden, true);
  assert.match(p.$('race-start').textContent, /Rematch: Home signal/);
  assert.match(p.$('race-message').textContent, /End of this test route/);
  const previous = [...p.renders];
  p.$('race-journey-find').click();
  assert.equal(p.$('journey-chooser').open, true);
  p.frame(0);
  assert.equal(p.renders[0], previous[0]);
  assert.equal(p.renders[1], previous[1]);
  let persisted = false;
  await settle(() => {
    void backend.read().then((profile) => {
      persisted = !!profile.clears.versus[missionId];
    });
    return persisted;
  });
  const profile = await backend.read();
  assert.deepEqual(Object.keys(profile.clears.versus), [missionId]);
  assert.deepEqual(Object.keys(profile.clears.solo), []);
});
