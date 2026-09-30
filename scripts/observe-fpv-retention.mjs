import { closeSync, openSync, writeSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { observeFrozenFPV, fpvObservationDeadline } from './fpv-observation-artifact.mjs';
import { compareFlightHeaps, FPV_HEAP_LIMITS, readFlightHeap } from './analyze-fpv-heap.mjs';

export function observeFPVRetention(options) {
  return observeFrozenFPV({
    ...options,
    kind: 'retention',
    observerPath: 'scripts/observe-fpv-retention.mjs',
    authorityPaths: ['scripts/analyze-fpv-heap.mjs'],
    observe: async ({ page, output, report, json, extraCleanup }) => {
      const errors = report.errors;
      const client = await page.context().newCDPSession(page);
      extraCleanup.push(['cdp', () => client.detach()]);
      await fpvObservationDeadline(client.send('HeapProfiler.enable'), 15_000, 'Heap profiler');
      report.snapshotArtifacts = [];
      const resources = () =>
        page.evaluate(() => ({
          renderer: globalThis.flightRetention.resources(),
          connected: {
            all: globalThis.document.querySelectorAll('*').length,
            canvases: globalThis.document.querySelectorAll('canvas').length,
            dialogs: globalThis.document.querySelectorAll('dialog').length,
          },
          openDialogs: globalThis.document.querySelectorAll('dialog[open]').length,
        }));
      async function choose(index) {
        await page.getByRole('button', { name: 'Choose a drill', exact: true }).click();
        await page.locator('#course-list button').nth(index).click();
      }
      async function cycle(index) {
        await choose(index % 12);
        await page.getByRole('button', { name: 'Reset', exact: true }).click();
        await page.getByRole('button', { name: 'Radio & response', exact: true }).click();
        await page.waitForTimeout(40);
        await page.locator('[data-close="setup-dialog"]').click();
        await page.locator('#notebook-button').click();
        await page.locator('[data-close="notebook-dialog"]').click();
        await page.locator('#help').click();
        await page.locator('#studio-button').click();
        await page.getByRole('button', { name: 'Preview without earning', exact: true }).click();
        await page.waitForFunction(() => !globalThis.document.getElementById('studio-dialog').open);
        await choose(0);
        await page.getByRole('button', { name: 'Reset', exact: true }).click();
        await page.waitForTimeout(40);
        return resources();
      }
      // Warm every scene/shader and each dialog/preview before taking the baseline.
      for (let i = 0; i < 12; i++) await cycle(i);
      async function snapshot(name) {
        await fpvObservationDeadline(
          client.send('HeapProfiler.collectGarbage'),
          60_000,
          'Garbage collection',
        );
        const dom = await fpvObservationDeadline(
            client.send('Memory.getDOMCounters'),
            15_000,
            'DOM counters',
          ),
          file = path.join(output, name + '.heapsnapshot'),
          descriptor = openSync(file, 'wx'),
          captureHash = createHash('sha256');
        let bytes = 0,
          overflow = false,
          ioError = null,
          captureError = null,
          capturedBytes = 0;
        const chunk = ({ chunk: text }) => {
          bytes += Buffer.byteLength(text);
          if (bytes > FPV_HEAP_LIMITS.bytes) {
            overflow = true;
            return;
          }
          if (ioError) return;
          try {
            const data = Buffer.from(text);
            let offset = 0;
            while (offset < data.length) {
              const written = writeSync(descriptor, data, offset, data.length - offset);
              if (written <= 0) throw new Error('Incomplete heap chunk write.');
              captureHash.update(data.subarray(offset, offset + written));
              capturedBytes += written;
              offset += written;
            }
          } catch (error) {
            ioError = error;
          }
        };
        client.on('HeapProfiler.addHeapSnapshotChunk', chunk);
        try {
          await fpvObservationDeadline(
            client.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false }),
            60_000,
            'Heap snapshot',
          );
        } catch (error) {
          captureError = error;
        } finally {
          client.off('HeapProfiler.addHeapSnapshotChunk', chunk);
          try {
            closeSync(descriptor);
          } catch (error) {
            ioError ??= error;
          }
        }
        report.snapshotArtifacts.push({
          path: name + '.heapsnapshot',
          bytes: capturedBytes,
          sha256: captureHash.digest('hex'),
          complete: !overflow && !ioError && !captureError,
        });
        if (captureError) throw captureError;
        if (overflow)
          throw new Error(
            'Heap snapshot exceeds 128 MiB; truncated evidence retained, not analyzed.',
          );
        if (ioError) throw ioError;
        const analysis = await readFlightHeap(file);
        await json(name + '-analysis.json', analysis);
        return { dom, analysis };
      }
      const beforeResources = await resources(),
        before = await snapshot('before');
      const cycles = (report.cycles = []);
      for (let i = 0; i < 20; i++) cycles.push({ cycle: i + 1, resources: await cycle(i) });
      const afterResources = await resources(),
        after = await snapshot('after');
      const secondCycles = (report.secondCycles = []);
      for (let i = 20; i < 40; i++) secondCycles.push({ cycle: i + 1, resources: await cycle(i) });
      const after40Resources = await resources(),
        after40 = await snapshot('after40');
      const disposed = await page.evaluate(() => {
        globalThis.flightRetention.dispose();
        const result = globalThis.flightRetention.resources();
        delete globalThis.flightRetention;
        return result;
      });
      await page.waitForTimeout(100);
      const released = await snapshot('released');
      Object.assign(report, {
        scope:
          'Frozen admitted runtime, one headless Chrome desktop session; 12 warm cycles then 40 public scene/reset/radio/notebook/Studio-preview cycles with a separate 20-cycle checkpoint. Explicit forced GC before each heap snapshot. No wins, stored receipts, radio samples, installed PWA, natural pacing or physical-device claims.',
        viewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
        beforeResources,
        cycles,
        afterResources,
        secondCycles,
        after40Resources,
        disposed,
        snapshotFiles: {
          before: before.analysis.file,
          after: after.analysis.file,
          after40: after40.analysis.file,
          released: released.analysis.file,
        },
        domCounters: {
          before: before.dom,
          after: after.dom,
          after40: after40.dom,
          released: released.dom,
        },
        activeComparison: compareFlightHeaps(before.analysis, after.analysis),
        secondIntervalComparison: compareFlightHeaps(after.analysis, after40.analysis),
        fullComparison: compareFlightHeaps(before.analysis, after40.analysis),
        releasedComparison: compareFlightHeaps(before.analysis, released.analysis),
        procedureComplete:
          cycles.length === 20 &&
          secondCycles.length === 20 &&
          errors.length === 0 &&
          [...cycles, ...secondCycles].every((item) => item.resources.openDialogs === 0),
        limitations: [
          'Object populations and sampled strong retaining paths require interpretation; this is not an automatic leak-free pass.',
          'The retained app API is intentionally released only after dispose; static host DOM remains mounted.',
          'Three resource counters are bookkeeping and not total GPU bytes; context loss is recorded separately.',
          'Heap snapshots may retain source/fixture strings; keep raw files local. Public summaries omit their payloads.',
        ],
        sources: [
          'https://playwright.dev/docs/api/class-cdpsession',
          'https://chromedevtools.github.io/devtools-protocol/tot/HeapProfiler/',
          'https://developer.chrome.com/docs/devtools/memory-problems/heap-snapshots',
        ],
      });
    },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [planFile, playwrightModule, output, ...extra] = process.argv.slice(2);
  if (extra.length || !planFile || !playwrightModule || !output)
    throw new Error(
      'Usage: node scripts/observe-fpv-retention.mjs PLAN PLAYWRIGHT_MODULE NEW_OUTPUT_DIRECTORY',
    );
  const report = await observeFPVRetention({ planFile, playwrightModule, output });
  console.log(
    JSON.stringify({
      completed: report.completed,
      runtimeRevision: report.runtimeRevision,
      shallowByteDelta: report.activeComparison?.shallowByteDelta,
      failure: report.failure,
      qualified: false,
    }),
  );
  if (!report.completed) process.exitCode = 1;
}
