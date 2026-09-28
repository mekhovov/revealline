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
import { OPTIONAL_PACKAGE_POLICIES } from '../publishing/optional-package-policy.mjs';

const runnerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Candidate production only: uses this checkout's committed builder, verifies
 * original inputs against that tree, and writes a new immutable output folder.
 * Pending human/device gates remain pending; no publisher is called. */
export async function bundleOptionalPractice({
  root = runnerRoot,
  out,
  basePath = '/revealline/',
  packageIds = ['civilian-flight'],
} = {}) {
  if (
    !Array.isArray(packageIds) ||
    !packageIds.length ||
    packageIds.length > 8 ||
    new Set(packageIds).size !== packageIds.length ||
    packageIds.some((id) => typeof id !== 'string' || !Object.hasOwn(OPTIONAL_PACKAGE_POLICIES, id))
  )
    throw new Error('Optional selection must contain unique registered package IDs.');
  packageIds = [...packageIds].sort();
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
  const build = async (packageId) => {
    const built = await buildOptionalPractice(root, {
      engineCommit: binding.sourceRevision,
      engineTree: binding.sourceTree,
      basePath,
      packageId,
    });
    verifyCommittedInputs(built.inputs, tree);
    return createOptionalPackageCandidate({ built, version, ...binding });
  };
  const files = new Map(),
    packages = [];
  for (const packageId of packageIds) {
    const first = await build(packageId),
      second = await build(packageId);
    if (first.files.size !== second.files.size)
      throw new Error('Optional build file count is not reproducible.');
    for (const [name, bytes] of first.files) {
      if (!second.files.has(name) || !bytes.equals(second.files.get(name)))
        throw new Error(`Optional artifact is not byte-reproducible: ${name}`);
      if (files.has(name)) throw new Error('Optional artifacts must have unique paths.');
      files.set(name, bytes);
    }
    packages.push(first.package);
  }
  const envelope = {
    format: 'revealline-optional-packages.v1',
    version,
    ...binding,
    packages,
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
    packageIds,
    reproducibleBuilds: 2,
    committedInputsVerified: true,
    zipMembersVerified: true,
    publicEligible: false,
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2),
    options = {},
    seen = new Set();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index],
      value = args[index + 1];
    if (!['--out', '--base-path', '--packages'].includes(flag) || !value || seen.has(flag))
      throw new Error('Invalid optional bundle arguments.');
    seen.add(flag);
    if (flag === '--out') options.out = value;
    if (flag === '--base-path') options.basePath = value;
    if (flag === '--packages') options.packageIds = value.split(',');
  }
  if (!options.out)
    throw new Error(
      'Usage: node scripts/bundle-optional-practice.mjs --out NEW_DIRECTORY [--base-path /revealline/] [--packages civilian-flight,civilian-fpv]',
    );
  bundleOptionalPractice(options)
    .then((result) => process.stdout.write(JSON.stringify(result, null, 2) + '\n'))
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
