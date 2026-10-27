import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { OVERFLIGHT_HUNT_MODE } from '../overflight/raid-mode.mjs';
import {
  createOverflightHuntProject,
  compileOverflightHuntProject,
} from '../overflight/raid-project.mjs';
import { createOverflightHuntReviewPilot } from '../overflight/raid-review-pilot.mjs';
import {
  createOverflightRaidVariant,
  overflightTimeAttackResult,
  overflightTimeAttackMedalGoal,
  overflightRaidMedalTime,
  overflightRaidVariantRecord,
} from '../overflight/raid-variants.mjs';

const modeFor = (variant = 'time-attack') =>
  createOverflightRaidVariant(OVERFLIGHT_HUNT_MODE, { variant });
function runFor(mode, budgets) {
  const source = createOverflightHuntProject({ seed: 42, rulesVersion: 3 });
  if (budgets) source.medalBudgets = { ...source.medalBudgets, ...budgets };
  return mode.createRun(compileOverflightHuntProject(source));
}
// Explicit terminal-value fixtures qualify presentation boundaries, not earned
// gameplay. The final case below reaches a native terminal through legal inputs.
function terminal(run, time, damage = 0, phase = 'won') {
  run.phase = phase;
  run.time = time;
  run.stats.damageTaken = damage;
  return run;
}
function resultView(mode, run) {
  const document = new Document();
  document.documentElement.lang = 'en';
  document.defaultView.requestAnimationFrame = (callback) => callback();
  for (const id of [
    'overflight-results',
    'result-title',
    'result-kicker',
    'result-message',
    'result-stats',
    'result-milestones',
    'result-build',
    'raid-records',
  ]) {
    const node = document.createElement(id === 'result-stats' ? 'dl' : 'div');
    node.id = id;
    document.body.append(node);
  }
  const writes = [];
  const records = {
    record: async (snapshot) => {
      writes.push(structuredClone(snapshot));
      return {
        durable: true,
        fastestClear: { time: snapshot.time },
        bestScore: { score: snapshot.hunt.score },
      };
    },
  };
  return {
    document,
    writes,
    render(locale = 'en') {
      document.documentElement.lang = locale;
      mode.renderResults({
        run,
        document,
        records,
        text: (key) => mode.text(locale, key),
        local: (value) => value[locale],
        formatTime: String,
        moduleIcon: () => document.createElement('span'),
      });
      return Object.fromEntries(
        [...document.getElementById('result-stats').children].map((row) => [
          row.children[0].textContent,
          row.children[1].textContent,
        ]),
      );
    },
  };
}

test('next-medal facts use the native exact result and authored thresholds, without changing the run', () => {
  const mode = modeFor(),
    run = runFor(mode, { gold: 80.125, silver: 120.5, bronze: 190.75 });
  for (const [time, damage, expected] of [
    [80.125, 0, { state: 'highest' }],
    [
      80.1250000001,
      0,
      { state: 'next', medal: 'gold', target: 80.125, shortfall: 80.1250000001 - 80.125 },
    ],
    [80, 1, { state: 'next', medal: 'gold', target: 80.125, shortfall: 0.125 }],
    [120.5, 0, { state: 'next', medal: 'gold', target: 80.125, shortfall: 40.375 }],
    [120.50001, 0, { state: 'next', medal: 'silver', target: 120.5, shortfall: 120.50001 - 120.5 }],
    [190.751, 0, { state: 'next', medal: 'bronze', target: 190.75, shortfall: 190.751 - 190.75 }],
  ]) {
    terminal(run, time, damage);
    const before = JSON.stringify(run),
      native = overflightTimeAttackResult(run),
      goal = overflightTimeAttackMedalGoal(run);
    assert.deepEqual(goal, expected);
    assert.ok(Object.isFrozen(goal));
    assert.deepEqual(overflightTimeAttackResult(run), native);
    assert.equal(JSON.stringify(run), before);
  }
});

test('incomplete, best-medal, legacy-default and unavailable boundaries never promise an unearned medal', () => {
  const mode = modeFor(),
    run = terminal(runFor(mode), 1, 0, 'lost');
  assert.deepEqual(overflightTimeAttackMedalGoal(run), { state: 'incomplete' });
  assert.equal(overflightTimeAttackResult(run).medal, 'failed');
  const legacy = mode.createRun(
    compileOverflightHuntProject(createOverflightHuntProject({ seed: 42 })),
  );
  terminal(legacy, 91);
  assert.deepEqual(overflightTimeAttackMedalGoal(legacy), {
    state: 'next',
    medal: 'gold',
    target: 90,
    shortfall: 1,
  });
  for (const bad of [
    null,
    { ...run, time: NaN },
    { ...run, time: -1 },
    { ...run, stats: { damageTaken: Infinity } },
    { ...run, compiled: { medalBudgets: { gold: 100, silver: 90, bronze: 150 } } },
    { ...run, compiled: { medalBudgets: { gold: 100, silver: 150 } } },
  ])
    assert.deepEqual(overflightTimeAttackMedalGoal(bad), { state: 'unavailable' });
});

test('actual native result view separates raw time, penalty and medal time, and localizes the prospective target', async () => {
  const mode = modeFor(),
    run = terminal(runFor(mode, { gold: 90, silver: 150, bronze: 240 }), 85.125, 20.5),
    before = JSON.stringify(run),
    view = resultView(mode, run);
  const en = view.render();
  assert.equal(en['Flight time before penalty'], '1:25.13');
  assert.equal(en['Damage penalty'], '+5.13 s');
  assert.equal(en['Medal time'], '1:30.25');
  assert.match(en['Next medal'], /^Gold: 90 s or less\. Reduce medal time by 0.25 s/);
  assert.match(en['Next medal'], /rounded up to 0.01 s.*unrounded values/);
  const uk = view.render('uk');
  assert.equal(uk['Час польоту без штрафу'], '1:25,13');
  assert.equal(uk['Штраф за шкоду'], '+5,13 с');
  assert.equal(uk['Заліковий час'], '1:30,25');
  assert.match(
    uk['Наступна медаль'],
    /^Золото: не більше 90 с\. Скоротіть заліковий час на 0,25 с/,
  );
  assert.match(uk['Наступна медаль'], /неокругленими значеннями/);
  assert.deepEqual(view.render('en'), en);
  assert.equal(JSON.stringify(run), before);
  assert.equal(view.writes.length, 1, 'locale refresh keeps the existing result write owner');
  assert.deepEqual(view.writes[0], overflightRaidVariantRecord(run));
  await Promise.resolve();
});

test('tiny positive misses cannot display zero, and ordinary shortfalls round up instead of underpromising', () => {
  const mode = modeFor();
  for (const [time, expected] of [
    [90.000001, /Less than 0.01 s over/],
    [90.121, /by 0.13 s/],
  ]) {
    const run = terminal(runFor(mode, { gold: 90, silver: 150, bronze: 240 }), time),
      view = resultView(mode, run),
      rows = view.render();
    assert.equal(overflightTimeAttackResult(run).medal, 'silver');
    assert.match(rows['Next medal'], expected);
    assert.doesNotMatch(rows['Next medal'], /by 0(?:\.00)? s/);
    if (time < 90.01) {
      assert.equal(rows['Medal time'], overflightRaidMedalTime(90));
      assert.match(view.render('uk')['Наступна медаль'], /менш ніж на 0,01 с/);
    }
  }
  const fractional = terminal(runFor(mode, { gold: 80.125, silver: 120.5, bronze: 190.75 }), 81);
  assert.match(resultView(mode, fractional).render('uk')['Наступна медаль'], /не більше 80,125 с/);
});

test('Gold and failed results have truthful goal text; Marathon does not inherit Time Attack goals', () => {
  for (const locale of ['en', 'uk']) {
    const mode = modeFor(),
      run = terminal(runFor(mode), 1),
      view = resultView(mode, run);
    const best = view.render(locale);
    assert.match(
      best[locale === 'uk' ? 'Мета для медалі' : 'Medal goal'],
      locale === 'uk' ? /найвища медаль/ : /highest medal/,
    );
    assert.equal(best[locale === 'uk' ? 'Наступна медаль' : 'Next medal'], undefined);
    run.phase = 'lost';
    assert.match(
      view.render(locale)[locale === 'uk' ? 'Мета для медалі' : 'Medal goal'],
      locale === 'uk' ? /Завершіть виліт/ : /Complete the sortie/,
    );
    const marathon = modeFor('marathon'),
      marathonRun = terminal(runFor(marathon), 1);
    const rows = resultView(marathon, marathonRun).render(locale);
    assert.equal(rows[locale === 'uk' ? 'Мета для медалі' : 'Medal goal'], undefined);
    assert.equal(rows[locale === 'uk' ? 'Наступна медаль' : 'Next medal'], undefined);
  }
});

test('a legal native completed sortie keeps exact result and record snapshots through EN/UK rendering', async () => {
  const mode = modeFor(),
    run = mode.createRun(compileOverflightHuntProject(createOverflightHuntProject({ seed: 42 }))),
    pilot = createOverflightHuntReviewPilot({ route: 'objectives', build: 'pursuer' });
  mode.start(run);
  while (['playing', 'upgrade'].includes(run.phase) && run.time < 180) {
    if (run.phase === 'upgrade') assert.equal(mode.choose(run, pilot.choose(run).id), true);
    else mode.step(run, pilot.input(run));
  }
  assert.equal(run.phase, 'won');
  assert.ok(run.hunt.objectivesCompleted > 0);
  const before = JSON.stringify(run),
    native = overflightTimeAttackResult(run),
    expectedRecord = overflightRaidVariantRecord(run),
    view = resultView(mode, run);
  for (const locale of ['en', 'uk', 'en']) {
    view.render(locale);
    assert.equal(JSON.stringify(run), before);
    assert.deepEqual(overflightTimeAttackResult(run), native);
  }
  assert.equal(view.writes.length, 1);
  assert.deepEqual(view.writes[0], expectedRecord);
  await Promise.resolve();
});
