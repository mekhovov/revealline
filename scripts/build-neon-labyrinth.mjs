import { neonRevealBackground } from './neon-reveal-artwork.mjs';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { validateScenario } from '../game/content.mjs';
import { validatePack } from '../game/packs.mjs';
import { encodeSpritePNG } from './produce-field-kit-sprites.mjs';

const root = new URL('../', import.meta.url);

// Merge identical horizontal spans on consecutive rows; all resulting rectangles
// are disjoint, preserving the maze's narrow gaps and stepped dividers.
function rectangles(cells, kind) {
  const result = [];
  let previous = new Map();
  for (let y = 1; y < 35; y++) {
    const current = new Map();
    for (let x = 1; x < 71; ) {
      if (cells[y * 72 + x] !== kind) {
        x++;
        continue;
      }
      const start = x;
      while (x < 71 && cells[y * 72 + x] === kind) x++;
      const key = `${start}:${x - start}`;
      const rect = previous.get(key) ?? { x: start, y, w: x - start, h: 0 };
      if (!rect.h) result.push(rect);
      rect.h++;
      current.set(key, rect);
    }
    previous = current;
  }
  return result;
}

function sprite(role) {
  const width = 32,
    height = 32,
    rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const dx = Math.abs(x - 15.5),
        dy = Math.abs(y - 15.5);
      const inside =
        role === 'wall' ||
        (role === 'enemy'
          ? dx * dx + dy * dy < 125
          : role === 'patrol'
            ? (dx < 4 || dy < 4 || Math.abs(dx - dy) < 2) && dx + dy < 20
            : role === 'lethalTerrain'
              ? Math.abs(dx - dy) < 2 && dx < 9
              : dx + dy < 10);
      if (!inside) continue;
      const rgb =
        role === 'wall'
          ? x % 8 === 0 || y % 8 === 0
            ? [20, 91, 123]
            : [43, 178, 215]
          : role === 'patrol'
            ? [71, 228, 239]
            : role === 'player'
              ? [249, 231, 90]
              : role === 'lethalTerrain'
                ? [224, 40, 98]
                : x < 16
                  ? [239, 115, 237]
                  : [189, 42, 192];
      rgba.set([...rgb, 255], (y * width + x) * 4);
    }
  return {
    name: `Labyrinth ${role}`,
    dataUrl: `data:image/png;base64,${encodeSpritePNG({ width, height, rgba }).toString('base64')}`,
  };
}

export async function buildNeonLabyrinth() {
  const read = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
  const base = await read('game/content/packs/classic-lab.json');
  const reference = await read('authoring/library/neon-labyrinth/reference-map.json');
  assert.equal(reference.rows.length, 45);
  assert.ok(reference.rows.every((row) => /^[.WX]{91}$/.test(row)));
  const theme = structuredClone(base.themes.find((entry) => entry.id === 'retro'));
  Object.assign(theme.palette, {
    field: '#000000',
    grid: '#101020',
    safe: '#39c7e8',
    danger: '#e665db',
    accent: '#efeb68',
  });
  const cells = Array.from({ length: 72 * 36 }, (_, i) => {
    const value =
      reference.rows[Math.floor(((Math.floor(i / 72) + 0.5) * 45) / 36)][
        Math.floor((((i % 72) + 0.5) * 91) / 72)
      ];
    return value === 'X' ? 'X' : '.';
  });
  // Forward-map every wall cell so a one-tile divider cannot disappear when
  // reduced to the supported board size. Outer walls sit just inside the safe rail.
  for (let y = 0; y < 45; y++)
    for (let x = 0; x < 91; x++) {
      if (reference.rows[y][x] !== 'W') continue;
      const tx = Math.max(1, Math.min(70, Math.floor(((x + 0.5) * 72) / 91)));
      const ty = Math.max(1, Math.min(34, Math.floor(((y + 0.5) * 36) / 45)));
      cells[ty * 72 + tx] = 'W';
    }
  const terrain = rectangles(cells, 'X').map((rect, i) => ({
    id: `hazard-${i + 1}`,
    kind: 'lethal',
    ...rect,
  }));
  const enemies = [
    ['upper-center', 29.7, 9.2, -2.7, -3.6],
    ['center-left', 34.3, 13.2, -1.4, 4.2],
    ['west-middle', 21.7, 16.8, 4.3, 0.9],
    ['east-middle', 68.1, 14.7, -0.8, 4.2],
    ['lower-center', 37.6, 22.7, 1.5, -4.1],
    ['lower-west', 5.5, 31.6, -1.8, 4.1],
  ].map(([id, x, y, vx, vy]) => ({
    id: `purple-${id}`,
    type: 'bouncer',
    x,
    y,
    vx,
    vy,
    radius: 0.3,
  }));
  const level = {
    version: 'xonix-level.v4',
    id: 'neon-labyrinth-reference',
    revision: '1',
    name: 'Neon Labyrinth',
    width: 72,
    height: 36,
    encounter: null,
    spawn: { x: 36.5, y: 35.5 },
    goal: { coverage: 0.75 },
    walls: rectangles(cells, 'W'),
    objectives: [],
    supplies: [],
    signalZones: [],
    hangars: [],
    classic: {
      version: 'classic.v1',
      terrain,
      powerups: [],
      arcadeActions: { version: 'arcade-actions.v1' },
    },
    enemies: [
      ...enemies,
      {
        id: 'cyan-top-center',
        type: 'border-patrol',
        x: 34.7,
        y: 0.5,
        speed: 4.5,
        clockwise: true,
        radius: 0.35,
      },
      {
        id: 'cyan-top-right',
        type: 'border-patrol',
        x: 71.5,
        y: 1,
        speed: 4.5,
        clockwise: true,
        radius: 0.35,
      },
    ],
    rules: {
      lives: 3,
      moveSpeed: 10,
      respawnSeconds: 0.7,
      graceSeconds: 0.8,
      timeLimitSeconds: 0,
      stopOnCapture: true,
    },
    metadata: {
      description:
        'A dense red-hazard labyrinth with cyan stepped dividers, corner recesses and central U-shaped bays. Cyan walls block movement and do not close a cut. Red ground is lethal until captured. Six purple bouncers threaten unfinished lines; two cyan patrols travel the outer safe rail. Start at bottom center, move sideways out of the bay, and find a clear entry before cutting. Reveal 75%. Layout follows the supplied screenshot; tile scaling and enemy motion use existing Classic rules.',
    },
  };
  const visualOverrides = Object.fromEntries(
    ['enemy', 'patrol', 'player', 'wall', 'lethalTerrain'].map((role) => [role, sprite(role)]),
  );
  visualOverrides.background = await neonRevealBackground('labyrinth', level.name);
  const scenario = {
    format: 'xonix-playground.v5',
    level,
    theme,
    classRecipes: base.classRecipes,
    settings: { classId: 'scout', turnPolicy: 'immediate', seed: 1 },
    visualOverrides,
    masteryDefinition: null,
    presentation: { style: 'microtile', showGrid: false },
  };
  const pack = {
    ...base,
    id: 'neon-labyrinth-reference',
    name: 'Neon Labyrinth',
    version: '1.1.0',
    description: level.metadata.description,
    themes: [theme],
    music: [],
    visualOverrides,
    metadata: {
      author: 'RevealLine',
      license: 'Project content',
      rightsStatus:
        'Geometry reconstructed from user-supplied references, with original sprites and AI-assisted reveal illustrations. No source screenshot artwork or music embedded.',
    },
    campaigns: [
      {
        version: 'xonix-campaign.v1',
        id: 'neon-labyrinth',
        revision: '1',
        title: 'Neon Labyrinth',
        themeId: 'retro',
        classIds: ['scout'],
        levels: [level],
      },
    ],
  };
  for (const checked of [validateScenario(scenario), validatePack(pack)])
    assert.equal(checked.valid, true, checked.errors.join('; '));
  return { scenario, pack };
}

if (process.argv[1] && new URL(process.argv[1], 'file:').href === import.meta.url) {
  const documents = await buildNeonLabyrinth();
  const directory = new URL('authoring/library/neon-labyrinth/', root);
  await mkdir(directory, { recursive: true });
  for (const [name, document] of Object.entries(documents))
    await writeFile(new URL(`${name}.json`, directory), JSON.stringify(document, null, 2) + '\n');
  console.log(
    `Neon Labyrinth: ${documents.scenario.level.walls.length} wall rectangles, ${documents.scenario.level.classic.terrain.length} hazard rectangles, eight enemies.`,
  );
}
