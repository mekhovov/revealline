import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('./pages-candidate-archive.py', import.meta.url));
const source = 'a'.repeat(40);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const maximum = 980000000;
const descriptor = (name, text) => ({
  path: name,
  bytes: Buffer.byteLength(text),
  sha256: sha(text),
});
const sortLargest = (files) =>
  [...files].sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path)).slice(0, 20);

async function fixture(t, { alterFiles, alterMembers } = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'pages-candidate-archive-'));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const preflight = {
    syntheticSha: source,
    sourceCommittedAt: '2026-10-16T12:00:00+00:00',
    buildVersion: `main-${source.slice(0, 12)}`,
    overlay: { files: [descriptor('practice/index.json', '{}')] },
  };
  const metadata =
    JSON.stringify(
      {
        format: 'revealline-main-deployment.v1',
        channel: 'main',
        sourceRevision: source,
        sourceCommittedAt: preflight.sourceCommittedAt,
        buildVersion: preflight.buildVersion,
        play: 'game/',
        releases: 'https://github.com/mekhovov/revealline/releases',
      },
      null,
      2,
    ) + '\n';
  const files = {
    'main-deployment.json': metadata,
    'release.json': metadata,
    'game/index.html': '<!doctype html><title>Fixture gate</title>',
    'releases/index.html': '<!doctype html><title>Fixture releases</title>',
    'practice/index.json': '{}',
    'nested/.hidden': 'hidden',
  };
  alterFiles?.(files);
  const rows = Object.entries(files)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([name, text]) => descriptor(name, text));
  const inventory = {
    format: 'revealline-main-pages-inventory.v1',
    sourceRevision: source,
    completeInventory: true,
    files: rows,
  };
  const inventoryBytes = JSON.stringify(inventory) + '\n';
  const staged = {
    format: 'revealline-main-pages-receipt.v1',
    sourceRevision: source,
    files: rows.length,
    bytes: rows.reduce((sum, row) => sum + row.bytes, 0),
    maximumBytes: maximum,
    completeInventory: true,
    withinCapacity: true,
    capacityAccepted: true,
    inventorySha256: sha(inventoryBytes),
    largestFiles: sortLargest(rows),
    errors: [],
  };
  const members = [
    { name: '.', kind: 'directory' },
    { name: './nested', kind: 'directory' },
    ...Object.entries(files).map(([name, text]) => ({ name: './' + name, text })),
  ];
  alterMembers?.(members);
  const result = spawnSync(
    'python3',
    [
      '-c',
      `import io,json,sys,tarfile
with tarfile.open(sys.argv[1], 'w', format=tarfile.PAX_FORMAT) as archive:
 for row in json.loads(sys.argv[2]):
  entry=tarfile.TarInfo(row['name'])
  kind=row.get('kind','file')
  if kind=='directory':
   entry.type=tarfile.DIRTYPE
   archive.addfile(entry)
  elif kind in ('symlink','hardlink','fifo'):
   entry.type={'symlink':tarfile.SYMTYPE,'hardlink':tarfile.LNKTYPE,'fifo':tarfile.FIFOTYPE}[kind]
   entry.linkname='game/index.html'
   archive.addfile(entry)
  else:
   data=row.get('text','').encode('utf-8')
   entry.size=len(data)
   archive.addfile(entry,io.BytesIO(data))`,
      path.join(directory, 'artifact.tar'),
      JSON.stringify(members),
    ],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  const archiveBytes = await readFile(path.join(directory, 'artifact.tar'));
  const archived = {
    format: 'revealline-main-pages-archive-receipt.v1',
    sourceRevision: source,
    artifactId: '12345',
    archiveAccepted: true,
    maximumArchiveBytes: maximum,
    inventorySha256: sha(inventoryBytes),
    archiveBytes: archiveBytes.length,
    archiveSha256: sha(archiveBytes),
    stagedBytes: staged.bytes,
    files: rows.length,
    overheadBytes: archiveBytes.length - staged.bytes,
    errors: [],
  };
  const f = { directory, preflight, inventory, staged, archived };
  await save(f);
  return f;
}

async function save(f) {
  const inventoryBytes = JSON.stringify(f.inventory) + '\n';
  await writeFile(path.join(f.directory, 'main-pages-inventory.json'), inventoryBytes);
  await writeFile(path.join(f.directory, 'main-pages-receipt.json'), JSON.stringify(f.staged));
  await writeFile(
    path.join(f.directory, 'main-pages-archive-receipt.json'),
    JSON.stringify(f.archived),
  );
  await writeFile(path.join(f.directory, 'preflight.json'), JSON.stringify(f.preflight));
}

function run(f) {
  return spawnSync(
    'python3',
    [script, '--bundle', f.directory, '--preflight', path.join(f.directory, 'preflight.json')],
    { encoding: 'utf8' },
  );
}

async function rejected(f, pattern) {
  const result = run(f);
  assert.equal(result.status, 1, result.stderr);
  if (pattern) assert.match(result.stderr, pattern);
  await assert.rejects(readFile(path.join(f.directory, 'independent-archive.json')), {
    code: 'ENOENT',
  });
}

test('derives actual archive bytes, hashes and metadata without qualification claims', async (t) => {
  const f = await fixture(t);
  const result = run(f);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  const record = JSON.parse(
    await readFile(path.join(f.directory, 'independent-archive.json'), 'utf8'),
  );
  assert.deepEqual(record.files, f.inventory.files);
  assert.equal(record.fileCount, f.staged.files);
  assert.equal(record.stagedBytes, f.staged.bytes);
  assert.equal(record.archiveBytes, f.archived.archiveBytes);
  assert.equal(record.archiveSha256, f.archived.archiveSha256);
  assert.equal(record.sourceRevision, source);
  assert.equal(record.metadata.mainDeployment, record.metadata.release);
  assert.match(record.metadata.gameGateHTML, /Fixture gate/);
  assert.match(record.metadata.releasesHTML, /Fixture releases/);
  for (const field of [
    'mergeAuthorized',
    'qualificationPerformed',
    'productionDeploymentPerformed',
  ])
    assert.equal(record[field], false);
});

for (const [name, alterMembers, message] of [
  ['missing', (rows) => rows.pop(), /missing inventoried/],
  ['extra', (rows) => rows.push({ name: './extra', text: 'x' }), /Unexpected/],
  [
    'changed',
    (rows) => {
      rows.at(-1).text = 'forged';
    },
    /hash mismatch/,
  ],
  ['traversal', (rows) => rows.push({ name: '../escape', text: 'x' }), /Unsafe path/],
  ['absolute', (rows) => rows.push({ name: '/escape', text: 'x' }), /Unsafe path/],
  ['backslash', (rows) => rows.push({ name: 'a\\escape', text: 'x' }), /Unsafe path/],
  ['duplicate', (rows) => rows.push({ ...rows.at(-1) }), /Duplicate/],
  [
    'duplicate directory',
    (rows) => rows.push({ name: './nested', kind: 'directory' }),
    /Duplicate/,
  ],
  ...['symlink', 'hardlink', 'fifo'].map((kind) => [
    kind,
    (rows) => {
      rows.at(-1).kind = kind;
    },
    /Unsupported/,
  ]),
])
  test(`rejects ${name} archive members`, async (t) => {
    await rejected(await fixture(t, { alterMembers }), message);
  });

for (const [name, change, message] of [
  [
    'source',
    (f) => {
      f.archived.sourceRevision = 'b'.repeat(40);
    },
    /Source identity/,
  ],
  [
    'raw budget',
    (f) => {
      f.staged.maximumBytes = maximum + 1;
    },
    /budget/,
  ],
  [
    'archive budget',
    (f) => {
      f.archived.maximumArchiveBytes = maximum + 1;
    },
    /budget/,
  ],
  [
    'tight archive budget',
    (f) => {
      f.archived.maximumArchiveBytes = 1;
    },
    /budget exceeded/,
  ],
  [
    'archive checksum',
    (f) => {
      f.archived.archiveSha256 = '0'.repeat(64);
    },
    /archive hash/,
  ],
  [
    'raw count',
    (f) => {
      f.staged.files = true;
    },
    /file count/,
  ],
  [
    'raw total',
    (f) => {
      f.staged.bytes++;
    },
    /raw bytes/,
  ],
  [
    'archive total',
    (f) => {
      f.archived.archiveBytes++;
    },
    /archive size/,
  ],
  [
    'overhead',
    (f) => {
      f.archived.overheadBytes++;
    },
    /overhead/,
  ],
  [
    'incomplete',
    (f) => {
      f.inventory.completeInventory = false;
    },
    /not accepted/,
  ],
  [
    'diagnostics',
    (f) => {
      f.archived.errors = ['failure'];
    },
    /not accepted/,
  ],
  [
    'largest list',
    (f) => {
      f.staged.largestFiles = [];
    },
    /largest files/,
  ],
  [
    'artifact identity',
    (f) => {
      f.archived.artifactId = '0';
    },
    /artifact identity/,
  ],
])
  test(`rejects inconsistent production ${name}`, async (t) => {
    const f = await fixture(t);
    change(f);
    await save(f);
    await rejected(f, message);
  });

for (const [name, alterFiles] of [
  [
    'changed',
    (files) => {
      files['practice/index.json'] = '[]';
    },
  ],
  [
    'extra',
    (files) => {
      files['practice/extra.json'] = '{}';
    },
  ],
  [
    'missing',
    (files) => {
      delete files['practice/index.json'];
    },
  ],
])
  test(`rejects fully self-consistent ${name} frozen overlay`, async (t) => {
    await rejected(await fixture(t, { alterFiles }), /overlay closure/);
  });

test('self-consistent forged inventory cannot conceal changed archive content', async (t) => {
  const f = await fixture(t);
  f.inventory.files.at(-1).sha256 = '0'.repeat(64);
  const inventoryBytes = JSON.stringify(f.inventory) + '\n';
  f.staged.inventorySha256 = f.archived.inventorySha256 = sha(inventoryBytes);
  f.staged.largestFiles = sortLargest(f.inventory.files);
  await save(f);
  await rejected(f, /hash mismatch/);
});

test('fully self-consistent wrong rolling identity is still rejected', async (t) => {
  await rejected(
    await fixture(t, {
      alterFiles(files) {
        files['main-deployment.json'] = files['release.json'] = '{}\n';
      },
    }),
    /Rolling deployment metadata/,
  );
});

test('missing archive and symlinked evidence are rejected without output', async (t) => {
  const missing = await fixture(t);
  await rm(path.join(missing.directory, 'artifact.tar'));
  await rejected(missing);
  const linked = await fixture(t);
  await rm(path.join(linked.directory, 'main-pages-receipt.json'));
  await symlink(
    path.join(linked.directory, 'preflight.json'),
    path.join(linked.directory, 'main-pages-receipt.json'),
  );
  await rejected(linked, /ordinary/);
});
