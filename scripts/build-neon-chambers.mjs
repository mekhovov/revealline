import { neonRevealBackground } from './neon-reveal-artwork.mjs';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { validateScenario } from '../game/content.mjs';
import { validatePack } from '../game/packs.mjs';
import { encodeSpritePNG } from './produce-field-kit-sprites.mjs';

const root = new URL('../', import.meta.url);

// Merge identical horizontal spans on consecutive rows; all resulting rectangles
// are disjoint, preserving the chambers' openings and stepped corners.
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
                  ? [246, 237, 126]
                  : [212, 190, 64];
      rgba.set([...rgb, 255], (y * width + x) * 4);
    }
  return {
    name: `Chambers ${role}`,
    dataUrl: `data:image/png;base64,${encodeSpritePNG({ width, height, rgba }).toString('base64')}`,
  };
}

export async function buildNeonChambers() {
  const read = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
  const base = await read('game/content/packs/classic-lab.json');
  const reference = await read('authoring/library/neon-chambers/reference-map.json');
  assert.equal(reference.rows.length, 45);
  assert.ok(reference.rows.every((row) => /^[.WX]{91}$/.test(row)));
  const theme = structuredClone(base.themes.find((entry) => entry.id === 'retro'));
  Object.assign(theme.palette, {
    field: '#000000',
    grid: '#101020',
    safe: '#39c7e8',
    danger: '#e02862',
    accent: '#efeb68',
  });
  const cells = Array(72 * 36).fill('.');
  // Forward-map every wall cell so a one-tile divider cannot disappear when
  // reduced to the supported board size. Outer walls sit just inside the safe rail.
  for (let y = 0; y < 45; y++)
    for (let x = 0; x < 91; x++) {
      if (reference.rows[y][x] !== 'W') continue;
      const tx = Math.max(1, Math.min(70, Math.floor(((x + 0.5) * 72) / 91)));
      const ty = Math.max(1, Math.min(34, Math.floor(((y + 0.5) * 36) / 45)));
      cells[ty * 72 + tx] = 'W';
    }
  const enemies = [
    ['upper-left', 13.35, 4.23, 4.3, 1.8],
    ['upper-center', 39.52, 7.34, 4.3, 1.5],
    ['inner-right', 37.5, 13.1, 4.2, 1.5],
    ['inner-left', 34.53, 13.49, 2.0, -4.0],
    ['lower-center', 42.6, 25.0, 3.3, 3.3],
    ['lower-right', 70.5, 29.78, 0.9, 4.6],
  ].map(([id, x, y, vx, vy]) => ({
    id: `yellow-${id}`,
    type: 'bouncer',
    x,
    y,
    vx,
    vy,
    radius: 0.3,
  }));
  const level = {
    version: 'xonix-level.v4',
    id: 'neon-chambers-reference',
    revision: '1',
    name: 'Neon Chambers',
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
      terrain: [],
      powerups: [],
      arcadeActions: { version: 'arcade-actions.v1' },
    },
    enemies: [
      ...enemies,
      ...[
        ['top-left', 4.1, 0.5, true],
        ['top-center-left', 32.25, 0.5, false],
        ['top-center-right', 39.82, 0.5, true],
        ['top-right', 67.93, 0.5, false],
      ].map(([id, x, y, clockwise]) => ({
        id: `cyan-${id}`,
        type: 'border-patrol',
        x,
        y,
        speed: 4.5,
        clockwise,
        radius: 0.35,
      })),
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
        'Three stepped cyan chambers contain nested open boxes, narrow passages and offset crossbars. Cyan walls block movement and cannot close a cut. Six yellow bouncers roam the field and four cyan patrols start along the top border. Start at bottom center, move sideways around the central wall, and reconnect to the safe outer rail to reveal 75%.',
    },
  };
  const visualOverrides = Object.fromEntries(
    ['enemy', 'patrol', 'player', 'wall'].map((role) => [role, sprite(role)]),
  );
  visualOverrides.background = await neonRevealBackground('chambers', level.name);
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
    id: 'neon-chambers-reference',
    name: 'Neon Chambers',
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
        id: 'neon-chambers',
        revision: '1',
        title: 'Neon Chambers',
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
  const documents = await buildNeonChambers();
  const directory = new URL('authoring/library/neon-chambers/', root);
  await mkdir(directory, { recursive: true });
  for (const [name, document] of Object.entries(documents))
    await writeFile(new URL(`${name}.json`, directory), JSON.stringify(document, null, 2) + '\n');
  console.log(
    `Neon Chambers: ${documents.scenario.level.walls.length} wall rectangles, ${documents.scenario.level.classic.terrain.length} hazard rectangles, ten enemies.`,
  );
}
