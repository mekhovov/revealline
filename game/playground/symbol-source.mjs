import { inspectImageDataUrl } from '../content.mjs';
import { imageDataURL } from '../creator/bytes.mjs';
import { SYMBOL_WIDTH, SYMBOL_HEIGHT } from './symbol-level.mjs';

function canvas(width, height) {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  return element;
}

export async function textSymbolMask(text) {
  const lines = String(text).trim().split(/\r?\n/);
  if (
    !lines.length ||
    lines.length > 3 ||
    lines.some((line) => !line.trim() || [...line].length > 16)
  )
    throw new Error('Enter one to three non-empty lines, with up to 16 characters per line.');
  await document.fonts.ready;
  const surface = canvas(SYMBOL_WIDTH * 8, SYMBOL_HEIGHT * 8),
    ctx = surface.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, surface.width, surface.height);
  ctx.font = 'bold 64px sans-serif';
  const size = Math.min(
    130 / lines.length,
    (64 * (surface.width - 16)) / Math.max(...lines.map((line) => ctx.measureText(line).width)),
  );
  ctx.font = `bold ${size}px sans-serif`;
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) =>
    ctx.fillText(
      line,
      surface.width / 2,
      surface.height / 2 + (i - (lines.length - 1) / 2) * size * 1.15,
    ),
  );
  return rasterMask(surface, 150, false);
}

function rasterMask(source, threshold, invert) {
  const small = canvas(SYMBOL_WIDTH, SYMBOL_HEIGHT),
    ctx = small.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = invert ? '#000' : '#fff';
  ctx.fillRect(0, 0, small.width, small.height);
  const scale = Math.min((small.width - 2) / source.width, (small.height - 2) / source.height);
  ctx.drawImage(
    source,
    (small.width - source.width * scale) / 2,
    (small.height - source.height * scale) / 2,
    source.width * scale,
    source.height * scale,
  );
  const { data } = ctx.getImageData(0, 0, small.width, small.height);
  return Uint8Array.from({ length: small.width * small.height }, (_, i) => {
    const luminance = 0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2];
    return Number(invert ? luminance > threshold : luminance < threshold);
  });
}

/** Local decoding only. Uploaded art is traced into cells, never executed or sent to a service. */
export async function imageSymbolMask(file, { threshold = 150, invert = false } = {}) {
  if (
    !file ||
    !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
    file.size > 4 * 1024 * 1024
  )
    throw new Error('Choose a PNG, JPEG or WebP image up to 4 MB.');
  if (!Number.isFinite(threshold) || threshold < 1 || threshold > 254)
    throw new Error('Invalid image threshold.');
  const header = inspectImageDataUrl(
    imageDataURL(new Uint8Array(await file.arrayBuffer()), file.type),
  );
  if (!header.valid) throw new Error(header.errors.join(' '));
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (image.naturalWidth * image.naturalHeight > 16_000_000)
      throw new Error('Use an image with at most 16 million pixels.');
    return rasterMask(image, threshold, invert);
  } finally {
    URL.revokeObjectURL(url);
  }
}
