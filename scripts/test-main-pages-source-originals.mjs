import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { applyPublicationProfile } from './game-cli.mjs';
import {
  mainPagesSourceOriginals,
  readCurrentArtSourceMetadata,
} from './main-pages-source-originals.mjs';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const file = (name, text) => ({ name, bytes: Buffer.from(text) });
const pin = (entry) => ({ path: entry.name, bytes: entry.bytes.length, sha256: hash(entry.bytes) });
function fixture() {
  const original = file('authoring/pictures/exact.png', 'exact PNG bytes'),
    fallback = file('optional/pack.json', 'native pack'),
    unavailable = file('authoring/pictures/unavailable.png', 'preserved PNG'),
    archived = file('optional/archive.json', 'archived native pack');
  const source = {
    id: 'exact',
    sourceImagePath: original.name,
    image: pin(original),
    kind: 'embedded',
    source: pin(fallback),
  };
  const sources = [
    source,
    {
      id: 'unavailable',
      sourceImagePath: unavailable.name,
      image: pin(unavailable),
      kind: 'embedded',
      source: pin(archived),
    },
  ];
  const entries = [
    original,
    fallback,
    unavailable,
    archived,
    file(
      'game/presentation/current-art-sources.mjs',
      `export const CURRENT_ART_SOURCES = ${JSON.stringify(sources)};`,
    ),
  ];
  const catalogue = {
    groups: [
      {
        id: 'tooling:workshop',
        category: 'tooling',
        requires: [],
        files: [original.name, unavailable.name],
      },
      { id: 'chapter:current', category: 'chapter', requires: [], files: [fallback.name] },
      { id: 'archive:old', category: 'archive', requires: [], files: [archived.name] },
    ],
    files: [original, fallback, unavailable, archived].map(pin),
    missions: [],
  };
  return { original, fallback, unavailable, archived, source, sources, entries, catalogue };
}

test('main-pages removes only a registered redundant original and retains offline fallback ownership', () => {
  const f = fixture();
  const audit = mainPagesSourceOriginals(f.entries, f.catalogue, new Set([f.archived.name]));
  assert.deepEqual([...audit.paths], [f.original.name]);
  assert.match(
    audit.candidates.find((row) => row.path === f.unavailable.name).reasons.join(' '),
    /not retained/,
  );
  applyPublicationProfile(f.entries, f.catalogue, 'main-pages', null);
  assert.ok(!f.entries.some((row) => row.name === f.original.name));
  assert.ok(f.entries.some((row) => row.name === f.unavailable.name));
  assert.deepEqual(
    f.catalogue.groups.find((row) => row.id === 'tooling:workshop').files.sort(),
    [f.fallback.name, f.unavailable.name].sort(),
  );
  assert.deepEqual(
    f.catalogue.files.map((row) => row.path).sort(),
    [f.fallback.name, f.unavailable.name].sort(),
  );
});

test('complete releases keep authored originals and original download groups untouched', () => {
  const f = fixture(),
    before = structuredClone({ entries: f.entries.map((row) => row.name), catalogue: f.catalogue });
  applyPublicationProfile(f.entries, f.catalogue, null, null);
  assert.deepEqual(
    f.entries.map((row) => row.name),
    before.entries,
  );
  assert.deepEqual(f.catalogue, before.catalogue);
});

test('other consumers or owners, stale images, and missing/mismatched fallback bodies preserve originals', () => {
  for (const alter of [
    (f) => f.entries.push(file('game/other.mjs', `fetch('${f.original.name}')`)),
    (f) => f.entries.push(file('game/other.json', JSON.stringify({ image: f.original.name }))),
    (f) => f.catalogue.groups[1].files.push(f.original.name),
    (f) => {
      f.original.bytes = Buffer.from('changed PNG');
    },
    (f) => {
      f.fallback.bytes = Buffer.from('changed native pack');
    },
    (f) => {
      f.entries = f.entries.filter((row) => row.name !== f.fallback.name);
    },
    (f) => {
      f.catalogue.files = f.catalogue.files.filter((row) => row.path !== f.fallback.name);
    },
  ]) {
    const f = fixture();
    alter(f);
    assert.equal(
      mainPagesSourceOriginals(f.entries, f.catalogue).paths.has(f.original.name),
      false,
    );
  }
});

test('all native owners must retain an exact fallback before a shared original may be omitted', () => {
  const f = fixture();
  f.sources.push({ ...f.source, id: 'second-owner', source: pin(f.archived) });
  f.entries.find((row) => row.name.endsWith('current-art-sources.mjs')).bytes = Buffer.from(
    `export const CURRENT_ART_SOURCES = ${JSON.stringify(f.sources)};`,
  );
  const audit = mainPagesSourceOriginals(f.entries, f.catalogue, new Set([f.archived.name]));
  assert.equal(audit.paths.has(f.original.name), false);
  assert.equal(audit.candidates.find((row) => row.path === f.original.name).descriptors.length, 2);
});

test('emitted source catalog parsing admits static metadata and never evaluates executable expressions', () => {
  const rows = readCurrentArtSourceMetadata(
    Buffer.from(
      "export const CURRENT_ART_SOURCES = [{id:'one', level:{x:-2}, nil:null, yes:true}];",
    ),
  );
  assert.equal(rows[0].level.x, -2);
  for (const source of [
    'export const CURRENT_ART_SOURCES = globalThis.run();',
    'export const CURRENT_ART_SOURCES = [{id:"one", get body() { return 1; }}];',
    'export const CURRENT_ART_SOURCES = [{id:"one", id:"two"}];',
    'export const CURRENT_ART_SOURCES = [{id:"one"},{id:"one"}];',
    'export const CURRENT_ART_SOURCES = []; throw new Error("execute");',
  ])
    assert.throws(
      () => readCurrentArtSourceMetadata(Buffer.from(source)),
      /Main Pages original projection/,
    );
  assert.deepEqual([...mainPagesSourceOriginals([], { files: [], groups: [] }).paths], []);
});

test('retained authoring registers cannot lose their original without the shared native reader', () => {
  const f = fixture();
  f.entries.push(
    file('authoring/production/register.json', JSON.stringify({ file: pin(f.original) })),
  );
  let audit = mainPagesSourceOriginals(f.entries, f.catalogue);
  assert.equal(audit.paths.has(f.original.name), false);
  assert.match(audit.candidates[0].reasons.join(' '), /shared resolver/);
  f.entries.push(
    file(
      'authoring/production/preview.mjs',
      "import { findCurrentArtOriginal, readCurrentArtImage } from '../../game/presentation/current-art.mjs';",
    ),
    file(
      'game/presentation/current-art.mjs',
      'export function findCurrentArtOriginal(){}; export function readCurrentArtImage(){};',
    ),
  );
  audit = mainPagesSourceOriginals(f.entries, f.catalogue);
  assert.equal(audit.paths.has(f.original.name), true);
});

test('an image pin cannot redirect the original identity or use the omitted original as fallback', () => {
  for (const corrupt of [
    (f) => {
      f.source.image = pin(f.fallback);
    },
    (f) => {
      f.source.source = pin(f.original);
    },
  ]) {
    const f = fixture();
    corrupt(f);
    f.entries.find((row) => row.name === 'game/presentation/current-art-sources.mjs').bytes =
      Buffer.from(`export const CURRENT_ART_SOURCES = ${JSON.stringify(f.sources)};`);
    assert.equal(
      mainPagesSourceOriginals(f.entries, f.catalogue).paths.has(f.original.name),
      false,
    );
  }
});

test('omitted-original callback reports only actual admitted removals and is absent for complete releases', () => {
  const f = fixture(),
    observed = [];
  applyPublicationProfile(f.entries, f.catalogue, 'main-pages', null, {
    onOmittedSourceOriginals(paths) {
      observed.push(paths);
    },
  });
  assert.deepEqual(observed, [[f.original.name]]);
  for (const name of observed[0]) {
    assert(!f.entries.some((entry) => entry.name === name));
    assert(!f.catalogue.files.some((file) => file.path === name));
  }
  observed[0].push('authoring/observer-only.png');
  const next = fixture(),
    second = [];
  applyPublicationProfile(next.entries, next.catalogue, 'main-pages', null, {
    onOmittedSourceOriginals(paths) {
      second.push(paths);
    },
  });
  assert.deepEqual(second, [[next.original.name]], 'Invocation output is locally owned.');
  const complete = fixture();
  applyPublicationProfile(complete.entries, complete.catalogue, null, null, {
    onOmittedSourceOriginals() {
      assert.fail('Complete releases do not declare omissions.');
    },
  });
  assert(complete.entries.some((entry) => entry.name === complete.original.name));
});

function preservedOriginalFixture() {
  const f = fixture();
  const oldPath = f.original.name;
  f.original.name = 'authoring/library/1994-forever-art/originals/last-train-cassette.png';
  f.source.sourceImagePath = f.original.name;
  f.source.image = pin(f.original);
  for (const group of f.catalogue.groups)
    group.files = group.files.map((name) => name === oldPath ? f.original.name : name);
  f.catalogue.files = f.entries.filter((entry) => entry.name !== 'game/presentation/current-art-sources.mjs').map(pin);
  f.entries.find((entry) => entry.name === 'game/presentation/current-art-sources.mjs').bytes =
    Buffer.from(`export const CURRENT_ART_SOURCES = ${JSON.stringify(f.sources)};`);
  return f;
}

test('current-main original URLs override earlier profile exclusions without omitting their bodies', () => {
  const f = preservedOriginalFixture();
  const omitted = new Set([f.original.name]);
  const audit = mainPagesSourceOriginals(f.entries, f.catalogue, omitted);
  assert.equal(omitted.has(f.original.name), false);
  assert.equal(audit.paths.has(f.original.name), false);
  assert.ok(f.entries.some((entry) => entry.name === f.original.name));
  assert.ok(f.catalogue.files.some((entry) => entry.path === f.original.name));
  assert.match(audit.candidates.find((row) => row.path === f.original.name).reasons.join(' '),
    /Current-main original URL is protected/);
});

test('missing current-main originals fail closed even when an earlier profile exclusion named them', () => {
  for (const earlierExclusion of [false, true]) {
    const f = preservedOriginalFixture();
    f.entries = f.entries.filter((entry) => entry.name !== f.original.name);
    assert.throws(() => mainPagesSourceOriginals(f.entries, f.catalogue,
      new Set(earlierExclusion ? [f.original.name] : [])),
      /Preserved current-main original is missing from build entries/);
  }
});
