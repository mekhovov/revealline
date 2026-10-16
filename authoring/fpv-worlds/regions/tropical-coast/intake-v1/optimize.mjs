import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, join, prune } from '@gltf-transform/functions';
const require = createRequire(import.meta.url);
const validator = require('gltf-validator');
const root = path.resolve(process.argv[2]),
  io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const records = JSON.parse(await fs.readFile(root + '/conversion-report.json'));
await fs.mkdir(root + '/converted', { recursive: true });
for (const r of records) {
  const doc = await io.read(root + '/selected/' + r.id + '/' + r.id + '.glb');
  r.beforeDrawCalls = doc
    .getRoot()
    .listMeshes()
    .reduce((n, m) => n + m.listPrimitives().length, 0);
  await doc.transform(dedup(), join(), prune());
  const out = await io.writeBinary(doc);
  const v = await validator.validateBytes(out, { uri: r.id + '.glb', maxIssues: 100 });
  if (v.issues.numErrors || v.issues.numWarnings) throw Error(JSON.stringify(v.issues));
  await fs.writeFile(root + '/converted/' + r.id + '.glb', out);
  r.beforeBytes = r.bytes;
  r.beforeSha256 = r.sha256;
  r.bytes = out.length;
  r.sha256 = crypto.createHash('sha256').update(out).digest('hex');
  r.drawCalls = v.info.drawCallCount;
  r.validation = v.issues;
  r.geometry = { vertices: v.info.totalVertexCount, triangles: v.info.totalTriangleCount };
  r.images = v.info.resources.filter((x) => x.image).map((x) => x.image);
  console.log(r.id, r.bytes, r.beforeDrawCalls + '→' + r.drawCalls, JSON.stringify(r.geometry));
}
await fs.writeFile(root + '/final-report.json', JSON.stringify(records, null, 2) + '\n');
