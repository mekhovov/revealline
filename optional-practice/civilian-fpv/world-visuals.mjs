import * as THREE from './vendor/three.module.js';
import { resolveThemeProfile } from './world-themes.mjs';

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
export function themeForCourse(course) {
  return resolveThemeProfile(course).palette;
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
function buildEnvironmentDressing({ course, world, material, bounds, theme, pixel }) {
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
    const trail = material(0x8b886d, { roughness: 1 });
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
      material(new THREE.Color(theme.ground).lerp(new THREE.Color(theme.fog), 0.12)),
      true,
    );
  }
  for (const [name, rows, color, opacity] of [
    ['facility-paint', marks, theme.warm, 0.58],
    ['facility-secondary-paint', secondary, pixel ? theme.accent : 0xd9d9ca, 0.45],
    ['floor-expansion-joints', joints, 0x293832, 0.22],
  ])
    if (rows.length)
      batch(name, new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), rows, paint(color, opacity));
  return group;
}

export function buildWorldVisuals({ course, world, mesh, material, box }) {
  const profile = resolveThemeProfile(course),
    theme = profile.palette,
    environment = course.environment,
    adventure = ADVENTURE_SURFACES[environment];
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
  world.add(backdrop);
  const detail = new THREE.Group();
  detail.name = 'surface-detail';
  world.add(detail);
  const pixel = profile.textureFilter === 'nearest';
  const hangar = environment === 'gym';
  const floorKind =
    adventure?.floor ??
    (hangar
      ? 'hangar-concrete'
      : natural
        ? 'grass'
        : environment === 'courtyard'
          ? 'paving'
          : environment === 'container-yard' || environment === 'stadium'
            ? 'asphalt'
            : 'concrete');
  const floorColor =
    natural || pixel
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
  const floorMaps = surfaceMaps(floorKind, floorColor, { pixel });
  // Repeat in metres across the entire ground, including its outer apron.
  const floorTile = natural ? 12 : environment === 'courtyard' ? 4 : 6;
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
  ground.position.set(cx, min.y - 0.01, cz);
  ground.receiveShadow = true;
  const accent = material(theme.accent, {
    roughness: 0.5,
    emissive: theme.accent,
    emissiveIntensity: 0.1,
  });
  const wallMaps = surfaceMaps(
    adventure?.wall ??
      (hangar
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
    texture.repeat.set(hangar ? 1 : 3, hangar ? 1 : 2);
  const wallMap = wallMaps.map;
  const walls = material(0xffffff, {
    ...wallMaps,
    normalScale: new THREE.Vector2(0.3, 0.3),
    roughness: 1,
    metalness: indoor ? 0.18 : 0.05,
  });
  world.userData.ownedMaterials = [accent, walls];
  const serviceBand = hangar
    ? material(0xffffff, {
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
      const maps = surfaceMaps(kind, colors[kind], { pixel });
      // A shared owner stays under world even when callers make no obstacle
      // mesh, and never shares texture lifetime with independently removed actors.
      world.userData.ownedMaterials.push(material(0xffffff, maps));
      obstacleSurfaces.set(kind, maps);
    }
    return obstacleSurfaces.get(kind);
  };
  const structure = (size, at, paint = walls) => {
    const shape = new THREE.BoxGeometry(...size);
    if (hangar && (paint === walls || paint === serviceBand)) {
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
    value.castShadow = value.receiveShadow = true;
    return value;
  };
  // Surface detailing only: structural silhouettes and flight sight lines are
  // identical in every preset. Repeated fasteners share one draw call.
  const hardware = material(0x87969b, { roughness: 0.48, metalness: 0.7 });
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
    detail.add(rivets);
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
      structure([width, 0.35, 0.015], [cx, 1.6, z], serviceBand);
      for (let x = min.x + 3; x < max.x - 2; x += 7)
        structure([3, 1.4, 0.015], [x, max.y * 0.7, z], windowPaint);
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
      bark = material(0x63554a);
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
  });
  // Thin painted boundary markings are wayfinding, not physical barriers.
  for (const z of [min.z, max.z]) box([width, 0.012, 0.06], [cx, 0.012, z], theme.warm);
  for (const x of [min.x, max.x]) box([0.06, 0.012, depth], [x, 0.012, cz], theme.warm);
  const pad = mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.016, 48), material(0xe7ddbd));
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
      detail.visible = value === 'high';
    },
  };
}

export function buildDroneVisual({ parent, mesh, material, kind = 'racer', quality = 'balanced' }) {
  const pixel = kind === 'pixel',
    utility = kind === 'utility',
    detail = quality === 'high' && !pixel,
    rotors = [];
  const carbon = !pixel && quality !== 'low' ? surfaceMaps('carbon', 0x283139) : {};
  const dark = material(pixel ? 0x293348 : 0x202b33, {
    ...carbon,
    metalness: 0.18,
    roughness: 0.72,
    normalScale: new THREE.Vector2(0.15, 0.15),
  });
  const shell = material(pixel ? 0x60e1d6 : utility ? 0xe7b875 : 0xc7d8c9, {
    metalness: 0.18,
    roughness: 0.4,
  });
  const tint = material(pixel ? 0xf3a870 : utility ? 0x91c8cf : 0xbdf083, {
    emissive: pixel ? 0x944a21 : 0x486834,
    emissiveIntensity: 0.25,
  });
  const alloy = material(0x9eacb1, { metalness: 0.82, roughness: 0.28 });
  const rubber = material(0x171d23, { roughness: 0.94 });
  const copper = detail ? material(0xbb7349, { metalness: 0.8, roughness: 0.3 }) : shell;
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
