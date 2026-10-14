// Content admission probes, using the unchanged runtime collision geometry.
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { inspectPack } from '../../../optional-practice/civilian-fpv/world-content.mjs';
import {
  initWorldRuntime,
  createWorldCollision,
} from '../../../optional-practice/civilian-fpv/world-collision.mjs';
const directory = new URL('./distribution/r1/cc0-coaster-park/', import.meta.url);
const pack = await inspectPack(await fs.readFile(new URL('cc0-coaster-park.r1.rlpack', directory)));
await initWorldRuntime();
const collision = createWorldCollision(pack.project.courses[0]);
const checks = [];
function check(name, passed) {
  if (!passed) throw Error(name);
  checks.push({ name, passed });
}
try {
  const launch = collision.support({ x: 0, y: 0, z: 40000 }, 250, 500);
  check('Launch supported by the landing floor', launch?.id === '$floor' && launch.y <= 2);
  for (const x of [-23000, 23000]) {
    const crossing = collision.moveSphere({ x, y: 8750, z: 15000 }, { x: 0, y: 0, z: -40000 }, 250);
    check(
      `Loop ${x < 0 ? 'left' : 'right'} opening passes a 500 mm diameter drone`,
      crossing.contacts.length === 0 && crossing.position.z === -25000,
    );
    const rail = collision.castPulse({ x, y: 17500, z: 15000 }, { x, y: 17500, z: -25000 });
    check(
      `Loop ${x < 0 ? 'left' : 'right'} top rail has collision`,
      Boolean(rail?.id.startsWith('surface-')),
    );
  }
  const avenue = collision.moveSphere({ x: 0, y: 3750, z: 40000 }, { x: 0, y: 0, z: -75000 }, 250);
  check(
    'Beginner avenue clear above paving',
    avenue.contacts.length === 0 && avenue.position.z === -35000,
  );
} finally {
  collision.dispose();
}
const receipt = {
  format: 'FPVFreeWorldGeometryChecks.v1',
  packSha256: pack.sha256,
  checks,
  limitations: [
    'Representative openings and rails; not exhaustive collision qualification or device performance.',
  ],
};
await fs.writeFile(
  new URL('geometry-checks.json', directory),
  JSON.stringify(receipt, null, 2) + '\n',
);
console.log(fileURLToPath(directory), JSON.stringify(receipt));
