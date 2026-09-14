/** A bounded, single-layer pixel document. Independent of game state and storage. */
export const MAX_SPRITE_EDGE = 128;
const HISTORY_LIMIT = 64;
const integer = (n, min, max, name) => {
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`Invalid ${name}.`);
  return n;
};
const rgba = (value) => {
  if (!Array.isArray(value) || value.length !== 4) throw new Error('Use four RGBA channels.');
  return [0, 1, 2, 3].map((index) => integer(value[index], 0, 255, 'color channel'));
};
const clone = (d) => ({
  width: d.width,
  height: d.height,
  pixels: new Uint8ClampedArray(d.pixels),
});

export function spriteDocument(width, height, pixels) {
  integer(width, 1, MAX_SPRITE_EDGE, 'sprite width');
  integer(height, 1, MAX_SPRITE_EDGE, 'sprite height');
  const length = width * height * 4;
  if (pixels !== undefined && (!(pixels instanceof Uint8ClampedArray) || pixels.length !== length))
    throw new Error('Pixel data does not match the sprite frame.');
  return {
    width,
    height,
    pixels: pixels ? new Uint8ClampedArray(pixels) : new Uint8ClampedArray(length),
  };
}

export function createSpriteEditor(initial) {
  let current = spriteDocument(initial.width, initial.height, initial.pixels);
  const undo = [],
    redo = [];
  const point = (x, y) => {
    integer(x, 0, current.width - 1, 'pixel x');
    integer(y, 0, current.height - 1, 'pixel y');
    return (y * current.width + x) * 4;
  };
  const commit = (next) => {
    if (
      next.width === current.width &&
      next.height === current.height &&
      next.pixels.every((v, i) => v === current.pixels[i])
    )
      return false;
    undo.push(current);
    if (undo.length > HISTORY_LIMIT) undo.shift();
    redo.length = 0;
    current = next;
    return true;
  };
  const set = (d, x, y, color) => d.pixels.set(color, (y * d.width + x) * 4);
  const line = (d, x0, y0, x1, y1, color) => {
    let dx = Math.abs(x1 - x0),
      sx = x0 < x1 ? 1 : -1;
    let dy = -Math.abs(y1 - y0),
      sy = y0 < y1 ? 1 : -1,
      error = dx + dy;
    while (true) {
      set(d, x0, y0, color);
      if (x0 === x1 && y0 === y1) break;
      const twice = 2 * error;
      if (twice >= dy) {
        error += dy;
        x0 += sx;
      }
      if (twice <= dx) {
        error += dx;
        y0 += sy;
      }
    }
  };
  return {
    snapshot: () => clone(current),
    history: () => ({ undo: undo.length, redo: redo.length }),
    pixel(x, y) {
      const at = point(x, y);
      return Array.from(current.pixels.slice(at, at + 4));
    },
    stroke(points, color) {
      if (!Array.isArray(points) || !points.length || points.length > 16384)
        throw new Error('Invalid stroke.');
      const c = rgba(color);
      for (const p of points) {
        if (!Array.isArray(p) || p.length !== 2) throw new Error('Invalid stroke point.');
        point(...p);
      }
      const next = clone(current);
      set(next, ...points[0], c);
      for (let i = 1; i < points.length; i++) line(next, ...points[i - 1], ...points[i], c);
      return commit(next);
    },
    line(x0, y0, x1, y1, color) {
      point(x0, y0);
      point(x1, y1);
      const next = clone(current);
      line(next, x0, y0, x1, y1, rgba(color));
      return commit(next);
    },
    rectangle(x0, y0, x1, y1, color, filled = false) {
      point(x0, y0);
      point(x1, y1);
      const next = clone(current),
        c = rgba(color);
      const left = Math.min(x0, x1),
        top = Math.min(y0, y1);
      const right = Math.max(x0, x1),
        bottom = Math.max(y0, y1);
      for (let y = top; y <= bottom; y++)
        for (let x = left; x <= right; x++)
          if (filled || x === left || x === right || y === top || y === bottom) set(next, x, y, c);
      return commit(next);
    },
    fill(x, y, color) {
      const start = point(x, y),
        c = rgba(color),
        target = Array.from(current.pixels.slice(start, start + 4));
      if (c.every((v, i) => v === target[i])) return false;
      const next = clone(current),
        seen = new Uint8Array(current.width * current.height),
        queue = [[x, y]];
      for (let q = 0; q < queue.length; q++) {
        const [px, py] = queue[q],
          index = py * current.width + px;
        if (seen[index]) continue;
        seen[index] = 1;
        if (!target.every((v, i) => next.pixels[index * 4 + i] === v)) continue;
        set(next, px, py, c);
        if (px > 0) queue.push([px - 1, py]);
        if (py > 0) queue.push([px, py - 1]);
        if (px + 1 < next.width) queue.push([px + 1, py]);
        if (py + 1 < next.height) queue.push([px, py + 1]);
      }
      return commit(next);
    },
    replaceColor(before, after) {
      const from = rgba(before),
        to = rgba(after),
        next = clone(current);
      for (let at = 0; at < next.pixels.length; at += 4)
        if (from.every((v, i) => next.pixels[at + i] === v)) next.pixels.set(to, at);
      return commit(next);
    },
    moveSelection({ x, y, width, height }, dx, dy) {
      point(x, y);
      integer(width, 1, current.width, 'selection width');
      integer(height, 1, current.height, 'selection height');
      point(x + width - 1, y + height - 1);
      integer(dx, -MAX_SPRITE_EDGE, MAX_SPRITE_EDGE, 'horizontal move');
      integer(dy, -MAX_SPRITE_EDGE, MAX_SPRITE_EDGE, 'vertical move');
      point(x + dx, y + dy);
      point(x + width - 1 + dx, y + height - 1 + dy);
      const next = clone(current);
      for (let py = y; py < y + height; py++)
        for (let px = x; px < x + width; px++) set(next, px, py, [0, 0, 0, 0]);
      for (let py = y; py < y + height; py++)
        for (let px = x; px < x + width; px++) {
          const at = (py * current.width + px) * 4;
          set(next, px + dx, py + dy, current.pixels.subarray(at, at + 4));
        }
      return commit(next);
    },
    transform(kind) {
      if (!['flip-x', 'flip-y', 'rotate'].includes(kind))
        throw new Error('Unknown sprite transform.');
      const next =
        kind === 'rotate' ? spriteDocument(current.height, current.width) : clone(current);
      for (let y = 0; y < current.height; y++)
        for (let x = 0; x < current.width; x++) {
          const at = (y * current.width + x) * 4;
          const [nx, ny] =
            kind === 'rotate'
              ? [current.height - 1 - y, x]
              : kind === 'flip-x'
                ? [current.width - 1 - x, y]
                : [x, current.height - 1 - y];
          set(next, nx, ny, current.pixels.subarray(at, at + 4));
        }
      return commit(next);
    },
    undo() {
      if (!undo.length) return false;
      redo.push(current);
      current = undo.pop();
      return true;
    },
    redo() {
      if (!redo.length) return false;
      undo.push(current);
      current = redo.pop();
      return true;
    },
  };
}
