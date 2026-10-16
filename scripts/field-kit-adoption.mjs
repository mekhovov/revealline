#!/usr/bin/env node
/** Review-branch adoption only. Never edits a checkout, index or existing ref. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { canonicalJSON } from '../game/data-json.mjs';
import { importThemeBundle } from '../game/presentation/bundle.mjs';
import { decodePresentationDocument } from '../game/presentation/document-codec.mjs';
import { LIMITS, validateThemeBundle } from '../game/presentation/model.mjs';
import { checkFieldKitReadiness, PRODUCTION_LEDGER } from './check-field-kit-readiness.mjs';
import {
  createFieldKitProductionCandidate,
  fieldKitCandidateDestination,
  writeFieldKitProductionCandidate,
} from './field-kit-production-candidate.mjs';
import { frozenSource } from './frozen-source.mjs';
import { checkSourceIdentity } from './check-source-identity.mjs';
import { retainedPresentationPath, verifyPresentationOutput } from './write-presentation.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const compiledPrefix = 'game/presentation/compiled/';
const format = 'revealline-field-kit-adoption.v1';
const zero = '0'.repeat(40);
const sha = (body) => createHash('sha256').update(body).digest('hex');
const objectId = (type, body) =>
  createHash('sha1').update(`${type} ${body.length}\0`).update(body).digest('hex');
const json = (value) => Buffer.from(canonicalJSON(value) + '\n');
const pins = (files) =>
  [...files]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, bytes]) => ({ path: name, bytes: bytes.length, sha256: sha(bytes) }));
const compiledFiles = (files) =>
  new Map(
    [...files]
      .filter(([name]) => name.startsWith('compiled/'))
      .map(([name, body]) => [name.slice(9), body]),
  );
function git(projectRoot, args, { input, index, allowedFailure = false } = {}) {
  try {
    return execFileSync('git', ['--no-replace-objects', '-C', projectRoot, ...args], {
      input,
      env: { ...process.env, ...(index ? { GIT_INDEX_FILE: index } : {}) },
      maxBuffer: 128 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (error) {
    if (allowedFailure && error.status === 1) return null;
    throw error;
  }
}
function identity(value) {
  if (typeof value !== 'string' || !/^[^\r\n\0<>]+ <[^\r\n\0<>]+> \d+ [+-]\d{4}$/.test(value))
    throw new Error('Invalid adoption commit identity.');
  return value;
}

/** Strict complete inventory, including ignored files: no ownership by omission. */
async function readPublished(projectRoot) {
  const files = new Map();
  const visit = async (directory, prefix = '') => {
    const info = await fs.lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink())
      throw new Error('Published presentation must use ordinary directories.');
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const name = `${prefix}${entry.name}`;
      if (entry.isDirectory() && name === 'assets')
        await visit(path.join(directory, entry.name), 'assets/');
      else if (entry.isFile()) files.set(name, await fs.readFile(path.join(directory, entry.name)));
      else throw new Error(`Unmanaged published presentation path: ${name}`);
    }
  };
  await visit(path.join(projectRoot, compiledPrefix));
  await verifyPresentationOutput(files);
  return files;
}

/** The exact predecessor remains in Git; its runtime and lazy payloads also
 * remain usable by old saves within the proposed compiled generation. */
export async function validateFieldKitAdoptionHistory(beforeLedger, afterLedger, before, after) {
  await verifyPresentationOutput(before);
  await verifyPresentationOutput(after);
  const prior = await importThemeBundle(new Blob([beforeLedger]), { decodeImage: null });
  const next = await importThemeBundle(new Blob([afterLedger]), { decodeImage: null });
  for (const [compiled, document] of [
    [before, prior.document],
    [after, next.document],
  ]) {
    const manifest = JSON.parse(compiled.get('manifest.json'));
    if (
      manifest.source?.id !== document.id ||
      manifest.source?.revision !== document.revision ||
      canonicalJSON(decodePresentationDocument(compiled.get('studio.json')?.toString('utf8'))) !==
        canonicalJSON(document)
    )
      throw new Error('Compiled output and production ledger have different owners.');
  }
  validateThemeBundle(next.document, {
    previous: prior.document,
    expectedRevision: prior.document.revision,
  });
  for (const [name, body] of prior.assets) {
    const retained = next.assets.get(name);
    if (
      !retained ||
      !Buffer.from(await retained.arrayBuffer()).equals(Buffer.from(await body.arrayBuffer()))
    )
      throw new Error(`Published ledger payload is not preserved: ${name}`);
  }
  for (const [name, body] of before) {
    if (
      (name.startsWith('assets/') || retainedPresentationPath(name)) &&
      !after.get(name)?.equals(body)
    )
      throw new Error(`Published presentation bytes are not preserved: ${name}`);
  }
  const runtime = before.get('runtime.json');
  if (!runtime || !after.get(`runtime.${sha(runtime)}.json`)?.equals(runtime))
    throw new Error('The exact published runtime must be retained before adoption.');
}

/** Writes only unreachable Git blobs/trees and a temporary private index.
 * No commit object, normal index, working file or ref is changed. */
export async function stageFieldKitAdoptionTree(projectRoot, parent, before, files) {
  if (!/^[a-f0-9]{40}$/.test(parent)) throw new Error('Invalid adoption parent.');
  const after = compiledFiles(files);
  await verifyPresentationOutput(before);
  await verifyPresentationOutput(after);
  const ledger = files.get('production.rltheme');
  if (!ledger) throw new Error('Missing proposed ledger.');
  const tracked = git(projectRoot, ['ls-tree', '-rz', parent, '--', compiledPrefix])
    .toString()
    .split('\0')
    .filter(Boolean);
  if (
    tracked.length !== before.size ||
    tracked.some((row) => {
      const match = /^100644 blob ([a-f0-9]{40})\t(.+)$/.exec(row);
      const body = match && before.get(match[2].slice(compiledPrefix.length));
      return !body || objectId('blob', body) !== match[1];
    })
  )
    throw new Error('Published inventory differs from the pinned Git parent.');
  if (
    !/^100644 blob [a-f0-9]{40}\t/.test(
      git(projectRoot, ['ls-tree', parent, '--', PRODUCTION_LEDGER]).toString(),
    )
  )
    throw new Error('The production ledger must already be an ordinary tracked file.');
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'field-kit-adoption-index-'));
  const index = path.join(scratch, 'index');
  try {
    git(projectRoot, ['read-tree', parent], { index });
    const updates = [...before.keys()].map((name) => `0 ${zero}\t${compiledPrefix}${name}\0`);
    for (const [name, body] of new Map([
      [PRODUCTION_LEDGER, ledger],
      ...[...after].map(([name, body]) => [`${compiledPrefix}${name}`, body]),
    ])) {
      const blob = git(projectRoot, ['hash-object', '-w', '--stdin'], { input: body })
        .toString()
        .trim();
      updates.push(`100644 ${blob}\t${name}\0`);
    }
    git(projectRoot, ['update-index', '-z', '--index-info'], { input: updates.join(''), index });
    return git(projectRoot, ['write-tree'], { index }).toString().trim();
  } finally {
    await fs.rm(scratch, { recursive: true, force: true });
  }
}

async function proposal({ projectRoot = root, author, committer } = {}) {
  const candidate = await createFieldKitProductionCandidate({ projectRoot });
  const before = await readPublished(projectRoot);
  const ledger = await fs.readFile(path.join(projectRoot, PRODUCTION_LEDGER));
  await validateFieldKitAdoptionHistory(
    ledger,
    candidate.files.get('production.rltheme'),
    before,
    compiledFiles(candidate.files),
  );
  const tree = await stageFieldKitAdoptionTree(
    projectRoot,
    candidate.receipt.source.sourceRevision,
    before,
    candidate.files,
  );
  const parent = candidate.receipt.source.sourceRevision;
  author = identity(author ?? git(projectRoot, ['var', 'GIT_AUTHOR_IDENT']).toString().trim());
  committer = identity(
    committer ?? git(projectRoot, ['var', 'GIT_COMMITTER_IDENT']).toString().trim(),
  );
  const commit = Buffer.from(
    `tree ${tree}\nparent ${parent}\nauthor ${author}\ncommitter ${committer}\n\nAdopt exact Field Kit production ${candidate.receipt.proposed.revision} for review\n\nCandidate review SHA-256: ${sha(candidate.files.get('review.json'))}\nNo public release or artistic approval is inferred.\n`,
  );
  const commitId = objectId('commit', commit);
  const receipt = {
    format,
    source: candidate.receipt.source,
    candidateReviewSha256: sha(candidate.files.get('review.json')),
    baseline: { ledger: candidate.receipt.baseline, compiled: pins(before) },
    proposed: candidate.receipt.proposed,
    readiness: candidate.receipt.readiness,
    transaction: {
      parent,
      tree,
      commit: commitId,
      author,
      committer,
      ref: `refs/heads/codex/field-kit-adoption-${commitId.slice(0, 16)}`,
    },
    guarantee:
      'Atomic review ref only; original checkout, index and all existing refs remain unchanged. Merge and public delivery require their separate qualification.',
  };
  const after = await checkSourceIdentity({ root: projectRoot });
  if (
    after.aggregateSha256 !== candidate.receipt.source.aggregateSha256 ||
    canonicalJSON(frozenSource(projectRoot)) !==
      canonicalJSON({
        sourceRevision: candidate.receipt.source.sourceRevision,
        sourceTree: candidate.receipt.source.sourceTree,
      })
  )
    throw new Error('Source changed while staging adoption.');
  return {
    candidate,
    receipt,
    files: new Map([...candidate.files, ['adoption.json', json(receipt)], ['commit.txt', commit]]),
  };
}

export async function prepareFieldKitAdoption(
  candidateDirectory,
  destination,
  { projectRoot = root } = {},
) {
  const output = await fieldKitCandidateDestination(destination, { projectRoot });
  const planned = await proposal({ projectRoot });
  await writeFieldKitProductionCandidate(planned.candidate.files, candidateDirectory, {
    projectRoot,
    check: true,
  });
  await writeFieldKitProductionCandidate(planned.files, output, { projectRoot });
  return planned.receipt;
}

/** Reproduction is the authority; imported receipts cannot grant readiness,
 * select a different ref, inject a commit or change the path allowlist. */
export async function checkFieldKitAdoption(directory, { projectRoot = root } = {}) {
  const output = await fieldKitCandidateDestination(directory, { projectRoot });
  const stat = await fs.lstat(output);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Invalid adoption directory.');
  const receiptPath = path.join(output, 'adoption.json');
  const receiptStat = await fs.lstat(receiptPath);
  if (!receiptStat.isFile() || receiptStat.size > LIMITS.manifestBytes)
    throw new Error('Invalid adoption receipt.');
  const recorded = JSON.parse(await fs.readFile(receiptPath));
  if (recorded.format !== format) throw new Error('Unknown adoption transaction.');
  const planned = await proposal({
    projectRoot,
    author: recorded.transaction?.author,
    committer: recorded.transaction?.committer,
  });
  await writeFieldKitProductionCandidate(planned.files, output, { projectRoot, check: true });
  return planned;
}

/** Compare-and-swap only the exact transaction-owned ref. Recovery retries this
 * operation; rollback refuses moved refs and every checked-out worktree. */
export function updateFieldKitAdoptionRef(projectRoot, transaction, { rollback = false } = {}) {
  const { ref, commit, parent, tree } = transaction;
  if (
    !/^[a-f0-9]{40}$/.test(commit) ||
    !/^[a-f0-9]{40}$/.test(parent) ||
    !/^[a-f0-9]{40}$/.test(tree) ||
    ref !== `refs/heads/codex/field-kit-adoption-${commit.slice(0, 16)}`
  )
    throw new Error('Invalid adoption ref ownership.');
  if (git(projectRoot, ['symbolic-ref', '--quiet', ref], { allowedFailure: true }))
    throw new Error('Adoption ref must not be symbolic.');
  const observed = git(projectRoot, ['rev-parse', '--verify', '--quiet', ref], {
    allowedFailure: true,
  })
    ?.toString()
    .trim();
  if (observed && observed !== commit) throw new Error('Adoption ref changed; preserve it.');
  if (rollback) {
    const worktrees = git(projectRoot, ['worktree', 'list', '--porcelain', '-z'])
      .toString()
      .split('\0');
    if (worktrees.includes(`branch ${ref}`))
      throw new Error('Adoption ref is checked out; preserve it.');
    if (observed) git(projectRoot, ['update-ref', '--no-deref', '-d', ref, commit]);
    return observed ? 'rolled-back-review-ref' : 'already-absent';
  }
  if (observed) return 'already-adopted';
  git(projectRoot, [
    'update-ref',
    '--no-deref',
    '-m',
    'Exact Field Kit adoption for review',
    ref,
    commit,
    zero,
  ]);
  return 'adopted-review-ref';
}

export async function applyFieldKitAdoption(
  directory,
  { projectRoot = root, rollback = false } = {},
) {
  const planned = await checkFieldKitAdoption(directory, { projectRoot });
  if (!rollback) {
    // Never publish the current unreviewed technical candidate even to a review
    // ref through this command. Preparation remains available for gap review.
    await checkFieldKitReadiness(new Blob([planned.files.get('production.rltheme')]));
    const id = git(projectRoot, ['hash-object', '-t', 'commit', '-w', '--stdin'], {
      input: planned.files.get('commit.txt'),
    })
      .toString()
      .trim();
    if (id !== planned.receipt.transaction.commit) throw new Error('Adoption commit changed.');
  }
  return {
    status: updateFieldKitAdoptionRef(projectRoot, planned.receipt.transaction, { rollback }),
    transaction: planned.receipt.transaction,
    guarantee: planned.receipt.guarantee,
  };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const [command, first, second, ...extra] = process.argv.slice(2);
    if (
      extra.length ||
      !first ||
      (command === '--prepare' ? !second : second) ||
      !['--prepare', '--check', '--adopt', '--recover', '--rollback'].includes(command)
    )
      throw new Error(
        'Usage: field-kit-adoption.mjs --prepare CANDIDATE NEW_DIRECTORY | --check DIRECTORY | --adopt DIRECTORY | --recover DIRECTORY | --rollback DIRECTORY',
      );
    const result =
      command === '--prepare'
        ? await prepareFieldKitAdoption(first, second)
        : command === '--check'
          ? (await checkFieldKitAdoption(first)).receipt
          : await applyFieldKitAdoption(first, { rollback: command === '--rollback' });
    process.stdout.write(JSON.stringify(result) + '\n');
  } catch (error) {
    process.stderr.write(error.message + '\n');
    process.exitCode = 1;
  }
}
