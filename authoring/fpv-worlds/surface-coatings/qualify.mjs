#!/usr/bin/env node
// Bounded manual compatibility and real parser qualification; no browser/GPU or unit suite.
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as coating from '../../../optional-practice/civilian-fpv/world-themes.mjs';
import * as content from '../../../optional-practice/civilian-fpv/world-content.mjs';
import {
  exportEditableZip,
  importEditableZip,
} from '../../../optional-practice/civilian-fpv/world-zip.mjs';
import { GLTFLoader } from '../../../optional-practice/civilian-fpv/vendor/addons/loaders/GLTFLoader.js';
import { configureWorldGLTFLoader } from '../../../optional-practice/civilian-fpv/renderer.mjs';
import {
  applySimMaterialBindings,
  disposeSimVisualGroup,
} from '../../../optional-practice/civilian-fpv/world-visuals.mjs';
import { prepareWorldFile } from '../../../scripts/fpv-content.mjs';
const [legacyRoot, outputRoot] = process.argv.slice(2);
if (!outputRoot) throw Error('Use LEGACY_PLAYER NEW_OUTPUT_DIRECTORY');
await mkdir(outputRoot);
const output = path.join(outputRoot, 'qualification.json');
const legacy = await import(
    pathToFileURL(path.join(legacyRoot, 'optional-practice/civilian-fpv/world-content.mjs'))
  ),
  legacyZip = await import(
    pathToFileURL(path.join(legacyRoot, 'optional-practice/civilian-fpv/world-zip.mjs'))
  ),
  name = coating.WORLD_SURFACE_COATING_EXTENSION,
  hint = { version: 1, kind: 'opaque-finish' },
  sha = (b) => createHash('sha256').update(b).digest('hex'),
  checks = [];
function check(label, ok) {
  checks.push({ name: label, passed: !!ok });
  if (!ok) throw Error(label);
}
async function rejects(label, action, match) {
  let message = '';
  try {
    await action();
  } catch (error) {
    message = error.message;
  }
  check(label, match.test(message));
}
function parse(bytes) {
  const n = bytes.readUInt32LE(12);
  return { json: JSON.parse(bytes.subarray(20, 20 + n)), binary: bytes.subarray(n + 28) };
}
function binary(
  json,
  bytes = Buffer.concat([
    Buffer.from(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer),
    Buffer.alloc(12, 255),
  ]),
) {
  const text = Buffer.from(JSON.stringify(json)),
    n = Math.ceil(text.length / 4) * 4,
    b = Buffer.alloc(28 + n + bytes.length);
  b.writeUInt32LE(0x46546c67);
  b.writeUInt32LE(2, 4);
  b.writeUInt32LE(b.length, 8);
  b.writeUInt32LE(n, 12);
  b.writeUInt32LE(0x4e4f534a, 16);
  b.fill(32, 20, 20 + n);
  text.copy(b, 20);
  b.writeUInt32LE(bytes.length, 20 + n);
  b.writeUInt32LE(0x004e4942, 24 + n);
  bytes.copy(b, 28 + n);
  return b;
}
function document({ marked = true, unlit = false } = {}) {
  const extensions = {
      ...(marked ? { [name]: hint } : {}),
      ...(unlit ? { KHR_materials_unlit: {} } : {}),
    },
    used = Object.keys(extensions);
  return {
    asset: { version: '2.0' },
    ...(used.length ? { extensionsUsed: used, extensionsRequired: used } : {}),
    buffers: [{ byteLength: 48 }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36 },
      { buffer: 0, byteOffset: 36, byteLength: 12 },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        type: 'VEC3',
        count: 3,
        min: [0, 0, 0],
        max: [1, 1, 0],
      },
      { bufferView: 1, componentType: 5121, type: 'VEC4', count: 3, normalized: true },
    ],
    materials: [{ ...(used.length ? { extensions } : {}), name: 'coated' }, { name: 'plain' }],
    meshes: [0, 1].map((material) => ({
      primitives: [{ attributes: { POSITION: 0, COLOR_0: 1 }, material }],
    })),
    nodes: [{ mesh: 0 }, { mesh: 0 }, { mesh: 1 }],
    scenes: [{ nodes: [0, 1, 2] }],
    scene: 0,
  };
}
for (const [label, mutate] of [
  ['unknown version', (d) => (d.materials[0].extensions[name].version = 2)],
  ['unknown kind', (d) => (d.materials[0].extensions[name].kind = 'xray')],
  ['extra numeric state', (d) => (d.materials[0].extensions[name].factor = -99)],
  ['blend', (d) => (d.materials[0].alphaMode = 'BLEND')],
  ['alpha mask', (d) => (d.materials[0].alphaMode = 'MASK')],
  [
    'partial opacity',
    (d) => (d.materials[0].pbrMetallicRoughness = { baseColorFactor: [1, 1, 1, 0.5] }),
  ],
  [
    'transmission',
    (d) => (d.materials[0].extensions.KHR_materials_transmission = { transmissionFactor: 0.2 }),
  ],
  ['missing required marker', (d) => delete d.extensionsRequired],
  ['missing used marker', (d) => delete d.extensionsUsed],
  ['duplicate marker', (d) => d.extensionsRequired.push(name)],
  ['lines', (d) => (d.meshes[0].primitives[0].mode = 1)],
  ['marker without payload', (d) => delete d.materials[0].extensions[name]],
]) {
  const d = structuredClone(document());
  mutate(d);
  const sourcePath = path.join(outputRoot, label.replaceAll(' ', '-') + '.glb'),
    preparedPath = sourcePath + '.prepared';
  await writeFile(sourcePath, binary(d), { flag: 'wx' });
  await rejects(
    label + ' rejected before offline transformation',
    () => prepareWorldFile({ entry: sourcePath, outputDirectory: preparedPath }),
    /coating/i,
  );
  let absent = false;
  try {
    await access(preparedPath);
  } catch (error) {
    absent = error.code === 'ENOENT';
  }
  check(label + ' creates no downgraded prepared output', absent);
  await rejects(
    label + ' rejected by shared validator',
    () => coating.validateWorldSurfaceCoatings(d),
    /coating/i,
  );
  await rejects(
    label + ' rejected by real loader before scene construction',
    () => configureWorldGLTFLoader(new GLTFLoader()).parseAsync(binary(d).buffer, ''),
    /coating/i,
  );
}
for (const unlit of [false, true]) {
  const bytes = binary(document({ unlit })),
    result = await configureWorldGLTFLoader(new GLTFLoader()).parseAsync(bytes.buffer, ''),
    [a, b, plain] = result.scene.children,
    paint = a.material;
  check(
    'Actual ' + (unlit ? 'unlit' : 'PBR') + ' material has fixed bias',
    paint.polygonOffset && paint.polygonOffsetFactor === -1 && paint.polygonOffsetUnits === -1,
  );
  check(
    'Opaque GLTF state retained',
    !paint.transparent && paint.opacity === 1 && paint.depthTest && paint.depthWrite,
  );
  check(
    'Loader flat-normal clone association is preserved',
    paint.flatShading && result.parser.associations.get(paint).materials === 0,
  );
  check('Loader vertex-color material variant remains enabled', paint.vertexColors);
  check('Shared real loader material remains shared', a.material === b.material);
  check('Unmarked real loader material unchanged', !plain.material.polygonOffset);
  check('Canonical payload not duplicated in extras', !paint.userData.reveallineSurface);
  for (const item of [a, b, plain])
    item.userData.reveallineTheme = {
      format: 'SimMaterialBinding.v1',
      collectionId: 'industrial-workshop',
      revision: 'r1',
      role: 'concrete',
    };
  // Theme bindings require UVs; the triangle fixture deliberately has no map.
  const THREE = await import('../../../optional-practice/civilian-fpv/vendor/three.module.js');
  for (const item of [a, b, plain])
    item.geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
  const themes = applySimMaterialBindings(result.scene, { collectionId: 'industrial-workshop' });
  check('Actual parsed Theme bindings all apply', themes.applied === 3);
  check(
    'Theme preserves coating and shared owner',
    a.material === b.material &&
      a.material.polygonOffset &&
      a.material.polygonOffsetFactor === -1 &&
      a.material.polygonOffsetUnits === -1,
  );
  check(
    'Theme cache keeps plain and coated distinct',
    a.material !== plain.material && !plain.material.polygonOffset,
  );
  const owners = new Set([
      ...result.scene.userData.ownedMaterials,
      ...result.scene.children.map((m) => m.material),
    ]),
    counts = new Map();
  for (const p of owners)
    p.addEventListener('dispose', () => counts.set(p, (counts.get(p) ?? 0) + 1));
  disposeSimVisualGroup(result.scene);
  check(
    'Actual parsed/theme material owners disposed exactly once',
    [...owners].every((p) => counts.get(p) === 1),
  );
}
const source = binary(document()),
  entry = path.join(outputRoot, 'valid.glb'),
  preparedRoot = path.join(outputRoot, 'valid-prepared');
await writeFile(entry, source, { flag: 'wx' });
const { project, report } = await prepareWorldFile({ entry, outputDirectory: preparedRoot }),
  prepared = await readFile(path.join(preparedRoot, project.world.modelAsset)),
  assets = new Map([[project.world.modelAsset, prepared]]),
  pack = Buffer.from(await (await content.preparePack(project, { assets })).arrayBuffer()),
  zip = await exportEditableZip(project, { assets });
check(
  'Actual offline preparation has no validator errors',
  report.validation.before.issues.numErrors === 0 && report.validation.after.issues.numErrors === 0,
);
for (const [label, bytes] of [
  ['source', source],
  ['prepared', prepared],
]) {
  check(
    label + ' retains canonical required capability',
    coating.validateWorldSurfaceCoatings(parse(bytes).json).size === 1,
  );
  await rejects(
    'Legacy host refuses ' + label,
    () => legacy.inspectImport({ files: { 'world.glb': bytes }, entry: 'world.glb' }),
    /Unsupported required extension: REVEALLINE_surface_coating/,
  );
  const parsed = await configureWorldGLTFLoader(new GLTFLoader()).parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  let marked = 0;
  parsed.scene.traverse((item) => {
    if (item.isMesh && item.material.polygonOffset) marked++;
  });
  check(label + ' actual parser applies retained coating', marked === 2);
  disposeSimVisualGroup(parsed.scene);
}
await rejects(
  'Legacy host refuses required pack',
  () => legacy.inspectPack(pack),
  /Unsupported required extension: REVEALLINE_surface_coating/,
);
await rejects(
  'Legacy host refuses required editable ZIP',
  () => legacyZip.importEditableZip(zip),
  /Unsupported required extension: REVEALLINE_surface_coating/,
);
const imported = await content.inspectPack(pack),
  zipped = await importEditableZip(zip),
  reopened = await importEditableZip(
    await exportEditableZip(zipped.project, { assets: zipped.assets }),
  );
for (const [label, data] of [
  ['pack', imported],
  ['ZIP', zipped],
  ['reexport/reimport', reopened],
]) {
  check(
    label + ' preserves exact prepared GLB',
    sha(Buffer.from(await data.assets.get(project.world.modelAsset).arrayBuffer())) ===
      sha(prepared),
  );
  check(
    label + ' preserves complete project',
    content.canonicalWorldJSON(data.project) === content.canonicalWorldJSON(project),
  );
}
const noHint = binary(document({ marked: false })),
  old = await legacy.inspectImport({ files: { 'world.glb': noHint }, entry: 'world.glb' }),
  current = await content.inspectImport({ files: { 'world.glb': noHint }, entry: 'world.glb' });
check(
  'Unmarked imported bytes remain legacy-exact',
  sha(Buffer.from(await old.modelBlob.arrayBuffer())) ===
    sha(Buffer.from(await current.modelBlob.arrayBuffer())),
);
const ordinary = await configureWorldGLTFLoader(new GLTFLoader()).parseAsync(noHint.buffer, '');
check(
  'Unmarked actual loader keeps default offset',
  ordinary.scene.children.every(
    (m) =>
      !m.material.polygonOffset &&
      m.material.polygonOffsetFactor === 0 &&
      m.material.polygonOffsetUnits === 0,
  ),
);
disposeSimVisualGroup(ordinary.scene);
const files = [
    'renderer.mjs',
    'world-visuals-source.mjs',
    'world-visuals.mjs',
    'world-content.mjs',
    'world-themes.mjs',
  ],
  runtime = [];
for (const file of files) {
  const bytes = await readFile(
    new URL('../../../optional-practice/civilian-fpv/' + file, import.meta.url),
  );
  runtime.push({
    path: 'optional-practice/civilian-fpv/' + file,
    bytes: bytes.length,
    sha256: sha(bytes),
  });
}
const receipt = {
  format: 'FPVRequiredSurfaceCoatingManualQualification.v2',
  status: 'passed',
  checks,
  runtime,
  source: { bytes: source.length, sha256: sha(source) },
  prepared: { bytes: prepared.length, sha256: sha(prepared) },
  pack: { bytes: pack.length, sha256: sha(pack) },
  legacyPlayer: legacyRoot,
  scope:
    'Bounded manual real-loader, native offline preparation, pack/ZIP, Theme ownership and compatibility checks. No WebGL, flight, art, hardware or package admission claim.',
};
await writeFile(output, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ passed: checks.length, pack: receipt.pack }));
