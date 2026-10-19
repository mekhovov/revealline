#!/usr/bin/env node
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Test-only page: native simulation and renderer reuse the hosted modules without
// booting an ordinary game, creating saves, or changing player preferences.
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=')),
);
const runtime = args.runtime ?? 'playwright';
const playwright = await import(runtime.startsWith('/') ? pathToFileURL(runtime).href : runtime);
const engine = args.browser ?? 'chromium';
const baseURL = args.url ?? 'http://127.0.0.1:8768';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname));
const browser = await playwright[engine].launch({
  headless: true,
  ...(args.executable ? { executablePath: args.executable } : {}),
});
const report = {
  engine,
  all: args.all === 'true',
  started: new Date().toISOString(),
  complete: false,
};
try {
  const page = await browser.newPage();
  const fixture = `${baseURL}/__sim_demo_qualification__`;
  await page.route(fixture, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }),
  );
  await page.goto(fixture);
  Object.assign(
    report,
    await page.evaluate(async (all) => {
      const { createSimDemoAdapter } = await import('/game/demo-modes/sim.mjs');
      const { worldStateIdentity } = await import(
        '/optional-practice/civilian-fpv/world-model.mjs'
      );
      const adapter = createSimDemoAdapter();
      const sources = await adapter.enumerateSources();
      const cases = all
        ? sources
        : sources.filter((s) =>
            [
              'beginner-01',
              'beginner-53',
              'snake-hunt-loops-01',
              'native-pursuit-armor-windows',
              'adventure-coast-05',
              'flight-05',
              'warehouse-07',
            ].includes(s.levelId),
          );
      const verified = [],
        failures = [];
      for (const source of cases) {
        let player, practice;
        const start = performance.now();
        try {
          player = await source.create({ signal: new AbortController().signal });
          player.play();
          player.advance(0.2);
          player.pause();
          const checkpoint = worldStateIdentity(player.state);
          practice = adapter.createPractice(await player.forkForPractice());
          if (worldStateIdentity(practice.state) !== checkpoint)
            throw new Error('Practice prefix mismatch');
          practice.start({ input: { roll: 0.1, pitch: 0.2, yaw: 0, throttle: 0.65, actions: 0 } });
          practice.advance(0.02);
          if (practice.state.ticks !== 11 || practice.state.lastInput.throttle !== 650)
            throw new Error('Fresh practice input mismatch');
          if (worldStateIdentity(player.state) !== checkpoint)
            throw new Error('Watching state mutated by practice');
          player.play();
          while (player.phase !== 'complete') player.advance(0.25);
          verified.push({
            id: source.id,
            ticks: player.state.ticks,
            status: player.state.status,
            ms: Math.round(performance.now() - start),
          });
        } catch (error) {
          failures.push({
            id: source.id,
            code: error.code,
            message: error.message,
            tick: error.tick,
          });
        } finally {
          await practice?.dispose();
          await player?.dispose();
        }
      }
      return {
        inventory: sources.length,
        verified,
        failures,
        complete: failures.length === 0 && cases.length > 0,
      };
    }, report.all),
  );
} catch (error) {
  report.error = String(error.stack ?? error);
} finally {
  await browser.close();
}
report.finished = new Date().toISOString();
if (args.report) await writeFile(args.report, JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify({
    engine,
    all: report.all,
    inventory: report.inventory,
    verified: report.verified?.length ?? 0,
    failures: report.failures ?? [],
    error: report.error,
    complete: report.complete,
    report: args.report ?? null,
  }),
);
process.exitCode = report.complete ? 0 : 1;
