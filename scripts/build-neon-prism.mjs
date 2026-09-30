import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { validateScenario } from '../game/content.mjs';
import { validatePack } from '../game/packs.mjs';
import { encodeSpritePNG } from './produce-field-kit-sprites.mjs';

const root = new URL('../', import.meta.url);

// Merge identical horizontal spans on consecutive rows; all resulting rectangles
// are disjoint, preserving the partition walls, terrain lanes and openings.
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
          ? dx * dx + dy * dy < 110 || (dx * dx + dy * dy >= 156 && dx * dx + dy * dy < 225)
          : role === 'slowTerrain'
            ? (y >= 9 && y <= 12 && x >= 7 && x <= 24) || (x >= 14 && x <= 17 && y >= 12 && y <= 20)
            : role === 'eroder'
              ? dx + dy < 14
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
          : role === 'enemy'
            ? [244, 131, 182]
            : role === 'slowTerrain'
              ? [66, 96, 220]
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
    name: `Prism ${role}`,
    dataUrl: `data:image/png;base64,${encodeSpritePNG({ width, height, rgba }).toString('base64')}`,
  };
}

export async function buildNeonPrism() {
  const read = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
  const base = await read('game/content/packs/classic-lab.json');
  const reference = await read('authoring/library/neon-prism/reference-map.json');
  assert.equal(reference.rows.length, 45);
  assert.ok(reference.rows.every((row) => /^[.XS]{91}$/.test(row)));
  const theme = structuredClone(base.themes.find((entry) => entry.id === 'retro'));
  Object.assign(theme.palette, {
    field: '#000000',
    grid: '#101020',
    safe: '#39c7e8',
    danger: '#e02862',
    accent: '#efeb68',
  });
  const cells = Array(72 * 36).fill('.');
  // Forward-project every traced terrain cell. Lethal tiles take precedence
  // at compressed boundaries; the resulting rectangles remain disjoint.
  for (const kind of ['S', 'X'])
    for (let y = 0; y < 45; y++)
      for (let x = 0; x < 91; x++) {
        if (reference.rows[y][x] !== kind) continue;
        const tx = 1 + Math.floor(((x + 0.5) * 70) / 91);
        const ty = 1 + Math.floor(((y + 0.5) * 34) / 45);
        cells[ty * 72 + tx] = kind;
      }
  const terrain = [
    ...rectangles(cells, 'X').map((rect, i) => ({
      id: `hazard-${i + 1}`,
      kind: 'lethal',
      ...rect,
    })),
    ...rectangles(cells, 'S').map((rect, i) => ({ id: `slow-${i + 1}`, kind: 'slow', ...rect })),
  ];
  // Centers measured on the displayed reference arena (90, 30)–(1978, 966).
  const enemies = [
    ['upper-center-notch', 1156, 162, 0.7, 4.0],
    ['upper-right-field', 1467, 200, -4.1, 0.6],
    ['right-diagonal', 1917, 476, -0.8, -4.0],
    ['lower-left-diagonal', 313, 649, 2.3, 3.5],
    ['lower-left-field', 599, 791, 4.1, -0.3],
  ].map(([id, px, py, vx, vy]) => ({
    id: `pink-${id}`,
    type: 'bouncer',
    x: 1 + ((px - 90) * 70) / 1888,
    y: 1 + ((py - 30) * 34) / 936,
    vx,
    vy,
    radius: 0.4,
  }));
  const level = {
    version: 'xonix-level.v5',
    id: 'neon-prism-reference',
    revision: '1',
    name: 'Neon Prism',
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
        ['top-left', 0.5 + ((677 - 90) * 71) / 1888, 0.5, true],
        ['top-right', 0.5 + ((1392 - 90) * 71) / 1888, 0.5, false],
        ['left-upper', 0.5, 0.5 + ((379 - 30) * 35) / 936, false],
        ['right-upper', 71.5, 0.5 + ((379 - 30) * 35) / 936, true],
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
        'A mirrored red-and-blue tapestry narrows at its center, with two side diamonds, long red diagonal borders and small top and bottom chevrons. Red tiles are lethal until captured; blue tiles slow the player. Five pink ring bouncers begin in the upper center notch, upper-right field, right diagonal and two lower-left positions. Four cyan patrols start on the top and side rails. Start at bottom center and reveal 75%.',
    },
  };
  const visualOverrides = Object.fromEntries(
    ['enemy', 'patrol', 'player', 'lethalTerrain', 'slowTerrain'].map((role) => [
      role,
      sprite(role),
    ]),
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
    id: 'neon-prism-reference',
    name: 'Neon Prism',
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
        id: 'neon-prism',
        revision: '1',
        title: 'Neon Prism',
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
  const documents = await buildNeonPrism();
  const directory = new URL('authoring/library/neon-prism/', root);
  await mkdir(directory, { recursive: true });
  for (const [name, document] of Object.entries(documents))
    await writeFile(new URL(`${name}.json`, directory), JSON.stringify(document, null, 2) + '\n');
  const level = documents.scenario.level;
  const tile = (r, color) =>
    `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${color}"/>`;
  const shapes = [
    ...level.walls.map((r) => tile(r, '#31bddb')),
    ...level.foundations.map((r) => tile(r, '#25497f')),
    ...level.classic.terrain.map((r) => tile(r, r.kind === 'slow' ? '#4260dc' : '#e02862')),
  ];
  for (const e of level.enemies)
    shapes.push(
      e.type === 'bouncer'
        ? `<circle cx="${e.x}" cy="${e.y}" r=".85" fill="none" stroke="#f483b6" stroke-width=".2"/><circle cx="${e.x}" cy="${e.y}" r=".50" fill="#f483b6"/>`
        : e.type === 'eroder'
          ? `<path d="M${e.x} ${e.y - 0.7}l.7 .7-.7 .7-.7-.7z" fill="#f58bb6"/>`
          : `<path d="M${e.x - 0.4} ${e.y}h.8m-.4-.4v.8" stroke="#47e4ef" stroke-width=".25"/>`,
    );
  await writeFile(
    new URL('preview.svg', directory),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 36"><rect width="72" height="36" fill="#030609"/><rect x=".5" y=".5" width="71" height="35" fill="none" stroke="#31536a" stroke-width=".12"/>${shapes.join('')}<circle cx="36.5" cy="35.5" r=".3" fill="#f9e75a"/></svg>`,
  );
  console.log(
    `Neon Prism: ${documents.scenario.level.walls.length} wall rectangles, ${documents.scenario.level.classic.terrain.length} terrain rectangles, nine enemies.`,
  );
}
