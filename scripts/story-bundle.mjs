import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { inspectStoryBundle, STORY_BUNDLE_LIMITS } from '../game/story-bundle.mjs';

/** Read one ordinary file into an owned bounded snapshot; growth cannot trigger
 * an unbounded readFile allocation. CLI inspection never opens IndexedDB.
 */
export async function inspectStoryFile(path) {
  const handle = await open(path, constants.O_RDONLY | (constants.O_NONBLOCK ?? 0));
  let snapshot;
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.size < 12 || before.size > STORY_BUNDLE_LIMITS.bytes)
      throw new Error('Choose an ordinary .rlstory file within the 256 MiB bound.');
    const buffer = Buffer.alloc(before.size + 1);
    let read = 0;
    while (read < buffer.length) {
      const result = await handle.read(buffer, read, buffer.length - read, read);
      if (!result.bytesRead) break;
      read += result.bytesRead;
    }
    const after = await handle.stat();
    if (read !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs)
      throw new Error('Story file changed while reading; inspect a stable copy.');
    snapshot = buffer.subarray(0, read);
  } finally {
    await handle.close();
  }
  const inspected = await inspectStoryBundle(new Blob([snapshot]));
  return {
    format: 'revealline-story-file-inspection.v1',
    status: 'METADATA_AND_ORIGINAL_BYTES_PASS',
    codec: 'NOT_TESTED',
    bytes: snapshot.length,
    sha256: createHash('sha256').update(snapshot).digest('hex'),
    stories: inspected.document.stories.length,
    availableOriginals: inspected.assets.length,
    originalBytes: inspected.assets.reduce((n, a) => n + a.blob.size, 0),
    assets: inspected.assets.map((a) => ({ sha256: a.sha256, bytes: a.blob.size })),
    notice:
      'Byte verification is not browser codec support, imported restore authority, a game award or a complete paired backup.',
  };
}
export async function main(args = process.argv.slice(2)) {
  if (args.length !== 2 || args[0] !== 'inspect' || !args[1] || args[1].startsWith('-'))
    throw new Error('Usage: node scripts/story-bundle.mjs inspect PATH.rlstory');
  process.stdout.write(`${JSON.stringify(await inspectStoryFile(args[1]), null, 2)}\n`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
