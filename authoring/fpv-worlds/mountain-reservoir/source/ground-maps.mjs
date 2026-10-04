// Original deterministic ground albedos. No photographs or downloaded textures.
import { noise, rgbPNG } from './mineral.mjs';

const size = 128,
  fract = (n) => n - Math.floor(n),
  random = (x, y, seed) => fract(Math.sin(x * 127.1 + y * 311.7 + seed * 19.19) * 43758.5453123),
  wrap = (v, span = size) => ((v % span) + span) % span;
function periodic(x, y, scale) {
  const u = x / size,
    v = y / size;
  return (
    noise(u * scale, v * scale) * (1 - u) * (1 - v) +
    noise((u - 1) * scale, v * scale) * u * (1 - v) +
    noise(u * scale, (v - 1) * scale) * (1 - u) * v +
    noise((u - 1) * scale, (v - 1) * scale) * u * v
  );
}
function image(pixel) {
  const scanlines = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const channels = pixel(x, y),
        at = y * (size * 3 + 1) + 1 + x * 3;
      channels.forEach((value, i) => {
        scanlines[at + i] = Math.max(0, Math.min(255, Math.round(value)));
      });
    }
  return rgbPNG(size, scanlines);
}
export function grassPNG() {
  const blades = new Float32Array(size * size),
    dry = new Float32Array(size * size);
  // At a 1.5m repeat, these 2–7px marks describe short irregular grass blades.
  // Wrapped strokes and periodic soil patches preserve the repeat boundary.
  for (let i = 0; i < 1050; i++) {
    const x = random(i, 1, 71) * size,
      y = random(i, 2, 71) * size,
      angle = random(i, 3, 71) * Math.PI * 2,
      length = 2 + random(i, 4, 71) * 5,
      brightness = (random(i, 5, 71) - 0.45) * 36,
      isDry = random(i, 6, 71) > 0.87;
    for (let step = 0; step <= Math.ceil(length * 2); step++) {
      const distance = step / 2,
        at =
          wrap(Math.floor(y + Math.sin(angle) * distance)) * size +
          wrap(Math.floor(x + Math.cos(angle) * distance));
      blades[at] = brightness;
      if (isDry) dry[at] = 1;
    }
  }
  return image((x, y) => {
    const at = y * size + x,
      cover = periodic(x, y, 5),
      soil = Math.max(0, 0.39 - cover) * 95,
      value = 206 + (cover - 0.5) * 24 + (random(x, y, 8) - 0.5) * 14 + blades[at];
    return [value + soil * 0.25 + dry[at] * 9, value - soil * 0.45, value - soil - dry[at] * 20];
  });
}
export function gravelPNG() {
  const cells = 20;
  return image((x, y) => {
    const u = (x / size) * cells,
      v = (y / size) * cells,
      cx = Math.floor(u),
      cy = Math.floor(v);
    let closest = Infinity,
      next = Infinity,
      stone = 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const gx = cx + dx,
          gy = cy + dy,
          px = gx + 0.05 + random(wrap(gx, cells), wrap(gy, cells), 43) * 0.9,
          py = gy + 0.05 + random(wrap(gx, cells), wrap(gy, cells), 44) * 0.9,
          distance = Math.hypot(u - px, v - py);
        if (distance < closest) {
          next = closest;
          closest = distance;
          stone = random(wrap(gx, cells), wrap(gy, cells), 45);
        } else next = Math.min(next, distance);
      }
    // A 0.75m repeat gives irregular 15–45mm aggregate, with narrow dusty joints.
    const joint = Math.max(0, Math.min(1, (next - closest) * 8)),
      chipRadius = 0.29 + stone * 0.25,
      edge = Math.min(joint, Math.max(0, Math.min(1, (chipRadius - closest) * 13))),
      dust = 143 + periodic(x, y, 7) * 15 + (random(x, y, 47) - 0.5) * 13,
      chip = 178 + stone * 47 + (random(x, y, 46) - 0.5) * 18,
      value = dust + (chip - dust) * edge;
    return [value + 4, value + 1, value - 5];
  });
}
