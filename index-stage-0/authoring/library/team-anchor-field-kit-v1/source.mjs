/** Original 24px radio-objective icons; integer drawing, no sampled reference art.
 * Both states share a mast, braced receiver and two feet. The open connector in
 * available closes into a linked frame when captured: shape, not colour alone.
 * Runtime supplies anchor letters/checks and the actual capture perimeter. */
export const TEAM_ANCHOR_ART_VERSION = 1;
export const TEAM_ANCHOR_PALETTE = Object.freeze({
  ink: '#070b12',
  shadow: '#101923',
  light: '#f3f0db',
  cyan: '#78dce8',
  amber: '#f4bf62',
});
export const TEAM_ANCHOR_STATES = Object.freeze(['available', 'captured']);

export function teamAnchorPixels(state) {
  if (!TEAM_ANCHOR_STATES.includes(state)) throw new TypeError('Unknown Team anchor state.');
  const width = 24,
    height = 24,
    rgba = new Uint8ClampedArray(width * height * 4);
  const palette = Object.fromEntries(
    Object.entries(TEAM_ANCHOR_PALETTE).map(([name, hex]) => [
      name,
      [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16)).concat(255),
    ]),
  );
  const rect = (x, y, w, h, color) => {
    for (let py = y; py < y + h; py++)
      for (let px = x; px < x + w; px++) rgba.set(palette[color], (py * width + px) * 4);
  };
  // Two upright receiver ears and a central mast, not the pickup's diamond.
  rect(4, 2, 3, 7, 'ink');
  rect(17, 2, 3, 7, 'ink');
  rect(5, 3, 1, 4, 'light');
  rect(18, 3, 1, 4, 'light');
  rect(6, 6, 12, 3, 'ink');
  rect(7, 7, 10, 1, 'light');
  rect(10, 3, 4, 9, 'ink');
  rect(11, 4, 2, 7, 'light');
  // A compact braced field-radio case, with a pale rim on dark/light scenery.
  rect(5, 10, 14, 10, 'ink');
  rect(4, 11, 16, 8, 'ink');
  rect(6, 11, 12, 8, 'light');
  rect(7, 12, 10, 6, 'shadow');
  rect(4, 19, 5, 3, 'ink');
  rect(15, 19, 5, 3, 'ink');
  rect(5, 20, 3, 1, 'light');
  rect(16, 20, 3, 1, 'light');
  // Disconnected jaws versus one continuous secured connector; no letters/checks.
  const accent = state === 'captured' ? 'cyan' : 'amber';
  rect(8, 13, 2, 4, accent);
  rect(14, 13, 2, 4, accent);
  rect(10, 13, 1, 1, accent);
  rect(13, 13, 1, 1, accent);
  rect(10, 16, 1, 1, accent);
  rect(13, 16, 1, 1, accent);
  if (state === 'captured') {
    rect(10, 13, 4, 1, accent);
    rect(10, 16, 4, 1, accent);
    rect(11, 14, 2, 2, 'light');
  }
  return { width, height, rgba };
}
