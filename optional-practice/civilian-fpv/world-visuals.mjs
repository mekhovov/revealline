import * as THREE from './vendor/three.module.js';
import { resolveThemeProfile } from './world-themes.mjs';

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
function surfaceTexture(kind, color, seed = 971) {
  const size = 128,
    data = new Uint8Array(size * size * 4),
    rng = random(seed),
    base = new THREE.Color(color);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let shade = 0.86 + rng() * 0.22;
      if (kind === 'concrete' && (x % 64 === 0 || y % 64 === 0)) shade *= 0.58;
      if (kind === 'metal') shade *= x % 16 < 3 ? 0.7 : 1.04;
      if (kind === 'brick' && (y % 32 < 2 || (x + (Math.floor(y / 32) % 2) * 32) % 64 < 2))
        shade *= 0.63;
      if (kind === 'wood') shade *= 0.83 + Math.sin(x * 0.2 + Math.sin(y * 0.05)) * 0.17;
      if (kind === 'grass') shade *= 0.9 + Math.sin(x * 0.81 + y * 0.14) * 0.11;
      const at = (y * size + x) * 4;
      data[at] = Math.min(255, base.r * 255 * shade);
      data[at + 1] = Math.min(255, base.g * 255 * shade);
      data[at + 2] = Math.min(255, base.b * 255 * shade);
      data[at + 3] = 255;
    }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  // Color() values above are linear, matching Three's working color space.
  texture.colorSpace = THREE.LinearSRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
export function buildWorldVisuals({ course, world, mesh, material, box }) {
  const profile = resolveThemeProfile(course),
    theme = profile.palette,
    environment = course.environment;
  const min = Object.fromEntries(Object.entries(course.bounds.min).map(([k, v]) => [k, v / 1000]));
  const max = Object.fromEntries(Object.entries(course.bounds.max).map(([k, v]) => [k, v / 1000]));
  const width = max.x - min.x,
    depth = max.z - min.z,
    cx = (min.x + max.x) / 2,
    cz = (min.z + max.z) / 2;
  const indoor = ['gym', 'warehouse', 'garage'].includes(environment);
  const natural = ['field', 'woodland'].includes(environment);
  const backdrop = new THREE.Group();
  backdrop.name = 'procedural-scenery-fallback';
  world.add(backdrop);
  const floorMap = surfaceTexture(natural ? 'grass' : 'concrete', theme.ground);
  if (profile.textureFilter === 'nearest') {
    floorMap.magFilter = THREE.NearestFilter;
    floorMap.minFilter = THREE.NearestMipmapNearestFilter;
  }
  floorMap.repeat.set(Math.max(2, width / 4), Math.max(2, depth / 4));
  const ground = mesh(
    new THREE.PlaneGeometry(width + 100, depth + 100),
    material(0xffffff, { map: floorMap, bumpMap: floorMap, bumpScale: 0.025, roughness: 0.96 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(cx, min.y - 0.01, cz);
  ground.receiveShadow = true;
  const accent = material(theme.accent, {
    roughness: 0.5,
    emissive: theme.accent,
    emissiveIntensity: 0.1,
  });
  const wallMap = surfaceTexture(
    environment === 'courtyard' ? 'brick' : natural ? 'wood' : 'metal',
    natural ? 0x857763 : theme.wall,
  );
  if (profile.textureFilter === 'nearest') {
    wallMap.magFilter = THREE.NearestFilter;
    wallMap.minFilter = THREE.NearestMipmapNearestFilter;
  }
  wallMap.repeat.set(3, 2);
  const walls = material(0xffffff, {
    map: wallMap,
    bumpMap: wallMap,
    bumpScale: 0.015,
    roughness: 0.85,
    metalness: indoor ? 0.18 : 0.05,
  });
  world.userData.ownedMaterials = [accent, walls];
  const structure = (size, at, paint = walls) => {
    const value = mesh(new THREE.BoxGeometry(...size), paint, indoor ? world : backdrop);
    value.position.set(...at);
    value.castShadow = value.receiveShadow = true;
    return value;
  };
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
    for (const z of [min.z + 0.012, max.z - 0.012]) {
      structure([width, 0.35, 0.015], [cx, 1.6, z], accent);
      for (let x = min.x + 3; x < max.x - 2; x += 7)
        structure(
          [3, 1.4, 0.015],
          [x, max.y * 0.7, z],
          material(0xa8d5df, { emissive: 0x749fab, emissiveIntensity: 0.35 }),
        );
    }
    if (environment === 'garage') {
      for (let x = min.x + 3; x < max.x; x += 5) {
        const stripe = mesh(new THREE.PlaneGeometry(0.09, depth - 4), accent);
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(x, 0.012, cz);
      }
    }
  } else if (environment === 'courtyard') {
    for (let i = 0; i < 12; i++) {
      const side = i % 4,
        along = Math.floor(i / 4),
        height = 7 + (i % 3) * 2;
      const x = side < 2 ? (side ? max.x + 5 : min.x - 5) : min.x + (width * (along + 0.5)) / 3;
      const z =
        side >= 2 ? (side === 2 ? min.z - 5 : max.z + 5) : min.z + (depth * (along + 0.5)) / 3;
      structure([6, height, 6], [x, height / 2, z]);
      structure([6.4, 0.25, 6.4], [x, height + 0.12, z], material(theme.warm));
      for (let floor = 2; floor < height; floor += 2.5) {
        const pane = structure(
          [4.4, 1.1, 0.015],
          [x, floor, z + (z < cz ? 3.01 : -3.01)],
          material(0x698493, { metalness: 0.45, roughness: 0.3 }),
        );
        if (side < 2) {
          pane.rotation.y = Math.PI / 2;
          pane.position.set(x + (x < cx ? 3.01 : -3.01), floor, z);
        }
      }
    }
  } else if (environment === 'container-yard') {
    for (let i = 0; i < 18; i++) {
      const side = i % 4,
        slot = Math.floor(i / 4);
      const x = side < 2 ? (side ? max.x + 4 : min.x - 4) : min.x + 5 + (slot * (width - 10)) / 4;
      const z =
        side >= 2 ? (side === 2 ? min.z - 4 : max.z + 4) : min.z + 5 + (slot * (depth - 10)) / 4;
      const container = structure(
        [5, 2.7, 2.6],
        [x, 1.35, z],
        material(i % 3 ? 0xffffff : 0xffe0b0, { map: wallMap, metalness: 0.2 }),
      );
      container.rotation.y = side < 2 ? Math.PI / 2 : 0;
      if (i % 3 === 0) {
        const upper = structure([5, 2.7, 2.6], [x, 4.05, z], container.material);
        upper.rotation.y = container.rotation.y;
      }
    }
  } else if (environment === 'stadium') {
    for (const side of [-1, 1])
      for (let tier = 0; tier < 4; tier++) {
        const z = side < 0 ? min.z - 3 - tier * 2 : max.z + 3 + tier * 2;
        structure(
          [width + 8, 0.6, 1.5],
          [cx, 0.5 + tier * 1.2, z],
          material(tier % 2 ? theme.accent : theme.wall),
        );
      }
    for (const x of [min.x - 3, max.x + 3])
      for (const z of [min.z - 3, max.z + 3]) {
        structure([0.25, 13, 0.25], [x, 6.5, z]);
        structure(
          [2.5, 0.5, 0.5],
          [x, 12.8, z],
          material(0xfff2c9, { emissive: 0xffefd4, emissiveIntensity: 1.3 }),
        );
      }
  } else {
    const rng = random(environment === 'woodland' ? 7947 : 997),
      count = environment === 'woodland' ? 66 : 32;
    const radius = Math.hypot(width, depth) / 2 + 10;
    const leaves = [material(0x496b50), material(0x345749), material(0x7c905d)],
      bark = material(0x63554a);
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
  return { theme, profile, indoor, backdrop, obstacleMap: wallMap, center: [cx, cz], width, depth };
}

export function buildDroneVisual({ parent, mesh, material, box, kind = 'racer' }) {
  const pixel = kind === 'pixel',
    utility = kind === 'utility',
    rotors = [];
  const dark = material(pixel ? 0x293348 : 0x202b33, { metalness: 0.55, roughness: 0.42 });
  const shell = material(pixel ? 0x60e1d6 : utility ? 0xe7b875 : 0xc7d8c9, {
    metalness: 0.18,
    roughness: 0.4,
  });
  const tint = material(pixel ? 0xf3a870 : utility ? 0x91c8cf : 0xbdf083, {
    emissive: pixel ? 0x944a21 : 0x486834,
    emissiveIntensity: 0.25,
  });
  const part = (shape, paint, at) => {
    const value = mesh(shape, paint, parent);
    value.position.set(...at);
    value.castShadow = true;
    return value;
  };
  part(new THREE.BoxGeometry(0.17, 0.032, 0.13), dark, [0, 0, 0]);
  part(new THREE.BoxGeometry(0.12, 0.045, 0.13), shell, [0, 0.038, 0.016]);
  part(new THREE.BoxGeometry(0.027, 0.05, 0.132), dark, [0, 0.044, 0.016]);
  for (const x of [-0.103, 0.103])
    for (const z of [-0.103, 0.103]) {
      const arm = part(new THREE.BoxGeometry(0.018, 0.018, 0.15), dark, [x / 2, 0, z / 2]);
      arm.rotation.y = Math.atan2(x, z);
      part(new THREE.CylinderGeometry(0.021, 0.023, 0.038, pixel ? 6 : 12), shell, [x, 0.012, z]);
      const rotor = new THREE.Group();
      parent.add(rotor);
      rotor.position.set(x, 0.039, z);
      for (let blade = 0; blade < 3; blade++) {
        const prop = mesh(new THREE.BoxGeometry(0.016, 0.004, 0.12), tint, rotor);
        prop.rotation.y = (blade * Math.PI) / 3;
      }
      rotors.push(rotor);
      if (utility) {
        const duct = part(new THREE.TorusGeometry(0.067, 0.006, 6, 24), shell, [x, 0.025, z]);
        duct.rotation.x = Math.PI / 2;
      }
    }
  part(new THREE.BoxGeometry(0.06, 0.048, 0.045), dark, [0, 0.015, -0.087]);
  const lens = part(
    new THREE.CylinderGeometry(0.016, 0.017, 0.014, 16),
    material(0x5fbed7, { metalness: 0.6, roughness: 0.1 }),
    [0, 0.016, -0.117],
  );
  lens.rotation.x = Math.PI / 2;
  part(new THREE.CylinderGeometry(0.003, 0.003, 0.075, 6), dark, [0.045, 0.079, 0.065]);
  part(new THREE.SphereGeometry(0.012, 8, 6), tint, [0.045, 0.12, 0.065]);
  for (const x of [-0.063, 0.063])
    part(new THREE.BoxGeometry(0.014, 0.04, 0.09), dark, [x, -0.03, 0]);
  return { rotors, tint };
}
