/** Finite IndexedDB model: versioned connections, upgrade blocking, serialized transactions.
 * It is not evidence of a particular browser's disk/quota behavior. */
export function managedIndexedDB() {
  let stores = new Map(),
    version = 0,
    running = false;
  const connections = new Set(),
    waiting = [],
    transactions = [];
  const api = {
    puts: [],
    allPuts: [],
    failPutAt: null,
    failAnyPutAt: null,
    onPut: null,
    onAnyPut: null,
    afterCommit: null,
    afterAnyCommit: null,
    openCount: 0,
    closed: 0,
  };
  const cloneStores = () => new Map([...stores].map(([k, v]) => [k, new Map(v)]));
  const legacy = (name) => name === 'audio' || name === 'metadata';
  function pump() {
    if (running || !transactions.length) return;
    running = true;
    transactions.shift()();
  }
  function transaction(names, mode = 'readonly') {
    for (const name of names)
      if (!stores.has(name)) throw new DOMException('Unknown store', 'NotFoundError');
    const requests = [];
    let data,
      started = false,
      finished = false,
      pending = 0,
      writes = 0,
      allWrites = 0;
    const tx = { error: null, oncomplete: null, onabort: null, onerror: null };
    function next() {
      running = false;
      queueMicrotask(pump);
      queueMicrotask(retryOpen);
    }
    function abort(error) {
      if (finished) return;
      finished = true;
      tx.error = error ?? null;
      queueMicrotask(() => {
        tx.onabort?.();
        if (started) next();
      });
    }
    tx.abort = () => {
      if (finished) throw new DOMException('Transaction already finished', 'InvalidStateError');
      abort();
    };
    function complete() {
      if (!started || finished || pending) return;
      finished = true;
      if (mode === 'readwrite') {
        for (const name of names) stores.set(name, data.get(name));
        if (writes) api.afterCommit?.();
        api.afterAnyCommit?.({ stores: names });
      }
      queueMicrotask(() => {
        tx.oncomplete?.();
        next();
      });
    }
    function request(operation) {
      if (finished) throw new DOMException('Inactive transaction', 'TransactionInactiveError');
      const req = { result: undefined, error: null };
      pending++;
      const execute = () =>
        queueMicrotask(() => {
          if (finished) return;
          try {
            req.result = operation();
            req.onsuccess?.();
          } catch (error) {
            req.error = error;
            tx.error = error;
            req.onerror?.();
            tx.onerror?.();
            abort(error);
          }
          pending--;
          queueMicrotask(complete);
        });
      if (started) execute();
      else requests.push(execute);
      return req;
    }
    tx.objectStore = (name) => {
      if (!names.includes(name)) throw new DOMException('Store outside scope', 'NotFoundError');
      return {
        get: (key) => request(() => structuredClone(data.get(name).get(key))),
        getAllKeys: () => request(() => [...data.get(name).keys()].sort()),
        getAll: () =>
          request(() =>
            [...data.get(name)]
              .sort(([a], [b]) => String(a).localeCompare(String(b)))
              .map(([, v]) => structuredClone(v)),
          ),
        put: (value, key) =>
          request(() => {
            if (mode === 'readonly') throw new DOMException('Read only', 'ReadOnlyError');
            allWrites++;
            api.allPuts.push([name, key]);
            api.onAnyPut?.({ name, key, tx });
            if (legacy(name)) {
              writes++;
              api.puts.push([name, key]);
              api.onPut?.({ name, key, tx });
            }
            if (api.failAnyPutAt === allWrites || (legacy(name) && api.failPutAt === writes))
              throw new DOMException('Injected storage write failure', 'QuotaExceededError');
            data.get(name).set(key, structuredClone(value));
            return key;
          }),
        delete: (key) =>
          request(() => {
            if (mode === 'readonly') throw new DOMException('Read only', 'ReadOnlyError');
            return data.get(name).delete(key);
          }),
      };
    };
    transactions.push(() => {
      if (finished) {
        next();
        return;
      }
      started = true;
      data = cloneStores();
      for (const run of requests) run();
      queueMicrotask(complete);
    });
    queueMicrotask(pump);
    return tx;
  }
  function connection() {
    let closed = false;
    const db = {
      get version() {
        return version;
      },
      get objectStoreNames() {
        const names = [...stores.keys()];
        names.contains = (name) => stores.has(name);
        return names;
      },
      createObjectStore(name) {
        if (stores.has(name)) throw new DOMException('Store already exists', 'ConstraintError');
        stores.set(name, new Map());
      },
      close() {
        if (!closed) {
          closed = true;
          connections.delete(db);
          api.closed++;
          queueMicrotask(retryOpen);
        }
      },
      transaction(names, mode) {
        if (closed) throw new DOMException('Connection closed', 'InvalidStateError');
        return transaction(typeof names === 'string' ? [names] : names, mode);
      },
    };
    connections.add(db);
    return db;
  }
  function retryOpen() {
    if (running || transactions.length) return;
    for (const job of [...waiting]) {
      if (job.target > version && connections.size) continue;
      waiting.splice(waiting.indexOf(job), 1);
      job.run();
    }
  }
  api.indexedDB = {
    open(_name, requestedVersion) {
      api.openCount++;
      const req = { result: null, error: null, transaction: null };
      queueMicrotask(() => {
        const target = requestedVersion ?? (version || 1);
        const fail = (error) => {
          req.error = error;
          req.onerror?.();
        };
        const run = () => {
          if (target < version) {
            fail(new DOMException('Requested older database version', 'VersionError'));
            return;
          }
          if (target > version) {
            const old = version,
              previous = cloneStores();
            let aborted = false;
            const db = connection();
            req.result = db;
            req.transaction = {
              abort() {
                aborted = true;
              },
            };
            try {
              req.onupgradeneeded?.({ oldVersion: old, newVersion: target });
            } catch (error) {
              aborted = true;
              req.error = error;
            }
            if (aborted) {
              stores = previous;
              db.close();
              fail(req.error ?? new DOMException('Upgrade aborted', 'AbortError'));
              return;
            }
            version = target;
            req.transaction = null;
            req.onsuccess?.();
          } else {
            req.result = connection();
            req.onsuccess?.();
          }
        };
        if (target > version) {
          for (const db of [...connections])
            db.onversionchange?.({ oldVersion: version, newVersion: target });
          if (connections.size || running || transactions.length) {
            waiting.push({ target, run });
            if (connections.size) req.onblocked?.();
            return;
          }
        }
        run();
      });
      return req;
    },
  };
  api.contents = cloneStores;
  api.corrupt = (hash, blob) => stores.get('audio').set(hash, blob);
  api.seedOrphan = api.corrupt;
  return api;
}
