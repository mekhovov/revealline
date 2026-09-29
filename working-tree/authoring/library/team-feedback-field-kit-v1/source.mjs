/** Original integer-pixel Team feedback; no sampled images or baked text. */
export const TEAM_FEEDBACK_ART_VERSION = 1;
export const TEAM_FEEDBACK_PALETTE = Object.freeze({
  ink: '#070b12',
  shadow: '#101923',
  light: '#f3f0db',
  cyan: '#78dce8',
  amber: '#f4bf62',
  sage: '#9dbb7a',
});
export const TEAM_FEEDBACK_STATES = Object.freeze(['support', 'slowed', 'rescue', 'recovery']);
export const TEAM_FEEDBACK_DESCRIPTIONS = Object.freeze({
  support:
    'Short field-radio pulse: upright transmitter and disconnected stepped side signals, with no scanning circle or attack shape.',
  slowed:
    'Braced hourglass with a narrow waist and descending sand: temporary slowdown, never a pause or stun command.',
  rescue:
    'Round and diamond partner links joined by a pale diagonal coupling: held contact rescue, not a reward or extra reserve.',
  recovery:
    'Small four-arm craft inside a tapered protective badge: revived-player grace, distinct from the hexagonal relay shield.',
});
export function teamFeedbackPixels(state) {
  if (!TEAM_FEEDBACK_STATES.includes(state)) throw new TypeError('Unknown Team feedback state.');
  const width = 32,
    height = 32,
    rgba = new Uint8ClampedArray(width * height * 4),
    marks = new Map();
  const palette = Object.fromEntries(
    Object.entries(TEAM_FEEDBACK_PALETTE).map(([name, hex]) => [
      name,
      [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)).concat(255),
    ]),
  );
  const dot = (x, y, color) => {
    if (x < 2 || x > 28 || y < 2 || y > 28) throw Error('Artwork exceeds its safe frame.');
    marks.set(y * width + x, color);
  };
  const rect = (x, y, w, h, color) => {
    for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) dot(px, py, color);
  };
  const line = (x0, y0, x1, y1, color) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= steps; i++)
      dot(
        Math.round(x0 + ((x1 - x0) * i) / Math.max(1, steps)),
        Math.round(y0 + ((y1 - y0) * i) / Math.max(1, steps)),
        color,
      );
  };
  if (state === 'support') {
    rect(13, 20, 6, 6, 'light');
    rect(14, 21, 4, 4, 'shadow');
    rect(15, 10, 2, 12, 'cyan');
    rect(13, 7, 6, 4, 'light');
    rect(14, 8, 4, 2, 'cyan');
    for (const [x, sign] of [
      [9, -1],
      [22, 1],
    ]) {
      rect(x, 10, 2, 8, 'cyan');
      rect(x - sign, 9, 2, 2, 'cyan');
      rect(x - sign, 18, 2, 2, 'cyan');
      rect(x + sign * 5, 8, 2, 12, 'light');
      rect(x + sign * 4, 7, 2, 2, 'light');
      rect(x + sign * 4, 20, 2, 2, 'light');
    }
    rect(11, 26, 10, 2, 'light');
  } else if (state === 'slowed') {
    rect(7, 5, 18, 3, 'light');
    rect(7, 25, 18, 3, 'light');
    for (let i = 0; i < 8; i++) {
      rect(8 + i, 8 + i, 2, 2, 'amber');
      rect(22 - i, 8 + i, 2, 2, 'amber');
      rect(8 + i, 23 - i, 2, 2, 'amber');
      rect(22 - i, 23 - i, 2, 2, 'amber');
    }
    rect(12, 9, 8, 2, 'light');
    rect(14, 11, 4, 2, 'light');
    rect(15, 14, 2, 5, 'light');
    rect(13, 22, 6, 2, 'light');
  } else if (state === 'rescue') {
    const circle = [
      [7, 15],
      [12, 15],
      [15, 18],
      [15, 23],
      [12, 26],
      [7, 26],
      [4, 23],
      [4, 18],
      [7, 15],
    ];
    for (let i = 1; i < circle.length; i++) {
      line(...circle[i - 1], ...circle[i], 'amber');
      line(circle[i - 1][0] + 1, circle[i - 1][1], circle[i][0] + 1, circle[i][1], 'light');
    }
    const diamond = [
      [22, 4],
      [28, 11],
      [22, 18],
      [15, 11],
      [22, 4],
    ];
    for (let i = 1; i < diamond.length; i++) {
      line(...diamond[i - 1], ...diamond[i], 'cyan');
      line(diamond[i - 1][0] - 1, diamond[i - 1][1], diamond[i][0] - 1, diamond[i][1], 'light');
    }
    line(12, 20, 21, 11, 'light');
    line(13, 21, 22, 12, 'light');
  } else {
    rect(7, 5, 18, 2, 'sage');
    rect(5, 7, 2, 12, 'light');
    rect(25, 7, 2, 12, 'light');
    for (let i = 0; i < 7; i++) {
      rect(7 + i, 19 + i, 2, 2, 'sage');
      rect(23 - i, 19 + i, 2, 2, 'sage');
    }
    rect(14, 12, 4, 9, 'light');
    rect(15, 13, 2, 6, 'amber');
    for (const [x, y] of [
      [9, 10],
      [20, 10],
      [9, 19],
      [20, 19],
    ]) {
      rect(x, y, 3, 3, 'light');
      line(x + 1, y + 1, 16, 16, 'cyan');
    }
    rect(14, 12, 4, 7, 'light');
    rect(15, 13, 2, 4, 'amber');
  }
  // A one-pixel ink outline provides light-ground separation without glow.
  for (const key of marks.keys()) {
    const x = key % width,
      y = Math.floor(key / width);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) rgba.set(palette.ink, ((y + dy) * width + x + dx) * 4);
  }
  for (const [key, color] of marks) rgba.set(palette[color], key * 4);
  return { width, height, rgba };
}
