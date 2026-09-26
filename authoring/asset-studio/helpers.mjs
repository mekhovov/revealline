import { t } from '../../game/i18n/index.mjs';

/** Pure view helpers; the presentation model remains the authority on validity. */
export function centerCrop(width, height, targetWidth, targetHeight) {
  if (![width, height, targetWidth, targetHeight].every((n) => Number.isInteger(n) && n > 0))
    throw new Error(t('tools:studio.crop.positiveWholePixels'));
  const ratio = targetWidth / targetHeight;
  const cropWidth = Math.min(width, Math.floor(height * ratio));
  const cropHeight = Math.min(height, Math.floor(width / ratio));
  return {
    x: Math.floor((width - cropWidth) / 2),
    y: Math.floor((height - cropHeight) / 2),
    width: Math.max(1, cropWidth),
    height: Math.max(1, cropHeight),
  };
}
export function checkedCrop(crop, width, height) {
  const { x, y, width: w, height: h } = crop;
  if (
    ![x, y, w, h].every(Number.isInteger) ||
    x < 0 ||
    y < 0 ||
    w < 1 ||
    h < 1 ||
    x + w > width ||
    y + h > height
  )
    throw new Error(t('tools:studio.crop.insideOriginal'));
  return { x, y, width: w, height: h };
}
export function pixelBounds({ width, height, data }) {
  let left = width,
    top = height,
    right = -1,
    bottom = -1,
    transparent = false;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha < 255) transparent = true;
      if (!alpha) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  return {
    transparent,
    occupiedBounds:
      right < 0
        ? null
        : {
            x: left / width,
            y: top / height,
            width: (right - left + 1) / width,
            height: (bottom - top + 1) / height,
          },
  };
}
export function matchingSlots(slots, resolved, filters) {
  const query = (filters.query || '').trim().toLowerCase();
  return slots.filter((slot) => {
    const asset = resolved.assets[slot.id],
      stage = asset?.quality.stage || 'missing';
    return (
      (!query ||
        `${slot.id} ${slot.label} ${slot.requirements.join(' ')}`.toLowerCase().includes(query)) &&
      (!filters.screen || slot.screens.includes(filters.screen)) &&
      (!filters.state || slot.states.includes(filters.state)) &&
      (!filters.kind || asset?.kind === filters.kind) &&
      (!filters.quality ||
        (filters.quality === 'unfinished' ? stage !== 'reviewed' : stage === filters.quality))
    );
  });
}
export function hexColor(hex, alpha = 255) {
  return [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)).concat(Number(alpha));
}
export function rgbHex(channels) {
  return (
    '#' +
    channels
      .slice(0, 3)
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')
  );
}
