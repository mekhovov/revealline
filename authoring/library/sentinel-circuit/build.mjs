import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { ordinaryFile, writeCandidateDirectory } from './files.mjs';
import { preparePack } from '../../../game/packs.mjs';
import { prepareScenario } from '../../../game/imports.mjs';

const root = new URL('../../../', import.meta.url);
export const SOURCE_PINS = Object.freeze({
  'game/content/themes.json': '93582f7d9ba53753106df7b63928f086820fc0f68357d3c08f26c0b89fb84774',
  'game/content/classes.json': '2f776b0dfd099478ffe78465c7b602cd98896206a222a0ed7fd4405a4a643f84',
});
export const IDS = Object.freeze([
  'sentinel-circuit-listening-court',
  'sentinel-circuit-switchyard-gates',
  'sentinel-circuit-open-circuit',
]);
const wall = (x, y, w, h) => ({ x, y, w, h });
const field = (id, x, y, vx, vy) => ({ id, type: 'bouncer', x, y, vx, vy, radius: 0.25 });
const objective = (id, x, y, hidden = false) => ({ id, x, y, required: true, hidden });
const noImage = async () => {
  throw new Error('This candidate uses existing procedural pictures.');
};

/** Three new layouts; this chapter does not add an internal boss phase. */
export async function buildSentinelCircuit() {
  const inputs = {};
  for (const [file, hash] of Object.entries(SOURCE_PINS)) {
    const bytes = await ordinaryFile(new URL(file, root), 1024 * 1024);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), hash, file);
    inputs[file] = JSON.parse(bytes);
  }
  const theme = inputs['game/content/themes.json'].themes.find((t) => t.id === 'fpv');
  const classRecipes = inputs['game/content/classes.json'];
  const specs = [
    {
      name: 'Listening Court',
      classId: 'scout',
      coverage: 0.45,
      spawn: { x: 0.5, y: 18.5 },
      walls: [wall(10, 5, 2, 9), wall(12, 5, 12, 2), wall(24, 23, 18, 2), wall(40, 25, 2, 6)],
      enemies: [field('court-interceptor', 58.5, 30.5, -0.7, 0.5)],
      objectives: [objective('court-listening-relay', 22.5, 9.5, true)],
      supplies: [],
      signalZones: [],
      encounter: null,
      classic: {
        enemyPressure: {
          version: 'enemy-pressure.v1',
          actors: [
            {
              id: 'court-interceptor',
              mode: 'head-intercept',
              senseRadius: 20,
              scanTicks: 36,
              warningTicks: 90,
              commitTicks: 240,
              cooldownTicks: 360,
              leadTicks: 30,
            },
          ],
        },
      },
      description:
        'Recommended: Scout. Scan reveals the hidden relay and shows enemy direction hints; it does not slow the patrol or capture territory. Reveal 45% and the relay. Read the two open courtyards before choosing the upper survey loop or lower outer approach. The center throat ends at a wall: walls cannot reconnect a cut. An interceptor warns before committing to its target. A known route without Scan remains possible.',
    },
    {
      name: 'Switchyard Gates',
      classId: 'bomber',
      coverage: 0.45,
      spawn: { x: 36.5, y: 35.5 },
      walls: [wall(8, 8, 20, 2), wall(44, 15, 18, 2), wall(24, 24, 2, 7)],
      enemies: [field('switchyard-crosser', 32.5, 30.5, 2, 0)],
      objectives: [objective('switchyard-relay', 58.5, 24.5)],
      supplies: [{ id: 'switchyard-charge', x: 36.5, y: 35.5, radius: 2 }],
      signalZones: [],
      encounter: null,
      classic: {},
      description:
        'Recommended: Light carrier. Collect one charge at home, then fly Up about five cells and drop the temporary field before the patrol reaches your cable. The field stuns nearby enemies for 2.5 seconds; it is not a delivery or damage action. Reveal 45% and the eastern relay. Empty or early equipment leaves the crossing exposed. A longer route follows the eastern safe edge, cuts left above the patrol, then returns through the upper gate.',
    },
    {
      name: 'Open the Circuit',
      classId: 'fiber',
      coverage: 0.75,
      spawn: { x: 36.5, y: 35.5 },
      walls: [
        wall(8, 10, 10, 2),
        wall(18, 12, 2, 8),
        wall(34, 6, 16, 2),
        wall(48, 8, 2, 7),
        wall(42, 25, 18, 2),
      ],
      enemies: [{ id: 'circuit-sentinel', type: 'relay-sentinel', x: 54.5, y: 18.5, radius: 0.25 }],
      objectives: [objective('circuit-shield', 18.5, 8.5), objective('circuit-core', 54.5, 18.5)],
      supplies: [],
      signalZones: [
        {
          id: 'circuit-band',
          x: 22,
          y: 4,
          w: 12,
          h: 27,
          speedFactor: 0.25,
          disableBoost: true,
          lockAbility: true,
        },
      ],
      classic: {},
      encounter: {
        version: 'xonix-encounter.v1',
        kind: 'relay-sentinel',
        enemyId: 'circuit-sentinel',
        shieldObjectiveId: 'circuit-shield',
        coreObjectiveId: 'circuit-core',
        minReleaseCutCells: 12,
        initialDelayTicks: 240,
        transitionTicks: 180,
        shielded: { warningTicks: 240, activeTicks: 84, restTicks: 396 },
        exposed: { warningTicks: 240, activeTicks: 84, openTicks: 480 },
        laneWidth: 1.2,
      },
      description:
        'Recommended: Fiber relay. Signal resistance keeps your movement and equipment working through the band; your live cable can still break. Other craft can use the western and southern detour. Capture the visible shield relay first. The sentinel warns horizontally, then after the relay warns vertically. Wait for the active stripe to end; during the opening close a cut with at least twelve new field cells. An early or short cut keeps ordinary gains but does not open the core. Missed openings repeat. If at most twelve field cells remain, wait safely outside a cut for an opening. The sentinel has a shielded stage and an exposed stage.',
    },
  ];
  const scenarios = [];
  for (const [i, spec] of specs.entries()) {
    const level = {
      version: 'xonix-level.v4',
      id: IDS[i],
      revision: '1',
      name: spec.name,
      width: 72,
      height: 36,
      themeId: 'fpv',
      spawn: spec.spawn,
      goal: { coverage: spec.coverage },
      walls: spec.walls,
      enemies: spec.enemies,
      objectives: spec.objectives,
      supplies: spec.supplies,
      signalZones: spec.signalZones,
      hangars: [{ id: `circuit-home-${i + 1}`, ...spec.spawn, radius: 2 }],
      classic: { version: 'classic.v1', terrain: [], powerups: [], ...spec.classic },
      encounter: spec.encounter,
      rules: {
        lives: 3,
        moveSpeed: 10,
        boostMultiplier: 1.5,
        graceSeconds: 0,
        respawnSeconds: 0.65,
        stopOnCapture: true,
        cutTimeLimitSeconds: 12,
        maxTrailCells: 110,
        timeLimitSeconds: 180,
        timeMedals: [45, 90],
      },
      metadata: {
        title: spec.name,
        description: spec.description,
        author: 'RevealLine',
        license: 'Original project content',
        rightsStatus:
          'Original abstract route geometry and fictional mechanics; existing procedural scenery and theme music.',
      },
    };
    const scenario = {
      format: 'xonix-playground.v5',
      level,
      theme: structuredClone(theme),
      classRecipes: structuredClone(classRecipes),
      settings: { classId: spec.classId, turnPolicy: 'immediate', seed: 1 },
      visualOverrides: {},
      masteryDefinition: null,
    };
    await prepareScenario(scenario, { decodeImage: noImage });
    scenarios.push(scenario);
  }
  const { pack } = await preparePack(
    {
      format: 'xonix-pack.v5',
      id: 'sentinel-circuit',
      version: '1.0.0',
      name: 'Sentinel Circuit · Tactical',
      engine: 'xonix-core.v5',
      dependencies: [],
      description:
        'Three missions: read the courtyards, control a crossing, then release the signal sentinel. Existing procedural pictures and theme music.',
      metadata: {
        author: 'RevealLine',
        license: 'Original project content',
        rightsStatus:
          'Original fictional scenarios. No newly illustrated backgrounds or real-world equipment claims.',
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
          id: 'sentinel-circuit',
          revision: '1',
          title: 'Sentinel Circuit',
          themeId: 'fpv',
          classIds: classRecipes.map((c) => c.id),
          levels: scenarios.map((s) => s.level),
        },
      ],
    },
    { decodeImage: noImage },
  );
  return { pack, scenarios };
}

export async function exportSentinelCircuit(output) {
  const { pack, scenarios } = await buildSentinelCircuit();
  return writeCandidateDirectory(output, {
    'sentinel-circuit.json': pack,
    ...Object.fromEntries(scenarios.map((s) => [`${s.level.id}.json`, s])),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assert.ok(
    process.argv.length === 4 && process.argv[2] === '--out',
    'Use build.mjs --out .cache/<new-directory>.',
  );
  console.log(JSON.stringify(await exportSentinelCircuit(process.argv[3]), null, 2));
}
