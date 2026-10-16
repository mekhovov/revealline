import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const require = createRequire(import.meta.url);
const validator = require('gltf-validator');
const root = path.dirname(fileURLToPath(import.meta.url));
const records = JSON.parse(await fs.readFile(path.join(root, 'final-report.json')));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const results = [];
for (const record of records) {
  const bytes = await fs.readFile(path.join(root, 'models', `${record.id}.glb`));
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  if (bytes.length !== record.bytes || sha256 !== record.sha256)
    throw new Error(`Identity mismatch: ${record.id}`);
  const validation = await validator.validateBytes(bytes, { maxIssues: 100 });
  if (validation.issues.numErrors || validation.issues.numWarnings)
    throw new Error(`Invalid model: ${record.id}`);
  if (validation.info.resources.some((r) => r.storage !== 'glb' && r.storage !== 'buffer-view'))
    throw new Error(`External resource: ${record.id}`);
  const doc = await io.readBinary(bytes);
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  let triangles = 0;
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const matrix = node.getWorldMatrix();
    for (const primitive of mesh.listPrimitives()) {
      if (primitive.getMode() !== 4) throw new Error(`Non-triangle topology: ${record.id}`);
      const position = primitive.getAttribute('POSITION');
      if (!primitive.getAttribute('NORMAL')) throw new Error(`Missing normals: ${record.id}`);
      if (primitive.getMaterial()?.getBaseColorTexture() && !primitive.getAttribute('TEXCOORD_0'))
        throw new Error(`Missing texture coordinates: ${record.id}`);
      triangles += (primitive.getIndices()?.getCount() ?? position.getCount()) / 3;
      const v = [];
      for (let i = 0; i < position.getCount(); i++) {
        position.getElement(i, v);
        for (let axis = 0; axis < 3; axis++) {
          const value =
            matrix[axis] * v[0] +
            matrix[axis + 4] * v[1] +
            matrix[axis + 8] * v[2] +
            matrix[axis + 12];
          if (!Number.isFinite(value)) throw new Error(`Non-finite geometry: ${record.id}`);
          min[axis] = Math.min(min[axis], value);
          max[axis] = Math.max(max[axis], value);
        }
      }
    }
  }
  if (triangles !== record.triangles) throw new Error(`Triangle count changed: ${record.id}`);
  results.push({
    id: record.id,
    sha256,
    bytes: bytes.length,
    triangles,
    drawCalls: validation.info.drawCallCount,
    dimensionsMetres: max.map((n, i) => n - min[i]),
    bounds: { min, max },
    errors: 0,
    warnings: 0,
  });
}
console.log(
  JSON.stringify(
    { scope: 'Pinned self-contained authoring assets; no flight/world admission', models: results },
    null,
    2,
  ),
);
