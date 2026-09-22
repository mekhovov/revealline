import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { couchPage } from './helpers/couch-host.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { playKeyboardRoute } from './helpers/keyboard-route.mjs';
import { VARIETY_ROUTES } from './helpers/variety-routes.mjs';
import { createJourneyBackend } from '../journey/profile.mjs';
import { createWholeSortingCandidates } from '../content-design/whole-spatial-candidates.mjs';
import { createSpatialBalanceCandidates } from '../content-design/spatial-balance-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

// Real registered bytes and public keyboard commands, with finite DOM/decoder
// boundaries. These checks do not certify native artwork or physical devices.
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
const arrows = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
const wasd = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' };
const assets = async (path) =>
  String(path).includes('/content-design/assets/') ? new Response(await readFile(path)) : undefined;
const current = compileContentProject(createWholeSortingCandidates({ artwork: true }));
const greybox = compileContentProject(createSpatialBalanceCandidates());
const finale = JSON.parse(
  await readFile(new URL('./fixtures/apex-field-clear-routes.json', import.meta.url)),
).rows.find((row) => row.difficulty === 'standard' && row.turnPolicy === 'immediate');

function optionalRecording(id) {
  const row = VARIETY_ROUTES.find(
    (item) => item.id === id && item.difficulty === 'standard' && item.turnPolicy === 'immediate',
  );
  const references = [current, greybox].map((project) =>
    createRun(resolveMission(project, id).level, {
      seed: row.seed,
      classId: 'scout',
      turnPolicy: row.turnPolicy,
    }),
  );
  for (const [direction, ticks] of row.segments)
    for (let tick = 0; tick < ticks; tick++)
      for (const run of references) stepRun(run, { direction }, FIXED_DT);
  assert(references.every((run) => run.status === 'won' && run.classic.livesLost === 0));
  assert.equal(authoritativeCheckpoint(references[1]).hash, row.greyboxCheckpoint);
  return {
    ...row,
    segments: row.segments.map(([direction, ticks]) => ({ direction, ticks })),
    checkpoint: authoritativeCheckpoint(references[0]).hash,
  };
}

for (const mode of ['solo', 'versus'])
  for (const ending of ['optional', 'core'])
    test(`default v5 ${mode} ${ending} ending retains its earned run and offers a deliberate next destination`, async (t) => {
      const memory = managedIndexedDB();
      const backend = createJourneyBackend({ ...memory, profileKey: 'journey-whole-spatial-v5' });
      const oldBackend = createJourneyBackend({
        ...memory,
        profileKey: 'journey-whole-spatial-v4',
      });
      const beforeOld = await oldBackend.read();
      const p =
        mode === 'solo'
          ? await soloPage(t, {
              search: '',
              titleScreen: true,
              storage: memoryStorage(),
              journeyIndexedDB: memory.indexedDB,
              pictures: { Image: Picture },
              fetchResponse: assets,
            })
          : await couchPage(t, {
              href: 'http://localhost/game/couch/',
              initialLevel: null,
              storage: memoryStorage(),
              assetDatabase: memory.indexedDB,
              fetchResponse: assets,
            });
      const id =
        ending === 'core'
          ? 'home-signal'
          : mode === 'solo'
            ? 'dnipro-crossings'
            : 'toolbench-weave';
      const runs = () => (mode === 'solo' ? [p.rendered.run] : p.renders);
      p.$(mode === 'solo' ? 'shell-packs' : 'race-journey-find').click();
      assert.equal(p.$('journey-cards').children.length, 91);
      const card = p
        .$('journey-cards')
        .children.find((node) => node.dataset.missionId.endsWith('/' + id));
      assert(card);
      const missionId = card.dataset.missionId;
      card.click();
      await settle(() => {
        p.frame(0);
        return (
          runs()[0].levelId === id &&
          (mode === 'solo'
            ? p.doc.body.dataset.flightState === 'running'
            : !p.$('race-pause').disabled)
        );
      });
      assert.equal(p.$('journey-chooser').open, false);
      playKeyboardRoute(
        p,
        runs,
        mode === 'solo' ? [arrows] : [wasd, arrows],
        ending === 'core' ? finale : optionalRecording(id),
      );
      let persisted;
      await settle(() => {
        void backend.read().then((value) => {
          if (value.clears[mode][missionId]) persisted = value;
        });
        return !!persisted;
      });
      assert(runs().every((run) => run.status === 'won'));
      assert.deepEqual(Object.keys(persisted.clears[mode]), [missionId]);
      assert.deepEqual(persisted.clears[mode === 'solo' ? 'versus' : 'solo'], {});
      assert.deepEqual(persisted.skipped[mode], []);
      const previous = [...runs()];
      const pictures =
        mode === 'solo' ? [p.rendered.backdrop] : p.drawOptions.map((o) => o.backdrop);
      if (mode === 'solo') {
        assert.match(
          p.$('next-button').textContent,
          ending === 'core' ? /Journey complete/ : /End of sequence/,
        );
        p.$('next-button').click();
      } else {
        assert.equal(p.$('race-journey-next').hidden, true);
        assert.match(p.$('race-message').textContent, /Find missions.*Rematch/);
        assert.match(
          p.$('race-message').textContent,
          ending === 'core' ? /End of the main Journey/ : /End of this optional sequence/,
        );
        assert.doesNotMatch(p.$('race-message').textContent, /test route/);
        assert.match(p.$('race-start').textContent, /Rematch/);
        p.$('race-journey-find').click();
      }
      assert.equal(p.$('journey-chooser').open, true);
      p.frame(0);
      assert(runs().every((run, index) => run === previous[index]));
      const currentPictures =
        mode === 'solo' ? [p.rendered.backdrop] : p.drawOptions.map((o) => o.backdrop);
      assert(currentPictures.every((picture, index) => picture === pictures[index]));
      if (mode === 'versus') {
        p.$('journey-back').click();
        p.$('race-start').click();
        await settle(() => {
          p.frame(0);
          return p.renders[0] !== previous[0] && !p.$('race-pause').disabled;
        });
        assert(p.renders.every((run, index) => run !== previous[index] && run.levelId === id));
        assert.equal(p.drawOptions[0].backdrop === p.drawOptions[1].backdrop, true);
        assert.deepEqual(p.drawOptions[0].backdrop.assetRevision, pictures[0].assetRevision);
        assert.deepEqual((await backend.read()).clears.versus, persisted.clears.versus);
      }
      assert.deepEqual(await oldBackend.read(), beforeOld);
      if (mode === 'solo') assert.deepEqual(p.errors, []);
    });
