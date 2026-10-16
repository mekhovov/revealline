// Review-only producer: the exact framework preparation/ZIP encoder, with a
// single archive on mounted storage instead of thousands of slow SMB writes.
import { prepareBuildProject, createZip } from '../../../../scripts/game-cli.mjs';
import { writeFile, rename, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root = process.cwd();
const destination = process.argv[2];
if (!destination) throw new Error('Pass the absolute output ZIP path');
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const startedAt = new Date().toISOString();
execFileSync('git', ['diff', '--quiet']);
const prepared = await prepareBuildProject({ root, version: '0.151.1', sourceRevision: revision });
if (execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() !== revision) throw new Error('Source revision changed');
execFileSync('git', ['diff', '--quiet']);
const archive = createZip(prepared.entries);
const receipt = { sourceRevision: revision, version: prepared.version, startedAt, preparedAt: new Date().toISOString(), files: prepared.manifest.files.length, contentBytes: prepared.manifest.totalBytes, archiveBytes: archive.length, sha256: createHash('sha256').update(archive).digest('hex'), layout: 'Unchanged framework ZIP bytes; archive-only review layout because local disk is constrained and SMB per-file writes are slow.' };
const partial = `${destination}.${process.pid}.partial`;
try {
  await writeFile(partial, archive, { flag: 'wx' });
  await rename(partial, destination);
  receipt.completedAt = new Date().toISOString();
  await writeFile(`${destination}.json`, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify(receipt));
} finally { await rm(partial, { force: true }); }
