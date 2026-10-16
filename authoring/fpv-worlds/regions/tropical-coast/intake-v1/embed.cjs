const fs = require('fs'),
  path = require('path'),
  crypto = require('crypto');
const root = path.resolve(process.argv[2]);
const validator = require('gltf-validator');
const hash = (b) => crypto.createHash('sha256').update(b).digest('hex');
(async () => {
  const reports = [];
  for (const rec of JSON.parse(fs.readFileSync(path.join(root, 'selection.json')))) {
    const dir = path.join(root, 'selected', rec.id),
      raw = fs.readFileSync(path.join(dir, 'converted.glb')),
      jl = raw.readUInt32LE(12),
      doc = JSON.parse(raw.subarray(20, 20 + jl));
    let bin = raw.subarray(28 + jl, 28 + jl + raw.readUInt32LE(20 + jl));
    const changes = [];
    const cs = rec.materialSource
      ? fs.readFileSync(path.join(dir, rec.materialSource), 'utf8')
      : '';
    const defs = [...cs.matchAll(/singleton\s+Material\(([^)]+)\)\s*\{([^}]+)\}/g)].map((m) =>
      Object.fromEntries(
        [
          ...m[2].matchAll(
            /(mapTo|doubleSided|alphaTest|alphaRef|diffuseMap\[0\])\s*=\s*"([^"]*)"/g,
          ),
        ].map((f) => [f[1], f[2]]),
      ),
    );
    for (const mat of doc.materials || []) {
      const matches = defs.filter((d) => d.mapTo === mat.name);
      if (matches.length > 1) throw Error('ambiguous material ' + mat.name);
      const d = matches[0];
      if (d) {
        if (d.doubleSided === '1') mat.doubleSided = true;
        if (d.alphaTest === '1') {
          mat.alphaMode = 'MASK';
          mat.alphaCutoff = d.alphaRef === undefined ? 0.5 : Number(d.alphaRef) / 255;
        }
        changes.push({
          material: mat.name,
          doubleSided: !!mat.doubleSided,
          alphaMode: mat.alphaMode || 'OPAQUE',
          alphaCutoff: mat.alphaCutoff ?? null,
          sourceAlphaRef: d.alphaRef ?? null,
        });
      }
    }
    const uvAdaptations = [];
    for (const mesh of doc.meshes)
      for (const primitive of mesh.primitives)
        for (const [semantic, index] of Object.entries(primitive.attributes)) {
          const acc = doc.accessors[index];
          if (!semantic.startsWith('TEXCOORD_') || acc.type !== 'VEC3') continue;
          if (acc.componentType !== 5126 || acc.sparse) throw Error('unsupported UV encoding');
          const view = doc.bufferViews[acc.bufferView],
            stride = view.byteStride || 12,
            offset = (view.byteOffset || 0) + (acc.byteOffset || 0);
          const uv = Buffer.alloc(acc.count * 8);
          for (let i = 0; i < acc.count; i++) {
            uv.writeFloatLE(bin.readFloatLE(offset + i * stride), i * 8);
            uv.writeFloatLE(bin.readFloatLE(offset + i * stride + 4), i * 8 + 4);
          }
          const target = bin.length;
          bin = Buffer.concat([bin, uv]);
          acc.bufferView = doc.bufferViews.length;
          doc.bufferViews.push({
            buffer: 0,
            byteOffset: target,
            byteLength: uv.length,
            target: 34962,
          });
          acc.byteOffset = 0;
          acc.type = 'VEC2';
          if (acc.min) acc.min = acc.min.slice(0, 2);
          if (acc.max) acc.max = acc.max.slice(0, 2);
          uvAdaptations.push(index);
        }
    const textures = [];
    for (const im of doc.images || []) {
      if (!/^[A-Za-z0-9_.-]+\.(png|jpg)$/i.test(im.uri)) throw Error('unsafe image ' + im.uri);
      const bytes = fs.readFileSync(path.join(dir, im.uri));
      textures.push({ file: im.uri, bytes: bytes.length, sha256: hash(bytes) });
      const offset = bin.length;
      bin = Buffer.concat([bin, bytes, Buffer.alloc((4 - (bytes.length % 4)) % 4)]);
      im.bufferView = doc.bufferViews.length;
      doc.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length });
      im.mimeType = im.uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      delete im.uri;
    }
    doc.buffers[0].byteLength = bin.length;
    doc.asset.generator =
      'assimpjs 0.0.10; bounded tropical intake with explicit embedded source textures';
    const j = Buffer.from(JSON.stringify(doc)),
      jp = Buffer.concat([j, Buffer.alloc((4 - (j.length % 4)) % 4, 32)]);
    const header = Buffer.alloc(20);
    header.writeUInt32LE(0x46546c67);
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(28 + jp.length + bin.length, 8);
    header.writeUInt32LE(jp.length, 12);
    header.writeUInt32LE(0x4e4f534a, 16);
    const bh = Buffer.alloc(8);
    bh.writeUInt32LE(bin.length);
    bh.writeUInt32LE(0x004e4942, 4);
    const out = Buffer.concat([header, jp, bh, bin]);
    const result = await validator.validateBytes(out, { uri: rec.id + '.glb', maxIssues: 100 });
    if (result.issues.numErrors) throw Error(JSON.stringify(result));
    fs.writeFileSync(path.join(dir, rec.id + '.glb'), out);
    const primitives = doc.meshes.flatMap((m) => m.primitives);
    reports.push({
      id: rec.id,
      bytes: out.length,
      sha256: hash(out),
      triangles: primitives.reduce(
        (n, p) =>
          n +
          (p.indices === undefined
            ? doc.accessors[p.attributes.POSITION].count
            : doc.accessors[p.indices].count) /
            3,
        0,
      ),
      vertices: primitives.reduce((n, p) => n + doc.accessors[p.attributes.POSITION].count, 0),
      allNormals: primitives.every((p) => p.attributes.NORMAL !== undefined),
      allTexturedUVs: primitives.every(
        (p) =>
          !doc.materials[p.material]?.pbrMetallicRoughness?.baseColorTexture ||
          p.attributes.TEXCOORD_0 !== undefined,
      ),
      textures,
      materialChanges: changes,
      uv3To2Accessors: uvAdaptations,
      validation: result.issues,
      imageInfo: result.info?.images,
    });
    console.log(rec.id, out.length, result.issues.numWarnings + ' warnings');
  }
  fs.writeFileSync(
    path.join(root, 'conversion-report.json'),
    JSON.stringify(reports, null, 2) + '\n',
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
