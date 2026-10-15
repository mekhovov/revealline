/** Find actor differences in two normal downloaded diagnostic artifacts. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const [leftPath, rightPath, output] = process.argv.slice(2);
assert.ok(leftPath && rightPath && output && !existsSync(output));
const read = (path) =>
  JSON.parse(path.endsWith('.gz') ? gunzipSync(readFileSync(path)) : readFileSync(path, 'utf8'));
const left = read(leftPath),
  right = read(rightPath);
assert.equal(left.projectIdentity, right.projectIdentity);
const report = [];
for (const row of left.reviewTrace.details) {
  const peer = right.reviewTrace.details.find((other) => other.tick === row.tick);
  assert.ok(peer, `Missing tick ${row.tick}`);
  const records = new Map(peer.enemies.map((enemy) => [enemy.id, enemy]));
  const changes = [];
  for (const enemy of row.enemies) {
    const other = records.get(enemy.id);
    assert.ok(other, `Missing enemy ${enemy.id}`);
    const fields = Object.keys(enemy).filter((key) =>
      typeof enemy[key] === 'number' && typeof other[key] === 'number'
        ? Math.abs(enemy[key] - other[key]) > 1e-8
        : JSON.stringify(enemy[key]) !== JSON.stringify(other[key]),
    );
    if (!fields.length) continue;
    changes.push({
      id: enemy.id,
      fields,
      positionDelta: Math.hypot(enemy.x - other.x, enemy.y - other.y),
      velocityDelta: Math.hypot(
        enemy._motionVX - other._motionVX,
        enemy._motionVY - other._motionVY,
      ),
      native: enemy,
      headless: other,
    });
  }
  changes.sort(
    (a, b) => b.velocityDelta - a.velocityDelta || b.positionDelta - a.positionDelta || a.id - b.id,
  );
  report.push({
    tick: row.tick,
    time: row.tick / 60,
    actors: row.enemies.length,
    changed: changes.length,
    changes,
  });
}
writeFileSync(
  output,
  JSON.stringify(
    { format: 'OverflightActorDetailComparisonV1', leftPath, rightPath, report },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify(
    report.map(({ time, actors, changed, changes }) => ({
      time,
      actors,
      changed,
      largest: changes.slice(0, 3).map(({ id, fields, positionDelta, velocityDelta }) => ({
        id,
        fields,
        positionDelta,
        velocityDelta,
      })),
    })),
  ),
);
