/* Native lifecycle fixture only. No flight state, clocks or production guards are replaced. */
const params = new URL(location.href).searchParams,
  nativeIDB = window.indexedDB,
  prefix = params.get("storage");
if (!prefix || !/^warm-[a-f0-9-]+:$/.test(prefix))
  throw Error("Missing isolated native storage prefix");
const data = {
  format: "FPVWarmLifecycleHost.v1",
  timeOrigin: performance.timeOrigin,
  storagePrefix: prefix,
  methods: [],
  draws: [],
  warm: [],
  statuses: [],
  errors: [],
  warnings: [],
  actions: [],
  databaseEvents: [],
  pageEvents: [],
  dropped: {},
  losses: 0,
  restorations: 0,
};
window.fpvWarmData = data;
let app,
  owner,
  canvas,
  gl,
  extension,
  courseId = null,
  courseGeneration = 0,
  methodSequence = 0,
  latestPrepare = null,
  latestLoad = null,
  phase = "mount",
  phaseDraws = 0,
  lossOnWarm = false;
const pending = { prepare: 0, loadScene: 0 };
const now = () => performance.now(),
  copy = (v) => structuredClone(v),
  keep = (key, row, limit = 256) => {
    if (data[key].length < limit) data[key].push(row);
    else data.dropped[key] = (data.dropped[key] ?? 0) + 1;
  };
const observedDBs = new WeakSet(),
  databaseHooks = [];
let connectionSequence = 0,
  transactionSequence = 0;
const databaseEvent = (type, info = {}) =>
  keep("databaseEvents", { type, at: now(), phase, ...info }, 1024);
function observeConnection(db) {
  if (observedDBs.has(db)) return;
  observedDBs.add(db);
  const info = {
    connection: ++connectionSequence,
    name: db.name,
    version: db.version,
  };
  databaseEvent("open-success", info);
  const originalClose = db.close,
    originalTransaction = db.transaction;
  const close = function (...args) {
    databaseEvent("close-call", {
      ...info,
      stack: new Error("Native connection close called").stack,
    });
    return originalClose.apply(this, args);
  };
  const transaction = function (...args) {
    const detail = {
      ...info,
      transaction: ++transactionSequence,
      stores: Array.from(typeof args[0] === "string" ? [args[0]] : args[0]),
      mode: args[1] ?? "readonly",
    };
    try {
      const tx = originalTransaction.apply(this, args);
      databaseEvent("transaction-start", detail);
      for (const event of ["complete", "abort", "error"])
        tx.addEventListener(
          event,
          () =>
            databaseEvent("transaction-" + event, {
              ...detail,
              error: tx.error?.message ?? null,
            }),
          { once: true },
        );
      return tx;
    } catch (error) {
      databaseEvent("transaction-throw", {
        ...detail,
        error: String(error),
        stack: error.stack,
      });
      throw error;
    }
  };
  db.close = close;
  db.transaction = transaction;
  const changed = (event) =>
    databaseEvent("versionchange", {
      ...info,
      oldVersion: event.oldVersion,
      newVersion: event.newVersion,
    });
  const closed = () => databaseEvent("native-forced-close", info);
  db.addEventListener("versionchange", changed);
  db.addEventListener("close", closed);
  databaseHooks.push(() => {
    if (db.close === close) delete db.close;
    if (db.transaction === transaction) delete db.transaction;
    db.removeEventListener("versionchange", changed);
    db.removeEventListener("close", closed);
  });
}
Object.defineProperty(window, "indexedDB", {
  value: {
    open(name, version) {
      databaseEvent("open-request", { name: prefix + name, version });
      const request =
        version === undefined
          ? nativeIDB.open(prefix + name)
          : nativeIDB.open(prefix + name, version);
      request.addEventListener(
        "success",
        () => observeConnection(request.result),
        { once: true },
      );
      for (const event of ["error", "blocked", "upgradeneeded"])
        request.addEventListener(event, (e) =>
          databaseEvent("open-" + event, {
            name: prefix + name,
            version,
            error: event === "error" ? (request.error?.message ?? null) : null,
            oldVersion: e.oldVersion,
            newVersion: e.newVersion,
          }),
        );
      return request;
    },
    deleteDatabase(name) {
      databaseEvent("delete-request", {
        name: prefix + name,
        stack: new Error("Native database deletion requested").stack,
      });
      return nativeIDB.deleteDatabase(prefix + name);
    },
    cmp: nativeIDB.cmp.bind(nativeIDB),
  },
});
const pageEvent = (event) =>
  keep("pageEvents", {
    type: event.type,
    at: now(),
    phase,
    focused: document.hasFocus(),
    visibility: document.visibilityState,
    persisted: event.persisted,
  });
for (const event of ["focus", "blur", "pagehide", "pageshow"])
  window.addEventListener(event, pageEvent);
document.addEventListener("visibilitychange", pageEvent);
const capture = () => ({
  at: now(),
  phase,
  courseId,
  status: document.getElementById("flight-status")?.textContent,
  armDisabled: document.getElementById("world-arm")?.disabled,
  resources: owner?.resources?.(),
  ghost: owner?.ghostSnapshot?.(),
  pixels: canvas ? [canvas.width, canvas.height] : null,
  focused: document.hasFocus(),
  visibility: document.visibilityState,
});
const error = (e) => data.errors.push(String(e.message ?? e.reason ?? e));
window.addEventListener("error", error);
window.addEventListener("unhandledrejection", error);
for (const kind of ["error", "warn"]) {
  const original = console[kind];
  console[kind] = (...args) => {
    data[kind === "error" ? "errors" : "warnings"].push(
      args.map(String).join(" "),
    );
    return original.apply(console, args);
  };
}
const [{ mountWorldApp }, { createFlightRenderer }, catalogue] =
  await Promise.all([
    import("./player/optional-practice/civilian-fpv/world-app.mjs"),
    import("./player/optional-practice/civilian-fpv/world-assets.mjs"),
    import("./player/optional-practice/civilian-fpv/world-catalogue.mjs"),
  ]);
const onLost = () => data.losses++,
  onRestored = () => data.restorations++;
app = mountWorldApp({
  document,
  window,
  rendererFactory(options) {
    canvas = options.canvas;
    owner = createFlightRenderer(options);
    gl = canvas.getContext("webgl2");
    extension = gl?.getExtension("WEBGL_lose_context");
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    data.nativeLossSupported = Boolean(extension);
    if (params.has("initial-loss"))
      queueMicrotask(() => extension?.loseContext());
    for (const name of ["setCourse", "loadScene", "prepare", "dispose"]) {
      const original = owner[name];
      if (!original) continue;
      owner[name] = function (...args) {
        if (name === "setCourse") {
          courseId = args[0].id;
          courseGeneration++;
          latestPrepare = null;
          latestLoad = null;
        }
        const row = {
          id: ++methodSequence,
          name,
          phase,
          courseId,
          generation: courseGeneration,
          start: now(),
        };
        if (name === "prepare") latestPrepare = row;
        if (name === "loadScene") latestLoad = row;
        keep("methods", row);
        if (name in pending) pending[name]++;
        const settled = (result, error) => {
          row.end = now();
          if (name in pending) pending[name]--;
          if (name === "prepare") row.result = result;
          if (error) row.error = String(error);
        };
        try {
          const result = original.apply(this, args);
          if (result?.then)
            result.then(
              (v) => settled(v),
              (e) => settled(null, e),
            );
          else settled(result);
          return result;
        } catch (e) {
          settled(null, e);
          throw e;
        }
      };
    }
    const original = owner.draw;
    owner.draw = function (state, options) {
      const warm = document.getElementById("world-arm").disabled,
        record = warm || phaseDraws++ < 3;
      const row = record
        ? {
            phase,
            courseId,
            start: now(),
            warm,
            generation: courseGeneration,
            preparation: latestPrepare ? copy(latestPrepare) : null,
            sceneLoad: latestLoad ? copy(latestLoad) : null,
            pendingMethods: data.methods.filter((m) => !m.end).map(copy),
            pending: { ...pending },
            state: copy(state),
            camera: copy(options),
            before: capture(),
          }
        : null;
      if (warm && lossOnWarm) {
        lossOnWarm = false;
        data.requestedWarmLoss = { phase, at: now() };
        extension.loseContext();
      }
      try {
        const result = original.call(this, state, options);
        if (row) {
          row.end = now();
          row.result = result;
          row.stateAfter = copy(state);
          row.after = capture();
          keep(warm ? "warm" : "draws", row);
        }
        return result;
      } catch (error) {
        if (row) {
          row.error = String(error);
          keep(warm ? "warm" : "draws", row);
        }
        throw error;
      }
    };
    return owner;
  },
});
await app.ready;
const observer = new MutationObserver(() =>
  keep("statuses", {
    at: now(),
    phase,
    courseId,
    text: document.getElementById("flight-status").textContent,
    armDisabled: document.getElementById("world-arm").disabled,
  }),
);
observer.observe(document.getElementById("flight-status"), {
  subtree: true,
  childList: true,
  characterData: true,
});
window.fpvWarm = {
  data,
  app,
  entries: catalogue.WORLD_CATALOGUE,
  capture,
  begin(name) {
    phase = name;
    phaseDraws = 0;
  },
  requestWarmLoss() {
    if (!extension) throw Error("Native context loss unavailable");
    lossOnWarm = true;
  },
  restore() {
    extension.restoreContext();
  },
  async finish() {
    try {
      await app.dispose();
    } finally {
      observer.disconnect();
      canvas?.removeEventListener("webglcontextlost", onLost);
      canvas?.removeEventListener("webglcontextrestored", onRestored);
      data.disposed = capture();
      for (const restore of databaseHooks.splice(0)) restore();
      for (const event of ["focus", "blur", "pagehide", "pageshow"])
        window.removeEventListener(event, pageEvent);
      document.removeEventListener("visibilitychange", pageEvent);
      data.finishedAt = new Date().toISOString();
    }
    return data;
  },
};
