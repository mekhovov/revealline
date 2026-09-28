import test from 'node:test';
import assert from 'node:assert/strict';
import {
  paintRotor,
  preparedRotorRecipe,
  PREPARED_ROTOR_COLORS,
} from '../ui/rotor-presentation.mjs';
import { paintCharacter } from '../../authoring/motion-lab/render-character.mjs';
import { drawEnemySilhouette, drawPresentedActor } from '../ui/actor-presentation.mjs';

function surface(alpha = 1) {
  const calls = [],
    stack = [];
  let state = { globalAlpha: alpha, fillStyle: '#112233' };
  const ctx = new Proxy(
    {},
    {
      get(_, name) {
        if (name in state) return state[name];
        return (...args) => {
          calls.push({ name, args, ...state });
          if (name === 'save') stack.push({ ...state });
          if (name === 'restore') state = stack.pop();
        };
      },
      set(_, name, value) {
        state[name] = value;
        return true;
      },
    },
  );
  return { ctx, calls, stack };
}

// Replay Canvas transforms so assertions inspect painted points, not merely
// the presence of a scale/rotate command or a changing animation clock.
function paintedGeometry(calls) {
  let matrix = [1, 0, 0, 1, 0, 0],
    path = [];
  const stack = [],
    paints = [],
    point = (x, y) => [
      matrix[0] * x + matrix[2] * y + matrix[4],
      matrix[1] * x + matrix[3] * y + matrix[5],
    ],
    transform = ([a, b, c, d, e, f]) => {
      const [aa, bb, cc, dd, ee, ff] = matrix;
      matrix = [
        aa * a + cc * b,
        bb * a + dd * b,
        aa * c + cc * d,
        bb * c + dd * d,
        aa * e + cc * f + ee,
        bb * e + dd * f + ff,
      ];
    };
  for (const { name, args, fillStyle } of calls) {
    const [x, y, width, height] = args;
    if (name === 'save') stack.push([...matrix]);
    else if (name === 'restore') matrix = stack.pop();
    else if (name === 'translate') transform([1, 0, 0, 1, x, y]);
    else if (name === 'scale') transform([x, 0, 0, y, 0, 0]);
    else if (name === 'rotate')
      transform([Math.cos(x), Math.sin(x), -Math.sin(x), Math.cos(x), 0, 0]);
    else if (name === 'transform') transform(args);
    else if (name === 'beginPath') path = [];
    else if (name === 'moveTo' || name === 'lineTo') path.push(point(x, y));
    else if (name === 'fill' && path.length)
      paints.push({ color: fillStyle, origin: point(0, 0), points: [...path], kind: 'path' });
    else if (name === 'fillRect')
      paints.push({
        color: fillStyle,
        origin: point(0, 0),
        points: [
          point(x, y),
          point(x + width, y),
          point(x + width, y + height),
          point(x, y + height),
        ],
        kind: 'rect',
      });
  }
  assert.equal(stack.length, 0, 'painting restores its transform stack');
  return paints;
}

const close = (actual, expected, message) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} != ${expected}`);
const localPoint = ([x, y], [cx, cy], angle) => [
  (x - cx) * Math.cos(angle) + (y - cy) * Math.sin(angle),
  -(x - cx) * Math.sin(angle) + (y - cy) * Math.cos(angle),
];
const paintedAngle = ({ points, origin }) =>
  Math.atan2(points[1][1] - origin[1], points[1][0] - origin[0]);
const rotorPaths = (calls) =>
  paintedGeometry(calls).filter(
    (paint) => paint.kind === 'path' && paint.color === PREPARED_ROTOR_COLORS.fillColor,
  );

test('rotor blades and sweep preserve inherited downed opacity and restore caller state', () => {
  const { ctx, calls, stack } = surface(0.45);
  paintRotor(ctx, { radius: 4, phase: 0.31, blurOpacity: 0.08 });
  const paints = calls.filter((call) => ['fill', 'fillRect'].includes(call.name));
  assert.ok(paints.length > 0);
  assert.equal(paints[0].globalAlpha, 0.45 * 0.08, 'sweep alpha multiplies inherited opacity');
  assert.ok(paints.slice(1).every((call) => call.globalAlpha === 0.45));
  assert.equal(ctx.globalAlpha, 0.45);
  assert.equal(ctx.fillStyle, '#112233');
  assert.equal(stack.length, 0);
});

for (const shape of ['swept', 'tapered', 'paddle'])
  test(`${shape} blades originate at each hub and stay inside its declared sweep`, () => {
    const radius = 4,
      { ctx, calls } = surface();
    paintRotor(ctx, {
      radius,
      bladeShape: shape,
      bladeCount: 4,
      bladeWidth: 0.5,
      pixel: 1,
    });
    const starts = calls.filter((call) => call.name === 'moveTo');
    assert.equal(starts.length, 4);
    assert.ok(starts.every((call) => call.args[0] === 0 && call.args[1] === 0));
    for (const { name, args } of calls) {
      if (name === 'lineTo') assert.ok(Math.hypot(...args) <= radius + 1e-12);
      if (name === 'fillRect') {
        const [x, y, width, height] = args;
        for (const [xx, yy] of [
          [x, y],
          [x + width, y],
          [x, y + height],
          [x + width, y + height],
        ])
          assert.ok(Math.hypot(xx, yy) <= radius + 1e-12);
      }
    }
    assert.equal(
      calls.some((call) => call.name === 'stroke'),
      false,
      'no detached corner rim',
    );
  });

test('prepared geometry keeps exact radii and uses the densest declared blade pattern without mutating source recipes', () => {
  const recipe = {
      components: [
        { id: 'motors', type: 'rotors', radius: 0.2, bladeCount: 2, fillColor: '#abcdef' },
        { id: 'status', type: 'blink', color: '#ffffff' },
      ],
    },
    geometry = {
      rotors: [{ bladeCount: 2 }, { bladeCount: 4 }],
    },
    original = structuredClone(recipe),
    result = preparedRotorRecipe(recipe, geometry);
  assert.equal(
    result.components[0].radius,
    0.16,
    'normalized anchor radii retain their exact scale',
  );
  assert.equal(
    result.components[0].bladeCount,
    4,
    'one shared phase is safe for both hub patterns',
  );
  assert.equal(result.components[1], recipe.components[1]);
  assert.equal(preparedRotorRecipe(recipe, geometry), result);
  assert.deepEqual(recipe, original);
});

for (const shape of ['swept', 'tapered', 'paddle'])
  test(`${shape} counter-rotating blades and tips mirror in their radial frame without moving the hub`, () => {
    for (const bladeCount of [2, 3, 4]) {
      const phase = 0.37,
        paint = (direction) => {
          const { ctx, calls } = surface();
          ctx.translate(13, 17);
          paintRotor(ctx, { radius: 7, phase, direction, bladeCount, bladeShape: shape });
          return paintedGeometry(calls);
        },
        positive = paint(1),
        negative = paint(-1);
      for (let blade = 0; blade < bladeCount; blade++) {
        const angle = phase + (blade * Math.PI * 2) / bladeCount;
        for (const part of [0, 1]) {
          const a = positive[blade * 2 + part],
            b = negative[blade * 2 + part];
          assert.deepEqual(a.origin, [13, 17]);
          assert.deepEqual(b.origin, a.origin);
          a.points.forEach((point, index) => {
            const left = localPoint(point, a.origin, angle),
              right = localPoint(b.points[index], b.origin, angle);
            close(left[0], right[0], 'radial extent stays fixed');
            close(left[1], -right[1], 'blade and tip change handedness');
            assert.ok(Math.hypot(...right) <= 7 + 1e-9, 'mirrored paint stays inside sweep');
          });
        }
      }
      assert.deepEqual(positive.at(-1), negative.at(-1), 'motor hub is never mirrored or moved');
      assert.deepEqual(paint(undefined), positive, 'omitted direction preserves legacy geometry');
    }
  });

function paintedRenderer(renderer, anchors, phase, componentDirection = 1, reduced = false) {
  const { ctx, calls } = surface(),
    image = { naturalWidth: 64, naturalHeight: 32 },
    pivot = { x: 0.25, y: 0.75 };
  if (renderer === 'character')
    paintCharacter(ctx, {
      body: {
        widthCells: 1,
        heightCells: 0.5,
        headingOffsetDegrees: 0,
        presentationPivot: pivot,
        rotors: anchors,
      },
      image,
      recipe: {
        components: [
          {
            id: 'motors',
            type: 'rotors',
            radius: 0.16,
            bladeWidth: 0.38,
            bladeShape: 'swept',
            bladeCount: 3,
            direction: componentDirection,
            phaseDegrees: 17,
            ...PREPARED_ROTOR_COLORS,
          },
        ],
      },
      animation: { rates: {}, phases: { motors: phase } },
      colors: { body: '#ffffff' },
      x: 13,
      y: 17,
      scale: 100,
      reducedMotion: reduced,
    });
  else
    drawPresentedActor(
      ctx,
      {
        x: 13,
        y: 17,
        heading: 0,
        bank: 0,
        diameter: 100,
        radius: 3,
        tail: [],
        role: 'patrol',
        type: 'border-patrol',
        rotorPhase: phase,
        reduced,
      },
      { muted: '#111111', accent: '#ffffff' },
      image,
      {
        frame: { width: 64, height: 32 },
        pivot,
        rotors: anchors,
      },
    );
  return rotorPaths(calls);
}

for (const renderer of ['character', 'enemy'])
  test(`${renderer} paints signed rotation and matching handedness while preserving authored offsets and anchors`, () => {
    const anchors = [
        { x: -0.2, y: -0.1, radiusScale: 1, direction: 1, phaseDegrees: 31, bladeCount: 2 },
        { x: 0.3, y: 0.2, radiusScale: 1.25, direction: -1, phaseDegrees: -23, bladeCount: 3 },
      ],
      original = structuredClone(anchors),
      phase = 0.29,
      step = 0.04;
    for (const componentDirection of renderer === 'character' ? [1, -1] : [1]) {
      const first = paintedRenderer(renderer, anchors, phase, componentDirection),
        second = paintedRenderer(renderer, anchors, phase + step, componentDirection);
      assert.equal(first.length, 5, 'mixed blade counts survive the renderer');
      let index = 0;
      for (const anchor of anchors) {
        const direction = anchor.direction * componentDirection,
          offset = ((anchor.phaseDegrees + (renderer === 'character' ? 17 : 0)) * Math.PI) / 180,
          radius = anchor.radiusScale * 16,
          blade = first[index],
          local = localPoint(blade.points[1], blade.origin, phase * direction + offset);
        close(blade.origin[0], 13 + anchor.x * 100, 'frame-local motor x stays fixed');
        close(blade.origin[1], 17 + anchor.y * 50, 'rectangular-frame motor y stays fixed');
        close(local[0], radius * 0.55, 'signed phase retains its authored offset');
        close(
          local[1],
          -radius * 0.38 * 0.38 * direction,
          'blade profile follows effective direction',
        );
        const delta = paintedAngle(second[index]) - paintedAngle(blade);
        close(
          Math.atan2(Math.sin(delta), Math.cos(delta)),
          step * direction,
          'painted angular displacement',
        );
        index += anchor.bladeCount;
      }
      const reduced = paintedRenderer(renderer, anchors, phase, componentDirection, true);
      assert.deepEqual(
        reduced,
        paintedRenderer(renderer, anchors, phase + step, componentDirection, true),
      );
      assert.deepEqual(
        reduced,
        paintedRenderer(renderer, anchors, 0, componentDirection),
        'reduced pose retains direction and offsets',
      );
    }
    assert.deepEqual(anchors, original, 'rendering never rewrites the authored rig');
  });

test('legacy character tuples and object anchors retain their established direction defaults', () => {
  const tuples = [
      [-0.2, -0.1, 0.16],
      [0.3, 0.2, 0.2],
    ],
    explicit = tuples.map(([x, y, radius], index) => ({
      x,
      y,
      radiusScale: radius / 0.16,
      direction: index % 2 ? -1 : 1,
      phaseDegrees: index * 23,
    }));
  assert.deepEqual(
    paintedRenderer('character', tuples, 0.29),
    paintedRenderer('character', explicit, 0.29),
  );
  const objects = [
    { x: -0.2, y: -0.1 },
    { x: 0.3, y: 0.2 },
  ];
  assert.deepEqual(
    paintedRenderer('character', objects, 0.29),
    paintedRenderer(
      'character',
      objects.map((anchor) => ({ ...anchor, radiusScale: 1, direction: 1, phaseDegrees: 0 })),
      0.29,
    ),
  );
});

for (const role of ['patrol', 'contour'])
  test(`procedural ${role} rotors retain signed motion and mirror their opposite blades`, () => {
    const paint = (phase) => {
        const { ctx, calls } = surface();
        drawEnemySilhouette(
          ctx,
          { role, themeId: 'fpv', style: 'hybrid', phase: 0, travelPhase: 0, rotorPhase: phase },
          { body: '#ffffff', dark: '#111111', light: '#eeeeee', trim: '#aaaaaa' },
        );
        return rotorPaths(calls);
      },
      phase = 0.29,
      first = paint(phase),
      second = paint(phase + 0.04);
    assert.equal(first.length, (role === 'patrol' ? 4 : 2) * 3);
    for (let index = 0; index < first.length; index += 3) {
      const blade = first[index],
        [x, y] = blade.origin,
        direction = role === 'patrol' ? (x * y > 0 ? 1 : -1) : x < 0 ? 1 : -1,
        local = localPoint(blade.points[1], blade.origin, phase * direction),
        delta = paintedAngle(second[index]) - paintedAngle(blade);
      close(local[0], 5 * 0.55, 'fallback radius stays fixed');
      close(local[1], -5 * 0.34 * 0.38 * direction, 'fallback blade handedness');
      close(
        Math.atan2(Math.sin(delta), Math.cos(delta)),
        0.04 * direction,
        'fallback painted direction',
      );
    }
  });
