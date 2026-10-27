/** Read-only Linux browser qualification of one exact canonical emitted capture. */
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, lstat, mkdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fingerprintDemoSources } from './demo-source-fingerprint.mjs';
import { openEmittedPreview } from './emitted-preview.mjs';
import { startProductionPreview } from './serve-production-preview.mjs';
import { writeQualificationReport } from './shared-demo-browser-report.mjs';
import { snapshotReplay } from '../game/replay.mjs';
import {
  demoIdentity,
  demoInputTraceIdentity,
  validateDemoCatalog,
} from '../game/demo-catalog.mjs';

export const HOSTED_BROWSER_VERSIONS = Object.freeze({ node: 'v22.13.1', playwright: '1.62.1' });
export const HOSTED_PHASE_SECONDS = Object.freeze({ matrix: 1800, additional: 1800, offline: 600 });
export const REVIEWED_IDS = Object.freeze(['first-signal-right', 'hidden-frequency-search']);
export const SURVIVAL_FRESH_CHECKS = Object.freeze([
  'stay-retains-original-sortie',
  'same-page-standard-ready',
  'manual-start-retains-standard',
  'cross-page-standard-ready',
]);
const engines = ['chromium', 'firefox', 'webkit'];
const modes = ['sim', 'snake', 'solo', 'survival'];
const sha = (body) => createHash('sha256').update(body).digest('hex');
const declarationPath = 'docs/qualification/shared-demos/source-freeze-latest.json';
const sourceRoot = fileURLToPath(new URL('../', import.meta.url));

export function hostedArguments(values) {
  const result = {};
  const allowed = new Set([
    'head',
    'base',
    'fingerprint',
    'emitted-preview',
    'report',
    'runtime',
    'phase',
  ]);
  for (const value of values) {
    const match = /^--([^=]+)=(.+)$/.exec(value);
    assert.ok(
      match && allowed.has(match[1]) && !Object.hasOwn(result, match[1]),
      `Unsupported or repeated argument: ${value}`,
    );
    result[match[1]] = match[2];
  }
  for (const key of ['head', 'base']) assert.match(result[key] ?? '', /^[a-f0-9]{40}$/);
  assert.match(result.fingerprint ?? '', /^[a-f0-9]{64}$/);
  for (const key of ['emitted-preview', 'report', 'runtime'])
    assert.ok(result[key], `Required: ${key}`);
  assert.ok(Object.hasOwn(HOSTED_PHASE_SECONDS, result.phase));
  assert.ok(result.report.endsWith('.json'));
  assert.ok(
    path.isAbsolute(result.runtime),
    'Supply the installed Playwright index.mjs absolute path.',
  );
  return result;
}

export function hostedJobs(phase) {
  if (phase === 'additional')
    return [
      ...engines.map((engine) => ({
        id: `survival-fresh-${engine}`,
        kind: 'survival-fresh',
        engine,
        script: 'scripts/qualify-survival-fresh-browser.mjs',
        extra: [],
        seconds: 180,
      })),
      ...engines.flatMap((engine) =>
        REVIEWED_IDS.map((clipID) => ({
          id: `${clipID}-${engine}`,
          kind: 'reviewed-solo',
          engine,
          clipID,
          script: 'scripts/qualify-solo-browser.mjs',
          extra: [
            '--catalog=demo-data/catalog.json',
            '--reviewed=true',
            '--runtime-sources=true',
            `--only=${clipID}`,
          ],
          seconds: 180,
        })),
      ),
    ];
  if (phase === 'offline')
    return [
      {
        id: 'actual-worker-offline-chromium',
        kind: 'offline',
        engine: 'chromium',
        script: 'scripts/qualify-shared-demo-offline-browser.mjs',
        extra: [],
        seconds: 540,
      },
    ];
  assert.equal(phase, 'matrix');
  return [
    ...['webkit', 'chromium', 'firefox'].map((engine) => ({
      id: `restoration-${engine}`,
      kind: 'restoration',
      engine,
      script: 'scripts/qualify-demo-restoration-browser.mjs',
      extra: ['--port=8771'],
      seconds: 270,
    })),
    ...engines.map((engine) => ({
      id: `mixed-${engine}`,
      kind: 'mixed',
      engine,
      script: 'scripts/qualify-shared-demo-browser.mjs',
      extra: [
        '--practice=true',
        '--localeCheck=true',
        '--lifecycle=true',
        '--cycles=12',
        '--port=18773',
      ],
      seconds: 300,
    })),
    ...engines.map((engine) => ({
      id: `sim-fresh-${engine}`,
      kind: 'sim-fresh',
      engine,
      script: 'scripts/qualify-sim-fresh-browser.mjs',
      extra: [],
      seconds: 180,
    })),
    {
      id: 'graphics-chromium',
      kind: 'graphics',
      engine: 'chromium',
      script: 'scripts/qualify-shared-demo-browser.mjs',
      extra: ['--fault=graphics', '--port=18773'],
      seconds: 240,
    },
    {
      id: 'listeners-chromium',
      kind: 'listeners',
      engine: 'chromium',
      script: 'scripts/qualify-shared-demo-listeners.mjs',
      extra: [],
      seconds: 240,
    },
  ];
}

/** These validate existing result contracts; no failed browser result is waived. */
export function validateHostedResult(result, job, { head, base, candidates = [] } = {}) {
  assert.equal(result.complete, true);
  assert.ok(result.started && result.finished);
  for (const key of ['error', 'failure', 'bindingFailure']) assert.equal(result[key], undefined);
  if (job.kind === 'reviewed-solo') {
    assert.equal(result.engine, job.engine);
    assert.equal(result.sourceRevision, head);
    assert.equal(result.mainRevision, base);
    assert.ok(result.browserVersion);
    for (const key of ['failures', 'variants', 'performances']) assert.deepEqual(result[key], []);
    assert.equal(result.required, 1);
    assert.deepEqual(
      result.runtime.map((row) => row.id),
      [job.clipID],
    );
    const row = result.runtime[0];
    assert.equal(row.ok, true);
    assert.ok(['won', 'lost'].includes(row.outcome));
    assert.ok(Number.isInteger(row.captures) && row.captures > 0);
    assert.ok(Number.isInteger(row.capturedCells) && row.capturedCells > 0 && row.themes > 0);
    assert.ok(
      candidates.some(
        (candidate) => candidate.ticks === row.tick && candidate.outcome === row.outcome,
      ),
      'Terminal result must match a bound published candidate.',
    );
    return {
      clips: 1,
      terminalAndMeaningfulProgress: true,
      reviewedCompatibility: true,
      pageErrorsObserved: false,
      takeoverCheckedHere: false,
    };
  }
  assert.equal(result.browserCloseCompleted, true);
  assert.deepEqual(result.errors, []);
  assert.ok(Array.isArray(result.checks) && result.checks.length > 0);
  const ofType = (type) => result.checks.filter((row) => row.type === type);
  if (job.kind === 'survival-fresh') {
    assert.equal(result.engine, job.engine);
    assert.deepEqual(
      result.checks.map((row) => row.type),
      SURVIVAL_FRESH_CHECKS,
    );
  } else if (job.kind === 'mixed' || job.kind === 'graphics') {
    assert.equal(result.engine, job.engine);
    assert.deepEqual(
      ofType('native-playback')
        .map((row) => row.mode)
        .sort(),
      modes,
    );
    assert.equal(ofType('pause').length, 1);
    assert.equal(ofType('return-and-persistence').length, 1);
    if (job.kind === 'mixed') {
      for (const type of ['takeover-and-return', 'live-localization'])
        assert.deepEqual(
          ofType(type)
            .map((row) => row.mode)
            .sort(),
          modes,
        );
      assert.equal(ofType('scene-retirement').length, 12);
      assert.equal(ofType('narrow-controls').length, 1);
      if (job.engine === 'chromium')
        assert.equal(ofType('browser-freeze-resume-and-paused-intent').length, 1);
    } else assert.equal(ofType('real-webgl-loss-recovery').length, 1);
    assert.equal(result.previewClosed, true);
  } else if (job.kind === 'restoration') {
    assert.equal(result.engine, job.engine);
    assert.equal(result.strictDiagnosticGate, true);
    assert.equal(result.functionalComplete, true);
    assert.equal(result.previewClosed, true);
    assert.deepEqual(
      ofType('ordinary-control-reload')
        .map((row) => row.mode)
        .sort(),
      modes,
    );
    assert.equal(ofType('reload-from-demo').length, 8);
  } else if (job.kind === 'sim-fresh') {
    assert.equal(result.engine, job.engine);
    assert.equal(result.checks.length, 2);
    assert.ok(
      result.checks.every(
        (row) =>
          row.type === 'fresh-start-exact-authored-setup-ready-disarmed' &&
          row.savedCustomAircraftTuningUnchanged === true &&
          row.ticks === 0,
      ),
    );
  } else if (job.kind === 'listeners') {
    assert.equal(ofType('all-four-modes-warmed').length, 1);
    assert.equal(ofType('closed-baseline-comparison').length, 3);
  } else {
    assert.equal(job.kind, 'offline');
    assert.equal(result.source.expectedHead, head);
    assert.equal(result.serverClosed, true);
    assert.equal(result.bindingsStable, true);
    assert.equal(result.profile?.removed, true);
    assert.equal(result.localSession?.removed, true);
    assert.equal(result.checks.length, 11);
  }
  return { checks: result.checks.length, observedPageErrors: 0 };
}

export async function runHostedChild(argv, { timeoutMs, signal, spawnChild = spawn } = {}) {
  assert.ok(Number.isSafeInteger(timeoutMs) && timeoutMs > 0);
  signal?.throwIfAborted();
  const child = spawnChild(process.execPath, argv, {
    stdio: 'inherit',
    env: { ...process.env, NODE_DISABLE_COMPILE_CACHE: '1', SHARED_DEMO_BROWSER_SUPERVISED: '1' },
  });
  let timer;
  let abort;
  try {
    return await new Promise((resolve, reject) => {
      abort = () => reject(signal.reason ?? new Error('Qualification interrupted.'));
      signal?.addEventListener('abort', abort, { once: true });
      timer = setTimeout(
        () =>
          reject(
            new Error(
              `Child exceeded ${timeoutMs}ms; outer exact-identity supervisor must retire descendants.`,
            ),
          ),
        timeoutMs,
      );
      child.once('error', reject);
      child.once('close', (code, stoppedBy) => resolve({ code, signal: stoppedBy }));
      if (signal?.aborted) abort();
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

async function boundedJSON(filename, maximum = 16 * 1024 * 1024) {
  const info = await lstat(filename);
  assert.ok(
    info.isFile() && !info.isSymbolicLink() && info.size <= maximum,
    'Report must be a bounded regular file.',
  );
  const body = await readFile(filename);
  assert.ok(body.length <= maximum);
  return { body, value: JSON.parse(body) };
}

async function freshReport(filename, root) {
  const relative = path.relative(root, filename);
  assert.ok(relative.startsWith(`.cache${path.sep}`) && !relative.split(path.sep).includes('..'));
  await mkdir(path.dirname(filename), { recursive: true });
  assert.equal(
    await realpath(path.dirname(filename)),
    path.dirname(filename),
    'Evidence must not traverse symlinks.',
  );
  try {
    await lstat(filename);
    assert.fail(`Refusing existing evidence: ${relative}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function closePreview(preview, result) {
  result.closeCompleted = !preview;
  if (!preview) return;
  let timer;
  try {
    preview.server.closeAllConnections();
    await new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Owned preview cleanup exceeded2000ms.')), 2000);
      preview.server.close((error) => (error ? reject(error) : resolve()));
    });
    result.closeCompleted = true;
  } finally {
    clearTimeout(timer);
  }
}

async function reviewedCandidates(emitted) {
  async function sameBytes(name) {
    const source = await readFile(new URL(`../${name}`, import.meta.url));
    assert.deepEqual(
      await emitted.read(name),
      source,
      `${name}: qualifier inputs must equal emitted bytes.`,
    );
    return { body: source, pin: { path: name, bytes: source.length, sha256: sha(source) } };
  }
  const catalog = await sameBytes('game/demo-data/catalog.json');
  const clips = validateDemoCatalog(catalog.body.toString()).clips.filter((clip) =>
    REVIEWED_IDS.includes(clip.id),
  );
  assert.deepEqual(clips.map((clip) => clip.id).sort(), [...REVIEWED_IDS].sort());
  const inventory = [];
  for (const clip of clips) {
    const row = { id: clip.id, levelKey: `${clip.campaignKey}/${clip.levelId}`, candidates: [] };
    for (const candidate of [
      { ...clip },
      ...(clip.replayVariants ?? []).map((replayURL) => ({ ...clip, replayURL })),
      ...(clip.runtimePerformances ?? []).map((performance) => ({ ...clip, ...performance })),
    ]) {
      const name = `game/${candidate.replayURL.replace(/^\.\//, '')}`;
      const { body, pin } = await sameBytes(name);
      const replay = snapshotReplay(body.toString());
      assert.equal(replay.level.id, clip.levelId);
      assert.equal(demoIdentity(replay.level, replay.options.classRecipes), clip.recordingIdentity);
      assert.equal(demoInputTraceIdentity(replay), candidate.inputTraceIdentity);
      assert.equal(replay.ticks / 120, candidate.durationSeconds);
      assert.equal(replay.options.turnPolicy, candidate.turnPolicy);
      assert.ok(['won', 'lost'].includes(replay.summary.status));
      const descriptor = { ...pin, ticks: replay.ticks, outcome: replay.summary.status };
      const diagnostic = name.replace(/\.replay\.json$/, '.diagnostics.json');
      if (emitted.has(diagnostic)) descriptor.diagnostic = (await sameBytes(diagnostic)).pin;
      row.candidates.push(descriptor);
    }
    inventory.push(row);
  }
  return { catalog: catalog.pin, inventory };
}

export async function qualifyHostedBrowser(args) {
  assert.equal(
    process.env.SHARED_DEMO_HOSTED_SUPERVISED,
    '1',
    'Use the exact-owned Python supervisor.',
  );
  assert.equal(process.version, HOSTED_BROWSER_VERSIONS.node);
  assert.equal(process.platform, 'linux');
  assert.equal(process.arch, 'x64');
  const root = await realpath(process.cwd());
  assert.equal(root, await realpath(sourceRoot));
  const git = (...argv) =>
    execFileSync('git', argv, {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, GIT_NO_LAZY_FETCH: '1', GIT_OPTIONAL_LOCKS: '0' },
    }).trim();
  const reportPath = path.resolve(root, args.report);
  const reportBase = reportPath.replace(/\.json$/, '');
  const jobs = hostedJobs(args.phase).map((job) => ({
    ...job,
    reportPath: `${reportBase}.${job.id}.json`,
  }));
  for (const filename of [
    reportPath,
    ...jobs.flatMap((job) => [
      job.reportPath,
      job.reportPath.replace(/\.json$/, '.png'),
      job.reportPath.replace(/\.json$/, '-narrow.png'),
    ]),
  ])
    await freshReport(filename, root);
  const aborter = new AbortController();
  const report = {
    format: 'SharedDemoHostedBrowserV1',
    complete: false,
    phase: args.phase,
    started: new Date().toISOString(),
    head: args.head,
    base: args.base,
    expectedRuntime: args.fingerprint,
    selected: jobs.map((job) => job.id),
    jobs: [],
    bounds: { seconds: HOSTED_PHASE_SECONDS[args.phase], noRetries: true },
    limitations: [
      'Fresh Linux evidence is separate from retained macOS qualification; no earlier partial job is counted here.',
      'Existing real-UI qualifiers retain their access-credential fixture exceptions. Only the actual-worker offline scenario proves original emitted HTML and worker behavior.',
      'The two reviewed Solo clips use the unchanged narrowly scoped compatibility path, bind every candidate, and report terminal tick/outcome without identifying the selected payload. Their qualifier has no pageerror or takeover probe; the mixed UI jobs observe takeover separately.',
      'No two-hour endurance, physical controller/mobile device, audible playback or unfamiliar-human review is claimed.',
    ],
  };
  const interrupted = (signum) => {
    report.interruptedSignal ??= signum;
    report.complete = false;
    process.exitCode = 1;
    aborter.abort(new Error(`Qualification interrupted by ${signum}.`));
  };
  const handlers = new Map(
    ['SIGINT', 'SIGTERM'].map((signum) => [signum, () => interrupted(signum)]),
  );
  for (const [signum, handler] of handlers) process.on(signum, handler);
  let before;
  let toolingBefore;
  let childUnclosed = false;
  const captureDirectory = path.resolve(root, args['emitted-preview']);
  const tooling = async () => {
    const runtimePath = await realpath(args.runtime);
    const moduleRoot = path.dirname(runtimePath);
    const names = [
      runtimePath,
      path.join(moduleRoot, 'package.json'),
      path.join(moduleRoot, '../playwright-core/package.json'),
      path.join(moduleRoot, '../playwright-core/browsers.json'),
    ];
    return Promise.all(
      names.map(async (name) => ({ path: name, sha256: sha(await readFile(name)) })),
    );
  };
  const binding = async () => {
    const emitted = await openEmittedPreview(captureDirectory, { root, verifySource: true });
    // Verify every captured body, including unrequested offline payloads, at both boundaries.
    for (const file of emitted.manifest.files) await emitted.read(file.path);
    const auditName = emitted.manifest.auditReportPath;
    const names = [
      declarationPath,
      path.relative(root, path.join(captureDirectory, 'manifest.json')),
      auditName,
      auditName.replace(/\.json$/, '.inventory.json'),
      ...execFileSync('rg', ['--files', 'scripts'], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 8 * 1024 * 1024,
      })
        .trim()
        .split('\n'),
    ].sort();
    const files = await Promise.all(
      names.map(async (name) => ({
        path: name,
        sha256: sha(await readFile(path.join(root, name))),
      })),
    );
    return {
      head: git('rev-parse', 'HEAD'),
      source: emitted.sourceVerification,
      manifestSHA256: emitted.manifestSHA256,
      inventorySHA256: emitted.manifest.inventorySHA256,
      files,
    };
  };
  try {
    await writeQualificationReport(reportPath, report);
    assert.equal(git('rev-parse', 'HEAD'), args.head);
    assert.equal(
      git('status', '--porcelain', '--untracked-files=no'),
      '',
      'Tracked source must be clean.',
    );
    const declaration = JSON.parse(await readFile(declarationPath, 'utf8'));
    assert.equal(declaration.integrationBase, args.base);
    assert.equal(declaration.sourceFingerprint, args.fingerprint);
    const runtime = await fingerprintDemoSources(root);
    assert.deepEqual(runtime, {
      sha256: args.fingerprint,
      files: declaration.files,
      bytes: declaration.bytes,
    });
    const runtimePath = await realpath(args.runtime);
    const packageFile = path.join(path.dirname(runtimePath), 'package.json');
    const packageBody = await readFile(packageFile);
    const packageValue = JSON.parse(packageBody);
    assert.equal(packageValue.name, 'playwright');
    assert.equal(packageValue.version, HOSTED_BROWSER_VERSIONS.playwright);
    const corePackage = JSON.parse(
      await readFile(path.join(path.dirname(runtimePath), '../playwright-core/package.json')),
    );
    assert.equal(corePackage.name, 'playwright-core');
    assert.equal(corePackage.version, HOSTED_BROWSER_VERSIONS.playwright);
    report.toolingBefore = toolingBefore = await tooling();
    const playwright = await import(pathToFileURL(runtimePath).href);
    const executables = Object.fromEntries(
      engines.map((engine) => [engine, playwright[engine].executablePath()]),
    );
    for (const executable of Object.values(executables))
      assert.ok((await lstat(executable)).isFile());
    report.environment = {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      playwright: packageValue.version,
      runtimePath,
      packageSHA256: sha(packageBody),
      executables,
    };
    report.before = before = await binding();
    assert.equal(before.head, args.head);
    assert.equal(before.source.runtime.sha256, args.fingerprint);
    const emitted = await openEmittedPreview(captureDirectory, { root, verifySource: true });
    if (args.phase === 'additional') report.reviewed = await reviewedCandidates(emitted);
    await writeQualificationReport(reportPath, report);
    for (const job of jobs) {
      aborter.signal.throwIfAborted();
      const record = {
        id: job.id,
        kind: job.kind,
        engine: job.engine,
        reportPath: path.relative(root, job.reportPath),
        scriptSHA256: sha(await readFile(job.script)),
        started: new Date().toISOString(),
        complete: false,
      };
      report.jobs.push(record);
      let preview;
      const direct = ['mixed', 'graphics', 'restoration', 'offline'].includes(job.kind);
      try {
        if (!direct) {
          preview = await startProductionPreview({
            root,
            port: 18774,
            fixtureAccess: false,
            cache: 'revalidate',
            emittedPreview: captureDirectory,
            verifyEmittedSource: true,
          });
          assert.equal(preview.emittedPreview.sourceVerified, true);
          assert.equal(preview.emittedPreview.manifestSHA256, before.manifestSHA256);
          record.provider = {
            owner: 'phase-runner',
            fixtureAccess: preview.fixtureAccess,
            emittedPreview: preview.emittedPreview,
            closeCompleted: false,
          };
        }
        const common = [
          `--runtime=${runtimePath}`,
          `--executable=${executables[job.engine]}`,
          `--report=${job.reportPath}`,
        ];
        const extra =
          job.kind === 'offline'
            ? [
                `--head=${args.head}`,
                `--fingerprint=${args.fingerprint}`,
                `--audit=${emitted.manifest.auditReportPath}`,
              ]
            : [`--browser=${job.engine}`];
        if (job.kind === 'reviewed-solo')
          extra.push(`--source-revision=${args.head}`, `--main-revision=${args.base}`);
        if (job.kind === 'listeners') extra.push(`--fingerprint=${args.fingerprint}`);
        const provider = direct
          ? [`--emitted-preview=${args['emitted-preview']}`]
          : [`--url=${preview.url.replace(/\/$/, '')}`];
        const argv = [job.script, ...common, ...provider, ...extra, ...job.extra];
        record.command = [process.execPath, ...argv];
        await writeQualificationReport(reportPath, report);
        console.log(JSON.stringify({ phase: args.phase, job: job.id, state: 'started' }));
        childUnclosed = true;
        record.exit = await runHostedChild(argv, {
          timeoutMs: job.seconds * 1000,
          signal: aborter.signal,
        });
        childUnclosed = false;
        const { body, value } = await boundedJSON(job.reportPath);
        record.reportSHA256 = sha(body);
        record.exitObserved = new Date().toISOString();
        assert.deepEqual(record.exit, { code: 0, signal: null });
        record.coverage = validateHostedResult(value, job, {
          head: args.head,
          base: args.base,
          candidates: report.reviewed?.inventory.find((row) => row.id === job.clipID)?.candidates,
        });
        if (job.kind === 'offline') {
          assert.equal(value.capture?.manifestSHA256, before.manifestSHA256);
          assert.equal(value.capture?.inventorySHA256, before.inventorySHA256);
          assert.deepEqual(value.source.before.runtime, before.source.runtime);
          assert.deepEqual(value.source.before.buildInput, before.source.buildInput);
          assert.deepEqual(value.source.after, value.source.before);
        }
        if (direct && job.kind !== 'offline') {
          assert.equal(value.preview?.emittedPreview?.sourceVerified, true);
          assert.equal(value.preview.emittedPreview.manifestSHA256, before.manifestSHA256);
          record.provider = {
            owner: 'child-qualifier',
            emittedPreview: value.preview.emittedPreview,
            closeCompleted: value.previewClosed === true,
          };
        }
        record.complete = true;
      } finally {
        if (preview) await closePreview(preview, record.provider);
        record.finished = new Date().toISOString();
        await writeQualificationReport(reportPath, report);
      }
      console.log(
        JSON.stringify({
          phase: args.phase,
          job: job.id,
          state: 'finished',
          complete: record.complete,
          coverage: record.coverage,
        }),
      );
    }
    report.complete =
      report.jobs.length === jobs.length &&
      report.jobs.every((job) => job.complete) &&
      !aborter.signal.aborted;
  } catch (error) {
    report.complete = false;
    report.failure = String(error.stack ?? error).slice(0, 12000);
  } finally {
    try {
      report.toolingAfter = await tooling();
      assert.deepEqual(
        report.toolingAfter,
        toolingBefore,
        'Installed Playwright runtime/manifest changed.',
      );
      report.after = await binding();
      assert.deepEqual(
        report.after,
        before,
        'HEAD/source/build inputs/capture/harness changed during qualification.',
      );
      assert.equal(git('status', '--porcelain', '--untracked-files=no'), '');
      report.bindingsStable = true;
    } catch (error) {
      report.complete = false;
      report.bindingFailure = String(error.stack ?? error).slice(0, 6000);
    }
    if (aborter.signal.aborted || childUnclosed) report.complete = false;
    report.finished = new Date().toISOString();
    await writeQualificationReport(reportPath, report);
    console.log(
      JSON.stringify({
        phase: args.phase,
        report: args.report,
        complete: report.complete,
        jobs: report.jobs.length,
        failure: report.failure,
      }),
    );
    for (const [signum, handler] of handlers) process.removeListener(signum, handler);
  }
  if (childUnclosed || aborter.signal.aborted) process.exit(1); // Only the outer exact-identity owner retires descendants.
  process.exitCode = report.complete ? 0 : 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  await qualifyHostedBrowser(hostedArguments(process.argv.slice(2)));
