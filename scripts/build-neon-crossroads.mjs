import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { validateScenario } from '../game/content.mjs';
import { validatePack } from '../game/packs.mjs';
import { encodeSpritePNG } from './produce-field-kit-sprites.mjs';

const root = new URL('../', import.meta.url);

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
            : dx + dy < (role === 'player' ? 10 : 15));
      if (!inside) continue;
      const rgb =
        role === 'wall'
          ? x % 8 === 0 || y % 8 === 0
            ? [20, 91, 123]
            : [43, 178, 215]
          : role === 'patrol'
            ? [71, 228, 239]
            : role === 'eroder'
              ? x < 16
                ? [255, 132, 222]
                : [220, 57, 170]
              : x < 16
                ? [249, 248, 129]
                : [221, 224, 78];
      rgba.set([...rgb, 255], (y * width + x) * 4);
    }
  return {
    name: `Crossroads ${role}`,
    dataUrl: `data:image/png;base64,${encodeSpritePNG({ width, height, rgba }).toString('base64')}`,
  };
}

export async function buildNeonCrossroads() {
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
  // The reference arena spans x=46..2001, y=30..1009 in the displayed image.
  // Cross edges project to columns 35..36 and rows 17..18 on a 72 × 36 board.
  // Split the horizontal beam at the vertical beam: wall rectangles cannot overlap.
  const level = {
    version: 'xonix-level.v4',
    id: 'neon-crossroads-reference',
    revision: '1',
    name: 'Neon Crossroads',
    width: 72,
    height: 36,
    encounter: null,
    spawn: { x: 36.5, y: 35.5 },
    goal: { coverage: 0.75 },
    walls: [
      { x: 35, y: 1, w: 2, h: 34 },
      { x: 1, y: 17, w: 34, h: 2 },
      { x: 37, y: 17, w: 34, h: 2 },
    ],
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
      {
        id: 'yellow-upper-inner',
        type: 'bouncer',
        x: 39.3,
        y: 12.3,
        vx: 4.1,
        vy: 2.4,
        radius: 0.3,
      },
      {
        id: 'yellow-upper-outer',
        type: 'bouncer',
        x: 56.2,
        y: 13.6,
        vx: -3.8,
        vy: 3.1,
        radius: 0.3,
      },
      { id: 'yellow-lower-outer', type: 'bouncer', x: 11.5, y: 19.5, vx: 2, vy: -4.5, radius: 0.3 },
      {
        id: 'yellow-lower-inner',
        type: 'bouncer',
        x: 25.3,
        y: 19.8,
        vx: -1.1,
        vy: -4.5,
        radius: 0.3,
      },
      { id: 'pink-upper-left', type: 'eroder', x: 9.1, y: 7.2, vx: -3.4, vy: -0.3, radius: 0.4 },
      { id: 'pink-lower-right', type: 'eroder', x: 60.8, y: 25.1, vx: 3.1, vy: -1.6, radius: 0.4 },
      {
        id: 'cyan-top-left',
        type: 'border-patrol',
        x: 13,
        y: 0.5,
        speed: 5,
        clockwise: true,
        radius: 0.35,
      },
      {
        id: 'cyan-top-right',
        type: 'border-patrol',
        x: 59,
        y: 0.5,
        speed: 5,
        clockwise: false,
        radius: 0.35,
      },
      {
        id: 'cyan-left',
        type: 'border-patrol',
        x: 0.5,
        y: 23,
        speed: 4.5,
        clockwise: true,
        radius: 0.35,
      },
      {
        id: 'cyan-right',
        type: 'border-patrol',
        x: 71.5,
        y: 23,
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
        'Four chambers divided by solid cyan walls. Yellow bouncers occupy the upper-right and lower-left chambers; pink diamond eroders occupy the other two. Four cyan patrols travel the outer safe border. Start at bottom center, move sideways before entering a chamber, and reconnect each cut to the outer safe border. Walls block movement and do not close a cut. Reveal 75%. Layout and actor positions follow the supplied screenshot; speeds and behaviors use existing Classic rules.',
    },
  };
  const visualOverrides = Object.fromEntries(
    ['enemy', 'eroder', 'patrol', 'player', 'wall'].map((role) => [role, sprite(role)]),
  );
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
    id: 'neon-crossroads-reference',
    name: 'Neon Crossroads',
    version: '1.0.0',
    description: level.metadata.description,
    themes: [theme],
    music: [],
    visualOverrides,
    metadata: {
      author: 'RevealLine',
      license: 'Project content',
      rightsStatus:
        'Layout reconstructed from a user-supplied screenshot. Original procedural sprites and existing retro theme; no source screenshot pixels or music embedded.',
    },
    campaigns: [
      {
        version: 'xonix-campaign.v1',
        id: 'neon-crossroads',
        revision: '1',
        title: 'Neon Crossroads',
        themeId: 'retro',
        classIds: ['scout'],
        levels: [level],
      },
    ],
  };
  for (const result of [validateScenario(scenario), validatePack(pack)])
    assert.equal(result.valid, true, result.errors.join('; '));
  return { scenario, pack };
}

if (process.argv[1] && new URL(process.argv[1], 'file:').href === import.meta.url) {
  const documents = await buildNeonCrossroads();
  const directory = new URL('authoring/library/neon-crossroads/', root);
  await mkdir(directory, { recursive: true });
  for (const [name, document] of Object.entries(documents))
    await writeFile(new URL(`${name}.json`, directory), JSON.stringify(document, null, 2) + '\n');
  console.log('Neon Crossroads: valid scenario and pack, four chambers, ten enemies.');
}
