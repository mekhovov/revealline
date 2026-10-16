import {
  compileTerrainCell,
  TERRAIN_FORMAT,
} from '../../../optional-practice/civilian-fpv/regional/terrain-cell.mjs';
import {
  compileSceneryCell,
  SCENERY_FORMAT,
} from '../../../optional-practice/civilian-fpv/regional/scenery-cell.mjs';
export async function digest(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');
}
const point = (x) => ({ x: x * 128000 + 64000, y: 10000, z: 6000 });
export async function createEnduranceFixture(sceneryGround = false) {
  const layers = {};
  for (const kind of ['terrain', 'scenery']) {
    const assets = [],
      chunks = [],
      bodies = new Map();
    let requests = 0,
      intercept = null;
    for (let x = 0; x < 6; x++) {
      const base = { chunkId: `tile-${x}`, x, z: 0, cellSizeMm: 128000 };
      const cell =
        kind === 'terrain'
          ? {
              format: TERRAIN_FORMAT,
              ...base,
              samples: 33,
              heightsMm: Array(1089).fill(0),
            }
          : {
              format: SCENERY_FORMAT,
              ...base,
              surfaces: [
                ...(sceneryGround
                  ? [
                      {
                        id: 'floor',
                        positionsMm: [0, 0, 0, 128000, 0, 0, 0, 0, 128000, 128000, 0, 128000],
                        indices: [0, 2, 1, 1, 2, 3],
                        color: [0.4, 0.4, 0.4],
                      },
                    ]
                  : []),
                {
                  id: 'roof',
                  positionsMm: [
                    30000, 8000, 30000, 90000, 8000, 30000, 30000, 8000, 90000, 90000, 8000, 90000,
                  ],
                  indices: [0, 2, 1, 1, 2, 3],
                  color: [0.5, 0.4, 0.3],
                },
                {
                  id: 'wall',
                  positionsMm: [
                    100000, 0, 10000, 100000, 20000, 10000, 100000, 0, 100000, 100000, 20000,
                    100000,
                  ],
                  indices: [0, 1, 2, 1, 3, 2],
                  color: [0.5, 0.4, 0.3],
                },
              ],
            };
      const ids = [];
      for (const [type, bytes] of [
        ['scene', (kind === 'terrain' ? compileTerrainCell : compileSceneryCell)(cell).glb],
        ['collision', new TextEncoder().encode(JSON.stringify(cell))],
      ]) {
        const id = `tile-${x}-${type}`,
          path = `${id}.${type === 'scene' ? 'glb' : 'json'}`;
        assets.push({
          id,
          kind: type,
          path,
          bytes: bytes.length,
          sha256: await digest(bytes),
        });
        bodies.set(path, bytes);
        ids.push(id);
      }
      chunks.push({ id: base.chunkId, x, z: 0, assets: ids });
    }
    layers[kind] = {
      requests: () => requests,
      setIntercept(value) {
        intercept = value;
      },
      manifest: {
        format: 'FPVRegionManifest.v1',
        id: 'mixed-check',
        revision: 'r1',
        title: { en: 'Mixed', uk: 'Змішаний' },
        grid: {
          cellSizeMm: 128000,
          minX: 0,
          minZ: 0,
          width: 6,
          depth: 1,
          floorMm: -1000,
          ceilingMm: 1000000,
        },
        assets,
        chunks,
        spawns: [{ id: 'start', position: point(0) }],
      },
      source: {
        baseURL: `https://${kind}.example/`,
        fetchImpl: async (url, options) => {
          requests++;
          const key = new URL(url).pathname.slice(1);
          const replacement = await intercept?.(key, options);
          const bytes = replacement ?? bodies.get(key);
          return new Response(bytes, { status: bytes ? 200 : 404 });
        },
      },
    };
  }
  return layers;
}

export function createEndurancePilot() {
  let direction = 1,
    reversals = 0;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  return {
    get reversals() {
      return reversals;
    },
    command(state) {
      if (direction > 0 && state.position.x > 650000) {
        direction = -1;
        reversals++;
      }
      if (direction < 0 && state.position.x < 110000) {
        direction = 1;
        reversals++;
      }
      const target = direction > 0 ? 700000 : 64000;
      const roll = clamp(
        (target - state.position.x) / 180000 - state.velocity.x / 18000,
        -0.3,
        0.3,
      );
      const throttle = clamp(
        0.5 +
          (20000 - state.position.y) / 140000 -
          state.velocity.y / 24000 +
          Math.abs(roll) * 0.015,
        0.2,
        0.8,
      );
      return { roll, pitch: 0, yaw: 0, throttle };
    },
  };
}
