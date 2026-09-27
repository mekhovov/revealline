import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  focusedCommandExecutionPlan,
  focusedTestPlan,
  runFocusedCommands,
} from './focused-tests.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(await readFile(path.join(directory, 'focused-test-map.json'), 'utf8'));

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

test('publishing changes run the exact-head controller, authority, determinism and public-byte gates', () => {
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
    'publishing/pages-controller/archive-authority.test.mjs',
    'publishing/pages-controller/assemble.test.mjs',
    'publishing/pages-controller/metadata.test.mjs',
    'publishing/pages-controller/public-byte-audit.test.mjs',
    'publishing/pages-controller/release-asset.test.mjs',
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
      repositoryFiles: ['tests/a.test.mjs'],
    },
    {
      packageScripts: { suite: 'node --test tests/a.test.mjs && echo unsafe' },
      repositoryFiles: ['tests/a.test.mjs'],
    },
    {
      packageScripts: {},
      repositoryFiles: ['tests/a.test.mjs'],
    },
  ]) {
    const execution = focusedCommandExecutionPlan(commands, inputs);
    assert.deepEqual(execution.commands, commands);
    assert.deepEqual(execution.deduplicated, []);
    assert.equal(execution.diagnostics.length, 1);
  }
});
