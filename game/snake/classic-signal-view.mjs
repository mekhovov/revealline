import { applyAnalogSignalNoise } from '../ui/analog-signal.mjs';

export const CLASSIC_SIGNAL_MAX_BLEND = 0.65;
export const CLASSIC_SIGNAL_MAX_TEAR_CELLS = 0.15;
const receivers = new WeakMap();
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const axisDistance = (a, b, size, wrap) => {
  const delta = Math.abs(a - b);
  return wrap ? Math.min(delta, size - delta) : delta;
};

export function classicSignalStrength(run, signal) {
  if (!signal?.active || signal.suppressed || run.status !== 'running') return 0;
  const heads = run.snakes.filter((snake) => snake.alive).map((snake) => snake.body[0]);
  return Math.max(
    0,
    ...signal.sources
      .filter((source) => source.phase === 'jamming')
      .map((source) => {
        if (source.radius == null) return 1;
        const distance = Math.min(
          ...heads.map((head) =>
            Math.hypot(
              axisDistance(head.x, source.x, run.level.width, run.level.wrap),
              axisDistance(head.y, source.y, run.level.height, run.level.wrap),
            ),
          ),
        );
        return distance > source.radius ? 0 : 0.25 + 0.75 * (1 - distance / source.radius);
      }),
  );
}

/** Fresh live field plus at most 65% receiver noise. A two-cell neighbourhood
 * of every head, and the source cells, stay exact. Reduced effects freezes only
 * noise and tearing; the supplied board pixels still change on every step. */
export function classicSignalPixels(
  base,
  width,
  height,
  {
    frame = 0,
    seed = 0,
    strength = 1,
    reduced = false,
    columns = 24,
    rows = 18,
    wrap = false,
    heads = [],
    sources = [],
    scratch = {},
  } = {},
) {
  const cellWidth = width / columns,
    cellHeight = height / rows;
  if (scratch.torn?.length !== base.length) scratch.torn = new Uint8ClampedArray(base.length);
  if (scratch.noisy?.length !== base.length) scratch.noisy = new Uint8ClampedArray(base.length);
  const { torn, noisy } = scratch;
  const blend = CLASSIC_SIGNAL_MAX_BLEND * clamp(strength, 0, 1);
  const maxTear = reduced ? 0 : Math.floor(cellWidth * CLASSIC_SIGNAL_MAX_TEAR_CELLS);
  for (let y = 0; y < height; y++) {
    const band = Math.floor(y / Math.max(1, Math.floor(cellHeight * 0.35)));
    const shift = maxTear
      ? (((Math.imul(band + frame + 1, 137) ^ seed) >>> 0) % (2 * maxTear + 1)) - maxTear
      : 0;
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4,
        from = (y * width + clamp(x + shift, 0, width - 1)) * 4;
      const grey = base[from] * 0.3 + base[from + 1] * 0.6 + base[from + 2] * 0.1;
      for (let channel = 0; channel < 3; channel++)
        torn[at + channel] = (base[from + channel] * 0.35 + grey * 0.65) * 0.62;
      torn[at + 3] = 255;
    }
  }
  applyAnalogSignalNoise(torn, width, height, reduced ? 0 : frame, noisy, {
    seed: seed >>> 0,
    strength: clamp(strength, 0, 1),
  });
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4,
        cx = Math.floor(x / cellWidth),
        cy = Math.floor(y / cellHeight);
      const safe =
        heads.some((head) => {
          const dx = Math.abs(head.x - cx),
            dy = Math.abs(head.y - cy);
          return (
            (wrap ? Math.min(dx, columns - dx) : dx) <= 2 &&
            (wrap ? Math.min(dy, rows - dy) : dy) <= 2
          );
        }) || sources.some((source) => source.x === cx && source.y === cy);
      for (let channel = 0; channel < 3; channel++)
        noisy[at + channel] = safe
          ? base[at + channel]
          : base[at + channel] * (1 - blend) + noisy[at + channel] * blend;
      noisy[at + 3] = 255;
    }
  return noisy;
}

function createReceiver(canvas) {
  const surface =
    canvas.ownerDocument?.createElement?.('canvas') ??
    (typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(1, 1) : null);
  const context = surface?.getContext?.('2d', { willReadFrequently: true });
  return context?.getImageData && context?.putImageData
    ? { surface, context, owner: null, key: '', scratch: {} }
    : null;
}

export function drawClassicSignalInterference(
  ctx,
  canvas,
  run,
  signal,
  { unit = 28, reduced = false, timeMs = 0, palette, visualKey = '' } = {},
) {
  const strength = classicSignalStrength(run, signal);
  if (!strength) return;
  if (!receivers.has(canvas)) receivers.set(canvas, createReceiver(canvas));
  const receiver = receivers.get(canvas);
  const width = run.level.width * unit,
    height = run.level.height * unit;
  if (receiver) {
    const ratio = Math.min(1, 320 / width, 320 / height),
      sampleWidth = Math.max(1, Math.round(width * ratio)),
      sampleHeight = Math.max(1, Math.round(height * ratio)),
      frame = reduced ? 0 : Math.floor((Number.isFinite(timeMs) ? timeMs : 0) / 100),
      key = `${run.tick}/${frame}/${strength}/${reduced}/${canvas.width}/${canvas.height}/${visualKey}`;
    // Ticks always refresh the live source, even with a frozen noise clock.
    if (receiver.owner !== run || receiver.key !== key) {
      const { surface, context } = receiver;
      if (surface.width !== sampleWidth || surface.height !== sampleHeight) {
        surface.width = sampleWidth;
        surface.height = sampleHeight;
      }
      context.imageSmoothingEnabled = false;
      context.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, sampleWidth, sampleHeight);
      try {
        const image = context.getImageData(0, 0, sampleWidth, sampleHeight);
        image.data.set(
          classicSignalPixels(image.data, sampleWidth, sampleHeight, {
            frame,
            seed: run.hazardSeed ?? run.seed ?? 0,
            strength,
            reduced,
            columns: run.level.width,
            rows: run.level.height,
            wrap: run.level.wrap,
            heads: run.snakes.filter((snake) => snake.alive).map((snake) => snake.body[0]),
            sources: signal.sources,
            scratch: receiver.scratch,
          }),
        );
        context.putImageData(image, 0, 0);
        receiver.owner = run;
        receiver.key = key;
      } catch {
        // A custom cross-origin skin cannot break rendering or steering.
        receivers.set(canvas, null);
        return;
      }
    }
    ctx.drawImage(receiver.surface, 0, 0, width, height);
  } else {
    ctx.save();
    ctx.fillStyle = palette?.grid ?? '#33434c';
    ctx.globalAlpha = 0.18 * strength;
    for (let y = 0; y < height; y += 4) ctx.fillRect(0, y, width, 1);
    ctx.restore();
  }
}

/** Truthful source/range cues are drawn after the processed live feed. */
export function drawClassicSignalSources(ctx, run, signal, { unit = 28, palette = {} } = {}) {
  if (!signal?.sources?.length) return;
  const width = run.level.width * unit,
    height = run.level.height * unit;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();
  for (const source of signal.sources) {
    const active = source.phase === 'jamming' && signal.active && !signal.suppressed;
    const warning = source.phase === 'warning' && signal.warning && !signal.suppressed;
    const x = (source.x + 0.5) * unit,
      y = (source.y + 0.5) * unit;
    ctx.strokeStyle = active ? (palette.danger ?? '#ff8478') : (palette.accent ?? '#ffd06c');
    ctx.lineWidth = active || warning ? 1.5 : 1;
    ctx.globalAlpha = active || warning ? 0.68 : 0.24;
    ctx.setLineDash([3, 6]);
    if (source.radius != null) {
      const radius = source.radius * unit;
      for (const dx of run.level.wrap ? [-width, 0, width] : [0])
        for (const dy of run.level.wrap ? [-height, 0, height] : [0]) {
          if (
            x + dx + radius < 0 ||
            x + dx - radius > width ||
            y + dy + radius < 0 ||
            y + dy - radius > height
          )
            continue;
          ctx.beginPath();
          ctx.arc(x + dx, y + dy, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
    } else if (active || warning) ctx.strokeRect(2, 2, width - 4, height - 4);
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    // Antenna stays recognizable even when distant actor detail is noisy.
    ctx.fillStyle = '#162d30';
    const antennaOffsets = source.radius == null ? [-3, 3] : [0];
    ctx.fillRect(x - (source.radius == null ? 7 : 4), y - 9, source.radius == null ? 14 : 8, 17);
    ctx.strokeStyle = '#fff0ad';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const dx of antennaOffsets) {
      ctx.moveTo(x + dx, y + 5);
      ctx.lineTo(x + dx, y - 10);
      ctx.moveTo(x + dx - 3, y - 6);
      ctx.lineTo(x + dx + 3, y - 6);
    }
    ctx.stroke();
    if (active || warning) {
      ctx.beginPath();
      ctx.arc(x, y - 6, 8, -1, 1);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y - 6, 8, Math.PI - 1, Math.PI + 1);
      ctx.stroke();
    }
  }
  // Per-board text/status is owned by the host, outside the playable grid.
  ctx.restore();
}
