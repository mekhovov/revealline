/* global document, window, innerWidth, innerHeight, devicePixelRatio, addEventListener, PerformanceObserver, requestAnimationFrame, cancelAnimationFrame, parent, location */
// Transparent observers around the actual host's supported rendererFactory seam.
const started = performance.now();
const data = {
  format: 'FPVCurrentPlayerProfile.v1',
  timeOrigin: performance.timeOrigin,
  startedAt: new Date().toISOString(),
  environment: {
    userAgent: navigator.userAgent,
    hardwareConcurrency: navigator.hardwareConcurrency,
    viewport: [innerWidth, innerHeight],
    dpr: devicePixelRatio,
  },
  spans: [],
  draws: [],
  raf: [],
  tasks: [],
  visibility: [],
  errors: [],
  warnings: [],
  checks: [],
  samples: [],
  dropped: {},
  observerSupport: {},
  context: { phase: 'document-start' },
};
const limit = 15000;
function put(key, row) {
  if (data[key].length < limit) data[key].push(row);
  else data.dropped[key] = (data.dropped[key] ?? 0) + 1;
}
const at = () => performance.now() - started;
const begin = (name, detail = {}) => {
  const row = { name, context: { ...data.context }, start: at(), ...detail };
  put('spans', row);
  return row;
};
const end = (row, error) => {
  row.end = at();
  row.wallMs = row.end - row.start;
  if (error) row.error = String(error?.stack ?? error);
};
const visibility = (type) =>
  put('visibility', {
    type,
    at: at(),
    state: document.visibilityState,
    focus: document.hasFocus(),
  });
for (const type of ['visibilitychange', 'focus', 'blur'])
  addEventListener(type, () => visibility(type));
visibility('start');
addEventListener('error', (e) => data.errors.push(e.message));
addEventListener('unhandledrejection', (e) =>
  data.errors.push(String(e.reason?.stack ?? e.reason)),
);
for (const kind of ['error', 'warn']) {
  const prior = console[kind];
  console[kind] = (...args) => {
    data[kind === 'error' ? 'errors' : 'warnings'].push(args.map(String).join(' '));
    return prior.apply(console, args);
  };
}
const observers = [];
for (const type of ['longtask', 'long-animation-frame']) {
  data.observerSupport[type] = PerformanceObserver.supportedEntryTypes.includes(type);
  if (!data.observerSupport[type]) continue;
  const take = (entries) =>
    entries.forEach((item) =>
      put('tasks', {
        type,
        start: item.startTime - started,
        duration: item.duration,
        renderStart: item.renderStart ? item.renderStart - started : null,
        styleAndLayoutStart: item.styleAndLayoutStart ? item.styleAndLayoutStart - started : null,
        blockingDuration: item.blockingDuration,
        scripts: item.scripts
          ? [...item.scripts].map((s) => ({
              invoker: s.invoker,
              invokerType: s.invokerType,
              sourceURL: s.sourceURL,
              sourceFunctionName: s.sourceFunctionName,
              start: s.startTime - started,
              duration: s.duration,
              forcedStyleAndLayoutDuration: s.forcedStyleAndLayoutDuration,
            }))
          : undefined,
      }),
    );
  const observer = new PerformanceObserver((list) => take(list.getEntries()));
  observer.observe({ type });
  observers.push({ observer, take });
}
let raf,
  lastRAF,
  lastState = null,
  owner = null,
  installedCourse = null;
function pulse() {
  const t = at();
  if (lastRAF !== undefined)
    put('raf', { at: t, intervalMs: t - lastRAF, context: { ...data.context } });
  lastRAF = t;
  raf = requestAnimationFrame(pulse);
}
raf = requestAnimationFrame(pulse);
const load = begin('import.host');
const [{ mountWorldApp }, { createFlightRenderer }, catalogue] = await Promise.all([
  import('./player/optional-practice/civilian-fpv/world-app.mjs'),
  import('./player/optional-practice/civilian-fpv/world-assets.mjs'),
  import('./player/optional-practice/civilian-fpv/world-catalogue.mjs'),
]);
end(load);
const mounting = begin('host.mount-and-ready');
const app = mountWorldApp({
  window,
  document,
  rendererFactory(options) {
    const row = begin('renderer.create', { canvas: options.canvas.id });
    owner = createFlightRenderer(options);
    end(row);
    const gl = options.canvas.getContext('webgl2');
    if (gl)
      data.environment.webgl = {
        vendor: gl.getParameter(gl.VENDOR),
        renderer: gl.getParameter(gl.RENDERER),
        version: gl.getParameter(gl.VERSION),
        parallelCompile: Boolean(gl.getExtension('KHR_parallel_shader_compile')),
      };
    for (const name of [
      'setPresentation',
      'setCourse',
      'setQuality',
      'setDrone',
      'loadScene',
      'prepare',
      'dispose',
    ]) {
      const original = owner[name];
      if (typeof original !== 'function') continue;
      owner[name] = function (...args) {
        const detail =
          name === 'setCourse'
            ? { courseId: args[0].id, mode: args[1] }
            : name === 'setQuality'
              ? { quality: args[0] }
              : {};
        const row = begin('renderer.' + name, detail);
        try {
          const result = original.apply(this, args);
          if (name === 'setCourse') installedCourse = args[0].id;
          row.dispatchMs = at() - row.start;
          if (result?.then)
            result.then(
              () => end(row),
              (error) => end(row, error),
            );
          else end(row);
          return result;
        } catch (error) {
          end(row, error);
          throw error;
        }
      };
    }
    const draw = owner.draw;
    owner.draw = function (state, ...args) {
      const before = performance.now();
      const value = draw.call(this, state, ...args);
      put('draws', {
        at: at(),
        cpuSubmissionMs: performance.now() - before,
        courseId: installedCourse,
        context: { ...data.context },
      });
      lastState = {
        courseId: installedCourse,
        ticks: state.ticks,
        status: state.status,
        mode: state.mode,
        position: state.position ? { ...state.position } : null,
      };
      return value;
    };
    return owner;
  },
});
await app.ready;
end(mounting);
cancelAnimationFrame(raf);
data.readyAt = at();
window.fpvWorldStudio = app;
window.fpvPerformance = {
  data,
  entries: [...catalogue.WORLD_CATALOGUE, ...catalogue.BEGINNER_CATALOGUE],
  state: () => (lastState ? { ...lastState } : null),
  resources: () => owner?.resources(),
  begin,
  end,
  visibility,
  startMeasurement() {
    data.measurementStartedAt = at();
    data.operatorIdleMs = data.measurementStartedAt - data.readyAt;
    data.context = { phase: 'measurement-start' };
    lastRAF = undefined;
    raf = requestAnimationFrame(pulse);
    visibility('measurement-start');
  },
  async finish() {
    data.measurementEndedAt = at();
    data.context = { phase: 'dispose' };
    await app.dispose();
    data.disposedResources = owner?.resources();
    cancelAnimationFrame(raf);
    for (const { observer, take } of observers) {
      take(observer.takeRecords());
      observer.disconnect();
    }
    data.finishedAt = new Date().toISOString();
    data.elapsedMs = at();
    return data;
  },
};
parent.postMessage({ type: 'fpv-profile-ready' }, location.origin);
