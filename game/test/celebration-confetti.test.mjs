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

test('every world celebrates with bounded paper and stars without equipment', () => {
  for (const family of families) {
    const source = createCelebration({ theme: { family }, levelId: 'picture', seed: 17 });
    let seenPaper = false;
    for (let elapsed = 0; elapsed < CELEBRATION_SECONDS; elapsed += 0.05) {
      const frame = at(source, elapsed);
      assert.deepEqual(frame.equipment, []);
      assert.ok(frame.particles.length <= 120);
      for (const particle of frame.particles) {
        assert.ok(['paper', 'glint'].includes(particle.shape));
        assert.ok(particle.x > -0.25 && particle.x < 1.25);
        assert.ok(Number.isFinite(particle.y) && Number.isFinite(particle.rotation));
        assert.ok(particle.alpha >= 0 && particle.alpha <= 1);
        if (particle.shape === 'paper') {
          seenPaper = true;
          assert.ok(particle.flip >= 0.18 && particle.flip <= 1);
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
    if (method === 'fillRect') assert.ok(width <= 10 && height <= 23);
  }
  assert.deepEqual(frame, before);
});

test('confetti launches at the center and expands into all four quadrants', () => {
  const source = createCelebration({ seed: 17 });
  const launch = at(source, 0.1).particles;
  assert.ok(launch.length > 0);
  for (const p of launch) assert.ok(Math.hypot(p.x - 0.5, p.y - 0.5) < 0.05);
  const bloom = at(source, 0.75).particles;
  for (const [dx, dy] of [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ]) {
    assert.ok(bloom.some((p) => (p.x - 0.5) * dx > 0.15 && (p.y - 0.5) * dy > 0.15));
  }
  const radius = (time) => {
    const particles = at(source, time).particles.filter((p) => p.shape === 'paper');
    return (
      particles.reduce((sum, p) => sum + Math.hypot(p.x - 0.5, p.y - 0.5), 0) / particles.length
    );
  };
  assert.ok(radius(1.4) > radius(0.75));
  assert.ok(at(source, 3.7).particles.every((p) => p.alpha < 0.01));
});

test('burst uses equal pixel distances from the center on portrait and wide surfaces', () => {
  for (const [width, height] of [
    [1280, 640],
    [390, 844],
  ]) {
    const ctx = drawingContext();
    drawCelebration(
      ctx,
      {
        active: true,
        particles: [
          {
            shape: 'paper',
            x: 0.75,
            y: 0.75,
            size: 6,
            alpha: 1,
            aspect: 0.5,
            rotation: 0,
            flip: 1,
          },
        ],
      },
      {},
      width,
      height,
    );
    const [, x, y] = ctx.calls.find(([name]) => name === 'translate');
    assert.equal(x - width / 2, y - height / 2);
    assert.equal(x - width / 2, Math.min(width, height) / 4);
  }
});
