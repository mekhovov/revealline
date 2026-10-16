// Bounded, offline content preparation. Never changes flight physics or browser imports.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  mergeDocuments,
  dedup,
  prune,
  unpartition,
  weld,
  simplify,
} from '@gltf-transform/functions';
import validator from 'gltf-validator';
import { MeshoptSimplifier } from 'meshoptimizer';
await MeshoptSimplifier.ready;
import { layouts } from './source/layouts.mjs';
import {
  inspectImport,
  projectFromImport,
  preparePack,
  inspectPack,
  canonicalWorldJSON,
} from '../../../optional-practice/civilian-fpv/world-content.mjs';
import {
  courseFromProject,
  synchronizeDefinitions,
} from '../../../optional-practice/civilian-fpv/world-app.mjs';
import { validateWorldCourse } from '../../../optional-practice/civilian-fpv/world-model.mjs';
import {
  exportEditableZip,
  importEditableZip,
} from '../../../optional-practice/civilian-fpv/world-zip.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const [sourceRoot, catalogFile, selection] = process.argv.slice(2);
if (!sourceRoot || !catalogFile) throw Error('Use SOURCE_ROOT DOWNLOAD_RECEIPT_JSON [WORLD_ID]');
const sources = JSON.parse(await fs.readFile(catalogFile));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const assert = (v, m) => {
  if (!v) throw Error(m);
};
const xyz = (a) => Object.fromEntries(['x', 'y', 'z'].map((k, i) => [k, Math.round(a[i] * 1000)]));
const hold = (p, land = false) => ({
  type: land ? 'land' : 'hold',
  min: xyz(p.map((v, i) => v - (i === 1 ? (land ? 0 : 1) : 2))),
  max: xyz(p.map((v, i) => v + (i === 1 ? (land ? 0.8 : 1) : 2))),
  ticks: 30,
  maxSpeed: land ? 900 : 1800,
  maxTilt: 3000,
  minTilt: 0,
  centred: false,
  heading: null,
  ...(land ? { surface: '$floor' } : {}),
});

function collision(scene, architectural = false) {
  const obstacles = [];
  scene.traverse((node) => {
    if (!node.getMesh() || node.getName() === 'practice-ground') return;
    const m = node.getWorldMatrix();
    if (
      architectural &&
      !/Ground|Road|Building|Fassade|Crane|Stair|Ramp|Fence/i.test(node.getName())
    ) {
      const b = getBounds(node),
        min = xyz(b.min),
        max = xyz(b.max);
      if (['x', 'y', 'z'].every((k) => max[k] > min[k]))
        obstacles.push({ id: 'surface-' + String(obstacles.length).padStart(3, '0'), min, max });
      return;
    }
    for (const primitive of node.getMesh().listPrimitives()) {
      const position = primitive.getAttribute('POSITION');
      assert(primitive.getMode() === 4, 'Only triangle surfaces supported');
      const vertices = [],
        remap = [],
        unique = new Map();
      for (let i = 0; i < position.getCount(); i++) {
        const v = position.getElement(i, []);
        const point = [0, 1, 2].map((k) =>
          Math.round(1000 * (m[k] * v[0] + m[4 + k] * v[1] + m[8 + k] * v[2] + m[12 + k])),
        );
        const key = point.join();
        if (!unique.has(key)) {
          unique.set(key, vertices.length / 3);
          vertices.push(...point);
        }
        remap.push(unique.get(key));
      }
      const raw = Array.from(
          primitive.getIndices()?.getArray() ??
            Array.from({ length: position.getCount() }, (_, i) => i),
          (i) => remap[i],
        ),
        indices = [];
      for (let i = 0; i < raw.length; i += 3) {
        const p = [raw[i], raw[i + 1], raw[i + 2]].map((j) => vertices.slice(j * 3, j * 3 + 3));
        const a = p[1].map((v, k) => v - p[0][k]),
          b = p[2].map((v, k) => v - p[0][k]);
        if (
          a[1] * b[2] !== a[2] * b[1] ||
          a[2] * b[0] !== a[0] * b[2] ||
          a[0] * b[1] !== a[1] * b[0]
        )
          indices.push(raw[i], raw[i + 1], raw[i + 2]);
      }
      if (indices.length)
        obstacles.push({
          id: 'surface-' + String(obstacles.length).padStart(3, '0'),
          type: 'trimesh',
          vertices,
          indices,
        });
    }
  });
  return obstacles;
}
function ground(doc, scene, color) {
  const buffer = doc.getRoot().listBuffers()[0] ?? doc.createBuffer();
  const attr = (type, array) =>
    doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const mat = doc
    .createMaterial('Practice ground')
    .setBaseColorFactor([...color, 1])
    .setRoughnessFactor(0.95)
    .setMetallicFactor(0);
  const primitive = doc
    .createPrimitive()
    .setAttribute(
      'POSITION',
      attr('VEC3', new Float32Array([-85, 0, -85, 85, 0, -85, 85, 0, 85, -85, 0, 85])),
    )
    .setAttribute('NORMAL', attr('VEC3', new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0])))
    .setIndices(attr('SCALAR', new Uint16Array([0, 2, 1, 0, 3, 2])))
    .setMaterial(mat);
  scene.addChild(
    doc
      .createNode('practice-ground')
      .setMesh(doc.createMesh('practice-ground').addPrimitive(primitive)),
  );
}
const candidates = [
  ...layouts,
  {
    kit: 'construction',
    id: 'cc0-construction-site',
    title: ['House Construction Site', 'Будівельний майданчик'],
    scene: 'construction/construction.glb',
    ground: [0.3, 0.32, 0.27],
    placements: [],
  },
];
for (const spec of candidates.filter((s) => !selection || s.id === selection)) {
  const source = sources.find((r) => r.id === spec.kit);
  assert(
    source?.cc0 && !source.error && Object.values(source.licenses).some((s) => s.includes('CC0')),
    'Archive license required',
  );
  const document = spec.scene ? await io.read(path.join(sourceRoot, spec.scene)) : new Document(),
    scene = document.getRoot().getDefaultScene() ?? document.createScene(spec.title[0]);
  document.getRoot().setDefaultScene(scene);
  const provenance = spec.scene
    ? [
        {
          model: spec.scene,
          sha256: sha(await fs.readFile(path.join(sourceRoot, spec.scene))),
          conversion:
            'Blender 4.5.14 built-in glTF, visible static geometry; see source/export-construction.py',
        },
      ]
    : [];
  for (const [index, placement] of spec.placements.entries()) {
    const filename = source.models.find((n) => n.endsWith('/' + placement.model + '.glb'));
    assert(filename, 'Missing model ' + placement.model);
    const full = path.join(sourceRoot, spec.kit, filename),
      original = await io.read(full),
      originalScene = original.getRoot().getDefaultScene() ?? original.getRoot().listScenes()[0];
    for (const animation of original.getRoot().listAnimations()) animation.dispose();
    if (spec.kit.startsWith('modular-'))
      await original.transform(
        weld(),
        simplify({ simplifier: MeshoptSimplifier, ratio: 0.15, error: 0.005, lockBorder: true }),
      );
    const bounds = getBounds(originalScene),
      scale =
        placement.size / Math.max(bounds.max[0] - bounds.min[0], bounds.max[2] - bounds.min[2]),
      mapping = mergeDocuments(document, original);
    const angle = (placement.yaw * Math.PI) / 180;
    const holder = document
      .createNode('placement-' + index)
      .setTranslation([placement.x, placement.y, placement.z])
      .setRotation([0, Math.sin(angle / 2), 0, Math.cos(angle / 2)])
      .setScale([scale, scale, scale]);
    const centered = document
      .createNode('origin-' + index)
      .setTranslation([
        -(bounds.max[0] + bounds.min[0]) / 2,
        -bounds.min[1],
        -(bounds.max[2] + bounds.min[2]) / 2,
      ]);
    for (const child of originalScene.listChildren()) centered.addChild(mapping.get(child));
    mapping.get(originalScene).dispose();
    holder.addChild(centered);
    scene.addChild(holder);
    const bytes = await fs.readFile(full);
    provenance.push({ model: filename, sha256: sha(bytes), placement, scale });
  }
  if (!spec.scene) ground(document, scene, spec.ground);
  scene.addChild(
    document
      .createNode('launch')
      .setTranslation(spec.scene ? [0, 0, 60] : [0, 0, 40])
      .setExtras({ rl: { id: 'launch', kind: 'spawn' } }),
  );
  const obstacles = collision(scene, !!spec.scene);
  if (obstacles.reduce((n, o) => n + (o.indices?.length ?? 0) / 3, 0) > 14000)
    for (const obstacle of obstacles) {
      if (!obstacle.indices) continue;
      const [reduced, error] = MeshoptSimplifier.simplify(
        new Uint32Array(obstacle.indices),
        new Float32Array(obstacle.vertices),
        3,
        Math.min(
          obstacle.indices.length,
          Math.max(12, Math.floor((obstacle.indices.length * 0.08) / 3) * 3),
        ),
        0.001,
        ['LockBorder'],
      );
      const map = new Map(),
        v = [],
        indices = [];
      for (const index of reduced) {
        if (!map.has(index)) {
          map.set(index, v.length / 3);
          v.push(...obstacle.vertices.slice(index * 3, index * 3 + 3));
        }
        indices.push(map.get(index));
      }
      obstacle.vertices = v;
      obstacle.indices = indices;
      console.log('collision reduction', spec.id, obstacle.id, indices.length / 3, error);
    }
  scene.setExtras({
    ...scene.getExtras(),
    fpvGroundVisual: true,
    fpvCollisionVisuals: obstacles.map((o) => o.id),
  });
  await document.transform(dedup(), prune({ keepExtras: true, keepLeaves: true }), unpartition());
  const model = await io.writeBinary(document);
  const checked = await validator.validateBytes(model, {
    uri: spec.id + '.glb',
    writeTimestamp: false,
  });
  assert(checked.issues.numErrors === 0, JSON.stringify(checked.issues));
  const imported = await inspectImport({
    files: { 'world.glb': model },
    entry: 'world.glb',
    id: spec.id,
    title: spec.title[0],
  });
  const project = projectFromImport(imported);
  project.revision = 'r1';
  const course = courseFromProject(project);
  course.obstacles = obstacles;
  course.bounds = { min: xyz([-80, 0, -80]), max: xyz([80, spec.scene ? 90 : 70, 80]) };
  course.world = { id: spec.id, theme: 'academy', style: 'meadow' };
  course.locales = {
    en: {
      title: spec.title[0] + ' · discovery',
      brief:
        'Lift from the marked pad, follow the open central lane, turn above the far marker, then return and land.',
      lesson:
        'A new practice layout made from CC0 models. The visible scenery has collision, including openings. Both flight modes are available. Use the open lane for your first flight, then explore around the buildings and landmarks.',
    },
    uk: {
      title: spec.title[1] + ' · знайомство',
      brief:
        'Злетіть із майданчика, пройдіть вільну центральну смугу, розверніться над дальнім маркером, поверніться та сядьте.',
      lesson:
        'Новий тренувальний майданчик із моделей CC0. Видимі об’єкти мають зіткнення зі збереженням отворів. Доступні обидва режими польоту. Почніть із вільної смуги, потім досліджуйте будівлі та орієнтири.',
    },
  };
  if (spec.locales) {
    for (const language of ['en', 'uk'])
      Object.assign(course.locales[language], spec.locales[language]);
  }
  if (spec.scene) {
    course.locales.en.brief =
      'Lift above the road, circle the construction site via the outer road markers, return and land.';
    course.locales.en.lesson =
      'Majadroid’s CC0 construction site, including open building floors and cranes. Follow the perimeter for your first flight; then practise around the real structure. Main architecture uses triangle collision; small props use conservative boxes. Both flight modes are available.';
    course.locales.uk.brief =
      'Підніміться над дорогою, облетіть майданчик за зовнішніми маркерами, поверніться та сядьте.';
    course.locales.uk.lesson =
      'Будівельний майданчик Majadroid за CC0 з відкритими поверхами й кранами. Почніть із периметра, потім тренуйтеся біля споруди. Основна архітектура має трикутні колізії, дрібні предмети — спрощені об’ємні. Доступні обидва режими польоту.';
  }
  // The route stays in the deliberately open lane; free exploration remains within the same generous bounds.
  const route = spec.scene
    ? [
        hold([0, 6, 60]),
        hold([-58, 6, 60]),
        hold([-58, 6, -58]),
        hold([58, 6, -58]),
        hold([58, 6, 60]),
        hold([0, 6, 60]),
        hold([0, 0, 60], true),
      ]
    : [
        hold([0, 4, 30]),
        hold([0, 5, 16]),
        hold([0, 4, -16]),
        hold([0, 4, -22]),
        hold([0, 5, 16]),
        hold([0, 4, 40]),
        hold([0, 0, 40], true),
      ];
  course.steps = { 'self-level': structuredClone(route), acro: structuredClone(route) };
  project.courses = [validateWorldCourse(course)];
  project.spawnBindings = { [course.id]: 'launch' };
  project.routeBindings = {
    [course.id]: { 'self-level': route.map(() => null), acro: route.map(() => null) },
  };
  project.provenance = [
    {
      asset: project.world.modelAsset,
      author: spec.scene ? 'Majadroid / Maik Hoffmann (palette: Imphenzia)' : 'Kenney',
      license: 'CC0-1.0',
      sourceURL: source.url,
      changes:
        (spec.scene
          ? 'Original assembled scene retained; visible Blender scene exported, small props have conservative box collision. '
          : 'Original practice composition; ') +
        ' uniform scaling, translation, rotation, embedded palette textures, shared resources. Static triangle collision from placed geometry; identical millimetre vertices welded and degenerate triangles omitted. High-density modular collision simplified with locked borders and at most 0.001 relative error.',
    },
  ];
  synchronizeDefinitions(project);
  const assets = new Map([[project.world.modelAsset, model]]),
    pack = await preparePack(project, { assets }),
    zip = await exportEditableZip(project, { assets });
  const bytes = Buffer.from(await pack.arrayBuffer()),
    reimported = await inspectPack(bytes),
    editable = await importEditableZip(zip);
  assert(
    canonicalWorldJSON(reimported.project) === canonicalWorldJSON(project),
    'Pack project round trip',
  );
  assert(
    canonicalWorldJSON(editable.project) === canonicalWorldJSON(project),
    'Editable project round trip',
  );
  assert(
    Buffer.from(await reimported.assets.get(project.world.modelAsset).arrayBuffer()).equals(
      Buffer.from(model),
    ),
    'Model byte round trip',
  );
  const directory = path.join(root, 'distribution/r1', spec.id);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, spec.id + '.r1.rlpack'), bytes);
  await fs.writeFile(
    path.join(directory, spec.id + '.r1.zip'),
    Buffer.from(await zip.arrayBuffer()),
  );
  await fs.writeFile(
    path.join(directory, 'LICENSE.txt'),
    Object.values(source.licenses).join('\n'),
  );
  const receipt = {
    format: 'FPVFreeWorldPreparation.v1',
    id: spec.id,
    title: spec.title,
    kit: spec.kit,
    sourceURL: source.url,
    downloadURL: source.download,
    archiveSha256: source.sha256,
    license: 'CC0-1.0',
    tool: '@gltf-transform 4.5.1',
    modelBytes: model.length,
    modelSha256: sha(model),
    packBytes: bytes.length,
    packSha256: sha(bytes),
    collisionSurfaces: obstacles.length,
    collisionTriangles: obstacles.reduce((n, o) => n + (o.indices?.length ?? 0) / 3, 0),
    validation: checked.issues,
    placements: provenance,
  };
  await fs.writeFile(
    path.join(directory, 'preparation.json'),
    JSON.stringify(receipt, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({ id: spec.id, bytes: bytes.length, triangles: receipt.collisionTriangles }),
  );
}
