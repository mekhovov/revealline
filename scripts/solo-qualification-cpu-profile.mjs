import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, writeFile } from 'node:fs/promises';

/** A separate diagnostic recording. Never use its timings as qualification. */
export function createQualificationCpuProfile(cdp, { file, maximumMs, onLimit = () => {} }) {
  assert(Number.isInteger(maximumMs) && maximumMs > 0 && maximumMs <= 300000);
  const report = {
    status: 'not-started',
    file,
    maximumMs,
    samplingIntervalUs: 1000,
    scope:
      'Chromium main-thread CDP CPU profile, including preparation and public UI. Entire run excluded from timing gates; workers, GPU and native decoder work are not fully observed.',
  };
  let timer,
    stopPromise,
    started = false;
  const send = async (method, params) => {
    let deadline;
    try {
      return await Promise.race([
        cdp.send(method, params),
        new Promise((_, reject) => {
          deadline = setTimeout(() => reject(new Error(`${method} exceeded 10 seconds`)), 10000);
        }),
      ]);
    } finally {
      clearTimeout(deadline);
    }
  };
  const stop = (reason = 'completed') => {
    if (stopPromise) return stopPromise;
    clearTimeout(timer);
    stopPromise = (async () => {
      report.stopReason = reason;
      report.stopRequestedAt = new Date().toISOString();
      if (!started) return report;
      try {
        const { profile } = await send('Profiler.stop');
        report.profileStartTimeUs = profile.startTime;
        report.profileEndTimeUs = profile.endTime;
        report.sampleCount = profile.samples?.length ?? 0;
        report.nodeCount = profile.nodes?.length ?? 0;
        const bytes = JSON.stringify(profile) + '\n';
        assert(Buffer.byteLength(bytes) <= 64 * 1024 * 1024, 'CPU profile exceeds 64 MiB bound');
        await writeFile(file, bytes, { flag: 'wx' });
        report.bytes = Buffer.byteLength(bytes);
        report.sha256 = createHash('sha256').update(bytes).digest('hex');
        report.status = 'retained';
      } catch (error) {
        report.status = 'failed';
        report.failure = String(error.stack ?? error);
      } finally {
        report.stoppedAt = new Date().toISOString();
      }
      return report;
    })();
    return stopPromise;
  };
  return {
    report,
    async start() {
      assert.equal(report.status, 'not-started', 'CPU profile may only start once');
      try {
        try {
          await access(file);
          throw new Error('Refusing to overwrite an existing CPU profile');
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
        await send('Profiler.enable');
        await send('Profiler.setSamplingInterval', { interval: report.samplingIntervalUs });
        await send('Profiler.start');
        started = true;
        report.status = 'recording';
        report.startedAt = new Date().toISOString();
        timer = setTimeout(async () => {
          report.limitReached = true;
          await stop('profile-duration-limit');
          await onLimit();
        }, maximumMs);
        timer.unref?.();
      } catch (error) {
        report.status = 'failed';
        report.failure = String(error.stack ?? error);
        throw error;
      }
    },
    stop,
  };
}
