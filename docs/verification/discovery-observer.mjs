import { frameSummary, resourceSummary, reviewPlayerSurface } from './company-review-model.mjs';

export const DISCOVERY_OBSERVATION_FORMAT = 'revealline-discovery-observation.v1';
const visible = (node) =>
  !!node && !node.closest('[hidden], [inert]') && node.getClientRects().length > 0;
const finite = (value) => (Number.isFinite(value) ? value : null);

/** Connected DOM observations do not count detached nodes, browser decoder
 * allocations or object URLs with no remaining DOM reference. */
export function discoverySurfaceSnapshot(document, window) {
  const all = [...document.querySelectorAll('*')];
  const media = [...document.querySelectorAll('img,audio,video')];
  const resources = media.filter((node) => (node.currentSrc || node.src || '').startsWith('blob:'));
  const counts = (selector) => document.querySelectorAll(selector).length;
  const heap = window.performance.memory;
  return {
    connectedNodes: all.length,
    connectedImages: counts('img'),
    connectedAudio: counts('audio'),
    connectedVideo: counts('video'),
    connectedBlobMedia: resources.length,
    uniqueConnectedBlobURLs: new Set(resources.map((node) => node.currentSrc || node.src)).size,
    rewardDialogs: counts('#completion-reward-dialog'),
    rewardShelves: counts('#completion-reward-shelf'),
    rewardResults: counts('#completion-reward-result'),
    openDialogs: counts('dialog[open]'),
    usedJSHeapBytes: finite(heap?.usedJSHeapSize),
    heapScope: heap
      ? 'approximate browser-provided heap; not edition-owned retained memory'
      : 'unavailable',
    detachedNodes: null,
    outstandingObjectURLs: null,
    decoderResources: null,
  };
}

export function discoverySurfaceState(document) {
  const player = reviewPlayerSurface(document, visible),
    result = document.getElementById('completion-reward-result');
  return {
    ...player,
    wonResult:
      visible(result) &&
      ['won', 'campaign-complete'].includes(document.getElementById('game-overlay')?.dataset.kind),
    rewardViewer: !!document.getElementById('completion-reward-dialog')?.open,
    collection: !!document.getElementById('collection-dialog')?.open,
    effects: document.body.dataset.effects ?? 'unknown',
  };
}

function bindingCopy(input) {
  const value = JSON.parse(JSON.stringify(input ?? {}));
  if (JSON.stringify(value).length > 8192) throw new TypeError('Observation binding is too large.');
  for (const key of [
    'label',
    'deviceLabel',
    'editionId',
    'gameplayId',
    'inputProtocol',
    'settingsIdentity',
    'sourceIdentity',
  ])
    if (typeof value[key] !== 'string' || !value[key].trim() || value[key].length > 256)
      throw new TypeError(`Provide an explicit bounded ${key} observation binding.`);
  if (!['worktree', 'compiled-artifact'].includes(value.sourceKind))
    throw new TypeError('Declare the source kind.');
  if (!/^[0-9a-f]{64}$/.test(value.sourceIdentity))
    throw new TypeError('Bind an explicit source SHA-256.');
  return value;
}

/** Passive, opt-in desktop observation. No engine imports, synthetic completions,
 * persistent state writes, input events, DOM changes or automatic approvals. */
export function observeDiscovery({
  document = globalThis.document,
  window = globalThis.window,
  binding,
}) {
  const checked = bindingCopy(binding),
    performance = window.performance,
    records = [];
  const startedAt = new Date().toISOString(),
    started = performance.now();
  let disposed = false,
    raf = null,
    previous = null,
    sample = null,
    samples = 0;
  const tasks = [],
    cycles = { result: 0, rewardViewer: 0, collection: 0 },
    pendingCycles = new Map();
  let last = discoverySurfaceState(document);
  const environment = {
    userAgent: window.navigator?.userAgent ?? '',
    platform: window.navigator?.platform ?? '',
    hardwareConcurrency: window.navigator?.hardwareConcurrency ?? null,
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: window.devicePixelRatio,
    timeOrigin: performance.timeOrigin ?? null,
    headlessReported: /Headless/i.test(window.navigator?.userAgent ?? ''),
  };
  const record = (value) => {
    if (records.length >= 500) records.shift();
    records.push({ atMs: performance.now() - started, ...value, qualified: false });
  };
  const checkpoint = (label) => {
    if (disposed) throw new Error('Observer is disposed.');
    if (typeof label !== 'string' || !label.trim() || label.length > 160)
      throw new TypeError('Use a bounded checkpoint label.');
    const value = {
      kind: 'checkpoint',
      label,
      state: discoverySurfaceState(document),
      resources: discoverySurfaceSnapshot(document, window),
      ...resourceSummary(performance.getEntriesByType('resource')),
    };
    record(value);
    return value;
  };
  let taskObserver = null;
  const supported = window.PerformanceObserver?.supportedEntryTypes?.includes('longtask') === true;
  const acceptTasks = (entries) => {
    for (const entry of entries)
      if (entry.startTime >= started && Number.isFinite(entry.duration)) {
        tasks.push({ startTime: entry.startTime, duration: entry.duration });
        if (tasks.length > 2000) tasks.shift();
      }
  };
  if (supported) {
    taskObserver = new window.PerformanceObserver((list) => acceptTasks(list.getEntries()));
    taskObserver.observe({ type: 'longtask', buffered: false });
  }
  const finish = (outcome) => {
    if (!sample) return;
    taskObserver && acceptTasks(taskObserver.takeRecords());
    const end = performance.now(),
      complete = outcome === 'observed';
    const included = tasks.filter(
      (task) => task.startTime + task.duration > sample.armedAt && task.startTime < end,
    );
    const value = {
      kind: 'sample',
      scenario: sample.kind,
      outcome,
      surfaceVisibleWhenArmed: sample.surfaceVisibleWhenArmed,
      effects: sample.effects,
      mission: sample.mission,
      durationMs: sample.durationMs,
      activeElapsedMs: sample.began === null ? null : end - sample.began,
      transitionWindowMs: end - sample.armedAt,
      frameIntervals: complete ? frameSummary(sample.intervals) : null,
      metric:
        'requestAnimationFrame intervals including observer overhead, not renderer execution time',
      pageLongTasks: supported
        ? {
            supported: true,
            count: included.length,
            over50Ms: included.filter((task) => task.duration > 50).length,
            maxMs: included.length ? Math.max(...included.map((task) => task.duration)) : 0,
            scope: 'page-wide from arming through completion; not attributed to reward rendering',
          }
        : { supported: false },
      rewardTaskAttribution: { supported: false },
      before: sample.before,
      after: discoverySurfaceSnapshot(document, window),
      inputEvents: sample.inputEvents,
    };
    const resolve = sample.resolve;
    sample = null;
    previous = null;
    record(value);
    resolve(value);
  };
  const condition = (state, kind) =>
    kind === 'active-play'
      ? state.running
      : kind === 'result-reveal'
        ? state.wonResult && !state.rewardViewer
        : kind === 'reward-viewer'
          ? state.rewardViewer
          : state.collection && !state.rewardViewer;
  const tick = (timestamp) => {
    if (disposed) return;
    const now = performance.now(),
      state = discoverySurfaceState(document);
    for (const [key, field] of [
      ['result', 'wonResult'],
      ['rewardViewer', 'rewardViewer'],
      ['collection', 'collection'],
    ]) {
      if (!last[field] && state[field])
        pendingCycles.set(key, { began: now, before: discoverySurfaceSnapshot(document, window) });
      if (last[field] && !state[field] && pendingCycles.has(key)) {
        const cycle = pendingCycles.get(key);
        pendingCycles.delete(key);
        cycles[key]++;
        record({
          kind: 'cycle',
          surface: key,
          ordinal: cycles[key],
          elapsedMs: now - cycle.began,
          before: cycle.before,
          after: discoverySurfaceSnapshot(document, window),
        });
      }
    }
    last = state;
    if (sample) {
      if (document.hidden) finish('discarded: page hidden');
      else if (sample.began === null) {
        if (condition(state, sample.kind)) {
          sample.began = now;
          sample.effects = state.effects;
          sample.mission = state.mission;
          previous = null;
        } else if (now - sample.armedAt > 30000)
          finish('discarded: target surface did not appear within 30 seconds');
      } else if (!condition(state, sample.kind)) finish('discarded: observed surface changed');
      else if (state.effects !== sample.effects || state.mission !== sample.mission)
        finish('discarded: scenario changed');
      else {
        if (previous !== null) sample.intervals.push(timestamp - previous);
        previous = timestamp;
        if (sample.intervals.length > 10000) finish('discarded: frame limit');
        else if (now - sample.began >= sample.durationMs) finish('observed');
      }
    }
    raf = window.requestAnimationFrame(tick);
  };
  const input = (event) => {
    if (!sample) return;
    const key = event.isTrusted ? 'trusted' : 'synthetic';
    sample.inputEvents[key]++;
  };
  const visibility = () => {
    if (document.hidden) finish('discarded: page hidden');
  };
  const blur = () => finish('discarded: focus left the observed page');
  const pagehide = () => dispose('page navigation');
  for (const type of ['keydown', 'pointerdown', 'click'])
    document.addEventListener(type, input, true);
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('blur', blur);
  window.addEventListener('pagehide', pagehide);
  raf = window.requestAnimationFrame(tick);
  checkpoint('observer attached');
  const exportReport = () => ({
    format: DISCOVERY_OBSERVATION_FORMAT,
    qualified: false,
    binding: checked,
    environment,
    startedAt,
    cycles: { ...cycles },
    records: structuredClone(records),
    limitations: [
      'Desktop browser observation only; no human, mobile-device or installed-app qualification.',
      'Frame intervals include observer overhead and are not isolated render durations.',
      'Connected DOM and media counts do not prove absence of detached nodes, leaked object URLs or decoder allocations.',
      'Long tasks are page-wide and cannot establish reward-rendering attribution.',
      'Reloading editions destroys the old document and is not a same-document ownership leak test.',
    ],
  });
  function dispose(reason = 'explicit disposal') {
    if (disposed) return;
    finish('discarded: ' + reason);
    record({
      kind: 'detached',
      reason,
      incompleteCycles: [...pendingCycles.keys()],
      resources: discoverySurfaceSnapshot(document, window),
    });
    disposed = true;
    window.cancelAnimationFrame(raf);
    taskObserver?.disconnect();
    for (const type of ['keydown', 'pointerdown', 'click'])
      document.removeEventListener(type, input, true);
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('blur', blur);
    window.removeEventListener('pagehide', pagehide);
  }
  return {
    checkpoint,
    exportReport,
    dispose,
    sample({ kind = 'active-play', durationMs = 20000 } = {}) {
      if (disposed || sample || ++samples > 100)
        throw new Error('One live sample at a time, at most 100 per observer.');
      if (
        !['active-play', 'result-reveal', 'reward-viewer', 'collection'].includes(kind) ||
        !Number.isInteger(durationMs) ||
        durationMs < 1000 ||
        durationMs > 30000
      )
        throw new TypeError('Choose a supported surface and 1–30 second bounded interval.');
      return new Promise((resolve) => {
        sample = {
          kind,
          durationMs,
          resolve,
          armedAt: performance.now(),
          began: null,
          surfaceVisibleWhenArmed: condition(discoverySurfaceState(document), kind),
          effects: null,
          mission: null,
          before: discoverySurfaceSnapshot(document, window),
          intervals: [],
          inputEvents: { trusted: 0, synthetic: 0 },
        };
      });
    },
  };
}
