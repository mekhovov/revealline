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
function surfacePixels(kind, color, seed, size, pixel) {
  const data = new Uint8Array(size * size * 4),
    height = new Float32Array(size * size),
    normal = new Uint8Array(size * size * 4),
    properties = new Uint8Array(size * size * 4),
    rng = random(seed),
    base = new THREE.Color(color);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / size,
        v = y / size,
        grain = rng(),
        tau = Math.PI * 2;
      let shade = 0.91 + grain * 0.16,
        relief = grain * 0.025,
        roughness = 0.86;
      const patch = Math.sin(tau * u) * Math.sin(tau * v * 2) * 0.06;
      if (kind === 'concrete') {
        const joint = (u * 2) % 1 < 0.007 || (v * 2) % 1 < 0.007;
        shade *= joint ? 0.64 : 1 + patch - (grain < 0.03 ? 0.16 : 0);
        relief += joint ? -0.13 : patch * 0.3;
        roughness = 0.76 + grain * 0.2;
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
        shade *= 0.88 + vein * 0.1 + patch;
        relief += vein * 0.045;
        roughness = 0.67 + grain * 0.17;
      }
      if (kind === 'grass') {
        shade *= 0.85 + patch * 2 + Math.sin((u * 37 + v * 19) * tau) * 0.1;
        relief += grain * 0.1;
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
  const detail = new THREE.Group();
  detail.name = 'surface-detail';
  world.add(detail);
  const pixel = profile.textureFilter === 'nearest';
  const floorMaps = surfaceMaps(natural ? 'grass' : 'concrete', theme.ground, { pixel });
  // Repeat in metres across the entire ground, including its outer apron.
  for (const texture of new Set(Object.values(floorMaps)))
    texture.repeat.set((width + 100) / 4, (depth + 100) / 4);
  const ground = mesh(
    new THREE.PlaneGeometry(width + 100, depth + 100),
    material(0xffffff, { ...floorMaps, normalScale: new THREE.Vector2(0.35, 0.35), roughness: 1 }),
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
    environment === 'courtyard' ? 'brick' : natural ? 'wood' : 'metal',
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
  const structure = (size, at, paint = walls) => {
    const value = mesh(new THREE.BoxGeometry(...size), paint, indoor ? world : backdrop);
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
    for (let z = min.z + 4; z < max.z; z += 12)
      for (const x of [min.x + width * 0.25, min.x + width * 0.75]) {
        structure([3.6, 0.15, 0.35], [x, max.y + 0.04, z], hardware);
        structure([3.2, 0.025, 0.28], [x, max.y - 0.001, z], beamLight);
      }
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
      // Cornices and plinths give buildings scale without changing flyable gaps.
      structure([6.12, 0.24, 6.12], [x, 0.22, z], material(0x9b9587));
      structure([6.1, 0.18, 6.1], [x, height - 0.6, z], material(0xf0e5cb));
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
  world.userData.ownedMaterials.push(hardware);
  return {
    theme,
    profile,
    indoor,
    backdrop,
    obstacleMap: wallMap,
    obstacleMaps: wallMaps,
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
