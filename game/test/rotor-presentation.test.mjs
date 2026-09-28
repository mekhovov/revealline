import test from 'node:test';
import assert from 'node:assert/strict';
import { paintRotor, preparedRotorRecipe } from '../ui/rotor-presentation.mjs';

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
