import { neonRevealBackground } from './neon-reveal-artwork.mjs';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { validateScenario } from '../game/content.mjs';
import { validatePack } from '../game/packs.mjs';
import { encodeSpritePNG } from './produce-field-kit-sprites.mjs';

const root = new URL('../', import.meta.url);

// Merge identical horizontal spans on consecutive rows; all resulting rectangles
// are disjoint, preserving the cross lattice's narrow gaps and crossbars.
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
          ? dx * dx + dy * dy < 20 || (dx * dx + dy * dy >= 125 && dx * dx + dy * dy < 225)
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
    name: `Crossgrid ${role}`,
    dataUrl: `data:image/png;base64,${encodeSpritePNG({ width, height, rgba }).toString('base64')}`,
  };
}

export async function buildNeonCrossgrid() {
  const read = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
  const base = await read('game/content/packs/classic-lab.json');
  const reference = await read('authoring/library/neon-crossgrid/reference-map.json');
  assert.equal(reference.rows.length, 46);
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
  // Fit the full screenshot inside the safe outer rail, retaining clearance
  // between perimeter walls and the nearest cross arms.
  for (let y = 0; y < 46; y++)
    for (let x = 0; x < 91; x++) {
      if (reference.rows[y][x] !== 'X') continue;
      const tx = 1 + Math.floor(((x + 0.5) * 70) / 91);
      const ty = 1 + Math.floor(((y + 0.5) * 34) / 46);
      cells[ty * 72 + tx] = 'X';
    }
  // Forward-map every wall cell so a one-tile divider cannot disappear when
  // reduced to the supported board size. Outer walls sit just inside the safe rail.
  for (let y = 0; y < 46; y++)
    for (let x = 0; x < 91; x++) {
      if (reference.rows[y][x] !== 'W') continue;
      const tx = 1 + Math.floor(((x + 0.5) * 70) / 91);
      const ty = 1 + Math.floor(((y + 0.5) * 34) / 46);
      cells[ty * 72 + tx] = 'W';
    }
  const terrain = rectangles(cells, 'X').map((rect, i) => ({
    id: `hazard-${i + 1}`,
    kind: 'lethal',
    ...rect,
  }));
  const enemies = [
    ['upper-right-left', 61.34, 2.84, -4.0, 1.3],
    ['upper-right-middle', 66.86, 2.88, 3.6, 2.1],
    ['upper-right-lower', 69.32, 10.28, 4.1, 0.4],
    ['lower-left-upper', 7.03, 25.38, 3.1, -3.0],
    ['lower-left-middle', 3.48, 28.64, 3.0, 3.0],
    ['lower-left-bottom', 3.51, 29.8, -2.4, 3.5],
  ].map(([id, x, y, vx, vy]) => ({
    id: `yellow-${id}`,
    type: 'bouncer',
    x: 1 + (x * 70) / 72,
    y: 1 + (y * 34) / 36,
    vx,
    vy,
    radius: 0.4,
  }));
  const level = {
    version: 'xonix-level.v4',
    id: 'neon-crossgrid-reference',
    revision: '2',
    name: 'Neon Crossgrid',
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
      coverage: { version: 'reachable-routes.v1' },
      terrain,
      powerups: [],
      arcadeActions: { version: 'arcade-actions.v1' },
    },
    enemies: [
      ...enemies,
      ...[
        ['top-left', 4.65, 0.5, true],
        ['top-center', 41.05, 0.5, true],
        ['top-right', 67.31, 0.5, false],
        ['bottom-left', 4.65, 35.5, false],
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
        'Eighteen red lethal crosses fill a six-by-three lattice divided by staggered cyan walls. Six yellow ring bouncers begin in two clusters: three at the upper right and three at the lower left. Three cyan patrols start on the top rail and one on the bottom-left rail. Start at bottom center, go sideways around the central divider, and enclose the hazards to reveal 75%.',
    },
  };
  const visualOverrides = Object.fromEntries(
    ['enemy', 'patrol', 'player', 'wall', 'lethalTerrain'].map((role) => [role, sprite(role)]),
  );
  visualOverrides.background = await neonRevealBackground('crossgrid', level.name);
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
    id: 'neon-crossgrid-reference',
    name: 'Neon Crossgrid',
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
        id: 'neon-crossgrid',
        revision: '2',
        title: 'Neon Crossgrid',
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
  const documents = await buildNeonCrossgrid();
  const directory = new URL('authoring/library/neon-crossgrid/', root);
  await mkdir(directory, { recursive: true });
  for (const [name, document] of Object.entries(documents))
    await writeFile(new URL(`${name}.json`, directory), JSON.stringify(document, null, 2) + '\n');
  const level = documents.scenario.level;
  const tile = (r, color) =>
    `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${color}"/>`;
  const shapes = [
    ...level.walls.map((r) => tile(r, '#31bddb')),
    ...level.classic.terrain.map((r) => tile(r, '#e02862')),
  ];
  for (const e of level.enemies)
    shapes.push(
      e.type === 'bouncer'
        ? `<circle cx="${e.x}" cy="${e.y}" r=".85" fill="none" stroke="#f6ed7e" stroke-width=".2"/><circle cx="${e.x}" cy="${e.y}" r=".27" fill="#f6ed7e"/>`
        : `<path d="M${e.x - 0.4} ${e.y}h.8m-.4-.4v.8" stroke="#47e4ef" stroke-width=".25"/>`,
    );
  await writeFile(
    new URL('preview.svg', directory),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 36"><rect width="72" height="36" fill="#030609"/><rect x=".5" y=".5" width="71" height="35" fill="none" stroke="#31536a" stroke-width=".12"/>${shapes.join('')}<circle cx="36.5" cy="35.5" r=".3" fill="#f9e75a"/></svg>`,
  );
  console.log(
    `Neon Crossgrid: ${documents.scenario.level.walls.length} wall rectangles, ${documents.scenario.level.classic.terrain.length} hazard rectangles, ten enemies.`,
  );
}
