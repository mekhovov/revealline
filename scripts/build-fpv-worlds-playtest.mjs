import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { buildOptionalPractice } from './build-optional-practice.mjs';

export async function buildWorldsPlaytest({
  root = fileURLToPath(new URL('../', import.meta.url)),
  out = path.join(root, 'dist/fpv-worlds-playtest'),
} = {}) {
  const built = await buildOptionalPractice(root, { packageId: 'fpv-worlds' });
  await mkdir(out, { recursive: true });
  for (const entry of built.entries) {
    const target = path.join(out, entry.name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, entry.bytes);
  }
  await writeFile(path.join(out, 'fpv-worlds-playtest.zip'), built.zip);
  const entry = 'optional-practice/fpv-worlds/index.html';
  await writeFile(
    path.join(out, 'index.html'),
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FPV Worlds playtest</title><style>body{font:20px system-ui;background:#102329;color:#eff8eb;padding:10vw}a{color:#c8ed96}</style><h1>FPV World Studio</h1><p>26 learning lessons (14 Acro + 12 optional self-level) · 60 world challenges · 8 worlds · Your own routes</p><p><a href="./' +
      entry +
      '">Open the playtest</a></p><p><a href="./fpv-worlds-playtest.zip">Download the portable package</a></p><p>Serve this folder over localhost or HTTPS. Use World packs → Prepare simulator offline to install this exact build.</p>\n',
  );
  const receipt = {
    format: 'FPVPlaytestBuild.v1',
    entry,
    files: built.entries.length,
    bytes: built.entries.reduce((n, e) => n + e.bytes.length, 0),
    zipSha256: createHash('sha256').update(built.zip).digest('hex'),
    qualification: 'development-playtest',
    unitTests: 'deferred-to-final-phase',
    releaseQualified: false,
  };
  await writeFile(path.join(out, 'playtest-build.json'), JSON.stringify(receipt, null, 2) + '\n');
  return { out, ...receipt };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length && !(args.length === 2 && args[0] === '--out'))
    throw new Error('Usage: node scripts/build-fpv-worlds-playtest.mjs [--out DIRECTORY]');
  console.log(
    JSON.stringify(
      await buildWorldsPlaytest(args.length ? { out: path.resolve(args[1]) } : {}),
      null,
      2,
    ),
  );
}
