import { boundedJSON, dataIdentity, exactKeys, required } from '../data-json.mjs';
import { createOverflightTerrainFixture, overflightTerrainOpenPoint } from './terrain.mjs';
import {
  createOverflightLayoutPresentation,
  validateOverflightLayoutPresentation,
} from './world-layout-presentation.mjs';

export const OVERFLIGHT_WORLD_FORMAT = 'OverflightWorldPresentationV1';
export const OVERFLIGHT_WORLD_REVISION = 1;
export const OVERFLIGHT_WORLDS = Object.freeze([
  Object.freeze({
    id: 'field-crossing',
    title: { en: 'Field Crossing', uk: 'Польова переправа' },
    material: 'earth',
    palette: ['#202d24', '#313c2c', '#474633', '#656044'],
    signatures: ['crossing-front', 'shield-support'],
  }),
  Object.freeze({
    id: 'freight-depot',
    title: { en: 'Freight Depot', uk: 'Вантажне депо' },
    material: 'concrete',
    palette: ['#252f30', '#35403f', '#444a43', '#6a6751'],
    signatures: ['convoy-escort', 'courier-standoff'],
  }),
  Object.freeze({
    id: 'relay-ruins',
    title: { en: 'Relay Ruins', uk: 'Руїни ретранслятора' },
    material: 'damaged',
    palette: ['#202c30', '#303c40', '#46504b', '#667367'],
    signatures: ['brace-standoff', 'tank-support'],
  }),
  Object.freeze({
    id: 'river-port',
    title: { en: 'River Port', uk: 'Річковий порт' },
    material: 'timber',
    palette: ['#243234', '#354442', '#58655c', '#8a8970'],
    signatures: ['convoy-escort', 'courier-standoff'],
  }),
  Object.freeze({
    id: 'chalk-quarry',
    title: { en: 'Chalk Quarry', uk: 'Крейдяний кар’єр' },
    material: 'masonry',
    palette: ['#3b3c31', '#565846', '#797960', '#a2a084'],
    signatures: ['crossing-front', 'tank-support'],
  }),
  Object.freeze({
    id: 'orchard-strongpoint',
    title: { en: 'Orchard Strongpoint', uk: 'Садовий опорний пункт' },
    material: 'earth',
    palette: ['#2b3024', '#40462f', '#62683c', '#96824c'],
    signatures: ['shield-support', 'brace-standoff'],
  }),
]);
const byId = new Map(OVERFLIGHT_WORLDS.map((world) => [world.id, world]));
const materials = ['earth', 'concrete', 'damaged', 'timber', 'masonry', 'metal'];
export const OVERFLIGHT_LANDMARK_KINDS = Object.freeze([
  'road',
  'tracks',
  'rail',
  'foundation',
  'crater',
  'tree',
  'container',
  'antenna',
  'rubble',
]);
export const overflightWorldForEncounterSet = (set) =>
  ({ crossing: 'freight-depot', mixed: 'relay-ruins' })[set] ?? 'field-crossing';
export function overflightWorldDefinition(id) {
  return byId.get(id) ?? null;
}
const rect = (id, material, x, y, width, height) => ({ id, material, x, y, width, height });
const landmark = (id, kind, x, y, width, height) => ({ id, kind, x, y, width, height });

/** Presentation uses its own fixed layout, never the combat random stream. */
export function createOverflightWorldPresentation(
  world = 'field-crossing',
  arena = { width: 2880, height: 1080 },
  { layout } = {},
) {
  if (layout) return createOverflightLayoutPresentation(byId.get(world), arena, layout);
  required(byId.has(world), 'Unknown FPV Survivals world.');
  const regions = [],
    landmarks = [];
  if (world === 'field-crossing') {
    regions.push(
      rect('western-field', 'earth', 0, 80, 920, 920),
      rect('east-field', 'earth', 1660, 90, 1140, 870),
    );
    landmarks.push(
      landmark('crossroad', 'road', 0, 470, 2880, 132),
      landmark('north-track', 'tracks', 1200, 80, 94, 880),
    );
    for (let i = 0; i < 20; i++)
      landmarks.push(landmark(`shelter-${i}`, 'tree', 36 + i * 142, i % 2 ? 1012 : 16, 48, 48));
    for (let i = 0; i < 9; i++)
      landmarks.push(
        landmark(
          `shell-${i}`,
          'crater',
          180 + i * 301,
          190 + ((i * 137) % 670),
          44 + (i % 3) * 12,
          32,
        ),
      );
  } else if (world === 'freight-depot') {
    regions.push(
      rect('west-yard', 'concrete', 110, 190, 780, 700),
      rect('loading-yard', 'concrete', 1050, 150, 1530, 790),
      rect('service-strip', 'earth', 0, 960, 2880, 120),
    );
    landmarks.push(
      landmark('rail-north', 'rail', 0, 98, 2880, 48),
      landmark('rail-south', 'rail', 0, 929, 2880, 48),
      landmark('service-road', 'road', 80, 470, 2720, 105),
    );
    for (let i = 0; i < 14; i++)
      landmarks.push(
        landmark(`freight-${i}`, 'container', 110 + i * 196, i % 2 ? 1000 : 12, 116, 48),
      );
    for (let i = 0; i < 6; i++)
      landmarks.push(
        landmark(`loading-${i}`, 'foundation', 230 + i * 430, 245 + (i % 2) * 405, 100, 75),
      );
  } else if (world === 'relay-ruins') {
    regions.push(
      rect('west-plaza', 'damaged', 80, 90, 780, 850),
      rect('relay-ground', 'concrete', 1670, 160, 1040, 720),
    );
    landmarks.push(landmark('approach', 'road', 0, 475, 2880, 115));
    for (let i = 0; i < 12; i++)
      landmarks.push(
        landmark(
          `ruin-${i}`,
          'foundation',
          120 + (i % 6) * 450,
          190 + Math.floor(i / 6) * 560,
          160,
          120,
        ),
      );
    for (let i = 0; i < 5; i++)
      landmarks.push(landmark(`mast-${i}`, 'antenna', 220 + i * 530, i % 2 ? 1000 : 12, 60, 64));
    for (let i = 0; i < 12; i++)
      landmarks.push(landmark(`debris-${i}`, 'rubble', 95 + i * 231, 360 + (i % 2) * 320, 48, 32));
  } else {
    const definition = byId.get(world);
    regions.push(rect('work-ground', definition.material, 20, 130, 2840, 820));
    for (let i = 0; i < 12; i++)
      landmarks.push(
        landmark(
          `edge-${i}`,
          world === 'orchard-strongpoint'
            ? 'tree'
            : world === 'river-port'
              ? 'container'
              : 'rubble',
          80 + i * 230,
          i % 2 ? 1008 : 20,
          64,
          48,
        ),
      );
    for (let i = 0; i < 6; i++)
      landmarks.push(
        landmark(`court-${i}`, 'foundation', 120 + i * 450, 230 + (i % 2) * 450, 160, 100),
      );
  }

  const fit = (entry) => ({
    ...entry,
    x: Math.round((entry.x * arena.width) / 2880),
    y: Math.round((entry.y * arena.height) / 1080),
    width: Math.max(1, Math.round((entry.width * arena.width) / 2880)),
    height: Math.max(1, Math.round((entry.height * arena.height) / 1080)),
  });
  return {
    format: OVERFLIGHT_WORLD_FORMAT,
    world,
    revision: OVERFLIGHT_WORLD_REVISION,
    resource: { id: 'overflight-worlds', revision: 1 },
    regions: regions.map(fit),
    landmarks: landmarks.map(fit),
  };
}

/** Cosmetic ground for other modes. Their own walls, gameplay and cameras stay
 * authoritative. Retain the original three projections; new worlds reuse V2
 * materials and low props without painting false buildings or collision cover. */
export function createOverflightGroundPresentation(
  world = 'field-crossing',
  arena = { width: 2880, height: 1080 },
) {
  const recipes = {
    'river-port': {
      regions: [
        ['concrete', 0, 0, 2880, 1080],
        ['timber', 80, 100, 760, 880],
        ['metal', 1860, 220, 940, 640],
      ],
      paths: [
        [
          'road',
          72,
          [
            [160, 210],
            [2600, 210],
            [2600, 870],
            [600, 870],
          ],
        ],
        [
          'cable',
          8,
          [
            [850, 540],
            [1720, 540],
            [1720, 870],
          ],
        ],
      ],
      props: ['pipe', 'puddle'],
    },
    'chalk-quarry': {
      regions: [
        ['masonry', 0, 0, 2880, 1080],
        ['earth', 100, 700, 2160, 300],
        ['damaged', 1530, 70, 1260, 370],
      ],
      paths: [
        [
          'tracks',
          62,
          [
            [160, 850],
            [900, 290],
            [1760, 780],
            [2710, 220],
          ],
        ],
        [
          'tracks',
          42,
          [
            [170, 240],
            [1100, 770],
            [2040, 250],
          ],
        ],
      ],
      props: ['spoil', 'rubble'],
    },
    'orchard-strongpoint': {
      regions: [
        ['earth', 0, 0, 2880, 1080],
        ['timber', 130, 140, 1010, 220],
        ['damaged', 1730, 260, 1000, 590],
      ],
      paths: [
        [
          'irrigation',
          8,
          [
            [220, 210],
            [1540, 210],
            [1540, 520],
            [2670, 520],
          ],
        ],
        [
          'irrigation',
          8,
          [
            [210, 840],
            [1250, 840],
            [1250, 550],
            [350, 550],
          ],
        ],
      ],
      props: ['irrigation', 'glass'],
    },
  };
  const recipe = recipes[world];
  if (!recipe) {
    const legacy = createOverflightWorldPresentation(world, arena);
    legacy.landmarks = legacy.landmarks.filter(
      (item) => !['tree', 'container', 'antenna'].includes(item.kind),
    );
    return legacy;
  }
  const sx = arena.width / 2880,
    sy = arena.height / 1080;
  const regions = recipe.regions.map(([material, x, y, width, height], index) => ({
    id: `ground-${index}`,
    material,
    variant: index,
    x: x * sx,
    y: y * sy,
    width: width * sx,
    height: height * sy,
  }));
  const paths = recipe.paths.map(([kind, width, points], index) => ({
    id: `ground-path-${index}`,
    kind,
    width,
    points: points.map(([x, y]) => ({ x: x * sx, y: y * sy })),
  }));
  const landmarks = Array.from({ length: 8 }, (_, index) => ({
    id: `ground-detail-${index}`,
    kind: recipe.props[index % 2],
    x: (240 + index * 325) * sx,
    y: (index % 2 ? 680 : 350) * sy,
    width: 40 * sx,
    height: 28 * sy,
  }));
  return validateOverflightWorldPresentation(
    {
      format: 'OverflightWorldPresentationV2',
      world,
      revision: 2,
      resource: { id: 'overflight-worlds', revision: 2 },
      regions,
      paths,
      landmarks,
      assemblies: [],
    },
    arena,
  );
}

export function validateOverflightWorldPresentation(source, arena) {
  if (source?.format === 'OverflightWorldPresentationV2')
    return validateOverflightLayoutPresentation(source, arena, byId);
  const value = boundedJSON(source, {
    maxBytes: 24 * 1024,
    maxNodes: 1400,
    maxArray: 64,
    maxDepth: 5,
  });
  exactKeys(
    value,
    ['format', 'world', 'revision', 'resource', 'regions', 'landmarks'],
    'World presentation',
  );
  required(
    value.format === OVERFLIGHT_WORLD_FORMAT && byId.has(value.world) && value.revision === 1,
    'Unsupported world presentation.',
  );
  exactKeys(value.resource, ['id', 'revision'], 'World resource');
  required(
    value.resource.id === 'overflight-worlds' && value.resource.revision === 1,
    'Unsupported world resource reference.',
  );
  for (const [key, type, allowed] of [
    ['regions', 'material', materials],
    ['landmarks', 'kind', OVERFLIGHT_LANDMARK_KINDS],
  ]) {
    required(
      Array.isArray(value[key]) && value[key].length <= 64,
      'World layout exceeds its placement budget.',
    );
    const ids = new Set();
    for (const entry of value[key]) {
      exactKeys(entry, ['id', type, 'x', 'y', 'width', 'height'], 'World placement');
      required(
        typeof entry.id === 'string' && /^[a-z0-9-]{1,64}$/.test(entry.id) && !ids.has(entry.id),
        'World placement IDs must be unique.',
      );
      ids.add(entry.id);
      required(allowed.includes(entry[type]), 'Unknown world placement kind.');
      required(
        ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(entry[key])) &&
          entry.x >= 0 &&
          entry.y >= 0 &&
          entry.width > 0 &&
          entry.height > 0 &&
          entry.x + entry.width <= arena.width &&
          entry.y + entry.height <= arena.height,
        'World placement must fit its arena.',
      );
      if (['tree', 'container', 'antenna'].includes(entry.kind))
        required(
          entry.y + entry.height <= (150 * arena.height) / 1080 ||
            entry.y >= arena.height - (150 * arena.height) / 1080,
          'Tall decoration belongs at the perimeter of an open arena.',
        );
    }
  }
  return value;
}

/** Cosmetic edits never reset records. Legacy projects retain their exact hash. */
export function overflightGameplayIdentity(project) {
  const { presentation: _presentation, ...gameplay } = project;
  return dataIdentity(gameplay);
}
export function overflightPresentationIdentity(project) {
  return project.presentation ? dataIdentity(project.presentation) : 'legacy';
}
export function overflightWorldDependencies(project) {
  return {
    ...structuredClone(project.resources),
    ...(project.presentation ? { world: structuredClone(project.presentation.resource) } : {}),
  };
}

/** Authored combat changes are explicit; a Studio palette change uses only presentation. */
export function applyOverflightWorld(source, world, { encounters = true } = {}) {
  const project = structuredClone(source),
    definition = byId.get(world);
  required(
    definition && /V[34]$/.test(project.survivorFormat ?? project.format),
    'Worlds require current combat rules; upgrade a copy of this project first.',
  );
  project.presentation = createOverflightWorldPresentation(world, project.arena, {
    layout: project.battlefield,
  });
  if (!encounters) return project;
  if ((project.survivorFormat ?? project.format).endsWith('V4')) {
    // The battlefield's authored deck and routes are authoritative in the new rules.
    // Never replace their coordinated patterns with the legacy two-pattern loop.
    project.encounterProfile = `${world}.v2`;
    return project;
  }
  project.encounterProfile = `${world}.v1`;
  const raid = project.format.startsWith('OverflightHunt');
  project.id = `${raid ? 'raid' : 'survivor'}-${world}`;
  project.title = structuredClone(definition.title);
  if (raid) {
    for (const [sectorIndex, sector] of project.encounters.entries()) {
      for (const pack of sector.packs) {
        if (!pack.id.includes('escort')) continue;
        const shield =
          world === 'field-crossing'
            ? !pack.id.endsWith('wing')
            : world === 'relay-ruins'
              ? pack.id.endsWith('wing')
              : pack.behavior === 'shield';
        pack.family = shield ? 'shield-bearer' : 'brace-trooper';
        pack.behavior = shield ? 'shield' : 'brace';
      }
      if (world === 'freight-depot')
        for (const target of sector.objectives)
          if (target.behavior === 'vehicle') {
            target.route = [
              { x: Math.max(sectorIndex * 960 + 180, target.x - 160), y: target.y },
              { x: Math.min(sectorIndex * 960 + 860, target.x + 160), y: target.y },
            ];
            for (const wing of sector.packs.filter((pack) => pack.escortOf === target.id))
              wing.route = target.route.map((p) => ({
                x: p.x + wing.x - target.x,
                y: p.y + wing.y - target.y,
              }));
          }
    }
  } else {
    // Keep the opening six choices untouched. Late ranks remain earned without
    // the long 750→1150→1750 collection gaps seen in return-route builds.
    project.upgrades.thresholds = [12, 45, 100, 180, 300, 480, 700, 1000, 1400, 1900].slice(
      0,
      project.upgrades.choices,
    );
    let index = 0;
    for (const encounter of project.encounters) {
      if (encounter.pattern === 'relief') continue;
      const phase = index++;
      if (phase < 2) continue; // Preserve the low-pressure movement/escort lesson.
      const second = phase % 2;
      const patterns =
        world === 'field-crossing'
          ? ['crossing', 'armored']
          : world === 'freight-depot'
            ? ['crossing', 'flank']
            : ['flank', 'support'];
      const families =
        world === 'field-crossing'
          ? [
              ['patroller', 'runner', 'sprinter'],
              ['shield-bearer', 'patroller', 'relay-warden'],
            ]
          : world === 'freight-depot'
            ? [
                ['patroller', 'cargo-truck', 'armored-carrier'],
                // Ordinary fronts leave room for bounded standoff threats and
                // smaller fast courier groups; never make the entire crowd
                // 96-unit flankers merely by changing its world appearance.
                ['patroller', 'courier', 'radar-truck'],
              ]
            : [
                ['brace-trooper', 'patroller', 'radar-truck'],
                ['relay-warden', 'runner', 'tracked-tank'],
              ];
      encounter.pattern = patterns[second];
      encounter.families = families[second];
      // Existing arrival budgets and relief remain unchanged; no refill quotas.
    }
  }
  return project;
}

export function validateOverflightEncounterProfile(value) {
  required(
    OVERFLIGHT_WORLDS.some((world) => [`${world.id}.v1`, `${world.id}.v2`].includes(value)),
    'Unsupported authored world encounter profile.',
  );
  return value;
}

export function createExperimentalOverflightWorldProject(createProject, options = {}) {
  const project = createProject({
    ...options,
    rulesVersion: 3,
    world: 'freight-depot',
    encounterSet: 'crossing',
  });
  project.id += '-experimental-breach';
  project.title = { en: 'Depot Breach · Experimental', uk: 'Прорив депо · Експеримент' };
  project.terrain = createOverflightTerrainFixture(project.arena);
  // Author the same clear positions that native play accepts, so preview marks
  // never promise an objective or route waypoint inside solid cover.
  const clearPoint = (point, radius = 28) =>
    overflightTerrainOpenPoint(project.terrain, point.x, point.y, radius, project.arena);
  if (project.format === 'OverflightHuntProjectV3') {
    for (const encounter of project.encounters) {
      Object.assign(encounter.entry, clearPoint(encounter.entry));
      for (const actor of encounter.objectives) {
        const wings = encounter.packs
          .filter((pack) => pack.escortOf === actor.id)
          .map((pack) => ({
            pack,
            dx: pack.x - actor.x,
            dy: pack.y - actor.y,
          }));
        const radius = Math.max(28, ...wings.map(({ dx, dy }) => Math.hypot(dx, dy) + 28));
        Object.assign(actor, clearPoint(actor, radius));
        actor.route = actor.route.map((point) => clearPoint(point, radius));
        for (const { pack, dx, dy } of wings) {
          pack.x = actor.x + dx;
          pack.y = actor.y + dy;
          pack.route = actor.route.map((point) => ({ x: point.x + dx, y: point.y + dy }));
        }
      }
      for (const pack of encounter.packs.filter((pack) => !pack.escortOf)) {
        Object.assign(pack, clearPoint(pack));
        pack.route = pack.route.map((point) => clearPoint(point));
      }
    }
  }
  return project;
}
