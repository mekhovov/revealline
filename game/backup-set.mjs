import { canonicalJSON, required } from './data-json.mjs';
import { exportBackup, MAX_BACKUP_BYTES } from './backup.mjs';
import { exportMediaBundle } from './media-bundle.mjs';
import { exportStoryBundle } from './story-bundle.mjs';
import { exportSoundtrackBundle } from './soundtrack-bundle.mjs';
import { MANAGED_MEDIA_LIMITS } from './managed-media-store.mjs';

// One saved shared-media inventory plus the existing per-format metadata bounds.
// Existing serializers still enforce their stricter individual limits.
export const BACKUP_SET_MAX_BYTES = MAX_BACKUP_BYTES + MANAGED_MEDIA_LIMITS.bytes + 8 * 1024 * 1024;
const abort = (signal) => {
  if (signal?.aborted) throw new DOMException('Backup preparation cancelled.', 'AbortError');
};
const digest = async (blob, signal) => {
  abort(signal);
  const bytes = await blob.arrayBuffer();
  abort(signal);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  abort(signal);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
};
const generations = (value) => {
  for (const key of ['media', 'story', 'audio'])
    required(Number.isSafeInteger(value[key]) && value[key] >= 0, 'Invalid backup generation.');
  return canonicalJSON(value);
};

/** Read-only coordination of the existing four portable formats. Adapters and
 * the current writer are borrowed. No store is committed, closed or replaced.
 * Metadata fences establish a stable observation, not a cross-store lock.
 */
export async function prepareBackupSet(
  source,
  { signal, onProgress = () => {}, maxBytes = BACKUP_SET_MAX_BYTES } = {},
) {
  abort(signal);
  required(
    Number.isSafeInteger(maxBytes) && maxBytes > 0 && maxBytes <= BACKUP_SET_MAX_BYTES,
    'Invalid backup-set byte budget.',
  );
  const gameIdentity = source.gameIdentity(),
    savedAt = new Date().toISOString(),
    // One prefix for this observed snapshot, independent of browser rename rules.
    filenamePrefix = `RevealLine-backup-${savedAt.replace(/[^0-9TZ]/g, '')}-${crypto.randomUUID().replace(/-/g, '')}`,
    metadata = await source.readMetadata({ signal }),
    generationIdentity = generations(metadata),
    game = await source.readGame({ savedAt, signal });
  abort(signal);
  const gameContents = canonicalJSON(game.contents);
  const assertGameCurrent = () => {
    required(
      source.gameIdentity() === gameIdentity,
      'Game data changed. Prepare the backup set again.',
    );
  };
  assertGameCurrent();
  const files = [];
  let total = 0;
  async function add(id, filename, blob) {
    abort(signal);
    total += blob.size;
    required(total <= maxBytes, 'Backup set exceeds its bounded preparation budget.');
    const sha256 = await digest(blob, signal);
    assertGameCurrent();
    files.push(Object.freeze({ id, filename, blob, bytes: blob.size, sha256 }));
  }
  onProgress('Checking game data and the saved flight…');
  await add(
    'game',
    `${filenamePrefix}-game-data.json`,
    new Blob([await exportBackup(game.contents, { ...game.options, signal })], {
      type: 'application/json',
    }),
  );
  onProgress('Checking picture and poster originals…');
  const still = await source.readStill({ signal });
  required(
    still.generation === metadata.media,
    'Picture originals changed. Prepare the backup set again.',
  );
  await add(
    'media',
    `${filenamePrefix}-originals.rlmedia`,
    await exportMediaBundle(still.document, still.assets, {
      signal,
      decodeImage: source.decodeImage,
    }),
  );
  onProgress('Checking story originals…');
  const story = await source.readStory({ signal });
  required(story.generation === metadata.story, 'Stories changed. Prepare the backup set again.');
  await add(
    'story',
    `${filenamePrefix}-stories.rlstory`,
    await exportStoryBundle(story.document, story.assets, { still: still.document, signal }),
  );
  onProgress('Checking saved music originals…');
  const audio = await source.readAudio({ signal });
  required(audio.generation === metadata.audio, 'Music changed. Prepare the backup set again.');
  await add(
    'audio',
    `${filenamePrefix}-soundtrack.rlsound`,
    await exportSoundtrackBundle(audio.library, audio.assets, { signal }),
  );
  const detachedStories = story.document.stories
    .filter((row) => !story.document.originals.includes(row.source.sha256))
    .map((row) => ({ id: row.id, sha256: row.source.sha256 }));
  const coverage = Object.freeze({
    report: 'RevealLine backup set coverage',
    reportVersion: 1,
    preparedAt: savedAt,
    edition: {
      version: source.edition.version,
      channel: source.edition.channel,
      sourceRevision: source.edition.sourceRevision ?? null,
    },
    generations: { ...metadata },
    mediaScope: 'Saved shared-origin media, paired with this one game profile channel',
    domains: await Promise.all(
      [
        ['media', still.document, still.assets],
        ['story', story.document, story.assets],
        ['audio', audio.library, audio.assets],
      ].map(async ([id, document, assets]) => ({
        id,
        metadataSha256: await digest(new Blob([canonicalJSON(document)]), signal),
        originals: assets.length,
        originalBytes: assets.reduce((sum, asset) => sum + asset.blob.size, 0),
      })),
    ),
    coverage: detachedStories.length
      ? 'incomplete: detached story originals'
      : 'saved referenced inventory',
    detachedStories,
    exclusions: [
      'Unsaved editor drafts',
      'Other profile channels',
      'Unreferenced blobs and browser caches',
      'Unavailable or detached originals',
    ],
    restoreOrder: [
      'Restore .rlmedia picture/poster originals',
      'Restore .rlstory stories',
      'Restore .rlsound saved music',
      'Review and import game-data JSON',
    ],
    files: files.map(({ id, filename, bytes, sha256 }) => ({
      id,
      filename,
      bytes,
      sha256,
      status: 'Prepared',
    })),
    note: 'Prepared files have not been saved to disk. Download each file and check its bytes and SHA-256. Restore uses the existing independent reviews; it is not an atomic multi-file transaction.',
  });
  await add(
    'coverage',
    `${filenamePrefix}-coverage.json`,
    new Blob([JSON.stringify(coverage, null, 2) + '\n'], { type: 'application/json' }),
  );
  // Re-read full game metadata with the SAME export timestamp. A newly generated
  // savedAt must not mask a changed replay or falsely invalidate an idle flight.
  const finalGame = await source.readGame({ savedAt, signal });
  required(
    canonicalJSON(finalGame.contents) === gameContents,
    'Game data changed. Prepare the backup set again.',
  );
  required(
    generations(await source.readMetadata({ signal })) === generationIdentity,
    'Originals changed. Prepare the backup set again.',
  );
  abort(signal);
  assertGameCurrent();
  return Object.freeze({ files: Object.freeze(files), coverage, assertGameCurrent });
}
