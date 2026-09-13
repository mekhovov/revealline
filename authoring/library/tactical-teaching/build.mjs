import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { CLASSIC_VERSIONS } from '../../../game/core/versions.mjs';
import { prepareScenario } from '../../../game/imports.mjs';

const root = new URL('../../../', import.meta.url);
export const SOURCE_PINS = Object.freeze({
  'game/content/themes.json': '93582f7d9ba53753106df7b63928f086820fc0f68357d3c08f26c0b89fb84774',
  'game/content/classes.json': '2f776b0dfd099478ffe78465c7b602cd98896206a222a0ed7fd4405a4a643f84',
});
export const DEMO_IDS = Object.freeze([
  'tactical-read-clearing',
  'tactical-borrowed-seconds',
  'tactical-quiet-crossing',
]);
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export async function buildTacticalTeaching() {
  const inputs = {};
  for (const [path, hash] of Object.entries(SOURCE_PINS)) {
    const bytes = await readFile(new URL(path, root));
    assert.equal(sha256(bytes), hash, `Reviewed source changed: ${path}`);
    inputs[path] = JSON.parse(bytes);
  }
  const theme = inputs['game/content/themes.json'].themes.find((item) => item.id === 'fpv');
  assert.ok(theme);
  const recipes = inputs['game/content/classes.json'];
  const specs = [
    {
      name: 'Read the clearing',
      classId: 'scout',
      description:
        'Recommended: Scout. Scan once at home to reveal the hidden relay, then cut Down to the opposite safe border. Secure 45% and the relay. Scan provides information and direction hints; it grants no area and is not a secret completion requirement. A reversed live cut still costs the only life. Original abstract teaching board.',
      enemy: { id: 'east-patrol', type: 'bouncer', x: 60.5, y: 25.5, vx: 1, vy: 0.5 },
      rules: {},
      supplies: [],
      signalZones: [],
    },
    {
      name: 'Borrowed seconds',
      classId: 'bomber',
      description:
        'Recommended: Light carrier. Collect a charge on the home supply pad. Fly Down about five cells, then use Equipment to hold the approaching field patrol while you finish the cut. Secure 45% and the relay. Supply is a separate action; an empty carrier cannot place a field. The field grants time, not territory or relay delivery. One life; keep moving while the cable is exposed. Original abstract teaching board.',
      enemy: { id: 'crossing-patrol', type: 'bouncer', x: 40.5, y: 5.5, vx: -2, vy: 0 },
      rules: {},
      supplies: [{ id: 'home-supply', x: 36.5, y: 0.5, radius: 2 }],
      signalZones: [],
    },
    {
      name: 'Quiet crossing',
      classId: 'fiber',
      description:
        'Recommended: Fiber relay. Fly Down through the visible interference band; Scan there to reveal the relay, then reach the opposite safe border. Secure 45% and the relay. Fiber ignores this band’s slowdown and action/Boost lock, but does not protect the live cable: close within five seconds and 36 cells. An overlong sideways detour still loses the only life. Original abstract teaching board.',
      enemy: { id: 'east-patrol', type: 'bouncer', x: 60.5, y: 25.5, vx: 1, vy: 0.5 },
      rules: { cutTimeLimitSeconds: 5, maxTrailCells: 36 },
      supplies: [],
      signalZones: [
        {
          id: 'quiet-band',
          x: 1,
          y: 4,
          w: 70,
          h: 12,
          speedFactor: 0.25,
          disableBoost: true,
          lockAbility: true,
        },
      ],
    },
  ];
  const scenarios = [];
  for (const [i, spec] of specs.entries()) {
    const level = {
      version: CLASSIC_VERSIONS.levelVersion,
      id: DEMO_IDS[i],
      revision: '1',
      name: spec.name,
      width: 72,
      height: 36,
      encounter: null,
      classic: { version: 'classic.v1', terrain: [], powerups: [] },
      spawn: { x: 36.5, y: 0.5 },
      walls: [],
      enemies: [spec.enemy],
      objectives: [{ id: 'clearing-relay', x: 18.5, y: 18.5, required: true, hidden: i !== 1 }],
      supplies: spec.supplies,
      signalZones: spec.signalZones,
      hangars: [],
      goal: { coverage: 0.45 },
      rules: {
        lives: 1,
        moveSpeed: 10,
        boostMultiplier: 1.5,
        graceSeconds: 0,
        respawnSeconds: 0.1,
        stopOnCapture: true,
        cutTimeLimitSeconds: 8,
        timeLimitSeconds: 30,
        timeMedals: [8, 15],
        ...spec.rules,
      },
      metadata: { description: spec.description },
    };
    const candidate = {
      format: 'xonix-playground.v5',
      level,
      theme: structuredClone(theme),
      classRecipes: structuredClone(recipes),
      settings: { classId: spec.classId, turnPolicy: 'immediate', seed: 1 },
      visualOverrides: {},
      masteryDefinition: null,
    };
    // Actual public import authority; no image adapter or invented media is needed.
    await prepareScenario(candidate);
    scenarios.push(candidate);
  }
  return scenarios;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const scenarios = await buildTacticalTeaching();
  if (process.argv.slice(2).join(' ') !== '--write')
    throw new Error('Use --write to materialize only these new authored scenarios.');
  const directory = new URL('scenarios/', import.meta.url);
  await mkdir(directory, { recursive: true });
  for (const scenario of scenarios)
    await writeFile(
      new URL(`${scenario.level.id}.json`, directory),
      `${JSON.stringify(scenario, null, 2)}\n`,
      { flag: 'wx' },
    );
  process.stdout.write(`Prepared ${scenarios.length} isolated scenarios.\n`);
}
