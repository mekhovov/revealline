#!/usr/bin/env node
/** Bounded real-browser proof of lazy Classic admission on an empty profile. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { finishQualification } from './shared-demo-browser-report.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((value) => value.replace(/^--/, '').split('=')),
);
const baseURL = args.url ?? 'http://127.0.0.1:8769';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname));
const runtime = args.runtime ?? 'playwright';
const engine = args.browser ?? 'chromium';
const reportPath = args.report ?? `.cache/classic-builtins-${engine}.json`;
const boundPaths = [
  'game/demo-modes/solo-classic-builtins.mjs',
  'game/demo-modes/solo-classic-launch.mjs',
  'game/demo-modes/solo-source-owner.mjs',
  'game/demo-modes/solo-builtins.mjs',
  'game/demo-modes/solo-catalog.mjs',
  'game/imports.mjs',
  'game/demo-sources.mjs',
  'game/replay-player.mjs',
  'game/packs.mjs',
  'game/content/mission-library-index.json',
  'game/demo-data/catalog.json',
  'scripts/qualify-classic-demo-builtins-browser.mjs',
];
const hashes = async () =>
  Object.fromEntries(
    await Promise.all(
      boundPaths.map(async (path) => [
        path,
        createHash('sha256')
          .update(await readFile(new URL(`../${path}`, import.meta.url)))
          .digest('hex'),
      ]),
    ),
  );
const report = {
  engine,
  started: new Date().toISOString(),
  checks: [],
  errors: [],
  complete: false,
  scope:
    'One isolated empty profile; metadata union plus one selected base, current and archived Classic performance. No full-catalog replay or ordinary app launch.',
};
let browser;
try {
  report.before = await hashes();
  const playwright = await import(runtime.startsWith('/') ? pathToFileURL(runtime).href : runtime);
  browser = await playwright[engine].launch({
    headless: true,
    ...(args.executable ? { executablePath: args.executable } : {}),
  });
  report.browserVersion = browser.version();
  const page = await browser.newPage();
  page.on('pageerror', (error) => report.errors.push(String(error)));
  const fixture = `${baseURL}/__classic_demo_qualification__`;
  await page.route(fixture, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }),
  );
  await page.goto(fixture);
  report.checks = await page.evaluate(async () => {
    const check = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    const keys = (sources) => [...new Set(sources.map((source) => source.levelKey))].sort();
    const storage = async () => ({
      local: { ...localStorage },
      session: { ...sessionStorage },
      databases: await globalThis.indexedDB.databases(),
    });
    const before = await storage();
    const requests = [];
    const fetcher = async (url, options) => {
      requests.push(new URL(url).pathname);
      return fetch(url, options);
    };
    const [
      { loadStandaloneSoloContext },
      { loadBuiltinSoloDemoSources, mergeBuiltinSoloDemoSources },
      { SOLO_BUILTIN_DEMO_INDEX },
      { createDemoPractice },
    ] = await Promise.all([
      import('/game/demo-modes/solo-catalog.mjs'),
      import('/game/demo-modes/solo-builtins.mjs'),
      import('/game/demo-modes/solo-builtins-index.mjs'),
      import('/game/demo-modes/solo-practice.mjs'),
    ]);
    const index = await (await fetch('/game/content/mission-library-index.json')).json();
    const authored = index.missions.filter(
      (row) =>
        ['base', 'bundled', 'archived'].includes(row.source) &&
        row.modes.includes('solo') &&
        row.difficultiesByMode.solo.includes('standard'),
    );
    const expected = [
      ...new Set([
        ...authored.map((row) => `${row.campaignKey}/${row.levelId}`),
        ...SOLO_BUILTIN_DEMO_INDEX.map((row) => row.levelKey),
      ]),
    ].sort();
    const builtin = await loadBuiltinSoloDemoSources({ fetch: fetcher });
    check(
      JSON.stringify(keys(builtin)) === JSON.stringify(expected),
      'Built-in catalog is incomplete.',
    );
    check(
      builtin.every((source) => source.entry === null),
      'Metadata retained prepared entries.',
    );
    check(
      requests.every((path) =>
        /\/(?:catalog(?:\.journey-(?:current|archive))?|mission-library-index)\.json$/.test(path),
      ),
      'Enumeration fetched a source body.',
    );
    const journey = builtin.filter((source) =>
      SOLO_BUILTIN_DEMO_INDEX.some((row) => row.id === source.id),
    );
    check(
      JSON.stringify(keys(mergeBuiltinSoloDemoSources(journey, builtin))) ===
        JSON.stringify(expected),
      'Journey entry omits Classic sources.',
    );
    const context = await loadStandaloneSoloContext({ fetch: fetcher });
    requests.length = 0;
    const crossMode = await context.loadSources({});
    check(
      JSON.stringify(keys(crossMode)) === JSON.stringify(expected),
      'Cross-mode entry omits authored sources.',
    );
    check(
      requests.every((path) => /\/catalog(?:\.journey-(?:current|archive))?\.json$/.test(path)),
      'Cross-mode enumeration fetched a body.',
    );
    const results = [
      {
        name: 'dynamic-clean-profile-union',
        levels: expected.length,
        classicLevels: authored.length,
        metadataOnly: true,
        journeyAndCrossMode: true,
      },
    ];
    for (const group of ['base', 'bundled', 'archived']) {
      const choices = builtin.filter((source) =>
        authored.some(
          (row) =>
            row.source === group &&
            row.campaignKey === source.campaignKey &&
            row.levelId === source.levelId,
        ),
      );
      // Base uses an original reviewed route to exercise its preserved admission.
      const source =
        group === 'base'
          ? choices.find((source) => !source.id.startsWith('solo-qualified-'))
          : choices.sort((a, b) => a.durationSeconds - b.durationSeconds)[0];
      check(source, `Missing ${group} performance.`);
      requests.length = 0;
      const started = performance.now();
      let player;
      try {
        player = await source.create();
        const prepareMs = performance.now() - started;
        check(source.entry?.themes?.length > 0, 'Native prepared themes missing.');
        check(source.entry.difficulty === 'standard', 'Prepared setup differs from standard.');
        const initiallyClaimed = player.state.claimedCount;
        player.play();
        player.advance(0.25);
        player.pause();
        const watchingTick = player.state.tick;
        const fork = await player.forkForPractice();
        const practice = createDemoPractice(fork.run);
        check(
          practice.state !== player.state && practice.state.tick === watchingTick,
          'Practice checkpoint is not isolated.',
        );
        practice.start({ direction: 'right' });
        practice.advance(0.1);
        practice.pause();
        check(
          practice.state.tick > watchingTick && player.state.tick === watchingTick,
          'Practice did not retain isolation.',
        );
        player.play();
        let advances = 0;
        while (player.phase === 'playing') {
          player.advance(0.25);
          check(
            ++advances <= Math.ceil(player.info.totalTicks / 30) + 2,
            'Playback exceeded recorded ticks.',
          );
        }
        check(
          player.phase === 'complete' && ['won', 'lost'].includes(player.state.status),
          'No verified natural terminal.',
        );
        check(player.state.claimedCount > initiallyClaimed, 'No meaningful captures.');
        results.push({
          name: 'native-selected-performance',
          group,
          sourceId: source.id,
          levelId: source.levelId,
          prepareMs,
          outcome: player.state.status,
          ticks: player.state.tick,
          capturedCells: player.state.claimedCount - initiallyClaimed,
          isolatedPractice: true,
          nativeImages: true,
          requests: [...requests],
        });
      } finally {
        player?.dispose();
      }
      check(source.entry === null, 'Disposed source retained prepared entry.');
    }
    check(
      JSON.stringify(await storage()) === JSON.stringify(before),
      'Demo activity changed persistence.',
    );
    results.push({
      name: 'disposal-and-persistence',
      allPreparedEntriesReleased: builtin.every((source) => source.entry === null),
      persistenceUnchanged: true,
    });
    return results;
  });
  assert.deepEqual(report.errors, []);
  report.after = await hashes();
  assert.deepEqual(
    report.after,
    report.before,
    'Bound runtime/tooling changed during qualification.',
  );
  report.complete = true;
} catch (error) {
  report.failure = String(error.stack ?? error);
} finally {
  await finishQualification({ report, reportPath, browser });
}
if (!report.complete) process.exitCode = 1;
