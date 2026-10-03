import { boundedJSON, canonicalJSON, dataIdentity, exactKeys, required } from '../data-json.mjs';
import { createProfileRecordBackend } from '../profile-storage.mjs';
import { validateClassicSnakeLevel } from './classic-core.mjs';

export const CLASSIC_PACKAGE_FORMAT = 'revealline-classic-package.v1';
const LIBRARY_FORMAT = 'revealline-classic-library.v1';
export const CLASSIC_PACKAGE_MAX_BYTES = 1536 * 1024;
const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
function localized(source, label, maximum) {
  exactKeys(source, ['en', 'uk'], label);
  for (const language of ['en', 'uk'])
    required(
      typeof source[language] === 'string' &&
        source[language].trim().length > 0 &&
        source[language].length <= maximum,
      `${label} needs bounded EN/UK text.`,
    );
  return source;
}
/** Data-only portable content. No script, asset URL or self-attested clear is admitted. */
export function validateClassicSnakePackage(source) {
  const pack = boundedJSON(source, {
    maxBytes: CLASSIC_PACKAGE_MAX_BYTES,
    maxNodes: 160000,
    maxArray: 1536,
    maxDepth: 12,
  });
  exactKeys(pack, ['format', 'title', 'entries'], 'Classic Snake package');
  required(pack.format === CLASSIC_PACKAGE_FORMAT, 'Unsupported Classic Snake package.');
  localized(pack.title, 'Package title', 120);
  required(
    Array.isArray(pack.entries) && pack.entries.length >= 1 && pack.entries.length <= 12,
    'A Classic Snake package contains one to twelve authored missions.',
  );
  const ids = new Set();
  for (const entry of pack.entries) {
    exactKeys(entry, ['title', 'description', 'level'], 'Classic package mission');
    localized(entry.title, 'Mission title', 120);
    localized(entry.description, 'Mission brief', 1200);
    entry.level = validateClassicSnakeLevel(entry.level);
    required(!ids.has(entry.level.id), 'Package mission source IDs must be distinct.');
    ids.add(entry.level.id);
  }
  return freeze(pack);
}
/** Identity is a content address, not an author signature or publication approval. */
export function classicSnakePackageIdentity(source) {
  return dataIdentity(validateClassicSnakePackage(source));
}
export function classicSnakePackageEntries(source) {
  const pack = validateClassicSnakePackage(source),
    identity = dataIdentity(pack);
  return freeze(
    pack.entries.map((entry, index) => {
      const id = `custom-snake-${identity}-${index + 1}`;
      const level = { ...structuredClone(entry.level), id, revision: `community:${identity}` };
      return {
        id,
        chapterId: `custom-snake-${identity}`,
        title: entry.title,
        description: entry.description,
        level: validateClassicSnakeLevel(level),
        communityIdentity: identity,
      };
    }),
  );
}
export async function importClassicSnakePackage(blob) {
  required(
    blob &&
      Number.isSafeInteger(blob.size) &&
      blob.size > 0 &&
      blob.size <= CLASSIC_PACKAGE_MAX_BYTES &&
      typeof blob.text === 'function',
    'Choose a bounded Classic Snake package file.',
  );
  return validateClassicSnakePackage(await blob.text());
}
export function exportClassicSnakePackage(source) {
  return new Blob([canonicalJSON(validateClassicSnakePackage(source))], {
    type: 'application/json',
  });
}
const empty = () => ({ format: LIBRARY_FORMAT, packages: {} });
function validateLibrary(source) {
  const value = boundedJSON(source, {
    maxBytes: 24 * 1024 * 1024,
    maxNodes: 2400000,
    maxArray: 1536,
    maxDepth: 16,
  });
  exactKeys(value, ['format', 'packages'], 'Classic community library');
  required(
    value.format === LIBRARY_FORMAT &&
      value.packages &&
      typeof value.packages === 'object' &&
      !Array.isArray(value.packages) &&
      Object.keys(value.packages).length <= 16,
    'Classic community library is full or invalid.',
  );
  for (const [identity, sourcePack] of Object.entries(value.packages)) {
    const pack = validateClassicSnakePackage(sourcePack);
    required(identity === dataIdentity(pack), 'Stored Classic package content changed.');
    value.packages[identity] = pack;
  }
  return value;
}
/** Atomic, merge-on-write storage in the existing Journey profile database. */
export function createClassicSnakeCommunityLibrary({ indexedDB = globalThis.indexedDB } = {}) {
  const backend = createProfileRecordBackend({
    key: LIBRARY_FORMAT,
    empty,
    validate: validateLibrary,
    indexedDB,
    operationTimeoutMs: 5000,
  });
  return Object.freeze({
    async install(source) {
      const pack = validateClassicSnakePackage(source),
        identity = dataIdentity(pack);
      await backend.update((state) => {
        const existing = state.packages[identity];
        required(
          !existing || canonicalJSON(existing) === canonicalJSON(pack),
          'A different package already owns this content address. Export both before proceeding.',
        );
        state.packages[identity] = pack;
        return state;
      });
      return { identity, pack, entries: classicSnakePackageEntries(pack) };
    },
    async load(identity) {
      required(
        typeof identity === 'string' && /^[a-f0-9]{16}$/.test(identity),
        'Invalid Classic package identity.',
      );
      const state = await backend.read(),
        pack = state.packages[identity];
      required(pack, 'This Classic package is not installed. Import it in Snake Studio first.');
      return { identity, pack, entries: classicSnakePackageEntries(pack) };
    },
    async list() {
      const state = await backend.read();
      return Object.entries(state.packages).map(([identity, pack]) => ({
        identity,
        title: pack.title,
        count: pack.entries.length,
      }));
    },
    async remove(identity) {
      required(
        typeof identity === 'string' && /^[a-f0-9]{16}$/.test(identity),
        'Invalid Classic package identity.',
      );
      return backend.update((state) => {
        delete state.packages[identity];
        return state;
      });
    },
    close: () => backend.close(),
  });
}
