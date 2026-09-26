import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import {
  collectEditionEngineFiles,
  compileEdition,
  selectEditionClosure,
} from './compile-edition.mjs';
import { checkEditionSourceEligibility } from './check-edition-source.mjs';
import { validateEditionProviderParity } from './edition-provider-parity.mjs';
import {
  createEditionCandidate,
  editionJSON,
  editionDescriptor,
} from '../publishing/edition-candidate.mjs';
import { validateEditionAdmission } from '../publishing/edition-admission.mjs';
import { editionHash } from '../publishing/edition-zip.mjs';

const git = (root, args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim();
function frozenSource(root) {
  if (git(root, ['status', '--porcelain', '--untracked-files=normal']))
    throw new Error(
      'Candidate bundles require a clean committed source tree. Commit the reviewed inputs first.',
    );
  return {
    sourceRevision: git(root, ['rev-parse', 'HEAD']),
    sourceTree: git(root, ['rev-parse', 'HEAD^{tree}']),
  };
}
function committedInputMap(root) {
  return new Map(
    git(root, ['ls-tree', '-rz', '--full-tree', 'HEAD'])
      .split('\0')
      .filter(Boolean)
      .map((row) => {
        const match = /^(100644|100755) blob ([a-f0-9]+)\t([\s\S]+)$/.exec(row);
        return match ? [match[3], match[2]] : [row.split('\t')[1], null];
      }),
  );
}
function verifyCommittedInputs(files, tree) {
  for (const [name, bytes] of files) {
    const object = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    if (tree.get(name) !== object)
      throw new Error(`Selected input differs from the immutable commit: ${name}`);
  }
}

/** Create candidates only. Publication needs the separate reviewed selector and
 * qualification receipts; successful compilation is never human signoff. */
export async function bundleEditions({ root = process.cwd(), editionIds, out, basePath = '/' }) {
  root = await fs.realpath(root);
  if (
    !Array.isArray(editionIds) ||
    !editionIds.length ||
    editionIds.length > 32 ||
    new Set(editionIds).size !== editionIds.length
  )
    throw new Error('Choose between one and 32 unique edition IDs.');
  if (!out) throw new Error('A new candidate output directory is required.');
  const output = path.resolve(root, out),
    relative = path.relative(root, output);
  if (
    !relative ||
    (!relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative) &&
      (() => {
        try {
          git(root, ['check-ignore', '--', relative]);
          return false;
        } catch {
          return true;
        }
      })())
  )
    throw new Error(
      'Candidate output inside the checkout must be Git-ignored (for example .cache/company-candidate).',
    );
  try {
    await fs.access(output);
    throw new Error('Candidate output already exists; immutable candidates are never overwritten.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const binding = frozenSource(root),
    tree = committedInputMap(root);
  const sourceEligibility = await checkEditionSourceEligibility(root);
  if (sourceEligibility.status !== 'verified')
    throw new Error('Public source eligibility is required.');
  const packageBytes = await fs.readFile(path.join(root, 'package.json'));
  const catalogBytes = await fs.readFile(path.join(root, 'game/editions/catalog.json'));
  verifyCommittedInputs(
    new Map([
      ['package.json', packageBytes],
      ['game/editions/catalog.json', catalogBytes],
    ]),
    tree,
  );
  const version = `v${JSON.parse(packageBytes).version}`,
    catalog = JSON.parse(catalogBytes);
  if (!/^v\d+\.\d+\.\d+$/.test(version))
    throw new Error('Candidate version must be a numeric semantic release.');
  const engine = await collectEditionEngineFiles({ root });
  verifyCommittedInputs(engine, tree);
  const files = new Map(),
    editions = [],
    presentationReceipts = [];
  for (const id of [...editionIds].sort()) {
    const closure = selectEditionClosure(catalog, [id]);
    const sourceFiles = new Map(engine);
    const selectedPaths = new Set([
      ...closure.assets.map((asset) => asset.path),
      ...closure.campaigns.flatMap((campaign) => [
        campaign.sourcePath,
        ...(campaign.lessonPath ? [campaign.lessonPath] : []),
      ]),
      ...closure.editions.flatMap((edition) => Object.values(edition.boot)),
    ]);
    for (const name of selectedPaths) {
      const real = await fs.realpath(path.join(root, name));
      if (!real.startsWith(`${root}${path.sep}`))
        throw new Error('Source input escapes its checkout.');
      const stat = await fs.stat(real);
      if (!stat.isFile() || stat.size > 32 * 1024 * 1024)
        throw new Error('Selected source input exceeds its file budget.');
      sourceFiles.set(name, await fs.readFile(real));
    }
    verifyCommittedInputs(sourceFiles, tree);
    const compile = () =>
      compileEdition({
        catalog,
        editionIds: [id],
        files: sourceFiles,
        enginePaths: [...engine.keys()],
        version,
        sourceRevision: binding.sourceRevision,
        offline: { basePath },
      });
    const compiled = await compile();
    presentationReceipts.push(
      await validateEditionProviderParity({ sourceFiles, catalog, compiled }),
    );
    const first = createEditionCandidate({
      compiled,
      sourceFiles,
      version,
      ...binding,
    });
    const second = createEditionCandidate({
      compiled: await compile(),
      sourceFiles,
      version,
      ...binding,
    });
    for (const [name, bytes] of first.files) {
      if (editionHash(bytes) !== editionHash(second.files.get(name)))
        throw new Error('Candidate compilation is not byte-reproducible.');
      files.set(name, bytes);
    }
    editions.push(first.edition);
  }
  const envelope = { format: 'revealline-editions.v1', version, ...binding, editions };
  const admission = await validateEditionAdmission(envelope, {
    read: async (row) => files.get(row.path),
  });
  files.set('editions.json', editionJSON(envelope));
  files.set(
    'candidate-verification.json',
    editionJSON({
      format: 'revealline-edition-candidate-verification.v1',
      version,
      ...binding,
      envelopeSha256: editionHash(files.get('editions.json')),
      sourceEligibility,
      admission,
      reproducibleBuilds: 2,
      presentationReceipts,
      publicEligible: false,
      requiredExternalQualification: [
        'human-artwork-and-brand-review',
        'human-learning-and-pacing-review',
        'install-offline-upgrade-rollback-matrix',
        'performance-and-accessibility-review',
        'downloaded-release-byte-verification',
      ],
    }),
  );
  files.set(
    'checksums.json',
    editionJSON({
      format: 'revealline-edition-checksums.v1',
      files: [...files]
        .map(([name, bytes]) => editionDescriptor(name, bytes))
        .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)),
    }),
  );
  if (JSON.stringify(frozenSource(root)) !== JSON.stringify(binding))
    throw new Error('Source changed while building the candidate.');
  await fs.mkdir(path.dirname(output), { recursive: true });
  const temporary = await fs.mkdtemp(`${output}.tmp-`);
  try {
    for (const [name, bytes] of files)
      await fs.writeFile(path.join(temporary, name), bytes, { flag: 'wx' });
    await validateEditionAdmission(envelope, {
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
    editionIds: editions.map((edition) => edition.id),
    zipMembersVerified: true,
    reproducibleBuilds: 2,
    verifiedPresentationReceipts: presentationReceipts.length,
    publicEligible: false,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const options = {};
  for (let index = 2; index < process.argv.length; index += 2) {
    const key = process.argv[index],
      value = process.argv[index + 1];
    if (!['--editions', '--out', '--base-path'].includes(key) || !value || key in options)
      throw new Error(
        'Usage: node scripts/bundle-editions.mjs --editions id[,id] --out NEW_DIR [--base-path /revealline/]',
      );
    options[key] = value;
  }
  console.log(
    JSON.stringify(
      await bundleEditions({
        editionIds: options['--editions']?.split(','),
        out: options['--out'],
        basePath: options['--base-path'] ?? '/',
      }),
      null,
      2,
    ),
  );
}
