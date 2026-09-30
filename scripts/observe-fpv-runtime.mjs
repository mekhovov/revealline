import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { observeFrozenFPV, fpvObservationDeadline } from './fpv-observation-artifact.mjs';

export function observeFPVRuntime(options) {
  return observeFrozenFPV({
    ...options,
    kind: 'runtime',
    observerPath: 'scripts/observe-fpv-runtime.mjs',
    observe: async ({ page, report }) => {
      const errors = report.errors;
      await page.waitForTimeout(500);
      const resources = () => page.evaluate(() => globalThis.flightObservation.resources());
      const initial = await resources(),
        cycles = [];
      async function choose(index) {
        await page.getByRole('button', { name: 'Choose a drill', exact: true }).click();
        await page.locator('#course-list button').nth(index).click();
      }
      for (let i = 0; i < 20; i++) {
        await choose(i % 12);
        await page.getByRole('button', { name: 'Reset', exact: true }).click();
        await page.waitForTimeout(50);
        cycles.push({
          cycle: i + 1,
          resources: await resources(),
          nodes: await page.evaluate(() => ({
            canvases: globalThis.document.querySelectorAll('canvas').length,
            dialogs: globalThis.document.querySelectorAll('dialog').length,
          })),
        });
      }
      await choose(0);
      await page.waitForTimeout(100);
      const returned = await resources(),
        layouts = [];
      for (const [width, height] of [
        [1440, 900],
        [390, 844],
        [844, 390],
        [768, 1024],
      ]) {
        await page.setViewportSize({ width, height });
        await page.waitForTimeout(80);
        layouts.push(
          await page.evaluate(() => {
            const box = globalThis.document.querySelector('#flight-canvas').getBoundingClientRect();
            return {
              width: globalThis.innerWidth,
              height: globalThis.innerHeight,
              scrollWidth: globalThis.document.documentElement.scrollWidth,
              scrollHeight: globalThis.document.documentElement.scrollHeight,
              canvas: { x: box.x, y: box.y, width: box.width, height: box.height },
            };
          }),
        );
      }
      await page.setViewportSize({ width: 1440, height: 900 });
      await choose(11);
      await page.getByRole('button', { name: 'Watch example', exact: true }).click();
      await fpvObservationDeadline(
        page.evaluate(() => globalThis.flightObservation.settled()),
        15_000,
        'Demonstration mount',
      );
      const playbackState = () =>
        page.evaluate(() => ({
          status: globalThis.document.getElementById('status').textContent,
          height: globalThis.document.getElementById('height').textContent,
          speed: globalThis.document.getElementById('speed').textContent,
          step: globalThis.document.getElementById('step-progress').value,
        }));
      const playbackBefore = await playbackState();
      const pacing = await fpvObservationDeadline(
        page.evaluate(
          () =>
            new Promise((resolve) => {
              const frames = [],
                longTasks = [];
              let last, start;
              const observer = new globalThis.PerformanceObserver((list) => {
                longTasks.push(
                  ...list.getEntries().map(({ startTime, duration }) => ({ startTime, duration })),
                );
              });
              observer.observe({ type: 'longtask', buffered: false });
              function frame(now) {
                start ??= now;
                if (last !== undefined) frames.push(now - last);
                last = now;
                if (now - start < 8000) return globalThis.requestAnimationFrame(frame);
                longTasks.push(
                  ...observer
                    .takeRecords()
                    .map(({ startTime, duration }) => ({ startTime, duration })),
                );
                observer.disconnect();
                const sorted = [...frames].sort((a, b) => a - b);
                resolve({
                  scenario: 'final-circuit demonstrated flight, 1440 × 900, headless Chrome',
                  duration: now - start,
                  samples: frames.length,
                  p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
                  max: sorted.at(-1),
                  longTasks,
                });
              }
              globalThis.requestAnimationFrame(frame);
            }),
        ),
        15_000,
        'Frame pacing observation',
      );
      const playbackAfter = await playbackState();
      await page.getByRole('button', { name: 'Reset', exact: true }).click();
      await page.getByRole('button', { name: 'Arm / resume', exact: true }).click();
      await page.waitForTimeout(300);
      const beforeLoss = await page.evaluate(() => globalThis.flightObservation.snapshot());
      await page.evaluate(() =>
        globalThis.document
          .getElementById('flight-canvas')
          .getContext('webgl2')
          .getExtension('WEBGL_lose_context')
          .loseContext(),
      );
      await page.waitForFunction(
        () =>
          globalThis.flightObservation.snapshot().status === 'paused' &&
          globalThis.document.getElementById('flight-canvas').getContext('webgl2').isContextLost(),
      );
      const frozen = await page.evaluate(() => globalThis.flightObservation.snapshot());
      await page.waitForTimeout(200);
      const afterLoss = await page.evaluate(() => globalThis.flightObservation.snapshot());
      const disposed = await page.evaluate(() => {
        globalThis.flightObservation.dispose();
        return globalThis.flightObservation.resources();
      });
      report.procedureComplete =
        errors.length === 0 &&
        playbackBefore.status.includes('example') &&
        JSON.stringify(playbackBefore) !== JSON.stringify(playbackAfter) &&
        JSON.stringify(initial) === JSON.stringify(returned) &&
        layouts.every(
          (item) =>
            item.scrollWidth === item.width &&
            item.scrollHeight <= item.height &&
            item.canvas.width > 0 &&
            item.canvas.height > 0 &&
            item.canvas.y >= 0 &&
            item.canvas.y + item.canvas.height <= item.height &&
            item.canvas.x >= 0 &&
            item.canvas.x + item.canvas.width <= item.width,
        ) &&
        beforeLoss.status === 'active' &&
        beforeLoss.ticks > 0 &&
        afterLoss.status === 'paused' &&
        frozen.ticks === afterLoss.ticks &&
        Object.values(disposed.registered).every((value) => value === 0) &&
        disposed.renderer.contextLost;
      Object.assign(report, {
        scope:
          'Frozen admitted runtime modules in a separately hashed instrumented host, packaged-preview headers. Scoped headless timing and registered resource counts; not a matched performance baseline, physical radio, full heap-retainer, installed-app or release qualification. Three retains a shared lookup-texture accounting entry after disposal; the GL context is explicitly lost.',
        initial,
        cycles,
        returned,
        layouts,
        pacing,
        playback: { before: playbackBefore, after: playbackAfter },
        contextLoss: {
          beforeTicks: beforeLoss.ticks,
          method: 'WEBGL_lose_context.loseContext(), actual isContextLost() confirmed',
          frozenTicks: frozen.ticks,
          afterTicks: afterLoss.ticks,
          beforeStatus: beforeLoss.status,
          afterStatus: afterLoss.status,
        },
        disposed,
      });
    },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [planFile, playwrightModule, output, ...extra] = process.argv.slice(2);
  if (extra.length || !planFile || !playwrightModule || !output)
    throw new Error(
      'Usage: node scripts/observe-fpv-runtime.mjs PLAN PLAYWRIGHT_MODULE NEW_OUTPUT_DIRECTORY',
    );
  const report = await observeFPVRuntime({ planFile, playwrightModule, output });
  console.log(
    JSON.stringify({
      completed: report.completed,
      pacing: report.pacing,
      contextLoss: report.contextLoss,
      failure: report.failure,
      qualified: false,
    }),
  );
  if (!report.completed) process.exitCode = 1;
}
