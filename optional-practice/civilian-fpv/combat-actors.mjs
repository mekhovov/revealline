import { ACTOR_FAMILIES, actorVisual } from '../../game/hunt/actor-catalog.mjs';
import { sharedActorAppearance } from '../../game/hunt/preferences.mjs';
import { COMBAT_APPEARANCE_LIMITS } from './combat-appearance.mjs';
import {
  buildIndustrialSoldier,
  applyIndustrialSoldierPose,
  industrialSoldierPaintKeys,
} from './industrial-soldiers.mjs';
import { buildIndustrialVehicle, INDUSTRIAL_VEHICLE_MODELS } from './industrial-vehicles.mjs';

const families = new Set(ACTOR_FAMILIES.map(({ id }) => id));
const finite = (p) => p && ['x', 'y', 'z'].every((key) => Number.isFinite(p[key]));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
// Representative-art ceiling; raising it requires a separate skinning qualification.
export const COMBAT_SKINNED_ACTOR_LIMIT = 20;
export const COMBAT_ACTOR_LIMIT = 128;
export const COMBAT_CROWD_PALETTE_BYTES = 8 * 1024 * 1024;

/** Reuses the native articulated wardrobe as a CPU pose template. Four shared
 * primitive batches render the complete admitted crowd; a soldier's separate limbs never
 * become dozens of scene draw calls. Templates are not collision bodies. */
export function createCombatActorPresentation({ THREE, scene, appearanceTemplate = null }) {
  const root = new THREE.Group();
  root.name = 'combat-live-actors';
  scene.add(root);
  const batches = new Map(),
    rows = new Map(),
    acceptedCasts = new Map(),
    healthHistory = new Map();
  const matrix = new THREE.Matrix4(),
    unitScale = new THREE.Matrix4(),
    tint = new THREE.Color();
  const geometries = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
    tapered: new THREE.CylinderGeometry(0.4, 0.5, 1, 10),
    sphere: new THREE.SphereGeometry(0.5, 10, 8),
  };
  for (const [name, geometry] of Object.entries(geometries)) {
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.82,
      metalness: 0.08,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, 2048);
    mesh.name = `combat-live-${name}`;
    mesh.count = 0;
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.setColorAt(0, tint.set(0xffffff));
    root.add(mesh);
    batches.set(name, mesh);
  }
  const healthGeometry = new THREE.PlaneGeometry(1, 1),
    healthPools = [];
  for (const [name, color] of [
    ['background', 0x171c22],
    ['fill', 0xf1c66a],
  ]) {
    const material = new THREE.MeshBasicMaterial({ color, toneMapped: false, depthWrite: false });
    const mesh = new THREE.InstancedMesh(healthGeometry, material, COMBAT_ACTOR_LIMIT);
    mesh.name = `combat-health-${name}`;
    mesh.count = 0;
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.renderOrder = 2;
    root.add(mesh);
    healthPools.push(mesh);
  }
  const healthPosition = new THREE.Vector3(),
    healthNormal = new THREE.Vector3(),
    healthDirection = new THREE.Vector3(),
    healthRight = new THREE.Vector3(),
    healthRotation = new THREE.Quaternion(),
    healthScale = new THREE.Vector3(),
    forward = new THREE.Vector3(0, 0, 1);
  let active = false,
    current = [],
    ticks = 0,
    disposed = false,
    lastQuality = 'balanced';
  let resources = {
    actors: 0,
    instances: 0,
    calls: 0,
    skinnedActors: 0,
    skinnedCalls: 0,
    crowdActors: 0,
    crowdInstances: 0,
    crowdCalls: 0,
  };
  let appearance = null;
  const gearPools = new Map();
  const crowdPools = () =>
    [...(appearance?.crowdPalettes.values() ?? [])].flatMap((palette) => palette.pools);
  const releaseClone = (row, source = row.source) => {
    row.mixer?.stopAllAction();
    row.mixer?.uncacheRoot(row.model);
    const skeletons = new Set(),
      shapes = new Set(),
      paints = new Set(),
      textures = new Set();
    const sharedTextures = new Set(
      [...(source?.materials ?? [])].flatMap((paint) =>
        Object.values(paint).filter((value) => value?.isTexture),
      ),
    );
    const sharedImages = new Set([...sharedTextures].map((texture) => texture.source?.data));
    row.model?.traverse((node) => {
      if (node.skeleton && !source?.skeletons.has(node.skeleton)) skeletons.add(node.skeleton);
      if (node.geometry && !source?.geometries.has(node.geometry)) shapes.add(node.geometry);
      for (const paint of Array.isArray(node.material) ? node.material : [node.material])
        if (paint && !source?.materials.has(paint)) {
          paints.add(paint);
          for (const value of Object.values(paint))
            if (value?.isTexture && !sharedTextures.has(value)) textures.add(value);
        }
    });
    for (const skeleton of skeletons) skeleton.dispose();
    for (const texture of textures) {
      if (!sharedImages.has(texture.source?.data)) texture.source?.data?.close?.();
      texture.dispose();
    }
    for (const shape of shapes) shape.dispose();
    for (const paint of paints) paint.dispose();
    if (row.model !== source?.input.scene) row.model?.removeFromParent();
    row.group?.removeFromParent();
  };
  const release = (row) => {
    if (row.crowd) {
      row.group.removeFromParent();
      return;
    }
    if (row.skinned) {
      releaseClone(row);
      return;
    }
    row.group.traverse((item) => {
      item.geometry?.dispose();
    });
    for (const material of row.paints) material.dispose();
  };
  const clearRows = () => {
    for (const row of rows.values()) release(row);
    rows.clear();
  };
  const clear = () => {
    clearRows();
    current = [];
    acceptedCasts.clear();
    healthHistory.clear();
    active = false;
    for (const mesh of [
      ...batches.values(),
      ...gearPools.values(),
      ...healthPools,
      ...crowdPools(),
    ]) {
      mesh.count = 0;
      mesh.visible = false;
    }
  };
  /** The host admits bytes/hashes before transferring this cache lease. No URL
   * or loader is accepted here. Successful installation owns release() until
   * replacement/disposal; rejected leases remain the caller's responsibility. */
  const poseKey = (source) =>
    JSON.stringify([
      source.input.scene.uuid,
      [...source.clips].map(([name, clip]) => [name, clip.uuid]),
      source.motion,
    ]);
  function readAppearanceTemplate(input) {
    if (
      !input ||
      input.ready !== true ||
      !/^[a-f0-9]{64}$/.test(input.sha256) ||
      !families.has(input.family) ||
      !input.scene?.isObject3D ||
      typeof input.clone !== 'function' ||
      !Number.isFinite(input.height) ||
      input.height <= 0 ||
      input.height > 8 ||
      !Number.isFinite(input.radius) ||
      input.radius <= 0 ||
      input.radius > 4 ||
      (input.cast !== undefined && !['tactical', 'rivals', 'arcade'].includes(input.cast)) ||
      (input.forward !== undefined && !['+z', '-z'].includes(input.forward)) ||
      (input.release !== undefined && typeof input.release !== 'function') ||
      !Array.isArray(input.clips) ||
      !input.clips.length ||
      input.clips.length > 32
    )
      throw new Error('Invalid admitted appearance template');
    const next = {
      input,
      objects: new Set(),
      skeletons: new Set(),
      geometries: new Set(),
      materials: new Set(),
      meshes: 0,
      clips: new Map(),
      motion: { ...input.motion },
    };
    let skinned = 0,
      slots = 0;
    input.scene.traverse((node) => {
      next.objects.add(node);
      if (node.isLight || node.isCamera || node.isLine || node.isPoints)
        throw new Error('Appearance templates contain only models and bones');
      if (!node.isMesh) return;
      next.meshes++;
      if (!node.geometry?.isBufferGeometry) throw new Error('Missing appearance geometry');
      next.geometries.add(node.geometry);
      const paints = Array.isArray(node.material) ? node.material : [node.material];
      const draws = Array.isArray(node.material) ? node.geometry.groups.length : 1;
      if (!draws) throw new Error('Empty appearance material groups');
      slots += draws;
      for (const paint of paints) {
        if (!paint?.isMaterial || paint.transparent)
          throw new Error('Unsupported appearance material');
        next.materials.add(paint);
      }
      if (node.isSkinnedMesh) {
        skinned++;
        if (!node.skeleton?.bones.length || node.skeleton.bones.length > 64)
          throw new Error('Appearance rig exceeds joint budget');
        next.skeletons.add(node.skeleton);
      }
    });
    if (!skinned || next.objects.size > 256 || next.meshes > 2 || slots > 2)
      throw new Error('Appearance model exceeds representative budget');
    next.calls = slots;
    for (const skeleton of next.skeletons)
      if (skeleton.bones.some((bone) => !next.objects.has(bone)))
        throw new Error('All appearance bones must belong to the template root');
    for (const clip of input.clips) {
      if (
        !(clip instanceof THREE.AnimationClip) ||
        !clip.name ||
        next.clips.has(clip.name) ||
        clip.tracks.length > 128 ||
        !clip.validate()
      )
        throw new Error('Invalid appearance clip');
      next.clips.set(clip.name, clip);
    }
    for (const role of ['idle', 'walk', 'run', 'warning']) {
      next.motion[role] ??= next.clips.has(role) ? role : null;
      if (next.motion[role] !== null && !next.clips.has(next.motion[role]))
        throw new Error('Missing appearance motion clip');
    }
    next.motion.idle ??= input.clips[0].name;
    next.equipment = [];
    for (const gear of input.equipment ?? []) {
      if (
        !gear.mesh?.isObject3D ||
        !gear.bindMatrix?.isMatrix4 ||
        ![...next.objects].some((node) => node.isBone && node.name === gear.bone)
      )
        throw new TypeError('Invalid authored equipment binding');
      gear.mesh.updateWorldMatrix(true, true);
      const inverse = gear.mesh.matrixWorld.clone().invert();
      gear.mesh.traverse((node) => {
        if (!node.isMesh) return;
        if (node.isSkinnedMesh) throw new TypeError('Equipment must be rigid');
        const paints = Array.isArray(node.material) ? node.material : [node.material];
        if (paints.some((paint) => !paint?.isMaterial || paint.transparent))
          throw new TypeError('Invalid equipment surface');
        next.equipment.push({
          geometry: node.geometry,
          material: node.material,
          calls: Array.isArray(node.material) ? node.geometry.groups.length : 1,
          bone: gear.bone,
          color: new THREE.Color().fromArray(gear.color ?? [1, 1, 1]),
          offset: new THREE.Matrix4().multiplyMatrices(
            gear.bindMatrix,
            new THREE.Matrix4().multiplyMatrices(inverse, node.matrixWorld),
          ),
          role: gear.role,
          openOffset: new THREE.Matrix4()
            .multiplyMatrices(
              new THREE.Matrix4().makeTranslation(...(gear.openOffset ?? [0, 0, 0])),
              gear.bindMatrix,
            )
            .multiply(new THREE.Matrix4().multiplyMatrices(inverse, node.matrixWorld)),
        });
      });
    }
    next.probe = cloneAppearance(next);
    return next;
  }
  function retireAppearance() {
    clearRows();
    for (const palette of appearance?.crowdPalettes.values() ?? []) releaseCrowdPalette(palette);
    for (const source of appearance?.sources ?? []) {
      if (source.probe) releaseClone(source.probe, source);
      try {
        source.input.release?.();
      } catch {
        /* Keep fallback available. */
      }
    }
    for (const mesh of gearPools.values()) {
      mesh.removeFromParent();
      mesh.dispose();
    }
    gearPools.clear();
    appearance = null;
  }
  function setAppearanceTemplates(entries) {
    if (disposed) return false;
    const sources = [],
      byIdentity = new Map(),
      stagedGear = new Map(),
      crowdPalettes = new Map();
    let valid = true,
      resourceMetrics = null;
    try {
      entries ??= [];
      if (!Array.isArray(entries) || entries.length > 36)
        throw new TypeError('Invalid appearance collection');
      const inputs = new Set(),
        probes = new Set();
      for (const entry of entries) {
        if (!Array.isArray(entry.lods) || !entry.lods.length || entry.lods.length > 4)
          throw new TypeError('Invalid appearance detail collection');
        const lods = [];
        for (const input of entry.lods) {
          if (inputs.has(input)) throw new TypeError('Repeated appearance lease');
          inputs.add(input);
          if (input.resourceMetrics !== undefined) {
            const next = input.resourceMetrics;
            for (const key of ['decodedBytes', 'gpuBytes']) {
              if (
                !Number.isSafeInteger(next?.[key]) ||
                next[key] < 0 ||
                (resourceMetrics && next[key] !== resourceMetrics[key])
              )
                throw new TypeError('Invalid appearance resource accounting');
            }
            resourceMetrics = { decodedBytes: next.decodedBytes, gpuBytes: next.gpuBytes };
          }
          const source = readAppearanceTemplate(input);
          sources.push(source);
          const key = poseKey(source);
          if (probes.has(key)) {
            releaseClone(source.probe, source);
            source.probe = null;
          } else probes.add(key);
          lods.push(source);
        }
        const key = `${lods[0].input.family}/${lods[0].input.cast ?? '*'}`;
        if (
          byIdentity.has(key) ||
          lods.some(
            (source) =>
              `${source.input.family}/${source.input.cast ?? '*'}` !== key ||
              source.input.sha256 !== sources[0].input.sha256,
          )
        )
          throw new TypeError('Mixed appearance identity');
        byIdentity.set(key, lods);
      }
      const gearCapacity = new Map();
      for (const source of sources) {
        const counts = new Map();
        for (const piece of source.equipment) {
          const key = gearKey(piece);
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        for (const [key, count] of counts)
          gearCapacity.set(key, Math.max(gearCapacity.get(key) ?? 0, count * COMBAT_ACTOR_LIMIT));
      }
      for (const source of sources)
        for (const piece of source.equipment)
          gearPool(piece, stagedGear, false, gearCapacity.get(gearKey(piece)));
      let paletteBytes = 0;
      for (const lods of byIdentity.values()) {
        const source = lods.at(-1);
        const key = poseKey(source);
        if (!crowdPalettes.has(key)) {
          const representative = sources.find(
            (candidate) => candidate.probe && poseKey(candidate) === key,
          );
          const palette = bakeCrowdPalette(
            source,
            representative?.probe,
            COMBAT_CROWD_PALETTE_BYTES - paletteBytes,
          );
          paletteBytes += palette.bytes;
          crowdPalettes.set(key, palette);
        }
        source.crowdPalette = crowdPalettes.get(key);
      }
      if (resourceMetrics) {
        const gearBytes = [...stagedGear.values()].reduce(
          (sum, mesh) =>
            sum +
            mesh.instanceMatrix.array.byteLength +
            (mesh.instanceColor?.array.byteLength ?? 0),
          0,
        );
        // Admitted pack metrics already reserve twenty live skeletons and probes.
        // These are the additional shared body poses and full-crowd gear buffers.
        resourceMetrics.decodedBytes += paletteBytes + gearBytes;
        resourceMetrics.gpuBytes +=
          [...crowdPalettes.values()].reduce((sum, palette) => sum + palette.gpuBytes, 0) +
          gearBytes;
        if (
          resourceMetrics.decodedBytes > COMBAT_APPEARANCE_LIMITS.decodedBytes ||
          resourceMetrics.gpuBytes > COMBAT_APPEARANCE_LIMITS.gpuBytes
        )
          throw new TypeError('Appearance and crowd resources exceed the pack budget');
      }
    } catch {
      for (const palette of crowdPalettes.values()) releaseCrowdPalette(palette);
      for (const mesh of stagedGear.values()) mesh.dispose();
      for (const source of sources) if (source.probe) releaseClone(source.probe, source);
      valid = false;
    }
    retireAppearance();
    if (!valid) return false;
    if (sources.length) {
      appearance = {
        sources,
        byIdentity,
        crowdPalettes,
        resourceMetrics,
        hash: sources[0].input.sha256,
      };
      for (const [key, mesh] of stagedGear) {
        gearPools.set(key, mesh);
        root.add(mesh);
      }
      for (const mesh of crowdPools()) root.add(mesh);
    }
    return true;
  }
  function setAppearanceTemplate(input) {
    if (input && appearance?.sources.length === 1 && appearance.sources[0].input === input)
      return true;
    return setAppearanceTemplates(input === null ? [] : [{ lods: [input] }]);
  }
  // Grow whole batches before writing. No admitted actor loses limbs or equipment
  // when the crowd exceeds the initial allocation.
  function reserveBatch(pools, key, required) {
    let mesh = pools.get(key);
    if (required <= mesh.instanceMatrix.count) return mesh;
    const size = Math.max(required, mesh.instanceMatrix.count * 2);
    const replacement = new THREE.InstancedMesh(mesh.geometry, mesh.material, size);
    replacement.name = mesh.name;
    replacement.frustumCulled = false;
    replacement.castShadow = false;
    replacement.receiveShadow = true;
    replacement.userData = { ...mesh.userData };
    replacement.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    replacement.instanceMatrix.array.set(mesh.instanceMatrix.array);
    replacement.setColorAt(0, tint.set(0xffffff));
    if (mesh.instanceColor) replacement.instanceColor.array.set(mesh.instanceColor.array);
    replacement.count = mesh.count;
    replacement.visible = mesh.visible;
    root.add(replacement);
    mesh.removeFromParent();
    mesh.dispose();
    pools.set(key, replacement);
    return replacement;
  }
  function gearKey(piece) {
    const paints = Array.isArray(piece.material) ? piece.material : [piece.material];
    return `${piece.geometry.uuid}/${paints.map((paint) => paint.uuid).join('/')}`;
  }
  function gearPool(piece, target = gearPools, attach = true, capacity = 320) {
    const key = gearKey(piece);
    if (!target.has(key)) {
      const mesh = new THREE.InstancedMesh(piece.geometry, piece.material, Math.max(1, capacity));
      mesh.name = 'combat-live-equipment';
      mesh.count = 0;
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.userData.combatCalls = piece.calls;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.setColorAt(0, tint.set(0xffffff));
      target.set(key, mesh);
      if (attach) root.add(mesh);
    }
    return attach ? reserveBatch(target, key, target.get(key).count + 1) : target.get(key);
  }
  function releaseCrowdPalette(palette) {
    for (const mesh of palette.pools) {
      mesh.removeFromParent();
      mesh.dispose();
    }
    for (const geometry of palette.geometries) geometry.dispose();
  }
  /** Bake the shared lowest-detail body once, never once per family or cast.
   * The small palette keeps distant soldiers in the admitted art style while
   * matching rigid equipment to the exact sampled skeleton pose. */
  function bakeCrowdPalette(source, probe, availableBytes) {
    if (!probe) throw new TypeError('Missing crowd pose preparation rig');
    const palette = {
      poses: [],
      roles: new Map(),
      pools: [],
      geometries: [],
      bytes: 0,
      gpuBytes: 0,
    };
    const sampled = new Map(),
      point = new THREE.Vector3();
    const addBytes = (bytes, gpu = false) => {
      palette.bytes += bytes;
      if (gpu) palette.gpuBytes += bytes;
      if (palette.bytes > availableBytes)
        throw new TypeError('Crowd pose palette exceeds its memory budget');
    };
    try {
      for (const role of ['idle', 'walk', 'run', 'warning']) {
        const name = source.motion[role] ?? source.motion.walk ?? source.motion.idle;
        const clip = source.clips.get(name);
        const count = role === 'walk' || role === 'run' ? 4 : 1;
        const frames = [];
        for (let frame = 0; frame < count; frame++) {
          const time = clip.duration * (role === 'warning' ? 0.5 : frame / count);
          const key = `${name}/${time}`;
          if (!sampled.has(key)) {
            probe.mixer.stopAllAction();
            probe.mixer.clipAction(clip).reset().play();
            probe.mixer.setTime(time);
            probe.model.updateMatrixWorld(true);
            const bones = new Map(),
              meshes = [];
            probe.model.traverse((node) => {
              if (node.isBone) {
                bones.set(node.name, node.matrixWorld.clone());
                addBytes(16 * 8);
              }
              if (node.isMesh) meshes.push(node);
              node.skeleton?.update();
            });
            const pose = { bones, pools: [] };
            for (const node of meshes) {
              const geometry = node.geometry.clone();
              palette.geometries.push(geometry);
              // Morphs and skinning are already applied to the sampled vertices.
              geometry.deleteAttribute('skinIndex');
              geometry.deleteAttribute('skinWeight');
              geometry.deleteAttribute('tangent');
              geometry.morphAttributes = {};
              const positions = geometry.attributes.position;
              for (let index = 0; index < positions.count; index++) {
                node.getVertexPosition(index, point).applyMatrix4(node.matrixWorld);
                positions.setXYZ(index, point.x, point.y, point.z);
              }
              geometry.computeVertexNormals();
              geometry.computeBoundingBox();
              geometry.computeBoundingSphere();
              const mesh = new THREE.InstancedMesh(geometry, node.material, COMBAT_ACTOR_LIMIT);
              mesh.name = 'combat-live-crowd-body';
              mesh.count = 0;
              mesh.visible = false;
              mesh.frustumCulled = false;
              mesh.castShadow = false;
              mesh.receiveShadow = true;
              mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
              mesh.userData.combatCalls = Array.isArray(node.material) ? geometry.groups.length : 1;
              palette.pools.push(mesh);
              pose.pools.push(mesh);
              const buffers = new Set(
                [geometry.index, ...Object.values(geometry.attributes)]
                  .filter(Boolean)
                  .map((attribute) => (attribute.data ?? attribute).array.buffer),
              );
              addBytes(
                [...buffers].reduce((sum, buffer) => sum + buffer.byteLength, 0) +
                  mesh.instanceMatrix.array.byteLength,
                true,
              );
            }
            sampled.set(key, palette.poses.length);
            palette.poses.push(pose);
          }
          frames.push(sampled.get(key));
        }
        palette.roles.set(role, { frames, duration: Math.max(0.001, clip.duration) });
      }
      return palette;
    } catch (error) {
      releaseCrowdPalette(palette);
      throw error;
    } finally {
      probe.mixer.stopAllAction();
      probe.model.updateMatrixWorld(true);
    }
  }
  function cloneAppearance(source) {
    let model;
    try {
      model = source.input.clone(source.input.scene);
      if (!model?.isObject3D || source.objects.has(model) || model.parent)
        throw new Error('Appearance clone must be detached and independently owned');
      const objects = new Set();
      model.traverse((node) => objects.add(node));
      if (
        objects.size < source.objects.size ||
        objects.size > source.objects.size + 2 ||
        objects.size > 256 ||
        [...objects].filter((node) => node.isMesh).length !== source.meshes ||
        [...objects].filter((node) => !node.isGroup).length !==
          [...source.objects].filter((node) => !node.isGroup).length ||
        [...objects].some((node) => source.objects.has(node))
      )
        throw new Error('Appearance clone shares its object hierarchy');
      model.traverse((node) => {
        if (!node.isMesh) return;
        const paints = Array.isArray(node.material) ? node.material : [node.material];
        if (
          !source.geometries.has(node.geometry) ||
          paints.some((paint) => !source.materials.has(paint))
        )
          throw new Error('Appearance clones must share admitted model resources');
        if (node.isSkinnedMesh) {
          if (
            source.skeletons.has(node.skeleton) ||
            node.skeleton.bones.some((bone) => !objects.has(bone))
          )
            throw new Error('Appearance clone must own its skeleton');
          if (!node.skeleton.boneTexture) node.skeleton.computeBoneTexture();
        }
        node.castShadow = false;
        node.receiveShadow = true;
        node.frustumCulled = false;
      });
      return { model, mixer: new THREE.AnimationMixer(model), source };
    } catch (error) {
      if (model && !source.objects.has(model)) releaseClone({ model }, source);
      throw error;
    }
  }
  function buildAppearance(actor, source) {
    const row = source.probe ?? cloneAppearance(source);
    source.probe = null;
    const group = new THREE.Group(),
      warning = new THREE.Object3D();
    const radius = clamp(Number(actor.radius) || 350, 50, 4000) / 1000,
      height = clamp(Number(actor.height) || 1800, 100, 8000) / 1000;
    row.model.scale.multiply(
      new THREE.Vector3(
        radius / source.input.radius,
        height / source.input.height,
        radius / source.input.radius,
      ),
    );
    warning.position.y = height + 0.3;
    group.name = `combat-appearance-${actor.id}`;
    if (source.input.forward === '+z') {
      const facing = new THREE.Group();
      facing.rotation.y = Math.PI;
      facing.add(row.model);
      group.add(facing);
    } else group.add(row.model);
    group.add(warning);
    root.add(group);
    return {
      ...row,
      group,
      skinned: true,
      equipment: source.equipment.map((piece) => ({
        ...piece,
        bone: row.model.getObjectByName(piece.bone),
      })),
      warning,
      clip: null,
      time: null,
      pieces: [
        {
          node: warning,
          kind: 'box',
          size: [radius * 0.14, radius * 0.5, radius * 0.14],
          color: new THREE.Color('#ffd275'),
        },
      ],
      rotors: [],
    };
  }
  function buildCrowdAppearance(actor, source) {
    const group = new THREE.Group(),
      model = new THREE.Object3D(),
      warning = new THREE.Object3D();
    const radius = clamp(Number(actor.radius) || 350, 50, 4000) / 1000;
    const height = clamp(Number(actor.height) || 1800, 100, 8000) / 1000;
    model.scale.set(
      radius / source.input.radius,
      height / source.input.height,
      radius / source.input.radius,
    );
    if (source.input.forward === '+z') model.rotation.y = Math.PI;
    warning.position.y = height + 0.3;
    group.name = `combat-crowd-${actor.id}`;
    group.add(model, warning);
    return {
      group,
      model,
      source,
      crowd: true,
      warning,
      rotors: [],
      equipment: source.equipment.map((piece) => ({
        ...piece,
        boneName: piece.bone,
        bone: { matrixWorld: new THREE.Matrix4() },
      })),
      pieces: [
        {
          node: warning,
          kind: 'box',
          size: [radius * 0.14, radius * 0.5, radius * 0.14],
          color: new THREE.Color('#ffd275'),
        },
      ],
    };
  }
  const appearanceRole = (actor, speed, reducedMotion) =>
    reducedMotion
      ? 'idle'
      : actor.warning
        ? 'warning'
        : speed > 2
          ? 'run'
          : speed > 0.05
            ? 'walk'
            : 'idle';
  function animateAppearance(row, actor, tick, speed, reducedMotion) {
    const role = appearanceRole(actor, speed, reducedMotion);
    const source = row.source;
    const name = source.motion[role] ?? source.motion.walk ?? source.motion.idle,
      time = reducedMotion ? 0 : Math.max(0, tick - (actor.spawnTick ?? 0)) / 50;
    if (row.clip !== name) {
      row.mixer.stopAllAction();
      row.mixer.clipAction(source.clips.get(name)).reset().play();
      row.clip = name;
      row.time = null;
    }
    if (row.time !== time) {
      row.mixer.setTime(time);
      row.time = time;
    }
  }
  function build(actor, quality, cast) {
    const group = new THREE.Group(),
      paints = new Set(),
      pieces = [],
      rotors = [];
    const radius = clamp(Number(actor.radius) || 350, 50, 4000) / 1000;
    const height = clamp(Number(actor.height) || 1800, 100, 8000) / 1000;
    const family = families.has(actor.appearance?.family) ? actor.appearance.family : 'patroller';
    const palette = actorVisual(family, cast).palette;
    const paint = (hex) => {
      const material = new THREE.MeshBasicMaterial({ color: hex });
      paints.add(material);
      return material;
    };
    const part = (geometry, material, at, parent = group) => {
      const node = new THREE.Mesh(geometry, material);
      node.position.set(...at);
      parent.add(node);
      const p = geometry.parameters;
      let kind = 'box',
        size = [p.width ?? 1, p.height ?? 1, p.depth ?? 1];
      if (geometry.type === 'CylinderGeometry') {
        const radius = Math.max(p.radiusTop, p.radiusBottom);
        kind = p.radiusTop / (p.radiusBottom || 1) < 0.9 ? 'tapered' : 'cylinder';
        size = [radius * 2, p.height, radius * 2];
      } else if (geometry.type === 'SphereGeometry') {
        kind = 'sphere';
        size = [p.radius * 2, p.radius * 2, p.radius * 2];
      }
      pieces.push({ node, kind, size, color: material.color });
      return node;
    };
    let rig = null,
      vehicle = null;
    if (actor.material === 'organic' || ['patrol', 'sentry', 'humanoid'].includes(actor.type)) {
      const soldierPaints = Object.fromEntries(
        industrialSoldierPaintKeys(family).map((role) => [role, paint(palette[role] ?? role)]),
      );
      rig = buildIndustrialSoldier({
        THREE,
        parent: group,
        part,
        family,
        cast,
        radius,
        height,
        quality,
        paints: soldierPaints,
      });
    } else if (actor.type === 'vehicle') {
      const model = INDUSTRIAL_VEHICLE_MODELS.includes(actor.vehicleModel)
        ? actor.vehicleModel
        : INDUSTRIAL_VEHICLE_MODELS.includes(actor.appearance?.model)
          ? actor.appearance.model
          : INDUSTRIAL_VEHICLE_MODELS.includes(actor.appearance?.family)
            ? actor.appearance.family
            : 'field-utility';
      const vehiclePaints = Object.fromEntries(
        Object.entries({
          armor: '#657969',
          dark: '#202d29',
          metal: '#9eaaa4',
          glass: '#68a9b4',
          threat: '#f4ca71',
        }).map(([role, hex]) => [role, paint(hex)]),
      );
      vehicle = buildIndustrialVehicle({
        THREE,
        parent: group,
        part,
        model,
        radius,
        quality,
        paints: vehiclePaints,
      });
    } else {
      const dark = paint('#243635'),
        body = paint(
          actor.material === 'wood'
            ? '#a27b52'
            : actor.material === 'glass'
              ? '#84bdc8'
              : '#687f71',
        ),
        bright = paint('#f0c773');
      const archetype = actor.appearance?.archetype;
      if (actor.type === 'drone' || actor.type === 'hazard' || archetype?.endsWith('-uav')) {
        part(new THREE.BoxGeometry(radius * 1.15, radius * 0.48, radius * 0.75), body, [0, 0, 0]);
        for (const side of [-1, 1]) {
          const arm = part(
            new THREE.BoxGeometry(radius * 2.3, radius * 0.16, radius * 0.15),
            dark,
            [0, 0, 0],
          );
          arm.rotation.y = (side * Math.PI) / 4;
          for (const end of [-1, 1]) {
            const pivot = new THREE.Group();
            pivot.position.set(side * radius * 0.76, radius * 0.1, end * radius * 0.76);
            group.add(pivot);
            part(
              new THREE.CylinderGeometry(radius * 0.16, radius * 0.16, radius * 0.25, 8),
              dark,
              [0, 0, 0],
              pivot,
            );
            const rotor = new THREE.Group();
            rotor.position.y = radius * 0.18;
            pivot.add(rotor);
            rotors.push(rotor);
            part(
              new THREE.BoxGeometry(radius * 0.82, radius * 0.035, radius * 0.12),
              bright,
              [0, 0, 0],
              rotor,
            );
          }
        }
        const camera = part(new THREE.SphereGeometry(radius * 0.19, 10, 8), bright, [
          0,
          -radius * 0.18,
          -radius * 0.46,
        ]);
        camera.name = 'combat-uav-camera';
        const antenna = part(
          new THREE.CylinderGeometry(radius * 0.025, radius * 0.025, radius * 0.5, 6),
          dark,
          [0, radius * 0.38, radius * 0.18],
        );
        antenna.name = 'combat-uav-antenna';
        if (archetype === 'interceptor-uav' || actor.type === 'hazard') {
          part(new THREE.CylinderGeometry(radius * 0.16, radius * 0.16, radius * 0.4, 8), body, [
            0,
            -radius * 0.28,
            0,
          ]).rotation.x = Math.PI / 2;
          part(new THREE.BoxGeometry(radius * 0.45, radius * 0.07, radius * 0.12), bright, [
            0,
            radius * 0.25,
            -radius * 0.3,
          ]);
        }
      } else if (archetype !== 'supply-container') {
        // A moving combat prop is a ground machine: a low chassis, independent
        // wheel sets/tracks, sensor mast and role-specific payload stay readable
        // at every quality level.
        const explosive = archetype === 'explosive-rover' || actor.explosive === true;
        const groundHeight = Math.max(radius * 0.65, height);
        part(new THREE.BoxGeometry(radius * 1.25, groundHeight * 0.32, radius * 1.55), body, [
          0,
          groundHeight * 0.42,
          0,
        ]);
        const wheels = [];
        for (const side of [-1, 1]) {
          if (!explosive)
            part(new THREE.BoxGeometry(radius * 0.32, groundHeight * 0.22, radius * 1.8), dark, [
              side * radius * 0.72,
              groundHeight * 0.18,
              0,
            ]).name = 'combat-robot-track';
          for (const end of [-1, 0, 1]) {
            const wheel = part(
              new THREE.CylinderGeometry(radius * 0.24, radius * 0.24, radius * 0.25, 10),
              dark,
              [side * radius * 0.77, radius * 0.24, end * radius * 0.62],
            );
            wheel.rotation.z = Math.PI / 2;
            wheel.name = 'combat-robot-wheel';
            wheels.push(wheel);
            part(new THREE.CylinderGeometry(radius * 0.12, radius * 0.12, radius * 0.27, 8), body, [
              side * radius * 0.78,
              radius * 0.24,
              end * radius * 0.62,
            ]).rotation.z = Math.PI / 2;
          }
        }
        const turret = part(
          new THREE.BoxGeometry(radius * 0.72, groundHeight * 0.25, radius * 0.65),
          body,
          [0, groundHeight * 0.68, -radius * 0.15],
        );
        turret.name = 'combat-robot-turret';
        const sensor = part(new THREE.SphereGeometry(radius * 0.13, 8, 6), bright, [
          0,
          groundHeight * 0.78,
          -radius * 0.49,
        ]);
        sensor.name = 'combat-robot-sensor';
        if (explosive) {
          for (const side of [-1, 1]) {
            const charge = part(
              new THREE.CylinderGeometry(radius * 0.17, radius * 0.17, radius * 0.9, 10),
              body,
              [side * radius * 0.3, groundHeight * 0.75, 0],
            );
            charge.rotation.x = Math.PI / 2;
            charge.name = 'combat-robot-charge';
            part(new THREE.BoxGeometry(radius * 0.36, radius * 0.07, radius * 0.12), bright, [
              side * radius * 0.3,
              groundHeight * 0.75 + radius * 0.17,
              0,
            ]);
          }
        } else {
          part(new THREE.CylinderGeometry(radius * 0.055, radius * 0.055, radius * 0.75, 8), dark, [
            0,
            groundHeight * 0.7,
            -radius * 0.65,
          ]).rotation.x = Math.PI / 2;
          part(
            new THREE.CylinderGeometry(radius * 0.025, radius * 0.025, groundHeight * 0.36, 6),
            dark,
            [radius * 0.2, groundHeight * 0.8, radius * 0.2],
          );
        }
        vehicle = { wheels, radar: null };
      } else {
        part(new THREE.BoxGeometry(radius * 1.3, height * 0.8, radius * 1.3), body, [
          0,
          height * 0.4,
          0,
        ]);
        for (const y of [0.15, 0.65])
          part(new THREE.BoxGeometry(radius * 1.36, height * 0.06, radius * 1.36), dark, [
            0,
            height * y,
            0,
          ]);
        part(new THREE.CylinderGeometry(radius * 0.32, radius * 0.32, radius * 0.03, 12), bright, [
          0,
          height * 0.82,
          0,
        ]);
      }
    }
    if (!(actor.material === 'organic' || ['patrol', 'sentry', 'humanoid'].includes(actor.type))) {
      const core = part(new THREE.SphereGeometry(radius * 0.2, 8, 6), paint('#ff794b'), [
        0,
        actor.type === 'drone' || actor.type === 'hazard' ? 0 : height * 0.55,
        -radius * 0.62,
      ]);
      core.name = 'combat-exposed-core';
      core.userData.componentBit = 2;
    }
    const warning = part(
      new THREE.BoxGeometry(radius * 0.14, radius * 0.5, radius * 0.14),
      paint('#ffd275'),
      [0, height + 0.3, 0],
    );
    return {
      group,
      paints,
      pieces,
      rig,
      vehicle,
      rotors,
      warning,
      radius,
      height,
      family,
      cast,
      signature: `${actor.sourceId}/${actor.type}/${actor.radius}/${actor.height}/${family}/${cast}/${quality}/${actor.material}/${actor.vehicleModel ?? actor.appearance?.model ?? ''}/${actor.appearance?.archetype ?? ''}`,
    };
  }
  function setActors(actors, options = {}) {
    if (disposed) return;
    if (actors === null) {
      clear();
      return;
    }
    if (!Array.isArray(actors) || actors.length > COMBAT_ACTOR_LIMIT)
      throw new TypeError(`Combat presentation accepts at most ${COMBAT_ACTOR_LIMIT} actors`);
    current = actors
      .filter((actor) => actor && typeof actor.id === 'string' && finite(actor.position))
      .map((actor) => structuredClone(actor));
    ticks = options.tick ?? ticks;
    active = true;
  }
  function update({
    tick = ticks,
    originMm = { x: 0, y: 0, z: 0 },
    graphicsQuality = 'balanced',
    cameraPosition = null,
    reducedMotion = false,
    enemyHealthDisplay = 'aimed',
    aimDirection = null,
  } = {}) {
    if (disposed) return;
    for (const mesh of healthPools) {
      mesh.count = 0;
      mesh.visible = false;
    }
    for (const batch of [...batches.values(), ...gearPools.values(), ...crowdPools()]) {
      batch.count = 0;
      batch.visible = false;
    }
    resources = {
      actors: 0,
      instances: 0,
      calls: 0,
      skinnedActors: 0,
      skinnedCalls: 0,
      crowdActors: 0,
      crowdInstances: 0,
      crowdCalls: 0,
    };
    if (!active) return;
    if (graphicsQuality !== lastQuality) {
      clearRows();
      lastQuality = graphicsQuality;
    }
    const retained = new Set();
    const retainedCasts = new Set();
    const distanceTo = (actor) =>
      cameraPosition
        ? Math.hypot(
            (actor.position.x - originMm.x) / 1000 - cameraPosition.x,
            (actor.position.y - originMm.y) / 1000 - cameraPosition.y,
            (actor.position.z - originMm.z) / 1000 - cameraPosition.z,
          )
        : 0;
    // Allocate the limited skinning work to nearby actors, not their spawn order.
    const skinPriority = (actor) => distanceTo(actor) * (rows.get(actor.id)?.skinned ? 0.85 : 1);
    const ordered = [...current].sort(
      (a, b) => skinPriority(a) - skinPriority(b) || a.id.localeCompare(b.id),
    );
    for (const actor of ordered) {
      retained.add(actor.id);
      if (
        ['defeated', 'caught', 'inactive', 'waiting'].includes(actor.status) ||
        actor.health === 0
      ) {
        if (rows.get(actor.id)?.skinned || rows.get(actor.id)?.crowd) {
          release(rows.get(actor.id));
          rows.delete(actor.id);
        }
        continue;
      }
      const healthKey = `${actor.id}/${actor.spawnId ?? actor.spawnTick ?? 0}`;
      const history = healthHistory.get(healthKey) ?? { health: actor.health, hitTick: -10000 };
      if (actor.health < history.health) history.hitTick = tick;
      if (Number.isFinite(actor.lastHitTick))
        history.hitTick = Math.max(history.hitTick, actor.lastHitTick);
      history.health = actor.health;
      healthHistory.set(healthKey, history);
      if (cameraPosition && enemyHealthDisplay !== 'off' && Number.isFinite(actor.health)) {
        const distance = distanceTo(actor);
        healthPosition.set(
          (actor.position.x - originMm.x) / 1000,
          (actor.position.y - originMm.y + actor.height) / 1000 + 0.24,
          (actor.position.z - originMm.z) / 1000,
        );
        healthDirection.copy(healthPosition);
        healthDirection.y -= actor.height / 2000 + 0.24;
        healthDirection.sub(cameraPosition).normalize();
        const aimed =
          finite(aimDirection) &&
          healthDirection.dot(healthNormal.copy(aimDirection).normalize()) > 0.992;
        if (
          enemyHealthDisplay === 'all' ||
          (distance < 100 && (aimed || tick - history.hitTick <= 150))
        ) {
          const fraction = clamp(actor.health / Math.max(1, actor.maxHealth ?? 100), 0, 1);
          const width = clamp(actor.radius / 500, 0.6, 1.6),
            height = 0.075;
          healthNormal.copy(cameraPosition).sub(healthPosition).normalize();
          healthRotation.setFromUnitVectors(forward, healthNormal);
          healthRight.set(1, 0, 0).applyQuaternion(healthRotation);
          matrix.compose(
            healthPosition,
            healthRotation,
            healthScale.set(width + 0.06, height + 0.035, 1),
          );
          healthPools[0].setMatrixAt(healthPools[0].count++, matrix);
          healthPosition
            .addScaledVector(healthNormal, 0.004)
            .addScaledVector(healthRight, (-width * (1 - fraction)) / 2);
          matrix.compose(
            healthPosition,
            healthRotation,
            healthScale.set(width * fraction, height, 1),
          );
          healthPools[1].setMatrixAt(healthPools[1].count++, matrix);
        }
      }
      const preferred = sharedActorAppearance().snapshot().cast;
      const castKey = `${actor.id}/${actor.spawnId ?? actor.spawnTick ?? 0}`;
      const rememberedCast = acceptedCasts.get(castKey);
      const cast = ['tactical', 'arcade', 'rivals'].includes(actor.appearance?.cast)
        ? actor.appearance.cast
        : (rememberedCast ?? (preferred !== 'authored' ? preferred : 'tactical'));
      acceptedCasts.set(castKey, cast);
      retainedCasts.add(castKey);
      const family = families.has(actor.appearance?.family) ? actor.appearance.family : 'patroller';
      const lods =
        appearance?.byIdentity.get(`${family}/${cast}`) ??
        appearance?.byIdentity.get(`${family}/*`);
      const distance = cameraPosition
        ? Math.hypot(
            (actor.position.x - originMm.x) / 1000 - cameraPosition.x,
            (actor.position.y - originMm.y) / 1000 - cameraPosition.y,
            (actor.position.z - originMm.z) / 1000 - cameraPosition.z,
          )
        : 0;
      let level =
        graphicsQuality === 'low'
          ? (lods?.length ?? 1) - 1
          : distance > 80
            ? 3
            : distance > 40
              ? 2
              : distance > (graphicsQuality === 'balanced' ? 14 : 24)
                ? 1
                : 0;
      level = Math.min(level, (lods?.length ?? 1) - 1);
      // Keep the current rig within a 15% band around each distance boundary.
      const oldLevel = lods?.indexOf(rows.get(actor.id)?.source) ?? -1;
      if (oldLevel >= 0 && graphicsQuality !== 'low') {
        const boundaries = [graphicsQuality === 'balanced' ? 14 : 24, 40, 80];
        if (level > oldLevel && distance < boundaries[oldLevel] * 1.15) level = oldLevel;
        if (level < oldLevel && distance > boundaries[oldLevel - 1] * 0.85) level = oldLevel;
      }
      let source = lods?.[level];

      const useAppearance =
        source &&
        (actor.material === 'organic' || ['patrol', 'sentry', 'humanoid'].includes(actor.type));
      const useSkin = useAppearance && resources.skinnedActors < COMBAT_SKINNED_ACTOR_LIMIT;
      if (useAppearance && !useSkin) source = lods.at(-1);
      const signature = `${actor.sourceId}/${actor.type}/${actor.radius}/${actor.height}/${family}/${cast}/${graphicsQuality}/${actor.material}/${actor.vehicleModel ?? actor.appearance?.model ?? ''}/${actor.appearance?.archetype ?? ''}/${useAppearance ? source.input.sha256 + '/' + source.input.scene.uuid + '/' + (useSkin ? 'skin' : 'crowd') : ''}`;
      let row = rows.get(actor.id);
      if (row && row.signature !== signature) {
        release(row);
        rows.delete(actor.id);
        row = null;
      }
      if (!row) {
        try {
          row = useAppearance
            ? useSkin
              ? buildAppearance(actor, source)
              : buildCrowdAppearance(actor, source)
            : build(actor, graphicsQuality, cast);
        } catch {
          setAppearanceTemplate(null);
          return update({
            tick,
            originMm,
            graphicsQuality,
            cameraPosition,
            reducedMotion,
            enemyHealthDisplay,
            aimDirection,
          });
        }
        row.signature = signature;
        row.cast = cast;
        rows.set(actor.id, row);
      }
      row.group.position.set(
        (actor.position.x - originMm.x) / 1000,
        (actor.position.y - originMm.y) / 1000,
        (actor.position.z - originMm.z) / 1000,
      );
      const heading = actor.heading ?? actor.velocity ?? { x: 0, z: -1 };
      if (Math.hypot(heading.x ?? 0, heading.z ?? 0) > 0)
        row.group.rotation.y = Math.atan2(-heading.x, -heading.z);
      const speed = finite(actor.velocity)
        ? Math.hypot(actor.velocity.x, actor.velocity.y, actor.velocity.z) / 1000
        : 0;
      if (row.skinned) {
        animateAppearance(row, actor, tick, speed, reducedMotion);
        resources.skinnedActors++;
        resources.skinnedCalls += row.source.calls;
        resources.calls += row.source.calls;
      }
      if (row.rig)
        applyIndustrialSoldierPose(row.rig, {
          ticks: tick,
          moving: speed > 0.05,
          phase: actor.warning ? 'warning' : (actor.pursuit?.phase ?? 'idle'),
          reducedMotion,
        });
      if (row.vehicle) {
        for (const wheel of row.vehicle.wheels)
          wheel.rotation.x = reducedMotion ? 0 : -((tick / 50) * speed) / (row.radius * 0.2);
        if (row.vehicle.radar) row.vehicle.radar.rotation.y = reducedMotion ? 0 : (tick / 50) * 0.7;
      }
      for (const [index, rotor] of row.rotors.entries())
        rotor.rotation.y = reducedMotion ? 0 : tick * 0.65 * (index % 2 ? 1 : -1);
      row.group.updateMatrixWorld(true);
      if (row.crowd) {
        const palette = row.source.crowdPalette;
        const role = palette.roles.get(appearanceRole(actor, speed, reducedMotion));
        const elapsed = reducedMotion ? 0 : Math.max(0, tick - (actor.spawnTick ?? 0)) / 50;
        const frame = Math.floor(((elapsed % role.duration) / role.duration) * role.frames.length);
        const pose = palette.poses[role.frames[frame]];
        for (const mesh of pose.pools) {
          if (mesh.count >= COMBAT_ACTOR_LIMIT)
            throw new Error('Admitted crowd exceeds pose capacity');
          mesh.setMatrixAt(mesh.count++, row.model.matrixWorld);
          resources.crowdInstances++;
        }
        for (const piece of row.equipment) {
          const bone = pose.bones.get(piece.boneName);
          if (!bone) throw new Error('Crowd equipment lost its sampled bone');
          piece.bone.matrixWorld.multiplyMatrices(row.model.matrixWorld, bone);
        }
        resources.crowdActors++;
      }
      for (const piece of row.equipment ?? []) {
        if (actor.componentMask & 1 && ['shield', 'brace'].includes(piece.role)) continue;
        const mesh = gearPool(piece);
        {
          matrix.copy(piece.offset);
          const cycle = Math.max(0, tick - (actor.spawnTick ?? 0)) % 160;
          const open = actor.pursuit
            ? !['warning', 'burst', 'guarding'].includes(actor.pursuit.phase)
            : cycle >= 60;
          if (piece.role === 'brace' && open) {
            const elapsed =
              actor.pursuit?.phase === 'recovering'
                ? 80 - (actor.pursuit.phaseTicks ?? 72)
                : actor.pursuit
                  ? 8
                  : cycle - 60;
            const progress = reducedMotion ? 1 : Math.max(0, Math.min(1, elapsed / 8));
            for (const axis of [12, 13, 14])
              matrix.elements[axis] +=
                (piece.openOffset.elements[axis] - piece.offset.elements[axis]) * progress;
          }
          matrix.premultiply(piece.bone.matrixWorld);
          mesh.setMatrixAt(mesh.count, matrix);
          mesh.setColorAt(mesh.count++, piece.color);
        }
      }
      const inside = (node, ancestor) => {
        for (let n = node; n; n = n.parent) if (n === ancestor) return true;
        return false;
      };
      for (const piece of row.pieces) {
        if (
          piece.node.userData.componentBit &&
          !(actor.componentMask & piece.node.userData.componentBit)
        )
          continue;
        if (
          actor.componentMask & 1 &&
          (inside(piece.node, row.rig?.accessories?.armor) ||
            /(?:combat-robot-(?:turret|sensor)|combat-uav-camera|industrial-fixed-barrel)/.test(
              piece.node.name,
            ))
        )
          continue;
        if (piece.node === row.warning && !actor.warning) continue;
        const batch = reserveBatch(batches, piece.kind, batches.get(piece.kind).count + 1);
        unitScale.makeScale(...piece.size);
        matrix.multiplyMatrices(piece.node.matrixWorld, unitScale);
        batch.setMatrixAt(batch.count, matrix);
        batch.setColorAt(batch.count++, tint.copy(piece.color));
        resources.instances++;
      }
      resources.actors++;
    }
    for (const key of acceptedCasts.keys()) if (!retainedCasts.has(key)) acceptedCasts.delete(key);
    for (const key of healthHistory.keys()) if (!retainedCasts.has(key)) healthHistory.delete(key);
    for (const mesh of healthPools) {
      mesh.visible = mesh.count > 0;
      if (mesh.visible) {
        mesh.instanceMatrix.needsUpdate = true;
        resources.calls++;
      }
    }
    for (const [id, row] of rows)
      if (!retained.has(id)) {
        release(row);
        rows.delete(id);
      }
    for (const batch of [...batches.values(), ...gearPools.values(), ...crowdPools()]) {
      batch.visible = batch.count > 0;
      if (batch.visible) {
        batch.instanceMatrix.needsUpdate = true;
        if (batch.instanceColor) batch.instanceColor.needsUpdate = true;
        resources.calls += batch.userData.combatCalls ?? 1;
        if (batch.name === 'combat-live-crowd-body')
          resources.crowdCalls += batch.userData.combatCalls;
      }
    }
  }
  if (appearanceTemplate !== null) setAppearanceTemplate(appearanceTemplate);
  return {
    setAppearanceTemplate,
    setAppearanceTemplates,
    prepareTextures(upload) {
      if (!appearance || typeof upload !== 'function') return;
      const textures = new Set();
      for (const paint of new Set(
        appearance.sources.flatMap((source) => [
          ...source.materials,
          ...source.equipment.flatMap((piece) =>
            Array.isArray(piece.material) ? piece.material : [piece.material],
          ),
        ]),
      ))
        for (const value of Object.values(paint)) if (value?.isTexture) textures.add(value);
      for (const row of [
        ...rows.values(),
        ...appearance.sources.map((source) => source.probe),
      ].filter(Boolean))
        row.model?.traverse((node) => {
          if (node.skeleton?.boneTexture) textures.add(node.skeleton.boneTexture);
        });
      for (const texture of textures) upload(texture);
    },
    prepareMaterials() {
      for (const mesh of [
        ...batches.values(),
        ...gearPools.values(),
        ...healthPools,
        ...crowdPools(),
      ])
        mesh.visible = true;
      const pending = (appearance?.sources ?? [])
        .filter((source) => source.probe)
        .map((source) => ({ source, probe: source.probe }));
      for (const { probe } of pending) root.add(probe.model);
      return () => {
        for (const { source, probe } of pending)
          if (source.probe === probe) probe.model.removeFromParent();
        for (const mesh of [
          ...batches.values(),
          ...gearPools.values(),
          ...healthPools,
          ...crowdPools(),
        ])
          mesh.visible = mesh.count > 0;
      };
    },
    setActors,
    update,
    reset: clear,
    active: () => active,
    resources: () => ({
      ...resources,
      templates: rows.size,
      capacity: COMBAT_ACTOR_LIMIT,
      healthBars: healthPools[0].count,
      appearanceReady: Boolean(appearance),
      appearanceHash: appearance?.hash ?? null,
      appearanceCharacters: appearance?.byIdentity.size ?? 0,
      equipmentCalls: [...gearPools.values()]
        .filter((mesh) => mesh.count > 0)
        .reduce((n, mesh) => n + mesh.userData.combatCalls, 0),
      maxSkinnedActors: COMBAT_SKINNED_ACTOR_LIMIT,
      crowdPaletteBytes: [...(appearance?.crowdPalettes.values() ?? [])].reduce(
        (sum, palette) => sum + palette.bytes,
        0,
      ),
      crowdPalettes: appearance?.crowdPalettes.size ?? 0,
      crowdPoses: [...(appearance?.crowdPalettes.values() ?? [])].reduce(
        (sum, palette) => sum + palette.poses.length,
        0,
      ),
      crowdPaletteByteLimit: COMBAT_CROWD_PALETTE_BYTES,
      appearanceResourceMetrics: appearance?.resourceMetrics
        ? { ...appearance.resourceMetrics }
        : null,
      crowdPaletteGpuBytes: [...(appearance?.crowdPalettes.values() ?? [])].reduce(
        (sum, palette) => sum + palette.gpuBytes,
        0,
      ),
      equipmentInstanceBytes: [...gearPools.values()].reduce(
        (sum, mesh) =>
          sum + mesh.instanceMatrix.array.byteLength + (mesh.instanceColor?.array.byteLength ?? 0),
        0,
      ),
    }),
    dispose() {
      if (disposed) return;
      setAppearanceTemplate(null);
      disposed = true;
      clear();
      root.removeFromParent();
      healthGeometry.dispose();
      for (const mesh of healthPools) {
        mesh.material.dispose();
        mesh.dispose();
      }
      for (const batch of batches.values()) {
        batch.geometry.dispose();
        batch.material.dispose();
        batch.dispose();
      }
    },
  };
}
