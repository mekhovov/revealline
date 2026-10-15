import { Worker } from 'node:worker_threads';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const root = pathToFileURL(process.cwd() + '/');
const { createRun } = await import(new URL('game/core/index.mjs', root));
const { applyGameplayTuning, resolveGameplayTuning } = await import(
  new URL('game/gameplay-tuning.mjs', root)
);
const pack = JSON.parse(await readFile(new URL('game/content/packs/fpv-arcade-r5.json', root)));
const run = createRun(
  applyGameplayTuning(pack.campaigns[0].levels[0], resolveGameplayTuning('standard')),
  { seed: 1, turnPolicy: 'immediate', classId: 'scout', classRecipes: pack.classRecipes },
);
const source = `import {parentPort} from 'node:worker_threads'; globalThis.postMessage=data=>parentPort.postMessage(data);globalThis.addEventListener=(type,fn)=>parentPort.on(type,data=>fn({data}));await import(${JSON.stringify(new URL('game/demo-bot-worker.mjs', root).href)});parentPort.postMessage({ready:true});`;
const start = performance.now(),
  report = {
    kind: 'worker-startup-diagnostic',
    qualification:
      'Single diagnostic without the production watchdog, not qualification or a retry of the failed audit.',
  };
const worker = new Worker(new URL('data:text/javascript,' + encodeURIComponent(source)), {
  type: 'module',
  execArgv: [],
});
let planning;
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Diagnostic limit: 15 seconds')), 15000);
    worker.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    worker.on('message', (data) => {
      if (data.ready) {
        report.startupMs = performance.now() - start;
        planning = performance.now();
        worker.postMessage({ type: 'plan', id: 1, state: run, plannerSeed: 1, decision: 0 });
      } else {
        report.planningMs = performance.now() - planning;
        report.result = {
          ok: data.result?.ok,
          reason: data.result?.reason,
          metrics: data.result?.metrics,
          error: data.error,
        };
        clearTimeout(timer);
        resolve();
      }
    });
  });
} catch (error) {
  report.error = error.message;
} finally {
  await worker.terminate();
  report.totalMs = performance.now() - start;
  await writeFile(
    new URL('docs/verification/demo-followup-2026-10-15/worker-startup-diagnostic.json', root),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report));
}
