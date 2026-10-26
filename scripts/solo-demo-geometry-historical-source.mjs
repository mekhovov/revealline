// Test-only exact input readback. Production admission never imports this module.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
export const demoGeometryWitnessPath =
  'docs/performance/fixtures/solo-demo-797e03/c293-paused-geometry-source.json';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function decodeDemoGeometryWitness(bytes) {
  assert.equal(bytes.length, 150438);
  assert.equal(sha(bytes), 'e86ea1f6e8f06e57d75c21058bbd6cffe2fc151129afa2b684a82d9acdd1567a');
  const value = JSON.parse(bytes);
  assert.equal(value.format, 'SoloDemoPausedGeometryHistoricalSourceV1');
  assert.equal(value.revision, 'c2930c544d7e1353cbc5aae10c0b77d121a32164');
  assert.equal(value.tree, 'fcab1c181518f01918b4d9b6512d5b870b86f2ad');
  assert.equal(value.records.length, 6);
  for (const ref of value.records)
    if (typeof ref.content === 'string') {
      const content = Buffer.from(ref.content);
      assert.equal(content.length, ref.bytes);
      assert.equal(sha(content), ref.sha256);
      assert.equal(
        createHash('sha1')
          .update(Buffer.from('blob ' + content.length + '\0'))
          .update(content)
          .digest('hex'),
        ref.gitBlob,
      );
    }
  return value;
}
export async function createDemoGeometryHistoricalReader(read) {
  const witness = decodeDemoGeometryWitness(await read(demoGeometryWitnessPath));
  return async (path) => {
    const row = witness.records.find((r) => r.path === path);
    const bytes = typeof row?.content === 'string' ? Buffer.from(row.content) : await read(path);
    if (row) {
      assert.equal(bytes.length, row.bytes);
      assert.equal(sha(bytes), row.sha256);
    }
    return bytes;
  };
}
