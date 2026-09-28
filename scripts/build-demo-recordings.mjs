#!/usr/bin/env node
/** Human-authored bent capture routes on unchanged installed campaign levels.
 * Default verifies committed assets. --write creates new files, never overwrites. */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createRun, stepRun, FIXED_DT } from '../game/core/index.mjs';
import { createRecorder, recordInput, exportReplay, verifyReplay } from '../game/replay.mjs';
import { DEMO_CATALOG_VERSION, demoDescriptor } from '../game/demo-catalog.mjs';

const root = new URL('../', import.meta.url);
const plans = [
  [
    [16, 5, 8],
    [24, 10, 8],
    [32, 15, 4],
    [40, 20, 4],
    [44, 26, 4],
    [44, 32, 4],
  ],
  [
    [32, 5, 40],
    [24, 10, 40],
    [16, 15, 44],
    [8, 20, 44],
    [4, 26, 44],
    [4, 32, 44],
  ],
  [
    [20, 4, 12],
    [28, 8, 12],
    [36, 12, 4],
    [40, 18, 4],
    [44, 25, 4],
    [44, 32, 4],
  ],
];
const clips = [
  {
    id: 'first-signal-left',
    level: 0,
    plan: 0,
    wait: 48,
    policy: 'immediate',
    tags: ['capture', 'bent-cut', 'safe-ground'],
  },
  {
    id: 'first-signal-right',
    level: 0,
    plan: 1,
    wait: 48,
    policy: 'grid-center',
    tags: ['capture', 'bent-cut', 'safe-ground'],
  },
  {
    id: 'relay-orchard-loop',
    level: 1,
    plan: 1,
    wait: 48,
    policy: 'immediate',
    tags: ['capture', 'bent-cut', 'relay'],
  },
  {
    id: 'relay-orchard-stairs',
    level: 1,
    plan: 2,
    wait: 48,
    policy: 'grid-center',
    tags: ['capture', 'bent-cut', 'relay'],
  },
  {
    id: 'crosswind-openings',
    level: 2,
    plan: 0,
    wait: 0,
    policy: 'immediate',
    tags: ['capture', 'bent-cut', 'multiple-enemies'],
  },
  {
    id: 'night-patrol-loop',
    level: 4,
    plan: 0,
    wait: 48,
    policy: 'grid-center',
    tags: ['capture', 'bent-cut', 'border-patrol'],
  },
];

export async function buildDemoRecordings() {
  const [campaign, classRecipes] = await Promise.all([
    readFile(new URL('game/content/campaign.json', root), 'utf8').then(JSON.parse),
    readFile(new URL('game/content/classes.json', root), 'utf8').then(JSON.parse),
  ]);
  campaign.classRecipes = classRecipes;
  const entry = { campaign, classRecipes };
  return clips.map((clip) => {
    const level = campaign.levels[clip.level];
    const options = { classId: 'scout', classRecipes, seed: 1, turnPolicy: clip.policy };
    const run = createRun(level, options),
      recorder = createRecorder(level, options, 'authored-attract-route.v1');
    let closedCuts = 0,
      bends = 0;
    function input(command, ticks = 1) {
      for (let tick = 0; tick < ticks && run.status === 'running'; tick++) {
        assert.ok(run.tick < 120 * 90, 'Demo route exceeded its duration budget.');
        stepRun(run, command, FIXED_DT);
        recordInput(recorder, command);
        closedCuts += run.events.filter((event) => event.type === 'cut.closed').length;
        assert.equal(run.lives, 3, `${clip.id}: authored route lost a life.`);
      }
    }
    function move(axis, cell) {
      if (run.status !== 'running') return;
      const target = cell + 0.5,
        sign = Math.sign(target - run.player[axis]);
      if (!sign) return;
      const direction = axis === 'x' ? (sign > 0 ? 'right' : 'left') : sign > 0 ? 'down' : 'up';
      if (run.player.cutting && run.player.direction !== direction) bends++;
      let ticks = 0;
      while ((target - run.player[axis]) * sign > 0.02 && run.status === 'running') {
        assert.ok(ticks++ < 1500, `${clip.id}: unreachable authored waypoint.`);
        input({ direction });
      }
    }
    for (const [start, depth, end] of plans[clip.plan]) {
      if (run.status !== 'running') break;
      input({ action: true });
      input({}, clip.wait);
      move('x', start);
      move('y', depth);
      move('x', end);
      move('y', 0);
    }
    const replay = exportReplay(recorder, run);
    assert.equal(run.status, 'won', `${clip.id}: route did not finish.`);
    assert.ok(closedCuts >= 3 && bends >= 3, `${clip.id}: insufficient bent capture sequences.`);
    assert.ok(run.time >= 15 && run.time <= 60, `${clip.id}: unsuitable showcase duration.`);
    assert.equal(verifyReplay(replay).match, true);
    return {
      replay,
      descriptor: {
        ...demoDescriptor(replay, entry, { id: clip.id, provenance: 'authored' }),
        replayURL: `./demo-data/${clip.id}.replay.json`,
        tags: clip.tags,
      },
      metrics: { closedCuts, bends },
    };
  });
}

async function main() {
  const args = process.argv.slice(2);
  assert.ok(
    args.length === 0 || (args.length === 1 && args[0] === '--write'),
    'Use no arguments to verify or --write to create new files.',
  );
  const generated = await buildDemoRecordings();
  const files = [
    ...generated.map(({ replay, descriptor }) => [
      new URL(`game/${descriptor.replayURL.slice(2)}`, root),
      replay,
    ]),
    [
      new URL('game/demo-data/catalog.json', root),
      { format: DEMO_CATALOG_VERSION, clips: generated.map(({ descriptor }) => descriptor) },
    ],
  ];
  if (args[0] === '--write') await mkdir(new URL('game/demo-data/', root), { recursive: true });
  for (const [path, document] of files) {
    if (args[0] === '--write')
      await writeFile(path, `${JSON.stringify(document, null, 2)}\n`, { flag: 'wx' });
    else
      assert.deepEqual(
        JSON.parse(await readFile(path, 'utf8')),
        document,
        `${path.pathname}: demo data is stale.`,
      );
  }
  process.stdout.write(
    `Verified ${generated.length} authored recordings across ${new Set(generated.map(({ replay }) => replay.level.id)).size} unchanged campaign levels.\n`,
  );
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
