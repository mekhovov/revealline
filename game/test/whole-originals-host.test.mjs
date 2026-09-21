import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { soloPage, settle, memoryStorage } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { createJourneyBackend } from '../journey/profile.mjs';
import { createAuthoredJourneyRoute } from '../content-design/route.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { couchPage } from './helpers/couch-host.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { createWholeJourneyCandidates } from '../content-design/whole-journey-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';

const route = createAuthoredJourneyRoute('whole-originals-v3');
// Retain original route/checkpoint evidence. Theme editions change run identity
// and result revision, not physics; never rewrite the frozen replay fixtures.
const historicalProject = compileContentProject(
  createWholeJourneyCandidates({ roverTeaching: true }),
);
const fixtures = [
  'horizon-greybox',
  'border-clear',
  'signal-clear',
  'neon-clear',
  'rover-clear',
  'fracture-clear',
  'phase-clear',
  'livewire-clear',
  'relay-clear',
  'crosswind-clear',
  'sentinel-clear',
  'apex-clear',
];
const rows = (
  await Promise.all(
    fixtures.map(async (name) => {
      const f = JSON.parse(
        await readFile(new URL(`./fixtures/${name}-routes.json`, import.meta.url)),
      );
      return (
        f.rows ??
        f.sets.find(
          (s) => s.difficulty === 'standard' && s.turnPolicy === 'immediate' && s.bonuses !== false,
        ).rows
      ).slice(0, -1);
    }),
  )
).flat();
const teaching = JSON.parse(
  await readFile(new URL('./fixtures/rover-teaching-routes.json', import.meta.url)),
).rows.filter((r) => r.difficulty === 'standard' && r.turnPolicy === 'immediate');
for (const row of teaching) {
  const index = rows.findIndex((r) => r[0] === row.missionId);
  assert(index >= 0);
  rows[index] = [row.missionId, row.simulationIdentity, row.checkpoint, row.segments];
}
const keys = { up: 'ArrowUp', right: 'ArrowRight', down: 'ArrowDown', left: 'ArrowLeft' };

// Finite decoder model reads actual hashed PNG bytes and dimensions. This is
// deliberately not claimed as native browser image decoding or visual approval.
class OriginalImage {
  releases = 0;
  set src(source) {
    this.source = source;
    const bytes = Buffer.from(source.split(',')[1], 'base64');
    this.width = this.naturalWidth = bytes.readUInt32BE(16);
    this.height = this.naturalHeight = bytes.readUInt32BE(20);
    this.sha256 = createHash('sha256').update(bytes).digest('hex');
    queueMicrotask(() => this.onload?.());
  }
  async decode() {}
  removeAttribute() {
    this.source = '';
    this.releases++;
  }
}
const running = (p, id) =>
  settle(() => {
    p.frame(0);
    return p.doc.body.dataset.flightState === 'running' && p.rendered.run.levelId === id;
  });

test('campaign presentation edition:71 real Solo host clears retain exact themes and originals across70 Next actions and a failed preload', async (t) => {
  assert.equal(rows.length, 71);
  const memory = managedIndexedDB(),
    storage = memoryStorage();
  const backend = createJourneyBackend(memory);
  let refuse = null;
  const p = await soloPage(t, {
    search: '?journey=whole-originals-v3',
    titleScreen: true,
    storage,
    journeyIndexedDB: memory.indexedDB,
    pictures: { Image: OriginalImage },
    fetchResponse: async (path) => {
      if (!String(path).includes('/content-design/assets/')) return;
      if (refuse && String(path).includes(refuse)) return new Response('Offline', { status: 503 });
      return new Response(await readFile(path));
    },
  });
  p.$('shell-featured').click();
  await running(p, rows[0][0]);
  for (const [index, [id, , checkpoint, segments]] of rows.entries()) {
    assert.equal(p.rendered.run.levelId, id);
    const mission = route.source.missions.find((m) => m.id === id);
    assert.equal(p.$('theme-select').value, mission.presentation.themeId, id);
    const asset = route.source.assets.find((a) => a.id === mission.presentation.backgroundAssetId);
    assert.equal(p.rendered.backdrop.image.sha256, asset.sha256, id);
    assert.equal(p.rendered.backdrop.image.width, asset.width, id);
    const reference = createRun(p.rendered.run.level, { seed: 1, classId: 'scout' });
    const historical = createRun(resolveMission(historicalProject, id).level, {
      seed: 1,
      classId: 'scout',
    });
    for (const [direction, ticks] of segments) {
      if (direction !== null) {
        p.key(keys[direction]);
        p.key(keys[direction], false);
      }
      let frames = 0;
      for (let tick = 0; tick < ticks; tick++) {
        stepRun(reference, { direction }, FIXED_DT);
        stepRun(historical, { direction }, FIXED_DT);
        frames++;
        const closure = reference.events.some((e) => e.type === 'capture.stopped');
        if (closure || frames === 12 || tick === ticks - 1) {
          p.frame(frames * FIXED_DT * 1000);
          frames = 0;
          if (closure && tick < ticks - 1 && p.rendered.run.status !== 'won') {
            assert.equal(p.rendered.run.player.speed, 0);
            p.key(keys[direction]);
            p.key(keys[direction], false);
          }
        }
      }
    }
    assert.equal(p.rendered.run.status, 'won', id);
    assert.equal(
      authoritativeCheckpoint(p.rendered.run).hash,
      authoritativeCheckpoint(reference).hash,
      id,
    );
    assert.equal(authoritativeCheckpoint(historical).hash, checkpoint, id);
    const oldSections = authoritativeCheckpoint(historical).sections;
    const newSections = authoritativeCheckpoint(reference).sections;
    for (const key of Object.keys(oldSections))
      if (!['identity', 'result'].includes(key))
        assert.equal(newSections[key], oldSections[key], `${id}/${key}`);
    assert.deepEqual(reference.result, { ...historical.result, revision: mission.revision });
    assert.equal(p.$('game-overlay').dataset.kind, 'won', id);
    assert.equal(p.$('journey-chooser').open, false, id);
    if (index === rows.length - 1) break;
    if (id === 'return-pocket') {
      const oldRun = p.rendered.run,
        oldPicture = p.rendered.backdrop;
      refuse = '/signal-pixel-r1/';
      p.$('next-button').click();
      await settle(() => p.$('flight-preparation-status').dataset.state === 'error');
      p.frame(0);
      assert.equal(p.rendered.run, oldRun);
      assert.equal(p.rendered.backdrop, oldPicture);
      assert.equal(oldPicture.image.releases, 0);
      refuse = null;
    }
    p.$('next-button').click();
    await running(p, rows[index + 1][0]);
    assert.equal(p.rendered.run.player.speed, 0, 'Next input is consumed');
  }
  assert.match(p.$('next-button').textContent, /Journey complete/);
  p.$('next-button').click();
  assert.equal(p.$('journey-chooser').open, true);
  assert.equal(p.$('journey-cards').children.length, 83);
  assert.equal(p.rendered.run.levelId, 'home-signal');
  let profile;
  for (let attempt = 0; attempt < 200; attempt++) {
    profile = await backend.read();
    if (Object.keys(profile.clears.solo).length === 71) break;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.equal(Object.keys(profile.clears.solo).length, 71);
  for (const key of [
    'revealline.library.dev.v1',
    'revealline.suspended.dev.v1',
    'revealline.suspended.journey-opening.v1',
    'revealline.suspended.journey-authored.v1',
    'revealline.suspended.journey-whole-originals.v1',
    'revealline.suspended.journey-whole-originals.v2',
  ])
    assert(!storage.writes.some(([written]) => written === key), key);
  assert.deepEqual(p.errors, []);
});

test('campaign presentation edition:71 real Versus races keep equal boards, exact themes and pictures through70 deliberate Next actions', async (t) => {
  const memory = managedIndexedDB(),
    storage = memoryStorage();
  const backend = createJourneyBackend(memory);
  const p = await couchPage(t, {
    href: 'http://localhost/game/couch/?journey=whole-originals-v3',
    initialLevel: null,
    assetDatabase: memory.indexedDB,
    storage,
    ImageClass: OriginalImage,
    fetchResponse: async (url) => {
      if (String(url).includes('/content-design/assets/')) return new Response(await readFile(url));
    },
  });
  p.$('race-start').click();
  await waitFor(() => {
    p.frame(0);
    return !p.$('race-pause').disabled;
  });
  const pairedKeys = {
    up: ['KeyW', 'ArrowUp'],
    down: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
  };
  const gesture = (direction) => {
    for (const key of pairedKeys[direction] ?? []) {
      p.key(key);
      p.key(key, false);
    }
  };
  for (const [index, [id, , , segments]] of rows.entries()) {
    assert.equal(p.renders[0].levelId, id);
    assert.equal(p.renders[1].levelId, id);
    const mission = route.source.missions.find((m) => m.id === id);
    assert.equal(p.$('race-theme').value, mission.presentation.themeId, id);
    const asset = route.source.assets.find((a) => a.id === mission.presentation.backgroundAssetId);
    const picture = p.drawOptions[0].backdrop;
    assert.equal(picture, p.drawOptions[1].backdrop);
    assert.equal(picture.image.sha256, asset.sha256);
    assert.equal(picture.image.width, asset.width);
    const reference = createRun(p.renders[0].level, { seed: 1, classId: 'scout' });
    // The live host consumes one neutral tick when starting a new race.
    stepRun(reference, { direction: null }, FIXED_DT);
    p.frame(FIXED_DT * 1000);
    for (const [direction, ticks] of segments) {
      gesture(direction);
      let frames = 0;
      for (let tick = 0; tick < ticks; tick++) {
        stepRun(reference, { direction }, FIXED_DT);
        frames++;
        const closure = reference.events.some((e) => e.type === 'capture.stopped');
        if (closure || frames === 12 || tick === ticks - 1) {
          p.frame(frames * FIXED_DT * 1000);
          frames = 0;
          if (closure && tick < ticks - 1 && reference.status !== 'won') gesture(direction);
        }
      }
    }
    for (const run of p.renders) {
      assert.equal(run.status, 'won', id);
      assert.equal(authoritativeCheckpoint(run).hash, authoritativeCheckpoint(reference).hash, id);
    }
    assert.equal(p.$('journey-chooser').open, false);
    assert.equal(p.drawOptions[0].backdrop, picture);
    if (index === rows.length - 1) break;
    const previous = p.renders[0];
    p.$('race-journey-next').click();
    await waitFor(() => {
      p.frame(0);
      return p.renders[0] !== previous && !p.$('race-pause').disabled;
    });
  }
  assert.equal(p.$('race-journey-next').hidden, true);
  assert.match(p.$('race-message').textContent, /End of this test route.*optional Remixes/);
  let profile;
  for (let attempt = 0; attempt < 200; attempt++) {
    profile = await backend.read();
    if (Object.keys(profile.clears.versus).length === 71) break;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.equal(Object.keys(profile.clears.versus).length, 71);
  assert.equal(Object.keys(profile.clears.solo).length, 0);
  assert.equal(Object.keys(profile.clears.team).length, 0);
});
