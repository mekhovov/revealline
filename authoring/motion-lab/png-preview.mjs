// Bounded container transformation only. Native Image still decodes PNG pixels.
export const PNG_PREVIEW_MAX_BYTES = 25 * 1024 * 1024;
export const PNG_PREVIEW_MAX_CHUNKS = 16384;
const signature = [137, 80, 78, 71, 13, 10, 26, 10];
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc(bytes, start, end) {
  let value = 0xffffffff;
  for (let i = start; i < end; i++) value = crcTable[(value ^ bytes[i]) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}
function need(ok) {
  if (!ok) throw new Error('This PNG has invalid or unsupported chunk structure.');
}

// Preserve all ordinary PNG chunks, including color/transparency metadata and
// exact compressed IDAT bytes. Never mutate the upload or decode pixels here.
export function derivePngStill(input) {
  need(input instanceof Uint8Array && input.byteLength <= PNG_PREVIEW_MAX_BYTES);
  need(signature.every((value, i) => input[i] === value));
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const parts = [input.subarray(0, 8)];
  let offset = 8,
    count = 0,
    width = 0,
    height = 0,
    depth = 0,
    color = 0,
    palette = false,
    transparency = false,
    idat = false,
    idatEnded = false,
    idatBytes = 0,
    ended = false,
    animated = false,
    declaredFrames = 0,
    frameCount = 0,
    sequence = 0,
    frame = null,
    outputBytes = 8;
  const u32 = (index) => view.getUint32(index);
  while (offset < input.length) {
    need(++count <= PNG_PREVIEW_MAX_CHUNKS && offset + 12 <= input.length && !ended);
    const size = u32(offset),
      data = offset + 8,
      end = data + size;
    need(size <= 0x7fffffff && end + 4 <= input.length);
    const nameBytes = input.subarray(offset + 4, data);
    need([...nameBytes].every((n) => (n >= 65 && n <= 90) || (n >= 97 && n <= 122)));
    need(nameBytes[2] >= 65 && nameBytes[2] <= 90);
    const name = String.fromCharCode(...nameBytes);
    need(u32(end) === crc(input, offset + 4, end));
    need(count === 1 ? name === 'IHDR' : name !== 'IHDR');
    if (idat && name !== 'IDAT') idatEnded = true;
    switch (name) {
      case 'IHDR': {
        need(size === 13);
        width = u32(data);
        height = u32(data + 4);
        depth = input[data + 8];
        color = input[data + 9];
        const depths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
        need(width > 0 && width <= 0x7fffffff && height > 0 && height <= 0x7fffffff);
        need(depths[color]?.includes(depth));
        need(input[data + 10] === 0 && input[data + 11] === 0 && input[data + 12] <= 1);
        break;
      }
      case 'PLTE':
        need(!palette && !idat && !transparency && color !== 0 && color !== 4);
        need(size > 0 && size <= 768 && size % 3 === 0 && (color !== 3 || size / 3 <= 2 ** depth));
        palette = size / 3;
        break;
      case 'tRNS':
        need(!transparency && !idat);
        need(
          (color === 0 && size === 2) ||
            (color === 2 && size === 6) ||
            (color === 3 && palette && size > 0 && size <= palette),
        );
        transparency = true;
        break;
      case 'IDAT':
        need(!idatEnded && (color !== 3 || palette));
        idat = true;
        idatBytes += size;
        if (frame?.usesIdat) frame.bytes += size;
        break;
      case 'acTL':
        need(!animated && !idat && size === 8);
        declaredFrames = u32(data);
        need(declaredFrames > 0 && declaredFrames <= PNG_PREVIEW_MAX_CHUNKS);
        animated = true;
        break;
      case 'fcTL': {
        need(animated && size === 26 && (!frame || frame.bytes > 0));
        need(u32(data) === sequence++);
        const w = u32(data + 4),
          h = u32(data + 8),
          x = u32(data + 12),
          y = u32(data + 16);
        need(w > 0 && h > 0 && x + w <= width && y + h <= height);
        need(input[data + 24] <= 2 && input[data + 25] <= 1);
        if (!idat) need(frameCount === 0 && x === 0 && y === 0 && w === width && h === height);
        frame = { usesIdat: !idat, bytes: 0 };
        frameCount++;
        need(frameCount <= declaredFrames);
        break;
      }
      case 'fdAT':
        need(animated && idat && frame && !frame.usesIdat && size >= 4);
        need(u32(data) === sequence++);
        frame.bytes += size - 4;
        break;
      case 'IEND':
        need(size === 0 && idatBytes > 0 && end + 4 === input.length);
        need(!animated || (frameCount === declaredFrames && frame?.bytes > 0));
        ended = true;
        break;
      default:
        // Unknown critical chunks cannot safely become a valid still image.
        need((nameBytes[0] & 32) !== 0);
    }
    if (!['acTL', 'fcTL', 'fdAT'].includes(name)) {
      parts.push(input.subarray(offset, end + 4));
      outputBytes += size + 12;
      need(outputBytes <= PNG_PREVIEW_MAX_BYTES);
    }
    offset = end + 4;
  }
  need(ended);
  if (!animated) return { bytes: input, animated: false };
  const bytes = new Uint8Array(outputBytes);
  let cursor = 0;
  for (const part of parts) {
    bytes.set(part, cursor);
    cursor += part.length;
  }
  return { bytes, animated: true };
}
