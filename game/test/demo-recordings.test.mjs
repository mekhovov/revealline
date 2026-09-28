import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildDemoRecordings } from '../../scripts/build-demo-recordings.mjs';
import { prepareReplayPlayer } from '../replay-player.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  recordRelease,
  exportReplay,
} from '../replay.mjs';
import { createRun, stepRun, releaseInputs, FIXED_DT } from '../core/index.mjs';
import {
  loadDemoCatalog,
  loadDemoRecording,
  resolveDemoCatalog,
  validateDemoCatalog,
  demoReplayMatchesEntry,
} from '../demo-catalog.mjs';

const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const campaign = await json('../content/campaign.json'),
  classRecipes = await json('../content/classes.json');
campaign.classRecipes = classRecipes;
const entry = { campaign, classRecipes };
const catalog = await json('../demo-data/catalog.json');

test('six curated recordings reproduce authored bent routes on four unchanged installed maps', async () => {
  const generated = await buildDemoRecordings();
  assert.equal(generated.length, 6);
  assert.equal(new Set(generated.map(({ replay }) => replay.level.id)).size, 4);
  assert.deepEqual(
    catalog.clips,
    generated.map(({ descriptor }) => descriptor),
  );
  for (const { replay, descriptor, metrics } of generated) {
    assert.deepEqual(await json(`../${descriptor.replayURL.slice(2)}`), replay);
    assert.ok(demoReplayMatchesEntry(replay, entry));
    assert.ok(metrics.closedCuts >= 3 && metrics.bends >= 3);
    const player = await prepareReplayPlayer(replay);
    player.play();
    while (player.phase === 'playing') player.advance(0.2);
    assert.equal(player.finalCheckpoint.hash, replay.checkpoint.hash);
    assert.equal(player.state.status, 'won');
    assert.equal(player.state.lives, 3);
  }
});

test('catalogue admits only matching installed content and local bundled replay URLs', async () => {
  assert.equal(resolveDemoCatalog(catalog, [entry]).length, 6);
  assert.equal(resolveDemoCatalog(catalog, []).length, 0);
  const changed = structuredClone(entry);
  changed.campaign.levels[0].rules.moveSpeed++;
  assert.equal(resolveDemoCatalog(catalog, [changed]).length, 0);
  const remote = structuredClone(catalog);
  remote.clips[0].replayURL = 'https://example.com/uninstalled.json';
  assert.throws(() => validateDemoCatalog(remote), /bundled relative/);
  const duplicate = structuredClone(catalog);
  duplicate.clips[1].id = duplicate.clips[0].id;
  assert.throws(() => validateDemoCatalog(duplicate), /identity/);
  const fetched = await loadDemoCatalog({
    fetch: async (url) => {
      assert.ok(url.href.endsWith('/game/demo-data/catalog.json'));
      return { ok: true, text: async () => JSON.stringify(catalog) };
    },
  });
  assert.deepEqual(fetched, catalog);
  const resolved = resolveDemoCatalog(catalog, [entry]),
    source = await json('../demo-data/first-signal-left.replay.json');
  assert.deepEqual(
    await loadDemoRecording(resolved[0], {
      fetch: async () => ({ ok: true, text: async () => JSON.stringify(source) }),
    }),
    source,
  );
  await assert.rejects(
    loadDemoRecording(resolved[2], {
      fetch: async () => ({ ok: true, text: async () => JSON.stringify(source) }),
    }),
    /no longer matches/,
  );
});

async function routeReplay(packFile, proofFile, turnPolicy) {
  const pack = await json(`../content/packs/${packFile}.json`),
    proof = await json(`../replays/${proofFile}.json`);
  const route = proof.routes.find(
    (candidate) =>
      candidate.turnPolicy === turnPolicy &&
      (!candidate.difficulty || candidate.difficulty === 'standard') &&
      (!candidate.packId || candidate.packId === pack.id),
  );
  const level = pack.campaigns
    .flatMap((item) => item.levels)
    .find((item) => item.id === route.levelId);
  const options = {
    seed: route.seed ?? route.expected.seed,
    turnPolicy,
    classId: route.classId ?? route.expected.classId,
    classRecipes: pack.classRecipes,
  };
  const run = createRun(level, options),
    recorder = createRecorder(level, options);
  for (const segment of route.segments)
    for (let i = 0; i < segment.ticks; i++) {
      assert.ok(!segment.releaseBefore, 'This test route requires no explicit releases.');
      stepRun(run, segment.input, FIXED_DT);
      recordInput(recorder, segment.input);
    }
  assert.deepEqual(authoritativeCheckpoint(run), route.checkpoint);
  return exportReplay(recorder, run);
}

for (const policy of ['immediate', 'grid-center']) {
  test(`${policy}: practice forks match all four core branches and own every mutable value`, async () => {
    const sources = [
      await json(
        `../replay-theater/data/fieldcraft-0${policy === 'immediate' ? 1 : 2}.replay.json`,
      ),
      await routeReplay('sentinel-relay', 'sentinel-routes', policy),
      await routeReplay('fpv-arcade', 'first-light-routes', policy),
      await routeReplay('fpv-arcade-r5', 'fpv-arcade-r5-routes', policy),
    ];
    for (const source of sources) {
      const player = await prepareReplayPlayer(source);
      for (const target of [0, 150, Math.min(815, source.ticks - 1)]) {
        player.reset();
        for (let remaining = target; remaining > 0; remaining -= 240)
          player.step(Math.min(remaining, 240));
        const expected = authoritativeCheckpoint(player.state),
          { run, origin } = await player.forkForPractice();
        assert.deepEqual(authoritativeCheckpoint(run), expected);
        assert.equal(origin.tick, target);
        assert.notEqual(run.cells, player.state.cells);
        assert.notEqual(run.ability, player.state.ability);
        releaseInputs(run);
        stepRun(run, { direction: 'left' });
        assert.deepEqual(authoritativeCheckpoint(player.state), expected);
      }
    }
  });
}

test('practice preparation rejects stale, cancelled, terminal or altered playback and owns exports', async () => {
  const source = await json('../demo-data/first-signal-left.replay.json'),
    player = await prepareReplayPlayer(source);
  player.step(240);
  const controller = new AbortController();
  const cancelled = player.forkForPractice({ signal: controller.signal });
  controller.abort();
  await assert.rejects(cancelled, { name: 'AbortError' });
  const pending = player.forkForPractice();
  player.reset();
  await assert.rejects(pending, { name: 'AbortError' });
  player.play();
  await assert.rejects(player.forkForPractice(), /Pause/);
  player.pause();
  player.state.score++;
  await assert.rejects(player.forkForPractice(), /reproduce/);
  player.reset();
  const exported = player.exportRecording();
  exported.segments[0].input.direction = 'left';
  assert.deepEqual(player.exportRecording(), source);
  player.play();
  while (player.phase === 'playing') player.advance(0.2);
  await assert.rejects(player.forkForPractice(), /ended/);
});

test('practice forks preserve live-cut releases at exact RLE boundaries and a trailing pause', async () => {
  for (const turnPolicy of ['immediate', 'grid-center']) {
    const options = { turnPolicy, classRecipes },
      run = createRun(campaign.levels[0], options),
      recorder = createRecorder(campaign.levels[0], options);
    const input = (command, ticks) => {
      for (let tick = 0; tick < ticks; tick++) {
        stepRun(run, command);
        recordInput(recorder, command);
      }
    };
    input({ direction: 'down', action: true }, 45);
    input({ direction: 'right' }, 24);
    releaseInputs(run);
    recordRelease(recorder);
    input({ action: true }, 1);
    input({ direction: 'down' }, 17);
    releaseInputs(run);
    recordRelease(recorder);
    const player = await prepareReplayPlayer(exportReplay(recorder, run));
    for (const target of [69, 70, 87]) {
      player.reset();
      player.step(target);
      assert.equal(player.state.player.cutting, true);
      const fork = await player.forkForPractice();
      assert.deepEqual(authoritativeCheckpoint(fork.run), authoritativeCheckpoint(player.state));
    }
    await assert.rejects(
      player.forkForPractice({
        onProgress: ({ fraction }) => {
          if (fraction === 1) player.state.score++;
        },
      }),
      /reproduce/,
    );
  }
});

test('disposing replay playback cancels pending practice and prevents an abandoned player from advancing', async () => {
  const source = await json('../demo-data/first-signal-left.replay.json'),
    player = await prepareReplayPlayer(source);
  player.step(240);
  const before = authoritativeCheckpoint(player.state);
  const pending = player.forkForPractice();
  player.dispose();
  player.dispose();
  await assert.rejects(pending, { name: 'AbortError' });
  player.play();
  player.advance(0.2);
  assert.equal(player.phase, 'disposed');
  assert.deepEqual(authoritativeCheckpoint(player.state), before);
  assert.throws(() => player.reset(), /disposed/);
  assert.throws(() => player.step(), /disposed/);
  assert.throws(() => player.setRate(2), /disposed/);
  await assert.rejects(player.forkForPractice(), /disposed/);
});

const stepTo = (player, target) => {
  player.reset();
  for (let remaining = target; remaining > 0; remaining -= 240)
    player.step(Math.min(remaining, 240));
};

test('a takeover retains both hangar loadouts, a live support field and impact recovery timing', async () => {
  const carrier = await prepareReplayPlayer(
    await json('../replay-theater/data/fieldcraft-02.replay.json'),
  );
  stepTo(carrier, 815);
  assert.equal(carrier.state.activeClassId, 'carrier');
  assert.equal(carrier.state.classHistory.length, 2);
  assert.ok(carrier.state.ability.fields.length > 0);
  const before = authoritativeCheckpoint(carrier.state),
    { run } = await carrier.forkForPractice();
  assert.deepEqual(authoritativeCheckpoint(run), before);
  releaseInputs(run);
  for (let tick = 0; tick < 250; tick++) stepRun(run, {});
  stepRun(run, { switchClass: 'bomber' });
  assert.equal(run.activeClassId, 'bomber');
  assert.equal(run.ability.ammo, 0, 'Switching back retains the earlier spent loadout.');
  assert.deepEqual(authoritativeCheckpoint(carrier.state), before);
  const impact = await prepareReplayPlayer(
    await json('../replay-theater/data/fieldcraft-03.replay.json'),
  );
  stepTo(impact, 120);
  assert.equal(impact.state.status, 'respawning');
  const recovery = await impact.forkForPractice();
  assert.deepEqual(authoritativeCheckpoint(recovery.run), authoritativeCheckpoint(impact.state));
  for (let tick = 0; tick < 70; tick++) stepRun(recovery.run, {});
  impact.step(70);
  assert.equal(recovery.run.status, 'running');
  assert.deepEqual(authoritativeCheckpoint(recovery.run), authoritativeCheckpoint(impact.state));
});

for (const policy of ['immediate', 'grid-center'])
  test(`${policy}: staged encounter takeover preserves warning, active and transition authority`, async () => {
    const player = await prepareReplayPlayer(
      await routeReplay('sentinel-relay', 'sentinel-routes', policy),
    );
    for (const [target, phase] of [
      [241, 'warning'],
      [481, 'active'],
      [1100, 'transition'],
      [1510, 'active'],
    ]) {
      stepTo(player, target);
      assert.equal(player.state.encounter.phase, phase);
      const { run } = await player.forkForPractice();
      assert.deepEqual(authoritativeCheckpoint(run), authoritativeCheckpoint(player.state));
      assert.notEqual(run.encounter, player.state.encounter);
      releaseInputs(run);
      stepRun(run, { direction: 'up' });
      assert.equal(player.state.tick, target);
      assert.equal(player.state.encounter.phase, phase);
    }
  });
