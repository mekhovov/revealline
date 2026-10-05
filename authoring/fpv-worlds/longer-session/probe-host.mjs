/* Manual observer only: original native results, clocks, state and guards are retained. */
const nativeClone = window.structuredClone,
  nativeRAF = window.requestAnimationFrame,
  nativeIDB = window.indexedDB,
  now = () => performance.now(),
  prefix = new URL(location.href).searchParams.get("storage");
if (!/^steady-[a-f0-9-]+:$/.test(prefix ?? ""))
  throw Error("Missing isolated native store");
const copy = (v) => nativeClone.call(window, v),
  data = {
    format: "FPVLongerSessionHost.v1",
    timeOrigin: performance.timeOrigin,
    environment: {
      userAgent: navigator.userAgent,
      dpr: devicePixelRatio,
      hardwareConcurrency: navigator.hardwareConcurrency,
      platform: navigator.platform,
      language: navigator.language,
      physicalDevice:
        "Unverified; browser-reported fields are not hardware qualification",
      screen: { width: screen.width, height: screen.height },
      viewport: { width: innerWidth, height: innerHeight },
    },
    storagePrefix: prefix,
    windows: [],
    totalHostRAF: 0,
    totalDraws: 0,
    callbacks: [],
    errors: [],
    warnings: [],
    dropped: {},
    support: {
      observerTypes: window.PerformanceObserver?.supportedEntryTypes ?? [],
    },
  };
window.fpvSteadyData = data;
let active = null,
  hostDepth = 0,
  app,
  owner,
  canvas,
  state = null,
  course = null,
  generation = 0,
  observer;
const restores = [],
  nativeCallbacks = new WeakMap();
function stat() {
  return {
    count: 0,
    sumMs: 0,
    minMs: null,
    maxMs: 0,
    histogram: Array(12).fill(0),
  };
}
const bounds = [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 4, 8, 16];
function add(s, ms) {
  s.count++;
  s.sumMs += ms;
  s.minMs = s.minMs === null ? ms : Math.min(s.minMs, ms);
  s.maxMs = Math.max(s.maxMs, ms);
  const i = bounds.findIndex((n) => ms < n);
  s.histogram[i < 0 ? bounds.length : i]++;
}
function metric(row, group, key, ms) {
  add((row[group][key] ??= stat()), ms);
}
function keep(key, value, cap = 32) {
  if (data[key].length < cap) data[key].push(value);
  else data.dropped[key] = (data.dropped[key] ?? 0) + 1;
}
window.addEventListener("error", (e) => keep("errors", e.message));
window.addEventListener("unhandledrejection", (e) =>
  keep("errors", String(e.reason)),
);
for (const key of ["warn", "error"]) {
  const original = console[key];
  const wrapped = function (...args) {
    keep(key === "warn" ? "warnings" : "errors", args.map(String).join(" "));
    return original.apply(this, args);
  };
  console[key] = wrapped;
  restores.push(() => {
    if (console[key] === wrapped) console[key] = original;
  });
}
Object.defineProperty(window, "indexedDB", {
  configurable: true,
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
const cloned = function (...args) {
  const row = active;
  if (!row || !hostDepth) return nativeClone.apply(this, args);
  const entered = now(),
    value = args[0],
    kind =
      value && typeof value === "object"
        ? "ticks" in value &&
          "position" in value &&
          "orientation" in value &&
          "status" in value
          ? "flight-state"
          : typeof value.type === "string"
            ? "criterion-or-typed-object"
            : "other-object"
        : "primitive";
  const start = now();
  try {
    return nativeClone.apply(this, args);
  } finally {
    const end = now();
    metric(row, "clone", kind, end - start);
    row.observerCPUms += now() - entered - (end - start);
  }
};
window.structuredClone = cloned;
restores.push(() => {
  if (window.structuredClone === cloned) window.structuredClone = nativeClone;
});
const raf = function (callback) {
  let info = nativeCallbacks.get(callback);
  if (!info) {
    const stack =
      callback.name === "frame"
        ? new Error("Native RAF registration").stack
        : null;
    info = {
      name: callback.name,
      host:
        callback.name === "frame" &&
        stack.includes("/civilian-fpv/world-app.mjs"),
      stack,
    };
    nativeCallbacks.set(callback, info);
    // Only stable callback registrations needed for attribution; unrelated new callbacks are counted.
    if (info.host || data.callbacks.length < 8) keep("callbacks", info, 16);
  }
  return nativeRAF.call(this, function (...args) {
    const row = active,
      entered = now();
    if (row && info.host) {
      if (row.lastRAF !== null) add(row.rafGaps, args[0] - row.lastRAF);
      row.lastRAF = args[0];
      row.visibility[document.visibilityState] =
        (row.visibility[document.visibilityState] ?? 0) + 1;
      const focus = String(document.hasFocus());
      row.focus[focus] = (row.focus[focus] ?? 0) + 1;
    }
    if (info.host) {
      hostDepth++;
      data.totalHostRAF++;
    }
    const start = now();
    try {
      return callback.apply(this, args);
    } finally {
      const end = now();
      if (info.host) hostDepth--;
      if (row) {
        metric(
          row,
          "rafCPU",
          info.host ? "world-host" : "other-callback",
          end - start,
        );
        if (info.host) {
          const status = state?.status ?? "no-draw";
          row.states[status] = (row.states[status] ?? 0) + 1;
        }
        row.observerCPUms += now() - entered - (end - start);
      }
    }
  });
};
window.requestAnimationFrame = raf;
restores.push(() => {
  if (window.requestAnimationFrame === raf)
    window.requestAnimationFrame = nativeRAF;
});
const watched = (node) =>
  Boolean(node?.id && /^(flight-|world-|aim-)/.test(node.id));
function field(row, node, suffix) {
  const key = node.id + suffix;
  if (!(key in row.dom) && Object.keys(row.dom).length >= 96) {
    row.droppedDOM++;
    return null;
  }
  return (row.dom[key] ??= { calls: 0, unchanged: 0, native: stat() });
}
const textDescriptor = Object.getOwnPropertyDescriptor(
  Node.prototype,
  "textContent",
);
if (textDescriptor?.set && textDescriptor.configurable) {
  const setter = function (value) {
    const row = active;
    if (!row || !hostDepth || !watched(this))
      return textDescriptor.set.call(this, value);
    const entered = now(),
      record = field(row, this, ".textContent"),
      old = textDescriptor.get.call(this);
    const comparable = typeof value === "string" || typeof value === "number";
    const start = now();
    try {
      return textDescriptor.set.call(this, value);
    } finally {
      const end = now();
      if (record) {
        record.calls++;
        record.unchanged += Number(comparable && old === String(value));
        add(record.native, end - start);
      }
      row.observerCPUms += now() - entered - (end - start);
    }
  };
  Object.defineProperty(Node.prototype, "textContent", {
    ...textDescriptor,
    set: setter,
  });
  restores.push(() => {
    if (
      Object.getOwnPropertyDescriptor(Node.prototype, "textContent").set ===
      setter
    )
      Object.defineProperty(Node.prototype, "textContent", textDescriptor);
  });
  data.support.textContent = true;
} else data.support.textContent = false;
const setAttribute = Element.prototype.setAttribute,
  getAttribute = Element.prototype.getAttribute;
const attr = function (name, value) {
  const row = active;
  if (!row || !hostDepth || !watched(this) || typeof name !== "string")
    return setAttribute.apply(this, arguments);
  const entered = now(),
    record = field(row, this, "@" + name),
    old = getAttribute.call(this, name),
    start = now();
  try {
    return setAttribute.apply(this, arguments);
  } finally {
    const end = now();
    if (record) {
      record.calls++;
      record.unchanged += Number(typeof value === "string" && value === old);
      add(record.native, end - start);
    }
    row.observerCPUms += now() - entered - (end - start);
  }
};
Element.prototype.setAttribute = attr;
restores.push(() => {
  if (Element.prototype.setAttribute === attr)
    Element.prototype.setAttribute = setAttribute;
});
const widthDescriptor = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "clientWidth",
);
if (widthDescriptor?.get && widthDescriptor.configurable) {
  const getter = function () {
    const row = active;
    if (!row || !hostDepth || !watched(this))
      return widthDescriptor.get.call(this);
    const entered = now(),
      start = now();
    try {
      return widthDescriptor.get.call(this);
    } finally {
      const end = now();
      metric(row, "layoutReads", this.id + ".clientWidth", end - start);
      row.observerCPUms += now() - entered - (end - start);
    }
  };
  Object.defineProperty(Element.prototype, "clientWidth", {
    ...widthDescriptor,
    get: getter,
  });
  restores.push(() => {
    if (
      Object.getOwnPropertyDescriptor(Element.prototype, "clientWidth").get ===
      getter
    )
      Object.defineProperty(Element.prototype, "clientWidth", widthDescriptor);
  });
  data.support.clientWidth = true;
} else data.support.clientWidth = false;
function performanceEntries(entries) {
  for (const entry of entries)
    for (const row of data.windows) {
      if (
        entry.startTime < row.start ||
        entry.startTime >= (row.end ?? Infinity)
      )
        continue;
      metric(row, "performanceEntries", entry.entryType, entry.duration);
      for (const script of entry.scripts ?? []) {
        const key =
          (script.sourceURL ?? "") +
          ":" +
          (script.sourceFunctionName ?? "") +
          ":" +
          (script.sourceCharPosition ?? "");
        if (!(key in row.scripts) && Object.keys(row.scripts).length >= 24) {
          row.droppedScripts++;
          continue;
        }
        const v = (row.scripts[key] ??= {
          count: 0,
          duration: 0,
          forcedStyleAndLayoutDuration: 0,
        });
        v.count++;
        v.duration += script.duration ?? 0;
        v.forcedStyleAndLayoutDuration +=
          script.forcedStyleAndLayoutDuration ?? 0;
      }
    }
}
const types = ["long-animation-frame", "longtask"].filter((t) =>
  data.support.observerTypes.includes(t),
);
if (types.length) {
  observer = new PerformanceObserver((list) =>
    performanceEntries(list.getEntries()),
  );
  observer.observe({ entryTypes: types });
}
const [{ mountWorldApp }, { createFlightRenderer }, { WORLD_CATALOGUE }] =
  await Promise.all([
    import("./player/optional-practice/civilian-fpv/world-app.mjs"),
    import("./player/optional-practice/civilian-fpv/world-assets.mjs"),
    import("./player/optional-practice/civilian-fpv/world-catalogue.mjs"),
  ]);
app = mountWorldApp({
  document,
  window,
  rendererFactory(options) {
    canvas = options.canvas;
    owner = createFlightRenderer(options);
    const setCourse = owner.setCourse,
      draw = owner.draw;
    owner.setCourse = function (...args) {
      course = args[0].id;
      generation++;
      return setCourse.apply(this, args);
    };
    owner.draw = function (...args) {
      state = args[0];
      data.totalDraws++;
      const row = active;
      if (!row) return draw.apply(this, args);
      const entered = now(),
        start = now();
      try {
        return draw.apply(this, args);
      } finally {
        const end = now();
        add(row.drawCPU, end - start);
        row.observerCPUms += now() - entered - (end - start);
      }
    };
    return owner;
  },
});
window.fpvSteadyBootDispose = async () => {
  try {
    await app?.dispose();
    data.disposed = owner?.resources?.();
  } finally {
    observer?.disconnect();
    restores.reverse().forEach((f) => f());
    data.finishedAt = now();
  }
};
await app.ready;
function capture() {
  const value = owner?.resources?.();
  return {
    course,
    generation,
    state: copy(state),
    resources: value,
    status: document.getElementById("flight-status")?.textContent,
    canvas: canvas ? { width: canvas.width, height: canvas.height } : null,
    mode: document.getElementById("flight-mode").value,
    camera: document.getElementById("flight-camera").value,
    quality: document.getElementById("flight-quality").value,
    appearance: document.getElementById("sim-appearance-world").value,
    preset: document.getElementById("flight-keyboard-preset").value,
    inputSource: document.getElementById("flight-source").value,
    visibility: document.visibilityState,
    focused: document.hasFocus(),
    dialogs: [...document.querySelectorAll("dialog[open]")].map((n) => n.id),
  };
}
window.fpvSteady = {
  data,
  app,
  entries: WORLD_CATALOGUE,
  capture,
  identity() {
    const s = app.snapshot();
    return {
      course: s.course,
      replay: s.replay,
      recordCount: s.records.length,
    };
  },
  peek: () => ({
    course,
    generation,
    status: state?.status,
    ticks: state?.ticks,
  }),
  begin(name, expected, requestedMs = 20000) {
    if (active) throw Error("Window already running");
    const row = {
      name,
      expected,
      before: capture(),
      clone: {},
      dom: {},
      layoutReads: {},
      rafCPU: {},
      drawCPU: stat(),
      rafGaps: stat(),
      performanceEntries: {},
      scripts: {},
      visibility: {},
      focus: {},
      states: {},
      observerCPUms: 0,
      droppedDOM: 0,
      droppedScripts: 0,
      lastRAF: null,
      histogramUpperBoundsMs: bounds,
      requestedMs,
    };
    row.start = now();
    data.windows.push(row);
    active = row;
    return row;
  },
  end() {
    if (!active) throw Error("No active window");
    const row = active;
    row.end = now();
    active = null;
    row.elapsedMs = row.end - row.start;
    performanceEntries(observer?.takeRecords() ?? []);
    row.after = capture();
    delete row.lastRAF;
    return row;
  },
  async finish() {
    if (active) this.end();
    try {
      await app.dispose();
      data.disposed = owner?.resources?.();
    } finally {
      performanceEntries(observer?.takeRecords() ?? []);
      observer?.disconnect();
      restores.reverse().forEach((f) => f());
      data.finishedAt = now();
    }
  },
};
