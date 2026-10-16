import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { applyFocusedTestPolicy, focusedTestPlan, runFocusedCommands } from './focused-tests.mjs';

const policy = {
  ...JSON.parse(await readFile(new URL('./test-policy.json', import.meta.url))),
  mode: 'waived',
  authorization: 'explicit-user-request-20260922',
};
const command = (id, command, args) => ({ id, command, args });
const checks = [
  command('validate', 'npm', ['run', 'validate']),
  command('company-check', 'npm', ['run', 'company:check']),
  command('syntax', 'node', ['--check', 'test.mjs']),
];
const tests = [
  command('direct', 'node', ['--test', 'game/test/one.test.mjs', 'scripts/test-extra.mjs']),
  command('package', 'npm', ['run', 'company:test']),
];
const scripts = { 'company:test': 'node --test game/test/*.test.mjs' };

test('explicit waived policy skips pure suites and preserves non-test commands in order', () => {
  const selected = applyFocusedTestPolicy([...checks, ...tests], policy, {
    packageScripts: scripts,
  });
  assert.deepEqual(selected.commands, checks);
  assert.deepEqual(
    selected.waivedTests.map(({ id }) => id),
    ['direct', 'package'],
  );
  assert.ok(selected.waivedTests.every(({ verdict }) => verdict === 'WAIVED_SKIPPED_NOT_PASSED'));
});

test('missing, required or malformed policy cannot silently waive tests', () => {
  const commands = [...checks, ...tests];
  for (const p of [null, undefined, { ...policy, mode: 'required' }])
    assert.deepEqual(
      applyFocusedTestPolicy(commands, p, { packageScripts: scripts }).commands,
      commands,
    );
  for (const p of [{}, { ...policy, authorization: 'untrusted' }, { ...policy, mode: 'unknown' }])
    assert.throws(() => applyFocusedTestPolicy(commands, p, { packageScripts: scripts }));
});

test('mixed npm scripts, pre/post hooks and unknown syntax remain mandatory', () => {
  const npmTest = tests[1];
  for (const packageScripts of [
    {},
    {
      'company:test': 'node --test game/test/one.test.mjs && npm run validate',
    },
    { ...scripts, 'precompany:test': 'npm run validate' },
    { ...scripts, 'postcompany:test': 'npm run build' },
    {
      'company:test': 'node --test --import ./setup.mjs game/test/one.test.mjs',
    },
  ])
    assert.deepEqual(applyFocusedTestPolicy([npmTest], policy, { packageScripts }).commands, [
      npmTest,
    ]);
  const ambiguous = command('loader', 'node', ['--test', '--import', './setup.mjs', 'test.mjs']);
  assert.deepEqual(applyFocusedTestPolicy([ambiguous], policy).commands, [ambiguous]);
});

test('non-test failure still fails the focused job after tests are waived', () => {
  const selected = applyFocusedTestPolicy([...checks, ...tests], policy, {
    packageScripts: scripts,
  });
  const called = [];
  const result = runFocusedCommands(selected.commands, {
    spawn(command, args) {
      called.push([command, ...args]);
      return { status: 9, signal: null };
    },
    stdout: { write() {} },
    stderr: { write() {} },
  });
  assert.equal(result.exitCode, 9);
  assert.equal(called.length, checks.length);
  assert.equal(result.failures.length, checks.length);
});

test('actual selected company, i18n and unknown-runtime validations survive the waiver', async () => {
  const map = JSON.parse(await readFile(new URL('./focused-test-map.json', import.meta.url)));
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url)));
  const plan = focusedTestPlan(
    ['game/app.mjs', 'game/i18n/catalogs.mjs', 'game/new-runtime.mjs'],
    map,
  );
  const selected = applyFocusedTestPolicy(plan.commands, policy, {
    packageScripts: pkg.scripts,
  });
  assert.deepEqual(
    selected.commands.map(({ id }) => id),
    ['i18n-check', 'company-generated-source-and-media', 'unknown-runtime-validate'],
  );
  assert.ok(selected.waivedTests.length > 0);
});

test('workflow passes pinned policy without weakening the exact-source or required gate', async () => {
  const workflow = await readFile(
    new URL('../.github/workflows/deploy-pages.yml', import.meta.url),
    'utf8',
  );
  assert.equal(
    workflow.split('--test-policy automation/publishing/test-policy.json').length - 1,
    2,
  );
  assert.match(
    workflow,
    /publishing\/test-policy\.json\n            publishing\/test-policy\.mjs\n            scripts\/check-source-identity\.mjs/u,
  );
  assert.match(workflow, /test "\$FOCUSED_RESULT" = success/u);
  assert.match(workflow, /Verify exact tracked source before commands/u);
  assert.match(workflow, /Verify exact tracked source after commands/u);
  assert.match(workflow, /waived suites are not passed/u);
});
