#!/usr/bin/env node
/** Compare raw working files with HEAD, without trusting Git index stat caches. */
import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

const execute = promisify(execFile);
const unchanged = (a, b) =>
  ['dev', 'ino', 'mode', 'size', 'mtimeNs', 'ctimeNs'].every((key) => a[key] === b[key]);
const gitMode = (info) => {
  if (info.isSymbolicLink()) return '120000';
  // Git tracks the owner executable bit, not group/other permissions or ownership.
  if (info.isFile()) return info.mode & 0o100n ? '100755' : '100644';
  return null;
};

export async function checkSourceIdentity({ root = process.cwd() } = {}) {
  const git = async (...args) => {
    const result = await execute('git', ['--no-replace-objects', '-C', root, ...args], {
      encoding: 'buffer',
      maxBuffer: 16 * 1024 * 1024,
    });
    return result.stdout;
  };
  root = await fs.realpath((await git('rev-parse', '--show-toplevel')).toString().trim());
  if ((await git('rev-parse', '--show-object-format')).toString().trim() !== 'sha1')
    throw new Error('Source identity currently requires a SHA-1 Git repository.');
  const sourceRevision = (await git('rev-parse', '--verify', 'HEAD')).toString().trim();
  const sourceTree = (await git('rev-parse', `${sourceRevision}^{tree}`)).toString().trim();
  const tree = await git('ls-tree', '-r', '-l', '-z', '--full-tree', sourceRevision);
  const records = [];
  let start = 0;
  for (let end = 0; end < tree.length; end++) {
    if (tree[end] !== 0) continue;
    const row = tree.subarray(start, end);
    start = end + 1;
    const tab = row.indexOf(9);
    const fields = row.subarray(0, tab).toString().trim().split(/\s+/);
    const rawName = row.subarray(tab + 1);
    const name = rawName.toString('utf8');
    const [mode, type, oid, size] = fields;
    if (
      tab < 0 ||
      fields.length !== 4 ||
      type !== 'blob' ||
      !['100644', '100755', '120000'].includes(mode) ||
      !/^[a-f0-9]{40}$/.test(oid) ||
      !/^\d+$/.test(size) ||
      !Number.isSafeInteger(Number(size)) ||
      !Buffer.from(name, 'utf8').equals(rawName) ||
      path.isAbsolute(name) ||
      name.split('/').some((part) => !part || part === '.' || part === '..')
    )
      throw new Error(`Unsupported tracked entry: ${name}`);
    records.push({ name, mode, oid, bytes: Number(size) });
  }
  if (start !== tree.length) throw new Error('Incomplete Git tree inventory.');
  records.sort((a, b) => Buffer.compare(Buffer.from(a.name), Buffer.from(b.name)));
  const aggregate = createHash('sha256');
  const buffer = Buffer.alloc(64 * 1024);
  const directories = new Map();
  let bytes = 0;
  for (const record of records) {
    let parent = root;
    for (const segment of record.name.split('/').slice(0, -1)) {
      parent = path.join(parent, segment);
      const info = await fs.lstat(parent, { bigint: true });
      if (!info.isDirectory() || info.isSymbolicLink())
        throw new Error(`Tracked parent is not an ordinary directory: ${record.name}`);
      const prior = directories.get(parent);
      if (prior && (prior.dev !== info.dev || prior.ino !== info.ino))
        throw new Error(`Tracked parent changed during verification: ${record.name}`);
      directories.set(parent, info);
    }
    const target = path.join(root, record.name);
    const before = await fs.lstat(target, { bigint: true });
    if (gitMode(before) !== record.mode)
      throw new Error(`Tracked mode differs from HEAD: ${record.name}`);
    const blob = createHash('sha1').update(`blob ${record.bytes}\0`);
    const content = createHash('sha256');
    if (record.mode === '120000') {
      const link = await fs.readlink(target, { encoding: 'buffer' });
      if (link.length !== record.bytes)
        throw new Error(`Tracked size differs from HEAD: ${record.name}`);
      blob.update(link);
      content.update(link);
    } else {
      if (before.size !== BigInt(record.bytes))
        throw new Error(`Tracked size differs from HEAD: ${record.name}`);
      const file = await fs.open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        if (!unchanged(before, await file.stat({ bigint: true })))
          throw new Error(`Tracked file changed before reading: ${record.name}`);
        let read = 0;
        for (;;) {
          const result = await file.read(buffer, 0, buffer.length, null);
          if (!result.bytesRead) break;
          read += result.bytesRead;
          if (read > record.bytes) throw new Error(`Tracked file grew: ${record.name}`);
          blob.update(buffer.subarray(0, result.bytesRead));
          content.update(buffer.subarray(0, result.bytesRead));
        }
        if (read !== record.bytes || !unchanged(before, await file.stat({ bigint: true })))
          throw new Error(`Tracked file changed while reading: ${record.name}`);
      } finally {
        await file.close();
      }
    }
    if (!unchanged(before, await fs.lstat(target, { bigint: true })))
      throw new Error(`Tracked path changed while reading: ${record.name}`);
    if (blob.digest('hex') !== record.oid)
      throw new Error(`Tracked content differs from HEAD: ${record.name}`);
    aggregate.update(`${JSON.stringify([record.name, record.mode, content.digest('hex')])}\n`);
    record.observed = before;
    bytes += record.bytes;
    if (!Number.isSafeInteger(bytes)) throw new Error('Tracked byte count exceeds safe integer.');
  }
  // Detect a source edit/rename after an earlier file was hashed. Untracked cache
  // creation may change directory timestamps, so only directory identity matters.
  for (const record of records)
    if (!unchanged(record.observed, await fs.lstat(path.join(root, record.name), { bigint: true })))
      throw new Error(`Tracked path changed during verification: ${record.name}`);
  for (const [directory, before] of directories) {
    const after = await fs.lstat(directory, { bigint: true });
    if (!after.isDirectory() || before.dev !== after.dev || before.ino !== after.ino)
      throw new Error('Tracked parent changed during verification.');
  }
  if ((await git('rev-parse', '--verify', 'HEAD')).toString().trim() !== sourceRevision)
    throw new Error('HEAD changed during source verification.');
  return {
    format: 'revealline-source-identity.v1',
    root,
    sourceRevision,
    sourceTree,
    files: records.length,
    bytes,
    aggregateSha256: aggregate.digest('hex'),
    aggregateFormat: 'UTF-8 path sorted JSONL [path, Git mode, raw content SHA-256]',
    allTrackedSourceContentsAndModesMatch: true,
  };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || args[0] !== '--root' || !args[1]))
      throw new Error('Usage: check-source-identity.mjs [--root PATH]');
    process.stdout.write(`${JSON.stringify(await checkSourceIdentity({ root: args[1] }))}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
