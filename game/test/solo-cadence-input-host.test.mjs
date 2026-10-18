import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, SoloElement, settle } from './helpers/solo-dom.mjs';
import { activateHostAction } from './helpers/host-action.mjs';
import { createRun, stepRun, releaseInputs, FIXED_DT } from '../core/index.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';
import { snapshotCaptureSession, nativeCaptureSession } from '../capture-presentation-session.mjs';

// Simulated callback schedules exercise the real Solo host and input router.
// These are bounded Node correctness cases, not physical display, gamepad or
// input-latency measurements. Use the serial remote runner's 600s/4GiB bound.
const campaign = JSON.parse(await readFile(new URL('../content/campaign.json', import.meta.url)));
const rates = [30, 40, 45, 60, 90, 120, 144];
const schedules = [
  ...rates.map((hz) => ({ name: `${hz}Hz`, hz, intervals: [1000 / hz] })),
  { name: 'changing-cadence', intervals: rates.map((hz) => 1000 / hz) },
  { name: 'exact-250ms-catch-up', intervals: [250] },
];
const phases = [
  {},
  { direction: 'right', boost: true, action: true, pickup: true },
  { direction: 'left', boost: true },
  { direction: 'right', action: true, pickup: true },
  { direction: 'left' },
];
const sessionKey = 'revealline.suspended.dev.v1';
const checkpoint = (run) => authoritativeCheckpoint(run).hash;

function gamepad() {
  return {
    index: 0,
    id: 'Cadence correctness controller',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
}

function controls(page, source, pad) {
  let previous = {};
  const codes = { right: 'ArrowRight', left: 'ArrowLeft' };
  return (next = {}) => {
    if (source === 'gamepad') {
      pad.axes[0] = next.direction === 'right' ? 1 : next.direction === 'left' ? -1 : 0;
      for (const [index, key] of [
        [0, 'action'],
        [2, 'pickup'],
        [5, 'boost'],
      ]) {
        pad.buttons[index].pressed = !!next[key];
        pad.buttons[index].value = next[key] ? 1 : 0;
      }
    } else {
      if (previous.direction !== next.direction) {
        if (previous.direction) page.key(codes[previous.direction], false);
        if (next.direction) page.key(codes[next.direction]);
      }
      for (const [key, code] of [
        ['boost', 'ShiftLeft'],
        ['action', 'KeyE'],
        ['pickup', 'KeyR'],
      ])
        if (!!previous[key] !== !!next[key]) page.key(code, !!next[key]);
    }
    previous = next;
  };
}

function second(page, schedule) {
  // Each input transition happens AFTER the callback ending the prior second.
  // Do not feed a new input into a callback accounting for the prior interval.
  let elapsed = 0,
    frame = 0;
  if (schedule.hz) {
    for (let index = 1; index <= schedule.hz; index++) {
      const end = (index * 1000) / schedule.hz;
      page.frame(end - elapsed);
      elapsed = end;
    }
    return;
  }
  while (elapsed < 1000) {
    const end = Math.min(1000, elapsed + schedule.intervals[frame++ % schedule.intervals.length]);
    page.frame(end - elapsed);
    elapsed = end;
  }
}

async function start(page, mark = () => {}) {
  mark('start:activate');
  await activateHostAction(page.$('start-button'));
  mark('start:running-wait');
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.frame(0);
  mark('start:ready');
}

async function restart(page, setControls, mark) {
  mark('restart:request');
  setControls();
  page.frame(0);
  const oldRun = page.rendered.run;
  await activateHostAction(page.$('overlay-restart'));
  assert.equal(page.$('restart-dialog').open, true);
  mark('restart:confirm');
  await activateHostAction(page.$('restart-confirm'));
  mark('restart:running-wait');
  await settle(
    () => page.rendered.run !== oldRun && page.doc.body.dataset.flightState === 'running',
  );
  page.frame(0);
  assert.equal(page.rendered.run.tick, 0);
  mark('restart:ready');
}

function savedReplay(page) {
  const raw = page.storage.getItem(sessionKey);
  assert.equal(typeof raw, 'string', 'The real Pause action must save its input recording.');
  const replay = nativeCaptureSession(snapshotCaptureSession(JSON.parse(raw))).replay;
  assert.equal(verifyReplay(replay).match, true, 'The complete saved replay must verify strictly.');
  assert.equal(replay.checkpoint.hash, checkpoint(page.rendered.run));
  return replay;
}

function recordedBehavior(replay) {
  const run = createRun(replay.level, replay.options);
  const counts = { action: 0, pickup: 0, boost: 0, right: 0, left: 0 };
  const edges = { action: [], pickup: [] };
  const effects = { used: [], collected: [], rejected: [], failed: [] };
  let previous = { action: false, pickup: false };
  for (const segment of replay.segments) {
    if (segment.releaseBefore) {
      releaseInputs(run);
      previous = { action: false, pickup: false };
    }
    for (let tick = 0; tick < segment.ticks; tick++) {
      const input = segment.input;
      for (const key of ['action', 'pickup']) {
        if (input[key]) counts[key]++;
        if (input[key] && !previous[key]) edges[key].push(run.tick + 1);
      }
      if (input.boost) counts.boost++;
      if (input.direction === 'left' || input.direction === 'right') counts[input.direction]++;
      stepRun(run, input, FIXED_DT);
      for (const event of run.events) {
        const key = {
          'ability.used': 'used',
          'pickup.collected': 'collected',
          'ability.rejected': 'rejected',
          'player.failed': 'failed',
        }[event.type];
        if (key) effects[key].push(event.tick);
      }
      previous = input;
    }
  }
  if (replay.releaseAfter) releaseInputs(run);
  assert.equal(checkpoint(run), replay.checkpoint.hash);
  return { counts, edges, effects };
}

function phaseRecorder() {
  const began = process.hrtime.bigint();
  const events = [];
  return {
    events,
    mark(phase) {
      // Await boundaries only: bounded diagnostics, no per-frame output.
      if (events.length < 64)
        events.push({ phase, elapsedMs: Number(process.hrtime.bigint() - began) / 1e6 });
    },
  };
}

async function preparedPage(t, source, mark) {
  // Model the browser's synchronous dialog lifecycle, without changing the
  // real confirmed Restart handler, preparation, focus or run ownership.
  const showModal = SoloElement.prototype.showModal;
  t.mock.method(SoloElement.prototype, 'showModal', function () {
    if (this.open) return;
    this.emit('beforetoggle', { oldState: 'closed', newState: 'open', bubbles: false });
    showModal.call(this);
  });
  const pad = gamepad();
  mark('fixture:open');
  const page = await soloPage(t, {
    campaign,
    readPads: () => (source === 'gamepad' ? [pad] : []),
  });
  mark('fixture:class');
  page.change('class-select', 'bomber');
  await settle(() => page.rendered.run.classId === 'bomber' && !page.$('start-button').disabled);
  const setControls = controls(page, source, pad);
  if (source === 'gamepad') {
    // Solo auto-joins a neutral controller. A face-button press here would
    // already Confirm Start, so retain one ordinary public Start action.
    page.frame(0);
  }
  await start(page, mark);
  return { page, setControls, pad };
}

for (const activation of ['Menu', 'Confirm']) {
  test(`actual Solo controller ${activation} Resume cannot spend the paused callback interval`, async (t) => {
    const { page, setControls, pad } = await preparedPage(t, 'gamepad', () => {});
    page.frame(1000 / 60);
    await activateHostAction(page.$('pause-button'));
    page.frame(0);
    const run = page.rendered.run,
      before = checkpoint(run),
      beforeTick = run.tick,
      reference = structuredClone(run);
    assert.equal(page.doc.body.dataset.flightState, 'paused');
    page.$('start-button').focus();
    const button = pad.buttons[activation === 'Menu' ? 9 : 0];
    button.pressed = true;
    button.value = 1;
    if (activation === 'Confirm') {
      // Actual Confirm owns the press and commits the visible Resume on release.
      page.frame(0);
      assert.equal(page.doc.body.dataset.flightState, 'paused');
      assert.equal(checkpoint(run), before);
      button.pressed = false;
      button.value = 0;
    }
    const reads = page.padReads;
    page.frame(100);
    assert.ok(page.padReads > reads, 'The paused callback still polls the real controller.');
    assert.equal(
      page.doc.body.dataset.flightState,
      'running',
      'Cached Resume commits in this callback.',
    );
    assert.ok(page.rendered.run === run, 'Resume keeps the accepted run.');
    assert.equal(checkpoint(run), before, 'The 100 ms before Resume is not gameplay time.');
    button.pressed = false;
    button.value = 0;
    page.frame(1000 / 60);
    assert.equal(
      checkpoint(run),
      before,
      'The first active clock sample only establishes its boundary.',
    );
    setControls({ boost: true, action: true, pickup: true });
    page.frame(FIXED_DT * 1000);
    stepRun(reference, {}, FIXED_DT);
    assert.equal(
      checkpoint(run),
      checkpoint(reference),
      'The first real tick preserves neutral Resume input.',
    );
    page.frame(FIXED_DT * 1000);
    stepRun(reference, { boost: true, action: true, pickup: true }, FIXED_DT);
    assert.equal(run.tick, beforeTick + 2, 'Only fresh 120 Hz intervals advance simulation.');
    assert.equal(checkpoint(run), checkpoint(reference));
    setControls();
    page.frame(0);
    await activateHostAction(page.$('pause-button'));
    const replay = savedReplay(page),
      behavior = recordedBehavior(replay);
    assert.deepEqual(behavior.edges, { action: [beforeTick + 2], pickup: [beforeTick + 2] });
    assert.equal(behavior.counts.boost, 1);
    assert.equal(replay.checkpoint.hash, checkpoint(reference));
    assert.deepEqual(page.errors, []);
  });
}

for (const source of ['keyboard', 'gamepad']) {
  test(
    `actual Solo ${source} movement and discrete edges survive simulated display cadence and catch-up`,
    { timeout: 240000 },
    async (t) => {
      const phase = phaseRecorder();
      t.after(() => t.diagnostic(JSON.stringify({ source, phases: phase.events })));
      const { page, setControls } = await preparedPage(t, source, phase.mark);
      const initial = checkpoint(page.rendered.run);
      let expectedFinal;
      const observations = [];
      t.after(() =>
        t.diagnostic(
          JSON.stringify({
            source,
            scope: 'simulated cadence correctness only',
            plannedSchedules: schedules.map((schedule) => schedule.name),
            observations,
          }),
        ),
      );
      for (const [index, schedule] of schedules.entries()) {
        if (index) await restart(page, setControls, phase.mark);
        assert.equal(
          checkpoint(page.rendered.run),
          initial,
          `${schedule.name}: same accepted initial state`,
        );
        const reference = structuredClone(page.rendered.run);
        const originalLives = reference.lives;
        for (const [phase, command] of phases.entries()) {
          setControls(command);
          second(page, schedule);
          // Independent core expectation: one pulse at each declared edge.
          // Sampled holds may span more ticks, but cannot retrigger an ability.
          for (let tick = 0; tick < 120; tick++)
            stepRun(
              reference,
              {
                ...command,
                action: !!command.action && tick === 0,
                pickup: !!command.pickup && tick === 0,
              },
              FIXED_DT,
            );
          assert.equal(page.rendered.run.tick, (phase + 1) * 120, schedule.name);
          if (!command.action)
            assert.equal(
              checkpoint(page.rendered.run),
              checkpoint(reference),
              `${schedule.name}: authoritative state agrees after released boundary ${phase + 1}s`,
            );
        }
        assert.equal(page.rendered.run.status, 'running');
        assert.equal(page.rendered.run.lives, originalLives);
        assert.equal(page.rendered.run.trail.length, 0);
        assert.equal(page.rendered.run.player.y, reference.level.spawn.y);
        expectedFinal ??= checkpoint(reference);
        assert.equal(
          checkpoint(reference),
          expectedFinal,
          'Every schedule uses the same declared core commands.',
        );
        phase.mark('pause:save');
        await activateHostAction(page.$('pause-button'));
        phase.mark('pause:saved');
        const replay = savedReplay(page);
        assert.equal(replay.checkpoint.hash, expectedFinal);
        const behavior = recordedBehavior(replay);
        assert.deepEqual(behavior.edges, { action: [121, 361], pickup: [121, 361] });
        assert.deepEqual(behavior.effects, {
          used: [121, 361],
          collected: [121, 361],
          rejected: [],
          failed: [],
        });
        assert.equal(behavior.counts.boost, 240);
        assert.equal(behavior.counts.right, 240);
        assert.equal(behavior.counts.left, 240);
        if (source === 'gamepad') {
          assert.equal(
            behavior.counts.action,
            240,
            'Held gamepad action keeps its sampled-hold semantics.',
          );
          assert.equal(behavior.counts.pickup, 240);
        } else {
          assert.ok(behavior.counts.action >= 2 && behavior.counts.action < 240);
          assert.ok(behavior.counts.pickup >= 2 && behavior.counts.pickup < 240);
        }
        observations.push({
          schedule: schedule.name,
          ticks: replay.ticks,
          checkpoint: replay.checkpoint.hash,
          ...behavior,
        });
      }
      assert.equal(
        page.errors.length,
        0,
        page.errors
          .slice(0, 8)
          .map((error) => String(error).slice(0, 500))
          .join('\n'),
      );
    },
  );
  test(
    `actual Solo ${source} interruption discards stale discrete input and resumes with a fresh edge`,
    { timeout: 240000 },
    async (t) => {
      const phase = phaseRecorder();
      let interruption = null;
      t.after(() =>
        t.diagnostic(
          JSON.stringify({
            source,
            scope: 'independent simulated interruption correctness only',
            phases: phase.events,
            interruption,
          }),
        ),
      );
      const { page, setControls } = await preparedPage(t, source, phase.mark);
      // The >250ms path must discard unconsumed discrete gestures, not turn
      // hidden elapsed time or a stale edge into new gameplay after Resume.
      second(
        page,
        schedules.find((schedule) => schedule.name === '60Hz'),
      );
      const reference = structuredClone(page.rendered.run);
      setControls({ action: true, pickup: true });
      page.frame(251);
      assert.equal(page.doc.body.dataset.flightState, 'paused');
      assert.equal(checkpoint(page.rendered.run), checkpoint(reference));
      page.frame(10000);
      assert.equal(checkpoint(page.rendered.run), checkpoint(reference));
      setControls();
      await start(page, phase.mark);
      page.frame(250);
      for (let tick = 0; tick < 30; tick++) stepRun(reference, {}, FIXED_DT);
      assert.equal(checkpoint(page.rendered.run), checkpoint(reference));
      setControls({ action: true, pickup: true });
      page.frame(250);
      for (let tick = 0; tick < 30; tick++)
        stepRun(reference, { action: tick === 0, pickup: tick === 0 }, FIXED_DT);
      setControls();
      page.frame(250);
      for (let tick = 0; tick < 30; tick++) stepRun(reference, {}, FIXED_DT);
      assert.equal(checkpoint(page.rendered.run), checkpoint(reference));
      phase.mark('pause:save');
      await activateHostAction(page.$('pause-button'));
      phase.mark('pause:saved');
      const replay = savedReplay(page);
      const behavior = recordedBehavior(replay);
      assert.deepEqual(behavior.edges, { action: [151], pickup: [151] });
      assert.deepEqual(behavior.effects, {
        used: [151],
        collected: [151],
        rejected: [],
        failed: [],
      });
      assert.equal(replay.ticks, 210);
      assert.equal(replay.checkpoint.hash, checkpoint(reference));
      assert.equal(
        page.errors.length,
        0,
        page.errors
          .slice(0, 8)
          .map((error) => String(error).slice(0, 500))
          .join('\n'),
      );
      interruption = { gapMs: 251, acceptedCatchUpMs: 250, ticks: replay.ticks, ...behavior };
    },
  );
}
