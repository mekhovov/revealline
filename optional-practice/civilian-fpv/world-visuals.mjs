import * as THREE from './vendor/three.module.js';
import {
  BUILTIN_SIM_VISUAL_COLLECTIONS,
  SIM_MATERIAL_ROLES,
  THEME_PROFILES,
  resolveSimVisualCollection,
  resolveSimThemeProfile,
} from './world-themes.mjs';
import { boundedJSON, exactKeys, required, stableId } from '../../game/data-json.mjs';
import { contrastRatio } from '../../game/presentation/theme-system.mjs';

const ADVENTURE_SURFACES = Object.freeze({
  coast: { floor: 'sand', color: 0xc2b38f, wall: 'concrete' },
  quarry: { floor: 'stone', color: 0x9a8264, wall: 'stone' },
  rooftops: { floor: 'asphalt', color: 0x414a55, wall: 'plaster' },
  orchard: { floor: 'grass', color: 0x6e835d, wall: 'wood' },
  'solar-farm': { floor: 'ballast', color: 0x97937a, wall: 'metal' },
  'rail-depot': { floor: 'ballast', color: 0x777773, wall: 'metal' },
});

const ORCHARD_PROFILE = JSON.stringify(
  THEME_PROFILES.find((profile) => profile.id === 'ukrainian'),
);
function canonicalOrchardTrees(course) {
  if (
    !/^adventure-orchard-0[1-5]$/.test(course.id ?? '') ||
    course.world?.id !== 'orchard' ||
    course.world?.style !== 'orchard' ||
    course.obstacles?.length !== 34 ||
    !['x', 'y', 'z'].every(
      (axis, index) =>
        course.bounds?.min?.[axis] === [-60000, 0, -60000][index] &&
        course.bounds?.max?.[axis] === [60000, 35000, 60000][index],
    ) ||
    !course.obstacles
      .filter((item) => !/^tree-/.test(item.id ?? ''))
      .every((item) => ['building-barn', 'rock-survey-plinth'].includes(item.id))
  )
    return false;
  const trees = (course.obstacles ?? []).filter((item) => /^tree-/.test(item.id ?? ''));
  return (
    trees.length === 32 &&
    new Set(trees.map((item) => item.id)).size === 32 &&
    trees.every((item) => {
      const id = /^tree-(trunk|canopy)-([0-3])-([0-3])$/.exec(item.id);
      if (!id || item.rotation !== undefined) return false;
      const x = [-36000, -18000, 18000, 36000][Number(id[2])],
        z = [-34000, -16000, 2000, 20000][Number(id[3])];
      if (id[1] === 'trunk')
        return (
          item.type === undefined &&
          ['x', 'y', 'z'].every(
            (axis, index) =>
              item.min?.[axis] === [x - 400, 0, z - 400][index] &&
              item.max?.[axis] === [x + 400, 5000, z + 400][index],
          )
        );
      const vertices = [
          x,
          8000,
          z,
          x - 3400,
          4800,
          z,
          x,
          4800,
          z - 3400,
          x + 3400,
          4800,
          z,
          x,
          4800,
          z + 3400,
          x,
          3000,
          z,
        ],
        indices = [0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1, 5, 2, 1, 5, 3, 2, 5, 4, 3, 5, 1, 4];
      return (
        item.type === 'trimesh' &&
        item.vertices?.length === vertices.length &&
        item.indices?.length === indices.length &&
        vertices.every((value, index) => item.vertices[index] === value) &&
        indices.every((value, index) => item.indices[index] === value)
      );
    })
  );
}

/** The six closed Quarry solids share one finish; creator variants stay generic. */
export function isQuarryStrataObstacle(obstacle) {
  const expected = {
    'rock-west-terrace': [22000, 7000, 76000],
    'rock-east-terrace': [22000, 9000, 76000],
    'rock-west-rim': [8000, 16000, 82000],
    'rock-east-rim': [8000, 19000, 82000],
    'rock-central-spire': [12000, 20000, 12000],
    'rock-landing-ledge': [8000, 5000, 8000],
  }[obstacle?.id];
  return Boolean(
    expected &&
      obstacle.type === undefined &&
      obstacle.rotation === undefined &&
      ['x', 'y', 'z'].every(
        (axis, index) =>
          Number.isFinite(obstacle.min?.[axis]) &&
          Number.isFinite(obstacle.max?.[axis]) &&
          obstacle.max[axis] - obstacle.min[axis] === expected[index],
      ),
  );
}

// Original procedural artwork. Textures are deterministic and entirely local;
// only authored obstacle geometry is placed inside the flyable volume.
export function themeForCourse(course, presentation) {
  return resolveSimThemeProfile(course, presentation).palette;
}
export function simCollectionIdForProfile(profile) {
  const { collection } = resolveSimVisualCollection({
    collectionId: profile?.id ?? 'authored',
    revision: profile?.revision ?? 'r1',
  });
  return collection.id === 'authored' ? null : collection.id;
}

/** Runtime cue legibility, independent of pinned model/material asset revisions. */
export function simObjectiveLabelStyle(profile) {
  if (!simCollectionIdForProfile(profile)) return null;
  const background = `#${profile.palette.wall.toString(16).padStart(6, '0')}`;
  const colors = ['#f1f9e8', '#101820'];
  let foreground = colors.reduce((best, color) =>
    contrastRatio(color, background) > contrastRatio(best, background) ? color : best,
  );
  if (contrastRatio(foreground, background) < 4.5)
    foreground =
      contrastRatio('#ffffff', background) > contrastRatio('#000000', background)
        ? '#ffffff'
        : '#000000';
  return { background, foreground };
}

/** Only the active cue grows; its original lower edge stays fixed above the opening. */
export function simObjectiveLabelLayout({
  baseSize,
  active,
  viewDepth,
  projectionY,
  viewportHeight,
}) {
  const base = Number.isFinite(baseSize) && baseSize > 0 ? baseSize : 0.72;
  const valid = [viewDepth, projectionY, viewportHeight].every(
    (value) => Number.isFinite(value) && value > 0,
  );
  const size =
    active && valid
      ? Math.max(base, Math.min(base * 2, (18 * 2 * viewDepth) / (projectionY * viewportHeight)))
      : base;
  return { size, centerY: base / (2 * size) };
}

/** Static objective brackets, not a replacement model or a larger gate opening.
 * The two contrasting strips sit wholly outside the existing 45 mm frame.
 * Geometry and paints are shared by every gate in this ownership group. */
export function createSimGateCueFactory(profile) {
  if (!simCollectionIdForProfile(profile)) return null;
  let shape, paints;
  return ({ axis, span, height }) => {
    if (
      !['x', 'z'].includes(axis) ||
      ![span, height].every((value) => Number.isFinite(value) && value > 0)
    )
      return null;
    shape ??= new THREE.BoxGeometry(1, 1, 1);
    paints ??= [0x101820, 0xf1f9e8].map(
      (color) =>
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 1,
          depthTest: true,
          depthWrite: false,
          toneMapped: false,
          fog: true,
        }),
    );
    const cue = new THREE.Group();
    cue.name = 'active-gate-corner-cue';
    cue.visible = false;
    const frameHalf = 0.045 / 2,
      strip = 0.06,
      across = Math.min(0.32, span / 4),
      vertical = Math.min(0.32, height / 4),
      transform = new THREE.Matrix4(),
      scale = new THREE.Vector3(),
      position = new THREE.Vector3(),
      rotation = new THREE.Quaternion();
    for (const [band, paint] of paints.entries()) {
      const batch = new THREE.InstancedMesh(shape, paint, 8);
      let index = 0;
      for (const side of [-1, 1])
        for (const top of [-1, 1]) {
          const outer = (band + 1) * strip,
            middle = (band + 0.5) * strip;
          for (const upright of [true, false]) {
            const width = upright ? strip : across + outer,
              tall = upright ? vertical + outer : strip,
              x = side * (span / 2 + frameHalf + (upright ? middle : (outer - across) / 2)),
              y = top * (height / 2 + frameHalf + (upright ? (outer - vertical) / 2 : middle));
            position.set(axis === 'z' ? x : 0, y, axis === 'z' ? 0 : x);
            scale.set(axis === 'z' ? width : 0.045, tall, axis === 'z' ? 0.045 : width);
            transform.compose(position, rotation, scale);
            batch.setMatrixAt(index++, transform);
          }
        }
      cue.add(batch);
    }
    return cue;
  };
}
function random(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}
function surfacePixels(kind, color, seed, size, pixel) {
  const data = new Uint8Array(size * size * 4),
    height = new Float32Array(size * size),
    normal = new Uint8Array(size * size * 4),
    properties = new Uint8Array(size * size * 4),
    rng = random(seed),
    base = new THREE.Color(color);
  const noise = (cells) => {
    const values = Float32Array.from({ length: cells * cells }, () => rng());
    return (u, v) => {
      const x = u * cells,
        y = v * cells,
        ix = Math.floor(x),
        iy = Math.floor(y),
        sx = x - ix,
        sy = y - iy,
        tx = sx * sx * (3 - 2 * sx),
        ty = sy * sy * (3 - 2 * sy),
        at = (dx, dy) => values[((iy + dy) % cells) * cells + ((ix + dx) % cells)];
      return (
        (at(0, 0) * (1 - tx) + at(1, 0) * tx) * (1 - ty) +
        (at(0, 1) * (1 - tx) + at(1, 1) * tx) * ty
      );
    };
  };
  const broad = noise(5),
    fine = noise(19);
  // Original 3×5 bay numerals share the storage surface atlas; no font, canvas
  // or separate decal texture is needed. Rows run from glyph top to bottom.
  const bayDigits = [
    '010110010010111',
    '110001010100111',
    '110001010001110',
    '101101111001001',
    '111100110001110',
    '011100110101010',
  ];
  const orchardBark = kind === 'orchard-bark',
    orchardLeaves = kind === 'orchard-foliage',
    woodlandSurface = kind === 'bark' || kind === 'forest-floor',
    earth = woodlandSurface ? new THREE.Color(0x695946).lerp(base, 0.3) : null,
    moss = woodlandSurface ? new THREE.Color(0x576747).lerp(base, 0.3) : null,
    pale = woodlandSurface ? new THREE.Color(0x92917b).lerp(base, 0.3) : null,
    leaf = kind === 'forest-floor' ? new THREE.Color(0x82735a).lerp(base, 0.3) : null;
  const quarryStone = kind === 'quarry-stone',
    quarryBeds = quarryStone
      ? Array.from({ length: size }, (_, x) =>
          [0.1, 0.23, 0.46, 0.58, 0.82].map((level, index) => {
            const u = x / size,
              phase = (index + 0.5) / 6;
            return [
              level + (broad(u, phase) - 0.5) * 0.095 + (fine(u, phase) - 0.5) * 0.018,
              Math.max(0, Math.min(1, (broad(u, (phase + 0.37) % 1) - 0.38) * 3)),
            ];
          }),
        )
      : null,
    quarryTones = quarryStone ? [-0.008, 0.018, -0.015, 0.025, -0.008, -0.008] : null,
    quarryFractures = quarryStone
      ? [
          [0.12, 0.06, 0.22, 0.24],
          [0.22, 0.24, 0.15, 0.46],
          [0.54, 0.39, 0.62, 0.59],
          [0.79, 0.72, 0.7, 0.97],
          [0.76, 0.85, 0.94, 0.88],
          [0.43, 0.13, 0.56, 0.29],
          [0.62, 0.59, 0.82, 0.63],
        ]
      : null;
  const meadow = kind === 'meadow-grass',
    soil = meadow ? new THREE.Color(0x75634b).lerp(base, 0.18) : null,
    dryGrass = meadow ? new THREE.Color(0xa49b68).lerp(base, 0.48) : null,
    tuftGrid = 24,
    tuftRandom = random(seed ^ 0xbb67ae85),
    tufts = meadow
      ? Array.from({ length: tuftGrid * tuftGrid }, () => {
          const angle = tuftRandom() * Math.PI * 2;
          return {
            x: 0.28 + tuftRandom() * 0.44,
            y: 0.28 + tuftRandom() * 0.44,
            cosine: Math.cos(angle),
            sine: Math.sin(angle),
            length: 0.14 + tuftRandom() * 0.1,
            shade: 0.85 + tuftRandom() * 0.3,
          };
        })
      : null;
  const branchScars = [
    [0.23, 0.32],
    [0.71, 0.69],
  ];
  const leafGrid = 18,
    leafRandom = random(seed ^ 0x6a09e667),
    leaves =
      kind === 'forest-floor' || kind === 'woodland-canopy' || orchardLeaves
        ? Array.from({ length: leafGrid * leafGrid }, (_, index) => {
            const angle = leafRandom() * Math.PI * 2,
              u = ((index % leafGrid) + 0.5) / leafGrid,
              v = (Math.floor(index / leafGrid) + 0.5) / leafGrid,
              // Litter gathers in irregular soil patches, with calm open moss
              // between them; a uniform scatter becomes distracting at flight height.
              density = Math.max(0, Math.min(0.6, (broad(u, v) - 0.38) * 2.2));
            return {
              x: 0.28 + leafRandom() * 0.44,
              y: 0.28 + leafRandom() * 0.44,
              cosine: Math.cos(angle),
              sine: Math.sin(angle),
              length: 0.14 + leafRandom() * 0.14,
              width: 0.06 + leafRandom() * 0.055,
              visible: leafRandom() < density,
              shade: 0.94 + leafRandom() * 0.08,
            };
          })
        : null;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / size,
        v = y / size,
        grain = rng(),
        tau = Math.PI * 2;
      let shade = 0.91 + grain * 0.16,
        relief = grain * 0.025,
        roughness = 0.86,
        red = base.r,
        green = base.g,
        blue = base.b;
      const patch = (broad(u, v) - 0.5) * 0.16,
        mottling = fine(u, v) - 0.5;
      if (kind === 'concrete') {
        const joint = (u * 2) % 1 < 0.007 || (v * 2) % 1 < 0.007;
        shade *= joint ? 0.8 : 1 + patch + mottling * 0.05 - (grain < 0.015 ? 0.1 : 0);
        relief += joint ? -0.075 : patch * 0.1;
        roughness = 0.76 + grain * 0.2;
      }
      if (kind === 'hangar-concrete') {
        // One six-metre slab, aligned to the facility's existing floor joints.
        // Broad wear changes roughness more than colour, keeping route cues quiet.
        const edge = Math.min(u, 1 - u, v, 1 - v),
          joint = edge < 0.004,
          lip = Math.max(0, 1 - edge / 0.035),
          wear = Math.max(0, broad(u, v) - 0.42),
          aggregate = grain < 0.025 ? 0.08 : 0;
        shade = joint ? 0.65 : 0.96 + patch * 0.7 + mottling * 0.025 - lip * 0.035 - aggregate;
        relief = joint ? -0.085 : mottling * 0.014 + grain * 0.008 - lip * 0.006;
        roughness = joint ? 0.98 : 0.88 - wear * 0.24 + grain * 0.055;
      }
      if (kind === 'garage-concrete') {
        // Six-metre concrete pours continue from the slope onto the upper deck.
        // Traction and runoff stay in the finish, never in collision geometry.
        const edge = Math.min(u, 1 - u, v, 1 - v),
          joint = edge < (pixel ? 0.014 : 0.005),
          runoff = Math.max(0, fine(u, 0.5) - 0.54),
          traction = Math.cos(v * tau * (pixel ? 16 : 48));
        shade = joint ? 0.76 : 0.97 + patch * 0.65 + mottling * 0.03 - runoff * 0.1;
        relief = joint ? -0.045 : mottling * 0.009 + traction * 0.003;
        roughness = joint ? 0.98 : 0.88 + grain * 0.06 - runoff * 0.08;
      }
      if (kind === 'stadium-concrete') {
        // Six by two metres: three precast facade panels, not floor slabs
        // stretched up a stand. Quiet runoff and aggregate retain a solid face.
        const across = (u * 3) % 1,
          edge = Math.min(across, 1 - across, v, 1 - v),
          joint = edge < 0.012,
          runoff = Math.max(0, fine(u, 0.35) - 0.5) * (1 - v) * 0.1;
        shade = joint ? 0.73 : 0.96 + patch * 0.5 + mottling * 0.025 - runoff;
        relief = joint ? -0.04 : mottling * 0.009 + grain * 0.004;
        roughness = joint ? 0.97 : 0.84 + grain * 0.07;
      }
      if (kind === 'painted-steel') {
        const column = Math.floor(u * 3),
          row = Math.floor(v * 3),
          panelU = (u * 3) % 1,
          panelV = (v * 3) % 1,
          seam = Math.min(panelU, 1 - panelU, panelV, 1 - panelV) < 0.012,
          panel = Math.sin(column * 17 + row * 31) * 0.026;
        // Six by three metres per tile: readable 2×1 m painted panels instead
        // of corrugation stretched across an entire hangar wall or ceiling beam.
        shade = seam ? 0.79 : 0.98 + panel + patch * 0.28 + mottling * 0.018;
        relief = seam ? -0.032 : mottling * 0.006;
        roughness = seam ? 0.86 : 0.57 + grain * 0.055 + broad(u, v) * 0.075;
      }
      if (kind === 'storage-steel') {
        // Left half: closed steel panels, never empty shelving or dark openings.
        // Right half: six restrained bay labels on the existing flush plates.
        if (u < 0.5) {
          const across = u * 2,
            frame = Math.min(across, 1 - across) < 0.035 || v < 0.07 || v > 0.93,
            joint =
              Math.abs(across - 0.5) < 0.012 ||
              Math.abs(v - 0.35) < 0.01 ||
              Math.abs(v - 0.65) < 0.01,
            handle = Math.abs(across - 0.46) < 0.025 && Math.abs(v - 0.49) < 0.012,
            fastener =
              Math.hypot(
                Math.min(Math.abs(across - 0.1), Math.abs(across - 0.9)),
                Math.min(Math.abs(v - 0.12), Math.abs(v - 0.88)),
              ) < 0.012;
          shade =
            0.99 +
            patch * 0.24 +
            mottling * 0.015 -
            (frame ? 0.16 : joint ? 0.13 : 0) +
            (handle ? 0.16 : 0) -
            (fastener ? 0.12 : 0);
          relief = (frame || joint ? -0.035 : 0) + (handle ? 0.015 : 0) + mottling * 0.003;
          roughness = 0.59 + grain * 0.035 + broad(u, v) * 0.045;
        } else {
          const cellX = Math.min(1, Math.floor((u - 0.5) * 4)),
            cellY = Math.min(2, Math.floor(v * 3)),
            x = (u - 0.5) * 4 - cellX,
            y = v * 3 - cellY,
            column = Math.floor(((x - 0.3) / 0.4) * 3),
            row = Math.floor(((0.8 - y) / 0.6) * 5),
            glyph =
              column >= 0 &&
              column < 3 &&
              row >= 0 &&
              row < 5 &&
              bayDigits[cellY * 2 + cellX][row * 3 + column] === '1';
          shade = glyph ? 2.1 : 0.75;
          relief = 0;
          roughness = 0.68;
        }
      }
      if (kind === 'rubber') {
        shade = 0.94 + patch * 0.35 + mottling * 0.08;
        relief = mottling * 0.014 + grain * 0.006;
        roughness = 0.94 + grain * 0.05;
      }
      if (kind === 'asphalt') {
        shade *= 0.94 + patch + mottling * 0.08;
        relief += grain * 0.03;
        roughness = 0.87 + grain * 0.12;
      }
      if (kind === 'sand') {
        shade *= 0.98 + patch + mottling * 0.025;
        relief += mottling * 0.012;
        roughness = 0.98;
      }
      if (kind === 'stone') {
        const seam = Math.abs(Math.sin(v * tau * 3 + broad(u, v) * 0.8));
        shade *= 0.95 + patch * 1.5 + mottling * 0.16 - (seam < 0.035 ? 0.12 : 0);
        relief += mottling * 0.09 - (seam < 0.035 ? 0.05 : 0);
        roughness = 0.92 + grain * 0.07;
      }
      if (quarryStone) {
        // Unequal mineral beds wander and fade along the six-metre tile.
        // Keep the original rock grain dominant; bedding is not a colour ramp.
        let bed = 0,
          layer = 0,
          fracture = 0;
        for (const [level, strength] of quarryBeds[x]) {
          if (v > level) layer++;
          bed = Math.max(bed, Math.max(0, 1 - Math.abs(v - level) / 0.005) * strength);
        }
        for (const [ax, ay, bx, by] of quarryFractures) {
          const dx = bx - ax,
            dy = by - ay,
            px = u + mottling * 0.006 - ax,
            py = v + patch * 0.05 - ay,
            along = Math.max(0, Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy)));
          fracture = Math.max(
            fracture,
            Math.max(0, 1 - Math.hypot(px - dx * along, py - dy * along) / 0.0045),
          );
        }
        shade =
          (0.91 + grain * 0.16) * (0.95 + patch * 1.5 + mottling * 0.16) +
          quarryTones[layer] -
          bed * 0.13 -
          fracture * 0.17;
        relief = grain * 0.025 + mottling * 0.09 - bed * 0.045 - fracture * 0.04;
        roughness = 0.92 + grain * 0.07;
      }
      if (kind === 'ballast') {
        shade *= 0.89 + patch + mottling * 0.24 + grain * 0.2;
        relief += mottling * 0.12;
        roughness = 0.98;
      }
      if (kind === 'foliage') {
        shade *= 0.93 + patch * 1.4 + mottling * 0.3;
        relief += mottling * 0.045;
        roughness = 0.95;
      }
      if (kind === 'woodland-canopy' || orchardLeaves) {
        // Original leaf clusters: broad shade carries at flight distance, while
        // scattered elliptical leaves and veins resolve only at close range.
        // Opaque, mipmapped maps preserve the established crown silhouette.
        const cellX = Math.floor(u * leafGrid),
          cellY = Math.floor(v * leafGrid),
          detail = leaves[cellY * leafGrid + cellX],
          dx = u * leafGrid - cellX - detail.x,
          dy = v * leafGrid - cellY - detail.y,
          along = (dx * detail.cosine + dy * detail.sine) / (detail.length * 1.7),
          across = (-dx * detail.sine + dy * detail.cosine) / (detail.width * 2.1),
          outline = along * along + across * across,
          blade = Math.max(0, Math.min(1, (1 - outline) * 5)),
          vein = Math.max(0, 1 - Math.abs(across) / 0.1) * blade;
        shade = 0.76 + broad(u, v) * 0.2 + mottling * 0.12 + blade * 0.14 - vein * 0.035;
        relief = mottling * 0.04 + blade * 0.025 - vein * 0.01;
        roughness = 0.88 + grain * 0.06;
        if (orchardLeaves) {
          // Opaque leaf groups carry restrained harvest warmth; the closed
          // crown and every route through the orchard keep their exact shape.
          const harvest = Math.max(0, Math.min(0.25, (broad((u + 0.31) % 1, v) - 0.57) * 1.8));
          red += harvest * 0.12;
          green += harvest * 0.05;
          blue -= harvest * 0.025;
          shade = 0.82 + broad(u, v) * 0.24 + mottling * 0.075 + blade * 0.1 - vein * 0.03;
          relief = mottling * 0.015 + blade * 0.018 - vein * 0.008;
        }
      }
      if (kind === 'solar') {
        const bus = (u * 12) % 1 < 0.022,
          joint = (u * 6) % 1 < 0.025 || (v * 8) % 1 < 0.025;
        shade *= joint ? 1.9 : bus ? 1.35 : 0.89 + patch * 0.3;
        relief = joint ? -0.025 : 0;
        roughness = joint ? 0.52 : 0.24;
      }
      if (kind === 'plaster') {
        shade *= 0.98 + patch * 0.4 + mottling * 0.035;
        relief += mottling * 0.02;
        roughness = 0.87 + grain * 0.1;
      }
      if (kind === 'paving') {
        const row = Math.floor(v * 6),
          column = Math.floor(u * 6 + (row % 2) * 0.5),
          joint = (v * 6) % 1 < 0.025 || (u * 6 + (row % 2) * 0.5) % 1 < 0.025;
        shade *= joint ? 0.75 : 0.93 + Math.sin(row * 17 + column * 31) * 0.045 + patch;
        relief += joint ? -0.055 : mottling * 0.02;
        roughness = 0.86 + grain * 0.12;
      }
      if (kind === 'metal') {
        const corrugation = Math.cos(u * tau * 8);
        shade *= 0.9 + corrugation * 0.085 + patch;
        relief += corrugation * 0.15;
        roughness = 0.42 + grain * 0.16 + Math.abs(patch);
      }
      if (kind === 'brick') {
        const row = Math.floor(v * 8),
          joint = (v * 8) % 1 < 0.06 || (u * 4 + (row % 2) * 0.5) % 1 < 0.027;
        shade *= joint ? 0.65 : 0.96 + 0.06 * Math.sin(row * 71 + Math.floor(u * 4) * 13);
        relief += joint ? -0.2 : 0.025;
      }
      if (kind === 'wood') {
        const vein = Math.sin(u * tau * 32 + Math.sin(v * tau * 2) * 2);
        shade *= 0.93 + vein * 0.055 + patch + mottling * 0.08;
        relief += vein * 0.025;
        roughness = 0.67 + grain * 0.17;
      }
      if (orchardBark) {
        // Upright, broken grain uses the existing four-metre projection.
        const line = u * 16 + Math.sin(v * tau) * 0.07 + (broad(u, v) - 0.5) * 0.14,
          fissure = Math.max(0, 1 - Math.abs(Math.sin(line * tau)) / 0.13);
        shade = 0.9 + patch * 0.6 + mottling * 0.1 - fissure * 0.18;
        relief = mottling * 0.025 - fissure * 0.09;
        roughness = 0.92 + grain * 0.045;
      }
      if (kind === 'bark') {
        // Coarse broken plates replace sawn-wood striping. V spans the entire
        // standing trunk, so root moss and branch scars never repeat up its height.
        const warp = Math.sin(v * tau * 3) * 0.17 + Math.sin(v * tau * 7) * 0.07 + mottling * 0.22,
          plate = u * 7 + warp,
          column = Math.floor(plate),
          across = plate - column,
          seam = Math.min(across, 1 - across),
          fissure = Math.max(0, 1 - seam / 0.085),
          rowPhase = v * 17 + column * 0.618 + broad(u, v) * 0.4,
          row = rowPhase - Math.floor(rowPhase),
          split = Math.max(0, 1 - row / 0.06) * (0.35 + broad(u, v) * 0.4),
          root = Math.max(0, 1 - v / (0.11 + broad(u, v) * 0.09)),
          lichen = Math.max(0, (broad((u + 0.23) % 1, v) - 0.58) * 1.8);
        let scar = 0;
        for (const [atU, atV] of branchScars) {
          const du = Math.min(Math.abs(u - atU), 1 - Math.abs(u - atU)) / 0.12,
            dv = (v - atV) / 0.035,
            radius = Math.hypot(du, dv);
          if (radius < 1.3) scar += (1 - radius / 1.3) * (0.55 + Math.sin(radius * 13) * 0.2);
        }
        shade = 0.92 + patch * 1.1 + mottling * 0.11 - fissure * 0.25 - split * 0.09 - scar * 0.17;
        relief = mottling * 0.07 - fissure * 0.22 - split * 0.065 - scar * 0.08;
        roughness = 0.88 + grain * 0.08;
        const mossMix = root * (0.28 + broad(u, v) * 0.4),
          lichenMix = Math.min(0.2, lichen) * (1 - root);
        red = base.r + (moss.r - base.r) * mossMix + (pale.r - base.r) * lichenMix;
        green = base.g + (moss.g - base.g) * mossMix + (pale.g - base.g) * lichenMix;
        blue = base.b + (moss.b - base.b) * mossMix + (pale.b - base.b) * lichenMix;
      }
      if (kind === 'forest-floor') {
        // Six-metre, seamless ground tile: broad moss/soil areas remain calm at
        // flight speed; scattered leaves supply close-range scale without geometry.
        const earthMix = Math.max(0, Math.min(1, (broad(u, v) - 0.28) * 2.2)),
          cellX = Math.floor(u * leafGrid),
          cellY = Math.floor(v * leafGrid),
          detail = leaves[cellY * leafGrid + cellX],
          dx = u * leafGrid - cellX - detail.x,
          dy = v * leafGrid - cellY - detail.y,
          along = (dx * detail.cosine + dy * detail.sine) / detail.length,
          across = (-dx * detail.sine + dy * detail.cosine) / detail.width,
          outline = along * along + across * across,
          leafMix = detail.visible ? Math.max(0, Math.min(1, (1 - outline) * 8)) * 0.42 : 0,
          vein = Math.max(0, 1 - Math.abs(across) / 0.12) * leafMix;
        red = moss.r + (earth.r - moss.r) * earthMix;
        green = moss.g + (earth.g - moss.g) * earthMix;
        blue = moss.b + (earth.b - moss.b) * earthMix;
        red += (leaf.r * detail.shade - red) * leafMix;
        green += (leaf.g * detail.shade - green) * leafMix;
        blue += (leaf.b * detail.shade - blue) * leafMix;
        shade = 0.94 + patch * 0.85 + mottling * 0.07 - vein * 0.045;
        relief = mottling * 0.025 + leafMix * 0.028 - vein * 0.009;
        roughness = 0.9 + grain * 0.08;
      }
      if (kind === 'grass') {
        // Isotropic patches and fine blades: no regular diagonal stripes or
        // high-frequency sine pattern that aliases into bands during flight.
        shade *= 0.97 + patch * 1.4 + mottling * 0.14;
        relief += mottling * 0.035 + grain * 0.018;
        roughness = 0.98;
      }
      if (meadow) {
        // One twelve-metre seamless tile. Quiet soil patches supply ground scale;
        // short, scattered blades stay within their jittered half-metre cells.
        // The independent seed leaves every other surface's pixels unchanged.
        const soilMix = Math.max(0, Math.min(0.72, (broad(u, v) - 0.5) * 2.4)),
          cellX = Math.floor(u * tuftGrid),
          cellY = Math.floor(v * tuftGrid),
          tuft = tufts[cellY * tuftGrid + cellX],
          dx = u * tuftGrid - cellX - tuft.x,
          dy = v * tuftGrid - cellY - tuft.y,
          along = (dx * tuft.cosine + dy * tuft.sine) / tuft.length,
          across = (dy * tuft.cosine - dx * tuft.sine) / 0.07,
          blade = Math.max(0, 1 - Math.abs(along)) * Math.max(0, 1 - Math.abs(across)),
          dryMix = blade * (1 - soilMix) * 0.3 * tuft.shade;
        red = base.r + (soil.r - base.r) * soilMix;
        green = base.g + (soil.g - base.g) * soilMix;
        blue = base.b + (soil.b - base.b) * soilMix;
        red += (dryGrass.r - red) * dryMix;
        green += (dryGrass.g - green) * dryMix;
        blue += (dryGrass.b - blue) * dryMix;
        shade = 0.94 + patch * 0.7 + mottling * 0.1 + grain * 0.055 + blade * 0.08;
        relief = mottling * 0.012 + grain * 0.006 + blade * 0.018 - soilMix * 0.012;
        roughness = 0.98 - soilMix * 0.12 + grain * 0.015;
      }
      if (kind === 'carbon') {
        const weave = (Math.floor(u * 24) + Math.floor(v * 24)) % 2;
        shade *= weave ? 0.65 : 1.2;
        relief += weave * 0.04;
        roughness = weave ? 0.58 : 0.42;
      }
      if (pixel) shade = Math.round(shade * 6) / 6;
      const at = (y * size + x) * 4;
      data[at] = Math.min(255, red * 255 * shade);
      data[at + 1] = Math.min(255, green * 255 * shade);
      data[at + 2] = Math.min(255, blue * 255 * shade);
      data[at + 3] = 255;
      height[y * size + x] = relief;
      properties[at] = Math.round(255 * (relief < -0.08 ? 0.86 : 1));
      properties[at + 1] = Math.round(255 * roughness);
      properties[at + 2] = kind === 'metal' ? 170 : 0;
      properties[at + 3] = 255;
    }
  const reliefScale =
    woodlandSurface || kind === 'woodland-canopy'
      ? size / 64
      : meadow || quarryStone || orchardBark || orchardLeaves
        ? size / 128
        : 2;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const at = (y * size + x) * 4;
      const dx =
        (height[y * size + ((x + 1) % size)] - height[y * size + ((x + size - 1) % size)]) *
        reliefScale;
      const dy =
        (height[((y + 1) % size) * size + x] - height[((y + size - 1) % size) * size + x]) *
        reliefScale;
      const length = Math.hypot(dx, dy, 1);
      normal[at] = Math.round(127.5 * (1 - dx / length));
      normal[at + 1] = Math.round(127.5 * (1 - dy / length));
      normal[at + 2] = Math.round(127.5 * (1 + 1 / length));
      normal[at + 3] = 255;
    }
  return [data, normal, properties];
}
function surfaceMaps(kind, color, { pixel = false, seed = 971 } = {}) {
  const surface = { kind, color, seed, pixel, size: 0, textures: [] };
  surface.textures = [0, 1, 2].map((index) => {
    const texture = new THREE.DataTexture();
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = pixel ? THREE.NearestFilter : THREE.LinearFilter;
    texture.minFilter = pixel ? THREE.NearestMipmapNearestFilter : THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    // Generated base colors are already linear. Normal/ORM are data, not colors.
    texture.colorSpace = index === 0 ? THREE.LinearSRGBColorSpace : THREE.NoColorSpace;
    texture.userData.surface = surface;
    if (kind === 'storage-steel')
      texture.name = `warehouse-storage-steel-${['albedo', 'normal', 'orm'][index]}`;
    if (kind === 'bark' || kind === 'forest-floor' || kind === 'woodland-canopy')
      texture.name = `woodland-${kind}-${['albedo', 'normal', 'orm'][index]}`;
    if (kind === 'meadow-grass')
      texture.name = `meadow-ground-${['albedo', 'normal', 'orm'][index]}`;
    return texture;
  });
  resizeSurface(surface, pixel ? 64 : 256, 1);
  return {
    map: surface.textures[0],
    normalMap: surface.textures[1],
    roughnessMap: surface.textures[2],
    aoMap: surface.textures[2],
  };
}
function resizeSurface(surface, size, anisotropy) {
  if (surface.size !== size) {
    const maps = surfacePixels(surface.kind, surface.color, surface.seed, size, surface.pixel);
    surface.textures.forEach((texture, index) => {
      // WebGL2 texture storage is immutable. Preserve material references, but
      // release its GPU allocation before changing width/height on a preset swap.
      if (surface.size) texture.dispose();
      texture.image = { data: maps[index], width: size, height: size };
      texture.needsUpdate = true;
    });
    surface.size = size;
  }
  for (const texture of surface.textures)
    if (texture.anisotropy !== anisotropy) {
      texture.anisotropy = anisotropy;
      texture.needsUpdate = true;
    }
}
export function setSurfaceQuality(materials, quality, maxAnisotropy = 1) {
  const surfaces = new Set();
  for (const paint of materials)
    for (const value of Object.values(paint))
      if (value?.isTexture && value.userData.surface) surfaces.add(value.userData.surface);
  for (const surface of surfaces)
    resizeSurface(
      surface,
      surface.pixel ? 64 : quality === 'high' ? 512 : quality === 'low' ? 128 : 256,
      surface.pixel
        ? 1
        : Math.min(maxAnisotropy, quality === 'high' ? 8 : quality === 'low' ? 1 : 4),
    );
}

/** Small local lighting probe. No network or scene-geometry dependency. */
export function createEnvironmentLight(
  renderer,
  { sky = 0xc5d7e4, ground = 0x535c54, indoor = false } = {},
) {
  const probe = new THREE.Scene();
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(30, 16, 8),
    new THREE.MeshBasicMaterial({ color: sky, side: THREE.BackSide }),
  );
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshBasicMaterial({ color: ground, side: THREE.DoubleSide }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -4;
  probe.add(shell, floor);
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(indoor ? 12 : 6, indoor ? 8 : 6),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color().setRGB(3, 2.8, 2.4),
      side: THREE.DoubleSide,
    }),
  );
  panel.position.set(-10, 12, 8);
  panel.lookAt(0, 0, 0);
  probe.add(panel);
  const generator = new THREE.PMREMGenerator(renderer);
  try {
    return generator.fromScene(probe, 0.12, 0.1, 80);
  } finally {
    generator.dispose();
    for (const object of [shell, floor, panel]) {
      object.geometry.dispose();
      object.material.dispose();
    }
  }
}

/** Persistent, non-gameplay dressing. Paint is flush with the floor; solid
 * silhouettes stay outside the entire flight volume, including larger lessons. */
function buildEnvironmentDressing({ course, world, material, bounds, theme, pixel, kit }) {
  const { min, max, width, depth, cx, cz } = bounds,
    environment = course.environment,
    natural = ['field', 'woodland', 'orchard'].includes(environment),
    adventure = ADVENTURE_SURFACES[environment];
  const group = new THREE.Group();
  group.name = 'environment-dressing';
  world.add(group);
  const batch = (name, geometry, rows, paint, solid = false) => {
    if (!rows.length) {
      geometry.dispose();
      return;
    }
    const instances = new THREE.InstancedMesh(geometry, paint, rows.length),
      transform = new THREE.Matrix4(),
      orientation = new THREE.Quaternion(),
      position = new THREE.Vector3(),
      scale = new THREE.Vector3();
    instances.name = name;
    instances.userData.presentationOnly = true;
    instances.userData.outsideFlightBounds = solid;
    rows.forEach(([x, y, z, sx, sy, sz], index) => {
      if (
        solid &&
        !(x + sx / 2 < min.x || x - sx / 2 > max.x || z + sz / 2 < min.z || z - sz / 2 > max.z)
      )
        throw new Error('Decorative scenery overlaps the flight volume');
      transform.compose(position.set(x, y, z), orientation, scale.set(sx, sy, sz));
      instances.setMatrixAt(index, transform);
    });
    instances.instanceMatrix.needsUpdate = true;
    instances.computeBoundingSphere();
    instances.receiveShadow = true;
    // Exterior dressing does not cast new shadows across gameplay sight lines.
    instances.castShadow = false;
    group.add(instances);
  };
  const marks = [],
    secondary = [],
    joints = [];
  const rectangle = (rows, x, z, w, d) => rows.push([x, min.y + 0.018, z, w, 1, d]);
  const outline = (rows, x, z, w, d, thickness = 0.06) => {
    for (const side of [-1, 1]) {
      rectangle(rows, x, z + (side * d) / 2, w, thickness);
      rectangle(rows, x + (side * w) / 2, z, thickness, d);
    }
  };
  const paint = (color, opacity = 0.62) =>
    material(color, {
      roughness: 0.96,
      transparent: true,
      opacity,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
  const digit = (value, x, z, size = 1) => {
    const segments = ['abcedf', 'bc', 'abged', 'abgcd', 'fgbc'];
    for (const segment of segments[value] ?? '') {
      const [dx, dz, w, d] = {
        a: [0, -0.5, 0.55, 0.065],
        b: [0.275, -0.25, 0.065, 0.48],
        c: [0.275, 0.25, 0.065, 0.48],
        d: [0, 0.5, 0.55, 0.065],
        e: [-0.275, 0.25, 0.065, 0.48],
        f: [-0.275, -0.25, 0.065, 0.48],
        g: [0, 0, 0.55, 0.065],
      }[segment];
      rectangle(secondary, x + dx * size, z + dz * size, w * size, d * size);
    }
  };
  if (adventure) {
    const groundBatch = (name, rows, color, extras = {}) =>
      batch(
        name,
        new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
        rows,
        material(color, { roughness: 1, ...extras }),
      );
    const exterior = (name, rows, color, geometry = new THREE.BoxGeometry(1, 1, 1), extras = {}) =>
      batch(name, geometry, rows, material(color, { roughness: 0.86, ...extras }), true);
    // New worlds own complete silhouettes rather than inheriting a pine ring.
    // Every solid here is exterior; authored obstacles alone occupy flight space.
    if (environment === 'coast') {
      const sea = [
        [min.x - 22, min.y + 0.002, cz, 42, 1, depth + 84],
        [max.x + 22, min.y + 0.002, cz, 42, 1, depth + 84],
        [cx, min.y + 0.002, min.z - 22, width + 2, 1, 42],
        [cx, min.y + 0.002, max.z + 22, width + 2, 1, 42],
      ];
      // Water is scenery beyond the arena, not a fictitious traversable hazard.
      batch(
        'coastal-water-outside-arena',
        new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
        sea,
        material(0x397986, { roughness: 0.32, metalness: 0.12 }),
        true,
      );
      const breakwater = [];
      for (let i = 0; i < 16; i++)
        breakwater.push([
          min.x + (width * (i + 0.5)) / 16,
          min.y + 0.8,
          min.z - 5,
          width / 17,
          1.6,
          2.4,
        ]);
      exterior('harbor-breakwater', breakwater, 0x737f7d);
      const beaconX = max.x + 7,
        beaconZ = min.z - 7;
      exterior(
        'harbor-beacon',
        [[beaconX, min.y + 6, beaconZ, 2.4, 12, 2.4]],
        0xe4ded0,
        new THREE.CylinderGeometry(0.36, 0.5, 1, 10),
      );
      exterior(
        'harbor-beacon-bands',
        [
          [beaconX, min.y + 4.1, beaconZ, 2.42, 0.7, 2.42],
          [beaconX, min.y + 8, beaconZ, 2.42, 0.7, 2.42],
        ],
        0xa64f40,
        new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
      );
      exterior(
        'harbor-beacon-lantern',
        [[beaconX, min.y + 12.4, beaconZ, 2.6, 0.9, 2.6]],
        0xe6c885,
        new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
        { emissive: 0xba8543, emissiveIntensity: 0.2 },
      );
      for (const side of [-1, 1])
        rectangle(secondary, cx + side * Math.min(8, width / 5), cz, 0.06, depth - 8);
    } else if (environment === 'quarry') {
      const tones = [0x8b745a, 0xb29973, 0x796a59];
      for (let tier = 0; tier < 3; tier++) {
        const terraces = [];
        for (let side = 0; side < 4; side++)
          for (let i = 0; i < 5; i++) {
            const along = (i + 0.5) / 5,
              height = 5 + tier * 6 + ((i + side) % 3) * 1.2,
              across = (side % 2 ? depth : width) / 5 + 0.4,
              offset = 5 + tier * 6,
              x = side === 1 ? max.x + offset : side === 3 ? min.x - offset : min.x + width * along,
              z = side === 0 ? min.z - offset : side === 2 ? max.z + offset : min.z + depth * along;
            terraces.push([
              x,
              min.y + height / 2,
              z,
              side % 2 ? 7 : across,
              height,
              side % 2 ? across : 7,
            ]);
          }
        exterior(`quarry-cut-terrace-${tier}`, terraces, tones[tier]);
      }
      for (const side of [-1, 1]) {
        const z = side < 0 ? min.z + 3 : max.z - 3;
        for (let x = min.x + 5; x < max.x - 4; x += 8) rectangle(marks, x, z, 1.3, 0.1);
      }
    } else if (environment === 'rooftops') {
      const skyline = [[], [], []],
        windows = [];
      for (let side = 0; side < 4; side++)
        for (let i = 0; i < 7; i++) {
          const height = 9 + ((i * 7 + side * 5) % 20),
            along = (i + 0.5) / 7,
            x = side === 1 ? max.x + 9 : side === 3 ? min.x - 9 : min.x + width * along,
            z = side === 0 ? min.z - 9 : side === 2 ? max.z + 9 : min.z + depth * along;
          skyline[(i + side) % 3].push([x, min.y + height / 2, z, 9, height, 9]);
          for (let y = 3; y < height - 1; y += 3)
            windows.push([
              side === 1 ? x - 4.51 : side === 3 ? x + 4.51 : x,
              min.y + y,
              side === 0 ? z + 4.51 : side === 2 ? z - 4.51 : z,
              side % 2 ? 0.015 : 5.8,
              0.6,
              side % 2 ? 5.8 : 0.015,
            ]);
        }
      for (let i = 0; i < skyline.length; i++)
        exterior(`city-skyline-${i}`, skyline[i], [0x3e4b5e, 0x5c657a, 0x6d6574][i]);
      exterior('city-window-bands', windows, 0x6bafb4, undefined, {
        emissive: 0x35696d,
        emissiveIntensity: 0.15,
      });
      for (const side of [-1, 1])
        rectangle(joints, side < 0 ? min.x + 2 : max.x - 2, cz, 0.15, depth - 4);
    } else if (environment === 'orchard') {
      const trunks = [],
        crowns = [];
      for (let side = 0; side < 4; side++)
        for (let i = 0; i < 7; i++) {
          const along = (i + 0.5) / 7,
            x = side === 1 ? max.x + 5 : side === 3 ? min.x - 5 : min.x + width * along,
            z = side === 0 ? min.z - 5 : side === 2 ? max.z + 5 : min.z + depth * along;
          trunks.push([x, min.y + 1.8, z, 0.4, 3.6, 0.4]);
          crowns.push([x, min.y + 4.1, z, 4.2, 3.8, 4.2]);
        }
      exterior('orchard-peripheral-trunks', trunks, 0x79634c);
      exterior('orchard-peripheral-crowns', crowns, 0x567849, new THREE.SphereGeometry(0.5, 8, 6));
      const soil = (course.obstacles ?? [])
        .filter((obstacle) => /^tree-trunk-/.test(obstacle.id) && obstacle.min && obstacle.max)
        .map((obstacle) => [
          (obstacle.min.x + obstacle.max.x) / 2000,
          min.y + 0.003,
          (obstacle.min.z + obstacle.max.z) / 2000,
          3,
          1,
          3,
        ]);
      if (soil.length) groundBatch('orchard-tree-soil', soil, 0x81745c);
      groundBatch('orchard-farm-lane', [[cx, min.y + 0.002, cz, 4, 1, depth + 2]], 0xafa185);
      exterior('orchard-barn', [[min.x - 9, min.y + 2.5, max.z - 8, 8, 5, 12]], 0xa18b68);
      exterior(
        'orchard-barn-roof',
        [[min.x - 9, min.y + 6, max.z - 8, 11.8, 2.5, 17]],
        0x80554a,
        new THREE.ConeGeometry(0.5, 1, 4).rotateY(Math.PI / 4),
      );
    } else if (environment === 'solar-farm') {
      const cabinets = [],
        insulators = [],
        poles = [];
      for (let i = 0; i < 8; i++) {
        const x = min.x + (width * (i + 0.5)) / 8;
        cabinets.push([x, min.y + 1.4, min.z - 6, 3.3, 2.8, 3]);
        for (const dx of [-0.8, 0.8])
          insulators.push([x + dx, min.y + 3.5, min.z - 6, 0.35, 1.4, 0.35]);
      }
      for (const x of [min.x - 3, max.x + 3])
        for (let z = min.z; z <= max.z; z += 10) poles.push([x, min.y + 1.2, z, 0.12, 2.4, 0.12]);
      exterior('solar-transformer-cabinets', cabinets, 0xa3aca9);
      exterior(
        'solar-transformer-insulators',
        insulators,
        0x4d666e,
        new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
      );
      exterior('solar-perimeter-posts', poles, 0x7d8a88);
      for (const side of [-1, 1]) rectangle(secondary, cx + side * 3, cz, 0.06, depth - 4);
    } else if (environment === 'rail-depot') {
      const trackXs = [
        ...new Set(
          (course.obstacles ?? [])
            .filter((obstacle) => /^rail-car-/.test(obstacle.id) && obstacle.min && obstacle.max)
            .map((obstacle) => (obstacle.min.x + obstacle.max.x) / 2000),
        ),
      ];
      const rails = [],
        sleepers = [];
      for (const x of trackXs.length ? trackXs.slice(0, 8) : [cx - 24, cx, cx + 24]) {
        for (const offset of [-0.78, 0.78])
          rails.push([x + offset, min.y + 0.008, cz, 0.09, 1, depth + 18]);
        for (let z = min.z - 8; z <= max.z + 8; z += 1.5)
          sleepers.push([x, min.y + 0.003, z, 2.2, 1, 0.24]);
      }
      groundBatch('depot-track-sleepers', sleepers, 0x625b4e);
      groundBatch('depot-track-rails', rails, 0xa4a6a0, { metalness: 0.55, roughness: 0.42 });
      exterior(
        'depot-outer-platforms',
        [
          [min.x - 4, min.y + 0.6, cz, 5, 1.2, depth + 12],
          [max.x + 4, min.y + 0.6, cz, 5, 1.2, depth + 12],
        ],
        0x858b88,
      );
      exterior(
        'depot-service-hall',
        [[cx, min.y + 5, min.z - 12, Math.min(42, width * 0.7), 10, 14]],
        0x68777a,
      );
      for (let z = min.z + 4; z < max.z; z += 8) rectangle(marks, max.x - 1.8, z, 0.12, 1.4);
    }
  } else if (!natural) {
    // Static facility markings convey scale, not an extra challenge route.
    const inset = Math.min(2, width * 0.08, depth * 0.08);
    for (let x = min.x + 2; x < max.x - 1; x += 6) {
      rectangle(marks, x, min.z + inset, 1.15, 0.055);
      rectangle(marks, x, max.z - inset, 1.15, 0.055);
    }
    if (environment === 'gym' || environment === 'garage') {
      for (let x = min.x + 6; x < max.x; x += 6) rectangle(joints, x, cz, 0.022, depth);
      for (let z = min.z + 6; z < max.z; z += 6) rectangle(joints, cx, z, width, 0.022);
    }
    if (environment === 'gym') {
      for (const side of [-1, 1]) {
        const x = side < 0 ? min.x + 2.2 : max.x - 2.2;
        for (let z = min.z + 4; z < max.z - 3; z += 7) outline(secondary, x, z, 2.2, 3.4, 0.05);
      }
      for (let i = 1; i <= 4; i++) digit(i, min.x + (width * i) / 5, max.z - 1.15, 0.75);
    } else if (environment === 'courtyard') {
      // A narrow paved border remains ground-level around the open courtyard.
      for (const side of [-1, 1]) {
        rectangle(secondary, cx, side < 0 ? min.z + 0.6 : max.z - 0.6, width, 0.08);
        rectangle(secondary, side < 0 ? min.x + 0.6 : max.x - 0.6, cz, 0.08, depth);
      }
    } else if (environment === 'warehouse' || environment === 'container-yard') {
      for (const side of [-1, 1]) {
        const x = side < 0 ? min.x + 3 : max.x - 3;
        for (let z = min.z + 4; z < max.z - 3; z += 9) {
          outline(marks, x, z, 3.5, 5.4, 0.075);
          rectangle(secondary, x, z + 1.5, 0.65, 0.14);
        }
      }
    } else if (environment === 'stadium') {
      for (const inset of [1.4, 3.2, 5])
        outline(secondary, cx, cz, Math.max(2, width - inset * 2), Math.max(2, depth - inset * 2));
      for (let i = 0; i < 16; i++)
        rectangle(i % 2 ? secondary : marks, cx - 4 + i * 0.5, max.z + 0.75, 0.5, 0.5);
    } else if (environment === 'garage') {
      for (const side of [-1, 1]) {
        const x = side < 0 ? min.x + 2.4 : max.x - 2.4;
        for (let z = min.z + 3; z < max.z - 3; z += 5.5) outline(secondary, x, z, 3.1, 4.6, 0.06);
      }
      for (let i = 1; i <= 4; i++) digit(i, max.x - 2.4, min.z + (depth * i) / 5, 0.8);
    }
  } else {
    const trail = kit ? kit.paint('concrete') : material(0x8b886d, { roughness: 1 });
    batch(
      'peripheral-walking-verge',
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      [
        [cx, min.y + 0.002, min.z - 2, width + 7, 1, 1.1],
        [max.x + 2, min.y + 0.002, cz, 1.1, 1, depth + 7],
      ],
      trail,
      true,
    );
    const hills = [],
      rng = random(environment === 'field' ? 1049 : 2781);
    for (let i = 0; i < 14; i++) {
      const side = i % 4,
        along = (i + 0.5) / 14,
        span = 15 + rng() * 10,
        height = 3 + rng() * 3,
        x = side === 1 ? max.x + 28 : side === 3 ? min.x - 28 : min.x + width * along,
        z = side === 0 ? min.z - 28 : side === 2 ? max.z + 28 : min.z + depth * along;
      hills.push([x, min.y - height * 0.16, z, span, height, span]);
    }
    batch(
      'distant-landscape',
      new THREE.SphereGeometry(0.5, pixel ? 7 : 12, pixel ? 4 : 6),
      hills,
      kit
        ? kit.paint('grass')
        : material(new THREE.Color(theme.ground).lerp(new THREE.Color(theme.fog), 0.12)),
      true,
    );
  }
  for (const [name, rows, color, opacity] of [
    ['facility-paint', marks, theme.warm, 0.58],
    [
      'facility-secondary-paint',
      secondary,
      kit ? getSimVisualCollection(kit.collectionId).paper : pixel ? theme.accent : 0xd9d9ca,
      0.45,
    ],
    ['floor-expansion-joints', joints, 0x293832, 0.22],
  ])
    if (rows.length)
      batch(name, new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), rows, paint(color, opacity));
  return group;
}

export function buildWorldVisuals({
  course,
  world,
  mesh,
  material,
  box,
  presentation,
  quality = 'balanced',
  maxAnisotropy = 1,
}) {
  const profile = resolveSimThemeProfile(course, presentation),
    theme = profile.palette,
    environment = course.environment,
    adventure = ADVENTURE_SURFACES[environment];
  const collectionId = simCollectionIdForProfile(profile),
    themed = Boolean(collectionId),
    kit = themed
      ? createWorkshopMaterials({ material, quality, maxAnisotropy, collectionId })
      : null;
  const min = Object.fromEntries(Object.entries(course.bounds.min).map(([k, v]) => [k, v / 1000]));
  const max = Object.fromEntries(Object.entries(course.bounds.max).map(([k, v]) => [k, v / 1000]));
  const width = max.x - min.x,
    depth = max.z - min.z,
    cx = (min.x + max.x) / 2,
    cz = (min.z + max.z) / 2;
  const indoor = ['gym', 'warehouse', 'garage'].includes(environment);
  const natural = ['field', 'woodland', 'orchard'].includes(environment);
  const backdrop = new THREE.Group();
  backdrop.name = 'procedural-scenery-fallback';
  if (kit) bindSimModelRole(backdrop, 'scenery', collectionId);
  world.add(backdrop);
  const surfaceDetail = new THREE.Group();
  surfaceDetail.name = 'surface-detail';
  world.add(surfaceDetail);
  const pixel = profile.textureFilter === 'nearest';
  const orchardTrees =
    environment === 'orchard' &&
    !pixel &&
    !kit &&
    JSON.stringify(profile) === ORCHARD_PROFILE &&
    canonicalOrchardTrees(course);
  const quarryRocks =
      environment === 'quarry'
        ? (course.obstacles ?? []).filter(
            (item) => !/^(rail-gantry|rail-car|solar-hut)-/.test(item.id ?? ''),
          )
        : [],
    quarryStrata =
      !pixel &&
      !kit &&
      quarryRocks.length === 6 &&
      new Set(quarryRocks.map((item) => item.id)).size === 6 &&
      quarryRocks.every(isQuarryStrataObstacle);
  const hangar = environment === 'gym',
    warehouse = environment === 'warehouse',
    steelCladding = hangar || warehouse;
  const floorKind =
    adventure?.floor ??
    (hangar
      ? 'hangar-concrete'
      : environment === 'woodland'
        ? 'forest-floor'
        : environment === 'field' && !pixel && !kit
          ? 'meadow-grass'
          : natural
            ? 'grass'
            : environment === 'courtyard'
              ? 'paving'
              : environment === 'container-yard' || environment === 'stadium'
                ? 'asphalt'
                : 'concrete');
  const floorColor =
    themed || natural || pixel
      ? new THREE.Color(theme.ground)
      : new THREE.Color(
          adventure?.color ??
            (environment === 'courtyard'
              ? 0xa89c86
              : floorKind === 'asphalt'
                ? 0x454e54
                : environment === 'garage'
                  ? 0x858b88
                  : 0x77807b),
        ).lerp(
          new THREE.Color(theme.ground),
          environment === 'courtyard' ? 0.08 : floorKind === 'asphalt' ? 0.1 : 0.12,
        );
  const floorMaps = kit
    ? { map: kit.texture(natural ? 'grass' : 'concrete') }
    : surfaceMaps(floorKind, floorColor, { pixel });
  // Repeat in metres across the entire ground, including its outer apron.
  const floorTile =
    environment === 'woodland' ? 6 : natural ? 12 : environment === 'courtyard' ? 4 : 6;
  for (const texture of new Set(Object.values(floorMaps)))
    texture.repeat.set(
      hangar ? 1 : (width + 100) / floorTile,
      hangar ? 1 : (depth + 100) / floorTile,
    );
  const floorGeometry = new THREE.PlaneGeometry(width + 100, depth + 100);
  if (hangar) {
    const positions = floorGeometry.attributes.position,
      uv = floorGeometry.attributes.uv;
    for (let i = 0; i < positions.count; i++)
      uv.setXY(i, (positions.getX(i) + cx - min.x) / 6, (-positions.getY(i) + cz - min.z) / 6);
  }
  const ground = mesh(
    floorGeometry,
    material(0xffffff, {
      ...floorMaps,
      normalScale: new THREE.Vector2(natural ? 0.18 : 0.3, natural ? 0.18 : 0.3),
      roughness: 1,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.userData.materialRole = natural ? 'grass' : 'concrete';
  ground.position.set(cx, min.y - 0.01, cz);
  ground.receiveShadow = true;
  if (warehouse) ground.userData.materialRole = 'concrete';
  const accent = material(theme.accent, {
    roughness: 0.5,
    emissive: theme.accent,
    emissiveIntensity: 0.1,
  });
  const wallMaps = kit
    ? { map: kit.texture(natural ? 'timber' : 'steel') }
    : surfaceMaps(
        adventure?.wall ??
          (steelCladding
            ? 'painted-steel'
            : environment === 'courtyard'
              ? 'brick'
              : natural
                ? 'wood'
                : 'metal'),
        natural ? 0x857763 : theme.wall,
        { pixel },
      );
  for (const texture of new Set(Object.values(wallMaps)))
    texture.repeat.set(steelCladding ? 1 : 3, steelCladding ? 1 : 2);
  const wallMap = wallMaps.map;
  const walls = material(0xffffff, {
    ...wallMaps,
    normalScale: new THREE.Vector2(0.3, 0.3),
    roughness: 1,
    metalness: indoor ? 0.18 : 0.05,
  });
  world.userData.ownedMaterials = [accent, walls];
  world.userData.collectionId = collectionId ?? 'authored';
  const serviceBand = hangar
    ? kit
      ? kit.paint('rubber')
      : material(0xffffff, {
          ...surfaceMaps('rubber', new THREE.Color(theme.wall).multiplyScalar(0.2), { pixel }),
          normalScale: new THREE.Vector2(0.18, 0.18),
          roughness: 1,
        })
    : accent;
  if (hangar) world.userData.ownedMaterials.push(serviceBand);
  const obstacleSurfaces = new Map();
  const obstacleSurface = (kind = 'concrete') => {
    const colors = {
      wood: 0x85725a,
      bark: 0x78614d,
      concrete: 0x929790,
      'garage-concrete': 0x9a9d93,
      'stadium-concrete': new THREE.Color(0x929790).lerp(new THREE.Color(theme.wall), 0.2),
      'stadium-steel': theme.wall,
      plaster: theme.wall,
      brick: environment === 'courtyard' ? 0xb99e83 : theme.wall,
      metal: theme.wall,
      'storage-steel': theme.wall,
      stone: 0xa18a6d,
      'quarry-stone': 0xa18a6d,
      foliage: 0x587d49,
      solar: 0x263e5d,
    };
    if (!Object.hasOwn(colors, kind)) kind = 'concrete';
    if (!obstacleSurfaces.has(kind)) {
      const role =
        kind === 'wood'
          ? 'timber'
          : kind === 'foliage'
            ? 'grass'
            : [
                  'concrete',
                  'garage-concrete',
                  'stadium-concrete',
                  'stone',
                  'quarry-stone',
                  'plaster',
                ].includes(kind)
              ? 'concrete'
              : 'steel';
      const maps = kit
        ? { map: kit.texture(role) }
        : surfaceMaps(
            orchardTrees && kind === 'wood'
              ? 'orchard-bark'
              : orchardTrees && kind === 'foliage'
                ? 'orchard-foliage'
                : kind === 'stadium-steel'
                  ? 'painted-steel'
                  : kind,
            colors[kind],
            { pixel },
          );
      // A shared owner stays under world even when callers make no obstacle
      // mesh, and never shares texture lifetime with independently removed actors.
      world.userData.ownedMaterials.push(material(0xffffff, maps));
      obstacleSurfaces.set(kind, maps);
    }
    return obstacleSurfaces.get(kind);
  };
  const garagePaints = new Map();
  if (environment === 'coast' && !pixel) {
    const paints = new Map();
    for (const obstacle of course.obstacles ?? [])
      for (const { role, layer, geometry } of buildCoastLighthouseGeometry(obstacle)) {
        const materialRole = role === 'pane' || role === 'trim' ? 'steel' : 'concrete';
        if (!paints.has(role)) {
          const colors = { shell: 0xffedcc, band: 0xd95b42, pane: 0x18313b, trim: 0xfff4db },
            maps = kit ? { map: kit.texture(materialRole) } : obstacleSurface('concrete'),
            paint = material(kit && role === 'band' ? theme.accent : colors[role], {
              ...maps,
              roughness: role === 'pane' ? 0.38 : 0.85,
              metalness: role === 'trim' ? 0.15 : 0,
              polygonOffset: true,
              polygonOffsetFactor: -layer,
              polygonOffsetUnits: -layer,
            });
          // Both maps already belong to this world. No actor or imported scene
          // owns the lighthouse finish; retain paints through world disposal.
          world.userData.ownedMaterials.push(paint);
          paints.set(role, paint);
        }
        const finish = mesh(geometry, paints.get(role), world);
        finish.name = `coast-lighthouse-${role}`;
        finish.userData = { role: 'coast-lighthouse-landmark', materialRole, cosmeticDetail: true };
        finish.castShadow = false;
        finish.receiveShadow = true;
      }
  }
  const garageDetailMaterial = (role) => {
    if (!garagePaints.has(role)) {
      const paint = kit
        ? kit.paint(role)
        : material(0xffffff, {
            ...surfaceMaps(
              role === 'rubber' ? 'rubber' : 'concrete',
              role === 'rubber'
                ? 0x3b4240
                : new THREE.Color(theme.warm).lerp(new THREE.Color(0xe4dfc8), 0.7),
              { pixel },
            ),
            roughness: role === 'rubber' ? 0.95 : 0.78,
            metalness: 0,
          });
      // Renderer decal clones keep these maps. The source owner must also be
      // reachable when a course changes before any detail is ever rendered.
      world.userData.ownedMaterials.push(paint);
      garagePaints.set(role, paint);
    }
    return garagePaints.get(role);
  };
  const structure = (size, at, paint = walls) => {
    const shape = new THREE.BoxGeometry(...size);
    if (steelCladding && (paint === walls || (hangar && paint === serviceBand))) {
      // UV-only projection keeps all existing faces, bounds and silhouettes.
      // A shared map retains the same material scale on differently sized walls.
      const positions = shape.attributes.position,
        normals = shape.attributes.normal,
        uv = shape.attributes.uv;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i) + at[0] - min.x,
          y = positions.getY(i) + at[1] - min.y,
          z = positions.getZ(i) + at[2] - min.z;
        uv.setXY(
          i,
          (Math.abs(normals.getX(i)) > 0.5 ? z : x) / 6,
          (Math.abs(normals.getY(i)) > 0.5 ? z : y) / 3,
        );
      }
    }
    const value = mesh(shape, paint, indoor ? world : backdrop);
    value.position.set(...at);
    if (warehouse && (paint === walls || paint === serviceBand))
      value.userData.materialRole = paint === walls ? 'steel' : 'enamel';
    value.castShadow = value.receiveShadow = true;
    value.userData.materialRole =
      hangar && paint === serviceBand ? 'rubber' : natural ? 'timber' : 'steel';
    return value;
  };
  const detailRows = [];
  const detail = (shape, paint, at, target = backdrop) =>
    detailRows.push({ shape, paint, positions: [at], target });
  const repeatedDetail = (shape, paint, positions, target = backdrop) => {
    detailRows.push({ shape, paint, positions, target });
  };
  // Surface detailing only: structural silhouettes and flight sight lines are
  // identical in every preset. Repeated fasteners share one draw call.
  const hardware = kit
    ? kit.paint('copper')
    : material(0x87969b, { roughness: 0.48, metalness: 0.7 });
  const points = [];
  if (!natural)
    for (const z of [min.z - 0.08, max.z + 0.08])
      for (let x = min.x + 1; x < max.x; x += 3)
        for (const y of [0.45, 2.15]) points.push([x, y, z]);
  if (points.length) {
    const rivets = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.035, 6, 4),
      hardware,
      points.length,
    );
    const transform = new THREE.Matrix4();
    points.forEach((at, index) => rivets.setMatrixAt(index, transform.makeTranslation(...at)));
    rivets.instanceMatrix.needsUpdate = true;
    surfaceDetail.add(rivets);
  }
  if (indoor) {
    const sill = environment === 'gym' ? max.y : 2.5;
    const northWall = structure([width + 1, sill, 0.35], [cx, sill / 2, min.z - 0.18]),
      southWall = structure([width + 1, sill, 0.35], [cx, sill / 2, max.z + 0.18]);
    if (hangar) {
      const paints = new Map();
      for (const [wall, side] of [
        [northWall, 'north'],
        [southWall, 'south'],
      ])
        for (const { role, layer, geometry } of buildHangarBayGeometry(
          [width + 1, sill, 0.35],
          side,
        )) {
          if (!paints.has(role)) {
            const source =
              role === 'rubber'
                ? serviceBand
                : kit
                  ? kit.paint('enamel')
                  : material(0xe4ddc3, { roughness: 0.82 });
            const paint = source.clone();
            paint.polygonOffset = true;
            paint.polygonOffsetFactor = -layer;
            paint.polygonOffsetUnits = -layer;
            // Clones share maps with their source; retain both until this world
            // is released. No texture or material belongs to an objective actor.
            world.userData.ownedMaterials.push(source, paint);
            paints.set(role, paint);
          }
          const markings = mesh(geometry, paints.get(role), wall);
          markings.name = `hangar-${side}-bay-${role}`;
          markings.userData.role = 'hangar-bay-landmark';
          markings.userData.materialRole = role;
          markings.userData.cosmeticDetail = true;
          markings.castShadow = false;
          markings.receiveShadow = true;
        }
    }
    for (const x of [min.x - 0.18, max.x + 0.18]) structure([0.35, sill, depth], [x, sill / 2, cz]);
    if (sill < max.y) {
      // Transparent perimeter glazing exposes the authored industrial skyline.
      // Window frames and glass remain beyond the same flight boundary.
      const glass = material(0xa7c9cc, {
        transparent: true,
        opacity: 0.09,
        roughness: 0.2,
        depthWrite: false,
      });
      for (const z of [min.z - 0.2, max.z + 0.2]) {
        structure([width, max.y - sill, 0.03], [cx, (max.y + sill) / 2, z], glass);
        for (let x = min.x; x <= max.x; x += 8) structure([0.22, max.y, 0.25], [x, max.y / 2, z]);
      }
      for (const x of [min.x - 0.2, max.x + 0.2]) {
        structure([0.03, max.y - sill, depth], [x, (max.y + sill) / 2, cz], glass);
        for (let z = min.z; z <= max.z; z += 8) structure([0.25, max.y, 0.22], [x, max.y / 2, z]);
      }
    }
    // Ceiling trusses lie outside the flight bounds, just like the walls.
    for (let x = min.x + 2; x < max.x; x += 6) structure([0.22, 0.3, depth], [x, max.y + 0.2, cz]);
    const beamLight = material(0xe3f4ef, {
      emissive: 0xbedbd4,
      emissiveIntensity: pixel ? 0.7 : 1.1,
      roughness: 0.38,
    });
    const windowPaint = material(0xa8d5df, {
      emissive: 0x749fab,
      emissiveIntensity: 0.35,
    });
    for (let z = min.z + 4; z < max.z; z += 12)
      for (const x of [min.x + width * 0.25, min.x + width * 0.75]) {
        structure([3.6, 0.15, 0.35], [x, max.y + 0.04, z], hardware);
        structure([3.2, 0.025, 0.28], [x, max.y - 0.001, z], beamLight);
      }
    for (const z of [min.z + 0.012, max.z - 0.012]) {
      structure([width, 0.35, 0.015], [cx, 1.6, z], serviceBand);
      for (let x = min.x + 3; x < max.x - 2; x += 7)
        structure([3, 1.4, 0.015], [x, max.y * 0.7, z], windowPaint);
    }
    if (kit) {
      // Service conduits remain beyond the same world boundary as the walls.
      for (const z of [min.z - 0.42, max.z + 0.42]) {
        detail(
          new THREE.BoxGeometry(width, 0.09, 0.09),
          kit.paint('copper'),
          [cx, Math.min(sill - 0.2, 2.2), z],
          world,
        );
        for (let x = min.x + 1; x < max.x; x += 6)
          detail(
            new THREE.BoxGeometry(0.14, 0.28, 0.14),
            kit.paint('rubber'),
            [x, Math.min(sill - 0.2, 2.2), z],
            world,
          );
      }
    }
    if (environment === 'garage') {
      for (let x = min.x + 3; x < max.x; x += 5) {
        const stripe = mesh(new THREE.PlaneGeometry(0.09, depth - 4), accent);
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(x, 0.012, cz);
      }
    }
  } else if (environment === 'courtyard') {
    // These are closed facade finishes on the two authored collision solids.
    // Pixel retains its existing simple blocks; shared Themes keep their role maps.
    if (!pixel) {
      const finishes = {
        plinth: ['concrete', 0x827e72, 0.94, 0, 3],
        roof: ['steel', 0x596766, 0.76, 0.12, 3],
        window: ['steel', 0x506c78, 0.38, 0.25, 6],
        door: ['timber', 0x74604c, 0.88, 0, 4],
        accent: ['enamel', 0x557f8a, 0.8, 0, 5],
        trim: ['concrete', 0xe4d9bd, 0.9, 0, 7],
      };
      for (const { finish, geometry } of buildCourtyardFacadeGeometry(course)) {
        const [role, color, roughness, metalness, layer] = finishes[finish],
          source = kit ? kit.paint(role) : material(color, { roughness, metalness }),
          paint = source.clone();
        paint.polygonOffset = true;
        paint.polygonOffsetFactor = -layer;
        paint.polygonOffsetUnits = -layer;
        world.userData.ownedMaterials.push(source, paint);
        const facade = mesh(geometry, paint, world);
        facade.name = `courtyard-house-${finish}`;
        facade.userData.role = 'courtyard-house-facade';
        facade.userData.materialRole = role;
        facade.userData.cosmeticDetail = true;
        facade.castShadow = false;
        facade.receiveShadow = true;
      }
    }
    const roofPaint = material(theme.warm),
      plinthPaint = material(0x9b9587),
      trimPaint = material(0xf0e5cb),
      windowPaint = material(0x698493, { metalness: 0.45, roughness: 0.3 });
    for (let i = 0; i < 12; i++) {
      const side = i % 4,
        along = Math.floor(i / 4),
        height = 7 + (i % 3) * 2;
      const x = side < 2 ? (side ? max.x + 5 : min.x - 5) : min.x + (width * (along + 0.5)) / 3;
      const z =
        side >= 2 ? (side === 2 ? min.z - 5 : max.z + 5) : min.z + (depth * (along + 0.5)) / 3;
      structure([6, height, 6], [x, height / 2, z]);
      structure([6.4, 0.25, 6.4], [x, height + 0.12, z], roofPaint);
      // Cornices and plinths give buildings scale without changing flyable gaps.
      structure([6.12, 0.24, 6.12], [x, 0.22, z], plinthPaint);
      structure([6.1, 0.18, 6.1], [x, height - 0.6, z], trimPaint);
      if (kit) {
        for (let slat = 0; slat < 4; slat++)
          detail(new THREE.BoxGeometry(1.1, 0.06, 0.025), kit.paint('rubber'), [
            x,
            1.4 + slat * 0.14,
            z + (z < cz ? 3.015 : -3.015),
          ]);
      }
      for (let floor = 2; floor < height; floor += 2.5) {
        const pane = structure(
          [4.4, 1.1, 0.015],
          [x, floor, z + (z < cz ? 3.01 : -3.01)],
          windowPaint,
        );
        if (side < 2) {
          pane.rotation.y = Math.PI / 2;
          pane.position.set(x + (x < cx ? 3.01 : -3.01), floor, z);
        }
      }
    }
  } else if (environment === 'container-yard') {
    const containerPaints = [
      material(0xffe0b0, { map: wallMap, metalness: 0.2 }),
      material(0xffffff, { map: wallMap, metalness: 0.2 }),
    ];
    for (let i = 0; i < 18; i++) {
      const side = i % 4,
        slot = Math.floor(i / 4);
      const x = side < 2 ? (side ? max.x + 4 : min.x - 4) : min.x + 5 + (slot * (width - 10)) / 4;
      const z =
        side >= 2 ? (side === 2 ? min.z - 4 : max.z + 4) : min.z + 5 + (slot * (depth - 10)) / 4;
      const container = structure([5, 2.7, 2.6], [x, 1.35, z], containerPaints[i % 3 ? 1 : 0]);
      container.rotation.y = side < 2 ? Math.PI / 2 : 0;
      if (kit) {
        // Corrugated cladding and corner castings belong to perimeter scenery.
        const ribs = [],
          castings = [];
        for (const face of [-1, 1]) {
          for (let rib = -2.25; rib <= 2.25; rib += 0.5) ribs.push([rib, 0, face * 1.31]);
          for (const x of [-2.38, 2.38])
            for (const y of [-1.21, 1.21]) castings.push([x, y, face * 1.31]);
        }
        repeatedDetail(
          new THREE.BoxGeometry(0.045, 2.5, 0.025),
          kit.paint('steel'),
          ribs,
          container,
        );
        repeatedDetail(
          new THREE.BoxGeometry(0.18, 0.18, 0.035),
          kit.paint('copper'),
          castings,
          container,
        );
      }
      for (const edge of [-1, 1]) {
        const rail = structure([5.06, 0.1, 0.1], [x, 2.6, z + edge * 1.3], hardware);
        if (side < 2) {
          rail.rotation.y = Math.PI / 2;
          rail.position.set(x + edge * 1.3, 2.6, z);
        }
      }
      if (i % 3 === 0) {
        const upper = structure([5, 2.7, 2.6], [x, 4.05, z], container.material);
        upper.rotation.y = container.rotation.y;
      }
    }
  } else if (environment === 'stadium') {
    const seatPaints = [material(theme.wall), material(theme.accent)],
      lampPaint = material(0xfff2c9, { emissive: 0xffefd4, emissiveIntensity: 1.3 });
    for (const side of [-1, 1])
      for (let tier = 0; tier < 4; tier++) {
        const z = side < 0 ? min.z - 3 - tier * 2 : max.z + 3 + tier * 2;
        structure([width + 8, 0.6, 1.5], [cx, 0.5 + tier * 1.2, z], seatPaints[tier % 2]);
      }
    for (const x of [min.x - 3, max.x + 3])
      for (const z of [min.z - 3, max.z + 3]) {
        structure([0.25, 13, 0.25], [x, 6.5, z]);
        structure([2.5, 0.5, 0.5], [x, 12.8, z], lampPaint);
      }
  } else if (!adventure) {
    const rng = random(environment === 'woodland' ? 7947 : 997),
      count = environment === 'woodland' ? 66 : 32;
    const radius = Math.hypot(width, depth) / 2 + 10;
    const naturalWoodland = environment === 'woodland' && !pixel && !kit,
      canopyMaps = naturalWoodland ? surfaceMaps('woodland-canopy', 0xffffff) : null,
      leaves = [0x496b50, 0x345749, 0x7c905d].map((color) =>
        material(
          color,
          canopyMaps
            ? { ...canopyMaps, normalScale: new THREE.Vector2(0.22, 0.22), vertexColors: true }
            : {},
        ),
      ),
      bark = kit
        ? kit.paint('timber')
        : naturalWoodland
          ? material(0xffffff, {
              ...surfaceMaps('bark', 0x63554a),
              normalScale: new THREE.Vector2(0.3, 0.3),
            })
          : material(0x63554a);
    // Meadow groves frame a clearing instead of repeating a circular tree fence.
    // Unequal groups and staggered depth leave broad openings. Their spread is
    // capped in metres so larger school arenas retain recognizable silhouettes.
    const groveSlots =
      environment === 'field'
        ? [
            {
              side: 'north',
              anchor: min.x + width * 0.12,
              span: Math.min(28, Math.max(18, width * 0.45)),
              offsets: [
                [-0.42, 9],
                [-0.1, 11],
                [0.05, 0],
                [0.35, 1],
                [0.22, 16],
                [-0.22, 3],
                [-0.3, 18],
                [-0.47, 1],
                [0.48, 6],
                [0.43, 17],
                [0.05, 8],
                [-0.49, 15],
                [0.04, 23],
              ],
            },
            {
              side: 'east',
              anchor: min.z + depth * 0.22,
              span: Math.min(24, Math.max(16, depth * 0.35)),
              offsets: [
                [-0.4, 5],
                [-0.05, 8],
                [0.2, 2],
                [0.32, 14],
                [-0.3, 16],
                [0.44, 7],
                [0.05, 18],
                [-0.5, 0],
                [0, 0],
              ],
            },
            {
              side: 'west',
              anchor: min.z + depth * 0.8,
              span: Math.min(22, Math.max(14, depth * 0.28)),
              offsets: [
                [-0.45, 1],
                [-0.12, 0],
                [0.17, 8],
                [0.45, 1],
                [-0.3, 12],
                [0.37, 14],
                [0, 17],
              ],
            },
            {
              side: 'south',
              anchor: min.x + width * 0.76,
              span: Math.min(14, Math.max(10, width * 0.16)),
              offsets: [
                [-0.45, 6],
                [0.05, 12],
                [0.5, 0],
              ],
            },
          ].flatMap(({ side, anchor, span, offsets }) =>
            offsets.map(([along, outward]) => ({ side, along: anchor + along * span, outward })),
          )
        : null;
    // Keep spatial sectors independently culled: a single forest-wide batch
    // would submit every crown even when the camera sees only one edge.
    const canopyBatches = new Map(),
      branchBatches = new Map(),
      organicCanopy = environment === 'woodland' && !pixel && !kit,
      canopyShape = environment === 'woodland' ? new THREE.IcosahedronGeometry(1, 1) : null,
      branchShape = organicCanopy ? new THREE.CylinderGeometry(0.035, 0.08, 1, 5) : null;
    // Every lobe fits inside the old unit-sphere envelope. These cosmetic trees
    // stay outside the arena and cannot introduce an obstacle into a flight line.
    const crownLobes = organicCanopy
      ? [
          [0, 0.33, 0, 0.58, 0.62, 0.58],
          [-0.32, -0.05, -0.18, 0.56, 0.6, 0.6],
          [0.29, -0.12, 0.24, 0.58, 0.56, 0.54],
          [-0.2, -0.3, 0.26, 0.5, 0.5, 0.5],
          [0.26, 0.1, -0.3, 0.55, 0.57, 0.55],
        ]
      : [[0, 0, 0, 1, 1, 1]];
    if (naturalWoodland) {
      const positions = canopyShape.attributes.position,
        colors = new Float32Array(positions.count * 3);
      for (let i = 0; i < positions.count; i++) {
        // Stable local-space ambient shading does not alter geometry or vary
        // with quality. The lighter upper crown reads above a quieter underside.
        const light = 0.72 + (positions.getY(i) + 1) * 0.14;
        colors.set([light, light, light], i * 3);
      }
      canopyShape.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2,
        r = radius + rng() * 24,
        height = 5 + rng() * 7;
      let x = cx + Math.cos(angle) * r,
        z = cz + Math.sin(angle) * r;
      if (groveSlots) {
        const slot = groveSlots[i],
          // Preserve both random draws, every tree height and all geometry.
          // The full crown stays at least ten metres outside one bounds face;
          // the extra tenth also covers geometry attribute float rounding.
          offset = 10.1 + height * 0.3 + slot.outward;
        if (slot.side === 'north' || slot.side === 'south') {
          x = slot.along;
          z = slot.side === 'north' ? min.z - offset : max.z + offset;
        } else {
          x = slot.side === 'west' ? min.x - offset : max.x + offset;
          z = slot.along;
        }
      }
      const trunk = mesh(new THREE.CylinderGeometry(0.14, 0.24, height * 0.7, 6), bark, backdrop);
      trunk.position.set(x, height * 0.35, z);
      trunk.castShadow = true;
      if (canopyShape) {
        const sector = Math.floor((i / count) * 8),
          paint = leaves[i % 3],
          key = `${sector}:${i % 3}`;
        if (!canopyBatches.has(key)) canopyBatches.set(key, { paint, matrices: [] });
        const radius = height * 0.3;
        const turn = organicCanopy ? i * 2.399963229728653 : 0,
          rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), turn);
        for (const [lx, ly, lz, sx, sy, sz] of crownLobes) {
          const offset = new THREE.Vector3(lx, ly, lz)
            .multiplyScalar(radius)
            .applyQuaternion(rotation);
          canopyBatches
            .get(key)
            .matrices.push(
              new THREE.Matrix4().compose(
                offset.add(new THREE.Vector3(x, height * 0.75, z)),
                rotation,
                new THREE.Vector3(sx * radius, sy * radius, sz * radius),
              ),
            );
        }
        if (branchShape) {
          if (!branchBatches.has(sector)) branchBatches.set(sector, []);
          for (const lobe of crownLobes.slice(1, 4)) {
            const start = new THREE.Vector3(x, height * 0.53, z),
              end = new THREE.Vector3(lobe[0], lobe[1], lobe[2])
                .multiplyScalar(radius)
                .applyQuaternion(rotation)
                .add(new THREE.Vector3(x, height * 0.75, z)),
              direction = end.clone().sub(start),
              length = direction.length();
            branchBatches
              .get(sector)
              .push(
                new THREE.Matrix4().compose(
                  start.add(end).multiplyScalar(0.5),
                  new THREE.Quaternion().setFromUnitVectors(
                    new THREE.Vector3(0, 1, 0),
                    direction.normalize(),
                  ),
                  new THREE.Vector3(1, length, 1),
                ),
              );
          }
        }
      } else {
        const crown = mesh(
          new THREE.ConeGeometry(height * 0.3, height * 0.75, 7),
          leaves[i % 3],
          backdrop,
        );
        crown.position.set(x, height * 0.75, z);
        crown.castShadow = true;
      }
    }
    for (const matrices of branchBatches.values()) {
      const forks = instanceSimDetails({
        shape: branchShape,
        paint: bark,
        parent: backdrop,
        matrices,
        mesh,
      });
      forks.name = 'woodland-branch-sector';
      forks.castShadow = true;
      forks.receiveShadow = false;
      forks.computeBoundingBox();
      forks.computeBoundingSphere();
    }
    for (const { paint, matrices } of canopyBatches.values()) {
      const canopy = instanceSimDetails({
        shape: canopyShape,
        paint,
        parent: backdrop,
        matrices,
        mesh,
      });
      canopy.name = 'woodland-canopy-sector';
      canopy.castShadow = true;
      canopy.receiveShadow = false;
      canopy.computeBoundingBox();
      canopy.computeBoundingSphere();
    }
  }
  buildEnvironmentDressing({
    course,
    world,
    material,
    bounds: { min, max, width, depth, cx, cz },
    theme,
    pixel,
    kit,
  });
  // Thin painted boundary markings are wayfinding, not physical barriers.
  for (const z of [min.z, max.z]) box([width, 0.012, 0.06], [cx, 0.012, z], theme.warm);
  for (const x of [min.x, max.x]) box([0.06, 0.012, depth], [x, 0.012, cz], theme.warm);
  const pad = mesh(
    new THREE.CylinderGeometry(1.3, 1.3, 0.016, 48),
    kit ? kit.paint('enamel') : material(0xe7ddbd),
  );
  pad.userData.modelRole = 'landing-pad';
  if (kit) bindSimModelRole(pad, 'landing-pad', collectionId);
  pad.position.set(course.spawn.x / 1000, course.spawn.y / 1000 + 0.016, course.spawn.z / 1000);
  const ring = mesh(new THREE.TorusGeometry(0.98, 0.065, 8, 48), material(0x354e56));
  ring.rotation.x = Math.PI / 2;
  ring.position.copy(pad.position);
  ring.position.y += 0.014;
  box(
    [0.14, 0.016, 0.8],
    [pad.position.x - 0.25, pad.position.y + 0.015, pad.position.z],
    0x354e56,
  );
  box(
    [0.14, 0.016, 0.8],
    [pad.position.x + 0.25, pad.position.y + 0.015, pad.position.z],
    0x354e56,
  );
  box([0.5, 0.016, 0.14], [pad.position.x, pad.position.y + 0.015, pad.position.z], 0x354e56);
  if (kit) {
    const bolts = [];
    for (let bolt = 0; bolt < 8; bolt++) {
      const angle = (bolt * Math.PI) / 4;
      bolts.push([
        pad.position.x + Math.cos(angle) * 1.17,
        pad.position.y + 0.012,
        pad.position.z + Math.sin(angle) * 1.17,
      ]);
    }
    repeatedDetail(
      new THREE.CylinderGeometry(0.035, 0.035, 0.005, 6),
      kit.paint('copper'),
      bolts,
      world,
    );
  }
  // Static perimeter details share batches across containers/buildings. Tiny
  // inset fittings receive shadows but do not add their own shadow-map pass.
  const batches = new Map();
  world.updateMatrixWorld(true);
  for (const { shape, paint, positions, target } of detailRows) {
    const root = target === world ? world : backdrop,
      key = `${root.id}:${paint.id}:${shape.type}:${JSON.stringify(shape.parameters)}`;
    if (!batches.has(key)) batches.set(key, { shape, paint, root, matrices: [] });
    const batch = batches.get(key),
      transform = new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(target.matrixWorld);
    if (shape !== batch.shape) shape.dispose();
    for (const at of positions)
      batch.matrices.push(transform.clone().multiply(new THREE.Matrix4().makeTranslation(...at)));
  }
  for (const { shape, paint, root, matrices } of batches.values())
    instanceSimDetails({ shape, paint, parent: root, matrices, mesh });
  world.userData.ownedMaterials.push(hardware);
  return {
    theme,
    profile,
    indoor,
    groundColor: floorColor,
    fogRange: adventure ? [125, 320] : null,
    backdrop,
    obstacleMap: wallMap,
    obstacleMaps: wallMaps,
    obstacleSurface,
    // Keep fittings in this world's existing material/texture ownership. The
    // Themes steel kit owns its finish; authored worlds reuse neutral hardware.
    obstacleFittingsMaterial: () => (kit ? kit.paint('steel') : hardware),
    garageDetailMaterial,
    stadiumDetailMaterial(role) {
      if (!kit) return null;
      const paint = kit.paint(role);
      world.userData.ownedMaterials.push(paint);
      return paint;
    },
    obstacleSurfaceKind(obstacle) {
      const id = obstacle.id ?? '';
      if (environment === 'stadium' && !obstacle.type && obstacle.min && obstacle.max) {
        if (id === 'stand-west' || id === 'stand-east') return 'stadium-concrete';
        if (id === 'scoreboard') return 'stadium-steel';
      }
      if (
        environment === 'garage' &&
        ((id === 'garage-ramp' && obstacle.type === 'trimesh') ||
          (/^(garage-deck|column-[01]-[0-2])$/.test(id) &&
            !obstacle.type &&
            obstacle.min &&
            obstacle.max))
      )
        return 'garage-concrete';
      if (
        warehouse &&
        /^(rack-[01]-[0-2]|school-low-stack|school-overhead-beam|school-aisle-divider)$/.test(id) &&
        !obstacle.type &&
        obstacle.min &&
        obstacle.max
      )
        return 'storage-steel';
      if (
        environment === 'woodland' &&
        /^tree-\d+$/.test(id) &&
        !obstacle.type &&
        obstacle.min &&
        obstacle.max
      )
        return 'bark';
      if (!adventure) return null;
      if (/^(rail-gantry|rail-car|solar-hut)-/.test(id)) return 'metal';
      if (quarryStrata && isQuarryStrataObstacle(obstacle)) return 'quarry-stone';
      if (environment === 'quarry' || /^rock-/.test(id)) return 'stone';
      if (/^tree-canopy-/.test(id)) return 'foliage';
      if (/^tree-trunk-|timber|crate/.test(id)) return 'wood';
      if (/^solar-panel-/.test(id)) return 'solar';
      if (/^building-/.test(id)) return 'plaster';
      if (/pier|deck|tower|platform|column|ramp/.test(id)) return 'concrete';
      return 'metal';
    },
    center: [cx, cz],
    width,
    depth,
    setQuality(value) {
      surfaceDetail.visible = value === 'high';
    },
  };
}

/** Closed lantern panes and paint stay on the four faces of the existing tower. */
export function buildCoastLighthouseGeometry(obstacle) {
  if (
    obstacle?.id !== 'coast-tower-lighthouse' ||
    obstacle.type !== undefined ||
    obstacle.rotation !== undefined ||
    !['x', 'y', 'z'].every(
      (axis, index) =>
        Number.isFinite(obstacle.min?.[axis]) &&
        Number.isFinite(obstacle.max?.[axis]) &&
        obstacle.max[axis] - obstacle.min[axis] === [6000, 22000, 6000][index],
    )
  )
    return [];
  const min = Object.fromEntries(
      Object.entries(obstacle.min).map(([key, value]) => [key, value / 1000]),
    ),
    max = Object.fromEntries(
      Object.entries(obstacle.max).map(([key, value]) => [key, value / 1000]),
    ),
    cx = (min.x + max.x) / 2,
    cz = (min.z + max.z) / 2,
    batches = new Map(),
    points = [
      (u, y) => [cx + u, min.y + y, max.z],
      (u, y) => [max.x, min.y + y, cz - u],
      (u, y) => [cx - u, min.y + y, min.z],
      (u, y) => [min.x, min.y + y, cz + u],
    ],
    rectangle = (role, point, left, bottom, right, top) => {
      if (!batches.has(role)) batches.set(role, { positions: [], uv: [] });
      const row = batches.get(role),
        corners = [
          [left, bottom],
          [right, bottom],
          [right, top],
          [left, top],
        ];
      for (const index of [0, 1, 2, 0, 2, 3]) {
        const [u, y] = corners[index];
        row.positions.push(...point(u, y));
        row.uv.push(u / 4, y / 4);
      }
    };
  for (const point of points) {
    rectangle('shell', point, -3, 0, 3, 22);
    for (const bottom of [4.5, 9.5, 14.5, 21])
      rectangle('band', point, -3, bottom, 3, Math.min(bottom + 1.3, 22));
    rectangle('pane', point, -2.35, 18.3, 2.35, 20.7);
    for (const bottom of [18.3, 20.58])
      rectangle('trim', point, -2.35, bottom, 2.35, bottom + 0.12);
    for (const left of [-2.35, -1.2, -0.06, 1.08, 2.23])
      rectangle('trim', point, left, 18.3, left + 0.12, 20.7);
  }
  // A closed, solid service door faces the harbour. It never suggests a tunnel.
  rectangle('pane', points[0], -0.85, 0.05, 0.85, 2.8);
  rectangle('trim', points[0], 0.54, 1.1, 0.62, 1.42);
  return [...batches].map(([role, { positions, uv }]) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.computeVertexNormals();
    return { role, layer: ['shell', 'band', 'pane', 'trim'].indexOf(role) + 1, geometry };
  });
}

/** Original closed-house artwork, flush with the authored box faces.
 * No recess, porch, roof extension or pane is presented as a flyable opening. */
export function buildCourtyardFacadeGeometry(course) {
  if (course?.environment !== 'courtyard') return [];
  const batches = new Map();
  for (const obstacle of course.obstacles ?? []) {
    const expected =
      obstacle.id === 'house-west' ? [8, 8, 20] : obstacle.id === 'house-east' ? [8, 7, 26] : null;
    if (!expected || obstacle.type || obstacle.rotation || !obstacle.min || !obstacle.max) continue;
    const min = ['x', 'y', 'z'].map((axis) => obstacle.min[axis] / 1000),
      max = ['x', 'y', 'z'].map((axis) => obstacle.max[axis] / 1000);
    if (
      ![...min, ...max].every(Number.isFinite) ||
      expected.some((size, axis) => Math.abs(max[axis] - min[axis] - size) > 1e-8)
    )
      continue;
    const [width, height, depth] = expected,
      center = min.map((value, axis) => (value + max[axis]) / 2);
    for (let side = 0; side < 4; side++) {
      const span = side % 2 ? width : depth,
        // Each local face runs left to right as viewed from outside, so its
        // triangles are front-facing without a double-sided material.
        point = (u, v) =>
          side === 0
            ? [max[0], min[1] + v, center[2] - u]
            : side === 1
              ? [center[0] + u, min[1] + v, max[2]]
              : side === 2
                ? [min[0], min[1] + v, center[2] + u]
                : [center[0] - u, min[1] + v, min[2]],
        polygon = (finish, points) => {
          if (!batches.has(finish)) batches.set(finish, { positions: [], uv: [] });
          const batch = batches.get(finish);
          for (let i = 1; i < points.length - 1; i++)
            for (const index of [0, i, i + 1]) {
              const p = point(...points[index]);
              batch.positions.push(...p);
              batch.uv.push((side % 2 ? p[0] : p[2]) / 3, p[1] / 3);
            }
        },
        rectangle = (finish, left, bottom, right, top) =>
          polygon(finish, [
            [left, bottom],
            [right, bottom],
            [right, top],
            [left, top],
          ]),
        frame = (finish, left, bottom, right, top, stroke) => {
          rectangle(finish, left, bottom, right, bottom + stroke);
          rectangle(finish, left, top - stroke, right, top);
          rectangle(finish, left, bottom + stroke, left + stroke, top - stroke);
          rectangle(finish, right - stroke, bottom + stroke, right, top - stroke);
        };
      rectangle('plinth', -span / 2, 0, span / 2, 0.56);
      rectangle('trim', -span / 2, 0.56, span / 2, 0.66);
      rectangle('roof', -span / 2, height - 0.3, span / 2, height);
      rectangle('trim', -span / 2, height - 0.48, span / 2, height - 0.3);
      for (const x of [-span / 2, span / 2 - 0.18])
        rectangle('trim', x, 0.66, x + 0.18, height - 0.48);
      // Match renderObstacle's existing plaster-window grid. The new panes
      // cover those opaque marks at every preset instead of drawing a second,
      // misaligned set of windows over them. Old marks use offset layer 2.
      const columns = Math.max(1, Math.min(5, Math.floor(span / 2.4))),
        pitch = span / columns,
        entrySide = obstacle.id === 'house-west' ? side === 0 : side === 2,
        entryColumn = Math.floor(columns / 2);
      for (let column = 0; column < columns; column++) {
        const x = (column + 0.5 - columns / 2) * pitch;
        for (let floor = 0; floor < Math.min(3, Math.floor(height / 2.2)); floor++) {
          if (entrySide && column === entryColumn && floor === 0) continue;
          const bottom = 1.4 + floor * 2.2 - 0.575,
            top = bottom + 1.15,
            left = x - 0.73,
            right = x + 0.73;
          rectangle('accent', left - 0.13, bottom - 0.14, right + 0.13, top + 0.14);
          rectangle('window', left, bottom, right, top);
          frame('trim', left, bottom, right, top, 0.07);
          rectangle('trim', x - 0.045, bottom + 0.07, x + 0.045, top - 0.07);
          rectangle('trim', left + 0.07, top - 0.48, right - 0.07, top - 0.42);
          rectangle('trim', left - 0.2, bottom - 0.14, right + 0.2, bottom - 0.06);
        }
      }
      if (entrySide) {
        // Opaque timber leaves, separate panel lines and a visible handle make
        // the entrance read as closed. The geometric border is original paint.
        const left = -0.78,
          right = 0.78;
        rectangle('door', left, 0.08, right, 2.42);
        frame('trim', left - 0.13, 0.08, right + 0.13, 2.55, 0.13);
        rectangle('accent', -0.026, 0.14, 0.026, 2.36);
        for (const x of [-0.69, 0.1]) {
          frame('accent', x, 0.25, x + 0.59, 1.2, 0.045);
          frame('accent', x, 1.4, x + 0.59, 2.25, 0.045);
        }
        rectangle('trim', 0.12, 1.18, 0.18, 1.43);
        rectangle('accent', -1.08, 2.6, 1.08, 2.84);
        for (let i = -2; i <= 2; i++) {
          const x = i * 0.37;
          polygon('trim', [
            [x, 2.63],
            [x + 0.1, 2.72],
            [x, 2.81],
            [x - 0.1, 2.72],
          ]);
        }
      }
    }
  }
  return [...batches].map(([finish, { positions, uv }]) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return { finish, geometry };
  });
}

/** Bay paint sits exactly on the inward face of the two generated Hangar walls. */
export function buildHangarBayGeometry([width, height, depth], side) {
  if (
    !['north', 'south'].includes(side) ||
    ![width, height, depth].every(Number.isFinite) ||
    width < 20 ||
    height < 4 ||
    depth <= 0
  )
    return [];
  const batches = new Map(),
    direction = side === 'north' ? 1 : -1,
    point = (x, y) => [x * direction, y - height / 2, (depth * direction) / 2],
    rectangle = (role, left, bottom, right, top) => {
      if (!batches.has(role)) batches.set(role, []);
      const points = [
        point(left, bottom),
        point(right, bottom),
        point(right, top),
        point(left, top),
      ];
      for (const index of [0, 1, 2, 0, 2, 3]) batches.get(role).push(...points[index]);
    },
    digits = [
      '111101101101111',
      '010110010010111',
      '110001010100111',
      '110001010001110',
      '101101111001001',
      '111100110001110',
      '011100110101010',
      '111001010010010',
      '111101111101111',
      '111101111001110',
    ];
  for (let bay = 0; bay < 4; bay++) {
    const x = (width - 1) * ((bay + 0.5) / 4 - 0.5),
      label = String(bay + (side === 'north' ? 1 : 5)).padStart(2, '0');
    rectangle('rubber', x - 0.75, 2.5, x + 0.75, 3.7);
    for (let digit = 0; digit < label.length; digit++)
      for (let row = 0; row < 5; row++)
        for (let column = 0; column < 3; column++)
          if (digits[Number(label[digit])][row * 3 + column] === '1') {
            const left = x - 0.53 + digit * 0.58 + column * 0.15,
              top = 3.5 - row * 0.15;
            rectangle('enamel', left, top - 0.15, left + 0.15, top);
          }
    rectangle('enamel', x - 0.43, 2.59, x + 0.43, 2.64);
    // A painted service-cover outline and vents give the blank wall scale.
    // These closed marks do not depict a doorway or change its physical face.
    const left = x + 1.3,
      right = x + 2.65,
      bottom = 2.14,
      top = 3.6,
      stroke = 0.035;
    rectangle('rubber', left, bottom, right, bottom + stroke);
    rectangle('rubber', left, top - stroke, right, top);
    rectangle('rubber', left, bottom + stroke, left + stroke, top - stroke);
    rectangle('rubber', right - stroke, bottom + stroke, right, top - stroke);
    for (let vent = 0; vent < 4; vent++)
      rectangle('rubber', left + 0.26, 3.3 - vent * 0.14, right - 0.26, 3.33 - vent * 0.14);
    rectangle('rubber', right - 0.2, 2.55, right - 0.14, 2.82);
  }
  return [...batches].map(([role, positions]) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    const uv = [];
    for (let i = 0; i < positions.length; i += 3) uv.push(positions[i] / 6, positions[i + 1] / 3);
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    return { role, layer: role === 'rubber' ? 1 : 2, geometry };
  });
}

/** Cosmetic meshes share one draw call and the parent's existing transform. */
export function instanceSimDetails({ shape, paint, parent, matrices, mesh }) {
  const registered = mesh(shape, paint, parent);
  parent.remove(registered);
  const value = new THREE.InstancedMesh(shape, paint, matrices.length);
  // mesh() may register shadow materials against the temporary mesh. Keep
  // those owners reachable after replacement, including drone/gate batches
  // that do not get a later world traversal.
  value.customDepthMaterial = registered.customDepthMaterial;
  value.customDistanceMaterial = registered.customDistanceMaterial;
  matrices.forEach((matrix, index) => value.setMatrixAt(index, matrix));
  value.instanceMatrix.needsUpdate = true;
  value.userData.cosmeticDetail = true;
  value.castShadow = false;
  value.receiveShadow = true;
  parent.add(value);
  return value;
}

/** Opaque paint on the existing Garage solids; never a rail or a new support. */
export function buildGarageSurfaceGeometry(obstacle) {
  const batches = new Map();
  const quad = (role, layer, points) => {
    const key = `${role}:${layer}`;
    if (!batches.has(key)) batches.set(key, { role, layer, positions: [] });
    const positions = batches.get(key).positions;
    for (const index of [0, 1, 2, 0, 2, 3]) positions.push(...points[index]);
  };
  const rectangle = (role, layer, point, left, bottom, right, top) =>
    quad(role, layer, [
      point(left, bottom),
      point(right, bottom),
      point(right, top),
      point(left, top),
    ]);
  if (obstacle.id === 'garage-ramp' && obstacle.type === 'trimesh') {
    const values = obstacle.vertices,
      triangles = [0, 2, 1, 1, 2, 3, 0, 4, 2, 1, 3, 5, 2, 4, 3, 3, 4, 5, 0, 1, 4, 1, 5, 4];
    if (
      !Array.isArray(values) ||
      values.length !== 18 ||
      !values.every(Number.isFinite) ||
      triangles.some((value, index) => obstacle.indices?.[index] !== value) ||
      obstacle.indices?.length !== triangles.length
    )
      return [];
    const [left, bottom, toe, right, , , , top, crest] = values,
      expected = [
        left,
        bottom,
        toe,
        right,
        bottom,
        toe,
        left,
        top,
        crest,
        right,
        top,
        crest,
        left,
        bottom,
        crest,
        right,
        bottom,
        crest,
      ];
    if (
      values.some((value, index) => value !== expected[index]) ||
      ![right - left, top - bottom, toe - crest].every((size) => size >= 1000 && size <= 200000)
    )
      return [];
    const width = (right - left) / 1000,
      run = (toe - crest) / 1000,
      point = (x, z) => [
        left / 1000 + x,
        bottom / 1000 + ((top - bottom) / 1000) * (z / run),
        toe / 1000 - z,
      ];
    // Leave the route's centre unpainted. Edge bands meet the deck without a
    // transverse stop line that could make the continuous crest look blocked.
    for (const x of [0.18, width - 0.34]) {
      rectangle('enamel', 2, point, x, 0, x + 0.16, run);
      for (let z = 2; z < run - 1; z += 4)
        rectangle(
          'enamel',
          2,
          point,
          x < width / 2 ? x + 0.16 : x - 0.3,
          z,
          x < width / 2 ? x + 0.46 : x,
          z + 0.12,
        );
    }
  } else if (
    /^(garage-deck|column-[01]-[0-2])$/.test(obstacle.id ?? '') &&
    !obstacle.type &&
    obstacle.min &&
    obstacle.max
  ) {
    const size = ['x', 'y', 'z'].map((axis) => (obstacle.max[axis] - obstacle.min[axis]) / 1000);
    if (!size.every((value) => Number.isFinite(value) && value >= 0.2 && value <= 200)) return [];
    const [width, height, depth] = size,
      sidePoint = (side) => (x, y) => {
        if (side === 0) return [x, y, depth / 2];
        if (side === 1) return [-x, y, -depth / 2];
        if (side === 2) return [width / 2, y, -x];
        return [-width / 2, y, x];
      };
    if (obstacle.id === 'garage-deck') {
      if (width < 2 || depth < 2) return [];
      const topPoint = (x, z) => [x, height / 2, -z];
      for (const x of [-width / 2 + 0.18, width / 2 - 0.34])
        rectangle('enamel', 2, topPoint, x, -depth / 2, x + 0.16, depth / 2 - 0.18);
      rectangle(
        'enamel',
        2,
        topPoint,
        -width / 2 + 0.18,
        depth / 2 - 0.34,
        width / 2 - 0.18,
        depth / 2 - 0.18,
      );
      // A thin fascia marks the slab's real thickness; the ramp-facing seam
      // remains free of a false barrier. No underside paint obscures clearance.
      for (const side of [1, 2, 3]) {
        const span = side < 2 ? width : depth;
        rectangle('enamel', 2, sidePoint(side), -span / 2, -height * 0.12, span / 2, height * 0.3);
      }
    } else {
      if (width < 1 || depth < 1 || height < 3) return [];
      const match = obstacle.id.match(/^column-([01])-([0-2])$/),
        number = Number(match[1]) * 3 + Number(match[2]),
        glyph = [
          '010110010010111',
          '110001010100111',
          '110001010001110',
          '101101111001001',
          '111100110001110',
          '011100110101010',
        ][number];
      for (let side = 0; side < 4; side++) {
        const span = side < 2 ? width : depth,
          point = sidePoint(side),
          bottom = -height / 2;
        rectangle('rubber', 1, point, -span / 2, bottom + 0.08, span / 2, bottom + 0.72);
        rectangle('enamel', 2, point, -span / 2, bottom + 0.65, span / 2, bottom + 0.72);
        rectangle('rubber', 1, point, -0.29, bottom + 1.74, 0.29, bottom + 2.42);
        for (let row = 0; row < 5; row++)
          for (let column = 0; column < 3; column++)
            if (glyph[row * 3 + column] === '1')
              rectangle(
                'enamel',
                2,
                point,
                -0.15 + column * 0.1,
                bottom + 2.31 - (row + 1) * 0.09,
                -0.15 + (column + 1) * 0.1,
                bottom + 2.31 - row * 0.09,
              );
      }
    }
  }
  return [...batches.values()].map(({ role, layer, positions }) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    const normals = geometry.getAttribute('normal'),
      origin = ['x', 'y', 'z'].map((axis) =>
        obstacle.type === 'trimesh' ? 0 : (obstacle.max[axis] + obstacle.min[axis]) / 2000,
      ),
      uv = new Float32Array((positions.length / 3) * 2);
    for (let index = 0; index < normals.count; index++) {
      const x = positions[index * 3] + origin[0],
        y = positions[index * 3 + 1] + origin[1],
        z = positions[index * 3 + 2] + origin[2],
        nx = Math.abs(normals.getX(index)),
        ny = Math.abs(normals.getY(index)),
        nz = Math.abs(normals.getZ(index));
      // Use the body's world projection even though each box stores local
      // vertices. Ramp and deck paint must have the same phase at their crest.
      uv[index * 2] = (nx > ny && nx > nz ? z : x) / 6;
      uv[index * 2 + 1] = (ny >= nx && ny >= nz ? z : y) / 6;
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return { role, layer, geometry };
  });
}

/** Painted facility detail, coplanar with the three canonical Stadium solids.
 * Role batches retain the solid contact faces and add no silhouette or opening. */
export function buildStadiumStructureGeometry(id, [width, height, depth]) {
  if (!['stand-west', 'stand-east', 'scoreboard'].includes(id)) return [];
  if (![width, height, depth].every((value) => Number.isFinite(value) && value > 0)) return [];
  const batches = new Map();
  function panel(role, layer, side, along, elevation, span, tall) {
    const key = `${role}:${layer}`;
    if (!batches.has(key)) batches.set(key, { role, layer, positions: [], normals: [], uvs: [] });
    const row = batches.get(key),
      half = (side < 2 ? depth : width) / 2,
      normal = [
        [0, 0, 1],
        [0, 0, -1],
        [1, 0, 0],
        [-1, 0, 0],
      ][side];
    for (const [u, v] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      const a = along + (u * span) / 2,
        y = elevation + (v * tall) / 2;
      row.positions.push(
        ...(side === 0
          ? [a, y, half]
          : side === 1
            ? [-a, y, -half]
            : side === 2
              ? [half, y, -a]
              : [-half, y, a]),
      );
      row.normals.push(...normal);
      row.uvs.push(a / 6, y / 3);
    }
  }
  const glyphs = {
    1: '010110010010111',
    2: '110001010100111',
    3: '110001010001110',
    4: '101101111001001',
    5: '111100110001110',
    6: '011100110101010',
    7: '111001010010010',
    8: '010101010101010',
    F: '111100110100100',
    P: '110101110100100',
    V: '101101101101010',
  };
  function glyph(letter, side, x, y, unit) {
    for (let row = 0; row < 5; row++)
      for (let column = 0; column < 3; column++)
        if (glyphs[letter][row * 3 + column] === '1')
          panel(
            'enamel',
            2,
            side,
            x + (column - 1) * unit,
            y + (2 - row) * unit,
            unit * 0.86,
            unit * 0.86,
          );
  }
  if (id !== 'scoreboard') {
    const bays = Math.max(1, Math.min(8, Math.floor(depth / 6))),
      pitch = depth / bays,
      pier = Math.min(0.18, pitch * 0.04),
      numeral = Math.min(0.12, pitch / 16, height / 30);
    for (const side of [2, 3]) {
      panel('steel', 1, side, 0, -height * 0.44, depth, height * 0.075);
      panel('steel', 1, side, 0, height * 0.455, depth, height * 0.045);
      for (let i = 1; i < bays; i++)
        panel('steel', 1, side, -depth / 2 + i * pitch, 0, pier, height * 0.86);
      for (let i = 0; i < bays; i++) {
        const along = -depth / 2 + (i + 0.5) * pitch;
        // Shallow tier bands and small section plates read as a closed stand
        // facade. No painted black doorway suggests a nonexistent flight gap.
        for (const y of [0.16, 0.3])
          panel('enamel', 2, side, along, height * y, pitch - pier * 2, height * 0.014);
        panel('steel', 1, side, along, -height * 0.2, numeral * 7, numeral * 7);
        glyph(i + 1, side, along, -height * 0.2, numeral);
      }
    }
    for (const side of [0, 1]) {
      panel('steel', 1, side, 0, -height * 0.44, width, height * 0.075);
      panel('steel', 1, side, 0, height * 0.455, width, height * 0.045);
      for (const y of [0.16, 0.3])
        panel('enamel', 2, side, 0, height * y, width * 0.88, height * 0.014);
    }
  } else {
    const screenWidth = width * 0.86,
      screenHeight = height * 0.52,
      screenY = height * 0.16,
      rim = Math.min(width * 0.014, height * 0.022);
    panel('rubber', 1, 0, 0, screenY, screenWidth, screenHeight);
    for (const side of [-1, 1]) {
      panel(
        'steel',
        1,
        0,
        side * (screenWidth / 2 + rim / 2),
        screenY,
        rim,
        screenHeight + rim * 2,
      );
      panel('steel', 1, 0, 0, screenY + side * (screenHeight / 2 + rim / 2), screenWidth, rim);
    }
    // Static FPV sign and idle --:-- display; this is never a race clock,
    // live score, objective or input to the simulation.
    const unit = Math.min(width / 42, height / 35);
    for (const [i, letter] of ['F', 'P', 'V'].entries())
      glyph(letter, 0, (i - 1) * unit * 4.5, height * 0.285, unit);
    for (const x of [-0.28, -0.13, 0.13, 0.28])
      panel('enamel', 2, 0, width * x, height * 0.065, width * 0.095, height * 0.025);
    for (const y of [0.025, 0.105]) panel('enamel', 2, 0, 0, height * y, unit * 0.8, unit * 0.8);
    panel('steel', 1, 0, 0, -height * 0.33, width * 0.88, height * 0.028);
    for (let slot = 0; slot < 7; slot++)
      panel('rubber', 1, 1, 0, height * (0.1 + slot * 0.035), width * 0.66, height * 0.01);
  }
  return [...batches.values()].map(({ role, layer, positions, normals, uvs }) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    return { role, layer, geometry };
  });
}

/** Closed visual steelwork stays inside the authored container collision box. */
export function buildContainerVisualGeometry([width, height, depth]) {
  if (
    ![width, height, depth].every((value) => Number.isFinite(value) && value >= 1 && value <= 200)
  )
    throw new TypeError('Invalid visual container dimensions.');
  const positions = [],
    fittings = [];
  const quad = (a, b, c, d) => positions.push(...a, ...b, ...c, ...a, ...c, ...d);
  const layers = Math.max(1, Math.min(2, Math.round(height / 2.6))),
    layerHeight = height / layers;
  const fitting = (size, at) => {
    const indexed = new THREE.BoxGeometry(...size),
      shape = indexed.toNonIndexed();
    indexed.dispose();
    shape.translate(...at);
    fittings.push(shape);
  };
  for (let layer = 0; layer < layers; layer++) {
    const bottom = -height / 2 + layer * layerHeight,
      top = bottom + layerHeight,
      centre = (bottom + top) / 2;
    for (let side = 0; side < 4; side++) {
      const end = side < 2,
        span = end ? width : depth;
      const across = end
        ? [-span / 2, -span / 2 + 0.14, -0.055, -0.012, 0.012, 0.055, span / 2 - 0.14, span / 2]
        : [-span / 2, -span / 2 + 0.16];
      const recess = end ? [0, 0.045, 0.045, 0.062, 0.062, 0.045, 0.045, 0] : [0, 0];
      if (!end) {
        const ribs = Math.min(24, Math.max(4, Math.round((span - 0.32) / 0.55))),
          pitch = (span - 0.32) / ribs;
        for (let rib = 0; rib < ribs; rib++)
          for (const [fraction, inset] of [
            [0.18, 0],
            [0.34, 0.038],
            [0.7, 0.038],
            [0.86, 0],
          ]) {
            across.push(-span / 2 + 0.16 + (rib + fraction) * pitch);
            recess.push(inset);
          }
        across.push(span / 2 - 0.16, span / 2);
        recess.push(0, 0);
      }
      const elevations = [bottom, bottom + 0.13, top - 0.13, top];
      const point = (u, v) => {
        const along = across[u],
          y = elevations[v],
          inset = v === 0 || v === 3 ? 0 : recess[u];
        if (side === 0) return [along, y, depth / 2 - inset];
        if (side === 1) return [-along, y, -depth / 2 + inset];
        if (side === 2) return [width / 2 - inset, y, -along];
        return [-width / 2 + inset, y, along];
      };
      for (let u = 0; u < across.length - 1; u++)
        for (let v = 0; v < elevations.length - 1; v++)
          quad(point(u, v), point(u + 1, v), point(u + 1, v + 1), point(u, v + 1));
    }
    quad(
      [-width / 2, top, depth / 2],
      [width / 2, top, depth / 2],
      [width / 2, top, -depth / 2],
      [-width / 2, top, -depth / 2],
    );
    quad(
      [-width / 2, bottom, -depth / 2],
      [width / 2, bottom, -depth / 2],
      [width / 2, bottom, depth / 2],
      [-width / 2, bottom, depth / 2],
    );
    for (const x of [-1, 1])
      for (const z of [-1, 1])
        for (const y of [-1, 1])
          fitting(
            [0.18, 0.16, 0.18],
            [x * (width / 2 - 0.09), centre + y * (layerHeight / 2 - 0.08), z * (depth / 2 - 0.09)],
          );
    for (const end of [-1, 1]) {
      // The doors are closed opaque geometry. Locks sit in the recessed face,
      // never outside the original collision envelope or across a flyable gap.
      for (const x of [-0.32, -0.18, 0.18, 0.32])
        fitting([0.045, layerHeight - 0.38, 0.03], [x * width, centre, end * (depth / 2 - 0.023)]);
      for (const x of [-1, 1]) {
        fitting([0.32, 0.05, 0.038], [x * width * 0.18, centre - 0.18, end * (depth / 2 - 0.024)]);
        for (const y of [-0.3, 0.3])
          fitting(
            [0.22, 0.08, 0.022],
            [x * (width / 2 - 0.16), centre + y * layerHeight, end * (depth / 2 - 0.016)],
          );
      }
    }
  }
  const shell = new THREE.BufferGeometry();
  shell.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  shell.computeVertexNormals();
  const hardware = new THREE.BufferGeometry();
  for (const attribute of ['position', 'normal', 'uv']) {
    const values = [];
    for (const shape of fittings) values.push(...shape.getAttribute(attribute).array);
    hardware.setAttribute(
      attribute,
      new THREE.Float32BufferAttribute(values, attribute === 'uv' ? 2 : 3),
    );
  }
  for (const shape of fittings) shape.dispose();
  return { shell, hardware };
}

export function buildDroneVisual({
  parent,
  mesh,
  material,
  box,
  kind = 'racer',
  profile = null,
  quality = 'balanced',
  maxAnisotropy = 1,
  collectionId = simCollectionIdForProfile(profile),
}) {
  const pixel = kind === 'pixel',
    utility = kind === 'utility',
    detail = quality === 'high' && !pixel,
    rotors = [];
  const kit = collectionId
    ? createWorkshopMaterials({ material, quality, maxAnisotropy, collectionId })
    : null;
  parent.userData.modelRole = `drone-${kind}`;
  parent.userData.collectionId = collectionId ?? 'authored';
  if (kit) {
    bindSimModelRole(parent, 'drone', collectionId);
    parent.userData.droneKind = kind;
  }
  const carbon = !kit && !pixel && quality !== 'low' ? surfaceMaps('carbon', 0x283139) : {};
  const dark = kit
    ? kit.paint('rubber')
    : material(pixel ? 0x293348 : 0x202b33, {
        ...carbon,
        metalness: pixel ? 0.18 : 0,
        roughness: pixel ? 0.72 : 0.56,
        normalScale: new THREE.Vector2(0.15, 0.15),
      });
  const shell = kit
    ? kit.paint('steel')
    : material(pixel ? 0x60e1d6 : utility ? 0x59636a : 0x667277, {
        metalness: pixel ? 0.18 : 0.04,
        roughness: pixel ? 0.4 : 0.6,
      });
  const tint = material(
    kit
      ? getSimVisualCollection(collectionId).materials.enamel.color
      : pixel
        ? 0xf3a870
        : utility
          ? 0xcbd8d0
          : 0xdde8df,
    {
      emissive: pixel ? 0x944a21 : 0,
      emissiveIntensity: pixel ? 0.25 : 0,
      ...(pixel ? {} : { roughness: 0.48, metalness: 0 }),
    },
  );
  const alloy = kit ? kit.paint('steel') : material(0x9eacb1, { metalness: 0.82, roughness: 0.28 });
  const rubber = kit ? kit.paint('rubber') : material(0x171d23, { roughness: 0.94 });
  const copper = kit
    ? kit.paint('copper')
    : detail
      ? material(0xbb7349, { metalness: 0.8, roughness: 0.3 })
      : shell;
  parent.userData.ownedMaterials = [dark, shell, tint, alloy, rubber, copper];
  const part = (shape, paint, at) => {
    const value = mesh(shape, paint, parent);
    value.position.set(...at);
    value.castShadow = true;
    return value;
  };
  // Original small solid meshes, built locally. These change appearance only;
  // motor centres, rotor clocks and the flight collision sphere stay unchanged.
  const plate = (points, thickness) => {
    const outline = new THREE.Shape();
    points.forEach(([x, z], index) => (index ? outline.lineTo(x, z) : outline.moveTo(x, z)));
    outline.closePath();
    const shape = new THREE.ExtrudeGeometry(outline, {
      depth: thickness,
      bevelEnabled: false,
      steps: 1,
    });
    shape.rotateX(Math.PI / 2);
    shape.translate(0, thickness / 2, 0);
    return shape;
  };
  const chamferedCase = (width, height, depth, bevel) => {
    const x = width / 2,
      z = depth / 2;
    return plate(
      [
        [-x + bevel, -z],
        [x - bevel, -z],
        [x, -z + bevel],
        [x, z - bevel],
        [x - bevel, z],
        [-x + bevel, z],
        [-x, z - bevel],
        [-x, -z + bevel],
      ],
      height,
    );
  };
  const strap = () => {
    const outline = new THREE.Shape();
    outline.moveTo(-0.029, -0.017);
    outline.lineTo(0.029, -0.017);
    outline.lineTo(0.029, 0.017);
    outline.lineTo(-0.029, 0.017);
    outline.closePath();
    const opening = new THREE.Path();
    opening.moveTo(-0.02725, -0.01575);
    opening.lineTo(-0.02725, 0.01575);
    opening.lineTo(0.02725, 0.01575);
    opening.lineTo(0.02725, -0.01575);
    opening.closePath();
    outline.holes.push(opening);
    const shape = new THREE.ExtrudeGeometry(outline, {
      depth: 0.012,
      bevelEnabled: false,
      steps: 1,
    });
    shape.translate(0, 0, -0.006);
    return shape;
  };
  const propeller = (handedness) => {
    // A swept tip stays inside its radius. Utility props fit the existing guard;
    // Racer's larger disc remains inside the existing 0.22 m collision sphere.
    const radius = utility ? 0.059 : 0.07;
    const blade = [
      [-0.065, 0.1],
      [0.075, 0.1],
      [0.16, 0.22],
      [0.235, 0.44],
      [0.22, 0.64],
      [0.15, 0.83],
      [0.05, 0.97],
      [-0.005, 0.995],
      [-0.07, 0.965],
      [-0.12, 0.83],
      [-0.135, 0.61],
      [-0.12, 0.38],
      [-0.1, 0.22],
    ];
    const outlines = [];
    for (let index = 0; index < 3; index++) {
      const angle = (index * Math.PI * 2) / 3,
        outline = new THREE.Shape();
      blade.forEach(([across, along], vertex) => {
        const x = across * radius * handedness,
          z = along * radius;
        const u = x * Math.cos(angle) + z * Math.sin(angle),
          v = z * Math.cos(angle) - x * Math.sin(angle);
        vertex ? outline.lineTo(u, v) : outline.moveTo(u, v);
      });
      outline.closePath();
      outlines.push(outline);
    }
    const shape = new THREE.ExtrudeGeometry(outlines, {
      depth: 0.0018,
      bevelEnabled: false,
      steps: 1,
    });
    shape.rotateX(Math.PI / 2);
    shape.translate(0, 0.0009, 0);
    // A modest blade pitch gives real thickness/specular definition obliquely;
    // it is geometry, not blur or an amplified motor/control signal.
    const points = shape.getAttribute('position');
    for (let i = 0; i < points.count; i++) {
      const x = points.getX(i),
        z = points.getZ(i),
        angle = Math.atan2(x, z),
        sector = Math.round(angle / ((Math.PI * 2) / 3)),
        turn = (sector * Math.PI * 2) / 3,
        across = x * Math.cos(turn) - z * Math.sin(turn),
        along = x * Math.sin(turn) + z * Math.cos(turn);
      points.setY(i, points.getY(i) + handedness * across * (0.38 - (0.18 * along) / radius));
    }
    shape.computeVertexNormals();
    return shape;
  };
  const frame = () => {
    if (pixel) return new THREE.BoxGeometry(0.17, 0.012, 0.15);
    const outline = new THREE.Shape();
    outline.moveTo(-0.046, -0.052);
    outline.lineTo(-0.03, -0.083);
    outline.lineTo(0.03, -0.083);
    outline.lineTo(0.046, -0.052);
    outline.lineTo(0.043, 0.05);
    outline.lineTo(0.031, 0.08);
    outline.lineTo(-0.031, 0.08);
    outline.lineTo(-0.043, 0.05);
    outline.closePath();
    const geometry = new THREE.ExtrudeGeometry(outline, {
      depth: 0.004,
      bevelEnabled: quality !== 'low',
      bevelSegments: 1,
      steps: 1,
      bevelSize: 0.001,
      bevelThickness: 0.0006,
    });
    geometry.rotateX(Math.PI / 2);
    return geometry;
  };
  part(frame(), dark, [0, pixel ? -0.005 : -0.002, 0]);
  part(frame(), dark, [0, pixel ? 0.027 : 0.025, 0]);
  for (const x of pixel ? [-0.047, 0.047] : [-0.032, 0.032])
    for (const z of [-0.055, 0.055])
      part(
        new THREE.CylinderGeometry(
          pixel ? 0.004 : 0.0028,
          pixel ? 0.004 : 0.0028,
          0.024,
          pixel ? 4 : 8,
        ),
        alloy,
        [x, pixel ? 0.01 : 0.0095, z],
      );
  const battery = part(
    pixel ? new THREE.BoxGeometry(0.12, 0.045, 0.13) : chamferedCase(0.054, 0.031, 0.116, 0.005),
    shell,
    [0, pixel ? 0.038 : 0.0425, 0.016],
  );
  battery.name = 'drone-battery';
  for (const z of [-0.014, 0.054])
    part(pixel ? new THREE.BoxGeometry(0.124, 0.049, 0.015) : strap(), rubber, [
      0,
      pixel ? 0.038 : 0.0425,
      z,
    ]);
  part(
    new THREE.BoxGeometry(pixel ? 0.045 : 0.031, pixel ? 0.002 : 0.001, pixel ? 0.037 : 0.038),
    tint,
    [0, pixel ? 0.0615 : 0.0585, 0.018],
  );
  if (detail) {
    for (const z of [-0.053, 0.047])
      for (const x of [-0.036, 0.036])
        part(new THREE.CylinderGeometry(0.003, 0.003, 0.002, 8), alloy, [x, 0.0258, z]);
    for (let cell = 0; cell < 4; cell++)
      part(new THREE.BoxGeometry(0.001, 0.019, 0.009), alloy, [
        0.027,
        0.0425,
        -0.025 + cell * 0.024,
      ]);
    const lead = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.019, 0.043, 0.074),
      new THREE.Vector3(0.045, 0.034, 0.097),
      new THREE.Vector3(0.043, 0.012, 0.055),
    ]);
    part(new THREE.TubeGeometry(lead, 8, 0.0025, 5, false), material(0xb8513e), [0, 0, 0]);
    part(new THREE.BoxGeometry(0.016, 0.01, 0.017), material(0xe9ba57), [0.043, 0.013, 0.053]);
  }
  const armShape = pixel
    ? null
    : plate(
        [
          [-0.009, -0.075],
          [0.009, -0.075],
          [0.008, -0.025],
          [0.007, 0.074],
          [-0.007, 0.074],
          [-0.008, -0.025],
        ],
        0.0065,
      );
  const propShapes = pixel ? null : [propeller(-1), propeller(1)];
  const windings = [];
  const motorBell = pixel
    ? null
    : new THREE.LatheGeometry(
        [
          [0, -0.009],
          [0.015, -0.009],
          [0.018, -0.006],
          [0.018, 0.004],
          [0.016, 0.008],
          [0.01, 0.01],
          [0.006, 0.012],
          [0, 0.012],
        ].map(([r, y]) => new THREE.Vector2(r, y)),
        detail ? 20 : 12,
      );
  if (motorBell) {
    const vertices = motorBell.getAttribute('position'),
      indices = motorBell.index.array,
      kept = [],
      segments = detail ? 20 : 12;
    for (let i = 0; i < indices.length; i += 3) {
      const triangle = Array.from(indices.slice(i, i + 3));
      const vent = triangle.every(
        (index) => Math.abs(Math.hypot(vertices.getX(index), vertices.getZ(index)) - 0.018) < 1e-6,
      );
      const x = triangle.reduce((n, index) => n + vertices.getX(index), 0),
        z = triangle.reduce((n, index) => n + vertices.getZ(index), 0),
        sector = Math.floor(
          ((Math.atan2(x, z) + Math.PI * 2) % (Math.PI * 2)) / ((Math.PI * 2) / segments),
        );
      if (!vent || sector % 2 === 0) kept.push(...triangle);
    }
    motorBell.setIndex(kept);
  }
  for (const x of [-0.103, 0.103])
    for (const z of [-0.103, 0.103]) {
      const arm = part(armShape ?? new THREE.BoxGeometry(0.018, 0.018, 0.15), dark, [
        x / 2,
        0,
        z / 2,
      ]);
      arm.name = 'drone-carbon-arm';
      arm.rotation.y = Math.atan2(x, z);
      const bell = part(motorBell ?? new THREE.CylinderGeometry(0.021, 0.023, 0.032, 6), alloy, [
        x,
        pixel ? 0.01 : 0.009,
        z,
      ]);
      bell.name = 'drone-motor-bell';
      part(
        pixel
          ? new THREE.CylinderGeometry(0.022, 0.022, 0.008, 6)
          : new THREE.CylinderGeometry(0.0145, 0.0145, 0.012, detail ? 16 : 12),
        pixel ? dark : copper,
        [x, pixel ? 0.027 : 0.007, z],
      );
      if (detail)
        for (let vent = 0; vent < 8; vent++) {
          const angle = (vent * Math.PI) / 4;
          windings.push(
            new THREE.Matrix4().makeTranslation(
              x + Math.cos(angle) * 0.0145,
              0.012,
              z + Math.sin(angle) * 0.0145,
            ),
          );
        }
      const rotor = new THREE.Group();
      parent.add(rotor);
      rotor.position.set(x, 0.039, z);
      if (pixel) {
        for (let blade = 0; blade < 3; blade++) {
          const pivot = new THREE.Group();
          pivot.rotation.y = (blade * Math.PI * 2) / 3;
          rotor.add(pivot);
          const prop = mesh(new THREE.BoxGeometry(0.014, 0.003, 0.058), tint, pivot);
          prop.position.z = 0.028;
        }
      } else {
        const prop = mesh(propShapes[x * z > 0 ? 0 : 1], tint, rotor);
        prop.name = 'drone-swept-propeller';
      }
      const hub = mesh(
        new THREE.CylinderGeometry(0.006, 0.006, pixel ? 0.006 : 0.02, 8),
        alloy,
        rotor,
      );
      if (!pixel) hub.position.y = -0.008;
      rotors.push(rotor);
      if (utility) {
        const duct = part(new THREE.TorusGeometry(0.067, 0.006, 6, 24), shell, [x, 0.025, z]);
        duct.rotation.x = Math.PI / 2;
      }
    }
  if (windings.length) {
    const coils = instanceSimDetails({
      shape: new THREE.CylinderGeometry(0.002, 0.002, 0.01, 5),
      paint: copper,
      parent,
      matrices: windings,
      mesh,
    });
    coils.name = 'drone-motor-windings';
  }
  const camera = part(
    pixel ? new THREE.BoxGeometry(0.06, 0.048, 0.045) : chamferedCase(0.034, 0.024, 0.036, 0.004),
    dark,
    [0, pixel ? 0.015 : 0.009, pixel ? -0.087 : -0.078],
  );
  camera.name = 'drone-camera';
  if (!pixel) {
    // The camera sits between two thin carbon cheeks, not inside a solid cube.
    const cheek = plate(
      [
        [-0.012, -0.102],
        [0.024, -0.101],
        [0.029, -0.07],
        [-0.012, -0.06],
      ],
      0.003,
    );
    cheek.rotateZ(Math.PI / 2);
    for (const x of [-0.021, 0.021]) {
      part(cheek, dark, [x, 0, 0]).name = 'drone-camera-cheek';
      const screw = part(new THREE.CylinderGeometry(0.0035, 0.0035, 0.003, 8), alloy, [
        x * 1.095,
        0.01,
        -0.081,
      ]);
      screw.rotation.z = Math.PI / 2;
    }
    const housing = part(
      new THREE.CylinderGeometry(0.013, 0.015, 0.014, 16),
      alloy,
      [0, 0.009, -0.098],
    );
    housing.rotation.x = Math.PI / 2;
  }
  const lensShape = pixel
    ? new THREE.CylinderGeometry(0.016, 0.017, 0.014, 16)
    : new THREE.SphereGeometry(
        0.0118,
        detail ? 20 : 12,
        detail ? 12 : 8,
        0,
        Math.PI * 2,
        0,
        Math.PI / 2,
      );
  if (!pixel) lensShape.scale(1, 0.28, 1);
  const lens = part(
    lensShape,
    material(pixel ? 0x5fbed7 : 0x27465a, {
      metalness: pixel ? 0.6 : 0,
      roughness: pixel ? 0.1 : 0.055,
    }),
    [0, pixel ? 0.016 : 0.009, pixel ? -0.117 : -0.106],
  );
  lens.rotation.x = pixel ? Math.PI / 2 : -Math.PI / 2;
  lens.name = 'drone-glass-lens';
  part(
    new THREE.CylinderGeometry(0.003, 0.003, pixel ? 0.075 : 0.084, 6),
    dark,
    pixel ? [0.045, 0.079, 0.065] : [0.024, 0.067, 0.073],
  );
  part(
    new THREE.SphereGeometry(pixel ? 0.012 : 0.009, 8, 6),
    tint,
    pixel ? [0.045, 0.12, 0.065] : [0.024, 0.117, 0.073],
  );
  if (pixel) {
    for (const x of [-0.063, 0.063])
      part(new THREE.BoxGeometry(0.014, 0.04, 0.09), rubber, [x, -0.03, 0]);
  } else {
    const pads = [];
    for (const x of [-0.033, 0.033])
      for (const z of [-0.047, 0.047])
        pads.push(new THREE.Matrix4().makeTranslation(x, -0.0115, z));
    const landingPads = instanceSimDetails({
      shape: new THREE.BoxGeometry(0.012, 0.011, 0.016),
      paint: rubber,
      parent,
      matrices: pads,
      mesh,
    });
    landingPads.name = 'drone-landing-pads';
    landingPads.castShadow = true;
  }
  if (kit) {
    // Flush fasteners and a recessed service panel stay inside the original hull.
    const panel = part(
      new THREE.BoxGeometry(pixel ? 0.062 : 0.032, 0.001, pixel ? 0.063 : 0.04),
      kit.paint('enamel'),
      [0, pixel ? 0.061 : 0.0585, 0.022],
    );
    panel.castShadow = false;
    panel.userData.cosmeticDetail = true;
    const matrices = [];
    for (const x of pixel ? [-0.049, 0.049] : [-0.012, 0.012])
      for (const z of pixel ? [-0.026, 0.058] : [0.007, 0.037])
        matrices.push(new THREE.Matrix4().makeTranslation(x, pixel ? 0.061 : 0.0585, z));
    instanceSimDetails({
      shape: new THREE.CylinderGeometry(0.003, 0.003, 0.002, 6),
      paint: kit.paint('copper'),
      parent,
      matrices,
      mesh,
    });
  }
  for (const x of [-1, 1]) {
    part(
      new THREE.BoxGeometry(0.011, 0.008, 0.006),
      material(0xd5f4eb, {
        emissive: 0x9be7d5,
        emissiveIntensity: 0.8,
      }),
      [x * (pixel ? 0.053 : 0.035), 0.015, pixel ? -0.08 : -0.068],
    );
    part(
      new THREE.BoxGeometry(0.011, 0.008, 0.006),
      material(0xea866d, {
        emissive: 0xc84c36,
        emissiveIntensity: 0.7,
      }),
      [x * (pixel ? 0.053 : 0.026), 0.015, 0.073],
    );
  }
  return { rotors, tint };
}

// Original local procedural source art. No simulation RNG, downloads or decoders.
const freezeMaterials = (roles) =>
  Object.freeze(
    Object.fromEntries(Object.entries(roles).map(([role, spec]) => [role, Object.freeze(spec)])),
  );
export const WORKSHOP_MATERIALS = freezeMaterials({
  steel: { color: 0x566164, roughness: 0.76, metalness: 0.45 },
  rubber: { color: 0x242a2b, roughness: 0.96, metalness: 0 },
  copper: { color: 0xb48153, roughness: 0.64, metalness: 0.62 },
  concrete: { color: 0x797970, roughness: 0.96, metalness: 0 },
  enamel: { color: 0xdab465, roughness: 0.66, metalness: 0.16 },
  timber: { color: 0x827565, roughness: 0.92, metalness: 0 },
  grass: { color: 0x66765b, roughness: 1, metalness: 0 },
});
export const SIM_SAMPLING = Object.freeze({ low: 1, balanced: 4, high: 8 });
const themedMaterials = (colors, overrides = {}) =>
  freezeMaterials(
    Object.fromEntries(
      Object.entries(WORKSHOP_MATERIALS).map(([role, spec]) => [
        role,
        { ...spec, color: colors[role], ...(overrides[role] ?? {}) },
      ]),
    ),
  );
const collectionSources = {
  'military-field': {
    pattern: 'field',
    ornament: 0xa8b382,
    paper: 0xf0efdc,
    materials: themedMaterials({
      steel: 0x65744f,
      rubber: 0x26302b,
      copper: 0xada37c,
      concrete: 0x969f8c,
      enamel: 0x61734a,
      timber: 0x827553,
      grass: 0x5c744e,
    }),
  },
  'ember-foundry': {
    pattern: 'foundry',
    ornament: 0xf0a266,
    paper: 0xf8ecd9,
    materials: themedMaterials(
      {
        steel: 0x65564b,
        rubber: 0x302824,
        copper: 0xbd835a,
        concrete: 0x807365,
        enamel: 0x9e613d,
        timber: 0x82705a,
        grass: 0x6d7556,
      },
      {
        steel: { roughness: 0.78, metalness: 0.48 },
        copper: { roughness: 0.52, metalness: 0.7 },
        enamel: { roughness: 0.66, metalness: 0.12 },
      },
    ),
  },
  'polar-relay': {
    pattern: 'relay',
    ornament: 0x91d5e3,
    paper: 0xeaf2ee,
    materials: themedMaterials(
      {
        steel: 0x647f8c,
        rubber: 0x29373e,
        copper: 0xadb5ad,
        concrete: 0x87989b,
        enamel: 0x4e7687,
        timber: 0x7e8174,
        grass: 0x637e70,
      },
      {
        steel: { roughness: 0.64, metalness: 0.48 },
        copper: { roughness: 0.5, metalness: 0.65 },
        enamel: { roughness: 0.58, metalness: 0.18 },
      },
    ),
  },
  'industrial-workshop': {
    materials: WORKSHOP_MATERIALS,
    pattern: 'riveted',
    ornament: 0xe8b45c,
    paper: 0xe5cc97,
  },
  vyshyvanka: {
    pattern: 'stitched',
    ornament: 0xc83030,
    paper: 0xe0dcd0,
    materials: themedMaterials(
      {
        steel: 0x383840,
        rubber: 0x25252d,
        copper: 0x8e7770,
        concrete: 0x67656a,
        enamel: 0xa82828,
        timber: 0x766456,
        grass: 0x60705a,
      },
      {
        steel: { roughness: 0.88, metalness: 0.18 },
        rubber: { roughness: 1 },
        enamel: { roughness: 0.86, metalness: 0.05 },
      },
    ),
  },
  'dnipro-porcelain': {
    pattern: 'porcelain',
    ornament: 0x0057b7,
    paper: 0xf3f7fb,
    materials: themedMaterials(
      {
        steel: 0xc4d2db,
        rubber: 0x34495b,
        copper: 0x94a3af,
        concrete: 0x9facb1,
        enamel: 0xe5eef4,
        timber: 0xa1917c,
        grass: 0x7d9584,
      },
      {
        steel: { roughness: 0.48, metalness: 0.38 },
        enamel: { roughness: 0.32, metalness: 0.02 },
        copper: { roughness: 0.42, metalness: 0.68 },
      },
    ),
  },
  tryzub: {
    pattern: 'inlaid',
    ornament: 0xf0c040,
    paper: 0xe8e4d8,
    materials: themedMaterials(
      {
        steel: 0x334967,
        rubber: 0x202b3e,
        copper: 0xb69b52,
        concrete: 0x74818a,
        enamel: 0xd5b355,
        timber: 0x807057,
        grass: 0x617957,
      },
      {
        steel: { roughness: 0.69, metalness: 0.28 },
        copper: { roughness: 0.48, metalness: 0.7 },
        enamel: { roughness: 0.54, metalness: 0.2 },
      },
    ),
  },
  'windows-classic': {
    pattern: 'beveled',
    ornament: 0x000080,
    paper: 0xffffff,
    materials: themedMaterials(
      {
        steel: 0xbdbdbd,
        rubber: 0x3c3c3c,
        copper: 0x808080,
        concrete: 0x929c9c,
        enamel: 0x354e93,
        timber: 0x8a847b,
        grass: 0x397f73,
      },
      {
        steel: { roughness: 0.84, metalness: 0.04 },
        copper: { roughness: 0.75, metalness: 0.15 },
        enamel: { roughness: 0.82, metalness: 0 },
      },
    ),
  },
  dos: {
    pattern: 'indexed',
    ornament: 0xffff55,
    paper: 0xaaaaaa,
    materials: themedMaterials(
      {
        steel: 0x555588,
        rubber: 0x222244,
        copper: 0xaaaaaa,
        concrete: 0x444466,
        enamel: 0xcaca55,
        timber: 0x886633,
        grass: 0x448844,
      },
      Object.fromEntries(SIM_MATERIAL_ROLES.map((role) => [role, { roughness: 1, metalness: 0 }])),
    ),
  },
  'orchard-workshop': {
    pattern: 'crafted',
    ornament: 0x4f6b3c,
    paper: 0xf3e6c7,
    materials: themedMaterials(
      {
        steel: 0x79816b,
        rubber: 0x463f34,
        copper: 0xb18552,
        concrete: 0xada386,
        enamel: 0xe5d3a1,
        timber: 0x987548,
        grass: 0x6b8554,
      },
      {
        steel: { roughness: 0.83, metalness: 0.12 },
        enamel: { roughness: 0.78, metalness: 0 },
        timber: { roughness: 0.84 },
      },
    ),
  },
  'neon-ruins': {
    pattern: 'etched',
    ornament: 0x67d8ca,
    paper: 0xe5eef2,
    materials: themedMaterials(
      {
        steel: 0x465269,
        rubber: 0x252d3d,
        copper: 0x7966a6,
        concrete: 0x555b6b,
        enamel: 0x497f83,
        timber: 0x716278,
        grass: 0x526f67,
      },
      {
        steel: { roughness: 0.79, metalness: 0.2 },
        concrete: { roughness: 0.92 },
        enamel: { roughness: 0.57, metalness: 0.12 },
      },
    ),
  },
  'pocket-lcd': {
    pattern: 'lcd',
    ornament: 0x35452b,
    paper: 0xdce7b8,
    materials: themedMaterials(
      {
        steel: 0x7c8961,
        rubber: 0x29372b,
        copper: 0x96a475,
        concrete: 0x9aab7e,
        enamel: 0xbacb91,
        timber: 0x788563,
        grass: 0x627b4e,
      },
      Object.fromEntries(
        SIM_MATERIAL_ROLES.map((role) => [role, { roughness: 0.96, metalness: 0 }]),
      ),
    ),
  },
  'copper-observatory': {
    pattern: 'copper',
    ornament: 0xe1a06a,
    paper: 0xf2e6d3,
    materials: themedMaterials(
      {
        steel: 0x405b60,
        rubber: 0x202c31,
        copper: 0xb97f52,
        concrete: 0x718184,
        enamel: 0x315b64,
        timber: 0x82705c,
        grass: 0x59776d,
      },
      {
        copper: { roughness: 0.48, metalness: 0.72 },
        steel: { roughness: 0.7, metalness: 0.4 },
        enamel: { roughness: 0.6, metalness: 0.18 },
      },
    ),
  },
  'sakura-station': {
    pattern: 'sakura',
    ornament: 0xa42e48,
    paper: 0xf8eee6,
    materials: themedMaterials(
      {
        steel: 0xaaa0a2,
        rubber: 0x493741,
        copper: 0xab8478,
        concrete: 0xbeb0a4,
        enamel: 0xeddacf,
        timber: 0x92796d,
        grass: 0x7b9272,
      },
      {
        steel: { roughness: 0.58, metalness: 0.26 },
        enamel: { roughness: 0.4, metalness: 0.02 },
        copper: { roughness: 0.54, metalness: 0.45 },
      },
    ),
  },
  'obsidian-reliquary': {
    pattern: 'reliquary',
    ornament: 0xc5a563,
    paper: 0xeee5d4,
    materials: themedMaterials(
      {
        steel: 0x494249,
        rubber: 0x231f26,
        copper: 0x9b8050,
        concrete: 0x5e575b,
        enamel: 0x54303e,
        timber: 0x625047,
        grass: 0x4e5b48,
      },
      {
        steel: { roughness: 0.84, metalness: 0.25 },
        copper: { roughness: 0.52, metalness: 0.6 },
        concrete: { roughness: 0.98 },
        enamel: { roughness: 0.66, metalness: 0.08 },
        timber: { roughness: 0.94 },
      },
    ),
  },
  'deep-space': {
    pattern: 'orbital',
    ornament: 0x99d5ed,
    paper: 0xe5eff5,
    materials: themedMaterials(
      {
        steel: 0x43576b,
        rubber: 0x202b38,
        copper: 0x8d9398,
        concrete: 0x69747c,
        enamel: 0x314962,
        timber: 0x716a65,
        grass: 0x586e63,
      },
      {
        steel: { roughness: 0.66, metalness: 0.42 },
        copper: { roughness: 0.48, metalness: 0.7 },
        enamel: { roughness: 0.58, metalness: 0.12 },
        rubber: { roughness: 0.98 },
      },
    ),
  },
  'moonlit-grove': {
    pattern: 'moonlit',
    ornament: 0xc0b6e2,
    paper: 0xe6ece1,
    materials: themedMaterials(
      {
        steel: 0x4a5e54,
        rubber: 0x22332b,
        copper: 0x989c87,
        concrete: 0x667469,
        enamel: 0x3e5945,
        timber: 0x655c52,
        grass: 0x4e714e,
      },
      {
        steel: { roughness: 0.82, metalness: 0.2 },
        copper: { roughness: 0.54, metalness: 0.58 },
        enamel: { roughness: 0.75, metalness: 0.04 },
        timber: { roughness: 0.96 },
      },
    ),
  },
};
export const SIM_VISUAL_COLLECTIONS = Object.freeze(
  Object.fromEntries(
    Object.entries(collectionSources).map(([id, source]) => {
      const descriptor = BUILTIN_SIM_VISUAL_COLLECTIONS[id];
      return [
        id,
        Object.freeze({
          id,
          revision: 'r1',
          specimen: false,
          ...source,
          descriptor,
          models: descriptor?.models,
          assets: descriptor?.assets,
        }),
      ];
    }),
  ),
);

// Periodic isotropic mottling adapted from the environment art pass. It avoids
// diagonal grass bands; density stays fixed when the quality preset changes.
function surfaceMottle(x, y, cell = 32) {
  const count = 128 / cell,
    ix = Math.floor(x / cell),
    iy = Math.floor(y / cell);
  const noise = (dx, dy) =>
    (((Math.imul(((ix + dx) % count) + 7, 374761393) ^
      Math.imul(((iy + dy) % count) + 11, 668265263)) >>>
      0) %
      1000) /
    1000;
  const sx = (x % cell) / cell,
    sy = (y % cell) / cell,
    u = sx * sx * (3 - 2 * sx),
    v = sy * sy * (3 - 2 * sy);
  return (
    (noise(0, 0) * (1 - u) + noise(1, 0) * u) * (1 - v) +
    (noise(0, 1) * (1 - u) + noise(1, 1) * u) * v
  );
}
function familySurface(pattern, role, x, y, grain) {
  const u = x % 64,
    v = y % 64,
    edge = Math.min(u, v, 63 - u, 63 - v),
    solid = ['steel', 'enamel', 'copper'].includes(role);
  let shade = 0.97 + grain * 0.055,
    mark = 0;
  if (role === 'grass')
    return { shade: 0.87 + surfaceMottle(x, y) * 0.2 + surfaceMottle(x, y, 8) * 0.06, mark: 0 };
  if (role === 'timber')
    shade *=
      0.92 + Math.sin(x * 0.38 + Math.sin(y * 0.049) * 2) * 0.055 + surfaceMottle(x, y) * 0.1;
  if (role === 'concrete') shade *= edge < 1 ? 0.85 : 0.96 + surfaceMottle(x, y) * 0.07;
  if (role === 'rubber') shade *= (x + y) % 16 < 2 ? 0.91 : 1;
  if (pattern === 'field') {
    // Recessed equipment panels with corner fasteners and a short service slot.
    // Keep the subdued field palette; readable structure must survive grayscale.
    if (solid) {
      shade *= edge < 2 ? 0.78 : 1;
      const fastener =
        (Math.abs(u - 8) <= 1 || Math.abs(u - 55) <= 1) &&
        (Math.abs(v - 8) <= 1 || Math.abs(v - 55) <= 1);
      if (fastener) shade *= 0.55;
      if (role === 'enamel' && v >= 44 && v <= 46 && u >= 22 && u <= 41) shade *= 0.64;
    }
  } else if (pattern === 'foundry') {
    // Bolted, heat-darkened access plates with short edge machining marks.
    if (solid) {
      shade *= edge < 2 ? 0.71 : edge === 3 ? 1.12 : 1;
      if ((u === 7 || u === 56) && (v === 7 || v === 56)) shade *= 1.2;
      if (role === 'enamel' && v === 7 && u > 17 && u < 30) mark = 1;
    }
    if (role === 'copper') shade *= 0.96 + surfaceMottle(x, y, 16) * 0.06;
  } else if (pattern === 'relay') {
    // Chilled alloy cassettes with two isolated instrument ticks near the rim.
    if (solid) {
      shade *= edge < 2 ? 0.75 : u === 3 || v === 3 ? 1.1 : 1;
      if (role === 'enamel' && u === 8 && ((v > 13 && v < 19) || (v > 23 && v < 29))) mark = 2;
      if (role === 'steel' && u === 55 && v > 45 && v < 52) shade *= 0.73;
    }
  } else if (pattern === 'stitched') {
    if (role === 'rubber') shade *= x % 4 < 2 === y % 4 < 2 ? 1.025 : 0.975;
    if (role === 'enamel') {
      const diamond = Math.abs((x % 24) - 12) + Math.abs((y % 24) - 12);
      if ((v < 12 || v > 51) && (diamond === 8 || diamond === 9)) mark = 2;
      if (v === 14 || v === 49) shade *= 0.62;
    } else if (role === 'steel') shade *= edge < 2 ? 0.8 : 1;
  } else if (pattern === 'porcelain') {
    if (solid) {
      shade *= edge < 2 ? 0.89 : 1 + Math.sin(x * 0.049) * 0.015;
      if (role === 'enamel' && (edge === 5 || edge === 6)) mark = 1;
      if (role === 'enamel' && v > 25 && v < 39 && (u + Math.floor(v / 3) * 3) % 32 < 2) mark = 1;
    }
  } else if (pattern === 'inlaid') {
    if (solid) {
      shade *= edge < 2 ? 0.74 : 1;
      if (role === 'steel' && edge === 5 && (u % 16 < 7 || v % 16 < 7)) mark = 1;
      if (role === 'enamel' && Math.abs(u - 32) === Math.floor(Math.abs(v - 32) / 2) + 5)
        shade *= 0.64;
    }
  } else if (pattern === 'beveled') {
    if (solid) {
      shade = u < 3 || v < 3 ? 1.24 : u > 60 || v > 60 ? 0.61 : 1;
      if (role === 'enamel' && v < 15 && u > 8 && u < 56) mark = 2;
      if (role === 'steel' && u > 49 && v > 47 && u % 3 === 0) shade = 0.64;
    }
  } else if (pattern === 'indexed') {
    shade = Math.round(shade * 4) / 4;
    if (solid) {
      shade = edge < 2 ? 0.55 : 1;
      if (
        role === 'enamel' &&
        ((u >= 12 && u <= 15 && v > 12 && v < 51) || (v >= 48 && v <= 51 && u > 12 && u < 43))
      )
        mark = 2;
      if (role === 'steel' && (Math.floor(u / 8) + Math.floor(v / 8)) % 2 === 0) shade = 0.88;
    }
  } else if (pattern === 'crafted') {
    if (role === 'steel') shade *= edge < 2 ? 0.76 : 0.96 + surfaceMottle(x, y) * 0.06;
    if (role === 'enamel') {
      if (edge < 3) mark = 1;
      if (Math.abs(u - 32) + Math.abs(v - 32) * 0.7 < 10 && (u + v) % 5 < 2) mark = 1;
    }
    if (role === 'timber') shade *= u < 2 ? 0.67 : 1;
    if (role === 'rubber') shade *= x % 8 < 4 === y % 8 < 4 ? 1.04 : 0.97;
  } else if (pattern === 'lcd') {
    // Broad moulded housings and inset display surrounds, never simulated scanlines.
    if (solid) {
      shade *= edge < 3 ? 0.79 : edge < 5 ? 1.05 : 1;
      if (role === 'enamel' && u > 11 && u < 52 && v > 15 && v < 49)
        shade *= u < 15 || u > 48 || v < 19 || v > 45 ? 0.78 : 0.96;
    }
  } else if (pattern === 'copper') {
    // Sparse engraved arcs near joins keep the centre of instrument plates quiet.
    if (solid) {
      shade *= edge < 2 ? 0.76 : 0.98 + surfaceMottle(x, y) * 0.035;
      const radius = Math.hypot(u - 7, v - 7);
      if (role === 'enamel' && u < 25 && v < 25 && radius > 13 && radius < 15) mark = 1;
      if (role === 'copper') shade *= 0.99 + Math.sin(y * 0.098) * 0.025;
    }
  } else if (pattern === 'sakura') {
    // A small four-petal corner stamp on matte ceramic; no repeated field pattern.
    if (solid) {
      shade *= edge < 2 ? 0.86 : 1 + Math.sin(x * 0.049) * 0.01;
      const petalX = Math.abs(u - 12),
        petalY = Math.abs(v - 12);
      if (role === 'enamel' && petalX + petalY < 8 && Math.abs(petalX - petalY) > 2) mark = 1;
    }
  } else if (pattern === 'reliquary') {
    // Shallow cut-stone corners and aged inlay, with no symbols or busy centre.
    if (solid) {
      const corner = Math.min(u + v, 63 - u + v, u + 63 - v, 126 - u - v);
      shade *= corner < 8 ? 0.71 : edge < 2 ? 0.8 : 1;
      if (role === 'enamel' && (v === 8 || v === 55) && u > 15 && u < 48) mark = 1;
    }
    if (role === 'concrete') shade *= 0.94 + Math.abs(Math.sin(x * 0.027 + y * 0.016)) * 0.055;
  } else if (pattern === 'orbital') {
    // Offset access-panel joins and a small status strip, never a target decal.
    if (solid) {
      shade *= edge < 2 ? 0.72 : 1;
      if (role === 'enamel' && ((u === 9 && v > 12 && v < 51) || (v === 12 && u > 9 && u < 27)))
        shade *= 0.66;
      if (role === 'enamel' && v > 48 && v < 52 && u >= 42 && u < 54) mark = 1;
    }
    if (role === 'copper') shade *= 0.99 + Math.sin(y * 0.098) * 0.015;
  } else if (pattern === 'moonlit') {
    // A restrained crescent stamp at the frame corner; quiet moonlit enamel.
    if (solid) {
      shade *= edge < 2 ? 0.83 : 1;
      if (role === 'enamel' && Math.hypot(u - 15, v - 15) < 7 && Math.hypot(u - 18, v - 13) > 6)
        mark = 2;
    }
    if (role === 'timber') shade *= u < 2 ? 0.82 : 1;
  } else if (pattern === 'etched') {
    if (solid) {
      shade *= edge < 3 ? 0.67 : 1;
      if (
        role === 'enamel' &&
        ((u === 10 && v < 45) || (v === 44 && u < 44) || (u === 43 && v > 22))
      )
        mark = 1;
      if (role === 'steel' && Math.abs(u - v) < 2 && u > 10 && u < 28) mark = 1;
    }
  }
  return { shade, mark };
}
export function getSimVisualCollection(id = 'industrial-workshop') {
  if (!Object.hasOwn(SIM_VISUAL_COLLECTIONS, id))
    throw new TypeError(`Unknown SIM material collection: ${id}.`);
  return SIM_VISUAL_COLLECTIONS[id];
}
export function bindSimModelRole(object, role, collectionId = 'industrial-workshop') {
  const collection = getSimVisualCollection(collectionId);
  if (!Object.hasOwn(collection.models, role))
    throw new TypeError(`Missing SIM model role: ${role}.`);
  if (object.userData.assetRole && object.userData.assetRole !== collection.assets[role])
    throw new TypeError(`Unsupported SIM asset binding for ${role}.`);
  object.userData = {
    ...object.userData,
    collectionId,
    modelRole: role,
    sourceModel: collection.models[role],
    assetRole: collection.assets[role],
  };
  return object;
}

export function configureSimTextureSampling(texture, quality = 'balanced', maxAnisotropy = 1) {
  if (!Object.hasOwn(SIM_SAMPLING, quality)) throw new TypeError('Unknown SIM quality.');
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = Math.min(SIM_SAMPLING[quality], Math.max(1, maxAnisotropy));
  texture.needsUpdate = true;
  return texture;
}

export function createWorkshopTexture(
  role,
  { quality = 'balanced', maxAnisotropy = 1, collectionId = 'industrial-workshop' } = {},
) {
  const collection = getSimVisualCollection(collectionId),
    spec = collection.materials[role];
  if (!spec) throw new TypeError(`Unknown workshop material: ${role}.`);
  const size = 128,
    data = new Uint8Array(size * size * 4),
    base = new THREE.Color(spec.color).convertLinearToSRGB(),
    ornament = new THREE.Color(collection.ornament).convertLinearToSRGB(),
    paper = new THREE.Color(collection.paper).convertLinearToSRGB();
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const hash = (Math.imul(x + 7, 374761393) ^ Math.imul(y + 11, 668265263)) >>> 0;
      let shade = 0.96 + (hash % 100) / 1250;
      if (role === 'steel') {
        if (x % 64 < 2 || y % 64 < 2) shade *= 0.74;
        const rx = x % 64,
          ry = y % 64;
        if ((rx === 6 || rx === 57) && (ry === 6 || ry === 57)) shade *= 1.28;
      }
      if (role === 'concrete' && (x % 64 === 0 || y % 64 === 0)) shade *= 0.86;
      if (role === 'rubber' && (x + y) % 16 < 2) shade *= 0.87;
      if (role === 'copper') shade *= 0.97 + Math.sin((y / size) * Math.PI * 32) * 0.025;
      if (role === 'timber')
        shade *=
          0.96 + Math.sin((x / size) * Math.PI * 16 + Math.sin((y / size) * Math.PI * 2)) * 0.07;
      if (role === 'grass') shade *= 0.97 + Math.sin(((x + y) * Math.PI) / 8) * 0.03;
      const pattern =
        collection.pattern === 'riveted'
          ? { shade, mark: 0 }
          : familySurface(collection.pattern, role, x, y, (hash % 100) / 100);
      const pigment = pattern.mark === 1 ? ornament : pattern.mark === 2 ? paper : base;
      shade = pattern.mark ? 1 : pattern.shade;
      const at = (y * size + x) * 4;
      data[at] = Math.min(255, Math.round(pigment.r * 255 * shade));
      data[at + 1] = Math.min(255, Math.round(pigment.g * 255 * shade));
      data[at + 2] = Math.min(255, Math.round(pigment.b * 255 * shade));
      data[at + 3] = 255;
    }
  const texture = new THREE.DataTexture(data, size, size);
  texture.name = `${collection.descriptor?.materials[role] ?? `${collectionId}-${role}`}-${collection.revision}`;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.userData = { simSurface: true, materialRole: role, revision: 'r1', collectionId };
  configureSimTextureSampling(texture, quality, maxAnisotropy);
  return texture;
}

/** Original bevel-height calibration only; runtime collections do not request it. */
export function createWorkshopBevelNormalTexture({ quality = 'balanced', maxAnisotropy = 1 } = {}) {
  const size = 128,
    data = new Uint8Array(size * size * 4),
    height = (x, y) => {
      const u = ((x % 64) + 64) % 64,
        v = ((y % 64) + 64) % 64,
        edge = Math.min(u, 63 - u, v, 63 - v),
        t = Math.min(1, edge / 5);
      return t * t * (3 - 2 * t);
    };
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const nx = (height(x - 1, y) - height(x + 1, y)) * 2,
        ny = (height(x, y - 1) - height(x, y + 1)) * 2,
        length = Math.hypot(nx, ny, 1),
        at = (y * size + x) * 4;
      data[at] = Math.round(((nx / length) * 0.5 + 0.5) * 255);
      data[at + 1] = Math.round(((ny / length) * 0.5 + 0.5) * 255);
      data[at + 2] = Math.round(((1 / length) * 0.5 + 0.5) * 255);
      data[at + 3] = 255;
    }
  const texture = new THREE.DataTexture(data, size, size);
  texture.name = 'workshop-bevel-normal-calibration-r1';
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.userData = {
    simSurface: true,
    materialRole: 'bevel-normal-calibration',
    revision: 'r1',
    calibrationOnly: true,
  };
  configureSimTextureSampling(texture, quality, maxAnisotropy);
  return texture;
}

/** One factory per ownership group: maps are shared inside it and disposed together. */
export function createWorkshopMaterials({
  material,
  quality = 'balanced',
  maxAnisotropy = 1,
  collectionId = 'industrial-workshop',
}) {
  const collection = getSimVisualCollection(collectionId);
  const maps = new Map(),
    paints = new Map();
  const texture = (role) => {
    if (!maps.has(role))
      maps.set(role, createWorkshopTexture(role, { quality, maxAnisotropy, collectionId }));
    return maps.get(role);
  };
  const paint = (role) => {
    if (!collection.materials[role]) throw new TypeError(`Unknown workshop material: ${role}.`);
    if (!paints.has(role)) {
      const { roughness, metalness } = collection.materials[role],
        value = material(0xffffff, { map: texture(role), roughness, metalness });
      value.name = collection.descriptor?.materials[role] ?? `${collectionId}-${role}`;
      value.userData = {
        ...value.userData,
        materialRole: role,
        collectionId,
      };
      paints.set(role, value);
    }
    return paints.get(role);
  };
  return { collectionId, paint, texture, materials: paints, textures: maps };
}

export function validateSimMaterialBinding(input) {
  const value = boundedJSON(input, { maxBytes: 1024, maxNodes: 12, maxDepth: 2, maxString: 80 });
  exactKeys(
    value,
    ['format', 'collectionId', 'revision', 'role', 'allowTransparencyReplacement'],
    'SIM material binding',
  );
  required(value.format === 'SimMaterialBinding.v1', 'Unsupported SIM material binding format.');
  required(stableId(value.collectionId), 'Invalid bound SIM collection.');
  required(
    typeof value.revision === 'string' && /^[a-zA-Z0-9._-]{1,64}$/.test(value.revision),
    'Invalid bound SIM revision.',
  );
  required(SIM_MATERIAL_ROLES.includes(value.role), 'Invalid bound SIM material role.');
  required(
    value.allowTransparencyReplacement === undefined ||
      typeof value.allowTransparencyReplacement === 'boolean',
    'Invalid transparency replacement choice.',
  );
  return Object.freeze(value);
}

export function ownedSimMaterials(object) {
  const values = object.userData?.ownedMaterials;
  return Array.isArray(values)
    ? values.filter((paint) => paint?.isMaterial && typeof paint.dispose === 'function')
    : [];
}

/** Only bound mesh nodes and their loader-identified primitives opt in, never a subtree. */
export function applySimMaterialBindings(
  root,
  {
    collectionId = 'authored',
    quality = 'balanced',
    maxAnisotropy = 1,
    associations = null,
    material = (color, extras) => new THREE.MeshStandardMaterial({ color, ...extras }),
  } = {},
) {
  const diagnostics = [],
    retained = new Set(ownedSimMaterials(root)),
    variants = new Map();
  let kit = null,
    applied = 0;
  let diagnosticsTruncated = 0;
  const diagnose = (item, code) => {
    if (diagnostics.length < 128)
      diagnostics.push({ node: String(item.name ?? '').slice(0, 128), code });
    else diagnosticsTruncated++;
  };
  const apply = (item, binding) => {
    if (!item.isMesh || !item.material) {
      diagnose(item, 'mesh-node-required');
      return;
    }
    if (!item.geometry?.getAttribute('uv')) {
      diagnose(item, 'uv-required');
      return;
    }
    const originals = Array.isArray(item.material) ? item.material : [item.material];
    if (
      !binding.allowTransparencyReplacement &&
      originals.some(
        (paint) =>
          paint.transparent ||
          paint.opacity < 1 ||
          paint.alphaTest > 0 ||
          paint.alphaMap ||
          paint.transmission > 0,
      )
    ) {
      diagnose(item, 'transparency-protected');
      return;
    }
    kit ??= createWorkshopMaterials({ material, quality, maxAnisotropy, collectionId });
    const replacements = originals.map((paint) => {
      retained.add(paint);
      const state = {
          side: paint.side,
          shadowSide: paint.shadowSide,
          flatShading: Boolean(paint.flatShading),
          depthTest: paint.depthTest,
          depthWrite: paint.depthWrite,
        },
        key = `${binding.role}:${JSON.stringify(state)}`;
      if (!variants.has(key)) {
        const source = kit.paint(binding.role),
          replacement = source.clone();
        Object.assign(replacement, state);
        retained.add(source);
        variants.set(key, replacement);
      }
      return variants.get(key);
    });
    item.material = Array.isArray(item.material) ? replacements : replacements[0];
    const previousShadow = item.onBeforeShadow;
    item.onBeforeShadow = function (...args) {
      previousShadow.apply(this, args);
      // Approved replacements are opaque and need no color sampler in depth.
      args[5].map = null;
    };
    applied++;
  };
  root.traverse((item) => {
    if (!Object.hasOwn(item.userData ?? {}, 'reveallineTheme')) return;
    let binding;
    try {
      binding = validateSimMaterialBinding(item.userData.reveallineTheme);
    } catch {
      diagnose(item, 'invalid-binding');
      return;
    }
    const resolved = resolveSimVisualCollection(binding);
    if (resolved.fallbackReason || resolved.collection.id === 'authored') {
      diagnose(item, resolved.fallbackReason ?? 'collection-has-no-replacement-materials');
      return;
    }
    if (binding.collectionId !== collectionId) {
      diagnose(item, 'collection-not-selected');
      return;
    }
    if (item.isMesh) {
      apply(item, binding);
      return;
    }
    const source = associations?.get(item),
      primitives = Number.isInteger(source?.meshes)
        ? item.children.filter((child) => {
            const part = associations.get(child);
            return (
              child.isMesh &&
              part?.meshes === source.meshes &&
              Number.isInteger(part.primitives) &&
              part.nodes === undefined &&
              !Object.hasOwn(child.userData ?? {}, 'reveallineTheme')
            );
          })
        : [];
    if (!primitives.length) diagnose(item, 'mesh-node-required');
    for (const primitive of primitives) apply(primitive, binding);
  });
  if (retained.size) root.userData.ownedMaterials = [...retained];
  return { applied, diagnostics, diagnosticsTruncated };
}

/** Identical ownership rules for hangar and calibration previews. */
export function disposeSimVisualGroup(root) {
  const geometry = new Set(),
    materials = new Set(),
    textures = new Set(),
    instances = new Set();
  root.traverse((item) => {
    if (item.geometry) geometry.add(item.geometry);
    if (item.isInstancedMesh) instances.add(item);
    for (const paint of [
      ...(Array.isArray(item.material) ? item.material : [item.material]),
      ...ownedSimMaterials(item),
      item.customDepthMaterial,
      item.customDistanceMaterial,
    ]) {
      if (!paint) continue;
      materials.add(paint);
      for (const value of Object.values(paint)) if (value?.isTexture) textures.add(value);
    }
    if (item.userData?.ownedMaterials) item.userData.ownedMaterials = [];
  });
  for (const texture of textures) {
    texture.source?.data?.close?.();
    texture.dispose();
  }
  for (const material of materials) material.dispose();
  for (const instance of instances) instance.dispose();
  for (const shape of geometry) shape.dispose();
  root.clear();
}

/** Runtime-renderable material specimen used by tests and authoring previews. */
export function createWorkshopCalibration({
  quality = 'balanced',
  maxAnisotropy = 1,
  collectionId = 'industrial-workshop',
} = {}) {
  const group = new THREE.Group();
  group.name = 'workshop-material-calibration-r1';
  const kit = createWorkshopMaterials({
    material: (color, props) => new THREE.MeshStandardMaterial({ color, ...props }),
    quality,
    maxAnisotropy,
    collectionId,
  });
  for (const [index, role] of Object.keys(WORKSHOP_MATERIALS).entries()) {
    const object = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), kit.paint(role));
    object.name = role;
    object.position.set(index * 1.1, 0.4, 0);
    group.add(object);
  }
  return group;
}
