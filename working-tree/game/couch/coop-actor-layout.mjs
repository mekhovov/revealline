import { resolveTextSize } from '../text-size.mjs';

// Cosmetic geometry only. All positions passed to the core remain untouched.
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
export function coopCueScale(width, columns = 72, textSize = 'standard') {
  const factor = resolveTextSize(textSize) === 'large' ? 4 / 3 : 1;
  const cssWidth = Number.isFinite(width) && width > 0 ? width : 1152;
  const cell = cssWidth / columns;
  return Object.freeze({
    width: cssWidth,
    cell,
    factor,
    // Enlarge the resolved CSS text and its backing geometry together. The
    // arena/collision scale and ordinary actor sizes do not belong to this role.
    px: (value) => value * factor,
    font: (cells, minimum = 12, maximum = 18) =>
      (clamp(cells * cell, minimum, maximum) * factor) / cell,
  });
}

/** Relative full-frame/rotor/nose bounds after the shared heading and banking transforms. */
export function coopBodyBounds(frame, geometry) {
  const diameter = frame.diameter,
    source = geometry.frame,
    extent = Math.max(source.width, source.height),
    width = (diameter * source.width) / extent,
    height = (diameter * source.height) / extent,
    sx = 1 - frame.bank * 0.35,
    sy = 1 + frame.bank * 0.2,
    cosine = Math.cos(frame.heading),
    sine = Math.sin(frame.heading);
  const points = [];
  const rectangle = (left, top, right, bottom) => {
    for (const [x, y] of [
      [left, top],
      [right, top],
      [left, bottom],
      [right, bottom],
    ])
      points.push({ x: x * sx * cosine - y * sy * sine, y: x * sx * sine + y * sy * cosine });
  };
  rectangle(
    -geometry.pivot.x * width,
    -geometry.pivot.y * height,
    (1 - geometry.pivot.x) * width,
    (1 - geometry.pivot.y) * height,
  );
  for (const rotor of geometry.rotors) {
    // Include the square motor housing as well as every rotating blade angle.
    const radius = (Math.sqrt(32) * 0.16 * rotor.radiusScale * width) / 5;
    rectangle(
      rotor.x * width - radius,
      rotor.y * height - radius,
      rotor.x * width + radius,
      rotor.y * height + radius,
    );
  }
  rectangle((-4 * diameter) / 28, (-13 * diameter) / 28, (4 * diameter) / 28, (-9 * diameter) / 28);
  return Object.freeze({
    left: Math.min(...points.map((point) => point.x)),
    top: Math.min(...points.map((point) => point.y)),
    right: Math.max(...points.map((point) => point.x)),
    bottom: Math.max(...points.map((point) => point.y)),
  });
}

export function coopPilotBodyOffset(frame, geometry, width, height, margin = 0) {
  const bounds = coopBodyBounds(frame, geometry),
    x = Math.round(frame.x),
    y = Math.round(frame.y);
  return Object.freeze({
    x: clamp(x, margin - bounds.left, width - margin - bounds.right) - x,
    y: clamp(y, margin - bounds.top, height - margin - bounds.bottom) - y,
  });
}

const intersects = (a, b) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
/** Bounded label placement in CSS pixels; true heads are hard exclusions. */
export function placeCoopCue({
  x,
  y,
  width,
  height,
  arenaWidth,
  arenaHeight,
  heads,
  occupied = [],
  avoid = [],
  preferClear = false,
}) {
  if (width > arenaWidth - 2 || height > arenaHeight - 2) return null;
  const margin = 1,
    halfWidth = width / 2,
    halfHeight = height / 2,
    candidates = [],
    add = (cx, cy) => {
      cx = clamp(cx, margin + halfWidth, arenaWidth - margin - halfWidth);
      cy = clamp(cy, margin + halfHeight, arenaHeight - margin - halfHeight);
      const rect = {
        x: cx,
        y: cy,
        left: cx - halfWidth,
        top: cy - halfHeight,
        right: cx + halfWidth,
        bottom: cy + halfHeight,
        width,
        height,
      };
      if (!heads.some((head) => intersects(rect, head))) candidates.push(rect);
    };
  add(x, y);
  for (let ring = 1; ring <= 3; ring++) {
    const dx = (width + 3) * ring,
      dy = (height + 3) * ring;
    for (const [ox, oy] of [
      [0, -dy],
      [0, dy],
      [-dx, 0],
      [dx, 0],
      [-dx, -dy],
      [dx, -dy],
      [-dx, dy],
      [dx, dy],
    ])
      add(x + ox, y + oy);
  }
  for (const cx of [halfWidth + margin, arenaWidth - halfWidth - margin])
    for (const cy of [halfHeight + margin, arenaHeight - halfHeight - margin]) add(cx, cy);
  const clear = (rect) => !occupied.some((other) => intersects(rect, other));
  if (preferClear && !candidates.some(clear)) {
    // Larger captions can fit between existing plates even when none of the
    // ordinary radial positions do. Sweep obstacle edges, not arena pixels.
    const obstacles = [...heads, ...occupied],
      minimumX = margin + halfWidth,
      maximumX = arenaWidth - margin - halfWidth,
      minimumY = margin + halfHeight,
      maximumY = arenaHeight - margin - halfHeight,
      columns = new Set([
        clamp(x, minimumX, maximumX),
        minimumX,
        maximumX,
        ...obstacles.flatMap((rect) => [
          clamp(rect.left - halfWidth - margin, minimumX, maximumX),
          clamp(rect.right + halfWidth + margin, minimumX, maximumX),
        ]),
      ]);
    for (const cx of columns) {
      const intervals = obstacles
        .filter((rect) => cx - halfWidth < rect.right && cx + halfWidth > rect.left)
        .map((rect) => [rect.top - halfHeight - margin, rect.bottom + halfHeight + margin])
        .sort((a, b) => a[0] - b[0]);
      let start = minimumY,
        nearest = null;
      const gap = (end) => {
        if (end < start) return;
        const cy = clamp(y, start, end);
        if (nearest === null || Math.abs(cy - y) < Math.abs(nearest - y)) nearest = cy;
      };
      for (const [low, high] of intervals) {
        gap(Math.min(low, maximumY));
        start = Math.max(start, high);
        if (start > maximumY) break;
      }
      if (start <= maximumY) gap(maximumY);
      if (nearest !== null) add(cx, nearest);
    }
  }
  const available = preferClear ? candidates.filter(clear) : [];
  const score = (rect) =>
    occupied.filter((other) => intersects(rect, other)).length * 100000 +
    avoid.filter((other) => intersects(rect, other)).length * 10000 +
    (rect.x - x) ** 2 +
    (rect.y - y) ** 2;
  const ranked = available.length ? available : candidates;
  ranked.sort((a, b) => score(a) - score(b));
  return ranked[0] ?? null;
}
