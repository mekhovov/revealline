import { createExternalChapterHost } from '../external-chapter-host.mjs';
import { SOURCE_EXTERNAL_CHAPTERS, SOURCE_EXTERNAL_EDITIONS } from '../external-chapter-source.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { acquirePresentationImage } from '../ui/presentation-image.mjs';
import { inspectImageDataUrl } from '../content.mjs';

const cancelled = () =>
  new DOMException('Installed couch chapter loading cancelled.', 'AbortError');
const requireValue = (value, message) => {
  if (!value) throw new Error(message);
};
const releaseImage = (image) => {
  image?.removeAttribute?.('src');
  image?.close?.();
};

/** A read-only consumer of the solo channel. One manager and one accepted image
 * belong to this couch page; neither player owns a separate media assignment.
 * No writer lease, installation, recovery, progress or backup mutation is exposed.
 */
export function createCouchInstalledChapters({
  channel,
  registeredEntries,
  indexedDB = globalThis.indexedDB,
  storage = globalThis.localStorage,
  lockManager = globalThis.navigator?.locks,
  ImageClass = globalThis.Image,
  URLImpl = globalThis.URL,
} = {}) {
  let manager = null,
    disposed = false,
    generation = 0,
    pending = null,
    executingSignal = null,
    executingStatus = null,
    snapshot = null,
    choices = new WeakMap(),
    binding = null,
    selection = null,
    staged = null;
  const retirements = new Set();
  const check = (signal) => {
    if (disposed || signal?.aborted) throw cancelled();
  };
  function decode(source, signal) {
    check(signal);
    requireValue(typeof ImageClass === 'function', 'Browser picture decoding is unavailable.');
    return new Promise((resolve, reject) => {
      const image = new ImageClass();
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        image.onload = image.onerror = null;
        if (error) {
          releaseImage(image);
          reject(error);
        } else resolve(image);
      };
      const abort = () => finish(cancelled());
      const timer = setTimeout(
        () => finish(new Error('Installed couch picture decode timed out.')),
        15000,
      );
      signal?.addEventListener('abort', abort, { once: true });
      image.onerror = () => finish(new Error('The installed couch picture could not decode.'));
      image.onload = async () => {
        try {
          requireValue(
            typeof image.decode === 'function',
            'Complete picture decoding is unavailable.',
          );
          await image.decode();
          check(signal);
          finish();
        } catch (error) {
          finish(error);
        }
      };
      if (signal?.aborted) return abort();
      try {
        image.src = source;
      } catch (error) {
        finish(error);
      }
    });
  }
  // The host verifies original bytes and headers. Its preparation decoder is
  // deliberately bounded and cancellable even for older embedded image packs.
  async function verifyDecode(source, { signal = executingSignal } = {}) {
    let url = null,
      image = null;
    try {
      check(signal);
      executingStatus?.('decoding', 'Checking installed picture decoding…');
      if (typeof source !== 'string') {
        url = URLImpl.createObjectURL(source);
        source = url;
      }
      image = await decode(source, signal);
      check(signal);
      return { naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight };
    } finally {
      releaseImage(image);
      if (url !== null) URLImpl.revokeObjectURL(url);
    }
  }
  const host = createExternalChapterHost({
    indexedDB,
    profileKey: `revealline.library.${channel}.v1`,
    packsKey: `revealline.packs.${channel}.v1`,
    storage,
    lockManager,
    writer: Object.freeze({ writable: false }),
    registeredEntries,
    knownDescriptors: SOURCE_EXTERNAL_CHAPTERS,
    getManagedStore: () => (manager ??= createManagedMediaStore({ indexedDB, storyMedia: true })),
    decodeImage: verifyDecode,
  });
  function clearBinding() {
    const prior = binding;
    binding = null;
    selection = null;
    prior?.release();
  }
  function cancel() {
    generation++;
    pending?.controller.abort();
    staged?.cancel();
  }
  function clear() {
    cancel();
    clearBinding();
  }
  function operation(
    signal,
    work,
    onStatus = () => {},
    message = 'Checking installed chapters and pictures…',
  ) {
    check(signal);
    const ticket = ++generation,
      previous = pending,
      controller = new AbortController();
    previous?.controller.abort();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    const item = { controller, promise: null };
    pending = item;
    const report = (stage, message, status = 'preparing') => {
      if (disposed || controller.signal.aborted || ticket !== generation) return;
      try {
        onStatus({ status, stage, message, progress: null });
      } catch {}
    };
    item.promise = Promise.resolve()
      .then(async () => {
        // Join cancelled authority work before entering its single-operation lock.
        if (previous) await previous.promise.catch(() => {});
        check(controller.signal);
        requireValue(ticket === generation, 'The selected couch chapter changed.');
        // Legacy pack preparation receives no signal argument from its decoder
        // caller. Bind that decoder to the work actually executing, never to a
        // newer queued operation that is still waiting for this one to unwind.
        executingSignal = controller.signal;
        executingStatus = report;
        try {
          const result = await work(
            controller.signal,
            () => {
              check(controller.signal);
              requireValue(ticket === generation, 'The selected couch chapter changed.');
            },
            report,
          );
          report('ready', 'Installed content is ready.', 'ready');
          check(controller.signal);
          requireValue(ticket === generation, 'The selected couch chapter changed.');
          return result;
        } catch (error) {
          if (error.name !== 'AbortError') report('error', error.message, 'error');
          throw error;
        } finally {
          if (executingSignal === controller.signal) {
            executingSignal = null;
            executingStatus = null;
          }
        }
      })
      .finally(() => {
        signal?.removeEventListener('abort', abort);
        if (pending === item) pending = null;
      });
    report('verifying', message);
    return item.promise;
  }
  async function refresh({ signal, onStatus } = {}) {
    staged?.cancel();
    clearBinding();
    snapshot = null;
    choices = new WeakMap();
    return operation(
      signal,
      async (s, current) => {
        const next = await host.inspect({ signal: s });
        current();
        requireValue(
          next.status === 'checked',
          'Installed chapters need recovery in solo More worlds before racing.',
        );
        const rows = [];
        for (const entry of next.executionCatalog.entries) {
          if (!entry.sourcePackId || entry.difficulty !== 'standard') continue;
          const external = next.index.chapters.some((item) => item.id === entry.sourcePackId);
          for (const level of entry.campaign.levels) {
            const visuals = {
              ...entry.visualOverrides,
              ...entry.levelVisuals.find((item) => item.levelId === level.id)?.visualOverrides,
            };
            const row = Object.freeze({
              key: `installed/${entry.executionKey}/${level.id}`,
              chapter: `${SOURCE_EXTERNAL_EDITIONS.find((edition) => edition.descriptor.id === entry.sourcePackId)?.name || entry.campaign.title} · Installed`,
              level,
              classes: entry.classRecipes,
              themes: entry.themes,
              defaultThemeId: level.themeId || entry.campaign.themeId,
              track:
                entry.music.find(
                  (track) => track.id === (level.musicId || entry.campaign.musicId),
                ) || null,
              visualOverrides: Object.freeze(
                Object.fromEntries(
                  Object.entries(visuals).filter(([role]) => role !== 'background'),
                ),
              ),
              external,
            });
            choices.set(row, { snapshot: next, entry, background: visuals.background, external });
            rows.push(row);
          }
        }
        current();
        snapshot = next;
        return Object.freeze(rows);
      },
      onStatus,
    );
  }
  function stateFor(row, themeId) {
    const state = choices.get(row);
    requireValue(state && state.snapshot === snapshot, 'Select a current installed couch chapter.');
    requireValue(
      row.themes.some((theme) => theme.id === themeId),
      'This world does not belong to the selected chapter.',
    );
    return state;
  }
  async function verifyCurrent(state, proof, signal) {
    await host.withCurrent(
      state.snapshot,
      async () => {
        if (proof) {
          const latest = await proof.store.readPresentationMetadata({ signal });
          requireValue(
            latest.metadata.generation === proof.metadata.generation,
            'Installed originals changed; reload this chapter before starting.',
          );
        }
        check(signal);
      },
      { signal },
    );
  }
  async function select(
    row,
    { themeId = row.defaultThemeId, raceId, signal, onStatus } = {},
    stage = null,
  ) {
    const state = stateFor(row, themeId);
    requireValue(Number.isSafeInteger(raceId) && raceId >= 0, 'Use a new in-memory race identity.');
    if (!stage) {
      staged?.cancel();
      clearBinding();
    }
    return operation(
      signal,
      async (s, current, report) => {
        let candidate = null,
          proof = null;
        try {
          if (state.external) {
            proof = await host.authoredPicture(
              state.snapshot,
              {
                executionKey: state.entry.executionKey,
                levelId: row.level.id,
                levelRevision: row.level.revision,
                themeId,
              },
              { signal: s },
            );
            current();
            report('decoding', 'Opening the original picture for both boards…');
            candidate = await acquirePresentationImage(proof, { signal: s, ImageClass, URLImpl });
            requireValue(candidate?.image, 'The installed authored original is unavailable.');
          } else if (state.background) {
            const header = inspectImageDataUrl(state.background.dataUrl);
            requireValue(header.valid, 'The installed embedded original is invalid.');
            report('decoding', 'Opening the original picture for both boards…');
            const image = await decode(state.background.dataUrl, s);
            candidate = Object.freeze({
              image,
              fit: state.background.fit || 'cover',
              sampling: 'nearest',
              release: () => releaseImage(image),
            });
            requireValue(
              image.naturalWidth === header.width && image.naturalHeight === header.height,
              'The installed original decoded to different dimensions.',
            );
          }
          current();
          report('verifying', 'Confirming the selected chapter and picture…');
          await verifyCurrent(state, proof, s);
          current();
          requireValue(state === stateFor(row, themeId), 'The selected installed owner changed.');
          const selected = { row, themeId, raceId, state, proof };
          if (stage) {
            stage.current();
            stage.picture = candidate;
            stage.selection = selected;
            candidate = null;
            return stage.picture;
          }
          binding = candidate;
          candidate = null;
          selection = selected;
          return binding;
        } finally {
          candidate?.release();
        }
      },
      onStatus,
      'Checking the selected chapter’s exact picture…',
    );
  }
  // The accepted Results image remains live throughout candidate verification.
  async function stage(row, options = {}) {
    check(options.signal);
    staged?.cancel();
    const controller = new AbortController();
    let live = true;
    const item = {
      picture: null,
      selection: null,
      confirmed: false,
      current() {
        check(controller.signal);
        requireValue(live && staged === item, 'The next installed chapter changed.');
      },
      cancel() {
        if (!live) return;
        live = false;
        if (staged === item) staged = null;
        options.signal?.removeEventListener('abort', item.cancel);
        controller.abort();
        try {
          item.picture?.release();
        } catch {}
        item.picture = null;
      },
    };
    staged = item;
    options.signal?.addEventListener('abort', item.cancel, { once: true });
    if (options.signal?.aborted) item.cancel();
    try {
      await select(row, { ...options, signal: controller.signal }, item);
      item.current();
      return Object.freeze({
        picture: item.picture,
        cancel: item.cancel,
        async confirm({ onStatus } = {}) {
          item.current();
          item.confirmed = false;
          await operation(
            controller.signal,
            async (s, current) => {
              const selected = item.selection;
              await verifyCurrent(selected.state, selected.proof, s);
              current();
              requireValue(
                selected.state === stateFor(row, selected.themeId),
                'The selected installed owner changed.',
              );
              item.current();
              item.confirmed = true;
            },
            onStatus,
            'Confirming the next chapter before adopting it…',
          );
          item.current();
        },
        commit() {
          item.current();
          requireValue(item.confirmed && !pending, 'Confirm the next chapter before adopting it.');
          const previous = binding;
          binding = item.picture;
          selection = item.selection;
          live = false;
          staged = null;
          options.signal?.removeEventListener('abort', item.cancel);
          let retired = false;
          const retire = () => {
            if (retired) return;
            retired = true;
            retirements.delete(retire);
            try {
              previous?.release();
            } catch {}
          };
          retirements.add(retire);
          return retire;
        },
      });
    } catch (error) {
      item.cancel();
      throw error;
    }
  }
  async function confirm(row, { raceId, signal, onStatus } = {}) {
    const selected = selection;
    requireValue(
      selected?.row === row && selected.raceId === raceId,
      'Load the selected original before starting.',
    );
    return operation(
      signal,
      async (s, current) => {
        await verifyCurrent(selected.state, selected.proof, s);
        current();
        requireValue(selection === selected, 'The prepared race changed.');
        return binding;
      },
      onStatus,
      'Confirming the prepared picture before starting…',
    );
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    clear();
    for (const retire of retirements) retire();
    choices = new WeakMap();
    snapshot = null;
    host.close();
    manager?.close();
  }
  return Object.freeze({
    refresh,
    select,
    stage,
    confirm,
    current: () => binding,
    cancel,
    clear,
    dispose,
  });
}
