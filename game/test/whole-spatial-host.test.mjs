import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { couchPage } from './helpers/couch-host.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { createJourneyBackend, emptyJourneyProfile } from '../journey/profile.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const first = 'candidate/journey-opening/prologue/first-return';
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
const running = (p, levelId) =>
  settle(() => {
    p.frame(0);
    return p.doc.body.dataset.flightState === 'running' && p.rendered.run.levelId === levelId;
  });

for (const revision of ['v1', 'v2']) {
  const routeId = `whole-spatial-${revision}`;
  const profileKey = `journey-whole-spatial-${revision}`;
  const sessionKey = `revealline.suspended.journey-whole-spatial.${revision}`;
  test(`${revision} spatial Solo ignores historical progress, clears and skips in its namespace, then restores exact unfinished flight`, async (t) => {
    const disk = managedIndexedDB(),
      storage = memoryStorage();
    const historical = createJourneyBackend(disk);
    const prior = await historical.commit([
      { type: 'select', mode: 'solo', missionId: first },
      {
        type: 'complete',
        mode: 'solo',
        missionId: first,
        runId: 'old',
        gameplayId: 'old',
        difficulty: 'standard',
      },
    ]);
    const backend = createJourneyBackend({ ...disk, profileKey });
    let checkpoint,
      saved,
      refusePicture = false;
    const options = {
      search: `?journey=${routeId}`,
      titleScreen: true,
      storage,
      journeyIndexedDB: disk.indexedDB,
      pictures: { Image: Picture },
      fetchResponse: async (path) =>
        refusePicture && String(path).includes('/border-r1/')
          ? new Response('Offline test', { status: 503 })
          : fetchResponse(path),
    };
    await t.test('first clear, Next, two-activation Skip, scoped save and mode link', async (t) => {
      const p = await soloPage(t, options);
      p.$('shell-featured').click();
      await running(p, 'first-return');
      assert.equal(p.$('theme-select').value, 'horizon-actors-v1');
      assert.match(p.$('overlay-difficulty').textContent, /40% faster.*15% shorter attack rests/);
      assert.match(p.$('difficulty-note').textContent, /40% faster/);
      assert.deepEqual(await backend.read(), {
        ...emptyJourneyProfile(),
        generation: 1,
        cursors: { solo: first, versus: null, team: null },
      });
      p.key('ArrowDown');
      p.key('ArrowDown', false);
      for (let i = 0; i < 1000 && p.rendered.run.status !== 'won'; i++) p.frame();
      assert.equal(p.rendered.run.status, 'won');
      assert.equal(p.$('journey-chooser').open, false);
      p.$('next-button').click();
      await running(p, 'choose-your-share');
      assert.equal(p.rendered.run.player.speed, 0);
      p.$('journey-skip').click();
      assert.equal(p.rendered.run.levelId, 'choose-your-share');
      p.$('journey-skip').click();
      await running(p, 'two-keepers');
      p.key('ArrowDown');
      for (let i = 0; i < 12; i++) p.frame();
      p.key('ArrowDown', false);
      p.$('shell-menu').click();
      p.frame(0);
      checkpoint = authoritativeCheckpoint(p.rendered.run);
      saved = storage.getItem(sessionKey);
      assert(saved);
      assert.equal(storage.getItem('revealline.suspended.journey-whole-originals.v4'), null);
      p.$('shell-title-versus').click();
      await settle(() => !p.$('mode-leave-confirm').disabled);
      assert.equal(p.$('mode-leave-dialog').open, true);
      assert.match(p.$('mode-leave-status').textContent, /saved and verified/);
      saved = storage.getItem(sessionKey);
      p.$('mode-leave-confirm').click();
      await settle(() =>
        globalThis.location.href.includes(`couch/?return=solo&journey=${routeId}`),
      );
      assert.deepEqual(p.errors, []);
    });
    await t.test('reload Continue preserves picture/material/exact runtime', async (t) => {
      const p = await soloPage(t, options);
      assert.equal(storage.getItem(sessionKey), saved);
      p.$('shell-continue').click();
      await running(p, 'two-keepers');
      assert.deepEqual(authoritativeCheckpoint(p.rendered.run), checkpoint);
      assert.equal(p.$('theme-select').value, 'horizon-actors-v1');
      assert(p.rendered.backdrop.assetRevision);
      const profile = await backend.read();
      assert.equal(Object.keys(profile.clears.solo).length, 1);
      assert.notEqual(profile.clears.solo[first].runId, 'old');
      assert.equal(profile.skipped.solo.length, 1);
      assert.match(profile.skipped.solo[0], /choose-your-share$/);
      assert.deepEqual(await historical.read(), prior);
      p.$('shell-packs').click();
      const card = p
        .$('journey-cards')
        .children.find((node) => node.dataset.missionId.endsWith('/long-way-home'));
      assert(card);
      card.click();
      await running(p, 'long-way-home');
      const previousRun = p.rendered.run,
        previousPicture = p.rendered.backdrop;
      const beforeBoundary = await backend.read();
      refusePicture = true;
      p.$('journey-skip').click();
      p.$('journey-skip').click();
      await settle(() => p.$('flight-preparation-status').dataset.state === 'error');
      p.frame(0);
      assert.equal(p.rendered.run, previousRun);
      assert.equal(p.rendered.backdrop, previousPicture);
      assert.deepEqual(
        await backend.read(),
        beforeBoundary,
        'failed preparation cannot record a skip or cursor',
      );
      refusePicture = false;
      p.$('journey-skip').click();
      p.$('journey-skip').click();
      await running(p, 'behind-the-patrol');
      assert.equal(p.$('theme-select').value, 'border-bloom-actors-v1');
      assert.equal(p.$('journey-chooser').open, false);
      assert.equal(p.rendered.run.player.speed, 0);
      assert.equal(
        Object.keys((await backend.read()).clears.solo).length,
        1,
        'cross-pack skip awards no clear',
      );
      assert.deepEqual(p.errors, []);
    });
  });

  test(`${revision} spatial Versus keeps equal owned boards, Next/Skip and matching Solo destination without legacy progress`, async (t) => {
    const disk = managedIndexedDB();
    const backend = createJourneyBackend({ ...disk, profileKey });
    const p = await couchPage(t, {
      href: `http://localhost/game/couch/?journey=${routeId}`,
      initialLevel: null,
      storage: memoryStorage(),
      assetDatabase: disk.indexedDB,
      fetchResponse,
    });
    p.$('race-start').click();
    await settle(() => {
      p.frame(0);
      return !p.$('race-pause').disabled;
    });
    assert.equal(p.$('race-theme').value, 'horizon-actors-v1');
    assert.match(p.$('race-journey-difficulty-note').textContent, /40% faster/);
    assert.notEqual(p.renders[0], p.renders[1]);
    assert.notEqual(p.renders[0].player, p.renders[1].player);
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
    p.$('race-journey-skip').click();
    assert.equal(p.renders[0].levelId, 'choose-your-share');
    p.$('race-journey-skip').click();
    await settle(() => {
      p.frame(0);
      return p.renders[0].levelId === 'two-keepers';
    });
    assert.equal(p.renders[1].levelId, 'two-keepers');
    assert.equal(p.$('race-solo-return').getAttribute('href'), `../?journey=${routeId}`);
    const profile = await backend.read();
    assert.equal(Object.keys(profile.clears.versus).length, 1);
    assert.equal(profile.skipped.versus.length, 1);
    assert.deepEqual(await createJourneyBackend(disk).read(), emptyJourneyProfile());
  });
}
