import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { runFlightGoldenFixtures } from '../game/test/helpers/fpv-portability.mjs';

/** Explicit external test-tool path: Playwright is not shipped in the optional game.
 * Serve this checkout with production-style headers for UI/performance qualification;
 * this runner establishes numeric fixture agreement only. */
export async function verifyFlightPortability({ playwright, baseURL, output }) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const paths = [
    'optional-practice/civilian-fpv/model.mjs',
    'optional-practice/civilian-fpv/math.mjs',
    'optional-practice/civilian-fpv/rotation-table.mjs',
    'optional-practice/civilian-fpv/radio-profile.mjs',
    'optional-practice/civilian-fpv/catalogue.mjs',
    'optional-practice/civilian-fpv/demonstrations.mjs',
    'game/data-json.mjs',
    'game/test/helpers/fpv-portability.mjs',
  ];
  const sources = await Promise.all(
    paths.map(async (name) => ({
      path: name,
      sha256: createHash('sha256')
        .update(await readFile(path.join(root, name)))
        .digest('hex'),
    })),
  );
  const baseline = runFlightGoldenFixtures(),
    results = [{ runtime: 'node', version: process.version, matched: true, fixtures: baseline }];
  for (const name of ['chromium', 'firefox', 'webkit']) {
    let browser;
    try {
      browser = await playwright[name].launch({
        headless: true,
        ...(name === 'chromium' ? { channel: 'chrome' } : {}),
      });
      const page = await browser.newPage();
      await page.goto(new URL('/optional-practice/civilian-fpv/index.html', baseURL).href);
      const fixtures = await page.evaluate(async () => {
        const module = await import('/game/test/helpers/fpv-portability.mjs');
        return module.runFlightGoldenFixtures();
      });
      results.push({
        runtime: name,
        version: browser.version(),
        matched: JSON.stringify(fixtures) === JSON.stringify(baseline),
        fixtures,
      });
    } catch (error) {
      results.push({ runtime: name, matched: false, error: error.message });
    } finally {
      await browser?.close();
    }
  }
  const after = await Promise.all(
    paths.map(async (name) =>
      createHash('sha256')
        .update(await readFile(path.join(root, name)))
        .digest('hex'),
    ),
  );
  const report = {
    format: 'FlightPortabilityEvidence.v1',
    createdAt: new Date().toISOString(),
    scope:
      'Numeric golden fixtures only. No radio hardware, performance, human learning or release qualification.',
    sourceStable: sources.every((source, i) => source.sha256 === after[i]),
    sources,
    passed: results.every((item) => item.matched),
    results,
  };
  report.passed &&= report.sourceStable;
  if (output) await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  return report;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [modulePath, baseURL = 'http://127.0.0.1:8793', output = '/tmp/fpv-portability.json'] =
    process.argv.slice(2);
  if (!modulePath)
    throw new Error(
      'Usage: node scripts/verify-fpv-portability.mjs /absolute/path/to/playwright/index.mjs [base-url] [report.json]',
    );
  const playwright = await import(pathToFileURL(path.resolve(modulePath)).href),
    report = await verifyFlightPortability({ playwright, baseURL, output });
  process.stdout.write(
    JSON.stringify(
      {
        passed: report.passed,
        sourceStable: report.sourceStable,
        runtimes: report.results.map(({ runtime, version, matched, error }) => ({
          runtime,
          version,
          matched,
          error,
        })),
        output,
      },
      null,
      2,
    ) + '\n',
  );
  if (!report.passed) process.exitCode = 1;
}
