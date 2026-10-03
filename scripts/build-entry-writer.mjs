import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';

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
      (await fs.readFile(source)).equals(expected)
    ) {
      await fs.copyFile(source, target, constants.COPYFILE_FICLONE_FORCE);
      // A source edit between comparison and cloning cannot alter the accepted
      // build. The clone is checked before staging can become a published tree.
      if ((await fs.readFile(target)).equals(expected)) return;
    }
  } catch {
    // Missing generated sources, unsupported reflinks and copy failures all
    // retain the original byte writer. Its errors remain visible to the caller.
  }
  await fs.writeFile(target, expected);
}
