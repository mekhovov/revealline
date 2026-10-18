import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { parse } from 'acorn';

// This contract is run from the admitted repository root. The explicit source
// override permits the retained before/after cache control without browser work.
const root = process.cwd();
const runnerPath = process.env.SOLO_BASELINE_DISPATCH_SOURCE
  ? resolve(process.env.SOLO_BASELINE_DISPATCH_SOURCE)
  : join(root, 'scripts/run-solo-remote-correctness.mjs');
const source = await readFile(runnerPath, 'utf8');
const { bindSustainedJob, validateSustainedPlan } = await import(
  pathToFileURL(join(root, 'scripts/solo-remote-sustained.mjs')).href
);
const load = async (name) =>
  JSON.parse(await readFile(join(root, 'docs/performance', name), 'utf8'));
const next = await load('solo-next-geometric-c696-plan.json');

function actualSetup(text) {
  const tree = parse(text, { ecmaVersion: 'latest', sourceType: 'module' });
  const found = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (
      node.type === 'IfStatement' &&
      node.test.type === 'Identifier' &&
      node.test.name === 'extension' &&
      text.slice(node.start, node.end).includes('report.modePreparationCompletedAt')
    )
      found.push(node);
    for (const child of Object.values(node))
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === 'object') visit(child);
  };
  visit(tree);
  assert.equal(found.length, 1, 'Exercise the unique actual pre-dispatch block');
  const block = text.slice(found[0].start, found[0].end);
  return vm.runInNewContext(
    `(async function({extension, plan, ensureBaseline, inspect, adapter, context}) {
      let setupActive = true, modeState = null;
      const report = {};
      ${block}
      return {setupActive, modeState, report, context};
    })`,
    {},
    { timeout: 1000 },
  );
}
async function execute(text, plan, { extension = 'sustained', baselineError = null } = {}) {
  const calls = [];
  const methods = {
    sustained: 'prepareSustainedMode',
    offline: 'prepareOfflineMode',
    auxiliary: 'prepareAuxiliaryMode',
    supplemental: 'prepareSupplementalMode',
  };
  const adapter = {
    [methods[extension]]: async (context) => {
      calls.push('prepare');
      assert.equal(context.plan, plan);
      return 'prepared';
    },
  };
  let result = null,
    failure = null;
  try {
    result = await actualSetup(text)({
      extension,
      plan,
      adapter,
      context: { plan },
      ensureBaseline: async () => {
        calls.push('baseline');
        if (baselineError) throw baselineError;
      },
      inspect: async () => calls.push('inspect'),
    });
  } catch (error) {
    failure = error;
  }
  return { calls, result, failure };
}

test('actual pre-dispatch reaches all six admitted candidate-only modes without baseline acquisition', async () => {
  for (const engine of ['chromium', 'webkit'])
    for (const repetition of [1, 2, 3]) {
      const plan = bindSustainedJob(next, engine, repetition);
      validateSustainedPlan(plan);
      const observed = await execute(source, plan, {
        baselineError: new Error('Forbidden baseline acquisition'),
      });
      assert.equal(observed.failure, null, `${engine}/${repetition}`);
      assert.deepEqual(observed.calls, ['inspect', 'prepare']);
      assert.equal(observed.result.setupActive, false);
      assert.equal(observed.result.context.modeState, 'prepared');
      assert(observed.result.report.modePreparationCompletedAt);
    }
});

test('all paired historical lifecycle plans still acquire baseline before inspection and preparation', async () => {
  for (const name of [
    'solo-final-next-plan.json',
    'solo-final-retry-plan.json',
    'solo-final-long29-plan.json',
    'solo-final-soak-plan.json',
  ]) {
    const manifest = await load(name);
    for (const engine of ['chromium', 'webkit'])
      for (const repetition of [1, 2, 3]) {
        const plan = bindSustainedJob(manifest, engine, repetition);
        validateSustainedPlan(plan);
        assert(plan.rows.some((row) => row.source === 'baseline'));
        const observed = await execute(source, plan);
        assert.equal(observed.failure, null, name);
        assert.deepEqual(observed.calls, ['baseline', 'inspect', 'prepare']);
      }
  }
});

test('baseline failure stops the real paired setup boundary before inspection or adapter preparation', async () => {
  const plan = bindSustainedJob(await load('solo-final-next-plan.json'), 'webkit', 2);
  const error = new Error('retained baseline rejection');
  const observed = await execute(source, plan, { baselineError: error });
  assert.equal(observed.failure, error);
  assert.deepEqual(observed.calls, ['baseline']);
});

test('existing diagnostics and other adapter baseline-dispatch rules stay unchanged', async () => {
  for (const [extension, plan, expected] of [
    ['sustained', { phase: 'diagnostics', rows: [{ source: 'baseline' }] }, ['inspect', 'prepare']],
    [
      'offline',
      { rows: [{ source: 'baseline' }], offline: { gameplay: false } },
      ['baseline', 'prepare'],
    ],
    [
      'auxiliary',
      { rows: [{ source: 'candidate' }, { source: 'baseline' }] },
      ['baseline', 'inspect', 'prepare'],
    ],
    ['supplemental', { rows: [{ source: 'candidate' }] }, ['inspect', 'prepare']],
  ]) {
    const observed = await execute(source, plan, { extension });
    assert.equal(observed.failure, null);
    assert.deepEqual(observed.calls, expected);
  }
});

test('removing the row guard from the real block reproduces the observed eager-baseline rejection', async () => {
  const pattern =
    /\(extension === 'sustained' &&\s*plan\.phase !== 'diagnostics' &&\s*plan\.rows\.some\(\(row\) => row\.source === 'baseline'\)\)/;
  assert(pattern.test(source), 'Require the reviewed row guard in the actual source');
  const prior = source.replace(
    pattern,
    "(extension === 'sustained' && plan.phase !== 'diagnostics')",
  );
  const plan = bindSustainedJob(next, 'chromium', 1),
    error = new Error('Forbidden baseline acquisition');
  const observed = await execute(prior, plan, { baselineError: error });
  assert.equal(observed.failure, error);
  assert.deepEqual(observed.calls, ['baseline']);
});
