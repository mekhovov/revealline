#!/usr/bin/env node
/** Exercise published adapter admission, complete playback and isolated practice
 * in an already installed browser. This never authors or modifies recordings. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const args = Object.fromEntries(
  process.argv.slice(2).map((value) => value.replace(/^--/, '').split('=')),
);
const runtime = args.runtime ?? 'playwright';
const playwright = await import(runtime.startsWith('/') ? pathToFileURL(runtime).href : runtime);
const engine = args.browser ?? 'chromium';
const modes = (args.modes ?? 'snake,survival').split(',');
assert.ok(modes.every((mode) => ['snake', 'survival'].includes(mode)));
const baseURL = args.url ?? 'http://127.0.0.1:8768';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname));
const reportPath = args.report ?? `.cache/native-demo-${engine}.json`;
const report = {
  engine,
  modes,
  started: new Date().toISOString(),
  verified: [],
  failures: [],
  complete: false,
};
const browser = await playwright[engine].launch({
  headless: true,
  ...(args.executable ? { executablePath: args.executable } : {}),
});
try {
  report.browserVersion = browser.version();
  const page = await browser.newPage();
  const fixture = `${baseURL}/__native_demo_qualification__`;
  await page.route(fixture, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }),
  );
  await page.goto(fixture);
  for (const mode of modes) {
    const sources = await page.evaluate(async (mode) => {
      const module = await import(`/game/demo-modes/${mode}.mjs`);
      const adapter =
        mode === 'snake' ? module.createSnakeDemoAdapter() : module.createSurvivalDemoAdapter();
      globalThis.qualificationAdapter = adapter;
      globalThis.qualificationSources = await adapter.enumerateSources();
      return globalThis.qualificationSources.map((source) => source.id);
    }, mode);
    for (const id of sources) {
      const result = await page.evaluate(
        async ({ mode, id }) => {
          const adapter = globalThis.qualificationAdapter;
          const source = globalThis.qualificationSources.find((value) => value.id === id);
          const start = performance.now();
          let player, practice;
          try {
            player = await source.create({ signal: new AbortController().signal });
            player.play();
            player.advance(0.25);
            player.pause();
            const before = JSON.stringify(player.state);
            const tick = player.state.tick;
            practice = adapter.createPractice(await player.forkForPractice());
            if (practice.state.tick !== tick) throw new Error('Practice checkpoint tick mismatch.');
            practice.start(mode === 'snake' ? { direction: 'right' } : { x: 1, y: 0 });
            practice.advance(0.25);
            if (practice.state.tick <= tick)
              throw new Error('Fresh practice input did not advance.');
            if (JSON.stringify(player.state) !== before)
              throw new Error('Practice changed the original player.');
            player.play();
            for (let step = 0; step < 50000 && player.phase !== 'complete'; step++)
              player.advance(0.25);
            if (player.phase !== 'complete')
              throw new Error('Playback did not reach its recorded terminal state.');
            return {
              id,
              mode,
              tick: player.state.tick,
              outcome: player.state.status ?? player.state.phase,
              loadingAndPlaybackMs: Math.round(performance.now() - start),
            };
          } catch (error) {
            return { id, mode, failure: String(error.stack ?? error), code: error.code ?? null };
          } finally {
            await practice?.dispose();
            await player?.dispose();
          }
        },
        { mode, id },
      );
      (result.failure ? report.failures : report.verified).push(result);
    }
  }
  report.complete = report.verified.length > 0 && report.failures.length === 0;
} catch (error) {
  report.error = String(error.stack ?? error);
} finally {
  await browser.close();
}
report.finished = new Date().toISOString();
await mkdir(new URL('../docs/qualification/shared-demos/', import.meta.url), { recursive: true });
await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify({
    reportPath,
    complete: report.complete,
    verified: report.verified.length,
    failures: report.failures,
  }),
);
if (!report.complete) process.exitCode = 1;
