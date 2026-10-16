import { readFile, writeFile, mkdir, link } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const [player, output, revision, kind = 'source-overlay'] = process.argv.slice(2);
if (
  !player ||
  !output ||
  !/^[a-f0-9]{40}$/.test(revision ?? '') ||
  !['source-overlay', 'admitted'].includes(kind)
)
  throw Error(
    'Usage: node prepare-browser.mjs ABS_PLAYER ABS_NEW_OUTPUT COMMIT [source-overlay|admitted]',
  );
if (![player, output].every(path.isAbsolute)) throw Error('Use absolute paths.');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const stagingBytes = await readFile(player + '.json');
const staging = JSON.parse(stagingBytes);
if (staging.files.length !== 102 || !/^[a-f0-9]{40}$/.test(staging.sourceRevision))
  throw Error('Expected a retained admitted 102-member player receipt.');
if (kind === 'admitted' && staging.sourceRevision !== revision)
  throw Error('Admitted source revision differs.');
const hostPath = 'optional-practice/civilian-fpv/world-app.mjs';
const candidateHost = execFileSync('git', ['show', revision + ':' + hostPath], {
  cwd: root,
  env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
  maxBuffer: 1024 * 1024,
});
const files = [];
await mkdir(output); // A frozen fixture is never overwritten.
for (const row of staging.files) {
  if (!/^[a-zA-Z0-9_./-]+$/.test(row.path) || row.path.split('/').includes('..'))
    throw Error('Unsafe staging path.');
  const source = path.join(player, row.path),
    bytes = await readFile(source);
  if (bytes.length !== row.bytes || sha(bytes) !== row.sha256)
    throw Error('Changed player: ' + row.path);
  const target = path.join(output, 'player', row.path);
  await mkdir(path.dirname(target), { recursive: true });
  const overlay = kind === 'source-overlay' && row.path === hostPath;
  if (overlay) await writeFile(target, candidateHost, { flag: 'wx' });
  else {
    if (row.path === hostPath && !bytes.equals(candidateHost))
      throw Error('Admitted host differs from commit.');
    await link(source, target);
  }
  const actual = overlay ? candidateHost : bytes;
  files.push({
    path: 'player/' + row.path,
    bytes: actual.length,
    sha256: sha(actual),
    provenance: overlay ? 'declared committed source overlay' : 'immutable admitted member',
  });
}
const custom = async (name, bytes) => {
  await writeFile(path.join(output, name), bytes, { flag: 'wx' });
  files.push({
    path: name,
    bytes: Buffer.byteLength(bytes),
    sha256: sha(bytes),
    provenance: 'fixture only',
  });
};
for (const name of ['index.html', 'browser-harness.mjs', 'observe.js'])
  await custom(name, await readFile(new URL(name, import.meta.url)));
const nativeHTML = await readFile(
  path.join(player, 'optional-practice/fpv-worlds/index.html'),
  'utf8',
);
await custom(
  'player/optional-practice/fpv-worlds/focus-host.html',
  nativeHTML.replace('<head>', '<head>\n    <script src="../../../observe.js"></script>'),
);
const manifest = {
  format: 'FPVPrearmFocusFixture.v1',
  kind,
  candidateRevision: revision,
  baseline: {
    sourceRevision: staging.sourceRevision,
    packageRevision: staging.packageRevision,
    stagingSha256: sha(stagingBytes),
    archive: staging.archive,
  },
  host: { bytes: candidateHost.length, sha256: sha(candidateHost) },
  files,
  limits: [
    'Native IDB and localStorage on this dedicated origin; no storage, state, renderer or clock replacement.',
    'Source overlays are functional evidence, not package admission. No offline, controller or performance claim.',
  ],
};
const bytes = JSON.stringify(manifest, null, 2) + '\n';
await writeFile(path.join(output, 'fixture.json'), bytes, { flag: 'wx' });
console.log(
  JSON.stringify({ output, fixtureSha256: sha(bytes), host: manifest.host, files: files.length }),
);
