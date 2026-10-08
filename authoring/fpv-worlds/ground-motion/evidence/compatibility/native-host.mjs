// Native clocks and same-realm standard IndexedDB names. Read-only observer connections.
const token = new URL(location.href).searchParams.get("token");
if (!/^ground-[a-f0-9-]+$/.test(token ?? ""))
  throw Error("Owned fixture token required");
const data = {
  token,
  errors: [],
  warnings: [],
  events: [],
  statuses: [],
  downloads: [],
  rendererCount: 0,
  lastDraw: null,
};
const keep = (key, value, cap = 128) => {
  if (data[key].length < cap) data[key].push(value);
  else
    data.dropped = { ...data.dropped, [key]: (data.dropped?.[key] ?? 0) + 1 };
};
addEventListener("error", (e) =>
  keep("errors", { message: e.message, stack: e.error?.stack }),
);
addEventListener("unhandledrejection", (e) =>
  keep("errors", { message: String(e.reason), stack: e.reason?.stack }),
);
for (const key of ["error", "warn"]) {
  const original = console[key];
  console[key] = (...args) => {
    keep(key === "error" ? "errors" : "warnings", args.map(String).join(" "));
    return original.apply(console, args);
  };
}
for (const name of ["focus", "blur", "visibilitychange"])
  (name === "visibilitychange" ? document : window).addEventListener(name, () =>
    keep("events", {
      name,
      at: performance.now(),
      visible: document.visibilityState,
      focused: document.hasFocus(),
    }),
  );
const urls = new Map(),
  createURL = URL.createObjectURL,
  revokeURL = URL.revokeObjectURL,
  anchorClick = HTMLAnchorElement.prototype.click;
URL.createObjectURL = function (blob) {
  const url = createURL.call(this, blob);
  urls.set(url, blob);
  return url;
};
URL.revokeObjectURL = function (url) {
  urls.delete(url);
  return revokeURL.call(this, url);
};
HTMLAnchorElement.prototype.click = function (...args) {
  if (this.download && urls.has(this.href)) {
    keep("downloads", { name: this.download, blob: urls.get(this.href) }, 16);
    return;
  }
  return anchorClick.apply(this, args);
};
const observer = new MutationObserver(() => {
  const next = {
    at: performance.now(),
    flight: document.getElementById("flight-status")?.textContent,
    studio: document.getElementById("studio-status")?.textContent,
  };
  const prior = data.statuses.at(-1);
  if (!prior || next.flight !== prior.flight || next.studio !== prior.studio)
    keep("statuses", next);
});
for (const id of ["flight-status", "studio-status"])
  observer.observe(document.getElementById(id), {
    childList: true,
    characterData: true,
    subtree: true,
  });
const load = (name) =>
  import(new URL("../civilian-fpv/" + name, location.href));
const [
  { mountWorldApp },
  { createFlightRenderer },
  { openWorldStore },
  { openWorldRecords },
  recordsModule,
  model,
] = await Promise.all([
  load("world-app.mjs"),
  load("world-assets.mjs"),
  load("world-store.mjs"),
  load("world-records.mjs"),
  load("world-records.mjs"),
  load("world-model.mjs"),
]);
let renderer;
const app = mountWorldApp({
  document,
  window,
  rendererFactory(options) {
    data.rendererCount++;
    renderer = createFlightRenderer(options);
    const draw = renderer.draw,
      setCourse = renderer.setCourse;
    renderer.setCourse = function (course, ...args) {
      data.course = course.id;
      data.lastDraw = null;
      return setCourse.call(this, course, ...args);
    };
    renderer.draw = function (state, ...args) {
      const result = draw.call(this, state, ...args);
      data.lastDraw = {
        returned: result,
        ticks: state.ticks,
        status: state.status,
        actors: (state.actors ?? []).map((a) => ({
          id: a.id,
          position: { ...a.position },
          blocked: a.blocked,
        })),
      };
      return result;
    };
    return renderer;
  },
});
await app.ready;
const store = await openWorldStore(),
  records = await openWorldRecords();
window.fpvGround = {
  app,
  data,
  token,
  model,
  recordsModule,
  disposed: false,
  async inspect() {
    return {
      generation: await store.generation(),
      revisions: await store.list({ includeRevisions: true }),
      records: await records.list(),
      recovery: await records.session(),
    };
  },
  async finish() {
    if (this.disposed) return;
    try {
      await app.dispose();
    } finally {
      store.close();
      records.close();
      observer.disconnect();
      this.disposed = true;
      data.resources = renderer?.resources?.() ?? null;
      URL.createObjectURL = createURL;
      URL.revokeObjectURL = revokeURL;
      HTMLAnchorElement.prototype.click = anchorClick;
    }
  },
};
