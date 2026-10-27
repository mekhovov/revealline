import { mkdir, writeFile } from 'node:fs/promises';
import { arch, cpus, loadavg, platform, release } from 'node:os';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { computeBenchmarkIndex } from './vendor/devtools-benchmark.mjs';

// This follows DevTools' score targets and bisect method. It is a reproducible
// desktop CPU stress setting, never an emulation of an iPhone or Steam Deck.
export async function calibrateCpu(measure) {
  const samples = [];
  const sample = async (rate, purpose) => {
    rate = Math.max(1, Number(rate.toFixed(2)));
    const score = await measure(rate);
    if (!Number.isFinite(score) || score <= 0) throw new Error('Invalid calibration score.');
    samples.push({ rate, score, purpose });
    return score;
  };
  await sample(1, 'warmup');
  let baseline = await sample(1, 'baseline');
  if (baseline < 1000) baseline = await sample(1, 'baseline-retry');
  const presets = {};
  for (const [name, target] of [
    ['low', 264],
    ['mid', 1000],
  ]) {
    if (baseline < target) {
      presets[name] = { target, status: 'host-too-slow' };
      continue;
    }
    let lower = 1;
    let upper = (baseline / target) * 1.5;
    let rate = 1;
    for (let iteration = 0; iteration < 8; iteration++) {
      rate = Math.max(1, Number(((lower + upper) / 2).toFixed(2)));
      const score = await sample(rate, `${name}-search`);
      if (Math.abs(score - target) < 10) break;
      if (score < target) upper = rate;
      else lower = rate;
    }
    // Keep independent verification samples rather than assuming the final
    // search point stayed valid under changing host load.
    const verification = [];
    for (let i = 0; i < 3; i++) verification.push(await sample(rate, `${name}-verify`));
    const sorted = [...verification].sort((a, b) => a - b);
    const median = sorted[1];
    const spread = (sorted[2] - sorted[0]) / median;
    presets[name] = {
      target,
      rate,
      verification,
      median,
      spread,
      status:
        Math.abs(median - target) / target <= 0.1 && spread <= 0.2
          ? 'verified'
          : 'unstable-or-off-target',
    };
  }
  return { baseline, samples, presets };
}

async function main() {
  const output = process.argv[2];
  if (!output || !process.env.PLAYWRIGHT_MODULE)
    throw new Error(
      'Usage: PLAYWRIGHT_MODULE=<path> [CHROME_EXECUTABLE=<path>] node scripts/calibrate-solo-performance.mjs <report.json>',
    );
  const report = {
    schema: 1,
    startedAt: new Date().toISOString(),
    method:
      'DevTools benchmark with score-target bisect and three independent verification samples',
    upstreamBlob: '514aa4d4290d6967c73ccadedce3517830d231a3',
    upstreamSource:
      'https://chromium.googlesource.com/devtools/devtools-frontend/+/HEAD/front_end/panels/mobile_throttling/CalibrationController.ts',
    limits:
      'Main-thread desktop CPU stress only; GPU, memory bandwidth, OS scheduling, thermals and physical devices are not simulated.',
    host: {
      platform: platform(),
      arch: arch(),
      release: release(),
      cpu: cpus()[0]?.model,
      initialLoad: loadavg(),
    },
    result: null,
    failure: null,
  };
  await mkdir(dirname(resolve(output)), { recursive: true });
  // A rerun gets a new evidence file; never replace an earlier calibration.
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  let browser, cdp;
  try {
    const { chromium } = await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href);
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROME_EXECUTABLE,
    });
    report.browser = browser.version();
    const page = await browser.newPage();
    cdp = await page.context().newCDPSession(page);
    await page.goto('about:blank');
    // The checked-in, licensed benchmark is injected; no fetched code executes.
    await page.evaluate(
      `globalThis.soloCalibrationBenchmark = (${computeBenchmarkIndex.toString()})`,
    );
    report.result = await calibrateCpu(async (rate) => {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate });
      return page.evaluate(() => globalThis.soloCalibrationBenchmark(250));
    });
  } catch (error) {
    report.failure = error.stack ?? String(error);
    process.exitCode = 1;
  } finally {
    if (cdp) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }).catch(() => {});
    await browser?.close();
    report.host.finalLoad = loadavg();
    report.finishedAt = new Date().toISOString();
    await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await main();
