#!/usr/bin/env node
// Authoring-only manual qualification; never imported by a player.
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import path from 'node:path';

const HOST = 'optional-practice/civilian-fpv/world-app.mjs';
const EXPECTED_HOST = '6bd30bcd11caa83ccdb36d9bb7c826a9735b5d4549bb49008494921a6a0ba4cc';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const assert = (ok, message) => {
  if (!ok) throw new Error(message);
};
const options = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i];
  assert(
    ['--player', '--artifacts', '--out'].includes(key) && process.argv[i + 1],
    'Use --player ADMITTED_DIRECTORY --artifacts QUALIFIED_DIRECTORY --out NEW_DIRECTORY',
  );
  options[key.slice(2)] = path.resolve(process.argv[i + 1]);
}
assert(Object.keys(options).length === 3, 'All three directory options are required');
const player = await fs.realpath(options.player);
const artifacts = await fs.realpath(options.artifacts);
const descriptor = await fs.readFile(path.join(player, 'optional-package.json'));
const manifest = JSON.parse(descriptor);
assert(
  manifest.id === 'fpv-worlds' && manifest.files.length === 101,
  'Expected the admitted 102-member Worlds package',
);
assert(
  manifest.engineCommit === 'd9ad2561ee1d7685ef97961478b7de30278c1e48',
  'Unexpected admitted source',
);
assert(
  manifest.files.find((f) => f.path === HOST)?.sha256 === EXPECTED_HOST,
  'Unexpected admitted host',
);
const qualificationBytes = await fs.readFile(path.join(artifacts, 'qualification.json'));
const qualification = JSON.parse(qualificationBytes);
assert(
  qualification.passed && qualification.projects === 10 && qualification.completedReplays === 20,
  'Expected the successful twenty-replay starter qualification',
);
const files = [
  ...manifest.files,
  { path: 'optional-package.json', bytes: descriptor.length, sha256: hash(descriptor) },
];
const staged = [];
async function checked(root, record) {
  assert(
    /^[a-zA-Z0-9_./-]+$/.test(record.path) &&
      !record.path.split('/').includes('..') &&
      !path.isAbsolute(record.path),
    'Unsafe source member',
  );
  const source = await fs.realpath(path.join(root, record.path));
  assert(source.startsWith(root + path.sep), 'Source member leaves its root');
  const bytes = await fs.readFile(source);
  assert(
    bytes.length === record.bytes && hash(bytes) === record.sha256,
    `Source checksum differs: ${record.path}`,
  );
  return source;
}
for (const record of files)
  staged.push({
    source: await checked(player, record),
    path: `player/${record.path}`,
    ...record,
    destination: `player/${record.path}`,
  });
for (const result of qualification.results) {
  for (const record of [
    ...Object.values(result.artifacts),
    ...result.flights.map((f) => f.proof),
  ]) {
    staged.push({
      source: await checked(artifacts, record),
      ...record,
      destination: `starters/${record.path}`,
    });
  }
}
// Refuse replacement, including prior failed fixtures. Hardlinks are never modified or chmodded.
await fs.mkdir(options.out);
for (const record of staged) {
  const destination = path.join(options.out, record.destination);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.link(record.source, destination);
}
await fs.writeFile(path.join(options.out, 'qualification.json'), qualificationBytes, {
  flag: 'wx',
});
const setup = `
window.fixtureToken=new URL(location.href).searchParams.get('token');window.fixtureErrors=[];
addEventListener('error',e=>fixtureErrors.push(e.message));addEventListener('unhandledrejection',e=>fixtureErrors.push(String(e.reason)));
Object.defineProperty(window,'localStorage',{value:parent.fixtureStorage});
const nativeIDB=window.indexedDB,dbPrefix=parent.fixtureDBPrefix;
Object.defineProperty(window,'indexedDB',{value:{
open(name,version){const full=dbPrefix+name;parent.fixtureDBNames.add(full);return version===undefined?nativeIDB.open(full):nativeIDB.open(full,version)},
deleteDatabase:name=>nativeIDB.deleteDatabase(dbPrefix+name),cmp:nativeIDB.cmp.bind(nativeIDB)
}});
Object.defineProperty(navigator,'getGamepads',{value:()=>[]});
window.fixtureDownloads=[];const blobs=new Map(),create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL),anchorClick=HTMLAnchorElement.prototype.click;
URL.createObjectURL=blob=>{const url=create(blob);blobs.set(url,blob);return url};URL.revokeObjectURL=url=>{revoke(url);blobs.delete(url)};
HTMLAnchorElement.prototype.click=function(){if(this.download&&blobs.has(this.href)){fixtureDownloads.push({name:this.download,blob:blobs.get(this.href)});return}return anchorClick.call(this)};
`;
const originalHTML = await fs.readFile(path.join(player, manifest.entry), 'utf8');
assert(
  originalHTML.includes('<head>') && originalHTML.includes('data-fpv-worlds="true"'),
  'Missing actual automatic host mount',
);
const hostHTML = originalHTML.replace(
  '<head>',
  `<head><base href="./player/optional-practice/fpv-worlds/"><script>${setup}</script>`,
);
await fs.writeFile(path.join(options.out, 'host.html'), hostHTML, { flag: 'wx' });
for (const [source, destination] of [
  ['browser-harness.html', 'index.html'],
  ['browser-harness.mjs', 'browser-harness.mjs'],
]) {
  await fs.copyFile(
    new URL(source, import.meta.url),
    path.join(options.out, destination),
    fs.constants.COPYFILE_EXCL,
  );
}
const receipt = {
  format: 'FPVCreatorStarterBrowserFixture.v1',
  sourceRevision: manifest.engineCommit,
  hostSha256: EXPECTED_HOST,
  hostHTMLSha256: hash(hostHTML),
  packageRevision: manifest.revision,
  admittedFiles: files,
  qualificationSha256: hash(qualificationBytes),
  starterFiles: staged
    .filter((f) => f.destination.startsWith('starters/'))
    .map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })),
  browserSources: await Promise.all(
    ['index.html', 'browser-harness.mjs'].map(async (file) => ({
      path: file,
      sha256: hash(await fs.readFile(path.join(options.out, file))),
    })),
  ),
  modifications: [
    'Separate host HTML adds a base URL and isolated storage/download instrumentation before the unchanged automatic mount.',
    'The native IndexedDB factory remains in the host iframe realm; only database names are prefixed. Parent read-only inspection uses its own factory with the same prefix.',
    'All admitted player files are immutable hardlinks; no module, mount guard, physics or asset changes.',
  ],
  limitations: [
    'Manual spatial drag remains necessary after stage one.',
    'Online native-IDB reopening only; no service-worker installation or offline claim.',
    'No explicit Acro spatial mode chooser is implemented.',
  ],
};
await fs.writeFile(
  path.join(options.out, 'fixture.json'),
  JSON.stringify(receipt, null, 2) + '\n',
  { flag: 'wx' },
);
console.log(
  JSON.stringify(
    {
      output: options.out,
      admittedFiles: files.length,
      starterFiles: receipt.starterFiles.length,
      hostSha256: EXPECTED_HOST,
      browserQualification: 'pending',
    },
    null,
    2,
  ),
);
