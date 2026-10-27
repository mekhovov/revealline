/** Deterministic r2 refinement of the immutable r1 character. Existing textured
 * body/wardrobe data is shared; only section-edge vertices, indices and matched
 * wound surfaces are added. No complete body or rig is duplicated. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(base, '../r1');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const original = await fs.readFile(path.join(source, 'characters.glb'));
const jsonLength = original.readUInt32LE(12);
const doc = JSON.parse(original.subarray(20, 20 + jsonLength));
const oldBinary = original.subarray(28 + jsonLength);
const chunks = [oldBinary];
let binaryLength = oldBinary.length;
const appendedValues = new Map();
const widths = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const sizes = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 };
function readAccessor(index) {
  if (appendedValues.has(index)) return appendedValues.get(index).map((value) => [...value]);
  const a = doc.accessors[index],
    v = doc.bufferViews[a.bufferView];
  const n = widths[a.type],
    size = sizes[a.componentType],
    stride = v.byteStride ?? n * size;
  const offset = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const read =
    a.componentType === 5126
      ? 'readFloatLE'
      : a.componentType === 5125
        ? 'readUInt32LE'
        : a.componentType === 5123
          ? 'readUInt16LE'
          : 'readUInt8';
  return Array.from({ length: a.count }, (_, i) =>
    Array.from({ length: n }, (_, j) => oldBinary[read](offset + i * stride + j * size)),
  );
}
function appendAccessor(values, type, componentType = 5126, replace = null) {
  const size = sizes[componentType],
    flat = values.flat(),
    bytes = Buffer.alloc(flat.length * size);
  const write =
    componentType === 5126
      ? 'writeFloatLE'
      : componentType === 5125
        ? 'writeUInt32LE'
        : 'writeUInt16LE';
  flat.forEach((v, i) => bytes[write](v, i * size));
  const pad = (4 - (binaryLength % 4)) % 4;
  if (pad) {
    chunks.push(Buffer.alloc(pad));
    binaryLength += pad;
  }
  const bufferView = doc.bufferViews.length;
  doc.bufferViews.push({ buffer: 0, byteOffset: binaryLength, byteLength: bytes.length });
  chunks.push(bytes);
  binaryLength += bytes.length;
  const a = { bufferView, componentType, count: values.length, type };
  if (type === 'VEC3') {
    a.min = [0, 1, 2].map((k) => Math.min(...values.map((v) => v[k])));
    a.max = [0, 1, 2].map((k) => Math.max(...values.map((v) => v[k])));
  }
  if (replace !== null) {
    doc.accessors[replace] = a;
    appendedValues.set(replace, values);
    return replace;
  }
  const result = doc.accessors.push(a) - 1;
  appendedValues.set(result, values);
  return result;
}
const nodeIndex = (name) => doc.nodes.findIndex((n) => n.name === name);
const regions = {};
const regionSource = {
  head: [['head', -Infinity, Infinity, 'chest']],
  torso: [
    ['pelvis', -Infinity, 0.12, null],
    ['abdomen', 0.12, 0.32, 'pelvis'],
    ['chest', 0.32, Infinity, 'abdomen'],
  ],
  left_arm: [
    ['leftForearm', -Infinity, -0.29, 'leftUpperArm'],
    ['leftUpperArm', -0.29, Infinity, 'chest'],
  ],
  right_arm: [
    ['rightForearm', -Infinity, -0.29, 'rightUpperArm'],
    ['rightUpperArm', -0.29, Infinity, 'chest'],
  ],
  left_leg: [
    ['leftShin', -Infinity, -0.42, 'leftThigh'],
    ['leftThigh', -0.42, Infinity, 'pelvis'],
  ],
  right_leg: [
    ['rightShin', -Infinity, -0.42, 'rightThigh'],
    ['rightThigh', -0.42, Infinity, 'pelvis'],
  ],
};
const aggregates = {
  head: 'head',
  torso: 'torso',
  left_arm: 'leftArm',
  right_arm: 'rightArm',
  left_leg: 'leftLeg',
  right_leg: 'rightLeg',
};
// Convex boundary of the actual plane intersections. Use a contact contour,
// never an arbitrary spherical cap protruding through the clothing.
function hull(points) {
  const by = new Map(points.map((p) => [`${p[0].toFixed(6)}/${p[2].toFixed(6)}`, p]));
  const p = [...by.values()].sort((a, b) => a[0] - b[0] || a[2] - b[2]);
  const cross = (a, b, c) => (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]);
  if (p.length < 3) return [];
  const lo = [],
    hi = [];
  for (const v of p) {
    while (lo.length > 1 && cross(lo.at(-2), lo.at(-1), v) <= 0) lo.pop();
    lo.push(v);
  }
  for (const v of p.toReversed()) {
    while (hi.length > 1 && cross(hi.at(-2), hi.at(-1), v) <= 0) hi.pop();
    hi.push(v);
  }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}
for (const [sourceName, specs] of Object.entries(regionSource)) {
  const parentIndex = nodeIndex(`damage_${sourceName}_root`),
    parent = doc.nodes[parentIndex];
  const bodyNode = doc.nodes[nodeIndex(`damage_${sourceName}_mesh`)];
  const capNode = doc.nodes[nodeIndex(`damage_${sourceName}_cap`)];
  const sourceBody = doc.meshes[bodyNode.mesh];
  const outputs = specs.map(() => []),
    cuts = specs.map(() => new Map());
  for (const primitive of sourceBody.primitives) {
    const arrays = Object.fromEntries(
      Object.entries(primitive.attributes).map(([key, index]) => [key, readAccessor(index)]),
    );
    const indices = readAccessor(primitive.indices).flat();
    const edgeCache = new Map();
    function intersect(a, b, y) {
      const key = [Math.min(a, b), Math.max(a, b), y].join('/');
      if (edgeCache.has(key)) return edgeCache.get(key);
      const t = (y - arrays.POSITION[a][1]) / (arrays.POSITION[b][1] - arrays.POSITION[a][1]);
      const index = arrays.POSITION.length;
      for (const values of Object.values(arrays))
        values.push(values[a].map((v, k) => v + (values[b][k] - v) * t));
      arrays.POSITION[index][1] = y;
      const normal = arrays.NORMAL?.[index];
      if (normal) {
        const length = Math.hypot(...normal);
        for (let k = 0; k < 3; k++) normal[k] /= length || 1;
      }
      edgeCache.set(key, index);
      return index;
    }
    function clip(poly, y, up) {
      if (!Number.isFinite(y)) return poly;
      const out = [];
      for (let j = 0; j < poly.length; j++) {
        const a = poly[j],
          b = poly[(j + 1) % poly.length];
        const insideA = up ? arrays.POSITION[a][1] >= y : arrays.POSITION[a][1] <= y;
        const insideB = up ? arrays.POSITION[b][1] >= y : arrays.POSITION[b][1] <= y;
        if (insideA) out.push(a);
        if (insideA !== insideB) out.push(intersect(a, b, y));
      }
      return out;
    }
    specs.forEach(([name, min, max], section) => {
      const result = [];
      for (let i = 0; i < indices.length; i += 3) {
        let poly = clip(indices.slice(i, i + 3), min, true);
        if (poly.length) poly = clip(poly, max, false);
        for (let j = 1; j < poly.length - 1; j++) result.push(poly[0], poly[j], poly[j + 1]);
        for (const cut of [min, max].filter(Number.isFinite)) {
          const on = poly.filter((index) => Math.abs(arrays.POSITION[index][1] - cut) < 1e-6);
          if (on.length > 1)
            cuts[section].set(cut, [
              ...(cuts[section].get(cut) ?? []),
              ...on.map((i) => arrays.POSITION[i]),
            ]);
        }
      }
      if (result.length)
        outputs[section].push({
          ...primitive,
          indices: appendAccessor(
            result.map((i) => [i]),
            'SCALAR',
            5125,
          ),
        });
    });
    for (const [key, index] of Object.entries(primitive.attributes))
      appendAccessor(arrays[key], doc.accessors[index].type, 5126, index);
  }
  const sourceCaps = doc.meshes[capNode.mesh].primitives.map((p) => ({
    p,
    arrays: Object.fromEntries(Object.entries(p.attributes).map(([k, a]) => [k, readAccessor(a)])),
    indices: readAccessor(p.indices).flat(),
  }));
  specs.forEach(([name, min, max, parentRegion], section) => {
    const meshName = `region_${name}_mesh`,
      capName = `region_${name}_cap`;
    const capPos = [],
      capNorm = [],
      capUV = [],
      capIndices = [];
    // Retain the original authored closures which belong to this section.
    for (const { arrays, indices } of sourceCaps)
      for (let i = 0; i < indices.length; i += 3) {
        const tri = indices.slice(i, i + 3),
          y = tri.reduce((s, j) => s + arrays.POSITION[j][1], 0) / 3;
        if (y < min || y > max) continue;
        for (const j of tri) {
          capIndices.push(capPos.length);
          capPos.push(arrays.POSITION[j]);
          capNorm.push(arrays.NORMAL[j]);
          capUV.push(arrays.TEXCOORD_0[j]);
        }
      }
    for (const [y, points] of cuts[section]) {
      const ring = hull(points);
      if (!ring.length) continue;
      const center = [
        ring.reduce((s, v) => s + v[0], 0) / ring.length,
        y,
        ring.reduce((s, v) => s + v[2], 0) / ring.length,
      ];
      const normal = [0, y === min ? -1 : 1, 0],
        start = capPos.length;
      capPos.push(center);
      capNorm.push(normal);
      capUV.push([0.5, 0.5]);
      const sx = Math.max(...ring.map((p) => Math.abs(p[0] - center[0]))),
        sz = Math.max(...ring.map((p) => Math.abs(p[2] - center[2])));
      for (const p of ring) {
        capPos.push(p);
        capNorm.push(normal);
        capUV.push([
          0.5 + (0.48 * (p[0] - center[0])) / (sx || 1),
          0.5 + (0.48 * (p[2] - center[2])) / (sz || 1),
        ]);
      }
      for (let i = 0; i < ring.length; i++) {
        const tri = [start, start + 1 + i, start + 1 + ((i + 1) % ring.length)];
        if (normal[1] > 0) tri.reverse();
        capIndices.push(...tri);
      }
    }
    if (!capIndices.length) throw Error(`No authored closure for ${name}`);
    const mesh = doc.meshes.push({ name: meshName, primitives: outputs[section] }) - 1;
    const cap =
      doc.meshes.push({
        name: capName,
        primitives: [
          {
            attributes: {
              POSITION: appendAccessor(capPos, 'VEC3'),
              NORMAL: appendAccessor(capNorm, 'VEC3'),
              TEXCOORD_0: appendAccessor(capUV, 'VEC2'),
            },
            indices: appendAccessor(
              capIndices.map((i) => [i]),
              'SCALAR',
              5125,
            ),
            material: 2,
          },
        ],
      }) - 1;
    parent.children.push(
      doc.nodes.push({ name: meshName, mesh }) - 1,
      doc.nodes.push({ name: capName, mesh: cap }) - 1,
    );
    regions[name] = {
      mesh: meshName,
      cap: capName,
      parent: parentRegion,
      aggregate: aggregates[sourceName],
    };
  });
}
// Keep the source skin, eyes and fine PBR fabric detail, while making exposed
// garments military uniforms instead of the r1 white shirt / blue workwear.
// glTF COLOR_0 is core PBR data, usable in both runtime and external Studio.
const garmentColors = new Map();
for (const mesh of doc.meshes) {
  let category = /^base\./.test(mesh.name)
    ? 'live'
    : /damage_.*_body_data/.test(mesh.name)
      ? mesh.name
      : null;
  if (!category) continue;
  for (const primitive of mesh.primitives) {
    if (primitive.material !== 1) continue;
    const position = primitive.attributes.POSITION;
    if (garmentColors.has(position)) continue;
    const colors = readAccessor(position).map(([x, y, z]) => {
      let garment = null;
      if (category === 'live') {
        // The source overalls extend through the torso, not only the legs.
        if (y > 0.015 && y < 1.54 && Math.abs(x) < 0.3) garment = 'pants';
        else if (y >= 0.93 && y < 1.54 && Math.abs(x) < 0.44) garment = 'shirt';
      } else if (category.includes('_leg_')) garment = 'pants';
      else if (category.includes('_torso_')) garment = 'pants';
      else if (category.includes('_arm_') && y > -0.29) garment = 'shirt';
      if (!garment) return [1, 1, 1, 1];
      const pattern = Math.sin(x * 71 + z * 43) * Math.sin(y * 59 - z * 31) > 0.18 ? 0.8 : 1;
      return [
        ...(garment === 'pants' ? [0.8, 0.5, 0.085] : [0.35, 0.44, 0.22]).map((c) => c * pattern),
        1,
      ];
    });
    garmentColors.set(position, appendAccessor(colors, 'VEC4'));
  }
}
for (const mesh of doc.meshes)
  for (const primitive of mesh.primitives)
    if (garmentColors.has(primitive.attributes.POSITION))
      primitive.attributes.COLOR_0 = garmentColors.get(primitive.attributes.POSITION);
const pad = (4 - (binaryLength % 4)) % 4;
if (pad) {
  chunks.push(Buffer.alloc(pad));
  binaryLength += pad;
}
doc.buffers[0].byteLength = binaryLength;
doc.asset.generator += '; FPV connected military damage r2';
const json = Buffer.from(JSON.stringify(doc)),
  jsonPad = (4 - (json.length % 4)) % 4,
  encoded = Buffer.concat([json, Buffer.alloc(jsonPad, 32)]),
  binary = Buffer.concat(chunks),
  header = Buffer.alloc(20),
  bh = Buffer.alloc(8);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + encoded.length + binary.length, 8);
header.writeUInt32LE(encoded.length, 12);
header.writeUInt32LE(0x4e4f534a, 16);
bh.writeUInt32LE(binary.length, 0);
bh.writeUInt32LE(0x004e4942, 4);
const release = Buffer.concat([header, encoded, bh, binary]);
const manifest = JSON.parse(await fs.readFile(path.join(source, 'manifest.json'), 'utf8'));
manifest.format = 'FPVCombatAppearance.v2';
manifest.revision = 'r2';
manifest.title = 'Military wardrobe — connected damage regions';
manifest.regionSets = { 'military-body-v2': regions };
manifest.files = [{ path: 'characters.glb', bytes: release.length, sha256: sha(release) }];
manifest.license.modifications +=
  ' Revision r2 reuses the immutable r1 body, animation, textures and military wardrobe; anatomically repartitions rigid remains into twelve connected regions with plane-matched cut surfaces. Core vertex colors turn exposed source workwear into olive field uniforms while preserving skin and texture detail. It does not duplicate live rigs or body geometry.';
for (const character of manifest.characters) {
  character.regionSet = 'military-body-v2';
  for (const item of character.equipment ?? []) {
    item.damageRegion =
      item.region === 'head'
        ? 'head'
        : item.region === 'torso'
          ? 'chest'
          : item.region === 'leftLeg'
            ? 'leftThigh'
            : item.region === 'rightLeg'
              ? 'rightThigh'
              : item.region === 'leftArm'
                ? item.root.includes('lowerarm')
                  ? 'leftForearm'
                  : 'leftUpperArm'
                : item.root.includes('lowerarm')
                  ? 'rightForearm'
                  : 'rightUpperArm';
  }
}
const manifestBytes = Buffer.from(JSON.stringify(manifest) + '\n');
await fs.writeFile(path.join(base, 'characters.glb'), release);
await fs.writeFile(path.join(base, 'manifest.json'), manifestBytes);
const predecessor = JSON.parse(await fs.readFile(path.join(source, 'provenance.json'), 'utf8'));
const builder = await fs.readFile(fileURLToPath(import.meta.url));
const provenance = {
  ...predecessor,
  revision: 'r2',
  predecessor: { revision: 'r1', file: 'characters.glb', sha256: sha(original) },
  modifications:
    'Twelve connected, geometrically clipped rigid regions and matched caps. Live meshes, PBR textures and animation reuse r1 resources. No gameplay changes.',
  builders: [{ path: 'authoring/repartition.mjs', bytes: builder.length, sha256: sha(builder) }],
  release: {
    files: [
      { path: 'characters.glb', bytes: release.length, sha256: sha(release) },
      { path: 'manifest.json', bytes: manifestBytes.length, sha256: sha(manifestBytes) },
    ],
  },
};
await fs.writeFile(path.join(base, 'provenance.json'), JSON.stringify(provenance, null, 2) + '\n');
console.log(
  JSON.stringify(
    {
      manifestSHA256: sha(manifestBytes),
      downloadBytes: manifestBytes.length + release.length,
      regions: Object.keys(regions),
      vertices: [
        ...new Set(doc.meshes.flatMap((m) => m.primitives.map((p) => p.attributes.POSITION))),
      ].reduce((n, a) => n + doc.accessors[a].count, 0),
    },
    null,
    2,
  ),
);
