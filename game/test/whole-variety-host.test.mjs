import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { couchPage } from './helpers/couch-host.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { playKeyboardRoute } from './helpers/keyboard-route.mjs';
import { VARIETY_ARCS, VARIETY_ROUTES } from './helpers/variety-routes.mjs';
import { createJourneyBackend } from '../journey/profile.mjs';
import { createCulturalWorkshopArtCandidates } from '../content-design/cultural-workshop-art-candidates.mjs';
import { createSpatialBalanceCandidates } from '../content-design/spatial-balance-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT, CLASSES } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { chooseJourneyMission, openMissionLibrary } from './helpers/library-selection.mjs';
import { expectedRouteEvidence } from './helpers/route-evidence.mjs';
import { createWholeVarietyCandidates } from '../content-design/whole-spatial-candidates.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { dataIdentity } from '../data-json.mjs';

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
const pictured = compileContentProject(createCulturalWorkshopArtCandidates({ spatial: true }));
const greybox = compileContentProject(createSpatialBalanceCandidates());
const current = compileContentProject(createWholeVarietyCandidates({ artwork: true }));
const tuned = JSON.parse(
  await readFile(new URL('./fixtures/whole-variety-tuned-host-routes.json', import.meta.url)),
);
const endings = JSON.parse(
  await readFile(new URL('./fixtures/default-journey-tuned-endings.json', import.meta.url)),
);

// Derive the pictured checksum independently from the isolated donor, proving the
// original greybox golden first. No generated fixture or host-state injection.
function historicalRecording(id) {
  const row = VARIETY_ROUTES.find(
    (r) => r.id === id && r.difficulty === 'standard' && r.turnPolicy === 'immediate',
  );
  const runs = [pictured, greybox].map((project) =>
    createRun(resolveMission(project, id, { difficulty: row.difficulty }).level, {
      seed: row.seed,
      classId: 'scout',
      turnPolicy: row.turnPolicy,
    }),
  );
  for (const [direction, ticks] of row.segments)
    for (let i = 0; i < ticks; i++) for (const run of runs) stepRun(run, { direction }, FIXED_DT);
  assert(runs.every((r) => r.status === 'won' && r.classic.livesLost === 0));
  assert.equal(authoritativeCheckpoint(runs[1]).hash, row.greyboxCheckpoint);
  return {
    ...row,
    segments: row.segments.map(([direction, ticks]) => ({ direction, ticks })),
    checkpoint: authoritativeCheckpoint(runs[0]).hash,
  };
}
const running = (p, mode, id) =>
  settle(() => {
    p.frame(0);
    return mode === 'solo'
      ? p.doc.body.dataset.flightState === 'running' && p.rendered.run.levelId === id
      : p.renders[0]?.levelId === id && !p.$('race-pause').disabled;
  });
const controls = (mode) => (mode === 'solo' ? [arrows] : [wasd, arrows]);
const runs = (p, mode) => (mode === 'solo' ? [p.rendered.run] : p.renders);
const findButton = (mode) => (mode === 'solo' ? 'shell-packs' : 'race-journey-find');
const nextButton = (mode) => (mode === 'solo' ? 'next-button' : 'race-journey-next');
const skipButton = (mode) => (mode === 'solo' ? 'journey-skip' : 'race-journey-skip');
const choose = (p, mode, id) => chooseJourneyMission(p, findButton(mode), 'whole-spatial-v4', id);
async function page(t, mode, disk, extra = {}) {
  return mode === 'solo'
    ? soloPage(t, {
        search: '?journey=whole-spatial-v4',
        titleScreen: true,
        storage: memoryStorage(),
        journeyIndexedDB: disk.indexedDB,
        pictures: { Image: Picture },
        fetchResponse,
        ...extra,
      })
    : couchPage(t, {
        href: 'http://localhost/game/couch/?journey=whole-spatial-v4',
        initialLevel: null,
        storage: memoryStorage(),
        assetDatabase: disk.indexedDB,
        fetchResponse,
        ...extra,
      });
}
async function waitFor(backend, predicate) {
  let done = false;
  await settle(() => {
    void backend.read().then((p) => {
      done = predicate(p);
    });
    return done;
  });
}

for (const [mode, arc] of [
  ['solo', VARIETY_ARCS[0]],
  ['versus', VARIETY_ARCS[1]],
])
  test(`actual ${mode} completes four optional missions with direct Next and a voluntary ending`, async (t) => {
    const disk = managedIndexedDB();
    const backend = createJourneyBackend({ ...disk, profileKey: 'journey-whole-spatial-v4' });
    const p = await page(t, mode, disk);
    const first = await choose(p, mode, arc[0]);
    const prefix = first.slice(0, first.lastIndexOf('/') + 1);
    for (const [index, id] of arc.entries()) {
      await running(p, mode, id);
      assert.equal(p.$('journey-chooser').open, false);
      for (const run of runs(p, mode)) assert.equal(run.player.speed, 0);
      historicalRecording(id);
      const manifest = resolveMission(current, id);
      const level = applyGameplayTuning(manifest.level, resolveGameplayTuning('standard'));
      const fresh = tuned.rows.find((r) => r.id === id) ?? endings.rows.find((r) => r.id === id);
      assert.equal(manifest.simulationIdentity, fresh.authoredIdentity);
      for (const run of runs(p, mode)) {
        assert.deepEqual(run.level, level);
        assert.equal(
          dataIdentity({ ruleset: run.ruleset, level, classes: CLASSES }),
          fresh.gameplayIdentity,
        );
      }
      const pictures =
        mode === 'solo' ? [p.rendered.backdrop] : p.drawOptions.map((o) => o.backdrop);
      assert(
        pictures.every((picture) => picture.assetRevision.sha256 === manifest.background.sha256),
      );
      playKeyboardRoute(p, () => runs(p, mode), controls(mode), {
        ...fresh,
        evidence: expectedRouteEvidence(
          tuned.rows.some((row) => row.id === id) ? tuned.routeEvidence : endings.evidence,
          id,
        ),
      });
      await waitFor(backend, (profile) => !!profile.clears[mode][prefix + id]);
      if (index < arc.length - 1) p.$(nextButton(mode)).click();
    }
    const prior = [...runs(p, mode)];
    if (mode === 'solo') {
      assert.match(p.$('next-button').textContent, /Browse missions/);
      p.$('next-button').click();
      await settle(() => p.$('journey-chooser')?.open && p.$('journey-collection'));
    } else {
      assert.equal(p.$('race-journey-next').hidden, false);
      assert.equal(p.$('race-journey-next').textContent, 'Browse missions');
      assert.match(p.$('race-message').textContent, /End of this optional sequence/);
      assert.match(p.$('race-start').textContent, /Rematch/);
      await openMissionLibrary(p, 'race-journey-find');
    }
    assert.equal(p.$('journey-chooser').open, true);
    p.frame(0);
    for (const [index, run] of runs(p, mode).entries()) assert.equal(run, prior[index]);
    const profile = await backend.read();
    assert.deepEqual(Object.keys(profile.clears[mode]).sort(), arc.map((id) => prefix + id).sort());
    assert.deepEqual(profile.skipped[mode], []);
    assert.deepEqual(Object.keys(profile.clears[mode === 'solo' ? 'versus' : 'solo']), []);
    assert.deepEqual(
      (await createJourneyBackend({ ...disk, profileKey: 'journey-whole-spatial-v3' }).read())
        .clears[mode],
      {},
    );
    if (mode === 'solo') assert.deepEqual(p.errors, []);
  });

for (const mode of ['solo', 'versus'])
  test(`${mode} optional Skip requires confirmation, stays in sequence and cannot award a clear`, async (t) => {
    const disk = managedIndexedDB();
    const backend = createJourneyBackend({ ...disk, profileKey: 'journey-whole-spatial-v4' });
    const p = await page(t, mode, disk);
    const first = await choose(p, mode, 'cross-stitch-crossings');
    await running(p, mode, 'cross-stitch-crossings');
    p.$(skipButton(mode)).click();
    assert.equal(runs(p, mode)[0].levelId, 'cross-stitch-crossings');
    p.$(skipButton(mode)).click();
    await running(p, mode, 'rushnyk-bands');
    await waitFor(backend, (profile) => profile.skipped[mode].includes(first));
    const profile = await backend.read();
    assert.deepEqual(profile.skipped[mode], [first]);
    assert.deepEqual(profile.clears[mode], {});
    assert.match(profile.cursors[mode], /rushnyk-bands$/);
  });

test('a manually selected last optional race that both pilots lose never claims sequence completion', async (t) => {
  const disk = managedIndexedDB();
  const backend = createJourneyBackend({ ...disk, profileKey: 'journey-whole-spatial-v4' });
  const p = await page(t, 'versus', disk);
  await choose(p, 'versus', 'toolbench-weave');
  await running(p, 'versus', 'toolbench-weave');
  // Deliberately reverse through an unfinished line using actual fresh keys.
  // Do not mutate lives, match status, positions or the completion store.
  for (let cycle = 0; cycle < 20 && p.renders.some((r) => r.status !== 'lost'); cycle++) {
    for (const direction of ['down', 'up']) {
      for (const keys of [wasd, arrows]) p.key(keys[direction]);
      for (let frame = 0; frame < 12; frame++) p.frame(50);
      for (const keys of [wasd, arrows]) p.key(keys[direction], false);
    }
  }
  assert(p.renders.every((r) => r.status === 'lost'));
  assert.match(p.$('race-message').textContent, /End of this optional sequence/);
  assert.doesNotMatch(p.$('race-message').textContent, /sequence complete/i);
  assert.equal(p.$('race-journey-next').hidden, false);
  assert.equal(p.$('race-journey-next').textContent, 'Browse missions');
  assert.deepEqual((await backend.read()).clears.versus, {});
});

test('original themes are opt-in and independently owned in the combined edition', async () => {
  const { journeyActorThemeCandidates } = await import(
    '../presentation/journey-actor-materials.mjs'
  );
  const themes = JSON.parse(
    await readFile(new URL('../content-design/themes.json', import.meta.url)),
  ).themes;
  const before = structuredClone(themes);
  const old = journeyActorThemeCandidates(themes);
  const current = journeyActorThemeCandidates(themes, { includeOriginals: true });
  assert.equal(old.length, themes.length);
  assert.equal(current.length, themes.length * 2);
  assert.deepEqual(current.slice(0, old.length), old);
  assert.deepEqual(current.slice(old.length), themes);
  current.at(-1).name = 'caller edit';
  assert.deepEqual(themes, before);
});

test('optional Solo picture failure preserves the attempt and exact menu save resumes in v4', async (t) => {
  const disk = managedIndexedDB(),
    storage = memoryStorage();
  const backend = createJourneyBackend({ ...disk, profileKey: 'journey-whole-spatial-v4' });
  let refusePicture = false,
    checkpoint;
  const extra = {
    storage,
    fetchResponse: async (path) =>
      refusePicture && String(path).endsWith('/rushnyk-bands.png')
        ? new Response('Offline test', { status: 503 })
        : fetchResponse(path),
  };
  await t.test('failed Skip cannot change the run, picture, cursor or award state', async (t) => {
    const p = await page(t, 'solo', disk, extra);
    const id = await choose(p, 'solo', 'cross-stitch-crossings');
    await running(p, 'solo', 'cross-stitch-crossings');
    await waitFor(backend, (profile) => profile.cursors.solo === id);
    const run = p.rendered.run,
      picture = p.rendered.backdrop,
      before = await backend.read();
    refusePicture = true;
    p.$('journey-skip').click();
    p.$('journey-skip').click();
    await settle(() => p.$('flight-preparation-status').dataset.state === 'error');
    p.frame(0);
    assert.equal(p.rendered.run, run);
    assert.equal(p.rendered.backdrop, picture);
    assert.deepEqual(await backend.read(), before);
    refusePicture = false;
    p.$('journey-skip').click();
    p.$('journey-skip').click();
    await running(p, 'solo', 'rushnyk-bands');
    p.key('ArrowDown');
    p.key('ArrowDown', false);
    p.frame(50);
    p.$('shell-menu').click();
    p.frame(0);
    checkpoint = authoritativeCheckpoint(p.rendered.run);
    assert(storage.getItem('revealline.suspended.journey-whole-spatial.v4'));
    assert.equal(storage.getItem('revealline.suspended.journey-whole-spatial.v3'), null);
  });
  await t.test(
    'one Continue returns to the exact optional mission and picture edition',
    async (t) => {
      const p = await page(t, 'solo', disk, extra);
      p.$('shell-continue').click();
      await running(p, 'solo', 'rushnyk-bands');
      assert.deepEqual(authoritativeCheckpoint(p.rendered.run), checkpoint);
      assert.equal(p.$('theme-select').value, 'horizon');
      assert.deepEqual((await backend.read()).clears.solo, {});
      assert.deepEqual(p.errors, []);
    },
  );
});
