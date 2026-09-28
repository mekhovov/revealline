import { canonicalJSON } from '../data-json.mjs';
import { campaignKey } from '../library.mjs';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import { createPresentationPins, snapshotPictureChoice } from '../presentation-pins.mjs';
import { createPictureIdentityCatalog } from './picture-identity.mjs';
import { resolveEarnedPicture } from './earned-picture.mjs';
import { acquirePresentationImage } from './presentation-image.mjs';

const abort = (signal) => {
  if (signal?.aborted) throw new DOMException('Demo picture preparation cancelled.', 'AbortError');
};

/** Resolve the actually displayed picture against earned originals. A clear
 * level is not proof that a different world or a later art assignment is earned.
 * No profile, receipt, assignment or storage write is made here. */
export async function resolveDemoPicture({
  entry,
  level,
  theme,
  library,
  entries = [entry],
  readMedia,
  currentPin,
  signal,
  acquire = acquirePresentationImage,
} = {}) {
  let backdrop = null;
  const result = (pictureVisibility = 'blurred', artSeed = null) => {
    let disposed = false;
    return Object.freeze({
      pictureVisibility,
      backdrop,
      artSeed,
      dispose() {
        if (disposed) return;
        disposed = true;
        backdrop?.release?.();
      },
    });
  };
  try {
    abort(signal);
    const executionKey = campaignKey(entry.campaign);
    const baseKey = campaignKey(entry.baseCampaign ?? entry.campaign);
    const owner = entries.find(
      (item) => campaignKey(item.baseCampaign ?? item.campaign) === baseKey,
    );
    if (!owner) return result();
    const executionEntries = createExecutionCatalog([
      { ...owner, campaign: owner.baseCampaign ?? owner.campaign },
    ]).entries;
    const identityCatalog = createPictureIdentityCatalog({ entries: executionEntries });
    const request = {
      executionKey,
      levelId: level.id,
      levelRevision: level.revision,
      themeId: theme.id,
    };
    const identity = identityCatalog.resolve(request);
    if (!identity) return result();
    const media = readMedia ? await readMedia({ signal }) : null;
    abort(signal);
    const pin = currentPin
      ? snapshotPictureChoice(currentPin)
      : media
        ? createPresentationPins({
            library: media.metadata.document.library,
            identityCatalog,
            ...request,
            themeIds: [theme.id],
          }).choices[0]
        : snapshotPictureChoice({ kind: 'legacy', identity });
    if (canonicalJSON(pin.identity) !== canonicalJSON(identity)) return result();
    if (pin.kind === 'still') {
      if (!media) return result();
      backdrop = await acquire({ pin, metadata: media.metadata, store: media.store }, { signal });
      abort(signal);
      // An injected or failed adapter must not claim that another image is clear.
      if (!backdrop?.image || canonicalJSON(backdrop.pin) !== canonicalJSON(pin)) {
        backdrop?.release?.();
        backdrop = null;
        return result();
      }
    }
    for (const item of library?.gallery ?? []) {
      if (item.levelId !== level.id || item.themeId !== theme.id) continue;
      try {
        const receipt = library.pictureReceipts?.find((value) => value.galleryKey === item.key);
        const earned = resolveEarnedPicture({
          item,
          receipt,
          entries: executionEntries,
          metadata: media?.metadata,
        });
        if (!earned) continue;
        const earnedIdentity = identityCatalog.resolve({
          executionKey: item.campaignKey,
          levelId: item.levelId,
          levelRevision: item.levelRevision,
          themeId: item.themeId,
        });
        if (!earnedIdentity || canonicalJSON(earnedIdentity) !== canonicalJSON(identity)) continue;
        const earnedPin = receipt?.presentationPin ?? { kind: 'legacy', identity: earnedIdentity };
        if (canonicalJSON(earnedPin) === canonicalJSON(pin))
          return result('clear', pin.kind === 'legacy' ? earned.item.seed : null);
      } catch {
        // An invalid or unavailable receipt is no permission to reveal art.
      }
    }
    return result();
  } catch (error) {
    backdrop?.release?.();
    backdrop = null;
    if (signal?.aborted || error?.name === 'AbortError') throw error;
    return result();
  }
}

/** Three separable box passes are a true low-pass blur, not canvas CSS. The
 * caller downsamples first, bounding work and preventing fine picture detail. */
export function blurDemoPixels(data, width, height, radius = 8, passes = 3) {
  if (
    !(data instanceof Uint8ClampedArray) ||
    data.length !== width * height * 4 ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 96 ||
    height > 96 ||
    !Number.isInteger(radius) ||
    radius < 1 ||
    radius > 32 ||
    !Number.isInteger(passes) ||
    passes < 1 ||
    passes > 4
  )
    throw new TypeError('Demo blur needs bounded RGBA image pixels.');
  let current = new Uint8ClampedArray(data);
  const count = radius * 2 + 1;
  for (let pass = 0; pass < passes; pass++) {
    for (const horizontal of [true, false]) {
      const next = new Uint8ClampedArray(data.length);
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++)
          for (let channel = 0; channel < 4; channel++) {
            let sum = 0;
            for (let offset = -radius; offset <= radius; offset++) {
              const sx = horizontal ? Math.max(0, Math.min(width - 1, x + offset)) : x;
              const sy = horizontal ? y : Math.max(0, Math.min(height - 1, y + offset));
              sum += current[(sy * width + sx) * 4 + channel];
            }
            next[(y * width + x) * 4 + channel] = Math.round(sum / count);
          }
      current = next;
    }
  }
  return current;
}

/** One bounded cached bitmap per painter. Every source change first invalidates
 * the old bitmap. A decode/read failure returns null, never the raw original. */
export function createDemoPictureFilter({
  canvasFactory = () => document.createElement('canvas'),
} = {}) {
  let source = null,
    signature = '',
    blurred = null;
  function clear() {
    if (blurred) {
      blurred.width = 0;
      blurred.height = 0;
    }
    source = null;
    signature = '';
    blurred = null;
  }
  return Object.freeze({
    clear,
    select(image, policy = 'clear') {
      if (!['clear', 'blurred'].includes(policy))
        throw new TypeError('Invalid demo picture policy.');
      if (policy === 'clear') return image;
      const next = `${image?.width}:${image?.height}`;
      if (image === source && signature === next) return blurred;
      clear();
      source = image;
      signature = next;
      try {
        if (!image || !(image.width > 0) || !(image.height > 0)) return null;
        const canvas = canvasFactory();
        const ratio = Math.min(1, 96 / Math.max(image.width, image.height));
        canvas.width = Math.max(1, Math.round(image.width * ratio));
        canvas.height = Math.max(1, Math.round(image.height * ratio));
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return null;
        context.imageSmoothingEnabled = true;
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        pixels.data.set(blurDemoPixels(pixels.data, canvas.width, canvas.height));
        context.putImageData(pixels, 0, 0);
        blurred = canvas;
        return blurred;
      } catch {
        return null;
      }
    },
  });
}
