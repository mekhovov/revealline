#!/usr/bin/env node
/** Native offline authoring for exact Journey originals missing fixture proofs. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { soloJourneyDemoInventory } from './audit-solo-demo-scope.mjs';
import { qualifySoloPerformance } from './qualify-solo-demos.mjs';
import { prepareImprovPlayer } from '../game/demo-improv-player.mjs';
import { authorSoloTerrainDemo } from '../game/demo-modes/solo-authoring.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../game/gameplay-tuning.mjs';
import { demoReplayMatchesEntry } from '../game/demo-catalog.mjs';

const root = new URL('../', import.meta.url);
if (!isMainThread) {
  let player;
  try {
    const { target, seed, classId, planner } = workerData;
    const level = applyGameplayTuning(target.level, resolveGameplayTuning('standard'));
    const options = {
      seed,
      classId,
      turnPolicy: 'immediate',
      classRecipes: target.entry.classRecipes,
    };
    const replay =
      planner === 'terrain'
        ? await authorSoloTerrainDemo(level, options)
        : (player = await prepareImprovPlayer(level, options, {
            performanceSeed: seed,
          })).exportRecording();
    if (!demoReplayMatchesEntry(replay, target.entry))
      throw new Error('Recording differs from exact authored entry.');
    parentPort.postMessage({ replay, metrics: qualifySoloPerformance(replay) });
  } catch (error) {
    parentPort.postMessage({ error: error.message });
  } finally {
    player?.dispose();
  }
} else {
  const only = process.argv
    .find((arg) => arg.startsWith('--level='))
    ?.slice(8)
    .split(',');
  const onlyId = process.argv.find((arg) => arg.startsWith('--id='))?.slice(5);
  const onlyPlanner = process.argv.find((arg) => arg.startsWith('--planner='))?.slice(10);
  const improveLoss = process.argv.includes('--improve-loss');
  const reportPath =
    process.argv.find((arg) => arg.startsWith('--report='))?.slice(9) ??
    '.cache/solo-journey-planner-authoring.json';
  const inventory = await soloJourneyDemoInventory();
  const output = new URL('authoring/solo-demo-generated/', root);
  await mkdir(output, { recursive: true });
  await mkdir(new URL('.cache/', root), { recursive: true });
  const report = {
    format: 'SoloJourneyPlannerAuthoringV1',
    required: inventory.length,
    entries: [],
  };
  async function attempt(target, method) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL(import.meta.url), { workerData: { target, ...method } });
      const timeout = setTimeout(
        () => {
          void worker.terminate();
          reject(
            new Error(
              `No complete native performance within ${method.planner === 'terrain' ? 120 : 30} seconds.`,
            ),
          );
        },
        method.planner === 'terrain' ? 120000 : 30000,
      );
      function finish(error, result) {
        clearTimeout(timeout);
        void worker.terminate();
        if (error) reject(error);
        else resolve(result);
      }
      worker.once('message', (result) =>
        finish(result.error ? new Error(result.error) : null, result),
      );
      worker.once('error', (error) => finish(error));
    });
  }
  for (const target of inventory.filter(
    (entry) => (!only || only.includes(entry.levelId)) && (!onlyId || entry.id === onlyId),
  )) {
    const path = new URL(`${target.id}.json`, output);
    const row = {
      id: target.id,
      levelId: target.levelId,
      routeId: target.routeId,
      qualified: false,
      attempts: [],
    };
    try {
      const prior = JSON.parse(await readFile(path, 'utf8'));
      if (!demoReplayMatchesEntry(prior.replay, target.entry))
        throw new Error('Stale authored proof.');
      const metrics = qualifySoloPerformance(prior.replay);
      if (improveLoss && metrics.outcome === 'lost') throw new Error('Improve this loss.');
      Object.assign(row, { qualified: true, existing: true, outcome: metrics.outcome });
    } catch {}
    if (!row.qualified) {
      const methods = [
        { seed: 123, classId: 'scout', planner: 'improv' },
        ...(target.entry.classRecipes.some((recipe) => recipe.id === 'fiber')
          ? [{ seed: 123, classId: 'fiber', planner: 'improv' }]
          : []),
        { seed: 123, classId: 'scout', planner: 'terrain' },
        { seed: 987654321, classId: 'scout', planner: 'improv' },
      ];
      for (const method of methods.filter(
        (method) => !onlyPlanner || method.planner === onlyPlanner,
      )) {
        try {
          const { replay, metrics } = await attempt(target, method);
          if (
            metrics.outcome === 'lost' &&
            (metrics.captures < 3 || metrics.capturedCells < 150 || metrics.seconds < 20)
          )
            throw new Error('This loss needs a more substantial goal demonstration.');
          await writeFile(
            path,
            `${JSON.stringify({ id: target.id, levelId: target.levelId, replay, metrics })}\n`,
          );
          Object.assign(row, {
            qualified: true,
            outcome: metrics.outcome,
            captures: metrics.captures,
            ticks: metrics.ticks,
            method,
          });
          break;
        } catch (error) {
          row.attempts.push({ ...method, error: error.message });
          console.log(
            JSON.stringify({
              id: target.id,
              levelId: target.levelId,
              method,
              error: error.message,
            }),
          );
        }
      }
    }
    report.entries.push(row);
    console.log(JSON.stringify(row));
    await writeFile(new URL(reportPath, root), `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(
    JSON.stringify({
      verified: report.entries.filter((entry) => entry.qualified).length,
      required: report.entries.length,
    }),
  );
  process.exitCode = report.entries.some((entry) => !entry.qualified) ? 1 : 0;
}
