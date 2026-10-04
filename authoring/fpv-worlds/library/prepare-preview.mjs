// Visual-only companion of an immutable manual qualifier, never a production entry.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const [input, output] = process.argv.slice(2);
assert(input && output);
const root = await fs.realpath(input),
  out = path.resolve(output),
  hash = (b) => createHash('sha256').update(b).digest('hex');
const raw = await fs.readFile(path.join(root, 'fixture.json')),
  fixture = JSON.parse(raw);
const rows = fixture.files.map((f) => ({
  ...(fixture.overlays.find((x) => x.path === f.path) ?? f),
  path: 'player/' + f.path,
}));
rows.push(fixture.browserSources.find((f) => f.path.endsWith('/fixture-host.html')));
rows.push(fixture.browserSources.find((f) => f.path === 'worker-diagnostic.js'));
assert(rows.length === 104 && rows.every(Boolean));
await fs.mkdir(out);
for (const f of rows) {
  const source = await fs.realpath(path.join(root, f.path));
  assert(source.startsWith(root + path.sep));
  const b = await fs.readFile(source);
  assert(b.length === f.bytes && hash(b) === f.sha256, f.path);
  const target = path.join(out, f.path);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.link(source, target);
}
await fs.link(path.join(root, 'fixture.json'), path.join(out, 'fixture.json'));
const index = await fs.readFile(new URL('preview.html', import.meta.url));
await fs.writeFile(path.join(out, 'index.html'), index, { flag: 'wx' });
await fs.writeFile(
  path.join(out, 'preview.json'),
  JSON.stringify(
    {
      format: 'FPVWorldLibraryVisualPreview.v1',
      source: fixture.head,
      fixtureSHA256: hash(raw),
      indexSHA256: hash(index),
      files: rows,
      scope:
        'Native Library EN/UK/mobile review with an explicitly injected one-row verification index. Successful download remains the real pinned HTTPS pack. No finished production world listing.',
    },
    null,
    2,
  ) + '\n',
  { flag: 'wx' },
);
console.log(
  JSON.stringify({ out, source: fixture.head, newBytes: index.length, fixtureSHA256: hash(raw) }),
);
