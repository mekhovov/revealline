/** Isolated, source-bound review output. This module never adopts production. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { canonicalJSON } from '../game/data-json.mjs';
import { importThemeBundle, exportThemeBundle } from '../game/presentation/bundle.mjs';
import { presentationCoverage } from '../game/presentation/model.mjs';
import { checkSourceIdentity } from './check-source-identity.mjs';
import { committedInputMap, frozenSource, verifyCommittedInputs } from './frozen-source.mjs';
import { createFieldKitProduction, compileFieldKitProduction } from './produce-field-kit-theme.mjs';
import {
  PICTURE_PRODUCTION_MIGRATION,
  retainPictureProductionHistory,
} from './picture-production-history.mjs';
import { verifyPresentationOutput } from './write-presentation.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const ledgerPath = 'authoring/library/fpv-field-kit/production.rltheme';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (value) => Buffer.from(canonicalJSON(value) + '\n');
const pins = (files) =>
  [...files]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, bytes]) => ({
      path: name,
      bytes: bytes.length,
      sha256: sha(bytes),
    }));
const inside = (parent, child) => {
  const relative = path.relative(parent, child);
  return (
    !relative ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
  );
};
const safeName = (name) =>
  typeof name === 'string' &&
  !path.isAbsolute(name) &&
  !name.includes('\\') &&
  name.split('/').every((part) => part && part !== '.' && part !== '..');

/** Canonicalize the existing parent before checking aliases into the source tree.
 * A candidate is a new sibling tree; only .cache is allowed inside this checkout. */
export async function fieldKitCandidateDestination(destination, { projectRoot = root } = {}) {
  if (typeof destination !== 'string' || !destination.trim())
    throw new Error('An explicit candidate directory is required.');
  const requested = path.resolve(destination);
  const parent = await fs.realpath(path.dirname(requested));
  const output = path.join(parent, path.basename(requested));
  const source = await fs.realpath(projectRoot);
  if (inside(source, output) && !inside(path.join(source, '.cache'), output))
    throw new Error(
      'Candidate output must be outside the source tree or inside its .cache directory.',
    );
  if (output === path.join(source, '.cache'))
    throw new Error('Choose a new directory inside .cache, not .cache itself.');
  return output;
}

/** Actual read bytes, not just a HEAD label, are bound to committed Git blobs. */
export async function createFieldKitProductionCandidate({ projectRoot = root } = {}) {
  if ((await fs.realpath(projectRoot)) !== (await fs.realpath(root)))
    throw new Error('Candidate producer must run from its own committed source tree.');
  const source = frozenSource(projectRoot);
  const identity = await checkSourceIdentity({ root: projectRoot });
  const tree = committedInputMap(projectRoot),
    inputs = new Map();
  const read = async (name) => {
    if (!safeName(name)) throw new Error('Invalid candidate source path.');
    const bytes = await fs.readFile(path.join(projectRoot, name));
    verifyCommittedInputs(new Map([[name, bytes]]), tree);
    if (inputs.has(name) && !inputs.get(name).equals(bytes))
      throw new Error(`Candidate source changed between reads: ${name}`);
    inputs.set(name, bytes);
    return bytes;
  };
  const baselineBytes = await read(ledgerPath);
  const migrationBytes = await read('scripts/picture-production-migration.json');
  if (canonicalJSON(JSON.parse(migrationBytes)) !== canonicalJSON(PICTURE_PRODUCTION_MIGRATION))
    throw new Error('Loaded picture migration differs from committed input.');
  const prior = await importThemeBundle(new Blob([baselineBytes]), { decodeImage: null });
  const production = await createFieldKitProduction({ projectRoot, read });
  production.document = retainPictureProductionHistory(production.document, prior.document);
  production.assets = new Map([...prior.assets, ...production.assets]);
  production.coverage = presentationCoverage(production.document);
  const ledger = Buffer.from(
    await (await exportThemeBundle(production.document, production.assets)).arrayBuffer(),
  );
  const config = JSON.parse(await read('.prettierrc.json'));
  const compiled = await compileFieldKitProduction(production, { read, config });
  await verifyPresentationOutput(compiled.files);
  verifyCommittedInputs(inputs, tree);
  const after = await checkSourceIdentity({ root: projectRoot });
  if (
    canonicalJSON(source) !== canonicalJSON(frozenSource(projectRoot)) ||
    after.aggregateSha256 !== identity.aggregateSha256 ||
    identity.sourceRevision !== source.sourceRevision ||
    identity.sourceTree !== source.sourceTree
  )
    throw new Error('Candidate source changed during compilation.');
  const files = new Map([
    ['production.rltheme', ledger],
    ...[...compiled.files].map(([name, bytes]) => [`compiled/${name}`, Buffer.from(bytes)]),
  ]);
  const receipt = {
    format: 'revealline-field-kit-candidate.v1',
    source: { ...source, aggregateSha256: identity.aggregateSha256 },
    baseline: {
      path: ledgerPath,
      bytes: baselineBytes.length,
      sha256: sha(baselineBytes),
      id: prior.document.id,
      revision: prior.document.revision,
      slots: prior.document.slots.length,
    },
    proposed: {
      id: production.document.id,
      revision: production.document.revision,
      slots: production.document.slots.length,
    },
    migration: {
      path: 'scripts/picture-production-migration.json',
      sha256: sha(migrationBytes),
      addedSlots: production.document.slots
        .filter((slot) => !prior.document.slots.some((old) => old.id === slot.id))
        .map((slot) => slot.id),
    },
    qualification:
      'Isolated technical candidate; no artistic approval, default replacement or public release.',
    readiness: production.coverage,
    inputs: pins(inputs),
    files: pins(files),
  };
  files.set('review.json', json(receipt));
  return { files, receipt };
}

async function readCandidate(directory, expected) {
  const result = new Map();
  const visit = async (prefix = '') => {
    for (const entry of await fs.readdir(path.join(directory, prefix), { withFileTypes: true })) {
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory() && ['compiled', 'compiled/assets'].includes(name)) await visit(name);
      else if (entry.isFile()) {
        if (!expected.has(name)) throw new Error(`Unlisted candidate file: ${name}`);
        const file = path.join(directory, name);
        if ((await fs.lstat(file)).size !== expected.get(name).length)
          throw new Error(`Candidate byte length differs: ${name}`);
        result.set(name, await fs.readFile(file));
      } else throw new Error(`Unmanaged or linked candidate path: ${name}`);
    }
  };
  await visit();
  return result;
}

/** No replacing or merging an existing destination. A reservation directory and
 * whole-tree rename publish the ledger, compiled files and receipt together. */
export async function writeFieldKitProductionCandidate(
  files,
  destination,
  { projectRoot = root, check = false } = {},
) {
  const output = await fieldKitCandidateDestination(destination, { projectRoot });
  if (![...files.keys()].every(safeName)) throw new Error('Invalid candidate output path.');
  if (check) {
    const stat = await fs.lstat(output);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error('Candidate must be a real directory.');
    const actual = await readCandidate(output, files);
    if (files.size !== actual.size)
      throw new Error('Candidate inventory differs from committed reproduction.');
    for (const [name, bytes] of files)
      if (!actual.get(name)?.equals(bytes))
        throw new Error(`Candidate reproduction differs: ${name}`);
    return output;
  }
  // mkdir, unlike rename, refuses a pre-existing empty directory or symlink.
  await fs.mkdir(output);
  const owner = await fs.lstat(output);
  let stage;
  let adopted = false;
  try {
    stage = await fs.mkdtemp(path.join(path.dirname(output), '.field-kit-candidate-'));
    for (const [name, bytes] of files) {
      await fs.mkdir(path.dirname(path.join(stage, name)), { recursive: true });
      await fs.writeFile(path.join(stage, name), bytes, { flag: 'wx' });
    }
    const current = await fs.lstat(output);
    if (
      !current.isDirectory() ||
      current.isSymbolicLink() ||
      current.dev !== owner.dev ||
      current.ino !== owner.ino ||
      (await fs.readdir(output)).length
    )
      throw new Error('Candidate destination changed during preparation.');
    await fs.rename(stage, output);
    adopted = true;
  } finally {
    if (stage && !adopted) await fs.rm(stage, { recursive: true, force: true });
    if (!adopted) {
      const current = await fs.lstat(output).catch(() => null);
      if (current?.isDirectory() && current.dev === owner.dev && current.ino === owner.ino)
        await fs.rmdir(output).catch(() => {}); // Nonempty or replaced destinations remain untouched.
    }
  }
  return output;
}

export async function runFieldKitCandidate({ destination, check = false, projectRoot = root }) {
  // Reject a production-tree destination before doing any expensive work.
  const output = await fieldKitCandidateDestination(destination, { projectRoot });
  if (!check) {
    const existing = await fs.lstat(output).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
      return null;
    });
    if (existing)
      throw new Error('Candidate directory already exists; use --check-candidate to verify it.');
  }
  const { files, receipt } = await createFieldKitProductionCandidate({ projectRoot });
  await writeFieldKitProductionCandidate(files, output, { projectRoot, check });
  process.stdout.write(
    JSON.stringify({
      status: check ? 'verified-byte-identical' : 'candidate-created',
      output,
      source: receipt.source,
      baseline: receipt.baseline,
      proposed: receipt.proposed,
      files: files.size,
      bytes: [...files.values()].reduce((sum, body) => sum + body.length, 0),
      coverage: receipt.readiness.counts,
      requiredReady: receipt.readiness.requiredReady,
      qualification: receipt.qualification,
    }) + '\n',
  );
}
