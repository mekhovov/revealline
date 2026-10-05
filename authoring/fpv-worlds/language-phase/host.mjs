/* Manual fixture: native iframe storage, ordinary renderer and unchanged clocks. */
const prefix = new URL(location.href).searchParams.get("storage");
if (!/^phase-[a-f0-9-]+:$/.test(prefix ?? ""))
  throw Error("Missing isolated storage prefix");
const nativeIDB = window.indexedDB;
Object.defineProperty(window, "indexedDB", {
  value: {
    open(name, version) {
      return version === undefined
        ? nativeIDB.open(prefix + name)
        : nativeIDB.open(prefix + name, version);
    },
    deleteDatabase(name) {
      return nativeIDB.deleteDatabase(prefix + name);
    },
    cmp: nativeIDB.cmp.bind(nativeIDB),
  },
});
const data = {
  errors: [],
  warnings: [],
  events: [],
  pageEvents: [],
  dropped: {},
  storagePrefix: prefix,
};
function keep(key, row, max = 128) {
  if (data[key].length < max) data[key].push(row);
  else data.dropped[key] = (data.dropped[key] ?? 0) + 1;
}
window.addEventListener("error", (e) => keep("errors", String(e.message)));
window.addEventListener("unhandledrejection", (e) =>
  keep("errors", String(e.reason)),
);
for (const kind of ["error", "warn"]) {
  const original = console[kind];
  console[kind] = (...args) => {
    keep(kind === "error" ? "errors" : "warnings", args.map(String).join(" "));
    return original.apply(console, args);
  };
}
for (const type of ["click", "keydown", "keyup", "focusin"])
  document.addEventListener(
    type,
    (e) => {
      if (e.target?.id === "show-ghost")
        keep("events", {
          type,
          at: performance.now(),
          trusted: e.isTrusted,
          key: e.key,
          code: e.code,
          detail: e.detail,
          pointerType: e.pointerType,
          text: e.target.textContent,
        });
    },
    true,
  );
for (const type of ["focus", "blur", "pagehide", "pageshow"])
  window.addEventListener(type, (e) =>
    keep("pageEvents", {
      type,
      at: performance.now(),
      focused: document.hasFocus(),
      visibility: document.visibilityState,
    }),
  );
document.addEventListener("visibilitychange", () =>
  keep("pageEvents", {
    type: "visibilitychange",
    at: performance.now(),
    focused: document.hasFocus(),
    visibility: document.visibilityState,
  }),
);
const [{ mountWorldApp }, { createFlightRenderer }] = await Promise.all([
  import("./player/optional-practice/civilian-fpv/world-app.mjs"),
  import("./player/optional-practice/civilian-fpv/world-assets.mjs"),
]);
let renderer;
const app = mountWorldApp({
  document,
  window,
  rendererFactory(options) {
    renderer = createFlightRenderer(options);
    return renderer;
  },
});
await app.ready;
window.fpvPhase = {
  app,
  data,
  capture: () => ({
    resources: renderer?.resources(),
    ghost: renderer?.ghostSnapshot(),
    visibility: document.visibilityState,
    focused: document.hasFocus(),
  }),
  async finish() {
    await app.dispose();
    data.disposed = this.capture();
    return data;
  },
};
