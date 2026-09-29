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

/** CSS-pixel owner connector; nearby plates need no extra line. Invalid cosmetics stay inert. */
export function coopCueConnector(rect, owner, threshold = 10) {
  if (
    !rect ||
    !owner ||
    Array.isArray(rect) ||
    Array.isArray(owner) ||
    ![rect.left, rect.top, rect.right, rect.bottom, owner.x, owner.y, threshold].every(
      Number.isFinite,
    ) ||
    threshold < 10 ||
    !Number.isFinite(rect.right - rect.left) ||
    !Number.isFinite(rect.bottom - rect.top) ||
    rect.right <= rect.left ||
    rect.bottom <= rect.top
  )
    return null;
  const from = {
      x: clamp(owner.x, rect.left, rect.right),
      y: clamp(owner.y, rect.top, rect.bottom),
    },
    dx = owner.x - from.x,
    dy = owner.y - from.y,
    distance = Math.hypot(dx, dy);
  if (!Number.isFinite(distance) || distance <= threshold) return null;
  return Object.freeze({
    from: Object.freeze(from),
    to: Object.freeze({
      x: owner.x - (dx / distance) * 3,
      y: owner.y - (dy / distance) * 3,
    }),
  });
}

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
  rowPitch = null,
}) {
  if (width > arenaWidth - 2 || height > arenaHeight - 2) return null;
  if (rowPitch !== null && (!Number.isFinite(rowPitch) || rowPitch <= 0 || rowPitch < height))
    throw new TypeError('Cue row pitch must contain the complete plate height.');
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
  if (rowPitch !== null) {
    const rowCount = Math.floor((arenaHeight - margin * 2) / rowPitch);
    // Only explicit persistent-objective callers align to shared rows. Unusual
    // oversized surfaces retain the bounded ordinary search below.
    if (rowCount > 0 && rowCount <= 256) {
      const obstacles = [...heads, ...occupied],
        // Shared fractional row edges can differ by a few machine ulps. Ignore
        // only that arithmetic noise, not a visible geometric intersection.
        epsilon = Number.EPSILON * 8 * Math.max(arenaWidth, arenaHeight),
        rowIntersects = (a, b) =>
          a.left < b.right - epsilon &&
          a.right > b.left + epsilon &&
          a.top < b.bottom - epsilon &&
          a.bottom > b.top + epsilon,
        minimumX = margin + halfWidth,
        maximumX = arenaWidth - margin - halfWidth,
        columns = new Set([
          clamp(x, minimumX, maximumX),
          minimumX,
          maximumX,
          ...obstacles.flatMap((rect) => [
            clamp(rect.left - halfWidth - margin, minimumX, maximumX),
            clamp(rect.right + halfWidth + margin, minimumX, maximumX),
          ]),
        ]),
        clearRows = [];
      for (let row = 0; row < rowCount; row++) {
        const cy = margin + rowPitch / 2 + row * rowPitch;
        for (const cx of columns) {
          const rect = {
            x: cx,
            y: cy,
            left: cx - halfWidth,
            right: cx + halfWidth,
            top: cy - halfHeight,
            bottom: cy + halfHeight,
            width,
            height,
          };
          if (!obstacles.some((other) => rowIntersects(rect, other))) clearRows.push(rect);
        }
      }
      clearRows.sort((a, b) => (a.x - x) ** 2 + (a.y - y) ** 2 - (b.x - x) ** 2 - (b.y - y) ** 2);
      if (clearRows.length) return clearRows[0];
    }
    // Insufficient row capacity must not discard a required cue. The existing
    // placement fallback remains explicit, including its possible overlap.
  }
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
