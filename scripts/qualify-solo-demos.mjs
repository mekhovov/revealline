#!/usr/bin/env node
/** Catalog-derived complete-run gate. --write authors missing public-input
 * recordings; it never changes authored levels, replay rules or terminal outcomes. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { createExecutionCatalog } from '../game/campaign-contexts.mjs';
import { campaignMetadata } from '../game/packs.mjs';
import { campaignKey } from '../game/library.mjs';
import { dataIdentity } from '../game/data-json.mjs';
import {
  demoDescriptor,
  resolveDemoCatalog,
  validateDemoCatalog,
  demoInputTraceIdentity,
} from '../game/demo-catalog.mjs';
import { createRun, stepRun, releaseInputs, FIXED_DT } from '../game/core/index.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../game/replay.mjs';
import { prepareImprovPlayer } from '../game/demo-improv-player.mjs';
import { loadDemoSources } from '../game/demo-sources.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../game/gameplay-tuning.mjs';
import { soloJourneyDemoInventory } from './audit-solo-demo-scope.mjs';
import { commitDemoMetadata } from './build-demo-recordings.mjs';

const root = new URL('../', import.meta.url);
const json = async (name) => JSON.parse(await readFile(new URL(name, root), 'utf8'));

export async function soloDemoInventory({ includeJourney = true } = {}) {
  const campaign = await json('game/content/campaign.json');
  const classes = await json('game/content/classes.json');
  const authored = [
    {
      campaign: { ...campaign, classRecipes: classes },
      classRecipes: classes,
      sourcePackId: null,
      catalogGroup: 'base',
    },
  ];
  for (const [file, catalogGroup] of [
    ['catalog.json', 'current'],
    ['archive-catalog.json', 'archive'],
  ]) {
    const catalog = await json(`game/content/packs/${file}`);
    for (const item of catalog.packs) {
      // Trusted repository input uses the same projection as native installed
      // packs, including class restrictions. Execution validation below covers
      // simulation data; authoring qualification does not decode/hash artwork.
      const pack = await json(`game/content/packs/${item.path}`);
      for (const source of pack.campaigns) {
        const { campaign, classRecipes, sourcePackId } = campaignMetadata(pack, source);
        authored.push({ campaign, classRecipes, sourcePackId, catalogGroup });
      }
    }
  }
  const classic = createExecutionCatalog(authored)
    .entries.filter((entry) => entry.difficulty === 'standard')
    .flatMap((entry) =>
      entry.campaign.levels.map((level) => ({
        id: `solo-qualified-${dataIdentity({ owner: campaignKey(entry.campaign), levelId: level.id })}`,
        modeId: 'solo',
        levelId: level.id,
        levelKey: `${campaignKey(entry.campaign)}/${level.id}`,
        variantId: 'standard',
        entry,
        level,
        catalogGroup: entry.catalogGroup,
      })),
    );
  return includeJourney ? [...classic, ...(await soloJourneyDemoInventory())] : classic;
}

/** Full verification remains native; checkpoints supplement it every five seconds. */
export function qualifySoloPerformance(replay) {
  const verified = verifyReplay(replay);
  if (!verified.match)
    throw new Error(`Replay verification failed: ${JSON.stringify(verified.diagnostics)}`);
  const run = createRun(replay.level, replay.options);
  const initiallyClaimed = run.claimedCount;
  const checkpoints = [];
  let captures = 0,
    progressEvents = 0;
  for (const segment of replay.segments) {
    if (segment.releaseBefore) releaseInputs(run);
    for (let tick = 0; tick < segment.ticks; tick++) {
      stepRun(run, segment.input, FIXED_DT);
      captures += run.events.filter((event) => event.type === 'cut.closed').length;
      progressEvents += run.events.filter((event) =>
        ['objective.completed', 'signal.completed', 'relay.activated'].includes(event.type),
      ).length;
      if (run.tick % 600 === 0)
        checkpoints.push({ tick: run.tick, ...authoritativeCheckpoint(run) });
    }
  }
  if (replay.releaseAfter) releaseInputs(run);
  if (!['won', 'lost'].includes(run.status) || !captures || run.claimedCount <= initiallyClaimed)
    throw new Error(
      'A qualifying Solo performance must finish naturally after meaningful captures.',
    );
  return {
    outcome: run.status,
    ticks: run.tick,
    seconds: run.tick * FIXED_DT,
    captures,
    capturedCells: run.claimedCount - initiallyClaimed,
    coverage: run.claimedCount / run.totalClaimable,
    progressEvents,
    diagnostics: {
      format: 'SoloDemoDiagnosticsV1',
      inputTraceIdentity: demoInputTraceIdentity(replay),
      checkpoints,
    },
  };
}

if (!isMainThread && workerData?.soloDemo) {
  try {
    const { target, seed } = workerData;
    const recipes = target.entry.classRecipes;
    const player = await prepareImprovPlayer(
      applyGameplayTuning(target.level, resolveGameplayTuning('standard')),
      {
        seed,
        turnPolicy: 'immediate',
        classId: recipes.find((recipe) => recipe.id === 'scout')?.id ?? recipes[0].id,
        classRecipes: recipes,
      },
      { performanceSeed: seed },
    );
    try {
      const replay = player.exportRecording();
      parentPort.postMessage({ replay, metrics: qualifySoloPerformance(replay) });
    } finally {
      player.dispose();
    }
  } catch (error) {
    parentPort.postMessage({ error: error.message });
  }
} else if (isMainThread && process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const importGenerated = args.includes('--import-generated');
  const importOnly = args.includes('--import-only');
  const missingOnly = args.includes('--missing-only');
  const excludedIds = new Set(
    (args.find((arg) => arg.startsWith('--exclude='))?.slice(10) ?? '').split(','),
  );
  const onlyLevel = args.find((arg) => arg.startsWith('--level='))?.slice(8);
  const group = args.find((arg) => arg.startsWith('--group='))?.slice(8);
  const timeoutMs = Number(args.find((arg) => arg.startsWith('--timeout-ms='))?.slice(13) ?? 15000);
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120000)
    throw new Error('Use a generation timeout of 1000..120000 milliseconds.');
  const inventory = await soloDemoInventory();
  let selected = inventory.filter(
    (target) =>
      !excludedIds.has(target.id) &&
      (!onlyLevel || target.levelId === onlyLevel) &&
      (!group || target.catalogGroup === group),
  );
  const catalogs = new Map();
  const catalogPath = (target) =>
    `game/demo-data/${target.catalogGroup.startsWith('journey-') ? `catalog.${target.catalogGroup}` : 'catalog'}.json`;
  for (const target of selected) {
    const path = catalogPath(target);
    if (catalogs.has(path)) continue;
    let catalog;
    try {
      catalog = await json(path);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      catalog = { format: 'revealline-demo-catalog.v1', clips: [] };
    }
    catalogs.set(path, validateDemoCatalog(catalog));
  }
  if (missingOnly)
    selected = selected.filter(
      (target) =>
        !resolveDemoCatalog(catalogs.get(catalogPath(target)), [target.entry]).some(
          (clip) => clip.levelId === target.levelId,
        ),
    );
  const report = {
    format: 'SoloDemoCoverageV1',
    required: inventory.length,
    groups: {},
    entries: [],
    passed: false,
  };
  for (const target of inventory)
    report.groups[target.catalogGroup] = (report.groups[target.catalogGroup] ?? 0) + 1;
  async function generate(target, seed) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL(import.meta.url), {
        workerData: { soloDemo: true, target, seed },
      });
      const timer = setTimeout(() => {
        void worker.terminate();
        reject(new Error(`No complete performance within ${timeoutMs}ms preparation budget.`));
      }, timeoutMs);
      const finish = (error, result) => {
        clearTimeout(timer);
        void worker.terminate();
        error ? reject(error) : resolve(result);
      };
      worker.once('message', (result) =>
        finish(result.error ? new Error(result.error) : null, result),
      );
      worker.once('error', (error) => finish(error));
    });
  }
  for (const target of selected) {
    const catalog = catalogs.get(catalogPath(target));
    const entry = {
      id: target.id,
      levelId: target.levelId,
      levelKey: target.levelKey,
      catalogGroup: target.catalogGroup,
      qualified: false,
      attempts: [],
    };
    let replay, metrics, descriptor;
    const existing = resolveDemoCatalog(catalog, [target.entry]).filter(
      (clip) => clip.levelId === target.levelId,
    );
    const runtimeSources = write
      ? null
      : await loadDemoSources({
          entries: [target.entry],
          catalogs: [catalog],
          library: { list: async () => [] },
          WorkerClass: null,
          engineHint: null,
          fetch: async (url) => ({ ok: true, text: () => readFile(url, 'utf8') }),
        });
    for (const clip of existing) {
      let player;
      try {
        if (write) replay = await json(`game/${clip.replayURL.replace(/^\.\//, '')}`);
        else {
          const source = runtimeSources.find((source) => source.id === clip.id);
          if (!source) throw new Error('No admitted source for the authored catalog entry.');
          player = await source.create({});
          replay = player.exportRecording();
        }
        metrics = qualifySoloPerformance(replay);
        descriptor = clip;
        break;
      } catch (error) {
        entry.attempts.push({ sourceId: clip.id, error: error.message });
      } finally {
        await player?.dispose();
      }
    }
    if (!metrics && write) {
      // The same ordinary improvisation planner used at runtime. No forced outcome.
      for (const seed of [
        ...(importGenerated || importOnly ? ['authored'] : []),
        ...(importOnly ? [] : [123, 987654321]),
      ]) {
        try {
          if (seed === 'authored') {
            const generated = await json(`authoring/solo-demo-generated/${target.id}.json`);
            if (generated.id !== target.id || generated.levelId !== target.levelId)
              throw new Error('Authored demonstration does not match this inventory entry.');
            replay = generated.replay;
            // Recompute all evidence; imported metrics are never trusted.
            metrics = qualifySoloPerformance(replay);
          } else ({ replay, metrics } = await generate(target, seed));
          descriptor = {
            ...demoDescriptor(replay, target.entry, { id: target.id }),
            replayURL: `./demo-data/${target.id}.replay.json`,
          };
          await writeFile(
            new URL(`game/demo-data/${target.id}.replay.json`, root),
            `${JSON.stringify(replay)}\n`,
          );
          await writeFile(
            new URL(`game/demo-data/${target.id}.diagnostics.json`, root),
            `${JSON.stringify(metrics.diagnostics)}\n`,
          );
          catalog.clips.push(descriptor);
          validateDemoCatalog(catalog);
          await commitDemoMetadata(new URL(catalogPath(target), root), catalog);
          break;
        } catch (error) {
          replay = metrics = descriptor = undefined;
          entry.attempts.push({ seed, error: error.message });
        }
      }
    }
    if (metrics) {
      const { diagnostics, ...summary } = metrics;
      Object.assign(entry, summary, {
        sourceId: descriptor.id,
        qualified: true,
        diagnosticCheckpoints: diagnostics.checkpoints.length,
      });
      console.log(
        `Qualified ${target.catalogGroup}/${target.levelId}: ${summary.outcome}, ${summary.captures} captures, ${Math.round(summary.seconds)}s`,
      );
    } else
      console.log(
        `Missing ${target.catalogGroup}/${target.levelId}: ${entry.attempts.at(-1)?.error ?? 'No verified recording'}`,
      );
    report.entries.push(entry);
    report.passed =
      selected.length === inventory.length &&
      report.entries.length === inventory.length &&
      report.entries.every((item) => item.qualified);
    await mkdir(new URL('docs/qualification/', root), { recursive: true });
    await writeFile(
      new URL(
        `docs/qualification/solo-demo-coverage${missingOnly ? '-additions' : ''}${group ? `-${group}` : ''}${onlyLevel ? `-${onlyLevel}` : ''}.json`,
        root,
      ),
      `${JSON.stringify(report, null, 2)}\n`,
    );
  }
  console.log(
    `${report.entries.filter((entry) => entry.qualified).length}/${selected.length} selected; ${inventory.length} required across ${JSON.stringify(report.groups)}.`,
  );
  if (report.entries.some((entry) => !entry.qualified)) process.exitCode = 1;
}
