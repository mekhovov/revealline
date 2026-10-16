/** Original native Scout optical-body study. Composes immutable source geometry,
 * never a PNG, and keeps the retained rotor envelope separate from body detail. */
import { FIELD_KIT_COLORS } from './pixel-art.mjs';
import { detailedCandidatePixelArtForSlot } from './rotor-body-detail-art.mjs';

export const FIELD_KIT_BODY_OPTICAL_VERSION = 'reference-v5';
export const FIELD_KIT_BODY_OPTICAL_ROLES = Object.freeze(['scout']);

export function opticalCandidatePixelArtForSlot(slotId, { size } = {}) {
  const match = /^player\.scout\.(compact|detailed)$/.exec(slotId);
  if (!match) throw new Error(`No body-optical candidate for ${slotId}.`);
  size ??= match[1] === 'detailed' ? 64 : 32;
  if (![32, 64].includes(size))
    throw new Error('Body-optical frames require a native 32 or 64 pixel grid.');
  const image = detailedCandidatePixelArtForSlot(slotId, { size }),
    scale = size / 32;
  const rect = (x, y, width, height, name) => {
    const hex = FIELD_KIT_COLORS[name],
      rgba = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)).concat(255);
    for (let py = y * scale; py < (y + height) * scale; py++)
      for (let px = x * scale; px < (x + width) * scale; px++) {
        if (!Number.isInteger(px) || !Number.isInteger(py))
          throw new Error('Optical body clusters must use the native pixel grid.');
        const offset = (py * size + px) * 4;
        image.layers.equipment.set(rgba, offset);
        image.rgba.set(rgba, offset);
      }
  };
  // A chamfered equipment shoulder occupies the gap between the four propeller
  // sweeps. Only these four compact pixels extend the existing body silhouette.
  // Arms, hubs, camera, antenna and the frame's global occupied bounds stay exact.
  rect(12, 15, 8, 2, 'ink');
  rect(12, 15, 1, 2, 'frame');
  rect(19, 15, 1, 2, 'plate');
  // A single broad amber face carries the small-scale silhouette. Narrower ends
  // follow the rotor clearance, with two distinct dark tie-down straps.
  rect(14, 12, 4, 8, 'plate');
  rect(14, 12, 3, 8, 'amber');
  rect(13, 14, 6, 4, 'amber');
  rect(14, 13, 4, 1, 'frame');
  rect(14, 18, 4, 1, 'frame');
  rect(15, 13, 1, 1, 'metal');
  rect(15, 18, 1, 1, 'metal');
  if (size === 64) {
    // Deliberate half-grid bevels and buckle hardware; no enlarged compact PNG.
    rect(12.5, 15, 0.5, 2, 'metal');
    rect(19, 15, 0.5, 2, 'frame');
    rect(13, 14.5, 0.5, 3, 'metal');
    rect(18.5, 14, 0.5, 3.5, 'earth');
    rect(14, 12, 0.5, 1, 'light');
    rect(14, 19, 0.5, 1, 'light');
    rect(14, 14, 4, 0.5, 'light');
    rect(14, 17.5, 4, 0.5, 'earth');
    rect(15, 13, 0.5, 1, 'shadow');
    rect(15.5, 13, 0.5, 0.5, 'metal');
    rect(15, 18, 0.5, 1, 'shadow');
    rect(15.5, 18, 0.5, 0.5, 'metal');
  }
  return image;
}
