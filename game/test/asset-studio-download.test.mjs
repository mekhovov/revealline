import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudioDownload } from '../../authoring/asset-studio/download.mjs';
import { Document } from './helpers/couch-dom.mjs';
test('prepared download stays actionable after the automatic request and failed re-export; replacement and disposal release exact URLs', () => {
  const document = new Document(),
    target = document.createElement('p'),
    created = [],
    revoked = [];
  let fail = false;
  const urls = {
    createObjectURL(blob) {
      if (fail) throw Error('capacity');
      created.push(blob);
      return `blob:${created.length}`;
    },
    revokeObjectURL(url) {
      revoked.push(url);
    },
  };
  const d = createStudioDownload({ document, target, urls }),
    first = new Blob(['first']);
  const a = d.offer(first, 'collection-r1.rltheme');
  assert.equal(a.href, 'blob:1');
  assert.equal(a.download, 'collection-r1.rltheme');
  assert.equal(target.hidden, false);
  assert.equal(a.parentNode, target);
  assert.equal(created[0], first);
  assert.deepEqual(revoked, []);
  fail = true;
  assert.throws(() => d.offer(new Blob(['next']), 'collection-r2.rltheme'), /capacity/);
  assert.equal(a.parentNode, target);
  assert.deepEqual(revoked, []);
  fail = false;
  const b = d.offer(new Blob(['next']), 'collection-r2.rltheme');
  assert.equal(b.href, 'blob:2');
  assert.equal(b.download, 'collection-r2.rltheme');
  assert.deepEqual(revoked, ['blob:1']);
  d.dispose();
  d.dispose();
  assert.equal(target.hidden, true);
  assert.deepEqual(revoked, ['blob:1', 'blob:2']);
});
