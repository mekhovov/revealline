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
          ? dx * dx + dy * dy < 180
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
            ? [244, 224, 96]
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
    name: `Switchyards ${role}`,
    dataUrl: `data:image/png;base64,${encodeSpritePNG({ width, height, rgba }).toString('base64')}`,
  };
}

export async function buildNeonSwitchyards() {
  const read = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
  const base = await read('game/content/packs/classic-lab.json');
  const reference = await read('authoring/library/neon-switchyards/reference-map.json');
  assert.equal(reference.rows.length, 46);
  assert.ok(reference.rows.every((row) => /^[.XSW]{92}$/.test(row)));
  const theme = structuredClone(base.themes.find((entry) => entry.id === 'retro'));
  Object.assign(theme.palette, {
    field: '#000000',
    grid: '#101020',
    safe: '#39c7e8',
    danger: '#e02862',
    accent: '#efeb68',
  });
  const cells = Array(72 * 36).fill('.');
  // Forward-project the traced grid into the playable interior. Walls take
  // precedence at compressed edges so every one-tile partition survives.
  for (const kind of ['S', 'X', 'W'])
    for (let y = 0; y < 46; y++)
      for (let x = 0; x < 92; x++) {
        if (reference.rows[y][x] !== kind) continue;
        const tx = 1 + Math.floor(((x + 0.5) * 70) / 92);
        const ty = 1 + Math.floor(((y + 0.5) * 34) / 46);
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
  // Centers measured on the displayed reference arena (61, 28)–(1992, 995).
  const enemies = [
    ['upper-left-outer', 113, 449, 0.8, 4.0],
    ['lower-left-outer', 475, 929, 4.1, -0.5],
    ['upper-right-lane', 1801, 468, -1.7, 3.8],
    ['lower-right-lane', 1812, 553, -0.7, -4.1],
  ].map(([id, px, py, vx, vy]) => ({
    id: `yellow-${id}`,
    type: 'bouncer',
    x: 1 + ((px - 61) * 70) / 1931,
    y: 1 + ((py - 28) * 34) / 967,
    vx,
    vy,
    radius: 0.4,
  }));
  const level = {
    version: 'xonix-level.v5',
    id: 'neon-switchyards-reference',
    revision: '1',
    name: 'Neon Switchyards',
    width: 72,
    height: 36,
    encounter: null,
    spawn: { x: 36.5, y: 35.5 },
    goal: { coverage: 0.75 },
    walls: rectangles(cells, 'W'),
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
        ['bottom-left', 518, true],
        ['bottom-right', 1534, false],
      ].map(([id, px, clockwise]) => ({
        id: `cyan-${id}`,
        type: 'border-patrol',
        x: 0.5 + ((px - 61) * 71) / 1931,
        y: 35.5,
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
        'Three tall cyan dividers and a double-width horizontal wall split eight red-and-blue switchback lanes. Broken cyan perimeter walls retain the screenshot openings. Red side rails and alternating crossbars flank blue slow terrain. Four yellow bouncers begin near the left outer lanes and on either side of the center wall at the far right. Two cyan patrols start along the bottom rail. Start at bottom center, move sideways to an opening, and reveal 75%.',
    },
  };
  const visualOverrides = Object.fromEntries(
    ['wall', 'enemy', 'patrol', 'player', 'lethalTerrain', 'slowTerrain'].map((role) => [
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
    id: 'neon-switchyards-reference',
    name: 'Neon Switchyards',
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
        id: 'neon-switchyards',
        revision: '1',
        title: 'Neon Switchyards',
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
  const documents = await buildNeonSwitchyards();
  const directory = new URL('authoring/library/neon-switchyards/', root);
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
        ? `<circle cx="${e.x}" cy="${e.y}" r=".50" fill="#f4e060"/>`
        : e.type === 'eroder'
          ? `<path d="M${e.x} ${e.y - 0.7}l.7 .7-.7 .7-.7-.7z" fill="#f58bb6"/>`
          : `<path d="M${e.x - 0.4} ${e.y}h.8m-.4-.4v.8" stroke="#47e4ef" stroke-width=".25"/>`,
    );
  await writeFile(
    new URL('preview.svg', directory),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 36"><rect width="72" height="36" fill="#030609"/><rect x=".5" y=".5" width="71" height="35" fill="none" stroke="#31536a" stroke-width=".12"/>${shapes.join('')}<circle cx="36.5" cy="35.5" r=".3" fill="#f9e75a"/></svg>`,
  );
  console.log(
    `Neon Switchyards: ${documents.scenario.level.walls.length} wall rectangles, ${documents.scenario.level.classic.terrain.length} terrain rectangles, six enemies.`,
  );
}
