import { readFile } from 'node:fs/promises';
import { inspectMP3, prepareMP3Import } from '../../mp3.mjs';
import { emptySoundtrackLibrary } from '../../soundtrack.mjs';
import { prepareSoundtrackLibrary } from '../../soundtrack-bundle.mjs';

export const silenceBytes = await readFile(
  new URL('../fixtures/audio/silence-mpeg1-layer3.mp3', import.meta.url),
);
export const metadata = {
  id: 'qa.silence',
  title: 'Synthetic coded silence',
  artist: 'RevealLine tests',
  rights: { kind: 'original', credit: 'Synthetic MPEG frame fixture', license: '', source: '' },
};
// An explicit test seam; it does not certify browser decoding or audible playback.
export const structuralProbe = async (blob) => ({
  durationSeconds: (await inspectMP3(blob)).durationSeconds,
});
export async function fixture(tag = '') {
  const blob = tag
    ? new Blob([new Uint8Array([73, 68, 51, 4, 0, 0, 0, 0, 0, tag.length]), tag, silenceBytes])
    : new Blob([silenceBytes]);
  const imported = await prepareMP3Import(blob, metadata, { probeMedia: structuralProbe });
  const library = {
    ...emptySoundtrackLibrary(),
    tracks: [imported.track],
    playlists: [
      {
        id: 'qa.mix',
        title: 'Mixed synth and imported audio',
        trackIds: ['builtin.fpv', imported.track.id],
        order: 'ordered',
        repeat: 'all',
      },
    ],
  };
  // Keep fixture coupled to the actual builtin ID rather than duplicating an invented name.
  const { BUILTIN_SOUNDTRACK_TRACKS } = await import('../../soundtrack.mjs');
  library.playlists[0].trackIds[0] = BUILTIN_SOUNDTRACK_TRACKS[0].id;
  const assets = [{ sha256: imported.track.asset.sha256, blob }];
  const prepared = await prepareSoundtrackLibrary(library, assets, { probeMedia: structuralProbe });
  return { blob, library, assets, prepared, track: imported.track };
}

/** Finite async IndexedDB transaction model. Actual browser persistence remains an integration test. */
export function memoryIndexedDB() {
  let stores = null;
  const active = new Set();
  const api = {
    puts: [],
    failPutAt: null,
    onPut: null,
    afterCommit: null,
    openCount: 0,
    closed: 0,
  };
  const database = {
    createObjectStore(name) {
      stores.set(name, new Map());
    },
    close() {
      api.closed++;
    },
    transaction(names, mode = 'readonly') {
      const data = new Map([...stores].map(([key, value]) => [key, new Map(value)]));
      let pending = 0,
        finished = false,
        sequence = 0;
      const tx = { error: null, oncomplete: null, onerror: null, onabort: null };
      active.add(tx);
      const abort = (error) => {
        if (finished) return;
        finished = true;
        tx.error = error ?? null;
        active.delete(tx);
        queueMicrotask(() => tx.onabort?.());
      };
      tx.abort = () => {
        if (finished) throw new DOMException('Transaction already finished', 'InvalidStateError');
        abort();
      };
      const complete = () => {
        if (!finished && pending === 0) {
          finished = true;
          if (mode === 'readwrite') {
            stores = data;
            api.afterCommit?.();
          }
          active.delete(tx);
          queueMicrotask(() => tx.oncomplete?.());
        }
      };
      function request(operation) {
        const req = { result: undefined, error: null };
        pending++;
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
        return req;
      }
      tx.objectStore = (name) => ({
        get: (key) => request(() => structuredClone(data.get(name).get(key))),
        getAllKeys: () => request(() => [...data.get(name).keys()].sort()),
        getAll: () =>
          request(() =>
            [...data.get(name)]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([, v]) => structuredClone(v)),
          ),
        put: (value, key) =>
          request(() => {
            sequence++;
            api.puts.push([name, key]);
            api.onPut?.({ name, key, tx });
            if (api.failPutAt === sequence)
              throw new DOMException('Injected storage write failure', 'QuotaExceededError');
            data.get(name).set(key, structuredClone(value));
            return key;
          }),
        delete: (key) => request(() => data.get(name).delete(key)),
      });
      queueMicrotask(complete);
      return tx;
    },
  };
  api.indexedDB = {
    open() {
      api.openCount++;
      const req = { result: database };
      queueMicrotask(() => {
        if (stores === null) {
          stores = new Map();
          req.onupgradeneeded?.();
        }
        req.onsuccess?.();
      });
      return req;
    },
  };
  api.contents = () => new Map([...(stores ?? [])].map(([k, v]) => [k, new Map(v)]));
  api.corrupt = (hash, blob) => stores.get('audio').set(hash, blob);
  api.seedOrphan = (hash, blob) => stores.get('audio').set(hash, blob);
  return api;
}
