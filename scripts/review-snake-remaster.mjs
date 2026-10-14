/** Reproducible catalogue evidence, not an automated claim that a mission is fun. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { CLASSIC_SNAKE_LEVELS as levels } from '../game/snake/classic-catalogue.mjs';
import {
  CLASSIC_REMASTER_REVISIONS,
  CLASSIC_EDITORIAL_REVISIONS,
} from '../game/snake/classic-catalogue-remaster.mjs';
import { CLASSIC_MISSION_COMPOSITIONS } from '../game/snake/classic-compositions.mjs';
import { CLASSIC_CHAPTER_COMPOSITIONS } from '../game/snake/classic-worlds.mjs';
const revisions = { ...CLASSIC_REMASTER_REVISIONS, ...CLASSIC_EDITORIAL_REVISIONS };
const point = (p) => `(${p.x},${p.y})`;
const list = (cells) => cells.map(point).join(', ');
const key = (p) => `${p.x},${p.y}`;
const family = (level) => [
  ...new Set(
    level.targets?.required.map((p) => p.kind) ?? [
      level.targetMovement === 'flee' ? 'runner' : 'stationary prey',
    ],
  ),
];
function dimensions(level) {
  return {
    walls: level.walls.length,
    families: family(level).join('/'),
    catches: level.goal,
    stages: level.operation?.stages.length ?? 1,
    cargo: level.operation?.parcels.length ?? 0,
    gates: level.operation?.plates.length ?? 0,
    wrap: level.wrap,
  };
}
function turningArea(level) {
  const blocked = new Set(level.walls.map(key)),
    areas = [];
  for (let y = 2; y < level.height - 2; y++)
    for (let x = 2; x < level.width - 2; x++) {
      let clear = true;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) if (blocked.has(`${x + dx},${y + dy}`)) clear = false;
      if (clear) areas.push({ x, y });
    }
  const destination = level.operation?.stages.at(-1).exit ?? level.spawns[0];
  return areas.sort(
    (a, b) =>
      Math.abs(a.x - destination.x) +
      Math.abs(a.y - destination.y) -
      Math.abs(b.x - destination.x) -
      Math.abs(b.y - destination.y),
  )[0];
}
const missions = levels.map((entry, index) => {
  const { level } = entry,
    operation = level.operation,
    composition = CLASSIC_MISSION_COMPOSITIONS[entry.id];
  const previous = levels[index - 1],
    current = dimensions(level),
    before = previous ? dimensions(previous.level) : null;
  const changes = before
    ? Object.entries(current)
        .filter(([field, value]) => before[field] !== value)
        .map(([field, value]) => `${field}: ${before[field]} → ${value}`)
    : [];
  const anchors = (level.targets?.required ?? [])
    .filter((p) => p.at)
    .map((p) => `${p.kind} at ${point(p.at)}`);
  const firstStage = operation?.stages[0],
    route = level.tactics?.[0]?.route;
  const firstObject = firstStage?.deliveries.length
    ? operation.parcels.find((p) => firstStage.deliveries.includes(p.id))?.at
    : null;
  const initial = firstObject ?? route?.[0] ?? level.targets?.required.find((p) => p.at)?.at;
  const area = turningArea(level);
  const nextGeometry = previous
    ? level.walls.filter((p) => !previous.level.walls.some((q) => key(q) === key(p))).length
    : 0;
  return {
    id: entry.id,
    chapter: entry.chapterId,
    world: CLASSIC_CHAPTER_COMPOSITIONS[entry.chapterId].scene,
    disposition: revisions[entry.id] ? 'revise-gameplay' : 'retain-gameplay-remaster-presentation',
    centralDecision: entry.description.en,
    opening: initial
      ? `From ${point(level.spawns[0])}, prepare an approach toward ${point(initial)}${firstObject ? ' for the first active parcel' : route ? ' at the committed route endpoint' : ' at the first fixed source'}. ${firstStage ? `Opening clearance: ${firstStage.id}.` : ''}`
      : `From ${point(level.spawns[0])}, read the spawned ${family(level).join(' / ')} and choose an approach around ${level.walls.length} occupied cells before the first catch.`,
    pressure: `${level.goal} accepted catches; ${family(level).join(', ')}.${operation ? ` ${operation.stages.map((s) => `${s.id}: ${s.catches} catches${s.deliveries.length ? `, deliveries ${s.deliveries.join('/')}` : ''}${s.exit ? `, exit ${point(s.exit)}` : ''}`).join('; ')}.` : ''}${anchors.length ? ` Fixed approaches: ${anchors.join('; ')}.` : ''}${route ? ` Committed route: ${list(route)}.` : ''}`,
    recovery: `${area ? `Terrain leaves a 3×3 turning area centred at ${point(area)}; ` : ''}${level.wrap ? 'the wrapping seam offers another approach' : 'check the open ends of the solid structures before returning'}. This is static route evidence, not a guarantee against a moving target, hazard or cable.`,
    focalArrangement: {
      ...composition.assembly,
      floor: composition.floor,
      light: composition.light,
    },
    differenceFromPrevious: previous
      ? `${changes.length ? changes.join('; ') : 'Same encounter vocabulary, different authored route'}. ${nextGeometry} solid cells differ from ${previous.id}; this mission asks: ${entry.description.en.split('. ')[0]}.`
      : 'The obstacle-free introduction teaches one turn, one catch and the growing cable before any structure or special enemy.',
    rationale:
      revisions[entry.id]?.reason ??
      `Retain the authored decision: ${entry.description.en} Improve its ${composition.assembly.family} construction and ${composition.assembly.landmark} focal assembly without adding collision cells.`,
    measurements: current,
  };
});
const report = {
  format: 'classic-snake-remaster-review.v1',
  scope:
    '240 official missions; deterministic recipe review plus authored tactical revision rationales. This is not a player study.',
  prototypes: 18,
  retained: missions.filter((m) => m.disposition !== 'revise-gameplay').length,
  revised: missions.filter((m) => m.disposition === 'revise-gameplay').length,
  missions,
};
const dir = new URL('../docs/verification/snake-remaster/', import.meta.url),
  file = new URL('catalogue-review.json', dir),
  text = JSON.stringify(report, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if ((await readFile(file, 'utf8')) !== text)
    throw new Error('Catalogue review differs from accepted recipes; regenerate evidence.');
} else {
  await mkdir(dir, { recursive: true });
  await writeFile(file, text);
}
console.log(
  `Reviewed ${missions.length} recipes: ${report.revised} gameplay revisions, ${report.retained} retained gameplay decisions, all compositions remastered.`,
);
