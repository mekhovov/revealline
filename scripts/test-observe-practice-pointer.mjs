import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import {
  PRACTICE_POINTER_PROTOCOL,
  validatePracticePointerPlan,
  practicePointerCases,
  activatePracticeTarget,
  installPointerWitness,
  validatePointerExport,
  observePracticePointer,
  acquirePointerResource,
} from './observe-practice-pointer.mjs';

const plan = () => ({
  format: 'revealline-practice-pointer-plan.v1',
  protocol: PRACTICE_POINTER_PROTOCOL.id,
  caseId: 'unit-fixture',
  deviceLabel: 'Unit fixture; no device evidence',
  quietWindow: 'No browser run',
  locales: ['en', 'uk'],
  bundle: '.',
  envelopeSha256: 'a'.repeat(64),
  sourceRevision: 'b'.repeat(40),
  sourceTree: 'c'.repeat(40),
  packageRevision: 'd'.repeat(64),
});

test('pointer plan requires exact binding, bounded labels and an explicit locale matrix', () => {
  assert.deepEqual(validatePracticePointerPlan(plan()), plan());
  for (const change of [
    { sourceRevision: 'main' },
    { packageRevision: [] },
    { locales: [] },
    { locales: ['en', 'en'] },
    { locales: ['fr'] },
    { script: 'change app state' },
    { password: 'not allowed' },
    { format: 'revealline-fpv-runtime-plan.v1' },
    { quietWindow: '' },
    { deviceLabel: 'x'.repeat(257) },
  ])
    assert.throws(() => validatePracticePointerPlan({ ...plan(), ...change }));
  assert.throws(() => validatePracticePointerPlan(' '.repeat(65537)));
});

test('matrix isolates every target, modality, visit and locale; single locale is explicitly narrower', () => {
  const cases = practicePointerCases(['en', 'uk']);
  assert.equal(cases.length, 24);
  assert.equal(new Set(cases.map((row) => row.id)).size, 24);
  for (const locale of ['en', 'uk'])
    for (const modality of ['pointer', 'keyboard'])
      for (const visit of ['fresh', 'reload'])
        assert.deepEqual(
          cases
            .filter((r) => r.locale === locale && r.modality === modality && r.visit === visit)
            .map((r) => r.target),
          ['workshop', 'profile', 'proof'],
        );
  assert.equal(practicePointerCases(['en']).length, 12);
});

function inputFixture({ focused = false, reachable = true } = {}) {
  const calls = [];
  const locator = {
    waitFor: async () => calls.push('visible'),
    scrollIntoViewIfNeeded: async () => calls.push('scroll'),
    evaluate: async (fn) => (fn.toString().includes('node ===') ? focused : {}),
    boundingBox: async () => ({ x: 10, y: 20, width: 100, height: 40 }),
    focus: () => assert.fail('Never programmatically focus a measured target'),
    click: () => assert.fail('Never force or retry a locator click'),
  };
  const page = {
    mouse: {
      move: async (...xy) => calls.push(['move', ...xy]),
      down: async () => calls.push('down'),
      up: async () => calls.push('up'),
    },
    keyboard: {
      press: async (key) => {
        calls.push(key);
        if (reachable) focused = true;
      },
    },
  };
  return { page, locator, calls };
}

test('pointer emits exactly one ordinary press at one coordinate without focus or retry', async () => {
  const f = inputFixture(),
    action = {};
  await activatePracticeTarget(f.page, f.locator, 'pointer', action);
  assert.deepEqual(f.calls, ['visible', 'scroll', ['move', 60, 40], 'down', 'up']);
  assert.deepEqual(action.coordinate, { x: 60, y: 40 });
});

test('keyboard reaches target with Tab then Enter, independently of mouse and with bounded traversal', async () => {
  const f = inputFixture(),
    action = {};
  await activatePracticeTarget(f.page, f.locator, 'keyboard', action);
  assert.deepEqual(f.calls, ['visible', 'scroll', 'Tab', 'Enter']);
  assert.equal(action.tabs, 1);
  const unreachable = inputFixture({ reachable: false });
  await assert.rejects(
    activatePracticeTarget(unreachable.page, unreachable.locator, 'keyboard', {}),
    /160 Tab/,
  );
  assert.equal(unreachable.calls.filter((c) => c === 'Tab').length, 160);
  assert(!unreachable.calls.includes('Enter'));
});

test('passive witness records down/up target geometry and focus without altering input', () => {
  const listeners = new Map();
  const node = {
    tagName: 'SUMMARY',
    id: 'target',
    closest() {
      return this;
    },
    getBoundingClientRect: () => ({ x: 10, y: 20, width: 100, height: 40 }),
    getAttribute: () => null,
  };
  const document = {
    activeElement: node,
    visibilityState: 'visible',
    hasFocus: () => true,
    querySelector: () => null,
    addEventListener: (type, callback, options) => {
      assert.deepEqual(JSON.parse(JSON.stringify(options)), { capture: true, passive: true });
      listeners.set(type, callback);
    },
  };
  const context = { document };
  runInNewContext(`(${installPointerWitness.toString()})()`, context);
  context.__practicePointerWitness.intended = node;
  const event = {
    type: 'pointerdown',
    target: node,
    clientX: 60,
    clientY: 40,
    isTrusted: true,
    preventDefault: () => assert.fail('Passive witness must not cancel events'),
  };
  listeners.get('pointerdown')(event);
  node.getBoundingClientRect = () => ({ x: 10, y: 80, width: 100, height: 40 });
  listeners.get('pointerup')({ ...event, type: 'pointerup' });
  const events = context.__practicePointerWitness.events;
  assert.equal(events[0].target.rect.y, 20);
  assert.equal(events[1].intended.rect.y, 80);
  assert.equal(events[1].documentFocused, true);
  for (let i = 0; i < 40; i++) listeners.get('click')({ ...event, type: 'click' });
  assert.equal(events.length, 32);
  assert.equal(context.__practicePointerWitness.dropped, 10);
});

test('exports require bounded real profile or pristine notebook backup formats, not attempt downloads', () => {
  const buffer = (value) => Buffer.from(JSON.stringify(value));
  assert.equal(
    validatePointerExport(buffer({ format: 'FlightProfiles.v2' }), 'profile').format,
    'FlightProfiles.v2',
  );
  assert.equal(
    validatePointerExport(buffer({ format: 'FlightProofBackup.v1', attempts: [] }), 'proof').format,
    'FlightProofBackup.v1',
  );
  for (const value of [
    { format: 'FlightAttempt.v1' },
    { format: 'FlightRecording.v1' },
    { format: 'FlightProofBackup.v1', attempts: [{}] },
  ])
    assert.throws(() => validatePointerExport(buffer(value), 'proof'));
  assert.throws(() => validatePointerExport(Buffer.alloc(65537), 'profile'));
  assert.throws(() => validatePointerExport(Buffer.alloc(0), 'proof'));
});

test('failed admission is retained before browser import; existing evidence is never overwritten', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'practice-pointer-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const planFile = path.join(root, 'plan.json'),
    output = path.join(root, 'evidence');
  await writeFile(planFile, JSON.stringify(plan()));
  await writeFile(path.join(root, 'optional-packages.json'), '{}');
  const report = await observePracticePointer({
    planFile,
    output,
    playwrightModule: '/must-not-be-imported.mjs',
    password: 'unit-private-value',
  });
  assert.equal(report.completed, false);
  assert.equal(report.qualified, false);
  assert.equal(report.cases.length, 0);
  assert.match(report.failure, /Envelope differs/);
  assert.equal(report.cleanup.completed, true);
  const original = await readFile(path.join(output, 'observation.json'), 'utf8');
  assert(!original.includes('unit-private-value'));
  assert.deepEqual(JSON.parse(original), report);
  await assert.rejects(observePracticePointer({ planFile, output, playwrightModule: '/unused' }), {
    code: 'EEXIST',
  });
  assert.equal(await readFile(path.join(output, 'observation.json'), 'utf8'), original);
});

test('timed-out browser allocation retains pending ownership and closes a late resource', async () => {
  const records = [];
  let resolve,
    closed = 0;
  const pending = acquirePointerResource(
    records,
    'context',
    () =>
      new Promise((finish) => {
        resolve = finish;
      }),
    async () => {
      closed++;
    },
    5,
  );
  await assert.rejects(pending, /timed out/);
  assert.equal(records[0].pending, true);
  assert.equal(records[0].timedOut, true);
  resolve({});
  await new Promise((finish) => setImmediate(finish));
  assert.equal(closed, 1);
  assert.equal(records[0].pending, false);
  assert.equal(records[0].lateClosed, true);
});

test('observer serves original entry and uses ordinary notebook controls without simulator hooks', async () => {
  const source = await readFile(new URL('./observe-practice-pointer.mjs', import.meta.url), 'utf8');
  assert(source.includes("new URL(PREFIX + 'index.html', served.url)"));
  assert(source.includes("'#notebook-button'"));
  assert(source.includes('Export verified flight proofs'));
  assert(!source.includes('#export-attempt'));
  for (const forbidden of ['dispatchEvent(', '.showModal(', '.mountFlightApp(', 'storageState:'])
    assert(!source.includes(forbidden), forbidden);
});

test('failed late resource closure remains unverified even after allocation settles', async () => {
  const records = [];
  let resolve;
  await assert.rejects(
    acquirePointerResource(
      records,
      'context',
      () =>
        new Promise((finish) => {
          resolve = finish;
        }),
      async () => {
        throw new Error('close failed');
      },
      5,
    ),
    /timed out/,
  );
  resolve({});
  await new Promise((finish) => setImmediate(finish));
  assert.equal(records[0].pending, false);
  assert.equal(records[0].timedOut, true);
  assert.equal(records[0].lateClosed, false);
  assert.equal(records[0].lateCloseError, 'close failed');
  assert(records.some((row) => row.pending || (row.timedOut && !row.lateClosed)));
});
