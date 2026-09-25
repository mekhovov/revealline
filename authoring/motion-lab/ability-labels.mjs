import { t } from '../../game/i18n/index.mjs';
const WIDTH = 48;
const HEIGHT = 36;
const INSET = 0.2;
const MAX_SEGMENT_UNITS = 2048;
const MAX_CACHED_LABELS = 128;

/** Presentation-only descriptors. Conceal notes before either consumer sees text. */
export function describeAbilityLabels(state, config, family) {
  const vocabulary = config.vocabulary[family];
  return [
    ...config.stage.haze.map((area, index) => ({
      key: `haze:${index}`,
      kind: 'haze',
      x: area.x + area.width / 2,
      y: area.y + 0.8,
      canvasText: vocabulary.hazeLabel,
      text: vocabulary.hazeLabel,
      concealed: false,
      status: null,
    })),
    ...config.stage.supplyPads.map((pad) => ({
      key: `pad:${pad.id}`,
      kind: 'pad',
      x: pad.x,
      y: pad.y + pad.radius + 0.65,
      canvasText: `${vocabulary.supplyLabel} · R`,
      text: vocabulary.supplyLabel,
      concealed: false,
      status: null,
    })),
    ...state.targets.map((target) => {
      const concealed = target.kind === 'note' && !(target.revealedUntil > state.time);
      return {
        key: `target:${target.id}`,
        kind: target.kind,
        x: target.x,
        y: target.y + (concealed ? 0.16 : 1.1),
        canvasText: concealed
          ? '?'
          : target.kind === 'ground'
            ? target.label.replace('Tile ', '')
            : target.label,
        text: concealed ? t("tools:concealedNote") : target.label,
        concealed,
        status: target.status,
      };
    }),
  ];
}

function defaultSegmenter() {
  try {
    return typeof Intl?.Segmenter === 'function'
      ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
      : null;
  } catch {
    return null;
  }
}

/** Cache only bounded grapheme boundaries, never font metrics: newly loaded fonts
 * must be measured afresh. A null segmenter safely uses whole text or ellipsis. */
export function createAbilityLabelPainter({ segmenter = defaultSegmenter() } = {}) {
  const segments = new Map();
  const boundaries = (text) => {
    if (!segmenter) return null;
    if (segments.has(text)) return segments.get(text);
    const ends = [0];
    let prefix = '';
    for (const part of segmenter.segment(text)) {
      if (prefix.length + part.segment.length > MAX_SEGMENT_UNITS) break;
      prefix += part.segment;
      ends.push(prefix.length);
    }
    const result = { prefix, ends };
    // Long author-authored labels remain available in the DOM without retaining
    // arbitrary strings in the painter or measuring them on every frame.
    if (text.length <= MAX_SEGMENT_UNITS) {
      if (segments.size >= MAX_CACHED_LABELS) segments.delete(segments.keys().next().value);
      segments.set(text, result);
    }
    return result;
  };

  return (ctx, descriptor, pixels, color, { family, minimum }) => {
    if (
      !Number.isFinite(pixels) ||
      pixels <= 0 ||
      !Number.isFinite(minimum) ||
      minimum <= 0 ||
      !Number.isFinite(descriptor.x) ||
      !Number.isFinite(descriptor.y) ||
      typeof descriptor.canvasText !== 'string' ||
      descriptor.canvasText.length === 0
    )
      return;
    const fontSize = Math.max(0.43, minimum / pixels);
    if (!Number.isFinite(fontSize)) return;
    ctx.font = `500 ${fontSize}px ${family}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = color;

    const measure = (text) => {
      const metrics = ctx.measureText(text);
      const horizontal = [metrics.actualBoundingBoxLeft, metrics.actualBoundingBoxRight];
      const vertical = [metrics.actualBoundingBoxAscent, metrics.actualBoundingBoxDescent];
      const [left, right] = horizontal.every(Number.isFinite)
        ? horizontal
        : [metrics.width / 2, metrics.width / 2];
      const [ascent, descent] = vertical.every(Number.isFinite)
        ? vertical
        : [fontSize, fontSize * 0.25];
      return { text, left, right, ascent, descent };
    };
    const fits = ({ left, right, ascent, descent }) =>
      [left, right, ascent, descent].every(Number.isFinite) &&
      left + right >= 0 &&
      left + right <= WIDTH - INSET * 2 &&
      ascent + descent >= 0 &&
      ascent + descent <= HEIGHT - INSET * 2;

    const text = descriptor.canvasText;
    let fitted = text.length <= MAX_SEGMENT_UNITS ? measure(text) : null;
    if (!fitted || !fits(fitted)) {
      fitted = measure('…');
      if (!fits(fitted)) return;
      const parts = boundaries(text);
      if (parts) {
        let low = 0,
          high = parts.ends.length - 1;
        while (low <= high) {
          const middle = Math.floor((low + high) / 2);
          const candidate = measure(`${parts.prefix.slice(0, parts.ends[middle]).trimEnd()}…`);
          if (fits(candidate)) {
            fitted = candidate;
            low = middle + 1;
          } else high = middle - 1;
        }
      }
    }
    const x = Math.max(INSET + fitted.left, Math.min(WIDTH - INSET - fitted.right, descriptor.x));
    const y = Math.max(
      INSET + fitted.ascent,
      Math.min(HEIGHT - INSET - fitted.descent, descriptor.y),
    );
    ctx.fillText(fitted.text, x, y);
  };
}
