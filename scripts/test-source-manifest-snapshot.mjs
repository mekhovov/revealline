import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { releaseSnapshot } from './game-cli.mjs';

test('opt-in manifest snapshot preserves the legacy distribution and refuses dirty source', async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'source-contract-'));
  t.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const root = path.join(temporary, 'legacy'),
    shadow = path.join(temporary, 'manifest');
  await fs.mkdir(path.join(root, 'scripts'), { recursive: true });
  const git = (...args) =>
    execFileSync('git', ['-C', root, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  await fs.writeFile(path.join(root, '.gitignore'), 'releases/\n');
  await fs.writeFile(
    path.join(root, 'scripts/game-cli.mjs'),
    `
    import fs from 'node:fs'; import path from 'node:path';
    const out = process.argv[process.argv.indexOf('--out') + 1];
    fs.mkdirSync(out, {recursive:true});
    fs.writeFileSync(path.join(out, 'distribution.zip'), 'identical frozen distribution fixture');
    fs.writeFileSync(path.join(out, 'manifest.json'), '{}');
  `,
  );
  git('init', '-q');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.invalid');
  git('add', '.');
  git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'fixture');
  const commit = git('rev-parse', 'HEAD');
  execFileSync('git', ['clone', '-q', root, shadow]);
  const legacy = await releaseSnapshot({ root, ref: commit, version: 'v1.2.3' });
  const modern = await releaseSnapshot({
    root: shadow,
    ref: commit,
    version: 'v1.2.3',
    sourceFormat: 'manifest',
  });
  assert.equal(modern.formatVersion, 2);
  assert.equal(modern.sourceRevision, legacy.sourceRevision);
  assert.equal(modern.distributionSha256, legacy.distributionSha256);
  assert.equal(modern.manifestSha256, legacy.manifestSha256);
  assert.equal(modern.sourceTree, git('rev-parse', 'HEAD^{tree}'));
  await fs.access(path.join(modern.directory, 'source-manifest.json'));
  await assert.rejects(fs.access(path.join(modern.directory, 'source.tar')));
  await fs.writeFile(path.join(shadow, 'dirty.txt'), 'not committed');
  await assert.rejects(
    releaseSnapshot({ root: shadow, ref: commit, version: 'v1.2.4', sourceFormat: 'manifest' }),
    /clean exact-commit/,
  );
});
