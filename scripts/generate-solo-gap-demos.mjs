#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { soloDemoInventory, qualifySoloPerformance } from './qualify-solo-demos.mjs';
import { prepareImprovPlayer } from '../game/demo-improv-player.mjs';
import { authorSoloTerrainDemo } from '../game/demo-modes/solo-authoring.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../game/gameplay-tuning.mjs';
const directory = new URL('../authoring/solo-demo-generated/', import.meta.url);
await mkdir(directory, { recursive: true });
const only = process.argv.find((arg) => arg.startsWith('--level='))?.slice(8);
const inventory = await soloDemoInventory();
let missing = null;
try {
  const report = JSON.parse(
    await readFile(
      new URL('../docs/qualification/solo-demo-coverage.json', import.meta.url),
      'utf8',
    ),
  );
  missing = new Set(
    report.entries.filter((entry) => !entry.qualified).map((entry) => entry.levelKey),
  );
} catch {
  /* A first authoring run may precede its qualification report. */
}
for (const target of inventory.filter((target) =>
  only
    ? only.split(',').includes(target.levelId)
    : missing
      ? missing.has(target.levelKey)
      : ['fieldcraft-01', 'homeward-01', 'workshop-01'].includes(target.levelId) ||
        target.levelId.startsWith('neon-'),
)) {
  const path = new URL(`${target.id}.json`, directory);
  try {
    const prior = JSON.parse(await readFile(path, 'utf8'));
    qualifySoloPerformance(prior.replay);
    console.log(`Verified existing ${target.levelId}`);
    continue;
  } catch {}
  let succeeded = false;
  for (const seed of [123, 987654321, 17]) {
    let player;
    try {
      const level = applyGameplayTuning(target.level, resolveGameplayTuning('standard'));
      const options = {
        seed,
        turnPolicy: 'immediate',
        classId: target.entry.classRecipes.some((recipe) => recipe.id === 'fiber')
          ? 'fiber'
          : 'scout',
        classRecipes: target.entry.classRecipes,
      };
      let replay;
      if (target.levelId.startsWith('neon-'))
        replay = await authorSoloTerrainDemo(level, options, {
          onProgress: ({ decision, captures, coverage }) => {
            if (decision % 10 === 0)
              console.log(
                `${target.levelId}/${seed}: ${captures} captures, ${Math.round(coverage * 100)}%`,
              );
          },
        });
      else {
        player = await prepareImprovPlayer(level, options, { performanceSeed: seed });
        replay = player.exportRecording();
      }
      const metrics = qualifySoloPerformance(replay);
      await writeFile(
        path,
        `${JSON.stringify({ id: target.id, levelId: target.levelId, replay, metrics })}\n`,
      );
      console.log(
        `${target.levelId}: ${metrics.outcome}, ${metrics.captures} captures, ${Math.round(metrics.seconds)}s`,
      );
      succeeded = true;
      break;
    } catch (error) {
      console.log(`${target.levelId}/${seed}: ${error.message}`);
    } finally {
      player?.dispose();
    }
  }
  if (!succeeded) process.exitCode = 1;
}
