import test from 'node:test';
import assert from 'node:assert/strict';
import { paintCharacter } from '../../authoring/motion-lab/render-character.mjs';

function paintedBladeCounts(anchors) {
  const counts = new Map();
  let hub = null;
  const centers = anchors.map((a) => `${a.x * 100},${a.y * 100}`);
  const ctx = new Proxy(
    {},
    {
      get(_target, name) {
        if (name === 'translate')
          return (x, y) => {
            const key = `${x},${y}`;
            if (centers.includes(key)) {
              hub = key;
              counts.set(key, 0);
            }
          };
        if (name === 'closePath') return () => counts.set(hub, counts.get(hub) + 1);
        return () => {};
      },
      set() {
        return true;
      },
    },
  );
  paintCharacter(ctx, {
    body: {
      widthCells: 1,
      heightCells: 1,
      headingOffsetDegrees: 0,
      rotors: anchors,
      sampling: 'nearest',
    },
    image: { naturalWidth: 32, naturalHeight: 32 },
    recipe: {
      components: [
        {
          id: 'motors',
          type: 'rotors',
          radius: 0.1,
          bladeWidth: 0.3,
          phaseDegrees: 0,
          direction: 1,
          bladeCount: 3,
          bladeShape: 'paddle',
          fillColor: '#f4bf62',
          tipColor: '#ffffff',
          hubColor: '#101923',
        },
      ],
    },
    animation: { rates: {}, phases: {} },
    colors: { body: '#ffffff' },
    scale: 100,
    reducedMotion: true,
  });
  return [...counts.values()];
}

test('the registered renderer honors mixed per-hub blade counts without changing legacy recipes', () => {
  const anchors = [
    { x: -0.2, y: -0.2, bladeCount: 2 },
    { x: 0.2, y: -0.2, bladeCount: 3 },
    { x: 0, y: 0.2, bladeCount: 4 },
  ];
  assert.deepEqual(paintedBladeCounts(anchors), [2, 3, 4]);
  assert.deepEqual(paintedBladeCounts(anchors.map(({ x, y }) => ({ x, y }))), [3, 3, 3]);
  assert.deepEqual(
    anchors.map((a) => a.bladeCount),
    [2, 3, 4],
  );
});
