// Manual data-publication qualification; does not generate flights or unit coverage.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { worldLibraryIndex } from '../../../optional-practice/civilian-fpv/world-library.mjs';
import {
  inspectPack,
  preparePack,
} from '../../../optional-practice/civilian-fpv/world-content.mjs';
import { importProofPart } from '../../../optional-practice/civilian-fpv/world-records.mjs';
import { validateWorldCourse } from '../../../optional-practice/civilian-fpv/world-model.mjs';
import { canonicalJSON } from '../../../game/data-json.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const base = '2d447bc790bdf3951251c99041c8a918363ece0a';
const mergedContent = 'd867c7f1f138ee6a0ce25ea7a4f4312928c4a40c';
const indexPath = 'authoring/fpv-worlds/published/surface-coating-v1/index.json';
const output = process.argv[2];
assert(output, 'Usage: node qualify-festival-row.mjs NEW_RECEIPT.json');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const gitBytes = (ref, path) =>
  execFileSync('git', ['show', `${ref}:${path}`], {
    cwd: root,
    maxBuffer: 4 * 1024 * 1024,
  });
const checks = [];
function check(name, condition) {
  assert(condition, name);
  checks.push({ name, passed: true });
}
const bytes = await readFile(new URL('../../../' + indexPath, import.meta.url));
const rows = worldLibraryIndex(bytes);
check(
  'Current strict parser accepts Reservoir followed by Festival',
  rows.length === 2 && rows[0].id === 'mountain-reservoir' && rows[1].id === 'festival-grounds',
);
const previous = worldLibraryIndex(gitBytes(base, indexPath));
check(
  'Published Reservoir row retains every field and immutable URL',
  canonicalJSON(previous[0]) === canonicalJSON(rows[0]),
);
const originalPath = 'authoring/fpv-worlds/published/index.json';
const original = await readFile(new URL('../../../' + originalPath, import.meta.url));
check(
  'Original cached-runtime catalogue is byte-exact and remains empty',
  original.equals(gitBytes(base, originalPath)) && worldLibraryIndex(original).length === 0,
);
const row = rows[1];
execFileSync('git', ['merge-base', '--is-ancestor', row.commit, mergedContent], { cwd: root });
execFileSync('git', ['merge-base', '--is-ancestor', mergedContent, base], { cwd: root });
check('Pinned immutable content is included in merged PR1097 and main', true);

const requests = [];
async function remote(path) {
  const url = `https://raw.githubusercontent.com/mekhovov/revealline/${row.commit}/${path}`;
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200);
  assert.equal(response.url, url);
  const data = Buffer.from(await response.arrayBuffer());
  assert(data.length < 4 * 1024 * 1024, 'Bounded publication artifact');
  requests.push({
    url,
    status: response.status,
    finalURL: response.url,
    bytes: data.length,
    sha256: sha256(data),
    etag: response.headers.get('etag'),
  });
  check(
    `Immutable HTTP bytes match committed ${path.split('/').at(-1)}`,
    data.equals(gitBytes(row.commit, path)) && data.equals(gitBytes(base, path)),
  );
  return data;
}
const prefix = row.path.slice(0, row.path.lastIndexOf('/') + 1);
const packBytes = await remote(row.path);
const manifest = JSON.parse(await remote(prefix + 'manifest.json'));
const proofBytes = await remote(prefix + manifest.files.proofs.path);
check(
  'Pack size and SHA-256 match the row and published release manifest',
  packBytes.length === row.bytes &&
    sha256(packBytes) === row.sha256 &&
    manifest.files.pack.bytes === row.bytes &&
    manifest.files.pack.sha256 === row.sha256,
);
check(
  'EN/UK titles, revision and eight-course count match release metadata',
  canonicalJSON(row.title) === canonicalJSON([manifest.title.en, manifest.title.uk]) &&
    row.revision === manifest.revision &&
    row.courses === manifest.courseCount,
);
check(
  'Proof archive retains its separate immutable size/hash and sixteen records',
  proofBytes.length === manifest.files.proofs.bytes &&
    sha256(proofBytes) === manifest.files.proofs.sha256 &&
    manifest.proofCount === 16,
);
const pack = await inspectPack(packBytes);
check(
  'Current main imports the exact Festival r5 project with eight distinct courses',
  pack.project.id === row.id &&
    pack.project.revision === row.revision &&
    pack.sha256 === row.sha256 &&
    pack.project.courses.length === 8 &&
    new Set(pack.project.courses.map((course) => course.id)).size === 8,
);
const roundtrip = Buffer.from(
  await (await preparePack(pack.project, { assets: pack.assets })).arrayBuffer(),
);
check('Pack roundtrip preserves every published byte', roundtrip.equals(packBytes));
check(
  'Festival does not require Harbor support-v1 actor movement',
  pack.project.courses.every((course) =>
    (course.actors ?? []).every((actor) => actor.groundMotion === undefined),
  ),
);
const records = await importProofPart(proofBytes.toString('utf8'));
check(
  'Checksummed archive import retains sixteen unique exact course/mode pairs',
  records.length === 16 &&
    new Set(records.map((record) => record.course.id + '/' + record.proof.mode)).size === 16,
);
for (const record of records) {
  const course = pack.project.courses.find((value) => value.id === record.course.id);
  check(
    `${record.course.id}/${record.proof.mode} retains exact pack and normalized course`,
    record.packIdentity === `fpv-pack:${row.sha256}` &&
      course &&
      canonicalJSON(validateWorldCourse(course)) === canonicalJSON(record.course) &&
      ['self-level', 'acro'].includes(record.proof.mode),
  );
}
const source = [];
for (const path of [
  'optional-practice/civilian-fpv/world-library.mjs',
  'optional-practice/civilian-fpv/world-content.mjs',
  'optional-practice/civilian-fpv/world-records.mjs',
  'optional-practice/civilian-fpv/world-model.mjs',
  'optional-practice/civilian-fpv/world-themes.mjs',
  'optional-practice/civilian-fpv/content-definitions.mjs',
  'game/data-json.mjs',
]) {
  const data = await readFile(new URL('../../../' + path, import.meta.url));
  check(`Qualification source matches frozen main: ${path}`, data.equals(gitBytes(base, path)));
  source.push({ path, bytes: data.length, sha256: sha256(data) });
}
await writeFile(
  output,
  JSON.stringify(
    {
      format: 'FPVFestivalLibraryRow.v1',
      verifiedAt: new Date().toISOString(),
      baseMain: base,
      contentMerge: mergedContent,
      index: { path: indexPath, bytes: bytes.length, sha256: sha256(bytes) },
      row,
      preservedReservoir: rows[0],
      requests,
      checks,
      source,
      limitations: [
        'Data-only catalogue change. No runtime, package, physics, course or recording bytes changed.',
        'Node HTTP/parser/import/roundtrip/dependency checks; no new flight, browser, Worker or offline run.',
        'Existing content flight/replay/native/offline qualification remains attributed to PR1097 receipts.',
        'Proofs remain a separate explicit archive import. No bundled or precached world is added.',
        'Protected publication and actual public Browse/download/install still require separate verification.',
      ],
    },
    null,
    2,
  ) + '\n',
  { flag: 'wx' },
);
console.log(
  JSON.stringify({
    checks: checks.length,
    indexBytes: bytes.length,
    packBytes: packBytes.length,
    packSHA256: row.sha256,
    output,
  }),
);
