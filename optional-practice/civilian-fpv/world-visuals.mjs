import * as THREE from './vendor/three.module.js';
import {
  BUILTIN_SIM_VISUAL_COLLECTIONS,
  SIM_MATERIAL_ROLES,
  resolveSimVisualCollection,
  resolveSimThemeProfile,
} from './world-themes.mjs';
import { boundedJSON, exactKeys, required, stableId } from '../../game/data-json.mjs';

const ADVENTURE_SURFACES = Object.freeze({
  coast: { floor: 'sand', color: 0xc2b38f, wall: 'concrete' },
  quarry: { floor: 'stone', color: 0x9a8264, wall: 'stone' },
  rooftops: { floor: 'asphalt', color: 0x414a55, wall: 'plaster' },
  orchard: { floor: 'grass', color: 0x6e835d, wall: 'wood' },
  'solar-farm': { floor: 'ballast', color: 0x97937a, wall: 'metal' },
  'rail-depot': { floor: 'ballast', color: 0x777773, wall: 'metal' },
});

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
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / size,
        v = y / size,
        grain = rng(),
        tau = Math.PI * 2;
      let shade = 0.91 + grain * 0.16,
        relief = grain * 0.025,
        roughness = 0.86;
      const patch = (broad(u, v) - 0.5) * 0.16,
        mottling = fine(u, v) - 0.5;
      if (kind === 'concrete') {
        const joint = (u * 2) % 1 < 0.007 || (v * 2) % 1 < 0.007;
        shade *= joint ? 0.8 : 1 + patch + mottling * 0.05 - (grain < 0.015 ? 0.1 : 0);
        relief += joint ? -0.075 : patch * 0.1;
        roughness = 0.76 + grain * 0.2;
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
      if (kind === 'grass') {
        // Isotropic patches and fine blades: no regular diagonal stripes or
        // high-frequency sine pattern that aliases into bands during flight.
        shade *= 0.97 + patch * 1.4 + mottling * 0.14;
        relief += mottling * 0.035 + grain * 0.018;
        roughness = 0.98;
      }
      if (kind === 'carbon') {
        const weave = (Math.floor(u * 24) + Math.floor(v * 24)) % 2;
        shade *= weave ? 0.65 : 1.2;
        relief += weave * 0.04;
        roughness = weave ? 0.58 : 0.42;
      }
      if (pixel) shade = Math.round(shade * 6) / 6;
      const at = (y * size + x) * 4;
      data[at] = Math.min(255, base.r * 255 * shade);
      data[at + 1] = Math.min(255, base.g * 255 * shade);
      data[at + 2] = Math.min(255, base.b * 255 * shade);
      data[at + 3] = 255;
      height[y * size + x] = relief;
      properties[at] = Math.round(255 * (relief < -0.08 ? 0.86 : 1));
      properties[at + 1] = Math.round(255 * roughness);
      properties[at + 2] = kind === 'metal' ? 170 : 0;
      properties[at + 3] = 255;
    }
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const at = (y * size + x) * 4;
      const dx =
        (height[y * size + ((x + 1) % size)] - height[y * size + ((x + size - 1) % size)]) * 2;
      const dy =
        (height[((y + 1) % size) * size + x] - height[((y + size - 1) % size) * size + x]) * 2;
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
  const floorKind =
    adventure?.floor ??
    (natural
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
  const floorTile = natural ? 12 : environment === 'courtyard' ? 4 : 6;
  for (const texture of new Set(Object.values(floorMaps)))
    texture.repeat.set((width + 100) / floorTile, (depth + 100) / floorTile);
  const ground = mesh(
    new THREE.PlaneGeometry(width + 100, depth + 100),
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
  const accent = material(theme.accent, {
    roughness: 0.5,
    emissive: theme.accent,
    emissiveIntensity: 0.1,
  });
  const wallMaps = kit
    ? { map: kit.texture(natural ? 'timber' : 'steel') }
    : surfaceMaps(
        adventure?.wall ?? (environment === 'courtyard' ? 'brick' : natural ? 'wood' : 'metal'),
        natural ? 0x857763 : theme.wall,
        { pixel },
      );
  for (const texture of new Set(Object.values(wallMaps))) texture.repeat.set(3, 2);
  const wallMap = wallMaps.map;
  const walls = material(0xffffff, {
    ...wallMaps,
    normalScale: new THREE.Vector2(0.3, 0.3),
    roughness: 1,
    metalness: indoor ? 0.18 : 0.05,
  });
  world.userData.ownedMaterials = [accent, walls];
  world.userData.collectionId = collectionId ?? 'authored';
  const obstacleSurfaces = new Map();
  const obstacleSurface = (kind = 'concrete') => {
    const colors = {
      wood: 0x85725a,
      concrete: 0x929790,
      plaster: theme.wall,
      brick: environment === 'courtyard' ? 0xb99e83 : theme.wall,
      metal: theme.wall,
      stone: 0xa18a6d,
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
            : ['concrete', 'stone', 'plaster'].includes(kind)
              ? 'concrete'
              : 'steel';
      const maps = kit ? { map: kit.texture(role) } : surfaceMaps(kind, colors[kind], { pixel });
      // A shared owner stays under world even when callers make no obstacle
      // mesh, and never shares texture lifetime with independently removed actors.
      world.userData.ownedMaterials.push(material(0xffffff, maps));
      obstacleSurfaces.set(kind, maps);
    }
    return obstacleSurfaces.get(kind);
  };
  const structure = (size, at, paint = walls) => {
    const value = mesh(new THREE.BoxGeometry(...size), paint, indoor ? world : backdrop);
    value.position.set(...at);
    value.castShadow = value.receiveShadow = true;
    value.userData.materialRole = natural ? 'timber' : 'steel';
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
    structure([width + 1, sill, 0.35], [cx, sill / 2, min.z - 0.18]);
    structure([width + 1, sill, 0.35], [cx, sill / 2, max.z + 0.18]);
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
      structure([width, 0.35, 0.015], [cx, 1.6, z], accent);
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
    const leaves = [material(0x496b50), material(0x345749), material(0x7c905d)],
      bark = kit ? kit.paint('timber') : material(0x63554a);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2,
        r = radius + rng() * 24,
        height = 5 + rng() * 7;
      const x = cx + Math.cos(angle) * r,
        z = cz + Math.sin(angle) * r;
      const trunk = mesh(new THREE.CylinderGeometry(0.14, 0.24, height * 0.7, 6), bark, backdrop);
      trunk.position.set(x, height * 0.35, z);
      trunk.castShadow = true;
      const crown = mesh(
        environment === 'woodland'
          ? new THREE.IcosahedronGeometry(height * 0.3, 1)
          : new THREE.ConeGeometry(height * 0.3, height * 0.75, 7),
        leaves[i % 3],
        backdrop,
      );
      crown.position.set(x, height * 0.75, z);
      crown.castShadow = true;
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
    obstacleSurfaceKind(obstacle) {
      if (!adventure) return null;
      const id = obstacle.id ?? '';
      if (/^(rail-gantry|rail-car|solar-hut)-/.test(id)) return 'metal';
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

/** Cosmetic meshes share one draw call and the parent's existing transform. */
export function instanceSimDetails({ shape, paint, parent, matrices, mesh }) {
  const registered = mesh(shape, paint, parent);
  parent.remove(registered);
  const value = new THREE.InstancedMesh(shape, paint, matrices.length);
  matrices.forEach((matrix, index) => value.setMatrixAt(index, matrix));
  value.instanceMatrix.needsUpdate = true;
  value.userData.cosmeticDetail = true;
  value.castShadow = false;
  value.receiveShadow = true;
  parent.add(value);
  return value;
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
        metalness: 0.18,
        roughness: 0.72,
        normalScale: new THREE.Vector2(0.15, 0.15),
      });
  const shell = kit
    ? kit.paint('steel')
    : material(pixel ? 0x60e1d6 : utility ? 0xe7b875 : 0xc7d8c9, {
        metalness: 0.18,
        roughness: 0.4,
      });
  const tint = material(
    kit
      ? getSimVisualCollection(collectionId).materials.enamel.color
      : pixel
        ? 0xf3a870
        : utility
          ? 0x91c8cf
          : 0xbdf083,
    {
      emissive: pixel ? 0x944a21 : 0x486834,
      emissiveIntensity: 0.25,
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
  const frame = () => {
    if (pixel) return new THREE.BoxGeometry(0.17, 0.012, 0.15);
    const outline = new THREE.Shape();
    outline.moveTo(-0.07, -0.055);
    outline.lineTo(-0.05, -0.083);
    outline.lineTo(0.05, -0.083);
    outline.lineTo(0.07, -0.055);
    outline.lineTo(0.07, 0.055);
    outline.lineTo(0.04, 0.08);
    outline.lineTo(-0.04, 0.08);
    outline.lineTo(-0.07, 0.055);
    outline.closePath();
    const geometry = new THREE.ExtrudeGeometry(outline, {
      depth: 0.007,
      bevelEnabled: quality !== 'low',
      bevelSegments: 1,
      steps: 1,
      bevelSize: 0.002,
      bevelThickness: 0.001,
    });
    geometry.rotateX(Math.PI / 2);
    return geometry;
  };
  part(frame(), dark, [0, -0.005, 0]);
  part(frame(), dark, [0, 0.027, 0]);
  for (const x of [-0.047, 0.047])
    for (const z of [-0.055, 0.055])
      part(new THREE.CylinderGeometry(0.004, 0.004, 0.024, pixel ? 4 : 8), alloy, [x, 0.01, z]);
  part(new THREE.BoxGeometry(0.12, 0.045, 0.13), shell, [0, 0.038, 0.016]);
  for (const z of [-0.014, 0.054])
    part(new THREE.BoxGeometry(0.124, 0.049, 0.015), rubber, [0, 0.038, z]);
  part(new THREE.BoxGeometry(0.045, 0.002, 0.037), tint, [0, 0.0615, 0.018]);
  if (detail) {
    for (const z of [-0.053, 0.047])
      for (const x of [-0.051, 0.051])
        part(new THREE.CylinderGeometry(0.003, 0.003, 0.002, 8), alloy, [x, 0.029, z]);
    for (let cell = 0; cell < 4; cell++)
      part(new THREE.BoxGeometry(0.003, 0.032, 0.085), alloy, [0.06, 0.038, -0.025 + cell * 0.024]);
    const lead = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.043, 0.04, 0.09),
      new THREE.Vector3(0.072, 0.034, 0.1),
      new THREE.Vector3(0.075, 0.01, 0.06),
    ]);
    part(new THREE.TubeGeometry(lead, 8, 0.0025, 5, false), material(0xb8513e), [0, 0, 0]);
    part(new THREE.BoxGeometry(0.016, 0.01, 0.017), material(0xe9ba57), [0.073, 0.011, 0.062]);
  }
  for (const x of [-0.103, 0.103])
    for (const z of [-0.103, 0.103]) {
      const arm = part(new THREE.BoxGeometry(0.018, 0.018, 0.15), dark, [x / 2, 0, z / 2]);
      arm.rotation.y = Math.atan2(x, z);
      part(new THREE.CylinderGeometry(0.021, 0.023, 0.032, pixel ? 6 : detail ? 24 : 12), alloy, [
        x,
        0.01,
        z,
      ]);
      part(new THREE.CylinderGeometry(0.022, 0.022, 0.008, pixel ? 6 : 12), dark, [x, 0.027, z]);
      if (detail)
        for (let vent = 0; vent < 8; vent++) {
          const angle = (vent * Math.PI) / 4;
          part(new THREE.CylinderGeometry(0.0025, 0.0025, 0.016, 5), copper, [
            x + Math.cos(angle) * 0.0205,
            0.012,
            z + Math.sin(angle) * 0.0205,
          ]);
        }
      const rotor = new THREE.Group();
      parent.add(rotor);
      rotor.position.set(x, 0.039, z);
      for (let blade = 0; blade < 3; blade++) {
        const pivot = new THREE.Group();
        pivot.rotation.y = (blade * Math.PI * 2) / 3;
        rotor.add(pivot);
        const prop = mesh(new THREE.BoxGeometry(0.014, 0.003, 0.058), tint, pivot);
        prop.position.z = 0.028;
        if (!pixel) prop.rotation.z = 0.12;
      }
      mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.006, 8), alloy, rotor);
      rotors.push(rotor);
      if (utility) {
        const duct = part(new THREE.TorusGeometry(0.067, 0.006, 6, 24), shell, [x, 0.025, z]);
        duct.rotation.x = Math.PI / 2;
      }
    }
  part(new THREE.BoxGeometry(0.06, 0.048, 0.045), dark, [0, 0.015, -0.087]);
  if (!pixel) {
    const housing = part(
      new THREE.CylinderGeometry(0.022, 0.022, 0.017, 16),
      alloy,
      [0, 0.016, -0.11],
    );
    housing.rotation.x = Math.PI / 2;
  }
  const lens = part(
    new THREE.CylinderGeometry(0.016, 0.017, 0.014, 16),
    material(0x5fbed7, { metalness: 0.6, roughness: 0.1 }),
    [0, 0.016, -0.117],
  );
  lens.rotation.x = Math.PI / 2;
  part(new THREE.CylinderGeometry(0.003, 0.003, 0.075, 6), dark, [0.045, 0.079, 0.065]);
  part(new THREE.SphereGeometry(0.012, 8, 6), tint, [0.045, 0.12, 0.065]);
  for (const x of [-0.063, 0.063])
    part(new THREE.BoxGeometry(0.014, 0.04, 0.09), rubber, [x, -0.03, 0]);
  if (kit) {
    // Flush fasteners and a recessed service panel stay inside the original hull.
    const panel = part(
      new THREE.BoxGeometry(0.062, 0.001, 0.063),
      kit.paint('enamel'),
      [0, 0.061, 0.022],
    );
    panel.castShadow = false;
    panel.userData.cosmeticDetail = true;
    const matrices = [];
    for (const x of [-0.049, 0.049])
      for (const z of [-0.026, 0.058])
        matrices.push(new THREE.Matrix4().makeTranslation(x, 0.061, z));
    instanceSimDetails({
      shape: new THREE.CylinderGeometry(0.003, 0.003, 0.002, 6),
      paint: kit.paint('copper'),
      parent,
      matrices,
      mesh,
    });
  }
  for (const x of [-0.053, 0.053]) {
    part(
      new THREE.BoxGeometry(0.011, 0.008, 0.006),
      material(0xd5f4eb, {
        emissive: 0x9be7d5,
        emissiveIntensity: 0.8,
      }),
      [x, 0.015, -0.08],
    );
    part(
      new THREE.BoxGeometry(0.011, 0.008, 0.006),
      material(0xea866d, {
        emissive: 0xc84c36,
        emissiveIntensity: 0.7,
      }),
      [x, 0.015, 0.073],
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
  if (pattern === 'stitched') {
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
