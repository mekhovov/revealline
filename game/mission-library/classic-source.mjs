import { boundedJSON } from '../data-json.mjs';

const SOURCES = ['base', 'bundled', 'archived', 'optional', 'external'];
const digest = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);

/** The build verifies this index against every original source. Reading its
 * bounded metadata never downloads or validates a playable pack. Host adapters
 * must resolve and validate exact runtime/presentation ownership before Play. */
export function prepareMissionLibraryIndex(value) {
  const index = boundedJSON(value, {
    maxBytes: 512 * 1024,
    maxNodes: 50000,
    maxArray: 4096,
    maxDepth: 12,
    maxString: 2048,
  });
  if (index.format !== 'revealline-mission-library-index.v1' || !Array.isArray(index.missions))
    throw new TypeError('Unsupported mission library index.');
  const ids = new Set();
  const nonempty = (value) => typeof value === 'string' && value.length > 0;
  for (const row of index.missions) {
    if (
      !row ||
      !SOURCES.includes(row.source) ||
      !nonempty(row.id) ||
      ids.has(row.id) ||
      !nonempty(row.campaignKey) ||
      !nonempty(row.campaignId) ||
      !nonempty(row.levelId) ||
      !nonempty(row.name) ||
      !nonempty(row.campaignTitle) ||
      !nonempty(row.edition) ||
      !digest(row.sourceFile?.sha256) ||
      !Number.isSafeInteger(row.sourceFile?.bytes) ||
      row.sourceFile.bytes <= 0 ||
      !Array.isArray(row.modes) ||
      !row.modes.length ||
      row.modes.some((mode) => !['solo', 'versus'].includes(mode)) ||
      !Array.isArray(row.tags) ||
      !row.tags.includes('Classic') ||
      !Number.isInteger(row.levelIndex) ||
      row.levelIndex < 0 ||
      (row.source === 'base' ? row.packId !== null : !nonempty(row.packId)) ||
      (row.source !== 'base' &&
        (!digest(row.packIdentity?.sha256) ||
          !Number.isSafeInteger(row.packIdentity?.bytes) ||
          row.packIdentity.bytes <= 0)) ||
      (row.download &&
        (row.download.id !== row.packId ||
          !Number.isSafeInteger(row.download.bytes) ||
          row.download.bytes < row.sourceFile.bytes))
    )
      throw new TypeError('Invalid or duplicate Classic mission metadata.');
    ids.add(row.id);
  }
  const freeze = (item) => {
    if (item && typeof item === 'object') {
      Object.values(item).forEach(freeze);
      Object.freeze(item);
    }
    return item;
  };
  return freeze(index);
}

/** No source-name guesses and no eager artwork reads. In particular an installed
 * pack with a matching name or ID is not automatically the official edition. */
export function classicLibrarySources(index, { availability, prepare, launch, progress, card }) {
  const checked = prepareMissionLibraryIndex(index);
  if (typeof availability !== 'function' || typeof launch !== 'function')
    throw new TypeError('Classic browsing needs host-owned availability and launch adapters.');
  const owners = new Map();
  for (const entry of checked.missions) {
    const id = JSON.stringify(['classic', entry.source, entry.packId]);
    let owner = owners.get(id);
    if (!owner) {
      owner = {
        id,
        collection: 'Classic',
        editionId: entry.sourceFile.sha256,
        edition: entry.edition,
        entries: [],
        describe: (row) => ({
          id: row.levelId,
          revision: row.levelRevision,
          campaignKey: row.campaignKey,
          campaignTitle: row.campaignTitle,
          name: row.name,
          levelIndex: row.levelIndex,
          modes: row.modes,
          tags: row.tags,
          rules: row.rules,
        }),
        availability,
        prepare,
        launch,
        progress,
        card,
      };
      owners.set(id, owner);
    }
    if (
      owner.editionId !== entry.sourceFile.sha256 ||
      owner.edition !== entry.edition ||
      (owner.entries.length > 0 &&
        (owner.entries[0].packIdentity?.sha256 !== entry.packIdentity?.sha256 ||
          owner.entries[0].packIdentity?.bytes !== entry.packIdentity?.bytes))
    )
      throw new TypeError('One Classic owner cannot silently combine different source editions.');
    owner.entries.push(entry);
  }
  return [...owners.values()];
}
