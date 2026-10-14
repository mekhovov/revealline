import { boundedJSON, canonicalJSON, exactKeys, required } from '../data-json.mjs';
import {
  validateOverflightTerrain,
  overflightTerrainClear,
  overflightTerrainOpenPoint,
  createOverflightTerrain,
} from './terrain.mjs';

export const OVERFLIGHT_BATTLEFIELD_FORMAT = 'OverflightBattlefieldV1';
export const OVERFLIGHT_MOVEMENT_PRESETS = Object.freeze([
  'pursuit',
  'split-front',
  'committed-flank',
  'crosscut',
  'standoff',
  'screen-support',
  'convoy',
]);
const arena = Object.freeze({ width: 2880, height: 1080 });
const rows = [
  [
    'field-crossing',
    'broken-crossroads',
    'Broken Crossroads',
    'Розбиті перехрестя',
    [],
    [460, 550, 460],
  ],
  [
    'field-crossing',
    'shelterbelt-gaps',
    'Shelterbelt Gaps',
    'Проходи лісосмуг',
    [
      [540, 280, 160, 140],
      [1260, 660, 220, 140],
      [2060, 280, 220, 140],
    ],
    [620, 430, 620],
  ],
  [
    'field-crossing',
    'supply-orchard-edge',
    'Supply Orchard Edge',
    'Постачання біля саду',
    [
      [380, 280, 180, 140],
      [1060, 660, 180, 140],
      [1740, 280, 180, 140],
      [2420, 660, 180, 140],
    ],
    [560, 500, 560],
  ],
  [
    'freight-depot',
    'shunting-yard',
    'Shunting Yard',
    'Сортувальна станція',
    [[1240, 280, 320, 120]],
    [560, 600, 520],
  ],
  [
    'freight-depot',
    'loading-loop',
    'Loading Loop',
    'Вантажне кільце',
    [[1080, 400, 640, 280]],
    [540, 180, 540],
  ],
  [
    'freight-depot',
    'dispatch-junction',
    'Dispatch Junction',
    'Диспетчерський вузол',
    [
      [440, 280, 160, 140],
      [1360, 660, 160, 140],
      [2280, 280, 160, 140],
      [900, 450, 80, 140, true],
      [1840, 450, 80, 140, true],
    ],
    [620, 460, 620],
  ],
  [
    'relay-ruins',
    'antenna-court',
    'Antenna Court',
    'Антенний двір',
    [[1260, 660, 260, 120]],
    [430, 440, 430],
  ],
  [
    'relay-ruins',
    'split-compound',
    'Split Compound',
    'Розділений комплекс',
    [
      [760, 380, 420, 260],
      [1660, 380, 420, 260],
    ],
    [540, 540, 540],
  ],
  [
    'relay-ruins',
    'receiver-gardens',
    'Receiver Gardens',
    'Сади приймачів',
    [
      [360, 280, 200, 140],
      [1040, 660, 200, 140],
      [1720, 280, 200, 140],
      [2400, 660, 200, 140],
    ],
    [570, 500, 570],
  ],
  [
    'river-port',
    'pump-apron',
    'Pump Apron',
    'Насосний майданчик',
    [[1440, 280, 220, 120]],
    [620, 620, 620],
  ],
  [
    'river-port',
    'twin-docks',
    'Twin Docks',
    'Подвійні доки',
    [
      [720, 400, 380, 200],
      [1640, 400, 380, 200],
    ],
    [500, 500, 500],
  ],
  [
    'river-port',
    'floodgate-yard',
    'Floodgate Yard',
    'Шлюзовий двір',
    [
      [440, 280, 160, 140],
      [1360, 280, 160, 140],
      [2280, 280, 160, 140],
      [440, 660, 160, 140],
      [1360, 660, 160, 140],
      [2280, 660, 160, 140],
    ],
    [540, 540, 540],
  ],
  ['chalk-quarry', 'survey-basin', 'Survey Basin', 'Геодезичний котлован', [], [460, 600, 460]],
  [
    'chalk-quarry',
    'haul-switchbacks',
    'Haul Switchbacks',
    'Кар’єрний серпантин',
    [
      [480, 260, 220, 180],
      [1260, 640, 240, 180],
      [2060, 260, 220, 180],
    ],
    [640, 420, 640],
  ],
  [
    'chalk-quarry',
    'reclaimer-court',
    'Reclaimer Court',
    'Двір реклаймера',
    [
      [1160, 360, 480, 320],
      [440, 460, 120, 120],
      [2360, 460, 120, 120],
    ],
    [720, 180, 720],
  ],
  [
    'orchard-strongpoint',
    'harvest-clearing',
    'Harvest Clearing',
    'Жнивна галявина',
    [[760, 680, 240, 120]],
    [460, 460, 600],
  ],
  [
    'orchard-strongpoint',
    'irrigation-courts',
    'Irrigation Courts',
    'Зрошувальні двори',
    [
      [400, 280, 200, 140],
      [1120, 660, 200, 140],
      [1840, 280, 200, 140],
      [2520, 660, 120, 140],
    ],
    [600, 500, 600],
  ],
  [
    'orchard-strongpoint',
    'glasshouse-ruins',
    'Glasshouse Ruins',
    'Руїни теплиць',
    [
      [600, 380, 280, 260],
      [1320, 380, 280, 260],
      [2040, 380, 280, 260],
    ],
    [540, 180, 720],
  ],
];
export const OVERFLIGHT_BATTLEFIELDS = Object.freeze(
  rows.map(([world, slug, en, uk], index) =>
    Object.freeze({
      id: `${world}-${slug}`,
      world,
      title: Object.freeze({ en, uk }),
      kind: index % 3 === 0 ? 'open' : 'cover',
    }),
  ),
);
const definitions = new Map(
  OVERFLIGHT_BATTLEFIELDS.map((entry, index) => [entry.id, { ...entry, row: rows[index] }]),
);
export function overflightBattlefieldDefinition(id) {
  return OVERFLIGHT_BATTLEFIELDS.find((entry) => entry.id === id) ?? null;
}
const point = (x, y) => ({ x, y });

export function createOverflightBattlefield(id = OVERFLIGHT_BATTLEFIELDS[0].id) {
  const definition = definitions.get(id);
  required(definition, 'Unknown battlefield layout.');
  const [, , , , boxes, heights] = definition.row;
  const terrain = {
    format: 'OverflightTerrainV2',
    id,
    experimental: false,
    obstacles: boxes.map(([x, y, width, height, breakable = false], i) => ({
      id: `cover-${i + 1}`,
      x,
      y,
      width,
      height,
      breakable,
    })),
  };
  const courts = [480, 1440, 2400].map((x, i) => ({
    id: `court-${i + 1}`,
    ...overflightTerrainOpenPoint(terrain, x, heights[i], 124, arena),
  }));
  const index = OVERFLIGHT_BATTLEFIELDS.findIndex((entry) => entry.id === id);
  const authoredPaths = [
    [
      [
        [160, 180],
        [800, 380],
        [1440, 540],
        [2080, 700],
        [2720, 900],
      ],
      [
        [160, 900],
        [800, 700],
        [1440, 540],
        [2080, 380],
        [2720, 180],
      ],
    ],
    [
      [
        [160, 900],
        [860, 900],
        [860, 540],
        [1640, 540],
        [1640, 160],
        [2720, 160],
      ],
      [
        [160, 160],
        [860, 160],
        [860, 540],
        [1640, 540],
        [1640, 920],
        [2720, 920],
      ],
    ],
    [
      [
        [160, 160],
        [760, 160],
        [760, 540],
        [1440, 540],
        [2120, 540],
        [2120, 920],
        [2720, 920],
      ],
      [
        [160, 920],
        [760, 920],
        [760, 540],
        [2120, 540],
        [2120, 160],
        [2720, 160],
      ],
    ],
    [
      [
        [160, 540],
        [800, 540],
        [2080, 540],
        [2720, 540],
      ],
      [
        [160, 180],
        [1080, 180],
        [1080, 540],
        [1800, 540],
        [1800, 900],
        [2720, 900],
      ],
    ],
    [
      [
        [920, 280],
        [1880, 280],
        [1880, 800],
        [920, 800],
        [920, 280],
      ],
      [
        [160, 540],
        [920, 540],
        [920, 800],
        [1880, 800],
        [1880, 540],
        [2720, 540],
      ],
    ],
    [
      [
        [160, 180],
        [1120, 180],
        [1120, 540],
        [1640, 540],
        [1640, 900],
        [2720, 900],
      ],
      [
        [160, 900],
        [720, 900],
        [720, 180],
        [2080, 180],
        [2080, 900],
        [2720, 900],
      ],
    ],
    [
      [
        [160, 300],
        [720, 300],
        [1440, 520],
        [2160, 300],
        [2720, 300],
      ],
      [
        [160, 900],
        [1000, 900],
        [1000, 520],
        [1880, 520],
        [1880, 900],
        [2720, 900],
      ],
    ],
    [
      [
        [240, 540],
        [600, 540],
        [600, 220],
        [1440, 220],
        [1440, 800],
        [2280, 800],
        [2280, 540],
        [2640, 540],
      ],
      [
        [240, 540],
        [600, 540],
        [600, 800],
        [1440, 800],
        [1440, 220],
        [2280, 220],
        [2280, 540],
        [2640, 540],
      ],
    ],
    [
      [
        [160, 920],
        [800, 920],
        [800, 540],
        [1480, 540],
        [2160, 540],
        [2160, 160],
        [2720, 160],
      ],
      [
        [160, 160],
        [800, 160],
        [800, 540],
        [2160, 540],
        [2160, 920],
        [2720, 920],
      ],
    ],
    [
      [
        [160, 760],
        [960, 760],
        [1920, 760],
        [2720, 760],
      ],
      [
        [160, 160],
        [1120, 160],
        [1120, 540],
        [1920, 540],
        [1920, 160],
        [2720, 160],
      ],
    ],
    [
      [
        [160, 240],
        [1280, 240],
        [1280, 800],
        [2720, 800],
      ],
      [
        [160, 800],
        [1440, 800],
        [1440, 240],
        [2720, 240],
      ],
    ],
    [
      [
        [160, 540],
        [2720, 540],
      ],
      [
        [800, 160],
        [800, 920],
        [1920, 920],
        [1920, 160],
        [800, 160],
      ],
    ],
    [
      [
        [160, 540],
        [720, 260],
        [1440, 160],
        [2160, 260],
        [2720, 540],
        [2160, 820],
        [1440, 920],
        [720, 820],
      ],
      [
        [160, 540],
        [960, 540],
        [1440, 680],
        [1920, 540],
        [2720, 540],
      ],
    ],
    [
      [
        [160, 920],
        [900, 920],
        [900, 540],
        [1700, 540],
        [1700, 160],
        [2720, 160],
      ],
      [
        [160, 160],
        [900, 160],
        [900, 540],
        [1700, 540],
        [1700, 920],
        [2720, 920],
      ],
    ],
    [
      [
        [920, 200],
        [1880, 200],
        [1880, 880],
        [920, 880],
        [920, 200],
      ],
      [
        [160, 700],
        [760, 700],
        [760, 880],
        [2120, 880],
        [2120, 700],
        [2720, 700],
      ],
    ],
    [
      [
        [160, 260],
        [720, 260],
        [1440, 540],
        [2160, 260],
        [2720, 260],
      ],
      [
        [160, 920],
        [560, 920],
        [560, 540],
        [1200, 540],
        [1840, 820],
        [2720, 820],
      ],
    ],
    [
      [
        [160, 900],
        [840, 900],
        [840, 540],
        [1560, 540],
        [2280, 540],
        [2280, 160],
        [2720, 160],
      ],
      [
        [160, 160],
        [840, 160],
        [840, 540],
        [2280, 540],
        [2280, 920],
        [2720, 920],
      ],
    ],
    [
      [
        [160, 220],
        [1120, 220],
        [1120, 840],
        [1840, 840],
        [1840, 220],
        [2720, 220],
      ],
      [
        [160, 840],
        [400, 840],
        [400, 220],
        [1120, 220],
        [1120, 840],
        [2560, 840],
        [2560, 220],
        [2720, 220],
      ],
    ],
  ];
  const routes = authoredPaths[index].map((points, i) => ({
    id: `authored-route-${i + 1}`,
    points: points.map(([x, y]) => point(x, y)),
  }));
  const approaches = [
    point(80, 180),
    point(80, 900),
    point(2800, 180),
    point(2800, 900),
    point(960, 80),
    point(1920, 1000),
  ].map((p, i) => ({ id: `approach-${i + 1}`, ...p }));
  return validateOverflightBattlefield(
    {
      format: OVERFLIGHT_BATTLEFIELD_FORMAT,
      id,
      world: definition.world,
      revision: 1,
      arena: { ...arena },
      courts,
      approaches,
      routes,
      terrain,
    },
    arena,
  );
}

export function validateOverflightMovement(value, bounds) {
  exactKeys(
    value,
    ['preset', 'anchors', 'commitmentSeconds', 'formationWidth', 'coordinatedFraction'],
    'Movement profile',
  );
  required(OVERFLIGHT_MOVEMENT_PRESETS.includes(value.preset), 'Unsupported movement preset.');
  required(
    Array.isArray(value.anchors) && value.anchors.length <= 8,
    'Movement needs at most eight anchors.',
  );
  for (const p of value.anchors) {
    exactKeys(p, ['x', 'y'], 'Movement anchor');
    required(
      Number.isFinite(p.x) &&
        Number.isFinite(p.y) &&
        p.x >= 40 &&
        p.y >= 40 &&
        p.x <= bounds.width - 40 &&
        p.y <= bounds.height - 40,
      'Movement anchor must fit the battlefield.',
    );
  }
  for (const [key, min, max] of [
    ['commitmentSeconds', 1, 6],
    ['formationWidth', 48, 320],
    ['coordinatedFraction', 0, 0.3],
  ])
    required(
      Number.isFinite(value[key]) && value[key] >= min && value[key] <= max,
      `Invalid movement ${key}.`,
    );
  return value;
}

/** Shared graph proves usable body routes. Compilation never samples combat RNG. */
function routeReachable(terrain, from, to, bounds, radius = 28) {
  if (
    !overflightTerrainClear(terrain, from.x, from.y, from.x, from.y, radius) ||
    !overflightTerrainClear(terrain, to.x, to.y, to.x, to.y, radius)
  )
    return false;
  const edge = radius + 0.01;
  const points = [
    from,
    to,
    ...terrain.obstacles
      .filter((o) => o.active !== false)
      .flatMap((o) => [
        point(o.x - edge, o.y - edge),
        point(o.x + o.width + edge, o.y - edge),
        point(o.x - edge, o.y + o.height + edge),
        point(o.x + o.width + edge, o.y + o.height + edge),
      ])
      .filter(
        (p) =>
          p.x >= radius &&
          p.y >= radius &&
          p.x <= bounds.width - radius &&
          p.y <= bounds.height - radius &&
          overflightTerrainClear(terrain, p.x, p.y, p.x, p.y, radius),
      ),
  ];
  const seen = new Set([0]),
    queue = [0];
  for (let at = 0; at < queue.length; at++)
    for (let i = 1; i < points.length; i++) {
      if (
        seen.has(i) ||
        !overflightTerrainClear(
          terrain,
          points[queue[at]].x,
          points[queue[at]].y,
          points[i].x,
          points[i].y,
          radius,
        )
      )
        continue;
      if (i === 1) return true;
      seen.add(i);
      queue.push(i);
    }
  return false;
}

export function validateOverflightBattlefield(source, bounds = arena) {
  const value = boundedJSON(source, { maxBytes: 24576, maxNodes: 600, maxArray: 12, maxDepth: 7 });
  exactKeys(
    value,
    ['format', 'id', 'world', 'revision', 'arena', 'courts', 'approaches', 'routes', 'terrain'],
    'Battlefield layout',
  );
  required(
    value.format === OVERFLIGHT_BATTLEFIELD_FORMAT &&
      value.revision === 1 &&
      /^[a-z0-9-]{1,80}$/.test(value.id) &&
      rows.some((row) => row[0] === value.world),
    'Unsupported battlefield identity.',
  );
  exactKeys(value.arena, ['width', 'height'], 'Battlefield arena');
  required(
    value.arena.width === bounds.width &&
      value.arena.height === bounds.height &&
      bounds.width === arena.width &&
      bounds.height === arena.height,
    'Battlefield arena does not match its project.',
  );
  value.terrain = validateOverflightTerrain(value.terrain, bounds);
  required(
    value.terrain.format === 'OverflightTerrainV2' && value.terrain.id === value.id,
    'Battlefield terrain identity must match.',
  );
  required(
    value.courts?.length === 3 &&
      value.approaches?.length >= 4 &&
      value.approaches.length <= 8 &&
      value.routes?.length >= 2 &&
      value.routes.length <= 8,
    'Battlefield needs three courts, four to eight approaches and two to eight routes.',
  );
  const ids = new Set();
  const location = (p) =>
    required(
      Number.isFinite(p.x) &&
        Number.isFinite(p.y) &&
        p.x >= 40 &&
        p.y >= 40 &&
        p.x <= bounds.width - 40 &&
        p.y <= bounds.height - 40 &&
        overflightTerrainClear(value.terrain, p.x, p.y, p.x, p.y, 28),
      'Battlefield anchor must be clear of cover.',
    );
  for (const group of [value.courts, value.approaches, value.routes])
    for (const entry of group) {
      exactKeys(
        entry,
        group === value.routes ? ['id', 'points'] : ['id', 'x', 'y'],
        'Battlefield anchor',
      );
      required(
        typeof entry.id === 'string' && /^[a-z0-9-]{1,64}$/.test(entry.id) && !ids.has(entry.id),
        'Battlefield anchor identities must be unique.',
      );
      ids.add(entry.id);
      if (group === value.routes) {
        required(
          entry.points?.length >= 2 && entry.points.length <= 8,
          'Battlefield route needs two to eight points.',
        );
        for (const p of entry.points) {
          exactKeys(p, ['x', 'y'], 'Route point');
          location(p);
        }
      } else location(entry);
    }
  const terrain = createOverflightTerrain(value.terrain, bounds);
  // The two preserved perimeter circuits are joined through each court. Test
  // both north and south approaches at a 120-unit radius (240-unit passage).
  for (const court of value.courts)
    for (const y of [120, 960])
      required(
        routeReachable(terrain, court, { x: court.x, y }, bounds, 120),
        'Every combat court needs north and south 240-unit escape routes.',
      );
  return value;
}

const movement = (preset, anchors, fraction = 0.25) => ({
  preset,
  anchors: anchors.map(({ x, y }) => ({ x, y })),
  commitmentSeconds: 2,
  formationWidth: 160,
  coordinatedFraction: fraction,
});

/** Explicit author operation. Art is applied separately so it cannot change rules. */
export function applyOverflightBattlefield(source, id) {
  const project = structuredClone(source);
  if (project.battlefield?.id === id) return project;
  const previousCourts = project.battlefield?.courts;
  required(
    (project.survivorFormat ?? project.format).endsWith('V4'),
    'Battlefields require V4 rules; upgrade a copy first.',
  );
  const layout = createOverflightBattlefield(id);
  project.battlefield = layout;
  project.terrain = structuredClone(layout.terrain);
  project.id = `${project.format.startsWith('OverflightHunt') ? 'raid' : 'survivor'}-${id}`;
  project.title = structuredClone(overflightBattlefieldDefinition(id).title);
  const clear = (p, radius = 28) =>
    overflightTerrainOpenPoint(layout.terrain, p.x, p.y, radius, project.arena);
  project.props = [0, 2].map((i) => ({
    id: `case-${i}`,
    kind: 'supply-case',
    ...clear({ x: layout.courts[i].x, y: i ? 840 : 240 }, 100),
  }));
  const decks = {
    'field-crossing': [
      'split-front',
      'screen-support',
      'committed-flank',
      'crosscut',
      'standoff',
      'convoy',
    ],
    'freight-depot': [
      'convoy',
      'committed-flank',
      'split-front',
      'standoff',
      'screen-support',
      'crosscut',
    ],
    'relay-ruins': [
      'screen-support',
      'standoff',
      'committed-flank',
      'split-front',
      'convoy',
      'crosscut',
    ],
    'river-port': [
      'crosscut',
      'screen-support',
      'standoff',
      'convoy',
      'split-front',
      'committed-flank',
    ],
    'chalk-quarry': [
      'split-front',
      'crosscut',
      'convoy',
      'committed-flank',
      'screen-support',
      'standoff',
    ],
    'orchard-strongpoint': [
      'committed-flank',
      'crosscut',
      'split-front',
      'screen-support',
      'standoff',
      'convoy',
    ],
  };
  const presets = decks[layout.world];
  if (!project.format.startsWith('OverflightHunt')) {
    let phase = 0;
    for (const encounter of project.encounters) {
      const opening = phase < 2 || encounter.pattern === 'relief';
      encounter.movement = movement(
        opening ? 'pursuit' : presets[(phase - 2) % presets.length],
        layout.approaches,
        opening ? 0 : 0.25,
      );
      if (encounter.pattern !== 'relief') phase++;
    }
  } else
    for (const [index, encounter] of project.encounters.entries()) {
      const court = layout.courts[index];
      const previous = previousCourts?.[index] ?? { x: index * 960 + 480, y: 540 };
      const scaleX = previousCourts ? 1 : 0.76,
        scaleY = previousCourts ? 1 : 0.5;
      const shift = (p) =>
        clear(
          { x: court.x + (p.x - previous.x) * scaleX, y: court.y + (p.y - previous.y) * scaleY },
          100,
        );
      encounter.entry = clear({ x: court.x - 300, y: court.y }, 60);
      for (const target of encounter.objectives) {
        const escorts = encounter.packs
          .filter((pack) => pack.escortOf === target.id)
          .map((pack) => ({ pack, dx: pack.x - target.x, dy: pack.y - target.y }));
        const radius = Math.max(40, ...escorts.map(({ dx, dy }) => Math.hypot(dx, dy) + 90));
        Object.assign(target, clear(shift(target), radius));
        target.route = target.route.map((p) => clear(shift(p), radius));
        if (target.route.every((p) => p.x === target.route[0].x && p.y === target.route[0].y))
          target.route[1] = clear({ x: target.route[0].x + 120, y: target.route[0].y }, radius);
        target.movement = movement(
          target.behavior === 'vehicle' ? 'convoy' : 'committed-flank',
          target.route,
        );
        for (const { pack, dx, dy } of escorts) {
          pack.x = target.x + dx;
          pack.y = target.y + dy;
          pack.route = target.route.map((p) => ({ x: p.x + dx, y: p.y + dy }));
          pack.movement = movement('screen-support', pack.route);
        }
      }
      for (const [i, pack] of encounter.packs.filter((p) => !p.escortOf).entries()) {
        Object.assign(pack, shift(pack));
        pack.route = pack.route.map(shift);
        if (pack.route.every((p) => p.x === pack.route[0].x && p.y === pack.route[0].y))
          pack.route[1] = clear({ x: pack.route[0].x + 120, y: pack.route[0].y }, 100);
        pack.movement = movement(presets[i % 5], pack.route);
      }
    }
  return project;
}

export function validateOverflightBattlefieldProject(project) {
  const layout = validateOverflightBattlefield(project.battlefield, project.arena);
  required(
    canonicalJSON(layout.terrain) === canonicalJSON(project.terrain),
    'Battlefield snapshot and terrain must match.',
  );
  const terrain = createOverflightTerrain(project.terrain, project.arena);
  const profiles = project.format.startsWith('OverflightHunt')
    ? project.encounters.flatMap((e) => [...e.objectives, ...e.packs])
    : project.encounters;
  for (const entry of profiles)
    if (entry.movement) {
      validateOverflightMovement(entry.movement, project.arena);
      for (const p of entry.movement.anchors)
        required(
          overflightTerrainClear(terrain, p.x, p.y, p.x, p.y, 28),
          'Movement anchor overlaps cover.',
        );
    }
  if (project.format.startsWith('OverflightHunt'))
    for (const encounter of project.encounters) {
      for (const actor of [...encounter.objectives, ...encounter.packs]) {
        required(
          Array.isArray(actor.route) &&
            actor.route.length >= 2 &&
            actor.route.length <= 8 &&
            actor.route.some((p) => p.x !== actor.route[0].x || p.y !== actor.route[0].y),
          'Raid movement needs two to eight distinct route points.',
        );
        const radius = actor.count
          ? (Math.ceil(Math.sqrt(actor.count)) * actor.spacing) / 2 + 12
          : 28;
        for (const p of [actor, ...actor.route])
          required(
            overflightTerrainClear(terrain, p.x, p.y, p.x, p.y, radius),
            'Raid formation or route anchor overlaps cover.',
          );
        required(
          routeReachable(terrain, encounter.entry, actor, project.arena, 28),
          'Mandatory battlefield approach is unreachable.',
        );
      }
    }
  return layout;
}
