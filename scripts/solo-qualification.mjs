// Qualification data and arithmetic only. No browser, simulation or filesystem
// mutations belong here. Browser actions are implemented by the separate runner.
import assert from 'node:assert/strict';

export const QUALIFICATION_FORMAT = 'SoloQualificationV1';
export const FRAME_BOUNDS = [8.34, 10, 16.67, 20, 25, 33.34, 40, 50, 100, 250, null];
const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Escape', 'Shift'];
const types = new Set([
  'click',
  'select',
  'check',
  'fill',
  'upload',
  'key',
  'wait',
  'expect',
  'snapshot',
  'resize',
  'fault',
  'repeat',
  'follow',
  'exportReplay',
  'reload',
  'audio-ready',
  'result',
]);
function integer(value, minimum, maximum, name) {
  assert(Number.isInteger(value) && value >= minimum && value <= maximum, `Invalid ${name}`);
}
function string(value, name) {
  assert(typeof value === 'string' && value.length > 0 && value.length <= 4096, `Invalid ${name}`);
}

function hashes(values) {
  assert(
    Array.isArray(values) && values.length > 0 && values.length <= 16,
    'Invalid recording hashes',
  );
  assert(
    values.every((value) => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)),
    'Invalid recording SHA256',
  );
  assert.equal(new Set(values).size, values.length, 'Duplicate recording hashes');
}

/** Responsive/raster stress options, never a physical device identity. */
export function qualificationDisplayOptions(flags) {
  const value = (name, fallback) => {
    const matches = flags.filter((flag) => flag === `--${name}` || flag.startsWith(`--${name}=`));
    assert(matches.length <= 1, `Duplicate ${name}`);
    if (!matches.length) return fallback;
    assert(matches[0].includes('='), `Missing ${name} value`);
    return matches[0].slice(name.length + 3);
  };
  const dimensions = value('viewport', '1280x800');
  assert(/^\d+x\d+$/.test(dimensions), 'Viewport must be WIDTHxHEIGHT');
  const [width, height] = dimensions.split('x').map(Number);
  integer(width, 240, 3840, 'viewport width');
  integer(height, 240, 3840, 'viewport height');
  const scale = value('dpr', '1');
  assert(/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(scale), 'Invalid DPR');
  const deviceScaleFactor = Number(scale);
  assert(deviceScaleFactor >= 0.5 && deviceScaleFactor <= 4, 'DPR outside bounded 0.5–4 range');
  assert(
    width * height * deviceScaleFactor ** 2 <= 16 * 1024 * 1024,
    'Requested display exceeds 16-Mipixel harness bound',
  );
  assert(
    !flags.some((flag) => flag.startsWith('--mobile-context=')),
    'Mobile context is a Boolean flag',
  );
  const isMobile = flags.includes('--mobile-context');
  return { viewport: { width, height }, deviceScaleFactor, isMobile, hasTouch: isMobile };
}

export function validateQualification(scenario) {
  assert.equal(scenario.format, QUALIFICATION_FORMAT);
  string(scenario.id, 'scenario id');
  assert(['performance', 'lifecycle', 'recovery'].includes(scenario.kind), 'Invalid evidence kind');
  if (scenario.query !== undefined) {
    assert(scenario.query && typeof scenario.query === 'object' && !Array.isArray(scenario.query));
    for (const [key, value] of Object.entries(scenario.query)) {
      assert(['journey', 'pack'].includes(key));
      string(value, 'query value');
    }
  }
  if (scenario.entryPath !== undefined) {
    string(scenario.entryPath, 'entry path');
    assert(
      !scenario.entryPath.includes('..') &&
        !/^[a-z]+:/i.test(scenario.entryPath) &&
        !scenario.entryPath.startsWith('/'),
    );
  }
  if (scenario.readySelector !== undefined) string(scenario.readySelector, 'ready selector');
  integer(scenario.timeoutMs, 1000, 7_200_000, 'scenario timeout');
  assert(Array.isArray(scenario.coverage) && scenario.coverage.every((x) => typeof x === 'string'));
  if (scenario.expectAudio) {
    integer(scenario.expectAudio.nativeStartsAtLeast, 1, 1000000, 'audio source count');
    assert.equal(scenario.expectAudio.unmuted, true);
  }
  if (scenario.audioRequirements) {
    const requirements = scenario.audioRequirements;
    assert(
      Object.keys(requirements).every((key) =>
        [
          'recordedHashes',
          'streamedHashes',
          'minimumAdvanceSeconds',
          'naturalTransitionsAtLeast',
        ].includes(key),
      ),
      'Unknown audio proof requirement',
    );
    assert(
      requirements.recordedHashes || requirements.streamedHashes,
      'Audio proof needs recording identities',
    );
    if (requirements.recordedHashes) hashes(requirements.recordedHashes);
    if (requirements.streamedHashes) hashes(requirements.streamedHashes);
    if (requirements.minimumAdvanceSeconds !== undefined)
      assert(
        Number.isFinite(requirements.minimumAdvanceSeconds) &&
          requirements.minimumAdvanceSeconds > 0 &&
          requirements.minimumAdvanceSeconds <= 30,
      );
    if (requirements.naturalTransitionsAtLeast !== undefined) {
      integer(requirements.naturalTransitionsAtLeast, 1, 16, 'natural stream transitions');
      assert(
        requirements.streamedHashes?.length >= 2,
        'Natural transitions require two known streams',
      );
    }
  }
  if (scenario.replayRequirements)
    for (const [key, value] of Object.entries(scenario.replayRequirements)) {
      assert(
        [
          'closures',
          'eroded',
          'shots',
          'warningTicks',
          'projectileTicks',
          'jammerTicks',
          'maximumTrailCells',
          'maximumClaimedCells',
        ].includes(key),
      );
      integer(value, 1, 1000000, 'replay feature minimum');
    }
  let expanded = 0;
  function actions(list, multiplier = 1, depth = 0) {
    assert(Array.isArray(list) && list.length > 0 && depth < 5, 'Invalid action list');
    for (const action of list) {
      assert(action && types.has(action.type), 'Unknown qualification action');
      expanded += multiplier;
      assert(expanded <= 100_000, 'Expanded action count exceeds bounded harness capacity');
      if (action.timeoutMs !== undefined) integer(action.timeoutMs, 1, 120_000, 'action timeout');
      if (['click', 'select', 'check', 'fill', 'upload', 'expect', 'follow'].includes(action.type))
        string(action.selector, 'selector');
      if (['select', 'fill'].includes(action.type)) string(action.value, 'control value');
      if (action.type === 'check') assert.equal(typeof action.value, 'boolean');
      if (action.type === 'upload') string(action.file, 'fixture file');
      if (action.type === 'key') {
        assert(keys.includes(action.key), 'Only gameplay keys are admitted');
        integer(action.ms, 1, 60_000, 'key duration');
      }
      if (action.type === 'audio-ready') {
        hashes(action.recordedHashes);
        integer(action.fallbackMs, 1, 60_000, 'non-profiling fixed preparation wait');
      }
      if (action.type === 'result')
        assert(['won', 'lost'].includes(action.outcome), 'Invalid public outcome');
      if (action.label !== undefined) {
        string(action.label, 'action label');
        if (action.label === 'natural-music-transition')
          assert(
            action.type === 'wait' && Number.isInteger(action.ms),
            'Natural transition window must have no public input',
          );
      }
      if (action.type === 'wait') {
        assert(
          Number.isInteger(action.ms) !== (typeof action.phase === 'string'),
          'Wait needs duration OR phase',
        );
        if (action.ms !== undefined) integer(action.ms, 1, 60_000, 'wait duration');
        if (action.phase !== undefined)
          assert(['running', 'paused', 'briefing', 'result', 'picture'].includes(action.phase));
      }
      if (action.type === 'expect') {
        if (action.contains !== undefined) string(action.contains, 'expected text fragment');
        if (action.attribute !== undefined) string(action.attribute, 'attribute');
        if (action.value !== undefined) assert(['string', 'boolean'].includes(typeof action.value));
      }
      if (action.type === 'snapshot') string(action.group, 'snapshot group');
      if (action.type === 'resize') {
        integer(action.width, 240, 3840, 'viewport width');
        integer(action.height, 240, 2160, 'viewport height');
      }
      if (action.type === 'fault') {
        assert.equal(scenario.kind, 'recovery', 'Injected faults are never performance evidence');
        assert(
          ['canvas-loss', 'canvas-restore', 'blur', 'focus'].includes(action.event),
          'Unknown fault',
        );
        if (action.event.startsWith('canvas-')) string(action.selector, 'canvas selector');
      }
      if (action.type === 'repeat') {
        integer(action.count, 1, 1000, 'repeat count');
        if (action.atLeastMs !== undefined)
          integer(action.atLeastMs, 1, 3_600_000, 'minimum repeat duration');
        actions(action.actions, multiplier * action.count, depth + 1);
      }
    }
  }
  actions(scenario.actions);
  if (scenario.replayRequirements)
    assert.equal(
      scenario.actions.at(-1).type,
      'exportReplay',
      'Feature requirements need a final public replay export',
    );
  for (const rule of scenario.resourceRules ?? []) {
    string(rule.group, 'resource snapshot group');
    string(rule.path, 'resource path');
    assert(
      /^[\w.]+$/.test(rule.path) && rule.path.startsWith('resources.'),
      'Only exported resource paths',
    );
    assert(
      !rule.path.split('.').some((x) => ['__proto__', 'constructor', 'prototype'].includes(x)),
    );
    integer(rule.last, 3, 1000, 'resource sample count');
    assert(Number.isFinite(rule.maxRange) && rule.maxRange >= 0, 'Invalid resource tolerance');
  }
  return scenario;
}

export function quantileBound(histogram, fraction, bounds = FRAME_BOUNDS, maximumMs = Infinity) {
  assert(Array.isArray(histogram) && histogram.length === bounds.length);
  assert(histogram.every((n) => Number.isSafeInteger(n) && n >= 0));
  assert(fraction > 0 && fraction <= 1);
  const count = histogram.reduce((sum, n) => sum + n, 0);
  if (!count) return null;
  let cumulative = 0;
  for (let i = 0; i < histogram.length; i++) {
    cumulative += histogram[i];
    if (cumulative >= Math.ceil(count * fraction))
      return {
        lowerExclusiveMs: i ? bounds[i - 1] : 0,
        upperInclusiveMs: Number.isFinite(maximumMs)
          ? Math.min(bounds[i] ?? Infinity, maximumMs)
          : bounds[i],
      };
  }
  throw new Error('Invalid histogram');
}

/** Conservative gates for the observed playing window. Histograms that straddle
 * a threshold remain inconclusive; transition hitches require attribution. This
 * is not a device, thermal, matched-overhead or release qualification. */
export function evaluateQualificationBudgets(application) {
  const B = application?.baselineMs;
  const measured =
    application?.enabled === true &&
    application?.cadenceCalibration?.status === 'measured-before-play' &&
    Number.isFinite(B) &&
    B > 0;
  const playing = application?.phases?.playing;
  const bounds = application?.histogramUpperBoundsMs;
  const checks = [];
  function quantile(name, stats, fraction, limitMs, minimumSamples) {
    if (!measured || !stats || stats.count < minimumSamples || !Array.isArray(bounds)) {
      checks.push({
        name,
        status: 'unobserved',
        count: stats?.count ?? null,
        limitMs: measured ? limitMs : null,
        minimumSamples,
        reason: !measured ? 'Measured pre-play cadence unavailable.' : 'Insufficient observations.',
      });
      return;
    }
    assert.equal(
      stats.histogram.reduce((sum, n) => sum + n, 0),
      stats.count,
    );
    const bound = quantileBound(
      stats.histogram,
      fraction,
      stats.histogramUpperBoundsMs ?? bounds,
      stats.maxMs,
    );
    const status =
      bound.upperInclusiveMs !== null && bound.upperInclusiveMs <= limitMs
        ? 'pass'
        : bound.lowerExclusiveMs >= limitMs
          ? 'fail'
          : 'inconclusive';
    checks.push({ name, status, count: stats.count, fraction, limitMs, ...bound });
  }
  quantile('playing-work-p95', playing?.work, 0.95, Math.min(10, 0.6 * B), 100);
  quantile('playing-cadence-p95', playing?.frames, 0.95, 1.2 * B, 100);
  quantile('playing-cadence-p99', playing?.frames, 0.99, 2 * B, 100);
  const frames = playing?.frames;
  const opportunities = frames ? frames.count + frames.missedOpportunities : 0;
  const missedRate = opportunities ? frames.missedOpportunities / opportunities : null;
  checks.push({
    name: 'playing-missed-opportunity-rate',
    limit: 0.01,
    actual: missedRate,
    count: frames?.count ?? null,
    status:
      measured && Number.isFinite(missedRate) && frames.count >= 100
        ? missedRate <= 0.01
          ? 'pass'
          : 'fail'
        : 'unobserved',
  });
  quantile(
    'keyboard-input-to-submitted-render-p95',
    application?.inputLatency?.byKind?.keyboard?.toRender,
    0.95,
    2 * B,
    20,
  );
  for (const name of ['interruptions', 'failures']) {
    const count = application?.[name]?.count;
    checks.push({
      name,
      limit: 0,
      actual: count ?? null,
      status: Number.isSafeInteger(count) ? (count === 0 ? 'pass' : 'fail') : 'unobserved',
    });
  }
  const review = [];
  if (frames?.maxMs >= 100)
    review.push(
      'At least one prior-playing-phase interval is >=100ms. Correlate timestamps with phase transitions before attributing an active gameplay stall.',
    );
  if (playing?.work?.maxMs > 50)
    review.push(
      'At least one observed playing callback exceeds 50ms. Investigate its work before qualification.',
    );
  if (frames?.maxMissedStreak > 2)
    review.push(
      'A burst exceeds two consecutive missed opportunities; retained hitch evidence needs review.',
    );
  const numericalStatus = checks.some((row) => row.status === 'fail')
    ? 'fail'
    : checks.some((row) => row.status !== 'pass')
      ? 'inconclusive'
      : 'pass';
  return {
    baselineMs: measured ? B : null,
    numericalStatus,
    status:
      numericalStatus === 'fail'
        ? 'fail'
        : review.length
          ? 'review-required'
          : numericalStatus === 'pass'
            ? 'pass-observed-window'
            : 'inconclusive',
    checks,
    review,
    observedPlayingMs: playing?.durationMs ?? null,
    cohortStatus: 'not-evaluated',
    limitations: [
      'The minimum sample counts avoid empty/tiny passes; they do not establish statistical confidence or representativeness.',
      'Keyboard latency excludes physical input and display latency. Other input methods remain unobserved.',
      'Use at least three independent runs per scenario/browser/quality and retain failures. Matched diagnostics overhead, resources, mechanics, physical devices and thermal qualification are separate.',
      'No GPU completion or OS presentation measurement; aggregate long-task entries may include non-playing phases.',
    ],
  };
}

export function resourceStability(snapshots, rules = []) {
  return rules.map((rule) => {
    const rows = snapshots.filter((row) => row.group === rule.group).slice(-rule.last);
    const values = rows.map((row) =>
      rule.path.split('.').reduce((object, key) => object?.[key], row.application),
    );
    if (rows.length !== rule.last || values.some((value) => !Number.isFinite(value)))
      return {
        ...rule,
        status: 'unobserved',
        samples: rows.length,
        values,
        reason: 'Missing compatible exported resource counters.',
      };
    const range = Math.max(...values) - Math.min(...values);
    return {
      ...rule,
      status: range <= rule.maxRange ? 'pass' : 'fail',
      samples: rows.length,
      values,
      range,
      firstToLast: values.at(-1) - values[0],
      scope: 'Owned counter plateau only; not a process, browser or GPU memory measurement.',
    };
  });
}

/** Pause-only Chromium profiling. These are retained heap/DOM observations,
 * not total process memory and not proof of a leak or its absence. */
export function memoryProfileSummary(snapshots, last = 10) {
  const groups = [...new Set(snapshots.filter((row) => row.memory?.after).map((row) => row.group))];
  return groups.map((group) => {
    const rows = snapshots.filter((row) => row.group === group && row.memory?.after).slice(-last);
    const counters = {};
    for (const path of [
      'heap.usedSize',
      'heap.totalSize',
      'heap.embedderHeapUsedSize',
      'heap.backingStorageSize',
      'dom.documents',
      'dom.nodes',
      'dom.jsEventListeners',
    ]) {
      const values = rows.map((row) =>
        path.split('.').reduce((value, key) => value?.[key], row.memory.after),
      );
      if (values.some((value) => !Number.isFinite(value))) {
        counters[path] = { status: 'unavailable', values };
        continue;
      }
      counters[path] = {
        status: rows.length < last ? 'insufficient-comparable-samples' : 'observed',
        values,
        range: Math.max(...values) - Math.min(...values),
        firstToLast: values.at(-1) - values[0],
      };
    }
    return {
      group,
      requestedLast: last,
      samples: rows.length,
      counters,
      gateStatus: 'requires-owner-and-trend-review',
      scope:
        'Post-forced-GC Chromium heap/DOM counters at declared equivalent checkpoints. No universal heap growth tolerance is assumed. Browser/native/GPU/audio decoder allocations may be absent or overlap.',
    };
  });
}

export function mirroredRequest(requestURL, publicURL, localURL) {
  const request = new URL(requestURL),
    publicBase = new URL('.', publicURL),
    localBase = new URL('.', localURL);
  assert(
    ['localhost', '127.0.0.1', '[::1]'].includes(localBase.hostname),
    'Mirror target must be local',
  );
  if (request.origin !== publicBase.origin || !request.pathname.startsWith(publicBase.pathname))
    return null;
  const mapped = new URL(
    request.pathname.slice(publicBase.pathname.length) + request.search,
    localBase,
  );
  assert.equal(mapped.origin, localBase.origin);
  assert(mapped.pathname.startsWith(localBase.pathname), 'Mirror path escaped its admitted prefix');
  return mapped.href;
}

/** Match the entire archived deployment, including ../authoring imports. A
 * missing package file must never silently fall through to today's public app. */
export function createManifestMirror(manifest, publicURL, localURL) {
  assert.equal(manifest.formatVersion, 1);
  string(manifest.entry, 'manifest entry');
  assert(Array.isArray(manifest.files) && manifest.files.length > 0);
  const paths = new Set(
    manifest.files.map(({ path }) => {
      string(path, 'manifest path');
      assert(
        !path.startsWith('/') &&
          !path.includes('\\') &&
          !path.split('/').some((part) => part === '..' || part === '.'),
      );
      return path;
    }),
  );
  assert(paths.has(manifest.entry), 'Manifest entry is not included');
  const root = (entry) => {
    const url = new URL(entry),
      folder = manifest.entry.slice(0, manifest.entry.lastIndexOf('/') + 1);
    const suffix = url.pathname.endsWith(manifest.entry) ? manifest.entry : folder;
    assert(
      suffix && url.pathname.endsWith(suffix),
      'URL must identify the manifest entry or its directory',
    );
    url.pathname = url.pathname.slice(0, -suffix.length);
    url.search = url.hash = '';
    return url;
  };
  const publicRoot = root(publicURL),
    localRoot = root(localURL);
  assert(['localhost', '127.0.0.1', '[::1]'].includes(localRoot.hostname));
  return (requestURL) => {
    const request = new URL(requestURL);
    if (request.origin !== publicRoot.origin)
      return { kind: 'remote', reason: 'Different origin; ordinary browser CSP still applies.' };
    if (request.pathname.startsWith(publicRoot.pathname)) {
      let path;
      try {
        path = decodeURIComponent(request.pathname.slice(publicRoot.pathname.length));
      } catch {
        return { kind: 'blocked', reason: 'Invalid package path' };
      }
      if (!path || path.endsWith('/')) path += 'index.html';
      if (!paths.has(path))
        return { kind: 'blocked', path, reason: 'Absent from frozen package manifest' };
      const mapped = new URL(path + request.search, localRoot);
      assert.equal(mapped.origin, localRoot.origin);
      assert(mapped.pathname.startsWith(localRoot.pathname));
      return { kind: 'local', path, url: mapped.href };
    }
    // The default soundtrack publication is a sibling repository on the same
    // public origin. No other absent runtime path is allowed to float forward.
    if (request.pathname.startsWith('/revealline-soundtracks/'))
      return { kind: 'remote', reason: 'Explicit external soundtrack publication' };
    return {
      kind: 'blocked',
      reason: 'Outside frozen deployment and explicit soundtrack publication',
    };
  };
}
