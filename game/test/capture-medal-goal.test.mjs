import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, stepRun, FIXED_DT, getSummary } from '../core/index.mjs';
import { EPS } from '../core/geometry.mjs';
import { createRecorder, recordInput, exportReplay, verifyReplay } from '../replay.mjs';
import { captureMedalGoal, captureMedalGoalCopy } from '../ui/capture-medal-goal.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

const level = {
  version: 'xonix-level.v4',
  id: 'medal-goal',
  revision: '1',
  name: 'Medal goal',
  width: 72,
  height: 36,
  encounter: null,
  classic: {
    version: 'classic.v1',
    terrain: [],
    powerups: [{ id: 'life', kind: 'extra-life', x: 60.5, y: 15.5 }],
  },
  spawn: { x: 60.5, y: 0.5 },
  goal: { coverage: 0.1 },
  enemies: [{ id: 'seed', type: 'bouncer', x: 20.5, y: 18.5, vx: 0, vy: 0 }],
  rules: { lives: 3, respawnSeconds: 0.1, graceSeconds: 0 },
};
function flight({ lose = false, thresholds, classic = true } = {}) {
  const source = structuredClone(level);
  if (thresholds) source.rules.timeMedals = thresholds;
  if (!classic) {
    source.version = 'xonix-level.v1';
    source.width = 48;
    source.spawn = { x: 40.5, y: 0.5 };
    delete source.classic;
    delete source.encounter;
  }
  const options = { seed: 1 },
    run = createRun(source, options),
    recorder = createRecorder(source, options, 'medal-goal-native');
  const step = (direction) => {
    const input = { direction };
    stepRun(run, input, FIXED_DT);
    recordInput(recorder, input);
  };
  if (lose) {
    for (let i = 0; i < 35; i++) step('down');
    for (let i = 0; i < 35 && run.status === 'running'; i++) step('up');
    assert.equal(run.status, 'respawning');
    while (run.status === 'respawning') step(null);
  }
  for (let i = 0; i < 700 && run.status === 'running'; i++) step('down');
  assert.equal(run.status, 'won');
  const replay = exportReplay(recorder, run);
  assert.equal(verifyReplay(replay).match, true);
  return { run, replay };
}

test('legal Capture medals explain the next native threshold without changing the result or replay', () => {
  for (const [thresholds, medal, next] of [
    [[1, 2], 'bronze', 'silver'],
    [[1, 100], 'silver', 'gold'],
    [[90, 150], 'gold', null],
  ]) {
    const { run, replay } = flight({ thresholds }),
      before = JSON.stringify(run),
      summary = getSummary(run);
    assert.equal(run.medal, medal);
    const goal = captureMedalGoal(run);
    assert.ok(Object.isFrozen(goal));
    if (next) {
      assert.equal(goal.medal, next);
      assert.equal(goal.target, next === 'gold' ? 1 : 2);
      assert.equal(goal.shortfall, run.time - goal.target);
      assert.equal(goal.clean, next === 'gold' ? true : null);
    } else assert.deepEqual(goal, { state: 'highest' });
    assert.equal(JSON.stringify(run), before);
    assert.deepEqual(getSummary(run), summary);
    assert.equal(verifyReplay(replay).match, true);
  }
});

test('a legally replaced lost life does not claim the Gold clean condition, in either native rule branch', () => {
  for (const classic of [true, false]) {
    const { run } = flight({ lose: true, classic }),
      before = JSON.stringify(run);
    assert.equal(run.medal, 'silver');
    assert.equal(run.lives, classic ? 3 : 2);
    if (classic) assert.equal(run.classic.livesLost, 1);
    assert.deepEqual(captureMedalGoal(run), {
      state: 'next',
      medal: 'gold',
      target: 90,
      clean: false,
      shortfall: 0,
    });
    assert.equal(JSON.stringify(run), before);
  }
});

test('native EPS acceptance and a positive miss remain distinct across identical legal routes', () => {
  const time = flight().run.time;
  const accepted = flight({ thresholds: [time - EPS / 2, 100] }).run;
  assert.equal(accepted.medal, 'gold');
  assert.deepEqual(captureMedalGoal(accepted), { state: 'highest' });
  const missed = flight({ thresholds: [time - EPS * 2, 100] }).run;
  assert.equal(missed.medal, 'silver');
  assert.ok(captureMedalGoal(missed).shortfall > EPS);
  assert.ok(captureMedalGoal(missed).shortfall < 0.01);
});

test('EN/UK distinguish the time gap and clean-life condition, with fractional targets and tiny-positive wording', (t) => {
  const locale = getLocale();
  t.after(() => setLocale(locale, { persist: false }));
  const missed = flight({ thresholds: [4.125, 100] }).run,
    recovered = flight({ lose: true }).run,
    tiny = flight({ thresholds: [flight().run.time - 0.000001, 100] }).run;
  const snapshots = [missed, recovered, tiny].map((run) => JSON.stringify(run));
  for (const language of ['en', 'uk', 'en']) {
    setLocale(language, { persist: false });
    assert.match(
      captureMedalGoalCopy(missed),
      language === 'en'
        ? /Next: Gold.*4\.125 s.*rounded up.*No lives lost/
        : /золото.*4,125 с.*округлено вгору.*не втрачено/,
    );
    assert.match(
      captureMedalGoalCopy(recovered),
      language === 'en' ? /time already meets.*life was lost/ : /час уже відповідає.*було втрачено/,
    );
    assert.match(
      captureMedalGoalCopy(tiny),
      language === 'en' ? /Less than 0.01 s/ : /менш ніж на 0,01 с/,
    );
    assert.doesNotMatch(captureMedalGoalCopy(tiny), /by 0 s|на 0 с/);
    assert.deepEqual(
      [missed, recovered, tiny].map((run) => JSON.stringify(run)),
      snapshots,
    );
  }
});

test('nonterminal and unavailable comparison facts never advertise an earned or attainable medal', () => {
  assert.equal(captureMedalGoal(null), null);
  assert.equal(captureMedalGoal({ status: 'lost' }), null);
  const run = flight({ thresholds: [1, 100] }).run;
  for (const patch of [
    { time: NaN },
    { medal: null },
    { rules: { timeMedals: [90] } },
    { classic: { livesLost: undefined } },
  ])
    assert.deepEqual(captureMedalGoal({ ...run, ...patch }), { state: 'unavailable' });
});
