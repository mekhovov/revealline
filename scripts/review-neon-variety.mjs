import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRun, CELL } from '../game/core/index.mjs';
import {
  projectClassicCurrentRulesEntry,
  CLASSIC_RULES_CURRENT,
} from '../game/mission-library/classic-current-rules.mjs';
const read = async (path) =>
  JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const receipts = (await read('docs/qualification/neon-level-completion/winning-routes.json'))
  .receipts;
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const rows = [];
for (const packId of ['neon-reference-pack', 'neon-mosaic-pack']) {
  const pack = await read(`game/content/packs/${packId}.json`);
  for (const original of pack.campaigns) {
    const campaign = {
      ...original,
      classRecipes: pack.classRecipes.filter((r) => original.classIds.includes(r.id)),
    };
    const current = projectClassicCurrentRulesEntry({ campaign }, CLASSIC_RULES_CURRENT);
    for (const level of current.campaign.levels) {
      const route = receipts.find(
        (r) =>
          r.levelId === level.id &&
          r.difficulty === 'standard' &&
          r.options.turnPolicy === 'grid-center',
      );
      if (!route) throw Error(`Missing legal route: ${level.id}`);
      const run = createRun(level, route.options),
        hist = { safe: 0, wall: 0, field: 0, slow: 0, lethal: 0 };
      const structure = [];
      for (let i = 0; i < run.cells.length; i++) {
        const value = run.cells[i];
        hist[value === CELL.SAFE ? 'safe' : value === CELL.WALL ? 'wall' : 'field']++;
        if (run.classic.terrain[i] === 1) hist.slow++;
        if (run.classic.terrain[i] === 2) hist.lethal++;
        structure.push(value === CELL.WALL ? 'W' : value === CELL.SAFE ? 'S' : '.');
      }
      const directionChanges = route.segments.reduce(
        (n, [d], i) => n + (i > 0 && d !== route.segments[i - 1][0]),
        0,
      );
      rows.push({
        packId,
        id: level.id,
        name: level.name,
        description: original.levels.find((l) => l.id === level.id).description ?? '',
        structureSHA256: digest(structure.join('')),
        lowerStructureSHA256: digest(
          structure.slice(run.width * Math.floor(run.height * 0.66)).join(''),
        ),
        geometry: hist,
        enemyTypes: [...new Set(run.enemies.map((e) => e.type))].sort(),
        directionChanges,
        firstDirection: route.segments.find(([d]) => d)?.[0],
        routeSeconds: route.time,
        routeCheckpoint: route.checkpoint,
      });
    }
  }
}
const groups = (key) => {
  const m = new Map();
  for (const r of rows) {
    const bucket = m.get(r[key]) ?? [];
    bucket.push(r.id);
    m.set(r[key], bucket);
  }
  return [...m.values()].filter((v) => v.length > 1);
};
const result = {
  format: 'revealline-neon-route-variety-review.v1',
  scope:
    'Authored structural variety plus recorded legal-route decisions. No route search, geometry change, human enjoyment or every-seed guarantee.',
  levels: rows.length,
  distinctSafeWallStructures: new Set(rows.map((r) => r.structureSHA256)).size,
  distinctLowerSafeWallStructures: new Set(rows.map((r) => r.lowerStructureSHA256)).size,
  sharedStructures: groups('structureSHA256'),
  sharedLowerStructures: groups('lowerStructureSHA256'),
  range: {
    directionChanges: [
      Math.min(...rows.map((r) => r.directionChanges)),
      Math.max(...rows.map((r) => r.directionChanges)),
    ],
    routeSeconds: [
      Math.min(...rows.map((r) => r.routeSeconds)),
      Math.max(...rows.map((r) => r.routeSeconds)),
    ],
  },
  rows,
};
await writeFile(
  new URL('../docs/qualification/neon-level-completion/route-variety.json', import.meta.url),
  JSON.stringify(result, null, 2) + '\n',
);
console.log(
  JSON.stringify(
    {
      levels: result.levels,
      distinctSafeWallStructures: result.distinctSafeWallStructures,
      distinctLowerSafeWallStructures: result.distinctLowerSafeWallStructures,
      sharedStructures: result.sharedStructures,
      range: result.range,
    },
    null,
    2,
  ),
);
