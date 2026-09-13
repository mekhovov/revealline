import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm, symlink, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import {
  validateProductionRegister,
  summarizeProduction,
  inspectProductionSlot,
  proposeProductionBinding,
  canonical,
} from '../authoring/production/model.mjs';
import { verifyProductionSources } from '../authoring/production/sources.mjs';
import { runProductionCli } from '../authoring/production/cli.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const input = 'authoring/production/register.json';
const seed = JSON.parse(await readFile(path.join(root, input), 'utf8'));
const clone = (r = seed) => JSON.parse(JSON.stringify(r));
const first = seed.bindings.find((b) => b.slotId === 'picture.pressure-orchard.fpv');
const checks = [
  'provenance',
  'decode',
  'framing',
  'reveal-contrast',
  'display-sizes',
  'source-integration',
  'full-reveal',
  'collection',
  'release',
];
function reviewed() {
  const r = clone();
  r.assessments = checks.map((check) => ({
    id: `review-${check}`,
    slotId: first.slotId,
    bindingRevision: 1,
    workId: first.workId,
    workRevision: 1,
    check,
    outcome: 'pass',
    reviewer: 'Synthetic test reviewer',
    date: '2026-09-13',
    evidence: [seed.deliveries[0].evidence],
    resolves: null,
  }));
  return r;
}
function replacement(r) {
  const w = clone(r.works.find((w) => w.id === first.workId));
  w.revision = 2;
  w.title = 'Explicit revised picture';
  w.files[0].file.sha256 = 'b'.repeat(64);
  w.derivedFrom = { workId: w.id, workRevision: 1 };
  r.works.push(w);
  return w;
}
async function fixture(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'revealline-production-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const pins = [
    ...seed.authorities,
    ...seed.works.map((w) => w.source),
    ...seed.works.flatMap((w) => w.dependencies),
    ...seed.layouts.map((l) => l.source),
    ...seed.enemies.map((e) => e.source),
    ...seed.deliveries.map((d) => d.evidence),
  ];
  for (const name of new Set(pins.map((p) => p.path))) {
    await mkdir(path.dirname(path.join(dir, name)), { recursive: true });
    await writeFile(path.join(dir, name), await readFile(path.join(root, name)));
  }
  await mkdir(path.join(dir, 'authoring/production'), { recursive: true });
  await writeFile(path.join(dir, input), JSON.stringify(seed));
  return dir;
}

test('real source cohort has 27 unique originals in nine proposed layout families, not 15 new external works', () => {
  const r = validateProductionRegister(seed),
    s = summarizeProduction(r);
  assert.deepEqual(s.maps, { target: 29, proposed: 9, approved: 0, unassigned: 20 });
  assert.equal(s.uniquePictureWorks, 27);
  assert.equal(s.domains.picture.target, 116);
  assert.equal(s.domains.picture.missing, 89);
  assert.equal(s.missingPictureSlots.filter((id) => id.includes('sentinel')).length, 9);
  assert.equal(s.missingPictureSlots.filter((id) => id.includes('unassigned')).length, 80);
  assert.deepEqual(s.historicalDelivery, { pictures: 15, stories: 1 });
  assert.equal(s.domains.story.missing, 11);
  assert.equal(s.recipeTracks, 5);
  assert.equal(s.sharedPresentationWorks, 6);
  assert.equal(s.enemyHandles, 28);
  assert.equal(s.domains.presentation.target, 56);
  assert.equal(s.domains.presentation.stages.planned, 56);
  assert.equal(s.domains.track.stages.planned, 24);
  assert.equal(s.uniqueReserveWorks, 0);
  assert(
    r.works.find((w) => w.id === first.workId).owners.length === 2,
    'same Pressure original retains old and external owners',
  );
  assert.deepEqual(
    Object.fromEntries(Object.entries(s.domains).map(([k, v]) => [k, v.stages.released])),
    { picture: 0, presentation: 0, story: 0, reserve: 0, track: 0 },
  );
  assert.deepEqual(seed.assessments, [], 'seed never invents human attestations');
  assert(Object.isFrozen(r.works[0]));
});

test('finite adapters validate all real original identities without rerunning producers or decoding', async () => {
  const m = await verifyProductionSources(seed, { root });
  assert.equal(m.metadata, 'verified');
  assert.equal(m.originalBytesVerified, false);
  assert.equal(m.originals.length, 35);
  assert(m.originals.every((f) => f.status === 'unverified'));
  const b = await verifyProductionSources(seed, { root, files: true });
  assert.equal(b.originalBytesVerified, true);
  assert(b.originals.every((f) => f.status === 'verified'));
});

test('pure browser module runs from a data URL without Node, DOM or source imports', async () => {
  const code = await readFile(
    new URL('../authoring/production/model.mjs', import.meta.url),
    'utf8',
  );
  const api = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
  assert.equal(api.summarizeProduction(seed).uniquePictureWorks, 27);
  assert.equal(canonical(seed), canonical(JSON.parse(JSON.stringify(seed))));
});

test('strict metadata rejects unknown fields, unsafe paths, duplicate identities and invalid target basis', () => {
  for (const change of [
    (r) => (r.extra = true),
    (r) => (r.works[0].source.path = '../escape'),
    (r) => (r.works[0].source.path = 'authoring//escape'),
    (r) => r.works.push(clone(r.works[0])),
    (r) => (r.basis.presentationBasis = 'enemy'),
    (r) => (r.maps[28].id = r.maps[0].id),
    (r) => (r.basis.maps = 30),
  ]) {
    const r = clone();
    change(r);
    assert.throws(() => validateProductionRegister(r));
  }
  const unsafe = clone();
  Object.defineProperty(unsafe, 'extra', {
    enumerable: true,
    get() {
      throw new Error('getter executed');
    },
  });
  assert.throws(() => validateProductionRegister(unsafe), /accessors/);
});

test('a distinct edition or explicitly declared variant cannot fill a second map slot', () => {
  const r = clone();
  r.layouts.push({ ...clone(r.layouts[0]), id: 'theme-edition', variantOf: r.layouts[0].id });
  r.maps[9] = { id: r.maps[9].id, selection: 'approved', layoutId: 'theme-edition' };
  assert.throws(() => validateProductionRegister(r), /family/);
  r.layouts[0].variantOf = 'theme-edition';
  assert.throws(() => validateProductionRegister(r), /cycle/);
});

test('picture owner is constrained to the actual planned layout and work, including theme', () => {
  const r = clone();
  r.bindings.find((b) => b.slotId === first.slotId).handle.owner = clone(
    r.works.find((w) => w.id === 'picture-crosswind-depot').owners[0],
  );
  assert.throws(() => validateProductionRegister(r), /owner/);
  const s = clone();
  s.bindings = s.bindings.filter((b) => b.slotId !== 'picture.sentinel-listening.fpv');
  const b = s.bindings.find((b) => b.slotId === first.slotId);
  b.slotId = 'picture.sentinel-listening.fpv';
  assert.throws(() => validateProductionRegister(s), /another planned layout/);
  const p = clone();
  p.bindings[0].handle.owner.themeId = 'retro';
  assert.throws(() => validateProductionRegister(p), /owner/);
});

test('replacement preserves A history and reviews but B cannot inherit them or skip its own stages', () => {
  const a = reviewed();
  assert.equal(inspectProductionSlot(a, first.slotId).stage, 'released');
  replacement(a);
  const b = proposeProductionBinding(a, {
    slotId: first.slotId,
    workId: first.workId,
    workRevision: 2,
    expectedBinding: 1,
    handle: first.handle,
  });
  const current = inspectProductionSlot(b, first.slotId);
  assert.equal(current.stage, 'produced');
  assert.equal(current.history.length, 2);
  assert.equal(current.missingChecks.length, 9);
  assert.deepEqual(b.assessments, a.assessments);
  assert.equal(a.bindings.length, 89);
  assert.equal(b.revision, 2);
  assert.throws(
    () =>
      proposeProductionBinding(b, {
        slotId: first.slotId,
        workId: first.workId,
        workRevision: 1,
        expectedBinding: 1,
        handle: first.handle,
      }),
    /stale/,
  );
  const wrong = clone(b);
  wrong.assessments[0].bindingRevision = 2;
  assert.throws(() => validateProductionRegister(wrong), /exact binding\/work/);
});

test('append-only revision comparison refuses identity edits and removed history', () => {
  const old = reviewed();
  replacement(old);
  const next = proposeProductionBinding(old, {
    slotId: first.slotId,
    workId: first.workId,
    workRevision: 2,
    expectedBinding: 1,
    handle: first.handle,
  });
  for (const change of [
    (r) => (r.works[0].files[0].file.sha256 = 'e'.repeat(64)),
    (r) => r.assessments.shift(),
    (r) => (r.deliveries[0].title = 'rewritten'),
    (r) => (r.layouts[0].title = 'rewritten'),
    (r) => (r.works[0].dependencies[0].sha256 = 'f'.repeat(64)),
  ]) {
    const r = clone(next);
    change(r);
    assert.throws(() => validateProductionRegister(r, { previous: old }), /history/);
  }
  const gap = clone(next);
  gap.bindings.pop();
  gap.bindings.push({ ...clone(first), revision: 3, previous: 2 });
  assert.throws(() => validateProductionRegister(gap), /history/);
});

test('an unresolved failure blocks stage promotion even when another pass exists', () => {
  const r = reviewed();
  r.assessments.push({
    ...clone(r.assessments[0]),
    id: 'failed-framing',
    check: 'framing',
    outcome: 'fail',
  });
  assert.equal(inspectProductionSlot(r, first.slotId).stage, 'produced');
  r.assessments.push({
    ...clone(r.assessments[0]),
    id: 'fixed-framing',
    check: 'framing',
    resolves: 'failed-framing',
  });
  assert.equal(inspectProductionSlot(r, first.slotId).stage, 'released');
  r.assessments.at(-1).date = '2026-02-30';
  assert.throws(() => validateProductionRegister(r), /date/);
});

test('shared original bytes and recompressed derivatives cannot inflate selected/reserve totals', () => {
  const r = clone();
  const w = replacement(r);
  const proposal = proposeProductionBinding(r, {
    slotId: 'reserve.1',
    workId: w.id,
    workRevision: 2,
    expectedBinding: null,
    handle: { kind: 'reserve' },
  });
  let s = summarizeProduction(proposal);
  assert.equal(s.uniquePictureWorks, 27);
  assert.equal(s.uniqueReserveWorks, 0);
  assert.equal(s.reserveOverlap, 1);
  const copy = clone();
  const extra = clone(copy.works[0]);
  extra.id = 'renamed-identical-original';
  copy.works.push(extra);
  const dup = proposeProductionBinding(copy, {
    slotId: 'reserve.1',
    workId: extra.id,
    workRevision: 1,
    expectedBinding: null,
    handle: { kind: 'reserve' },
  });
  s = summarizeProduction(dup);
  assert.equal(s.uniqueReserveWorks, 0);
  assert.equal(s.reserveOverlap, 1);
});

test('metadata remains inspectable when originals are missing; byte verification reports unavailable', async (t) => {
  const dir = await fixture(t);
  const m = await verifyProductionSources(seed, { root: dir });
  assert.equal(m.metadata, 'verified');
  assert.equal(m.originalBytesVerified, false);
  const b = await verifyProductionSources(seed, { root: dir, files: true });
  assert.equal(b.originalBytesVerified, false);
  assert(b.originals.every((f) => f.status === 'unavailable'));
  assert.equal(summarizeProduction(seed).uniquePictureWorks, 27);
});

test('changed metadata, forged ownership and symlinked sources refuse without executing a module', async (t) => {
  const dir = await fixture(t);
  const pathname = path.join(dir, 'game/content/classes.json');
  await writeFile(pathname, '[]');
  await assert.rejects(verifyProductionSources(seed, { root: dir }), /changed authority/);
  await rm(pathname);
  await symlink(path.join(root, 'game/content/classes.json'), pathname);
  await assert.rejects(verifyProductionSources(seed, { root: dir }), /Symlink/);
  const r = clone();
  r.works[0].owners.pop();
  await assert.rejects(verifyProductionSources(r, { root }), /owners changed/);
  const b = clone();
  b.bindings.find((x) => x.slotId === 'presentation.carrier.fpv.compact').workId = 'rig-fpv-body';
  b.bindings.find((x) => x.slotId === 'presentation.carrier.fpv.compact').handle.bodyId =
    'fpv-body';
  await assert.rejects(verifyProductionSources(b, { root }), /does not serve/);
});

test('CLI produces one exclusive proposal, preserves input, and refuses overwrites and stale revisions', async (t) => {
  const dir = await fixture(t),
    original = await readFile(path.join(dir, input));
  let output = '';
  const args = [
    'propose-binding',
    input,
    '--root',
    dir,
    '--slot',
    'reserve.1',
    '--work',
    first.workId,
    '--revision',
    '1',
    '--expected-binding',
    'none',
    '--handle',
    '{"kind":"reserve"}',
    '--out',
    'authoring/production/proposal.json',
  ];
  await runProductionCli(args, { write: (s) => (output += s) });
  assert.match(output, /proposal only/);
  const proposed = JSON.parse(await readFile(path.join(dir, 'authoring/production/proposal.json')));
  assert.equal(proposed.revision, 2);
  assert.equal(proposed.bindings.at(-1).slotId, 'reserve.1');
  assert.deepEqual(await readFile(path.join(dir, input)), original);
  const before = await readFile(path.join(dir, 'authoring/production/proposal.json'));
  await assert.rejects(runProductionCli(args, { write: () => {} }), /EEXIST/);
  assert.deepEqual(await readFile(path.join(dir, 'authoring/production/proposal.json')), before);
  const stale = [...args];
  stale[1] = 'authoring/production/proposal.json';
  stale[stale.indexOf('--out') + 1] = 'authoring/production/stale.json';
  await assert.rejects(runProductionCli(stale, { write: () => {} }), /stale/);
  assert(!(await readdir(path.join(dir, 'authoring/production'))).includes('stale.json'));
});

test('CLI report reads metadata only; traversal and wrong options never create output', async (t) => {
  const dir = await fixture(t);
  let output = '';
  await runProductionCli(['report', input, '--root', dir, '--json'], {
    write: (s) => (output += s),
  });
  assert.equal(JSON.parse(output).uniquePictureWorks, 27);
  for (const args of [
    ['report', '../escape', '--root', dir],
    ['report', input, '--root', dir, '--files'],
    ['inspect', input, '--root', dir, '--slot', 'not-a-slot'],
  ])
    await assert.rejects(runProductionCli(args, { write: () => {} }));
  const original = await readFile(path.join(dir, input));
  await symlink(path.join(dir, input), path.join(dir, 'authoring/production/link.json'));
  await assert.rejects(
    runProductionCli(['report', 'authoring/production/link.json', '--root', dir], {
      write: () => {},
    }),
    /Symlink/,
  );
  assert.equal(
    createHash('sha256')
      .update(await readFile(path.join(dir, input)))
      .digest('hex'),
    createHash('sha256').update(original).digest('hex'),
  );
});

test('renamed shared recipes and another segment of one movie do not inflate unique works', () => {
  const r = clone();
  const body = clone(r.works.find((w) => w.id === 'rig-scout-quad'));
  body.id = 'renamed-rig';
  r.works.push(body);
  const b = r.bindings.find((b) => b.slotId === 'presentation.scout.fpv.compact');
  b.workId = body.id;
  assert.equal(summarizeProduction(r).sharedPresentationWorks, 6);
  const recipe = clone(r.works.find((w) => w.kind === 'track'));
  recipe.id = 'renamed-track';
  r.works.push(recipe);
  assert.equal(summarizeProduction(r).recipeTracks, 5);
  const story = clone(r.works.find((w) => w.kind === 'story'));
  story.id = 'another-segment';
  r.works.push(story);
  r.bindings.push({
    slotId: 'story.fpv.2',
    revision: 1,
    previous: null,
    workId: story.id,
    workRevision: 1,
    handle: clone(r.bindings.find((b) => b.slotId === 'story.fpv.1').handle),
  });
  const report = summarizeProduction(r);
  assert.equal(report.domains.story.bound, 2);
  assert.equal(report.uniqueStoryWorks, 1);
  assert.equal(report.qualifiedStoryWorks, 0);
});

test('movie facts and original dimensions cannot be changed under the same source identity', async () => {
  const r = clone();
  r.works.find((w) => w.adapter === 'dawn').files[0].durationSeconds = 4;
  await assert.rejects(verifyProductionSources(r, { root }), /duration differ/);
  const p = clone();
  p.works.find((w) => w.adapter === 'route').files[0].width = 1;
  await assert.rejects(verifyProductionSources(p, { root }), /dimensions differ/);
});

test('CLI previous-register comparison preserves exact prior work identity', async (t) => {
  const dir = await fixture(t),
    next = clone();
  next.revision = 2;
  const w = clone(next.works[0]);
  w.revision = 2;
  w.title = 'New revision, same retained original';
  next.works.push(w);
  await writeFile(path.join(dir, 'authoring/production/candidate.json'), JSON.stringify(next));
  const args = [
    'validate',
    'authoring/production/candidate.json',
    '--root',
    dir,
    '--previous',
    input,
  ];
  await runProductionCli(args, { write: () => {} });
  next.works[0].title = 'Overwritten old identity';
  await writeFile(path.join(dir, 'authoring/production/candidate.json'), JSON.stringify(next));
  await assert.rejects(runProductionCli(args, { write: () => {} }), /immutable history/);
});

test('existing produced raster manifest works without a second media store and preserves derivative parent', async () => {
  const r = clone(),
    name = 'authoring/library/round-06-fpv/media.json',
    bytes = await readFile(path.join(root, name)),
    media = JSON.parse(bytes);
  const source = {
    path: name,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
  const original = media.assets.find((a) => a.kind === 'original' && a.status === 'imported'),
    derived = media.assets.find(
      (a) => a.kind === 'derivative' && a.provenance.parentAssetId === original.id,
    );
  assert(original && derived);
  for (const a of [original, derived])
    r.works.push({
      id: `existing-${a.id}`,
      revision: 1,
      kind: 'picture',
      title: a.id,
      themeId: 'fpv',
      source,
      sourceId: a.id,
      adapter: 'authored',
      dependencies: [],
      owners: [],
      derivedFrom: a === derived ? { workId: `existing-${original.id}`, workRevision: 1 } : null,
      files: [
        {
          role: 'original',
          file: {
            path: path.posix.join(path.posix.dirname(name), a.file.path),
            bytes: a.file.bytes,
            sha256: a.file.sha256,
          },
          width: a.file.width,
          height: a.file.height,
          durationSeconds: null,
        },
      ],
    });
  const actual = await verifyProductionSources(r, { root });
  assert.equal(actual.metadata, 'verified');
  assert.equal(summarizeProduction(r).uniquePictureWorks, 27);
  r.works.at(-1).derivedFrom = null;
  await assert.rejects(verifyProductionSources(r, { root }), /derivative parent differs/);
});

test('historical originals with conflicting identities at one path reject before inventory dedupe', async (t) => {
  const dir = await fixture(t),
    r = clone(),
    where = 'authoring/production/conflict';
  await mkdir(path.join(dir, where), { recursive: true });
  const prior = seed.works.find((w) => w.id === first.workId).files[0],
    later = seed.works.find((w) => w.id === 'picture-courtyard-exits').files[0];
  await writeFile(
    path.join(dir, where, 'original.png'),
    await readFile(path.join(root, later.file.path)),
  );
  for (const [i, original] of [prior, later].entries()) {
    const manifest = {
      mediaVersion: '1.0.0',
      assets: [
        {
          id: 'original',
          kind: 'original',
          status: 'imported',
          file: {
            ...original.file,
            path: 'original.png',
            width: original.width,
            height: original.height,
          },
        },
      ],
    };
    const bytes = Buffer.from(JSON.stringify(manifest)),
      name = `${where}/revision-${i + 1}.json`;
    await writeFile(path.join(dir, name), bytes);
    r.works.push({
      id: 'retained-original',
      revision: i + 1,
      kind: 'picture',
      title: `Historical revision ${i + 1}`,
      themeId: 'fpv',
      source: {
        path: name,
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      },
      sourceId: 'original',
      adapter: 'authored',
      dependencies: [],
      owners: [],
      derivedFrom: null,
      files: [{ ...clone(original), file: { ...original.file, path: `${where}/original.png` } }],
    });
  }
  assert.equal(
    validateProductionRegister(r).works.length,
    41,
    'both immutable revisions are retained',
  );
  await assert.rejects(verifyProductionSources(r, { root: dir }), /Conflicting original identity/);
  await assert.rejects(
    verifyProductionSources(r, { root: dir, files: true }),
    /Conflicting original identity/,
  );
});
