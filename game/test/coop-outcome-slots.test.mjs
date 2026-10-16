import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTeamOutcomeFeedback,
  TEAM_OUTCOME_SLOTS,
  prepareTeamOutcomes,
} from '../couch/coop-outcome-presentation.mjs';
import { createCoopPainter } from '../couch/coop-view.mjs';
import { createStudioTeamFixture } from '../../authoring/asset-studio/team-preview-fixture.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { createCoop, startCoop, stepCoop, pauseCoop, FIXED_DT } from '../coop/core.mjs';
import { FIRST_CONNECTION } from '../coop/first-connection.mjs';
const palette = {
  ink: '#f3f0db',
  paper: '#070b12',
  muted: '#a5b2bb',
  accent: '#f4bf62',
  safe: '#78dce8',
  danger: '#f07879',
  field: '#070b12',
  grid: '#182631',
  sky: '#dfb781',
  land: '#687c55',
};

function surface() {
  const calls = [],
    stack = [],
    state = { globalAlpha: 1 };
  const ctx = new Proxy(
    {},
    {
      get(_, key) {
        if (key in state) return state[key];
        return (...args) => {
          calls.push({ method: key, args, alpha: state.globalAlpha });
          if (key === 'save') stack.push({ ...state });
          if (key === 'restore') {
            const prior = stack.pop();
            for (const k of Object.keys(state)) delete state[k];
            Object.assign(state, prior);
          }
          if (key === 'measureText') return { width: String(args[0]).length * 0.5 };
        };
      },
      set(_, key, value) {
        state[key] = value;
        return true;
      },
    },
  );
  return { calls, canvas: { width: 1152, height: 576, clientWidth: 1152, getContext: () => ctx } };
}

const defaults = createDefaultThemeBundle();
function snapshot() {
  const assets = {},
    images = {};
  for (const id of TEAM_OUTCOME_SLOTS) {
    const slot = defaults.slots.find((s) => s.id === id);
    assets[id] = { kind: 'image' };
    images[id] = {
      image: { id, width: 32, height: 32 },
      geometry: {
        frame: slot.geometry.frame,
        pivot: { x: 0.5, y: 0.5 },
        occupiedBounds: slot.geometry.occupiedBounds,
        rotors: [],
        nineSlice: null,
      },
    };
  }
  return {
    images,
    resolved: { assets },
    canvas: { assets, palette, motionScale: 1 },
    fonts: { ui: 'Exo 2', numeric: 'IBM Plex Mono' },
    image: (id) => images[id] ?? null,
  };
}

for (const arena of ['first-connection', 'relay-yard'])
  for (const [scenario, slot] of [
    ['capture', 'team.capture.joint'],
    ['team-recovery', 'team.recovery'],
  ])
    test(`${arena} ${scenario} renders command-earned outcome and preserves simulation`, () => {
      const f = createStudioTeamFixture({ arena, scenario }),
        p = createCoopPainter(surface().canvas),
        s = snapshot();
      const { canvas, calls } = surface();
      const painter = createCoopPainter(canvas);
      painter.setPresentation(s);
      assert(f.feedback.some((record) => record.slot === slot));
      const before = structuredClone(f.run);
      painter.paint(f.run, { feedback: f.feedback, reduced: true });
      assert(
        calls.some((call) => call.method === 'drawImage' && call.args[0] === s.images[slot].image),
      );
      assert(
        calls.some(
          (call) =>
            call.method === 'fillText' &&
            String(call.args[0]).includes(slot === 'team.recovery' ? 'TEAM RECOVERY' : 'JOINT CUT'),
        ),
      );
      assert.deepEqual(f.run, before);
      p.setPresentation(null);
      for (let i = 0; i < 135; i++) f.advance(FIXED_DT);
      assert(!f.feedback.some((record) => record.slot === slot));
      f.reset();
      assert(f.feedback.some((record) => record.slot === slot));
    });

test('fixed-step observation retains a joint event after the core clears it, without duplicate awards', () => {
  const run = startCoop(createCoop(FIRST_CONNECTION, { difficulty: 'standard', seed: 17 })),
    tracker = createTeamOutcomeFeedback();
  const command = (direction, support = false) => ({ direction, boost: true, support });
  let observed = false;
  for (let i = 0; i < 414; i++) {
    const support = i === 210;
    stepCoop(
      run,
      [command(i < 60 ? 'up' : 'right', support), command(i < 60 ? 'up' : 'left', support)],
      FIXED_DT,
    );
    tracker.observe(run);
    observed ||= run.events.some((e) => e.type === 'cut.joint');
  }
  assert(observed);
  const points = run.team.jointCuts;
  for (let i = 0; i < 4; i++) {
    stepCoop(run, [command(null), command(null)], FIXED_DT);
    tracker.observe(run);
  }
  assert(!run.events.some((e) => e.type === 'cut.joint'));
  assert.equal(tracker.read(run).length, 1);
  tracker.observe(run);
  tracker.observe(run);
  assert.equal(tracker.read(run).length, 1);
  assert.equal(run.team.jointCuts, points);
  pauseCoop(run);
  const paused = structuredClone(run);
  for (let i = 0; i < 120; i++) tracker.observe(run);
  assert.equal(tracker.read(run).length, 1);
  assert.deepEqual(run, paused);
  const other = startCoop(createCoop(FIRST_CONNECTION));
  assert.equal(tracker.observe(other).length, 0);
});

test('invalid declared outcome image fails before painter snapshot adoption', () => {
  const p = createCoopPainter(surface().canvas),
    good = snapshot();
  p.setPresentation(good);
  const bad = snapshot();
  bad.images['team.capture.joint'].geometry.pivot.x = 0;
  assert.throws(() => p.setPresentation(bad), /centered 32/);
  assert.equal(p.presentation, good);
  assert.deepEqual(prepareTeamOutcomes(null), {});
});

test('completed pictures suppress transient outcome feedback', () => {
  const f = createStudioTeamFixture({ arena: 'first-connection', scenario: 'victory' });
  assert.equal(f.feedback.length, 0);
});
