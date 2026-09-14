import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateVariants, wingEnvelopes, PARENT_COMMIT } from './model.mjs';

const text = readFileSync(new URL('./variants.json', import.meta.url), 'utf8');
const edit = (mutate) => {
  const v = JSON.parse(text);
  mutate(v);
  return JSON.stringify(v);
};

test('new candidate paths are separate from v1 and the rejected RGB attempts', () => {
  const data = validateVariants(text);
  assert.equal(data.parentCommit, PARENT_COMMIT);
  assert.deepEqual(
    data.roles.map((r) => r.classId),
    ['scout', 'interceptor', 'fiber'],
  );
  for (const role of data.roles) {
    assert.equal(role.body.src, `originals/${role.classId}-v3.png`);
    assert.equal(role.body.compactMinimumCSSPixels, 20);
  }
  for (const path of [
    'originals/scout-v2.png',
    'originals/scout-v2-alpha.png',
    '../ukraine-role-presentations/originals/scout.png',
  ])
    assert.throws(
      () =>
        validateVariants(
          edit((v) => {
            v.roles[0].body.src = path;
          }),
        ),
      /fresh original/,
    );
});

test('source identity and body data reject wrong types, unknown fields and changed role ownership', () => {
  for (const mutate of [
    (v) => {
      v.parentCommit = [PARENT_COMMIT];
    },
    (v) => {
      v.roles[0].sha256 = [v.roles[0].sha256];
    },
    (v) => {
      v.runtimeBinding = {};
    },
    (v) => {
      v.roles.reverse();
    },
    (v) => {
      v.roles[0].body.widthCells = 2;
    },
    (v) => {
      v.roles[0].width = 1253;
    },
    (v) => {
      v.roles[0].body.unlock = 'earned';
    },
  ])
    assert.throws(() => validateVariants(edit(mutate)));
  assert.throws(() => validateVariants(JSON.parse(text)), /JSON text/);
  assert.throws(() => validateVariants(' '.repeat(65537)), /JSON text/);
});

test('candidate rigs stay inside the source frame and refuse unsupported motion or escaped roots', () => {
  for (const role of validateVariants(text).roles)
    for (const box of wingEnvelopes(role.recipe.components[0]))
      assert.ok(box.left >= -0.5 && box.top >= -0.5 && box.right <= 0.5 && box.bottom <= 0.5);
  for (const mutate of [
    (c) => {
      c.span = 0.4;
    },
    (c) => {
      c.anchors[0][0] = -0.5;
    },
    (c) => {
      c.anchors[0][2] = 1;
    },
    (c) => {
      c.type = 'ability';
    },
    (c) => {
      c.actionState = 'scan';
    },
    (c) => {
      c.frequencyHz = '2';
    },
  ])
    assert.throws(() => validateVariants(edit((v) => mutate(v.roles[0].recipe.components[0]))));
});

test('each validation returns independent role and attachment data', () => {
  const first = validateVariants(text),
    second = validateVariants(text);
  first.roles[0].recipe.components[0].anchors[0][0] = -0.1;
  first.roles[1].body.src = 'changed';
  assert.equal(second.roles[0].recipe.components[0].anchors[0][0], -0.3);
  assert.equal(second.roles[1].body.src, 'originals/interceptor-v3.png');
  assert.equal(validateVariants(text).roles[0].recipe.components[0].anchors[0][0], -0.3);
});
