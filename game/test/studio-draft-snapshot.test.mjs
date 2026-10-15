import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudioDraftSnapshot } from '../studio/draft-snapshot.mjs';
import { createContentDraftSession } from '../content-design/session.mjs';
import { createStarterProject } from '../content-design/starter.mjs';
import { compileContentProject } from '../content-design/project.mjs';

test('Studio reuses an owned compiled draft across selection, and invalidates on edits, undo, redo and import', () => {
  let session = createContentDraftSession(createStarterProject());
  const snapshot = createStudioDraftSnapshot(() => session);
  const first = snapshot(),
    compiled = compileContentProject(first);
  assert.equal(snapshot(), first);
  assert.equal(compileContentProject(snapshot()), compiled);
  assert.throws(() => {
    first.name = 'mutation';
  }, TypeError);
  const edited = session.current();
  edited.missions[0].coverage = 0.65;
  // Same revision labels must not conceal different accepted source bytes.
  session.replace(edited);
  const next = snapshot();
  assert.notEqual(next, first);
  assert.equal(next.missions[0].coverage, 0.65);
  session.undo();
  assert.deepEqual(snapshot(), first);
  session.redo();
  assert.deepEqual(snapshot(), next);
  const previous = snapshot();
  session = createContentDraftSession(edited);
  assert.notEqual(snapshot(), previous);
  assert.deepEqual(snapshot(), previous);
});
