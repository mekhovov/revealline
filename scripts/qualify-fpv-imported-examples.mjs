#!/usr/bin/env node
/** Manual functional preparation; uses the actual private lookup and retained ordinary controls. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { parse } from 'acorn';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dataIdentity } from '../game/data-json.mjs';
import { WORLD_CATALOGUE } from '../optional-practice/civilian-fpv/world-catalogue.mjs';
import { WORLD_DEMONSTRATIONS } from '../optional-practice/civilian-fpv/world-demonstrations.mjs';
import { WORLD_COLLISION_BACKEND } from '../optional-practice/civilian-fpv/world-collision.mjs';
import {
  validateWorldCourse,
  replayWorldFlight,
  WORLD_FLIGHT_MODEL,
} from '../optional-practice/civilian-fpv/world-model.mjs';
import { responseIdentity } from '../optional-practice/civilian-fpv/radio-profile.mjs';
import { inspectPack, preparePack } from '../optional-practice/civilian-fpv/world-content.mjs';
import {
  exportProofParts,
  importProofPart,
  worldRecordIdentity,
} from '../optional-practice/civilian-fpv/world-records.mjs';

const args = process.argv.slice(2),
  opts = {};
for (let i = 0; i < args.length; i += 2) {
  assert(['--starter', '--out'].includes(args[i]) && args[i + 1]);
  opts[args[i].slice(2)] = path.resolve(args[i + 1]);
}
assert(opts.starter && opts.out, 'Required --starter retained-r5-directory --out NEW_DIRECTORY');
const root = fileURLToPath(new URL('../', import.meta.url)),
  hostPath = 'optional-practice/civilian-fpv/world-app.mjs',
  source = await readFile(path.join(root, hostPath), 'utf8'),
  baseline = execFileSync('git', ['show', '5931ef12678cc52ab332fbbfe5516ad93a60caa9:' + hostPath], {
    cwd: root,
  }).toString(),
  hash = (bytes) => createHash('sha256').update(bytes).digest('hex'),
  checks = [],
  files = [],
  replays = [];
function check(name, value) {
  checks.push({ name, passed: Boolean(value) });
  assert(value, name);
}
function lookup(text, records = []) {
  const wanted = new Map();
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (
      node.type === 'FunctionDeclaration' &&
      ['demonstrationFor', 'demonstrationEntry'].includes(node.id.name)
    )
      wanted.set(node.id.name, text.slice(node.start, node.end));
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  }
  visit(parse(text, { sourceType: 'module', ecmaVersion: 'latest' }));
  assert.equal(wanted.size, 2);
  return runInNewContext([...wanted.values()].join('\n') + '\ndemonstrationFor', {
    records,
    demonstrationCache: new WeakMap(),
    WORLD_DEMONSTRATIONS,
    dataIdentity,
    validateWorldCourse,
    WORLD_FLIGHT_MODEL,
    WORLD_COLLISION_BACKEND,
    responseIdentity,
  });
}
await mkdir(opts.out);
async function save(name, value) {
  const bytes = value instanceof Uint8Array ? value : Buffer.from(JSON.stringify(value));
  await writeFile(path.join(opts.out, name), bytes, { flag: 'wx' });
  files.push({ path: name, bytes: bytes.length, sha256: hash(bytes) });
}
const receipt = {
  format: 'FPVImportedExamplesPreparation.v1',
  sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root }).toString().trim(),
  candidateHostSha256: hash(source),
  baselineHostSha256: hash(baseline),
  runtimeGrowthBytes: Buffer.byteLength(source) - Buffer.byteLength(baseline),
  checks,
  replays,
  files,
};
try {
  const originalPack = await readFile(
    path.join(opts.starter, 'creator-industrial-split-level.rlpack'),
  );
  check(
    'retained D4 original pack exact',
    originalPack.length === 17072 &&
      hash(originalPack) === '311b04890037f6b5681dd1fd0067f72292a888bfd2e8cb5b605e8de707aa8711',
  );
  const installed = await inspectPack(originalPack),
    course = validateWorldCourse(installed.project.courses[0]),
    entry = {
      id: course.id,
      course,
      projectId: installed.project.id,
      packIdentity: 'fpv-pack:' + installed.sha256,
      legacy: false,
    },
    records = [];
  await save('original.rlpack', originalPack);
  for (const mode of ['self-level', 'acro']) {
    const bytes = await readFile(path.join(opts.starter, course.id + '-' + mode + '.proof.json')),
      original = JSON.parse(bytes),
      proof = { ...original, session: 'demonstration' };
    check(
      mode + ' original ordinary-control authoring proof',
      original.session === 'authoring' && original.mode === mode && original.course === course.id,
    );
    const result = await replayWorldFlight(course, proof);
    check(
      mode + ' converted demonstration completes exact replay',
      result.state.status === 'complete' && result.state.ticks === proof.frames.length,
    );
    check(
      mode + ' controls and final identity retained',
      dataIdentity(proof.frames) === dataIdentity(original.frames) &&
        proof.finalStateIdentity === original.finalStateIdentity,
    );
    const record = {
      id: worldRecordIdentity({ course, proof }),
      course,
      proof,
      packIdentity: entry.packIdentity,
      savedAt: 1,
      status: 'verified',
      diagnostic: 'complete',
      pinned: false,
    };
    records.push(record);
    replays.push({
      mode,
      originalBytes: bytes.length,
      originalSha256: hash(bytes),
      frames: proof.frames.length,
      finalStateIdentity: proof.finalStateIdentity,
      state: result.state,
    });
  }
  const parts = await exportProofParts(records);
  check(
    'bounded two-record transport has one part',
    parts.length === 1 && parts[0].records.length === 2,
  );
  const restored = await importProofPart(parts[0]);
  check(
    'transport does not trust verified flags',
    restored.every((r) => r.status === 'missing-dependency'),
  );
  await save('valid-examples.json', parts[0]);
  for (const record of records) {
    check(
      record.proof.mode + ' baseline lookup excludes installed example',
      lookup(baseline, records)(entry, record.proof.mode) === null,
    );
    check(
      record.proof.mode + ' candidate lookup selects exact installed example',
      lookup(source, records)(entry, record.proof.mode) === record.proof,
    );
  }
  const one = records[0],
    mode = one.proof.mode;
  for (const [name, mutate] of [
    [
      'missing dependency',
      (r) => {
        r.status = 'missing-dependency';
      },
    ],
    [
      'invalid recording',
      (r) => {
        r.status = 'invalid';
      },
    ],
    [
      'incomplete flight',
      (r) => {
        r.diagnostic = 'active';
      },
    ],
    [
      'wrong pack SHA',
      (r) => {
        r.packIdentity = 'fpv-pack:' + '0'.repeat(64);
      },
    ],
    [
      'wrong course revision',
      (r) => {
        r.course.revision = 'r2';
      },
    ],
    [
      'wrong course ID',
      (r) => {
        r.proof.course = 'another-course';
      },
    ],
    [
      'wrong mode',
      (r) => {
        r.proof.mode = 'acro';
      },
    ],
    [
      'non-demonstration session',
      (r) => {
        r.proof.session = 'practice';
      },
    ],
    [
      'wrong response identity',
      (r) => {
        r.proof.responseIdentity = 'wrong';
      },
    ],
    [
      'altered response controls',
      (r) => {
        r.proof.response.expo++;
      },
    ],
    [
      'wrong runtime model',
      (r) => {
        r.proof.model = 'wrong';
      },
    ],
    [
      'wrong collision backend',
      (r) => {
        r.proof.backend = 'wrong';
      },
    ],
  ]) {
    const bad = structuredClone(one);
    mutate(bad);
    check(name + ' unavailable', lookup(source, [bad])(entry, mode) === null);
    check(
      name + ' does not hide later genuine proof',
      lookup(source, [bad, one])(entry, mode) === one.proof,
    );
  }
  const shared = lookup(source, records),
    other = { ...entry, packIdentity: 'fpv-pack:' + '1'.repeat(64) };
  check('shared course object exact first pack cache', shared(entry, mode) === one.proof);
  check('shared course object distinct pack cache', shared(other, mode) === null);
  check('shared course object original cache remains exact', shared(entry, mode) === one.proof);
  check(
    'authoring draft cannot offer installed example',
    lookup(source, [{ ...one, packIdentity: 'authoring' }])(
      { ...entry, packIdentity: 'authoring' },
      mode,
    ) === null,
  );
  const builtIn = WORLD_CATALOGUE.find((e) => e.id === 'woodland-08'),
    copied = {
      ...builtIn,
      projectId: 'copied-builtin',
      packIdentity: 'fpv-pack:' + '2'.repeat(64),
    };
  receipt.builtinControl = { id: builtIn.id, title: builtIn.course.locales.en.title };
  check('built-in example retained', Boolean(lookup(source)(builtIn, mode)));
  check('baseline copied project borrows bundled example', Boolean(lookup(baseline)(copied, mode)));
  check(
    'candidate copied project cannot borrow bundled example',
    lookup(source)(copied, mode) === null,
  );
  const cacheBoundary = lookup(source);
  check('builtin shared course object first cached', Boolean(cacheBoundary(builtIn, mode)));
  check(
    'project cannot reuse builtin cache with same object and pack label',
    cacheBoundary({ ...builtIn, projectId: 'copied-builtin' }, mode) === null,
  );
  const revision = structuredClone(installed.project);
  revision.title += ' · revision B';
  await save(
    'revision-b.rlpack',
    new Uint8Array(await (await preparePack(revision, { assets: installed.assets })).arrayBuffer()),
  );
  const copyProject = {
    format: 'FPVWorldProject.v1',
    id: 'copied-builtin',
    title: 'Copied built-in dependency control',
    world: { id: builtIn.course.world.id, title: 'Copied built-in dependency control' },
    courses: [builtIn.course],
    source: { hash: null, anchors: [], colliders: [] },
    overrides: {},
    themes: [],
    campaigns: [],
    playlists: [],
    provenance: [],
  };
  await save(
    'copied-builtin.rlpack',
    new Uint8Array(await (await preparePack(copyProject)).arrayBuffer()),
  );
  const invalid = structuredClone(one);
  invalid.proof.responseIdentity = 'invalid';
  invalid.id = worldRecordIdentity(invalid);
  const missing = structuredClone(records[1]);
  missing.packIdentity = 'fpv-pack:' + '0'.repeat(64);
  missing.proof.finalStateIdentity = 'missing-pack-fixture';
  missing.id = worldRecordIdentity(missing);
  await save('unavailable-examples.json', (await exportProofParts([invalid, missing]))[0]);
  receipt.course = course;
  receipt.projectId = entry.projectId;
  receipt.packIdentity = entry.packIdentity;
  receipt.passed = true;
} catch (error) {
  receipt.passed = false;
  receipt.error = error.stack;
  process.exitCode = 1;
}
await writeFile(path.join(opts.out, 'preparation.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(
  JSON.stringify(
    {
      output: opts.out,
      passed: receipt.passed,
      checks: checks.length,
      growth: receipt.runtimeGrowthBytes,
      replays: replays.map((r) => ({ mode: r.mode, frames: r.frames })),
      error: receipt.error,
    },
    null,
    2,
  ),
);
