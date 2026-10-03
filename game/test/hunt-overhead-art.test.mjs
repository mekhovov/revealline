import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTOR_FAMILIES, ACTOR_VISUALS } from '../hunt/actor-catalog.mjs';
import {
  drawHuntActor,
  OVERHEAD_ACTOR_ART_REVISION,
  OVERHEAD_ACTOR_SAMPLES,
} from '../hunt/actor-art.mjs';

// Record actual canvas transforms and polygons, including compact scaling. This
// catches clipped accessories and double rotation without screenshot snapshots.
function context() {
  let matrix = [1, 0, 0, 1, 0, 0],
    rotation = 0;
  const stack = [],
    paints = [],
    rotations = [];
  function multiply([a, b, c, d, e, f]) {
    const [aa, ab, ac, ad, ae, af] = matrix;
    matrix = [
      aa * a + ac * b,
      ab * a + ad * b,
      aa * c + ac * d,
      ab * c + ad * d,
      aa * e + ac * f + ae,
      ab * e + ad * f + af,
    ];
  }
  return {
    paints,
    rotations,
    fillStyle: '#000000',
    globalAlpha: 1,
    imageSmoothingEnabled: true,
    save() {
      stack.push({ matrix: [...matrix], style: this.fillStyle, alpha: this.globalAlpha });
    },
    restore() {
      const old = stack.pop();
      matrix = old.matrix;
      this.fillStyle = old.style;
      this.globalAlpha = old.alpha;
    },
    translate(x, y) {
      multiply([1, 0, 0, 1, x, y]);
    },
    scale(x, y) {
      multiply([x, 0, 0, y, 0, 0]);
    },
    rotate(angle) {
      rotations.push(angle);
      rotation++;
      const c = Math.cos(angle),
        s = Math.sin(angle);
      multiply([c, s, -s, c, 0, 0]);
    },
    fillRect(x, y, width, height) {
      const [a, b, c, d, e, f] = matrix;
      paints.push({
        color: this.fillStyle,
        rotation,
        alpha: this.globalAlpha,
        rect: [x, y, width, height],
        corners: [
          [x, y],
          [x + width, y],
          [x, y + height],
          [x + width, y + height],
        ].map(([px, py]) => [a * px + c * py + e, b * px + d * py + f]),
      });
    },
  };
}
function draw(options = {}, size = 32) {
  const ctx = context();
  drawHuntActor(ctx, 0, 0, size, 0, {
    artRevision: OVERHEAD_ACTOR_ART_REVISION,
    shadow: false,
    ...options,
  });
  return ctx;
}

test('new overhead review covers every family and cast with bounded transparent rotating silhouettes', () => {
  assert.deepEqual(
    Object.keys(OVERHEAD_ACTOR_SAMPLES),
    ACTOR_FAMILIES.map((family) => family.id),
  );
  for (const detail of ['compact', 'detailed']) {
    const identities = new Set();
    for (const visual of ACTOR_VISUALS) {
      const front = draw({ visualId: visual.id, detail, token: true });
      identities.add(JSON.stringify(front.paints));
      assert.deepEqual(front.paints, draw({ visualId: visual.id, detail, token: false }).paints);
      for (const angle of [0, Math.PI / 4, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        for (const pose of [0, 1 / 6, 2 / 6, 4 / 6, 5 / 6]) {
          const ctx = draw({
            visualId: visual.id,
            detail,
            facingRadians: angle,
            locomotionPhase: pose,
            state: 'walk',
          });
          // The later specialist tell has its own established paint envelope.
          // Check the complete body/accessory pass before those markers.
          const body = ctx.paints.filter((paint) => paint.rotation === 1);
          assert.ok(body.length > 25 && body.length < 130, visual.id);
          for (const paint of body) {
            assert.ok(paint.rect[2] > 0 && paint.rect[3] > 0);
            for (const [x, y] of paint.corners)
              assert.ok(
                x >= -1e-8 && x <= 32 + 1e-8 && y >= -1e-8 && y <= 32 + 1e-8,
                `${visual.id}/${detail} accessory escaped at ${angle}`,
              );
            assert.notEqual(paint.color, visual.palette.skin, 'no frontal face under the crown');
          }
          assert.equal(ctx.rotations[0], angle);
        }
      }
    }
    assert.equal(identities.size, 36);
  }
});

test('overhead crown overlaps the shoulder plane instead of sitting above an upright torso', () => {
  const detailed = draw({ family: 'runner', detail: 'detailed', reducedEffects: true }),
    compact = draw({ family: 'runner', detail: 'compact', reducedEffects: true });
  // Outlined shoulder and crown planes deliberately overlap vertically. Rear
  // kit and soles are brief ground-plane glimpses, not a lower portrait half.
  for (const [ctx, shoulders, crown] of [
    [detailed, [7, 12, 18, 10], [11, 10, 10, 11]],
    [compact, [3, 6, 10, 5], [5, 5, 6, 5]],
  ]) {
    const shoulderIndex = ctx.paints.findIndex(
        (paint) => JSON.stringify(paint.rect) === JSON.stringify(shoulders),
      ),
      crownIndex = ctx.paints.findIndex(
        (paint) => JSON.stringify(paint.rect) === JSON.stringify(crown),
      );
    assert.ok(shoulderIndex >= 0 && crownIndex > shoulderIndex);
    assert.ok(crown[1] + crown[3] > shoulders[1] + shoulders[3] * 0.75);
  }
});

test('native locomotion drives overhead legs without the old idle clock alias; pause and Pulse stay fixed', () => {
  const moving = (locomotionPhase, timeMs) =>
    draw({
      family: 'runner',
      state: 'walk',
      locomotionPhase,
      timeMs,
    }).paints;
  assert.notDeepEqual(moving(0, 0), moving(1 / 6, 300));
  assert.deepEqual(moving(1 / 6, 100), moving(1 / 6, 300));
  for (const frozen of ['frozen', 'paused', 'reducedEffects'])
    assert.deepEqual(
      draw({ family: 'runner', state: 'walk', [frozen]: true, timeMs: 100 }).paints,
      draw({ family: 'runner', state: 'walk', [frozen]: true, timeMs: 9999 }).paints,
    );
});

test('time-only overhead and explicit Studio Move sample every admitted movement frame', () => {
  for (const detail of ['compact', 'detailed']) {
    const frames = [0, 100, 200, 300, 400, 500].map(
      (timeMs) => draw({ family: 'runner', detail, state: 'walk', timeMs }).paints,
    );
    assert.deepEqual(frames[0], frames[3], 'the two authored passing poses match');
    for (const frame of [1, 2, 4, 5]) {
      assert.notDeepEqual(
        frames[frame],
        frames[0],
        `movement frame ${frame} must not be suppressed`,
      );
      assert.deepEqual(
        frames[frame],
        draw({ family: 'runner', detail, state: 'walk', locomotionPhase: frame / 6 }).paints,
      );
    }
    const preview = (timeMs) =>
      draw({
        family: 'runner',
        detail,
        state: 'walk',
        timeMs,
        artRevision: 'industrial-pilot-v1',
        animationClip: 'move',
      }).paints;
    assert.notDeepEqual(preview(0), preview(100));
    assert.notDeepEqual(preview(0), preview(400));
    assert.notDeepEqual(preview(0), preview(500));
  }
});

test('specialist fronts use accepted heading, while pending turns and open armor remain separate tells', () => {
  const options = Object.freeze({
      family: 'shield-bearer',
      heading: 'left',
      nextHeading: 'up',
      facingRadians: Math.PI / 2,
      phase: 'turning',
      frozen: true,
    }),
    before = JSON.stringify(options),
    ctx = draw(options);
  assert.deepEqual(ctx.rotations, [-Math.PI / 2, -Math.PI / 2, 0]);
  assert.equal(JSON.stringify(options), before);
  assert.notDeepEqual(
    draw({ family: 'brace-trooper', phase: 'warning', frozen: true }).paints,
    draw({ family: 'brace-trooper', phase: 'rest', frozen: true }).paints,
  );
  assert.deepEqual(
    draw({ family: 'guard' }).paints,
    draw({ family: 'guard', armed: false }).paints,
  );
  assert.notDeepEqual(
    draw({ family: 'guard' }).paints,
    draw({ family: 'guard', armed: true }).paints,
  );
});

test('the new art is explicitly pinned; released and previous pilot selections stay distinct', () => {
  const released = draw({ family: 'runner', artRevision: 'released' }).paints,
    unknown = draw({ family: 'runner', artRevision: 'unknown-future-revision' }).paints,
    previous = draw({ family: 'runner', artRevision: 'industrial-pilot-v1' }).paints,
    overhead = draw({ family: 'runner' }).paints;
  assert.deepEqual(released, unknown);
  assert.notDeepEqual(released, previous);
  assert.notDeepEqual(previous, overhead);
  assert.notDeepEqual(released, overhead);
});
