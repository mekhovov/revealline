/* Diagnostic-only: native iframe storage, original clocks and production host. */
const parameters = new URL(location.href).searchParams;
const token = parameters.get('token');
if (!/^journey-[a-f0-9-]+$/.test(token ?? '')) throw Error('Owned journey token required');
const initialDatabases = await indexedDB.databases();
const initialCaches = await caches.keys();
if (parameters.get('fresh') === 'true' && (initialDatabases.length || initialCaches.length))
  throw Error('Dedicated origin is already used; choose another origin, never erase its data.');
const prefix = ''; // Deliberately standard names: cached native entry must see these same records.
const nativeIDB = window.indexedDB,
  owners = new WeakSet();
const data = {
  origin: location.origin,
  token,
  initialDatabases,
  initialCaches,
  lastDraw: null,
  rendererCreations: 0,
  errors: [],
  warnings: [],
  transactions: [],
  faults: [],
  statuses: [],
  events: [],
  downloads: [],
  dropped: {},
  activeTransactions: 0,
  fault: null,
  pendingRefresh: false,
  pendingGeneration: false,
};
const keep = (key, row, max = 1024) => {
  if (data[key].length < max) data[key].push(row);
  else data.dropped[key] = (data.dropped[key] ?? 0) + 1;
};
const open = (name, version, owner) => {
  const r =
    version === undefined ? nativeIDB.open(prefix + name) : nativeIDB.open(prefix + name, version);
  if (owner) r.addEventListener('success', () => owners.add(r.result), { once: true });
  return r;
};
Object.defineProperty(window, 'indexedDB', {
  value: {
    open: (name, version) => open(name, version, true),
    deleteDatabase: (name) => nativeIDB.deleteDatabase(prefix + name),
    cmp: nativeIDB.cmp.bind(nativeIDB),
  },
});
const nativeTransaction = IDBDatabase.prototype.transaction;
const nativePut = IDBObjectStore.prototype.put,
  nativeGetAll = IDBObjectStore.prototype.getAll,
  nativeGet = IDBObjectStore.prototype.get;
const transactionRows = new WeakMap();
IDBDatabase.prototype.transaction = function (stores, mode, ...rest) {
  const tx = nativeTransaction.call(this, stores, mode, ...rest);
  if (!owners.has(this)) return tx;
  const row = {
    id: data.transactions.length + 1,
    database: this.name,
    stores: [...tx.objectStoreNames],
    mode: tx.mode,
    at: performance.now(),
  };
  keep('transactions', row);
  transactionRows.set(tx, row);
  data.activeTransactions++;
  if (
    this.name.endsWith('revealline-fpv-worlds-v1') &&
    tx.mode === 'readwrite' &&
    row.stores.includes('revisions')
  ) {
    row.fault = data.fault;
    data.fault = null;
  }
  if (
    data.pendingRefresh &&
    this.name.endsWith('revealline.fpv.world-records.v1') &&
    tx.mode === 'readonly' &&
    row.stores.includes('records')
  ) {
    data.pendingRefresh = false;
    row.fault = 'post-commit-refresh';
  }
  if (
    data.pendingGeneration &&
    this.name.endsWith('revealline-fpv-worlds-v1') &&
    tx.mode === 'readonly' &&
    row.stores.length === 1 &&
    row.stores[0] === 'meta'
  ) {
    data.pendingGeneration = false;
    row.fault = 'post-commit-generation';
  }
  for (const kind of ['complete', 'abort'])
    tx.addEventListener(
      kind,
      () => {
        row.outcome = kind;
        row.ended = performance.now();
        row.error = tx.error?.name ?? null;
        data.activeTransactions--;
        if (kind === 'complete' && row.fault === 'commit-then-refresh') data.pendingRefresh = true;
        if (kind === 'complete' && row.fault === 'commit-then-generation')
          data.pendingGeneration = true;
      },
      { once: true },
    );
  return tx;
};
IDBObjectStore.prototype.get = function (...args) {
  const request = nativeGet.apply(this, args),
    row = transactionRows.get(this.transaction);
  if (this.name === 'meta' && args[0] === 'generation' && row?.fault === 'post-commit-generation') {
    row.fault = 'post-commit-generation-armed';
    request.addEventListener(
      'success',
      () => {
        keep('faults', {
          name: 'post-commit-generation',
          transaction: row.id,
          at: performance.now(),
          phase: 'native generation read succeeded after world commit; abort readonly transaction',
        });
        this.transaction.abort();
      },
      { once: true },
    );
  }
  return request;
};
IDBObjectStore.prototype.put = function (...args) {
  const request = nativePut.apply(this, args),
    row = transactionRows.get(this.transaction);
  if (this.name === 'projects' && row?.fault === 'abort-install') {
    row.fault = 'abort-install-armed';
    request.addEventListener(
      'success',
      () => {
        keep('faults', {
          name: 'abort-install',
          transaction: row.id,
          at: performance.now(),
          phase: 'after native project put succeeded, before transaction commit',
        });
        this.transaction.abort();
      },
      { once: true },
    );
  }
  return request;
};
IDBObjectStore.prototype.getAll = function (...args) {
  const request = nativeGetAll.apply(this, args),
    row = transactionRows.get(this.transaction);
  if (this.name === 'records' && row?.fault === 'post-commit-refresh') {
    row.fault = 'post-commit-refresh-armed';
    request.addEventListener(
      'success',
      () => {
        keep('faults', {
          name: 'post-commit-refresh',
          transaction: row.id,
          at: performance.now(),
          phase: 'native records read succeeded after world commit; abort readonly refresh',
        });
        this.transaction.abort();
      },
      { once: true },
    );
  }
  return request;
};
addEventListener('error', (e) => keep('errors', { message: e.message, stack: e.error?.stack }));
addEventListener('unhandledrejection', (e) =>
  keep('errors', { message: String(e.reason), stack: e.reason?.stack }),
);
for (const kind of ['error', 'warn']) {
  const original = console[kind];
  console[kind] = (...args) => {
    keep(kind === 'error' ? 'errors' : 'warnings', { message: args.map(String).join(' ') });
    return original.apply(console, args);
  };
}
for (const type of ['focus', 'blur', 'pagehide', 'pageshow'])
  addEventListener(type, () =>
    keep('events', {
      type,
      at: performance.now(),
      visible: document.visibilityState,
      focused: document.hasFocus(),
    }),
  );
document.addEventListener('visibilitychange', () =>
  keep('events', {
    type: 'visibilitychange',
    at: performance.now(),
    visible: document.visibilityState,
    focused: document.hasFocus(),
  }),
);
const urls = new Map(),
  nativeURL = URL.createObjectURL,
  nativeRevoke = URL.revokeObjectURL,
  nativeClick = HTMLAnchorElement.prototype.click;
URL.createObjectURL = function (blob) {
  const url = nativeURL.call(this, blob);
  urls.set(url, blob);
  return url;
};
URL.revokeObjectURL = function (url) {
  urls.delete(url);
  return nativeRevoke.call(this, url);
};
HTMLAnchorElement.prototype.click = function (...args) {
  if (this.download && urls.has(this.href)) {
    keep(
      'downloads',
      { name: this.download, blob: urls.get(this.href), at: performance.now() },
      24,
    );
    return;
  }
  return nativeClick.apply(this, args);
};
const observer = new MutationObserver(() => {
  const row = {
    at: performance.now(),
    studio: document.getElementById('studio-status')?.textContent,
    flight: document.getElementById('flight-status')?.textContent,
  };
  const prev = data.statuses.at(-1);
  if (!prev || row.studio !== prev.studio || row.flight !== prev.flight) keep('statuses', row, 128);
});
for (const id of ['studio-status', 'flight-status'])
  observer.observe(document.getElementById(id), {
    childList: true,
    characterData: true,
    subtree: true,
  });
const [
  { mountWorldApp },
  { createFlightRenderer },
  { openWorldStore },
  { openWorldRecords },
  content,
  zip,
  model,
] = await Promise.all([
  import('./player/optional-practice/civilian-fpv/world-app.mjs'),
  import('./player/optional-practice/civilian-fpv/world-assets.mjs'),
  import('./player/optional-practice/civilian-fpv/world-store.mjs'),
  import('./player/optional-practice/civilian-fpv/world-records.mjs'),
  import('./player/optional-practice/civilian-fpv/world-content.mjs'),
  import('./player/optional-practice/civilian-fpv/world-zip.mjs'),
  import('./player/optional-practice/civilian-fpv/world-model.mjs'),
]);
let renderer;
const app = mountWorldApp({
  document,
  window,
  rendererFactory(options) {
    renderer = createFlightRenderer(options);
    data.rendererCreations++;
    const draw = renderer.draw;
    renderer.draw = function (state, ...args) {
      data.lastDraw = {
        ticks: state.ticks,
        status: state.status,
        step: state.step,
        position: { ...state.position },
        velocity: { ...state.velocity },
        orientation: { ...state.orientation },
      };
      return draw.call(this, state, ...args);
    };
    return renderer;
  },
});
await app.ready;
// Separate read-only diagnostic connections never receive injected faults.
const readIDB = {
  open: (name, version) => open(name, version, false),
  cmp: nativeIDB.cmp.bind(nativeIDB),
};
const store = await openWorldStore({ indexedDB: readIDB }),
  records = await openWorldRecords(readIDB);
window.fpvJourney = {
  app,
  data,
  content,
  zip,
  model,
  store,
  records,
  token,
  disposed: false,
  async inspect() {
    const snapshot = app.snapshot();
    return {
      generation: await store.generation(),
      revisions: await store.list({ includeRevisions: true }),
      records: await records.list(),
      recovery: await records.session(),
      state: snapshot.state,
      course: snapshot.course,
      draft: document.getElementById('creator-json').value,
      selectedCourse: document.getElementById('editor-project-course')?.value,
      mode: document.getElementById('editor-route-mode')?.value,
      studio: document.getElementById('studio-status').textContent,
      flight: document.getElementById('flight-status').textContent,
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
      data.resources = renderer?.resources() ?? null;
      IDBDatabase.prototype.transaction = nativeTransaction;
      IDBObjectStore.prototype.put = nativePut;
      IDBObjectStore.prototype.getAll = nativeGetAll;
      IDBObjectStore.prototype.get = nativeGet;
      URL.createObjectURL = nativeURL;
      URL.revokeObjectURL = nativeRevoke;
      HTMLAnchorElement.prototype.click = nativeClick;
    }
  },
};
