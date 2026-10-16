#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createOverflightReuseFixture } from './overflight-reuse-fixture.mjs';
const root = resolve('.cache/overflight/reuse-review');
const { compiled, asset } = await createOverflightReuseFixture();
for (const [name, bytes] of compiled.files) {
  const file = resolve(root, 'compiled', name);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, bytes);
}
await writeFile(
  resolve(root, 'receipt.json'),
  JSON.stringify(
    {
      revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      asset,
      files: [...compiled.files.keys()],
      scope:
        'Shared PNG decoded by real browser; existing Capture BoardPainter and Asset Studio presentation adapter.',
    },
    null,
    2,
  ),
);
console.log(root);
