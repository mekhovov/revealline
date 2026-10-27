import { inspectImport, worldSHA256, validateWorldPath } from './world-content.mjs';
import { ACTOR_FAMILIES, ACTOR_CASTS } from '../../game/hunt/actor-catalog.mjs';
// Projected into the existing World runtime slot; the optional package does not
// gain a separate loader utility or make Academy depend on skeletal art.
export { clone as cloneCombatSkeleton } from './vendor/addons/utils/SkeletonUtils.js';

// Appearance is a separately admitted optional download. None of this data is
// part of an encounter, hitbox, recording proof, or reward identity.
// Enabled only after the complete optional asset pack has passed admission.
export const COMBAT_APPEARANCE_DOWNLOAD = Object.freeze({
  url: '../../authoring/library/fpv-character-art/r2/manifest.json',
  sha256: '9940f5d75727b52d067cf1be2ce75e254f52e0b6670643bc28a308291969e009',
  bytes: 14703667,
});
export const COMBAT_APPEARANCE_FORMAT = 'FPVCombatAppearance.v1';
export const COMBAT_APPEARANCE_FORMAT_V2 = 'FPVCombatAppearance.v2';
export const COMBAT_DAMAGE_REGIONS = Object.freeze([
  'head',
  'chest',
  'abdomen',
  'pelvis',
  'leftUpperArm',
  'leftForearm',
  'rightUpperArm',
  'rightForearm',
  'leftThigh',
  'leftShin',
  'rightThigh',
  'rightShin',
]);
const legacyRegions = ['head', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];
export const COMBAT_APPEARANCE_LIMITS = Object.freeze({
  manifestBytes: 64 * 1024,
  downloadBytes: 24 * 1024 * 1024,
  modelBytes: 16 * 1024 * 1024,
  decodedBytes: 128 * 1024 * 1024,
  gpuBytes: 160 * 1024 * 1024,
  files: 16,
  verticesPerModel: 65536,
  accessorValuesPerModel: 2 * 1000 * 1000,
  textureDimension: 2048,
  liveActors: 20,
});
const families = new Set(ACTOR_FAMILIES.map((row) => row.id));
const casts = new Set(ACTOR_CASTS.map((row) => row.id));
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const id = (value) => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,79}$/.test(value);
const text = (value, max = 200) =>
  typeof value === 'string' && value.length > 0 && value.length <= max;
const assert = (value, message) => {
  if (!value) throw new Error(message);
};
const abort = (signal) => {
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
};
const freeze = (value) => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
const prepared = new WeakMap();
const HTTPS = (value) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

export function validateCombatAppearanceManifest(input) {
  const m = structuredClone(input);
  assert(
    [COMBAT_APPEARANCE_FORMAT, COMBAT_APPEARANCE_FORMAT_V2].includes(m?.format) &&
      id(m.id) &&
      id(m.revision),
    'Invalid appearance identity.',
  );
  assert(text(m.title), 'Appearance title is required.');
  assert(
    m.license &&
      text(m.license.creator) &&
      text(m.license.name) &&
      HTTPS(m.license.sourceURL) &&
      HTTPS(m.license.licenseURL) &&
      text(m.license.modifications, 2000),
    'Appearance provenance and modifications are required.',
  );
  assert(
    Array.isArray(m.files) &&
      m.files.length > 0 &&
      m.files.length <= COMBAT_APPEARANCE_LIMITS.files,
    'Appearance file count exceeds budget.',
  );
  const files = new Set();
  let size = 0;
  for (const file of m.files) {
    validateWorldPath(file.path);
    assert(
      /\.glb$/.test(file.path) && !files.has(file.path),
      'Appearance files must be unique self-contained GLBs.',
    );
    assert(
      Number.isSafeInteger(file.bytes) &&
        file.bytes > 0 &&
        file.bytes <= COMBAT_APPEARANCE_LIMITS.modelBytes &&
        hash(file.sha256),
      'Invalid appearance file identity or size.',
    );
    files.add(file.path);
    size += file.bytes;
  }
  assert(size <= COMBAT_APPEARANCE_LIMITS.downloadBytes, 'Appearance download exceeds budget.');
  assert(
    Array.isArray(m.characters) && m.characters.length > 0 && m.characters.length <= 36,
    'Appearance characters are required.',
  );
  const identities = new Set(),
    used = new Set();
  for (const c of m.characters) {
    assert(
      families.has(c.family) && casts.has(c.cast) && !identities.has(`${c.family}/${c.cast}`),
      'Appearance requires unique supported family/cast identities.',
    );
    identities.add(`${c.family}/${c.cast}`);
    assert(files.has(c.file) && text(c.root, 80), 'Appearance character root or file is missing.');
    used.add(c.file);
    assert(
      Number.isFinite(c.height) &&
        c.height >= 0.5 &&
        c.height <= 3 &&
        Number.isFinite(c.radius) &&
        c.radius > 0 &&
        c.radius <= 1,
      'Invalid appearance dimensions.',
    );
    c.forward ??= '+z';
    assert(['+z', '-z'].includes(c.forward), 'Invalid appearance facing axis.');
    assert(
      c.clips && ['idle', 'move', 'attack'].every((key) => text(c.clips[key], 80)),
      'Appearance requires idle, move and attack clips.',
    );
    assert(
      Array.isArray(c.lods) &&
        c.lods.length >= 1 &&
        c.lods.length <= 3 &&
        c.lods.every((name) => text(name, 80)) &&
        new Set([c.root, ...c.lods]).size === c.lods.length + 1,
      'Appearance requires separate distance-detail roots.',
    );
    if (c.equipment !== undefined) {
      assert(
        Array.isArray(c.equipment) && c.equipment.length <= 8,
        'Appearance equipment count exceeds budget.',
      );
      const equipmentRoots = new Set(),
        remainsRoots = new Set();
      for (const item of c.equipment) {
        assert(
          text(item.root, 80) && !equipmentRoots.has(item.root) && text(item.bone, 80),
          'Appearance equipment requires distinct roots and attachment bones.',
        );
        equipmentRoots.add(item.root);
        assert(
          item.remainsRoot === undefined || text(item.remainsRoot, 80),
          'Appearance equipment remains root is invalid.',
        );
        const remainsRoot = item.remainsRoot ?? item.root;
        assert(
          !remainsRoots.has(remainsRoot),
          'Appearance equipment remains roots must be distinct.',
        );
        remainsRoots.add(remainsRoot);
        assert(
          Array.isArray(item.lodBones) &&
            item.lodBones.length === c.lods.length &&
            item.lodBones.every((name) => text(name, 80)),
          'Appearance equipment LOD bones are required.',
        );
        assert(
          legacyRegions.includes(item.region),
          'Appearance equipment requires a damage region.',
        );
        assert(
          item.color === undefined ||
            (Array.isArray(item.color) &&
              item.color.length === 3 &&
              item.color.every((v) => Number.isFinite(v) && v >= 0 && v <= 1)),
          'Appearance equipment color is invalid.',
        );
        assert(
          item.openOffset === undefined ||
            (Array.isArray(item.openOffset) &&
              item.openOffset.length === 3 &&
              item.openOffset.every((value) => Number.isFinite(value) && Math.abs(value) <= 0.3)),
          'Appearance equipment opening offset is invalid.',
        );
        assert(
          item.role === undefined || ['shield', 'brace'].includes(item.role),
          'Appearance equipment reaction is invalid.',
        );
      }
    }
    if (m.format === COMBAT_APPEARANCE_FORMAT_V2) {
      assert(id(c.regionSet) && m.regionSets?.[c.regionSet], 'Missing appearance region set.');
      c.regions = structuredClone(m.regionSets[c.regionSet]);
      const keys = Object.keys(c.regions);
      assert(
        keys.length === 12 && COMBAT_DAMAGE_REGIONS.every((key) => keys.includes(key)),
        'Appearance v2 requires all twelve connected damage regions.',
      );
      for (const [key, region] of Object.entries(c.regions)) {
        assert(
          text(region.mesh, 80) && text(region.cap, 80) && legacyRegions.includes(region.aggregate),
          'Invalid connected damage region.',
        );
        assert(
          region.parent === null ||
            (COMBAT_DAMAGE_REGIONS.includes(region.parent) && region.parent !== key),
          'Invalid connected damage parent.',
        );
        const visited = new Set([key]);
        let parent = region.parent;
        while (parent !== null) {
          assert(!visited.has(parent), 'Cyclic damage region connectivity.');
          visited.add(parent);
          parent = c.regions[parent]?.parent;
          assert(
            parent === null || COMBAT_DAMAGE_REGIONS.includes(parent),
            'Disconnected damage region.',
          );
        }
      }
      assert(
        Object.values(c.regions).filter((region) => region.parent === null).length === 1,
        'Damage regions require one connected root.',
      );
      for (const item of c.equipment ?? [])
        assert(
          COMBAT_DAMAGE_REGIONS.includes(item.damageRegion),
          'Equipment requires explicit connected-region ownership.',
        );
    }
    assert(
      c.parts &&
        ['head', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'].every(
          (key) => text(c.parts[key]?.mesh, 80) && text(c.parts[key]?.cap, 80),
        ),
      'Appearance requires authored body parts and wound caps.',
    );
  }
  assert(used.size === files.size, 'Appearance pack contains unused files.');
  return freeze(m);
}

// This only runs after inspectImport has checked every GLB view, image header,
// accessor and skin. Counts are conservative upper bounds, not GPU telemetry.
function modelMetrics(document, bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const jsonLength = view.getUint32(12, true);
  const binary = bytes.subarray(20 + jsonLength + 8);
  let pixels = 0;
  const imageMipPixels = [];
  for (const image of document.images ?? []) {
    const v = document.bufferViews[image.bufferView],
      start = v.byteOffset ?? 0;
    const b = binary.subarray(start, start + v.byteLength),
      d = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let width = 0,
      height = 0;
    if (image.mimeType === 'image/png') {
      width = d.getUint32(16);
      height = d.getUint32(20);
    } else {
      let p = 2;
      while (p + 4 <= b.length) {
        while (b[p] === 255) p++;
        const marker = b[p++];
        if (marker === 0xd9 || marker === 0xda) break;
        if (marker === 1 || (marker >= 0xd0 && marker <= 0xd7)) continue;
        const length = d.getUint16(p);
        if ([0xc0, 0xc1, 0xc2].includes(marker)) {
          height = d.getUint16(p + 3);
          width = d.getUint16(p + 5);
          break;
        }
        p += length;
      }
    }
    assert(
      width > 0 &&
        height > 0 &&
        width <= COMBAT_APPEARANCE_LIMITS.textureDimension &&
        height <= COMBAT_APPEARANCE_LIMITS.textureDimension,
      'Appearance texture dimension exceeds budget.',
    );
    pixels += width * height;
    let mipPixels = 0;
    while (true) {
      mipPixels += width * height;
      if (width === 1 && height === 1) break;
      width = Math.max(1, Math.floor(width / 2));
      height = Math.max(1, Math.floor(height / 2));
    }
    imageMipPixels.push(mipPixels);
  }
  const accessors = document.accessors ?? [];
  assert(
    accessors.every((a) => a.count <= 1000000) &&
      accessors.reduce((n, a) => n + a.count, 0) <= COMBAT_APPEARANCE_LIMITS.accessorValuesPerModel,
    'Appearance accessor budget exceeded.',
  );
  const positions = new Set(
    (document.meshes ?? []).flatMap((m) => m.primitives.map((p) => p.attributes.POSITION)),
  );
  const vertices = [...positions].reduce((n, a) => n + accessors[a].count, 0);
  assert(
    vertices <= COMBAT_APPEARANCE_LIMITS.verticesPerModel,
    'Appearance vertex budget exceeded.',
  );
  const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
  // Sparse and bufferless accessors allocate their full declared typed arrays.
  // Four bytes/component also bounds normalized/converted component storage.
  const accessorBytes = accessors.reduce((n, a) => n + a.count * components[a.type] * 4, 0);
  const textureUses = new Map();
  const countTextures = (value) => {
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      if (
        key.endsWith('Texture') &&
        item &&
        typeof item === 'object' &&
        Number.isInteger(item.index)
      )
        textureUses.set(item.index, (textureUses.get(item.index) ?? 0) + 1);
      else countTextures(item);
    }
  };
  for (const material of document.materials ?? []) countTextures(material);
  const textureMipPixels = (document.textures ?? []).reduce(
    (n, texture, index) =>
      n + imageMipPixels[texture.source] * Math.max(1, textureUses.get(index) ?? 0),
    0,
  );
  // Count separate material uses conservatively; sampler/UV/color-space variants
  // may own separate GPU textures even when they share an embedded image.
  const boneBytes =
    (document.nodes ?? []).filter((node) => node.skin !== undefined).length *
    64 *
    16 *
    4 *
    (COMBAT_APPEARANCE_LIMITS.liveActors + 2);
  return {
    vertices,
    pixels,
    decodedBytes: bytes.length * 2 + accessorBytes * 2 + pixels * 4 + boneBytes,
    gpuBytes: binary.length * 2 + accessorBytes * 2 + textureMipPixels * 4 + boneBytes,
  };
}

function validateCharacter(document, character) {
  const nodes = document.nodes ?? [],
    names = new Map();
  assert(
    (document.extensionsUsed ?? []).every((name) =>
      ['KHR_materials_unlit', 'KHR_texture_transform'].includes(name),
    ),
    'Appearance requires baked core PBR materials.',
  );
  for (const material of document.materials ?? [])
    assert(
      ['OPAQUE', 'MASK'].includes(material.alphaMode ?? 'OPAQUE'),
      'Appearance materials must be opaque or alpha-tested.',
    );
  for (const node of nodes) {
    assert(!node.extras?.rl, 'Appearance may not contain gameplay markers.');
    if (node.name) {
      assert(!names.has(node.name), 'Appearance node names must be unique.');
      names.set(node.name, node);
    }
  }
  const active = new Set();
  const visit = (index) => {
    active.add(nodes[index]);
    for (const child of nodes[index].children ?? []) visit(child);
  };
  for (const index of document.scenes[document.scene ?? 0].nodes ?? []) visit(index);
  const descendants = (name) => {
    const root = names.get(name);
    assert(root, `Missing appearance node: ${name}.`);
    assert(active.has(root), `Appearance node is outside the active scene: ${name}.`);
    const result = [];
    const walk = (node) => {
      result.push(node);
      for (const child of node.children ?? []) walk(nodes[child]);
    };
    walk(root);
    return result;
  };
  const clips = new Map();
  for (const clip of document.animations ?? []) {
    assert(
      text(clip.name, 80) && !clips.has(clip.name),
      'Appearance animation names must be unique.',
    );
    clips.set(clip.name, clip);
  }
  for (const name of Object.values(character.clips))
    assert(clips.has(name), `Missing appearance clip: ${name}.`);
  for (const root of [character.root, ...character.lods]) {
    const branch = descendants(root),
      members = new Set(branch);
    assert(branch.length <= 254, 'Appearance live node budget exceeded.');
    const meshes = branch.filter((node) => node.mesh !== undefined);
    assert(
      meshes.length > 0 &&
        meshes.reduce((n, node) => n + document.meshes[node.mesh].primitives.length, 0) <= 2,
      'Appearance live roots require at most two material draws.',
    );
    assert(
      meshes.every((node) => node.skin !== undefined),
      'Appearance live meshes must be skinned.',
    );
    const joints = new Set();
    for (const mesh of meshes)
      for (const joint of document.skins[mesh.skin].joints) {
        assert(members.has(nodes[joint]), 'Appearance live root must contain its complete rig.');
        joints.add(joint);
      }
    for (const item of character.equipment ?? []) {
      const lod = [character.root, ...character.lods].indexOf(root);
      const bone = names.get(lod === 0 ? item.bone : item.lodBones[lod - 1]);
      assert(
        bone && members.has(bone) && joints.has(nodes.indexOf(bone)),
        'Appearance equipment must attach to a contained skin joint.',
      );
    }
    for (const name of Object.values(character.clips))
      assert(
        clips.get(name).channels.some((channel) => joints.has(channel.target.node)),
        `Appearance clip does not animate the selected rig: ${name}.`,
      );
  }
  for (const item of character.equipment ?? []) {
    for (const name of new Set([item.root, item.remainsRoot ?? item.root])) {
      const pieces = descendants(name).filter((node) => node.mesh !== undefined);
      assert(
        pieces.length > 0 &&
          pieces.every((node) => node.skin === undefined) &&
          pieces.reduce((n, node) => n + document.meshes[node.mesh].primitives.length, 0) <= 2,
        'Appearance equipment requires bounded rigid meshes.',
      );
    }
  }
  const partRoots = new Set();
  for (const part of Object.values(character.parts))
    for (const name of [part.mesh, part.cap]) {
      assert(!partRoots.has(name), 'Appearance damage part roots must be distinct.');
      partRoots.add(name);
      const pieces = descendants(name).filter((node) => node.mesh !== undefined);
      assert(
        pieces.length > 0 &&
          pieces.every((node) => node.skin === undefined) &&
          pieces.reduce((n, node) => n + document.meshes[node.mesh].primitives.length, 0) <= 2,
        'Appearance remains require settled, unskinned meshes.',
      );
    }
  const regionRoots = new Set();
  for (const region of Object.values(character.regions ?? {})) {
    for (const name of [region.mesh, region.cap]) {
      assert(!regionRoots.has(name), 'Connected damage roots must be distinct.');
      regionRoots.add(name);
      const pieces = descendants(name).filter((node) => node.mesh !== undefined);
      assert(
        pieces.length > 0 &&
          pieces.every((node) => node.skin === undefined) &&
          pieces.reduce((n, node) => n + document.meshes[node.mesh].primitives.length, 0) <= 2,
        'Connected remains require bounded rigid meshes.',
      );
    }
  }
}

/** Full validation precedes activation or cache mutation. Blobs are immutable;
 * callers cannot mutate the bytes behind an already admitted pack. */
export async function prepareCombatAppearancePack({ manifestBytes, sha256, assets, signal } = {}) {
  abort(signal);
  assert(
    hash(sha256) &&
      manifestBytes instanceof Uint8Array &&
      manifestBytes.length <= COMBAT_APPEARANCE_LIMITS.manifestBytes,
    'A pinned bounded appearance manifest is required.',
  );
  manifestBytes = manifestBytes.slice();
  const manifestBlob = new Blob([manifestBytes]);
  assert((await worldSHA256(manifestBlob)) === sha256, 'Appearance manifest hash mismatch.');
  const manifest = validateCombatAppearanceManifest(
    JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(manifestBytes)),
  );
  assert(
    assets instanceof Map && assets.size === manifest.files.length,
    'Appearance files are incomplete.',
  );
  const blobs = new Map(),
    metrics = { downloadBytes: manifestBytes.length, decodedBytes: 0, gpuBytes: 0, vertices: 0 };
  for (const file of manifest.files) {
    abort(signal);
    const source = assets.get(file.path);
    assert(
      source instanceof Blob || source instanceof Uint8Array,
      'Appearance asset bytes are missing.',
    );
    const blob = source instanceof Blob ? source : new Blob([source]);
    assert(
      blob.size === file.bytes && (await worldSHA256(blob)) === file.sha256,
      `Appearance file hash/size mismatch: ${file.path}.`,
    );
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const imported = await inspectImport({ files: { [file.path]: bytes }, entry: file.path });
    const normalized = new Uint8Array(await imported.modelBlob.arrayBuffer());
    const measured = modelMetrics(imported.document, normalized);
    for (const c of manifest.characters.filter((c) => c.file === file.path))
      validateCharacter(imported.document, c);
    metrics.downloadBytes += file.bytes;
    for (const key of ['decodedBytes', 'gpuBytes', 'vertices']) metrics[key] += measured[key];
    blobs.set(file.path, blob);
  }
  for (const key of ['downloadBytes', 'decodedBytes', 'gpuBytes'])
    assert(metrics[key] <= COMBAT_APPEARANCE_LIMITS[key], `Appearance ${key} budget exceeded.`);
  abort(signal);
  const result = Object.freeze({
    manifest,
    sha256,
    get assets() {
      return new Map(blobs);
    },
    metrics: Object.freeze(metrics),
  });
  prepared.set(result, { sha256, manifest: manifestBlob, assets: [...blobs] });
  return result;
}

async function boundedResponse(response, limit, signal) {
  try {
    assert(response?.ok && response.body?.getReader, 'Appearance download failed.');
    const length = response.headers?.get('content-length');
    assert(
      length === null || length === undefined || Number(length) <= limit,
      'Appearance response exceeds byte budget.',
    );
  } catch (error) {
    await response?.body?.cancel?.().catch(() => {});
    throw error;
  }
  const reader = response.body.getReader(),
    chunks = [];
  let total = 0;
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    while (true) {
      abort(signal);
      const { value, done } = await reader.read();
      abort(signal);
      if (done) break;
      total += value.byteLength;
      assert(total <= limit, 'Appearance response exceeds byte budget.');
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  } finally {
    signal?.removeEventListener('abort', cancel);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function downloadCombatAppearancePack({
  url,
  sha256,
  fetch: fetcher = globalThis.fetch,
  signal,
} = {}) {
  assert(hash(sha256), 'A pinned appearance manifest hash is required.');
  const base = new URL(url);
  assert(
    (base.protocol === 'https:' ||
      (base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname))) &&
      !base.username &&
      !base.password,
    'Invalid appearance URL.',
  );
  const controller = new AbortController(),
    cancel = () => controller.abort();
  abort(signal);
  signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(cancel, 120000),
    outerSignal = signal;
  signal = controller.signal;
  try {
    const get = async (target, limit) => {
      abort(signal);
      const response = await fetcher(target.href, {
        signal,
        credentials: 'omit',
        redirect: 'error',
      });
      return boundedResponse(response, limit, signal);
    };
    const manifestBytes = await get(base, COMBAT_APPEARANCE_LIMITS.manifestBytes);
    assert((await worldSHA256(manifestBytes)) === sha256, 'Appearance manifest hash mismatch.');
    const manifest = validateCombatAppearanceManifest(
      JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(manifestBytes)),
    );
    assert(
      manifestBytes.length + manifest.files.reduce((n, file) => n + file.bytes, 0) <=
        COMBAT_APPEARANCE_LIMITS.downloadBytes,
      'Appearance download exceeds budget.',
    );
    const assets = new Map();
    for (const file of manifest.files)
      assets.set(file.path, await get(new URL(file.path, base), file.bytes));
    return await prepareCombatAppearancePack({ manifestBytes, sha256, assets, signal });
  } finally {
    clearTimeout(timeout);
    outerSignal?.removeEventListener('abort', cancel);
  }
}

/** Decode only a previously admitted pack. The owner and every consumer hold
 * separate leases: shared textures/geometries outlive all skinned clones and
 * instanced remains. This helper never changes gameplay or the visible scene. */
export async function prepareCombatAppearanceModels(
  pack,
  { THREE, loadModel, clone, signal } = {},
) {
  const admitted = prepared.get(pack);
  assert(
    admitted &&
      THREE?.AnimationClip &&
      typeof loadModel === 'function' &&
      typeof clone === 'function',
    'Appearance models require an admitted pack and renderer adapters.',
  );
  abort(signal);
  const models = new Map(),
    geometries = new Set(),
    materials = new Set(),
    textures = new Set(),
    images = new Set(),
    skeletons = new Set();
  let references = 1,
    closed = false,
    released = false;
  const disposeResources = () => {
    if (released) return;
    released = true;
    for (const skeleton of skeletons) skeleton.dispose?.();
    for (const geometry of geometries) geometry.dispose?.();
    for (const material of materials) material.dispose?.();
    for (const texture of textures) texture.dispose?.();
    for (const image of images) image.close?.();
    models.clear();
  };
  const release = () => {
    references--;
    if (references === 0) disposeResources();
  };
  const acquire = () => {
    assert(!closed && !released, 'Appearance model owner is closed.');
    references++;
    let alive = true;
    return () => {
      if (alive) {
        alive = false;
        release();
      }
    };
  };
  const own = (model) => {
    assert(model?.scene?.isObject3D, 'Appearance model decoding failed.');
    model.scene.updateMatrixWorld(true);
    model.scene.traverse((node) => {
      if (node.skeleton) skeletons.add(node.skeleton);
      if (node.geometry) geometries.add(node.geometry);
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        if (!material) continue;
        materials.add(material);
        for (const texture of Object.values(material))
          if (texture?.isTexture) {
            textures.add(texture);
            const source = texture.source?.data ?? texture.image;
            for (const image of Array.isArray(source) ? source : [source])
              if (image) images.add(image);
          }
      }
    });
    assert(Array.isArray(model.animations), 'Appearance model decoding failed.');
  };
  const actorClipCache = new WeakMap();
  const actorClips = (model, root, character) => {
    const nodes = new Set();
    root.traverse((node) => {
      nodes.add(node.name);
      nodes.add(node.uuid);
    });
    const clips =
      actorClipCache.get(root) ??
      model.animations
        .map((clip) => {
          const tracks = clip.tracks.filter((track) =>
            nodes.has(THREE.PropertyBinding.parseTrackName(track.name).nodeName),
          );
          return tracks.length
            ? new THREE.AnimationClip(clip.name, clip.duration, tracks, clip.blendMode)
            : null;
        })
        .filter(Boolean);
    const names = new Set(clips.map((clip) => clip.name));
    assert(
      clips.every((clip) => clip.validate()),
      'Decoded appearance clips are invalid.',
    );
    for (const name of Object.values(character.clips))
      assert(names.has(name), `Decoded appearance clip is missing: ${name}.`);
    actorClipCache.set(root, clips);
    return clips;
  };
  try {
    for (const [path, blob] of admitted.assets) {
      abort(signal);
      const model = await loadModel(blob, { signal });
      own(model);
      models.set(path, model);
      abort(signal);
    }
    // Resolve every authored root before exposing any lease; partial models are
    // never an activation candidate. Actual image decoding has completed here.
    for (const character of pack.manifest.characters) {
      const scene = models.get(character.file).scene;
      for (const name of [
        character.root,
        ...character.lods,
        ...Object.values(character.parts).flatMap((part) => [part.mesh, part.cap]),
        ...Object.values(character.regions ?? {}).flatMap((part) => [part.mesh, part.cap]),
        ...(character.equipment ?? []).flatMap((item) => [
          item.root,
          item.remainsRoot ?? item.root,
          item.bone,
          ...item.lodBones,
        ]),
      ])
        assert(scene.getObjectByName(name), `Decoded appearance root is missing: ${name}.`);
      for (const name of [character.root, ...character.lods])
        actorClips(models.get(character.file), scene.getObjectByName(name), character);
    }
  } catch (error) {
    closed = true;
    disposeResources();
    throw error;
  }
  const selected = (index) => {
    assert(
      !closed && Number.isSafeInteger(index) && pack.manifest.characters[index],
      'Unknown appearance character.',
    );
    const character = pack.manifest.characters[index];
    return { character, model: models.get(character.file) };
  };
  return Object.freeze({
    sha256: pack.sha256,
    manifest: pack.manifest,
    metrics: pack.metrics,
    createActorLease(index = 0, { lod = 0 } = {}) {
      const { character, model } = selected(index);
      assert(
        Number.isSafeInteger(lod) && lod >= 0 && lod <= character.lods.length,
        'Invalid appearance detail level.',
      );
      const root = model.scene.getObjectByName(
        lod === 0 ? character.root : character.lods[lod - 1],
      );
      const clips = actorClips(model, root, character);
      // The authored normalization may live above the selected rig. Preserve
      // that matrix in a child wrapper while the outer wrapper remains free for
      // runtime scale/facing adjustments; animation still binds original names.
      root.updateWorldMatrix(true, true);
      const parentMatrix = root.parent?.matrixWorld.clone() ?? new THREE.Matrix4();
      const cloneWithAncestors = (source) => {
        const outer = new THREE.Group(),
          normalization = new THREE.Group();
        normalization.matrix.copy(parentMatrix);
        normalization.matrixAutoUpdate = false;
        normalization.add(clone(source));
        outer.add(normalization);
        return outer;
      };
      return {
        ready: true,
        sha256: pack.sha256,
        resourceMetrics: pack.metrics,
        family: character.family,
        cast: character.cast,
        scene: root,
        clips,
        clone: cloneWithAncestors,
        forward: character.forward,
        height: character.height,
        radius: character.radius,
        equipment: (character.equipment ?? []).map((item) => {
          const bone = lod === 0 ? item.bone : item.lodBones[lod - 1],
            mesh = model.scene.getObjectByName(item.root),
            sourceBone = root.getObjectByName(bone);
          assert(sourceBone?.isBone && mesh, 'Decoded equipment attachment is invalid.');
          return {
            mesh,
            bone,
            region: item.region,
            damageRegion: item.damageRegion,
            role: item.role,
            color: item.color ? [...item.color] : [1, 1, 1],
            openOffset: item.openOffset ? [...item.openOffset] : [0, 0, 0],
            // Opening displacement is in the selected bone's local coordinates,
            // applied before bindMatrix by the cosmetic equipment renderer.
            bindMatrix: new THREE.Matrix4()
              .copy(sourceBone.matrixWorld)
              .invert()
              .multiply(mesh.matrixWorld),
          };
        }),
        motion: {
          idle: character.clips.idle,
          walk: character.clips.move,
          run: character.clips.run ?? character.clips.move,
          warning: character.clips.attack,
        },
        release: acquire(),
      };
    },
    createPartsLease(index = 0) {
      const { character, model } = selected(index);
      return {
        ready: true,
        sha256: pack.sha256,
        family: character.family,
        cast: character.cast,
        scene: model.scene,
        height: character.height,
        radius: character.radius,
        equipment: (character.equipment ?? []).map((item) => ({
          // Damage regions may use an authored pose different from the rig's
          // rest pose. Reuse the gear geometry with its matching settled transform.
          mesh: model.scene.getObjectByName(item.remainsRoot ?? item.root),
          region: item.region,
          damageRegion: item.damageRegion,
          color: item.color ? [...item.color] : [1, 1, 1],
          role: item.role,
        })),
        regions: character.regions
          ? Object.fromEntries(
              Object.entries(character.regions).map(([key, region]) => [
                key,
                {
                  mesh: model.scene.getObjectByName(region.mesh),
                  cap: model.scene.getObjectByName(region.cap),
                  parent: region.parent,
                  aggregate: region.aggregate,
                },
              ]),
            )
          : undefined,
        parts: Object.fromEntries(
          Object.entries(character.parts).map(([key, part]) => [
            key,
            {
              mesh: model.scene.getObjectByName(part.mesh),
              cap: model.scene.getObjectByName(part.cap),
            },
          ]),
        ),
        release: acquire(),
      };
    },
    prepareTextures(upload) {
      assert(
        !closed && typeof upload === 'function',
        'Appearance texture preparation requires an open owner.',
      );
      for (const texture of textures) upload(texture);
    },
    dispose() {
      if (!closed) {
        closed = true;
        release();
      }
    },
  });
}

/** One optional pack retained atomically. A bad download or quota failure never
 * replaces the previous pack. A cache read repeats byte and content admission. */
export async function openCombatAppearanceStore({
  indexedDB = globalThis.indexedDB,
  name = 'revealline-fpv-appearance-v1',
} = {}) {
  assert(indexedDB, 'Appearance storage is unavailable.');
  const opening = indexedDB.open(name, 1);
  opening.onupgradeneeded = () => opening.result.createObjectStore('pack');
  const db = await new Promise((resolve, reject) => {
    let failed = false;
    opening.onsuccess = () => (failed ? opening.result.close() : resolve(opening.result));
    opening.onerror = () => {
      failed = true;
      reject(opening.error);
    };
    opening.onblocked = () => {
      failed = true;
      reject(new Error('Appearance storage is busy in another tab.'));
    };
  });
  db.onversionchange = () => db.close();
  const transaction = (mode, work) =>
    new Promise((resolve, reject) => {
      const tx = db.transaction('pack', mode);
      let value, error;
      tx.oncomplete = () => resolve(value);
      tx.onabort = () =>
        reject(error || tx.error || new Error('Appearance storage transaction aborted.'));
      tx.onerror = () => {};
      try {
        work(
          tx.objectStore('pack'),
          (v) => {
            value = v;
          },
          (e) => {
            error = e;
            tx.abort();
          },
        );
      } catch (e) {
        error = e;
        tx.abort();
      }
    });
  return {
    async load(sha256, { signal } = {}) {
      assert(hash(sha256), 'Expected appearance hash is required.');
      abort(signal);
      const row = await transaction('readonly', (store, done) => {
        store.get('active').onsuccess = (e) => done(e.target.result);
      });
      abort(signal);
      if (!row || row.sha256 !== sha256) return null;
      return prepareCombatAppearancePack({
        manifestBytes: new Uint8Array(await row.manifest.arrayBuffer()),
        sha256,
        assets: new Map(row.assets),
        signal,
      });
    },
    async save(pack) {
      const row = prepared.get(pack);
      assert(row, 'Only a fully admitted appearance pack can be stored.');
      await transaction('readwrite', (store) => {
        store.put(row, 'active');
      });
    },
    async clear() {
      await transaction('readwrite', (store) => {
        store.delete('active');
      });
    },
    close() {
      db.close();
    },
  };
}

/** Local selection never authorizes a network request. Only download() fetches
 * the pinned optional pack; absent or invalid cache keeps Current playable. */
export function createCombatAppearanceChoice({
  storage,
  descriptor,
  openStore = openCombatAppearanceStore,
  download = downloadCombatAppearancePack,
  onChange = () => {},
} = {}) {
  const key = 'revealline.fpv.character-art.v1';
  let selection = 'current',
    pack = null,
    store = null,
    pending = null,
    disposed = false,
    serial = 0,
    issue = null,
    storageIssue = false;
  try {
    if (storage?.getItem(key) === 'realistic') selection = 'realistic';
  } catch {
    /* Optional preferences do not block flight. */
  }
  const snapshot = () => ({
    selection,
    installed: Boolean(pack),
    active: selection === 'realistic' && pack ? 'realistic' : 'current',
    pending: Boolean(pending),
    issue,
    storageIssue,
  });
  const notify = () => {
    if (!disposed) onChange(snapshot());
  };
  const persist = () => {
    try {
      storage?.setItem(key, selection);
    } catch {
      storageIssue = true;
    }
  };
  const ready = (async () => {
    try {
      store = await openStore();
      if (disposed) {
        store.close();
        store = null;
        return;
      }
      if (descriptor) {
        const cached = await store.load(descriptor.sha256);
        if (!disposed) pack = cached;
      }
    } catch {
      if (store) issue = 'invalid-cache';
      else storageIssue = true;
    }
    if (selection === 'realistic' && !pack && !issue) issue = 'missing';
    notify();
  })();
  return {
    ready,
    snapshot,
    pack: () => (selection === 'realistic' ? pack : null),
    select(value) {
      assert(['current', 'realistic'].includes(value), 'Unknown character art.');
      serial++;
      pending?.abort();
      pending = null;
      selection = value;
      issue = selection === 'realistic' && !pack ? 'missing' : null;
      persist();
      notify();
    },
    async download() {
      if (disposed || !descriptor) return false;
      pending?.abort();
      const controller = new AbortController(),
        request = ++serial;
      pending = controller;
      issue = null;
      notify();
      const owns = () => !disposed && request === serial && !controller.signal.aborted;
      try {
        const candidate = await download({ ...descriptor, signal: controller.signal });
        if (!owns()) return false;
        await ready;
        if (!owns()) return false;
        try {
          if (store) {
            await store.save(candidate);
            storageIssue = false;
          } else storageIssue = true;
        } catch {
          storageIssue = true;
        }
        if (!owns()) return false;
        pack = candidate;
        issue = null;
        selection = 'realistic';
        persist();
        return true;
      } catch (error) {
        if (owns()) issue = error?.name === 'AbortError' ? null : 'download';
        return false;
      } finally {
        if (request === serial) {
          pending = null;
          notify();
        }
      }
    },
    cancel() {
      serial++;
      pending?.abort();
      pending = null;
      issue = null;
      notify();
    },
    dispose() {
      disposed = true;
      serial++;
      pending?.abort();
      pending = null;
      store?.close();
      store = null;
      pack = null;
    },
  };
}
