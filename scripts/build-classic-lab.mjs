#!/usr/bin/env node
/** Original practice recipes plus explicitly labelled reference-routing hypotheses. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validatePack } from '../game/packs.mjs';
import { digest } from './verify-campaign.mjs';
const root = new URL('../', import.meta.url);
const readJSON = async (url) => JSON.parse(await readFile(new URL(url, root), 'utf8'));
export function studyMaterials(study) {
  assert.equal(study.format, 'revealline-reference-study.v1');
  assert.equal(study.projection.width, 72);
  assert.equal(study.projection.height, 36);
  const cells = new Uint8Array(72 * 36);
  for (const [k, kind] of ['slow', 'lethal', 'wall'].entries())
    for (const item of study.materials[kind]) {
      const rect = item.ring || item;
      assert.ok([rect.x, rect.y, rect.w, rect.h].every(Number.isInteger));
      assert.ok(rect.x > 0 && rect.y > 0 && rect.x + rect.w < 72 && rect.y + rect.h < 36);
      for (let y = rect.y; y < rect.y + rect.h; y++)
        for (let x = rect.x; x < rect.x + rect.w; x++)
          if (
            !item.ring ||
            x === rect.x ||
            x === rect.x + rect.w - 1 ||
            y === rect.y ||
            y === rect.y + rect.h - 1
          )
            cells[y * 72 + x] = k + 1;
    }
  const rectangles = [];
  for (let kind = 1; kind <= 3; kind++) {
    let previous = new Map();
    for (let y = 1; y < 35; y++) {
      const current = new Map();
      for (let x = 1; x < 71; ) {
        if (cells[y * 72 + x] !== kind) {
          x++;
          continue;
        }
        const left = x;
        while (x < 71 && cells[y * 72 + x] === kind) x++;
        const key = `${left}/${x - left}`,
          prior = previous.get(key);
        const rect = prior || { kind, x: left, y, w: x - left, h: 0 };
        rect.h++;
        if (!prior) rectangles.push(rect);
        current.set(key, rect);
      }
      previous = current;
    }
  }
  return {
    walls: rectangles.filter((r) => r.kind === 3).map(({ kind: _kind, ...r }) => r),
    terrain: rectangles
      .filter((r) => r.kind !== 3)
      .map(({ kind, ...r }, i) => ({
        id: `material-${i + 1}`,
        kind: kind === 1 ? 'slow' : 'lethal',
        ...r,
      })),
  };
}
const seed = { id: 'field-seed', type: 'bouncer', x: 20.5, y: 18.5, vx: 0, vy: 0 };
function level(id, name, changes = {}) {
  return {
    version: 'xonix-level.v4',
    id,
    name,
    revision: '1',
    width: 72,
    height: 36,
    encounter: null,
    classic: { version: 'classic.v1', terrain: [], powerups: [] },
    spawn: { x: 60.5, y: 0.5 },
    goal: { coverage: 0.8 },
    walls: [],
    objectives: [],
    enemies: [{ ...seed }],
    rules: {
      lives: 3,
      moveSpeed: 10,
      respawnSeconds: 0.7,
      graceSeconds: 0.8,
      timeLimitSeconds: 180,
    },
    ...changes,
  };
}
export async function buildClassicLab() {
  const pack = await readJSON('authoring/library/fpv-arcade/pack-source.json');
  pack.format = 'xonix-pack.v5';
  pack.engine = 'xonix-core.v5';
  pack.id = 'classic-lab';
  pack.version = '1.0.0';
  pack.name = 'Classic Lab · Roles & routing studies';
  pack.description =
    'Practice demonstrations of classic roles, terrain and pickups. Reference studies use observed motifs with original coordinates and tuning; they are not exact reconstructions.';
  pack.levelVisuals = [];
  pack.visualOverrides = {};
  pack.themes = (await readJSON('game/content/themes.json')).themes;
  pack.metadata.rightsStatus =
    'Original fictional practice recipes and procedural theme artwork. Referenced routing motifs are documented study hypotheses; no source game artwork is included.';
  const levels = [
    level('four-pickups', 'Four pickups · contact to collect', {
      classic: {
        version: 'classic.v1',
        terrain: [],
        powerups: ['extra-life', 'player-speed', 'enemy-slow', 'enemy-freeze'].map((kind, i) => ({
          id: `pickup-${i + 1}`,
          kind,
          x: 60.5,
          y: 4.5 + i * 7,
        })),
      },
      enemies: [{ ...seed, vx: 4, vy: 2 }],
    }),
    level('field-pressure', 'Field threat · keep the open line clear', {
      enemies: [
        { ...seed, vx: 6, vy: 3 },
        { id: 'second-field', type: 'bouncer', x: 45.5, y: 28.5, vx: -4, vy: -4 },
      ],
    }),
    level('contour-watch', 'Contour patrol · new edges remain dangerous', {
      enemies: [
        { ...seed },
        {
          id: 'contour',
          type: 'contour-patrol',
          edge: { x: 60, y: 1, side: 'north' },
          speed: 4,
          clockwise: true,
        },
      ],
    }),
    level('claimed-ground', 'Claimed rover · watch its wake-up warning', {
      enemies: [
        { ...seed },
        { id: 'rover', type: 'claimed-rover', x: 65.5, y: 18.5, vx: 3, vy: 2 },
      ],
    }),
    level('erosion-window', 'Eroder · defend the edge you just made', {
      enemies: [{ ...seed }, { id: 'eroder', type: 'eroder', x: 55.5, y: 18.5, vx: 4, vy: 1.5 }],
    }),
    level('terrain-reading', 'Terrain · walls, slow and lethal fields', {
      walls: [{ x: 28, y: 6, w: 2, h: 22 }],
      classic: {
        version: 'classic.v1',
        terrain: [
          { id: 'slow-field', kind: 'slow', x: 40, y: 8, w: 22, h: 18 },
          { id: 'lethal-field', kind: 'lethal', x: 48, y: 29, w: 18, h: 3 },
        ],
        powerups: [{ id: 'pace', kind: 'player-speed', x: 60.5, y: 4.5 }],
      },
    }),
  ];
  const briefs = [
    'Fly down to meet the four visible pickups. Life is immediate; speed, slow and freeze begin on the next simulation tick. Read the effect timers. Enclosure alone does not collect a pickup.',
    'Bright field actors can touch your character and unfinished line. Make shorter cuts or divide the space when their headings give you room.',
    'The contour patrol follows the frontier between safe and hidden territory, including new internal edges. Watch where it rejoins after a cut; it does not teleport.',
    'Make a downwards cut to claim the right side. The rover wakes only when its footprint fits on claimed ground, after a visible warning. Safe ground can still contain a threat.',
    'Make a downwards cut to create a new frontier. The diamond eroder warns before reopening one eligible cell. Reclaiming an erased cell does not pay its capture score again.',
    'Walls block travel. Slow material affects player speed, while lethal hidden material damages on contact. Capture material from outside to make the claimed route safe.',
  ];
  const studies = [];
  for (const id of ['opening-space', 'wall-slow-channels', 'bars-hollow-chambers']) {
    const study = await readJSON(`authoring/reference-studies/${id}.json`),
      materials = studyMaterials(study);
    const map = level(`study-${id}`, `Study · ${study.title}`.slice(0, 150), {
      ...materials,
      classic: { version: 'classic.v1', terrain: materials.terrain, powerups: [] },
      spawn: study.studySetup.spawn,
      goal: { coverage: study.studySetup.coverageGoal },
      enemies: study.studySetup.fieldActors.map((actor) => ({
        id: actor.id,
        type: 'bouncer',
        x: actor.x,
        y: actor.y,
        vx: 0,
        vy: 0,
      })),
      rules: {
        lives: 5,
        moveSpeed: 10,
        respawnSeconds: 0.7,
        graceSeconds: 0.8,
        timeLimitSeconds: 0,
      },
    });
    delete map.terrain;
    levels.push(map);
    briefs.push(
      `${study.reconstructionStatus} Stationary field actors isolate routing. Speeds, cell coordinates and capture behavior are our study values.`,
    );
    studies.push({
      studyId: id,
      levelId: map.id,
      studySha256: digest(study),
      levelSha256: digest(map),
      walls: map.walls.length,
      terrain: map.classic.terrain.length,
    });
  }
  for (const [i, map] of levels.entries()) map.metadata = { description: briefs[i] };
  pack.campaigns = [
    {
      ...pack.campaigns[0],
      id: 'classic-demonstrations',
      revision: '1',
      title: 'Classic Lab · practice demonstrations',
      levels,
    },
  ];
  const checked = validatePack(pack);
  assert.equal(checked.valid, true, checked.errors.join('; '));
  for (const study of studies)
    study.levelSha256 = digest(levels.find((map) => map.id === study.levelId));
  return { pack, studies };
}
async function main() {
  const args = process.argv.slice(2);
  assert.ok(
    args.length === 0 || (args.length === 1 && args[0] === '--write'),
    'Usage: node scripts/build-classic-lab.mjs [--write]',
  );
  const { pack, studies } = await buildClassicLab(),
    destination = new URL('game/content/packs/classic-lab.json', root);
  if (args.includes('--write')) await writeFile(destination, JSON.stringify(pack, null, 2) + '\n');
  else
    assert.deepEqual(
      JSON.parse(await readFile(destination, 'utf8')),
      pack,
      'Practice pack differs from its authored recipes.',
    );
  console.log(
    JSON.stringify(
      { maps: pack.campaigns[0].levels.length, indexedCampaign: false, studies },
      null,
      2,
    ),
  );
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main();
