// Manual data-publication qualification; no generated flights or added unit coverage.
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
const base = 'fba236ef80bd0310ae3b9c33fd7c26b1529b245c';
const prefix = 'authoring/fpv-worlds/published/';
const indexPath = prefix + 'ground-motion-v1/index.json';
const output = process.argv[2];
assert(output, 'Usage: node qualify-ground-library.mjs NEW_RECEIPT.json');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const gitBytes = (ref, path) =>
  execFileSync('git', ['show', `${ref}:${path}`], { cwd: root, maxBuffer: 4 * 1024 * 1024 });
const local = (path) => readFile(new URL('../../../' + path, import.meta.url));
const checks = [];
function check(name, condition) {
  assert(condition, name);
  checks.push({ name, passed: true });
}
const bytes = await local(indexPath);
const rows = worldLibraryIndex(bytes);
check(
  'Current parser accepts exactly Reservoir, Festival and Harbor',
  rows.map((row) => row.id).join(',') === 'mountain-reservoir,festival-grounds,harbor-docks',
);
for (const path of ['index.json', 'surface-coating-v1/index.json']) {
  check(
    `Older player feed remains byte-exact: ${path}`,
    (await local(prefix + path)).equals(gitBytes(base, prefix + path)),
  );
}
const previous = worldLibraryIndex(gitBytes(base, prefix + 'surface-coating-v1/index.json'));
check(
  'Every eligible older row and immutable URL survives unchanged',
  previous.every((row, i) => canonicalJSON(row) === canonicalJSON(rows[i])),
);
check(
  'Previously published ground cohort rows survive unchanged',
  worldLibraryIndex(gitBytes(base, indexPath)).every((row) =>
    rows.some((next) => canonicalJSON(next) === canonicalJSON(row)),
  ),
);
const requests = [];
async function remote(row, path) {
  const url = `https://raw.githubusercontent.com/mekhovov/revealline/${row.commit}/${path}`;
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200);
  assert.equal(response.url, url);
  const chunks = [];
  let length = 0;
  for await (const chunk of response.body) {
    length += chunk.length;
    assert(length < 4 * 1024 * 1024, 'Bounded publication artifact');
    chunks.push(chunk);
  }
  const data = Buffer.concat(chunks);
  requests.push({
    url,
    status: response.status,
    bytes: data.length,
    sha256: sha256(data),
    etag: response.headers.get('etag'),
  });
  check(
    `HTTP bytes match immutable commit and current main: ${path}`,
    data.equals(gitBytes(row.commit, path)) && data.equals(gitBytes(base, path)),
  );
  return data;
}
for (const row of rows) {
  execFileSync('git', ['merge-base', '--is-ancestor', row.commit, base], { cwd: root });
  check(`${row.id}: immutable content is already merged`, true);
  const packBytes = await remote(row, row.path);
  check(
    `${row.id}: exact listed size and SHA-256`,
    packBytes.length === row.bytes && sha256(packBytes) === row.sha256,
  );
  const pack = await inspectPack(packBytes);
  check(
    `${row.id}: listed identity, revision and eight distinct courses`,
    pack.project.id === row.id &&
      pack.project.revision === row.revision &&
      pack.sha256 === row.sha256 &&
      pack.project.courses.length === row.courses &&
      row.courses === 8 &&
      new Set(pack.project.courses.map((course) => course.id)).size === 8,
  );
  const roundtrip = Buffer.from(
    await (await preparePack(pack.project, { assets: pack.assets })).arrayBuffer(),
  );
  check(`${row.id}: lossless pack import/export`, roundtrip.equals(packBytes));
  const moving = pack.project.courses
    .flatMap((course) => course.actors ?? [])
    .filter((actor) => actor.groundMotion !== undefined);
  check(
    `${row.id}: ground-motion cohort requirement`,
    row.id === 'harbor-docks'
      ? moving.length === 2 && moving.every((actor) => actor.groundMotion === 'support-v1')
      : moving.length === 0,
  );
  const proofBytes = await remote(row, row.path.replace(/\.rlpack$/, '.proofs.json'));
  const records = await importProofPart(proofBytes.toString('utf8'));
  check(
    `${row.id}: sixteen unique course/mode dependencies`,
    records.length === 16 &&
      new Set(records.map((record) => record.course.id + '/' + record.proof.mode)).size === 16,
  );
  for (const record of records) {
    const course = pack.project.courses.find((value) => value.id === record.course.id);
    check(
      `${record.course.id}/${record.proof.mode}: exact pack and normalized course`,
      record.packIdentity === `fpv-pack:${row.sha256}` &&
        course &&
        canonicalJSON(validateWorldCourse(course)) === canonicalJSON(record.course) &&
        ['self-level', 'acro'].includes(record.proof.mode),
    );
  }
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
  const data = await local(path);
  check(`Qualification source matches frozen main: ${path}`, data.equals(gitBytes(base, path)));
  source.push({ path, bytes: data.length, sha256: sha256(data) });
}
await writeFile(
  output,
  JSON.stringify(
    {
      format: 'FPVCumulativeGroundLibrary.v1',
      verifiedAt: new Date().toISOString(),
      nodeVersion: process.version,
      baseMain: base,
      index: { path: indexPath, bytes: bytes.length, sha256: sha256(bytes) },
      rows,
      requests,
      checks,
      source,
      limitations: [
        'Data-only catalogue change; no runtime, package, physics, course or recording bytes changed.',
        'HTTP/parser/import/roundtrip and 48 exact recording dependency checks; recordings were not flown again.',
        'Historical content flight/replay/native/offline qualification remains attributed to the individual world receipts.',
        'Proof archives remain separate explicit imports, not automatic Library downloads.',
        'No fresh browser, offline, physical-device or sustained performance claim from this receipt.',
        'Protected publication and public Browse/download/install are separate verification steps.',
      ],
    },
    null,
    2,
  ) + '\n',
  { flag: 'wx' },
);
console.log(JSON.stringify({ checks: checks.length, indexBytes: bytes.length, output }));
