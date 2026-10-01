import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceCelebration,
  celebrationFrame,
  createCelebration,
  drawCelebration,
  skipCelebration,
  CELEBRATION_SECONDS,
} from '../ui/celebration.mjs';

const families = ['fpv', 'atlas', 'navi', 'retro'];
const at = (state, elapsed) => celebrationFrame({ ...state, elapsed });

function drawingContext() {
  const calls = [];
  const context = { calls, globalAlpha: 1 };
  for (const method of [
    'save',
    'restore',
    'beginPath',
    'rect',
    'clip',
    'translate',
    'rotate',
    'scale',
    'fillRect',
    'moveTo',
    'lineTo',
    'closePath',
    'fill',
  ])
    context[method] = (...args) => calls.push([method, ...args]);
  return context;
}

test('every world showers bounded paper confetti without equipment or explosive shapes', () => {
  for (const family of families) {
    const source = createCelebration({ theme: { family }, levelId: 'picture', seed: 17 });
    let seenPaper = false;
    for (let elapsed = 0; elapsed < CELEBRATION_SECONDS; elapsed += 0.05) {
      const frame = at(source, elapsed);
      assert.deepEqual(frame.equipment, []);
      assert.ok(frame.particles.length <= 80);
      for (const particle of frame.particles) {
        assert.ok(['paper', 'glint'].includes(particle.shape));
        assert.ok(particle.x > 0 && particle.x < 1);
        assert.ok(Number.isFinite(particle.y) && Number.isFinite(particle.rotation));
        assert.ok(particle.alpha >= 0 && particle.alpha <= 1);
        if (particle.shape === 'paper') {
          seenPaper = true;
          assert.ok(particle.flip >= 0.18 && particle.flip <= 1);
        } else {
          assert.ok(particle.x < 0.15 || particle.x > 0.85);
        }
      }
    }
    assert.equal(seenPaper, true);
    assert.deepEqual(at(source, CELEBRATION_SECONDS).particles, []);
  }
});

test('paper trajectories are deterministic, vary by picture seed, and freeze while paused', () => {
  const settings = { theme: { family: 'fpv' }, levelId: 'picture', seed: 17 };
  const source = createCelebration(settings);
  const original = structuredClone(source);
  assert.deepEqual(at(source, 1.2), at(createCelebration(settings), 1.2));
  assert.notDeepEqual(
    at(source, 1.2).particles,
    at(createCelebration({ ...settings, seed: 18 }), 1.2).particles,
  );
  const progressed = advanceCelebration({ ...source, elapsed: 1.2 }, 0.1);
  assert.notDeepEqual(at(source, 1.2).particles, celebrationFrame(progressed).particles);
  assert.deepEqual(
    celebrationFrame(advanceCelebration(progressed, 0.2, { paused: true })),
    celebrationFrame(progressed),
  );
  assert.deepEqual(source, original);
});

test('picture arrival eases once and settles permanently, including skip and reduced effects', () => {
  const source = createCelebration({ seed: 7 });
  let previousScale = Infinity;
  for (const elapsed of [0, 0.2, 0.7, 1, 1.35, 2.5, CELEBRATION_SECONDS, 50]) {
    const frame = at(source, elapsed);
    assert.ok(frame.pictureScale >= 1 && frame.pictureScale <= 1.014);
    assert.ok(frame.pictureScale <= previousScale);
    if (elapsed >= 1.35) assert.equal(frame.pictureScale, 1);
    previousScale = frame.pictureScale;
  }
  for (const state of [
    null,
    skipCelebration(source),
    createCelebration({ reduced: true }),
    advanceCelebration(source, 0.1, { reduced: true }),
  ]) {
    const frame = celebrationFrame(state);
    assert.equal(frame.pictureScale, 1);
    assert.equal(frame.reveal, 1);
    assert.equal(frame.active, false);
    assert.deepEqual(frame.particles, []);
    const ctx = drawingContext();
    drawCelebration(ctx, frame, {});
    assert.deepEqual(ctx.calls, []);
  }
});

test('paper drawing stays clipped to the picture and never paints a full-screen flash', () => {
  const frame = at(createCelebration({ seed: 31 }), 1.1);
  const before = structuredClone(frame);
  const ctx = drawingContext();
  drawCelebration(ctx, frame, {
    accent: '#e9c46a',
    safe: '#81b5bf',
    paper: '#f5f1e6',
    danger: '#f08168',
  });
  assert.deepEqual(ctx.calls.slice(0, 4), [
    ['save'],
    ['beginPath'],
    ['rect', 0, 0, 768, 576],
    ['clip'],
  ]);
  assert.equal(
    ctx.calls.filter(([method]) => method === 'save').length,
    ctx.calls.filter(([method]) => method === 'restore').length,
  );
  assert.ok(ctx.calls.some(([method]) => method === 'rotate'));
  for (const [method, , , width, height] of ctx.calls) {
    if (method === 'fillRect') assert.ok(width <= 8 && height <= 14);
  }
  assert.deepEqual(frame, before);
});
