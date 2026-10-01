import { neonRevealBackground } from './neon-reveal-artwork.mjs';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { validateScenario } from '../game/content.mjs';
import { validatePack } from '../game/packs.mjs';
import { encodeSpritePNG } from './produce-field-kit-sprites.mjs';

const root = new URL('../', import.meta.url);

// Geometry is authored in the approximately 92 × 46 source tile grid.
// W = solid cyan wall; S = already-revealed ground; X = lethal red ground.
export function heartReferenceGrid() {
  const cells = Array(92 * 46).fill('.');
  const row = (x, y, value) =>
    [...value].forEach((cell, i) => {
      cells[y * 92 + x + i] = cell;
    });
  const upper = [
    '.....WWWWW.....WWWWW.....',
    '....WWWWWWW...WWWWWWW....',
    '...WWWWWWWWWWWWWWWWWWW...',
    '..WWWWSSSSWWWWWSSSSWWWW..',
    '.WWWWSSSSSSWWWSSSSSSWWWW.',
    'WWWWSSSSSSSSWSSSSSSSSWWWW',
    'WWWSSSSSSSSSSSSSSSSSSSWWW',
    'WWWSSSSSSSSSSSSSSSSSSSWWW',
    '...SSSSSSSSSSSSSSSSSSS...',
  ];
  upper.forEach((value, i) => {
    assert.equal(value.length, 25);
    row(34, 11 + i, value);
  });
  row(37, 21, 'SSSS');
  row(52, 21, 'SSSS');
  for (let y = 22; y <= 35; y++) {
    const inset = Math.max(0, y - 23);
    for (let x = inset; x < 25 - inset; x++)
      cells[y * 92 + 34 + x] =
        x < inset + (y < 24 ? 3 : 2) || x >= 25 - inset - (y < 24 ? 3 : 2) ? 'W' : 'S';
  }
  const small = [
    '..XX..XX..',
    '.XXXXXXXX.',
    'XXXXXXXXXX',
    'XXXXXXXXXX',
    'XXXXXXXXXX',
    '.XXXXXXXX.',
    '..XXXXXX..',
    '...XXXX...',
    '....XX....',
  ];
  for (const [x, y] of [
    [3, 21],
    [13, 14],
    [23, 21],
    [60, 21],
    [70, 14],
    [80, 21],
  ])
    small.forEach((value, i) => row(x, y + i, value));
  const center = [
    '..XX...XX..',
    '.XXXX.XXXX.',
    'XXXXXXXXXXX',
    'XXXXXXXXXXX',
    'XXXXXXXXXXX',
    'XXXXXXXXXXX',
    '.XXXXXXXXX.',
    '..XXXXXXX..',
    '...XXXXX...',
    '....XXX....',
    '.....X.....',
  ];
  center.forEach((value, y) => {
    // Empty corners of the hazard preserve the revealed heart behind it.
    [...value].forEach((cell, x) => {
      if (cell === 'X') cells[(19 + y) * 92 + 41 + x] = cell;
    });
  });
  return cells;
}

// Merge identical horizontal spans on consecutive rows; all resulting rectangles
// are disjoint, including the gap through the large heart's sides.
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
                  ? [255, 148, 201]
                  : [239, 80, 154];
      rgba.set([...rgb, 255], (y * width + x) * 4);
    }
  return {
    name: `Hearts ${role}`,
    dataUrl: `data:image/png;base64,${encodeSpritePNG({ width, height, rgba }).toString('base64')}`,
  };
}

export async function buildNeonHearts() {
  const base = JSON.parse(
    await readFile(new URL('game/content/packs/classic-lab.json', root), 'utf8'),
  );
  const theme = structuredClone(base.themes.find((entry) => entry.id === 'retro'));
  Object.assign(theme.palette, {
    field: '#000000',
    grid: '#101020',
    safe: '#39c7e8',
    danger: '#ee66bc',
    accent: '#efeb68',
  });
  const reference = heartReferenceGrid();
  const cells = Array.from(
    { length: 72 * 36 },
    (_, i) =>
      reference[
        Math.floor(((Math.floor(i / 72) + 0.5) * 46) / 36) * 92 +
          Math.floor((((i % 72) + 0.5) * 92) / 72)
      ],
  );
  const terrain = rectangles(cells, 'X').map((rect, i) => ({
    id: `heart-hazard-${i + 1}`,
    kind: 'lethal',
    ...rect,
  }));
  const pink = [
    ['north-west', 9.1, 5.5, -3.5, 2.6],
    ['west-upper', 9, 11.9, 2.6, 3.9],
    ['west-heart', 13.2, 14.4, -1.3, 4.1],
    ['south-west', 1.9, 26.5, -2, 4.3],
    ['east-upper', 66.1, 15.4, -3.4, -2.6],
    ['east-lower', 47.3, 25.1, -4, -1.8],
    ['south-inner', 49.5, 33.6, 2.8, -3.5],
    ['south-east', 70.3, 32.3, 3.3, -2.7],
  ].map(([id, x, y, vx, vy]) => ({ id: `pink-${id}`, type: 'bouncer', x, y, vx, vy, radius: 0.3 }));
  const level = {
    version: 'xonix-level.v5',
    id: 'neon-hearts-reference',
    revision: '1',
    name: 'Neon Hearts',
    width: 72,
    height: 36,
    encounter: null,
    spawn: { x: 36.5, y: 35.5 },
    goal: { coverage: 0.75 },
    walls: rectangles(cells, 'W'),
    foundations: rectangles(cells, 'S'),
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
      ...pink,
      {
        id: 'cyan-west',
        type: 'border-patrol',
        x: 0.5,
        y: 21.5,
        speed: 4.5,
        clockwise: true,
        radius: 0.35,
      },
      {
        id: 'cyan-east',
        type: 'border-patrol',
        x: 71.5,
        y: 21.5,
        speed: 4.5,
        clockwise: false,
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
        'Seven red heart hazards surround a broken cyan heart wall. Red tiles are lethal until captured; cyan walls block movement and cannot close a cut. Enter through the side openings to reach the central revealed safe ground. Eight pink field bouncers threaten unfinished lines; two cyan patrols travel the border. Start at bottom center and reveal 75%. Geometry and initial positions follow the supplied picture, scaled to 72 × 36; motion uses existing Classic behavior.',
    },
  };
  const visualOverrides = Object.fromEntries(
    ['enemy', 'patrol', 'player', 'wall', 'lethalTerrain'].map((role) => [role, sprite(role)]),
  );
  visualOverrides.background = await neonRevealBackground('hearts', level.name);
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
    id: 'neon-hearts-reference',
    name: 'Neon Hearts',
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
        id: 'neon-hearts',
        revision: '1',
        title: 'Neon Hearts',
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
  const documents = await buildNeonHearts();
  const directory = new URL('authoring/library/neon-hearts/', root);
  await mkdir(directory, { recursive: true });
  for (const [name, document] of Object.entries(documents))
    await writeFile(new URL(`${name}.json`, directory), JSON.stringify(document, null, 2) + '\n');
  console.log('Neon Hearts: valid scenario and pack, seven lethal hearts and ten enemies.');
}
