import assert from 'node:assert/strict';
import { settle } from './solo-dom.mjs';

/** Explicit user replacement decision; never auto-accept unrelated operations. */
export async function acceptGameDataReplacement(page) {
  await settle(
    () => !page.$('library-operation-confirm').hidden,
    'Backup must offer replacement review before committing',
  );
  assert.match(page.$('save-status').textContent, /Replace this release’s/);
  assert.match(page.$('save-status').textContent, /Undo/);
  assert.equal(page.$('library-operation-cancel').textContent, 'Keep current data');
  page.$('library-operation-confirm').click();
}
