import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOverflightClock,
  createOverflightInputGate,
  OVERFLIGHT_STEP_SECONDS,
  createOverflightRendererOwner,
  createOverflightContextGuard,
  overflightPreviewRequest,
  createOverflightReviewPlayback,
  overflightReviewStopAt,
  overflightReviewControls,
  createOverflightKeyboardState,
  createOverflightJSONPages,
} from '../overflight/host-loop.mjs';
import { createOverflightAudio, overflightMusicContext } from '../overflight/audio.mjs';
import { emptySoundtrackLibrary, resolveSoundtrackSelection } from '../soundtrack.mjs';
import {
  createOverflightRun,
  startOverflight,
  pauseOverflight,
  resumeOverflight,
} from '../overflight/core.mjs';
import { DEFAULT_OVERFLIGHT_PROJECT, compileOverflightProject } from '../overflight/project.mjs';
import { OVERFLIGHT_COPY } from '../overflight/copy.mjs';
import { createOverflightReviewRecorder } from '../overflight/review-recorder.mjs';

test('review provenance and pilot inputs share the selected route without changing prior defaults', () => {
  for (const mode of ['overflight', 'overflight-riy']) {
    for (const build of ['fan', 'echo', 'systems', 'echo-scanner']) {
      const original = overflightReviewControls({ mode, build });
      assert.deepEqual(original, { route: 'tight', pilotArgument: 'tight' });
      assert.deepEqual(overflightReviewControls({ mode, build, route: 'unknown' }), original);
      for (const route of ['tight', 'figure-eight', 'lure-and-return']) {
        const controls = overflightReviewControls({ mode, build, route });
        assert.deepEqual(controls, { route, pilotArgument: route });
        const calls = [];
        const review = createOverflightReviewPlayback({
          build,
          route: controls.pilotArgument,
          pilot: (run, received) => {
            calls.push(received);
            return { x: 1, y: 0, boost: false };
          },
          selectCard: () => null,
        });
        review.input({ tick: 0, time: 0 });
        review.input({ tick: 5, time: 5 / 60 });
        review.input({ tick: 6, time: 0.1 });
        assert.deepEqual(calls, [controls.route, controls.route]);
      }
    }
  }
  assert.deepEqual(overflightReviewControls({ mode: 'overflight', build: null, route: 'tight' }), {
    route: null,
    pilotArgument: null,
  });
  assert.deepEqual(
    overflightReviewControls({ mode: 'overflight-hunt', build: 'objectives', route: 'tight' }),
    { route: 'objectives', pilotArgument: 'objectives' },
  );
  assert.deepEqual(
    overflightReviewControls({ mode: 'overflight-hunt', build: 'breaker', route: 'figure-eight' }),
    { route: 'packs', pilotArgument: 'breaker' },
  );
});

test('native entry forwards an explicit review route through both wrappers and records that same route', async () => {
  const { readFile } = await import('node:fs/promises');
  const { runInNewContext } = await import('node:vm');
  const { parse } = await import('acorn');
  const source = await readFile(new URL('../overflight/app.mjs', import.meta.url), 'utf8');
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const variable = (name) =>
    ast.body.flatMap((node) => node.declarations ?? []).find((node) => node.id.name === name);
  const base = variable('mode').init.alternate.properties.find(
    (node) => node.key.name === 'pilot',
  ).value;
  const forwarded = variable('review').init.arguments[0].properties.find(
    (node) => node.key.name === 'pilot',
  ).value;
  const identity = ast.body.find(
    (node) => node.type === 'FunctionDeclaration' && node.id.name === 'reviewIdentity',
  );
  for (const route of ['tight', 'figure-eight', 'lure-and-return']) {
    const calls = [];
    const nativePilot = runInNewContext(`(${source.slice(base.start, base.end)})`, {
      pilot: (run, received) => {
        calls.push(received);
        return { x: 1, y: 0, boost: false };
      },
    });
    const reviewControls = overflightReviewControls({
      mode: 'overflight-riy',
      build: 'echo',
      route,
    });
    const forwarder = runInNewContext(`(${source.slice(forwarded.start, forwarded.end)})`, {
      mode: { pilot: nativePilot },
    });
    const playback = createOverflightReviewPlayback({
      build: 'echo',
      route: reviewControls.pilotArgument,
      pilot: forwarder,
      selectCard: () => null,
    });
    playback.input({ tick: 0, time: 0 });
    assert.deepEqual(
      calls,
      [route],
      'neither native wrapper may silently replace the chosen route',
    );
    const report = runInNewContext(
      `${source.slice(identity.start, identity.end)}; reviewIdentity()`,
      { reviewBuild: 'echo', reviewStopAt: null, reviewControls },
    );
    assert.equal(report.route, calls[0]);
  }
});

test('native variant mission picker queries progress only for supported installed projects', async () => {
  const { readFile } = await import('node:fs/promises');
  const { runInNewContext } = await import('node:vm');
  const { parse } = await import('acorn');
  const { OVERFLIGHT_HUNT_MODE } = await import('../overflight/raid-mode.mjs');
  const { createOverflightRaidVariant } = await import('../overflight/raid-variants.mjs');
  const { createExperimentalOverflightWorldProject } = await import('../overflight/worlds.mjs');
  const { overflightPlayableMissionDefinitions } = await import(
    '../overflight/mission-library.mjs'
  );
  const source = await readFile(new URL('../overflight/app.mjs', import.meta.url), 'utf8');
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const declaration = ast.body.find(
    (node) => node.type === 'FunctionDeclaration' && node.id.name === 'openMissionLibrary',
  );
  const experimental = createExperimentalOverflightWorldProject(OVERFLIGHT_HUNT_MODE.createProject);
  const open = OVERFLIGHT_HUNT_MODE.createProject();
  for (const variant of ['time-attack', 'marathon']) {
    let refreshed = 0;
    const queries = [];
    const mode = createOverflightRaidVariant(OVERFLIGHT_HUNT_MODE, { variant });
    const context = {
      mode,
      pause() {},
      missionRegistry: {},
      missionChooser: {
        open() {},
        refresh() {
          refreshed++;
        },
      },
      doc: { activeElement: {} },
      refreshMissions: async () => {},
      records: {
        async read(query) {
          queries.push(query);
          return { fastestClear: { time: 30 } };
        },
      },
      progressEpoch: 0,
      officialProjects: () => [],
      installed: [experimental, open].map((project) => ({ project })),
      options: {},
      retired: false,
      overflightPlayableMissionDefinitions,
      overflightFlightProfile: () => ({}),
    };
    await runInNewContext(
      `${source.slice(declaration.start, declaration.end)}; openMissionLibrary()`,
      context,
    );
    assert.equal(queries.length, 1);
    assert.equal(queries[0].compiled.id, open.id);
    assert.equal(refreshed, 1);
    assert.equal(context.missionProgress.size, 1);
    assert.equal(
      context.missionProgress.get(mode.compileProject(open).projectIdentity).state,
      'completed',
    );
  }
});

test('completed-frame trials include explicitly requested native Survivor and Riy review builds', async () => {
  const { readFile } = await import('node:fs/promises');
  const { runInNewContext } = await import('node:vm');
  const { parse } = await import('acorn');
  const { overflightBenchmarkMeasureAt } = await import('../overflight/benchmark.mjs');
  const source = await readFile(new URL('../overflight/app.mjs', import.meta.url), 'utf8');
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const declarations = ast.body
    .filter((node) => node.type === 'VariableDeclaration')
    .flatMap((node) => node.declarations);
  const trial = declarations.find((node) => node.id.name === 'benchmarkTrial').init;
  const measureAt = declarations.find((node) => node.id.name === 'measureAt').init;
  const protocol = declarations.find((node) => node.id.name === 'benchmarkProtocol').init;
  const evaluate = (id, query, reviewBuild = null, fixture = null) => {
    const context = {
      mode: { id },
      params: new URLSearchParams(query),
      reviewBuild,
      fixture,
      overflightBenchmarkMeasureAt,
    };
    context.benchmarkTrial = runInNewContext(source.slice(trial.start, trial.end), context);
    context.measureAt = runInNewContext(source.slice(measureAt.start, measureAt.end), context);
    return JSON.parse(
      JSON.stringify({
        trial: context.benchmarkTrial,
        protocol: runInNewContext(source.slice(protocol.start, protocol.end), context),
      }),
    );
  };
  for (const id of ['overflight', 'overflight-riy', 'overflight-hunt']) {
    for (const trial of ['1', '2', '3']) {
      assert.deepEqual(evaluate(id, `benchmark=1&trial=${trial}`, 'fan-shield'), {
        trial,
        protocol: { warmupSeconds: 30, measurementSeconds: 120, repetitions: 1, stopAtEnd: true },
      });
      assert.equal(
        evaluate(id, `benchmark=1&trial=${trial}&measureAt=160`, 'fan-shield').protocol.measureAt,
        160,
      );
    }
    assert.equal(evaluate(id, 'trial=1', 'fan-shield').trial, null);
    assert.equal(evaluate(id, 'benchmark=1&trial=unrecognized', 'fan-shield').trial, null);
  }
  assert.equal(evaluate('overflight', 'benchmark=1&trial=1').trial, null);
  assert.equal(evaluate('overflight-riy', 'benchmark=1&trial=1').trial, null);
  assert.equal(evaluate('overflight-hunt', 'benchmark=1&trial=1').trial, '1');
  assert.equal(evaluate('overflight', 'trial=2', null, 'reference').trial, '2');
  for (const args of [
    ['overflight', 'benchmark=1&trial=1&measureAt=160', 'fan-shield', 'reference'],
    ['overflight-hunt', 'benchmark=1&trial=1&measureAt=160'],
    ['overflight-riy', 'benchmark=1&trial=soak&measureAt=160', 'fan-shield'],
    ['overflight-riy', 'benchmark=1&trial=1&measureAt=361', 'fan-shield'],
  ]) {
    assert.equal(Object.hasOwn(evaluate(...args).protocol, 'measureAt'), false);
  }
  assert.equal(
    evaluate('overflight-riy', 'benchmark=1&trial=soak', 'fan-shield').protocol.measurementSeconds,
    900,
  );
  assert.equal(
    evaluate('overflight-riy', 'benchmark=1&trial=1&measureAt=240', 'fan-shield').protocol
      .measureAt,
    240,
  );
});

test('native catalogue exposes all eighteen compiled layouts for all five operations', async () => {
  const { readFile } = await import('node:fs/promises');
  const { runInNewContext } = await import('node:vm');
  const { parse } = await import('acorn');
  const { OVERFLIGHT_BATTLEFIELDS } = await import('../overflight/battlefields.mjs');
  const { createOverflightProject, compileOverflightProject } = await import(
    '../overflight/project.mjs'
  );
  const { createOverflightRiyProject, compileOverflightRiyProject } = await import(
    '../overflight/riy-project.mjs'
  );
  const { OVERFLIGHT_HUNT_MODE } = await import('../overflight/raid-mode.mjs');
  const { createOverflightRaidVariant } = await import('../overflight/raid-variants.mjs');
  const source = await readFile(new URL('../overflight/app.mjs', import.meta.url), 'utf8');
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const official = ast.body.find(
    (node) => node.type === 'FunctionDeclaration' && node.id.name === 'officialProjects',
  );
  const modes = [
    {
      createProject: (options) => createOverflightProject({ ...options, rulesVersion: 4 }),
      compileProject: compileOverflightProject,
    },
    {
      createProject: (options) => createOverflightRiyProject({ ...options, rulesVersion: 4 }),
      compileProject: compileOverflightRiyProject,
    },
    OVERFLIGHT_HUNT_MODE,
    ...['time-attack', 'marathon'].map((variant) =>
      createOverflightRaidVariant(OVERFLIGHT_HUNT_MODE, { variant }),
    ),
  ];
  for (const mode of modes) {
    const projects = runInNewContext(`(${source.slice(official.start, official.end)})()`, {
      mode,
      OVERFLIGHT_BATTLEFIELDS,
      options: { difficulty: 'standard' },
    });
    assert.equal(projects.length, 18);
    assert.equal(new Set(projects.map((project) => project.battlefield.id)).size, 18);
    for (const project of projects) {
      const compiled = mode.compileProject(project);
      assert.equal(compiled.rulesVersion, 4);
      assert.equal(compiled.terrain.format, 'OverflightTerrainV2');
    }
  }
});

test('one fixed clock scales every simulation system and keeps paused time out of the run', () => {
  const clock = createOverflightClock();
  const observed = [];
  clock.advance(0, true, (dt) => observed.push(dt));
  for (let frame = 1; frame <= 60; frame++)
    clock.advance((frame * 1000) / 60, true, (dt) => observed.push(dt));
  assert.equal(observed.length, 60);
  assert.ok(observed.every((dt) => dt === OVERFLIGHT_STEP_SECONDS));
  clock.advance(7000, false, () => assert.fail('pause stepped'));
  clock.advance(7017, true, (dt) => observed.push(dt));
  assert.equal(observed.length, 61);
  clock.slowResume(8000);
  let scaled = 0;
  for (let frame = 1; frame <= 45; frame++)
    clock.advance(8000 + (frame * 1000) / 60, true, () => scaled++);
  assert.equal(scaled, 28);
  assert.ok(Math.abs(scaled / 60 + clock.stats().accumulator - 0.46875) < 1e-9);
});

test('an upgrade stops catch-up on that exact step and a hitch never requests automatic pause', () => {
  const clock = createOverflightClock();
  clock.advance(0, true, () => {});
  let steps = 0;
  clock.advance(1000, true, () => {
    steps++;
    return false;
  });
  assert.equal(steps, 1);
  assert.equal(clock.stats().accumulator, 0);
  assert.ok(clock.stats().droppedSeconds >= 0.75);
  clock.advance(1017, true, () => steps++);
  assert.equal(steps, 2);
});

test('modal actions wait for release while held steering stays responsive', () => {
  const gate = createOverflightInputGate();
  assert.deepEqual(gate.sample({ x: 1, boost: true, neutral: false }), {
    x: 1,
    y: 0,
    boost: false,
  });
  assert.deepEqual(gate.sample({ neutral: true }), {
    x: 0,
    y: 0,
    boost: false,
  });
  const direction = gate.sample({ x: 1, y: 1, boost: true, neutral: false });
  assert.ok(Math.abs(Math.hypot(direction.x, direction.y) - 1) < 1e-10);
  assert.equal(direction.boost, true);
  gate.release();
  assert.equal(gate.sample({ x: 1, neutral: false }).x, 1);
  assert.equal(gate.blocked(), true);
  gate.sample({ x: 1, actionsNeutral: true });
  assert.equal(gate.blocked(), false);
  assert.equal(gate.sample({ x: 1, boost: true }).boost, true);
});

test('keyboard focus loss forgets missed keyup but rejects repeats until a fresh press', () => {
  const keyboard = createOverflightKeyboardState(),
    gate = createOverflightInputGate();
  keyboard.press('KeyW');
  keyboard.press('Space');
  assert.equal(keyboard.size, 2);
  keyboard.clear();
  gate.release();
  keyboard.press('KeyW', true);
  keyboard.press('Space', true);
  assert.equal(keyboard.size, 0);
  gate.sample({ neutral: keyboard.size === 0 });
  keyboard.press('KeyD');
  assert.equal(gate.sample({ x: keyboard.has('KeyD') ? 1 : 0 }).x, 1);
  keyboard.release('KeyD');
  assert.equal(keyboard.size, 0);
});

test('raw measurement pages stay bounded and reconstruct the complete untruncated receipt', () => {
  const snapshot = {
    frames: Array.from({ length: 2000 }, (_, tick) => ({
      tick,
      milliseconds: 1000 / 60,
    })),
  };
  const pages = createOverflightJSONPages(snapshot, 4096);
  const chunks = Array.from({ length: pages.count }, (_, index) => pages.page(index));
  assert.ok(chunks.every((chunk) => chunk.length <= 4096));
  assert.deepEqual(JSON.parse(chunks.join('')), snapshot);
  assert.equal(chunks.join(''), pages.json);
  assert.throws(() => pages.page(pages.count), RangeError);
});

test('the shared audio adapter emits bounded semantic cues once per tick', () => {
  const heard = [];
  const sound = {
    encounter: (...args) => heard.push(args),
    feedbackDirector: { reset() {} },
  };
  const audio = createOverflightAudio(sound);
  const run = {
    tick: 4,
    player: { x: 100 },
    events: [{ type: 'impact', x: 120 }, { type: 'impact', x: 130 }, { type: 'pickup' }],
  };
  audio.update(run);
  audio.update(run);
  assert.deepEqual(
    heard.map(([cue]) => cue),
    ['impact', 'supply'],
  );
  run.tick++;
  audio.update(run);
  assert.equal(heard.length, 4);
});

test('native Overflight interface has matching English and Ukrainian coverage', () => {
  assert.deepEqual(Object.keys(OVERFLIGHT_COPY.en).sort(), Object.keys(OVERFLIGHT_COPY.uk).sort());
  assert.ok(
    Object.values(OVERFLIGHT_COPY.uk).every(
      (value) => typeof value === 'string' && value.length > 0,
    ),
  );
});

test('the 750 ms resume ramp integrates exactly at different display cadences', () => {
  const measure = (cadence) => {
    const clock = createOverflightClock();
    clock.slowResume(0);
    let total = 0;
    for (const now of cadence)
      clock.advance(now, true, (dt) => {
        total += dt;
      });
    return total + clock.stats().accumulator;
  };
  assert.ok(Math.abs(measure([10]) - 0.00255) < 1e-10);
  assert.ok(Math.abs(measure([250, 500, 750]) - 0.46875) < 1e-10);
  const split = Array.from({ length: 180 }, (_, index) => ((index + 1) * 1000) / 120);
  const coarse = Array.from({ length: 6 }, (_, index) => (index + 1) * 250);
  assert.ok(Math.abs(measure(split) - measure(coarse)) < 1e-10);
  assert.ok(Math.abs(measure(coarse) - 1.21875) < 1e-10);
});

test('ten retries keep one renderer and context restoration requires explicit resume', async () => {
  const owner = createOverflightRendererOwner();
  const compiled = compileOverflightProject(DEFAULT_OVERFLIGHT_PROJECT);
  let run,
    creations = 0,
    destructions = 0;
  const renderer = {
    present() {},
    async destroy() {
      destructions++;
    },
  };
  const create = async () => {
    creations++;
    return renderer;
  };
  const gate = createOverflightInputGate();
  const guard = createOverflightContextGuard({
    pause: () => pauseOverflight(run),
    release: () => gate.release(),
  });
  for (let retry = 0; retry < 10; retry++) {
    assert.equal(await owner.acquire('same-frozen-appearance', create), renderer);
    run = createOverflightRun(compiled);
    startOverflight(run);
    guard.lose();
    assert.equal(run.phase, 'paused');
    assert.equal(guard.blocked(), true);
    guard.restore();
    assert.equal(guard.blocked(), false);
    assert.equal(run.phase, 'paused');
    assert.deepEqual(gate.sample({ x: 1, boost: true }), {
      x: 1,
      y: 0,
      boost: false,
    });
    resumeOverflight(run);
    assert.equal(run.phase, 'playing');
  }
  assert.equal(creations, 1);
  assert.equal(destructions, 0);
  await owner.dispose();
  assert.equal(destructions, 1);
});

test('appearance replacement retires the old atlas first and teardown retires a pending renderer', async () => {
  const owner = createOverflightRendererOwner();
  const events = [];
  await owner.acquire('first', async () => ({
    destroy: async () => events.push('destroy-first'),
  }));
  await owner.acquire('second', async () => {
    events.push('create-second');
    return { destroy: async () => events.push('destroy-second') };
  });
  assert.deepEqual(events, ['destroy-first', 'create-second']);
  let resolve;
  const pending = owner.acquire(
    'third',
    () =>
      new Promise((accept) => {
        resolve = accept;
      }),
  );
  await new Promise((accept) => setImmediate(accept));
  const disposal = owner.dispose();
  resolve({ destroy: async () => events.push('destroy-third') });
  await assert.rejects(pending, /closed/);
  await disposal;
  assert.deepEqual(events, ['destroy-first', 'create-second', 'destroy-second', 'destroy-third']);
});

test('native music context is accepted by the shared soundtrack schema', () => {
  const context = overflightMusicContext(DEFAULT_OVERFLIGHT_PROJECT, {
    familyId: 'industrial-workshop',
  });
  assert.doesNotThrow(() => resolveSoundtrackSelection(emptySoundtrackLibrary(), context));
  assert.equal(context.mapKey, DEFAULT_OVERFLIGHT_PROJECT.id);
});

test('Studio project messages require the exact same-origin embedding parent', () => {
  const window = {},
    parent = {},
    origin = 'https://game.example';
  const scope = { window, parent, origin };
  const data = {
    type: 'overflight:preview',
    version: 1,
    requestId: 3,
    project: DEFAULT_OVERFLIGHT_PROJECT,
  };
  const accepted = { source: parent, origin, data };
  assert.equal(overflightPreviewRequest(accepted, scope), data);
  for (const event of [
    { ...accepted, source: {} },
    { ...accepted, origin: 'https://unrelated.example' },
    { ...accepted, data: { ...data, version: 2 } },
    { ...accepted, data: { ...data, requestId: { unsafe: true } } },
  ])
    assert.equal(overflightPreviewRequest(event, scope), null);
  assert.equal(
    overflightPreviewRequest({ ...accepted, source: window }, { ...scope, parent: window }),
    null,
  );
});

test('an accepted evolution has one audio cue even when no simulation tick elapsed', () => {
  const heard = [];
  const audio = createOverflightAudio({
    encounter: (type) => heard.push(type),
    publishedCue: (type) => heard.push(type),
    feedbackDirector: { reset() {} },
  });
  const run = {
    tick: 120,
    phase: 'upgrade',
    progression: { choices: 2, rerolls: 1 },
    player: { x: 0 },
    events: [{ type: 'upgrade-ready' }],
  };
  audio.update(run);
  run.phase = 'playing';
  run.progression.choices++;
  run.events = [{ type: 'upgrade' }, { type: 'evolution' }];
  audio.update(run);
  audio.update(run);
  assert.deepEqual(heard, ['confirm', 'objective']);
});

test('a failed renderer is replaced on Retry while healthy retries retain their owner', async () => {
  const owner = createOverflightRendererOwner();
  let creations = 0,
    destructions = 0;
  const create = async () => ({
    instance: ++creations,
    destroy: async () => {
      destructions++;
    },
  });
  const first = await owner.acquire('accepted-art', create);
  assert.equal(await owner.acquire('accepted-art', create), first);
  owner.invalidate();
  const recovered = await owner.acquire('accepted-art', create);
  assert.notEqual(recovered, first);
  assert.equal(creations, 2);
  assert.equal(destructions, 1);
  assert.equal(await owner.acquire('accepted-art', create), recovered);
  await owner.dispose();
  assert.equal(destructions, 2);
});

test('explicit review playback uses ordinary input at 10 Hz while the host keeps fixed 60 Hz steps', () => {
  const sampled = [];
  const review = createOverflightReviewPlayback({
    build: 'fan',
    pilot(run, route) {
      sampled.push({ tick: run.tick, route });
      return { x: 0.5, y: -0.25, boost: false };
    },
    selectCard() {
      assert.fail('no earned upgrade was presented');
    },
  });
  const clock = createOverflightClock();
  const run = { tick: 0 };
  const step = (dt) => {
    assert.equal(dt, 1 / 60);
    assert.deepEqual(review.input(run, { x: 1 }), {
      x: 0.5,
      y: -0.25,
      boost: false,
    });
    run.tick++;
  };
  clock.advance(0, true, step);
  for (let frame = 1; frame <= 120; frame++) clock.advance((frame * 1000) / 120, true, step);
  assert.equal(run.tick, 60);
  assert.deepEqual(
    sampled.map(({ tick }) => tick),
    [0, 6, 12, 18, 24, 30, 36, 42, 48, 54],
  );
  assert.ok(sampled.every(({ route }) => route === 'tight'));
  review.reset();
  review.input({ tick: 0 });
  assert.equal(sampled.at(-1).tick, 0);
});

test('review upgrades show legally rerolled offers for 1.5 visible seconds and never count hidden time', () => {
  let selections = 0;
  const run = {
    phase: 'upgrade',
    progression: { choices: 0, rerolls: 1 },
    offers: [{ id: 'first' }],
  };
  const review = createOverflightReviewPlayback({
    build: 'echo',
    pilot() {},
    selectCard(state, build) {
      assert.equal(build, 'echo');
      selections++;
      state.progression.rerolls--;
      state.offers = [{ id: 'rerolled' }];
      return state.offers[0];
    },
  });
  assert.equal(review.upgrade(run, 0, false), null);
  assert.equal(selections, 0);
  assert.deepEqual(review.upgrade(run, 10, true), {
    selectedId: 'rerolled',
    choiceId: null,
  });
  assert.equal(review.upgrade(run, 510, true).choiceId, null);
  assert.equal(review.upgrade(run, 600, false), null);
  assert.equal(review.upgrade(run, 10000, true).choiceId, null);
  assert.equal(review.upgrade(run, 10999, true).choiceId, null);
  assert.equal(review.upgrade(run, 11000, true).choiceId, 'rerolled');
  assert.equal(selections, 1);
  assert.equal(run.progression.choices, 0, 'the host alone applies the returned legal choice');
  run.phase = 'playing';
  assert.equal(review.upgrade(run, 12000, true), null);
});

test('ordinary manual play never invokes review input or automatic upgrade selection', () => {
  const review = createOverflightReviewPlayback({
    build: null,
    pilot() {
      assert.fail('manual play invoked the pilot');
    },
    selectCard() {
      assert.fail('manual play automatically selected a card');
    },
  });
  const manual = { x: -0.4, y: 0.7, boost: true };
  assert.equal(review.input({ tick: 0 }, manual), manual);
  assert.equal(review.upgrade({ phase: 'upgrade' }, 10000, true), null);
});

function recorderHarness() {
  const timers = new Map(),
    revoked = [],
    captured = [],
    instances = [];
  let timerId = 0,
    stoppedTracks = 0;
  class MediaRecorder {
    static isTypeSupported(type) {
      return type.startsWith('video/webm');
    }
    constructor(stream, options) {
      this.mimeType = options.mimeType;
      this.state = 'inactive';
      instances.push(this);
    }
    start(interval) {
      this.state = 'recording';
      this.interval = interval;
    }
    stop() {
      this.state = 'inactive';
      this.onstop?.();
    }
  }
  const environment = {
    MediaRecorder,
    Blob,
    setTimeout(fn, milliseconds) {
      timers.set(++timerId, { fn, milliseconds });
      return timerId;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    URL: {
      createObjectURL(blob) {
        captured.push(blob);
        return `blob:review-${captured.length}`;
      },
      revokeObjectURL(url) {
        revoked.push(url);
      },
    },
  };
  const canvas = {
    captureStream(rate) {
      assert.equal(rate, 30);
      let stopped = false;
      return {
        getTracks: () => [
          {
            stop() {
              if (!stopped) stoppedTracks++;
              stopped = true;
            },
          },
        ],
      };
    },
  };
  return {
    environment,
    canvas,
    timers,
    revoked,
    captured,
    instances,
    stopped: () => stoppedTracks,
  };
}

test('review capture is silent, bounded to 20 seconds, and releases tracks, timers and previous URLs', () => {
  const h = recorderHarness();
  const recorder = createOverflightReviewRecorder({ window: h.environment });
  assert.equal(recorder.record(h.canvas), true);
  assert.equal(h.instances[0].interval, 250);
  assert.equal(recorder.record(h.canvas), false, 'only one capture can be active');
  h.instances[0].ondataavailable({
    data: new Blob(['battlefield'], { type: 'video/webm' }),
  });
  const timer = [...h.timers.values()][0];
  assert.equal(timer.milliseconds, 20000);
  timer.fn();
  assert.equal(recorder.snapshot().phase, 'ready');
  assert.equal(h.stopped(), 1);
  assert.equal(h.timers.size, 0);
  assert.equal(h.captured[0].size, 11);
  recorder.record(h.canvas);
  assert.deepEqual(h.revoked, ['blob:review-1']);
  recorder.dispose();
  assert.equal(h.stopped(), 2);
  assert.equal(h.timers.size, 0);
  assert.equal(recorder.record(h.canvas), false);
});

test('oversize and unsupported review capture fail without retaining chunks or active tracks', () => {
  const h = recorderHarness();
  const recorder = createOverflightReviewRecorder({ window: h.environment });
  assert.equal(recorder.record({}), false);
  assert.equal(recorder.snapshot().phase, 'unsupported');
  recorder.record(h.canvas);
  h.instances[0].ondataavailable({
    data: new Blob([new Uint8Array(16 * 1024 * 1024 + 1)]),
  });
  assert.equal(recorder.snapshot().phase, 'tooLarge');
  assert.equal(h.captured.length, 0);
  assert.equal(h.stopped(), 1);
  assert.equal(h.timers.size, 0);
  recorder.dispose();
});

test('native Marathon continuation retains its run when next-sortie settings change', async () => {
  const { readFile } = await import('node:fs/promises');
  const { runInNewContext } = await import('node:vm');
  const { parse } = await import('acorn');
  const { overflightFlightProfile } = await import('../overflight/flight-profile.mjs');
  const source = await readFile(new URL('../overflight/app.mjs', import.meta.url), 'utf8');
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const start = ast.body.find(
    (node) => node.type === 'FunctionDeclaration' && node.id.name === 'start',
  );
  const installation = ast.body
    .filter((node) => node.type === 'VariableDeclaration')
    .flatMap((node) => node.declarations)
    .find((node) => node.id.name === 'disposeModeActions');
  const call = installation.init.expression ?? installation.init;
  const continuation = call.arguments[0].properties.find(
    (node) => node.key.name === 'onContinueContract',
  ).value;
  const fixture = () => {
    const original = {
      phase: 'ready',
      airframes: 3,
      airframesRemaining: 2,
      slowResume: true,
      flight: overflightFlightProfile('carrier', true),
      player: { hull: 37, maxHull: 120 },
      build: { hunt: { 'boost-duration': 2 } },
      raidVariant: { contract: 2, escrow: 1000 },
    };
    const calls = { create: 0, prepare: 0, entered: 0, reviewReset: 0 };
    const noop = () => {};
    const context = {
      run: original,
      renderer: {},
      preparing: false,
      suspendBusy: false,
      runtimeFailed: false,
      retired: false,
      contextGuard: { blocked: () => false },
      preparationIdentity: { characterId: 'carrier' },
      options: {
        characterId: 'interceptor',
        flightTraits: true,
        airframes: 1,
        slowResume: false,
      },
      compiled: {},
      seed: 42,
      fixture: null,
      reviewBuild: null,
      studio: false,
      resultRun: original,
      overflightFlightProfile,
      mode: {
        createRun(_compiled, options) {
          calls.create++;
          return {
            phase: 'ready',
            airframes: options.airframes,
            slowResume: options.slowResume,
            flight: overflightFlightProfile(options.characterId, options.flightTraits),
          };
        },
        start: (run) => {
          run.phase = 'playing';
        },
      },
      prepare: async () => {
        calls.prepare++;
      },
      releaseInput: noop,
      syncUpgrade: noop,
      showStatus: noop,
      updateShell: noop,
      music: { start: noop },
      sound: { enable: () => Promise.resolve(), pause: noop },
      commentator: { resume: noop, prepare: noop },
      audio: { prepare: noop, start: noop, update: noop },
      shell: {
        enterPlay: () => {
          calls.entered++;
        },
      },
      review: {
        active: () => false,
        reset: () => {
          calls.reviewReset++;
        },
      },
    };
    // Execute production functions, including their call connection. No copied
    // start/continue decision logic or DOM-source substring assumptions.
    runInNewContext(
      `${source.slice(start.start, start.end)}\nglobalThis.begin = start;\nglobalThis.continueContract = (${source.slice(continuation.start, continuation.end)});`,
      context,
    );
    return { context, original, calls };
  };
  const continued = fixture();
  continued.context.continueContract();
  assert.equal(continued.context.run, continued.original);
  assert.equal(continued.calls.create, 0);
  assert.equal(continued.calls.prepare, 0);
  assert.equal(continued.calls.entered, 1);
  assert.equal(continued.calls.reviewReset, 1);
  assert.equal(continued.original.phase, 'playing');
  assert.equal(continued.original.player.hull, 37);
  assert.equal(continued.original.player.maxHull, 120);
  assert.equal(continued.original.airframesRemaining, 2);
  assert.equal(continued.original.raidVariant.contract, 2);
  assert.equal(continued.original.raidVariant.escrow, 1000);
  assert.equal(continued.original.build.hunt['boost-duration'], 2);

  const changedOptions = fixture();
  changedOptions.context.options.characterId = 'carrier';
  changedOptions.context.begin();
  assert.equal(changedOptions.calls.create, 1);
  assert.notEqual(changedOptions.context.run, changedOptions.original);
  assert.equal(changedOptions.context.run.airframes, 1);
  assert.equal(changedOptions.context.run.slowResume, false);
  assert.equal(changedOptions.context.run.phase, 'playing');

  const changedAppearance = fixture();
  changedAppearance.context.begin();
  assert.equal(changedAppearance.calls.prepare, 1);
  assert.equal(changedAppearance.calls.create, 0);
  assert.equal(changedAppearance.original.phase, 'ready');
  await Promise.resolve();
});

test('review stop checkpoints are bounded and require an explicit diagnostic build', () => {
  for (const value of [null, '', 'bad', Infinity, -1, 119.99, 240.01])
    assert.equal(overflightReviewStopAt(value, { build: 'echo', diagnostics: true }), null);
  for (const value of [120, '180', 240])
    assert.equal(
      overflightReviewStopAt(value, { build: 'echo', diagnostics: true }),
      Number(value),
    );
  assert.equal(overflightReviewStopAt(180, { build: null, diagnostics: true }), null);
  assert.equal(overflightReviewStopAt(180, { build: 'echo', diagnostics: false }), null);
});

test('review stop immediately releases all actions, survives replacements, and keeps earned drafts', () => {
  let pilotCalls = 0;
  const review = createOverflightReviewPlayback({
    build: 'echo',
    stopAt: 180,
    pilot() {
      pilotCalls++;
      return { x: 1, y: -1, boost: true, focus: true };
    },
    selectCard: (run) => run.offers[0],
  });
  assert.equal(review.input({ tick: 100, time: 179.99 }).boost, true);
  const neutral = { x: 0, y: 0, boost: false, focus: false };
  assert.deepEqual(review.input({ tick: 101, time: 180 }), neutral);
  assert.deepEqual(review.input({ tick: 102, time: 181, player: { airframes: 2 } }), neutral);
  assert.deepEqual(
    review.input({ tick: 1, time: 0 }),
    neutral,
    'only explicit retry resets the stop',
  );
  assert.equal(pilotCalls, 1);
  const run = {
    phase: 'upgrade',
    progression: { choices: 2, rerolls: 1 },
    offers: [{ id: 'earned' }],
  };
  assert.equal(review.upgrade(run, 100, true).choiceId, null);
  assert.equal(review.upgrade(run, 1600, true).choiceId, 'earned');
  review.reset();
  assert.equal(review.input({ tick: 0, time: 0 }).boost, true);
  assert.equal(pilotCalls, 2);
});

test('native Settings initialization preserves operation cards and navigation on Home', async () => {
  const { readFile } = await import('node:fs/promises');
  const { runInNewContext } = await import('node:vm');
  const { parse } = await import('acorn');
  const { Document } = await import('./helpers/couch-dom.mjs');
  const { mountModePlayShell } = await import('../ui/mode-play-shell.mjs');
  const { mountModeSettings } = await import('../ui/mode-settings-view.mjs');
  const { attachSettingsPanels } = await import('../ui/settings-panels.mjs');
  const { createOverflightOperationCards } = await import('../overflight/operation-view.mjs');
  const source = await readFile(new URL('../overflight/app.mjs', import.meta.url), 'utf8');
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const settings = ast.body.find(
    (node) =>
      node.type === 'ExpressionStatement' &&
      node.expression.type === 'AssignmentExpression' &&
      node.expression.left.name === 'settingsView',
  ).expression.right;
  for (const current of ['overflight', 'overflight-riy', 'overflight-hunt']) {
    const document = new Document();
    const nodes = new Map();
    const get = (id) => {
      if (!nodes.has(id)) {
        const node = document.createElement('section');
        node.id = id;
        document.body.append(node);
        nodes.set(id, node);
      }
      return nodes.get(id);
    };
    const operationCards = createOverflightOperationCards({
      document,
      current,
      text: (key) => key,
      destination: (path) => path,
      onSelect() {},
      onLeave() {},
    });
    const shell = mountModePlayShell({
      document,
      slots: { homeChoices: operationCards.root, settings: get('overflight-settings') },
    });
    const settingsView = runInNewContext(source.slice(settings.start, settings.end), {
      mountModeSettings,
      settingsRoot: shell.elements.dialogs.settings,
      shell,
      operationCards,
      getLocale: () => 'en',
      setMenuIcon() {},
      attachSettingsPanels,
      $: get,
      field: get,
      el: (tag) => document.createElement(tag),
      touchSettings: get('touch-settings'),
      audioCues: get('audio-cues'),
      offlineSettings: get('offline-settings'),
    });
    const cards = operationCards.root.querySelectorAll('[data-home-choice]');
    assert.equal(cards.length, 5);
    for (const card of cards) {
      assert.equal(
        shell.elements.home.contains(card),
        true,
        `${current}: ${card.id} stays on Home`,
      );
      assert.equal(shell.elements.dialogs.settings.contains(card), false);
    }
    assert.equal(settingsView.panels.gameplay.contains(get('difficulty')), true);
    shell.open('settings');
    shell.back();
    assert.equal(shell.elements.home.contains(operationCards.root), true);
    settingsView.destroy();
    shell.dispose();
  }
});

test('a selected demonstration remains manual until opt-in, and takeover stops all automation', () => {
  let piloted = 0,
    drafted = 0;
  const playback = createOverflightReviewPlayback({
    build: 'echo',
    enabled: false,
    pilot: () => {
      piloted++;
      return { x: -1, y: 0, boost: true };
    },
    selectCard: () => {
      drafted++;
      return null;
    },
  });
  const run = { tick: 0, time: 0, phase: 'playing' };
  const manual = { x: 1, y: 0, boost: false };
  assert.equal(playback.active(), false);
  assert.equal(playback.input(run, manual), manual);
  assert.equal(run.review, undefined);
  assert.equal(piloted, 0);
  playback.setEnabled(true);
  assert.equal(playback.input(run, manual).x, -1);
  assert.equal(run.review, true);
  playback.setEnabled(false);
  assert.equal(playback.input(run, manual), manual);
  run.phase = 'upgrade';
  assert.equal(playback.upgrade(run, 100, true), null);
  assert.equal(drafted, 0);
  assert.equal(run.review, true, 'taking over cannot erase automated-run provenance');
  playback.reset();
  assert.equal(playback.active(), false, 'retry stays under manual control after takeover');
});

test('opt-in review traces retain bounded ordinary inputs and snapshots without writing simulation state', () => {
  const run = createOverflightRun(compileOverflightProject(DEFAULT_OVERFLIGHT_PROJECT));
  const initial = structuredClone(run.player);
  const review = createOverflightReviewPlayback({
    build: 'echo',
    trace: true,
    detailTick: 0,
    pilot: () => ({ x: 1, y: 0, boost: false, focus: true }),
    selectCard: () => null,
  });
  review.input(run, {});
  review.input(run, {});
  const receipt = review.traceSnapshot();
  assert.equal(receipt.samples.length, 1, 'cached control frames do not produce duplicate samples');
  assert.equal(receipt.samples[0].tick, 0);
  assert.deepEqual(receipt.samples[0].input, { x: 1, y: 0, boost: false, focus: true });
  assert.deepEqual(receipt.samples[0].player, {
    x: initial.x,
    y: initial.y,
    vx: initial.vx,
    vy: initial.vy,
    heading: initial.heading,
    hull: initial.hull,
    shield: initial.shield,
    boostRemaining: initial.boostRemaining,
    boostCooldown: initial.boostCooldown,
  });
  receipt.samples[0].input.x = -1;
  assert.equal(review.traceSnapshot().samples[0].input.x, 1);
  assert.deepEqual(run.player, initial);
  for (let index = 1; index <= receipt.capacity; index++) {
    run.tick = index * 6;
    review.input(run, {});
  }
  assert.equal(review.traceSnapshot().samples.length, receipt.capacity);
  assert.equal(review.traceSnapshot().dropped, 1);
  assert.equal(review.traceSnapshot().details.length, 2);
  assert.deepEqual(
    review.traceSnapshot().details.map((row) => row.tick),
    [0, 6],
  );
  review.reset();
  assert.deepEqual(review.traceSnapshot().samples, []);
  assert.equal(review.traceSnapshot().dropped, 0);
  const manual = createOverflightReviewPlayback({
    trace: true,
    pilot: () => assert.fail(),
    selectCard: () => null,
  });
  const input = { x: 0, y: 1 };
  assert.equal(manual.input(run, input), input);
  assert.deepEqual(manual.traceSnapshot().samples, []);
  assert.equal(
    createOverflightReviewPlayback({
      build: 'echo',
      pilot: () => ({}),
      selectCard: () => null,
    }).traceSnapshot(),
    null,
  );
});

test('finished review download captures terminal state instead of an older inspector snapshot', async () => {
  const { readFile } = await import('node:fs/promises');
  const { parse } = await import('acorn');
  const { runInNewContext } = await import('node:vm');
  const source = await readFile(new URL('../overflight/app.mjs', import.meta.url), 'utf8');
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const node = ast.body.find(
    (node) => node.type === 'FunctionDeclaration' && node.id.name === 'downloadMeasurements',
  );
  assert.ok(node, 'the final report needs an export callable from inside the results dialog');
  let saved;
  const pauses = [];
  const context = {
    rawPages: { json: JSON.stringify({ phase: 'paused', time: 40 }) },
    completedMeasurement: { phase: 'paused', time: 120 },
    measurement: (options) => {
      assert.equal(options.raw, true);
      return { phase: 'lost', time: 319, reviewTrace: { samples: [{ tick: 19140 }] } };
    },
    pause: (options) => pauses.push(options),
    downloadBlob: (blob, name) => (saved = { blob, name }),
    Blob,
    JSON,
    fixture: null,
    seed: 202604,
  };
  const save = runInNewContext(
    `${source.slice(node.start, node.end)}; downloadMeasurements`,
    context,
  );
  save({ current: true });
  assert.equal(JSON.parse(await saved.blob.text()).phase, 'lost');
  assert.equal(saved.name, 'overflight-sortie-202604.json');
  assert.equal(pauses.length, 1);
  save();
  assert.equal(
    JSON.parse(await saved.blob.text()).time,
    40,
    'the separate frozen inspector download keeps its prior behavior',
  );
  const bindings = ast.body.filter(
    (node) => node.type === 'ExpressionStatement' && node.expression.callee?.name === 'listen',
  );
  for (const [id, options] of [
    ['result-download-metrics', { current: true }],
    ['download-metrics', undefined],
  ]) {
    const binding = bindings.find(
      (node) =>
        node.expression.arguments[0].callee?.name === '$' &&
        node.expression.arguments[0].arguments[0].value === id,
    );
    assert.ok(binding, id);
    const callback = binding.expression.arguments[2];
    let received;
    runInNewContext(`(${source.slice(callback.start, callback.end)})`, {
      downloadMeasurements: (value) => (received = value),
    })({ current: true });
    assert.equal(JSON.stringify(received), JSON.stringify(options));
  }
  for (const name of ['play.html', 'raid.html']) {
    const html = await readFile(new URL(`../overflight/${name}`, import.meta.url), 'utf8');
    assert.match(
      html,
      /<section id="overflight-results">[\s\S]*?id="result-download-metrics"[\s\S]*?<\/section>/,
    );
  }
});
