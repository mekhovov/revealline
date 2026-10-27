import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const hash = (b) => createHash('sha256').update(b).digest('hex');
// Test-only exact historical bytes. Production loading never calls this adapter.
export function createExecutedFrameReader(read) {
  let pending;
  return async (path) => {
    pending ??= (async () => {
      const bytes = await read(
        'docs/performance/fixtures/solo-browser-frame-trace/fd787-executed-source.json',
      );
      assert.equal(bytes.length, 192534);
      assert.equal(hash(bytes), 'b21ce92d121c99bffa6a6b2c8a60f631df3b52df46e12d86c1d30cc778f525ef');
      const witness = JSON.parse(bytes);
      assert.equal(witness.format, 'SoloExecutedFrameTraceDeclaredSourceV1');
      assert.equal(witness.revision, 'fd78700a0e3167e104da7c854a8b04f2cea9a19f');
      assert.equal(witness.tree, '88342841f9447323dddee42bdcccb79429ce2617');
      assert.equal(witness.records.length, 4);
      const records = new Map();
      for (const record of witness.records) {
        assert(!records.has(record.path));
        const content = Buffer.from(record.content);
        assert.equal(content.length, record.excerptBytes ?? record.bytes);
        assert.equal(hash(content), record.excerptSHA256 ?? record.sha256);
        records.set(record.path, content);
      }
      return records;
    })();
    return (await pending).get(path) ?? read(path);
  };
}
