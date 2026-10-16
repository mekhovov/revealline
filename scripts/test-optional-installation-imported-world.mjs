/** Synthetic public UI adapter fixtures only, not browser acceptance. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PACK, expectedC4AssetFingerprint } from './practice-imported-world-check.mjs';
import {
  selectImportedWorldMode,
  importedWorldAuthority,
  importRetainedC4World,
  verifyRetainedC4World,
  parseImportedWorldHUD,
  flyRetainedC4WorldOffline,
} from './optional-installation-imported-world.mjs';
const digest = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const store = (name, rows) => ({ name, rows, count: rows.length, sha256: digest(rows) });
const row = (n) => ({ key: digest(n), sha256: digest({ n }) });
const database = () => ({
  name: 'revealline-fpv-worlds-v1',
  version: 1,
  stores: [
    store('projects', [row(1), row(2)]),
    store('revisions', [row(3), row(4)]),
    store('assets', [expectedC4AssetFingerprint()]),
  ],
});
const baseline = () => ({
  card: { id: PACK.id, title: PACK.title, digestPrefix: PACK.sha256.slice(0, 12) },
  database: database(),
});
const URL =
  'http://127.0.0.1:3210/practice/fpv-worlds/releases/v0.160.0/site/optional-practice/fpv-worlds/index.html?lang=en';
const hud = (height = 0, phase = 'paused') => ({
  locale: 'en',
  source: 'keyboard',
  preset: 'two-stick',
  mode: 'self-level',
  title: 'Roadworks Practice Park · discovery',
  visible: true,
  focused: true,
  details: `Height ${height} m · 3–5 m`,
  gauge: 'Height',
  phase,
});
function fixture({
  imported = true,
  delayed = false,
  failUpload = false,
  wrongGauge = false,
} = {}) {
  const calls = [];
  let phase = 'paused',
    height = 0,
    down = false;
  const page = {
    url: () => URL,
    waitForEvent: async (event) => {
      assert.equal(event, 'filechooser');
      return {
        setFiles: async (file) => {
          calls.push(['upload', 'native file chooser', file.name]);
          if (failUpload) throw Error('Native upload failed');
          imported = true;
        },
      };
    },
    keyboard: {
      press: async (key) => {
        calls.push(['key', key]);
        phase = phase === 'active' ? 'paused' : 'active';
      },
      down: async (key) => {
        calls.push(['down', key]);
        down = true;
      },
      up: async (key) => {
        calls.push(['up', key]);
        down = false;
      },
    },
    waitForTimeout: async (ms) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      if (down && phase === 'active') height = 0.2;
    },
    evaluate: async () => ({ ...hud(height, phase), ...(wrongGauge ? { gauge: 'Speed' } : {}) }),
    locator(selector) {
      return {
        waitFor: async () => {
          calls.push(['visible', selector]);
          if (delayed) await new Promise((resolve) => setTimeout(resolve, 40));
        },
        isEnabled: async () => true,
        press: async (value) => {
          calls.push(['press', selector, value]);
        },
        selectOption: async (value) => {
          calls.push(['select', selector, value]);
        },
        setInputFiles: async (file) => {
          calls.push(['upload', selector, file.name]);
          if (failUpload) throw Error('Native upload failed');
          imported = true;
        },
        click: async () => {
          calls.push(['click', selector]);
        },
        count: async () => (imported ? 1 : 0),
        getAttribute: async (name) => (name === 'data-pack-id' ? PACK.id : null),
        innerText: async () =>
          selector.endsWith('strong')
            ? PACK.title
            : selector.endsWith('small')
              ? `1 challenges · ${PACK.sha256.slice(0, 12)}`
              : 'Ready. Choose your controls, then arm.',
        locator: (child) => page.locator(`${selector} ${child}`),
        getByRole: (role, options) => {
          assert.equal(role, 'button');
          assert.deepEqual(options, { name: 'Fly', exact: true });
          return page.locator('card:Fly');
        },
      };
    },
  };
  return { page, calls };
}
function options(extra = {}) {
  return {
    deadlineAt: Date.now() + 10000,
    requireActive() {},
    expectedURL: URL,
    receipt: {},
    readDatabase: async () => database(),
    baseline: baseline(),
    capture: async (step) => ({ path: `test-only-${step}.png`, bytes: 10, sha256: 'a'.repeat(64) }),
    ...extra,
  };
}
test('strict separate opt-in and exact authority paths', () => {
  assert.equal(selectImportedWorldMode(undefined), false);
  assert.equal(selectImportedWorldMode('roadworks-offline-flight', { worldSeed: true }), true);
  for (const input of [
    {},
    { worldSeed: true, historical: true },
    { worldSeed: true, download: 'all-short' },
  ])
    assert.throws(() => selectImportedWorldMode('roadworks-offline-flight', input));
  assert.throws(() => selectImportedWorldMode('all', { worldSeed: true }));
});
test('actual committed bytes import through public chooser and visible card', async () => {
  const bytes = await readFile(PACK.path),
    { page, calls } = fixture({ imported: false }),
    opts = options({ packBytes: bytes });
  const files = new Map(
    await Promise.all(
      ['world-app', 'world-content', 'world-store', 'sim-presentation'].map(async (name) => {
        const path = `optional-practice/civilian-fpv/${name}.mjs`;
        return [path, await readFile(path)];
      }),
    ),
  );
  assert.equal(importedWorldAuthority(files, bytes).runtime.length, 4);
  await importRetainedC4World(page, opts);
  assert(opts.receipt.imported && opts.receipt.cleanup.completed);
  assert.deepEqual(
    calls.filter((r) => r[0] === 'press').map((r) => r[1]),
    ['#worlds-shell-action-settings', '#worlds-settings-tab-content', '[data-tab="packs"]'],
  );
  assert.deepEqual(
    calls.find((r) => r[0] === 'upload'),
    ['upload', 'native file chooser', 'cc0-road-lab.r1.rlpack'],
  );
  assert(calls.some((r) => r[0] === 'click' && r[1] === 'label:has(#import-pack)'));
  assert.throws(() => importedWorldAuthority(new Map(), bytes));
});
test('upload failure and pre-abort do not claim imported state', async () => {
  const bytes = await readFile(PACK.path),
    a = fixture({ imported: false, failUpload: true }),
    opts = options({ packBytes: bytes });
  await assert.rejects(importRetainedC4World(a.page, opts), /upload failed/);
  assert(!opts.receipt.imported);
  assert(opts.receipt.cleanup.completed);
  const signal = AbortSignal.abort(),
    b = fixture(),
    aborted = options({ signal });
  await assert.rejects(verifyRetainedC4World(b.page, aborted));
  assert.equal(b.calls.length, 0);
});
test('rechecks shared deadline after visibility, no late activation', async () => {
  const { page, calls } = fixture({ delayed: true }),
    opts = options({ deadlineAt: Date.now() + 15 });
  await assert.rejects(verifyRetainedC4World(page, opts));
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(
    calls.some((r) => r[0] === 'press'),
    false,
  );
  assert.equal(opts.receipt.cleanup.completed, false);
});
test('retention uses existing Library without duplicate navigation when requested', async () => {
  const { page, calls } = fixture(),
    opts = options({ libraryAlreadyOpen: true });
  await verifyRetainedC4World(page, opts);
  assert(opts.receipt.passed && opts.receipt.cleanup.completed);
  assert.equal(
    calls.some((r) => r[0] === 'press'),
    false,
  );
});
test('maintained height parser rejects hidden, wrong-course, mode, focus or overshoot', () => {
  assert.equal(parseImportedWorldHUD(hud(0.2, 'active')).height, 0.2);
  for (const change of [
    { visible: false },
    { focused: false },
    { mode: 'acro' },
    { gauge: 'Speed' },
    { title: 'Lift and land' },
    { details: 'Height 1 m · 3–5 m' },
    { details: 'Height 0.2 m · 1.2–2.4 m' },
  ])
    assert.throws(() => parseImportedWorldHUD({ ...hud(), ...change }));
});
test('real adapter uses paused pack Fly, explicit native keys, motion and pause', async () => {
  const { page, calls } = fixture(),
    opts = options({ restartConfirmed: true, networkProbeFailed: true });
  await flyRetainedC4WorldOffline(page, opts);
  assert(opts.receipt.passed && opts.receipt.cleanup.completed);
  assert.deepEqual(
    calls.filter((r) => ['key', 'down', 'up'].includes(r[0])),
    [
      ['key', 'Space'],
      ['down', 'w'],
      ['up', 'w'],
      ['key', 'Space'],
    ],
  );
  assert.equal(opts.receipt.acceptance.machineWideOutageQualified, false);
});
test('wrong public gauge stops before throttle and preserves failed receipt', async () => {
  const { page, calls } = fixture({ wrongGauge: true }),
    opts = options({ restartConfirmed: true, networkProbeFailed: true });
  await assert.rejects(flyRetainedC4WorldOffline(page, opts));
  assert.equal(
    calls.some((r) => r[0] === 'down'),
    false,
  );
  assert(!opts.receipt.passed && opts.receipt.cleanup.completed);
});
