// Original tile interpretations of the sources listed in neon-mosaic/references.json.
export const CULTURAL_DESIGNS = [
  ['barvinok', 'Barvinok', 'five-petal periwinkle flowers on a curling branch'],
  ['wheat', 'Wheat Sheaf', 'three grain ears with paired kernels and a tied stalk'],
  ['vinok', 'Vinok', 'a floral wreath with flowing ribbons'],
  ['didukh', 'Didukh', 'a branched harvest sheaf tied above a spreading base'],
  ['rushnyk', 'Rushnyk', 'a hanging ritual textile with geometric embroidery and fringed ends'],
  ['bandura', 'Bandura', 'an asymmetric bandura body, neck and fan of strings'],
  ['trembita', 'Trembita', 'a long tapered Carpathian horn with a flared bell'],
  ['tsymbaly', 'Tsymbaly', 'a trapezoidal hammered dulcimer with strings and paired beaters'],
  [
    'kosiv-pitcher',
    'Kosiv Pitcher',
    'a handled ceramic pitcher with a floral ornament inspired by Kosiv',
  ],
  [
    'opishnia-ram',
    'Opishnia Ram',
    'a ceramic ram silhouette with a large curled horn inspired by Opishne toys',
  ],
  ['petrykivka', 'Petrykivka Flower', 'a fan-petalled flower with a curved stem and paired leaves'],
  ['oak', 'Oak and Acorns', 'lobed oak leaves and two capped acorns'],
  ['stork', 'Stork', 'a long-legged bird in profile with a pointed beak'],
  ['swallow', 'Swallow', 'a flying bird with swept wings and a forked tail'],
  ['horse', 'Pysanka Horse', 'a prancing horse in profile with mane and flowing tail'],
  ['deer', 'Pysanka Deer', 'a deer in profile with branching antlers'],
  ['fish', 'Pysanka Fish', 'a fish in profile with fins, scales and a split tail'],
  ['berehynia', 'Berehynia Motif', 'a geometric raised-arm figure inspired by pysanka motifs'],
  [
    'bezkonechnyk',
    'Bezkonechnyk',
    'a continuous closed meander inspired by pysanka eternity bands',
  ],
  [
    'ornek-tulip',
    'Crimean Tatar Ornek Tulip',
    'a tulip with curling paired leaves inspired by Crimean Tatar Ornek',
  ],
].map(([id, title, motif]) => ({ id, title, motif, symbol: id }));

export function drawCulturalMotif(id, { dot, box, line, diamond, ring }) {
  const path = (points, thick = 1) =>
    points.slice(1).forEach((p, i) => line(...points[i], ...p, thick));
  const leaf = (x, y, direction = 1) => {
    path([
      [x, y],
      [x + direction * 4, y - 3],
      [x + direction * 7, y - 3],
      [x + direction * 4, y],
      [x, y],
    ]);
  };
  const ear = (x, y) => {
    line(x, y, x, y + 8);
    for (let n = 1; n < 7; n += 2) {
      line(x, y + n, x - 2, y + n - 2);
      line(x, y + n, x + 2, y + n - 2);
    }
  };
  switch (id) {
    case 'barvinok':
      path([
        [23, 21],
        [29, 18],
        [35, 15],
        [42, 14],
        [47, 9],
      ]);
      for (const [x, y] of [
        [27, 9],
        [42, 8],
      ]) {
        for (let n = 0; n < 5; n++)
          diamond(
            Math.round(x + 4 * Math.cos((n * Math.PI * 2) / 5 - Math.PI / 2)),
            Math.round(y + 4 * Math.sin((n * Math.PI * 2) / 5 - Math.PI / 2)),
            2,
            true,
          );
        diamond(x, y, 1, true);
      }
      leaf(31, 18, -1);
      leaf(39, 19);
      break;
    case 'wheat':
    case 'didukh':
      for (const [x, y] of [
        [27, 9],
        [36, 4],
        [45, 9],
      ]) {
        ear(x, y);
        line(x, y + 8, 36, 19);
      }
      box(33, 18, 7, 2);
      for (const x of id === 'didukh' ? [28, 32, 36, 40, 44] : [32, 36, 40]) line(36, 19, x, 23);
      if (id === 'didukh') {
        ear(21, 11);
        ear(51, 11);
        line(21, 19, 36, 18);
        line(51, 19, 36, 18);
      }
      break;
    case 'vinok':
      ring(36, 11, 13, 7);
      for (const [x, y] of [
        [24, 8],
        [30, 5],
        [39, 4],
        [47, 8],
      ]) {
        diamond(x, y, 2, true);
        dot(x, y, 'B');
      }
      for (const [x, dx] of [
        [24, -3],
        [29, -1],
        [43, 1],
        [48, 3],
      ])
        path([
          [x, 16],
          [x + dx, 20],
          [x, 23],
        ]);
      break;
    case 'rushnyk':
      path([
        [23, 5],
        [23, 20],
        [29, 20],
        [29, 5],
        [43, 5],
        [43, 20],
        [49, 20],
        [49, 5],
      ]);
      for (const x of [26, 46]) {
        diamond(x, 10, 2);
        diamond(x, 16, 2);
        for (let xx = x - 3; xx <= x + 3; xx += 2) line(xx, 20, xx, 23);
      }
      line(23, 3, 49, 3);
      break;
    case 'bandura':
      path(
        [
          [32, 10],
          [34, 4],
          [39, 4],
          [38, 10],
          [44, 12],
          [46, 17],
          [44, 21],
          [39, 23],
          [30, 22],
          [26, 18],
          [27, 13],
          [32, 10],
        ],
        2,
      );
      for (let x = 30; x <= 42; x += 3) line(36, 8, x, 20);
      diamond(31, 15, 1, true);
      break;
    case 'trembita':
      path([
        [15, 6],
        [52, 17],
        [58, 16],
        [56, 23],
        [51, 20],
        [15, 7],
        [15, 6],
      ]);
      line(53, 18, 55, 21);
      break;
    case 'tsymbaly':
      path(
        [
          [24, 8],
          [48, 8],
          [55, 21],
          [17, 21],
          [24, 8],
        ],
        2,
      );
      for (let y = 11; y < 20; y += 3) line(25 - (y - 11) / 3, y, 47 + (y - 11) / 3, y);
      line(26, 4, 33, 10);
      line(46, 4, 39, 10);
      break;
    case 'kosiv-pitcher':
      path([
        [29, 4],
        [42, 4],
        [40, 7],
        [42, 11],
        [45, 16],
        [43, 21],
        [28, 21],
        [26, 16],
        [29, 10],
        [31, 7],
        [29, 4],
      ]);
      path(
        [
          [41, 8],
          [49, 8],
          [51, 11],
          [50, 16],
          [45, 18],
        ],
        2,
      );
      line(29, 22, 42, 22);
      diamond(35, 14, 3);
      line(35, 17, 35, 19);
      break;
    case 'opishnia-ram':
      path(
        [
          [26, 12],
          [43, 12],
          [46, 16],
          [43, 19],
          [27, 19],
          [24, 16],
          [26, 12],
        ],
        2,
      );
      ring(44, 9, 5, 5);
      path([
        [44, 6],
        [41, 8],
        [43, 11],
        [46, 9],
      ]);
      line(29, 19, 28, 23, 2);
      line(40, 19, 42, 23, 2);
      path([
        [24, 15],
        [20, 11],
        [21, 9],
      ]);
      break;
    case 'petrykivka':
      for (let n = 0; n < 7; n++) {
        const a = Math.PI + (n * Math.PI) / 6;
        line(36, 12, Math.round(36 + 11 * Math.cos(a)), Math.round(12 + 8 * Math.sin(a)), 2);
      }
      ring(36, 11, 4, 3);
      path([
        [36, 14],
        [39, 17],
        [36, 22],
        [32, 23],
      ]);
      leaf(38, 19);
      leaf(35, 19, -1);
      break;
    case 'oak':
      line(28, 22, 42, 6);
      for (const [x, y, s] of [
        [31, 18, -1],
        [35, 14, 1],
        [38, 10, -1],
      ]) {
        path([
          [x, y],
          [x + s * 4, y],
          [x + s * 7, y - 2],
          [x + s * 5, y - 3],
          [x + s * 7, y - 5],
          [x + s * 3, y - 4],
          [x, y],
        ]);
      }
      for (const [x, y] of [
        [45, 16],
        [25, 7],
      ]) {
        ring(x, y, 2, 3);
        box(x - 2, y - 2, 5, 1);
        line(x, y - 3, x + 2, y - 5);
      }
      break;
    case 'stork':
      path([
        [24, 13],
        [30, 10],
        [41, 12],
        [44, 9],
        [43, 5],
        [46, 4],
        [49, 6],
        [56, 7],
        [46, 7],
        [47, 11],
        [43, 16],
        [29, 17],
        [24, 13],
      ]);
      line(34, 17, 33, 23);
      path([
        [40, 17],
        [42, 21],
        [39, 23],
      ]);
      line(33, 23, 29, 23);
      path([
        [29, 12],
        [36, 15],
        [41, 14],
      ]);
      break;
    case 'swallow':
      path(
        [
          [36, 10],
          [23, 4],
          [29, 13],
          [34, 16],
          [28, 23],
          [36, 19],
          [44, 23],
          [38, 16],
          [44, 13],
          [49, 4],
          [36, 10],
        ],
        2,
      );
      box(35, 7, 3, 4);
      dot(38, 8);
      break;
    case 'horse':
    case 'deer':
      path(
        [
          [25, 12],
          [39, 12],
          [42, 7],
          [47, 8],
          [48, 11],
          [44, 11],
          [43, 17],
          [28, 17],
          [25, 12],
        ],
        2,
      );
      path(
        [
          [28, 17],
          [25, 22],
          [22, 22],
        ],
        2,
      );
      path(
        [
          [33, 17],
          [35, 22],
        ],
        2,
      );
      path(
        [
          [41, 17],
          [45, 20],
          [48, 18],
        ],
        2,
      );
      path(
        [
          [25, 13],
          [21, 9],
          [18, 11],
          [17, 15],
        ],
        2,
      );
      if (id === 'deer') {
        path([
          [44, 8],
          [42, 4],
          [39, 3],
        ]);
        path([
          [45, 8],
          [47, 4],
          [50, 3],
        ]);
        line(42, 4, 43, 2);
        line(47, 4, 46, 2);
      } else {
        path([
          [40, 8],
          [38, 10],
          [38, 13],
        ]);
        line(44, 7, 44, 5);
      }
      break;
    case 'fish':
      path(
        [
          [20, 13],
          [27, 8],
          [39, 7],
          [47, 11],
          [54, 7],
          [54, 20],
          [47, 16],
          [39, 20],
          [27, 18],
          [20, 13],
        ],
        2,
      );
      path([
        [31, 8],
        [34, 4],
        [39, 7],
      ]);
      path([
        [31, 19],
        [36, 23],
        [39, 20],
      ]);
      dot(25, 12, 'B');
      for (const x of [32, 39])
        path([
          [x, 10],
          [x + 2, 13],
          [x, 16],
        ]);
      break;
    case 'berehynia':
      diamond(36, 6, 2, true);
      line(36, 8, 36, 17, 2);
      for (const s of [-1, 1]) {
        path(
          [
            [36, 13],
            [36 + s * 7, 13],
            [36 + s * 7, 6],
            [36 + s * 11, 6],
            [36 + s * 11, 9],
          ],
          2,
        );
        line(36, 16, 36 + s * 8, 22, 2);
      }
      line(28, 22, 44, 22);
      break;
    case 'bezkonechnyk':
      path(
        [
          [16, 8],
          [23, 8],
          [23, 16],
          [29, 16],
          [29, 8],
          [36, 8],
          [36, 16],
          [43, 16],
          [43, 8],
          [50, 8],
          [50, 16],
          [56, 16],
          [56, 21],
          [16, 21],
          [16, 8],
        ],
        2,
      );
      break;
    case 'ornek-tulip':
      path([
        [29, 5],
        [33, 9],
        [36, 3],
        [39, 9],
        [43, 5],
        [42, 12],
        [39, 15],
        [33, 15],
        [30, 12],
        [29, 5],
      ]);
      line(36, 15, 36, 23);
      path([
        [36, 21],
        [27, 20],
        [24, 16],
        [26, 13],
        [30, 16],
        [29, 18],
        [36, 21],
      ]);
      path([
        [36, 21],
        [45, 20],
        [48, 16],
        [46, 13],
        [42, 16],
        [43, 18],
        [36, 21],
      ]);
      break;
    default:
      throw new Error(`Unknown cultural motif ${id}`);
  }
}

export function seededRandom(id) {
  let seed = 2166136261;
  for (const c of id) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619);
  return () => {
    seed = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    seed ^= seed + Math.imul(seed ^ (seed >>> 7), 61 | seed);
    return ((seed ^ (seed >>> 14)) >>> 0) / 4294967296;
  };
}

export const LOWER_FAMILIES = [
  'tidal coves',
  'stepping stones',
  'staggered terraces',
  'broken crescents',
  'slalom gates',
  'braided channels',
  'sparse archipelago',
  'sheltered harbours',
];
export function drawLowerLayout(design, index, { box, dot }) {
  const random = seededRandom(design.id);
  const family = (index * 3 + Math.floor(index / 8)) % LOWER_FAMILIES.length;
  box(2, 24, 68, 10, '.');
  const count = 3 + Math.floor(random() * 3);
  const targets = [];
  for (let i = 0; i < count; i++) {
    const x = 7 + Math.floor((i * 56) / count + random() * 4);
    const y = 26 + Math.floor(random() * 6);
    const w = 3 + Math.floor(random() * 4);
    // Sparse slow-water patches leave visible, traversable gaps between islands.
    if (family === 0 || family === 7) box(x - 2, 25, w + 6, 8, 'B');
    else if (family === 2) box(x - 2, y - 1, w + 3, 4, 'B');
    else if (family === 3) box(x - 2, y - 2, w + 3, 2, 'B');
    else if (family === 4) box(x - 1, 24, 3, 9, 'B');
    switch (family) {
      case 0:
        box(x, y, w, 2, 'S');
        box(x, y - 1, 2, 1, 'S');
        break;
      case 1:
        for (let d = -2; d <= 2; d++) box(x + 2 - Math.abs(d), y + d, 1 + Math.abs(d) * 2, 1, 'S');
        break;
      case 2:
        box(x, y, w, 1, 'S');
        box(x + 2, y + 1, w - 1, 1, 'S');
        box(x + 3, y + 2, 2, 1, 'S');
        break;
      case 3:
        box(x, y - 1, 1, 4, 'S');
        box(x + 1, y - 1, w, 1, 'S');
        box(x + 1, y + 2, w, 1, 'S');
        break;
      case 4:
        box(x, y - 1, 2, 4, 'S');
        box(x + w + 1, y + 1, 1, 2, 'W');
        break;
      case 5:
        box(x, y, w, 1, 'S');
        box(x + w - 1, y + 1, 1, 2, 'S');
        box(x + 1, y + 2, w - 2, 1, 'S');
        break;
      case 6:
        box(x, y, 2, 2, 'S');
        box(x + 4, y - 1, 2, 1, 'S');
        break;
      case 7:
        box(x, y - 1, 1, 4, 'S');
        box(x + 1, y + 2, w, 1, 'S');
        box(x + w, y, 1, 2, 'S');
        break;
    }
    if (i % 2 === 0 && family !== 4) dot(x - 2, y + 2, 'X');
    targets.push([x, y]);
  }
  return { targets, family: LOWER_FAMILIES[family] };
}

export const ARENA_FAMILIES = [
  'offset garden courts',
  'split riverbanks',
  'floating terraces',
  'open constellation',
  'alternating side bays',
  'broken spiral approach',
  'diagonal stepping fields',
  'twin flank corridors',
];
export function varyArena(cells, design, index) {
  const random = seededRandom(`${design.id}-arena`);
  // Preserve every foreground tile. Only the surrounding ground and unused margins change.
  const motif = [];
  for (let y = 1; y < 24; y++)
    for (let x = 1; x < 71; x++) {
      if (cells[y * 72 + x] === 'X') motif.push([x, y]);
      cells[y * 72 + x] = '.';
    }
  const shift = (index % 5) - 2;
  for (const [x, y] of motif) cells[y * 72 + x + shift] = 'X';
  const paint = (x, y, w, h, kind = 'B') => {
    for (let yy = y; yy < Math.min(24, y + h); yy++)
      for (let xx = x; xx < Math.min(70, x + w); xx++)
        if (xx >= 2 && yy >= 2 && cells[yy * 72 + xx] !== 'X') cells[yy * 72 + xx] = kind;
  };
  const family = index % 8,
    inset = 2 + Math.floor(random() * 3);
  switch (family) {
    case 0:
      for (let i = 0; i < 4; i++)
        paint(10 + i * 13, 4 + Math.floor(random() * 5), 9, 12 + Math.floor(random() * 5));
      break;
    case 1:
      paint(8, 3, 22, 20);
      paint(42, 5, 22, 18);
      paint(31, 10, 10, 5);
      break;
    case 2:
      for (let i = 0; i < 5; i++) paint(9 + i * 10, 3 + i * 3, 9, 6);
      break;
    case 3:
      for (let i = 0; i < 7; i++)
        paint(7 + i * 8, 4 + Math.floor(random() * 15), 5, 3 + Math.floor(random() * 4));
      break;
    case 4:
      for (let i = 0; i < 3; i++) {
        paint(8 + i * 18, 3, 11, 7);
        paint(15 + i * 17, 15, 9, 8);
      }
      break;
    case 5:
      paint(11, 3, 48, 4);
      paint(55, 7, 7, 13);
      paint(17, 19, 38, 4);
      paint(11, 10, 7, 9);
      paint(25, 11, 22, 4);
      break;
    case 6:
      for (let i = 0; i < 6; i++) paint(6 + i * 10, 3 + (i % 3) * 6, 8, 8);
      break;
    case 7:
      paint(7, 3, 12, 20);
      paint(53, 3, 12, 20);
      paint(26, 8, 20, 11);
      break;
  }
  // Marginal refuges and short gates are placed only where a two-tile clearance
  // preserves the full foreground silhouette, including text counters and antlers.
  const protectedAt = (x, y) =>
    motif.some(([mx, my]) => Math.abs(mx + shift - x) <= 2 && Math.abs(my - y) <= 2);
  const targets = [];
  for (let i = 0; i < 2 + (index % 3); i++) {
    const side = (i + index) % 2,
      x = side ? 65 : 3,
      y = 4 + i * 5 + Math.floor(random() * 3);
    const w = 2 + Math.floor(random() * 2),
      h = 2;
    if (
      Array.from({ length: w * h }, (_, n) => protectedAt(x + (n % w), y + Math.floor(n / w))).some(
        Boolean,
      )
    )
      continue;
    paint(x, y, w, h, 'S');
    targets.push([x, y]);
    if ((index + i) % 3 === 0) paint(side ? 69 : 2, y + 3, 1, 2, 'W');
  }
  // Different clear approach depths keep the outer rail accessible.
  for (let x = 2; x < 70; x++)
    for (let y = 2; y < inset; y++) if (cells[y * 72 + x] === 'B') cells[y * 72 + x] = '.';
  return { family: ARENA_FAMILIES[family], targets };
}
