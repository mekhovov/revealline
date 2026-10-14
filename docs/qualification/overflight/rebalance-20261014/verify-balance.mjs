/** Deterministic ordinary-input balance probes, never a claim of human difficulty. */
import {
  writeFileSync,
  writeSync,
  readFileSync,
  existsSync,
  openSync,
  closeSync,
  fsyncSync,
  renameSync,
  unlinkSync,
  statfsSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import {
  createOverflightProject,
  compileOverflightProject,
} from '../../../../game/overflight/project.mjs';
import {
  createOverflightRiyProject,
  compileOverflightRiyProject,
} from '../../../../game/overflight/riy-project.mjs';
import {
  createOverflightRiy,
  stepOverflightRiy,
  overflightRiyTarget,
} from '../../../../game/overflight/riy-core.mjs';
import { createOverflightRiyMode } from '../../../../game/overflight/riy-mode.mjs';
import {
  createOverflightRun,
  startOverflight,
  stepOverflight,
  chooseOverflightUpgrade,
  overflightSummary,
} from '../../../../game/overflight/core.mjs';
import { pilot, selectCard } from '../../../../game/overflight/review-pilot.mjs';
const squadMode = createOverflightRiyMode({ selectCard });
const paths = [
  'core',
  'project',
  'tactics',
  'combat-profile',
  'upgrades',
  'riy-core',
  'riy-project',
  'riy-upgrades',
  'review-pilot',
  'riy-mode',
  'flight-profile',
  'grid',
].map((x) => `game/overflight/${x}.mjs`);
const hashes = () =>
  paths.map((path) => ({
    path,
    sha256: createHash('sha256')
      .update(readFileSync(new URL(`../../../../${path}`, import.meta.url)))
      .digest('hex'),
  }));
let evidence = {
  format: 'OverflightRebalanceReviewV1',
  date: new Date().toISOString(),
  source: hashes(),
  scope:
    'Ordinary inputs and earned cards only; draft menus always resolved, including after stopping or replacement. Automated route skill does not establish enjoyment or medal timing.',
  results: [],
};
const clone = (value, seen = new Map()) => {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);
  const out =
    value instanceof Map
      ? new Map()
      : value instanceof Set
        ? new Set()
        : ArrayBuffer.isView(value)
          ? value.slice()
          : Array.isArray(value)
            ? []
            : {};
  seen.set(value, out);
  if (value instanceof Map) for (const [k, v] of value) out.set(clone(k, seen), clone(v, seen));
  else if (value instanceof Set) for (const v of value) out.add(clone(v, seen));
  else for (const key of Object.keys(value)) out[key] = clone(value[key], seen);
  return out;
};
function drive(run, config, route = 'active', stop = Infinity) {
  const { mode, build } = config;
  const choices = [],
    samples = [];
  let input = {},
    focus = false,
    stationaryOrigin = null;
  while (!['won', 'lost'].includes(run.phase) && run.time < 450) {
    while (run.phase === 'upgrade') {
      const card = mode === 'riy' ? squadMode.selectCard(run, build) : selectCard(run, build);
      if (!card || !chooseOverflightUpgrade(run, card.id)) throw Error('Unresolved earned draft');
      choices.push({ time: run.time, id: card.id });
    }
    if (run.time >= stop && !stationaryOrigin)
      stationaryOrigin = { x: run.player.x, y: run.player.y };
    if (run.tick % 6 === 0) {
      if (!stationaryOrigin) input = pilot(run, 'tight');
      else if (route === 'none') input = {};
      else if (route === 'wall') input = { x: 1 };
      else if (route === 'tiny')
        input = { x: Math.cos(run.time * 4) * 0.2, y: Math.sin(run.time * 4) * 0.2 };
      else if (route === 'orbit')
        input = { x: Math.cos(run.time * 0.7), y: Math.sin(run.time * 0.7) };
      else input = pilot(run, 'tight');
      const target = mode === 'riy' ? overflightRiyTarget(run) : null;
      focus =
        process.env.BALANCE_FOCUS !== '0' &&
        (!stationaryOrigin || route === 'active') &&
        target &&
        (target.role !== 'common' || target.maxArmor > 0 || target.guardIntegrity > 0) &&
        run.riy.cooldown === 0;
    }
    const tick = run.tick;
    stepOverflight(run, input);
    if (mode === 'riy' && run.tick !== tick) {
      stepOverflightRiy(run, { focus });
      focus = false;
    }
    if (run.tick % 600 === 0)
      samples.push({
        time: run.time,
        x: Math.round(run.player.x),
        y: Math.round(run.player.y),
        hull: run.player.hull,
        airframes: run.airframesRemaining,
        damage: run.stats.damageTaken,
        kills: run.stats.kills,
        visible: run.stats.enemiesVisible,
      });
    if (route === 'checkpoint' && run.time >= stop) return { run, choices, samples };
  }
  return {
    config,
    route,
    stop: Number.isFinite(stop) ? stop : null,
    summary: overflightSummary(run),
    build: run.build,
    damageCauses: run.stats.damageCauses,
    shieldBlocks: run.stats.shieldBlocks,
    choices,
    samples,
  };
}
const receiptURL = new URL(process.env.BALANCE_OUTPUT ?? 'balance-smoke.json.gz', import.meta.url);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const runtimeHashes = hashes();
const harnessHash = digest(readFileSync(new URL(import.meta.url)));
const runEnvironment = {
  rulesVersion: Number(process.env.BALANCE_RULES ?? 3),
  focus: process.env.BALANCE_FOCUS !== '0',
  matrix: process.env.BALANCE_MATRIX === '1',
  mode: process.env.BALANCE_MODE ?? null,
  build: process.env.BALANCE_BUILD ?? null,
  stop: process.env.BALANCE_STOP === undefined ? null : Number(process.env.BALANCE_STOP),
  configIndices: process.env.BALANCE_CONFIG_INDICES ?? null,
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const verifyHashes = (recorded, label) => {
  for (const entry of recorded) {
    const actual = runtimeHashes.find((item) => item.path === entry.path);
    if (!actual || actual.sha256 !== entry.sha256)
      throw Error(`${label}: changed source ${entry.path}`);
  }
};
if (process.env.BALANCE_RESUME === '1') {
  if (!existsSync(receiptURL)) throw Error('Resume requested without a saved receipt.');
  const priorBytes = readFileSync(receiptURL);
  const prior = JSON.parse(gunzipSync(priorBytes));
  if (prior.format !== evidence.format || !Array.isArray(prior.results))
    throw Error('Unsupported saved receipt.');
  verifyHashes(prior.source, 'Resume start');
  verifyHashes(prior.sourceAtFinish, 'Resume finish');
  if (prior.environment && !same(prior.environment, runEnvironment))
    throw Error('Resume environment differs from the original trial.');
  let historicalHarness = null;
  const missing = runtimeHashes.filter(
    (item) => !prior.source.some((old) => old.path === item.path),
  );
  if (missing.length) {
    // The interrupted V1 receipt recorded nine runtime files. Its contemporaneous
    // named-regression manifest binds the remaining policy/flight/grid helpers.
    const manifestURL = new URL('named-regression-metadata.json', import.meta.url);
    const manifest = JSON.parse(readFileSync(manifestURL));
    for (const entry of missing) {
      const historical = manifest.sourceAfter.find((item) => item.path === entry.path);
      if (!historical || historical.sha256 !== entry.sha256)
        throw Error(`No matching historical helper hash: ${entry.path}`);
    }
    const preserved = readFileSync(
      new URL('verify-balance-named-regressions.executed.mjs', import.meta.url),
    );
    if (digest(preserved) !== manifest.harness.sha256)
      throw Error('Preserved original harness does not match its recorded hash.');
    historicalHarness = manifest.harness.sha256;
  }
  evidence = {
    ...prior,
    source: runtimeHashes,
    environment: runEnvironment,
    resumptions: [
      ...(prior.resumptions ?? []),
      {
        at: new Date().toISOString(),
        prefixSha256: digest(priorBytes),
        prefixResults: prior.results.length,
        previousSource: prior.source,
        addedHelpers: missing,
        historicalHarness,
        currentHarness: harnessHash,
      },
    ],
  };
} else evidence.environment = runEnvironment;
evidence.harnessSha256 = harnessHash;
const save = () => {
  const current = hashes();
  if (!same(current, runtimeHashes))
    throw Error('Runtime source changed during the trial; refusing to bind mixed-source results.');
  if (process.env.BALANCE_MEMORY_RECEIPT === '1' && !evidence.completedAt) return;
  const encoded = gzipSync(JSON.stringify({ ...evidence, sourceAtFinish: current }), {
    level: 9,
    mtime: 0,
  });
  if (process.env.BALANCE_MEMORY_RECEIPT === '1') {
    process.stdout.write(
      JSON.stringify({
        type: 'OverflightBalanceFullReceiptFallbackV1',
        sha256: digest(encoded),
        results: evidence.results.length,
        gzipBase64: encoded.toString('base64'),
      }) + '\n',
    );
    return;
  }
  const temporary = new URL(`${receiptURL.pathname}.tmp-${process.pid}`, receiptURL);
  let fd;
  try {
    fd = openSync(temporary, 'wx');
    writeFileSync(fd, encoded);
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    renameSync(temporary, receiptURL);
  } catch (error) {
    if (fd !== undefined) closeSync(fd);
    try {
      unlinkSync(temporary);
    } catch {}
    if (error.code !== 'ENOSPC') throw error;
    // Preserve the complete verifiable receipt through the already-open log.
    // This never replaces the last atomic file with a partial write, and is
    // recoverable data rather than an inferred reconstruction from summaries.
    const fallback = Buffer.from(
      JSON.stringify({
        type: 'OverflightBalanceFullReceiptFallbackV1',
        sha256: digest(encoded),
        results: evidence.results.length,
        gzipBase64: encoded.toString('base64'),
      }) + '\n',
    );
    let written = 0;
    while (written < fallback.length) written += writeSync(1, fallback, written);
  }
};
const configKey = (config) =>
  JSON.stringify(
    ['mode', 'build', 'encounterSet', 'difficulty', 'airframes', 'seed'].map((key) => config[key]),
  );
const resultsFor = (config) =>
  evidence.results.filter((result) => configKey(result.config) === configKey(config));
const matrix = process.env.BALANCE_MATRIX === '1';
const configs = [];
for (const mode of process.env.BALANCE_MODE ? [process.env.BALANCE_MODE] : ['survivor', 'riy'])
  for (const build of process.env.BALANCE_BUILD
    ? [process.env.BALANCE_BUILD]
    : ['fan-shield', 'echo', 'echo-shield', 'systems'])
    for (const encounterSet of matrix ? ['front', 'crossing', 'mixed'] : ['front'])
      for (const difficulty of matrix ? ['standard', 'veteran'] : ['standard']) {
        const index = configs.length;
        configs.push({
          mode,
          build,
          encounterSet,
          difficulty,
          airframes: matrix && Math.floor(index / 2) % 2 ? 1 : 3,
          seed: matrix ? [17031991, 42, 7][Math.floor(index / 2) % 3] : 17031991,
        });
      }
const selectedConfigs = process.env.BALANCE_CONFIG_INDICES
  ? process.env.BALANCE_CONFIG_INDICES.split(',').map((index) => {
      const parsed = Number(index);
      if (!Number.isInteger(parsed) || !configs[parsed]) throw Error('Invalid configuration index');
      return configs[parsed];
    })
  : configs;
if (new Set(selectedConfigs).size !== selectedConfigs.length) throw Error('Duplicate configuration index');
for (const config of selectedConfigs) {
  const checkpoint = Number(
    process.env.BALANCE_STOP ?? (matrix ? [120, 180, 240][configs.indexOf(config) % 3] : 210),
  );
  const routes = matrix ? ['active', 'none', 'tiny', 'wall', 'orbit'] : ['active', 'none'];
  const existing = resultsFor(config);
  for (const result of existing)
    if (result.stop !== checkpoint)
      throw Error('Saved checkpoint differs for a resumed configuration.');
  const early = existing.find((result) => result.route === 'checkpoint');
  if (early) {
    if (!['won', 'lost'].includes(early.summary.outcome) || early.summary.time >= checkpoint)
      throw Error('Invalid early-failure receipt.');
    console.log(JSON.stringify({ config, resume: 'complete-before-checkpoint' }));
    continue;
  }
  if (routes.every((route) => existing.some((result) => result.route === route))) {
    console.log(JSON.stringify({ config, resume: 'complete' }));
    continue;
  }
  const space = statfsSync(new URL('.', receiptURL));
  if (space.bavail * space.bsize < 4 * 1024 * 1024)
    throw Error('Less than4MiB free; receipt preserved, resume after safe cleanup.');
  const opts = { ...config, rulesVersion: Number(process.env.BALANCE_RULES ?? 3) };
  const compiled =
    config.mode === 'riy'
      ? compileOverflightRiyProject(createOverflightRiyProject(opts))
      : compileOverflightProject(createOverflightProject(opts));
  const run = createOverflightRun(compiled, { airframes: config.airframes });
  if (config.mode === 'riy') run.riy = createOverflightRiy(run);
  startOverflight(run);
  const earned = drive(run, config, 'checkpoint', checkpoint);
  if (!earned.run) {
    evidence.results.push(earned);
    save();
    console.log(
      JSON.stringify({ config, early: earned.summary.outcome, time: earned.summary.time }),
    );
    continue;
  }
  const checkpointState = {
    time: earned.run.time,
    build: clone(earned.run.build),
    hull: earned.run.player.hull,
    airframes: earned.run.airframesRemaining,
    choices: earned.run.progression.choices,
    heading: earned.run.player.heading,
  };
  for (const previous of existing) {
    if (
      !same(previous.checkpoint, checkpointState) ||
      previous.summary.projectIdentity !== compiled.projectIdentity
    )
      throw Error('Replayed checkpoint differs from the saved deterministic trial.');
  }
  for (const route of routes) {
    if (existing.some((result) => result.route === route)) continue;
    const result = drive(clone(earned.run), config, route, checkpoint);
    result.checkpoint = checkpointState;
    result.choices = [...earned.choices, ...result.choices];
    result.samples = [...earned.samples, ...result.samples];
    evidence.results.push(result);
    save();
    console.log(
      JSON.stringify({
        config,
        route,
        time: result.summary.time,
        outcome: result.summary.outcome,
        choices: result.choices,
      }),
    );
  }
}

evidence.completedAt = new Date().toISOString();
evidence.coverage = {
  configurations: selectedConfigs.length,
  configurationResults: new Set(evidence.results.map((result) => configKey(result.config))).size,
  routeResults: evidence.results.length,
  earlyFailures: evidence.results.filter((result) => result.route === 'checkpoint').length,
};
save();
