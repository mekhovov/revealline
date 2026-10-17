import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { parse } from 'acorn';

const root = process.cwd();
const adapterPath = resolve(
  process.env.SOLO_READINESS_DISPATCH_ADAPTER ?? join(root, 'scripts/solo-remote-readiness.mjs'),
);
const adapterSource = await readFile(adapterPath, 'utf8');
const adapter = await import(pathToFileURL(adapterPath).href);
const runnerSource = await readFile(join(root, 'scripts/run-solo-remote-correctness.mjs'), 'utf8');
const manifest = JSON.parse(
  await readFile(join(root, 'docs/performance/solo-readiness-preparation-e1cc-plan.json'), 'utf8'),
);
function nodes(source, predicate) {
  const found = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (predicate(node)) found.push(node);
    for (const child of Object.values(node))
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === 'object') visit(child);
  };
  visit(parse(source, { ecmaVersion: 'latest', sourceType: 'module' }));
  return found;
}
function actualDispatch() {
  const loops = nodes(
    runnerSource,
    (n) =>
      n.type === 'ForOfStatement' &&
      runnerSource.slice(n.right.start, n.right.end) === 'report.rows',
  );
  assert.equal(loops.length, 1, 'Unique actual runner row dispatch');
  const body = loops[0].body.body;
  const attempt = body.findIndex((n) => n.type === 'TryStatement');
  assert(attempt > 0);
  const statements = body[attempt].block.body;
  const branch = statements.findIndex(
    (n) => n.type === 'IfStatement' && n.test.name === 'extension',
  );
  assert(branch > 0);
  const source =
    body
      .slice(0, attempt)
      .map((n) => runnerSource.slice(n.start, n.end))
      .join('\n') +
    '\n' +
    statements
      .slice(0, branch)
      .map((n) => runnerSource.slice(n.start, n.end))
      .join('\n') +
    '\n' +
    runnerSource.slice(statements[branch].consequent.start, statements[branch].consequent.end);
  return vm.runInNewContext(
    `(async function({row, report, plan, adapter, context, inspect, sourceIdentity, progress}) {
    const extension = 'readiness', admitted = {artifacts:{}}, evidence = '/evidence', repository = '/tools';
    const sources = {baseline:'/baseline', candidate:'/candidate'}, GiB = 1024 ** 3;
    const mkdir = async () => {}, lstat = async () => ({isDirectory:()=>true,dev:1,ino:2});
    const statfs = async () => ({bavail:2048,bsize:1024 ** 2});
    const scratchRowPath = (_path, index) => '/scratch/r' + index;
    ${source}
  })`,
    { assert, join },
    { timeout: 1000 },
  );
}
const dispatch = actualDispatch();
async function execute(engine, { mutate = null, invoke = null } = {}) {
  const plan = adapter.bindReadinessJob(manifest, engine);
  const report = {
    rows: structuredClone(plan.rows),
    scratchOwner: { path: '/scratch', device: 1, inode: 2 },
    tooling: { revision: 'tools' },
  };
  const outputs = [],
    calls = [];
  for (const row of report.rows) {
    await dispatch({
      row,
      report,
      plan,
      context: { plan },
      inspect: async () => calls.push('inspect'),
      sourceIdentity: async (path, revision) => calls.push([path, revision]),
      progress: (event, id) => calls.push([event, id]),
      adapter: {
        runReadinessRow: async (ctx, live, dir, tmp) => {
          assert.equal(ctx.plan, plan);
          assert.equal(live, row);
          assert.equal(dir, '/evidence/' + row.id);
          assert.equal(tmp, '/scratch/r' + report.rows.indexOf(row));
          assert.equal(live.status, 'failed');
          assert.match(live.startedAt, /^\d{4}-\d\d-\d\dT/);
          assert.equal(live.storage.minimumRemainingBytes, 1024 ** 3);
          assert.deepEqual(calls.slice(-4), [
            'inspect',
            ['/tools', 'tools'],
            ['/baseline', plan.baseline.revision],
            ['/candidate', plan.candidate.revision],
          ]);
          if (mutate) mutate(live);
          const before = structuredClone(live);
          const selected = adapter.readinessRowPlan(plan, live);
          assert.deepEqual(
            structuredClone(live),
            before,
            'Admission does not rewrite the live report',
          );
          if (invoke) await invoke(plan, live, selected);
          outputs.push(selected);
        },
      },
    });
  }
  return { plan, report, outputs };
}

test('actual common runner enrichment reaches all twelve exact preparation row plans', async () => {
  for (const engine of ['chromium', 'webkit']) {
    const { plan, report, outputs } = await execute(engine);
    assert.deepEqual(
      outputs.map((p) => p.phase),
      adapter.PREPARATION_READINESS_PHASES,
    );
    for (let i = 0; i < outputs.length; i++) {
      assert.deepEqual(outputs[i], adapter.readinessRowPlan(plan, plan.rows[i]));
      assert.deepEqual(
        Object.keys(report.rows[i]).sort(),
        [...Object.keys(plan.rows[i]), 'storage', 'startedAt', 'status'].sort(),
      );
      assert.equal(outputs[i].protocol.observationTimeoutMs, 240000);
      assert.equal(outputs[i].protocol.performanceQualification, false);
    }
  }
});

test('declared row mutations and undeclared metadata fail at actual enriched dispatch', async () => {
  for (const [key, value] of Object.entries({
    id: 'other',
    kind: 'first30',
    source: 'baseline',
    engine: 'firefox',
    timeoutMs: 480001,
    performanceExclusion: false,
    phase: 'saved-resume',
  }))
    for (const engine of ['chromium', 'webkit'])
      await assert.rejects(
        execute(engine, {
          mutate: (row) => {
            row[key] = value;
          },
        }),
        /Undeclared|Expected|Assertion/,
      );
  for (const key of [
    'fixture',
    'protocol',
    'served',
    'artifactAdmission',
    'unknown',
    'completedAt',
  ])
    await assert.rejects(
      execute('webkit', {
        mutate: (row) => {
          row[key] = {};
        },
      }),
      /Unexpected row field/,
    );
  for (const key of Object.keys(adapter.preparationReadinessRows('chromium')[0]))
    await assert.rejects(
      execute('chromium', {
        mutate: (row) => {
          delete row[key];
        },
      }),
    );
});

test('actual native command assembly reuses the admitted canonical plan after adapter metadata is added', async () => {
  const assignments = nodes(
    adapterSource,
    (n) =>
      n.type === 'AssignmentExpression' &&
      adapterSource.slice(n.left.start, n.left.end) === 'row.command' &&
      adapterSource.slice(n.right.start, n.right.end).startsWith('await ctx.run('),
  );
  assert.equal(assignments.length, 1);
  const actual = vm.runInNewContext(
    `(async function({ctx,row,activePlan,dir,url,readinessArguments,preparationPlan}) {
    const tmp='/scratch';
    ${adapterSource.slice(assignments[0].start, assignments[0].end)};
  })`,
    { process, join },
    { timeout: 1000 },
  );
  for (const engine of ['chromium', 'webkit'])
    await execute(engine, {
      invoke: async (plan, row, activePlan) => {
        row.served = { url: 'http://127.0.0.1:1/game/' };
        row.artifactAdmission = { status: 'passed' };
        let count = 0;
        await actual({
          ctx: {
            plan,
            here: '/tools/scripts',
            repository: root,
            cleanEnv: {},
            run: async (id, args, timeout, options) => {
              count++;
              assert.equal(id, row.id);
              assert.equal(timeout, 480000);
              assert.equal(options.env.TMPDIR, '/scratch');
              assert.deepEqual(Array.from(args), [
                process.execPath,
                ...adapter.readinessArguments(
                  { plan: activePlan, here: '/tools/scripts', repository: root },
                  row,
                  row.served.url,
                  '/evidence',
                ),
              ]);
              assert(args.includes('--source-revision=' + manifest.candidate.revision));
              assert(args.includes('--readiness-probe=' + activePlan.protocol.name));
              return { status: 'not-executed-test-boundary' };
            },
          },
          row,
          activePlan,
          dir: '/evidence',
          url: row.served.url,
          readinessArguments: adapter.readinessArguments,
          preparationPlan: (p) => p.sourceCohort === adapter.PREPARATION_READINESS_COHORT,
        });
        assert.equal(count, 1);
      },
    });
});

test('restoring the historical whole-object comparison reproduces the observed dispatch rejection', async () => {
  const legacyPath = join(root, 'scripts/solo-remote-readiness.mjs');
  const legacy = await import(pathToFileURL(legacyPath).href);
  // This control is source-independent after integration: restore only the
  // rejected comparison in the actual canonical selection body.
  const functions = nodes(
    adapterSource,
    (n) => n.type === 'FunctionDeclaration' && n.id?.name === 'preparationRowPlan',
  );
  assert.equal(functions.length, 1);
  const fn = functions[0];
  const afterExpected = fn.body.body[0].end;
  const restore =
    adapterSource.slice(fn.start, afterExpected) +
    "\nassert.deepEqual(row, expected, 'Exact preparation row');\nreturn expected;\n}";
  const old = vm.runInNewContext(
    '(' + restore + ')',
    { assert, preparationReadinessRows: legacy.preparationReadinessRows },
    { timeout: 1000 },
  );
  for (const engine of ['chromium', 'webkit'])
    await execute(engine, {
      invoke: async (plan, row) => assert.throws(() => old(plan, row), /Exact preparation row/),
    });
});
