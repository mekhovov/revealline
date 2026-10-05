import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  fieldKitCandidateDestination,
  writeFieldKitProductionCandidate,
} from '../../scripts/field-kit-production-candidate.mjs';

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'field-kit-candidate-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'source');
  await fs.mkdir(root);
  await fs.mkdir(path.join(root, '.cache'));
  return { directory, root, output: path.join(root, '.cache', 'candidate') };
}
const files = () =>
  new Map([
    ['production.rltheme', Buffer.from('immutable candidate ledger')],
    ['compiled/runtime.json', Buffer.from('candidate runtime')],
    ['compiled/assets/fixture.png', Buffer.from('candidate bytes')],
    ['review.json', Buffer.from('source-bound review receipt')],
  ]);

test('candidate output cannot target source directories, including a symlink alias', async (t) => {
  const { directory, root } = await fixture(t);
  const linked = path.join(directory, 'source-alias');
  await fs.symlink(root, linked, 'dir');
  await assert.rejects(
    fieldKitCandidateDestination(path.join(root, 'new-production'), { projectRoot: root }),
    /outside the source/,
  );
  await assert.rejects(
    fieldKitCandidateDestination(path.join(linked, 'new-production'), { projectRoot: root }),
    /outside the source/,
  );
  await assert.rejects(
    fieldKitCandidateDestination(path.join(root, '.cache'), { projectRoot: root }),
    /not .cache itself/,
  );
});

test('candidate reservation refuses existing empty, populated and linked destinations', async (t) => {
  const { directory, root, output } = await fixture(t);
  await fs.mkdir(output);
  await assert.rejects(writeFieldKitProductionCandidate(files(), output, { projectRoot: root }), {
    code: 'EEXIST',
  });
  await fs.writeFile(path.join(output, 'keep.txt'), 'user content');
  await assert.rejects(writeFieldKitProductionCandidate(files(), output, { projectRoot: root }), {
    code: 'EEXIST',
  });
  const alias = path.join(directory, 'candidate-alias');
  await fs.symlink(output, alias, 'dir');
  await assert.rejects(writeFieldKitProductionCandidate(files(), alias, { projectRoot: root }), {
    code: 'EEXIST',
  });
  assert.equal(await fs.readFile(path.join(output, 'keep.txt'), 'utf8'), 'user content');
});

test('candidate stages ledger, compiled output and receipt as one reproducible tree', async (t) => {
  const { root, output } = await fixture(t);
  const snapshot = files();
  await writeFieldKitProductionCandidate(snapshot, output, { projectRoot: root });
  await writeFieldKitProductionCandidate(snapshot, output, { projectRoot: root, check: true });
  assert.equal(
    await fs.readFile(path.join(output, 'production.rltheme'), 'utf8'),
    'immutable candidate ledger',
  );
  await fs.writeFile(path.join(output, 'compiled/runtime.json'), 'different runtime');
  await assert.rejects(
    writeFieldKitProductionCandidate(snapshot, output, { projectRoot: root, check: true }),
    /differs/,
  );
});

test('candidate check rejects unlisted files and symlinked payloads without removing them', async (t) => {
  const { directory, root, output } = await fixture(t);
  const snapshot = files();
  await writeFieldKitProductionCandidate(snapshot, output, { projectRoot: root });
  await fs.writeFile(path.join(output, 'unlisted.txt'), 'keep');
  await assert.rejects(
    writeFieldKitProductionCandidate(snapshot, output, { projectRoot: root, check: true }),
    /Unlisted/,
  );
  await fs.unlink(path.join(output, 'unlisted.txt'));
  const runtime = path.join(output, 'compiled/runtime.json');
  const external = path.join(directory, 'external.json');
  await fs.writeFile(external, snapshot.get('compiled/runtime.json'));
  await fs.unlink(runtime);
  await fs.symlink(external, runtime);
  await assert.rejects(
    writeFieldKitProductionCandidate(snapshot, output, { projectRoot: root, check: true }),
    /linked/,
  );
  assert.equal(await fs.readFile(external, 'utf8'), 'candidate runtime');
});

test('failed staging leaves no partial candidate and never touches published files', async (t) => {
  const { root, output } = await fixture(t);
  const published = path.join(root, 'production.rltheme');
  await fs.writeFile(published, 'published original');
  const impossible = new Map([
    ['compiled', Buffer.from('conflicting file')],
    ['compiled/runtime.json', Buffer.from('cannot write')],
  ]);
  await assert.rejects(writeFieldKitProductionCandidate(impossible, output, { projectRoot: root }));
  await assert.rejects(fs.stat(output), { code: 'ENOENT' });
  assert.deepEqual(await fs.readdir(path.dirname(output)), []);
  assert.equal(await fs.readFile(published, 'utf8'), 'published original');
});
