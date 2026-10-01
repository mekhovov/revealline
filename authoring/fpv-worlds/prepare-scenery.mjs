import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Document, NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, mergeDocuments, unpartition } from '@gltf-transform/functions';

// Offline, repeatable preparation. Original selected sources and licenses live
// beside this script; the player receives a single self-contained module.
const directory = path.dirname(fileURLToPath(import.meta.url));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const output = new Document();
const scene = output.createScene('Kenney CC0 scenery library');
output.getRoot().setDefaultScene(scene);
const sourceFiles = [];
for (const kit of ['retro-urban', 'city-industrial']) {
  const root = path.join(directory, 'assets/kenney', kit);
  for (const file of (await readdir(root)).filter((name) => name.endsWith('.glb')).sort()) {
    const source = await io.read(path.join(root, file));
    const original = source.getRoot().getDefaultScene();
    const bounds = getBounds(original);
    const map = mergeDocuments(output, source);
    const id = `${kit}/${file.replace(/\.glb$/, '')}`;
    const model = output
      .createNode(id)
      .setTranslation([
        -(bounds.min[0] + bounds.max[0]) / 2,
        -bounds.min[1],
        -(bounds.min[2] + bounds.max[2]) / 2,
      ]);
    model.setExtras({ sceneryId: id, size: bounds.max.map((v, i) => v - bounds.min[i]) });
    for (const node of original.listChildren()) model.addChild(map.get(node));
    scene.addChild(model);
    map.get(original).dispose();
    sourceFiles.push(`assets/kenney/${kit}/${file}`);
  }
}
await output.transform(dedup(), unpartition());
const binary = await io.writeBinary(output);
const template = await readFile(path.join(directory, 'scenery-runtime.template.mjs'), 'utf8');
const source = template.replace('__LIBRARY_BASE64__', Buffer.from(binary).toString('base64'));
const runtime = path.resolve(directory, '../../optional-practice/civilian-fpv/world-assets.mjs');
if (Buffer.byteLength(source) > 2 * 1024 * 1024) throw new Error('Scenery runtime exceeds 2 MiB');
await writeFile(runtime, source);
await writeFile(
  path.join(directory, 'assets/kenney/runtime-provenance.json'),
  `${JSON.stringify(
    {
      format: 'FPVSceneryProvenance.v1',
      author: 'Kenney',
      license: 'CC0-1.0',
      generator: 'authoring/fpv-worlds/prepare-scenery.mjs',
      tool: '@gltf-transform/core/functions/extensions 4.5.1',
      sources: sourceFiles,
      modifications:
        'Embedded original textures, deduplicated shared geometry/materials/textures, centered source models at ground level. Runtime instances form original scenery layouts outside flight bounds. No source geometry changes.',
      runtime: path.relative(path.resolve(directory, '../..'), runtime),
      bytes: Buffer.byteLength(source),
      sha256: createHash('sha256').update(source).digest('hex'),
      libraryBytes: binary.byteLength,
      librarySha256: createHash('sha256').update(binary).digest('hex'),
    },
    null,
    2,
  )}\n`,
);
console.log(
  JSON.stringify({
    runtime,
    bytes: Buffer.byteLength(source),
    libraryBytes: binary.byteLength,
    sourceModels: sourceFiles.length,
  }),
);
