/** Capability probe only. No application, authentication, device or a11y qualification. */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

export const NATIVE_ZOOM_POLICY = Object.freeze({
  protocol: 'practice-native-chrome-zoom-capability.v1',
  overallMs: 90000,
  actionMs: 10000,
  cleanupMs: 5000,
  settingsURL: 'chrome://settings/appearance',
  selector: 'settings-appearance-page #zoomLevel',
});
export const NATIVE_ZOOM_FIXTURE =
  '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Owned native browser zoom capability</title><style>body{margin:16px;font:16px sans-serif}#marker{width:200px;height:80px;background:#173958;color:white}button{margin-top:16px;padding:12px}button:focus-visible{outline:3px solid #bc5300}</style><h1>Native browser zoom capability</h1><p>This isolated fixture tests browser magnification, not Flight practice accessibility.</p><div id="marker">Fixed 200 CSS-pixel marker</div><button type="button">Keyboard witness only</button></html>';

export function validateZoomControl(witness, expected) {
  assert.deepEqual(Object.keys(witness).sort(), ['options', 'value']);
  assert(
    Array.isArray(witness.options) && witness.options.length >= 2 && witness.options.length <= 32,
  );
  assert.equal(new Set(witness.options.map((x) => x.value)).size, witness.options.length);
  for (const value of ['1', '2']) {
    const option = witness.options.find((x) => x.value === value);
    assert(option && option.disabled === false, 'Native Chrome 100% and 200% options required.');
    assert.equal(option.text.replace(/\s/g, ''), `${Number(value) * 100}%`);
  }
  if (expected !== undefined) assert.equal(witness.value, expected);
  return witness;
}
export function validateZoomMetrics(row) {
  for (const key of [
    'outerWidth',
    'outerHeight',
    'innerWidth',
    'innerHeight',
    'dpr',
    'visualScale',
    'visualWidth',
    'visualHeight',
    'markerWidth',
  ])
    assert(Number.isFinite(row[key]) && row[key] > 0, `Invalid native metric: ${key}`);
  assert(row.outerWidth >= 640 && row.outerHeight >= 480, 'Owned browser window is too small.');
  assert.equal(row.markerWidth, 200, 'Fixture marker CSS geometry changed.');
  assert(Math.abs(row.visualScale - 1) <= 0.001, 'Pinch/page-scale emulation is not browser zoom.');
  assert(Math.abs(row.visualWidth - row.innerWidth) <= 2);
  assert(Math.abs(row.visualHeight - row.innerHeight) <= 2);
  assert.deepEqual(row.css, [
    { zoom: '1', transform: 'none' },
    { zoom: '1', transform: 'none' },
    { zoom: '1', transform: 'none' },
  ]);
  assert.equal(row.frame, 'top');
  return row;
}
export function verifyNativeZoomSequence(rows) {
  assert.equal(rows.length, 3);
  assert.deepEqual(
    rows.map((x) => x.requested),
    ['1', '2', '1'],
  );
  for (const row of rows) {
    validateZoomControl(row.control, row.requested);
    validateZoomMetrics(row.metrics);
  }
  const [initial, zoomed, restored] = rows.map((x) => x.metrics);
  for (const item of [zoomed, restored]) {
    assert(Math.abs(item.outerWidth - initial.outerWidth) <= 2, 'Browser outer width changed.');
    assert(Math.abs(item.outerHeight - initial.outerHeight) <= 2, 'Browser outer height changed.');
  }
  assert(Math.abs(zoomed.dpr / initial.dpr - 2) <= 0.01, 'Native zoom must double DPR.');
  for (const key of ['innerWidth', 'innerHeight'])
    assert(Math.abs(zoomed[key] * 2 - initial[key]) <= 4, 'Native zoom must halve CSS viewport.');
  assert(Math.abs(restored.dpr - initial.dpr) <= 0.01);
  for (const key of ['innerWidth', 'innerHeight'])
    assert(Math.abs(restored[key] - initial[key]) <= 2);
  return true;
}

export function readNativeZoomMetrics() {
  const {
    document,
    getComputedStyle,
    outerWidth,
    outerHeight,
    innerWidth,
    innerHeight,
    devicePixelRatio,
    visualViewport,
  } = globalThis;
  const css = (element) => ({
    zoom: getComputedStyle(element).zoom,
    transform: getComputedStyle(element).transform,
  });
  const marker = document.getElementById('marker');
  return {
    outerWidth,
    outerHeight,
    innerWidth,
    innerHeight,
    dpr: devicePixelRatio,
    visualScale: visualViewport.scale,
    visualWidth: visualViewport.width,
    visualHeight: visualViewport.height,
    markerWidth: marker.getBoundingClientRect().width,
    css: [document.documentElement, document.body, marker].map(css),
    frame: globalThis.top === globalThis ? 'top' : 'child',
  };
}
export async function selectNativeZoom(settings, value, run, receipt) {
  assert(['1', '2'].includes(value));
  await run('Show owned Chrome settings', () => settings.bringToFront());
  assert.equal(settings.url(), NATIVE_ZOOM_POLICY.settingsURL);
  const select = settings.locator(NATIVE_ZOOM_POLICY.selector);
  await run('Wait for native Page zoom select', () =>
    select.waitFor({ state: 'visible', timeout: 5000 }),
  );
  assert.equal(await run('Check native select enabled', () => select.isEnabled()), true);
  const read = () =>
    select.evaluate((el) => ({
      value: el.value,
      options: [...el.options].map((o) => ({
        value: o.value,
        text: o.textContent.trim(),
        disabled: o.disabled,
      })),
    }));
  const before = validateZoomControl(await run('Read native Page zoom options', read));
  receipt.push({ action: 'ordinary visible selectOption', before: before.value, requested: value });
  await run('Select native browser zoom', () => select.selectOption(value, { timeout: 5000 }));
  return validateZoomControl(await run('Verify native Page zoom selection', read), value);
}

export async function observeNativeZoomSequence({
  page,
  settings,
  fixtureURL,
  run,
  capture,
  receipt,
}) {
  const url = new URL(fixtureURL);
  assert(
    url.protocol === 'http:' &&
      url.hostname === '127.0.0.1' &&
      url.port &&
      !url.username &&
      !url.password &&
      url.href === fixtureURL &&
      url.pathname === '/native-zoom' &&
      !url.search &&
      !url.hash,
  );
  receipt.steps = [];
  receipt.actions = [];
  await run('Open native Chrome appearance settings', () =>
    settings.goto(NATIVE_ZOOM_POLICY.settingsURL, {
      waitUntil: 'domcontentloaded',
      timeout: 10000,
    }),
  );
  for (const value of ['1', '2', '1']) {
    const control = await selectNativeZoom(settings, value, run, receipt.actions);
    if (value === '2') {
      const select = settings.locator(NATIVE_ZOOM_POLICY.selector);
      await run('Scroll native Page zoom control into view', () =>
        select.scrollIntoViewIfNeeded({ timeout: 5000 }),
      );
      receipt.settingsControlFrames = [];
      for (let attempt = 0; attempt < 5; attempt++) {
        const current = await run('Check native Page zoom screenshot framing', () =>
          select.evaluate(readNativeZoomControlFrame),
        );
        const previous = receipt.settingsControlFrames.at(-1);
        receipt.settingsControlFrames.push(current);
        try {
          validateNativeZoomControlFrame(current);
          if (previous) {
            validateNativeZoomControlFrame(previous);
            assert(
              ['x', 'y', 'width', 'height', 'viewportWidth', 'viewportHeight'].every(
                (key) => Math.abs(current[key] - previous[key]) < 0.5,
              ),
            );
            receipt.settingsControlFrame = current;
            break;
          }
        } catch {
          /* Continue only within the five-sample real-time bound. */
        }
        await run(
          'Wait for native scroll painting',
          () => new Promise((resolve) => setTimeout(resolve, 100)),
        );
      }
      assert(
        receipt.settingsControlFrame,
        'Native zoom control did not remain unobscured and stable.',
      );
      receipt.settingsControlScreenshot = await capture(select, 'settings-control-200');
      receipt.settingsScreenshot = await capture(settings, 'settings-200');
      receipt.settingsImageScope =
        'Locator image plus page corroboration; page image may be cropped by the browser screenshot implementation at native zoom. Images require independent visual review.';
      receipt.settingsImagesVisuallyReviewed = false;
    }
    await run('Show owned metric fixture', () => page.bringToFront());
    await run('Load owned metric fixture', () =>
      page.goto(fixtureURL, { waitUntil: 'domcontentloaded', timeout: 10000 }),
    );
    assert.equal(page.url(), fixtureURL);
    const metrics = validateZoomMetrics(
      await run('Read native zoom geometry', () => page.evaluate(readNativeZoomMetrics)),
    );
    receipt.steps.push({
      requested: value,
      control,
      metrics,
      screenshot: await capture(page, `fixture-${receipt.steps.length}-${Number(value) * 100}`),
    });
  }
  receipt.sequenceVerified = verifyNativeZoomSequence(receipt.steps);
}

export function readNativeZoomControlFrame(el) {
  const rect = el.getBoundingClientRect(),
    style = globalThis.getComputedStyle(el);
  const x = rect.x + rect.width / 2,
    y = rect.y + rect.height / 2;
  let hit = globalThis.document.elementFromPoint(x, y);
  for (let depth = 0; depth < 20 && hit?.shadowRoot; depth++) {
    const next = hit.shadowRoot.elementFromPoint(x, y);
    if (!next || next === hit) break;
    hit = next;
  }
  return {
    value: el.value,
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    viewportWidth: globalThis.innerWidth,
    viewportHeight: globalThis.innerHeight,
    visibility: style.visibility,
    display: style.display,
    opacity: style.opacity,
    visible: el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }),
    centerHit: hit === el || el.contains(hit),
  };
}
export function validateNativeZoomControlFrame(frame) {
  assert.equal(frame.value, '2');
  for (const key of ['x', 'y', 'width', 'height', 'viewportWidth', 'viewportHeight'])
    assert(Number.isFinite(frame[key]));
  assert(frame.width > 0 && frame.height > 0 && frame.x >= 0 && frame.y >= 0);
  assert(
    frame.x + frame.width <= frame.viewportWidth && frame.y + frame.height <= frame.viewportHeight,
  );
  assert.equal(frame.visible, true);
  assert.equal(frame.centerHit, true);
  assert.equal(frame.visibility, 'visible');
  assert.notEqual(frame.display, 'none');
  assert(Number(frame.opacity) > 0);
  return frame;
}

/** Bounds caller waits and retains underlying operations until they actually settle. */
export function zoomOperationScope({
  overallMs = NATIVE_ZOOM_POLICY.overallMs,
  actionMs = NATIVE_ZOOM_POLICY.actionMs,
} = {}) {
  assert(Number.isInteger(overallMs) && overallMs > 0 && overallMs <= NATIVE_ZOOM_POLICY.overallMs);
  assert(Number.isInteger(actionMs) && actionMs > 0 && actionMs <= NATIVE_ZOOM_POLICY.actionMs);
  const end = performance.now() + overallMs,
    pending = new Set();
  let stopped = false;
  const check = () =>
    assert(!stopped && performance.now() < end, 'Native zoom operation scope ended.');
  const run = async (label, work) => {
    check();
    const actionEnd = Math.min(end, performance.now() + actionMs);
    const row = { label };
    let timer;
    const task = Promise.resolve().then(() => {
      check();
      return work();
    });
    row.task = task;
    pending.add(row);
    void task.then(
      () => pending.delete(row),
      () => pending.delete(row),
    );
    try {
      const result = await Promise.race([
        task,
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`Native zoom action timed out: ${label}`)),
            Math.min(actionMs, end - performance.now()),
          );
        }),
      ]);
      check();
      assert(
        performance.now() < actionEnd,
        `Native zoom action exceeded its absolute deadline: ${label}`,
      );
      return result;
    } finally {
      clearTimeout(timer);
    }
  };
  return {
    run,
    stop() {
      stopped = true;
    },
    pending() {
      return [...pending].map((x) => x.label);
    },
    tasks() {
      return [...pending].map((x) => x.task);
    },
  };
}
