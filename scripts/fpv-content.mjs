#!/usr/bin/env node
/** Offline authoring only; dependencies are isolated in authoring/fpv-worlds. */
import { readFile, writeFile, mkdir, realpath, lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import {
  inspectImport,
  projectFromImport,
  preparePack,
  inspectPack,
  canonicalWorldJSON,
  validateWorldPath,
  WORLD_LIMITS,
} from '../optional-practice/civilian-fpv/world-content.mjs';
import { exportEditableZip } from '../optional-practice/civilian-fpv/world-zip.mjs';
const requireAuthoring = createRequire(
  new URL('../authoring/fpv-worlds/package.json', import.meta.url),
);
const load = (name) => import(pathToFileURL(requireAuthoring.resolve(name)).href);
const check = (ok, message) => {
  if (!ok) throw new TypeError(message);
};
async function sourceFiles(entry) {
  const absolute = await realpath(entry),
    base = path.dirname(absolute),
    name = path.basename(absolute),
    stat = await lstat(absolute);
  check(stat.isFile() && stat.size <= WORLD_LIMITS.importBytes, 'Source model exceeds budget.');
  const bytes = await readFile(absolute);
  let json;
  if (/\.glb$/i.test(name)) {
    check(
      bytes.length >= 20 &&
        bytes.readUInt32LE(0) === 0x46546c67 &&
        bytes.readUInt32LE(4) === 2 &&
        bytes.readUInt32LE(8) === bytes.length &&
        bytes.readUInt32LE(16) === 0x4e4f534a,
      'Invalid GLB header.',
    );
    const size = bytes.readUInt32LE(12);
    check(size <= WORLD_LIMITS.jsonBytes && 20 + size <= bytes.length, 'Invalid GLB JSON length.');
    json = JSON.parse(bytes.subarray(20, 20 + size).toString('utf8'));
  } else {
    check(
      /\.gltf$/i.test(name) && bytes.length <= WORLD_LIMITS.jsonBytes,
      'Expected .gltf or .glb.',
    );
    json = JSON.parse(bytes.toString('utf8'));
  }
  check(
    (json.nodes?.length ?? 0) <= WORLD_LIMITS.nodes &&
      (json.accessors?.length ?? 0) <= WORLD_LIMITS.accessors,
    'Source count budget exceeded.',
  );
  let accessorValues = 0;
  for (const accessor of json.accessors ?? [])
    check(
      Number.isSafeInteger(accessor.count) &&
        accessor.count > 0 &&
        accessor.count <= WORLD_LIMITS.vertices &&
        (accessorValues += accessor.count) <= WORLD_LIMITS.vertices * 4,
      'Source accessor allocation budget exceeded.',
    );
  for (const buffer of [...(json.buffers ?? []), ...(json.bufferViews ?? [])])
    check(
      Number.isSafeInteger(buffer.byteLength) &&
        buffer.byteLength >= 0 &&
        buffer.byteLength <= WORLD_LIMITS.importBytes,
      'Source buffer allocation budget exceeded.',
    );
  const files = new Map([[name, bytes]]),
    resources = {};
  let size = bytes.length,
    count = 0;
  async function visit(value, depth = 0) {
    check(++count < 200000 && depth < 64, 'Source JSON exceeds structural budget.');
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      check(!['__proto__', 'constructor', 'prototype'].includes(key), 'Unsafe source field.');
      if (key === 'uri') {
        validateWorldPath(child);
        if (files.has(child)) continue;
        const resolved = await realpath(path.join(base, child)),
          relative = path.relative(base, resolved);
        check(
          relative && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative),
          'Resource escapes source folder.',
        );
        const resourceStat = await lstat(resolved);
        check(
          resourceStat.isFile() &&
            (size += resourceStat.size) <= WORLD_LIMITS.importBytes &&
            files.size < WORLD_LIMITS.files,
          'Source resource budget exceeded.',
        );
        const data = await readFile(resolved);
        files.set(child, data);
        resources[child] = data;
      } else await visit(child, depth + 1);
    }
  }
  await visit(json);
  if (/\.glb$/i.test(name))
    check(
      files.size === 1,
      'GLB sources must embed resources. Use .gltf for a local resource folder.',
    );
  return { absolute, name, bytes, json, files, resources };
}
export async function inspectWorldFile(entry) {
  const source = await sourceFiles(entry);
  return inspectImport({ files: source.files, entry: source.name, id: 'inspected-world' });
}
export async function prepareWorldFile({
  entry,
  outputDirectory,
  id = 'authored-world',
  title = 'Authored world',
}) {
  const source = await sourceFiles(entry),
    [
      { NodeIO },
      { ALL_EXTENSIONS },
      { dedup, prune, inspect },
      { MeshoptDecoder },
      validatorModule,
      dracoModule,
    ] = await Promise.all([
      load('@gltf-transform/core'),
      load('@gltf-transform/extensions'),
      load('@gltf-transform/functions'),
      load('meshoptimizer'),
      load('gltf-validator'),
      load('draco3dgltf'),
    ]);
  await MeshoptDecoder.ready;
  const draco = dracoModule.default ?? dracoModule,
    io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
      'meshopt.decoder': MeshoptDecoder,
      'draco3d.decoder': await draco.createDecoderModule(),
    });
  const document = /\.glb$/i.test(source.name)
    ? await io.readBinary(source.bytes)
    : await io.readJSON({ json: source.json, resources: source.resources });
  // Browser profile deliberately uses uncompressed static GLB. Decoding occurs offline.
  for (const extension of document.getRoot().listExtensionsUsed())
    if (
      ['EXT_meshopt_compression', 'KHR_meshopt_compression', 'KHR_draco_mesh_compression'].includes(
        extension.extensionName,
      )
    )
      extension.dispose();
  const original = await inspectImport({
    files: { 'source.glb': await io.writeBinary(document) },
    entry: 'source.glb',
    id,
    title,
  });
  // Extract semantics FIRST. Never flatten/center/join/prune empty markers by aggregate defaults.
  const validator = validatorModule.default ?? validatorModule;
  const before = await validator.validateBytes(
    new Uint8Array(await original.modelBlob.arrayBuffer()),
    { uri: 'source.glb', writeTimestamp: false },
  );
  check(before.issues.numErrors === 0, 'Khronos Validator rejected the canonical input.');
  const beforeStats = inspect(document);
  await document.transform(dedup(), prune({ keepExtras: true, keepLeaves: true }));
  const optimized = await io.writeBinary(document),
    after = await validator.validateBytes(optimized, { uri: 'world.glb', writeTimestamp: false });
  check(after.issues.numErrors === 0, 'Khronos Validator rejected optimized output.');
  const prepared = await inspectImport({
    files: { 'world.glb': optimized },
    entry: 'world.glb',
    id,
    title,
  });
  const signature = (items) =>
    canonicalWorldJSON(
      items.map(({ node, ...item }) => item).sort((a, b) => a.id.localeCompare(b.id)),
    );
  check(
    signature(original.metadata.anchors) === signature(prepared.metadata.anchors) &&
      signature(original.metadata.colliders) === signature(prepared.metadata.colliders),
    'Optimization changed semantic anchors.',
  );
  const project = projectFromImport(prepared),
    output = path.resolve(outputDirectory),
    model = path.join(output, project.world.modelAsset);
  check(
    output !== path.dirname(source.absolute),
    'Use a separate output directory to preserve authoring sources.',
  );
  await mkdir(path.dirname(model), { recursive: true });
  await writeFile(model, new Uint8Array(await prepared.modelBlob.arrayBuffer()));
  await writeFile(path.join(output, 'project.json'), canonicalWorldJSON(project) + '\n');
  const report = {
    format: 'FPVPreparationReport.v1',
    source: source.name,
    sourceHash: original.sourceHash,
    outputHash: prepared.sourceHash,
    toolchain: {
      blender: '4.5 LTS',
      gltfTransform: '4.5.1',
      gltfValidator: '2.0.0-dev.3.10',
      meshoptimizer: '1.3.0',
      draco3dgltf: '1.5.7',
    },
    recipe: [
      'decode-meshopt-or-draco',
      'extract-extras.rl',
      'dedup',
      'prune(keepExtras,keepLeaves)',
      'compare-semantic-world-transforms',
    ],
    validation: { before, after },
    statistics: { before: beforeStats, after: inspect(document) },
    diagnostics: prepared.metadata.diagnostics,
  };
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  return { project, report };
}
async function projectAssets(file) {
  const project = JSON.parse(await readFile(file, 'utf8')),
    base = await realpath(path.dirname(file)),
    assets = new Map();
  for (const asset of project.assets ??
    (project.world.modelAsset ? [project.world.modelAsset] : [])) {
    validateWorldPath(asset);
    const target = await realpath(path.join(base, asset)),
      relative = path.relative(base, target);
    check(
      !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative),
      'Asset escapes project directory.',
    );
    assets.set(asset, await readFile(target));
  }
  return { project, assets };
}
export async function fpvContentMain(args) {
  const [command, input, output, id] = args;
  if (command === 'inspect') {
    const result = await inspectWorldFile(input);
    process.stdout.write(
      JSON.stringify(
        { sourceHash: result.sourceHash, bytes: result.modelBlob.size, ...result.metadata },
        null,
        2,
      ) + '\n',
    );
  } else if (command === 'prepare') {
    check(input && output, 'prepare requires input model and output folder.');
    const result = await prepareWorldFile({ entry: input, outputDirectory: output, id });
    process.stdout.write(
      JSON.stringify(
        { project: result.project.id, output, diagnostics: result.report.diagnostics },
        null,
        2,
      ) + '\n',
    );
  } else if (command === 'pack' || command === 'zip') {
    const { project, assets } = await projectAssets(input),
      blob =
        command === 'pack'
          ? await preparePack(project, { assets })
          : await exportEditableZip(project, {
              assets: new Map([...assets].map(([p, b]) => [p, new Blob([b])])),
            });
    check(output, 'An output filename is required.');
    await writeFile(output, new Uint8Array(await blob.arrayBuffer()));
    process.stdout.write(`${command}: ${blob.size} bytes\n`);
  } else if (command === 'verify') {
    const pack = await inspectPack(await readFile(input));
    process.stdout.write(
      `${pack.project.id}: verified ${pack.assets.size} assets, SHA-256 ${pack.sha256}\n`,
    );
  } else {
    process.stdout.write(
      'FPV authoring (offline)\n  inspect INPUT.glb|gltf\n  prepare INPUT.glb|gltf OUTPUT_FOLDER [WORLD_ID]\n  pack PROJECT.json OUTPUT.rlpack\n  zip PROJECT.json OUTPUT.zip\n  verify INPUT.rlpack\nInstall toolchain: npm ci --prefix authoring/fpv-worlds --ignore-scripts\n',
    );
    if (command && command !== '--help') process.exitCode = 1;
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  fpvContentMain(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`FPV content: ${error.message}\n`);
    process.exitCode = 1;
  });
