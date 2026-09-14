import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { ordinaryFile, writeCandidateDirectory, digest } from '../sentinel-circuit/files.mjs';
import { buildCountercurrent } from '../countercurrent/build.mjs';
import { buildSentinelCircuit } from '../sentinel-circuit/build.mjs';
import {
  buildFractureLines,
  inspectTopology,
  SOURCE_PINS as FRACTURE_PINS,
} from '../fracture-lines/build.mjs';
import { preparePack } from '../../../game/packs.mjs';
import { prepareScenario } from '../../../game/imports.mjs';
import { boundedJSON, exactKeys } from '../../../game/data-json.mjs';

const ROOT = new URL('../../../', import.meta.url);
export const IDS = Object.freeze([
  'moving-edges-terrace-stitch',
  'moving-edges-survey-wheel',
  'moving-edges-breakwater-return',
]);
export const CLASS_IDS = Object.freeze([
  'scout',
  'bomber',
  'carrier',
  'interceptor',
  'fiber',
  'impact',
  'trapper',
]);
export const SOURCE_PINS = Object.freeze({
  ...FRACTURE_PINS,
  'authoring/library/countercurrent/build.mjs':
    '545629fb0269bfe63f4895db9b5e5e537c704f24d2795e4d4e78e62ea6344de2',
  'authoring/library/countercurrent/layouts.json':
    'daaeb40b6260ada3632d602d42b41788fb0c36de109bcc0a1f648018112f3abc',
  'authoring/library/fracture-lines/build.mjs':
    '56cb05d183ce0406af2949506d6c3f6da78e9e275ce7302360a3d6742d72e59d',
  'authoring/library/fracture-lines/layouts.json':
    'af15577704ce673100f7c6d89ae92baffa25c5ebfdae2459ea4c720a9d7ab179',
});
const noImage = async () => {
  throw new Error('Moving Edges geometry has no original image assets.');
};

/** Source-only compilation through the existing validators; no simulation or install. */
export async function buildMovingEdges() {
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
    path: 'authoring/library/moving-edges/layouts.json',
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
  exactKeys(layout, ['format', 'levels'], 'Moving Edges layouts');
  assert.equal(layout.format, 'revealline-moving-edges-layouts.v1');
  assert.deepEqual(
    layout.levels.map((level) => level.id),
    IDS,
  );
  assert.deepEqual(
    layout.levels.map((level) => level.slotId),
    ['unassigned-16', 'unassigned-17', 'unassigned-18'],
  );
  const theme = inputs['game/content/themes.json'].themes.find((item) => item.id === 'fpv');
  const classRecipes = inputs['game/content/classes.json'];
  assert.deepEqual(
    classRecipes.map((item) => item.id),
    CLASS_IDS,
  );
  const older = Object.entries(inputs)
    .filter(([file]) => file.includes('/packs/'))
    .flatMap(([, pack]) => pack.campaigns.flatMap((campaign) => campaign.levels));
  older.push(...(await buildSentinelCircuit()).pack.campaigns[0].levels);
  older.push(...(await buildFractureLines()).pack.campaigns[0].levels);
  older.push(...(await buildCountercurrent()).pack.campaigns[0].levels);
  assert.equal(older.length, 18, 'Eighteen prior geometry exemplars, not production approvals.');
  const scenarios = [],
    topologyFacts = [];
  for (const spec of layout.levels) {
    exactKeys(
      spec,
      [
        'id',
        'slotId',
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
      'Moving Edges level',
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
        ...(spec.pressures.length
          ? { enemyPressure: { version: 'enemy-pressure.v1', actors: spec.pressures } }
          : {}),
      },
      rules: {
        lives: 3,
        moveSpeed: 15,
        boostMultiplier: 1.5,
        graceSeconds: 0,
        respawnSeconds: 0.65,
        stopOnCapture: true,
        cutTimeLimitSeconds: 0,
        maxTrailCells: 0,
        timeLimitSeconds: 0,
        timeMedals: [60, 120],
      },
      metadata: {
        title: spec.name,
        description: spec.description,
        author: 'RevealLine',
        license: 'Original project content',
        rightsStatus:
          'Original abstract source geometry. Existing procedural preview presentation; no new artwork, stories or music.',
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
    const facts = inspectTopology(level, [...older, ...scenarios.map((item) => item.level)]);
    assert.equal(facts.traversableComponents.length, 1, 'One connected non-wall domain required.');
    topologyFacts.push(facts);
    scenarios.push(scenario);
  }
  // Existing execution/session APIs require a prepared owner. This internal pack
  // is never written, installed, registered or offered for distribution here.
  const { pack } = await preparePack(
    {
      format: 'xonix-pack.v5',
      id: 'moving-edges',
      version: '1.0.0',
      name: 'Moving Edges · Arcade',
      engine: 'xonix-core.v5',
      dependencies: [],
      description:
        'Three original route decisions: shifting frontier, unequal sectors and erosion repair.',
      metadata: {
        author: 'RevealLine',
        license: 'Original project content',
        rightsStatus: 'Original abstract source geometry; no new media or production approval.',
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
          id: 'moving-edges',
          revision: '1',
          title: 'Moving Edges',
          themeId: 'fpv',
          classIds: [...CLASS_IDS],
          levels: scenarios.map((scenario) => scenario.level),
        },
      ],
    },
    { decodeImage: noImage },
  );
  return { pack, scenarios, inputPins, topologyFacts };
}

/** Optional source preview export writes only three scenarios into a new cache directory. */
export async function exportMovingEdgesScenarios(output) {
  const { scenarios } = await buildMovingEdges();
  return writeCandidateDirectory(
    output,
    Object.fromEntries(scenarios.map((scenario) => [scenario.level.id + '.json', scenario])),
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  assert.ok(
    (args.length === 1 && args[0] === '--inspect') || (args.length === 2 && args[0] === '--out'),
    'Use build.mjs --inspect or --out .cache/new-scenario-directory.',
  );
  console.log(
    JSON.stringify(
      args[0] === '--out'
        ? await exportMovingEdgesScenarios(args[1])
        : (await buildMovingEdges()).topologyFacts,
      null,
      2,
    ),
  );
}
