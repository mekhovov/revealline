import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

export const sourceGit = (root, args) =>
  execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  }).trim();
export function frozenSource(root) {
  if (sourceGit(root, ['status', '--porcelain', '--untracked-files=normal']))
    throw new Error(
      'Candidate bundles require a clean committed source tree. Commit the reviewed inputs first.',
    );
  return {
    sourceRevision: sourceGit(root, ['rev-parse', 'HEAD']),
    sourceTree: sourceGit(root, ['rev-parse', 'HEAD^{tree}']),
  };
}
export function committedInputMap(root) {
  return new Map(
    sourceGit(root, ['ls-tree', '-rz', '--full-tree', 'HEAD'])
      .split('\0')
      .filter(Boolean)
      .map((row) => {
        const match = /^(100644|100755) blob ([a-f0-9]+)\t([\s\S]+)$/.exec(row);
        return match ? [match[3], match[2]] : [row.split('\t')[1], null];
      }),
  );
}
export function verifyCommittedInputs(files, tree) {
  for (const [name, bytes] of files) {
    const object = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    if (tree.get(name) !== object)
      throw new Error(`Selected input differs from the immutable commit: ${name}`);
  }
}
