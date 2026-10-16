import test from 'node:test';
import assert from 'node:assert/strict';
import { createClassicRecentReplay } from '../snake/classic-recent-replay.mjs';
import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
import { prepareClassicSnakeLevel } from '../snake/classic-setup.mjs';
import {
  createClassicSnakeMatch,
  advanceClassicSnakeMatchTo,
  exportClassicSnakeMatch,
  restoreClassicSnakeMatch,
} from '../snake/classic-match.mjs';

const level = () =>
  prepareClassicSnakeLevel(
    CLASSIC_SNAKE_LEVELS.find((item) => item.id === 'classic-snake-open-loop'),
    { pace: 'normal', format: 'campaign', targetRules: 'authored', preset: 'classic' },
  );

test('a render frame observes each simulation move and restore seeds the same final boundaries', () => {
  const match = createClassicSnakeMatch(level()),
    recent = createClassicRecentReplay();
  recent.reset(match.runs);
  advanceClassicSnakeMatchTo(match, 650, { onStep: (event) => recent.observe(event) });
  assert.equal(recent.frames()[0].length, match.runs[0].tick + 1);
  assert.ok(match.runs[0].tick >= 3, 'several moves happened in one host update');
  const restored = createClassicRecentReplay();
  restoreClassicSnakeMatch(exportClassicSnakeMatch(match), {
    onStart: (value) => restored.reset(value.runs),
    onStep: (event) => restored.observe(event),
  });
  assert.deepEqual(restored.frames(), recent.frames());
});

test('a 30,000-step replay opens in constant space without reading input history or duplicating recipes', () => {
  const run = createClassicSnakeMatch(level()).runs[0],
    recent = createClassicRecentReplay();
  Object.defineProperty(run, 'history', {
    get() {
      throw new Error('History must never be copied');
    },
  });
  Object.defineProperty(run, 'turns', {
    get() {
      throw new Error('Journal must never be copied');
    },
  });
  for (let tick = 0; tick <= 30000; tick++) {
    run.tick = tick;
    recent.capture(run);
  }
  const frames = recent.frames()[0];
  assert.equal(frames.length, 9);
  assert.deepEqual(
    frames.map((frame) => frame.tick),
    Array.from({ length: 9 }, (_, i) => 29992 + i),
  );
  assert.ok(
    frames.every(
      (frame) => frame.level === run.level && !('history' in frame) && !('turns' in frame),
    ),
  );
  assert.equal(recent.durationMs(), 1920);
  run.failure = { players: [{ at: { x: -1, y: 5 } }], cause: 'wall' };
  run.status = 'lost';
  recent.capture(run);
  assert.equal(recent.frames()[0].length, 9, 'input-only failure replaces current boundary');
  assert.deepEqual(recent.frame(0, 1920).failure.players[0].at, { x: -1, y: 5 });
  run.failure.players[0].at.x = 20;
  assert.equal(recent.frame(0, 1920).failure.players[0].at.x, -1, 'visual boundaries are isolated');
});
