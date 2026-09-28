/** Original native Scout battery-face study, composed from immutable v3 source
 * geometry. No PNG is loaded, sampled, scaled or recoloured. Not registered. */
import { FIELD_KIT_COLORS } from './pixel-art.mjs';
import { detailedCandidatePixelArtForSlot } from './rotor-body-detail-art.mjs';

export const FIELD_KIT_BODY_CONTRAST_VERSION = 'reference-v4';
export const FIELD_KIT_BODY_CONTRAST_ROLES = Object.freeze(['scout']);

export function contrastCandidatePixelArtForSlot(slotId, { size } = {}) {
  const match = /^player\.scout\.(compact|detailed)$/.exec(slotId);
  if (!match) throw new Error(`No body-contrast candidate for ${slotId}.`);
  size ??= match[1] === 'detailed' ? 64 : 32;
  if (![32, 64].includes(size))
    throw new Error('Body-contrast frames require a native 32 or 64 pixel grid.');
  // Construct at the requested native grid. Camera, tail, silhouette, carbon
  // arms and motor housings remain exactly the v3 source recipe's pixels.
  const image = detailedCandidatePixelArtForSlot(slotId, { size }),
    scale = size / 32;
  const rect = (x, y, width, height, name) => {
    const hex = FIELD_KIT_COLORS[name],
      rgba = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)).concat(255);
    for (let py = y * scale; py < (y + height) * scale; py++)
      for (let px = x * scale; px < (x + width) * scale; px++) {
        const offset = (py * size + px) * 4;
        if (
          !Number.isInteger(px) ||
          !Number.isInteger(py) ||
          image.layers.equipment[offset + 3] !== 255
        )
          throw new Error('A contrast cluster must stay inside the native equipment silhouette.');
        image.layers.equipment.set(rgba, offset);
        image.rgba.set(rgba, offset);
      }
  };
  // Warm battery sleeve is one dominant face; dark straps and the shaded side
  // retain equipment volume and a dark edge over light reveal artwork.
  rect(15, 12, 2, 8, 'amber');
  rect(14, 14, 3, 4, 'amber');
  rect(17, 12, 1, 8, 'plate');
  rect(14, 13, 4, 1, 'frame');
  rect(14, 18, 4, 1, 'frame');
  rect(15, 13, 1, 1, 'metal');
  rect(15, 18, 1, 1, 'metal');
  if (size === 64) {
    // Native half-grid bevels and buckles; never an enlarged compact raster.
    rect(14.5, 12, 0.5, 1, 'amber');
    rect(14.5, 19, 0.5, 1, 'amber');
    rect(17, 14, 0.5, 4, 'metal');
    rect(14, 14, 0.5, 4, 'metal');
    rect(15, 12, 0.5, 1, 'light');
    rect(15, 14, 0.5, 3.5, 'light');
    rect(15, 19, 0.5, 1, 'light');
    rect(15, 13, 0.5, 1, 'shadow');
    rect(15.5, 13, 0.5, 0.5, 'metal');
    rect(15, 18, 0.5, 1, 'shadow');
    rect(15.5, 18, 0.5, 0.5, 'metal');
  }
  return image;
}
