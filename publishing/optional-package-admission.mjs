import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { editionHash, inspectEditionZip } from './edition-zip.mjs';
import { OPTIONAL_PACKAGE_POLICIES, optionalRuntimePaths } from './optional-package-policy.mjs';
import { validatePublicSourceEligibility } from './edition-admission.mjs';

const editionDescriptor = (path, bytes) => ({
  path,
  bytes: bytes.length,
  sha256: editionHash(bytes),
});
const SHA = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const fail = (message) => {
  throw new Error(message);
};
const keys = (value, allowed, label) => {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !allowed.includes(key)) ||
    allowed.some((key) => !(key in value))
  )
    fail(`Invalid ${label} fields.`);
};
const parse = (bytes) => {
  if (!(bytes instanceof Uint8Array) || bytes.length > 1024 * 1024)
    fail('Optional metadata exceeds its bounded JSON limit.');
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
};
function descriptor(value) {
  keys(value, ['path', 'bytes', 'sha256'], 'optional descriptor');
  if (
    typeof value.path !== 'string' ||
    value.path.length > 240 ||
    !/^[A-Za-z0-9_-][A-Za-z0-9_.-]*(?:\/[A-Za-z0-9_-][A-Za-z0-9_.-]*)*$/.test(value.path) ||
    !Number.isSafeInteger(value.bytes) ||
    value.bytes < 0 ||
    value.bytes > 9 * 1024 * 1024 ||
    !SHA.test(value.sha256)
  )
    fail('Invalid optional artifact descriptor.');
  return value;
}
function rows(value, expected, budget) {
  if (!Array.isArray(value) || value.length !== expected.length || value.length > 64)
    fail('Optional dependency inventory is incomplete.');
  const found = new Set();
  let total = 0;
  for (const row of value) {
    descriptor(row);
    if (found.has(row.path) || !expected.includes(row.path))
      fail('Optional package contains an undeclared dependency.');
    found.add(row.path);
    total += row.bytes;
  }
  if (total > budget) fail('Optional package exceeds its byte budget.');
}
function matches(pin, bytes) {
  descriptor(pin);
  if (
    !(bytes instanceof Uint8Array) ||
    bytes.length !== pin.bytes ||
    editionHash(bytes) !== pin.sha256
  )
    fail(`Optional artifact bytes differ: ${pin.path}`);
}

/** Only explicit package policies enter this independent additive envelope.
 * It grants neither publication approval nor a fictional arcade edition. */
export async function validateOptionalPackageAdmission(envelope, { read } = {}) {
  keys(
    envelope,
    ['format', 'version', 'sourceRevision', 'sourceTree', 'packages'],
    'optional envelope',
  );
  if (
    envelope.format !== 'revealline-optional-packages.v1' ||
    !/^v\d+\.\d+\.\d+$/.test(envelope.version) ||
    !COMMIT.test(envelope.sourceRevision) ||
    !COMMIT.test(envelope.sourceTree) ||
    !Array.isArray(envelope.packages) ||
    !envelope.packages.length ||
    envelope.packages.length > 8 ||
    typeof read !== 'function'
  )
    fail('Invalid optional release envelope.');
  const seen = new Set(),
    artifacts = new Set(),
    admitted = [];
  for (const item of envelope.packages) {
    keys(
      item,
      [
        'id',
        'revision',
        'classification',
        'core',
        'entry',
        'manifest',
        'distribution',
        'sourceInventory',
        'sourceArchive',
      ],
      'optional package',
    );
    const policy = OPTIONAL_PACKAGE_POLICIES[item.id];
    if (
      !policy ||
      seen.has(item.id) ||
      !SHA.test(item.revision) ||
      item.classification !== 'public' ||
      item.core !== false ||
      item.entry !== policy.entry
    )
      fail('Optional package is not admitted by policy.');
    seen.add(item.id);
    const loaded = {};
    for (const [role, prefix, extension] of [
      ['manifest', 'manifest', 'json'],
      ['distribution', 'distribution', 'zip'],
      ['sourceInventory', 'source-inventory', 'json'],
      ['sourceArchive', 'source', 'zip'],
    ]) {
      const pin = descriptor(item[role]);
      if (pin.path !== `${prefix}-optional-${item.id}.${extension}` || artifacts.has(pin.path))
        fail('Unexpected optional release artifact.');
      artifacts.add(pin.path);
      loaded[role] = await read(pin);
      matches(pin, loaded[role]);
    }
    const manifest = parse(loaded.manifest);
    keys(
      manifest,
      [
        'format',
        'id',
        'revision',
        'classification',
        'workerTemplateSha256',
        'engineCommit',
        'engineTree',
        'qualification',
        'entry',
        'locales',
        'core',
        'limits',
        'installation',
        'files',
      ],
      'optional manifest',
    );
    if (
      manifest.format !== 'revealline-optional-practice-package.v1' ||
      manifest.id !== item.id ||
      manifest.revision !== item.revision ||
      manifest.classification !== 'public' ||
      manifest.core !== false ||
      manifest.entry !== item.entry ||
      manifest.engineCommit !== envelope.sourceRevision ||
      manifest.engineTree !== envelope.sourceTree ||
      manifest.qualification !== 'requires-release-qualification' ||
      !SHA.test(manifest.workerTemplateSha256) ||
      !isDeepStrictEqual(manifest.locales, ['en', 'uk']) ||
      !isDeepStrictEqual(manifest.limits, policy.limits)
    )
      fail('Optional manifest does not bind its frozen package.');
    rows(manifest.files, optionalRuntimePaths(policy, { launcher: true }), policy.limits.bytes);
    const runtime = inspectEditionZip(loaded.distribution, [
      ...manifest.files,
      editionDescriptor('optional-package.json', loaded.manifest),
    ]);
    const installation = manifest.installation;
    keys(
      installation,
      ['basePath', 'id', 'scope', 'startURL', 'launcherRoot'],
      'optional installation identity',
    );
    if (
      !/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(installation.basePath) ||
      installation.id !== `${installation.basePath}practice/${item.id}/` ||
      installation.scope !== installation.id ||
      installation.startURL !== `${installation.id}app/` ||
      installation.launcherRoot !== 'launcher/'
    )
      fail('Optional installation identity is not stable.');
    for (const name of [policy.root + 'app.webmanifest', 'launcher/app.webmanifest']) {
      const app = parse(runtime.get(name));
      if (
        app.id !== installation.id ||
        app.scope !== installation.scope ||
        app.start_url !== installation.startURL ||
        !Array.isArray(app.icons) ||
        app.icons.length !== 2 ||
        !app.icons.every(
          (icon, index) => icon.src === `${installation.id}app/icons/icon-${[192, 512][index]}.png`,
        )
      )
        fail('Optional app and launcher installation identities differ.');
    }
    const inventory = parse(loaded.sourceInventory);
    keys(
      inventory,
      [
        'format',
        'version',
        'sourceRevision',
        'sourceTree',
        'packageId',
        'packageRevision',
        'classification',
        'kind',
        'description',
        'inputs',
        'files',
        'projections',
        'generated',
        'licenses',
      ],
      'optional source inventory',
    );
    if (
      inventory.format !== 'revealline-optional-package-source.v1' ||
      inventory.version !== envelope.version ||
      inventory.sourceRevision !== envelope.sourceRevision ||
      inventory.sourceTree !== envelope.sourceTree ||
      inventory.packageId !== item.id ||
      inventory.packageRevision !== item.revision ||
      inventory.classification !== 'public' ||
      inventory.kind !== 'selected-inputs-and-projections' ||
      typeof inventory.description !== 'string' ||
      inventory.description.length > 1000
    )
      fail('Optional source inventory identity differs.');
    const inputPaths = [
      ...policy.localFiles.map((name) => policy.root + name),
      ...policy.sharedFiles.filter((name) => name !== 'game/i18n/catalogs.mjs'),
      policy.template,
      policy.launcherTemplate,
      ...policy.localeInputs,
    ];
    rows(inventory.inputs, inputPaths, policy.limits.bytes);
    rows(
      inventory.files,
      [
        ...optionalRuntimePaths(policy, { launcher: true }),
        policy.template,
        policy.launcherTemplate,
      ],
      policy.limits.bytes,
    );
    const source = inspectEditionZip(loaded.sourceArchive, [
      ...inventory.files,
      editionDescriptor('source-inventory.json', loaded.sourceInventory),
    ]);
    validatePublicSourceEligibility({ files: source });
    for (const row of manifest.files)
      if (row.path !== policy.root + 'app.webmanifest') matches(row, source.get(row.path));
    for (const row of inventory.inputs)
      if (!policy.localeInputs.includes(row.path)) matches(row, source.get(row.path));
    const expectedProjection = [
      {
        kind: 'stable-installation-identity',
        output: editionDescriptor(
          policy.root + 'app.webmanifest',
          runtime.get(policy.root + 'app.webmanifest'),
        ),
        inputs: [policy.root + 'app.webmanifest'],
      },
      {
        kind: 'selected-validator-locales',
        output: editionDescriptor('game/i18n/catalogs.mjs', runtime.get('game/i18n/catalogs.mjs')),
        inputs: policy.localeInputs,
      },
    ];
    if (
      !isDeepStrictEqual(inventory.projections, expectedProjection) ||
      !isDeepStrictEqual(inventory.generated, [
        ...['worker.js', 'icons/icon-192.png', 'icons/icon-512.png'].map(
          (name) => policy.root + name,
        ),
        ...optionalRuntimePaths(policy, { launcher: true }).filter((name) =>
          name.startsWith('launcher/'),
        ),
      ])
    )
      fail('Unknown optional source projection or generated dependency.');
    const licenseRows = policy.licenses.map((license) => ({
      ...license,
      ...editionDescriptor(license.path, runtime.get(license.path)),
    }));
    if (!isDeepStrictEqual(inventory.licenses, licenseRows))
      fail('Optional dependency license inventory differs.');
    // Check the serialized worker without evaluating imported archive code.
    const template = new TextDecoder('utf-8', { fatal: true }).decode(source.get(policy.template));
    const start = template.indexOf('export function installPracticeWorker(');
    if (start < 0) fail('Optional worker template is missing its registered entry.');
    const functionSource = template.slice(start + 'export '.length).trim();
    if (
      !functionSource.endsWith('}') ||
      editionHash(Buffer.from(functionSource)) !== manifest.workerTemplateSha256
    )
      fail('Optional worker template pin differs.');
    const launcherTemplate = new TextDecoder('utf-8', { fatal: true }).decode(
      source.get(policy.launcherTemplate),
    );
    const launcherStart = launcherTemplate.indexOf('export function installOptionalLauncher(');
    if (launcherStart < 0) fail('Optional launcher template is missing its registered entry.');
    const launcherFunction = launcherTemplate.slice(launcherStart + 'export '.length).trim();
    const launcherApp = Buffer.from(
      `import { optionalInstallationKey, validateOptionalInstallationReference } from './context.mjs';\n(${launcherFunction})(${JSON.stringify({ packageId: item.id, root: installation.id })}, { optionalInstallationKey, validateOptionalInstallationReference });\n`,
    );
    if (
      !launcherFunction.endsWith('}') ||
      !launcherApp.equals(Buffer.from(runtime.get('launcher/app.mjs')))
    )
      fail('Optional launcher differs from its committed template.');
    if (
      !Buffer.from(runtime.get('launcher/context.mjs')).equals(
        Buffer.from(source.get('optional-practice/install-context.mjs')),
      )
    )
      fail('Optional launcher context differs from the shared installation adapter.');
    for (const size of [192, 512])
      if (
        !Buffer.from(runtime.get(`launcher/icons/icon-${size}.png`)).equals(
          Buffer.from(runtime.get(`${policy.root}icons/icon-${size}.png`)),
        )
      )
        fail('Optional launcher icon differs from its package.');
    const launcherNames = [
      'index.html',
      'app.mjs',
      'context.mjs',
      'app.webmanifest',
      'icons/icon-192.png',
      'icons/icon-512.png',
    ];
    const launcherPins = launcherNames.map((name) =>
      editionDescriptor(name, runtime.get('launcher/' + name)),
    );
    const launcherRevision = editionHash(Buffer.from(JSON.stringify(launcherPins)));
    const launcherWorker = Buffer.from(
      `// Generated exact optional launcher cache.\n(${functionSource})(self, ${JSON.stringify(launcherPins)}, ${JSON.stringify(launcherRevision)});\n`,
    );
    if (!launcherWorker.equals(Buffer.from(runtime.get('launcher/worker.js'))))
      fail('Optional launcher offline worker differs from its own dependency closure.');
    const beforeWorker = manifest.files
      .filter((row) => row.path !== policy.root + 'worker.js')
      .map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 }));
    const revision = editionHash(
      Buffer.from(
        JSON.stringify({
          files: beforeWorker,
          workerTemplateSha256: manifest.workerTemplateSha256,
          engineCommit: envelope.sourceRevision,
          engineTree: envelope.sourceTree,
        }),
      ),
    );
    if (revision !== manifest.revision)
      fail('Optional content revision differs from its dependencies.');
    const pins = beforeWorker.map((row) => ({
      ...row,
      path: path.posix.relative(policy.root, row.path),
    }));
    const worker = Buffer.from(
      `// Generated exact optional-package cache.\n(${functionSource})(self, ${JSON.stringify(pins)}, ${JSON.stringify(revision)});\n`,
    );
    if (!worker.equals(Buffer.from(runtime.get(policy.root + 'worker.js'))))
      fail('Optional offline worker differs from its declared dependency closure.');
    const total = [...runtime.values()].reduce((sum, bytes) => sum + bytes.length, 0);
    if (runtime.size > policy.limits.files || total > policy.limits.bytes)
      fail('Complete optional package exceeds its budget.');
    admitted.push({ id: item.id, revision: item.revision, files: runtime.size, bytes: total });
  }
  return Object.freeze({
    format: 'revealline-optional-package-admission.v1',
    version: envelope.version,
    sourceRevision: envelope.sourceRevision,
    sourceTree: envelope.sourceTree,
    packages: admitted,
    zipMembersVerified: true,
    publicEligible: false,
  });
}

export const OPTIONAL_PACKAGE_REVIEW_GATES = Object.freeze([
  'automated-validation',
  'content-accuracy',
  'asset-and-license-review',
  'keyboard-controller-accessibility',
  'installed-isolation',
  'update-and-rollback',
  'same-device-performance',
  'human-learning-and-pacing',
]);
export function createOptionalPackageReview(envelopeBytes) {
  const envelope = parse(envelopeBytes);
  return {
    format: 'revealline-optional-package-review.v1',
    envelopeSha256: editionHash(envelopeBytes),
    version: envelope.version,
    sourceRevision: envelope.sourceRevision,
    sourceTree: envelope.sourceTree,
    publication: 'public',
    packages: envelope.packages.map(({ id }) => ({
      id,
      gates: OPTIONAL_PACKAGE_REVIEW_GATES.map((gate) => ({
        id: gate,
        status: 'pending',
        reviewer: null,
        reviewedAt: null,
        evidence: null,
      })),
    })),
  };
}
export async function verifyOptionalPackageReview(envelopeBytes, review, { read } = {}) {
  const envelope = parse(envelopeBytes);
  const admission = await validateOptionalPackageAdmission(envelope, { read });
  const template = createOptionalPackageReview(envelopeBytes);
  keys(review, Object.keys(template), 'optional review');
  for (const key of [
    'format',
    'envelopeSha256',
    'version',
    'sourceRevision',
    'sourceTree',
    'publication',
  ])
    if (review[key] !== template[key]) fail('Optional review differs from its frozen envelope.');
  if (!Array.isArray(review.packages) || review.packages.length !== envelope.packages.length)
    fail('Optional review coverage is incomplete.');
  const ids = new Set();
  for (const row of review.packages) {
    keys(row, ['id', 'gates'], 'optional package review');
    if (
      ids.has(row.id) ||
      !envelope.packages.some((item) => item.id === row.id) ||
      !Array.isArray(row.gates) ||
      row.gates.length !== OPTIONAL_PACKAGE_REVIEW_GATES.length
    )
      fail('Optional review package coverage differs.');
    ids.add(row.id);
    const gates = new Set();
    for (const gate of row.gates) {
      keys(gate, ['id', 'status', 'reviewer', 'reviewedAt', 'evidence'], 'optional review gate');
      if (
        gates.has(gate.id) ||
        !OPTIONAL_PACKAGE_REVIEW_GATES.includes(gate.id) ||
        gate.status !== 'passed' ||
        typeof gate.reviewer !== 'string' ||
        !gate.reviewer.trim() ||
        gate.reviewer.length > 500 ||
        typeof gate.reviewedAt !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T/.test(gate.reviewedAt) ||
        !Number.isFinite(Date.parse(gate.reviewedAt))
      )
        fail('Every optional promotion gate requires reviewed evidence.');
      gates.add(gate.id);
      const evidence = gate.evidence;
      keys(
        evidence,
        ['path', 'bytes', 'sha256', 'publication', 'approved'],
        'optional review evidence',
      );
      if (
        !/^review-optional-[a-z0-9][a-z0-9.-]*\.(?:json|md|txt|png|webp)$/.test(evidence.path) ||
        evidence.publication !== 'public' ||
        evidence.approved !== true ||
        evidence.bytes <= 0
      )
        fail('Optional review evidence must be approved and public.');
      const pin = { path: evidence.path, bytes: evidence.bytes, sha256: evidence.sha256 };
      descriptor(pin);
      matches(pin, await read(evidence));
    }
  }
  return Object.freeze({
    ...admission,
    publicEligible: true,
    reviewSha256: editionHash(Buffer.from(JSON.stringify(review))),
  });
}
