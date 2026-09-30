import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { buildNeonChambers } from './build-neon-chambers.mjs';
import { buildNeonChannels } from './build-neon-channels.mjs';
import { buildNeonArrows } from './build-neon-arrows.mjs';
import { validateScenario } from '../game/content.mjs';
import { validatePack } from '../game/packs.mjs';

import {
  CULTURAL_DESIGNS,
  drawCulturalMotif,
  drawLowerLayout,
  varyArena,
  seededRandom,
} from './neon-cultural-motifs.mjs';

const root = new URL('../authoring/library/neon-mosaic/', import.meta.url);
const font = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  N: ['10001', '11001', '11001', '10101', '10011', '10011', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
};
export const MOSAIC_DESIGNS = [
  { id: 'fpv', title: 'FPV', lines: ['FPV'] },
  { id: 'ukraine', title: 'UKRAINE', lines: ['UKRAINE'] },
  { id: 'drone-aid', title: 'DRONE AID', lines: ['DRONE', 'AID'] },
  { id: 'coupa', title: 'COUPA', lines: ['COUPA'] },
  { id: 'social-drone', title: 'SOCIAL DRONE', lines: ['SOCIAL', 'DRONE'] },
  { id: 'sdua', title: 'SDUA', lines: ['SDUA'] },
  { id: 'victory-drones', title: 'VICTORY DRONES', lines: ['VICTORY', 'DRONES'] },
  { id: 'vd', title: 'VD', lines: ['VD'] },
  { id: 'fpv-line', title: 'FPV LINE', lines: ['FPV', 'LINE'] },
  { id: 'reveal', title: 'REVEAL', lines: ['REVEAL'] },
  { id: 'fly-free', title: 'FLY FREE', lines: ['FLY', 'FREE'] },
  {
    id: 'fpv-drone',
    title: 'FPV Drone',
    symbol: 'drone',
    motif:
      'a quadrotor silhouette with four circular rotors, a squashed-X frame, a camera and central fuselage',
  },
  {
    id: 'tryzub',
    title: 'Ukrainian Trident',
    symbol: 'tryzub',
    motif: 'a stylized Ukrainian tryzub with a central spear and interwoven side prongs',
  },
  {
    id: 'vyshyvanka',
    title: 'Vyshyvanka Diamonds',
    symbol: 'diamonds',
    motif: 'a vyshyvanka-inspired sequence of embroidered diamonds with cross-shaped centers',
  },
  {
    id: 'ruzha',
    title: 'Eight-Point Ruzha',
    symbol: 'ruzha',
    motif: 'an eight-point geometric rosette inspired by Ukrainian embroidery',
  },
  {
    id: 'kalyna',
    title: 'Kalyna',
    symbol: 'kalyna',
    motif: 'a kalyna branch with clustered berries and paired leaves',
  },
  {
    id: 'tree-of-life',
    title: 'Tree of Life',
    symbol: 'tree',
    motif: 'a branching tree-of-life motif inspired by Ukrainian embroidery',
  },
  {
    id: 'pysanka',
    title: 'Pysanka',
    symbol: 'pysanka',
    motif: 'a closed pysanka egg outline with a central diamond and staggered ornamental stitches',
  },
  ...CULTURAL_DESIGNS,
];

// Disjoint maximal row spans, merged vertically; also try the transposed grid.
function rectangles(cells, kind) {
  const sweep = (transpose) => {
    const result = [];
    let previous = new Map();
    const width = transpose ? 36 : 72,
      height = transpose ? 72 : 36;
    const at = (x, y) => cells[transpose ? x * 72 + y : y * 72 + x];
    for (let y = 0; y < height; y++) {
      const current = new Map();
      for (let x = 0; x < width; ) {
        if (at(x, y) !== kind) {
          x++;
          continue;
        }
        const start = x;
        while (x < width && at(x, y) === kind) x++;
        const key = `${start}:${x - start}`;
        const rect = previous.get(key) ?? { x: start, y, w: x - start, h: 0 };
        if (!rect.h) result.push(rect);
        rect.h++;
        current.set(key, rect);
      }
      previous = current;
    }
    return result.map((r) => (transpose ? { x: r.y, y: r.x, w: r.h, h: r.w } : r));
  };
  const greedy = (transpose) => {
    const w = transpose ? 36 : 72,
      h = transpose ? 72 : 36;
    const remaining = Array.from(
      { length: w * h },
      (_, i) => cells[transpose ? (i % w) * 72 + Math.floor(i / w) : i] === kind,
    );
    const result = [];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (remaining[y * w + x]) {
          let best = { w: 1, h: 1 },
            maxWidth = w - x;
          for (let yy = y; yy < h && remaining[yy * w + x]; yy++) {
            let width = 0;
            while (width < maxWidth && remaining[yy * w + x + width]) width++;
            maxWidth = width;
            if (width * (yy - y + 1) > best.w * best.h) best = { w: width, h: yy - y + 1 };
          }
          for (let yy = y; yy < y + best.h; yy++)
            for (let xx = x; xx < x + best.w; xx++) remaining[yy * w + xx] = false;
          result.push(transpose ? { x: y, y: x, w: best.h, h: best.w } : { x, y, ...best });
        }
    return result;
  };
  return [sweep(false), sweep(true), greedy(false), greedy(true)].sort(
    (a, b) => a.length - b.length,
  )[0];
}

function designCells(design, index) {
  const cells = Array(72 * 36).fill('.');
  const dot = (x, y, kind = 'X') => {
    if (x >= 1 && x < 71 && y >= 1 && y < 35) cells[y * 72 + x] = kind;
  };
  const box = (x, y, w, h, kind = 'X') => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) dot(xx, yy, kind);
  };
  const line = (x0, y0, x1, y1, thick = 1) => {
    const steps = Math.max(1, Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let n = 0; n <= steps; n++)
      box(
        Math.round(x0 + ((x1 - x0) * n) / steps),
        Math.round(y0 + ((y1 - y0) * n) / steps),
        thick,
        thick,
      );
  };
  const diamond = (cx, cy, r, solid = false) => {
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++) {
        const d = Math.abs(x - cx) + Math.abs(y - cy);
        if (solid ? d <= r : d === r) dot(x, y);
      }
  };
  const ring = (cx, cy, rx, ry) => {
    for (let y = cy - ry - 1; y <= cy + ry + 1; y++)
      for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (d >= 0.62 && d <= 1.35) dot(x, y);
      }
  };
  box(4, 3, 64, 29, 'B');
  if (design.lines) {
    const maxChars = Math.max(...design.lines.map((text) => text.length));
    const twoRows = design.lines.length > 1;
    const glyphWidth = maxChars > 5 ? 7 : 10;
    const glyphHeight = twoRows ? 7 : maxChars > 5 ? 11 : 14;
    const gap = maxChars > 5 ? 1 : 2;
    const totalHeight = design.lines.length * glyphHeight + (design.lines.length - 1) * 3;
    const y0 = 4 + Math.floor((19 - totalHeight) / 2);
    design.lines.forEach((text, row) => {
      const x0 = Math.floor((72 - (text.length * (glyphWidth + gap) - gap)) / 2);
      [...text].forEach((char, n) => {
        assert.ok(font[char], `Missing glyph ${char}`);
        for (let y = 0; y < glyphHeight; y++)
          for (let x = 0; x < glyphWidth; x++)
            if (
              font[char][Math.floor((y * 7) / glyphHeight)][Math.floor((x * 5) / glyphWidth)] ===
              '1'
            )
              dot(x0 + n * (glyphWidth + gap) + x, y0 + row * (glyphHeight + 3) + y);
      });
    });
  } else if (design.symbol === 'drone') {
    line(26, 8, 46, 19, 2);
    line(46, 8, 26, 19, 2);
    for (const x of [26, 46])
      for (const y of [8, 19]) {
        ring(x, y, 4, 4);
        dot(x, y);
        line(x, y, x, y - 2);
        line(x, y, x - 2, y + 1);
        line(x, y, x + 2, y + 1);
      }
    box(34, 9, 5, 10);
    box(35, 7, 3, 2);
    dot(36, 7, 'B');
    line(36, 19, 36, 22);
    box(35, 22, 3, 1);
  } else if (design.symbol === 'tryzub') {
    // Narrow spear, curved side hooks and open woven lower knot.
    dot(36, 3);
    box(35, 4, 3, 3);
    line(36, 7, 36, 12);
    for (const sign of [-1, 1]) {
      const x = (n) => 36 + sign * n;
      line(x(7), 6, x(7), 19);
      line(x(7), 6, x(5), 8);
      line(x(5), 8, x(4), 10);
      line(x(4), 10, x(3), 14);
      line(x(3), 14, x(5), 15);
      line(x(5), 15, x(5), 16);
      line(x(5), 16, x(4), 17);
      line(x(4), 17, 36, 18);
      line(36, 12, x(2), 16);
      line(x(2), 16, x(3), 19);
      line(x(3), 19, x(2), 21);
      line(x(2), 21, 36, 23);
    }
    line(29, 19, 43, 19);
    line(36, 18, 36, 23);
  } else if (design.symbol === 'diamonds') {
    for (const x of [16, 36, 56]) {
      diamond(x, 13, 7);
      diamond(x, 13, 2, true);
    }
  } else if (design.symbol === 'ruzha') {
    const star = (outer, inner, kind) => {
      const points = Array.from({ length: 16 }, (_, i) => {
        const a = (i * Math.PI) / 8 - Math.PI / 2,
          r = i % 2 ? inner : outer;
        return [36 + Math.cos(a) * r, 13 + Math.sin(a) * r];
      });
      for (let y = 3; y <= 23; y++)
        for (let x = 26; x <= 46; x++) {
          let inside = false;
          for (let i = 0, j = 15; i < 16; j = i++) {
            const [xi, yi] = points[i],
              [xj, yj] = points[j];
            if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
          }
          if (inside) dot(x, y, kind);
        }
    };
    star(10, 5.5, 'X');
    star(5, 2.7, 'B');
    diamond(36, 13, 1, true);
  } else if (design.symbol === 'kalyna') {
    line(34, 22, 39, 9, 2);
    for (const [x, y] of [
      [30, 7],
      [36, 6],
      [42, 7],
      [27, 11],
      [33, 11],
      [39, 11],
      [45, 11],
    ])
      diamond(x, y, 2, true);
    for (const sign of [-1, 1]) {
      line(36, 18, 36 + sign * 13, 15, 2);
      diamond(36 + sign * 10, 17, 3, true);
    }
  } else if (design.symbol === 'tree') {
    box(35, 7, 3, 15);
    diamond(36, 5, 2, true);
    for (const [y, reach] of [
      [10, 8],
      [15, 13],
      [20, 18],
    ])
      for (const sign of [-1, 1]) {
        line(36, y, 36 + sign * reach, y - 4, 2);
        line(36 + sign * reach, y - 4, 36 + sign * reach, y - 7);
        diamond(36 + sign * reach, y - 6, 2, true);
      }
    line(36, 19, 28, 22, 2);
    line(36, 19, 44, 22, 2);
  } else if (design.symbol === 'pysanka') {
    let previous = null;
    for (let y = 4; y <= 22; y++) {
      const t = (y - 4) / 18,
        radius = Math.round(11 * Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)) * (0.8 + 0.3 * t));
      if (previous !== null) {
        line(36 - previous, y - 1, 36 - radius, y);
        line(36 + previous, y - 1, 36 + radius, y);
      } else dot(36, y);
      previous = radius;
    }
    diamond(36, 13, 4);
    diamond(36, 13, 1, true);
    for (const x of [33, 39]) for (const y of [7, 19]) dot(x, y);
    for (const sign of [-1, 1])
      for (const y of [11, 15]) {
        dot(36 + sign * 7, y);
        dot(36 + sign * 8, y + 1);
      }
  } else drawCulturalMotif(design.symbol, { dot, box, line, diamond, ring });
  const arena = varyArena(cells, design, index);
  const lower = drawLowerLayout(design, index, { dot, box });
  lower.targets.push(...arena.targets);
  lower.arena = arena.family;
  return { cells, lower };
}

function islandPatrol(cells, id, tx, ty, clockwise) {
  const edges = [];
  for (let y = 1; y < 35; y++)
    for (let x = 1; x < 71; x++)
      if (cells[y * 72 + x] === 'S')
        for (const [side, dx, dy] of [
          ['north', 0, -1],
          ['east', 1, 0],
          ['south', 0, 1],
          ['west', -1, 0],
        ])
          if (!['S', 'W'].includes(cells[(y + dy) * 72 + x + dx]))
            edges.push({
              x: x + dx,
              y: y + dy,
              side: { north: 'south', south: 'north', east: 'west', west: 'east' }[side],
              dist: Math.hypot(x + dx * 0.5 - tx, y + dy * 0.5 - ty),
            });
  edges.sort((a, b) => a.dist - b.dist);
  const { x, y, side } = edges[0];
  return { id, type: 'contour-patrol', edge: { x, y, side }, clockwise, speed: 3, radius: 0.3 };
}

function makeBouncers(cells, id, count) {
  const random = seededRandom(`${id}-actors`);
  const result = [];
  for (let attempt = 0; result.length < count && attempt < 1000; attempt++) {
    const x = 5.5 + Math.floor(random() * 61),
      y = 3.5 + Math.floor(random() * 29);
    if (
      ['S', 'W'].includes(cells[Math.floor(y) * 72 + Math.floor(x)]) ||
      result.some((e) => Math.hypot(e.x - x, e.y - y) < 4)
    )
      continue;
    const angle = random() * Math.PI * 2,
      speed = 3.5 + random();
    result.push({
      id: `yellow-${result.length + 1}`,
      type: 'bouncer',
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 0.3,
    });
  }
  assert.equal(result.length, count, `${id}: valid enemy starts`);
  return result;
}

export async function buildNeonMosaic() {
  const [chambers, channels, arrows] = await Promise.all([
    buildNeonChambers(),
    buildNeonChannels(),
    buildNeonArrows(),
  ]);
  return MOSAIC_DESIGNS.map((design, index) => {
    const { cells, lower } = designCells(design, index),
      scenario = structuredClone(channels.scenario);
    scenario.visualOverrides = {
      ...chambers.scenario.visualOverrides,
      contour: structuredClone(chambers.scenario.visualOverrides.patrol),
      slowTerrain: channels.scenario.visualOverrides.slowTerrain,
      lethalTerrain: arrows.scenario.visualOverrides.lethalTerrain,
    };
    for (const [role, visual] of Object.entries(scenario.visualOverrides))
      visual.name = `Mosaic ${role}`;
    const terrain = [
      ...rectangles(cells, 'B').map((r) => ({ kind: 'slow', ...r })),
      ...rectangles(cells, 'X').map((r) => ({ kind: 'lethal', ...r })),
    ].map((r, i) => ({ id: `mosaic-${i + 1}`, ...r }));
    assert.ok(terrain.length <= 256, `${design.id}: ${terrain.length} terrain rectangles`);
    const level = {
      ...structuredClone(channels.scenario.level),
      id: `neon-${design.id}-reference`,
      name: `Neon ${design.title}`,
      spawn: { x: 36.5, y: 35.5 },
      walls: rectangles(cells, 'W'),
      foundations: rectangles(cells, 'S'),
      classic: {
        version: 'classic.v1',
        terrain,
        powerups: [],
        arcadeActions: { version: 'arcade-actions.v1' },
      },
      enemies: [
        ...makeBouncers(cells, design.id, 3 + (index % 3)),
        {
          id: 'cyan-top',
          type: 'border-patrol',
          x: 10.5 + (index % 49),
          y: 0.5,
          speed: 4.5,
          clockwise: true,
          radius: 0.35,
        },
        {
          id: 'cyan-right',
          type: 'border-patrol',
          x: 71.5,
          y: 3.5 + (index % 23),
          speed: 4.5,
          clockwise: false,
          radius: 0.35,
        },
        ...lower.targets.map(([x, y], i) =>
          islandPatrol(cells, `cyan-island-${i + 1}`, x, y, (i + index) % 2 === 0),
        ),
      ],
      metadata: {
        description: `${design.lines ? `Red pixel lettering spells ${design.title}` : `Red tiles form ${design.motif}`}. Blue ground slows the craft; red ground is lethal until captured. ${lower.arena[0].toUpperCase() + lower.arena.slice(1)} surround the motif, with ${lower.family} along the lower route. ${3 + (index % 3)} yellow bouncers, two outer patrols and ${lower.targets.length} island-contour patrols guard the field. No horizontal barrier bars. Start at bottom center and reveal 75%.`,
      },
    };
    scenario.level = level;
    const pack = {
      ...structuredClone(channels.pack),
      id: `neon-${design.id}-reference`,
      name: level.name,
      description: level.metadata.description,
      visualOverrides: scenario.visualOverrides,
      campaigns: [
        {
          version: 'xonix-campaign.v1',
          id: `neon-${design.id}`,
          revision: '1',
          title: level.name,
          themeId: 'retro',
          classIds: ['scout'],
          levels: [level],
        },
      ],
    };
    for (const result of [validateScenario(scenario), validatePack(pack)])
      assert.equal(result.valid, true, `${design.id}: ${result.errors.join('; ')}`);
    return { design, cells, scenario, pack };
  });
}

function svgBoard({ cells, scenario }, width = 720, height = 360) {
  const tiles = [];
  for (const [kind, color] of [
    ['B', '#294a91'],
    ['X', '#f34470'],
    ['S', '#5088a8'],
    ['W', '#36cbe0'],
  ])
    for (const r of rectangles(cells, kind))
      tiles.push(
        `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${color}" shape-rendering="crispEdges"/>`,
      );
  for (const e of scenario.level.enemies) {
    const x = e.x ?? e.edge.x + 0.5,
      y = e.y ?? e.edge.y + 0.5;
    tiles.push(
      `<circle cx="${x}" cy="${y}" r="${e.type === 'bouncer' ? 0.48 : 0.38}" fill="${e.type === 'bouncer' ? '#fff283' : '#69eeff'}"/>`,
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 36" width="${width}" height="${height}"><rect width="72" height="36" fill="#050911"/><rect x=".5" y=".5" width="71" height="35" fill="none" stroke="#397598" stroke-width=".16"/>${tiles.join('')}<path d="M36.5 34.9l.5.6-.5.5-.5-.5z" fill="#fff283"/></svg>`;
}

if (process.argv[1] && new URL(process.argv[1], 'file:').href === import.meta.url) {
  const sources = await buildNeonMosaic();
  await mkdir(root, { recursive: true });
  for (const source of sources) {
    const dir = new URL(`${source.design.id}/`, root);
    await mkdir(dir, { recursive: true });
    await writeFile(new URL('scenario.json', dir), JSON.stringify(source.scenario, null, 2) + '\n');
    await writeFile(new URL('preview.svg', dir), svgBoard(source));
  }
  await writeFile(new URL('designs.json', root), JSON.stringify(MOSAIC_DESIGNS, null, 2) + '\n');
  const cards = sources
    .map(
      ({ design }, i) =>
        `<article><a href="?level=${design.id}"><img src="${design.id}/preview.svg" alt="${design.title} level layout"/><span>${i + 1}. ${design.title}</span></a><button type="button" data-level="${design.id}">Play ${design.title}</button><a class="download" href="${design.id}/scenario.json" download>Editable level</a></article>`,
    )
    .join('\n');
  await writeFile(
    new URL('index.html', root),
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Neon Words & Symbols · RevealLine</title><style>:root{color-scheme:dark;font:16px/1.5 system-ui;background:#070b14;color:#dce9fa}body{max-width:1440px;margin:40px auto;padding:24px}h1{font-size:38px;color:#8bebff;margin:0}p{max-width:850px;color:#abbdd5}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:24px}article{background:#0e1728;border:1px solid #22364e;padding:14px;border-radius:12px}img{display:block;width:100%;height:auto}a{color:#99dcff;text-decoration:none}article span{display:block;font-size:20px;margin:12px 0}button{color:#08111b;background:#8bebff;border:0;padding:10px 16px;border-radius:6px;cursor:pointer;font:inherit;font-weight:600}.download{margin-left:14px;font-size:13px}#status{min-height:24px;color:#fff283}</style><h1>Neon Words & Symbols</h1><p>${sources.length} playable tile designs. Blue slows your craft; red is lethal until captured. Every arena has distinct terrain, side refuges, passages and enemy starts, plus varied lower routes. The main words and motifs remain intact. Cyan blocks are walls; filled islands are safe return surfaces. The long horizontal bars have been removed.</p><p>Included in Neon Words &amp; Symbols, levels #291–${290 + sources.length}. Reveal artwork and Ukrainian translation are deferred.</p><p id="status" role="status"></p><main class="grid">${cards}</main><script type="module" src="launch.mjs"></script></html>`,
  );
  const mini = sources
    .map((source, i) => {
      const x = (i % 3) * 740,
        y = Math.floor(i / 3) * 410;
      return `<g transform="translate(${x},${y})"><text x="10" y="26" fill="#dce9fa" font-family="sans-serif" font-size="23">${source.design.title}</text><g transform="translate(0,40)">${svgBoard(source)}</g></g>`;
    })
    .join('');
  await writeFile(
    new URL('overview.svg', root),
    `<svg xmlns="http://www.w3.org/2000/svg" width="2220" height="${Math.ceil(sources.length / 3) * 410}" viewBox="0 0 2220 ${Math.ceil(sources.length / 3) * 410}"><rect width="2220" height="${Math.ceil(sources.length / 3) * 410}" fill="#070b14"/>${mini}</svg>`,
  );
  console.log(
    sources
      .map(
        ({ design, scenario }) =>
          `${design.title}: ${scenario.level.classic.terrain.length} terrain rectangles, ${scenario.level.enemies.length} enemies`,
      )
      .join('\n'),
  );
}
