// Manual observation of real native graph queries; no replacement physics.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const [root, out] = process.argv.slice(2);
const load = (name) => import(pathToFileURL(path.join(root, 'optional-practice/civilian-fpv', name)));
const { validateWorldCourse, initWorldRuntime } = await load('world-model.mjs');
const { createWorldCollision } = await load('world-collision.mjs');
const { admitFlightPursuit } = await load('world-pursuit.mjs');
const { NATIVE_PURSUIT_COURSES } = await load('native-pursuit-courses.mjs');
await initWorldRuntime();
const receipt = { format: 'FPVGroundP1ProbeCacheObservation.v1', sourceSHA: createHash('sha256').update(await fs.readFile(path.join(root, 'optional-practice/civilian-fpv/world-pursuit.mjs'))).digest('hex'), cases: [] };
for (const policies of [[false, false], [true, true], [false, true], [true, false]]) {
  const source = structuredClone(NATIVE_PURSUIT_COURSES[3]);
  source.actors = source.actors.filter((actor) => actor.type === 'patrol');
  source.obstacles = [];
  source.actors.forEach((actor, index) => { if (policies[index]) actor.groundMotion = 'support-v1'; });
  const course = validateWorldCourse(source), collision = createWorldCollision(course);
  for (const actor of course.actors) collision.addActor(actor, actor.groundMotion);
  const calls = new Map(), move = collision.moveGroundActor;
  collision.moveGroundActor = function(actor, delta) {
    calls.set(actor.id, (calls.get(actor.id) ?? 0) + 1);
    return move.call(this, actor, delta);
  };
  const row = { policies, expectedDistinctPolicies: new Set(policies).size };
  try { admitFlightPursuit(course, collision); row.accepted = true; }
  catch (error) { row.error = error.message; }
  finally { collision.dispose(); }
  row.actual = [...calls].map(([id, queries]) => ({ id, policy: course.actors.find((actor) => actor.id === id).groundMotion ?? null, queries }));
  row.allDistinctPoliciesObserved = row.actual.length === row.expectedDistinctPolicies;
  receipt.cases.push(row);
}
await fs.writeFile(out, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(receipt));
