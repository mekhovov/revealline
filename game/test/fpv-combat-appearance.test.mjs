import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as THREE from '../../optional-practice/civilian-fpv/vendor/three.module.js';
import { GLTFLoader } from '../../optional-practice/civilian-fpv/vendor/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from '../../optional-practice/civilian-fpv/vendor/addons/utils/SkeletonUtils.js';
import { createCombatActorPresentation } from '../../optional-practice/civilian-fpv/combat-actors.mjs';
import {
  COMBAT_APPEARANCE_FORMAT,
  COMBAT_APPEARANCE_LIMITS,
  validateCombatAppearanceManifest,
  prepareCombatAppearancePack,
  downloadCombatAppearancePack,
  openCombatAppearanceStore,
  prepareCombatAppearanceModels,
} from '../../optional-practice/civilian-fpv/combat-appearance.mjs';
import {
  encodeWorldGLB,
  worldSHA256,
} from '../../optional-practice/civilian-fpv/world-content.mjs';
const requireAuthoring = createRequire(
  new URL('../../authoring/fpv-worlds/package.json', import.meta.url),
);
const { IDBFactory } = requireAuthoring('fake-indexeddb');

// An intentionally tiny technical fixture; this is not qualified character art.
function model(change = () => {}) {
  let binary = new Uint8Array(128);
  new Float32Array(binary.buffer, 0, 9).set([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  new Float32Array(binary.buffer, 48, 12).set([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
  new Float32Array(binary.buffer, 96, 2).set([0, 1]);
  new Float32Array(binary.buffer, 104, 6).set([0, 0, 0, 0, 0, 0]);
  const doc = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0, 3, 6, ...Array.from({ length: 12 }, (_, i) => i + 7)] }],
    buffers: [{ byteLength: 128 }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36 },
      { buffer: 0, byteOffset: 36, byteLength: 12 },
      { buffer: 0, byteOffset: 48, byteLength: 48 },
      { buffer: 0, byteOffset: 96, byteLength: 8 },
      { buffer: 0, byteOffset: 104, byteLength: 24 },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: 'VEC3',
        min: [0, 0, 0],
        max: [1, 1, 0],
      },
      { bufferView: 1, componentType: 5121, count: 3, type: 'VEC4' },
      { bufferView: 2, componentType: 5126, count: 3, type: 'VEC4' },
      { bufferView: 3, componentType: 5126, count: 2, type: 'SCALAR', min: [0], max: [1] },
      { bufferView: 4, componentType: 5126, count: 2, type: 'VEC3' },
    ],
    meshes: [
      { primitives: [{ attributes: { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2 } }] },
      { primitives: [{ attributes: { POSITION: 0 } }] },
    ],
    nodes: [
      { name: 'Character', children: [1, 2] },
      { name: 'Live', mesh: 0, skin: 0 },
      { name: 'Bone' },
      { name: 'LOD', children: [4, 5] },
      { name: 'LODMesh', mesh: 0, skin: 1 },
      { name: 'LODBone' },
      { name: 'UnusedRoot' },
      ...Array.from({ length: 12 }, (_, i) => ({ name: `Part${i}`, mesh: 1 })),
    ],
    skins: [{ joints: [2] }, { joints: [5] }],
    animations: ['Idle', 'Walk', 'Attack'].map((name) => ({
      name,
      samplers: [{ input: 3, output: 4 }],
      channels: [
        { sampler: 0, target: { node: 2, path: 'translation' } },
        { sampler: 0, target: { node: 5, path: 'translation' } },
      ],
    })),
  };
  const changedBinary = change(doc, binary);
  if (changedBinary instanceof Uint8Array) binary = changedBinary;
  return encodeWorldGLB(doc, binary);
}
async function fixture(changeModel, changeManifest = () => {}) {
  const bytes = model(changeModel);
  const manifest = {
    format: COMBAT_APPEARANCE_FORMAT,
    id: 'representative',
    revision: 'r1',
    title: 'Technical fixture',
    license: {
      creator: 'Test fixture',
      name: 'CC0-1.0',
      sourceURL: 'https://example.com/source',
      licenseURL: 'https://creativecommons.org/publicdomain/zero/1.0/',
      modifications: 'Authored test triangles.',
    },
    files: [{ path: 'actor.glb', bytes: bytes.length, sha256: await worldSHA256(bytes) }],
    characters: [
      {
        family: 'patroller',
        cast: 'tactical',
        file: 'actor.glb',
        root: 'Character',
        lods: ['LOD'],
        height: 1.8,
        radius: 0.35,
        clips: { idle: 'Idle', move: 'Walk', attack: 'Attack' },
        parts: Object.fromEntries(
          ['head', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'].map((p, i) => [
            p,
            { mesh: `Part${i * 2}`, cap: `Part${i * 2 + 1}` },
          ]),
        ),
      },
    ],
  };
  changeManifest(manifest);
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
  return {
    manifest,
    manifestBytes,
    sha256: await worldSHA256(manifestBytes),
    assets: new Map([['actor.glb', bytes]]),
  };
}
test('appearance admits exact cosmetic identity, bounded geometry and immutable bytes', async () => {
  const f = await fixture(),
    pack = await prepareCombatAppearancePack(f);
  assert.equal(pack.sha256, f.sha256);
  assert.equal(pack.metrics.vertices, 3);
  assert.equal(
    pack.metrics.downloadBytes,
    f.manifestBytes.length + f.assets.get('actor.glb').length,
  );
  assert.equal(pack.manifest.characters[0].family, 'patroller');
  assert.ok(Object.isFrozen(pack.manifest.characters[0].parts));
  f.assets.get('actor.glb').fill(0);
  assert.equal(await worldSHA256(pack.assets.get('actor.glb')), f.manifest.files[0].sha256);
  pack.assets.set('actor.glb', new Blob(['unverified replacement']));
  assert.equal(await worldSHA256(pack.assets.get('actor.glb')), f.manifest.files[0].sha256);
});
test('manifest mutation while hashing cannot substitute metadata behind its pinned identity', async () => {
  const f = await fixture(),
    pending = prepareCombatAppearancePack(f);
  f.manifestBytes.fill(32);
  const admitted = await pending;
  assert.equal(admitted.sha256, f.sha256);
  assert.equal(admitted.manifest.title, 'Technical fixture');
});
test('appearance requires license, LOD, authored fragments and unique compatible characters', async (t) => {
  for (const [label, change, pattern] of [
    ['provenance', (m) => delete m.license, /provenance/],
    ['LOD', (m) => (m.characters[0].lods = []), /distance-detail/],
    ['caps', (m) => delete m.characters[0].parts.head.cap, /wound caps/],
    ['duplicate', (m) => m.characters.push(m.characters[0]), /unique supported/],
    ['unknown family', (m) => (m.characters[0].family = 'civilian'), /supported/],
    ['unsafe path', (m) => (m.files[0].path = '../actor.glb'), /safe relative/],
    ['download size', (m) => (m.files[0].bytes = COMBAT_APPEARANCE_LIMITS.modelBytes + 1), /size/],
  ])
    await t.test(label, async () => {
      const f = await fixture(undefined, change);
      assert.throws(() => validateCombatAppearanceManifest(f.manifest), pattern);
    });
});
test('hash mismatch, missing file and malformed GLB fail before admission', async () => {
  const f = await fixture();
  await assert.rejects(
    prepareCombatAppearancePack({ ...f, sha256: '0'.repeat(64) }),
    /manifest hash/,
  );
  await assert.rejects(prepareCombatAppearancePack({ ...f, assets: new Map() }), /incomplete/);
  f.assets.get('actor.glb')[0] ^= 1;
  await assert.rejects(prepareCombatAppearancePack(f), /file hash/);
  const invalid = await fixture();
  invalid.assets.set('actor.glb', new Uint8Array(100));
  invalid.manifest.files[0].bytes = 100;
  invalid.manifest.files[0].sha256 = await worldSHA256(invalid.assets.get('actor.glb'));
  invalid.manifestBytes = new TextEncoder().encode(JSON.stringify(invalid.manifest));
  invalid.sha256 = await worldSHA256(invalid.manifestBytes);
  await assert.rejects(prepareCombatAppearancePack(invalid), /GLB/);
});
test('pack cannot add gameplay markers, omit clips, exceed live draws or skin remains', async (t) => {
  for (const [label, change, pattern] of [
    [
      'marker',
      (d) => (d.nodes[6].extras = { rl: { id: 'spawn', kind: 'spawn' } }),
      /gameplay markers/,
    ],
    ['clip', (d) => d.animations.pop(), /Missing appearance clip/],
    [
      'draws',
      (d) => d.meshes[0].primitives.push(d.meshes[0].primitives[0], d.meshes[0].primitives[0]),
      /two material/,
    ],
    [
      'skin',
      (d) => {
        d.nodes[7].mesh = 0;
        d.nodes[7].skin = 0;
      },
      /unskinned/,
    ],
    ['names', (d) => (d.nodes[6].name = 'Character'), /unique/],
    [
      'rig outside root',
      (d) => {
        d.nodes[0].children = [1];
        d.scenes[0].nodes.push(2);
      },
      /complete rig/,
    ],
    [
      'LOD not animated',
      (d) => {
        for (const a of d.animations) a.channels.pop();
      },
      /selected rig/,
    ],
    ['duplicate clip', (d) => d.animations.push(d.animations[0]), /animation names/],
    [
      'transparent surface',
      (d) => {
        d.materials = [{ alphaMode: 'BLEND' }];
      },
      /opaque or alpha-tested/,
    ],
    [
      'unbounded settled draws',
      (d) => d.meshes[1].primitives.push(d.meshes[1].primitives[0], d.meshes[1].primitives[0]),
      /unskinned meshes/,
    ],
    [
      'expanded buffers',
      (d) =>
        d.accessors.push(
          { type: 'MAT4', componentType: 5126, count: 1000000 },
          { type: 'MAT4', componentType: 5126, count: 100000 },
        ),
      /decodedBytes budget/,
    ],
  ])
    await t.test(
      label,
      async () => await assert.rejects(prepareCombatAppearancePack(await fixture(change)), pattern),
    );
});
test('GPU admission counts material texture uses and mip storage independently of compressed image bytes', async () => {
  const f = await fixture((d, original) => {
    const binary = new Uint8Array(164);
    binary.set(original);
    // Header-only image is sufficient for metadata admission; no image decoder
    // should run because the conservative GPU bound rejects the pack first.
    const png = new DataView(binary.buffer, 128);
    binary.set([137, 80, 78, 71, 13, 10, 26, 10], 128);
    png.setUint32(8, 13);
    png.setUint32(12, 0x49484452);
    png.setUint32(16, 2048);
    png.setUint32(20, 2048);
    d.buffers[0].byteLength = binary.length;
    d.bufferViews.push({ buffer: 0, byteOffset: 128, byteLength: 33 });
    d.images = [{ bufferView: 5, mimeType: 'image/png' }];
    d.textures = [{ source: 0 }];
    d.materials = Array.from({ length: 8 }, () => ({
      pbrMetallicRoughness: { baseColorTexture: { index: 0 } },
    }));
    return binary;
  });
  assert.ok(f.assets.get('actor.glb').byteLength < 10000);
  await assert.rejects(prepareCombatAppearancePack(f), /gpuBytes budget/);
});
test('download verifies manifest before requesting model and retains explicit fetch boundaries', async () => {
  const f = await fixture(),
    calls = [];
  const fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(url.endsWith('pack.json') ? f.manifestBytes : f.assets.get('actor.glb'));
  };
  const pack = await downloadCombatAppearancePack({
    url: 'https://example.com/art/pack.json',
    sha256: f.sha256,
    fetch,
  });
  assert.equal(pack.sha256, f.sha256);
  assert.deepEqual(
    calls.map((c) => c.url),
    ['https://example.com/art/pack.json', 'https://example.com/art/actor.glb'],
  );
  assert.equal(calls[0].options.credentials, 'omit');
  assert.equal(calls[0].options.redirect, 'error');
  calls.length = 0;
  await assert.rejects(
    downloadCombatAppearancePack({
      url: 'https://example.com/art/pack.json',
      sha256: '0'.repeat(64),
      fetch,
    }),
    /manifest hash/,
  );
  assert.equal(calls.length, 1);
});
test('streaming overrun, interruption and abort cannot return a partially ready pack', async () => {
  const f = await fixture();
  await assert.rejects(
    downloadCombatAppearancePack({
      url: 'https://example.com/pack.json',
      sha256: f.sha256,
      fetch: async () => new Response(new Uint8Array(COMBAT_APPEARANCE_LIMITS.manifestBytes + 1)),
    }),
    /byte budget/,
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(prepareCombatAppearancePack({ ...f, signal: controller.signal }), {
    name: 'AbortError',
  });
  let calls = 0;
  await assert.rejects(
    downloadCombatAppearancePack({
      url: 'https://example.com/pack.json',
      sha256: f.sha256,
      fetch: async () => {
        calls++;
        if (calls === 2) throw new TypeError('Offline');
        return new Response(f.manifestBytes);
      },
    }),
    /Offline/,
  );
});
test('download accepts localhost HTTP only and cancels rejected response bodies', async () => {
  const f = await fixture();
  let fetched = false,
    cancelled = false;
  await assert.rejects(
    downloadCombatAppearancePack({
      url: 'http://example.com/pack.json',
      sha256: f.sha256,
      fetch: async () => {
        fetched = true;
      },
    }),
    /Invalid appearance URL/,
  );
  assert.equal(fetched, false);
  await assert.rejects(
    downloadCombatAppearancePack({
      url: 'http://127.0.0.1/pack.json',
      sha256: f.sha256,
      fetch: async () =>
        new Response(
          new ReadableStream({
            cancel() {
              cancelled = true;
            },
          }),
          { headers: { 'content-length': COMBAT_APPEARANCE_LIMITS.manifestBytes + 1 } },
        ),
    }),
    /byte budget/,
  );
  assert.equal(cancelled, true);
});
test('optional cache accepts only fully admitted packs and rereads exact verified immutable bytes', async () => {
  const f = await fixture(),
    pack = await prepareCombatAppearancePack(f);
  const store = await openCombatAppearanceStore({
    indexedDB: new IDBFactory(),
    name: 'appearance-test',
  });
  try {
    await store.save(pack);
    pack.assets.clear(); // Public Map is never the retained verification token.
    const restored = await store.load(f.sha256);
    assert.equal(restored.sha256, f.sha256);
    assert.equal(restored.assets.size, 1);
    await assert.rejects(store.save({ ...pack }), /fully admitted/);
    assert.equal((await store.load(f.sha256)).sha256, f.sha256);
    assert.equal(await store.load('0'.repeat(64)), null);
    await store.clear();
    assert.equal(await store.load(f.sha256), null);
  } finally {
    store.close();
  }
});
test('invalid or interrupted replacement leaves the last optional pack available', async () => {
  const f = await fixture(),
    pack = await prepareCombatAppearancePack(f);
  const store = await openCombatAppearanceStore({
    indexedDB: new IDBFactory(),
    name: 'appearance-retention',
  });
  try {
    await store.save(pack);
    const candidate = await fixture(undefined, (m) => {
      m.revision = 'r2';
      m.characters[0].clips.move = 'Missing';
    });
    await assert.rejects(prepareCombatAppearancePack(candidate), /Missing appearance clip/);
    assert.equal((await store.load(f.sha256)).manifest.revision, 'r1');
    await assert.rejects(store.save(candidate), /fully admitted/);
    assert.equal((await store.load(f.sha256)).manifest.revision, 'r1');
  } finally {
    store.close();
  }
});

async function decodedFixture(blob) {
  const model = await new GLTFLoader().parseAsync(await blob.arrayBuffer(), '');
  const counts = { geometry: 0, material: 0, texture: 0, image: 0, skeleton: 0 },
    geometry = new Set(),
    material = new Set(),
    skeletons = new Set();
  const map = new THREE.Texture({ close: () => counts.image++ });
  map.addEventListener('dispose', () => counts.texture++);
  model.scene.traverse((node) => {
    if (node.geometry) geometry.add(node.geometry);
    if (node.skeleton) skeletons.add(node.skeleton);
    for (const paint of Array.isArray(node.material) ? node.material : [node.material])
      if (paint) {
        paint.map = map;
        material.add(paint);
      }
  });
  for (const shape of geometry) shape.addEventListener('dispose', () => counts.geometry++);
  for (const paint of material) paint.addEventListener('dispose', () => counts.material++);
  for (const skeleton of skeletons) {
    skeleton.computeBoneTexture();
    skeleton.boneTexture.addEventListener('dispose', () => counts.skeleton++);
  }
  return {
    model,
    counts,
    map,
    totals: {
      geometry: geometry.size,
      material: material.size,
      texture: 1,
      image: 1,
      skeleton: skeletons.size,
    },
  };
}

test('decoded appearance owns shared resources until the owner and all idempotent leases retire', async () => {
  const pack = await prepareCombatAppearancePack(await fixture());
  let decoded;
  const owner = await prepareCombatAppearanceModels(pack, {
    THREE,
    clone: cloneSkeleton,
    loadModel: async (blob) => {
      decoded = await decodedFixture(blob);
      return decoded.model;
    },
  });
  const actor = owner.createActorLease(),
    lod = owner.createActorLease(0, { lod: 1 }),
    parts = owner.createPartsLease();
  assert.equal(actor.resourceMetrics, owner.metrics);
  assert.equal(lod.resourceMetrics, owner.metrics);
  const sameActor = owner.createActorLease();
  assert.equal(
    sameActor.clips,
    actor.clips,
    'shared body roots reuse immutable animation clips across leases',
  );
  sameActor.release();
  assert.equal(actor.scene.name, 'Character');
  assert.equal(lod.scene.name, 'LOD');
  assert.equal(parts.parts.head.mesh.name, 'Part0');
  assert.equal(parts.parts.head.cap.name, 'Part1');
  for (const lease of [actor, lod]) {
    assert.equal(lease.clips.length, 3);
    assert.ok(lease.clips.every((clip) => clip.tracks.length === 1));
    const members = new Set();
    lease.scene.traverse((node) => {
      members.add(node.name);
      members.add(node.uuid);
    });
    assert.ok(
      lease.clips.every((clip) =>
        clip.tracks.every((track) =>
          members.has(THREE.PropertyBinding.parseTrackName(track.name).nodeName),
        ),
      ),
    );
  }
  const uploads = [];
  owner.prepareTextures((map) => uploads.push(map));
  assert.deepEqual(uploads, [decoded.map]);
  owner.dispose();
  owner.dispose();
  assert.deepEqual(decoded.counts, { geometry: 0, material: 0, texture: 0, image: 0, skeleton: 0 });
  assert.throws(() => owner.createActorLease(), /Unknown appearance/);
  actor.release();
  actor.release();
  lod.release();
  assert.equal(decoded.counts.geometry, 0);
  parts.release();
  parts.release();
  assert.deepEqual(decoded.counts, decoded.totals);
});

test('partial decode and cancellation dispose all returned resources before exposing an appearance owner', async () => {
  const f = await fixture();
  f.manifest.files.push({ ...f.manifest.files[0], path: 'other.glb' });
  f.manifest.characters.push({ ...f.manifest.characters[0], family: 'courier', file: 'other.glb' });
  f.assets.set('other.glb', f.assets.get('actor.glb'));
  f.manifestBytes = new TextEncoder().encode(JSON.stringify(f.manifest));
  f.sha256 = await worldSHA256(f.manifestBytes);
  const pack = await prepareCombatAppearancePack(f);
  let decoded,
    calls = 0;
  await assert.rejects(
    prepareCombatAppearanceModels(pack, {
      THREE,
      clone: cloneSkeleton,
      loadModel: async (blob) => {
        if (++calls === 2) throw new Error('Decode interrupted');
        decoded = await decodedFixture(blob);
        return decoded.model;
      },
    }),
    /Decode interrupted/,
  );
  assert.equal(calls, 2);
  assert.deepEqual(decoded.counts, decoded.totals);
  const controller = new AbortController();
  await assert.rejects(
    prepareCombatAppearanceModels(pack, {
      THREE,
      clone: cloneSkeleton,
      signal: controller.signal,
      loadModel: async (blob) => {
        decoded = await decodedFixture(blob);
        controller.abort();
        return decoded.model;
      },
    }),
    { name: 'AbortError' },
  );
  assert.deepEqual(decoded.counts, decoded.totals);
});

test('missing decoded roots or LOD motion and malformed animations reject with complete disposal', async (t) => {
  const pack = await prepareCombatAppearancePack(await fixture());
  for (const [name, mutate, pattern] of [
    [
      'missing root',
      (model) => {
        model.scene.getObjectByName('LOD').name = 'Missing';
      },
      /root is missing/,
    ],
    [
      'LOD motion absent',
      (model) => {
        for (const clip of model.animations)
          clip.tracks = clip.tracks.filter(
            (track) => THREE.PropertyBinding.parseTrackName(track.name).nodeName !== 'LODBone',
          );
      },
      /clip is missing/,
    ],
    [
      'malformed clips',
      (model) => {
        model.animations = null;
      },
      /decoding failed/,
    ],
  ])
    await t.test(name, async () => {
      let decoded;
      await assert.rejects(
        prepareCombatAppearanceModels(pack, {
          THREE,
          clone: cloneSkeleton,
          loadModel: async (blob) => {
            decoded = await decodedFixture(blob);
            mutate(decoded.model);
            return decoded.model;
          },
        }),
        pattern,
      );
      assert.deepEqual(decoded.counts, decoded.totals);
    });
});

test('actor leases preserve normalization ancestors and animations for both live and LOD roots', async () => {
  const pack = await prepareCombatAppearancePack(await fixture());
  const owner = await prepareCombatAppearanceModels(pack, {
    THREE,
    clone: cloneSkeleton,
    loadModel: async (blob) => {
      const { model } = await decodedFixture(blob);
      const normalization = new THREE.Group();
      normalization.position.set(2, 3, 4);
      normalization.scale.setScalar(2);
      normalization.rotation.y = 0.25;
      model.scene.add(normalization);
      normalization.add(
        model.scene.getObjectByName('Character'),
        model.scene.getObjectByName('LOD'),
      );
      for (const clip of model.animations)
        for (const track of clip.tracks) {
          if (track.name.endsWith('.position')) track.values[3] = 0.2;
        }
      return model;
    },
  });
  try {
    for (const lod of [0, 1]) {
      const lease = owner.createActorLease(0, { lod }),
        copy = lease.clone(lease.scene);
      const sourceBox = new THREE.Box3().setFromObject(lease.scene),
        copyBox = new THREE.Box3().setFromObject(copy);
      assert.ok(sourceBox.min.distanceTo(copyBox.min) < 0.00001);
      assert.ok(sourceBox.max.distanceTo(copyBox.max) < 0.00001);
      const boneName = lod ? 'LODBone' : 'Bone',
        bone = copy.getObjectByName(boneName),
        mixer = new THREE.AnimationMixer(copy);
      mixer.clipAction(lease.clips.find((clip) => clip.name === 'Walk')).play();
      mixer.setTime(0.5);
      assert.ok(bone.position.x > 0.09 && bone.position.x < 0.11);
      assert.equal(lease.scene.getObjectByName(boneName).position.x, 0);
      mixer.stopAllAction();
      mixer.uncacheRoot(copy);
      copy.traverse((node) => node.skeleton?.dispose());
      const scene = new THREE.Scene(),
        actors = createCombatActorPresentation({ THREE, scene });
      try {
        assert.equal(actors.setAppearanceTemplate(lease), true);
        actors.setActors([
          {
            id: 'actor',
            type: 'patrol',
            material: 'organic',
            radius: 350,
            height: 1800,
            health: 100,
            status: 'active',
            position: { x: 0, y: 0, z: 0 },
            appearance: { family: 'patroller', cast: 'tactical' },
          },
        ]);
        actors.update({ tick: 25 });
        assert.equal(actors.resources().skinnedActors, 1);
      } finally {
        actors.dispose();
      }
    }
  } finally {
    owner.dispose();
  }
});

test('equipment retains live bone binding and uses its declared rigid remains pose without copying geometry', async () => {
  const f = await fixture(
    (doc) => {
      doc.nodes.push(
        { name: 'LiveGear', mesh: 1, translation: [0.6, 0.9, 0] },
        {
          name: 'SettledGear',
          mesh: 1,
          translation: [0.2, 0.8, 0],
          rotation: [0, 0, -Math.SQRT1_2, Math.SQRT1_2],
        },
      );
      doc.scenes[0].nodes.push(19, 20);
    },
    (manifest) => {
      manifest.characters[0].equipment = [
        {
          root: 'LiveGear',
          remainsRoot: 'SettledGear',
          bone: 'Bone',
          lodBones: ['LODBone'],
          region: 'leftArm',
          color: [0.5, 0.6, 0.7],
        },
      ];
    },
  );
  const pack = await prepareCombatAppearancePack(f);
  assert.equal(pack.manifest.characters[0].equipment[0].remainsRoot, 'SettledGear');
  let decoded;
  const owner = await prepareCombatAppearanceModels(pack, {
    THREE,
    clone: cloneSkeleton,
    loadModel: async (blob) => {
      decoded = await decodedFixture(blob);
      return decoded.model;
    },
  });
  const actor = owner.createActorLease(),
    parts = owner.createPartsLease();
  try {
    const live = actor.equipment[0],
      remains = parts.equipment[0];
    assert.equal(live.mesh.name, 'LiveGear');
    assert.equal(remains.mesh.name, 'SettledGear');
    assert.equal(
      live.mesh.geometry,
      remains.mesh.geometry,
      'Two poses share the same admitted vertex data',
    );
    assert.deepEqual(
      new THREE.Vector3().setFromMatrixPosition(live.mesh.matrixWorld).toArray(),
      [0.6, 0.9, 0],
    );
    assert.deepEqual(
      new THREE.Vector3().setFromMatrixPosition(remains.mesh.matrixWorld).toArray(),
      [0.2, 0.8, 0],
    );
    assert.ok(
      new THREE.Quaternion()
        .setFromRotationMatrix(remains.mesh.matrixWorld)
        .angleTo(new THREE.Quaternion(0, 0, -Math.SQRT1_2, Math.SQRT1_2)) < 1e-6,
    );
    assert.deepEqual(remains.color, live.color);
    assert.equal(remains.region, 'leftArm');
    owner.dispose();
    actor.release();
    assert.equal(decoded.counts.geometry, 0, 'Remains lease retains the shared source');
  } finally {
    actor.release();
    parts.release();
    owner.dispose();
  }
  assert.deepEqual(decoded.counts, decoded.totals);
});

test('declared remains equipment must be an admitted distinct rigid branch', async (t) => {
  for (const [label, remainsRoot, mutate] of [
    ['missing', 'MissingGear', () => {}],
    ['skinned', 'Live', () => {}],
    [
      'too many draws',
      'SettledGear',
      (doc) => {
        doc.nodes[20] = { name: 'SettledGear', children: [21, 22, 23] };
        doc.nodes.push(...Array.from({ length: 3 }, (_, i) => ({ name: `GearPart${i}`, mesh: 1 })));
      },
    ],
  ])
    await t.test(label, async () => {
      const f = await fixture(
        (doc) => {
          doc.nodes.push({ name: 'LiveGear', mesh: 1 }, { name: 'SettledGear', mesh: 1 });
          doc.scenes[0].nodes.push(19, 20);
          mutate(doc);
        },
        (manifest) => {
          manifest.characters[0].equipment = [
            {
              root: 'LiveGear',
              remainsRoot,
              bone: 'Bone',
              lodBones: ['LODBone'],
              region: 'leftArm',
            },
          ];
        },
      );
      await assert.rejects(
        prepareCombatAppearancePack(f),
        /equipment|rigid|root|draw|Missing appearance node/i,
      );
    });
});
