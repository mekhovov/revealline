import test from 'node:test';
import assert from 'node:assert/strict';
import { drawCoopCueSymbol } from '../couch/coop-cue-symbols.mjs';

function context() {
  const initial = {
    globalAlpha: 0.4,
    globalCompositeOperation: 'multiply',
    lineJoin: 'bevel',
    lineCap: 'butt',
    lineWidth: 9,
    fillStyle: '#fedcba',
    strokeStyle: '#123456',
    dash: [3, 1],
  };
  let state = structuredClone(initial),
    path = [];
  const stack = [],
    calls = [],
    drawings = [];
  const methods = {
    save() {
      stack.push(structuredClone(state));
    },
    restore() {
      state = stack.pop();
    },
    beginPath() {
      path = [];
    },
    moveTo(...args) {
      path.push(['M', ...args]);
    },
    lineTo(...args) {
      path.push(['L', ...args]);
    },
    closePath() {
      path.push(['Z']);
    },
    arc(...args) {
      path.push(['A', ...args]);
    },
    setLineDash(value) {
      state.dash = [...value];
    },
    fill() {
      drawings.push({ method: 'fill', state: structuredClone(state), path: structuredClone(path) });
    },
    stroke() {
      drawings.push({
        method: 'stroke',
        state: structuredClone(state),
        path: structuredClone(path),
      });
    },
  };
  const ctx = new Proxy(
    {},
    {
      get(_, key) {
        if (key in methods)
          return (...args) => {
            calls.push([key, ...args]);
            return methods[key](...args);
          };
        if (key in state) return state[key];
        throw new Error(`Unexpected Canvas access: ${String(key)}`);
      },
      set(_, key, value) {
        if (!(key in state)) throw new Error(`Unexpected Canvas assignment: ${String(key)}`);
        state[key] = value;
        return true;
      },
    },
  );
  return { ctx, calls, drawings, initial, state: () => structuredClone(state), stack, methods };
}
const shapes = {
  hunter: [['M', 0, -1], ['L', 1, 0], ['L', 0, 1], ['L', -1, 0], ['Z']],
  'hunter-lock': [
    ['M', -1 / 3, -1],
    ['L', -1, -1],
    ['L', -1, -1 / 3],
    ['M', 1 / 3, -1],
    ['L', 1, -1],
    ['L', 1, -1 / 3],
    ['M', 1 / 3, 1],
    ['L', 1, 1],
    ['L', 1, 1 / 3],
    ['M', -1 / 3, 1],
    ['L', -1, 1],
    ['L', -1, 1 / 3],
  ],
  'hunter-charge': [
    ['M', -1, -1],
    ['L', 0, 0],
    ['L', -1, 1],
    ['M', 0, -1],
    ['L', 1, 0],
    ['L', 0, 1],
  ],
  'hunter-recovery': [['M', -1, -1], ['L', 1, -1], ['L', -1, 1], ['L', 1, 1], ['Z']],
  drifter: [['M', 0, -1], ['L', 1, 1], ['L', -1, 1], ['Z']],
  shielded: [['M', -1, -1], ['L', 1, -1], ['L', 1, 1 / 3], ['L', 0, 1], ['L', -1, 1 / 3], ['Z']],
  exposed: [
    ['M', -1, -1 / 3],
    ['L', -1, -1],
    ['L', 1, -1],
    ['L', 1, -1 / 3],
    ['M', -1, 1 / 3],
    ['L', -1, 1],
    ['L', 1, 1],
    ['L', 1, 1 / 3],
  ],
  secured: [
    ['M', -0.5, -1],
    ['L', 0.5, -1],
    ['L', 1, 0],
    ['L', 0.5, 1],
    ['L', -0.5, 1],
    ['L', -1, 0],
    ['Z'],
  ],
  'anchor-a': [
    ['M', -1, -1],
    ['L', -0.25, -1],
    ['L', -0.25, -0.55],
    ['L', 0.25, -0.55],
    ['L', 0.25, -1],
    ['L', 1, -1],
    ['L', 1, 1],
    ['L', -1, 1],
    ['Z'],
  ],
  'anchor-b': [
    ['M', -1, -1],
    ['L', -0.6, -1],
    ['L', -0.6, -0.55],
    ['L', -0.2, -0.55],
    ['L', -0.2, -1],
    ['L', 0.2, -1],
    ['L', 0.2, -0.55],
    ['L', 0.6, -0.55],
    ['L', 0.6, -1],
    ['L', 1, -1],
    ['L', 1, 1],
    ['L', -1, 1],
    ['Z'],
  ],
};
const check = [
  ['M', -0.5, 0.1],
  ['L', -0.15, 0.5],
  ['L', 0.55, -0.4],
];
const normalized = (path, half = 5.5) =>
  path.map(([command, ...coordinates]) => [command, ...coordinates.map((n) => n / half)]);
function samePath(actual, expected) {
  assert.equal(actual.length, expected.length);
  actual.forEach((command, index) => {
    assert.equal(command[0], expected[index][0]);
    assert.equal(command.length, expected[index].length);
    command
      .slice(1)
      .forEach((n, position) => assert.ok(Math.abs(n - expected[index][position + 1]) < 1e-10));
  });
}
for (const [mark, expected] of Object.entries(shapes))
  test(`${mark} retains its exact nonverbal shape with dark and light identical paths`, () => {
    const f = context(),
      bounds = drawCoopCueSymbol(f.ctx, Object.freeze({ mark }));
    const strokes = f.drawings.filter((call) => call.method === 'stroke');
    samePath(normalized(strokes[0].path), expected);
    assert.equal(strokes.length, mark === 'secured' ? 4 : 2);
    for (let i = 0; i < strokes.length; i += 2) {
      assert.deepEqual(strokes[i].path, strokes[i + 1].path);
      assert.equal(strokes[i].state.strokeStyle, '#07111c');
      assert.equal(strokes[i].state.lineWidth, 3);
      assert.equal(strokes[i + 1].state.strokeStyle, '#f1f7ed');
      assert.equal(strokes[i + 1].state.lineWidth, 1.5);
      assert.deepEqual(strokes[i].state.dash, []);
      assert.equal(strokes[i].state.globalAlpha, 1);
    }
    if (mark === 'secured') samePath(normalized(strokes[2].path), check);
    assert.ok(Object.isFrozen(bounds));
    assert.deepEqual(f.state(), f.initial);
    assert.equal(f.stack.length, 0);
  });

test('captured anchors retain one/two-notch identity and add the same check', () => {
  for (const mark of ['anchor-a', 'anchor-b']) {
    const f = context();
    drawCoopCueSymbol(f.ctx, { mark, captured: true });
    const strokes = f.drawings.filter((call) => call.method === 'stroke');
    assert.equal(strokes.length, 4);
    samePath(normalized(strokes[0].path), shapes[mark]);
    samePath(normalized(strokes[2].path), check);
    assert.deepEqual(strokes[2].path, strokes[3].path);
  }
  for (const mark of Object.keys(shapes).filter((name) => !name.startsWith('anchor'))) {
    const a = context(),
      b = context();
    drawCoopCueSymbol(a.ctx, { mark });
    drawCoopCueSymbol(b.ctx, { mark, captured: true });
    assert.deepEqual(a.drawings, b.drawings);
  }
});

test('only warning/charge show exact player circle/diamond targets in fixed reserved bounds', () => {
  for (const mark of ['hunter-lock', 'hunter-charge']) {
    const none = context(),
      a = context(),
      b = context();
    const bounds = drawCoopCueSymbol(none.ctx, { mark });
    assert.deepEqual(drawCoopCueSymbol(a.ctx, { mark, target: 0 }), bounds);
    assert.deepEqual(drawCoopCueSymbol(b.ctx, { mark, target: 1 }), bounds);
    const circle = a.drawings.filter((d) => d.method === 'stroke').at(-1).path;
    const diamond = b.drawings.filter((d) => d.method === 'stroke').at(-1).path;
    assert.deepEqual(circle, [['A', 10, -10, 2.5, 0, Math.PI * 2]]);
    assert.deepEqual(diamond, [
      ['M', 10, -13.25],
      ['L', 13.25, -10],
      ['L', 10, -6.75],
      ['L', 6.75, -10],
      ['Z'],
    ]);
    for (const target of [
      null,
      undefined,
      false,
      true,
      '0',
      '1',
      -1,
      2,
      0.5,
      NaN,
      Infinity,
      {},
      [],
    ]) {
      const f = context();
      assert.deepEqual(drawCoopCueSymbol(f.ctx, { mark, target }), bounds);
      assert.deepEqual(f.drawings, none.drawings, 'Invalid target cannot fabricate an identity.');
    }
  }
  for (const mark of Object.keys(shapes).filter(
    (name) => !['hunter-lock', 'hunter-charge'].includes(name),
  )) {
    const a = context(),
      b = context();
    drawCoopCueSymbol(a.ctx, { mark });
    drawCoopCueSymbol(b.ctx, { mark, target: 1 });
    assert.deepEqual(
      a.drawings,
      b.drawings,
      'Non-targeted phases and objectives do not imply a player target.',
    );
  }
});

test('every path and complete dark stroke stays within fixed bounds at all supported scales', () => {
  for (const size of [8, 14, 24, 64])
    for (const mark of Object.keys(shapes))
      for (const target of [null, 0, 1])
        for (const captured of [false, true]) {
          const f = context(),
            bounds = drawCoopCueSymbol(f.ctx, { mark, size, target, captured });
          for (const call of f.drawings) {
            const margin = call.method === 'stroke' ? call.state.lineWidth / 2 : 0;
            for (const [command, x, y, radius] of call.path) {
              if (command === 'Z') continue;
              const r = command === 'A' ? radius : 0;
              assert.ok(
                x - r - margin >= bounds.left - 1e-9 && x + r + margin <= bounds.right + 1e-9,
                `${mark} complete horizontal stroke`,
              );
              assert.ok(
                y - r - margin >= bounds.top - 1e-9 && y + r + margin <= bounds.bottom + 1e-9,
                `${mark} complete vertical stroke`,
              );
            }
          }
          assert.deepEqual(f.state(), f.initial);
        }
});

test('palette and pause/reduced-effect data cannot change geometry or mutate supplied records', () => {
  const a = context(),
    b = context();
  const options = Object.freeze({
    mark: 'hunter-charge',
    target: 1,
    captured: false,
    get time() {
      throw new Error('No clock access');
    },
    get run() {
      throw new Error('No gameplay access');
    },
    get reduced() {
      throw new Error('No effects-dependent meaning');
    },
    get paused() {
      throw new Error('No pause-dependent meaning');
    },
  });
  const bounds = drawCoopCueSymbol(a.ctx, options);
  assert.deepEqual(
    drawCoopCueSymbol(b.ctx, { mark: 'hunter-charge', target: 1, color: '#000', backing: '#FFF' }),
    bounds,
  );
  assert.deepEqual(
    a.drawings.map(({ method, path }) => ({ method, path })),
    b.drawings.map(({ method, path }) => ({ method, path })),
  );
  assert.deepEqual(a.state(), a.initial);
  assert.deepEqual(b.state(), b.initial);
  assert.ok(
    !a.calls.some(([name]) =>
      ['fillText', 'strokeText', 'translate', 'scale', 'rotate'].includes(name),
    ),
  );
});

test('malformed drawing inputs fail before any context mutation', () => {
  for (const options of [
    null,
    [],
    1,
    'hunter',
    {},
    { mark: 'unknown' },
    ...[null, '14', NaN, Infinity, 0, 7.999, 64.001].map((size) => ({ mark: 'hunter', size })),
    ...['red', 'rgba(1,2,3,0)', '#1234', '#12345678', '', null].map((color) => ({
      mark: 'hunter',
      color,
    })),
    { mark: 'hunter', backing: 'transparent' },
    { mark: 'anchor-a', captured: 1 },
  ]) {
    const f = context();
    assert.throws(() => drawCoopCueSymbol(f.ctx, options), TypeError);
    assert.deepEqual(f.calls, []);
    assert.deepEqual(f.state(), f.initial);
  }
  for (const ctx of [null, {}, []])
    assert.throws(() => drawCoopCueSymbol(ctx, { mark: 'hunter' }), TypeError);
});

test('drawing failure restores caller attributes without a state or clock dependency', () => {
  const f = context();
  f.methods.stroke = () => {
    throw new Error('Canvas lost');
  };
  assert.throws(() => drawCoopCueSymbol(f.ctx, { mark: 'hunter-lock', target: 0 }), /Canvas lost/);
  assert.deepEqual(f.state(), f.initial);
  assert.equal(f.stack.length, 0);
  assert.equal(f.calls.at(-1)[0], 'restore');
});
