import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSIC_SNAKE_V4_LEVELS } from '../snake/classic-catalogue-v4.mjs';
import {
  createClassicSnake,
  stepClassicSnake,
  queueClassicSnakeTurn,
  exportClassicSnakeReplay,
  restoreClassicSnakeReplay,
} from '../snake/classic-core.mjs';
import { drawClassicBoard } from '../snake/classic-view.mjs';

const level = CLASSIC_SNAKE_V4_LEVELS.find(
  (entry) => entry.id === 'classic-field-signal-check',
).level;
function move(run, count) {
  for (let i = 0; i < count; i++) {
    if (run.snakes[0].body[0].x === 20 && run.snakes[0].body[0].y === 2)
      queueClassicSnakeTurn(run, 0, 'down');
    stepClassicSnake(run);
    assert.equal(run.status, 'running');
  }
}
function render(run, options = {}) {
  const calls = [];
  let effectDraws = 0;
  const ctx = new Proxy(
    {},
    {
      get: (target, key) =>
        target[key] ??
        ((...args) => calls.push([key, ...args, target.fillStyle, target.globalAlpha])),
    },
  );
  const canvas = { width: 0, height: 0, style: {}, getContext: () => ctx };
  drawClassicBoard(canvas, run, {
    effects: { draw: () => effectDraws++ },
    ...options,
  });
  return { calls, effectDraws };
}

test('jammer warning shows the field before four fully opaque signal-loss moves', () => {
  const run = createClassicSnake(level);
  move(run, 12);
  const warning = render(run);
  assert.equal(run.targets[0].phase, 'warning');
  assert.equal(warning.effectDraws, 1);
  assert.ok(
    warning.calls.some(([method, dash]) => method === 'setLineDash' && String(dash) === '12,8'),
  );
  move(run, 4);
  const before = exportClassicSnakeReplay(run);
  const dropped = render(run);
  assert.equal(dropped.effectDraws, 0, 'world effects cannot disclose hidden positions');
  assert.ok(
    dropped.calls.some(
      ([method, x, y, width, height, fill, alpha]) =>
        method === 'fillRect' &&
        x === 0 &&
        y === 0 &&
        width === 672 &&
        height === 504 &&
        fill === '#07111a' &&
        alpha === 1,
    ),
  );
  assert.ok(
    dropped.calls.some(([method, text]) => method === 'fillText' && text === 'SIGNAL LOST'),
  );
  for (const remaining of [4, 3, 2, 1]) {
    assert.equal(run.signal.remainingTicks, remaining);
    assert.ok(
      render(run).calls.some(
        ([method, text]) => method === 'fillText' && text === `${remaining} moves remaining`,
      ),
    );
    move(run, 1);
  }
  assert.equal(run.signal.jammed, false);
  assert.equal(render(run).effectDraws, 1, 'feed returns at the simulation recovery boundary');
  assert.deepEqual(restoreClassicSnakeReplay(before).signal, { jammed: true, remainingTicks: 4 });
  assert.deepEqual(restoreClassicSnakeReplay(exportClassicSnakeReplay(run)), run);
});

test('signal loss hides every actor and wall equally in normal and reduced-effects modes', () => {
  const run = createClassicSnake(level);
  move(run, 16);
  const moved = structuredClone(run);
  moved.targets[0].x = 9;
  moved.targets[0].y = 11;
  moved.snakes[0].body = moved.snakes[0].body.map((cell) => ({ x: cell.x - 4, y: cell.y + 1 }));
  moved.level.walls = [{ x: 1, y: 1 }];
  moved.recentCatches = [{ id: 'hidden', x: 3, y: 3, kind: 'runner', tick: 1 }];
  const before = JSON.stringify(run);
  for (const reduced of [false, true]) {
    assert.deepEqual(render(run, { reduced }), render(moved, { reduced }));
    const uk = render(run, { reduced, locale: 'uk' });
    assert.ok(
      uk.calls.some(([method, text]) => method === 'fillText' && text === 'СИГНАЛ ВТРАЧЕНО'),
    );
    assert.ok(uk.calls.some(([method, x, y]) => method === 'strokeRect' && x === 1.5 && y === 1.5));
  }
  assert.equal(JSON.stringify(run), before, 'rendering cannot modify the simulation or RNG');
  const later = { ...run, tick: run.tick + 1 };
  assert.deepEqual(
    render(run, { reduced: true }),
    render(later, { reduced: true }),
    'reduced effects has no moving noise',
  );
  assert.notDeepEqual(
    render(run),
    render(later),
    'normal effects uses faint deterministic drifting lines',
  );
});

test('Pulse temporarily restores the feed and terminal failures reveal the impact', () => {
  const run = createClassicSnake(level);
  move(run, 16);
  const baseline = exportClassicSnakeReplay(run);
  run.pulseTicks = 8;
  const pulse = render(run);
  assert.equal(pulse.effectDraws, 1);
  assert.ok(
    pulse.calls.some(
      ([method, text]) => method === 'fillText' && text === 'PULSE · RECEPTION STABILIZED',
    ),
  );
  assert.equal(run.signal.remainingTicks, 4, 'presentation does not consume frozen interference');
  run.pulseTicks = 0;
  assert.equal(render(run).effectDraws, 0, 'remaining blackout resumes after Pulse');
  assert.deepEqual(exportClassicSnakeReplay(run), baseline);
  run.status = 'lost';
  const impact = render(run);
  assert.equal(impact.effectDraws, 1);
  assert.ok(
    !impact.calls.some(([method, text]) => method === 'fillText' && text === 'SIGNAL LOST'),
  );
});
