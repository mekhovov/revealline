import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { readFile, mkdtemp, symlink, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as pause } from 'node:timers/promises';
import {
  NATIVE_ZOOM_POLICY,
  NATIVE_ZOOM_FIXTURE,
  validateZoomControl,
  validateZoomMetrics,
  verifyNativeZoomSequence,
  observeNativeZoomSequence,
  zoomOperationScope,
  readNativeZoomControlFrame,
  validateNativeZoomControlFrame,
} from './practice-native-zoom-capability.mjs';
import { parseNativeZoomArguments } from './observe-practice-native-zoom.mjs';

test('symlinked CLI still requires explicit opt-in instead of silently exiting zero', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'practice-zoom-cli-test-'));
  try {
    const link = path.join(directory, 'probe.mjs');
    await symlink(
      fileURLToPath(new URL('./observe-practice-native-zoom.mjs', import.meta.url)),
      link,
    );
    const result = spawnSync(process.execPath, [link], {
      env: {},
      encoding: 'utf8',
      timeout: 10000,
    });
    assert.equal(result.error, undefined);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Explicit capability-only opt-in required/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

const options = [
  { value: '1', text: '100%', disabled: false },
  { value: '2', text: '200%', disabled: false },
];
const control = (value) => ({ value, options: structuredClone(options) });
const metrics = (zoom = 1) => ({
  outerWidth: 1280,
  outerHeight: 900,
  innerWidth: 1280 / zoom,
  innerHeight: 800 / zoom,
  dpr: 2 * zoom,
  visualScale: 1,
  visualWidth: 1280 / zoom,
  visualHeight: 800 / zoom,
  markerWidth: 200,
  css: Array.from({ length: 3 }, () => ({ zoom: '1', transform: 'none' })),
  frame: 'top',
});
const sequence = () =>
  ['1', '2', '1'].map((requested) => ({
    requested,
    control: control(requested),
    metrics: metrics(Number(requested)),
  }));
function fixture({
  unsupported = false,
  missing = false,
  noEffect = false,
  wrongRoute = false,
  obscured = false,
  moving = false,
} = {}) {
  let zoom = '1',
    settingsURL = 'about:blank',
    pageURL = 'about:blank';
  const calls = [];
  let frameReads = 0;
  const select = {
    waitFor: async () => {
      if (missing) throw Error('Native select unavailable');
    },
    isEnabled: async () => true,
    scrollIntoViewIfNeeded: async () => {
      calls.push(['scroll-native-select']);
    },
    evaluate: async (fn) => {
      if (fn === readNativeZoomControlFrame)
        return {
          value: zoom,
          x: moving ? ++frameReads : 20,
          y: 30,
          width: 100,
          height: 30,
          viewportWidth: 640,
          viewportHeight: 400,
          visibility: 'visible',
          display: 'block',
          opacity: '1',
          visible: true,
          centerHit: !obscured,
        };
      const result = control(zoom);
      if (unsupported) result.options[1].text = '150%';
      return result;
    },
    selectOption: async (value) => {
      calls.push(['select', value]);
      zoom = value;
    },
  };
  const settings = {
    goto: async (url) => {
      calls.push(['settings', url]);
      settingsURL = wrongRoute ? 'chrome://settings/' : url;
    },
    url: () => settingsURL,
    bringToFront: async () => {},
    locator: (selector) => {
      assert.equal(selector, NATIVE_ZOOM_POLICY.selector);
      return select;
    },
  };
  const page = {
    goto: async (url) => {
      calls.push(['fixture', url]);
      pageURL = url;
    },
    url: () => pageURL,
    bringToFront: async () => {},
    evaluate: async () => metrics(noEffect ? 1 : Number(zoom)),
  };
  return { settings, page, calls };
}
test('200 percent screenshot framing rejects clipping and effective invisibility', () => {
  const frame = {
    value: '2',
    x: 20,
    y: 30,
    width: 100,
    height: 30,
    viewportWidth: 640,
    viewportHeight: 400,
    visibility: 'visible',
    display: 'block',
    opacity: '1',
    visible: true,
    centerHit: true,
  };
  validateNativeZoomControlFrame(frame);
  for (const change of [
    { y: 390 },
    { x: -1 },
    { width: 0 },
    { visible: false },
    { opacity: '0' },
    { visibility: 'hidden' },
    { value: '1' },
    { centerHit: false },
  ])
    assert.throws(() => validateNativeZoomControlFrame({ ...frame, ...change }));
});
test('strict capability CLI accepts only explicit owned output and existing runtime paths', () => {
  assert.deepEqual(
    parseNativeZoomArguments(['--playwright', '/tmp/runtime.mjs', '--output', '/tmp/fresh-zoom']),
    { modulePath: '/tmp/runtime.mjs', output: '/tmp/fresh-zoom' },
  );
  for (const args of [
    [],
    ['--playwright', 'relative', '--output', '/tmp/out'],
    ['--playwright', '/tmp/p', '--output', '/'],
    ['--playwright', '/tmp/p', '--output', '/tmp/a/../out'],
    ['--profile', '/tmp/p', '--output', '/tmp/out'],
    ['--output', '/tmp/p', '--output', '/tmp/out'],
  ])
    assert.throws(() => parseNativeZoomArguments(args));
});
test('Chrome control must really offer enabled 100 and 200 percent options', () => {
  validateZoomControl(control('1'), '1');
  for (const mutation of [
    (x) => x.options.pop(),
    (x) => (x.options[1].disabled = true),
    (x) => (x.options[1].text = '150%'),
    (x) => x.options.push(x.options[0]),
    (x) => (x.value = '2'),
  ]) {
    const value = control('1');
    mutation(value);
    assert.throws(() => validateZoomControl(value, '1'));
  }
});
test('native geometry requires unchanged fixed CSS marker and no pinch/CSS scaling', () => {
  validateZoomMetrics(metrics());
  for (const mutate of [
    (x) => (x.visualScale = 2),
    (x) => (x.markerWidth = 400),
    (x) => (x.css[0].zoom = '2'),
    (x) => (x.css[1].transform = 'matrix(2, 0, 0, 2, 0, 0)'),
    (x) => (x.visualWidth = 700),
    (x) => (x.frame = 'child'),
    (x) => (x.dpr = NaN),
    (x) => (x.outerWidth = 500),
  ]) {
    const row = metrics();
    mutate(row);
    assert.throws(() => validateZoomMetrics(row));
  }
});
test('only corroborated 100 to 200 to 100 native metrics qualify', () => {
  assert(verifyNativeZoomSequence(sequence()));
  for (const mutate of [
    (x) => x.pop(),
    (x) => (x[1].metrics = metrics(1)),
    (x) => (x[1].metrics.dpr = 2),
    (x) => (x[1].metrics.outerWidth = 640),
    (x) => (x[2].metrics = metrics(2)),
    (x) => (x[1].control.value = '1'),
  ]) {
    const rows = sequence();
    mutate(rows);
    assert.throws(() => verifyNativeZoomSequence(rows));
  }
});
test('ordinary visible Settings actions record separate native selection and geometry witnesses', async () => {
  const f = fixture(),
    receipt = {},
    captures = [];
  await observeNativeZoomSequence({
    ...f,
    receipt,
    fixtureURL: 'http://127.0.0.1:1234/native-zoom',
    run: async (_, work) => work(),
    capture: async (_, name) => {
      if (name === 'settings-200' || name === 'settings-control-200') {
        assert.deepEqual(f.calls.at(-1), ['scroll-native-select']);
        assert.equal(receipt.settingsControlFrame.value, '2');
        assert.equal(receipt.settingsControlFrame.visible, true);
      }
      captures.push(name);
      return { path: name + '.png', sha256: 'a'.repeat(64) };
    },
  });
  assert(receipt.sequenceVerified);
  assert.deepEqual(
    f.calls.filter((x) => x[0] === 'select'),
    [
      ['select', '1'],
      ['select', '2'],
      ['select', '1'],
    ],
  );
  assert.deepEqual(captures, [
    'fixture-0-100',
    'settings-control-200',
    'settings-200',
    'fixture-1-200',
    'fixture-2-100',
  ]);
  assert.equal(receipt.settingsControlFrames.length, 2);
  assert.equal(receipt.settingsImagesVisuallyReviewed, false);
  assert.equal(receipt.actions.length, 3);
});
for (const kind of ['unsupported', 'missing', 'noEffect', 'wrongRoute', 'obscured', 'moving'])
  test(`native UI mismatch ${kind} fails rather than using CSS/viewport fallback`, async () => {
    const f = fixture({ [kind]: true }),
      receipt = {};
    await assert.rejects(
      observeNativeZoomSequence({
        ...f,
        receipt,
        fixtureURL: 'http://127.0.0.1:1234/native-zoom',
        run: async (_, work) => work(),
        capture: async () => ({}),
      }),
    );
    assert.notEqual(receipt.sequenceVerified, true);
  });
test('fixture route rejects external and arbitrary origins before any actions', async () => {
  for (const fixtureURL of [
    'https://example.com/native-zoom',
    'http://127.0.0.1:1234/other',
    'http://127.0.0.1:1234/native-zoom?q=1',
  ]) {
    const f = fixture();
    await assert.rejects(
      observeNativeZoomSequence({
        ...f,
        receipt: {},
        fixtureURL,
        run: async (_, work) => work(),
        capture: async () => ({}),
      }),
    );
    assert.deepEqual(f.calls, []);
  }
});
test('action absolute deadline rejects delayed timer dispatch', async () => {
  const scope = zoomOperationScope({ overallMs: 100, actionMs: 5 });
  await assert.rejects(
    scope.run('blocked native response', () => {
      const end = performance.now() + 15;
      while (performance.now() < end) {}
    }),
    /absolute deadline/,
  );
  scope.stop();
  assert.deepEqual(scope.pending(), []);
});
test('overall absolute deadline rejects delayed response and prevents later actions', async () => {
  const scope = zoomOperationScope({ overallMs: 5, actionMs: 100 });
  await assert.rejects(
    scope.run('blocked response', () => {
      const end = performance.now() + 15;
      while (performance.now() < end) {}
    }),
    /scope ended/,
  );
  let ran = false;
  await assert.rejects(
    scope.run('late mutation', () => {
      ran = true;
    }),
  );
  assert.equal(ran, false);
});
test('timed-out underlying task stays owned until settlement and stop rejects late work', async () => {
  const scope = zoomOperationScope({ overallMs: 100, actionMs: 5 });
  let resolve;
  await assert.rejects(
    scope.run(
      'pending native operation',
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    ),
    /timed out/,
  );
  assert.deepEqual(scope.pending(), ['pending native operation']);
  scope.stop();
  let ran = false;
  await assert.rejects(
    scope.run('new action', () => {
      ran = true;
    }),
  );
  assert.equal(ran, false);
  resolve();
  await pause(0);
  assert.deepEqual(scope.pending(), []);
});
test('probe launch and cleanup stay scoped; fixture cannot invoke app or settings APIs', async () => {
  const source = await readFile(
    new URL('./observe-practice-native-zoom.mjs', import.meta.url),
    'utf8',
  );
  assert.match(source, /launchPersistentContext\(profile/);
  assert.match(source, /headless:\s*false/);
  assert.match(source, /viewport:\s*null/);
  assert.match(source, /mkdtemp/);
  assert.match(source, /zoomResetVerified/);
  assert.match(source, /profileRemoved/);
  assert.match(source, /late.*resource/i);
  assert.doesNotMatch(
    source,
    /connectOverCDP|setViewportSize|setPageScaleFactor|deviceScaleFactor|settingsPrivate|\.focus\(/,
  );
  assert.doesNotMatch(NATIVE_ZOOM_FIXTURE, /<script|localStorage|serviceWorker|transform:|zoom:/);
});
