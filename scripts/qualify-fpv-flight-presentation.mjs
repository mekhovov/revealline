import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
let full = fileURLToPath(new URL('../', import.meta.url)),
  baseline = 'cf0b62e53d352c620f1793a3539c251e8932674b',
  candidateRef = null,
  output = null;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const option = args[i];
  if (option === '--source-root' && args[i + 1]) full = path.resolve(args[++i]);
  else if (option === '--baseline' && args[i + 1]) baseline = args[++i];
  else if (option === '--candidate-ref' && args[i + 1]) candidateRef = args[++i];
  else if (option === '--out' && args[i + 1]) output = path.resolve(args[++i]);
  else if (option === '--help') {
    console.log(
      'Usage: node scripts/qualify-fpv-flight-presentation.mjs [--baseline LOCAL_REVISION] [--candidate-ref LOCAL_REVISION] [--source-root CHECKOUT] [--out NEW_RECEIPT.json]\nManual CPU geometry/material qualification, not a unit suite or browser/performance acceptance. Optional output never overwrites an existing receipt.',
    );
    process.exit(0);
  } else throw Error('Unknown or incomplete option: ' + option);
}
const resolve = (ref) => {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,159}$/.test(ref))
    throw Error('Use a bounded local Git revision.');
  return execFileSync('git', ['rev-parse', '--verify', '--end-of-options', ref + '^{commit}'], {
    cwd: full,
    encoding: 'utf8',
    timeout: 10000,
  }).trim();
};
baseline = resolve(baseline);
if (candidateRef) candidateRef = resolve(candidateRef);
const relative = 'optional-practice/civilian-fpv/world-visuals.mjs',
  rendererRelative = 'optional-practice/civilian-fpv/renderer.mjs';
const gitSource = (ref, file) =>
  execFileSync('git', ['show', ref + ':' + file], {
    cwd: full,
    encoding: 'utf8',
    maxBuffer: 6 * 1024 * 1024,
    timeout: 10000,
  });
const base = gitSource(baseline, relative);
const current = candidateRef
  ? gitSource(candidateRef, relative)
  : await fs.readFile(path.join(full, relative), 'utf8');
const currentRenderer = candidateRef
  ? gitSource(candidateRef, rendererRelative)
  : await fs.readFile(path.join(full, rendererRelative), 'utf8');
const hash = (value) =>
  createHash('sha256')
    .update(typeof value === 'string' ? value : JSON.stringify(value))
    .digest('hex');
const load = (source) =>
  import(
    'data:text/javascript;base64,' +
      Buffer.from(
        source.replace(
          /from\s+(['"])(\.{1,2}\/[^'"]+)\1/g,
          (_m, q, s) => `from ${q}${new URL(s, pathToFileURL(`${full}/${relative}`)).href}${q}`,
        ),
      ).toString('base64')
  );
const [before, after, THREE] = await Promise.all([
  load(base),
  load(current),
  import(pathToFileURL(`${full}/optional-practice/civilian-fpv/vendor/three.module.js`)),
]);
const checks = [];
const check = (title, pass, detail) => {
  checks.push({ title, pass, ...(detail ? { detail } : {}) });
  if (!pass) throw new Error(title);
};
function drone(module, kind, quality, collectionId) {
  const root = new THREE.Group();
  const mesh = (shape, paint, parent = root) => {
    const v = new THREE.Mesh(shape, paint);
    parent.add(v);
    return v;
  };
  const material = (color, extras = {}) => new THREE.MeshStandardMaterial({ color, ...extras });
  const box = (size, at, color, parent = root) => {
    const v = mesh(new THREE.BoxGeometry(...size), material(color), parent);
    v.position.set(...at);
    return v;
  };
  const visual = module.buildDroneVisual({
    parent: root,
    mesh,
    material,
    box,
    kind,
    quality,
    collectionId,
  });
  const materials = new Set(),
    geometry = new Set(),
    textures = new Set();
  let meshes = 0,
    triangles = 0;
  const rows = [];
  root.updateMatrixWorld(true);
  root.traverse((v) => {
    if (!v.isMesh) return;
    meshes++;
    geometry.add(v.geometry);
    triangles +=
      ((v.geometry.index?.count ?? v.geometry.attributes.position.count) / 3) *
      (v.isInstancedMesh ? v.count : 1);
    const paints = Array.isArray(v.material) ? v.material : [v.material];
    for (const p of paints) {
      materials.add(p);
      for (const key of ['map', 'normalMap', 'roughnessMap', 'aoMap'])
        if (p[key]) textures.add(p[key]);
    }
    rows.push({
      matrix: v.matrixWorld.toArray(),
      attributes: Object.fromEntries(
        Object.entries(v.geometry.attributes).map(([k, a]) => [k, Array.from(a.array)]),
      ),
      index: v.geometry.index ? Array.from(v.geometry.index.array) : null,
      instance: v.isInstancedMesh ? Array.from(v.instanceMatrix.array) : null,
      materials: paints.map((p) => ({
        color: p.color.toArray(),
        emissive: p.emissive?.toArray(),
        emissiveIntensity: p.emissiveIntensity,
        metalness: p.metalness,
        roughness: p.roughness,
        opacity: p.opacity,
        transparent: p.transparent,
        maps: ['map', 'normalMap', 'roughnessMap'].map((k) =>
          p[k]
            ? { name: p[k].name, data: hash(Array.from(p[k].image.data)), filter: p[k].magFilter }
            : null,
        ),
      })),
    });
  });
  return {
    root,
    visual,
    signature: hash(rows),
    meshes,
    triangles,
    geometry: geometry.size,
    materials: materials.size,
    textures: textures.size,
  };
}
const rows = [];
for (const collectionId of [null, 'industrial-workshop'])
  for (const kind of ['racer', 'pixel', 'utility'])
    for (const quality of ['low', 'balanced', 'high']) {
      const old = drone(before, kind, quality, collectionId),
        next = drone(after, kind, quality, collectionId),
        label = `${collectionId ?? 'authored'} / ${kind} / ${quality}`;
      check(
        `${label}: four unchanged motor/rotor centres`,
        JSON.stringify(old.visual.rotors.map((r) => r.position.toArray())) ===
          JSON.stringify(next.visual.rotors.map((r) => r.position.toArray())) &&
          next.visual.rotors.length === 4,
      );
      check(
        `${label}: mesh and material/texture counts do not increase`,
        next.meshes <= old.meshes &&
          next.materials <= old.materials &&
          next.textures <= old.textures,
      );
      if (kind === 'pixel')
        check(
          `${label}: exact Pixel visual geometry/material/transform bytes`,
          next.signature === old.signature,
        );
      else {
        const battery = next.root.getObjectByName('drone-battery'),
          batteryBox = new THREE.Box3().setFromObject(battery),
          straps = next.root.children.filter(
            (v) => v.geometry?.parameters?.shapes?.holes?.length === 1,
          ),
          upperPlate = new THREE.Box3().setFromObject(next.root.children[1]);
        check(
          `${label}: narrow battery seated above frame and both straps aligned`,
          batteryBox.max.x - batteryBox.min.x < 0.055 &&
            batteryBox.max.y - batteryBox.min.y < 0.032 &&
            batteryBox.min.y >= upperPlate.max.y - 1e-6 &&
            straps.length === 2 &&
            straps.every((v) => Math.abs(v.position.y - battery.position.y) < 1e-9),
        );
        const landingPads = next.root.getObjectByName('drone-landing-pads'),
          lowerPlate = new THREE.Box3().setFromObject(next.root.children[0]),
          padMatrix = new THREE.Matrix4();
        let attached = landingPads?.count === 4;
        for (let pad = 0; pad < (landingPads?.count ?? 0); pad++) {
          landingPads.getMatrixAt(pad, padMatrix);
          landingPads.geometry.computeBoundingBox();
          const bounds = landingPads.geometry.boundingBox.clone().applyMatrix4(padMatrix);
          attached &&=
            Math.abs(bounds.max.y - lowerPlate.min.y) <= 0.0007 &&
            bounds.max.y - bounds.min.y <= 0.01101 &&
            bounds.min.x >= lowerPlate.min.x &&
            bounds.max.x <= lowerPlate.max.x &&
            bounds.min.z >= lowerPlate.min.z &&
            bounds.max.z <= lowerPlate.max.z;
        }
        check(`${label}: four short TPU pads meet lower frame at existing corners`, attached);
        const lens = next.root.getObjectByName('drone-glass-lens');
        check(
          `${label}: convex nonmetal glass and two camera cheeks`,
          lens.geometry.type === 'SphereGeometry' &&
            lens.material.metalness === 0 &&
            next.root.children.filter((v) => v.name === 'drone-camera-cheek').length === 2,
        );
        let radius = 0,
          localRadius = 0,
          analyticRadius = 0;
        for (let phase = 0; phase < 24; phase++) {
          next.visual.rotors.forEach((r) => (r.rotation.y = (phase * Math.PI) / 12));
          next.root.updateMatrixWorld(true);
          for (const rotor of next.visual.rotors) {
            const prop = rotor.getObjectByName('drone-swept-propeller'),
              a = prop.geometry.attributes.position,
              p = new THREE.Vector3();
            for (let i = 0; i < a.count; i++) {
              p.fromBufferAttribute(a, i);
              localRadius = Math.max(localRadius, Math.hypot(p.x, p.z));
              analyticRadius = Math.max(
                analyticRadius,
                Math.hypot(
                  Math.hypot(rotor.position.x, rotor.position.z) + Math.hypot(p.x, p.z),
                  rotor.position.y + p.y,
                ),
              );
              p.applyMatrix4(prop.matrixWorld);
              radius = Math.max(radius, p.length());
            }
          }
        }
        check(
          `${label}: all-angle prop stays inside unchanged collision sphere`,
          radius < 0.22 && analyticRadius < 0.22,
          { maxSampledRadius: radius, allAnglesUpperBound: analyticRadius },
        );
        if (kind === 'utility')
          check(`${label}: prop stays inside existing guard`, localRadius < 0.061, {
            maxRadius: localRadius,
          });
      }
      rows.push({
        collectionId,
        kind,
        quality,
        before: {
          meshes: old.meshes,
          triangles: old.triangles,
          geometry: old.geometry,
          materials: old.materials,
          textures: old.textures,
        },
        after: {
          meshes: next.meshes,
          triangles: next.triangles,
          geometry: next.geometry,
          materials: next.materials,
          textures: next.textures,
        },
      });
      before.disposeSimVisualGroup(old.root);
      after.disposeSimVisualGroup(next.root);
    }
check(
  'World visual composition/generators unchanged apart from lazy existing-finish accessor',
  before.buildWorldVisuals.toString() ===
    after.buildWorldVisuals
      .toString()
      .replace(
        "    // Keep fittings in this world's existing material/texture ownership. The\n" +
          '    // Themes steel kit owns its finish; authored worlds reuse neutral hardware.\n' +
          "    obstacleFittingsMaterial: () => (kit ? kit.paint('steel') : hardware),\n",
        '',
      ) && before.createWorkshopTexture.toString() === after.createWorkshopTexture.toString(),
);
const containers = [];
for (const size of [
  [5, 2.6, 12],
  [5, 5.2, 12],
]) {
  const { shell, hardware } = after.buildContainerVisualGeometry(size),
    paint = new THREE.MeshBasicMaterial(),
    mesh = new THREE.Mesh(shell, paint);
  mesh.updateMatrixWorld(true);
  for (const [name, geometry] of Object.entries({ shell, hardware })) {
    let finite = true,
      inside = true;
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++)
      for (let a = 0; a < 3; a++) {
        const value = pos.array[i * 3 + a];
        finite &&= Number.isFinite(value);
        inside &&= Math.abs(value) <= size[a] / 2 + 1e-6;
      }
    check(`${size.join('×')} ${name}: finite vertices within unchanged AABB`, finite && inside);
  }
  let hits = 0,
    maxInset = 0;
  for (let axis = 0; axis < 3; axis++)
    for (const sign of [-1, 1])
      for (const a of [-0.45, -0.25, 0, 0.25, 0.45])
        for (const b of [-0.45, -0.25, 0, 0.25, 0.45]) {
          const other = [0, 1, 2].filter((v) => v !== axis),
            origin = new THREE.Vector3(),
            direction = new THREE.Vector3();
          origin.setComponent(axis, sign * (size[axis] / 2 + 1));
          origin.setComponent(other[0], a * size[other[0]]);
          origin.setComponent(other[1], b * size[other[1]]);
          direction.setComponent(axis, -sign);
          const result = new THREE.Raycaster(origin, direction, 0, 2).intersectObject(mesh);
          if (result.length) {
            hits++;
            maxInset = Math.max(maxInset, result[0].distance - 1);
          }
        }
  check(`${size.join('×')}: all 150 outside rays meet closed outward-facing shell`, hits === 150, {
    hits,
    maxInset,
  });
  containers.push({
    size,
    shellTriangles: shell.attributes.position.count / 3,
    hardwareTriangles: hardware.attributes.position.count / 3,
    maxInset,
  });
  shell.dispose();
  hardware.dispose();
  paint.dispose();
}
// Exercise the actual world material factory independently of WebGL. Requesting
// fittings must reuse an existing world-owned finish and never allocate a map.
const { WORLD_CATALOGUE } = await import(
  pathToFileURL(`${full}/optional-practice/civilian-fpv/world-catalogue.mjs`)
);
for (const appearance of ['authored', 'industrial-workshop'])
  for (const quality of ['low', 'balanced', 'high']) {
    const world = new THREE.Group(),
      created = new Set(),
      course = WORLD_CATALOGUE.find((e) => e.id === 'container-yard-01').course;
    const material = (color, extras = {}) => {
      const paint = new THREE.MeshStandardMaterial({ color, ...extras });
      created.add(paint);
      return paint;
    };
    const mesh = (shape, paint, parent = world) => {
      const value = new THREE.Mesh(shape, paint);
      parent.add(value);
      return value;
    };
    const box = (size, at, color, parent = world) => {
      const value = mesh(new THREE.BoxGeometry(...size), material(color), parent);
      value.position.set(...at);
      return value;
    };
    const presentation = { collectionId: appearance, revision: 'r1' };
    const visual = after.buildWorldVisuals({
      course,
      world,
      mesh,
      material,
      box,
      quality,
      presentation,
    });
    const map = visual.obstacleSurface('metal').map;
    const collectMaps = () =>
      new Set(
        [...created].flatMap((paint) =>
          ['map', 'normalMap', 'roughnessMap'].map((key) => paint[key]).filter(Boolean),
        ),
      );
    const mapsBefore = collectMaps(),
      materialCount = created.size,
      fittings = visual.obstacleFittingsMaterial(),
      mapsAfter = collectMaps();
    check(
      `${appearance}/${quality}: fittings reuse existing world finish without new material/map`,
      visual.obstacleFittingsMaterial() === fittings &&
        created.size === materialCount &&
        mapsBefore.size === mapsAfter.size &&
        [...mapsAfter].every((t) => mapsBefore.has(t)) &&
        (!fittings.map || fittings.map === map) &&
        !fittings.transparent &&
        fittings.opacity === 1,
      {
        materials: materialCount,
        textures: mapsAfter.size,
        roughness: fittings.roughness,
        metalness: fittings.metalness,
        collectionId: fittings.userData.collectionId ?? null,
      },
    );
    after.disposeSimVisualGroup(world);
    created.forEach((paint) => paint.dispose());
    mapsAfter.forEach((texture) => texture.dispose());
  }
const receipt = {
  kind: 'manual-functional-cpu-qualification',
  source: {
    base: baseline,
    candidateRef,
    worldVisuals: hash(current),
    renderer: hash(currentRenderer),
    supportingDependencyMode:
      'Both visual sources import the selected source-root shared modules; the separate browser fixture freezes complete before/after trees.',
  },
  checks,
  droneModels: rows,
  containers,
  limitations: [
    'No actual WebGL screenshot or frame-time measurement in this CPU qualification.',
    'No physical device, real radio or novice acceptance claim.',
    'Simulation and course files are unchanged; this is not a new proof replay claim.',
  ],
};
if (output) await fs.writeFile(output, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(
  JSON.stringify({
    pass: checks.filter((x) => x.pass).length,
    checks: checks.length,
    output,
    source: receipt.source,
    containers,
    droneModels: rows,
  }),
);
