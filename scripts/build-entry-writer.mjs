import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import { execFile } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';

const runFile = promisify(execFile);

/** Bound filesystem round trips on network output volumes. All owned writes
 * settle before returning an error, so the caller can safely remove staging.
 * Directory promises are shared; accepted bytes and ZIP ordering are unchanged. */
export async function writeBuildEntries(
  root,
  staging,
  entries,
  { mkdir = fs.mkdir, writeEntry = writeBuildEntry } = {},
) {
  const directories = new Map();
  let next = 0,
    failure;
  const worker = async () => {
    while (!failure && next < entries.length) {
      const entry = entries[next++];
      try {
        const target = join(staging, entry.name),
          parent = dirname(target);
        if (!directories.has(parent))
          directories.set(
            parent,
            Promise.resolve().then(() => mkdir(parent, { recursive: true })),
          );
        await directories.get(parent);
        // A different worker may have failed while this parent was pending.
        if (!failure) await writeEntry(join(root, entry.name), target, entry.bytes);
      } catch (error) {
        failure ??= { error };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, entries.length) }, worker));
  if (failure) throw failure.error;
}

export function canCloneBuildEntry(source, destinationDirectory) {
  return (
    Number.isSafeInteger(source?.dev) && source.dev >= 0 && source.dev === destinationDirectory?.dev
  );
}

/** Preserve exact prepared bytes while avoiding duplicate asset blocks on
 * copy-on-write filesystems. Clones are independent files, never hardlinks.
 * Unsupported filesystems and generated/changed entries use ordinary writes. */
export async function writeBuildEntry(source, target, bytes) {
  const expected = Buffer.from(bytes);
  try {
    const stat = await fs.lstat(source);
    if (
      stat.isFile() &&
      stat.size === expected.length &&
      canCloneBuildEntry(stat, await fs.stat(dirname(target))) &&
      (await fs.readFile(source)).equals(expected)
    ) {
      // Node's forced-reflink copy returns ENOSYS on macOS. Its native cp uses
      // clonefile(2), with independent copies and a normal-copy fallback.
      if (process.platform === 'darwin')
        await runFile('/bin/cp', ['-c', resolve(source), resolve(target)]);
      else await fs.copyFile(source, target, constants.COPYFILE_FICLONE_FORCE);
      // A source edit between comparison and cloning cannot alter the accepted
      // build. The clone is checked before staging can become a published tree.
      if ((await fs.readFile(target)).equals(expected)) return;
    }
  } catch {
    // Cross-volume copies cannot clone. Missing sources, unsupported reflinks
    // and failures retain the original byte writer; its errors remain visible.
  }
  await fs.writeFile(target, expected);
}
