import test from 'node:test';
import assert from 'node:assert/strict';
import { classicTargetPose, drawClassicTarget } from '../snake/classic-target-art.mjs';
import {
  observeClassicWorldReactions,
  drawClassicWorldReactions,
  drawClassicWorldEquipment,
  drawClassicWorldVictory,
} from '../snake/classic-world-reactions.mjs';

function canvas() {
  const calls = [];
  const context = new Proxy(
    {},
    { get: (o, k) => o[k] ?? ((...args) => calls.push([k, ...args, o.fillStyle])) },
  );
  return { context, calls };
}
const palette = { safe: '#aacdaa', accent: '#dec885', danger: '#db826d' };

test('accepted enemy phases select appropriate shared animation clips including tactical source movement', () => {
  for (const phase of ['warning', 'turning', 'windup', 'prepare']) {
    const pose = classicTargetPose({ phase, timeMs: 1450 });
    assert.equal(pose.clip, 'anticipation');
    assert.equal(pose.stride, 0);
  }
  for (const phase of ['rest', 'recovery', 'recovering', 'open']) {
    const pose = classicTargetPose({ phase, timeMs: 1450 });
    assert.equal(pose.clip, 'recovery');
    assert.equal(pose.animationState, 'recover');
    assert.equal(pose.stride, 0);
  }
  for (const phase of ['dormant', 'waiting'])
    assert.equal(classicTargetPose({ phase }).clip, 'idle');
  assert.equal(classicTargetPose({ phase: 'blocked', timeMs: 1450 }).clip, 'blocked');
  assert.equal(
    classicTargetPose({ kind: 'jammer', phase: 'jamming', timeMs: 1450 }).stance,
    'action',
  );
  assert.equal(classicTargetPose({ kind: 'jammer', phase: 'jamming', timeMs: 1450 }).stride, 0);
  assert.equal(
    classicTargetPose({
      kind: 'jammer',
      phase: 'rest',
      tactical: { stationary: false },
      timeMs: 1450,
    }).stance,
    'travel',
  );
  assert.equal(
    classicTargetPose({
      kind: 'jammer',
      phase: 'rest',
      tactical: { stationary: true },
      timeMs: 1450,
    }).stance,
    'recover',
  );
  assert.equal(classicTargetPose({ kind: 'still', timeMs: 1450 }).clip, 'idle');
});

test('stationary actions never select the shared walking clip and frozen actors keep identical native geometry', () => {
  for (const [kind, phase] of [
    ['jammer', 'jamming'],
    ['lane', 'active'],
    ['guard', 'locked'],
    ['relay', 'active'],
  ]) {
    const pose = classicTargetPose({ kind, phase, timeMs: 1450 });
    assert.equal(pose.clip, 'idle', kind);
    assert.equal(pose.animationState, 'idle', kind);
    assert.equal(pose.stance, 'action', kind);
    const render = (timeMs, extra = {}) => {
      const c = canvas();
      drawClassicTarget(c.context, 0, 0, 28, 3, { kind, phase, timeMs, ...extra });
      return c.calls;
    };
    assert.deepEqual(render(0), render(1450), kind + ' action must not walk');
  }
  for (const kind of ['runner', 'jammer', 'guard', 'relay']) {
    for (const pauseFlag of ['paused', 'frozen', 'reducedEffects']) {
      const renders = [0, 1450].map((timeMs) => {
        const c = canvas();
        drawClassicTarget(c.context, 0, 0, 28, 3, {
          kind,
          phase: 'rest',
          tactical: { stationary: false },
          timeMs,
          [pauseFlag]: true,
        });
        return c.calls;
      });
      assert.deepEqual(...renders, kind + ' ' + pauseFlag + ' must freeze native rendering');
    }
  }
});

test('specialist preparation and recovery use different native equipment geometry without rotating to future heading', () => {
  for (const kind of ['jammer', 'guard', 'eroder']) {
    const poses = ['rest', 'warning'].map((phase) => {
      const c = canvas();
      drawClassicTarget(c.context, 0, 0, 28, 0, {
        kind,
        phase,
        heading: 'right',
        nextHeading: 'down',
        timeMs: 500,
        reducedEffects: true,
      });
      assert(c.calls.some(([op, angle]) => op === 'rotate' && angle === Math.PI / 2));
      return c.calls.filter(([op]) => op === 'fillRect').map((call) => call.slice(0, -1));
    });
    assert.notDeepEqual(
      poses[0],
      poses[1],
      kind + ' must deploy its equipment, not merely recolor it',
    );
  }
});

test('accepted gate state changes create one bounded rail reaction without delaying collision state', () => {
  const board = {},
    attempt = {},
    run = {
      tick: 0,
      level: {},
      shutters: [{ id: 'cable-a', closed: true, cells: [{ x: 3, y: 4 }] }],
    };
  observeClassicWorldReactions(board, run, attempt, 0);
  run.tick = 1;
  run.shutters[0].closed = false;
  const effects = observeClassicWorldReactions(board, run, attempt, 20);
  assert.equal(effects.length, 1);
  assert.equal(effects[0].kind, 'gate-open');
  assert.equal(observeClassicWorldReactions(board, run, attempt, 25).length, 1);
  const before = JSON.stringify(run),
    c = canvas();
  drawClassicWorldReactions(c.context, run, effects, {}, { palette, timeMs: 200 });
  assert.equal(JSON.stringify(run), before);
  const fills = c.calls.filter(([op]) => op === 'fillRect');
  assert.equal(fills.length, 4);
  for (const [, x, , width] of fills) {
    assert.equal(width, 2);
    assert(
      Math.abs(x + 1 - 3.5 * 28) > 28 * 0.4,
      'accepted open center never receives sliding panels',
    );
  }
  assert.equal(observeClassicWorldReactions(board, run, attempt, 600).length, 0);
});

test('six worlds acknowledge victory on open boards while defeat produces no celebration', () => {
  const signatures = [];
  for (const scene of ['orchard', 'freight', 'workshop', 'harbor', 'relay', 'quarry']) {
    const world = { scene, focus: [6, 5], ambient: 'fan' };
    const run = { status: 'lost', level: { width: 24, height: 18, walls: [] } };
    const lost = canvas();
    drawClassicWorldEquipment(lost.context, run, world, { palette, timeMs: 300 });
    assert.equal(lost.calls.length, 0);
    run.status = 'won';
    const won = canvas();
    drawClassicWorldEquipment(won.context, run, world, { palette, timeMs: 300 });
    assert(won.calls.some(([op]) => op === 'fillRect' || op === 'stroke'));
    signatures.push(JSON.stringify(won.calls.map((call) => call.slice(0, -1))));
    const first = canvas(),
      last = canvas();
    drawClassicWorldVictory(first.context, run, world, { palette, timeMs: 0, reduced: true });
    drawClassicWorldVictory(last.context, run, world, { palette, timeMs: 1234, reduced: true });
    assert.deepEqual(
      first.calls,
      last.calls,
      'reduced effects retain static completion information',
    );
  }
  assert.equal(new Set(signatures).size, 6);
});

test('wall equipment clips native parts and restores the fan transform before the completion outline', () => {
  const { context, calls } = canvas();
  drawClassicWorldEquipment(
    context,
    { status: 'won', level: { width: 24, height: 18, walls: [{ x: 4, y: 4 }] } },
    { scene: 'workshop', ambient: 'fan', focus: [4, 4] },
    { palette, timeMs: 900 },
  );
  const outline = calls.findIndex(
    ([op, x, y, w, h]) => op === 'strokeRect' && x === 5 && y === 5 && w === 18 && h === 18,
  );
  assert(outline > 0);
  assert.equal(calls[outline - 1][0], 'restore', 'fan rotation is scoped independently');
  assert(
    calls.some(([op, x, y, w, h]) => op === 'rect' && x === 0 && y === 0 && w === 28 && h === 28),
  );
});
