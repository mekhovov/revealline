/** Canonical production identity shared by emitted audits and browser admission. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function fingerprintDemoSources(
  root,
  directories = ['game', 'optional-practice', 'publishing'],
) {
  const paths = execFileSync('rg', ['--files', ...directories], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  })
    .trim()
    .split('\n')
    .filter(
      (p) =>
        /\.(mjs|js|json|css|html)$/.test(p) &&
        !p.includes('/test/') &&
        !p.endsWith('.test.mjs') &&
        !p.endsWith('/coverage.json'),
    )
    .sort();
  const hash = createHash('sha256');
  let bytes = 0;
  for (const name of paths) {
    const body = await readFile(path.join(root, name));
    bytes += body.length;
    hash.update(name + '\0').update(createHash('sha256').update(body).digest());
  }
  return { sha256: hash.digest('hex'), files: paths.length, bytes };
}
