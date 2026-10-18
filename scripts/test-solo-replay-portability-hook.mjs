import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import {
  validatePortabilityPlan,
  validatePortabilityMetadata,
} from './run-solo-replay-portability.mjs';
import { loadReplayPortabilityCase } from './solo-replay-portability-diagnostic.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const plan = JSON.parse(
  await readFile(
    new URL('../docs/performance/solo-replay-portability-797-plan.json', import.meta.url),
  ),
);
const { fixture } = await loadReplayPortabilityCase('baseline-first30-chromium');
test('fixed companion declaration admits only original four records/packages/Node and whole-row bound', () => {
  validatePortabilityPlan(plan, fixture);
  for (const change of [
    (p) => {
      p.records.reverse();
    },
    (p) => {
      p.records.push('another');
    },
    (p) => {
      p.status = 'held';
    },
    (p) => {
      p.rowTimeoutMs++;
    },
    (p) => {
      p.helperTimeoutMs++;
    },
    (p) => {
      p.node = '22.22.2';
    },
    (p) => {
      p.candidate.artifact++;
    },
    (p) => {
      p.candidate.inner.bytes++;
    },
    (p) => {
      p.candidate.revision = '0'.repeat(40);
    },
    (p) => {
      p.baseline.reusableArtifact.artifact++;
    },
    (p) => {
      p.baseline.reusableArtifact.ready.sha256 = '0'.repeat(64);
    },
    (p) => {
      p.sourceArtifact++;
    },
    (p) => {
      p.automaticRetries = 1;
    },
    (p) => {
      p.performanceExclusion = false;
    },
    (p) => {
      p.concurrency = 2;
    },
  ]) {
    const changed = structuredClone(plan);
    change(changed);
    assert.throws(() => validatePortabilityPlan(changed, fixture));
  }
});
async function actualRow({
  preparationFailure = false,
  cleanupFailure = false,
  exhausted = false,
  diagnosticFailure = false,
} = {}) {
  const source = await readFile(
    new URL('./run-solo-replay-portability.mjs', import.meta.url),
    'utf8',
  );
  const start = source.indexOf('async function rowChild(');
  const end = source.indexOf('\nasync function run(', start);
  let body = source.slice(start, end);
  const needle = 'await import(browserModule)';
  assert.equal(body.split(needle).length, 2);
  body = body.replace(needle, 'await loadPlaywright()');
  const state = { events: [], writes: [], elapsed: 0, exitCode: null };
  const { fixture: fixed, row } = await loadReplayPortabilityCase('candidate-first30-chromium');
  const fakeProcess = {
    version: 'v22.13.1',
    platform: 'linux',
    env: {
      SOLO_REMOTE_OWNER: 'modeled-owner',
      RUNNER_TEMP: '/modeled',
      SOLO_PLAYWRIGHT_MODULE: '/modeled/solo-browser-tools/node_modules/playwright/index.mjs',
    },
  };
  const fn = vm.runInNewContext('(' + body + ')', {
    assert,
    Buffer,
    URL,
    join,
    dirname,
    resolve,
    planPath: join(root, 'docs/performance/solo-replay-portability-797-plan.json'),
    MiB: 1024 ** 2,
    performance: { now: () => state.elapsed },
    process: fakeProcess,
    hash: () => '1'.repeat(64),
    PUBLIC_SECURITY_HEADERS: { 'Content-Security-Policy': 'modeled' },
    json: async () => plan,
    validatePortabilityPlan: (value) => validatePortabilityPlan(value, fixed),
    loadReplayPortabilityCase: async () => ({ fixture: fixed, row }),
    createReplayPortabilityReference: async (id, text) => {
      state.events.push('reference');
      assert.equal(id, row.id);
      assert.equal(text, row.recording.text);
      if (preparationFailure) throw new Error('reference preparation failed');
      state.elapsed = exhausted ? 120001 : 8000;
      return '{"modeled-reference":true}';
    },
    exclusive: async (path, value, maximum) => {
      const bytes = Buffer.byteLength(typeof value === 'string' ? value : JSON.stringify(value));
      assert(bytes <= maximum);
      state.writes.push({ path, value, maximum });
      return { bytes, sha256: '2'.repeat(64) };
    },
    readFile: async (path) =>
      Buffer.from(
        JSON.stringify(
          path.endsWith('playwright/package.json')
            ? { name: 'playwright', version: '1.62.1' }
            : { sourceRevision: row.sourceRevision },
        ),
      ),
    startProductionPreview: async () => {
      state.events.push('server');
      return {
        mode: 'generated-build',
        url: 'http://127.0.0.1:1234/',
        server: {
          close: (done) => done(cleanupFailure ? new Error('server close failed') : null),
          closeAllConnections: () => state.events.push('closed'),
        },
      };
    },
    loadPlaywright: async () => {
      state.events.push('playwright');
      return { chromium: { executablePath: () => '/modeled/chromium' } };
    },
    diagnoseNativeReplayPortability: async (options) => {
      state.events.push('native');
      assert.equal(options.timeoutMs, 112000);
      assert.equal(options.portabilityDiagnostic.referenceText, '{"modeled-reference":true}');
      return { status: diagnosticFailure ? 'incomplete' : 'complete', strictVerdictChanged: false };
    },
  });
  await fn(row.id, '/modeled/payload', '/modeled/evidence');
  return {
    state,
    exitCode: fakeProcess.exitCode,
    result: state.writes.find((entry) => entry.path.endsWith('/diagnostic.json')).value,
  };
}
test('actual row creates and retains its own reference before native work under the remaining120s budget', async () => {
  const { state, result, exitCode } = await actualRow();
  assert.deepEqual(state.events, ['reference', 'server', 'playwright', 'native', 'closed']);
  assert.equal(result.status, 'complete');
  assert.equal(exitCode, 0);
  const receipt = state.writes.find((entry) => entry.path.endsWith('reference-receipt.json')).value;
  assert.equal(receipt.originalMismatchReproduced, true);
  assert.equal(receipt.node, 'v22.13.1');
  assert.equal(receipt.sourceChecks, 'exact47-before-and-after');
  assert.equal(state.writes[0].maximum, 2 * 1024 * 1024);
});
test('actual row retains preparation failure and never starts a browser without a reproduced reference', async () => {
  const { state, result, exitCode } = await actualRow({ preparationFailure: true });
  assert.deepEqual(state.events, ['reference']);
  assert.equal(result.status, 'incomplete');
  assert.equal(exitCode, 1);
  assert.match(result.failure, /reference preparation failed/);
});
test('actual row exhausted preparation, diagnostic failure or server cleanup failure stays failed', async () => {
  for (const options of [
    { exhausted: true },
    { diagnosticFailure: true },
    { cleanupFailure: true },
  ]) {
    const { state, result, exitCode } = await actualRow(options);
    assert.equal(result.status, 'incomplete');
    assert.equal(exitCode, 1);
    if (options.exhausted) assert(!state.events.includes('native'));
    if (options.cleanupFailure) assert.match(result.serverCleanupFailure, /server close failed/);
  }
});
test('fixed native workflow source controls run exact Node before main-only manual companion admission', async () => {
  const workflow = await readFile(
    new URL('../.github/workflows/solo-native-package-consumer.yml', import.meta.url),
    'utf8',
  );
  const source = workflow
    .split('\n  replay-portability-source:\n')[1]
    ?.split('\n  replay-portability:\n')[0];
  const native = workflow.split('\n  replay-portability:\n')[1];
  assert(source && native);
  assert.match(workflow, /types:\s*\[opened,\s*synchronize\]/);
  for (const field of [
    'SoloReplayPortabilitySourceReceiptV1',
    'sourceRevision',
    'sourceTree',
    'githubSHA',
    'pullRequestHead',
    'pullRequestBase',
    'GITHUB_RUN_ID',
    'GITHUB_RUN_ATTEMPT',
  ]) {
    assert(source.includes(field), 'Missing source-only identity field: ' + field);
  }
  assert(source.includes("node == 'v22.13.1'"));
  assert(source.includes("revision == os.environ['GITHUB_SHA']"));
  assert(source.includes("['source.json','npm.log','source-controls.tap']"));

  assert.match(source, /node-version: '22\.13\.1'/);
  assert.match(
    source,
    /node --test --test-concurrency=1 scripts\/solo-replay-portability-diagnostic\.test\.mjs scripts\/test-solo-replay-portability-hook\.mjs/,
  );
  assert.match(native, /needs: replay-portability-source/);
  for (const term of [
    "github.repository == 'mekhovov/revealline'",
    "github.event_name == 'workflow_dispatch'",
    "github.ref == 'refs/heads/main'",
    "inputs.lane == 'replay-portability'",
  ])
    assert(native.includes(term));
  assert.match(native, /78m node scripts\/run-solo-replay-portability\.mjs run/);
  assert(!/inputs\.(?:source|artifact|recording|reference|timeout)/.test(native));
  assert.match(native, /if: \$\{\{ always\(\) \}\}/);
});

test('actual metadata boundary rejects changed producer/source/artifact before any download', () => {
  for (const role of ['baseline', 'candidate']) {
    const pin = role === 'baseline' ? plan.baseline.reusableArtifact : plan.candidate;
    const head = role === 'baseline' ? pin.producer.toolingRevision : pin.revision;
    const run = {
      repository: { full_name: plan.repository },
      head_sha: head,
      status: 'completed',
      conclusion: role === 'baseline' ? 'failure' : 'success',
      path:
        role === 'baseline' ? pin.producer.workflow : '.github/workflows/appearance-preview.yml',
      run_attempt: 1,
    };
    const artifact = {
      workflow_run: { id: pin.run, head_sha: head },
      name: pin.name,
      size_in_bytes: pin.outer.bytes,
      digest: 'sha256:' + pin.outer.sha256,
      expired: false,
    };
    validatePortabilityMetadata(plan, role, run, artifact);
    for (const mutate of [
      (r) => {
        r.repository.full_name = 'another/repository';
      },
      (r) => {
        r.head_sha = '0'.repeat(40);
      },
      (r) => {
        r.status = 'in_progress';
      },
      (r) => {
        r.conclusion = 'cancelled';
      },
      (r) => {
        r.path = 'another.yml';
      },
      (r) => {
        r.run_attempt++;
      },
      (_r, a) => {
        a.workflow_run.id++;
      },
      (_r, a) => {
        a.workflow_run.head_sha = '0'.repeat(40);
      },
      (_r, a) => {
        a.size_in_bytes++;
      },
      (_r, a) => {
        a.digest = 'sha256:' + '0'.repeat(64);
      },
      (_r, a) => {
        a.expired = true;
      },
    ]) {
      const r = structuredClone(run),
        a = structuredClone(artifact);
      mutate(r, a);
      assert.throws(() => validatePortabilityMetadata(plan, role, r, a));
    }
  }
});
