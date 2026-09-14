import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { ordinaryFile, writeCandidateDirectory, digest } from '../sentinel-circuit/files.mjs';
import { buildSentinelCircuit } from '../sentinel-circuit/build.mjs';
import { preparePack } from '../../../game/packs.mjs';
import { prepareScenario } from '../../../game/imports.mjs';
import { boundedJSON, exactKeys } from '../../../game/data-json.mjs';

const ROOT = new URL('../../../', import.meta.url);
export const IDS = Object.freeze([
  'fracture-lines-split-ring',
  'fracture-lines-fault-fan',
  'fracture-lines-frayed-causeway',
]);
export const SOURCE_PINS = Object.freeze({
  'game/content/themes.json': '93582f7d9ba53753106df7b63928f086820fc0f68357d3c08f26c0b89fb84774',
  'game/content/classes.json': '2f776b0dfd099478ffe78465c7b602cd98896206a222a0ed7fd4405a4a643f84',
  'game/content/packs/fpv-arcade-r5.json':
    '350d89cf41767668b3734b474e5dd3d1d301bb0b5612e5082c5d233a1a081a74',
  'game/content/packs/fpv-pressure-frontier.json':
    '2ceba2a83670216da9443602f16ac30f4ed734ffba969c622dd1bff8153780c9',
  'authoring/library/fpv-route-choices/packs/fpv-route-choices.json':
    '589543f693e650355216aa702844a7726b7cd6e318900b8583702fd0650ae989',
  'authoring/library/sentinel-circuit/build.mjs':
    'e76f204cbe240bdedac79f2d92c85ab767846be32cfae50cd76ef983340c4d41',
  'authoring/library/sentinel-circuit/files.mjs':
    '6420294630e32dd71da8c731bb4291406b2841ee9d6afe8cd5cf4eda8218e275',
});
const noImage = async () => {
  throw new Error('Fracture Lines has no original image assets.');
};
const mask = (level, flipX = false, flipY = false) => {
  const bytes = new Uint8Array(level.width * level.height);
  for (const r of level.walls)
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++)
        bytes[
          (flipY ? level.height - 1 - y : y) * level.width + (flipX ? level.width - 1 - x : x)
        ] = 1;
  return bytes;
};
function components(bytes, width, height, value) {
  const seen = new Set(),
    sizes = [];
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] !== value || seen.has(i)) continue;
    const queue = [i];
    seen.add(i);
    for (let n = 0; n < queue.length; n++) {
      const at = queue[n],
        x = at % width,
        y = Math.floor(at / width);
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (!seen.has(next) && bytes[next] === value) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    sizes.push(queue.length);
  }
  return sizes.sort((a, b) => b - a);
}
/** Data-only novelty check: a distinct mask is necessary, never proof of fun. */
export function inspectTopology(level, previous) {
  const own = mask(level),
    sha256 = digest(own);
  for (const other of previous)
    for (const x of [false, true])
      for (const y of [false, true])
        assert.notEqual(
          sha256,
          digest(mask(other, x, y)),
          `Repeated/reflected wall mask: ${other.id}`,
        );
  return {
    levelId: level.id,
    width: level.width,
    height: level.height,
    spawn: level.spawn,
    wallMaskSha256: sha256,
    wallCells: own.reduce((n, v) => n + v, 0),
    wallComponents: components(own, level.width, level.height, 1),
    traversableComponents: components(own, level.width, level.height, 0),
    comparedLevelIds: previous.map((p) => p.id),
  };
}

export async function buildFractureLines() {
  const inputs = {},
    inputPins = [];
  for (const [file, sha256] of Object.entries(SOURCE_PINS)) {
    const bytes = await ordinaryFile(new URL(file, ROOT), 16 * 1024 * 1024);
    assert.equal(digest(bytes), sha256, file);
    inputPins.push({ path: file, bytes: bytes.length, sha256 });
    if (file.endsWith('.json')) inputs[file] = JSON.parse(bytes);
  }
  const bytes = await ordinaryFile(new URL('./layouts.json', import.meta.url), 64 * 1024);
  inputPins.push({
    path: 'authoring/library/fracture-lines/layouts.json',
    bytes: bytes.length,
    sha256: digest(bytes),
  });
  const layout = boundedJSON(JSON.parse(bytes), {
    maxBytes: 64 * 1024,
    maxNodes: 10000,
    maxDepth: 12,
    maxArray: 100,
    maxString: 4096,
  });
  exactKeys(layout, ['format', 'levels'], 'Fracture layouts');
  assert.equal(layout.format, 'revealline-fracture-layouts.v1');
  assert.deepEqual(
    layout.levels.map((l) => l.id),
    IDS,
  );
  const theme = inputs['game/content/themes.json'].themes.find((t) => t.id === 'fpv');
  const classRecipes = inputs['game/content/classes.json'];
  const older = Object.entries(inputs)
    .filter(([p]) => p.includes('/packs/'))
    .flatMap(([, p]) => p.campaigns.flatMap((c) => c.levels));
  older.push(...(await buildSentinelCircuit()).pack.campaigns[0].levels);
  assert.equal(older.length, 12);
  const scenarios = [],
    topologyFacts = [];
  for (const spec of layout.levels) {
    exactKeys(
      spec,
      [
        'id',
        'name',
        'coverage',
        'spawn',
        'walls',
        'enemies',
        'terrain',
        'powerups',
        'pressures',
        'description',
      ],
      'Fracture level',
    );
    const level = {
      version: 'xonix-level.v4',
      id: spec.id,
      revision: '1',
      name: spec.name,
      width: 72,
      height: 36,
      themeId: 'fpv',
      spawn: spec.spawn,
      goal: { coverage: spec.coverage },
      walls: spec.walls,
      enemies: spec.enemies,
      objectives: [],
      supplies: [],
      signalZones: [],
      hangars: [],
      encounter: null,
      classic: {
        version: 'classic.v1',
        terrain: spec.terrain,
        powerups: spec.powerups,
        lineImpact: { version: 'line-impact.v1', speed: 24 },
        arcadeActions: { version: 'arcade-actions.v1' },
        enemyPressure: { version: 'enemy-pressure.v1', actors: spec.pressures },
      },
      rules: {
        lives: 3,
        moveSpeed: 15,
        boostMultiplier: 1.5,
        graceSeconds: 0,
        respawnSeconds: 0.65,
        stopOnCapture: true,
        cutTimeLimitSeconds: 12,
        maxTrailCells: 140,
        timeLimitSeconds: 180,
        timeMedals: [45, 90],
      },
      metadata: {
        title: spec.name,
        description: spec.description,
        author: 'RevealLine',
        license: 'Original project content',
        rightsStatus:
          'Original abstract geometry. Procedural FPV presentation; no new illustrations, stories or music.',
      },
    };
    const scenario = {
      format: 'xonix-playground.v5',
      level,
      theme: structuredClone(theme),
      classRecipes: structuredClone(classRecipes),
      settings: { classId: 'scout', turnPolicy: 'immediate', seed: 1 },
      visualOverrides: {},
      masteryDefinition: null,
    };
    await prepareScenario(scenario, { decodeImage: noImage });
    topologyFacts.push(inspectTopology(level, [...older, ...scenarios.map((s) => s.level)]));
    scenarios.push(scenario);
  }
  const { pack } = await preparePack(
    {
      format: 'xonix-pack.v5',
      id: 'fracture-lines',
      version: '1.0.0',
      name: 'Fracture Lines · Arcade',
      engine: 'xonix-core.v5',
      dependencies: [],
      description:
        'Three direction-only routes: choose a gate in the broken ring, clear the branching bays, then maintain a return through the island lanes.',
      metadata: {
        author: 'RevealLine',
        license: 'Original project content',
        rightsStatus:
          'Original abstract layouts. Existing procedural presentation; no new original media.',
      },
      themes: [structuredClone(theme)],
      classRecipes: structuredClone(classRecipes),
      visualOverrides: {},
      levelVisuals: [],
      music: [],
      masteries: [],
      campaigns: [
        {
          version: 'xonix-campaign.v1',
          id: 'fracture-lines',
          revision: '1',
          title: 'Fracture Lines',
          themeId: 'fpv',
          classIds: classRecipes.map((c) => c.id),
          levels: scenarios.map((s) => s.level),
        },
      ],
    },
    { decodeImage: noImage },
  );
  return { pack, scenarios, inputPins, topologyFacts };
}
export async function exportFractureLines(output) {
  const { pack, scenarios } = await buildFractureLines();
  return writeCandidateDirectory(output, {
    'fracture-lines.json': pack,
    ...Object.fromEntries(scenarios.map((s) => [s.level.id + '.json', s])),
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assert.ok(
    process.argv.length === 4 && process.argv[2] === '--out',
    'Use build.mjs --out .cache/<new-directory>.',
  );
  console.log(JSON.stringify(await exportFractureLines(process.argv[3]), null, 2));
}
