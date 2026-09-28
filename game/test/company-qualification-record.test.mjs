import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  COMPANY_GATE_SCENARIOS,
  COMPANY_QUALIFICATION_GATES,
  createCompanyQualificationRecord,
  validateCompanyQualificationRecord,
} from '../../docs/verification/company-qualification-model.mjs';

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

function review(gate, suffix = gate) {
  const observations = COMPANY_GATE_SCENARIOS[gate].map(observation);
  return {
    id: `review-${suffix}`,
    editionIds: envelope.editions.map(({ id }) => id),
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
            sourceRevision,
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

test('performance requires two real edition-switch observations', () => {
  const record = createCompanyQualificationRecord(envelope, candidate);
  const entry = review('same-device-performance');
  record.reviews.push(entry);
  const report = validateCompanyQualificationRecord(envelope, record, { envelopeSha256 });
  const rows = report.coverage.filter(({ gate }) => gate === 'same-device-performance');
  assert(rows.every(({ status }) => status === 'pending'));
  assert(rows.every(({ missingScenarios }) => missingScenarios.includes('edition-switch (1/2)')));
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
