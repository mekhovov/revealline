import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { paintCharacter } from '../../authoring/motion-lab/render-character.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { BoardPainter, playerPaintSize } from '../ui/render.mjs';
import { playerBodyOffset } from '../ui/player-body-layout.mjs';

const presets = JSON.parse(
  readFileSync(new URL('../../authoring/motion-lab/presets.json', import.meta.url)),
);
const positions = [
  [36.125, 0.5],
  [71.5, 18.125],
  [36.125, 35.5],
  [0.5, 18.125],
  [0.5, 0.5],
  [71.5, 0.5],
  [71.5, 35.5],
  [0.5, 35.5],
];

// Independent Canvas command geometry: observe actual paint primitives after
// the real transform stack, without trusting the layout helper's bounds.
function surface(width = 240) {
  let matrix = [1, 0, 0, 1, 0, 0],
    path = [],
    values = { lineWidth: 1 };
  const stack = [],
    shapes = [],
    calls = [];
  const transform = (a, b, c, d, e, f) => {
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
  const point = (x, y) => [
    matrix[0] * x + matrix[2] * y + matrix[4],
    matrix[1] * x + matrix[3] * y + matrix[5],
  ];
  const rect = (x, y, w, h) =>
    [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ].map(([x, y]) => point(x, y));
  const ctx = new Proxy(
    { canvas: { width: 1152, height: 576, clientWidth: width } },
    {
      get(target, key) {
        if (key in target) return target[key];
        if (key in values) return values[key];
        return (...args) => {
          calls.push({ op: key, args, ...values });
          if (key === 'save') stack.push({ matrix: [...matrix], values: { ...values } });
          if (key === 'restore') ({ matrix, values } = stack.pop());
          if (key === 'translate') transform(1, 0, 0, 1, ...args);
          if (key === 'scale') transform(args[0], 0, 0, args[1], 0, 0);
          if (key === 'rotate')
            transform(
              Math.cos(args[0]),
              Math.sin(args[0]),
              -Math.sin(args[0]),
              Math.cos(args[0]),
              0,
              0,
            );
          if (key === 'transform') transform(...args);
          if (key === 'beginPath') path = [];
          if (key === 'moveTo' || key === 'lineTo') path.push(point(...args));
          if (key === 'arc' || key === 'ellipse') {
            const [x, y, rx] = args,
              ry = key === 'arc' ? rx : args[3];
            for (let i = 0; i < 96; i++)
              path.push(
                point(x + Math.cos((i * Math.PI) / 48) * rx, y + Math.sin((i * Math.PI) / 48) * ry),
              );
          }
          if (key === 'fill' || key === 'stroke') {
            const ex =
                key === 'stroke' ? (values.lineWidth / 2) * Math.hypot(matrix[0], matrix[2]) : 0,
              ey = key === 'stroke' ? (values.lineWidth / 2) * Math.hypot(matrix[1], matrix[3]) : 0;
            shapes.push({
              kind: key,
              points: path.flatMap(([x, y]) => [
                [x - ex, y - ey],
                [x + ex, y + ey],
              ]),
              ...values,
            });
          }
          if (key === 'fillRect' || key === 'strokeRect')
            shapes.push({ kind: key, points: rect(...args), ...values });
          if (key === 'drawImage')
            shapes.push({ kind: key, image: args[0], points: rect(...args.slice(-4)), ...values });
        };
      },
      set(_target, key, value) {
        values[key] = value;
        return true;
      },
    },
  );
  return { ctx, shapes, calls };
}

function inside(shapes, width, height, margin = 0) {
  for (const shape of shapes)
    for (const [x, y] of shape.points) {
      assert.ok(
        x >= margin - 1e-8 && x <= width - margin + 1e-8,
        `horizontal clipping: ${x} / ${width} (${shape.kind})`,
      );
      assert.ok(
        y >= margin - 1e-8 && y <= height - margin + 1e-8,
        `vertical clipping: ${y} / ${height} (${shape.kind})`,
      );
    }
}

function poseFor(
  width,
  image,
  { heading = 0, bank = 0, reducedMotion = false, recipe, body } = {},
) {
  body ||= {
    ...presets.characters['fpv-scout-v1'],
    headingOffsetDegrees: 23,
    presentationPivot: { x: 0.36, y: 0.61 },
    centerMark: { widthCells: 0.18, heightCells: 0.24, topColor: '#fff', bottomColor: '#000' },
  };
  return {
    body,
    image,
    recipe: recipe || presets.animationRecipes[body.animationRecipe],
    animation: { time: 0.37, phases: { propellers: 1.9 }, rates: { propellers: { rawRps: 9 } } },
    scale: playerPaintSize(body, image, {
      screenScale: width / 1152,
      canvasCSSWidth: width,
      style: 'hybrid',
      scale: 1,
    }).scale,
    heading,
    bank,
    speedRatio: 1.2,
    reducedMotion,
    pixel: 1 / 16,
    colors: { body: '#ff0', accent: '#0ff' },
  };
}

test('gameplay player bodies can suppress detached procedural rotor overlays', () => {
  const pose = poseFor(390, { width: 64, height: 64 }),
    withRotors = surface(),
    cleanBody = surface();
  paintCharacter(withRotors.ctx, { ...pose, x: 12, y: 8 });
  paintCharacter(cleanBody.ctx, { ...pose, x: 12, y: 8, showRotors: false });
  assert.ok(withRotors.calls.some((call) => call.op === 'arc'));
  assert.equal(
    cleanBody.calls.some((call) => call.op === 'arc'),
    false,
    'the approved body remains without external corner-blade circles',
  );
  assert.equal(cleanBody.calls.filter((call) => call.op === 'drawImage').length, 1);
});

for (const width of [240, 320, 240, 514])
  for (const [treatment, image] of [
    ['compact', { width: 64, height: 48 }],
    ['detailed', { width: 96, height: 128 }],
    ['missing', null],
  ])
    test(`${width}px ${treatment}: actual full craft stays inside all edges/corners, headings and banks`, () => {
      for (const [x, y] of positions)
        for (const heading of [0, Math.PI / 4, Math.PI / 2, Math.PI, Math.PI * 1.5])
          for (const bank of [-0.16, 0, 0.16])
            for (const reducedMotion of [false, true]) {
              const pose = poseFor(width, image, { heading, bank, reducedMotion }),
                margin = 72 / width,
                offset = playerBodyOffset(pose, { x, y, width: 72, height: 36, margin }),
                s = surface();
              paintCharacter(s.ctx, { ...pose, x: x + offset.x, y: y + offset.y });
              inside(s.shapes, 72, 36, margin);
            }
    });

test('actual old unshifted paint clips the upper edge; inset retains the same image and body scale', () => {
  const image = { width: 64, height: 64 },
    pose = poseFor(254, image),
    before = surface(),
    after = surface();
  paintCharacter(before.ctx, { ...pose, x: 36.5, y: 0.5 });
  assert.ok(
    before.shapes.some((s) => s.points.some(([, y]) => y < 0)),
    'observed inherited placement reproduces',
  );
  const offset = playerBodyOffset(pose, {
    x: 36.5,
    y: 0.5,
    width: 72,
    height: 36,
    margin: 72 / 254,
  });
  paintCharacter(after.ctx, { ...pose, x: 36.5 + offset.x, y: 0.5 + offset.y });
  inside(after.shapes, 72, 36, 72 / 254);
  assert.deepEqual(
    before.calls.filter((c) => c.op === 'drawImage').map((c) => c.args),
    after.calls.filter((c) => c.op === 'drawImage').map((c) => c.args),
  );
});

test('all rotor shapes/phases and recipe attachments stay within a stable envelope', () => {
  const image = { width: 128, height: 96 };
  for (const bladeShape of ['paddle', 'swept', 'tapered']) {
    const body = {
      ...presets.characters['fpv-scout-v1'],
      rotors: [{ x: -0.6, y: -0.6, radiusScale: 2, phaseDegrees: 31, direction: 1 }],
    };
    const recipe = {
      components: [
        {
          ...presets.animationRecipes['fpv-tri'].components[0],
          id: 'rotor',
          bladeShape,
          bladeWidth: 0.5,
          radius: 0.35,
        },
        {
          id: 'wing',
          type: 'wings',
          anchors: [[0.2, 0, -1]],
          span: 0.6,
          chord: 0.2,
          foldFraction: 0.5,
          amplitudeDegrees: 40,
          color: '#fff',
          tipColor: '#000',
        },
        {
          id: 'thrust',
          type: 'thruster',
          anchors: [[0, 0.3]],
          width: 0.3,
          length: 0.4,
          speedGain: 1,
          flickerHz: 4,
          color: '#fff',
          innerColor: '#000',
        },
        {
          id: 'pulse',
          type: 'pulse',
          anchors: [[0.1, 0]],
          radius: 0.5,
          amplitude: 0.2,
          opacity: 0.4,
          frequencyHz: 1,
          color: '#fff',
        },
        {
          id: 'blink',
          type: 'blink',
          anchors: [[-0.5, 0.5]],
          size: 0.15,
          frequencyHz: 2,
          dutyCycle: 0.5,
          color: '#fff',
        },
      ],
    };
    let previous;
    for (let phase = 0; phase < Math.PI * 2; phase += 0.19) {
      const pose = poseFor(240, image, { body, recipe, heading: Math.PI / 4, bank: -0.16 });
      pose.animation = {
        time: phase,
        phases: { rotor: phase, wing: phase },
        rates: { rotor: { rawRps: 12 } },
      };
      pose.speedRatio = phase % 4;
      const offset = playerBodyOffset(pose, { x: 0.5, y: 0.5, width: 72, height: 36, margin: 0.3 }),
        s = surface();
      if (previous)
        assert.deepEqual(offset, previous, 'animation phases must not jiggle the craft origin');
      previous = offset;
      paintCharacter(s.ctx, { ...pose, x: 0.5 + offset.x, y: 0.5 + offset.y });
      inside(s.shapes, 72, 36, 0.3);
    }
  }
});

test('interior fractional position is exact; invalid and impossible-fit bounds stay finite', () => {
  const pose = poseFor(240, { width: 64, height: 48 }, { heading: 0.63, bank: 0.16 });
  assert.deepEqual(
    playerBodyOffset(pose, { x: 36.123, y: 18.234, width: 72, height: 36, margin: 0.3 }),
    { x: 0, y: 0 },
  );
  assert.deepEqual(playerBodyOffset(pose, { x: NaN, y: 0, width: 72, height: 36 }), { x: 0, y: 0 });
  const small = { x: 0.5, y: 0.5, width: 1, height: 1, margin: 0.1 };
  const a = playerBodyOffset(pose, small),
    b = playerBodyOffset(pose, small);
  assert.ok(Object.values(a).every(Number.isFinite));
  assert.deepEqual(a, b);
});

test('real BoardPainter insets only the craft and preserves exact contact, active head, trail and checkpoint', () => {
  const run = createRun({
    version: 'xonix-level.v3',
    id: 'edge-body',
    revision: '1',
    name: 'Edge body',
    width: 72,
    height: 36,
    encounter: null,
    spawn: { x: 4.5, y: 0.5 },
    walls: [],
    enemies: [],
    supplies: [],
    objectives: [],
    goal: { coverage: 0.9 },
  });
  for (let i = 0; i < 8; i++) stepRun(run, { direction: 'down' }, FIXED_DT);
  assert.ok(run.trailSegments.length > 0);
  const checkpoint = authoritativeCheckpoint(run),
    image = { width: 64, height: 64 },
    painter = new BoardPainter(presets),
    s = surface(240);
  painter.theme = {
    id: 'fpv',
    palette: {
      paper: '#000',
      ink: '#eee',
      safe: '#0f0',
      accent: '#ff0',
      muted: '#777',
      danger: '#f00',
    },
  };
  painter.body = presets.characters['fpv-scout-v1'];
  painter.image = image;
  painter.recipe = presets.animationRecipes[painter.body.animationRecipe];
  painter.background = { width: 384, height: 288 };
  painter.draw(s.ctx, run, 0.04, { paused: true });
  const bodies = s.shapes.filter((shape) => shape.image === image);
  assert.equal(bodies.length, 1);
  inside(bodies, 1152, 576, 1152 / 240);
  const contact = s.calls.filter(
    (c) => c.op === 'arc' && c.args[2] === run.rules.playerRadius * 16,
  );
  assert.ok(
    contact.some((c) => c.args[0] === run.player.x * 16 && c.args[1] === run.player.y * 16),
  );
  const segment = run.trailSegments[0];
  assert.ok(
    s.calls.some(
      (c) => c.op === 'moveTo' && c.args[0] === segment.x1 * 16 && c.args[1] === segment.y1 * 16,
    ),
  );
  assert.ok(
    s.calls.some(
      (c) => c.op === 'lineTo' && c.args[0] === segment.x2 * 16 && c.args[1] === segment.y2 * 16,
    ),
  );
  assert.ok(
    s.calls.some(
      (c) =>
        c.op === 'fillRect' &&
        c.args[0] === Math.round(run.player.x * 16 - 6) &&
        c.args[1] === Math.round(run.player.y * 16 - 6) &&
        c.args[2] === 12,
    ),
  );
  assert.ok(
    s.calls.findIndex((c) => c.op === 'drawImage' && c.args[0] === image) <
      s.calls.findLastIndex((c) => c.op === 'arc' && c.args[2] === run.rules.playerRadius * 16),
  );
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
});
