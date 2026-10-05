import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { checkEditionSourceEligibility } from './check-edition-source.mjs';

async function fixture(t, assets = []) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'edition-source-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const write = async (name, bytes) => {
    const file = path.join(root, name);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, bytes);
    return file;
  };
  await write(
    'game/editions/catalog.json',
    JSON.stringify({ format: 'revealline-edition-catalog.v3', editions: [], assets }),
  );
  await write('authoring/fpv-worlds/app.mjs', 'export const studio = true;\n');
  return { root, write };
}

test('source eligibility ignores installed dependencies and their executable symlinks at every depth', async (t) => {
  const { root, write } = await fixture(t);
  const before = await checkEditionSourceEligibility(root);
  assert.equal(before.status, 'verified');
  for (const prefix of ['', 'authoring/fpv-worlds/', 'services/rooms/tools/']) {
    await write(`${prefix}node_modules/semver/bin/semver.js`, '#!/usr/bin/env node\n');
    const bin = path.join(root, `${prefix}node_modules/.bin`);
    await fs.mkdir(bin, { recursive: true });
    await fs.symlink('../semver/bin/semver.js', path.join(bin, 'semver'));
  }
  assert.deepEqual(await checkEditionSourceEligibility(root), before);
});

test('source eligibility still rejects ordinary source symlinks beside installed dependencies', async (t) => {
  const { root, write } = await fixture(t);
  await write('authoring/fpv-worlds/node_modules/installed/package.json', '{}');
  await fs.symlink('app.mjs', path.join(root, 'authoring/fpv-worlds/linked.mjs'));
  await assert.rejects(
    checkEditionSourceEligibility(root),
    /non-regular files: authoring\/fpv-worlds\/linked\.mjs/,
  );
});

test('source eligibility still rejects undeclared Company originals outside dependencies', async (t) => {
  const { root, write } = await fixture(t);
  await write('authoring/brands/node_modules/installed/package.json', '{}');
  await write('authoring/brands/example/original.png', Buffer.from('unapproved original'));
  await assert.rejects(
    checkEditionSourceEligibility(root),
    /Company source media has no public eligibility record: authoring\/brands\/example\/original\.png/,
  );
});

test('other root-only exclusions do not hide nested private source', async (t) => {
  const { root, write } = await fixture(t);
  await write('authoring/fpv-worlds/.cache/private/token.json', '{}');
  await assert.rejects(
    checkEditionSourceEligibility(root),
    /Private source path cannot be published: authoring\/fpv-worlds\/\.cache\/private\/token\.json/,
  );
});

for (const prefix of ['', 'authoring/fpv-worlds/']) {
  test(`declared assets inside ${prefix}node_modules remain unavailable for publication`, async (t) => {
    const bytes = Buffer.from('approved bytes cannot come from excluded dependencies');
    const name = `${prefix}node_modules/art/actor.png`;
    const { root, write } = await fixture(t, [
      {
        path: name,
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        publication: 'public',
        approved: true,
      },
    ]);
    await write(name, bytes);
    await assert.rejects(
      checkEditionSourceEligibility(root),
      /Declared edition original is missing from source/,
    );
  });
}
