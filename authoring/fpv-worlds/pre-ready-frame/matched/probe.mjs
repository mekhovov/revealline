/* global window, document, navigator, devicePixelRatio */
// Observation only: every renderer method returns its original result/Promise.
import { observeNativePrograms } from "./native-programs.mjs";
const data = {
  format: "FPVFirstReadyResources.v1",
  timeOrigin: performance.timeOrigin,
  environment: { userAgent: navigator.userAgent, dpr: devicePixelRatio },
  methods: [],
  draws: [],
  phases: [],
  readyTransitions: [],
  errors: [],
  warnings: [],
  resizeDeliveries: [],
};
window.fpvFirstReadyData = data;
let phase = "mount",
  operation = "boot",
  owner,
  canvas,
  generation = 0,
  courseId,
  expectedActors = [],
  drawCount = 0;
let resizeObserver,
  observer,
  cssSize = null;
const pending = { loadScene: 0, prepare: 0 };
const now = () => performance.now();
const nativePrograms = observeNativePrograms(() => ({
  phase,
  generation,
  courseId,
  operation,
}));
data.nativePrograms = nativePrograms.records;
window.addEventListener("error", (e) => data.errors.push(e.message));
window.addEventListener("unhandledrejection", (e) =>
  data.errors.push(String(e.reason)),
);
for (const type of ["error", "warn"]) {
  const prior = console[type];
  console[type] = (...args) => {
    data[type === "error" ? "errors" : "warnings"].push(
      args.map(String).join(" "),
    );
    return prior.apply(console, args);
  };
}
function capture() {
  const value = owner?.resources?.();
  return {
    at: now(),
    status: document.getElementById("flight-status")?.textContent,
    armDisabled: document.getElementById("world-arm")?.disabled,
    phase,
    generation,
    courseId,
    quality: value?.quality,
    actors: value?.presentation?.actors ?? [],
    registered: value?.registered,
    renderer: value?.renderer,
    profileId: value?.presentation?.profileId,
    canvas: canvas
      ? {
          pixels: [canvas.width, canvas.height],
          lastObservedCSS: cssSize,
        }
      : null,
    visibility: document.visibilityState,
    focused: document.hasFocus(),
  };
}
const [{ mountWorldApp }, { createFlightRenderer }, catalogue] =
  await Promise.all([
    import("./player/optional-practice/civilian-fpv/world-app.mjs"),
    import("./player/optional-practice/civilian-fpv/world-assets.mjs"),
    import("./player/optional-practice/civilian-fpv/world-catalogue.mjs"),
  ]);
const app = mountWorldApp({
  document,
  window,
  rendererFactory(options) {
    canvas = options.canvas;
    owner = createFlightRenderer(options);
    if (window.ResizeObserver) {
      resizeObserver = new window.ResizeObserver(([entry]) => {
        cssSize = {
          size: [entry.contentRect.width, entry.contentRect.height],
          at: now(),
        };
        if (data.resizeDeliveries.length < 32)
          data.resizeDeliveries.push(cssSize);
      });
      resizeObserver.observe(canvas);
    }
    for (const name of ["setCourse", "loadScene", "prepare", "dispose"]) {
      const original = owner[name];
      owner[name] = function (...args) {
        if (name === "setCourse") {
          generation++;
          courseId = args[0].id;
          drawCount = 0;
          expectedActors = (args[0].actors ?? []).map((actor) => actor.id);
        }
        const row = {
          name,
          phase,
          generation,
          courseId,
          expectedActors,
          before: capture(),
        };
        data.methods.push(row);
        if (name in pending) pending[name]++;
        const finish = (error, result) => {
          row.end = now();
          row.wallMs = row.end - row.start;
          if (name in pending) pending[name]--;
          if (error) row.error = String(error);
          if (name === "prepare") row.result = result;
          row.after = capture();
        };
        row.start = now();
        const previousOperation = operation;
        operation = name;
        try {
          const result = original.apply(this, args);
          row.dispatchMs = now() - row.start;
          if (result?.then)
            result.then(
              (value) => finish(null, value),
              (error) => finish(error),
            );
          else finish(null, result);
          return result;
        } catch (error) {
          finish(error);
          throw error;
        } finally {
          operation = previousOperation;
        }
      };
    }
    const draw = owner.draw;
    owner.draw = function (state, options) {
      const ordinal = ++drawCount;
      if (ordinal > 3) {
        const previousOperation = operation;
        operation = "draw:later";
        try {
          return draw.call(this, state, options);
        } finally {
          operation = previousOperation;
        }
      }
      const row = {
        phase,
        generation,
        courseId,
        ordinal,
        pending: { ...pending },
        state: structuredClone(state),
        cameraOptions: { ...options },
        before: capture(),
      };
      data.draws.push(row);
      row.start = now();
      const previousOperation = operation;
      operation = "draw:" + ordinal;
      try {
        const result = draw.call(this, state, options);
        row.end = now();
        row.cpuSubmissionMs = row.end - row.start;
        row.after = capture();
        row.stateAfter = structuredClone(state);
        return result;
      } catch (error) {
        row.error = String(error);
        throw error;
      } finally {
        operation = previousOperation;
      }
    };
    return owner;
  },
});
window.fpvFirstReadyCleanup = async () => {
  try {
    await app.dispose();
  } finally {
    observer?.disconnect();
    resizeObserver?.disconnect();
    data.disposedResources = capture();
    data.nativeProgramObservationsDropped = nativePrograms.dropped;
    nativePrograms.restore();
  }
  return data;
};
await app.ready;
const status = document.getElementById("flight-status");
observer = new window.MutationObserver(() => {
  if (/^Ready\./.test(status.textContent))
    data.readyTransitions.push({
      phase,
      at: now(),
      text: status.textContent,
      generation,
      courseId,
    });
});
observer.observe(status, {
  subtree: true,
  childList: true,
  characterData: true,
});
window.fpvFirstReady = {
  data,
  app,
  entries: catalogue.WORLD_CATALOGUE,
  begin(name) {
    phase = name;
    data.phases.push({ name, at: now() });
  },
  finish: window.fpvFirstReadyCleanup,
};
