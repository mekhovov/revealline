import { acquireCandidatePicture, isCandidatePictureFor } from '../content-design/picture.mjs';

/** A bounded display lease. Closing/filtering releases decoded originals; a late
 * fetch cannot paint a new screen or change focus. No display action awards art. */
export function createJourneyArtworkView({ canvas, status, acquire = acquireCandidatePicture }) {
  let controller = null,
    binding = null,
    generation = 0;
  function release() {
    generation++;
    controller?.abort();
    controller = null;
    binding?.release();
    binding = null;
    canvas.hidden = true;
  }
  return {
    release,
    async show(record) {
      release();
      const ticket = generation,
        owner = new AbortController();
      controller = owner;
      status.textContent = 'Opening earned original…';
      let picture;
      try {
        picture = await acquire(record.asset, { signal: owner.signal });
        if (owner.signal.aborted || ticket !== generation) {
          picture.release();
          return false;
        }
        if (!isCandidatePictureFor(record.asset, picture))
          throw new Error('Original identity does not match.');
        const context = canvas.getContext('2d');
        const width = canvas.width,
          height = (width * record.asset.height) / record.asset.width;
        canvas.height = Math.round(height);
        context.drawImage(picture.image, 0, 0, width, canvas.height);
        binding = picture;
        picture = null;
        canvas.hidden = false;
        status.textContent = 'Earned original';
        return true;
      } catch (error) {
        picture?.release();
        if (ticket === generation && !owner.signal.aborted)
          status.textContent = `Original unavailable. Restore this edition’s exact artwork or retry download. ${error.message}`;
        return false;
      } finally {
        if (controller === owner) controller = null;
      }
    },
  };
}
