import { neonRevealBackground } from './neon-reveal-artwork.mjs';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { validateScenario } from '../game/content.mjs';
import { validatePack } from '../game/packs.mjs';
import { encodeSpritePNG } from './produce-field-kit-sprites.mjs';

const root = new URL('../', import.meta.url);
const read = async (p) => JSON.parse(await readFile(new URL(p, root), 'utf8'));
// Original small procedural game sprites, independent of the reference pixels.
function sprite(role) {
  const width = 32,
    height = 32,
    rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const dx = Math.abs(x - 15.5),
        dy = Math.abs(y - 15.5);
      const inside =
        role === 'enemy'
          ? dx * dx + dy * dy < 110
          : role === 'patrol'
            ? (dx < 4 || dy < 4 || Math.abs(dx - dy) < 2) && dx + dy < 19
            : role === 'slowTerrain'
              ? (y >= 9 && y <= 12 && x >= 7 && x <= 24) ||
                (x >= 14 && x <= 17 && y >= 12 && y <= 20)
              : dx + dy < (role === 'player' ? 11 : 14);
      if (!inside) continue;
      const rgb =
        role === 'patrol'
          ? [57, 223, 246]
          : role === 'slowTerrain'
            ? [66, 96, 220]
            : role === 'player'
              ? [255, 230, 74]
              : x < 15
                ? [255, 161, 200]
                : [243, 79, 144];
      rgba.set([...rgb, 255], (y * width + x) * 4);
    }
  return {
    name: `Neon ${role}`,
    dataUrl: `data:image/png;base64,${encodeSpritePNG({ width, height, rgba }).toString('base64')}`,
  };
}
// Measured tile coordinates of the supplied picture: 92 × 46, projected to
// the runtime's 72 × 36 board. Round edges, never widths independently.
const rect = (x, y, w, h) => ({
  x: Math.round((x * 72) / 92),
  y: Math.round((y * 36) / 46),
  w: Math.round(((x + w) * 72) / 92) - Math.round((x * 72) / 92),
  h: Math.round(((y + h) * 36) / 46) - Math.round((y * 36) / 46),
});

export async function buildNeonChannels() {
  const base = await read('game/content/packs/classic-lab.json');
  const theme = structuredClone(base.themes.find((item) => item.id === 'retro'));
  Object.assign(theme.palette, {
    field: '#000000',
    grid: '#101020',
    safe: '#39c7e8',
    danger: '#ff548b',
    accent: '#ffe654',
  });
  const terrain = [
    ['slow', 'north-west', 7, 6, 17, 5],
    ['slow', 'west-column', 7, 17, 5, 23],
    ['slow', 'inner-west-column', 31, 6, 5, 23],
    ['slow', 'south-center', 31, 35, 19, 5],
    ['slow', 'north-east', 56, 6, 18, 5],
    ['slow', 'inner-east-column', 56, 17, 5, 23],
    ['slow', 'east-column', 80, 6, 5, 34],
    ['lethal', 'west-tower', 19, 17, 5, 12],
    ['lethal', 'west-foot', 19, 35, 5, 5],
    ['lethal', 'north-center', 43, 6, 6, 6],
    ['lethal', 'center-tower', 42, 16, 8, 14],
    ['lethal', 'east-tower', 69, 17, 5, 12],
    ['lethal', 'east-foot', 69, 35, 5, 5],
  ].map(([kind, id, ...bounds]) => ({ id, kind, ...rect(...bounds) }));
  // Revealed islands are return surfaces, not impassable walls. These rows
  // preserve both small stepped islands and the open upper/lower center shells.
  const foundations = [
    [38, 7, 2, 1],
    [38, 8, 3, 1],
    [39, 9, 2, 1],
    [52, 7, 2, 1],
    [51, 8, 3, 1],
    [51, 9, 2, 1],
    [44, 12, 4, 1],
    [42, 13, 8, 1],
    [41, 14, 10, 1],
    [40, 15, 12, 1],
    [40, 16, 2, 2],
    [51, 16, 1, 2],
    [41, 18, 1, 2],
    [50, 18, 1, 2],
    [41, 26, 1, 3],
    [50, 26, 1, 3],
    [39, 29, 3, 1],
    [50, 29, 3, 1],
    [39, 30, 7, 2],
    [47, 30, 6, 2],
    [46, 31, 1, 1],
    [40, 32, 12, 1],
  ]
    .map((bounds) => rect(...bounds))
    .filter((r) => r.w && r.h);
  const level = {
    version: 'xonix-level.v5',
    id: 'neon-channels-reference',
    revision: '1',
    name: 'Neon Channels',
    width: 72,
    height: 36,
    encounter: null,
    spawn: { x: 0.5, y: 35.5 },
    goal: { coverage: 0.75 },
    walls: [],
    foundations,
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
      { id: 'pink-north-west', type: 'bouncer', x: 15.3, y: 2.2, vx: -4.2, vy: -1.8, radius: 0.3 },
      { id: 'pink-south-east', type: 'bouncer', x: 53.1, y: 26.4, vx: 3.1, vy: 4.1, radius: 0.3 },
      {
        id: 'pink-center-diamond',
        type: 'eroder',
        x: 35.6,
        y: 19.8,
        vx: -0.6,
        vy: -3.4,
        radius: 0.4,
      },
      {
        id: 'cyan-north',
        type: 'border-patrol',
        x: 21.5,
        y: 0.5,
        speed: 5,
        clockwise: false,
        radius: 0.35,
      },
      {
        id: 'cyan-west',
        type: 'border-patrol',
        x: 0.5,
        y: 14.5,
        speed: 4.5,
        clockwise: true,
        radius: 0.35,
      },
      {
        id: 'cyan-east',
        type: 'border-patrol',
        x: 71.5,
        y: 21.5,
        speed: 5.5,
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
        'Recreate the supplied neon arena: seven blue slowing regions, six red lethal regions, two roaming pink orbs, a central diamond eroder and three cyan perimeter patrols. Capture 75%. Blue ground slows your craft; red ground is lethal until captured. The central revealed islands are safe return surfaces. Grid and starting positions are scaled from the picture; enemy behaviors and speeds are authored approximations.',
    },
  };
  const visualOverrides = Object.fromEntries(
    ['enemy', 'eroder', 'patrol', 'player', 'slowTerrain'].map((role) => [role, sprite(role)]),
  );
  visualOverrides.background = await neonRevealBackground('channels', level.name);
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
    id: 'neon-channels-reference',
    name: 'Neon Channels',
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
        id: 'neon-channels',
        revision: '1',
        title: 'Neon Channels',
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
  const { scenario, pack } = await buildNeonChannels();
  const directory = new URL('authoring/library/neon-channels/', root);
  await mkdir(directory, { recursive: true });
  for (const [name, value] of Object.entries({ scenario, pack }))
    await writeFile(new URL(`${name}.json`, directory), JSON.stringify(value, null, 2) + '\n');
  console.log('Neon Channels: valid scenario and pack; 13 terrain regions and 6 enemies.');
}
