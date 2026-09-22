import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { ENEMY_CATALOG } from '../enemy-catalog.mjs';
import { enemyGuideEntry } from '../enemy-guide.mjs';
import { createApexSpatialCandidates } from '../content-design/apex-spatial-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { flightInformationSnapshot } from '../ui/flight-information-source.mjs';
import { flightDetailsModel } from '../ui/flight-information-details.mjs';

const context = {
  mission: 'Guidance test',
  goal: 'Reveal the target',
  steering: 'Immediate',
  objectiveLabel: 'Relay',
  actions: [],
};
const snapshot = (enemies) => ({
  status: 'running',
  paused: true,
  player: { cutting: false },
  objectives: { done: 0, total: 0 },
  classic: { summary: '', enemies, lineImpacts: [], erosion: [], effects: [], powerups: [] },
  laneBosses: [],
  encounter: null,
});
const model = (value) => flightDetailsModel({ snapshot: value }, context);
const lines = (value, section) =>
  model(value)
    .find((part) => part.id === section)
    ?.lines.join('\n') ?? '';

test('paused actors use the same seven role names as the guide and authoring catalogue', () => {
  for (const { type, label } of ENEMY_CATALOG) {
    const value = snapshot([{ id: type, type, mode: null }]);
    assert(lines(value, 'threats').startsWith(label));
    assert.equal(enemyGuideEntry(type).label, label);
  }
  assert.match(enemyGuideEntry('relay-sentinel').try, /every linked shield relay/);
  assert.match(enemyGuideEntry('relay-sentinel').try, /During CORE OPEN/);
  assert.match(enemyGuideEntry('relay-sentinel').try, /reclaimed ground with no unfinished line/);
});

test('outer perimeter and changing frontier remain explicit even when the crawler is idle', () => {
  const value = snapshot([
    { id: 'outer', type: 'border-patrol', mode: null },
    { id: 'frontier', type: 'contour-patrol', mode: 'idle' },
  ]);
  const text = lines(value, 'threats');
  assert.match(text, /Border guard.*outer perimeter/);
  assert.match(text, /Contour crawler.*changing frontier/);
  assert.match(text, /holding position/);
  assert.match(text, /inside reclaimed ground, away from the changing frontier/);
  assert.match(text, /Contact.*dangerous/);
  assert.doesNotMatch(text, /Boundary patrol|patrolling captured boundaries/);
});

for (const mode of ['patrolling', 'rejoining', 'idle'])
  test(`frontier ${mode} guidance retains domain, counterplay and effect modifiers`, () => {
    const value = snapshot([{ id: 'frontier', type: 'contour-patrol', mode, frozen: true }]);
    const text = lines(value, 'threats');
    assert.match(text, /changing frontier/);
    assert.match(text, /capture/);
    assert.match(text, /Frozen: movement and attack countdowns are held/);
    assert.match(text, /When freeze ends, contact/);
    assert.doesNotMatch(text, /Contact.*still dangerous/);
    assert.equal(text.includes('holding position'), mode === 'idle');
    assert.equal(text.includes('rejoining'), mode === 'rejoining');
  });

test('missing encounter guidance never invents a single linked relay', () => {
  const value = snapshot([{ id: 'core', type: 'relay-sentinel', mode: null }]);
  assert.match(lines(value, 'threats'), /guidance is unavailable/);
  assert.doesNotMatch(lines(value, 'threats'), /capture its relay/i);
  value.encounter = { stage: 'shielded', phase: 'delay', instruction: 'Unrelated encounter' };
  value.encounterLane = { id: 'different-core' };
  assert.doesNotMatch(lines(value, 'threats'), /Unrelated encounter/);
});

test('single-relay and ended encounter details do not advertise plural requirements or a live countdown', () => {
  const value = snapshot([{ id: 'core', type: 'relay-sentinel', mode: null }]);
  value.encounterLane = { id: 'core' };
  value.encounter = {
    stage: 'shielded',
    phase: 'delay',
    instruction: 'Capture the shield relay.',
    seconds: 2,
    cutCells: 0,
    min: 8,
    remaining: 20,
    title: 'Shield relay',
  };
  assert.match(lines(value, 'threats'), /Relay sentinel: Capture the shield relay\.$/);
  assert.match(lines(value, 'encounter'), /Capture the shield relay\./);
  assert.match(lines(value, 'encounter'), /Next lane warning · 2.0s/);
  assert.doesNotMatch(lines(value, 'encounter'), /all remaining shield relays/);
  value.status = 'lost';
  value.encounter.seconds = 0;
  value.encounter.instruction = 'Restart to try the two stages again.';
  assert.match(lines(value, 'encounter'), /Flight ended\./);
  assert.doesNotMatch(lines(value, 'encounter'), /Capture the shield relay|0.0s remaining/);
});

test('encounter phase clocks name the event, not an apparent mission deadline', () => {
  for (const [phase, label] of [
    ['delay', 'Next lane warning'],
    ['rest', 'Next lane warning'],
    ['transition', 'Next vertical lane warning'],
    ['warning', 'Lane warning ends'],
    ['active', 'Active lane ends'],
    ['open', 'Core opening closes'],
  ]) {
    const value = snapshot([]);
    value.encounter = {
      stage: 'shielded',
      phase,
      instruction: 'Capture every remaining relay.',
      seconds: 2,
      cutCells: 0,
      min: 8,
      remaining: 20,
      title: 'Shield relays',
      shields: { total: 3 },
    };
    const text = lines(value, 'encounter');
    assert(text.includes(`${label} · 2.0s remaining.`));
    assert.doesNotMatch(text, /Capture all remaining shield relays ·/);
  }
});

test('real Home route guidance follows three shields, transition, opening and defeat without mutating the run', () => {
  const source = compileContentProject(createApexSpatialCandidates());
  const level = resolveMission(source, 'home-signal', { difficulty: 'standard' }).level;
  const rows = JSON.parse(
    readFileSync(new URL('./fixtures/apex-spatial-clear-routes.json', import.meta.url)),
  ).rows;
  const row = rows.find(
    (r) => r.difficulty === 'standard' && r.turnPolicy === 'immediate' && r.route === 'ordinary',
  );
  const run = createRun(level, { seed: row.seed, classId: 'scout', turnPolicy: row.turnPolicy });
  const observed = new Set();
  const inspect = () => {
    const before = authoritativeCheckpoint(run);
    const value = flightInformationSnapshot(run, { started: true, paused: true });
    const e = value.encounter;
    observed.add(`${e.stage}/${e.phase}/${e.shields.captured}`);
    assert(
      lines(value, 'threats').includes(e.instruction),
      'Sentinel entry describes this actual encounter',
    );
    const encounter = lines(value, 'encounter');
    if (e.stage === 'shielded') {
      assert.match(encounter, /Capture all remaining shield relays/);
      assert.doesNotMatch(encounter, /Capture the shield relay ·/);
    }
    if (e.phase === 'defeated') {
      assert.match(encounter, /Core released/);
      assert.doesNotMatch(encounter, /Release the core ·/);
    }
    assert.deepEqual(authoritativeCheckpoint(run), before);
    assert.doesNotMatch(
      model(value)
        .flatMap((part) => part.lines)
        .join('\n'),
      /undefined|NaN|\.\./,
    );
  };
  inspect();
  for (const { direction, ticks } of row.segments)
    for (let tick = 0; tick < ticks; tick++) {
      stepRun(run, { direction }, FIXED_DT);
      if (
        run.events.some((event) =>
          ['objective.captured', 'encounter.stageChanged', 'encounter.phaseChanged'].includes(
            event.type,
          ),
        )
      )
        inspect();
    }
  assert.equal(run.status, 'won');
  assert.equal(authoritativeCheckpoint(run).hash, row.evidence.checkpoint);
  assert([...observed].some((key) => key.startsWith('transition/')));
  assert([...observed].some((key) => key.includes('/open/')));
  assert([...observed].some((key) => key.includes('/defeated/')));
});
