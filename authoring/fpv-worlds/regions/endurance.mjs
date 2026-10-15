import { createFlightRenderer } from '../../../optional-practice/civilian-fpv/renderer.mjs';
import { createRegionalFlightPrototype } from '../../../optional-practice/civilian-fpv/regional/flight-prototype.mjs';
import { createEnduranceFixture, createEndurancePilot, digest } from './endurance-fixture.mjs';
import { createEnduranceClock } from './endurance-clock.mjs';
import { createEnduranceObservation } from './endurance-observation.mjs';

const $ = (id) => document.getElementById(id);
const assert = (value, message) => {
  if (!value) throw new Error(message);
};
const authored = document.body.dataset.enduranceWorkload === 'urban-review-r2';
const format = authored ? 'FPVAuthoredRegionalElapsedReview.v1' : 'FPVRegionalElapsedReview.v1';
let flight = null,
  renderer = null,
  fixture = null,
  run = null,
  report = null;
let preparationAbort = null;
let busy = false,
  closed = false,
  frameId = 0,
  generation = 0;
let history = [],
  sourceHashes = null,
  preparation = null;
const counters = () => ({ count: 0, total: 0, max: 0 });
function record(counter, value) {
  counter.count++;
  counter.total += value;
  counter.max = Math.max(counter.max, value);
}
const summarize = (counter) => ({
  count: counter.count,
  meanMs: counter.count ? counter.total / counter.count : null,
  maxMs: counter.max,
});
const dimensions = () => {
  const canvas = document.querySelector('canvas'),
    box = canvas.getBoundingClientRect();
  const viewport = [
    ['visualViewport', globalThis.visualViewport?.width, globalThis.visualViewport?.height],
    ['window', innerWidth, innerHeight],
    ['document', document.documentElement.clientWidth, document.documentElement.clientHeight],
  ].find(([, width, height]) => width > 0 && height > 0);
  assert(
    viewport && box.width > 0 && box.height > 0 && canvas.width > 0 && canvas.height > 0,
    'Viewport or canvas dimensions unavailable',
  );
  return {
    basis: viewport[0],
    width: viewport[1],
    height: viewport[2],
    dpr: devicePixelRatio,
    cssWidth: box.width,
    cssHeight: box.height,
    backingWidth: canvas.width,
    backingHeight: canvas.height,
  };
};
function buttons() {
  $('prepare').disabled = busy || Boolean(run) || closed;
  $('start').disabled = busy || !flight || Boolean(run) || closed;
  $('stop').disabled = !run;
  $('release').disabled = authored ? !busy && !flight : busy || !flight;
  if (authored) $('release').textContent = busy ? 'Cancel preparation' : 'Release resources';
  $('export').disabled = !report;
  for (const name of ['label', 'duration', 'quality', 'import', 'focus-policy'])
    if ($(name)) $(name).disabled = busy || Boolean(run);
}
function sample() {
  const state = flight.snapshot(),
    collision = flight.collisionSnapshot();
  const owned = Object.fromEntries(
    [
      'geometryBytes',
      'textureBytes',
      'sourceBytes',
      'reservedGeometryBytes',
      'reservedSourceBytes',
    ].map((key) => [key, state.terrain[key] ?? 0]),
  );
  assert(
    owned.reservedGeometryBytes <= 10 * 1024 * 1024,
    'Combined geometry/texture reservation exceeded',
  );
  assert(owned.reservedSourceBytes <= 32 * 1024 * 1024, 'Combined source reservation exceeded');
  assert(
    collision.worlds <= 4 &&
      collision.colliders <= (authored ? fixture.identity.colliderUpperBound : 18) &&
      collision.rigidBodies === 0,
    'Regional collision ownership exceeded',
  );
  for (const key of ['x', 'y', 'z'])
    assert(
      state.localPositionMm[key] + state.originMm[key] === state.position[key],
      'Origin continuity mismatch',
    );
  return {
    elapsedMs: run?.clock.snapshot().elapsedMs ?? 0,
    ticks: state.ticks,
    position: state.position,
    originMm: state.originMm,
    recentres: state.recentres,
    status: state.status,
    reason: state.reason,
    streaming: state.streaming,
    owned,
    collision,
    renderer: renderer.resources().renderer,
    ...(authored ? { verifiedCache: fixture.cacheSnapshot() } : {}),
  };
}
function observe() {
  if (!run || !flight) return;
  const row = sample();
  for (const [key, value] of Object.entries({ ...row.owned, ...row.collision }))
    run.peaks[key] = Math.max(run.peaks[key] ?? 0, value);
  for (const key of ['geometries', 'textures', 'programs']) {
    const value = row.renderer[key];
    if (Number.isFinite(value))
      run.peaks[`renderer${key}`] = Math.max(run.peaks[`renderer${key}`] ?? 0, value);
  }
  run.lastSample = row;
  const second = Math.floor(row.elapsedMs / 1000),
    minute = Math.floor(second / 60);
  if (second !== run.lastSecond) {
    run.lastSecond = second;
    run.recent.push(row);
    if (run.recent.length > 120) run.recent.shift();
  }
  if (minute !== run.lastMinute) {
    run.lastMinute = minute;
    run.minutes.push(row);
    assert(run.minutes.length <= 121, 'Diagnostic history cap exceeded');
  }
}
function buildReport(segment, final = null) {
  return {
    format,
    scope: authored
      ? 'Real elapsed-time immutable Urban road/court workload; production regional flight and renderer. Commanded test pilot, no player input or game progress writes.'
      : 'Real elapsed-time synthetic corridor workload; production regional flight and renderer. No player input or game progress writes.',
    runtimeLabel: segment.label,
    runtimeLabelVerified: false,
    directSourceHashes: sourceHashes,
    wholeRuntimeClosureVerified: false,
    fixture: preparation.fixture,
    startedUTC: segment.startedUTC,
    userAgent: navigator.userAgent,
    dimensions: segment.dimensions,
    quality: segment.quality,
    camera: 'chase',
    mode: 'self-level',
    clock: segment.clock.snapshot(),
    observation: segment.observation.snapshot(),
    ...(authored
      ? { commandedRoute: segment.pilot.snapshot() }
      : { reversals: segment.pilot.reversals }),
    cellCrossings: segment.cellCrossings,
    frames: segment.frames,
    collisionAndReservationPeaks: segment.peaks,
    frameIntervalsMs: { ...summarize(segment.intervals), histogramMs: segment.histogram },
    physicsSubmissionCPU: summarize(segment.physics),
    drawSubmissionCPU: summarize(segment.draw),
    preparation: {
      initial: preparation.initial,
      completedStages: preparation.completedStages,
      maximumElapsedMs: preparation.maximumElapsedMs,
    },
    last120SecondSamples: segment.recent,
    minuteSamples: segment.minutes,
    final,
    priorSegments: history,
    limitations: [
      authored
        ? 'Repeated authored Urban road/court circuit, not all worlds, indoor routes or player behavior'
        : 'Repeated synthetic six-cell corridor, not all maps or player behavior',
      'CPU submission is not GPU completion or physical-device FPS',
      'Resource counters exclude opaque engine/GPU allocations',
      'Imported segments are unverified history and never extend an uninterrupted pass',
      'No persistence, browser-restart or all-network-offline claim',
      ...(authored
        ? [
            'Source payload is fully verified before timing; no network latency is exercised during the measured segment',
          ]
        : []),
    ],
  };
}
async function release() {
  if (!flight && !renderer && !fixture) return null;
  const currentFlight = flight,
    currentRenderer = renderer;
  flight = null;
  renderer = null;
  if (currentFlight) {
    currentFlight.pause();
    await currentFlight.dispose();
  }
  const collision = currentFlight?.collisionSnapshot() ?? null;
  const state = currentFlight?.snapshot() ?? null;
  currentRenderer?.dispose();
  fixture?.dispose?.();
  const verifiedCache = fixture?.cacheSnapshot?.() ?? null;
  fixture = null;
  return {
    collision,
    geometryBytes: state?.terrain.geometryBytes ?? 0,
    reservedGeometryBytes: state?.terrain.reservedGeometryBytes ?? 0,
    reservedSourceBytes: state?.terrain.reservedSourceBytes ?? 0,
    rootChildren: currentFlight?.root.children.length ?? 0,
    renderer: currentRenderer?.resources() ?? null,
    ...(authored ? { verifiedCache } : {}),
  };
}
async function finish(reason = null) {
  if (!run) return;
  const segment = run;
  if (reason) segment.clock.invalidate(reason);
  try {
    observe();
  } catch (error) {
    segment.clock.invalidate(error.message);
  }
  const before = flight?.snapshot();
  run = null;
  busy = true;
  buttons();
  const disposed = await release();
  const zero =
    disposed &&
    disposed.collision.worlds === 0 &&
    disposed.collision.colliders === 0 &&
    disposed.collision.rigidBodies === 0 &&
    disposed.geometryBytes === 0 &&
    disposed.reservedGeometryBytes === 0 &&
    disposed.reservedSourceBytes === 0 &&
    disposed.rootChildren === 0 &&
    (!authored || (disposed.verifiedCache?.files === 0 && disposed.verifiedCache?.bytes === 0));
  report = buildReport(segment, {
    beforeDisposal: before,
    afterDisposal: disposed,
    disposalZero: zero,
  });
  if (!zero) report.disposalFailure = true;
  const routeCoverage =
    !authored || (segment.pilot.snapshot().completedCircuits >= 2 && segment.cellCrossings >= 12);
  if (authored) report.routeCoverageQualified = routeCoverage;
  report.accepted =
    segment.clock.snapshot().status === 'completed' &&
    zero &&
    (!authored || segment.clock.snapshot().targetMs < 600000 || routeCoverage);
  $('result').textContent = JSON.stringify(report, null, 2);
  $('status').textContent = report.accepted
    ? `Completed ${segment.clock.snapshot().elapsedMs / 1000} real seconds; resources released. Export the report.`
    : `Invalid segment: ${segment.clock.snapshot().reason ?? (!zero ? 'resource disposal failed' : 'authored circuit coverage incomplete')}. Start a new segment; prior time does not count.`;
  busy = false;
  buttons();
}
async function readSourceHashes() {
  const names = [
    'renderer.mjs',
    'model.mjs',
    'flight-contact.mjs',
    'flight-support.mjs',
    'regional/flight-prototype.mjs',
    'regional/verified-mixed-window.mjs',
    'regional/terrain-admission.mjs',
    'regional/scenery-admission.mjs',
  ];
  const rows = [];
  for (const path of names) {
    const url = new URL(`../../../optional-practice/civilian-fpv/${path}`, import.meta.url);
    const response = await fetch(url, {
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
    });
    assert(response.ok, `Source identity unavailable: ${path}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    rows.push({ path, bytes: bytes.length, sha256: await digest(bytes) });
  }
  if (authored)
    for (const path of [
      'endurance.mjs',
      'endurance-clock.mjs',
      'endurance-observation.mjs',
      'authored-endurance-fixture.mjs',
    ]) {
      const response = await fetch(new URL(path, import.meta.url), {
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
      });
      assert(response.ok, `Workload identity unavailable: ${path}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      rows.push({ path: `authoring/${path}`, bytes: bytes.length, sha256: await digest(bytes) });
    }
  return rows;
}
$('prepare').onclick = async () => {
  if (busy || run || closed) return;
  busy = true;
  buttons();
  const token = ++generation;
  preparationAbort = new AbortController();
  $('status').textContent = 'Preparing verified fixture and production renderer; still disarmed.';
  try {
    await release();
    sourceHashes = await readSourceHashes();
    fixture = authored
      ? await (
          await import('./authored-endurance-fixture.mjs')
        ).createAuthoredEnduranceFixture({
          signal: AbortSignal.any([preparationAbort.signal, AbortSignal.timeout(180000)]),
        })
      : await createEnduranceFixture();
    assert(token === generation && !closed, 'Preparation superseded');
    const replacement = document.createElement('canvas');
    replacement.setAttribute('aria-label', 'Production regional flight renderer');
    document.querySelector('canvas').replaceWith(replacement);
    renderer = createFlightRenderer({
      canvas: replacement,
      window,
      reducedMotion: false,
      onContextLost: () => {
        if (run) void finish('Graphics context lost');
      },
    });
    assert(renderer.available, 'WebGL unavailable');
    renderer.setQuality($('quality').value);
    preparation = {
      initial: null,
      completedStages: 0,
      maximumElapsedMs: 0,
      fixture: authored
        ? {
            ...fixture.identity,
            id: fixture.terrain.manifest.id,
            revision: fixture.terrain.manifest.revision,
          }
        : {
            id: fixture.terrain.manifest.id,
            revision: fixture.terrain.manifest.revision,
            terrainManifestSHA256: await digest(
              new TextEncoder().encode(JSON.stringify(fixture.terrain.manifest)),
            ),
            sceneryManifestSHA256: await digest(
              new TextEncoder().encode(JSON.stringify(fixture.scenery.manifest)),
            ),
            source: 'Generated canonical six-cell corridor; deterministic reference workload',
          },
    };
    flight = createRegionalFlightPrototype({
      manifest: fixture.terrain.manifest,
      source: {
        ...fixture.terrain.source,
        ...(authored
          ? {
              surfaceQuality: { low: 'performance', balanced: 'balanced', high: 'quality' }[
                $('quality').value
              ],
            }
          : {}),
      },
      scenery: { manifest: fixture.scenery.manifest, source: fixture.scenery.source },
      geometryProfile: 'terrain-scenery-v1',
      continuous: true,
      prepareFrame: async (group, options) => {
        observe();
        await renderer.prepareRegionalFrame(group, options);
        const result = renderer.regionalPreparation();
        assert(result?.status === 'prepared', 'Renderer frame preparation did not complete');
        preparation.completedStages++;
        preparation.maximumElapsedMs = Math.max(preparation.maximumElapsedMs, result.elapsedMs);
        preparation.initial ??= result;
        observe();
      },
    });
    renderer.setRegional(flight, fixture.terrain.manifest);
    await flight.prepare();
    assert(token === generation && !closed, 'Preparation superseded');
    assert(flight.snapshot().status !== 'active', 'Preparation armed unexpectedly');
    assert(renderer.draw(flight.snapshot(), { cameraMode: 'chase' }), 'Initial draw failed');
    $('status').textContent =
      'Ready, disarmed. Start begins a new uninterrupted segment at tick zero.';
  } catch (error) {
    await release();
    $('status').textContent = `Preparation failed: ${error.message}`;
  } finally {
    preparationAbort = null;
    busy = false;
    buttons();
  }
};
$('start').onclick = () => {
  if (!flight || run || busy || closed) return;
  try {
    const startedAt = performance.now();
    const observation = createEnduranceObservation({
      policy: authored ? ($('focus-policy')?.value ?? 'strict-focus') : 'strict-focus',
      startedAt,
    });
    const observationFailure = observation.observe({
      at: startedAt,
      visible: document.visibilityState === 'visible',
      focused: document.hasFocus(),
      type: 'start',
    });
    assert(!observationFailure, observationFailure);
    const measuredDimensions = dimensions();
    assert(flight.snapshot().ticks === 0 && flight.arm(), 'Fresh disarmed fixture required');
    if (report) {
      history.push({
        importedUnverified: false,
        startedUTC: report.startedUTC,
        accepted: report.accepted,
        clock: report.clock,
        runtimeLabel: report.runtimeLabel,
        observationPolicy: report.observation?.policy ?? 'not-recorded',
      });
      history = history.slice(-8);
    }
    run = {
      clock: createEnduranceClock({
        startedAt,
        startedWallAt: Date.now(),
        targetMs: Number($('duration').value),
      }),
      observation,
      label: $('label').value,
      quality: $('quality').value,
      startedUTC: new Date().toISOString(),
      dimensions: measuredDimensions,
      pilot: fixture.createPilot?.() ?? createEndurancePilot(),
      frames: 0,
      cellCrossings: 0,
      previous: null,
      intervals: counters(),
      physics: counters(),
      draw: counters(),
      histogram: Array(251).fill(0),
      peaks: {},
      recent: [],
      minutes: [],
      lastSecond: -1,
      lastMinute: -1,
      lastSample: null,
    };
    observe();
    buttons();
    $('status').textContent =
      `${authored ? 'Running commanded Urban circuit' : 'Running synthetic flight'} in real elapsed time. ` +
      (observation.snapshot().policy === 'strict-focus'
        ? 'Keep this tab visible and focused.'
        : 'Keep this tab visible. Window focus is optional and recorded; no player input is measured.');
  } catch (error) {
    flight.pause();
    $('status').textContent = error.message;
  }
};
$('stop').onclick = () => void finish('Stopped by reviewer');
$('release').onclick = async () => {
  if (authored && busy) {
    generation++;
    preparationAbort?.abort(new DOMException('Preparation cancelled by reviewer', 'AbortError'));
    flight?.cancelPreparation();
    return;
  }
  if (run) return void finish('Released by reviewer');
  busy = true;
  buttons();
  await release();
  busy = false;
  buttons();
  $('status').textContent = 'Resources released. Prepare to start another segment.';
};
$('export').onclick = () => {
  if (!report) return;
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = 'regional-elapsed-review.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$('import').onchange = async () => {
  const file = $('import').files[0];
  if (!file || run || busy) return;
  try {
    assert(file.size <= 1024 * 1024, 'Report exceeds 1 MiB limit');
    const value = JSON.parse(await file.text());
    assert(
      value.format === format &&
        typeof value.startedUTC === 'string' &&
        value.startedUTC.length <= 40 &&
        typeof value.runtimeLabel === 'string' &&
        value.runtimeLabel.length <= 100 &&
        Number.isSafeInteger(value.clock?.ticks) &&
        value.clock.ticks >= 0 &&
        value.clock.ticks <= 360000 &&
        Number.isFinite(value.clock.elapsedMs) &&
        value.clock.elapsedMs >= 0,
      'Invalid report summary',
    );
    history.push({
      importedUnverified: true,
      startedUTC: value.startedUTC,
      runtimeLabel: value.runtimeLabel,
      ticks: value.clock.ticks,
      elapsedMs: value.clock.elapsedMs,
      claimedAccepted: value.accepted === true,
      observationPolicy: ['strict-focus', 'visible-commanded'].includes(value.observation?.policy)
        ? value.observation.policy
        : 'not-recorded',
    });
    history = history.slice(-8);
    $('status').textContent =
      'Imported history only. Prepare and Start begin a new zero-time segment.';
  } catch (error) {
    $('status').textContent = `Report not imported: ${error.message}`;
  }
};
function frame() {
  if (closed) return;
  if (run) {
    try {
      const observationFailure = run.observation.observe({
        at: performance.now(),
        visible: document.visibilityState === 'visible',
        focused: document.hasFocus(),
      });
      assert(!observationFailure, observationFailure);
      assert(
        JSON.stringify(dimensions()) === JSON.stringify(run.dimensions),
        'Viewport or canvas changed',
      );
      const now = performance.now();
      if (run.previous !== null) {
        const delta = now - run.previous;
        record(run.intervals, delta);
        run.histogram[Math.min(250, Math.floor(delta))]++;
      }
      run.previous = now;
      const start = performance.now();
      const clock = run.clock.advance(
        now,
        () => {
          const before = flight.snapshot(),
            state = flight.step(run.pilot.command(before));
          if (authored) assert(state.contacts === 0, 'Unexpected contact on authored review route');
          const size = fixture.terrain.manifest.grid.cellSizeMm;
          if (
            ['x', 'z'].some(
              (key) =>
                Math.floor(before.position[key] / size) !== Math.floor(state.position[key] / size),
            )
          )
            run.cellCrossings++;
          return state.status === 'active' && state.ticks === before.ticks + 1;
        },
        Date.now(),
      );
      record(run.physics, performance.now() - start);
      const drawStart = performance.now();
      assert(renderer.draw(flight.snapshot(), { cameraMode: 'chase' }), 'Graphics unavailable');
      record(run.draw, performance.now() - drawStart);
      run.frames++;
      if (clock.status !== 'running') {
        void finish();
      } else if (Math.floor(clock.elapsedMs / 1000) !== run.lastSecond) {
        observe();
        report = buildReport(run);
        $('result').textContent = JSON.stringify(report, null, 2);
        $('status').textContent =
          `${(clock.elapsedMs / 1000).toFixed(1)} / ${clock.targetMs / 1000} real seconds · ${clock.ticks} ticks · ${run.lastSample.recentres} recentres · ${authored ? run.pilot.snapshot().acceptedWaypoints : run.pilot.reversals} ${authored ? 'accepted waypoints' : 'turns'} · ${run.observation.snapshot().policy}`;
        buttons();
      }
    } catch (error) {
      void finish(error.message);
    }
  } else if (flight && renderer && !busy) renderer.draw(flight.snapshot(), { cameraMode: 'chase' });
  frameId = requestAnimationFrame(frame);
}
function observeWindow(type, focused = document.hasFocus()) {
  if (!run) return;
  const reason = run.observation.observe({
    at: performance.now(),
    visible: document.visibilityState === 'visible' && !document.hidden,
    focused,
    type,
  });
  if (reason) void finish(reason);
}
addEventListener('blur', () => observeWindow('blur', false));
addEventListener('focus', () => observeWindow('focus', true));
document.addEventListener('visibilitychange', () => observeWindow('visibilitychange'));
addEventListener(
  'pagehide',
  () => {
    closed = true;
    generation++;
    preparationAbort?.abort(new DOMException('Review page left', 'AbortError'));
    cancelAnimationFrame(frameId);
    if (run) void finish('Page left');
    else void release();
  },
  { once: true },
);
frameId = requestAnimationFrame(frame);
