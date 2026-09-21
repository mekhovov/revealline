// Semantic cue colours only: no game state, collision or timing authority.
const LEGACY = Object.freeze({
  back: '#07111c',
  text: '#f1f7ed',
  warning: '#ffd279',
  anchorReady: '#ffd279',
  anchorReadyFill: '#604b30',
  anchorCaptured: '#c9e4a0',
  anchorCapturedFill: '#315744',
  anchorText: '#fff1c8',
  coreSecured: '#a0c887',
  coreLive: '#ffc1a4',
  shield: '#f1b860',
  exposed: '#f48885',
  recovery: '#e6ffcf',
  playerFill: '#172c34',
  enemyQuiet: '#849fa4',
  enemyHot: '#fc786f',
  enemyLine: '#ffc0a1',
  enemyCenter: '#521f2a',
  enemyText: '#eee7c8',
  slowed: '#e6f8ff',
  impactFill: '#fff0bc',
  impactLine: '#fc786f',
});
function luminance(hex) {
  if (typeof hex !== 'string' || !/^#[a-f0-9]{6}$/i.test(hex))
    throw new TypeError('Team cue colour must be six-digit hex.');
  const channels = hex
    .slice(1)
    .match(/../g)
    .map((value) => parseInt(value, 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
export function coopCueContrast(first, second) {
  const a = luminance(first),
    b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
export function coopCueOutline(color) {
  return coopCueContrast('#000000', color) >= coopCueContrast('#ffffff', color)
    ? '#000000'
    : '#ffffff';
}
/** Keep a theme colour when readable; neutral fallback is a legibility treatment,
 * not a silent replacement of the selected presentation or its artwork. */
const readable = (color, back) =>
  coopCueContrast(color, back) >= 4.5 ? color : coopCueOutline(back);
export function coopCuePalette(palette = null) {
  if (palette === null) return LEGACY;
  const back = palette.paper,
    text = readable(palette.ink, back),
    warning = readable(palette.accent, back),
    safe = readable(palette.safe, back),
    danger = readable(palette.danger, back),
    quiet = readable(palette.muted, back);
  return Object.freeze({
    back,
    text,
    warning,
    anchorReady: warning,
    anchorReadyFill: back,
    anchorCaptured: safe,
    anchorCapturedFill: back,
    anchorText: text,
    coreSecured: safe,
    coreLive: warning,
    shield: warning,
    exposed: danger,
    recovery: safe,
    playerFill: back,
    enemyQuiet: quiet,
    enemyHot: danger,
    enemyLine: danger,
    enemyCenter: back,
    enemyText: text,
    slowed: safe,
    impactFill: text,
    impactLine: danger,
  });
}
