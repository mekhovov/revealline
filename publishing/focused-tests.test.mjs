import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFile, writeFile, mkdtemp, mkdir, rm, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  focusedCommandExecutionPlan,
  applyFocusedTestPolicy,
  parseFocusedShard,
  focusedCommandShard,
  assertFocusedShardCoverage,
  focusedTestPlan,
  loadFocusedExecutionInputs,
  packageScriptShellSemantics,
  runFocusedCommands,
  runFocusedCommandsParallel,
} from './focused-tests.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(await readFile(path.join(directory, 'focused-test-map.json'), 'utf8'));

test('bounded stack tooling selects every stack regression without hiding test registration', () => {
  for (const changed of [
    ...['contract', 'source', 'packet', 'measurement', 'artifacts', 'e2e'].flatMap((kind) => [
      `scripts/pages-stack-${kind}.mjs`,
      `scripts/test-pages-stack-${kind}.mjs`,
    ]),
    '.github/workflows/measure-pages-stack.yml',
    'scripts/pages-stack-artifact.py',
  ]) {
    const plan = focusedTestPlan([changed], manifest);
    assert.deepEqual(plan.unknownRuntime, []);
    const command = plan.commands.find(({ id }) => id === 'publishing-controller');
    assert.ok(command, 'Stack tooling must select publishing verification');
    for (const kind of ['contract', 'source', 'packet', 'measurement', 'artifacts', 'e2e'])
      assert.ok(command.args.includes(`scripts/test-pages-stack-${kind}.mjs`));
  }
});

test('candidate measurement tooling always selects its security and archive regressions', () => {
  for (const changed of [
    'scripts/pages-candidate-measurement.mjs',
    'scripts/pages-candidate-contract.mjs',
    'scripts/pages-candidate-overlay.mjs',
    'scripts/pages-candidate-archive.py',
    'scripts/pages-candidate-stack.mjs',
    'scripts/test-pages-candidate-stack.mjs',
    '.github/workflows/measure-pages-candidate.yml',
  ]) {
    const plan = focusedTestPlan([changed], manifest);
    assert.deepEqual(plan.unknownRuntime, []);
    const command = plan.commands.find(({ id }) => id === 'publishing-controller');
    for (const kind of ['measurement', 'contract', 'overlay', 'archive', 'stack'])
      assert.ok(command.args.includes(`scripts/test-pages-candidate-${kind}.mjs`));
  }
});

test('capacity comparison tooling selects its regression suite without broad runtime fallback', () => {
  for (const changed of [
    'scripts/pages-capacity-report.mjs',
    'scripts/test-pages-capacity-report.mjs',
  ]) {
    const plan = focusedTestPlan([changed], manifest);
    assert.deepEqual(plan.unknownRuntime, []);
    const command = plan.commands.find(({ id }) => id === 'publishing-controller');
    assert.ok(command.args.includes('scripts/test-pages-capacity-report.mjs'));
  }
});

test('shared Pages evidence scripts retain their publishing regression gates', () => {
  for (const kind of ['capacity', 'archive']) {
    const plan = focusedTestPlan([`scripts/pages-${kind}-evidence.py`], manifest);
    assert.deepEqual(plan.unknownRuntime, []);
    const command = plan.commands.find(({ id }) => id === 'publishing-controller');
    assert.ok(command.args.includes(`scripts/test-pages-${kind}-evidence.mjs`));
  }
});

test('rolling metadata scripts retain their publishing regression gates', () => {
  for (const changed of [
    'scripts/write-main-pages-metadata.mjs',
    'scripts/test-main-pages-metadata.mjs',
  ]) {
    const plan = focusedTestPlan([changed], manifest);
    assert.deepEqual(plan.unknownRuntime, []);
    const command = plan.commands.find(({ id }) => id === 'publishing-controller');
    assert.ok(command.args.includes('scripts/test-main-pages-metadata.mjs'));
  }
});

test('the real company package script exposes all tests to exact focused deduplication', async () => {
  const { scripts } = JSON.parse(await readFile(path.join(directory, '../package.json'), 'utf8'));
  const prefix = 'node --test ';
  assert.ok(scripts['company:test'].startsWith(prefix));
  const patterns = scripts['company:test'].slice(prefix.length).trim().split(/\s+/u);
  assert.ok(patterns.every((pattern) => /^[a-z0-9_./*-]+\.mjs$/iu.test(pattern)));
  const showcase = 'game/test/showcase-studio-playthrough.test.mjs';
  assert.ok(patterns.includes(showcase));
  assert.equal(scripts['company:showcase:test'], prefix + showcase);
  const commands = [
    { id: 'company', command: 'npm', args: ['run', 'company:test'] },
    { id: 'showcase', command: 'node', args: ['--test', showcase] },
    { id: 'unrelated', command: 'node', args: ['--test', 'game/test/unrelated.test.mjs'] },
  ];
  // Complete synthetic glob inventory: no file execution is claimed here.
  const execution = focusedCommandExecutionPlan(commands, {
    packageScripts: scripts,
    repositoryFiles: patterns.map((pattern) => pattern.replaceAll('*', 'example')),
    shellSemantics: 'posix',
  });
  assert.deepEqual(execution.diagnostics, []);
  assert.deepEqual(
    execution.commands.map(({ id }) => id),
    ['company', 'unrelated'],
  );
  assert.deepEqual(
    execution.deduplicated.map(({ testFile }) => testFile),
    [showcase],
  );
  assert.equal(execution.packageCoverage[0].tests.length, new Set(patterns).size);
});

test('ownership inventory changes select route coverage and artwork screening regressions', () => {
  const plan = focusedTestPlan(
    ['scripts/content-inventory.mjs', 'game/content-design/content-lifecycle.mjs'],
    manifest,
  );
  assert.deepEqual(plan.categories, ['content-inventory']);
  assert.deepEqual(plan.unknownRuntime, []);
  assert.deepEqual(
    plan.commands.map(({ id }) => id),
    ['content-inventory'],
  );
  assert.ok(plan.commands[0].args.includes('game/test/content-lifecycle.test.mjs'));
  assert.ok(plan.commands[0].args.includes('game/test/artwork-screening.test.mjs'));
});

test('combined company screening selects exact-copy, ownership and strict-review regressions', () => {
  const plan = focusedTestPlan(['scripts/company-artwork-screening.mjs'], manifest);
  assert.deepEqual(plan.categories, ['content-inventory']);
  assert.deepEqual(plan.unknownRuntime, []);
  assert.ok(plan.commands[0].args.includes('scripts/test-company-artwork-screening.mjs'));
});

test('company ownership reports select retained identity and profile preservation checks', () => {
  const plan = focusedTestPlan(['scripts/company-content-inventory.mjs'], manifest);
  assert.ok(plan.categories.includes('company-content-inventory'));
  assert.deepEqual(plan.unknownRuntime, []);
  const command = plan.commands.find(({ id }) => id === 'company-content-inventory');
  assert.ok(command.args.includes('scripts/test-company-content-inventory.mjs'));
  assert.ok(command.args.includes('game/test/edition-retained-presentation.test.mjs'));
  assert.ok(command.args.includes('game/test/edition-profile-compatibility.test.mjs'));
});

test('published size reports select metadata integrity and cache-owner measurement checks', () => {
  const plan = focusedTestPlan(['scripts/report-published-offline-packages.mjs'], manifest);
  assert.ok(plan.categories.includes('offline-package-measurements'));
  assert.deepEqual(plan.unknownRuntime, []);
  const command = plan.commands.find(({ id }) => id === 'offline-package-measurements');
  assert.ok(command.args.includes('scripts/test-report-published-offline-packages.mjs'));
  assert.ok(command.args.includes('scripts/test-report-offline-packages.mjs'));
});

test('official download changes require ownership recovery and gameplay-admission checks', () => {
  for (const file of ['game/official-downloads.mjs', 'game/test/official-downloads.test.mjs']) {
    const plan = focusedTestPlan([file], manifest);
    assert.deepEqual(plan.unknownRuntime, []);
    const command = plan.commands.find(({ id }) => id === 'official-download-retention');
    assert.ok(command);
    for (const required of [
      'game/test/official-downloads.test.mjs',
      'game/test/offline-download-access.test.mjs',
      'game/test/offline-team-retention-host.test.mjs',
    ])
      assert.ok(command.args.includes(required));
  }
});

test('online play changes retain optional-offline and published host coverage', () => {
  for (const file of [
    'game/offline-download-access.mjs',
    'game/offline/service-worker.template.js',
    'game/ui/company-startup.mjs',
  ]) {
    const plan = focusedTestPlan([file], manifest);
    const command = plan.commands.find(({ id }) => id === 'optional-offline-play');
    assert.ok(command);
    assert.ok(command.args.includes('game/test/published-solo-entry-host.test.mjs'));
    assert.ok(command.args.includes('game/test/optional-offline-access.test.mjs'));
  }
});

test('localization and offline paths select only their bounded gates', () => {
  const plan = focusedTestPlan(['game/localization/en.json', 'game/offline/install.mjs'], manifest);
  assert.deepEqual(plan.categories, ['localization', 'offline']);
  assert.equal(plan.unknownRuntime.length, 0);
  assert.deepEqual(
    plan.commands.map(({ id }) => id),
    ['i18n-check', 'localization-runtime', 'offline-runtime'],
  );
});

test('unknown runtime paths fail closed through validate', () => {
  const plan = focusedTestPlan(['game/new-player-runtime.mjs'], manifest);
  assert.deepEqual(plan.categories, []);
  assert.deepEqual(plan.unknownRuntime, ['game/new-player-runtime.mjs']);
  assert.deepEqual(
    plan.commands.map(({ id }) => id),
    ['unknown-runtime-validate'],
  );
});

test('release roots delegate unknown-runtime validation to their required exact-head build', () => {
  const plan = focusedTestPlan(['game/new-player-runtime.mjs'], manifest, {
    fallbackHandled: true,
  });
  assert.deepEqual(plan.categories, []);
  assert.deepEqual(plan.unknownRuntime, ['game/new-player-runtime.mjs']);
  assert.deepEqual(plan.commands, []);
});

test('Team picture authority changes avoid the broad navigation matrix', () => {
  const plan = focusedTestPlan(
    [
      'game/couch/coop-picture-bindings.mjs',
      'game/couch/coop-presentation.mjs',
      'game/test/coop-historical-import-picture.test.mjs',
      'game/test/coop-picture-bindings.test.mjs',
      'game/test/coop-reviewed-successor-picture.test.mjs',
      'package.json',
      'package-lock.json',
      'game/build-config.json',
    ],
    manifest,
  );
  assert.deepEqual(plan.categories, ['team-picture-bindings']);
  assert.deepEqual(plan.unknownRuntime.sort(), [
    'game/build-config.json',
    'package-lock.json',
    'package.json',
  ]);
  assert.deepEqual(
    plan.commands.map(({ id }) => id),
    ['team-picture-bindings', 'unknown-runtime-validate'],
  );
});

test('other Team runtime paths retain the navigation gate', () => {
  const plan = focusedTestPlan(['game/couch/relay-rescue.mjs'], manifest);
  assert.deepEqual(plan.categories, ['localization', 'player-navigation-team']);
  assert.deepEqual(plan.unknownRuntime, []);
  assert.equal(plan.commands.find(({ id }) => id === 'player-navigation-team')?.timeoutMs, 1200000);
});

test('Solo result-continuation coverage runs directly without the unrelated Team navigation bundle', () => {
  const file = 'game/test/solo-result-continuation-host.test.mjs';
  const plan = focusedTestPlan([file], manifest);
  assert.ok(!plan.categories.includes('player-navigation-team'));
  assert.deepEqual(
    plan.commands.map(({ id }) => id),
    ['unknown-runtime-validate', `changed-test:${file}`],
  );
});

test('Versus runtime changes retain native controller Start ownership coverage once', () => {
  const file = 'game/test/mission-library-controller-host.test.mjs';
  const plan = focusedTestPlan(['game/couch/couch.mjs', file], manifest);
  const command = plan.commands.find(({ id }) => id === 'player-navigation-team');
  assert.ok(command.args.includes(file));
  assert.equal(plan.commands.filter(({ args }) => args.includes(file)).length, 1);
});

test('documentation-only changes have a zero-command bounded plan', () => {
  const plan = focusedTestPlan(['docs/fast-release-mode.md'], manifest);
  assert.deepEqual(plan, {
    categories: [],
    unknownRuntime: [],
    deferredTests: [],
    commands: [],
  });
});

test('changed test files are executed directly without shell evaluation', () => {
  const plan = focusedTestPlan(['game/test/offline-new.test.mjs'], manifest);
  assert.ok(plan.commands.some(({ id }) => id === 'offline-runtime'));
  assert.ok(plan.commands.some(({ id }) => id === 'changed-test:game/test/offline-new.test.mjs'));
});

test('manifest-declared changed tests are not executed twice', () => {
  const plan = focusedTestPlan(['game/test/coop-picture-bindings.test.mjs'], manifest);
  assert.deepEqual(
    plan.commands.map(({ id }) => id),
    ['team-picture-bindings'],
  );
});

test('publishing changes run the exact-head controller and release-object gates', () => {
  const plan = focusedTestPlan(['publishing/pages-controller/public-byte-audit.mjs'], manifest);
  assert.deepEqual(plan.categories, ['publishing']);
  const command = plan.commands.find(({ id }) => id === 'publishing-controller');
  assert.ok(command);
  for (const required of [
    'publishing/focused-tests.test.mjs',
    'publishing/fastline-merge-controller.test.mjs',
    'publishing/fastline-release-inputs.test.mjs',
    'publishing/fastline-release-objects.test.mjs',
    'publishing/fastline-release-publisher.test.mjs',
    'publishing/source-workflow.test.mjs',
  ])
    assert.ok(command.args.includes(required), `Missing focused gate: ${required}`);
});

test('production Team retained-successor coverage is not deferred', () => {
  const retained = 'game/test/coop-reviewed-successor-picture.test.mjs';
  const plan = focusedTestPlan([retained], manifest);
  assert.deepEqual(plan.deferredTests, []);
  assert.ok(plan.commands.some((command) => command.args.includes(retained)));
  assert.ok(manifest.categories.every((category) => !category.deferredChangedTestPatterns?.length));
});

test('an explicit synthetic deferral is reported without altering production coverage', () => {
  const retained = 'game/test/coop-reviewed-successor-picture.test.mjs';
  const synthetic = structuredClone(manifest);
  const category = synthetic.categories.find((entry) => entry.id === 'team-picture-bindings');
  for (const command of category.commands)
    command.args = command.args.filter((argument) => argument !== retained);
  category.deferredChangedTestPatterns = [
    '^game/test/coop-reviewed-successor-picture\\.test\\.mjs$',
  ];
  const plan = focusedTestPlan([retained], synthetic);
  assert.deepEqual(plan.categories, ['team-picture-bindings']);
  assert.deepEqual(plan.deferredTests, [retained]);
  assert.ok(!plan.commands.some((command) => command.args.includes(retained)));
  assert.ok(
    focusedTestPlan([retained], manifest).commands.some((command) =>
      command.args.includes(retained),
    ),
  );
});

test('unsafe paths and empty selections are rejected', () => {
  assert.throws(() => focusedTestPlan([], manifest), /requires bounded/u);
  assert.throws(() => focusedTestPlan(['../outside.mjs'], manifest), /requires bounded/u);
});

test('company measurement tools under docs and shared Journey writes retain company gates', () => {
  for (const changed of [
    'docs/verification/company-review.html',
    'docs/verification/company-review.mjs',
    'docs/verification/company-review-model.mjs',
    'scripts/test-company-review.mjs',
    'game/journey/profile.mjs',
    'game/app.mjs',
    'game/index.html',
    'game/runtime-content-provider.mjs',
    'game/ui/edition-play.css',
    'game/ui/edition-lessons.mjs',
    'game/ui/edition-navigation.mjs',
    'game/ui/edition-controller-practice.mjs',
    'game/ui/body-backing.mjs',
    'game/profile-writer.mjs',
    'game/external-chapter-pointer.mjs',
    'game/external-chapter-backup.mjs',
    'game/presentation/actor-appearance-pin.mjs',
    'game/replay-actor-context.mjs',
    'game/editions/runtime-assets.json',
    'game/editions/standalone/route-loader.mjs',
    'scripts/edition-runtime.mjs',
    'scripts/edition-provider-parity.mjs',
  ]) {
    const plan = focusedTestPlan([changed], manifest);
    assert.ok(plan.categories.includes('company-editions'), changed);
    assert.deepEqual(plan.unknownRuntime, [], changed);
    assert.ok(
      plan.commands.some(({ id }) => id === 'company-runtime-and-publication'),
      changed,
    );
    assert.ok(
      plan.commands.some(({ id }) => id === 'company-review-measurements'),
      changed,
    );
  }
});

test('focused command execution reports every failure and continues once per command', () => {
  const commands = [
    { id: 'exit', command: 'node', args: ['exit'] },
    { id: 'returned-error', command: 'node', args: ['returned-error'] },
    { id: 'thrown-error', command: 'node', args: ['thrown-error'] },
    { id: 'signal', command: 'node', args: ['signal'] },
    { id: 'later-pass', command: 'node', args: ['later-pass'] },
  ];
  const calls = [];
  const stderr = [];
  const results = [
    { status: 7, signal: null },
    { status: null, signal: null, error: new Error('returned') },
    new Error('thrown'),
    { status: 0, signal: 'SIGTERM' },
    { status: 0, signal: null },
  ];
  const summary = runFocusedCommands(commands, {
    spawn(command, args) {
      calls.push([command, ...args]);
      const result = results.shift();
      if (result instanceof Error) throw result;
      return result;
    },
    stdout: { write() {} },
    stderr: {
      write(message) {
        stderr.push(message);
      },
    },
  });
  assert.deepEqual(
    calls,
    commands.map(({ command, args }) => [command, ...args]),
  );
  assert.equal(summary.attempted, commands.length);
  assert.deepEqual(
    summary.failures.map(({ id }) => id),
    ['exit', 'returned-error', 'thrown-error', 'signal'],
  );
  assert.equal(summary.exitCode, 7);
  assert.equal(stderr.length, 4);
  assert.match(stderr[1], /returned/u);
  assert.match(stderr[2], /thrown/u);
  assert.match(stderr[3], /SIGTERM/u);
});

test('focused command execution uses real child exit status and still runs later commands', () => {
  const summary = runFocusedCommands(
    [
      {
        id: 'real-exit',
        command: process.execPath,
        args: ['-e', 'process.exit(5)'],
      },
      {
        id: 'real-pass',
        command: process.execPath,
        args: ['-e', 'process.exit(0)'],
      },
    ],
    {
      stdout: { write() {} },
      stderr: { write() {} },
    },
  );
  assert.equal(summary.attempted, 2);
  assert.deepEqual(
    summary.failures.map(({ id, status }) => [id, status]),
    [['real-exit', 5]],
  );
  assert.equal(summary.exitCode, 5);
});

test('focused command execution reports a timeout and stops the remaining queue', () => {
  const calls = [];
  const stderr = [];
  const timeout = Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' });
  const summary = runFocusedCommands(
    [
      { id: 'blocked', command: 'node', args: ['blocked'], timeoutMs: 4321 },
      { id: 'must-not-run', command: 'node', args: ['later'] },
    ],
    {
      spawn(command, args, options) {
        calls.push([command, ...args, options.timeout, options.killSignal]);
        return { status: null, signal: 'SIGTERM', error: timeout };
      },
      stdout: { write() {} },
      stderr: {
        write(message) {
          stderr.push(message);
        },
      },
      timeoutMs: 1234,
    },
  );
  assert.deepEqual(calls, [['node', 'blocked', 4321, 'SIGTERM']]);
  assert.equal(summary.attempted, 1);
  assert.deepEqual(
    summary.failures.map(({ id, timedOut }) => [id, timedOut]),
    [['blocked', true]],
  );
  assert.equal(summary.exitCode, 124);
  assert.match(stderr.at(-1), /timed out after 4321ms/u);
});

test('focused command execution succeeds only when every command succeeds', () => {
  const summary = runFocusedCommands([{ id: 'pass', command: 'node', args: ['pass'] }], {
    spawn() {
      return { status: 0, signal: null };
    },
    stdout: { write() {} },
    stderr: { write() {} },
  });
  assert.deepEqual(summary, { attempted: 1, failures: [], exitCode: 0 });
});

test('fallback validation receives its bounded thirty-minute budget without widening other commands', async () => {
  const plan = focusedTestPlan(['game/new-player-runtime.mjs'], manifest);
  const execution = focusedCommandExecutionPlan(plan.commands);
  const fallback = execution.commands.find(({ id }) => id === 'unknown-runtime-validate');
  assert.ok(fallback);
  assert.equal(fallback.timeoutMs, 30 * 60 * 1000);
  const calls = [];
  const summary = await runFocusedCommandsParallel(
    [...execution.commands, { id: 'ordinary', command: 'node', args: ['ordinary'] }],
    {
      concurrency: 2,
      stdout: { write() {} },
      stderr: { write() {} },
      spawnChild(command, args, options) {
        calls.push([command, args, options.killSignal]);
        assert.equal(options.timeout, undefined, 'One runner-owned deadline, no second timer');
        const child = new EventEmitter();
        setImmediate(() => child.emit('close', args.includes('validate') ? 7 : 0, null));
        return child;
      },
    },
  );
  assert.deepEqual(calls, [
    ['npm', ['run', 'validate'], 'SIGTERM'],
    ['node', ['ordinary'], 'SIGTERM'],
  ]);
  assert.equal(summary.exitCode, 7);
  assert.deepEqual(
    summary.failures.map(({ id, status }) => [id, status]),
    [['unknown-runtime-validate', 7]],
  );
});

test('bounded parallel focused execution retains every command verdict', async () => {
  let active = 0;
  let maximumActive = 0;
  const summary = await runFocusedCommandsParallel(
    [
      { id: 'first', command: 'node', args: ['first'] },
      { id: 'second', command: 'node', args: ['second'] },
      { id: 'failure', command: 'node', args: ['failure'] },
    ],
    {
      concurrency: 2,
      stdout: { write() {} },
      stderr: { write() {} },
      spawnChild(_command, args) {
        const child = new EventEmitter();
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        setImmediate(() => {
          active -= 1;
          child.emit('close', args[0] === 'failure' ? 9 : 0, null);
        });
        return child;
      },
    },
  );
  assert.equal(summary.attempted, 3);
  assert.deepEqual(
    summary.failures.map(({ id, status }) => [id, status]),
    [['failure', 9]],
  );
  assert.equal(summary.exitCode, 9);
  assert.equal(maximumActive, 2, 'independent commands use the bounded worker pool');
});

test('parallel focused deadlines remain explicit when a real child handles SIGTERM', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'focused-deadline-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const unfinished = path.join(root, 'unfinished.test.mjs');
  await writeFile(
    unfinished,
    "import test from 'node:test'; test('unfinished', async () => { console.log('focused-child-ready'); await new Promise(() => setInterval(() => {}, 1000)); });\n",
  );
  for (const [id, args] of [
    ['node-test', ['--test', unfinished]],
    [
      'handled-one',
      [
        '-e',
        "process.on('SIGTERM', () => process.exit(1)); console.log('focused-child-ready'); setInterval(() => {}, 1000)",
      ],
    ],
    [
      'handled-zero',
      [
        '-e',
        "process.on('SIGTERM', () => process.exit(0)); console.log('focused-child-ready'); setInterval(() => {}, 1000)",
      ],
    ],
  ]) {
    // Test-only readiness avoids assigning a deadline to variable Node startup.
    // The runner still owns the sole command timer after receiving the child.
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const child = spawn(process.execPath, args, { env, stdio: ['ignore', 'pipe', 'ignore'] });
    t.after(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    });
    await new Promise((resolve, reject) => {
      let output = '';
      const finish = (error) => {
        clearTimeout(timer);
        child.stdout.off('data', ready);
        child.off('error', failed);
        child.off('close', closed);
        if (error) {
          child.kill('SIGTERM');
          reject(error);
        } else resolve();
      };
      const failed = (error) => finish(error),
        closed = () => finish(new Error('Tiny child exited before readiness')),
        ready = (bytes) => {
          output += bytes.toString();
          if (Buffer.byteLength(output) > 8192) finish(new Error('Tiny child output bound'));
          else if (output.includes('focused-child-ready')) finish();
        };
      const timer = setTimeout(() => finish(new Error('Tiny child readiness bound')), 5000);
      child.stdout.on('data', ready);
      child.once('error', failed);
      child.once('close', closed);
    });
    child.stdout.resume();
    const result = await runFocusedCommandsParallel(
      [{ id, command: process.execPath, args, timeoutMs: 50 }],
      {
        stdout: { write() {} },
        stderr: { write() {} },
        spawnChild(command, args, options) {
          assert.equal(command, process.execPath);
          assert.equal(options.timeout, undefined, 'The runner owns the only deadline');
          return child;
        },
      },
    );
    assert.equal(result.exitCode, 124, id);
    assert.equal(result.failures.length, 1);
    const failure = result.failures[0];
    assert.equal(failure.timedOut, true, id);
    assert.equal(failure.timeoutMs, 50);
    assert.equal(failure.timeoutReason, 'command-deadline');
    assert.equal(failure.status, id === 'handled-zero' ? 0 : 1);
    assert.equal(failure.signal, null);
    assert.equal(failure.error, null);
  }
});

test('parallel focused ordinary failure and independent abort are not deadline failures', async () => {
  const result = await runFocusedCommandsParallel(
    [
      { id: 'ordinary', command: process.execPath, args: ['-e', 'process.exit(1)'] },
      {
        id: 'independent-abort',
        command: process.execPath,
        args: ['-e', "process.kill(process.pid, 'SIGTERM')"],
      },
    ],
    { timeoutMs: 5000, stdout: { write() {} }, stderr: { write() {} } },
  );
  assert.equal(result.exitCode, 1);
  assert.deepEqual(
    result.failures.map(({ id, status, signal, error }) => ({ id, status, signal, error })),
    [
      { id: 'ordinary', status: 1, signal: null, error: null },
      { id: 'independent-abort', status: null, signal: 'SIGTERM', error: null },
    ],
  );
  for (const failure of result.failures)
    for (const field of ['timedOut', 'timeoutMs', 'timeoutReason'])
      assert.equal(Object.hasOwn(failure, field), false);
});

test('parallel focused invalid per-command deadlines fail before spawning', async () => {
  const values = [
    -1,
    0,
    0.5,
    '50',
    NaN,
    Infinity,
    2 ** 31,
    2 ** 32 - 1,
    2 ** 32,
    Number.MAX_SAFE_INTEGER + 1,
  ];
  let spawns = 0;
  const result = await runFocusedCommandsParallel(
    values.map((timeoutMs, index) => ({
      id: `invalid-${index}`,
      command: 'node',
      args: [],
      timeoutMs,
    })),
    {
      stdout: { write() {} },
      stderr: { write() {} },
      spawnChild() {
        spawns++;
        throw new Error('Invalid timeout reached spawn');
      },
    },
  );
  assert.equal(spawns, 0);
  assert.equal(result.attempted, values.length);
  assert.equal(result.exitCode, 1);
  assert.equal(result.failures.length, values.length);
  for (const failure of result.failures) {
    assert.match(failure.error, /timeout must be a positive signed 32-bit integer/);
    assert.equal(failure.status, null);
    assert.equal(failure.signal, null);
    assert.equal(Object.hasOwn(failure, 'timedOut'), false);
  }
});

test('parallel focused execution rejects invalid worker limits', async () => {
  await assert.rejects(
    runFocusedCommandsParallel([], {
      concurrency: 0,
      stdout: { write() {} },
      stderr: { write() {} },
    }),
    /concurrency/u,
  );
});

test('execution planning removes only exact tests covered by the selected package script', () => {
  const commands = [
    { id: 'aggregate', command: 'npm', args: ['run', 'suite'] },
    { id: 'any-id-a', command: 'node', args: ['--test', 'tests/a.test.mjs'] },
    { id: 'any-id-b', command: 'node', args: ['--test', 'other/b.test.mjs'] },
    { id: 'syntax', command: 'node', args: ['--check', 'tests/a.test.mjs'] },
  ];
  const execution = focusedCommandExecutionPlan(commands, {
    packageScripts: {
      suite: 'node --test tests/*.test.mjs scripts/test-extra.mjs',
    },
    shellSemantics: 'posix',
    repositoryFiles: [
      'tests/a.test.mjs',
      'tests/c.test.mjs',
      'other/b.test.mjs',
      'scripts/test-extra.mjs',
    ],
  });
  assert.deepEqual(
    execution.commands.map(({ id }) => id),
    ['aggregate', 'any-id-b', 'syntax'],
  );
  assert.deepEqual(execution.packageCoverage, [
    {
      id: 'aggregate',
      script: 'suite',
      tests: ['tests/a.test.mjs', 'tests/c.test.mjs', 'scripts/test-extra.mjs'],
    },
  ]);
  assert.deepEqual(execution.deduplicated, [
    {
      id: 'any-id-a',
      testFile: 'tests/a.test.mjs',
      coveredBy: ['aggregate'],
    },
  ]);
  assert.deepEqual(execution.diagnostics, []);
  const before = new Set([
    ...execution.packageCoverage[0].tests,
    'tests/a.test.mjs',
    'other/b.test.mjs',
  ]);
  const after = new Set([...execution.packageCoverage[0].tests, 'other/b.test.mjs']);
  assert.deepEqual(after, before);
});

test('package-script drift cannot silently remove focused coverage', () => {
  const commands = [
    { id: 'aggregate', command: 'npm', args: ['run', 'suite'] },
    { id: 'a', command: 'node', args: ['--test', 'tests/a.test.mjs'] },
    { id: 'b', command: 'node', args: ['--test', 'tests/b.test.mjs'] },
  ];
  const execution = focusedCommandExecutionPlan(commands, {
    packageScripts: { suite: 'node --test tests/a.test.mjs' },
    shellSemantics: 'posix',
    repositoryFiles: ['tests/a.test.mjs', 'tests/b.test.mjs'],
  });
  assert.deepEqual(
    execution.commands.map(({ id }) => id),
    ['aggregate', 'b'],
  );
  assert.deepEqual(
    execution.deduplicated.map(({ testFile }) => testFile),
    ['tests/a.test.mjs'],
  );
});

test('missing files and unsupported or missing scripts retain every command', () => {
  const commands = [
    { id: 'aggregate', command: 'npm', args: ['run', 'suite'] },
    { id: 'a', command: 'node', args: ['--test', 'tests/a.test.mjs'] },
  ];
  for (const inputs of [
    {
      packageScripts: { suite: 'node --test tests/missing.test.mjs' },
      shellSemantics: 'posix',
      repositoryFiles: ['tests/a.test.mjs'],
    },
    {
      packageScripts: { suite: 'node --test tests/a.test.mjs && echo unsafe' },
      shellSemantics: 'posix',
      repositoryFiles: ['tests/a.test.mjs'],
    },
    {
      packageScripts: {},
      shellSemantics: 'posix',
      repositoryFiles: ['tests/a.test.mjs'],
    },
  ]) {
    const execution = focusedCommandExecutionPlan(commands, inputs);
    assert.deepEqual(execution.commands, commands);
    assert.deepEqual(execution.deduplicated, []);
    assert.equal(execution.diagnostics.length, 1);
  }
});

test('POSIX wildcard coverage excludes leading-dot files unless the pattern names the dot', () => {
  const commands = [
    { id: 'aggregate', command: 'npm', args: ['run', 'suite'] },
    { id: 'hidden', command: 'node', args: ['--test', 'tests/.hidden.test.mjs'] },
  ];
  const execution = focusedCommandExecutionPlan(commands, {
    packageScripts: { suite: 'node --test tests/*.test.mjs' },
    repositoryFiles: ['tests/a.test.mjs', 'tests/.hidden.test.mjs'],
    shellSemantics: 'posix',
  });
  assert.deepEqual(
    execution.commands.map(({ id }) => id),
    ['aggregate', 'hidden'],
  );
  assert.deepEqual(execution.packageCoverage[0].tests, ['tests/a.test.mjs']);
});

test('shell expansion syntax and non-string scripts retain all commands', () => {
  const commands = [
    { id: 'aggregate', command: 'npm', args: ['run', 'suite'] },
    { id: 'literal-dollar', command: 'node', args: ['--test', 'tests/$CASE.test.mjs'] },
  ];
  for (const script of [
    'node --test tests/$CASE.test.mjs',
    'node --test "tests/a.test.mjs"',
    'node --test tests/a.test.mjs && echo unsafe',
    42,
    null,
    [],
    {},
  ]) {
    const execution = focusedCommandExecutionPlan(commands, {
      packageScripts: { suite: script },
      repositoryFiles: ['tests/$CASE.test.mjs', 'tests/a.test.mjs'],
      shellSemantics: 'posix',
    });
    assert.deepEqual(execution.commands, commands);
    assert.deepEqual(execution.deduplicated, []);
    assert.equal(execution.diagnostics.length, 1);
  }
});

test('deduplication requires confirmed POSIX npm script-shell semantics', () => {
  const commands = [
    { id: 'aggregate', command: 'npm', args: ['run', 'suite'] },
    { id: 'a', command: 'node', args: ['--test', 'tests/a.test.mjs'] },
  ];
  const inputs = {
    packageScripts: { suite: 'node --test tests/*.test.mjs' },
    repositoryFiles: ['tests/a.test.mjs'],
  };
  const unsupported = focusedCommandExecutionPlan(commands, inputs);
  assert.deepEqual(unsupported.commands, commands);
  assert.deepEqual(
    unsupported.diagnostics.map(({ reason }) => reason),
    ['unsupported-script-shell'],
  );
  assert.equal(
    packageScriptShellSemantics('/root', {
      platform: 'linux',
      spawn() {
        return { status: 0, signal: null, stdout: 'null\n' };
      },
    }),
    'posix',
  );
  assert.equal(
    packageScriptShellSemantics('/root', {
      platform: 'linux',
      spawn() {
        return { status: 0, signal: null, stdout: '/bin/bash\n' };
      },
    }),
    null,
  );
  assert.equal(
    packageScriptShellSemantics('/root', {
      platform: 'win32',
      spawn() {
        throw new Error('must not run');
      },
    }),
    null,
  );
});

test('execution input loading fails closed for missing directories, links, nonfiles and I/O errors', async () => {
  const commands = [{ id: 'aggregate', command: 'npm', args: ['run', 'suite'] }];
  const readFile = async () =>
    JSON.stringify({
      scripts: {
        suite: 'node --test tests/*.test.mjs other/exact.test.mjs',
      },
    });
  const inputs = await loadFocusedExecutionInputs(commands, '/root', {
    readFile,
    async readDirectory() {
      return [
        {
          name: 'a.test.mjs',
          isFile: () => true,
          isSymbolicLink: () => false,
        },
        {
          name: 'linked-file.test.mjs',
          isFile: () => false,
          isSymbolicLink: () => true,
        },
        {
          name: 'linked-directory.test.mjs',
          isFile: () => false,
          isSymbolicLink: () => true,
        },
        {
          name: 'directory.test.mjs',
          isFile: () => false,
          isSymbolicLink: () => false,
        },
      ];
    },
    async statPath(candidate) {
      if (candidate.endsWith('linked-file.test.mjs')) return { isFile: () => true };
      if (candidate.endsWith('linked-directory.test.mjs')) return { isFile: () => false };
      throw new Error('unreadable');
    },
    shellSemantics: 'posix',
  });
  assert.deepEqual(inputs, {
    packageScripts: {
      suite: 'node --test tests/*.test.mjs other/exact.test.mjs',
    },
    repositoryFiles: ['tests/a.test.mjs', 'tests/linked-file.test.mjs'],
    shellSemantics: 'posix',
  });
  const execution = focusedCommandExecutionPlan(
    [...commands, { id: 'a', command: 'node', args: ['--test', 'tests/a.test.mjs'] }],
    inputs,
  );
  assert.deepEqual(
    execution.commands.map(({ id }) => id),
    ['aggregate', 'a'],
  );
  assert.deepEqual(execution.deduplicated, []);
  assert.deepEqual(
    execution.diagnostics.map(({ reason }) => reason),
    ['unresolved-package-tests'],
  );

  const missingDirectory = await loadFocusedExecutionInputs(commands, '/root', {
    readFile,
    async readDirectory() {
      throw new Error('missing');
    },
    async statPath() {
      throw new Error('missing');
    },
    shellSemantics: 'posix',
  });
  assert.deepEqual(missingDirectory.repositoryFiles, []);
  assert.deepEqual(focusedCommandExecutionPlan(commands, missingDirectory).commands, commands);
});

test('missing or malformed npm shell-probe output cannot authorize deduplication', () => {
  for (const stdout of [undefined, null, 42, Buffer.from('null'), '', '  ', 'undefined']) {
    assert.equal(
      packageScriptShellSemantics('/root', {
        platform: 'linux',
        spawn() {
          return { status: 0, signal: null, stdout };
        },
      }),
      null,
    );
  }
  for (const result of [
    { status: 1, signal: null, stdout: 'null' },
    { status: 0, signal: 'SIGTERM', stdout: 'null' },
    { status: 0, error: new Error('probe unavailable'), stdout: 'null' },
  ]) {
    assert.equal(
      packageScriptShellSemantics('/root', { platform: 'linux', spawn: () => result }),
      null,
    );
  }
  assert.equal(
    packageScriptShellSemantics('/root', {
      platform: 'linux',
      spawn() {
        throw new Error('probe unavailable');
      },
    }),
    null,
  );
});

test('company packaging and boot admission always select company and startup regressions', () => {
  for (const changed of [
    'game/boot.mjs',
    'game/ui/company-startup.mjs',
    'game/ui/install-offline-panel.mjs',
    'game/editions/offline-package-id.mjs',
    'scripts/company-offline-packages.mjs',
    'scripts/offline-content.mjs',
  ]) {
    const plan = focusedTestPlan([changed], manifest);
    assert.ok(plan.categories.includes('company-editions'), changed);
    assert.ok(plan.categories.includes('company-offline-startup'), changed);
    assert.deepEqual(plan.unknownRuntime, [], changed);
    assert.ok(
      plan.commands.some((c) => c.id === 'company-runtime-and-publication'),
      changed,
    );
    const startup = plan.commands.find((c) => c.id === 'company-offline-startup');
    for (const required of [
      'game/test/boot.test.mjs',
      'game/test/offline-download-access.test.mjs',
      'game/test/official-downloads.test.mjs',
      'game/test/install-offline-panel.test.mjs',
      'scripts/test-offline-core-closure.mjs',
    ])
      assert.ok(startup.args.includes(required), required);
  }
});

test('neutral pilot recording changes select real engine replay and source parity checks', () => {
  const plan = focusedTestPlan(['game/content-design/neutral-pilot-session.mjs'], manifest);
  assert.deepEqual(plan.categories, ['neutral-pilot-evidence']);
  assert.deepEqual(plan.unknownRuntime, []);
  assert.ok(plan.commands[0].args.includes('game/test/neutral-pilot-session.test.mjs'));
});

test('Journey star sidecars select previous-release storage and backup compatibility checks', () => {
  for (const file of [
    'game/journey/stars.mjs',
    'game/journey/profile.mjs',
    'game/mission-library/creator-source.mjs',
  ]) {
    const plan = focusedTestPlan([file], manifest);
    assert.ok(plan.categories.includes('journey-star-compatibility'));
    const command = plan.commands.find(({ id }) => id === 'journey-star-compatibility');
    assert.ok(command.args.includes('game/test/journey-stars.test.mjs'));
    assert.ok(command.args.includes('game/test/journey-backup.test.mjs'));
  }
});

test('focused CI installs the locked native fixture owner before selected checks', async () => {
  const consumers = [
    'game/test/community-ownership-concurrency.test.mjs',
    'game/test/fpv-world-appearance-ui.test.mjs',
    'game/test/fpv-world-content.test.mjs',
  ];
  const plan = focusedTestPlan(consumers, manifest);
  for (const file of consumers)
    assert.ok(plan.commands.some(({ command, args }) => command === 'node' && args.includes(file)));

  const workflow = await readFile(
    path.join(directory, '../.github/workflows/deploy-pages.yml'),
    'utf8',
  );
  const focused = workflow.split('  focused_shards:\n')[1].split('\n  focused:')[0];
  assert.match(focused, /timeout-minutes: 90/u);
  const steps = focused.split(/\n      - /);
  const install = steps.findIndex((step) =>
    step.startsWith('name: Install pinned authoring dependencies for selected focused gates\n'),
  );
  const rootInstall = steps.findIndex((step) =>
    step.startsWith('name: Install dependencies once for selected focused gates\n'),
  );
  const execute = steps.findIndex((step) => step.startsWith('name: Run selected focused gates\n'));
  assert.ok(rootInstall >= 0 && install > rootInstall && execute > install);
  assert.match(
    focused,
    /needs\.preflight\.outputs\.focusedContract == 'revealline-focused-plan\.v2'/,
  );
  assert.match(focused, /needs\.preflight\.outputs\.focusedShards != '0'/);
  assert.match(steps[install], /working-directory: source/);
  assert.match(
    steps[install],
    /run: npm ci --prefix authoring\/fpv-worlds --ignore-scripts --include=dev --prefer-offline\s*$/,
  );
  assert.doesNotMatch(steps[install], /--omit=dev|continue-on-error|\|\|/);

  const owner = JSON.parse(
    await readFile(path.join(directory, '../authoring/fpv-worlds/package.json'), 'utf8'),
  );
  const lock = JSON.parse(
    await readFile(path.join(directory, '../authoring/fpv-worlds/package-lock.json'), 'utf8'),
  );
  assert.match(owner.devDependencies['fake-indexeddb'], /^\d+\.\d+\.\d+$/);
  for (const [name, version] of Object.entries({
    ...owner.dependencies,
    ...owner.devDependencies,
  })) {
    assert.equal(lock.packages['node_modules/' + name].version, version);
    assert.match(lock.packages['node_modules/' + name].integrity, /^sha512-/);
  }
  assert.equal(
    lock.packages[''].devDependencies['fake-indexeddb'],
    owner.devDependencies['fake-indexeddb'],
  );
  assert.equal(lock.packages['node_modules/fake-indexeddb'].dev, true);
});

const shardHash = (value) => createHash('sha256').update(value).digest('hex');
const shardIdentity = {
  sourceRevision: '1'.repeat(40),
  workflowRevision: '2'.repeat(40),
  policyDigest: '3'.repeat(64),
  testPolicySha256: '4'.repeat(64),
  manifestSha256: '5'.repeat(64),
  changedPathsSha256: '6'.repeat(64),
  fallbackHandled: false,
};
function shardReceipts(commands) {
  return [1, 2, 3, 4].map((index) => {
    const shard = { index, total: 4 },
      selected = focusedCommandShard(commands, shard);
    return {
      format: 'revealline-focused-shard.v1',
      state: 'complete',
      shard,
      identity: { ...shardIdentity, sourceTree: '7'.repeat(40) },
      plan: { commands, sha256: shardHash(JSON.stringify(commands)) },
      indices: selected.indices,
      result: { attempted: selected.commands.length, failures: [], exitCode: 0 },
    };
  });
}

test('four deterministic partitions retain every selected command once, in order, with its exact deadline', () => {
  for (const count of [0, 1, 3, 4, 5, 193]) {
    const commands = Array.from({ length: count }, (_, i) => ({
      id: `command-${i}`,
      command: 'node',
      args: ['--test', `game/test/case-${i}.test.mjs`],
      timeoutMs: (i + 1) * 1000,
    }));
    const receipts = shardReceipts(commands);
    const union = receipts.flatMap((receipt) => receipt.indices).sort((a, b) => a - b);
    assert.deepEqual(
      union,
      commands.map((_, index) => index),
    );
    for (let index = 1; index <= 4; index++) {
      const part = focusedCommandShard(commands, parseFocusedShard(`${index}/4`));
      for (let offset = 0; offset < part.commands.length; offset++)
        assert.equal(
          part.commands[offset],
          commands[part.indices[offset]],
          'No command is copied or rewritten',
        );
    }
    assert.equal(assertFocusedShardCoverage(receipts.reverse(), shardIdentity).commands, count);
  }
  for (const value of ['', '0/4', '5/4', '1/3', '1/04', '1/4x', '1/4\n', null])
    assert.throws(() => parseFocusedShard(value));
  assert.throws(() =>
    focusedCommandShard(
      [
        { id: 'x', command: 'node', args: [] },
        { id: 'x', command: 'node', args: [] },
      ],
      { index: 1, total: 4 },
    ),
  );
});

test('partitioning follows the unchanged explicit policy and exact package-script deduplication', async () => {
  const required = JSON.parse(await readFile(path.join(directory, 'test-policy.json'), 'utf8'));
  const waived = { ...required, mode: 'waived', authorization: 'explicit-user-request-20260922' };
  const commands = [
    { id: 'package', command: 'npm', args: ['run', 'tests'] },
    { id: 'covered', command: 'node', args: ['--test', 'game/test/a.test.mjs'] },
    { id: 'uncovered', command: 'node', args: ['--test', 'game/test/b.test.mjs'] },
    { id: 'validation', command: 'node', args: ['scripts/check.mjs'], timeoutMs: 1234 },
  ];
  const inputs = {
    packageScripts: { tests: 'node --test game/test/a.test.mjs' },
    repositoryFiles: ['game/test/a.test.mjs'],
    shellSemantics: 'posix',
  };
  for (const [policy, ids] of [
    [required, ['package', 'uncovered', 'validation']],
    [waived, ['validation']],
  ]) {
    const selected = applyFocusedTestPolicy(commands, policy, inputs);
    const final = focusedCommandExecutionPlan(selected.commands, inputs).commands;
    assert.deepEqual(
      final.map(({ id }) => id),
      ids,
    );
    const receipts = shardReceipts(final);
    assert.equal(assertFocusedShardCoverage(receipts, shardIdentity).commands, ids.length);
    if (policy === waived) {
      assert.equal(selected.waivedTests.length, 3);
      assert.ok(
        selected.waivedTests.every(({ verdict }) => verdict === 'WAIVED_SKIPPED_NOT_PASSED'),
      );
    }
  }
  const onlyTests = applyFocusedTestPolicy(commands.slice(0, 3), waived, inputs);
  assert.equal(onlyTests.commands.length, 0);
  assert.equal(onlyTests.waivedTests.length, 3);
  assert.equal(
    assertFocusedShardCoverage(shardReceipts(onlyTests.commands), shardIdentity).commands,
    0,
  );
  // Different fail-closed package discovery on one runner cannot silently omit a command.
  const final = focusedCommandExecutionPlan(commands, inputs).commands;
  const receipts = shardReceipts(final);
  receipts[0] = shardReceipts(focusedCommandExecutionPlan(commands).commands)[0];
  assert.throws(
    () => assertFocusedShardCoverage(receipts, shardIdentity),
    /complete execution plan/,
  );
});

test('coverage rejects dropped, duplicate, mutated, unfinished and failed receipts or identities', () => {
  const commands = Array.from({ length: 9 }, (_, i) => ({
    id: `c${i}`,
    command: 'node',
    args: ['-e', '0'],
    timeoutMs: 1000,
  }));
  const original = shardReceipts(commands);
  const mutations = [
    (r) => r.pop(),
    (r) => r.push(r[0]),
    (r) => {
      r[1] = structuredClone(r[0]);
    },
    (r) => {
      r[0].state = 'planned';
    },
    (r) => {
      r[0].result = null;
    },
    (r) => {
      r[0].result.exitCode = 1;
    },
    (r) => {
      r[0].result.exitCode = 124;
    },
    (r) => {
      r[0].result.failures = [{ id: 'c0', signal: 'SIGTERM' }];
    },
    (r) => {
      r[0].result.attempted--;
    },
    (r) => {
      r[0].indices.pop();
    },
    (r) => {
      r[0].indices.push(1);
    },
    (r) => {
      r[0].indices.reverse();
    },
    (r) => {
      r[0].plan.commands[0].timeoutMs++;
    },
    (r) => {
      r[0].plan.commands[0].args = ['-e', '1'];
      r[0].plan.sha256 = shardHash(JSON.stringify(r[0].plan.commands));
    },
    (r) => {
      r[0].identity.sourceTree = '8'.repeat(40);
    },
    (r) => {
      r[0].identity.sourceTree = '';
    },
    (r) => {
      r[0].shard.total = 3;
    },
    ...Object.keys(shardIdentity).map((key) => (r) => {
      r[0].identity[key] =
        key === 'fallbackHandled' ? true : 'f'.repeat(key.endsWith('Revision') ? 40 : 64);
    }),
  ];
  for (const mutate of mutations) {
    const receipts = original.map((r) => structuredClone(r));
    mutate(receipts);
    assert.throws(() => assertFocusedShardCoverage(receipts, shardIdentity), String(mutate));
  }
  assert.throws(() => assertFocusedShardCoverage(original, {}), /expected focused identity/);
  assert.equal(assertFocusedShardCoverage(original, shardIdentity).commands, 9);
});

async function tinyShardFixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'focused-shards-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ private: true, scripts: {} }));
  git('init', '-q');
  git('add', 'package.json');
  git(
    '-c',
    'user.name=Focused Fixture',
    '-c',
    'user.email=focused@example.invalid',
    'commit',
    '-qm',
    'fixture',
  );
  const source = git('rev-parse', 'HEAD'),
    workflow = 'b'.repeat(40);
  const admission = {
    format: 'revealline-admission.v1',
    headSha: source,
    baseSha: 'c'.repeat(40),
    workflowRevision: workflow,
    policyDigest: 'd'.repeat(64),
    classification: 'maintenance',
    dependencies: [],
    paths: ['game/app.mjs'],
  };
  const commands = Array.from({ length: 7 }, (_, i) => ({
    id: `tiny-${i}`,
    command: 'node',
    args: ['-e', `require('node:fs').appendFileSync('executed.txt','${i}\\n')`],
    timeoutMs: 2000,
  }));
  const manifest = {
    format: 'revealline-focused-test-map.v1',
    categories: [{ id: 'tiny', pathPatterns: ['^game/'], commands }],
    ignoredPathPatterns: [],
    runtimePathPatterns: ['^game/'],
    fallbackCommands: [],
  };
  await writeFile(path.join(root, 'admission.json'), JSON.stringify(admission));
  await writeFile(path.join(root, 'paths.txt'), 'game/app.mjs\n');
  await writeFile(path.join(root, 'manifest.json'), JSON.stringify(manifest));
  await writeFile(
    path.join(root, 'policy.json'),
    await readFile(path.join(directory, 'test-policy.json')),
  );
  const prefix = 'focused-shard-123-1-',
    receipts = path.join(root, 'receipts');
  await mkdir(receipts);
  const common = [
    '--manifest',
    path.join(root, 'manifest.json'),
    '--test-policy',
    path.join(root, 'policy.json'),
  ];
  const invoke = (args, env = {}) =>
    spawnSync(process.execPath, [path.join(directory, 'focused-tests.mjs'), ...args], {
      cwd: root,
      encoding: 'utf8',
      timeout: 15000,
      maxBuffer: 512 * 1024,
      env: {
        ...process.env,
        PATH: path.dirname(process.execPath) + path.delimiter + process.env.PATH,
        EXPECTED_SOURCE: source,
        EXPECTED_AUTOMATION: workflow,
        GITHUB_OUTPUT: '',
        GITHUB_STEP_SUMMARY: '',
        ...env,
      },
    });
  const run = (i, extra = []) =>
    invoke([
      '--root',
      root,
      '--paths',
      path.join(root, 'paths.txt'),
      ...common,
      '--shard',
      `${i}/4`,
      '--receipt',
      path.join(receipts, prefix + i, 'receipt.json'),
      '--admission',
      path.join(root, 'admission.json'),
      ...extra,
    ]);
  const verify = (extra = [], env = {}) =>
    invoke(
      [
        '--verify-shards',
        receipts,
        '--artifact-prefix',
        prefix,
        '--admission',
        path.join(root, 'admission.json'),
        ...common,
        ...extra,
      ],
      env,
    );
  return { root, run, verify, invoke, common, receipts, prefix, commands, manifest };
}

test('actual sharded CLI executes the exact union and verifier refuses missing or mismatched artifacts', async (t) => {
  const f = await tinyShardFixture(t);
  const unsharded = f.invoke([
    '--root',
    f.root,
    '--paths',
    path.join(f.root, 'paths.txt'),
    ...f.common,
  ]);
  assert.equal(unsharded.status, 0, unsharded.stderr);
  const defaultExecutions = (await readFile(path.join(f.root, 'executed.txt'), 'utf8'))
    .trim()
    .split('\n')
    .map(Number)
    .sort((a, b) => a - b);
  await writeFile(path.join(f.root, 'executed.txt'), '');
  for (let i = 1; i <= 4; i++) {
    const result = f.run(i);
    assert.equal(result.status, 0, result.stderr);
  }
  assert.deepEqual(
    (await readFile(path.join(f.root, 'executed.txt'), 'utf8'))
      .trim()
      .split('\n')
      .map(Number)
      .sort((a, b) => a - b),
    defaultExecutions,
  );
  assert.deepEqual(defaultExecutions, [0, 1, 2, 3, 4, 5, 6]);
  let result = f.verify();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"commands":7/);
  result = f.verify([], { EXPECTED_AUTOMATION: 'c'.repeat(40) });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /admission identity/);
  const last = path.join(f.receipts, f.prefix + 4),
    held = path.join(f.root, 'held');
  await rename(last, held);
  result = f.verify();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /artifacts/);
  await rename(held, last);
  const file = path.join(last, 'receipt.json'),
    original = await readFile(file, 'utf8');
  const receipt = JSON.parse(original);
  receipt.state = 'planned';
  await writeFile(file, JSON.stringify(receipt));
  result = f.verify();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /did not complete/);
  await writeFile(file, original);
  await writeFile(
    path.join(f.root, 'manifest.json'),
    JSON.stringify({ ...f.manifest, ignoredPathPatterns: ['changed'] }),
  );
  result = f.verify();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /manifestSha256/);
});

test('actual CLI preserves failed output and fails closed on invalid options, checkout and bounded receipt input', async (t) => {
  const f = await tinyShardFixture(t);
  const failed = structuredClone(f.manifest);
  failed.categories[0].commands[0].args = ['-e', 'process.exit(7)'];
  await writeFile(path.join(f.root, 'manifest.json'), JSON.stringify(failed));
  let result = f.run(1);
  assert.equal(result.status, 7, result.stderr);
  const file = path.join(f.receipts, f.prefix + 1, 'receipt.json'),
    receipt = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(receipt.state, 'complete');
  assert.equal(receipt.result.exitCode, 7);
  assert.equal(receipt.result.failures.length, 1);
  for (const extra of [['--shard', '2/4'], ['--plan-only'], ['--fallback-handled']]) {
    result = f.run(1, extra);
    assert.equal(result.status, 1, result.stderr);
  }
  result = f.verify(['--root', f.root]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /cannot execute/);
  const admission = JSON.parse(await readFile(path.join(f.root, 'admission.json'), 'utf8'));
  admission.headSha = 'e'.repeat(40);
  await writeFile(path.join(f.root, 'admission.json'), JSON.stringify(admission));
  result = f.run(1);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /admission identity/);
  // Bounded JSON reader rejects before parsing or reading an arbitrarily large receipt.
  await writeFile(path.join(f.root, 'admission.json'), ' '.repeat(8 * 1024 * 1024 + 1));
  result = f.verify();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /exceeds its bound/);
});

test('Solo Mission Library edits select every complete native file with its own five-minute ceiling', () => {
  const groups = [
    ['mission-library-solo-native-custom', 'game/test/mission-library-solo-custom-host.test.mjs'],
    ['mission-library-solo-native-setup', 'game/test/mission-library-solo-host.test.mjs'],
    ['mission-library-solo-native-incoming', 'game/test/mission-library-solo-incoming-host.test.mjs'],
    ['mission-library-solo-native-handoff', 'game/test/mission-library-solo-handoff-host.test.mjs'],
  ];
  for (const changed of ['game/test/mission-library-solo-fixture.mjs', ...groups.map(([, file]) => file)]) {
    const plan = focusedTestPlan([changed], manifest);
    assert.deepEqual(plan.unknownRuntime, []);
    assert.deepEqual(plan.deferredTests, []);
    assert.deepEqual(plan.commands.map(({ id }) => id), groups.map(([id]) => id));
    for (const [index, [, file]] of groups.entries()) {
      assert.equal(plan.commands[index].command, 'node');
      assert.deepEqual(plan.commands[index].args, ['--test', '--test-concurrency=1', file]);
      assert.equal(plan.commands[index].timeoutMs, 300000);
    }
  }
});

test('unrelated native edits do not select or defer the Solo Mission Library cohort', () => {
  for (const changed of [
    'game/test/controller-navigation.test.mjs',
    'game/test/mission-library-solo-lifecycle-host.test.mjs',
  ]) {
    const plan = focusedTestPlan([changed], manifest);
    assert.equal(plan.categories.includes('mission-library-solo-native'), false);
    assert.equal(plan.commands.some(({ id }) => id.startsWith('mission-library-solo-native-')), false);
    assert.deepEqual(plan.deferredTests, []);
    assert.equal(plan.commands.some(({ args }) => args.includes(changed)), true);
  }
});
