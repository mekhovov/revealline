// Manual fixture: native iframe IDB and Worker; only named catalogue/pack transport.
const query = new URL(location.href).searchParams,
  prefix = query.get('storage'),
  variant = query.get('variant');
if (
  !/^world-compatibility-[a-f0-9-]+:$/.test(prefix ?? '') ||
  !['old', 'candidate'].includes(variant)
)
  throw Error('Explicit isolated variant required');
const nativeIDB = indexedDB,
  data = { errors: [], warnings: [], requests: [], workers: [], statuses: [] },
  network = { index: { format: 'FPVWorldLibrary.v1', worlds: [] }, packs: {} };
const isolated = {
  open: (name, version) =>
    version === undefined ? nativeIDB.open(prefix + name) : nativeIDB.open(prefix + name, version),
  deleteDatabase: (name) => nativeIDB.deleteDatabase(prefix + name),
  cmp: nativeIDB.cmp.bind(nativeIDB),
};
Object.defineProperty(window, 'indexedDB', { value: isolated });
addEventListener('error', (e) => data.errors.push({ message: e.message, stack: e.error?.stack }));
addEventListener('unhandledrejection', (e) =>
  data.errors.push({ message: String(e.reason), stack: e.reason?.stack }),
);
for (const kind of ['error', 'warn']) {
  const original = console[kind];
  console[kind] = (...args) => {
    data[kind === 'error' ? 'errors' : 'warnings'].push(args.map(String).join(' '));
    return original.apply(console, args);
  };
}
const NativeWorker = Worker;
window.Worker = class extends NativeWorker {
  constructor(input, options) {
    const payload = new URL(input, location.href);
    if (!payload.pathname.endsWith('/optional-practice/fpv-worlds/worker.js')) {
      super(input, options);
      return;
    }
    super(new URL('worker.mjs', parent.location.href), options);
    const row = { payload: payload.href, terminated: 0, events: [] };
    this.row = row;
    data.workers.push(row);
    this.addEventListener('message', (event) => {
      if (!event.data?.compatibilityDiagnostic) {
        row.terminal = event.data?.type;
        return;
      }
      event.stopImmediatePropagation();
      row.events.push(event.data);
      if (event.data.request) data.requests.push(event.data.request);
    });
    super.postMessage({
      compatibilityConfig: {
        payload: payload.href,
        indexURL:
          'https://raw.githubusercontent.com/mekhovov/revealline/main/authoring/fpv-worlds/published/' +
          (variant === 'candidate' ? 'surface-coating-v1/' : '') +
          'index.json',
        index: network.index,
        packs: network.packs,
      },
    });
  }
  terminate() {
    if (this.row) this.row.terminated++;
    return super.terminate();
  }
};
const observer = new MutationObserver(() => {
  const value = document.getElementById('studio-status').textContent;
  if (data.statuses.at(-1) !== value) data.statuses.push(value);
});
observer.observe(document.getElementById('studio-status'), {
  childList: true,
  characterData: true,
  subtree: true,
});
const modules = await Promise.all(
  ['world-app.mjs', 'world-assets.mjs', 'world-store.mjs', 'world-records.mjs'].map(
    (name) => import(new URL('../civilian-fpv/' + name, location.href)),
  ),
);
let renderer;
const app = modules[0].mountWorldApp({
  document,
  window,
  rendererFactory(options) {
    return (renderer = modules[1].createFlightRenderer(options));
  },
});
await app.ready;
const store = await modules[2].openWorldStore({ indexedDB: isolated }),
  records = await modules[3].openWorldRecords(isolated);
window.fpvCompatibility = {
  app,
  data,
  network,
  prefix,
  variant,
  disposed: false,
  async inspect() {
    const snap = app.snapshot();
    return {
      generation: await store.generation(),
      revisions: await store.list({ includeRevisions: true }),
      records: await records.list(),
      recovery: await records.session(),
      draft: document.getElementById('creator-json').value,
      course: snap.course,
      state: snap.state,
      studio: document.getElementById('studio-status').textContent,
    };
  },
  async finish() {
    if (this.disposed) return;
    try {
      await app.dispose();
    } finally {
      this.disposed = true;
      store.close();
      records.close();
      observer.disconnect();
      data.resources = renderer?.resources();
      window.Worker = NativeWorker;
    }
  },
};
