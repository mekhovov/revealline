#!/usr/bin/env node
/** Reproducible earned-build matrix and movement-policy probes. No GPU/browser. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repository = fileURLToPath(new URL('../../../../', import.meta.url));
const option = (name, fallback = null) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const suite = option('suite', 'no-pulse');
const runtimeRef = option('runtime-ref');
const output = option('output');
if (!['no-pulse', 'pulse', 'camp', 'peak'].includes(suite) || !output)
  throw new Error(
    'Use --suite=no-pulse|pulse|camp|peak --output=path [--runtime-ref=git-revision].',
  );
const runtimeFiles = [
  'package.json',
  'game/i18n/index.mjs',
  'game/i18n/catalogs.mjs',
  'game/i18n/bootstrap.mjs',
  'game/vendor/i18next-26.4.2.min.js',
  'game/data-json.mjs',
  'game/overflight/core.mjs',
  'game/overflight/grid.mjs',
  'game/overflight/project.mjs',
  'game/overflight/upgrades.mjs',
];
const policyFiles = ['game/overflight/review-pilot.mjs', 'scripts/qualify-overflight.mjs'];
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
let temporary = null;
try {
  const source = runtimeRef
    ? (temporary = mkdtempSync(join(tmpdir(), 'overflight-balance-audit-')))
    : repository;
  if (temporary)
    for (const path of [...runtimeFiles, ...policyFiles]) {
      const bytes = runtimeFiles.includes(path)
        ? execFileSync('git', ['show', `${runtimeRef}:${path}`], {
            cwd: repository,
            maxBuffer: 32 * 1024 * 1024,
          })
        : readFileSync(resolve(repository, path));
      mkdirSync(dirname(resolve(source, path)), { recursive: true });
      writeFileSync(resolve(source, path), bytes, { flag: 'wx' });
    }
  const bindings = () =>
    [...runtimeFiles, ...policyFiles].map((path) => ({
      path,
      sha256: sha(readFileSync(resolve(source, path))),
      provenance: runtimeRef && runtimeFiles.includes(path) ? `git:${runtimeRef}` : 'working-tree',
    }));
  const sourceBindings = bindings();
  const { qualifyOverflight } = await import(
    pathToFileURL(resolve(source, 'scripts/qualify-overflight.mjs'))
  );
  const directions =
    suite === 'no-pulse'
      ? ['fan-scanner', 'fan-shield', 'echo-scanner', 'echo-shield']
      : suite === 'peak'
        ? ['fan']
        : ['fan', 'echo', 'systems'];
  const seeds = suite === 'peak' ? [42] : [17031991, 42, 20261005];
  const encounterSets =
    suite === 'peak' ? ['crossing'] : suite === 'camp' ? ['front'] : ['front', 'crossing', 'mixed'];
  const airframes = suite === 'peak' ? [3] : [1, 3];
  const routes =
    suite === 'camp'
      ? [
          'park-after-pulse2',
          'tiny-circle-after-pulse2',
          'wall-after-pulse2',
          'edge-loop-after-pulse2',
        ]
      : ['tight'];
  const receipt = {
    format: 'OverflightBroaderBalanceAuditV1',
    command: `node docs/qualification/overflight/parallel-20261005/balance-audit.mjs ${process.argv.slice(2).join(' ')}`,
    startedAt: new Date().toISOString(),
    completedAt: null,
    runtimeRef: runtimeRef ?? 'working-tree',
    policySource:
      'Working-tree qualification policies are reused against both runtimes; --runtime-ref changes only simulation/compiler/shared dependencies, not decision policies.',
    sourceBindings,
    driverSha256: sha(readFileSync(fileURLToPath(import.meta.url))),
    environment: { node: process.version, platform: process.platform, architecture: process.arch },
    protocol: {
      suite,
      directions,
      seeds,
      encounterSets,
      airframes,
      routes,
      limitSeconds: 480,
      simulationHz: 60,
      inputHz: 10,
      injectedBuilds: false,
      injectedXP: false,
      injectedHP: false,
      fixtures: false,
    },
    limits: [
      'These are deterministic automated routes with full game-state access; outcomes do not establish human difficulty or enjoyment.',
      'No browser, GPU, hardware, frame-time or memory performance qualification is performed.',
      'A strict no-pulse draft with no legal preferred card after rerolls records draft-blocked; it never silently chooses pulse or a different support.',
      'Movement probes earn two pulse ranks first, then use fixed input patterns while continuing legal upgrades. They do not inject positions, invulnerability or build state.',
      'Wall-clock durations are observations of this Node process only. Completed deterministic result hashes exclude observedWallMilliseconds.',
    ],
    complete: false,
    results: [],
  };
  const outputPath = resolve(repository, output);
  mkdirSync(dirname(outputPath), { recursive: true });
  for (const seed of seeds)
    for (const encounterSet of encounterSets)
      for (const direction of directions)
        for (const count of airframes)
          for (const route of routes) {
            const { samples, ...result } = qualifyOverflight({
              seed,
              encounterSet,
              direction,
              airframes: count,
              route,
            });
            receipt.results.push(result);
            writeFileSync(outputPath, `${JSON.stringify(receipt, null, 2)}\n`);
            console.log(
              JSON.stringify({
                suite,
                seed,
                encounterSet,
                direction,
                airframes: count,
                route,
                outcome: result.outcome,
                seconds: result.simulatedSeconds,
                peak: result.peakVisible,
                above800Seconds: result.densityExposure.above800Ticks / 60,
              }),
            );
          }
  if (JSON.stringify(sourceBindings) !== JSON.stringify(bindings()))
    throw new Error('Source changed during qualification; partial evidence must not be accepted.');
  receipt.complete = true;
  receipt.completedAt = new Date().toISOString();
  receipt.deterministicResultsSha256 = sha(
    JSON.stringify(receipt.results.map(({ observedWallMilliseconds, ...result }) => result)),
  );
  writeFileSync(outputPath, `${JSON.stringify(receipt, null, 2)}\n`);
} finally {
  if (temporary) rmSync(temporary, { recursive: true, force: true });
}
