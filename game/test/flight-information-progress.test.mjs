import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, stepRun, FIXED_DT, CELL } from '../core/index.mjs';
import { EPS } from '../core/geometry.mjs';
import { flightInformationSnapshot } from '../ui/flight-information-source.mjs';
import { flightDetailsModel } from '../ui/flight-information-details.mjs';
import { setLocale } from '../i18n/index.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';
import { combatLevel } from './helpers/combat-fixture.mjs';
import { prepareHuntLevel } from '../hunt/level.mjs';

const context = { mission: 'Accepted mission', goal: '', steering: '', actions: [] };
const snapshot = (run) => flightInformationSnapshot(run, { started: true, paused: true });
const lines = (value) =>
  flightDetailsModel({ snapshot: value }, context).find((part) => part.id === 'progress').lines;
const capture = (target = 0.65) => {
  const run = createRun({
    ...retryFixture('self-contact').level,
    goal: { coverage: target },
    rules: { lives: 3 },
    objectives: [{ id: 'remaining', x: 40.5, y: 15.5, required: true }],
  });
  for (let count = 0; count < 1000 && !run.coverage; count++)
    stepRun(run, { direction: 'down' }, FIXED_DT);
  assert.ok(run.coverage > 0 && run.coverage < 0.65, 'a legal cut earns partial reveal');
  return run;
};

test('earned partial coverage retains exact accepted progress while EN/UK details show the picture remainder', (t) => {
  t.after(() => setLocale('en', { persist: false }));
  const run = capture(),
    before = JSON.stringify(run),
    value = snapshot(run);
  assert.deepEqual(value.progress, {
    kind: 'coverage',
    basis: 'picture',
    current: run.coverage,
    target: 0.65,
    remaining: 0.65 - run.coverage,
  });
  assert.equal(Object.isFrozen(value.progress), true);
  setLocale('en', { persist: false });
  assert.deepEqual(lines(value), [
    'Picture revealed: 13%.',
    'Reveal target: 65% of the picture.',
    'Still to reveal: 52% of the picture.',
  ]);
  setLocale('uk', { persist: false });
  assert.deepEqual(lines(value), [
    'Відкрито зображення: 13%.',
    'Ціль відкриття: 65% зображення.',
    'Ще потрібно відкрити: 52% зображення.',
  ]);
  assert.equal(
    JSON.stringify(run),
    before,
    'reading and translating do not alter the accepted run',
  );
});

test('the reached reveal target does not imply that remaining required objectives or the mission are complete', (t) => {
  setLocale('en', { persist: false });
  t.after(() => setLocale('en', { persist: false }));
  const run = capture(0.1),
    value = snapshot(run);
  assert.equal(run.status, 'running');
  assert.deepEqual(value.objectives, { done: 0, total: 1 });
  assert.equal(value.progress.remaining, 0);
  assert.match(lines(value).join(' '), /Reveal target reached.*remaining required objectives/);
  assert.doesNotMatch(lines(value).join(' '), /Mission complete|Still to reveal/);
});

test('small positive remainders never round to zero and the native goal tolerance remains unchanged', (t) => {
  t.after(() => setLocale('en', { persist: false }));
  // Deliberate presentation-boundary scalars; these are not an earned-play receipt.
  const run = capture();
  run.coverage = 0.65 - 0.00001;
  for (const locale of ['en', 'uk']) {
    setLocale(locale, { persist: false });
    const value = snapshot(run);
    assert.ok(value.progress.remaining > 0);
    assert.match(lines(value).at(-1), locale === 'en' ? /Less than 0.1%/ : /менше ніж 0,1%/);
  }
  run.coverage = 0.65 - EPS / 2;
  assert.equal(snapshot(run).progress.remaining, 0);
});

test('Hunt uses its admitted quota and accepted kills instead of a reveal goal; bonus Hunt still uses coverage', (t) => {
  setLocale('en', { persist: false });
  t.after(() => setLocale('en', { persist: false }));
  for (const mode of ['hunt', 'bonus']) {
    const source = combatLevel('scout'),
      actors = structuredClone(source.classic.combatPatrols.actors);
    actors[0].turnTicks = 60;
    const run = createRun(
      prepareHuntLevel(source, {
        id: 'progress-hunt-fixture',
        revision: '1',
        actors,
        hunt: {
          version: 'humanoid-hunt.v1',
          mode,
          quota: mode === 'hunt' ? 1 : 0,
          targets: [{ id: actors[0].id, kind: 'runner' }],
        },
      }),
    );
    const value = snapshot(run);
    if (mode === 'hunt') {
      assert.deepEqual(value.progress, {
        kind: 'hunt',
        basis: 'targets',
        current: 0,
        target: 1,
        remaining: 1,
      });
      assert.deepEqual(lines(value), ['Targets defeated: 0 / 1.']);
      setLocale('uk', { persist: false });
      assert.deepEqual(lines(value), ['Знешкоджено цілей: 0 / 1.']);
      setLocale('en', { persist: false });
      run.classic.hunt.kills = NaN;
      assert.equal(snapshot(run).progress.current, null);
      assert.deepEqual(lines(snapshot(run)), ['Some mission progress is unavailable.']);
    } else {
      assert.equal(value.progress.kind, 'coverage');
      assert.equal(value.progress.target, source.goal.coverage);
      assert.match(lines(value).join(' '), /Reveal target/);
    }
  }
});

test('legal routed capture reports the fixed eligible-route budget rather than the picture area', (t) => {
  t.after(() => setLocale('en', { persist: false }));
  const run = createRun({
    ...retryFixture('self-contact').level,
    version: 'xonix-level.v4',
    width: 72,
    encounter: null,
    goal: { coverage: 0.65 },
    rules: { lives: 3 },
    enemies: [{ id: 'remote', type: 'bouncer', x: 60.5, y: 28.5, vx: 0, vy: 0 }],
    classic: {
      version: 'classic.v1',
      coverage: { version: 'reachable-routes.v1' },
      terrain: [{ id: 'pocket', kind: 'lethal', x: 30, y: 10, w: 4, h: 4 }],
      powerups: [],
    },
  });
  const pictureFieldCells = run.cells.filter((cell) => cell === CELL.FIELD).length;
  assert.equal(run.classic.coverageExcluded, 16);
  assert.equal(run.totalClaimable + run.classic.coverageExcluded, pictureFieldCells);
  for (let count = 0; count < 1000 && !run.coverage; count++)
    stepRun(run, { direction: 'down' }, FIXED_DT);
  assert.equal(run.status, 'running');
  assert.ok(run.coverage > 0 && run.coverage < 0.65);
  assert.equal(run.coverage, run.claimedCount / run.totalClaimable);
  assert.notEqual(run.coverage, run.claimedCount / pictureFieldCells);
  const before = JSON.stringify(run),
    value = snapshot(run);
  assert.equal(value.progress.basis, 'routes');
  for (const locale of ['en', 'uk']) {
    setLocale(locale, { persist: false });
    const actual = lines(value).join(' ');
    assert.match(
      actual,
      locale === 'en' ? /Reachable routes captured: 8.6%/ : /Захоплено доступних маршрутів: 8,6%/,
    );
    assert.match(
      actual,
      locale === 'en' ? /56.4% of reachable routes/ : /56,4% доступних маршрутів/,
    );
    assert.match(actual, locale === 'en' ? /Hazard pockets are bonus/ : /Небезпечні ділянки/);
    assert.doesNotMatch(actual, /of the picture|зображення:|% зображення/);
  }
  assert.equal(JSON.stringify(run), before);
  // Presentation boundary checks for route precision and unavailable future policies.
  run.coverage = 0.65 - 0.00001;
  for (const locale of ['en', 'uk']) {
    setLocale(locale, { persist: false });
    assert.match(
      lines(snapshot(run))[2],
      locale === 'en' ? /Less than 0.1% of reachable routes/ : /менше ніж 0,1% доступних маршрутів/,
    );
  }
  run.coverage = 0.65;
  assert.match(lines(snapshot(run))[2], /Ціль захоплення маршрутів досягнуто/);
  run.level.classic.coverage.version = 'unknown-policy';
  assert.equal(snapshot(run).progress.basis, null);
  assert.deepEqual(lines(snapshot(run)), ['Частина даних про прогрес місії недоступна.']);
});

test('missing or invalid coverage facts remain unavailable without invented completion or nonfinite text', (t) => {
  setLocale('en', { persist: false });
  t.after(() => setLocale('en', { persist: false }));
  for (const invalid of [undefined, null, NaN, Infinity, -1, 1.1]) {
    const run = capture();
    run.coverage = invalid;
    let value = snapshot(run);
    assert.equal(value.progress.current, null);
    assert.equal(value.progress.remaining, null);
    assert.deepEqual(lines(value), [
      'Reveal target: 65% of the picture.',
      'Some mission progress is unavailable.',
    ]);
    run.coverage = 0.25;
    run.level.goal.coverage = invalid;
    value = snapshot(run);
    assert.equal(value.progress.target, null);
    assert.deepEqual(lines(value), [
      'Picture revealed: 25%.',
      'Some mission progress is unavailable.',
    ]);
    assert.doesNotMatch(lines(value).join(' '), /NaN|Infinity|undefined|target reached/);
  }
});
