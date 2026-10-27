import {
  importMediaBundle,
  prepareMediaBundleRestore,
  commitMediaBundleRestore,
} from './media-bundle.mjs';
import {
  importStoryBundle,
  prepareStoryBundleRestore,
  commitStoryBundleRestore,
  cancelStoryBundleRestore,
} from './story-bundle.mjs';
import { importSoundtrackBundle } from './soundtrack-bundle.mjs';
import { JOURNEY_MODES } from './journey/catalog.mjs';

/** One destination-specific review at a time. The existing owners retain all
 * decoding, generation checks, quota admission and transaction semantics.
 * This is deliberately not a transaction spanning the component stores. */
export function createBackupArchiveRestore({
  identity,
  mediaStore,
  storyStore,
  audioStore,
  journey,
  catalogue,
  afterAudio = () => {},
  afterJourney = () => {},
  decodeImage,
  probeMedia,
  storyInspection = {},
}) {
  return {
    async prepare(file, { signal } = {}) {
      signal?.throwIfAborted();
      const owner = identity();
      let consumed = false,
        dispose = async () => {},
        commit,
        review;
      const check = () => {
        signal?.throwIfAborted();
        if (consumed) throw new Error('Review this component again before restoring.');
        if (identity() !== owner)
          throw new Error('The current game changed. Review this component again.');
      };
      try {
        if (file.id === 'media') {
          const imported = await importMediaBundle(file.blob, { signal, decodeImage }),
            prepared = await prepareMediaBundleRestore(imported, {
              store: mediaStore,
              assignmentMode: 'preserve',
              signal,
              decodeImage,
            });
          review = { kind: 'media', count: prepared.originals, bytes: prepared.originalBytes };
          commit = async () => {
            await commitMediaBundleRestore(prepared, { signal });
            return { state: 'saved' };
          };
        } else if (file.id === 'story') {
          const imported = await importStoryBundle(file.blob, { ...storyInspection, signal }),
            prepared = await prepareStoryBundleRestore(imported, {
              ...storyInspection,
              store: storyStore,
              restoreBindings: false,
              signal,
            });
          dispose = () => cancelStoryBundleRestore(prepared);
          review = { kind: 'story', count: prepared.originals };
          commit = async () => {
            await commitStoryBundleRestore(prepared, { signal });
            return { state: 'saved' };
          };
        } else if (file.id === 'audio') {
          const current = await audioStore.read({ signal }),
            prepared = await importSoundtrackBundle(file.blob, { signal, probeMedia, catalogue });
          review = {
            kind: 'audio',
            count: prepared.assets.length,
            references: prepared.library.referenceOnlyTrackIds?.length ?? 0,
          };
          commit = async () => {
            await audioStore.commit(prepared, {
              expectedGeneration: current.generation,
              publicStyles: null,
              signal,
            });
            try {
              await afterAudio();
              return { state: 'saved' };
            } catch {
              // Playback adoption cannot undo a completed storage transaction.
              return { state: 'saved', notice: 'reloadMusic' };
            }
          };
        } else if (file.id === 'journey') {
          if (!journey) throw new Error('Journey progress is unavailable in this game.');
          if (file.blob.size > 16 * 1024 * 1024)
            throw new Error('Journey backup exceeds the 16 MiB limit.');
          const revision = journey.stateRevision(),
            checked = await journey.inspectBackupAsync(await file.blob.text(), { signal }),
            current = journey.snapshot();
          review = { kind: 'journey', added: 0, skips: 0, conflicts: 0, pictures: 0 };
          for (const mode of JOURNEY_MODES) {
            review.added +=
              Object.keys(checked.merged.clears[mode]).length -
              Object.keys(current.clears[mode]).length;
            review.skips += checked.merged.skipped[mode].filter(
              (id) => !current.skipped[mode].includes(id),
            ).length;
            review.conflicts += Object.entries(checked.backup.profile.clears[mode]).filter(
              ([id, receipt]) =>
                Object.hasOwn(current.clears[mode], id) &&
                JSON.stringify(current.clears[mode][id]) !== JSON.stringify(receipt),
            ).length;
          }
          review.pictures = checked.pictures
            ? checked.pictures.records.length - (journey.pictures?.().records.length ?? 0)
            : 0;
          commit = async () => {
            if (journey.stateRevision() !== revision)
              throw new Error('Journey progress changed. Review this component again.');
            const restored = await journey.restoreAsync(checked.backup, { signal }),
              durable = await journey.flush();
            let notice;
            try {
              await afterJourney();
            } catch {
              notice = 'reloadJourney';
            }
            return !durable
              ? { state: 'partial', notice: 'sessionOnly' }
              : restored?.performance?.durable === false
                ? { state: 'partial', notice: 'performancePartial' }
                : { state: 'saved', ...(notice ? { notice } : {}) };
          };
        } else throw new Error('This component has no archive restore owner.');
        check();
        return Object.freeze({
          review: Object.freeze(review),
          async commit() {
            check();
            consumed = true;
            return commit();
          },
          dispose,
        });
      } catch (error) {
        await dispose();
        throw error;
      }
    },
  };
}
