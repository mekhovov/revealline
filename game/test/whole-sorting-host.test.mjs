import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { couchPage } from './helpers/couch-host.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { playKeyboardRoute } from './helpers/keyboard-route.mjs';
import { createJourneyBackend } from '../journey/profile.mjs';
import { createWholeSortingCandidates } from '../content-design/whole-spatial-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
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
const arrows = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
const wasd = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' };
const fixture = JSON.parse(
  await readFile(new URL('./fixtures/rover-sorting-mastery-routes.json', import.meta.url)),
);
const row = fixture.rows.find((r) => r.difficulty === 'standard' && r.turnPolicy === 'immediate');
const level = resolveMission(
  compileContentProject(createWholeSortingCandidates({ artwork: true })),
  'sorting-yard',
).level;
const reference = createRun(level, {
  seed: row.seed,
  classId: 'scout',
  turnPolicy: row.turnPolicy,
});
for (const { direction, ticks } of row.segments)
  for (let i = 0; i < ticks; i++) stepRun(reference, { direction }, FIXED_DT);
assert.equal(reference.status, 'won');
assert.equal(reference.classic.livesLost, 0);
assert.equal(authoritativeCheckpoint(reference).hash, row.checkpoint);
const recording = row;
const runs = (p, mode) => (mode === 'solo' ? [p.rendered.run] : p.renders);
const ids = (mode) =>
  mode === 'solo'
    ? { find: 'shell-packs', skip: 'journey-skip', next: 'next-button' }
    : { find: 'race-journey-find', skip: 'race-journey-skip', next: 'race-journey-next' };
const running = (p, mode, id) =>
  settle(() => {
    p.frame(0);
    return mode === 'solo'
      ? p.doc.body.dataset.flightState === 'running' && p.rendered.run.levelId === id
      : p.renders[0]?.levelId === id && !p.$('race-pause').disabled;
  });
async function page(t, mode, disk, storage) {
  return mode === 'solo'
    ? soloPage(t, {
        search: '?journey=whole-spatial-v5',
        titleScreen: true,
        storage,
        journeyIndexedDB: disk.indexedDB,
        pictures: { Image: Picture },
        fetchResponse,
      })
    : couchPage(t, {
        href: 'http://localhost/game/couch/?journey=whole-spatial-v5',
        initialLevel: null,
        storage,
        assetDatabase: disk.indexedDB,
        fetchResponse,
      });
}
function choose(p, mode, id) {
  p.$(ids(mode).find).click();
  const card = p.$('journey-cards').children.find((n) => n.dataset.missionId.endsWith('/' + id));
  assert(card);
  card.click();
  return card.dataset.missionId;
}
async function profileWhen(backend, predicate) {
  let result;
  await settle(() => {
    void backend.read().then((p) => {
      if (predicate(p)) result = p;
    });
    return !!result;
  });
  return result;
}

for (const mode of ['solo', 'versus']) {
  test(`${mode} actual keyboard clear continues into Fracture without menus and preserves old progress`, async (t) => {
    const disk = managedIndexedDB(),
      storage = memoryStorage();
    const backend = createJourneyBackend({ ...disk, profileKey: 'journey-whole-spatial-v5' });
    const old = createJourneyBackend({ ...disk, profileKey: 'journey-whole-spatial-v4' });
    // Prior-edition storage fixture, not a fabricated live gameplay result.
    await old.commit([
      {
        type: 'complete',
        mode,
        missionId: 'candidate/journey-opening/prologue/first-return',
        runId: 'prior-fixture',
        gameplayId: 'prior-fixture',
        difficulty: 'standard',
      },
      { type: 'skip', mode, missionId: 'candidate/journey-opening/prologue/two-keepers' },
    ]);
    const oldBefore = await old.read();
    const p = await page(t, mode, disk, storage);
    const mission = choose(p, mode, 'sorting-yard');
    await running(p, mode, 'sorting-yard');
    assert.equal(p.$('journey-chooser').open, false);
    playKeyboardRoute(
      p,
      () => runs(p, mode),
      mode === 'solo' ? [arrows] : [wasd, arrows],
      recording,
    );
    const cleared = await profileWhen(backend, (x) => !!x.clears[mode][mission]);
    assert.deepEqual(Object.keys(cleared.clears[mode]), [mission]);
    assert.deepEqual(cleared.clears[mode === 'solo' ? 'versus' : 'solo'], {});
    p.$(ids(mode).next).click();
    await running(p, mode, 'first-fracture');
    assert.equal(p.$('journey-chooser').open, false);
    for (const run of runs(p, mode)) assert.equal(run.player.speed, 0);
    assert.deepEqual(await old.read(), oldBefore);
    if (mode === 'solo') assert.deepEqual(p.errors, []);
  });
  test(`${mode} two-action Skip crosses the same campaign boundary without awarding a clear`, async (t) => {
    const disk = managedIndexedDB(),
      backend = createJourneyBackend({ ...disk, profileKey: 'journey-whole-spatial-v5' });
    const p = await page(t, mode, disk, memoryStorage());
    const mission = choose(p, mode, 'sorting-yard');
    await running(p, mode, 'sorting-yard');
    p.$(ids(mode).skip).click();
    assert.equal(runs(p, mode)[0].levelId, 'sorting-yard');
    p.$(ids(mode).skip).click();
    await running(p, mode, 'first-fracture');
    const profile = await profileWhen(backend, (x) => x.skipped[mode].includes(mission));
    assert.deepEqual(profile.clears[mode], {});
    assert.deepEqual(profile.skipped[mode], [mission]);
    choose(p, mode, 'sorting-yard');
    await running(p, mode, 'sorting-yard');
    assert.equal(runs(p, mode)[0].coverage, 0);
  });
}
