/* global document, window, navigator, URL, Blob */
// External manual observer. The native player entry and every package byte remain intact.
const $ = (id) => document.getElementById(id),
  frame = $('player');
const receipt = {
  format: 'FPVCurrentObservation.v1',
  createdAt: new Date().toISOString(),
  fixture: null,
  integrity: [],
  runs: [],
  loads: [],
  errors: [],
  limits: [
    'RAF gaps describe browser callback scheduling, not rendered FPS or GPU duration.',
    'No flushed caches or isolated hardware workload; browser-reported identity does not qualify a device.',
    'Only public DOM status is sampled at 4 Hz. No per-frame full app snapshots or physics writes.',
    'Player error listeners attach after native load; earlier startup errors are not captured.',
    'Callback coverage requires first and last callbacks within 250 ms of the window boundaries, matching the public-state polling cadence. Longer censored boundaries invalidate completion; their durations remain visible.',
    'Focus/visibility loss, pause, changed task/settings and native navigation stop the window. Incomplete runs remain exportable.',
  ],
};
let fixture,
  child,
  childDoc,
  pending = null,
  active = null,
  pulse = null,
  poll = null,
  timer = null;
let loadStarted = null,
  detach = [],
  observers = [];
const cap = (array, value, maximum, owner) => {
  if (array.length < maximum) array.push(value);
  else owner.dropped = (owner.dropped ?? 0) + 1;
};
const digest = async (bytes) =>
  [...new Uint8Array(await window.crypto.subtle.digest('SHA-256', bytes))]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
function snapshot() {
  const dialog = childDoc?.getElementById('flight-dialog');
  const value = (id) => childDoc?.getElementById(id)?.value ?? null;
  return {
    open: Boolean(dialog?.open),
    state: dialog?.dataset.flightState ?? null,
    title: childDoc?.getElementById('flight-title')?.textContent ?? '',
    status: childDoc?.getElementById('flight-status')?.textContent ?? '',
    replay: childDoc?.getElementById('world-replay-controls')?.hidden === false,
    camera: value('flight-camera'),
    quality: value('flight-quality'),
    mode: value('flight-mode'),
    source: value('flight-source'),
    fov: value('world-fov'),
    tilt: value('world-tilt'),
    replayRate: value('world-replay-rate'),
    viewport: [child?.innerWidth, child?.innerHeight],
    dpr: child?.devicePixelRatio,
    visible: childDoc?.visibilityState === 'visible' && document.visibilityState === 'visible',
    focused: childDoc?.hasFocus() === true,
    menu:
      Boolean(childDoc?.querySelector('dialog[open]:not(#flight-dialog)')) ||
      dialog?.dataset.flightMenuOpen === 'true' ||
      dialog?.dataset.optionsOpen === 'true' ||
      dialog?.dataset.immersiveControls === 'true',
  };
}
const identity = (state) =>
  JSON.stringify([
    state.title,
    state.replay,
    state.camera,
    state.quality,
    state.mode,
    state.source,
    state.fov,
    state.tilt,
    state.replayRate,
    state.viewport,
    state.dpr,
  ]);
function output() {
  $('receipt').value = JSON.stringify(receipt);
  $('receipt').hidden = false;
  $('export').disabled = false;
}
function buttons() {
  $('begin').disabled = !child || Boolean(pending || active);
  $('stop').disabled = !(pending || active);
  $('duration').disabled = $('workload').disabled = Boolean(pending || active);
}
function takeTasks(run, entries) {
  for (const item of entries) {
    const end = run.end ?? child.performance.now();
    if (item.startTime + item.duration < run.start || item.startTime > end) continue;
    cap(
      run.tasks,
      {
        type: item.entryType,
        start: item.startTime,
        duration: item.duration,
        blockingDuration: item.blockingDuration ?? null,
        renderStart: item.renderStart ?? null,
        styleAndLayoutStart: item.styleAndLayoutStart ?? null,
        scripts: item.scripts
          ? [...item.scripts].slice(0, 16).map((s) => ({
              sourceURL: s.sourceURL,
              sourceFunctionName: s.sourceFunctionName,
              duration: s.duration,
              forcedStyleAndLayoutDuration: s.forcedStyleAndLayoutDuration,
            }))
          : undefined,
      },
      512,
      run,
    );
  }
}
function finish(reason, complete = false) {
  if (!active && !pending) return;
  const run = active ?? pending;
  pending = null;
  active = null;
  window.clearInterval(poll);
  window.clearTimeout(timer);
  if (pulse !== null && child) child.cancelAnimationFrame(pulse);
  pulse = null;
  poll = null;
  timer = null;
  run.end = child?.performance.now() ?? null;
  run.elapsedMs = run.start !== undefined ? run.end - run.start : 0;
  run.reason = reason;
  run.requestedWindowElapsed = complete;
  run.after = snapshot();
  run.finishedAt = new Date().toISOString();
  for (const observer of observers) {
    takeTasks(run, observer.takeRecords());
    observer.disconnect();
  }
  observers = [];
  const first = run.firstCallbackAt ?? null,
    last = run.lastCallbackAt ?? null,
    boundaryLimitMs = 250;
  const leadingMs = first === null ? null : Math.max(0, first - run.start),
    trailingMs = last === null ? null : Math.max(0, run.end - last);
  // Boundary intervals are censored observations, never invented RAF samples.
  // This is observation coverage, not a frame-rate or performance pass threshold.
  const covered =
    first !== null &&
    last !== null &&
    run.gaps.length > 0 &&
    leadingMs <= boundaryLimitMs &&
    trailingMs <= boundaryLimitMs;
  run.callbackCoverage = {
    boundaryLimitMs,
    firstCallbackAt: first,
    lastCallbackAt: last,
    leadingCensoredMs: leadingMs,
    trailingCensoredMs: trailingMs,
    observedSpanMs: first === null || last === null ? 0 : Math.max(0, last - first),
    withoutCallbacksMs: first === null ? run.elapsedMs : null,
    complete: covered,
  };
  run.complete = complete && covered;
  run.valid = run.complete && !run.dropped && run.elapsedMs >= run.requestedMs;
  if (complete && !covered)
    run.reason = 'Requested window elapsed with incomplete callback coverage';
  const sorted = run.gaps.map((item) => item.intervalMs).sort((a, b) => a - b);
  const quantile = (fraction) => sorted[Math.floor((sorted.length - 1) * fraction)] ?? null;
  run.callbackGaps = {
    count: sorted.length,
    medianMs: quantile(0.5),
    p95Ms: quantile(0.95),
    p99Ms: quantile(0.99),
    maxMs: sorted.at(-1) ?? null,
  };
  buttons();
  output();
  const coverageSummary =
    ` Callback coverage: ${covered ? 'complete' : 'incomplete'}; ` +
    `leading ${leadingMs === null ? 'unknown' : leadingMs.toFixed(1)} ms, ` +
    `trailing ${trailingMs === null ? 'unknown' : trailingMs.toFixed(1)} ms (250 ms boundary limit).`;
  $('status').textContent =
    (run.complete
      ? 'Window finished. Inspect and export the receipt; no device FPS claim.'
      : `Stopped: ${run.reason}. Partial evidence retained.`) + coverageSummary;
}
function start(run, before) {
  pending = null;
  active = run;
  run.before = before;
  run.identity = identity(before);
  run.start = child.performance.now();
  run.timeOrigin = child.performance.timeOrigin;
  run.environment = {
    userAgent: child.navigator.userAgent,
    platform: child.navigator.platform,
    hardwareConcurrency: child.navigator.hardwareConcurrency,
    dpr: child.devicePixelRatio,
    viewport: [child.innerWidth, child.innerHeight],
    physicalDevice: 'Not independently verified',
  };
  const supported = child.PerformanceObserver?.supportedEntryTypes ?? [];
  run.observerSupport = Object.fromEntries(
    ['longtask', 'long-animation-frame'].map((type) => [type, supported.includes(type)]),
  );
  for (const type of Object.keys(run.observerSupport)) {
    if (!run.observerSupport[type]) continue;
    try {
      const observer = new child.PerformanceObserver((list) => takeTasks(run, list.getEntries()));
      observer.observe({ type });
      observers.push(observer);
    } catch (error) {
      run.observerSupport[type] = String(error);
    }
  }
  run.firstCallbackAt = null;
  run.lastCallbackAt = null;
  let last;
  const tick = (timestamp) => {
    if (active !== run) return;
    if (run.firstCallbackAt === null) run.firstCallbackAt = timestamp;
    run.lastCallbackAt = timestamp;
    if (last !== undefined)
      cap(run.gaps, { at: timestamp, intervalMs: timestamp - last }, 24000, run);
    last = timestamp;
    pulse = child.requestAnimationFrame(tick);
  };
  pulse = child.requestAnimationFrame(tick);
  timer = window.setTimeout(() => {
    if (active !== run) return;
    inspect();
    if (active === run) finish('requested window elapsed', true);
  }, run.requestedMs);
  $('status').textContent =
    `Observing ${run.requestedMs / 1000}s. Keep the player focused; Stop retains an incomplete receipt.`;
}
function inspect() {
  const run = active ?? pending;
  if (!run) return;
  const state = snapshot(),
    now = child.performance.now();
  if (pending) {
    if (window.performance.now() - run.waitStarted > 60000)
      return finish('No matching focused player state within 60 seconds');
    if (
      state.open &&
      state.visible &&
      state.focused &&
      !state.menu &&
      state.state === run.expectedState
    )
      start(run, state);
    return;
  }
  cap(run.states, { at: now, ...state }, 2048, run);
  if (!state.visible || !state.focused) return finish('Player lost visibility or focus');
  if (!state.open || state.menu || state.state !== run.expectedState)
    return finish(`Player state changed: ${state.state ?? 'closed'}`);
  if (identity(state) !== run.identity) return finish('Task or presentation settings changed');
}
frame.addEventListener('load', () => {
  if (!fixture || !frame.getAttribute('src')) return;
  if (active || pending) finish('Player navigated');
  detach.forEach((remove) => remove());
  detach = [];
  try {
    child = frame.contentWindow;
    childDoc = frame.contentDocument;
    if (!childDoc?.getElementById('world-viewport')) throw Error('Native Worlds entry not found');
    receipt.loads.push({
      observedAt: new Date().toISOString(),
      outerLoadMs: window.performance.now() - loadStarted,
      url: child.location.href,
      navigation: child.performance.getEntriesByType('navigation').map((entry) => entry.toJSON()),
    });
    const listen = (node, type, handler) => {
      node.addEventListener(type, handler);
      detach.push(() => node.removeEventListener(type, handler));
    };
    listen(child, 'blur', () => {
      if (active) finish('Player focus lost');
    });
    listen(childDoc, 'visibilitychange', () => {
      if (active && childDoc.visibilityState !== 'visible') finish('Player hidden');
    });
    listen(child, 'error', (event) => {
      cap(receipt.errors, { at: new Date().toISOString(), message: event.message }, 128, receipt);
      if (active) finish('Player error');
    });
    listen(child, 'unhandledrejection', (event) => {
      cap(
        receipt.errors,
        { at: new Date().toISOString(), message: String(event.reason) },
        128,
        receipt,
      );
      if (active) finish('Unhandled player rejection');
    });
    $('status').textContent =
      'Choose a world and prepare a flight. Begin waits for focused play; you arm or resume yourself.';
    buttons();
  } catch (error) {
    child = null;
    receipt.errors.push({ message: String(error) });
    $('status').textContent = String(error);
    output();
  }
});
document.addEventListener('visibilitychange', () => {
  if (active && document.visibilityState !== 'visible') finish('Observer hidden');
});
$('begin').onclick = () => {
  if (!child || active || pending) return;
  const requestedMs = Number($('duration').value) * 1000;
  if (![30000, 60000, 120000].includes(requestedMs)) return;
  pending = {
    requestedAt: new Date().toISOString(),
    waitStarted: window.performance.now(),
    requestedMs,
    expectedState: $('workload').value === 'ready' ? 'disarmed' : 'active',
    gaps: [],
    tasks: [],
    states: [],
    complete: false,
    valid: false,
  };
  receipt.runs.push(pending);
  $('receipt').hidden = true;
  buttons();
  $('status').textContent =
    'Waiting. Focus the player and deliberately start/resume it; nothing is armed automatically.';
  poll = window.setInterval(inspect, 250);
};
$('stop').onclick = () => finish('Operator stopped early');
$('export').onclick = () => {
  if (active || pending) finish('Operator exported before completion');
  output();
  const url = URL.createObjectURL(new Blob([$('receipt').value], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'fpv-current-observation.json';
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
try {
  const response = await window.fetch('./fixture.json', { cache: 'no-store' });
  if (!response.ok) throw Error('Fixture unavailable');
  fixture = await response.json();
  if (fixture.format !== 'FPVCurrentObservationFixture.v1' || fixture.runtimeOverlays !== 0)
    throw Error('Invalid fixture');
  receipt.fixture = fixture;
  for (const row of [
    ...fixture.files.map((item) => ({ ...item, url: './player/' + item.path })),
    { ...fixture.observer, url: './observer.mjs' },
  ]) {
    const result = await window.fetch(row.url, { cache: 'no-store' }),
      bytes = await result.arrayBuffer();
    const passed =
      result.ok && bytes.byteLength === row.bytes && (await digest(bytes)) === row.sha256;
    receipt.integrity.push({ path: row.url, passed });
    if (!passed) throw Error('Frozen bytes changed: ' + row.url);
  }
  receipt.verifiedAt = new Date().toISOString();
  loadStarted = window.performance.now();
  frame.src = './player/' + fixture.entry;
} catch (error) {
  receipt.errors.push({ message: String(error) });
  $('status').textContent = String(error);
  output();
}
