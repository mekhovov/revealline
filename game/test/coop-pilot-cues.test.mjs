import test from 'node:test';
import assert from 'node:assert/strict';
import { drawPreparedPilotContact } from '../couch/coop-pilot-cues.mjs';

for (const width of [240, 390, 844, 1152])
  for (const color of ['#ffda77', '#8be0ed'])
    test(`prepared pilot keeps an unfilled physical contact at ${width}px for ${color}`, () => {
      const calls = [],
        stack = [],
        state = { strokeStyle: 'original', lineWidth: 7 };
      const ctx = new Proxy(
        {},
        {
          get(_, key) {
            if (key in state) return state[key];
            return (...args) => {
              calls.push({ op: key, args, ...state });
              if (key === 'save') stack.push({ ...state });
              if (key === 'restore') Object.assign(state, stack.pop());
            };
          },
          set(_, key, value) {
            state[key] = value;
            return true;
          },
        },
      );
      drawPreparedPilotContact(ctx, 0.25, color, width / 72);
      assert.deepEqual(
        calls.filter((c) => c.op === 'arc').map((c) => c.args),
        [[0, 0, 0.25, 0, Math.PI * 2]],
      );
      assert.equal(
        calls.filter((c) => ['fill', 'fillRect', 'translate', 'scale'].includes(c.op)).length,
        0,
      );
      const strokes = calls.filter((c) => c.op === 'stroke');
      assert.deepEqual(
        strokes.map((c) => c.strokeStyle),
        ['#07111c', color],
      );
      assert.deepEqual(strokes.map((c) => (c.lineWidth * width) / 72).map(Math.round), [3, 1]);
      assert.deepEqual(state, { strokeStyle: 'original', lineWidth: 7 });
      assert.equal(stack.length, 0);
    });
