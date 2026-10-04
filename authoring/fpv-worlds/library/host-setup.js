/* Fixture-only diagnostics; no private application state or flight-clock writes. */
window.fixtureToken = new URL(location.href).searchParams.get('token');
window.fixtureErrors = [];
addEventListener('error', (e) => fixtureErrors.push(e.message));
addEventListener('unhandledrejection', (e) => fixtureErrors.push(String(e.reason)));
const nativeIDB = indexedDB,
  prefix = parent.fixturePrefix;
Object.defineProperty(window, 'indexedDB', {
  value: {
    open(name, version) {
      const full = prefix + name;
      parent.fixtureDatabases.add(full);
      return version === undefined ? nativeIDB.open(full) : nativeIDB.open(full, version);
    },
    deleteDatabase: (name) => nativeIDB.deleteDatabase(prefix + name),
    cmp: nativeIDB.cmp.bind(nativeIDB),
  },
});
Object.defineProperty(window, 'localStorage', { value: parent.fixtureStorage });
Object.defineProperty(navigator, 'getGamepads', { value: () => [] });
const nativeFetch = fetch.bind(window),
  nativeTimer = setTimeout.bind(window);
const indexURL =
  'https://raw.githubusercontent.com/mekhovov/revealline/main/authoring/fpv-worlds/published/index.json';
window.fixtureNetwork = {
  index: { format: 'FPVWorldLibrary.v1', worlds: [] },
  mode: 'normal',
  requests: [],
  held: null,
  timeout: null,
  aborts: [],
};
const nativeTransaction = IDBDatabase.prototype.transaction;
IDBDatabase.prototype.transaction = function (stores, mode, ...rest) {
  const tx = nativeTransaction.call(this, stores, mode, ...rest),
    n = fixtureNetwork;
  if (this.name.endsWith('revealline-fpv-worlds-v1') && mode === 'readwrite') {
    if (n.abortWrite) {
      n.abortWrite = false;
      n.aborts.push({ database: this.name, mode, phase: 'before-write' });
      tx.abort();
    }
    if (n.failRefresh)
      tx.addEventListener('complete', () => (n.abortRecords = true), { once: true });
  }
  if (
    n.abortRecords &&
    this.name.endsWith('revealline.fpv.world-records.v1') &&
    mode === 'readonly'
  ) {
    n.abortRecords = false;
    n.failRefresh = false;
    n.aborts.push({ database: this.name, mode, phase: 'post-commit-refresh' });
    tx.abort();
  }
  return tx;
};
window.setTimeout = (fn, ms, ...args) => {
  if (ms === 120000) fixtureNetwork.timeout = fn;
  return nativeTimer(fn, ms, ...args);
};
// Real native Worker per production request; only the diagnostic worker fetch is injected.
const NativeWorker = window.Worker;
fixtureNetwork.workers = [];
fixtureNetwork.pageRequests = [];
window.fetch = (input, options) => {
  if (String(input).startsWith('https://raw.githubusercontent.com/mekhovov/revealline/'))
    fixtureNetwork.pageRequests.push(String(input));
  return nativeFetch(input, options);
};
window.Worker = class extends NativeWorker {
  constructor(input, options) {
    const payload = new URL(input, location.href);
    if (!payload.pathname.endsWith('/optional-practice/fpv-worlds/worker.js')) {
      super(input, options);
      return;
    }
    const diagnostic = new URL('worker-diagnostic.js', parent.location.href);
    super(diagnostic, options);
    const n = fixtureNetwork;
    const record = { nativeWorker: true, payload: payload.href, terminateCount: 0, events: [] };
    n.workers.push(record);
    this.fixtureRecord = record;
    let request;
    this.addEventListener('message', (event) => {
      const data = event.data;
      if (!data?.fixtureWorker) {
        record.terminal = data?.type;
        if (data?.type === 'world-done') record.receivedBytes = data.bytes.byteLength;
        return;
      }
      event.stopImmediatePropagation();
      record.events.push(data);
      if (data.event === 'request') {
        request = data.entry;
        n.requests.push(request);
      } else if (data.event === 'abort') {
        if (request) request.aborted = true;
        n.held = null;
      } else if (data.event === 'reader-cancel' && request) {
        request.readerCancelled = true;
      } else if (data.event === 'body-cancel' && request) {
        request.bodyCancelled = true;
      } else if (data.event === 'native-response' && request) {
        Object.assign(request, {
          native: true,
          status: data.status,
          responseURL: data.responseURL,
        });
      } else if (data.event === 'held') {
        n.held = { release: () => super.postMessage({ type: 'fixture-release' }) };
      } else if (data.event === 'released') n.held = null;
    });
    super.postMessage({
      type: 'fixture-config',
      config: {
        payload: payload.href,
        indexURL,
        index: n.index,
        mode: n.mode,
        pack: n.pack,
        invalid: n.invalid,
      },
    });
  }
  terminate() {
    if (this.fixtureRecord) this.fixtureRecord.terminateCount++;
    return super.terminate();
  }
};
