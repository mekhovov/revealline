import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { couchPage } from './helpers/couch-host.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { playKeyboardRoute } from './helpers/keyboard-route.mjs';
import { VARIETY_ROUTES } from './helpers/variety-routes.mjs';
import { createJourneyBackend, JOURNEY_PROFILE_DATABASE } from '../journey/profile.mjs';
import { createWholeSortingCandidates } from '../content-design/whole-spatial-candidates.mjs';
import { createSpatialBalanceCandidates } from '../content-design/spatial-balance-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT, CLASSES } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { PNGImage } from './helpers/png-image.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { dataIdentity } from '../data-json.mjs';

// Real registered bytes and public keyboard commands, with finite DOM/decoder
// boundaries. These checks do not certify native artwork or physical devices.
const arrows = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
const wasd = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' };
const assets = async (path) =>
  String(path).includes('/content-design/assets/') ? new Response(await readFile(path)) : undefined;
const current = compileContentProject(createWholeSortingCandidates({ artwork: true }));
const greybox = compileContentProject(createSpatialBalanceCandidates());
const { rows: tunedRoutes } = JSON.parse(
  await readFile(new URL('./fixtures/default-journey-tuned-endings.json', import.meta.url)),
);

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
      const databases = new Map([[JOURNEY_PROFILE_DATABASE, memory]]);
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
              pictures: { Image: PNGImage },
              fetchResponse: assets,
            })
          : await couchPage(t, {
              href: 'http://localhost/game/couch/',
              initialLevel: null,
              storage: memoryStorage(),
              assetDatabase: {
                open(name, ...args) {
                  if (!databases.has(name)) databases.set(name, managedIndexedDB());
                  return databases.get(name).indexedDB.open(name, ...args);
                },
              },
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
      await settle(() => p.$('journey-chooser')?.open && p.$('journey-collection'));
      assert.equal(p.$('journey-cards').children.length, 201);
      const card = p.$('journey-cards').children.find((node) => {
        const [owner, edition, , runtimeId] = JSON.parse(node.dataset.missionId);
        return (
          owner === 'journey:whole-spatial-v5' &&
          edition === 'whole-spatial-v5' &&
          runtimeId.endsWith('/' + id)
        );
      });
      assert(card);
      const missionId = JSON.parse(card.dataset.missionId)[3];
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
      if (ending === 'optional') optionalRecording(id); // Keep historical authored-route evidence.
      const row = tunedRoutes.find((item) => item.id === id);
      const manifest = resolveMission(current, id);
      assert.equal(manifest.simulationIdentity, row.authoredIdentity);
      const level = applyGameplayTuning(manifest.level, resolveGameplayTuning('standard'));
      for (const run of runs()) {
        assert.deepEqual(run.level, level);
        assert.equal(
          dataIdentity({ ruleset: run.ruleset, level, classes: CLASSES }),
          row.gameplayIdentity,
        );
      }
      const acceptedPictures =
        mode === 'solo' ? [p.rendered.backdrop] : p.drawOptions.map((o) => o.backdrop);
      for (const picture of acceptedPictures) {
        assert.equal(picture.kind, 'candidate-picture');
        assert.deepEqual(picture.assetRevision, manifest.background);
      }
      playKeyboardRoute(p, runs, mode === 'solo' ? [arrows] : [wasd, arrows], row);
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
      assert.equal(persisted.clears[mode][missionId].gameplayId, row.gameplayIdentity);
      assert.equal(persisted.clears[mode][missionId].difficulty, 'standard');
      assert.equal(typeof persisted.clears[mode][missionId].runId, 'string');
      const checkpoint = runs().map((run) => authoritativeCheckpoint(run));
      const previous = [...runs()];
      const pictures =
        mode === 'solo' ? [p.rendered.backdrop] : p.drawOptions.map((o) => o.backdrop);
      const endingAction = mode === 'solo' ? 'next-button' : 'race-journey-next';
      assert.equal(p.$(endingAction).hidden, false);
      assert.match(p.$(endingAction).textContent, /Browse missions/);
      if (mode === 'versus') {
        assert.match(
          p.$('race-message').textContent,
          ending === 'core'
            ? /End of the main Journey.*Browse missions.*Rematch/
            : /End of this optional sequence.*Browse missions.*Rematch/,
        );
        assert.doesNotMatch(p.$('race-message').textContent, /test route/);
        assert.match(p.$('race-start').textContent, /Rematch/);
      }
      p.$(endingAction).focus();
      p.$(endingAction).click();
      await settle(() => p.$('journey-chooser')?.open && p.$('journey-collection'));
      assert.equal(p.$('journey-chooser').open, true);
      p.frame(0);
      assert(runs().every((run, index) => run === previous[index]));
      const currentPictures =
        mode === 'solo' ? [p.rendered.backdrop] : p.drawOptions.map((o) => o.backdrop);
      assert(currentPictures.every((picture, index) => picture === pictures[index]));
      assert.deepEqual(
        runs().map((run) => authoritativeCheckpoint(run)),
        checkpoint,
      );
      assert.deepEqual((await backend.read()).clears, persisted.clears);
      p.$('journey-back').click();
      assert.equal(p.doc.activeElement, p.$(endingAction));
      if (mode === 'versus') {
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

test('the final Journey mission distinguishes a first-to-two round from its completed match', async (t) => {
  const memory = managedIndexedDB();
  const databases = new Map([[JOURNEY_PROFILE_DATABASE, memory]]);
  const backend = createJourneyBackend({ ...memory, profileKey: 'journey-whole-spatial-v5' });
  const p = await couchPage(t, {
    href: 'http://localhost/game/couch/',
    initialLevel: null,
    storage: memoryStorage(),
    assetDatabase: {
      open(name, ...args) {
        if (!databases.has(name)) databases.set(name, managedIndexedDB());
        return databases.get(name).indexedDB.open(name, ...args);
      },
    },
    fetchResponse: assets,
  });
  p.$('race-format').value = 'first-to-two';
  await p.$('race-format').onchange();
  assert.match(p.$('race-format-help').textContent, /first to two/i);
  p.$('race-journey-find').click();
  await settle(() => p.$('journey-chooser')?.open && p.$('journey-collection'));
  const card = p.$('journey-cards').children.find((node) => {
    const [owner, edition, , runtimeId] = JSON.parse(node.dataset.missionId);
    return (
      owner === 'journey:whole-spatial-v5' &&
      edition === 'whole-spatial-v5' &&
      runtimeId.endsWith('/home-signal')
    );
  });
  assert(card);
  const missionId = JSON.parse(card.dataset.missionId)[3];
  card.click();
  await settle(() => {
    p.frame(0);
    return p.renders[0].levelId === 'home-signal' && !p.$('race-pause').disabled;
  });
  const row = tunedRoutes.find((item) => item.id === 'home-signal');
  const picture = p.drawOptions[0].backdrop;
  assert.equal(p.drawOptions[1].backdrop, picture);
  assert.deepEqual(picture.assetRevision, resolveMission(current, row.id).background);
  playKeyboardRoute(p, () => [p.renders[0]], [wasd], row);
  assert.equal(p.$('series-score').textContent, '1 : 0');
  assert.match(
    p.$('race-message').textContent,
    /Sunflower wins the round.*Next round.*Browse missions/,
  );
  assert.doesNotMatch(
    p.$('race-message').textContent,
    /End of the main Journey|wins the match|Rematch/,
  );
  assert.match(p.$('race-start').textContent, /^Next round:/);
  assert.equal(p.$('race-journey-next').textContent, 'Browse missions');
  let firstReceipt;
  await settle(() => {
    void backend.read().then((value) => {
      firstReceipt = value.clears.versus[missionId];
    });
    return !!firstReceipt;
  });
  const first = [...p.renders],
    checks = p.checkpoint();
  p.$('race-journey-next').focus();
  p.$('race-journey-next').click();
  await settle(() => p.$('journey-chooser')?.open && p.$('journey-collection'));
  p.frame(0);
  assert(p.renders.every((run, index) => run === first[index]));
  assert.deepEqual(p.checkpoint(), checks);
  assert.equal(p.$('series-score').textContent, '1 : 0');
  assert(p.drawOptions.every((options) => options.backdrop === picture));
  p.$('journey-back').click();
  assert.equal(p.doc.activeElement, p.$('race-journey-next'));
  p.$('race-start').click();
  await settle(() => {
    p.frame(0);
    return p.renders[0] !== first[0] && !p.$('race-pause').disabled;
  });
  assert.equal(p.$('series-score').textContent, '1 : 0');
  assert.equal(p.$('race-format').value, 'first-to-two');
  assert.equal(p.renders[1].levelId, row.id);
  assert.equal(p.drawOptions[0].backdrop, p.drawOptions[1].backdrop);
  assert.deepEqual(p.drawOptions[0].backdrop.assetRevision, picture.assetRevision);
  playKeyboardRoute(p, () => [p.renders[0]], [wasd], row);
  assert.equal(p.$('series-score').textContent, '2 : 0');
  assert.match(
    p.$('race-message').textContent,
    /Sunflower wins the match!.*End of the main Journey.*Browse missions.*Rematch/,
  );
  assert.match(p.$('race-start').textContent, /^Rematch:/);
  assert.equal(p.$('race-journey-next').textContent, 'Browse missions');
  let persisted;
  await settle(() => {
    void backend.read().then((value) => {
      const receipt = value.clears.versus[missionId];
      if (receipt && receipt.runId !== firstReceipt.runId) persisted = value;
    });
    return !!persisted;
  });
  assert.deepEqual(Object.keys(persisted.clears.versus), [missionId]);
  assert.equal(persisted.clears.versus[missionId].gameplayId, row.gameplayIdentity);
  assert.equal(persisted.clears.versus[missionId].difficulty, 'standard');
  assert.deepEqual(persisted.clears.solo, {});
  assert.deepEqual(persisted.clears.team, {});
  assert.deepEqual(persisted.skipped.versus, []);
});
