#!/usr/bin/env node
/** Candidate sizing only; this command does not create or qualify a release. */
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  PROJECT_ROOT,
  collectBuildFiles,
  inspectBuildProject,
  isBuildInputPath,
  readBuildConfig,
} from './game-cli.mjs';
import {
  committedInputMap,
  frozenSource,
  sourceGit,
  verifyCommittedInputs,
} from './frozen-source.mjs';
import { checkEditionSourceEligibility } from './check-edition-source.mjs';

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const within = (root, file) => file === root || file.startsWith(`${root}${path.sep}`);

async function regularInput(root, name) {
  let current = root;
  for (const part of name.split('/')) {
    current = path.join(current, part);
    const stat = await fs.lstat(current);
    if (stat.isSymbolicLink()) throw new Error(`Inspection rejects symbolic inputs: ${name}`);
  }
  if (!(await fs.stat(current)).isFile())
    throw new Error(`Inspection requires an ordinary committed file: ${name}`);
  return current;
}

/** Sparse checkouts must not silently omit unreferenced files from an included
 * directory. The normal collector still owns all path and reference rules. */
export async function inspectDefaultBuildInputs(root = PROJECT_ROOT) {
  root = await fs.realpath(root);
  const binding = frozenSource(root),
    tree = committedInputMap(root);
  const configBytes = await fs.readFile(await regularInput(root, 'game/build-config.json'));
  verifyCommittedInputs(new Map([['game/build-config.json', configBytes]]), tree);
  const config = await readBuildConfig(root);
  const expected = [...tree.keys()]
    .filter(
      (name) =>
        config.include.some((included) => name === included || name.startsWith(`${included}/`)) &&
        isBuildInputPath(name),
    )
    .sort();
  const missing = [];
  for (const name of expected) {
    try {
      await regularInput(root, name);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      missing.push(name);
    }
  }
  if (missing.length) {
    const absent = new Set(missing);
    const rows = sourceGit(root, ['ls-tree', '-rlz', '--full-tree', 'HEAD'])
      .split('\0')
      .filter(Boolean);
    let bytes = 0;
    for (const row of rows) {
      const match = /^\d+ blob [a-f0-9]+\s+(\d+)\t([\s\S]+)$/.exec(row);
      if (match && absent.has(match[2])) bytes += Number(match[1]);
    }
    const error = new Error(
      `Default inspection needs ${missing.length} missing committed build inputs (${bytes} bytes). No files were hydrated or built.`,
    );
    error.missingInputs = { files: missing, bytes };
    throw error;
  }
  const files = await collectBuildFiles(root, config);
  if (json(files) !== json(expected))
    throw new Error('Default build inputs differ from the exact committed include closure.');
  let bytes = 0;
  for (const name of files) {
    const input = await fs.readFile(await regularInput(root, name));
    verifyCommittedInputs(new Map([[name, input]]), tree);
    bytes += input.length;
  }
  return {
    format: 'revealline-default-build-inputs.v1',
    ...binding,
    files: files.length,
    bytes,
    note: 'Included originals only; transitive producer inputs are checked by normal build preparation.',
  };
}

/** Verify available compiler/producer originals too, without inventing a second
 * compiler dependency graph or hydrating unrelated historical source files. */
export async function verifyAvailableCommittedSources(root = PROJECT_ROOT) {
  root = await fs.realpath(root);
  const tree = committedInputMap(root),
    inventory = createHash('sha256');
  let files = 0,
    bytes = 0,
    absentTrackedFiles = 0;
  for (const [name, expected] of [...tree].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    let input;
    try {
      input = await regularInput(root, name);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      absentTrackedFiles += 1;
      continue;
    }
    const stat = await fs.stat(input),
      hash = createHash('sha1').update(`blob ${stat.size}\0`);
    let readBytes = 0;
    for await (const chunk of createReadStream(input)) {
      hash.update(chunk);
      readBytes += chunk.length;
    }
    if (readBytes !== stat.size || hash.digest('hex') !== expected)
      throw new Error(`Available source differs from the immutable commit: ${name}`);
    inventory.update(json({ path: name, blob: expected, bytes: readBytes }));
    files += 1;
    bytes += readBytes;
  }
  return { files, bytes, absentTrackedFiles, inventorySha256: inventory.digest('hex') };
}

async function inspectionOutput(root, out) {
  if (!out) throw new Error('An explicit new inspection JSON path is required.');
  const requested = path.resolve(out);
  const parent = await fs.realpath(path.dirname(requested));
  const output = path.join(parent, path.basename(requested));
  if (within(root, output)) {
    try {
      sourceGit(root, ['check-ignore', '--', path.relative(root, output)]);
    } catch {
      throw new Error('An inspection report inside its checkout must be Git-ignored.');
    }
  }
  try {
    await fs.lstat(output);
    throw new Error('Inspection output already exists; reports are never overwritten.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return output;
}

/** Run from this checkout's own committed inspector. No source hydration, ZIP,
 * expanded site, selector, release version or publication receipt is produced. */
export async function inspectDefaultBuild({ root = PROJECT_ROOT, out } = {}) {
  root = await fs.realpath(root);
  if (root !== (await fs.realpath(PROJECT_ROOT)))
    throw new Error('Run the default inspector from the checkout being inspected.');
  const output = await inspectionOutput(root, out);
  const before = await inspectDefaultBuildInputs(root);
  const availableBefore = await verifyAvailableCommittedSources(root);
  const sourceEligibility = await checkEditionSourceEligibility(root);
  const inspection = await inspectBuildProject({ root, sourceRevision: before.sourceRevision });
  const after = await inspectDefaultBuildInputs(root);
  const availableAfter = await verifyAvailableCommittedSources(root);
  const finalBinding = frozenSource(root);
  if (
    json(before) !== json(after) ||
    json(availableBefore) !== json(availableAfter) ||
    finalBinding.sourceRevision !== before.sourceRevision ||
    finalBinding.sourceTree !== before.sourceTree
  )
    throw new Error('Default source changed during inspection; no report was written.');
  const report = {
    ...inspection,
    sourceTree: before.sourceTree,
    includedInputs: before,
    availableCommittedSources: availableBefore,
    sourceEligibility,
    includedInputsVerified: true,
    availableCommittedSourcesVerified: true,
    reproducibleBuilds: 0,
    note: 'One normal build preparation, without ZIP or expanded-site writes. Not frozen release, archive verification, human review or whole-site qualification.',
  };
  const reportBytes = Buffer.from(json(report));
  await fs.writeFile(output, reportBytes, { flag: 'wx' });
  return {
    output,
    report: {
      bytes: reportBytes.length,
      sha256: createHash('sha256').update(reportBytes).digest('hex'),
    },
    sourceRevision: report.sourceRevision,
    sourceTree: report.sourceTree,
    manifest: report.manifestDescriptor,
    payloadBytesIncludingManifest: report.payloadBytesIncludingManifest,
    publicEligible: false,
    promotable: false,
    completeHostedOutput: false,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  try {
    if (args.length === 1 && args[0] === '--check-inputs')
      console.log(json(await inspectDefaultBuildInputs()));
    else if (args.length === 2 && args[0] === '--out' && args[1] && !args[1].startsWith('--'))
      console.log(json(await inspectDefaultBuild({ out: args[1] })));
    else
      throw new Error(
        'Usage: node scripts/inspect-default-build.mjs --check-inputs | --out new-report.json',
      );
  } catch (error) {
    console.error(error.message);
    if (error.missingInputs) console.error(json(error.missingInputs));
    process.exitCode = 1;
  }
}
