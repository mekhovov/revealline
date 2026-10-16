import { neonRevealBackground } from './neon-reveal-artwork.mjs';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { validateScenario } from '../game/content.mjs';
import { validatePack } from '../game/packs.mjs';
import { encodeSpritePNG } from './produce-field-kit-sprites.mjs';

const root = new URL('../', import.meta.url);

// Merge identical horizontal spans on consecutive rows; all resulting rectangles
// are disjoint, preserving the arrow lattice's narrow gaps and crossbars.
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
    name: `Arrows ${role}`,
    dataUrl: `data:image/png;base64,${encodeSpritePNG({ width, height, rgba }).toString('base64')}`,
  };
}

export async function buildNeonArrows() {
  const read = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
  const base = await read('game/content/packs/classic-lab.json');
  const reference = await read('authoring/library/neon-arrows/reference-map.json');
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
  // Preserve narrow arrow stems and crossbars when reducing the source grid.
  for (let y = 0; y < 45; y++)
    for (let x = 0; x < 91; x++) {
      if (reference.rows[y][x] !== 'X') continue;
      const tx = Math.max(1, Math.min(70, Math.floor(((x + 0.5) * 72) / 91)));
      const ty = Math.max(1, Math.min(34, Math.floor(((y + 0.5) * 36) / 45)));
      cells[ty * 72 + tx] = 'X';
    }
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
    ['top', 24.9, 1.35, -2.2, -4.0],
    ['left-center', 22.4, 15.7, -4.3, -1.1],
    ['left-lower', 20.6, 22.3, -4.4, 0.3],
    ['right-lower', 53.9, 27.9, 3.8, 2.1],
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
    id: 'neon-arrows-reference',
    revision: '2',
    name: 'Neon Arrows',
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
        ['top-left', 18.0, 0.5, true],
        ['top-right', 53.9, 0.5, false],
        ['left', 0.5, 17.8, true],
        ['right', 71.5, 17.8, false],
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
        'A lattice of red arrow hazards surrounds fourteen short cyan walls. Red ground is lethal until captured; cyan walls block movement and cannot close a cut. Four yellow bouncers roam the field while four cyan patrols travel the safe perimeter. Start at bottom center, weave between the arrows, and reconnect to safe ground to reveal 75%.',
    },
  };
  const visualOverrides = Object.fromEntries(
    ['enemy', 'patrol', 'player', 'wall', 'lethalTerrain'].map((role) => [role, sprite(role)]),
  );
  visualOverrides.background = await neonRevealBackground('arrows', level.name);
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
    id: 'neon-arrows-reference',
    name: 'Neon Arrows',
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
        id: 'neon-arrows',
        revision: '2',
        title: 'Neon Arrows',
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
  const documents = await buildNeonArrows();
  const directory = new URL('authoring/library/neon-arrows/', root);
  await mkdir(directory, { recursive: true });
  for (const [name, document] of Object.entries(documents))
    await writeFile(new URL(`${name}.json`, directory), JSON.stringify(document, null, 2) + '\n');
  console.log(
    `Neon Arrows: ${documents.scenario.level.walls.length} wall rectangles, ${documents.scenario.level.classic.terrain.length} hazard rectangles, eight enemies.`,
  );
}
