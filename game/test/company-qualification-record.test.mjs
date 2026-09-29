import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  COMPANY_GATE_SCENARIOS,
  COMPANY_QUALIFICATION_GATES,
  compileCompanyQualificationReview,
  createCompanyQualificationRecord,
  validateCompanyQualificationRecord,
} from '../../docs/verification/company-qualification-model.mjs';
import { EDITION_REVIEW_GATES, verifyEditionReview } from '../../publishing/edition-promotion.mjs';
import { editionAdmissionFixture } from '../../publishing/edition-fixture.mjs';

const sourceRevision = 'a'.repeat(40);
const sourceTree = 'b'.repeat(40);
const envelopeSha256 = 'c'.repeat(64);
const envelope = {
  format: 'revealline-editions.v1',
  version: 'v0.142.0',
  sourceRevision,
  sourceTree,
  editions: [{ id: 'coupa-all' }, { id: 'droneaid-nl-community' }],
};
const candidate = {
  envelopeSha256,
  sourceRevision,
  sourceTree,
  version: envelope.version,
  artifact: {
    id: 123456,
    name: `company-candidate-${sourceRevision}`,
    bytes: 725_000_000,
    sha256: 'd'.repeat(64),
  },
};
const observation = (scenario) => ({
  scenario,
  expected: `Expected ${scenario}.`,
  observed: `Observed ${scenario}.`,
  outcome: 'passed',
});
const environment = {
  actualDevice: true,
  installedApp: true,
  emulated: false,
  os: 'Example OS 1',
  browser: 'Example Browser 1',
  device: 'Synthetic device fixture',
  viewport: '1280x800 @1x',
  input: 'Keyboard and controller',
  assistiveTechnology: 'Synthetic fixture only',
};

function review(
  gate,
  suffix = gate,
  { editionIds = envelope.editions.map(({ id }) => id), revision = sourceRevision } = {},
) {
  const observations = COMPANY_GATE_SCENARIOS[gate].map(observation);
  return {
    id: `review-${suffix}`,
    editionIds,
    gate,
    status: 'passed',
    reviewer: 'Synthetic test fixture reviewer',
    reviewedAt: '2026-09-28T12:00:00.000Z',
    summary: 'Synthetic test fixture only; this is not a real qualification result.',
    environment:
      gate === 'automated-validation' ||
      ![
        'accessibility',
        'installed-pwa-isolation',
        'update-and-rollback',
        'storage-and-backup-recovery',
        'same-device-performance',
      ].includes(gate)
        ? null
        : structuredClone(environment),
    automation:
      gate === 'automated-validation'
        ? {
            conclusion: 'success',
            sourceRevision: revision,
            runUrl: 'https://github.com/example/revealline/actions/runs/123',
          }
        : null,
    observations,
  };
}

test('a new exact-candidate record starts pending and cannot imply qualification', () => {
  const record = createCompanyQualificationRecord(envelope, candidate);
  assert.deepEqual(record.reviews, []);
  const report = validateCompanyQualificationRecord(envelope, record, { envelopeSha256 });
  assert.equal(report.ready, false);
  assert.deepEqual(report.counts, { passed: 0, pending: 18, failed: 0, unavailable: 0 });
});

test('coverage becomes ready only after every edition gate has all bounded scenarios', () => {
  const record = createCompanyQualificationRecord(envelope, candidate);
  record.reviews = COMPANY_QUALIFICATION_GATES.map((gate) => review(gate));
  const secondSwitch = review('same-device-performance', 'performance-second-switch');
  secondSwitch.observations = [observation('edition-switch')];
  record.reviews.push(secondSwitch);
  const report = validateCompanyQualificationRecord(envelope, record, { envelopeSha256 });
  assert.equal(report.ready, true);
  assert.deepEqual(report.counts, { passed: 18, pending: 0, failed: 0, unavailable: 0 });
  assert(report.coverage.every(({ missingScenarios }) => missingScenarios.length === 0));
});

test('complete qualification compiles to the existing hash-bound promotion review schema', () => {
  const record = createCompanyQualificationRecord(envelope, candidate);
  record.reviews = COMPANY_QUALIFICATION_GATES.map((gate) => review(gate));
  const secondSwitch = review('same-device-performance', 'performance-second-review');
  secondSwitch.observations = [observation('edition-switch')];
  record.reviews.push(secondSwitch);
  const evidence = {
    path: `review-company-qualification-${envelope.version}.json`,
    bytes: 4_096,
    sha256: 'e'.repeat(64),
    publication: 'public',
    approved: true,
  };
  const compiled = compileCompanyQualificationReview(envelope, record, {
    envelopeSha256,
    evidence,
  });
  assert.deepEqual(COMPANY_QUALIFICATION_GATES, EDITION_REVIEW_GATES);
  assert.equal(compiled.format, 'revealline-edition-review.v1');
  assert.deepEqual(
    compiled.editions.map(({ id }) => id),
    envelope.editions.map(({ id }) => id),
  );
  assert(
    compiled.editions.every(({ gates }) =>
      gates.every(
        (gate) =>
          gate.status === 'passed' &&
          gate.evidence.path === evidence.path &&
          gate.evidence.sha256 === evidence.sha256,
      ),
    ),
  );
});

test('compiled qualification passes the actual immutable edition promotion verifier', async () => {
  const fixture = editionAdmissionFixture({ version: 'v0.142.0', editionId: 'coupa-all' }),
    envelopeBytes = fixture.files.get('editions.json'),
    exactEnvelopeSha256 = createHash('sha256').update(envelopeBytes).digest('hex'),
    exactCandidate = {
      envelopeSha256: exactEnvelopeSha256,
      sourceRevision: fixture.envelope.sourceRevision,
      sourceTree: fixture.envelope.sourceTree,
      version: fixture.envelope.version,
      artifact: {
        id: 123456,
        name: `company-candidate-${fixture.envelope.sourceRevision}`,
        bytes: 1_024,
        sha256: 'd'.repeat(64),
      },
    },
    record = createCompanyQualificationRecord(fixture.envelope, exactCandidate),
    reviewOptions = {
      editionIds: fixture.envelope.editions.map(({ id }) => id),
      revision: fixture.envelope.sourceRevision,
    };
  record.reviews = COMPANY_QUALIFICATION_GATES.map((gate) =>
    review(gate, `admission-${gate}`, reviewOptions),
  );
  const secondSwitch = review('same-device-performance', 'admission-second-switch', reviewOptions);
  secondSwitch.observations = [observation('edition-switch')];
  record.reviews.push(secondSwitch);
  const qualificationBytes = Buffer.from(`${JSON.stringify(record, null, 2)}\n`),
    evidencePath = `review-company-qualification-${fixture.envelope.version}.json`;
  fixture.files.set(evidencePath, qualificationBytes);
  const compiled = compileCompanyQualificationReview(fixture.envelope, record, {
      envelopeSha256: exactEnvelopeSha256,
      evidence: {
        path: evidencePath,
        bytes: qualificationBytes.length,
        sha256: createHash('sha256').update(qualificationBytes).digest('hex'),
        publication: 'public',
        approved: true,
      },
    }),
    admission = await verifyEditionReview(envelopeBytes, compiled, { read: fixture.read });
  assert.equal(admission.publicEligible, true);
  assert.equal(admission.zipMembersVerified, true);
});

test('incomplete qualification cannot compile promotion review output', () => {
  const record = createCompanyQualificationRecord(envelope, candidate);
  assert.throws(
    () =>
      compileCompanyQualificationReview(envelope, record, {
        envelopeSha256,
        evidence: {
          path: `review-company-qualification-${envelope.version}.json`,
          bytes: 1,
          sha256: 'e'.repeat(64),
          publication: 'public',
          approved: true,
        },
      }),
    /incomplete/,
  );
});

test('performance requires two real edition-switch observations', () => {
  const record = createCompanyQualificationRecord(envelope, candidate);
  const entry = review('same-device-performance');
  record.reviews.push(entry);
  const report = validateCompanyQualificationRecord(envelope, record, { envelopeSha256 });
  const rows = report.coverage.filter(({ gate }) => gate === 'same-device-performance');
  assert(rows.every(({ status }) => status === 'pending'));
  assert(rows.every(({ missingScenarios }) => missingScenarios.includes('edition-switch (1/2)')));
});

test('performance evidence cannot combine observations from different device environments', () => {
  for (const mutateEnvironment of [
    (value) => {
      value.device = 'Different synthetic device';
    },
    (value) => {
      value.browser = 'Example Browser 2';
    },
  ]) {
    const record = createCompanyQualificationRecord(envelope, candidate);
    record.reviews = COMPANY_QUALIFICATION_GATES.map((gate) => review(gate));
    const secondSwitch = review('same-device-performance', 'split-environment-second-switch');
    secondSwitch.observations = [observation('edition-switch')];
    mutateEnvironment(secondSwitch.environment);
    record.reviews.push(secondSwitch);
    const report = validateCompanyQualificationRecord(envelope, record, { envelopeSha256 }),
      rows = report.coverage.filter(({ gate }) => gate === 'same-device-performance');
    assert.equal(report.ready, false);
    assert(rows.every(({ status }) => status === 'pending'));
    assert(rows.every(({ missingScenarios }) => missingScenarios.includes('edition-switch (1/2)')));
    assert.throws(
      () =>
        compileCompanyQualificationReview(envelope, record, {
          envelopeSha256,
          evidence: {
            path: `review-company-qualification-${envelope.version}.json`,
            bytes: 1,
            sha256: 'e'.repeat(64),
            publication: 'public',
            approved: true,
          },
        }),
      /incomplete/,
    );
  }
});

test('performance evidence combines separate reviews from one exact device environment', () => {
  const record = createCompanyQualificationRecord(envelope, candidate);
  record.reviews = COMPANY_QUALIFICATION_GATES.map((gate) => review(gate));
  const secondSwitch = review('same-device-performance', 'coherent-environment-second-switch');
  secondSwitch.observations = [observation('edition-switch')];
  secondSwitch.environment = structuredClone(
    record.reviews.find(({ gate }) => gate === 'same-device-performance').environment,
  );
  record.reviews.push(secondSwitch);
  const report = validateCompanyQualificationRecord(envelope, record, { envelopeSha256 });
  assert.equal(report.ready, true);
  assert(
    report.coverage
      .filter(({ gate }) => gate === 'same-device-performance')
      .every(
        ({ status, missingScenarios }) => status === 'passed' && missingScenarios.length === 0,
      ),
  );
});

test('one review cannot duplicate a scenario to satisfy a repeated observation', () => {
  const record = createCompanyQualificationRecord(envelope, candidate);
  const entry = review('same-device-performance');
  entry.observations.push(observation('edition-switch'));
  record.reviews.push(entry);
  assert.throws(
    () => validateCompanyQualificationRecord(envelope, record, { envelopeSha256 }),
    /same scenario more than once/,
  );
});

test('device gates reject emulation, normal tabs and one-sided cross-edition claims', () => {
  for (const mutate of [
    (entry) => {
      entry.environment.actualDevice = false;
    },
    (entry) => {
      entry.environment.emulated = true;
    },
    (entry) => {
      entry.environment.installedApp = false;
    },
    (entry) => {
      entry.editionIds = ['coupa-all'];
    },
  ]) {
    const record = createCompanyQualificationRecord(envelope, candidate);
    const entry = review('installed-pwa-isolation');
    mutate(entry);
    record.reviews.push(entry);
    assert.throws(
      () => validateCompanyQualificationRecord(envelope, record, { envelopeSha256 }),
      /[Dd]evice|Cross-edition/,
    );
  }
});

test('candidate, envelope and exact-source automation identities fail closed', () => {
  for (const mutate of [
    (record) => {
      record.candidate.artifact.sha256 = '0'.repeat(63);
    },
    (record) => {
      record.candidate.artifact.name = 'company-candidate-latest';
    },
    (record) => {
      record.reviews[0].automation.sourceRevision = '0'.repeat(40);
    },
    (record) => {
      record.reviews[0].automation.runUrl = 'https://example.com/passed';
    },
  ]) {
    const record = createCompanyQualificationRecord(envelope, candidate);
    record.reviews.push(review('automated-validation'));
    mutate(record);
    assert.throws(() => validateCompanyQualificationRecord(envelope, record, { envelopeSha256 }));
  }
  const record = createCompanyQualificationRecord(envelope, candidate);
  assert.throws(() =>
    validateCompanyQualificationRecord(envelope, record, { envelopeSha256: 'e'.repeat(64) }),
  );
});

test('a failed observation remains failed instead of being hidden by a later pass', () => {
  const record = createCompanyQualificationRecord(envelope, candidate);
  const failed = review('asset-review', 'asset-failed');
  failed.status = 'failed';
  failed.observations = [
    {
      ...observation('mission-art'),
      outcome: 'failed',
      observed: 'A crop obscured the objective.',
    },
  ];
  record.reviews.push(failed, review('asset-review', 'asset-retest'));
  const report = validateCompanyQualificationRecord(envelope, record, { envelopeSha256 });
  assert(
    report.coverage
      .filter(({ gate }) => gate === 'asset-review')
      .every(({ status }) => status === 'failed'),
  );
});

test('an unavailable same-device environment remains unavailable', () => {
  const record = createCompanyQualificationRecord(envelope, candidate);
  const unavailable = review('same-device-performance', 'performance-unavailable');
  unavailable.status = 'unavailable';
  unavailable.observations = unavailable.observations.map((value) => ({
    ...value,
    outcome: 'unavailable',
    observed: 'The required device environment was unavailable.',
  }));
  record.reviews.push(unavailable);
  const report = validateCompanyQualificationRecord(envelope, record, { envelopeSha256 });
  assert(
    report.coverage
      .filter(({ gate }) => gate === 'same-device-performance')
      .every(({ status }) => status === 'unavailable'),
  );
});

test('the recorder defaults to pending and describes its non-publication boundary', async () => {
  const html = await fs.readFile(
    new URL('../../docs/verification/company-qualification.html', import.meta.url),
    'utf8',
  );
  assert.match(html, /<option value="pending" selected>Pending<\/option>/);
  assert.doesNotMatch(html, /<option value="passed" selected>/);
  assert.match(html, /never\s+changes an edition, release or publication selector/);
  assert.match(html, /OS-installed app window/);
});

test('promotion CLI writes exact evidence only for a complete record and never replaces outputs', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'company-qualification-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const bundle = path.join(root, 'bundle'),
    envelopeBytes = Buffer.from(`${JSON.stringify(envelope, null, 2)}\n`),
    exactEnvelopeSha256 = createHash('sha256').update(envelopeBytes).digest('hex'),
    exactCandidate = { ...candidate, envelopeSha256: exactEnvelopeSha256 },
    input = path.join(root, 'qualification.json'),
    output = path.join(root, 'edition-review.json'),
    script = fileURLToPath(
      new URL('../../docs/verification/compile-company-qualification.mjs', import.meta.url),
    ),
    run = () =>
      spawnSync(
        process.execPath,
        [script, '--bundle', bundle, '--review', output, '--qualification', input],
        { encoding: 'utf8' },
      );
  await fs.mkdir(bundle);
  await fs.writeFile(path.join(bundle, 'editions.json'), envelopeBytes);
  const pending = createCompanyQualificationRecord(envelope, exactCandidate);
  await fs.writeFile(input, `${JSON.stringify(pending, null, 2)}\n`);
  const rejected = run();
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /incomplete/);
  await assert.rejects(fs.access(output));
  await assert.rejects(
    fs.access(path.join(bundle, `review-company-qualification-${envelope.version}.json`)),
  );

  const complete = createCompanyQualificationRecord(envelope, exactCandidate);
  complete.reviews = COMPANY_QUALIFICATION_GATES.map((gate) => review(gate));
  const secondSwitch = review('same-device-performance', 'cli-second-switch');
  secondSwitch.observations = [observation('edition-switch')];
  complete.reviews.push(secondSwitch);
  const qualificationBytes = Buffer.from(`${JSON.stringify(complete, null, 2)}\n`);
  await fs.writeFile(input, qualificationBytes);
  const accepted = run();
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.match(accepted.stdout, /No release or selector was changed/);
  const evidencePath = path.join(bundle, `review-company-qualification-${envelope.version}.json`);
  assert((await fs.readFile(evidencePath)).equals(qualificationBytes));
  const compiled = JSON.parse(await fs.readFile(output, 'utf8'));
  assert.equal(compiled.format, 'revealline-edition-review.v1');
  assert(compiled.editions.every(({ gates }) => gates.every(({ status }) => status === 'passed')));
  const before = await fs.readFile(output);
  const replacement = run();
  assert.notEqual(replacement.status, 0);
  assert.match(replacement.stderr, /Refusing to replace existing promotion output/);
  assert((await fs.readFile(output)).equals(before));
});
