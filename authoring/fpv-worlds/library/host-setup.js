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
window.fetch = async (input, options = {}) => {
  const url = String(input);
  const isIndex = url === indexURL,
    isPack =
      /^https:\/\/raw\.githubusercontent\.com\/mekhovov\/revealline\/[a-f0-9]{40}\/authoring\/fpv-worlds\//.test(
        url,
      );
  if (!isIndex && !isPack) return nativeFetch(input, options);
  const n = fixtureNetwork,
    entry = {
      url,
      kind: isIndex ? 'index' : 'pack',
      mode: n.mode,
      cache: options.cache,
      credentials: options.credentials,
      redirect: options.redirect,
      aborted: false,
    };
  n.requests.push(entry);
  options.signal.addEventListener('abort', () => (entry.aborted = true), { once: true });
  if (n.mode === 'http') return new Response('', { status: 503 });
  if (n.mode === 'reject') throw new TypeError('Fixture network unavailable');
  if (n.mode === 'hold') {
    const bytes = isIndex ? new TextEncoder().encode(JSON.stringify(n.index)) : n.pack;
    const stream = new ReadableStream({
      start(controller) {
        const first = Math.min(64, bytes.length);
        controller.enqueue(bytes.subarray(0, first));
        n.held = {
          release() {
            controller.enqueue(bytes.subarray(first));
            controller.close();
            n.held = null;
          },
        };
        options.signal.addEventListener(
          'abort',
          () => {
            controller.error(new DOMException('Cancelled', 'AbortError'));
            n.held = null;
          },
          { once: true },
        );
      },
    });
    return new Response(stream);
  }
  if (isIndex) return new Response(typeof n.index === 'string' ? n.index : JSON.stringify(n.index));
  if (n.mode === 'oversize-header')
    return new Response('', { headers: { 'content-length': String(n.pack.length + 1) } });
  if (n.mode === 'short') return new Response(n.pack.subarray(0, n.pack.length - 1));
  if (n.mode === 'long') return new Response(new Uint8Array(n.pack.length + 1));
  if (n.mode === 'corrupt') {
    const b = n.pack.slice();
    b[b.length - 1] ^= 1;
    return new Response(b);
  }
  if (n.mode === 'invalid-pack') return new Response(n.invalid);
  if (n.mode === 'prepared-pack') return new Response(n.pack);
  const response = await nativeFetch(input, options);
  entry.native = true;
  entry.status = response.status;
  entry.responseURL = response.url;
  return response;
};
