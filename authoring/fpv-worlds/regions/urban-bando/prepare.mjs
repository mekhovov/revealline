import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO, getBounds } from '@gltf-transform/core';
import { mergeDocuments, unpartition, prune } from '@gltf-transform/functions';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import validator from 'gltf-validator';
import RAPIER from '../../../../optional-practice/civilian-fpv/vendor/rapier/rapier.mjs';
import { boxes, props, districts, probes, landmarks, sizeM } from './layout.mjs';
const output = process.argv[2];
assert(
  output,
  'Provide a new external output directory; existing directories are not overwritten.',
);
await mkdir(output, { recursive: false });
const source = new URL('../../assets/kenney/city-industrial/', import.meta.url);
const sourceReceipt = JSON.parse(await readFile(new URL('provenance.json', source), 'utf8'));
const sha = (data) => createHash('sha256').update(data).digest('hex');
for (const name of ['License.txt', 'Textures/colormap.png']) {
  const pin = sourceReceipt.files.find((file) => file.path === name);
  assert.equal(
    sha(await readFile(new URL(name, source))),
    pin.sha256,
    'Source dependency must match provenance',
  );
}
const document = new Document(),
  buffer = document.createBuffer(),
  scene = document.createScene('urban-bando-study');
document.getRoot().setDefaultScene(scene);
const colours = {
  concrete: [0.57, 0.56, 0.51, 1],
  brick: [0.43, 0.23, 0.15, 1],
  steel: [0.18, 0.26, 0.29, 1],
  roof: [0.25, 0.29, 0.31, 1],
  ground: [0.25, 0.28, 0.24, 1],
};
const materials = Object.fromEntries(
  Object.entries(colours).map(([name, rgba]) => [
    name,
    document
      .createMaterial(name)
      .setBaseColorFactor(rgba)
      .setMetallicFactor(0)
      .setRoughnessFactor(0.9)
      .setDoubleSided(true),
  ]),
);
const positions = [],
  normals = [],
  indices = [];
for (const [normal, corners] of [
  [
    [1, 0, 0],
    [
      [0.5, -0.5, -0.5],
      [0.5, 0.5, -0.5],
      [0.5, 0.5, 0.5],
      [0.5, -0.5, 0.5],
    ],
  ],
  [
    [-1, 0, 0],
    [
      [-0.5, -0.5, 0.5],
      [-0.5, 0.5, 0.5],
      [-0.5, 0.5, -0.5],
      [-0.5, -0.5, -0.5],
    ],
  ],
  [
    [0, 1, 0],
    [
      [-0.5, 0.5, -0.5],
      [-0.5, 0.5, 0.5],
      [0.5, 0.5, 0.5],
      [0.5, 0.5, -0.5],
    ],
  ],
  [
    [0, -1, 0],
    [
      [-0.5, -0.5, 0.5],
      [-0.5, -0.5, -0.5],
      [0.5, -0.5, -0.5],
      [0.5, -0.5, 0.5],
    ],
  ],
  [
    [0, 0, 1],
    [
      [-0.5, -0.5, 0.5],
      [0.5, -0.5, 0.5],
      [0.5, 0.5, 0.5],
      [-0.5, 0.5, 0.5],
    ],
  ],
  [
    [0, 0, -1],
    [
      [0.5, -0.5, -0.5],
      [-0.5, -0.5, -0.5],
      [-0.5, 0.5, -0.5],
      [0.5, 0.5, -0.5],
    ],
  ],
]) {
  const offset = positions.length / 3;
  positions.push(...corners.flat());
  normals.push(...Array(4).fill(normal).flat());
  indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
}
const accessor = (name, type, array) =>
  document.createAccessor(name).setType(type).setArray(array).setBuffer(buffer);
const position = accessor('box-position', 'VEC3', new Float32Array(positions));
const normal = accessor('box-normal', 'VEC3', new Float32Array(normals));
const index = accessor('box-index', 'SCALAR', new Uint16Array(indices));
const meshes = Object.fromEntries(
  Object.entries(materials).map(([name, material]) => [
    name,
    document
      .createMesh(name)
      .addPrimitive(
        document
          .createPrimitive()
          .setAttribute('POSITION', position)
          .setAttribute('NORMAL', normal)
          .setIndices(index)
          .setMaterial(material),
      ),
  ]),
);
for (const box of boxes) {
  const node = document
    .createNode(box.id)
    .setMesh(meshes[box.material])
    .setTranslation(box.centre)
    .setScale(box.size);
  if (box.rotation) {
    const a = box.rotation[0] / 2;
    node.setRotation([Math.sin(a), 0, 0, Math.cos(a)]);
  }
  scene.addChild(node);
}
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS),
  placedSources = [];
for (const prop of props) {
  const url = new URL(prop.model, source),
    bytes = await readFile(url);
  const pinned = sourceReceipt.files.find((file) => file.path === prop.model);
  assert.equal(sha(bytes), pinned.sha256, 'Source model must match licensed provenance');
  const original = await io.read(fileURLToPath(url)),
    originalScene = original.getRoot().getDefaultScene() ?? original.getRoot().listScenes()[0];
  const bounds = getBounds(originalScene),
    scale = prop.height
      ? prop.height / (bounds.max[1] - bounds.min[1])
      : prop.width / Math.max(bounds.max[0] - bounds.min[0], bounds.max[2] - bounds.min[2]);
  const map = mergeDocuments(document, original),
    angle = (prop.yaw * Math.PI) / 180;
  const holder = document
    .createNode(prop.id)
    .setTranslation([prop.x, 0, prop.z])
    .setRotation([0, Math.sin(angle / 2), 0, Math.cos(angle / 2)])
    .setScale([scale, scale, scale]);
  const centre = document
    .createNode(prop.id + '-origin')
    .setTranslation([
      -(bounds.min[0] + bounds.max[0]) / 2,
      -bounds.min[1],
      -(bounds.min[2] + bounds.max[2]) / 2,
    ]);
  for (const child of originalScene.listChildren()) centre.addChild(map.get(child));
  map.get(originalScene).dispose();
  holder.addChild(centre);
  scene.addChild(holder);
  placedSources.push({ ...prop, scale, sourceSHA256: pinned.sha256 });
}
await document.transform(unpartition(), prune());
// Derive collision from the serialized scene, including GLB transform rounding.
const glb = await io.writeBinary(document);
const serialized = await io.readBinary(glb);
// Each collider uses exact transformed visible mesh vertices; no per-building bounding boxes.
const surfaces = [];
serialized
  .getRoot()
  .getDefaultScene()
  .traverse((node) => {
    if (!node.getMesh()) return;
    const matrix = node.getWorldMatrix();
    for (const primitive of node.getMesh().listPrimitives()) {
      assert.equal(primitive.getMode(), 4);
      const attr = primitive.getAttribute('POSITION'),
        vertices = [];
      for (let i = 0; i < attr.getCount(); i++) {
        const v = attr.getElement(i, []);
        for (let k = 0; k < 3; k++)
          vertices.push(
            Math.fround(
              matrix[k] * v[0] + matrix[4 + k] * v[1] + matrix[8 + k] * v[2] + matrix[12 + k],
            ),
          );
      }
      const triangles = Array.from(
        primitive.getIndices()?.getArray() ?? Array.from({ length: attr.getCount() }, (_, i) => i),
      );
      surfaces.push({
        id: `surface-${surfaces.length}`,
        node: node.getName(),
        vertices,
        indices: triangles,
      });
    }
  });
const validation = await validator.validateBytes(glb, { maxIssues: 100 });
assert.equal(validation.issues.numErrors, 0);
await RAPIER.init();
const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
for (const surface of surfaces)
  world.createCollider(
    RAPIER.ColliderDesc.trimesh(
      new Float32Array(surface.vertices),
      new Uint32Array(surface.indices),
    ),
  );
world.step();
const checks = [];
try {
  for (const probe of probes) {
    const from = { x: probe.from[0], y: probe.from[1], z: probe.from[2] },
      delta = {
        x: probe.to[0] - probe.from[0],
        y: probe.to[1] - probe.from[1],
        z: probe.to[2] - probe.from[2],
      };
    const hit = world.castShape(
      from,
      { x: 0, y: 0, z: 0, w: 1 },
      delta,
      new RAPIER.Ball(0.25),
      0,
      1,
      true,
    );
    assert.equal(
      !hit,
      probe.clear,
      probe.id + ' expected ' + (probe.clear ? 'clear opening' : 'solid surface'),
    );
    checks.push({ id: probe.id, clear: !hit, passed: true });
  }
} finally {
  world.free();
}
const metadata = {
  format: 'FPVUrbanBandoStudy.v1',
  extentM: [sizeM, sizeM],
  targetExtentM: [4096, 4096],
  districts,
  landmarks,
  probes,
  placedSources,
  scene: 'architecture.glb',
  collision: 'architecture-collision.json',
  flightReady: false,
};
await writeFile(resolve(output, 'architecture.glb'), glb);
await writeFile(
  resolve(output, 'architecture-collision.json'),
  JSON.stringify({ format: 'FPVAuthoringMeshCollision.v1', units: 'metres', surfaces }),
);
const receipt = {
  format: 'FPVUrbanBandoPreparation.v1',
  extentM: [sizeM, sizeM],
  targetExtentM: [4096, 4096],
  authoredSolids: boxes.length,
  licensedProps: props.length,
  surfaces: surfaces.length,
  triangles: surfaces.reduce((n, s) => n + s.indices.length / 3, 0),
  sceneBytes: glb.length,
  sceneSHA256: sha(glb),
  glTFErrors: validation.issues.numErrors,
  glTFWarnings: validation.issues.numWarnings,
  checks,
  flightReady: false,
  limitations: [
    'Authoring-only original architecture and selected CC0 props',
    'Regional terrain profile does not yet admit this scenery collision format',
    'Representative 500 mm sphere sweeps, not exhaustive or flight qualification',
    'No player package, default catalogue, scored objectives, recordings or long-session performance qualification',
  ],
};
for (const [name, data] of [
  ['design.json', metadata],
  ['preparation.json', receipt],
])
  await writeFile(resolve(output, name), JSON.stringify(data, null, 2) + '\n');
const vendor = new URL('../../../../optional-practice/civilian-fpv/vendor/', import.meta.url);
for (const name of [
  'three.module.js',
  'three.core.js',
  'LICENSE.txt',
  'addons/loaders/GLTFLoader.js',
  'addons/utils/BufferGeometryUtils.js',
  'addons/utils/SkeletonUtils.js',
]) {
  const target = resolve(output, 'preview', name);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(new URL(name, vendor), target);
}
await writeFile(
  resolve(output, 'overview.html'),
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Urban Bando architecture study</title><style>body{margin:0;background:#121b24;color:#f3eee0;font:16px system-ui}header{padding:14px}button{font:inherit;padding:10px;margin:4px;background:#223441;color:#f3eee0;border:1px solid #81939d}canvas{display:block;width:100%;height:75vh}p{margin:8px}</style><header><b>Urban Bando ·384 ×384 m architecture study</b><p>Original open mill, warehouse, parking decks, viaduct and licensed CC0 industrial props. Authoring preview only.</p><nav></nav><p id="status">Loading exact prepared geometry…</p></header><canvas></canvas><script type="importmap">{"imports":{"three":"./preview/three.module.js"}}</script><script type="module">import * as T from './preview/three.module.js';import {GLTFLoader} from './preview/addons/loaders/GLTFLoader.js';const r=new T.WebGLRenderer({canvas:document.querySelector('canvas'),antialias:true});r.setPixelRatio(Math.min(devicePixelRatio,1.5));const s=new T.Scene();s.background=new T.Color('#bfd0d4');const c=new T.PerspectiveCamera(55,1,.1,1400);s.add(new T.HemisphereLight(0xc7e7fa,0x6c5845,2));const l=new T.DirectionalLight(0xffe9c3,2);l.position.set(100,300,80);s.add(l);const views=[['Overview',[460,320,480],[192,0,192]],['Mill atrium',[64,34,112],[64,9,64]],['Warehouse doors',[190,5,5],[190,5,75]],['Parking decks',[10,8,205],[64,8,260]],['Viaduct',[174,5,220],[174,5,270]],['Tower court',[270,28,220],[320,15,260]]];function draw(){const q=r.domElement.getBoundingClientRect();r.setSize(q.width,q.height,false);c.aspect=q.width/q.height;c.updateProjectionMatrix();r.render(s,c)}function view(v){c.position.fromArray(v[1]);c.lookAt(...v[2]);draw()}for(const v of views){const b=document.createElement('button');b.textContent=v[0];b.onclick=()=>view(v);document.querySelector('nav').append(b)}new GLTFLoader().load('./architecture.glb',g=>{s.add(g.scene);document.querySelector('#status').textContent='Exact mesh loaded · ${checks.length} opening/solid sphere sweeps passed · no flight runtime';view(views[0])},undefined,e=>{document.querySelector('#status').textContent=String(e)});addEventListener('resize',draw);</script>`,
);
console.log(JSON.stringify(receipt, null, 2));
