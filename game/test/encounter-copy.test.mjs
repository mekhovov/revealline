import test from 'node:test';
import assert from 'node:assert/strict';
import { encounterCopy } from '../ui/encounter-copy.mjs';
import { encounterView } from '../ui/encounter-view.mjs';
import { setLocale } from '../i18n/index.mjs';

function stateFor(version, options = {}) {
  const multiple = version === 2;
  const classic = multiple || options.frozen;
  const clock = classic ? 150 : 120;
  return {
    status: options.status || 'running',
    ruleset: classic ? 'xonix-core.v9' : 'xonix-core.v3',
    tick: classic ? 600 : clock,
    time: 5,
    ...(classic
      ? {
          classic: {
            actorTick: clock,
            effects: options.frozen ? { 'enemy-freeze': { from: 500, until: 700 } } : {},
          },
        }
      : {}),
    level: {
      encounter: {
        version: `xonix-encounter.v${version}`,
        enemyId: 'core',
        minReleaseCutCells: 3,
        ...(multiple
          ? { shieldObjectiveIds: options.singleShield ? ['shield-a'] : ['shield-a', 'shield-b'] }
          : { shieldObjectiveId: 'shield-a' }),
      },
    },
    encounter: {
      phase: options.phase || 'warning',
      stage: options.stage || 'shielded',
      phaseEndTick: clock + 150,
      lane: options.noLane ? null : 7.5,
      axis: options.axis || 'horizontal',
      defeated: options.defeated || false,
      defeatCause: options.defeatCause,
    },
    objectives: [
      { id: 'shield-a', captured: true },
      { id: 'shield-b', captured: false },
    ],
    cells: Array(options.isolated ? 3 : 10).fill(0),
    trail: [{ index: 0 }, { index: 1 }, { index: 1 }],
    enemies: [{ id: 'core', stunnedUntil: options.stunned ? 6 : 0 }],
  };
}
const copyOf = ({ title, instruction, lane }) => ({ title, instruction, lane });
const locale = (value) => setLocale(value, { persist: false });
const cases = [
  ['delay without a marked lane', { phase: 'delay', noLane: true }],
  ['warning on a row', {}],
  ['active on a column', { phase: 'active', axis: 'vertical' }],
  ['stunned active lane', { phase: 'active', stunned: true }],
  ['frozen warning', { frozen: true }],
  ['rest', { phase: 'rest', noLane: true }],
  ['transition', { phase: 'transition', stage: 'transition' }],
  ['single-shield transition', { phase: 'transition', stage: 'transition', singleShield: true }],
  ['exposed warning', { stage: 'exposed' }],
  ['open core', { phase: 'open', stage: 'exposed' }],
  ['isolated waiting core', { stage: 'exposed', isolated: true }],
  ['isolated open core', { phase: 'open', stage: 'exposed', isolated: true }],
  ['lost flight', { status: 'lost' }],
  ['respawn', { status: 'respawning' }],
  ['frozen respawn', { status: 'respawning', frozen: true }],
  [
    'isolated victory',
    { phase: 'defeated', stage: 'exposed', defeated: true, defeatCause: 'isolated' },
  ],
  [
    'release-cut victory',
    { phase: 'defeated', stage: 'exposed', defeated: true, defeatCause: 'release-cut' },
  ],
];
for (const version of [1, 2])
  for (const [name, options] of cases)
    test(`v${version} ${name}: accepted copy survives EN/UK/EN and later run changes`, (t) => {
      locale('en');
      t.after(() => locale('en'));
      const state = stateFor(version, options);
      const stateBefore = structuredClone(state);
      const view = encounterView(state);
      const english = copyOf(view);
      const facts = view.copyFacts;
      const serialized = JSON.stringify(facts);
      assert.deepEqual(
        state,
        stateBefore,
        'Reading encounter copy never mutates simulation state.',
      );
      assert.equal(Object.isFrozen(facts), true);
      if (facts.shields) assert.equal(Object.isFrozen(facts.shields), true);
      assert.deepEqual(JSON.parse(serialized), facts, 'Facts survive a plain JSON round trip.');
      assert.deepEqual(encounterCopy(facts), english);
      assert.equal(facts.seconds, options.status === 'lost' ? 0 : 1.25);
      assert.equal(
        facts.cutCells,
        2,
        'The captured cut count keeps the existing unique-cell rule.',
      );
      assert.equal(facts.remaining, options.isolated ? 3 : 10);
      assert.equal(facts.lane, options.noLane ? null : 7.5);
      if (version === 2) {
        assert.deepEqual(facts.shields, { total: options.singleShield ? 1 : 2, captured: 1 });
        assert.notEqual(facts.shields, view.shields);
      } else assert.equal(facts.shields, null);
      // Retire every live collection after accepting the snapshot. Formatting
      // must use its captured facts, including clocks and shield progress.
      state.status = 'lost';
      state.encounter = null;
      state.level.encounter = null;
      state.objectives.length = state.enemies.length = state.trail.length = 0;
      state.cells.fill(1);
      if (state.classic) state.classic.actorTick += 10000;
      locale('uk');
      const ukrainian = encounterCopy(facts);
      assert.notEqual(ukrainian.title, english.title);
      assert.notEqual(ukrainian.instruction, english.instruction);
      assert.match(ukrainian.title, /[А-Яа-яІіЇїЄєҐґ]/u);
      assert.match(ukrainian.instruction, /[А-Яа-яІіЇїЄєҐґ]/u);
      assert.deepEqual(encounterCopy(JSON.parse(serialized)), ukrainian);
      assert.deepEqual(copyOf(view), english, 'Already observed view strings remain unchanged.');
      assert.equal(JSON.stringify(facts), serialized);
      locale('en');
      assert.deepEqual(encounterCopy(facts), english);
      assert.equal(JSON.stringify(facts), serialized);
    });

test('existing English warning wording, fractional clocks and lane formatting stay exact', (t) => {
  locale('en');
  t.after(() => locale('en'));
  assert.deepEqual(copyOf(encounterView(stateFor(1))), {
    title: '1 / 2 · LANE WARNING · 1.3s',
    instruction: 'Capture the shield relay. Watch row 7.',
    lane: 'row 7',
  });
  assert.deepEqual(copyOf(encounterView(stateFor(2))), {
    title: '1 / 2 · LANE WARNING · 1.3s',
    instruction: 'Shield relays 1 / 2. Capture every remaining relay. Watch row 7.',
    lane: 'row 7',
  });
  const lost = encounterView(stateFor(2, { status: 'lost' }));
  assert.equal(lost.seconds, 0);
  assert.equal(lost.title, 'FLIGHT ENDED');
  assert.equal(lost.instruction, 'Restart to try the two stages again.');
});
