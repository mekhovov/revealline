import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { couchPage } from './helpers/couch-host.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

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

test('material successor Solo earns the same exact clear and continues with its theme and isolated save slot', async (t) => {
  const storage = memoryStorage();
  const p = await soloPage(t, {
    search: '?journey=whole-originals-v4',
    titleScreen: true,
    storage,
    journeyIndexedDB: managedIndexedDB().indexedDB,
    pictures: { Image: Picture },
    fetchResponse,
  });
  p.$('shell-featured').click();
  await settle(() => {
    p.frame(0);
    return p.doc.body.dataset.flightState === 'running';
  });
  assert.equal(p.$('theme-select').value, 'horizon-actors-v1');
  const expected = createRun(p.rendered.run.level, { seed: 1, classId: 'scout' });
  p.key('ArrowDown');
  p.key('ArrowDown', false);
  for (let i = 0; i < 414; i++) {
    p.frame();
    stepRun(expected, { direction: 'down' }, FIXED_DT);
  }
  assert.equal(p.rendered.run.status, 'won');
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), authoritativeCheckpoint(expected));
  p.$('next-button').click();
  await settle(() => {
    p.frame(0);
    return (
      p.rendered.run.levelId === 'choose-your-share' && p.doc.body.dataset.flightState === 'running'
    );
  });
  assert.equal(p.$('theme-select').value, 'horizon-actors-v1');
  assert.equal(p.$('journey-chooser').open, false);
  p.$('shell-menu').click();
  p.frame(0);
  assert(storage.getItem('revealline.suspended.journey-whole-originals.v4'));
  assert.equal(storage.getItem('revealline.suspended.journey-whole-originals.v3'), null);
  assert.deepEqual(p.errors, []);
});

test('material successor Versus keeps equal authored boards, direct Next and its explicit mode destination', async (t) => {
  const p = await couchPage(t, {
    href: 'http://localhost/game/couch/?journey=whole-originals-v4',
    initialLevel: null,
    storage: memoryStorage(),
    assetDatabase: managedIndexedDB().indexedDB,
    fetchResponse,
  });
  p.$('race-start').click();
  await settle(() => {
    p.frame(0);
    return !p.$('race-pause').disabled;
  });
  assert.equal(p.$('race-theme').value, 'horizon-actors-v1');
  p.key('KeyS');
  p.key('ArrowDown');
  for (let i = 0; i < 1000 && p.renders[0].status !== 'won'; i++) p.frame();
  p.key('KeyS', false);
  p.key('ArrowDown', false);
  assert.equal(p.renders[0].status, 'won');
  assert.equal(p.renders[1].status, 'won');
  assert.deepEqual(authoritativeCheckpoint(p.renders[0]), authoritativeCheckpoint(p.renders[1]));
  p.$('race-journey-next').click();
  await settle(() => {
    p.frame(0);
    return p.renders[0].levelId === 'choose-your-share';
  });
  assert.equal(p.renders[1].levelId, 'choose-your-share');
  assert.equal(p.$('race-theme').value, 'horizon-actors-v1');
  assert.equal(p.$('race-solo-return').getAttribute('href'), '../?journey=whole-originals-v4');
});
