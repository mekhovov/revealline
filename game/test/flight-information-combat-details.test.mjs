import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../core/index.mjs';
import { authoritativeCheckpoint, createRecorder, exportReplay, verifyReplay } from '../replay.mjs';
import { combatView } from '../ui/combat-view.mjs';
import { flightInformationSnapshot, flightEventKind } from '../ui/flight-information-source.mjs';
import { flightDetailsModel } from '../ui/flight-information-details.mjs';
import { createCombatCandidates } from '../content-design/combat-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { getLocale, setLocale, t } from '../i18n/index.mjs';
import { combatLevel, combat, patrol, ticks } from './helpers/combat-fixture.mjs';

const context = {
  mission: 'Optional patrol details',
  goal: 'Reveal',
  steering: 'Immediate',
  actions: [],
};
const read = (run, paused = true) => {
  const before = authoritativeCheckpoint(run),
    snapshot = flightInformationSnapshot(run, { started: true, paused }),
    sections = flightDetailsModel({ snapshot }, context);
  assert.deepEqual(authoritativeCheckpoint(run), before, 'Reading never changes the run.');
  return { snapshot, sections, optional: sections.find((part) => part.id === 'optional-patrols') };
};
const text = (value) => value.optional?.lines.join('\n') ?? '';

test('compiled optional candidates share the same paused projection as compatible ordinary levels', () => {
  const source = createCombatCandidates(),
    before = JSON.stringify(source),
    compiled = compileContentProject(source);
  for (const id of ['workshop-sweep', 'sentry-detour', 'two-bay-service']) {
    const level = resolveMission(compiled, id).level,
      run = createRun(level),
      value = read(run);
    assert.deepEqual(value.snapshot.combat, combatView(run));
    assert.ok(value.optional);
    assert.match(text(value), /Touch or enclose (a bracketed body|bracketed scouts)/);
    assert.equal(Object.isFrozen(value.snapshot.combat.actors[0]), true);
    assert.equal(Object.isFrozen(value.optional.lines), true);
  }
  assert.equal(JSON.stringify(source), before);
  for (let version = 5; version <= 8; version++) {
    const level = combatLevel();
    level.version = `xonix-level.v${version}`;
    if (version >= 6) level.relayGates = { version: 'relay-gates.v1', gates: [] };
    if (version >= 7) level.directionalFields = { version: 'directional-fields.v1', zones: [] };
    assert.ok(read(createRun(level)).optional, `Level v${version} has optional details`);
  }
});

test('absent and disabled combat preserve the old snapshot and complete Details output', () => {
  const absent = combatLevel();
  delete absent.classic.combatPatrols;
  const expected = read(createRun(absent));
  const disabled = combatLevel();
  disabled.classic.combatPatrols.enabled = false;
  const actual = read(createRun(disabled));
  assert.deepEqual(actual.snapshot, expected.snapshot);
  assert.deepEqual(
    actual.sections.map(({ id, title, lines }) => ({ id, title: String(title), lines })),
    expected.sections.map(({ id, title, lines }) => ({ id, title: String(title), lines })),
  );
  assert.equal(Object.hasOwn(expected.snapshot, 'combat'), false);
  const empty = combatLevel();
  empty.classic.combatPatrols.actors = [];
  assert.equal(read(createRun(empty)).optional, undefined);
});

test('live event reads omit the paused-only combat projection without masking paused invalid data', () => {
  const run = createRun(combatLevel());
  combat(run).version = 'future-state';
  const live = read(run, false);
  assert.equal(Object.hasOwn(live.snapshot, 'combat'), false);
  assert.equal(live.snapshot.issues.includes('combat-projection'), false);
  const paused = read(run);
  assert.equal(paused.snapshot.combat.valid, false);
  assert.ok(paused.snapshot.issues.includes('combat-projection'));
  assert.match(text(paused), /Optional patrol details are unavailable/);
  assert.doesNotMatch(text(paused), /Scouts:|Sentries:|earliest shot|removed|safe/i);
});

for (const turnPolicy of ['immediate', 'grid-center']) {
  test(`${turnPolicy}: real warning countdown and later recovering live shot remain distinct`, () => {
    const level = combatLevel(),
      options = { seed: 7, turnPolicy },
      run = createRun(level, options),
      recorder = createRecorder(level, options);
    const opening = ticks(run, 300, 'right', recorder),
      lock = opening.find((event) => event.type === 'combat.locked'),
      warning = read(run);
    assert.equal(lock.tick, 240);
    assert.equal(flightEventKind(lock.type), 'critical');
    assert.equal(patrol(run).phase, 'warning');
    assert.match(text(warning), /Aiming sentries: 1 · earliest shot in 0\.5s/);
    assert.doesNotMatch(text(warning), /Live sentry shots:/);
    const fixed = text(warning);
    for (let i = 0; i < 5; i++) assert.equal(text(read(run)), fixed);
    ticks(run, 59, 'right', recorder);
    assert.match(text(read(run)), /earliest shot in 0\.1s/);
    const fired = ticks(run, 21, 'down', recorder).find((event) => event.type === 'combat.fired');
    assert.ok(fired);
    assert.equal(flightEventKind(fired.type), 'critical');
    const recovery = read(run);
    assert.equal(patrol(run).phase, 'recovery');
    assert.equal(combat(run).projectiles.length, 1);
    assert.match(text(recovery), /Recovering sentries: 1\. Already fired shots can remain\./);
    assert.match(text(recovery), /Live sentry shots: 1/);
    assert.doesNotMatch(text(recovery), /Aiming sentries:|earliest shot|harmless|safe to/);
    assert.deepEqual(
      warning.snapshot.combat.actors[0].aim,
      lock.aim,
      'The retained reading owns its old locked aim.',
    );
    ticks(run, 120, 'down', recorder);
    assert.equal(patrol(run).phase, 'cooldown');
    assert.equal(combat(run).projectiles.length, 1);
    assert.match(text(read(run)), /Live sentry shots: 1/);
    assert.doesNotMatch(text(read(run)), /Aiming sentries:|Recovering sentries:/);
    assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
  });

  test(`${turnPolicy}: an actual earlier return removes warning and shots without claiming keeper safety`, () => {
    const level = combatLevel();
    level.goal.coverage = 0.9;
    level.foundations = [{ x: 1, y: 20, w: 70, h: 1 }];
    const run = createRun(level, { seed: 7, turnPolicy });
    ticks(run, 300, 'right');
    assert.match(text(read(run)), /Aiming sentries:/);
    const events = ticks(run, 30, 'down');
    assert.ok(
      events.some((event) => event.type === 'combat.cancelled' && event.reason === 'capture'),
    );
    assert.equal(patrol(run).phase, 'cooldown');
    assert.equal(combat(run).projectiles.length, 0);
    const value = read(run);
    assert.doesNotMatch(text(value), /Aiming sentries:|Live sentry shots:|Recovering sentries:/);
    assert.match(text(value), /round keepers remain dangerous/);
    assert.ok(value.sections.some((part) => part.id === 'threats'));
  });
}

test('multiple real locks are grouped and the earliest remaining warning is explicit', () => {
  const level = combatLevel();
  level.classic.combatPatrols.actors.push({
    ...level.classic.combatPatrols.actors[0],
    id: 'second',
    y: 14.5,
    openingTicks: 270,
  });
  const run = createRun(level, { seed: 7 });
  ticks(run, 300, 'right');
  assert.deepEqual(
    combatView(run).actors.map((actor) => actor.warningTicks),
    [60, 90],
  );
  const value = read(run);
  assert.match(text(value), /Scouts: 0 · Sentries: 2/);
  assert.equal(
    value.optional.lines.filter((line) => line.startsWith('Aiming sentries:')).length,
    1,
  );
  assert.match(text(value), /Aiming sentries: 2 · earliest shot in 0\.5s/);
  assert.ok(value.optional.lines.length <= 6);
});

test('enemy freeze preserves an actual live shot and countdown while describing the held state', () => {
  for (const until of [300, 380]) {
    const run = createRun(combatLevel(), { seed: 7 });
    ticks(run, until, 'right');
    run.classic.effects['enemy-freeze'] = { from: run.tick, until: run.tick + 100 };
    const before = read(run);
    ticks(run, 10);
    const after = read(run);
    assert.deepEqual(after.optional.lines, before.optional.lines);
    assert.deepEqual(after.snapshot.combat.actors, before.snapshot.combat.actors);
    assert.deepEqual(after.snapshot.combat.projectiles, before.snapshot.combat.projectiles);
    assert.match(text(after), /Enemy freeze holds these patrols, their warnings and shots/);
    assert.match(text(after), /can become dangerous when it ends/);
    if (until === 380) assert.match(text(after), /Live sentry shots: 1/);
    else {
      assert.match(text(after), /warning time held at 0\.5s/);
      assert.doesNotMatch(text(after), /earliest shot in/);
    }
  }
});

test('real contact and enclosure remove scouts but retain the ordinary keeper warning', () => {
  for (const cause of ['ram', 'capture']) {
    const level = combatLevel('scout');
    level.goal.coverage = 0.9;
    if (cause === 'capture') level.classic.combatPatrols.actors[0].y = 25.5;
    const run = createRun(level);
    const events = ticks(run, cause === 'ram' ? 150 : 900, 'right');
    assert.ok(events.some((event) => event.type === 'combat.eliminated' && event.cause === cause));
    const value = read(run);
    assert.equal(run.status, 'running');
    assert.match(text(value), /All bracketed patrols have been removed, along with their shots/);
    assert.match(text(value), /Round keepers remain dangerous/);
    assert.ok(
      value.sections
        .find((part) => part.id === 'threats')
        .lines.some((line) => line.includes('Field hunter')),
    );
  }
});

test('winning contact and enclosure routes do not describe removed patrols as live danger', () => {
  for (const cause of ['ram', 'capture']) {
    const level = combatLevel('scout');
    if (cause === 'capture') level.classic.combatPatrols.actors[0].y = 25.5;
    const run = createRun(level);
    const events = ticks(run, 900, 'right');
    assert.ok(events.some((event) => event.type === 'combat.eliminated' && event.cause === cause));
    assert.equal(run.status, 'won');
    assert.equal(run.tick, 846);
    const value = read(run);
    assert.equal(value.snapshot.combat.actors.length, 0);
    assert.equal(value.snapshot.combat.projectiles.length, 0);
    assert.deepEqual(value.optional.lines, [t('interface:optionalPatrolDetails.ended')]);
    assert.doesNotMatch(text(value), /remain dangerous|earliest shot|Move off|Touch or enclose/);
  }
});

test('malformed active data and mismatched schemas never turn into zero-count or removed claims', () => {
  for (const change of [
    (run) => {
      run.level.classic.combatPatrols.version = 'future';
    },
    (run) => {
      run.level.classic.combatPatrols.enabled = 'true';
    },
    (run) => {
      run.classic.combatPatrols = null;
    },
    (run) => {
      patrol(run).role = 'future';
    },
    (run) => {
      run.ruleset = 'xonix-core.v5';
    },
  ]) {
    const run = createRun(combatLevel());
    change(run);
    // A deliberately invalid ruleset has no legal replay checkpoint. Compare
    // owned source data instead; accepted-run cases above still verify replay.
    const before = structuredClone(run),
      snapshot = flightInformationSnapshot(run, { started: true, paused: true }),
      optional = flightDetailsModel({ snapshot }, context).find(
        (part) => part.id === 'optional-patrols',
      );
    assert.deepEqual(structuredClone(run), before);
    assert.equal(snapshot.combat.valid, false);
    assert.ok(snapshot.issues.includes('combat-projection'));
    assert.deepEqual(optional.lines, [t('interface:optionalPatrolDetails.unavailable')]);
  }
});

test('terminal retained combat records do not present future warnings or moving-shot instructions', () => {
  const level = combatLevel();
  level.classic.combatPatrols.actors[0].recoveryTicks = 486;
  const run = createRun(level);
  ticks(run, 1000, 'right');
  assert.equal(run.status, 'won');
  assert.equal(run.tick, 846);
  const value = read(run);
  assert.match(text(value), /This flight has ended/);
  assert.doesNotMatch(text(value), /earliest shot|Move off|Live sentry shots|Touch or enclose/);
});

test('only known emitted combat event types receive historical urgency metadata', () => {
  for (const type of ['locked', 'fired', 'impact'])
    assert.equal(flightEventKind(`combat.${type}`), 'critical');
  for (const type of ['cancelled', 'eliminated', 'expired', 'projectileRemoved', 'shotSkipped'])
    assert.equal(flightEventKind(`combat.${type}`), 'ordinary');
  for (const type of ['combat.future', 'combat', 'combat.shotEnded'])
    assert.equal(flightEventKind(type), 'unknown');
});

test('EN and UK optional details resolve counts, clock and unavailable guidance without raw keys', () => {
  const previous = getLocale();
  try {
    for (const locale of ['en', 'uk']) {
      setLocale(locale, { persist: false });
      const run = createRun(combatLevel());
      ticks(run, 300, 'right');
      const warning = text(read(run));
      assert.doesNotMatch(warning, /optionalPatrolDetails|\{\{/);
      assert.match(
        warning,
        locale === 'en' ? /earliest shot in 0\.5s/ : /до найближчого пострілу 0,5 с/,
      );
      combat(run).version = 'unknown';
      assert.match(
        text(read(run)),
        locale === 'en' ? /details are unavailable/ : /Відомості.*недоступні/,
      );
    }
  } finally {
    setLocale(previous, { persist: false });
  }
});
