import { boundedJSON, exactKeys, required } from '../data-json.mjs';
import {
  OVERFLIGHT_WORLD_ASSEMBLY_FAMILIES,
  OVERFLIGHT_WORLD_PROP_SLOTS,
} from '../presentation/overflight-world-slots.mjs';

export const OVERFLIGHT_WORLD_LAYOUT_FORMAT = 'OverflightWorldPresentationV2';
const materials = ['earth', 'concrete', 'damaged', 'timber', 'masonry', 'metal'];
export const OVERFLIGHT_WORLD_KITS = Object.freeze({
  'field-crossing': {
    scene: 'orchard',
    assemblies: ['shelter', 'planter'],
    materials: ['earth', 'damaged', 'timber'],
    props: ['tree', 'crater', 'pallet', 'tracks'],
    path: 'tracks',
  },
  'freight-depot': {
    scene: 'freight',
    assemblies: ['container', 'dispatch'],
    materials: ['concrete', 'metal', 'damaged'],
    props: ['pallet', 'barrel', 'wheel', 'cable'],
    path: 'rail',
  },
  'relay-ruins': {
    scene: 'relay',
    assemblies: ['antenna', 'receiver'],
    materials: ['damaged', 'masonry', 'concrete'],
    props: ['rubble', 'cable', 'puddle', 'antenna'],
    path: 'cable',
  },
  'river-port': {
    scene: 'harbor',
    assemblies: ['pump', 'floodgate'],
    materials: ['concrete', 'timber', 'metal'],
    props: ['bollard', 'pipe', 'timber-stack', 'puddle'],
    path: 'road',
  },
  'chalk-quarry': {
    scene: 'quarry',
    assemblies: ['terrace', 'reclaimer'],
    materials: ['masonry', 'earth', 'damaged'],
    props: ['spoil', 'conveyor', 'survey-post', 'rubble'],
    path: 'tracks',
  },
  'orchard-strongpoint': {
    scene: 'orchard',
    assemblies: ['glasshouse', 'irrigator'],
    materials: ['earth', 'timber', 'damaged'],
    props: ['crate', 'stump', 'irrigation', 'glass'],
    path: 'irrigation',
  },
});
const placement = (id, x, y, width, height, arena) => ({
  id,
  x: Math.max(0, Math.min(arena.width - width, Math.round(x))),
  y: Math.max(0, Math.min(arena.height - height, Math.round(y))),
  width,
  height,
});

/** Authored topology owns presentation placement, but never consumes combat RNG. */
export function createOverflightLayoutPresentation(world, arena, layout) {
  required(world && layout, 'World presentation needs a battlefield layout.');
  const kit = OVERFLIGHT_WORLD_KITS[world.id],
    regions = [],
    landmarks = [],
    assemblies = [],
    paths = [];
  required(
    kit && Array.isArray(layout.courts) && Array.isArray(layout.routes),
    'Battlefield presentation needs authored courts and routes.',
  );
  const sx = arena.width / 2880,
    sy = arena.height / 1080;
  regions.push({
    ...placement('base-material', 0, 0, arena.width, arena.height, arena),
    material: kit.materials[0],
    variant: 0,
  });
  for (const [index, court] of layout.courts.entries()) {
    const width = Math.min(arena.width, Math.round((index % 2 ? 600 : 740) * sx)),
      height = Math.min(arena.height, Math.round((index % 2 ? 440 : 500) * sy));
    regions.push({
      ...placement(
        `court-${index}`,
        court.x - width / 2,
        court.y - height / 2,
        width,
        height,
        arena,
      ),
      material: kit.materials[index % 3],
      variant: index % 4,
    });
    for (let prop = 0; prop < 4; prop++) {
      // Low, sparse landmarks are not collision islands. They stay outside the court center.
      const angle = index * 0.8 + (prop * Math.PI) / 2,
        kind = kit.props[prop],
        perimeter = kind === 'tree' || kind === 'antenna';
      landmarks.push({
        ...placement(
          `court-${index}-prop-${prop}`,
          court.x + Math.cos(angle) * width * 0.37,
          perimeter
            ? prop % 2
              ? arena.height - 56 * sy
              : 12 * sy
            : court.y + Math.sin(angle) * height * 0.37,
          40,
          28,
          arena,
        ),
        kind,
      });
    }
  }
  for (const [index, route] of layout.routes.entries())
    paths.push({
      id: `route-${index}`,
      kind: index === 0 ? 'road' : kit.path,
      width: index === 0 ? 80 : kit.path === 'rail' ? 38 : kit.path === 'tracks' ? 54 : 12,
      points: structuredClone(route.points),
    });
  for (const [index, obstacle] of (layout.terrain?.obstacles ?? []).entries()) {
    // Destructible cover remains dynamic. Never bake an intact barrier into ground.
    if (obstacle.breakable) continue;
    assemblies.push({
      ...placement(
        `cover-${index}`,
        obstacle.x,
        obstacle.y,
        obstacle.width,
        obstacle.height,
        arena,
      ),
      family: kit.assemblies[index % 2],
      coverId: obstacle.id,
    });
  }
  // Two distinct landmark assemblies remain recognizable even in the open layouts.
  for (let index = 0; index < 2; index++) {
    const width = Math.round(224 * sx),
      height = Math.round(84 * sy);
    assemblies.push({
      ...placement(
        `perimeter-${index}`,
        (index ? 2180 : 280) * sx,
        index ? arena.height - height : 0,
        width,
        height,
        arena,
      ),
      family: kit.assemblies[index],
      coverId: null,
    });
  }
  return {
    format: OVERFLIGHT_WORLD_LAYOUT_FORMAT,
    world: world.id,
    revision: 2,
    resource: { id: 'overflight-worlds', revision: 2 },
    regions,
    landmarks,
    paths,
    assemblies,
  };
}
const id = (value) => typeof value === 'string' && /^[a-z0-9-]{1,80}$/.test(value);
function fit(value, arena) {
  required(
    ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(value[key])) &&
      value.x >= 0 &&
      value.y >= 0 &&
      value.width > 0 &&
      value.height > 0 &&
      value.x + value.width <= arena.width &&
      value.y + value.height <= arena.height,
    'World placement must fit its arena.',
  );
}
function entries(value, key, maximum) {
  required(
    Array.isArray(value[key]) && value[key].length <= maximum,
    'World layout exceeds its placement budget.',
  );
  const seen = new Set();
  for (const entry of value[key]) {
    required(entry && id(entry.id) && !seen.has(entry.id), 'World placement IDs must be unique.');
    seen.add(entry.id);
  }
  return value[key];
}
export function validateOverflightLayoutPresentation(source, arena, worlds) {
  const value = boundedJSON(source, {
    maxBytes: 32 * 1024,
    maxNodes: 3000,
    maxArray: 64,
    maxDepth: 6,
  });
  exactKeys(
    value,
    ['format', 'world', 'revision', 'resource', 'regions', 'landmarks', 'paths', 'assemblies'],
    'World presentation',
  );
  required(
    value.format === OVERFLIGHT_WORLD_LAYOUT_FORMAT &&
      worlds.has(value.world) &&
      value.revision === 2,
    'Unsupported world presentation.',
  );
  exactKeys(value.resource, ['id', 'revision'], 'World resource');
  required(
    value.resource.id === 'overflight-worlds' && value.resource.revision === 2,
    'Unsupported world resource reference.',
  );
  for (const region of entries(value, 'regions', 32)) {
    exactKeys(
      region,
      ['id', 'x', 'y', 'width', 'height', 'material', 'variant'],
      'World material region',
    );
    required(
      materials.includes(region.material) &&
        Number.isInteger(region.variant) &&
        region.variant >= 0 &&
        region.variant <= 3,
      'Unknown world material variant.',
    );
    fit(region, arena);
  }
  for (const item of entries(value, 'landmarks', 64)) {
    exactKeys(item, ['id', 'x', 'y', 'width', 'height', 'kind'], 'World landmark');
    required(Object.hasOwn(OVERFLIGHT_WORLD_PROP_SLOTS, item.kind), 'Unknown world landmark.');
    fit(item, arena);
    if (['tree', 'container', 'antenna'].includes(item.kind))
      required(
        item.y + item.height <= (arena.height * 150) / 1080 ||
          item.y >= (arena.height * 930) / 1080,
        'Tall decoration belongs at the perimeter.',
      );
  }
  for (const path of entries(value, 'paths', 24)) {
    exactKeys(path, ['id', 'kind', 'width', 'points'], 'World path');
    required(
      ['road', 'tracks', 'rail', 'cable', 'irrigation'].includes(path.kind) &&
        Number.isFinite(path.width) &&
        path.width >= 4 &&
        path.width <= 160,
      'Unsupported world path.',
    );
    required(
      Array.isArray(path.points) && path.points.length >= 2 && path.points.length <= 32,
      'World path needs 2–32 points.',
    );
    for (const point of path.points) {
      exactKeys(point, ['x', 'y'], 'World path point');
      required(
        Number.isFinite(point.x) &&
          Number.isFinite(point.y) &&
          point.x >= 0 &&
          point.y >= 0 &&
          point.x <= arena.width &&
          point.y <= arena.height,
        'World path must fit its arena.',
      );
    }
  }
  for (const item of entries(value, 'assemblies', 24)) {
    exactKeys(item, ['id', 'x', 'y', 'width', 'height', 'family', 'coverId'], 'World assembly');
    required(
      OVERFLIGHT_WORLD_ASSEMBLY_FAMILIES.includes(item.family) &&
        (item.coverId === null || id(item.coverId)),
      'Unsupported world assembly.',
    );
    fit(item, arena);
    if (item.coverId === null)
      required(
        item.y + item.height <= (arena.height * 150) / 1080 ||
          item.y >= (arena.height * 930) / 1080,
        'Unbound tall assemblies belong at the perimeter.',
      );
  }
  return value;
}

/** A cosmetic edit may not invent solid-looking interior structures away from cover. */
export function validateOverflightPresentationCover(presentation, terrain) {
  if (presentation?.format !== OVERFLIGHT_WORLD_LAYOUT_FORMAT) return;
  for (const assembly of presentation.assemblies.filter((item) => item.coverId !== null)) {
    const obstacle = terrain?.obstacles.find((item) => item.id === assembly.coverId);
    required(
      obstacle &&
        !obstacle.breakable &&
        ['x', 'y', 'width', 'height'].every((key) => obstacle[key] === assembly[key]),
      'World assembly must match its permanent cover footprint.',
    );
  }
}

/** Editing cover changes only its matching cosmetic footprint. Accepted textures,
 * routes, props and existing assembly families survive the geometry edit. */
export function synchronizeOverflightPresentationCover(presentation, terrain) {
  const value = structuredClone(presentation);
  if (value?.format !== OVERFLIGHT_WORLD_LAYOUT_FORMAT) return value;
  const obstacles = (terrain?.obstacles ?? []).filter((item) => !item.breakable),
    byId = new Map(obstacles.map((item) => [item.id, item])),
    known = new Set();
  value.assemblies = value.assemblies.filter(
    (item) => item.coverId === null || byId.has(item.coverId),
  );
  for (const assembly of value.assemblies) {
    if (assembly.coverId === null) continue;
    const obstacle = byId.get(assembly.coverId);
    for (const key of ['x', 'y', 'width', 'height']) assembly[key] = obstacle[key];
    known.add(assembly.coverId);
  }
  const families = OVERFLIGHT_WORLD_KITS[value.world]?.assemblies ?? ['shelter', 'planter'];
  for (const [index, obstacle] of obstacles.entries()) {
    if (known.has(obstacle.id)) continue;
    let id = `cover-added-${index}`;
    while (value.assemblies.some((item) => item.id === id)) id += '-new';
    value.assemblies.push({
      id,
      x: obstacle.x,
      y: obstacle.y,
      width: obstacle.width,
      height: obstacle.height,
      family: families[index % families.length],
      coverId: obstacle.id,
    });
  }
  return value;
}
