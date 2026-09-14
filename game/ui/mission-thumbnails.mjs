import { canonicalJSON } from '../data-json.mjs';
import { campaignKey } from '../library.mjs';
import { createPictureIdentityCatalog } from './picture-identity.mjs';
import { acquireEarnedPicture } from './earned-picture.mjs';

const cancelled = (signal) => {
  if (signal.aborted) throw new DOMException('Mission thumbnails cancelled.', 'AbortError');
};

/** The collection's exact earned resolver owns thumbnails too. No fresh default,
 * current assignment, best-score seed or unearned source image can replace it. */
export function createMissionPictureThumbnails({
  readMedia,
  render,
  acquire = acquireEarnedPicture,
  onUpdate = () => {},
} = {}) {
  let active = null,
    closed = false;
  function cancel() {
    active?.abort();
    active = null;
  }
  return Object.freeze({
    async refresh({ library, entries, entry, themeId, targets }) {
      cancel();
      if (closed) return;
      const controller = new AbortController();
      active = controller;
      const signal = controller.signal,
        catalog = createPictureIdentityCatalog({ entries }),
        executionKey = campaignKey(entry.campaign),
        receipts = new Map((library.pictureReceipts ?? []).map((row) => [row.galleryKey, row]));
      const jobs = [];
      for (const { button, level, earned } of targets) {
        delete button.dataset.missionArtwork;
        button.dataset.pictureState = earned ? 'unavailable' : 'concealed';
        if (!earned) continue;
        const identity = catalog.resolve({
          executionKey,
          levelId: level.id,
          levelRevision: level.revision,
          themeId,
        });
        if (!identity) continue;
        const matching = library.gallery.filter((item) => {
          if (item.levelId !== level.id || item.themeId !== themeId) return false;
          const owner = catalog.resolve({
            executionKey: item.campaignKey,
            levelId: item.levelId,
            levelRevision: item.levelRevision,
            themeId: item.themeId,
          });
          return owner && canonicalJSON(owner) === canonicalJSON(identity);
        });
        const item = matching.find((row) => row.campaignKey === executionKey) ?? matching[0];
        if (item) jobs.push({ button, item, receipt: receipts.get(item.key) ?? null });
      }
      onUpdate();
      try {
        const needsMedia = jobs.some((job) => job.receipt?.presentationPin.kind === 'still');
        let media = null,
          mediaError = null;
        if (needsMedia) {
          try {
            media = await readMedia({ signal });
          } catch (error) {
            mediaError = error;
          }
        }
        cancelled(signal);
        for (const job of jobs) {
          let result = null;
          try {
            if (job.receipt?.presentationPin.kind === 'still' && mediaError) throw mediaError;
            result = await acquire(
              {
                item: job.item,
                receipt: job.receipt,
                entries,
                metadata: media?.metadata,
                store: media?.store,
              },
              { signal },
            );
            cancelled(signal);
            if (!result.picture) continue;
            const image = await render(result.picture, result.backdrop, { signal });
            cancelled(signal);
            if (active !== controller || !job.button.isConnected) continue;
            if (!/^data:image\/(?:png|jpeg|webp);base64,/u.test(image ?? ''))
              throw new Error('A mission thumbnail needs an owned image.');
            job.button.dataset.missionArtwork = image;
            job.button.dataset.pictureState = 'earned';
            onUpdate();
          } catch (error) {
            if (signal.aborted || error.name === 'AbortError') return;
            // The concealed/unavailable state is honest. Never show a different
            // source image when the exact earned original cannot be decoded.
          } finally {
            result?.release();
          }
        }
      } catch (error) {
        if (error.name !== 'AbortError') throw error;
      } finally {
        if (active === controller) active = null;
      }
    },
    cancel,
    close() {
      closed = true;
      cancel();
    },
  });
}
