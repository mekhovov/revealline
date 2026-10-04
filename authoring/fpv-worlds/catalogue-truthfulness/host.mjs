// Native realm and public host; no clock, flight-state or renderer substitution.
const prefix = new URL(location.href).searchParams.get('storage');
if (!/^catalogue-[a-f0-9-]+:$/.test(prefix ?? '')) throw Error('Isolated native prefix required');
const nativeIDB = indexedDB,
  isolated = {
    open: (name, version) =>
      version === undefined
        ? nativeIDB.open(prefix + name)
        : nativeIDB.open(prefix + name, version),
    deleteDatabase: (name) => nativeIDB.deleteDatabase(prefix + name),
    cmp: nativeIDB.cmp.bind(nativeIDB),
  },
  data = { errors: [], warnings: [], rendererCount: 0 };
Object.defineProperty(window, 'indexedDB', { value: isolated });
addEventListener('error', (e) => data.errors.push({ message: e.message, stack: e.error?.stack }));
addEventListener('unhandledrejection', (e) =>
  data.errors.push({ message: String(e.reason), stack: e.reason?.stack }),
);
for (const key of ['error', 'warn']) {
  const original = console[key];
  console[key] = (...args) => {
    data[key === 'error' ? 'errors' : 'warnings'].push(args.map(String).join(' '));
    return original.apply(console, args);
  };
}
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
    data.rendererCount++;
    return (renderer = modules[1].createFlightRenderer(options));
  },
});
await app.ready;
const store = await modules[2].openWorldStore({ indexedDB: isolated }),
  records = await modules[3].openWorldRecords(isolated);
window.fpvCatalogue = {
  app,
  data,
  prefix,
  disposed: false,
  async inspect() {
    return {
      revisions: (await store.list({ includeRevisions: true })).map((r) => ({
        id: r.id,
        sha256: r.sha256,
        active: r.active,
        project: r.project,
      })),
      records: (await records.list()).map((r) => ({
        id: r.id,
        packIdentity: r.packIdentity,
        status: r.status,
        proof: r.proof ? { mode: r.proof.mode, frames: r.proof.frames.length } : null,
      })),
    };
  },
  async finish() {
    if (this.disposed) return;
    try {
      await app.dispose();
    } finally {
      store.close();
      records.close();
      this.disposed = true;
      data.resources = renderer?.resources?.() ?? null;
    }
  },
};
