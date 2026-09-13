import { boundedJSON, canonicalJSON, exactKeys, required } from './data-json.mjs';
import {
  abortExternalChapter,
  emptyExternalChapterIndex,
  externalChapterHash,
  validateExternalChapter,
  validateExternalChapterIndex,
} from './external-chapter.mjs';
import { createExecutionCatalog } from './campaign-contexts.mjs';
import { createPictureIdentityCatalog } from './ui/picture-identity.mjs';
import { createStillMediaStore } from './media-store.mjs';
import { snapshotPictureChoice } from './presentation-pins.mjs';
import {
  PACK_LIMITS,
  emptyPackLibrary,
  exportPackLibrary,
  importPackLibrary,
  resolvePackCampaign,
} from './packs.mjs';
import { createExternalBackupAssets } from './external-backup-assets.mjs';
import { LIBRARY_LIMITS } from './library.mjs';
import { SESSION_IMPORT_BYTES } from './sessions.mjs';

const own = (value) =>
  boundedJSON(value, {
    maxBytes: PACK_LIMITS.libraryBytes + LIBRARY_LIMITS.maxBytes + SESSION_IMPORT_BYTES + 16384,
    maxString: 64 * 1024 * 1024,
    maxNodes: 3400000,
    maxDepth: 32,
    maxArray: 500000,
  });
const bytes = (value) =>
  new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value)).length;
const equal = (a, b) => canonicalJSON(a) === canonicalJSON(b);
const companions = new WeakSet();
export const isExternalChapterBackup = (value) => companions.has(value);

/** Optional descriptor-preserving backup capability. No media writes, pack install,
 * new store/schema, default selection or runtime/profile adoption. */
export function createExternalChapterBackup({
  indexedDB = globalThis.indexedDB,
  storage = globalThis.localStorage,
  profileKey,
  packsKey,
  writer,
  lockManager = globalThis.navigator?.locks,
  getManagedStore,
  registeredEntries = [],
  knownDescriptors = [],
  decodeImage,
  timeoutMs = 15000,
} = {}) {
  required(typeof getManagedStore === 'function', 'Borrow the same current DB4 media manager.');
  required(
    typeof lockManager?.request === 'function',
    'External backup snapshots require Web Locks.',
  );
  const bases = createExecutionCatalog(registeredEntries).entries.filter(
    (e) => e.difficulty === 'standard',
  );
  required(
    Array.isArray(knownDescriptors) && knownDescriptors.length <= PACK_LIMITS.installed,
    'Provide a bounded trusted external descriptor registry.',
  );
  const known = new Map();
  for (const input of knownDescriptors) {
    const descriptor = validateExternalChapter(input);
    required(!known.has(descriptor.id), 'Duplicate trusted external descriptor.');
    known.set(descriptor.id, descriptor);
  }
  const assets = createExternalBackupAssets({
    indexedDB,
    storage,
    profileKey,
    packsKey,
    writer,
    timeoutMs,
  });
  const keys = assets.keys;
  let closed = false,
    store = null;
  const check = (signal) => {
    abortExternalChapter(signal);
    required(!closed, 'External backup companion is closed.');
  };
  const clear = (state, lockKey = keys.lockKey) =>
    required(
      state.backup === null && state.external === null && storage.getItem(lockKey) === null,
      'Recover pending backup/external state before preparing game data.',
    );
  async function borrowed(signal) {
    check(signal);
    if (store) return store;
    const manager = await new Promise((resolve, reject) => {
      let done = false;
      const finish = (error, value) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', cancel);
        if (error) reject(error);
        else resolve(value);
      };
      const cancel = () =>
        finish(new DOMException('Backup media acquisition cancelled.', 'AbortError'));
      const timer = setTimeout(
        () => finish(new Error('Backup media acquisition timed out.')),
        timeoutMs,
      );
      signal?.addEventListener('abort', cancel, { once: true });
      Promise.resolve()
        .then(() => {
          check(signal);
          return getManagedStore();
        })
        .then(
          (value) => finish(null, value),
          (error) => finish(error),
        );
      if (signal?.aborted) cancel();
    });
    check(signal);
    required(
      manager?.storyMedia === true && manager.richStillMedia === true,
      'Use the shared DB4 manager.',
    );
    store ??= createStillMediaStore({ managedStore: manager, decodeImage });
    return store;
  }
  async function catalog(rawPacks, rawIndex, signal) {
    const index =
      rawIndex === null ? emptyExternalChapterIndex() : validateExternalChapterIndex(rawIndex);
    const packs =
      rawPacks === null ? emptyPackLibrary() : await importPackLibrary(rawPacks, { decodeImage });
    check(signal);
    required(
      bytes(exportPackLibrary(packs)) + (rawIndex === null ? 0 : bytes(index)) <=
        PACK_LIMITS.libraryBytes,
      'Packs plus descriptor index exceed the unchanged 48 MiB budget.',
    );
    for (const descriptor of known.values()) {
      if (packs.packs.some((pack) => pack.id === descriptor.id))
        required(
          index.chapters.some((entry) => entry.id === descriptor.id),
          'The known external edition needs its descriptor index; compact JSON alone is not install authority.',
        );
    }
    for (const descriptor of index.chapters) {
      const expected = known.get(descriptor.id);
      required(
        expected && canonicalJSON(expected) === canonicalJSON(descriptor),
        'Installed descriptor differs from the trusted external edition.',
      );
      const pack = packs.packs.find((entry) => entry.id === descriptor.id);
      required(
        pack &&
          bytes(JSON.stringify(pack)) === descriptor.pack.bytes &&
          (await externalChapterHash(JSON.stringify(pack))) === descriptor.pack.sha256,
        'External descriptor gameplay differs from the installed pack.',
      );
      check(signal);
      required(
        pack.format === 'xonix-pack.v5' &&
          pack.version === '1.0.0' &&
          pack.campaigns.length === 1 &&
          pack.campaigns[0].levels.length === 3 &&
          pack.themes.length === 1 &&
          pack.themes[0].id === descriptor.themeId &&
          pack.levelVisuals.length === 0 &&
          Object.keys(pack.visualOverrides).length === 0 &&
          pack.dependencies.length === 0,
        'External gameplay differs from the supported fresh-edition contract.',
      );
    }
    const entries = [
      ...bases,
      ...packs.packs.flatMap((pack) =>
        pack.campaigns.map((campaign) => resolvePackCampaign(pack, campaign.id)),
      ),
    ];
    const executions = createExecutionCatalog(entries);
    for (const descriptor of index.chapters)
      required(
        executions.select(descriptor.campaignKey, 'standard')?.sourcePackId === descriptor.id,
        'External authored owner differs from its descriptor.',
      );
    const usage = Object.freeze({
      packBytes: bytes(exportPackLibrary(packs)),
      indexBytes: rawIndex === null ? 0 : bytes(index),
      limit: PACK_LIMITS.libraryBytes,
    });
    return { packs, index, entries, executions, usage };
  }
  function closure(content, metadata) {
    const identityCatalog = createPictureIdentityCatalog({ entries: content.entries, metadata });
    const pins = new Map();
    for (const descriptor of content.index.chapters) {
      const chapterPins = descriptor.originals.map((original) => {
        const identity = {
          baseCampaignKey: descriptor.campaignKey,
          levelId: original.levelId,
          levelRevision: original.levelRevision,
          themeId: descriptor.themeId,
        };
        required(
          identityCatalog.has(identity),
          'External poster owner differs from the retained authored map.',
        );
        const presentation = metadata.document.library.presentations.find(
          (item) => item.id === original.presentationId && item.revision === 1,
        );
        const asset = metadata.document.library.assets.find((item) => item.id === original.assetId);
        required(
          presentation &&
            canonicalJSON(presentation.identity) === canonicalJSON(identity) &&
            presentation.poster.assetId === original.assetId &&
            presentation.poster.fit === 'contain' &&
            presentation.poster.sampling === 'nearest' &&
            presentation.story === null,
          'External authored presentation is missing or differs. Restore its exact originals.',
        );
        required(
          asset &&
            ['sha256', 'bytes', 'mime', 'width', 'height'].every(
              (key) => asset[key] === original[key],
            ),
          'External original metadata is missing or differs.',
        );
        return snapshotPictureChoice({
          kind: 'still',
          identity,
          presentationId: original.presentationId,
          presentationRevision: 1,
          assetId: original.assetId,
          sha256: original.sha256,
        });
      });
      pins.set(descriptor.id, chapterPins);
    }
    return { identityCatalog, pins };
  }

  async function verify(prepared, { signal } = {}) {
    check(signal);
    required(
      writer?.writable === true,
      'Hold the current profile writer lease before backup verification.',
    );
    const before = await assets.snapshot({ signal });
    clear(before);
    required(
      Object.hasOwn(prepared, 'externalChapters') || before.index === null,
      'Replacing indexed chapters requires explicit backup.v2, including an explicit empty index.',
    );
    const content = await catalog(prepared.packs, prepared.externalChapters ?? null, signal);
    let metadata = null,
      media = null;
    if (content.index.chapters.length) {
      media = await borrowed(signal);
      ({ metadata } = await media.readPresentationMetadata({ signal }));
      const proof = closure(content, metadata);
      for (const pins of proof.pins.values())
        for (const pin of pins)
          await media.readAsset(metadata, pin.assetId, { signal, decodeImage });
    }
    const assertCurrent = async ({ ownedToken = null } = {}) => {
      check(signal);
      if (metadata)
        required(
          (await media.readPresentationMetadata({ signal })).metadata.generation ===
            metadata.generation,
          'Original media changed during backup preparation; review again.',
        );
      const after = await assets.snapshot({ signal });
      required(
        after.external === null &&
          (ownedToken === null ? after.backup === null : after.backup?.token === ownedToken),
        'Backup recovery state changed.',
      );
      required(
        equal(after.packs, before.packs) && equal(after.index, before.index),
        'Backup target assets changed during verification.',
      );
      required(storage.getItem(keys.lockKey) === ownedToken, 'Backup lock ownership changed.');
    };
    await assertCurrent();
    return { before, index: prepared.externalChapters ?? null, assertCurrent };
  }
  const api = Object.freeze({
    assets,
    async assertSupported({ kind = 'backup', signal } = {}) {
      required(['backup', 'packs'].includes(kind), 'Choose a supported backup action.');
      const state = await assets.snapshot({ signal });
      clear(state);
      const content = await catalog(state.packs, state.index, signal);
      required(
        kind !== 'packs' || content.index.chapters.length === 0,
        'External chapters need game-data backup with their descriptor index and separate .rlmedia originals. Pack-only export would omit required data.',
      );
    },
    prepareExternalChapters: async (packs, index, { signal } = {}) => {
      await catalog(packs, index, signal);
    },
    verify,
    async snapshot(getContents, { signal } = {}) {
      required(
        typeof getContents === 'function',
        'Snapshot the paused current host state under its backup lock.',
      );
      return lockManager.request(
        keys.lockKey,
        { mode: 'exclusive', ifAvailable: true },
        async (held) => {
          required(held, 'Another operation owns the backup snapshot lock.');
          check(signal);
          const before = await assets.snapshot({ signal });
          clear(before);
          const contents = own(getContents());
          exactKeys(contents, ['library', 'packs', 'session'], 'current backup contents');
          const content = await catalog(before.packs, before.index, signal);
          required(
            equal(contents.packs, content.packs),
            'Current and persisted installed packs differ.',
          );
          check(signal);
          const after = await assets.snapshot({ signal });
          clear(after);
          required(
            equal(before, after) && equal(contents, getContents()),
            'Current backup snapshot changed.',
          );
          // Explicit empty index makes later Undo a deliberate v2 replacement,
          // without guessing whether an old v1 file intended to remove chapters.
          return { ...contents, externalChapters: content.index };
        },
      );
    },
    async readExternalSnapshot(source, { signal } = {}) {
      check(signal);
      const reader = createExternalBackupAssets({
        indexedDB,
        storage,
        profileKey: source.profileKey,
        packsKey: source.packsKey,
        timeoutMs,
      });
      try {
        const before = await reader.snapshot({ signal });
        clear(before, source.lockKey);
        await catalog(before.packs, before.index, signal);
        const after = await reader.snapshot({ signal });
        clear(after, source.lockKey);
        required(equal(before, after), 'Earlier chapter assets changed during transfer.');
        return own(before);
      } finally {
        reader.close();
      }
    },
    close() {
      closed = true;
      store?.close();
      assets.close();
    },
  });
  companions.add(api);
  return api;
}
