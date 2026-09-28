import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  focusedCommandExecutionPlan,
  focusedTestPlan,
  loadFocusedExecutionInputs,
  packageScriptShellSemantics,
  runFocusedCommands,
} from './focused-tests.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(await readFile(path.join(directory, 'focused-test-map.json'), 'utf8'));

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
