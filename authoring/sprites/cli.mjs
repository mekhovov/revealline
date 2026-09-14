#!/usr/bin/env node
/** Explicit, finite source-only sprite export and independent regeneration check. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deriveFrame, digest, RECIPE } from './derivative.mjs';

const FORMAT = 'revealline.sprite-derivatives.v1';
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const relative = (value) => {
  assert.ok(
    typeof value === 'string' && value.length <= 240 && /^[a-zA-Z0-9._/-]+$/.test(value),
    'Portable relative path of at most 240 characters required.',
  );
  assert.ok(
    !path.posix.isAbsolute(value) &&
      value.split('/').every((part) => part && part !== '.' && part !== '..'),
    'Unsafe path.',
  );
  return value;
};

async function ordinaryPath(root, name) {
  let target = root;
  const parts = relative(name).split('/');
  for (let i = 0; i < parts.length; i++) {
    target = path.join(target, parts[i]);
    const stat = await fs.lstat(target);
    assert.ok(!stat.isSymbolicLink(), 'Symbolic links are not source assets.');
    assert.ok(
      i === parts.length - 1 ? stat.isFile() : stat.isDirectory(),
      'Ordinary path required.',
    );
  }
  return target;
}

async function boundedRead(root, name, maxBytes) {
  const target = await ordinaryPath(root, name);
  assert.ok((await fs.stat(target)).size <= maxBytes, 'File exceeds byte bound.');
  const bytes = await fs.readFile(target);
  assert.ok(bytes.length <= maxBytes, 'File changed beyond byte bound.');
  return bytes;
}

async function generatorIdentity() {
  const base = path.dirname(fileURLToPath(import.meta.url));
  const files = [
    'cli.mjs',
    'derivative.mjs',
    '../library/fpv-role-presentations/png.mjs',
    '../../scripts/game-cli.mjs',
  ];
  return Object.fromEntries(
    await Promise.all(
      files.map(async (file) => [file, digest(await fs.readFile(path.resolve(base, file)))]),
    ),
  );
}

function validateSources(sources) {
  assert.ok(
    Array.isArray(sources) && sources.length > 0 && sources.length <= 56,
    'Expected 1–56 explicit sources.',
  );
  const ids = new Set();
  const paths = new Set();
  for (const entry of sources) {
    assert.deepEqual(Object.keys(entry).sort(), [
      'bytes',
      'height',
      'id',
      'path',
      'sha256',
      'width',
    ]);
    assert.ok(
      typeof entry.id === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(entry.id) && !ids.has(entry.id),
      'Unique portable sprite ID required.',
    );
    assert.ok(
      relative(entry.path).startsWith('authoring/library/') &&
        entry.path.endsWith('.png') &&
        !paths.has(entry.path),
      'Unique library PNG required.',
    );
    assert.ok(/^[a-f0-9]{64}$/.test(entry.sha256), 'SHA-256 required.');
    assert.ok(
      Number.isSafeInteger(entry.bytes) && entry.bytes >= 45 && entry.bytes <= 4 * 1024 * 1024,
      'Original byte bound.',
    );
    assert.ok(
      Number.isInteger(entry.width) &&
        entry.width >= 1 &&
        entry.width <= 2048 &&
        entry.height === entry.width,
      'Square original dimensions required.',
    );
    ids.add(entry.id);
    paths.add(entry.path);
  }
}

async function produce(root, spec) {
  assert.deepEqual(Object.keys(spec).sort(), ['size', 'sources']);
  assert.ok([32, 64, 128].includes(spec.size));
  validateSources(spec.sources);
  const outputs = [];
  for (const source of spec.sources) {
    const bytes = await boundedRead(root, source.path, 4 * 1024 * 1024);
    const derived = deriveFrame(bytes, source, spec.size);
    outputs.push({ ...derived, file: `${source.id}-${derived.record.output.sha256}.png` });
  }
  return {
    outputs,
    manifest: {
      format: FORMAT,
      recipe: RECIPE,
      generator: await generatorIdentity(),
      sources: spec.sources,
      size: spec.size,
      entries: outputs.map(({ file, record }) => ({ file, ...record })),
    },
  };
}

export async function compileSprites({ root, spec, out }) {
  root = await fs.realpath(root);
  relative(out);
  assert.ok(
    out.startsWith('authoring/library/') || out.startsWith('.cache/'),
    'Write only a new authoring-library or cache directory.',
  );
  const parsed = JSON.parse(await boundedRead(root, spec, 128 * 1024));
  const generated = await produce(root, parsed);
  const parent = path.posix.dirname(out);
  let cursor = root;
  for (const part of parent.split('/')) {
    cursor = path.join(cursor, part);
    const stat = await fs.lstat(cursor);
    assert.ok(
      stat.isDirectory() && !stat.isSymbolicLink(),
      'Output parent must already be an ordinary directory.',
    );
  }
  const target = path.join(root, out);
  await fs.mkdir(target); // Exclusive admission: never overwrite an earlier cohort.
  for (const { file, png } of generated.outputs)
    await fs.writeFile(path.join(target, file), png, { flag: 'wx' });
  await fs.writeFile(path.join(target, 'manifest.json'), json(generated.manifest), { flag: 'wx' });
  return generated.manifest;
}

export async function verifySprites({ root, manifest }) {
  root = await fs.realpath(root);
  const supplied = JSON.parse(await boundedRead(root, manifest, 256 * 1024));
  const generated = await produce(root, { size: supplied.size, sources: supplied.sources });
  assert.deepEqual(
    supplied,
    generated.manifest,
    'Derivative manifest, ancestry or generator differs.',
  );
  const directory = path.posix.dirname(relative(manifest));
  assert.deepEqual(
    (await fs.readdir(path.join(root, directory))).sort(),
    ['manifest.json', ...generated.outputs.map((entry) => entry.file)].sort(),
    'Exact cohort membership required.',
  );
  for (const output of generated.outputs) {
    const actual = await boundedRead(root, `${directory}/${output.file}`, 128 * 128 * 4 + 1024);
    assert.ok(actual.equals(output.png), 'Regenerated PNG differs.');
  }
  return supplied;
}

export async function main(argv) {
  const [command, ...flags] = argv;
  assert.ok(
    command === 'compile' || command === 'verify',
    'Usage: cli.mjs compile --root ROOT --spec INPUT.json --out NEW-DIR | verify --root ROOT --manifest DIR/manifest.json',
  );
  const keys = command === 'compile' ? ['root', 'spec', 'out'] : ['root', 'manifest'];
  const options = {};
  for (let i = 0; i < flags.length; i += 2) {
    const key = flags[i].slice(2);
    assert.ok(
      flags[i].startsWith('--') &&
        keys.includes(key) &&
        !Object.hasOwn(options, key) &&
        flags[i + 1] &&
        !flags[i + 1].startsWith('--'),
      'Invalid or duplicate argument.',
    );
    options[key] = flags[i + 1];
  }
  assert.deepEqual(Object.keys(options).sort(), keys.sort(), 'All arguments are required.');
  const result =
    command === 'compile' ? await compileSprites(options) : await verifySprites(options);
  console.log(
    json({
      status: command === 'compile' ? 'CANDIDATES_WRITTEN' : 'EXACT_REGENERATION_VERIFIED',
      files: result.entries.length,
      bytes: result.entries.reduce((sum, entry) => sum + entry.output.bytes, 0),
      recipe: result.recipe,
      runtimeAdopted: false,
    }),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
