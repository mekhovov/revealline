/** Original Field Kit sprite drawings. Integer pixel clusters are authored here,
 * never sampled from reference or generated artwork. Rendering is pure and has
 * no DOM, clock, random source, storage, simulation, or external image input. */
export const FIELD_KIT_SPRITE_VERSION = 1;
export const FIELD_KIT_COLORS = Object.freeze({
  ink: '#070b12',
  shadow: '#101923',
  plate: '#182531',
  frame: '#425563',
  metal: '#647786',
  light: '#a5b2bb',
  white: '#f3f0db',
  cyan: '#78dce8',
  amber: '#f4bf62',
  danger: '#f07879',
  green: '#9dbb7a',
  earth: '#687c55',
});
const classes = ['scout', 'bomber', 'carrier', 'interceptor', 'fiber', 'impact', 'trapper'];
export const FIELD_KIT_SPRITE_SIZES = Object.freeze(
  Object.fromEntries([
    ...classes.flatMap((id) => [
      [`player.${id}.compact`, 32],
      [`player.${id}.detailed`, 64],
    ]),
    ...['bouncer', 'border-patrol', 'contour-patrol', 'claimed-rover', 'eroder'].map((id) => [
      `enemy.${id}`,
      32,
    ]),
    ['enemy.lane-boss', 64],
    ['enemy.relay-sentinel', 64],
    ...['wall', 'slow', 'lethal'].map((id) => [`terrain.${id}`, 16]),
    ['pickup.objective', 16],
    ['pickup.supply', 16],
    ...['life', 'speed', 'slow', 'freeze'].map((id) => [`pickup.${id}`, 24]),
  ]),
);
export const FIELD_KIT_SPRITE_IDS = Object.freeze(Object.keys(FIELD_KIT_SPRITE_SIZES));
export const FIELD_KIT_PLAYER_HUBS = Object.freeze(
  Object.fromEntries(
    classes.map((id) => [
      id,
      Object.freeze(
        (id === 'carrier'
          ? [
              [0.3, 0.2],
              [0.7, 0.2],
              [0.2, 0.5],
              [0.8, 0.5],
              [0.3, 0.8],
              [0.7, 0.8],
            ]
          : [
              [0.25, 0.25],
              [0.75, 0.25],
              [0.25, 0.75],
              [0.75, 0.75],
            ]
        ).map(([x, y]) => Object.freeze({ x, y, radius: 0.12, blades: 3 })),
      ),
    ]),
  ),
);
const tokenNames = {
  ink: 'ink',
  shadow: 'panel',
  plate: 'panelRaised',
  frame: 'line',
  metal: 'controlLine',
  light: 'muted',
  white: 'text',
  cyan: 'cyan',
  amber: 'amber',
  danger: 'hazard',
  green: 'success',
  earth: 'land',
};

function pixelCanvas(size, palette) {
  const rgba = new Uint8ClampedArray(size * size * 4),
    scale = size / 32;
  const colors = Object.fromEntries(
    Object.entries(palette).map(([key, hex]) => [
      key,
      [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)).concat(255),
    ]),
  );
  const put = (x, y, color) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    rgba.set(color ? colors[color] : [0, 0, 0, 0], (y * size + x) * 4);
  };
  const rect = (x, y, w, h, color) => {
    const left = Math.floor(x * scale),
      top = Math.floor(y * scale),
      right = Math.max(left + 1, Math.floor((x + w) * scale)),
      bottom = Math.max(top + 1, Math.floor((y + h) * scale));
    for (let py = top; py < bottom; py++) for (let px = left; px < right; px++) put(px, py, color);
  };
  const polygon = (points, color) => {
    const p = points.map(([x, y]) => [x * scale, y * scale]);
    const minX = Math.max(0, Math.floor(Math.min(...p.map(([x]) => x)))),
      maxX = Math.min(size, Math.ceil(Math.max(...p.map(([x]) => x))));
    const minY = Math.max(0, Math.floor(Math.min(...p.map(([, y]) => y)))),
      maxY = Math.min(size, Math.ceil(Math.max(...p.map(([, y]) => y))));
    for (let y = minY; y < maxY; y++)
      for (let x = minX; x < maxX; x++) {
        let inside = false;
        for (let i = 0, j = p.length - 1; i < p.length; j = i++)
          if (
            p[i][1] > y + 0.5 !== p[j][1] > y + 0.5 &&
            x + 0.5 < ((p[j][0] - p[i][0]) * (y + 0.5 - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]
          )
            inside = !inside;
        if (inside) put(x, y, color);
      }
  };
  const chamfer = (x, y, w, h, color, cut = 1) =>
    polygon(
      [
        [x + cut, y],
        [x + w - cut, y],
        [x + w, y + cut],
        [x + w, y + h - cut],
        [x + w - cut, y + h],
        [x + cut, y + h],
        [x, y + h - cut],
        [x, y + cut],
      ],
      color,
    );
  const line = (x0, y0, x1, y1, width, color) => {
    let x = Math.floor(x0 * scale),
      y = Math.floor(y0 * scale),
      endX = Math.floor(x1 * scale),
      endY = Math.floor(y1 * scale);
    const dx = Math.abs(endX - x),
      sx = x < endX ? 1 : -1,
      dy = -Math.abs(endY - y),
      sy = y < endY ? 1 : -1;
    let error = dx + dy;
    const thickness = Math.max(1, Math.floor(width * scale)),
      offset = Math.floor(thickness / 2);
    for (;;) {
      for (let py = y - offset; py < y - offset + thickness; py++)
        for (let px = x - offset; px < x - offset + thickness; px++) put(px, py, color);
      if (x === endX && y === endY) break;
      const twice = 2 * error;
      if (twice >= dy) {
        error += dy;
        x += sx;
      }
      if (twice <= dx) {
        error += dx;
        y += sy;
      }
    }
  };
  const motor = (nx, ny) => {
    const x = Math.floor(nx * size),
      y = Math.floor(ny * size),
      r = Math.max(1, Math.floor(size / 16));
    for (let py = -r; py <= r; py++)
      for (let px = -r; px <= r; px++) {
        if (Math.abs(px) === r && Math.abs(py) === r) continue;
        const edge = Math.abs(px) === r || Math.abs(py) === r;
        put(x + px, y + py, edge ? (py < 0 ? 'light' : 'frame') : 'ink');
      }
    const c = Math.max(1, Math.floor(size / 32));
    for (let py = 0; py < c; py++) for (let px = 0; px < c; px++) put(x + px, y + py, 'amber');
    if (size >= 64) {
      put(x - 1, y - 1, 'white');
      put(x + 1, y + 1, 'metal');
    }
  };
  return { rgba, size, scale, put, rect, polygon, chamfer, line, motor };
}
function arm(a, x, y, detail) {
  const towardX = x < 16 ? 12 : 20,
    towardY = y < 16 ? 12 : 20;
  a.line(towardX, towardY, x, y, 4, 'ink');
  a.line(towardX, towardY, x, y, 3, 'frame');
  a.line(towardX, towardY - 1, x, y - 1, 1, 'metal');
  if (detail) a.line(towardX, towardY, x, y, 0.5, 'plate');
}
function plate(a, x, y, w, h, fill = 'plate') {
  a.chamfer(x, y, w, h, 'ink');
  a.chamfer(x + 0.5, y + 0.5, w - 1, h - 1, 'metal');
  a.chamfer(x + 1, y + 1, w - 2, h - 2, fill);
}
function battery(a, x, y, w, h, detail, color = 'amber') {
  a.rect(x, y, w, h, 'ink');
  a.rect(x + 1, y + 1, w - 2, h - 2, color);
  a.rect(x + 1, y + 1, w - 2, 1, 'white');
  const strapY = y + Math.floor(h / 2);
  a.rect(x, strapY, w, 1.5, 'frame');
  if (detail) {
    a.rect(x + 1.5, y + 2, 1, h - 4, 'white');
    a.rect(x + w - 2, y + 2, 0.5, h - 4, 'plate');
    a.rect(x + w - 2, y + h - 2, 1, 1, 'ink');
  }
}
function camera(a, detail, wide = false) {
  const x = wide ? 12 : 13,
    w = wide ? 8 : 6;
  a.chamfer(x, 4, w, 6, 'ink');
  a.rect(x + 1, 4, w - 2, 1, 'light');
  a.rect(x + 1, 5, w - 2, 3, 'plate');
  a.rect(14, 5, 4, 3, 'cyan');
  a.rect(15, 5, 1, 1, 'white');
  a.rect(16, 7, 1, 1, 'frame');
  if (detail) {
    a.rect(x + 0.5, 5, 0.5, 2, 'white');
    a.rect(x + w - 1, 5, 0.5, 2, 'metal');
  }
}
function player(a, id, detail) {
  const hubs = FIELD_KIT_PLAYER_HUBS[id];
  for (const hub of hubs) arm(a, hub.x * 32, hub.y * 32, detail);
  // Rear aerial is a single deliberate cluster, never a baked propeller.
  a.rect(15, 23, 2, 5, 'ink');
  a.rect(15, 24, 1, 3, 'metal');
  a.rect(14, 26, 3, 1, 'light');
  if (id === 'scout') {
    plate(a, 11, 8, 10, 16);
    battery(a, 12, 10, 8, 12, detail);
    a.rect(13, 22, 6, 2, 'frame');
  }
  if (id === 'bomber') {
    plate(a, 10, 8, 12, 17);
    plate(a, 8, 12, 4, 11, 'earth');
    plate(a, 20, 12, 4, 11, 'earth');
    battery(a, 12, 9, 8, 15, detail, 'green');
    a.rect(10, 12, 12, 2, 'amber');
    a.rect(10, 21, 12, 2, 'amber');
    if (detail) {
      a.rect(8.5, 15, 1, 5, 'white');
      a.rect(22.5, 15, 1, 5, 'metal');
    }
  }
  if (id === 'carrier') {
    plate(a, 10, 7, 12, 20, 'earth');
    a.rect(11, 8, 2, 17, 'amber');
    a.rect(19, 8, 2, 17, 'amber');
    a.rect(13, 9, 6, 15, 'earth');
    for (const y of [11, 17, 23]) {
      a.rect(11, y, 10, 2, 'ink');
      a.rect(11, y, 10, 1, 'amber');
    }
    if (detail) {
      a.rect(14, 8, 1, 16, 'green');
      for (const y of [9, 14, 20]) a.rect(17, y, 1, 1, 'metal');
    }
  }
  if (id === 'interceptor') {
    a.polygon(
      [
        [12, 8],
        [20, 8],
        [23, 21],
        [19, 25],
        [13, 25],
        [9, 21],
      ],
      'ink',
    );
    a.polygon(
      [
        [13, 9],
        [19, 9],
        [21, 20],
        [18, 23],
        [14, 23],
        [11, 20],
      ],
      'metal',
    );
    a.polygon(
      [
        [13, 10],
        [19, 10],
        [20, 20],
        [17, 22],
        [15, 22],
        [12, 20],
      ],
      'plate',
    );
    battery(a, 13, 9, 6, 11, detail);
    a.polygon(
      [
        [12, 20],
        [16, 22],
        [20, 20],
        [19, 24],
        [13, 24],
      ],
      'amber',
    );
    a.rect(11, 22, 2, 4, 'frame');
    a.rect(19, 22, 2, 4, 'frame');
  }
  if (id === 'fiber') {
    plate(a, 11, 8, 10, 15);
    battery(a, 12, 9, 8, 11, detail);
    a.chamfer(9, 20, 14, 6, 'ink');
    a.rect(11, 21, 10, 4, 'cyan');
    a.rect(9, 20, 3, 6, 'metal');
    a.rect(21, 20, 3, 6, 'frame');
    for (let x = 13; x < 21; x += detail ? 1 : 2) a.rect(x, 21, 0.5, 4, 'frame');
    a.rect(12, 21, 8, 1, 'white');
  }
  if (id === 'impact') {
    plate(a, 11, 9, 10, 16);
    a.polygon(
      [
        [11, 7],
        [21, 7],
        [24, 11],
        [21, 17],
        [11, 17],
        [8, 11],
      ],
      'ink',
    );
    a.polygon(
      [
        [12, 8],
        [20, 8],
        [22, 11],
        [20, 15],
        [12, 15],
        [10, 11],
      ],
      'white',
    );
    a.polygon(
      [
        [13, 9],
        [19, 9],
        [20, 11],
        [18, 14],
        [14, 14],
        [12, 11],
      ],
      'plate',
    );
    battery(a, 12, 16, 8, 9, detail);
    a.rect(14, 12, 4, 2, 'cyan');
  }
  if (id === 'trapper') {
    plate(a, 11, 8, 10, 17);
    plate(a, 8, 11, 3, 14);
    plate(a, 21, 11, 3, 14);
    battery(a, 12, 9, 8, 6, detail);
    battery(a, 12, 19, 8, 6, detail);
    a.rect(13, 15, 6, 4, 'metal');
    a.rect(14, 16, 4, 2, 'cyan');
    a.rect(8, 14, 3, 1, 'white');
    a.rect(21, 14, 3, 1, 'white');
    a.rect(8, 21, 3, 1, 'amber');
    a.rect(21, 21, 3, 1, 'amber');
  }
  camera(a, detail, id === 'carrier' || id === 'impact');
  for (const { x, y } of hubs) a.motor(x, y);
  if (detail) {
    for (const [x, y] of [
      [12, 9],
      [19, 9],
      [12, 23],
      [19, 23],
    ]) {
      a.rect(x, y, 0.5, 0.5, 'white');
      a.rect(x + 0.5, y + 0.5, 0.5, 0.5, 'ink');
    }
  }
}
function track(a, x, y, w, h, detail) {
  a.chamfer(x, y, w, h, 'ink');
  a.rect(x + 1, y + 1, w - 2, h - 2, 'frame');
  for (let yy = y + 2; yy < y + h - 1; yy += 3) {
    a.rect(x + 1, yy, w - 2, 1, 'metal');
    if (detail) a.rect(x + 1, yy, w - 2, 0.5, 'light');
  }
}
function sensor(a, x, y, width = 6) {
  a.chamfer(x, y, width, 4, 'ink');
  a.rect(x + 1, y, width - 2, 1, 'light');
  a.rect(x + 1, y + 1, width - 2, 2, 'danger');
  a.rect(x + 1, y + 1, 1, 1, 'white');
}
function enemy(a, id, detail) {
  if (id === 'bouncer') {
    track(a, 5, 7, 6, 21, detail);
    track(a, 21, 7, 6, 21, detail);
    plate(a, 9, 9, 14, 17, 'metal');
    a.rect(10, 11, 12, 2, 'danger');
    a.chamfer(11, 12, 10, 10, 'ink', 2);
    a.chamfer(12, 13, 8, 8, 'frame', 2);
    a.rect(14, 3, 4, 12, 'ink');
    a.rect(15, 4, 2, 11, 'metal');
    a.rect(15, 4, 2, 2, 'white');
    sensor(a, 13, 15);
    a.rect(13, 24, 6, 1, 'danger');
  }
  if (id === 'border-patrol') {
    for (const [x, y] of [
      [8, 8],
      [24, 8],
      [8, 24],
      [24, 24],
    ])
      arm(a, x, y, detail);
    a.polygon(
      [
        [12, 7],
        [20, 7],
        [23, 12],
        [20, 25],
        [12, 25],
        [9, 12],
      ],
      'ink',
    );
    a.polygon(
      [
        [13, 8],
        [19, 8],
        [21, 12],
        [19, 23],
        [13, 23],
        [11, 12],
      ],
      'frame',
    );
    a.rect(12, 11, 8, 3, 'danger');
    a.rect(13, 18, 6, 3, 'danger');
    sensor(a, 13, 5);
    for (const [x, y] of [
      [0.25, 0.25],
      [0.75, 0.25],
      [0.25, 0.75],
      [0.75, 0.75],
    ]) {
      a.motor(x, y);
      a.rect(x * 32, y * 32, 1, 1, 'danger');
    }
    a.rect(15, 24, 2, 4, 'light');
  }
  if (id === 'contour-patrol') {
    for (const x of [5, 23]) for (const y of [8, 20]) track(a, x, y, 4, 7, detail);
    plate(a, 8, 5, 16, 23, 'frame');
    a.rect(10, 9, 12, 4, 'danger');
    a.rect(10, 14, 12, 8, 'plate');
    a.rect(11, 15, 10, 1, 'metal');
    a.rect(10, 24, 12, 2, 'light');
    sensor(a, 10, 5, 5);
    sensor(a, 17, 5, 5);
    if (detail) {
      a.rect(12, 18, 2, 2, 'green');
      a.rect(18, 18, 2, 2, 'metal');
    }
  }
  if (id === 'claimed-rover') {
    track(a, 5, 12, 6, 16, detail);
    track(a, 21, 12, 6, 16, detail);
    plate(a, 9, 10, 14, 15, 'earth');
    a.rect(9, 8, 3, 8, 'metal');
    a.rect(20, 8, 3, 8, 'metal');
    a.rect(8, 5, 4, 5, 'ink');
    a.rect(20, 5, 4, 5, 'ink');
    a.rect(8, 5, 2, 4, 'light');
    a.rect(22, 5, 2, 4, 'light');
    a.rect(11, 17, 10, 3, 'danger');
    sensor(a, 13, 9);
    a.rect(12, 23, 8, 1, 'green');
  }
  if (id === 'eroder') {
    track(a, 6, 15, 6, 13, detail);
    track(a, 20, 15, 6, 13, detail);
    plate(a, 10, 11, 12, 15, 'plate');
    a.rect(14, 8, 4, 10, 'metal');
    a.polygon(
      [
        [4, 5],
        [28, 5],
        [27, 12],
        [23, 14],
        [9, 14],
        [5, 12],
      ],
      'ink',
    );
    a.rect(6, 6, 20, 5, 'frame');
    for (let x = 6; x < 27; x += 4) {
      a.rect(x, 5, 2, 2, 'light');
      a.rect(x, 9, 2, 3, 'danger');
    }
    a.rect(8, 7, 16, 1, 'metal');
    sensor(a, 13, 16);
    a.rect(12, 23, 8, 2, 'danger');
  }
  if (id === 'lane-boss') {
    track(a, 3, 7, 6, 22, detail);
    track(a, 23, 7, 6, 22, detail);
    plate(a, 7, 7, 18, 22, 'metal');
    a.rect(9, 10, 14, 3, 'danger');
    a.rect(10, 14, 12, 11, 'plate');
    a.rect(11, 15, 10, 2, 'frame');
    a.rect(12, 18, 8, 5, 'ink');
    a.rect(13, 19, 6, 3, 'danger');
    for (const x of [10, 20]) {
      a.rect(x, 3, 2, 7, 'ink');
      a.rect(x, 3, 1, 6, 'light');
      a.rect(x - 1, 3, 3, 2, 'danger');
    }
    sensor(a, 13, 7);
    a.rect(9, 26, 14, 1, 'white');
  }
  if (id === 'relay-sentinel') {
    for (const [x, y] of [
      [6, 9],
      [24, 9],
      [6, 25],
      [24, 25],
    ]) {
      a.line(16, 19, x, y, 4, 'ink');
      a.line(16, 19, x, y, 2, 'metal');
      a.chamfer(x - 3, y - 2, 6, 5, 'ink');
      a.rect(x - 2, y - 1, 4, 3, 'danger');
    }
    a.chamfer(9, 11, 14, 18, 'ink', 3);
    a.chamfer(10, 12, 12, 15, 'frame', 3);
    a.polygon(
      [
        [7, 5],
        [10, 2],
        [22, 2],
        [25, 5],
        [24, 11],
        [21, 14],
        [11, 14],
        [8, 11],
      ],
      'ink',
    );
    a.polygon(
      [
        [9, 5],
        [11, 4],
        [21, 4],
        [23, 5],
        [22, 10],
        [20, 12],
        [12, 12],
        [10, 10],
      ],
      'metal',
    );
    a.polygon(
      [
        [11, 5],
        [21, 5],
        [21, 9],
        [19, 11],
        [13, 11],
        [11, 9],
      ],
      'plate',
    );
    a.rect(12, 6, 8, 2, 'danger');
    a.rect(15, 6, 2, 4, 'white');
    sensor(a, 13, 16);
    a.chamfer(12, 22, 8, 4, 'ink');
    a.rect(13, 23, 6, 2, 'danger');
  }
  if (detail) {
    for (const [x, y] of [
      [11, 10],
      [20, 10],
      [11, 24],
      [20, 24],
    ]) {
      a.rect(x, y, 0.5, 0.5, 'white');
      a.rect(x + 0.5, y + 0.5, 0.5, 0.5, 'ink');
    }
  }
}
function terrain(a, id) {
  a.rect(0, 0, 32, 32, 'shadow');
  if (id === 'wall') {
    a.rect(0, 0, 32, 32, 'plate');
    for (const [x, y, w, h] of [
      [0, 0, 18, 10],
      [20, 0, 12, 10],
      [0, 12, 10, 8],
      [12, 12, 20, 8],
      [0, 22, 22, 10],
      [24, 22, 8, 10],
    ]) {
      a.rect(x, y, w, h, 'frame');
      a.rect(x, y, w, 2, 'metal');
      a.rect(x, y, 2, h, 'light');
      a.rect(x + 2, y + h - 2, w - 2, 2, 'plate');
    }
  }
  if (id === 'slow') {
    a.rect(0, 0, 32, 32, 'earth');
    a.polygon(
      [
        [0, 4],
        [12, 4],
        [12, 10],
        [20, 10],
        [20, 20],
        [32, 20],
        [32, 30],
        [16, 30],
        [16, 24],
        [8, 24],
        [8, 14],
        [0, 14],
      ],
      'shadow',
    );
    a.rect(2, 6, 8, 2, 'metal');
    a.rect(14, 12, 4, 2, 'cyan');
    a.rect(18, 22, 10, 2, 'metal');
    a.rect(2, 20, 4, 2, 'green');
    a.rect(24, 8, 6, 2, 'green');
  }
  if (id === 'lethal') {
    a.rect(0, 0, 32, 32, 'plate');
    a.rect(0, 0, 32, 2, 'metal');
    a.rect(0, 30, 32, 2, 'metal');
    for (let x = -16; x < 40; x += 12)
      a.polygon(
        [
          [x, 2],
          [x + 6, 2],
          [x + 22, 30],
          [x + 16, 30],
        ],
        'danger',
      );
    a.rect(4, 12, 24, 8, 'ink');
    a.rect(7, 14, 18, 2, 'metal');
    a.rect(9, 17, 14, 1, 'light');
  }
}
function pickup(a, id) {
  if (id === 'life') {
    a.polygon(
      [
        [5, 7],
        [12, 7],
        [16, 11],
        [20, 7],
        [27, 7],
        [30, 11],
        [30, 17],
        [16, 29],
        [2, 17],
        [2, 11],
      ],
      'ink',
    );
    a.polygon(
      [
        [6, 9],
        [11, 9],
        [16, 14],
        [21, 9],
        [26, 9],
        [28, 12],
        [28, 16],
        [16, 26],
        [4, 16],
        [4, 12],
      ],
      'danger',
    );
    a.rect(7, 10, 4, 2, 'white');
    a.rect(5, 12, 2, 4, 'white');
  }
  if (id === 'speed') {
    for (const x of [1, 14]) {
      a.polygon(
        [
          [x, 5],
          [x + 7, 5],
          [x + 17, 16],
          [x + 7, 27],
          [x, 27],
          [x + 10, 16],
        ],
        'ink',
      );
      a.polygon(
        [
          [x + 3, 7],
          [x + 7, 7],
          [x + 15, 16],
          [x + 7, 25],
          [x + 3, 25],
          [x + 11, 16],
        ],
        'cyan',
      );
    }
    a.rect(5, 8, 2, 2, 'white');
  }
  if (id === 'slow') {
    a.rect(7, 4, 18, 4, 'ink');
    a.rect(8, 5, 16, 2, 'light');
    a.rect(7, 25, 18, 4, 'ink');
    a.rect(8, 26, 16, 2, 'light');
    a.polygon(
      [
        [8, 8],
        [24, 8],
        [23, 12],
        [18, 16],
        [23, 21],
        [24, 25],
        [8, 25],
        [9, 21],
        [14, 16],
        [9, 12],
      ],
      'ink',
    );
    a.polygon(
      [
        [11, 9],
        [21, 9],
        [20, 12],
        [16, 15],
        [12, 12],
      ],
      'amber',
    );
    a.polygon(
      [
        [16, 18],
        [22, 24],
        [10, 24],
      ],
      'amber',
    );
    a.rect(15, 15, 2, 5, 'white');
  }
  if (id === 'freeze') {
    for (const [x, y] of [
      [16, 3],
      [16, 29],
      [3, 16],
      [29, 16],
      [6, 6],
      [26, 26],
      [6, 26],
      [26, 6],
    ])
      a.line(16, 16, x, y, 4, 'ink');
    for (const [x, y] of [
      [16, 4],
      [16, 28],
      [4, 16],
      [28, 16],
      [7, 7],
      [25, 25],
      [7, 25],
      [25, 7],
    ])
      a.line(16, 16, x, y, 2, 'cyan');
    for (const [x, y] of [
      [16, 4],
      [4, 16],
      [28, 16],
      [16, 28],
    ])
      a.rect(x - 1, y - 1, 2, 2, 'white');
    a.chamfer(12, 12, 8, 8, 'white', 2);
    a.chamfer(14, 14, 4, 4, 'cyan');
  }
  if (id === 'objective') {
    a.polygon(
      [
        [16, 1],
        [30, 15],
        [30, 17],
        [16, 31],
        [2, 17],
        [2, 15],
      ],
      'ink',
    );
    a.polygon(
      [
        [16, 4],
        [28, 16],
        [16, 28],
        [4, 16],
      ],
      'cyan',
    );
    a.polygon(
      [
        [16, 8],
        [24, 16],
        [16, 24],
        [8, 16],
      ],
      'plate',
    );
    a.rect(14, 11, 4, 13, 'amber');
    a.rect(12, 9, 8, 4, 'white');
    a.rect(10, 23, 12, 2, 'ink');
  }
  if (id === 'supply') {
    a.chamfer(3, 6, 26, 23, 'ink', 2);
    a.rect(5, 8, 22, 18, 'earth');
    a.rect(5, 8, 22, 3, 'green');
    a.rect(7, 6, 4, 22, 'metal');
    a.rect(21, 6, 4, 22, 'metal');
    a.rect(4, 17, 24, 4, 'ink');
    a.rect(5, 17, 22, 2, 'amber');
    a.rect(13, 12, 6, 11, 'ink');
    a.rect(14, 13, 4, 9, 'white');
    a.rect(11, 16, 10, 3, 'white');
  }
}
export function pixelArtForSlot(
  slotId,
  { size = FIELD_KIT_SPRITE_SIZES[slotId], tokens = {} } = {},
) {
  if (!Object.hasOwn(FIELD_KIT_SPRITE_SIZES, slotId))
    throw new Error(`No authored Field Kit sprite for ${slotId}.`);
  if (!Number.isInteger(size) || size < 8 || size > 128)
    throw new Error('Sprite size must be an integer from 8 to 128.');
  const palette = { ...FIELD_KIT_COLORS };
  for (const [key, token] of Object.entries(tokenNames))
    if (Object.hasOwn(tokens, token)) {
      if (!/^#[a-f0-9]{6}$/i.test(tokens[token]))
        throw new Error(`Invalid sprite palette token ${token}.`);
      palette[key] = tokens[token];
    }
  const canvas = pixelCanvas(size, palette),
    [group, id] = slotId.split('.'),
    detail = size >= 64;
  if (group === 'player') player(canvas, id, detail);
  else if (group === 'enemy') enemy(canvas, id, detail);
  else if (group === 'terrain') terrain(canvas, id);
  else pickup(canvas, id);
  return { width: size, height: size, rgba: canvas.rgba };
}
