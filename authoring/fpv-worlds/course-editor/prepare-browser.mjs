#!/usr/bin/env node
// Small manual UI fixture; no production imports this module.
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  encodeWorldGLB,
  inspectImport,
  projectFromImport,
  canonicalWorldJSON,
} from '../../../optional-practice/civilian-fpv/world-content.mjs';
import { validateWorldCourse } from '../../../optional-practice/civilian-fpv/world-model.mjs';
import { exportEditableZip } from '../../../optional-practice/civilian-fpv/world-zip.mjs';
import {
  courseFromProject,
  synchronizeDefinitions,
} from '../../../optional-practice/civilian-fpv/world-app.mjs';
import { WORLD_CATALOGUE } from '../../../optional-practice/civilian-fpv/world-catalogue.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const args = process.argv.slice(2),
  opts = {};
for (let i = 0; i < args.length; i += 2) {
  assert(['--player', '--out', '--admitted-source'].includes(args[i]) && args[i + 1]);
  opts[args[i].slice(2)] = args[i + 1];
}
assert(opts.player && opts.out);
const player = await fs.realpath(opts.player),
  out = path.resolve(opts.out),
  admitted = opts['admitted-source'],
  hash = (b) => createHash('sha256').update(b).digest('hex'),
  host = 'optional-practice/civilian-fpv/world-app.mjs',
  reaction = 'optional-practice/civilian-fpv/world-reaction-runtime.mjs',
  descriptor = await fs.readFile(path.join(player, 'optional-package.json')),
  manifest = JSON.parse(descriptor),
  files = [
    ...manifest.files,
    { path: 'optional-package.json', bytes: descriptor.length, sha256: hash(descriptor) },
  ];
assert.equal(manifest.id, 'fpv-worlds');
assert.equal(files.length, 102);
assert.equal(manifest.engineCommit, admitted ?? 'd41a251519ccb97dbac3b27bb9eed1718041d70e');
assert(!(await fs.stat(out).catch(() => null)), 'Do not replace frozen fixtures');
const overlays = new Map();
if (!admitted)
  for (const name of [host, reaction]) overlays.set(name, await fs.readFile(path.join(root, name)));
const staged = [];
for (const file of files) {
  assert(!file.path.split('/').includes('..') && !path.isAbsolute(file.path));
  const source = await fs.realpath(path.join(player, file.path)),
    bytes = await fs.readFile(source);
  assert(source.startsWith(player + path.sep));
  assert(bytes.length === file.bytes && hash(bytes) === file.sha256, file.path);
  staged.push({ ...file, source });
}
function scene(offset = 0) {
  const bin = new Uint8Array(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer);
  const nodes = [
    { mesh: 0 },
    { translation: [0, 0, 12], extras: { rl: { id: 'spawn', kind: 'spawn' } } },
    { translation: [0, 0, -12], extras: { rl: { id: 'landing', kind: 'landing', order: 20 } } },
    ...Array.from({ length: 8 }, (_, i) => ({
      translation: [i * 3 - 10.5 + offset, 4, 0],
      extras: { rl: { id: `gate-${i + 1}`, kind: 'gate', width: 6, height: 4, order: i + 1 } },
    })),
  ];
  return encodeWorldGLB(
    {
      asset: { version: '2.0' },
      scene: 0,
      scenes: [{ nodes: nodes.map((_, i) => i) }],
      nodes,
      buffers: [{ byteLength: 36 }],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
      accessors: [
        {
          bufferView: 0,
          componentType: 5126,
          count: 3,
          type: 'VEC3',
          min: [0, 0, 0],
          max: [1, 1, 0],
        },
      ],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    },
    bin,
  );
}
const original = scene(),
  imported = await inspectImport({
    files: { 'source.glb': original },
    entry: 'source.glb',
    id: 'course-picker-project',
    title: 'Eight-course fixture',
  }),
  project = projectFromImport(imported),
  hunt = WORLD_CATALOGUE.find((entry) =>
    entry.course.steps['self-level'].some((step) => step.type === 'hunt-contact-v1'),
  ).course,
  contact = hunt.steps['self-level'].find((step) => step.type === 'hunt-contact-v1'),
  actor = structuredClone(hunt.actors.find((a) => a.id === contact.targets[0]));
assert(actor, 'Retain a validated actor fixture');
project.world.id = 'course-picker-world';
project.routeBindings = {};
project.spawnBindings = {};
for (let i = 0; i < 8; i++) {
  const source = structuredClone(project);
  source.source.anchors = source.source.anchors.filter((a) =>
    ['spawn', 'landing', `gate-${i + 1}`].includes(a.id),
  );
  const course = courseFromProject(source);
  course.id = `picker-${i + 1}`;
  course.world.id = project.world.id;
  course.spawn.x = i * 1000;
  for (const locale of ['en', 'uk'])
    course.locales[locale].title = (locale === 'en' ? 'Challenge ' : 'Завдання ') + (i + 1);
  course.actors = ['shared-a', 'shared-b'].map((id, j) => ({
    ...structuredClone(actor),
    id,
    position: { ...actor.position, x: 20000 + j * 3000 },
  }));
  if (i % 2) course.actors.reverse();
  for (const mode of ['self-level', 'acro']) {
    course.steps[mode].splice(1, 0, {
      ...structuredClone(contact),
      targets: ['shared-a', 'shared-b'],
    });
    if (i === 1 && mode === 'acro') {
      course.steps[mode][0].minSide += 1000;
      course.steps[mode][0].maxSide += 1000;
    }
  }
  project.courses.push(course);
  project.routeBindings[course.id] = {
    'self-level': [`gate-${i + 1}`, null, 'landing'],
    acro: [`gate-${i + 1}`, null, 'landing'],
  };
  project.spawnBindings[course.id] = 'spawn';
}
project.playlists = [{ id: 'picker-order', courseIds: project.courses.map((c) => c.id) }];
synchronizeDefinitions(synchronizeDefinitions(project));
assert.equal(
  canonicalWorldJSON(synchronizeDefinitions(structuredClone(project))),
  canonicalWorldJSON(project),
);
for (const course of project.courses) validateWorldCourse(course);
const zip = await exportEditableZip(project, {
  assets: new Map([[project.world.modelAsset, imported.modelBlob]]),
});
const inputs = new Map([
  ['eight-courses.zip', Buffer.from(await zip.arrayBuffer())],
  ['eight-courses.project.json', Buffer.from(JSON.stringify(project, null, 2) + '\n')],
  ['source-updated.glb', scene(0.5)],
  ['expected-original-model.glb', Buffer.from(await imported.modelBlob.arrayBuffer())],
  [
    'expected-updated-model.glb',
    Buffer.from(
      await (
        await inspectImport({
          files: { 'source.glb': scene(0.5) },
          entry: 'source.glb',
          id: project.id,
        })
      ).modelBlob.arrayBuffer(),
    ),
  ],
]);
await fs.mkdir(out);
for (const file of staged) {
  const destination = path.join(out, 'player', file.path);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  if (overlays.has(file.path))
    await fs.writeFile(destination, overlays.get(file.path), { flag: 'wx' });
  else await fs.link(file.source, destination);
}
await fs.mkdir(path.join(out, 'inputs'));
for (const [name, bytes] of inputs)
  await fs.writeFile(path.join(out, 'inputs', name), bytes, { flag: 'wx' });
const setup = `
window.fixtureToken=new URL(location.href).searchParams.get('token');
window.fixtureErrors=[];addEventListener('error',e=>fixtureErrors.push(e.message));addEventListener('unhandledrejection',e=>fixtureErrors.push(String(e.reason)));
Object.defineProperty(window,'localStorage',{value:parent.fixtureStorage});
const nativeIDB=indexedDB;Object.defineProperty(window,'indexedDB',{value:{open(name,version){const full=parent.fixturePrefix+name;parent.fixtureDatabases.add(full);return version===undefined?nativeIDB.open(full):nativeIDB.open(full,version)},deleteDatabase:name=>nativeIDB.deleteDatabase(parent.fixturePrefix+name),cmp:nativeIDB.cmp.bind(nativeIDB)}});
Object.defineProperty(navigator,'getGamepads',{value:()=>[]});
window.fixtureDownloads=[];const blobs=new Map(),create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL),click=HTMLAnchorElement.prototype.click;
URL.createObjectURL=blob=>{const url=create(blob);blobs.set(url,blob);return url};URL.revokeObjectURL=url=>{revoke(url);blobs.delete(url)};
HTMLAnchorElement.prototype.click=function(){if(this.download&&blobs.has(this.href)){fixtureDownloads.push({name:this.download,blob:blobs.get(this.href)});return}return click.call(this)};
`;
const html = (await fs.readFile(path.join(player, manifest.entry), 'utf8')).replace(
  '<head>',
  `<head><base href="./player/optional-practice/fpv-worlds/"><script>${setup}</script>`,
);
await fs.writeFile(path.join(out, 'host.html'), html, { flag: 'wx' });
for (const file of ['index.html', 'browser-harness.mjs'])
  await fs.copyFile(
    new URL(file, import.meta.url),
    path.join(out, file),
    fs.constants.COPYFILE_EXCL,
  );
const fixture = {
  format: 'FPVProjectCourseEditorFixture.v1',
  kind: admitted ? 'admitted-package' : 'source-overlay',
  sourceRevision: manifest.engineCommit,
  sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  packageRevision: manifest.revision,
  files,
  overlays: [...overlays].map(([path, b]) => ({ path, bytes: b.length, sha256: hash(b) })),
  inputs: [...inputs].map(([name, b]) => ({
    path: 'inputs/' + name,
    bytes: b.length,
    sha256: hash(b),
  })),
  browserSources: await Promise.all(
    ['host.html', 'index.html', 'browser-harness.mjs'].map(async (name) => ({
      path: name,
      sha256: hash(await fs.readFile(path.join(out, name))),
    })),
  ),
  limits: [
    'Actual host, native iframe IndexedDB with isolated names; exported Blob interception only. No private editor state writes.',
    'Source overlays, when present, are explicit and do not claim package admission.',
    'Eight-course original semantic fixture, not Reservoir content or completed flight proofs. No offline/device/FPS claim.',
  ],
};
await fs.writeFile(path.join(out, 'fixture.json'), JSON.stringify(fixture, null, 2) + '\n', {
  flag: 'wx',
});
console.log(
  JSON.stringify(
    {
      output: out,
      kind: fixture.kind,
      files: files.length,
      overlays: fixture.overlays,
      inputBytes: [...inputs.values()].reduce((n, b) => n + b.length, 0),
    },
    null,
    2,
  ),
);
