const assert = require('node:assert/strict');
const fs = require('node:fs');
require('node:vm').runInThisContext(fs.readFileSync(__dirname + '/overhaul-gpu-probe.js', 'utf8'));
function fixture() {
  let disjoint = false, lost = false, available = false, current = null;
  const deleted = [], reads = [];
  const gl = {
    QUERY_RESULT_AVAILABLE: 1, QUERY_RESULT: 2, CURRENT_QUERY: 3,
    getExtension: () => ({ TIME_ELAPSED_EXT: 4, GPU_DISJOINT_EXT: 5 }),
    isContextLost: () => lost, getParameter: () => disjoint,
    getQuery: () => current, createQuery: () => ({}),
    beginQuery: (_, query) => { assert.equal(current, null); current = query; },
    endQuery: () => { assert.ok(current); current = null; },
    getQueryParameter: (query, type) => { if (type === 1) return available; assert.ok(available && !disjoint && !lost); reads.push(query); return 2500000; },
    deleteQuery: query => deleted.push(query),
  };
  return { gl, deleted, reads, set: patch => { if ('available' in patch) available = patch.available; if ('disjoint' in patch) disjoint = patch.disjoint; if ('lost' in patch) lost = patch.lost; } };
}
{
  const f = fixture(), probe = createFpvGpuProbe(f.gl, { sampleEvery: 1, maxPending: 2 });
  for (let i = 0; i < 4; i++) probe.around(() => {}, { tag: 'a' });
  assert.equal(f.reads.length, 0); assert.equal(probe.summary('a').pending, 2); assert.equal(probe.summary('a').skipped, 2);
  f.set({ available: true });
  const report = probe.summary('a'); assert.equal(report.samples, 2); assert.equal(report.gpuP95, 2.5); assert.equal(f.deleted.length, 2);
  assert.equal(probe.summary('b').samples, 0);
}
for (const flag of ['disjoint', 'lost']) {
  const f = fixture(), probe = createFpvGpuProbe(f.gl, { sampleEvery: 1 });
  probe.around(() => {}); f.set({ [flag]: true, available: true });
  const result = probe.summary(); assert.equal(f.reads.length, 0); assert.equal(result.discarded, 1); assert.equal(result.samples, 0); assert.equal(f.deleted.length, 1);
}
{
  const f = fixture(); f.gl.getExtension = () => null;
  const probe = createFpvGpuProbe(f.gl); let rendered = 0; probe.around(() => rendered++);
  assert.equal(rendered, 1); assert.equal(probe.summary().available, false); assert.equal(probe.summary().measured, false);
}
{
  const f = fixture(), probe = createFpvGpuProbe(f.gl, { sampleEvery: 1 });
  probe.around(() => {}, { active: false }); assert.equal(probe.summary().issued, 0);
  assert.throws(() => probe.around(() => { throw Error('render'); }), /render/);
  probe.dispose(); assert.equal(f.deleted.length, 1);
}
console.log('PASS 5 GPU probe checks: bounded asynchronous reads, per-phase samples, disjoint/context loss, unavailable extension, render failure cleanup');
