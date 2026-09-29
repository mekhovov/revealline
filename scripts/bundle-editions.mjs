import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  collectEditionEngineFiles,
  compileEdition,
  collectEditionSelectedFiles,
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
import {
  createEditionCapacityReport,
  editionCapacityPacket,
  EDITION_CAPACITY_REPORT,
} from '../publishing/edition-capacity.mjs';

import {
  sourceGit as git,
  frozenSource,
  committedInputMap,
  verifyCommittedInputs,
} from './frozen-source.mjs';

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
    const sourceFiles = new Map(engine);
    const selected = await collectEditionSelectedFiles({
      catalog,
      editionIds: [id],
      read: async (name) => {
        const real = await fs.realpath(path.join(root, name));
        if (!real.startsWith(`${root}${path.sep}`))
          throw new Error('Source input escapes its checkout.');
        const stat = await fs.stat(real);
        if (!stat.isFile() || stat.size > 32 * 1024 * 1024)
          throw new Error('Selected source input exceeds its file budget.');
        return fs.readFile(real);
      },
    });
    for (const [name, bytes] of selected) sourceFiles.set(name, bytes);
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
  files.set(EDITION_CAPACITY_REPORT, editionJSON(createEditionCapacityReport(files)));
  files.set(
    'checksums.json',
    editionJSON({
      format: 'revealline-edition-checksums.v1',
      files: [...files]
        .map(([name, bytes]) => editionDescriptor(name, bytes))
        .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)),
    }),
  );
  const capacityPacket = editionCapacityPacket(files);
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
    capacityMetadataFiles: capacityPacket.size,
    capacityMetadataBytes: [...capacityPacket.values()].reduce(
      (total, bytes) => total + bytes.length,
      0,
    ),
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
