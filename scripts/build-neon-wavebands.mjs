import { neonRevealBackground } from './neon-reveal-artwork.mjs';
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
    name: `Wavebands ${role}`,
    dataUrl: `data:image/png;base64,${encodeSpritePNG({ width, height, rgba }).toString('base64')}`,
  };
}

export async function buildNeonWavebands() {
  const read = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
  const base = await read('game/content/packs/classic-lab.json');
  const reference = await read('authoring/library/neon-wavebands/reference-map.json');
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
  // Project slow bands first; lethal cells take precedence at their intersections.
  for (let y = 0; y < 45; y++)
    for (let x = 0; x < 91; x++) {
      if (reference.rows[y][x] !== 'S') continue;
      const tx = 1 + Math.floor(((x + 0.5) * 70) / 91);
      const ty = 1 + Math.floor(((y + 0.5) * 34) / 45);
      cells[ty * 72 + tx] = 'S';
    }
  // Fit the full screenshot inside the safe outer rail, retaining clearance
  // around the outer hazard bands and between the nested spiral arms.
  for (let y = 0; y < 45; y++)
    for (let x = 0; x < 91; x++) {
      if (reference.rows[y][x] !== 'X') continue;
      const tx = 1 + Math.floor(((x + 0.5) * 70) / 91);
      const ty = 1 + Math.floor(((y + 0.5) * 34) / 45);
      cells[ty * 72 + tx] = 'X';
    }
  const terrain = [
    ...rectangles(cells, 'X').map((rect, i) => ({
      id: `hazard-${i + 1}`,
      kind: 'lethal',
      ...rect,
    })),
    ...rectangles(cells, 'S').map((rect, i) => ({ id: `slow-${i + 1}`, kind: 'slow', ...rect })),
  ];
  // Centers measured against the reference arena (89, 28)–(1957, 953).
  const enemies = [
    ['upper-right', 'bouncer', 1487, 149, -4.0, 1.5],
    ['upper-left-band', 'bouncer', 746, 347, 3.9, 1.7],
    ['middle-left-band', 'bouncer', 414, 491, 1.5, -4.0],
    ['middle-right-band', 'bouncer', 1584, 470, -3.2, -3.0],
    ['upper-diamond', 'eroder', 655, 182, -2.8, -2.5],
  ].map(([id, type, px, py, vx, vy]) => ({
    id: `pink-${id}`,
    type,
    x: 1 + ((px - 89) * 70) / 1868,
    y: 1 + ((py - 28) * 34) / 925,
    vx,
    vy,
    radius: 0.4,
  }));
  const level = {
    version: 'xonix-level.v5',
    id: 'neon-wavebands-reference',
    revision: '1',
    name: 'Neon Wavebands',
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
        ['top-left-center', 22.66, 0.5, true],
        ['left-upper', 0.5, 13.4, true],
        ['right-upper', 71.5, 13.4, false],
        ['right-lower', 71.5, 22.52, false],
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
        'Red zigzag waves intersect three horizontal blue slowing bands, with additional red waves along the top and bottom. Four pink ring bouncers and one pink diamond eroder roam the field. Four cyan patrols start at the top, left and two right-side positions. Red tiles are lethal until captured; blue tiles slow your craft. Start at bottom center and close cuts on the safe perimeter to reveal 75%.',
    },
  };
  const visualOverrides = Object.fromEntries(
    ['enemy', 'eroder', 'patrol', 'player', 'lethalTerrain', 'slowTerrain'].map((role) => [
      role,
      sprite(role),
    ]),
  );
  visualOverrides.background = await neonRevealBackground('wavebands', level.name);
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
    id: 'neon-wavebands-reference',
    name: 'Neon Wavebands',
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
        id: 'neon-wavebands',
        revision: '1',
        title: 'Neon Wavebands',
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
  const documents = await buildNeonWavebands();
  const directory = new URL('authoring/library/neon-wavebands/', root);
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
        ? `<circle cx="${e.x}" cy="${e.y}" r=".85" fill="none" stroke="#f58bb6" stroke-width=".2"/><circle cx="${e.x}" cy="${e.y}" r=".50" fill="#f58bb6"/>`
        : e.type === 'eroder'
          ? `<path d="M${e.x} ${e.y - 0.7}l.7 .7-.7 .7-.7-.7z" fill="#f58bb6"/>`
          : `<path d="M${e.x - 0.4} ${e.y}h.8m-.4-.4v.8" stroke="#47e4ef" stroke-width=".25"/>`,
    );
  await writeFile(
    new URL('preview.svg', directory),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 36"><rect width="72" height="36" fill="#030609"/><rect x=".5" y=".5" width="71" height="35" fill="none" stroke="#31536a" stroke-width=".12"/>${shapes.join('')}<circle cx="36.5" cy="35.5" r=".3" fill="#f9e75a"/></svg>`,
  );
  console.log(
    `Neon Wavebands: ${documents.scenario.level.walls.length} wall rectangles, ${documents.scenario.level.classic.terrain.length} terrain rectangles, nine enemies.`,
  );
}
