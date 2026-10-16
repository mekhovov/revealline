/** Original low-contrast timber refinement; existing pixel dimensions, UVs and panels stay exact. */
const widths = [15, 17, 16, 18, 14, 17, 15, 16, 18, 15, 17, 14, 16, 18, 15, 15];
const edges = widths.reduce((rows, width) => [...rows, rows.at(-1) + width], [0]);
const hash = (board, row) =>
  (((Math.imul(board + 7, 374761393) ^ Math.imul(row + 19, 668265263)) >>> 9) % 17) / 8 - 1;
const smooth = (value) => value * value * (3 - 2 * value);
export function quietStationWall(original) {
  if (original.id !== 'original-station-wall' || original.width !== 256 || original.height !== 128)
    throw new TypeError('Exact accepted station wall required');
  const bytes = Buffer.from(original.rgbaBase64, 'base64');
  for (let py = 0; py < 128; py++)
    for (let px = 0; px < 256; px++) {
      const x = px / 32,
        y = (1 - py / 128) * 14;
      // The masonry, backed panels/frames and dark eave strip are unchanged pixels.
      if (y < 1.4 || y > 13.65 || (y > 3.8 && y < 8.2 && x > 1.7 && x < 6.3)) continue;
      const board = edges.findIndex((right, index) => index && px < right) - 1;
      const left = edges[board],
        right = edges[board + 1];
      const seam = Math.max(0, 1 - Math.min(px - left, right - px) / 2.5);
      const coarse = y / 1.6,
        row = Math.floor(coarse),
        t = smooth(coarse - row);
      const grain = (hash(board, row) * (1 - t) + hash(board, row + 1) * t) * 1.5;
      const tint = hash(board, 0) * 4;
      const shade = seam * 16;
      const rgb = [
        139 + tint + grain - shade,
        108 + tint + grain - shade,
        77 + tint + grain - shade,
      ];
      bytes.set(
        rgb.map((v) => Math.round(v)),
        (py * 256 + px) * 4,
      );
    }
  return { ...original, rgbaBase64: bytes.toString('base64') };
}
export function quietStationCell(source) {
  let changedTextures = 0;
  const textures = source.textures.map((texture) => {
    if (texture.id !== 'original-station-wall') return texture;
    changedTextures++;
    return quietStationWall(texture);
  });
  return { source: changedTextures ? { ...source, textures } : source, changedTextures };
}
