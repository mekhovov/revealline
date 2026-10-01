import { neonRevealBackground } from './neon-reveal-artwork.mjs';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { validateScenario } from '../game/content.mjs';
import { validatePack } from '../game/packs.mjs';
import { encodeSpritePNG } from './produce-field-kit-sprites.mjs';

const root = new URL('../', import.meta.url);

// Merge identical horizontal spans on consecutive rows; all resulting rectangles
// are disjoint, preserving the cross-and-bar field's narrow gaps and crossbars.
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
                  ? [246, 237, 126]
                  : [212, 190, 64];
      rgba.set([...rgb, 255], (y * width + x) * 4);
    }
  return {
    name: `Crossfire ${role}`,
    dataUrl: `data:image/png;base64,${encodeSpritePNG({ width, height, rgba }).toString('base64')}`,
  };
}

export async function buildNeonCrossfire() {
  const read = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
  const base = await read('game/content/packs/classic-lab.json');
  const reference = await read('authoring/library/neon-crossfire/reference-map.json');
  assert.equal(reference.rows.length, 44);
  assert.ok(reference.rows.every((row) => /^[.WX]{86}$/.test(row)));
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
  for (let y = 0; y < 44; y++)
    for (let x = 0; x < 86; x++) {
      if (reference.rows[y][x] !== 'X') continue;
      const tx = 1 + Math.floor(((x + 0.5) * 70) / 86);
      const ty = 1 + Math.floor(((y + 0.5) * 34) / 44);
      cells[ty * 72 + tx] = 'X';
    }
  // Forward-map every wall cell so a one-tile divider cannot disappear when
  // reduced to the supported board size. Outer walls sit just inside the safe rail.
  for (let y = 0; y < 44; y++)
    for (let x = 0; x < 86; x++) {
      if (reference.rows[y][x] !== 'W') continue;
      const tx = 1 + Math.floor(((x + 0.5) * 70) / 86);
      const ty = 1 + Math.floor(((y + 0.5) * 34) / 44);
      cells[ty * 72 + tx] = 'W';
    }
  const terrain = rectangles(cells, 'X').map((rect, i) => ({
    id: `hazard-${i + 1}`,
    kind: 'lethal',
    ...rect,
  }));
  // Enemy centers measured in the 2048 × 1072 reference display.
  const enemies = [
    ['upper-center', 971, 225, 0.2, -4.3],
    ['upper-right-inner', 1173, 367, -2.9, 3.3],
    ['upper-right-outer', 1356, 372, 4.0, -1.5],
    ['lower-left-inner', 633, 652, -4.0, 1.6],
    ['lower-left-outer', 717, 685, -3.9, 1.8],
    ['lower-right', 1489, 769, 3.7, 2.2],
  ].map(([id, px, py, vx, vy]) => ({
    id: `yellow-${id}`,
    type: 'bouncer',
    // Keep the lower-right orb just clear of the bar tip after grid reduction.
    x: 1 + ((px - 119) * 70) / 1853 - (id === 'lower-right' ? 0.15 : 0),
    y: 1 + ((py - 40) * 34) / 949,
    vx,
    vy,
    radius: 0.3,
  }));
  const level = {
    version: 'xonix-level.v4',
    id: 'neon-crossfire-reference',
    revision: '1',
    name: 'Neon Crossfire',
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
      ...[
        ['top-left', 18.7, 0.5, false],
        ['top-right', 51.43, 0.5, false],
        ['left-middle', 0.5, 17.56, true],
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
        'Eight cyan crosses and twenty straight cyan barriers divide red corner brackets, stepped fields and small square hazards. Six yellow bouncers begin at the upper-center, paired upper-right, paired lower-left and lower-right positions. Two cyan patrols start on the top rail and one on the left rail. Start at bottom center, weave between the walls, and reconnect to the safe perimeter to reveal 75%. Red terrain is lethal until captured; cyan walls block movement.',
    },
  };
  const visualOverrides = Object.fromEntries(
    ['enemy', 'patrol', 'player', 'wall', 'lethalTerrain'].map((role) => [role, sprite(role)]),
  );
  visualOverrides.background = await neonRevealBackground('crossfire', level.name);
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
    id: 'neon-crossfire-reference',
    name: 'Neon Crossfire',
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
        id: 'neon-crossfire',
        revision: '1',
        title: 'Neon Crossfire',
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
  const documents = await buildNeonCrossfire();
  const directory = new URL('authoring/library/neon-crossfire/', root);
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
        ? `<circle cx="${e.x}" cy="${e.y}" r=".48" fill="#f6ed7e"/>`
        : `<path d="M${e.x - 0.4} ${e.y}h.8m-.4-.4v.8" stroke="#47e4ef" stroke-width=".25"/>`,
    );
  await writeFile(
    new URL('preview.svg', directory),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 36"><rect width="72" height="36" fill="#030609"/><rect x=".5" y=".5" width="71" height="35" fill="none" stroke="#31536a" stroke-width=".12"/>${shapes.join('')}<circle cx="36.5" cy="35.5" r=".3" fill="#f9e75a"/></svg>`,
  );
  console.log(
    `Neon Crossfire: ${documents.scenario.level.walls.length} wall rectangles, ${documents.scenario.level.classic.terrain.length} hazard rectangles, nine enemies.`,
  );
}
