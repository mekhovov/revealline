import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { validateScenario } from '../game/content.mjs';
import { validatePack } from '../game/packs.mjs';
import { encodeSpritePNG } from './produce-field-kit-sprites.mjs';

const root = new URL('../', import.meta.url);

// Merge identical horizontal spans on consecutive rows; all resulting rectangles
// are disjoint, preserving the hazard maze's narrow gaps and crossbars.
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
          ? dx * dx + dy * dy < 190
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
                  ? [255, 159, 199]
                  : [230, 78, 145];
      rgba.set([...rgb, 255], (y * width + x) * 4);
    }
  return {
    name: `Pinwheels ${role}`,
    dataUrl: `data:image/png;base64,${encodeSpritePNG({ width, height, rgba }).toString('base64')}`,
  };
}

export async function buildNeonPinwheels() {
  const read = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
  const base = await read('game/content/packs/classic-lab.json');
  const reference = await read('authoring/library/neon-pinwheels/reference-map.json');
  assert.equal(reference.rows.length, 45);
  assert.ok(reference.rows.every((row) => /^[.X]{91}$/.test(row)));
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
  // around the outer hazard bands and between the nested pinwheel arms.
  for (let y = 0; y < 45; y++)
    for (let x = 0; x < 91; x++) {
      if (reference.rows[y][x] !== 'X') continue;
      const tx = 1 + Math.floor(((x + 0.5) * 70) / 91);
      const ty = 1 + Math.floor(((y + 0.5) * 34) / 45);
      cells[ty * 72 + tx] = 'X';
    }
  const terrain = rectangles(cells, 'X').map((rect, i) => ({
    id: `hazard-${i + 1}`,
    kind: 'lethal',
    ...rect,
  }));
  // Centers measured against the reference arena (97, 32)–(1989, 969).
  const enemies = [
    ['upper-left-ring', 703, 233, -1.4, 4.0],
    ['right-middle-ring', 1728, 534, 4.0, 1.3],
    ['lower-left', 339, 716, -4.2, 0.1],
    ['lower-right-ring', 1393, 748, 1.1, -4.2],
  ].map(([id, px, py, vx, vy]) => ({
    id: `pink-${id}`,
    type: 'bouncer',
    x: 1 + ((px - 97) * 70) / 1892,
    y: 1 + ((py - 32) * 34) / 937,
    vx,
    vy,
    radius: 0.3,
  }));
  const level = {
    version: 'xonix-level.v5',
    id: 'neon-pinwheels-reference',
    revision: '1',
    name: 'Neon Pinwheels',
    width: 72,
    height: 36,
    encounter: null,
    spawn: { x: 36.5, y: 35.5 },
    goal: { coverage: 0.75 },
    walls: [],
    foundations: [],
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
      ...[
        ['left-upper', 0.5, 10.77, true],
        ['right-upper', 71.5, 10.85, false],
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
        'Thirty red pinwheel motifs alternate with seven open angular rings and their center dots. Partial motifs continue along the top and bottom edges. Four pink bouncers begin at the upper-left ring, middle-right ring, lower-left field and lower-right ring; two cyan patrols start opposite one another on the upper side rails. All red tiles are lethal until captured. Start at bottom center, weave between the motifs, and reconnect to the perimeter to reveal 75%.',
    },
  };
  const visualOverrides = Object.fromEntries(
    ['enemy', 'patrol', 'player', 'lethalTerrain'].map((role) => [role, sprite(role)]),
  );
  const scenario = {
    format: 'xonix-playground.v6',
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
    format: 'xonix-pack.v6',
    engine: 'xonix-core.v6',
    id: 'neon-pinwheels-reference',
    name: 'Neon Pinwheels',
    version: '1.0.0',
    description: level.metadata.description,
    themes: [theme],
    music: [],
    visualOverrides,
    metadata: {
      author: 'RevealLine',
      license: 'Project content',
      rightsStatus:
        'Tile layout traced from a user-supplied screenshot. Original procedural sprites and existing retro reveal art; no source image pixels or music embedded.',
    },
    campaigns: [
      {
        version: 'xonix-campaign.v1',
        id: 'neon-pinwheels',
        revision: '1',
        title: 'Neon Pinwheels',
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
  const documents = await buildNeonPinwheels();
  const directory = new URL('authoring/library/neon-pinwheels/', root);
  await mkdir(directory, { recursive: true });
  for (const [name, document] of Object.entries(documents))
    await writeFile(new URL(`${name}.json`, directory), JSON.stringify(document, null, 2) + '\n');
  const level = documents.scenario.level;
  const tile = (r, color) =>
    `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${color}"/>`;
  const shapes = [
    ...level.walls.map((r) => tile(r, '#31bddb')),
    ...level.foundations.map((r) => tile(r, '#25497f')),
    ...level.classic.terrain.map((r) => tile(r, '#e02862')),
  ];
  for (const e of level.enemies)
    shapes.push(
      e.type === 'bouncer'
        ? `<circle cx="${e.x}" cy="${e.y}" r=".48" fill="#f58bb6"/>`
        : `<path d="M${e.x - 0.4} ${e.y}h.8m-.4-.4v.8" stroke="#47e4ef" stroke-width=".25"/>`,
    );
  await writeFile(
    new URL('preview.svg', directory),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 36"><rect width="72" height="36" fill="#030609"/><rect x=".5" y=".5" width="71" height="35" fill="none" stroke="#31536a" stroke-width=".12"/>${shapes.join('')}<circle cx="36.5" cy="35.5" r=".3" fill="#f9e75a"/></svg>`,
  );
  console.log(
    `Neon Pinwheels: ${documents.scenario.level.walls.length} wall rectangles, ${documents.scenario.level.classic.terrain.length} hazard rectangles, six enemies.`,
  );
}
