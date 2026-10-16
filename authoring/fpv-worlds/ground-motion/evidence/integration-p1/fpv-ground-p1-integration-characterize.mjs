// One-off manual composition diagnostic; no product or unit-test changes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const [root, out] = process.argv.slice(2);
const file = (name) => path.join(root, 'optional-practice/civilian-fpv', name);
const model = await import(pathToFileURL(file('world-model.mjs')));
const { NATIVE_PURSUIT_COURSES } = await import(pathToFileURL(file('native-pursuit-courses.mjs')));
const receipt = {
  format: 'FPVGroundP1CompositionDiagnostic.v1',
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, env: { ...process.env, GIT_NO_LAZY_FETCH: '1' } }).toString().trim(),
  files: {}, cases: [], complete: false,
  scope: 'Actual createWorldFlight graph admission only. Synthetic data; no authored world or completed flight claim.',
};
for (const name of ['world-model.mjs', 'world-collision.mjs', 'world-pursuit.mjs']) {
  const bytes = await fs.readFile(file(name));
  receipt.files[name] = createHash('sha256').update(bytes).digest('hex');
}
await model.initWorldRuntime();
try {
  for (const [name, policies, ceiling] of [
    ['legacy-clear', [false, false], false],
    ['support-clear', [true, true], false],
    ['legacy-thin-ceiling', [false, false], true],
    ['support-thin-ceiling', [true, true], true],
    ['mixed-legacy-first-thin-ceiling', [false, true], true],
    ['mixed-support-first-thin-ceiling', [true, false], true],
  ]) {
    const course = structuredClone(NATIVE_PURSUIT_COURSES[3]);
    course.id = 'ground-p1-composition';
    course.revision = 'diagnostic-r1';
    course.actors = course.actors.filter((actor) => actor.type === 'patrol');
    assert.equal(course.actors.length, 2);
    for (const [index, actor] of course.actors.entries()) {
      if (policies[index]) actor.groundMotion = 'support-v1';
    }
    course.obstacles = ceiling ? [{
      id: 'thin-ceiling',
      min: { x: -18000, y: 1805, z: -16000 },
      max: { x: 18000, y: 1807, z: 18000 },
    }] : [];
    const row = { name, policies, ceiling, accepted: false };
    let flight;
    try {
      flight = model.createWorldFlight({ course });
      row.accepted = true;
      row.identity = flight.identity;
      row.state = flight.snapshot();
    } catch (error) {
      row.error = { name: error.name, message: error.message, code: error.code };
    } finally {
      flight?.dispose();
    }
    receipt.cases.push(row);
  }
  receipt.complete = true;
} finally {
  await fs.writeFile(out, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(receipt.cases.map(({ name, accepted, error }) => ({ name, accepted, error }))));
}
