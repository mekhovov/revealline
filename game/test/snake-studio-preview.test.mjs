// Authored regressions; automated suites remain waived by publishing/test-policy.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSnakeStudioPreview } from '../studio/snake-preview.mjs';
import { makeClassicSnakeV3 } from '../snake/classic-core.mjs';
import {
  createClassicSnakeMatch,
  queueClassicSnakeMatchTurn,
  advanceClassicSnakeMatchTo,
  nextClassicSnakeMatchEventAt,
  classicSnakeMatchSummary,
} from '../snake/classic-match.mjs';
import { drawClassicBoard } from '../snake/classic-view.mjs';

function recipe() {
  const level = structuredClone(
    makeClassicSnakeV3({
      version: 'classic-snake-level.v1',
      id: 'studio-preview-boundaries',
      revision: '1',
      name: 'Studio preview boundaries',
      width: 24,
      height: 18,
      walls: [],
      spawns: [
        { x: 5, y: 2, direction: 'right' },
        { x: 18, y: 15, direction: 'left' },
      ],
      goal: 8,
      stepMs: 200,
      speedupEvery: 0,
      minStepMs: 200,
      wrap: true,
      targetMovement: 'still',
      fleeEvery: 3,
    }),
  );
  level.targets.required = [
    {
      kind: 'patroller',
      every: 4,
      path: [
        { x: 12, y: 6 },
        { x: 13, y: 6 },
        { x: 13, y: 7 },
        { x: 12, y: 7 },
      ],
    },
  ];
  return level;
}
function specimen() {
  const calls = [],
    context = new Proxy(
      {},
      {
        get(target, name) {
          return target[name] ?? ((...args) => calls.push([name, ...args]));
        },
      },
    );
  return { calls, canvas: { width: 0, height: 0, style: {}, getContext: () => context } };
}

test('preview native commands preserve the draft and match Solo, paired Versus and shared Team', () => {
  for (const mode of ['solo', 'versus', 'team']) {
    const source = recipe(),
      before = structuredClone(source),
      native = createClassicSnakeMatch(source, { mode, seed: 17 }),
      preview = createSnakeStudioPreview();
    preview.load(source, { mode });
    assert.equal(preview.snapshot().playing, false);
    for (const direction of ['down', 'right', 'up', 'right']) {
      preview.turn(0, direction);
      queueClassicSnakeMatchTurn(native, 0, direction);
      if (mode !== 'solo') {
        preview.turn(1, direction);
        queueClassicSnakeMatchTurn(native, 1, direction);
      }
      preview.step();
      advanceClassicSnakeMatchTo(native, nextClassicSnakeMatchEventAt(native));
      assert.deepEqual(preview.snapshot().match, classicSnakeMatchSummary(native));
    }
    assert.deepEqual(source, before);
    preview.dispose();
  }
});

test('stepping and cosmetic changes use actual prey movement, drone corners and wrap seams', () => {
  const level = recipe(),
    specimens = [],
    preview = createSnakeStudioPreview({
      draw(canvas, run, options) {
        specimens.push({ run: structuredClone(run), flight: structuredClone(options.flight) });
        drawClassicBoard(canvas, run, options);
      },
    }),
    { canvas, calls } = specimen();
  preview.load(level);
  preview.draw([canvas]);
  const target = structuredClone(specimens.at(-1).run.targets[0]);
  for (let i = 0; i < 4; i++) preview.step();
  preview.draw([canvas]);
  assert.notDeepEqual(
    { x: specimens.at(-1).run.targets[0].x, y: specimens.at(-1).run.targets[0].y },
    { x: target.x, y: target.y },
  );
  // Nineteen accepted steps cross x=23 -> x=0; no synthetic body is injected.
  for (let i = 4; i < 19; i++) preview.step();
  preview.draw([canvas]);
  assert.equal(specimens.at(-1).run.snakes[0].body[0].x, 0);
  preview.turn(0, 'down');
  preview.step();
  const before = preview.snapshot();
  for (const boardStyle of ['theme', 'retro'])
    for (const style of ['cable', 'signal'])
      for (const reduced of [false, true])
        preview.draw([canvas], { boardStyle, style, reduced, brutal: true, blood: false });
  assert.deepEqual(preview.snapshot(), before);
  const body = specimens.at(-1).run.snakes[0].body;
  assert.ok(body.some((point) => point.x === 23));
  assert.notEqual(body[0].y, body[1].y);
  assert.ok(
    calls.some(([name]) => name === 'rotate'),
    'the native drone/prey rig was drawn',
  );
  preview.dispose();
});

test('paused and late preview frames cannot advance gameplay; reduced effects only freeze decoration', () => {
  const frames = [],
    preview = createSnakeStudioPreview({
      draw: (_canvas, _run, options) => frames.push(options.flight),
    });
  preview.load(recipe());
  const paused = preview.snapshot();
  preview.advance(50000);
  assert.deepEqual(preview.snapshot(), paused);
  preview.setPlaying(true);
  preview.advance(50000, { reduced: true });
  assert.equal(preview.snapshot().match.elapsedMs, 100);
  preview.advance(100, { reduced: true });
  preview.draw([{}], { reduced: true });
  assert.equal(preview.snapshot().match.boards[0].tick, 1);
  assert.equal(frames.at(-1).timeMs, 0);
  preview.step();
  assert.equal(preview.snapshot().playing, false);
  assert.equal(preview.snapshot().match.boards[0].tick, 2);
  preview.dispose();
});

test('invalid replacement retires the previous accepted board and restart retains the fixed seed', () => {
  let drawings = 0;
  const level = recipe(),
    preview = createSnakeStudioPreview({ draw: () => drawings++ });
  preview.load(level, { mode: 'versus' });
  const first = preview.snapshot();
  // Mutating the authoring object cannot mutate the already accepted preview.
  level.walls.push({ x: level.spawns[0].x, y: level.spawns[0].y });
  preview.step();
  assert.equal(preview.snapshot().match.boards[0].tick, 1);
  assert.throws(() => preview.load(level), /Snake cell|fields|bodies/);
  assert.equal(preview.snapshot().match, null);
  preview.draw([{}, {}]);
  assert.equal(drawings, 0);
  preview.load(recipe(), { mode: 'versus' });
  assert.deepEqual(preview.snapshot(), first);
  preview.dispose();
  assert.equal(preview.turn(0, 'left'), false);
  assert.equal(preview.setPlaying(true).playing, false);
  preview.draw([{}, {}]);
  assert.equal(drawings, 0);
  assert.throws(() => preview.load(recipe()), /disposed/);
});
