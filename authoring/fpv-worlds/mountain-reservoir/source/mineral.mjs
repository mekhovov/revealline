// Original deterministic mineral grain, used only by this external authored asset.
import { deflateSync } from 'node:zlib';

const fract = (n) => n - Math.floor(n);
const random = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453123);
const smooth = (x) => x * x * (3 - 2 * x);
export function noise(x, y) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    u = smooth(x - ix),
    v = smooth(y - iy),
    a = random(ix, iy),
    b = random(ix + 1, iy),
    c = random(ix, iy + 1),
    d = random(ix + 1, iy + 1);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, bytes) {
  const name = Buffer.from(type),
    size = Buffer.alloc(4),
    crc = Buffer.alloc(4);
  size.writeUInt32BE(bytes.length);
  crc.writeUInt32BE(crc32(Buffer.concat([name, bytes])));
  return Buffer.concat([size, name, bytes, crc]);
}
export function mineralPNG() {
  const size = 256,
    scanlines = Buffer.alloc(size * (size * 3 + 1));
  // Periodic coordinates keep the repeat seam continuous. The finest speckle
  // remains irregular; fractured veins are subordinate to mineral grain.
  const periodic = (x, y, scale) => {
    const nx = x / size,
      ny = y / size;
    return (
      noise(nx * scale, ny * scale) * (1 - nx) * (1 - ny) +
      noise((nx - 1) * scale, ny * scale) * nx * (1 - ny) +
      noise(nx * scale, (ny - 1) * scale) * (1 - nx) * ny +
      noise((nx - 1) * scale, (ny - 1) * scale) * nx * ny
    );
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const coarse = periodic(x, y, 6),
        vein = periodic(x, y, 17),
        grain = random(x, y) - 0.5,
        fracture = Math.abs(vein - 0.5) < 0.023 ? 15 : 0,
        shade = 170 + coarse * 45 + grain * 31 - fracture,
        at = y * (size * 3 + 1) + 1 + x * 3;
      scanlines[at] = shade + 4;
      scanlines[at + 1] = shade + 2;
      scanlines[at + 2] = shade;
    }
  }
  return rgbPNG(size, scanlines);
}
export function rgbPNG(size, scanlines) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(scanlines, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
