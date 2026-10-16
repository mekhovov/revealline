import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRun, stepRun, releaseInputs, FIXED_DT } from '../core/index.mjs';
import { encounterView } from '../ui/encounter-view.mjs';
import { missionBriefing } from '../mission-brief.mjs';
import { deriveTension } from '../ui/music.mjs';
const pack = JSON.parse(
  await readFile(new URL('../content/packs/sentinel-relay.json', import.meta.url), 'utf8'),
);
const proof = JSON.parse(
  await readFile(new URL('../replays/sentinel-routes.json', import.meta.url), 'utf8'),
);
const level = pack.campaigns[0].levels[0];

test('mission requirements come from encounter rules, not authored prose', () => {
  const brief = missionBriefing({
    ...level,
    metadata: { description: 'A misleading 99-cell cut.' },
  });
  assert.match(brief.copy, /Capture the shield relay/);
  assert.match(brief.copy, /8 new trail cells during CORE OPEN, or isolate/);
  assert.doesNotMatch(brief.copy, /99/);
  assert.equal(brief.fullBrief, 'A misleading 99-cell cut.');
});

for (const turnPolicy of ['immediate', 'grid-center'])
  test(`${turnPolicy}: visible cues follow actual legal-input phases and cut progress`, () => {
    const route = proof.routes.find(
      (item) =>
        item.turnPolicy === turnPolicy && item.variant === 'ordinary' && item.classId === 'scout',
    );
    const run = createRun(level, { turnPolicy, classRecipes: pack.classRecipes });
    const samples = new Map();
    for (const segment of route.segments) {
      if (segment.releaseBefore) releaseInputs(run);
      for (let i = 0; i < segment.ticks; i++) {
        stepRun(run, segment.input, FIXED_DT);
        if ([240, 241, 1084, 1265, 1505, 1589, 1791, 1792].includes(run.tick)) {
          const before = JSON.stringify(run);
          samples.set(run.tick, encounterView(run));
          assert.equal(JSON.stringify(run) === before, true, 'View derives no simulation mutation');
        }
      }
    }
    assert.equal(samples.get(240).phase, 'delay');
    assert.equal(samples.get(241).phase, 'warning');
    assert.match(samples.get(241).title, /LANE WARNING/);
    assert.match(samples.get(241).instruction, /Capture the shield relay/);
    assert.equal(samples.get(1084).phase, 'transition');
    assert.match(samples.get(1265).lane, /column/);
    assert.equal(samples.get(1505).phase, 'active');
    assert.equal(samples.get(1589).phase, 'open');
    assert.equal(samples.get(1589).seconds, 4);
    assert.match(samples.get(1589).instruction, /Live line .*\/ 8/);
    assert.ok(samples.get(1791).cutCells >= 8);
    assert.match(samples.get(1792).title, /CORE RELEASED/);
    assert.equal(samples.get(1792).remaining, 0);
    assert.equal(samples.get(1792).seconds, 0);
  });

test('no encounter leaves the legacy view empty and old tension unchanged', () => {
  assert.equal(encounterView({}), null);
  assert.equal(deriveTension({ lives: 3, player: { cutting: false }, enemies: [] }), 0);
  assert.equal(
    deriveTension({
      lives: 3,
      player: { cutting: false },
      enemies: [],
      encounter: { phase: 'warning' },
    }),
    0.25,
  );
  assert.equal(
    deriveTension({
      lives: 3,
      player: { cutting: false },
      enemies: [],
      encounter: { phase: 'open' },
    }),
    0,
  );
});

test('a terminal failed run cannot advertise a live opening countdown or remaining action', () => {
  const run = createRun(level, { classRecipes: pack.classRecipes });
  for (let i = 0; i < 10000 && run.status !== 'lost'; i++)
    stepRun(run, { direction: 'right' }, FIXED_DT);
  assert.equal(run.status, 'lost');
  const view = encounterView(run);
  assert.equal(view.title, 'FLIGHT ENDED');
  assert.equal(view.seconds, 0);
  assert.match(view.instruction, /Restart/);
});

test('every replay-observed encounter phase has Ukrainian guidance without changing its replay state', async (context) => {
  const { getLocale, setLocale } = await import('../i18n/index.mjs');
  const locale = getLocale();
  context.after(() => setLocale(locale, { persist: false }));
  const route = proof.routes.find(
    (item) =>
      item.turnPolicy === 'immediate' && item.variant === 'ordinary' && item.classId === 'scout',
  );
  const run = createRun(level, { classRecipes: pack.classRecipes });
  const observed = new Set();
  for (const segment of route.segments) {
    if (segment.releaseBefore) releaseInputs(run);
    for (let i = 0; i < segment.ticks; i++) {
      stepRun(run, segment.input, FIXED_DT);
      if (observed.has(run.encounter.phase)) continue;
      observed.add(run.encounter.phase);
      const checkpoint = JSON.stringify(run);
      setLocale('en', { persist: false });
      const english = encounterView(run);
      setLocale('uk', { persist: false });
      const ukrainian = encounterView(run);
      assert.notEqual(ukrainian.title, english.title);
      assert.notEqual(ukrainian.instruction, english.instruction);
      assert.doesNotMatch(ukrainian.instruction, /[a-zA-Z]{3}/);
      for (const field of [
        'phase',
        'stage',
        'seconds',
        'cutCells',
        'min',
        'remaining',
        'suppressed',
      ])
        assert.equal(ukrainian[field], english[field]);
      assert.equal(JSON.stringify(run), checkpoint);
      setLocale('en', { persist: false });
      assert.deepEqual(encounterView(run), english);
    }
  }
  assert.ok(observed.has('warning'));
  assert.ok(observed.has('transition'));
  assert.ok(observed.has('open'));
  assert.ok(observed.has('defeated'));
});
