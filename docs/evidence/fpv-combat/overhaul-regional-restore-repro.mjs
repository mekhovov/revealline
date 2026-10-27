import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { REGIONAL_LIBRARY_PINS } from '../../../optional-practice/civilian-fpv/regional-library.mjs';
import { createRegionalSession } from '../../../optional-practice/civilian-fpv/regional-session.mjs';
import { initAdvancedRuntime } from '../../../optional-practice/civilian-fpv/advanced-simulation.mjs';
await initAdvancedRuntime();
const pin = REGIONAL_LIBRARY_PINS.find(item => item.pin.sha256 === (process.env.REGION_PIN || '891835944510139a7bed6a99305c0e22b71ba9ccfe84801a07ea6e215ca25c87'));
const parts = new URL(pin.pin.url).pathname.split('/'), revision = parts[3],
  descriptorPath = parts.slice(4).join('/'), directory = descriptorPath.slice(0, descriptorPath.lastIndexOf('/') + 1);
const git = file => execFileSync('git', ['show', `${revision}:${file}`], { maxBuffer: 100 * 1024 * 1024 });
const descriptor = JSON.parse(git(descriptorPath)), cache = new Map();
const load = file => {
  if (!cache.has(file)) cache.set(file, git(directory + file));
  return cache.get(file);
};
const source = ref => ({
  baseURL: new URL('.', 'https://fixture.invalid/' + ref.path).href,
  fetchImpl: async input => new Response(load(new URL(input).pathname.slice(1))),
});
const configuration = {
  manifest: JSON.parse(load(descriptor.terrain.path)), source: source(descriptor.terrain),
  scenery: { manifest: JSON.parse(load(descriptor.scenery.path)), source: source(descriptor.scenery) },
  geometryProfile: 'terrain-scenery-v1', spawnId: process.env.REGION_START || 'turning-basin', mode: 'acro',
};
const flight = createRegionalSession(configuration);
const report = { pin: pin.pin.sha256, results: [] };
try {
  await flight.prepare();
  report.initial = flight.snapshot();
  flight.arm();
  for (let tick = 0; tick < 3; tick++) flight.step({ roll: 0, pitch: 0, yaw: 0, throttle: 0 });
  flight.pause();
  const saved = flight.encounterCheckpoint();
  report.saved = saved;
  const certificateCode = (await readFile('optional-practice/civilian-fpv/regional/restore-containment.mjs', 'utf8'))
    .replace('async function certificate(', 'export async function certificate(')
    .replace('result.push({ bounds, planes: retained });', 'result.push({ bounds: Array.from(bounds), planes: retained, closed: component.closed, faceCount: component.faces.length });');
  const { certificate } = await import('data:text/javascript;base64,' + Buffer.from(certificateCode).toString('base64'));
  const meshes = [];
  flight.root.updateMatrixWorld(true);
  flight.root.traverse(object => { if (object.isMesh && object.geometry.index) meshes.push(object); });
  const point = [saved.body.position.x - saved.origin.x, saved.body.position.y + 220 - saved.origin.y, saved.body.position.z - saved.origin.z].map(n => n / 1000);
  report.candidateComponents = [];
  for (const mesh of meshes) {
    const m = mesh.matrixWorld.elements;
    const proof = await certificate([{ positions: mesh.geometry.attributes.position.array, indices: mesh.geometry.index.array,
      translation: { x: m[12], y: m[13], z: m[14] } }], () => {});
    for (const component of proof.components ?? []) {
      if (point.every((n, axis) => n >= component.bounds[axis] && n <= component.bounds[axis + 3]))
        report.candidateComponents.push({ name: mesh.name, bounds: component.bounds, closed: component.closed,
          convex: !!component.planes, faces: component.faceCount, point });
    }
  }
  for (const delta of [0, 1, 10, 100, 220, 500]) {
    const candidate = structuredClone(saved);
    candidate.body.position.y += delta;
    if (delta) { candidate.body.grounded = false; candidate.body.support = null; }
    try {
      await flight.restoreEncounterCheckpoint(candidate);
      report.results.push({ delta, restored: true });
    } catch (error) {
      report.results.push({ delta, message: error.message, reason: error.reason, code: error.code, stack: error.stack });
    }
  }
} finally { await flight.dispose(); }
await writeFile('docs/evidence/fpv-combat/' + (process.env.REPORT_FILE || 'overhaul-regional-restore-repro.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ position: report.saved.body.position, support: report.saved.body.support, components: report.candidateComponents, results: report.results }));
if (process.env.EXPECT_FAILURE !== '1') assert.ok(report.results.every(result => result.restored), 'Pinned Canal turning-basin recovery must restore every clear diagnostic pose');
