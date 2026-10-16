/** Explicit derived material review; original intake models are never modified. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import * as THREE from '../../../../optional-practice/civilian-fpv/vendor/three.module.js';
import { compileRgbaSceneryCell } from '../rgba-scenery-cell.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)),
  output = path.resolve(process.argv[2]),
  python = process.argv[3] || 'python3';
await fs.mkdir(output, { recursive: false });
const visualFoliageMaterials = {
  'beach-grass': ['BeachGrass01'],
  'young-bamboo': ['YoungBamboo_01'],
  palm: ['DriPalm02', 'Palm05_Old', 'Palm05_png'],
};
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS),
  report = [];
const ids =
  process.argv[4] === 'all'
    ? [
        'beach-grass',
        'young-bamboo',
        'crate',
        'covered-jetty',
        'open-jetty',
        'jungle-hut',
        'beach-rock',
        'palm',
      ]
    : ['palm', 'covered-jetty'];
if (process.argv[4] && process.argv[4] !== 'all')
  throw Error('Only the explicit all-model intake selection is supported');
for (const id of ids) {
  const input = await fs.readFile(path.join(here, 'intake-v1/models', id + '.glb')),
    doc = await io.readBinary(input),
    textureList = doc.getRoot().listTextures();
  if (textureList.length < 1 || textureList.length > 4)
    throw Error('Unsupported review texture count');
  const dimension = 128,
    textures = [],
    raw = [];
  for (let i = 0; i < textureList.length; i++) {
    const texture = textureList[i],
      image = texture.getImage(),
      base = path.join(output, `${id}-texture-${i}`);
    await fs.writeFile(base + '.source', image);
    const py = spawnSync(
      python,
      [
        '-c',
        `from PIL import Image\nimport json,sys\nim=Image.open(sys.argv[1]); size=im.size; im=im.convert('RGBA'); im=im.resize((int(sys.argv[3]),int(sys.argv[3])),Image.Resampling.LANCZOS); open(sys.argv[2],'wb').write(im.tobytes()); print(json.dumps({'sourceDimensions':size,'derivedDimensions':im.size,'resample':'Pillow LANCZOS'}))`,
        base + '.source',
        base + '.rgba',
        String(dimension),
      ],
      { encoding: 'utf8' },
    );
    if (py.status !== 0) throw Error(py.stderr);
    const rgba = await fs.readFile(base + '.rgba');
    textures.push({
      id: `texture-${i}`,
      width: dimension,
      height: dimension,
      rgbaBase64: rgba.toString('base64'),
      magFilter: 9729,
      minFilter: 9987,
      wrapS: 10497,
      wrapT: 10497,
    });
    raw.push({
      ...JSON.parse(py.stdout),
      sourceSha256: crypto.createHash('sha256').update(image).digest('hex'),
      rgbaSha256: crypto.createHash('sha256').update(rgba).digest('hex'),
    });
  }
  const geometry = [],
    bounds = new THREE.Box3();
  let inputTriangles = 0;
  for (const node of doc.getRoot().listNodes())
    for (const primitive of node.getMesh()?.listPrimitives() || []) {
      const matrix = new THREE.Matrix4().fromArray(node.getWorldMatrix()),
        normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix),
        position = primitive.getAttribute('POSITION'),
        normal = primitive.getAttribute('NORMAL'),
        uv = primitive.getAttribute('TEXCOORD_0'),
        color = primitive.getAttribute('COLOR_0'),
        points = [],
        normals = [],
        uvs = [],
        colors = [];
      const element = [];
      for (let i = 0; i < position.getCount(); i++) {
        position.getElement(i, element);
        const p = new THREE.Vector3(...element).applyMatrix4(matrix);
        points.push(p);
        bounds.expandByPoint(p);
        normal.getElement(i, element);
        normals.push(
          ...new THREE.Vector3(...element).applyMatrix3(normalMatrix).normalize().toArray(),
        );
        uv.getElement(i, element);
        uvs.push(element[0], element[1]);
        if (color) {
          color.getElement(i, element);
          colors.push(
            element[0],
            element[1],
            element[2],
            color.getType() === 'VEC4' ? element[3] : 1,
          );
        }
      }
      const indices = Array.from(
        primitive.getIndices()?.getArray() ||
          Array.from({ length: position.getCount() }, (_, i) => i),
      );
      inputTriangles += indices.length / 3;
      geometry.push({ primitive, points, normals, uvs, colors, indices });
    }
  const center = bounds.getCenter(new THREE.Vector3()),
    surfaces = [],
    bindings = [];
  let omittedDegenerateTriangles = 0;
  for (const [i, g] of geometry.entries()) {
    let positionsMm = g.points.flatMap((p) => [
        Math.round((p.x - center.x + 64) * 1000),
        Math.round((p.y - bounds.min.y) * 1000),
        Math.round((p.z - center.z + 64) * 1000),
      ]),
      indices = [];
    for (let j = 0; j < g.indices.length; j += 3) {
      const [a, b, c] = g.indices
        .slice(j, j + 3)
        .map((ix) => new THREE.Vector3(...positionsMm.slice(ix * 3, ix * 3 + 3)));
      if (
        new THREE.Vector3()
          .subVectors(b, a)
          .cross(new THREE.Vector3().subVectors(c, a))
          .lengthSq() === 0
      ) {
        omittedDegenerateTriangles++;
        continue;
      }
      indices.push(...g.indices.slice(j, j + 3));
    }
    if (!indices.length) continue;
    // Exact tuple welding for world assembly preserves UV seams, hard normals and tints.
    // The original two-model comparison stays byte-identical without the explicit all flag.
    if (process.argv[4] === 'all') {
      const unique = new Map(),
        compact = { positions: [], normals: [], uvs: [], colors: [] },
        remapped = [];
      for (const vertex of indices) {
        const position = positionsMm.slice(vertex * 3, vertex * 3 + 3),
          normal = g.normals.slice(vertex * 3, vertex * 3 + 3),
          uv = g.uvs.slice(vertex * 2, vertex * 2 + 2),
          color = g.colors.length ? g.colors.slice(vertex * 4, vertex * 4 + 4) : [];
        const key = JSON.stringify([position, normal, uv, color]);
        if (!unique.has(key)) {
          unique.set(key, compact.positions.length / 3);
          compact.positions.push(...position);
          compact.normals.push(...normal);
          compact.uvs.push(...uv);
          compact.colors.push(...color);
        }
        remapped.push(unique.get(key));
      }
      positionsMm = compact.positions;
      indices = remapped;
      g.normals = compact.normals;
      g.uvs = compact.uvs;
      g.colors = compact.colors;
    }
    const material = g.primitive.getMaterial(),
      textureId = textureList.indexOf(material.getBaseColorTexture());
    if (textureId < 0) throw Error('Review requires authored base-colour texture');
    const alphaMode = material.getAlphaMode();
    if (!['OPAQUE', 'MASK'].includes(alphaMode)) throw Error('Unsupported review alpha mode');
    const surfaceId = 'surface-' + i;
    surfaces.push({
      id: surfaceId,
      positionsMm,
      indices,
      color: material.getBaseColorFactor().slice(0, 3),
    });
    bindings.push({
      surfaceId,
      textureId: `texture-${textureId}`,
      uvs: g.uvs,
      normals: g.normals,
      colors: g.colors,
      alphaMode,
      alphaCutoff: alphaMode === 'MASK' ? material.getAlphaCutoff() : 0,
      doubleSided: material.getDoubleSided(),
      collision: visualFoliageMaterials[id]?.includes(material.getName()) ? 'visual-only' : 'solid',
    });
  }
  const source = {
    format: 'FPVRegionRgbaScenery.v1',
    cell: {
      format: 'FPVRegionScenery.v1',
      chunkId: id,
      x: 0,
      z: 0,
      cellSizeMm: 128000,
      surfaces,
    },
    textures,
    bindings,
  };
  const compiled = compileRgbaSceneryCell(source),
    sourceBytes = Buffer.from(JSON.stringify(source));
  await fs.writeFile(path.join(output, id + '.json'), sourceBytes);
  await fs.writeFile(path.join(output, id + '.glb'), compiled.glb);
  report.push({
    id,
    inputSha256: crypto.createHash('sha256').update(input).digest('hex'),
    sourceBytes: sourceBytes.length,
    sourceSha256: crypto.createHash('sha256').update(sourceBytes).digest('hex'),
    glbBytes: compiled.glb.length,
    glbSha256: crypto.createHash('sha256').update(compiled.glb).digest('hex'),
    inputTriangles,
    outputVertices: surfaces.reduce((n, s) => n + s.positionsMm.length / 3, 0),
    exactAttributeWelding: process.argv[4] === 'all',
    omittedDegenerateTriangles,
    compiledTriangles: surfaces.reduce((n, s) => n + s.indices.length / 3, 0),
    solidSurfaces: bindings.filter((b) => b.collision === 'solid').length,
    visualOnlySurfaces: bindings.filter((b) => b.collision === 'visual-only').length,
    derivation:
      'Centre x/z at 64m; ground at source minY; round geometry to millimetres; authoring LANCZOS downsample; Only named foliage materials are explicitly visual-only; trunks and structural materials (including cutout thatch/canvas/planks) remain solid.',
    textures: raw,
  });
}
await fs.writeFile(path.join(output, 'receipt.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
