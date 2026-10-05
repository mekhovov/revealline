#!/usr/bin/env node
/** Authored bent capture routes on unchanged installed campaign levels.
 * Default verifies assets. --write creates a catalogue; --extend adds scenes
 * and frozen variants without replacing any existing recording or input trace. */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createRun, stepRun, FIXED_DT } from '../game/core/index.mjs';
import { createRecorder, recordInput, exportReplay, verifyReplay } from '../game/replay.mjs';
import {
  DEMO_CATALOG_VERSION,
  demoDescriptor,
  demoInputTraceIdentity,
} from '../game/demo-catalog.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../game/gameplay-tuning.mjs';

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
    seed: 35,
    level: 0,
    plan: 0,
    wait: 48,
    policy: 'immediate',
    tags: ['capture', 'bent-cut', 'safe-ground'],
  },
  {
    id: 'first-signal-right',
    seed: 5,
    level: 0,
    plan: 1,
    wait: 48,
    policy: 'grid-center',
    tags: ['capture', 'bent-cut', 'safe-ground'],
  },
  {
    id: 'relay-orchard-loop',
    seed: 331,
    level: 1,
    plan: 1,
    wait: 48,
    policy: 'immediate',
    tags: ['capture', 'bent-cut', 'relay'],
  },
  {
    id: 'relay-orchard-stairs',
    seed: 322,
    level: 1,
    plan: 2,
    wait: 48,
    policy: 'grid-center',
    tags: ['capture', 'bent-cut', 'relay'],
  },
  {
    id: 'crosswind-openings',
    seed: 287,
    level: 2,
    plan: 2,
    wait: 120,
    policy: 'immediate',
    tags: ['capture', 'bent-cut', 'multiple-enemies'],
  },
  {
    id: 'night-patrol-loop',
    seed: 376,
    level: 4,
    plan: 0,
    wait: 48,
    policy: 'grid-center',
    tags: ['capture', 'bent-cut', 'border-patrol'],
  },
  {
    id: 'stone-lanes-detour',
    seed: 1,
    level: 3,
    route: [
      [24, 16, 47, 0],
      [16, 8, 0, 0],
      [40, 20, 0, 48],
    ],
    policy: 'immediate',
    tags: ['capture', 'bent-cut', 'walls', 'relay'],
  },
  {
    id: 'hidden-frequency-search',
    seed: 1,
    level: 5,
    route: [
      [24, 12, 47, 0],
      [24, 28, 47, 48],
      [16, 8, 0, 0],
      [8, 20, 47, 0],
      [16, 34, 0, 120],
    ],
    policy: 'immediate',
    tags: ['capture', 'bent-cut', 'scan', 'hidden-relay'],
  },
  {
    id: 'the-crossing-windows',
    seed: 1,
    level: 6,
    route: [
      [24, 12, 47, 0],
      [32, 16, 0, 0],
      [8, 34, 0, 0],
      [40, 24, 0, 0],
    ],
    policy: 'immediate',
    tags: ['capture', 'bent-cut', 'lane-warning'],
  },
  {
    id: 'signal-garden-route',
    seed: 1,
    level: 8,
    route: [
      [16, 20, 0, 0],
      [32, 20, 0, 0],
      [40, 8, 47, 0],
      [32, 28, 47, 120],
      [24, 28, 0, 48],
    ],
    policy: 'immediate',
    tags: ['capture', 'bent-cut', 'signal-zone', 'hidden-relay'],
  },
];

export async function buildDemoRecordings() {
  const [campaign, classRecipes, variantManifest] = await Promise.all([
    readFile(new URL('game/content/campaign.json', root), 'utf8').then(JSON.parse),
    readFile(new URL('game/content/classes.json', root), 'utf8').then(JSON.parse),
    readFile(new URL('game/demo-data/variant-provenance.json', root), 'utf8').then(JSON.parse),
  ]);
  campaign.classRecipes = classRecipes;
  const entry = { campaign, classRecipes };
  const reviewedWins = clips.map((clip) => {
    const level = applyGameplayTuning(
      campaign.levels[clip.level],
      resolveGameplayTuning('standard'),
    );
    const options = { classId: 'scout', classRecipes, seed: clip.seed, turnPolicy: clip.policy };
    const run = createRun(level, options),
      recorder = createRecorder(level, options, 'authored-attract-route.v1');
    let closedCuts = 0,
      bends = 0;
    const events = {};
    function input(command, ticks = 1) {
      for (let tick = 0; tick < ticks && run.status === 'running'; tick++) {
        assert.ok(run.tick < 120 * 90, 'Demo route exceeded its duration budget.');
        stepRun(run, command, FIXED_DT);
        recordInput(recorder, command);
        closedCuts += run.events.filter((event) => event.type === 'cut.closed').length;
        for (const event of run.events) events[event.type] = (events[event.type] ?? 0) + 1;
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
    for (const [start, depth, end, wait = clip.wait] of clip.route ?? plans[clip.plan]) {
      if (run.status !== 'running') break;
      input({ action: true });
      input({}, wait);
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
        replayVariants: variantManifest.variants
          .filter((variant) => variant.id === clip.id)
          .map((variant) => variant.replayURL),
        tags: clip.tags,
      },
      metrics: { closedCuts, bends, events },
    };
  });
  const classIds = classRecipes.map((recipe) => recipe.id);
  // Failure scenes are deliberately occasional in the full rotation. The four
  // previously uncovered late maps are included, plus two early mechanical
  // examples; reviewed wins remain the majority of the catalogue.
  // Historical scripted reversal losses remain preserved as files, but are
  // no longer generated or admitted to the unattended complete-run rotation.
  return reviewedWins;
}

const fileOperations = { readFile, writeFile, mkdir, rename, unlink };
const jsonText = (document) => `${JSON.stringify(document, null, 2)}\n`;

/** Commit metadata only after all immutable files are ready. Failed writes never
 * truncate the previous catalogue/manifest; an exact new-file orphan is retryable. */
export async function commitDemoMetadata(url, document, io = fileOperations) {
  const temporary = new URL(`${url.href}.tmp-${randomUUID()}`);
  try {
    await io.writeFile(temporary, jsonText(document), { flag: 'wx' });
    await io.rename(temporary, url);
  } finally {
    await io.unlink(temporary).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}

export async function writeDemoRecordings(
  generated,
  { mode = 'verify', gameRoot = new URL('game/', root), io = fileOperations } = {},
) {
  assert.ok(['verify', 'write', 'extend'].includes(mode));
  const catalogURL = new URL('demo-data/catalog.json', gameRoot);
  const catalog = {
    format: DEMO_CATALOG_VERSION,
    clips: generated.map(({ descriptor }) => descriptor),
  };
  const historical = new Set();
  if (mode === 'extend') {
    const previous = JSON.parse(await io.readFile(catalogURL, 'utf8'));
    assert.equal(previous.format, DEMO_CATALOG_VERSION);
    for (const [index, clip] of previous.clips.entries()) {
      historical.add(clip.id);
      const next = generated[index]?.descriptor;
      assert.ok(next, 'Extending cannot remove or reorder existing scenes.');
      const { replayVariants: before = [], ...oldIdentity } = clip;
      const { replayVariants: after = [], ...newIdentity } = next;
      assert.deepEqual(newIdentity, oldIdentity, 'Extending cannot replace a reviewed scene.');
      assert.deepEqual(after.slice(0, before.length), before, 'Extending cannot replace variants.');
    }
  }
  if (mode === 'write') {
    await io.mkdir(new URL('demo-data/', gameRoot), { recursive: true });
    for (const { replay, descriptor } of generated)
      await io.writeFile(new URL(descriptor.replayURL, gameRoot), jsonText(replay), { flag: 'wx' });
    await io.writeFile(catalogURL, jsonText(catalog), { flag: 'wx' });
    return;
  }
  const additions = [];
  // Validate every old and new file before creating any additions.
  for (const { replay, descriptor } of generated) {
    const url = new URL(descriptor.replayURL, gameRoot);
    let original;
    try {
      const text = await io.readFile(url, 'utf8');
      if (mode === 'extend' && !historical.has(descriptor.id))
        assert.equal(
          text,
          jsonText(replay),
          'An unregistered recording must exactly match the pending addition.',
        );
      original = JSON.parse(text);
    } catch (error) {
      if (mode !== 'extend' || error.code !== 'ENOENT') throw error;
      assert.ok(!historical.has(descriptor.id), `Missing historical recording: ${descriptor.id}.`);
      additions.push([url, replay]);
      original = replay;
    }
    assert.equal(demoInputTraceIdentity(original), demoInputTraceIdentity(replay));
    const alternatives = [
      original,
      ...(await Promise.all(
        (descriptor.replayVariants ?? []).map(async (url) =>
          JSON.parse(await io.readFile(new URL(url, gameRoot), 'utf8')),
        ),
      )),
    ];
    for (const candidate of alternatives)
      assert.equal(demoInputTraceIdentity(candidate), descriptor.inputTraceIdentity);
    assert.ok(
      alternatives.some((candidate) => verifyReplay(candidate).match),
      `${url.pathname}: no frozen recording exactly matches this runtime.`,
    );
  }
  if (mode === 'extend') {
    for (const [url, replay] of additions)
      await io.writeFile(url, jsonText(replay), { flag: 'wx' });
    await commitDemoMetadata(catalogURL, catalog, io);
  } else
    assert.deepEqual(
      JSON.parse(await io.readFile(catalogURL, 'utf8')),
      catalog,
      `${catalogURL.pathname}: demo data is stale.`,
    );
}

async function main() {
  const args = process.argv.slice(2);
  assert.ok(
    args.length === 0 || (args.length === 1 && ['--write', '--extend'].includes(args[0])),
    'Use no arguments to verify, --write to create, or --extend to append scenes.',
  );
  const generated = await buildDemoRecordings();
  await writeDemoRecordings(generated, { mode: args[0]?.slice(2) ?? 'verify' });
  process.stdout.write(
    `Verified ${generated.length} authored recordings across ${new Set(generated.map(({ replay }) => replay.level.id)).size} unchanged campaign levels.\n`,
  );
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
