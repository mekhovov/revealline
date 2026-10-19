import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { preparePack } from '../packs.mjs';
import { inspectImageDataUrl } from '../content.mjs';
import { soloPage } from './helpers/solo-dom.mjs';
import { installedAssets, open } from './mission-library-solo-fixture.mjs';

// Diagnostic only: the existing production query owns its own stage clocks.
// and stage stamps. This fixture adds no timers, frames or opening gates.
test('cold installed Custom Browse reports its existing public opening stages', async (t) => {
  const source = JSON.parse(
    await readFile(new URL('../content/packs/night-shift.json', import.meta.url), 'utf8'),
  );
  source.id = 'library-custom-host';
  const second = structuredClone(source.campaigns[0]);
  second.id = 'custom-second';
  second.levels.forEach((level, index) => {
    level.id = `custom-second-${index}`;
  });
  source.campaigns.push(second);
  const { pack } = await preparePack(source, {
    decodeImage: async (dataUrl) => {
      const image = inspectImageDataUrl(dataUrl);
      return { naturalWidth: image.width, naturalHeight: image.height };
    },
  });
  const assets = await installedAssets(pack);
  const prefix = 'RevealLineMissionsStageV1 ',
    stageLogs = [],
    stageMetrics = [],
    originalDebug = console.debug;
  let metricOrigin = null,
    stageBytes = 0,
    droppedStages = 0,
    observationErrors = 0;
  const observedDebug = function (...args) {
    try {
      const line = args[0];
      if (typeof line === 'string' && line.startsWith(prefix)) {
        const bytes = Buffer.byteLength(line, 'utf8');
        if (stageLogs.length < 64 && bytes <= 512 && stageBytes + bytes <= 8192) {
          stageLogs.push(line);
          stageBytes += bytes;
          // Cumulative process measurements, aligned to this retained stage index.
          // CPU includes GC and other process work; it is not exclusive owner CPU.
          const wallNs = process.hrtime.bigint(),
            cpu = process.cpuUsage();
          metricOrigin ??= { wallNs, cpu };
          const elapsedWallMs = Math.round(Number(wallNs - metricOrigin.wallNs) / 1000) / 1000,
            userCpuUs = cpu.user - metricOrigin.cpu.user,
            systemCpuUs = cpu.system - metricOrigin.cpu.system;
          if (
            stageMetrics.length < 64 &&
            Number.isFinite(elapsedWallMs) &&
            elapsedWallMs >= 0 &&
            Number.isFinite(userCpuUs) &&
            userCpuUs >= 0 &&
            Number.isFinite(systemCpuUs) &&
            systemCpuUs >= 0
          ) {
            stageMetrics.push([stageLogs.length - 1, elapsedWallMs, userCpuUs, systemCpuUs]);
          } else observationErrors++;
        } else droppedStages++;
      }
    } catch {
      observationErrors++;
    }
    return originalDebug.apply(this, args);
  };
  try {
    console.debug = observedDebug;
    const page = await soloPage(t, {
      titleScreen: true,
      assetIndexedDB: assets.indexedDB,
      search: '?journey=legacy&performance=1',
    });
    // The shared helper retains the REAL native Browse click and exact15s wait.
    await open(page);
    assert.equal(page.$('journey-chooser').open, true);
    assert.ok(page.$('journey-collection'));
    assert.equal(
      stageLogs.some((line) => line.includes('"missions-complete"')),
      true,
    );
    assert.equal(droppedStages, 0);
    assert.equal(observationErrors, 0);
    assert.deepEqual(page.errors, []);
  } catch (error) {
    try {
      const evidence = JSON.stringify({
        format: 'mission-library-public-stage-probe.v1',
        stageLogs,
        stageMetrics,
        stageBytes,
        droppedStages,
        observationErrors,
      });
      if (typeof error?.message === 'string' && Buffer.byteLength(evidence, 'utf8') <= 12288) {
        void error.stack;
        error.message += `\n${evidence}`;
      }
    } catch {
      // Keep the original failure authoritative even if observation fails.
    }
    throw error;
  } finally {
    if (console.debug === observedDebug) console.debug = originalDebug;
  }
});
