import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildOptionalPractice } from './build-optional-practice.mjs';
import {
  frozenSource,
  committedInputMap,
  verifyCommittedInputs,
  sourceGit,
} from './frozen-source.mjs';
import { createOptionalPackageCandidate } from '../publishing/optional-package-candidate.mjs';
import {
  validateOptionalPackageAdmission,
  createOptionalPackageReview,
} from '../publishing/optional-package-admission.mjs';
import { editionJSON, editionDescriptor } from '../publishing/edition-candidate.mjs';
import { editionHash } from '../publishing/edition-zip.mjs';

const runnerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Candidate production only: uses this checkout's committed builder, verifies
 * original inputs against that tree, and writes a new immutable output folder.
 * Pending human/device gates remain pending; no publisher is called. */
export async function bundleOptionalPractice({
  root = runnerRoot,
  out,
  basePath = '/revealline/',
} = {}) {
  root = await fs.realpath(root);
  if (root !== (await fs.realpath(runnerRoot)))
    throw new Error(
      'Run the optional bundle script from the checkout whose source is being frozen.',
    );
  if (!out) throw new Error('A new optional candidate output directory is required.');
  const output = path.resolve(root, out),
    relative = path.relative(root, output);
  if (!relative || relative === '..' || root.startsWith(output + path.sep))
    throw new Error('Optional output cannot replace its source checkout.');
  if (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) {
    try {
      sourceGit(root, ['check-ignore', '--', relative]);
    } catch {
      throw new Error('Optional output inside its checkout must be Git-ignored.');
    }
  }
  try {
    await fs.access(output);
    throw new Error('Optional candidate already exists; immutable outputs are never overwritten.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const binding = frozenSource(root),
    tree = committedInputMap(root);
  const packageBytes = await fs.readFile(path.join(root, 'package.json'));
  verifyCommittedInputs(new Map([['package.json', packageBytes]]), tree);
  const version = `v${JSON.parse(packageBytes).version}`;
  if (!/^v\d+\.\d+\.\d+$/.test(version))
    throw new Error('Optional candidates require a numeric release version.');
  const build = async () => {
    const built = await buildOptionalPractice(root, {
      engineCommit: binding.sourceRevision,
      engineTree: binding.sourceTree,
      basePath,
    });
    verifyCommittedInputs(built.inputs, tree);
    return createOptionalPackageCandidate({ built, version, ...binding });
  };
  const first = await build(),
    second = await build();
  if (first.files.size !== second.files.size)
    throw new Error('Optional build file count is not reproducible.');
  for (const [name, bytes] of first.files)
    if (!second.files.has(name) || !bytes.equals(second.files.get(name)))
      throw new Error(`Optional artifact is not byte-reproducible: ${name}`);
  const files = first.files;
  const envelope = {
    format: 'revealline-optional-packages.v1',
    version,
    ...binding,
    packages: [first.package],
  };
  const admission = await validateOptionalPackageAdmission(envelope, {
    read: async (row) => files.get(row.path),
  });
  files.set('optional-packages.json', editionJSON(envelope));
  files.set(
    'optional-package-review.json',
    editionJSON(createOptionalPackageReview(files.get('optional-packages.json'))),
  );
  files.set(
    'optional-candidate-verification.json',
    editionJSON({
      format: 'revealline-optional-package-candidate-verification.v1',
      version,
      ...binding,
      envelopeSha256: editionHash(files.get('optional-packages.json')),
      admission,
      reproducibleBuilds: 2,
      committedInputsVerified: true,
      publicEligible: false,
      note: 'Artifact admission does not qualify installed identity, device behavior or human learning. Review gates remain pending.',
    }),
  );
  files.set(
    'optional-checksums.json',
    editionJSON({
      format: 'revealline-optional-package-checksums.v1',
      files: [...files]
        .map(([name, bytes]) => editionDescriptor(name, bytes))
        .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)),
    }),
  );
  if (JSON.stringify(frozenSource(root)) !== JSON.stringify(binding))
    throw new Error('Optional source changed during compilation.');
  await fs.mkdir(path.dirname(output), { recursive: true });
  const temporary = await fs.mkdtemp(`${output}.tmp-`);
  try {
    for (const [name, bytes] of files)
      await fs.writeFile(path.join(temporary, name), bytes, { flag: 'wx' });
    await validateOptionalPackageAdmission(envelope, {
      read: async (row) => fs.readFile(path.join(temporary, row.path)),
    });
    await fs.rename(temporary, output);
  } catch (error) {
    await fs.rm(temporary, { recursive: true, force: true });
    throw error;
  }
  return {
    output,
    version,
    ...binding,
    packageIds: [first.package.id],
    reproducibleBuilds: 2,
    committedInputsVerified: true,
    zipMembersVerified: true,
    publicEligible: false,
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [flag, out, baseFlag, basePath, ...extra] = process.argv.slice(2);
  if (
    flag !== '--out' ||
    !out ||
    extra.length ||
    (baseFlag !== undefined && (baseFlag !== '--base-path' || !basePath))
  )
    throw new Error(
      'Usage: node scripts/bundle-optional-practice.mjs --out NEW_DIRECTORY [--base-path /revealline/]',
    );
  bundleOptionalPractice({ out, ...(basePath ? { basePath } : {}) })
    .then((result) => process.stdout.write(JSON.stringify(result, null, 2) + '\n'))
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
