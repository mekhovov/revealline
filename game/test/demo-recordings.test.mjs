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
  verifyReplay,
} from '../replay.mjs';
import { createRun, stepRun, releaseInputs, FIXED_DT } from '../core/index.mjs';
import {
  loadDemoCatalog,
  loadDemoRecording,
  resolveDemoCatalog,
  validateDemoCatalog,
  demoReplayMatchesEntry,
  demoIdentity,
  demoInputTraceIdentity,
} from '../demo-catalog.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';

const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const campaign = await json('../content/campaign.json'),
  classRecipes = await json('../content/classes.json');
campaign.classRecipes = classRecipes;
const entry = { campaign, classRecipes };
const catalog = await json('../demo-data/catalog.json');

test('curated wins and authored mistakes reproduce current Standard tuning across every installed base map', async () => {
  const generated = await buildDemoRecordings();
  assert.equal(generated.length, 16);
  assert.equal(
    new Set(generated.map(({ replay }) => replay.level.id)).size,
    campaign.levels.length,
  );
  assert.deepEqual(
    catalog.clips,
    generated.map(({ descriptor }) => descriptor),
  );
  for (const { replay, descriptor, metrics } of generated) {
    const authored = campaign.levels.find((level) => level.id === replay.level.id);
    assert.deepEqual(
      replay.level,
      applyGameplayTuning(authored, resolveGameplayTuning('standard')),
    );
    assert.equal(descriptor.identity, demoIdentity(authored, classRecipes));
    assert.equal(descriptor.recordingIdentity, demoIdentity(replay.level, classRecipes));
    assert.equal(descriptor.levelRevision, authored.revision);
    const candidates = await Promise.all(
      [descriptor.replayURL, ...descriptor.replayVariants].map((url) => json(`../${url.slice(2)}`)),
    );
    for (const candidate of candidates) {
      assert.equal(demoInputTraceIdentity(candidate), descriptor.inputTraceIdentity);
      assert.deepEqual(candidate.summary, replay.summary);
    }
    const frozen = candidates.find((candidate) => verifyReplay(candidate).match);
    assert.ok(
      frozen,
      'At least one independently frozen strict recording must match this runtime.',
    );
    assert.ok(demoReplayMatchesEntry(replay, entry));
    const mistake = descriptor.tags.includes('failure');
    if (mistake) {
      assert.ok(metrics.failures >= 1);
      assert.ok(replay.ticks / 120 >= 12 && replay.ticks / 120 <= 30);
      assert.ok(['running', 'lost'].includes(replay.summary.status));
      assert.ok(replay.summary.lives < 3);
      assert.ok(descriptor.tags.includes(replay.options.classId));
    } else {
      assert.ok(metrics.closedCuts >= 3 && metrics.bends >= 3);
      assert.ok(replay.ticks / 120 >= 20 && replay.ticks / 120 <= 60);
      assert.equal(replay.summary.status, 'won');
      assert.equal(replay.summary.lives, 3);
    }
    assert.ok(replay.segments.every((segment) => !segment.input.boost));
    const player = await prepareReplayPlayer(frozen);
    const events = {};
    let takeoverChecked = false;
    player.play();
    while (player.phase === 'playing') {
      const before = { ...player.state.player };
      for (const event of player.advance(0.2).events)
        events[event.type] = (events[event.type] ?? 0) + 1;
      if (
        descriptor.id === 'stone-lanes-detour' &&
        !takeoverChecked &&
        before.cutting &&
        player.state.player.cutting &&
        before.direction !== player.state.player.direction
      ) {
        player.pause();
        const expected = authoritativeCheckpoint(player.state);
        const fork = await player.forkForPractice();
        assert.notEqual(fork.run, player.state);
        assert.deepEqual(authoritativeCheckpoint(fork.run), expected);
        stepRun(fork.run, { direction: 'up' }, FIXED_DT);
        assert.deepEqual(authoritativeCheckpoint(player.state), expected);
        assert.equal(fork.run.tick, player.state.tick + 1);
        takeoverChecked = true;
        player.play();
      }
    }
    assert.equal(player.finalCheckpoint.hash, frozen.checkpoint.hash);
    assert.equal(player.state.status, replay.summary.status);
    assert.equal(player.state.lives, replay.summary.lives);
    if (mistake) {
      assert.equal(events['player.failed'], metrics.failures);
      assert.ok(
        metrics.fullLoss ? player.state.status === 'lost' : player.state.status === 'running',
      );
    } else {
      assert.equal(events['player.failed'] ?? 0, 0);
      assert.ok(events['cut.closed'] >= 3);
    }
    if (!mistake && descriptor.id === 'stone-lanes-detour') {
      assert.equal(
        takeoverChecked,
        true,
        'Takeover must cover an actual live bend on the new map.',
      );
      assert.ok(authored.walls.length > 0);
      assert.equal(events['objective.captured'], 1);
    } else if (!mistake && descriptor.id === 'hidden-frequency-search') {
      assert.ok(authored.objectives.some((objective) => objective.hidden && objective.required));
      assert.ok(events['ability.used'] >= 1);
      assert.equal(events['objective.captured'], 1);
      assert.equal(
        player.state.objectives.find((objective) => objective.id === 'hidden-relay').captured,
        true,
      );
    } else if (!mistake && descriptor.id === 'the-crossing-windows') {
      assert.ok(
        events['boss.warning'] >= 2,
        'The lane threat must actually telegraph during playback.',
      );
      assert.equal(events['objective.captured'], 1);
    } else if (!mistake && descriptor.id === 'signal-garden-route') {
      assert.ok(events['signal.changed'] >= 2, 'The flight must enter and leave interference.');
      assert.ok(events['ability.used'] >= 1);
      assert.equal(events['objective.captured'], 1);
    }
    player.dispose();
  }
});

test('personal replay compatibility reconstructs tuning from installed originals and rejects admin or forged recipes', async () => {
  const replay = await json('../demo-data/first-signal-left.replay.json');
  assert.ok(demoReplayMatchesEntry(replay, entry));
  const changed = structuredClone(replay);
  changed.level.enemies[0].vx += 0.01;
  assert.equal(demoReplayMatchesEntry(changed, entry), false);
  changed.level = applyGameplayTuning(
    campaign.levels[0],
    resolveGameplayTuning('standard', {
      enemySpeed: 0.75,
      playerSpeed: 1,
      enemyDensity: 1,
    }),
  );
  assert.equal(demoReplayMatchesEntry(changed, entry), false);
  const installed = structuredClone(entry);
  installed.campaign.levels[0].enemies[0].x++;
  assert.equal(demoReplayMatchesEntry(replay, installed), false);

  const player = await prepareReplayPlayer(replay);
  player.step(240);
  const fork = await player.forkForPractice();
  assert.deepEqual(authoritativeCheckpoint(fork.run), authoritativeCheckpoint(player.state));
  assert.deepEqual(fork.run.level, replay.level);
  player.dispose();
});

test('frozen browser variants preserve the exact reviewed trace and every non-enemy outcome', async () => {
  const provenance = await json('../demo-data/variant-provenance.json');
  assert.equal(provenance.format, 'revealline-demo-runtime-variants.v1');
  assert.equal(
    provenance.variants.length,
    catalog.clips.reduce((count, clip) => count + clip.replayVariants.length, 0),
  );
  for (const id of [
    'first-signal-left',
    'first-signal-right',
    'relay-orchard-loop',
    'relay-orchard-stairs',
    'crosswind-openings',
    'night-patrol-loop',
  ])
    assert.ok(provenance.variants.some((variant) => variant.id === id));
  for (const variant of provenance.variants) {
    const clip = catalog.clips.find((candidate) => candidate.id === variant.id);
    assert.ok(clip.replayVariants.includes(variant.replayURL));
    const original = await json(`../${clip.replayURL.slice(2)}`);
    const replay = await json(`../${variant.replayURL.slice(2)}`);
    assert.equal(original.checkpoint.hash, variant.sourceCheckpoint);
    assert.equal(replay.checkpoint.hash, variant.checkpoint);
    assert.equal(demoInputTraceIdentity(replay), variant.inputTraceIdentity);
    assert.equal(variant.inputTraceIdentity, clip.inputTraceIdentity);
    for (const key of [
      'version',
      'ruleset',
      'level',
      'options',
      'segments',
      'ticks',
      'releaseAfter',
      'summary',
    ])
      assert.deepEqual(replay[key], original[key]);
    for (const [section, hash] of Object.entries(original.checkpoint.sections))
      if (section !== 'enemies') assert.equal(replay.checkpoint.sections[section], hash);
    assert.notEqual(replay.checkpoint.sections.enemies, original.checkpoint.sections.enemies);
  }
});

test('catalogue admits only matching installed content and local bundled replay URLs', async () => {
  assert.equal(resolveDemoCatalog(catalog, [entry]).length, 16);
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
  const invalidVariant = structuredClone(catalog);
  invalidVariant.clips[0].replayVariants = ['https://example.com/replay.json'];
  assert.throws(() => validateDemoCatalog(invalidVariant), /bundled relative/);
  invalidVariant.clips[0].replayVariants = Array(4).fill(catalog.clips[0].replayURL);
  assert.throws(() => validateDemoCatalog(invalidVariant), /bounded bundled/);
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
