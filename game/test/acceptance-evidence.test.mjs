import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterProject } from '../content-design/starter.mjs';
import { createTeamOpeningCandidates } from '../content-design/team-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import {
  PLAYTEST_EVIDENCE_FORMAT,
  PLAYTEST_LEDGER_FORMAT,
  MISSION_ACCEPTANCE_CHECKS,
  missionEvidenceTarget,
  readPlaytestEvidence,
  readPlaytestLedger,
  appendPlaytestEvidence,
  inspectMissionAcceptance,
} from '../content-design/acceptance-evidence.mjs';

// Synthetic contract fixtures only. These are not real testing or acceptance records.
const source = createStarterProject(),
  id = source.missions[0].id,
  sourceCommit = 'a'.repeat(40),
  options = { sourceCommit },
  target = missionEvidenceTarget(source, id, options);
function record(overrides = {}) {
  return {
    format: PLAYTEST_EVIDENCE_FORMAT,
    id: 'synthetic-contract-test',
    target,
    kind: 'automated',
    observedAt: '2026-09-21T10:00:00.000Z',
    method: 'Synthetic unit fixture, not observed acceptance evidence.',
    checks: [
      { id: 'capture-contract', outcome: 'pass', detail: 'Synthetic contract assertion only.' },
    ],
    artifacts: [],
    supersedes: null,
    ...overrides,
  };
}
const report = (ledger, selection = {}) =>
  inspectMissionAcceptance(source, id, {
    ...options,
    ...(ledger === undefined ? {} : { ledger }),
    ...selection,
  });
const status = (result, check) => result.checks.find((item) => item.id === check).status;

test('Solo, Versus and explicit Team targets use the shared resolver and pin the full experience', () => {
  for (const [project, mode] of [
    [source, 'solo'],
    [source, 'versus'],
    [createTeamOpeningCandidates(), 'team'],
  ]) {
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      const missionId = project.missions[0].id,
        selection = { sourceCommit, mode, difficulty },
        target = missionEvidenceTarget(project, missionId, selection),
        manifest = resolveMission(compileContentProject(project), missionId, { mode, difficulty });
      assert.equal(target.simulationIdentity, manifest.simulationIdentity);
      assert.equal(target.projectId, project.id);
      assert.equal(target.missionId, missionId);
      assert.equal(target.mode, mode);
      assert.equal(target.difficulty, difficulty);
      assert.equal(target.sourceCommit, sourceCommit);
      assert(Object.isFrozen(target));
      assert.deepEqual(target, missionEvidenceTarget(project, missionId, selection));
    }
  }
  assert.throws(() => missionEvidenceTarget(source, id, { sourceCommit, mode: 'team' }));
  assert.throws(() => missionEvidenceTarget(source, id), /exact source commit/);
  assert.throws(
    () => missionEvidenceTarget(source, id, { sourceCommit: 'HEAD' }),
    /exact source commit/,
  );
});

test('missing evidence never becomes human validation, publication or gameplay progress', () => {
  const before = JSON.stringify(source),
    result = report(undefined);
  assert(result.checks.every((item) => item.status === 'missing'));
  assert.equal(result.releaseEligible, false);
  assert.equal(result.qualification, 'local-evidence-claims-require-review-not-release-approval');
  assert.equal(JSON.stringify(source), before);
  assert.equal(
    result.checks.some((item) => item.id === 'team-coordination'),
    false,
  );
  assert.equal(
    result.checks.some((item) => item.id === 'versus-parity'),
    false,
  );
});

test('append is immutable and idempotent, while an altered existing ID fails atomically', () => {
  const empty = readPlaytestLedger(),
    first = record(),
    ledger = appendPlaytestEvidence(empty, first);
  assert.equal(empty.records.length, 0);
  assert.equal(ledger.records.length, 1);
  assert(Object.isFrozen(ledger.records[0].checks[0]));
  assert.deepEqual(appendPlaytestEvidence(ledger, first), ledger);
  assert.throws(
    () => appendPlaytestEvidence(ledger, { ...first, method: 'Changed observation' }),
    /cannot be overwritten/,
  );
  assert.equal(ledger.records[0].method, first.method);
  assert.equal(status(report(ledger), 'capture-contract'), 'reported-pass');
  assert.equal(status(report(ledger), 'capture-understanding'), 'missing');
});

test('a later pass cannot silently mask a failure; exact-target explicit supersession retains history', () => {
  const failed = record({
      checks: [{ id: 'capture-contract', outcome: 'fail', detail: 'Synthetic failure.' }],
    }),
    first = appendPlaytestEvidence(undefined, failed),
    second = appendPlaytestEvidence(first, record({ id: 'second' }));
  assert.equal(status(report(second), 'capture-contract'), 'reported-fail');
  const third = appendPlaytestEvidence(
      second,
      record({ id: 'explicit-correction', supersedes: failed.id }),
    ),
    inspection = report(third);
  assert.equal(third.records.length, 3);
  assert.equal(status(inspection, 'capture-contract'), 'reported-pass');
  assert.deepEqual(inspection.supersededEvidenceIds, [failed.id]);
  assert.deepEqual(inspection.currentEvidenceIds, ['second', 'explicit-correction']);
  assert.throws(
    () => appendPlaytestEvidence(first, record({ id: 'bad-link', supersedes: 'future-record' })),
    /earlier evidence/,
  );
  assert.throws(
    () =>
      appendPlaytestEvidence(
        first,
        record({
          id: 'wrong-edition',
          supersedes: failed.id,
          target: { ...target, sourceCommit: 'b'.repeat(40) },
        }),
      ),
    /exact target/,
  );
});

test('automated and browser observations cannot supply human understanding or physical-device checks', () => {
  for (const kind of ['automated', 'native'])
    for (const id of [
      'capture-understanding',
      'failure-understanding',
      'mission-distinction',
      'voluntary-retry',
      'pacing',
      'touch',
      'controller',
    ])
      assert.throws(
        () =>
          readPlaytestEvidence(
            record({
              kind,
              checks: [{ id, outcome: 'pass', detail: 'A script is not a person.' }],
            }),
          ),
        /evidence kind/,
      );
  const human = readPlaytestEvidence(
    record({
      kind: 'human',
      checks: [
        {
          id: 'voluntary-retry',
          outcome: 'not-run',
          detail: 'No person has tested this synthetic fixture.',
        },
      ],
    }),
  );
  assert.equal(
    status(report(appendPlaytestEvidence(undefined, human)), 'voluntary-retry'),
    'not-run',
  );
});

test('all permitted reported passes still remain unverified claims and cannot approve a release', () => {
  let ledger = readPlaytestLedger();
  for (const kind of ['automated', 'native', 'human']) {
    const observations = MISSION_ACCEPTANCE_CHECKS.filter(
      (check) => check.modes.includes('solo') && check.kinds[0] === kind,
    ).map((check) => ({
      id: check.id,
      outcome: 'pass',
      detail: 'Synthetic report projection, not observed evidence.',
    }));
    if (observations.length)
      ledger = appendPlaytestEvidence(
        ledger,
        record({ id: `synthetic-${kind}`, kind, checks: observations }),
      );
  }
  const result = report(ledger);
  assert(result.checks.every((check) => check.status === 'reported-pass'));
  assert.equal(result.releaseEligible, false);
  assert(result.limitations.some((line) => line.includes('not authenticated human')));
});

test('build and preset changes retain old evidence but never count it as current', () => {
  const ledger = appendPlaytestEvidence(undefined, record());
  for (const selection of [{ sourceCommit: 'b'.repeat(40) }, { difficulty: 'expert' }]) {
    const result = report(ledger, selection);
    assert.deepEqual(result.currentEvidenceIds, []);
    assert.deepEqual(result.staleEvidenceIds, ['synthetic-contract-test']);
    assert.equal(status(result, 'capture-contract'), 'missing');
  }
});

test('presentation and lesson changes invalidate experience evidence even when physics stay the same', () => {
  const ledger = appendPlaytestEvidence(undefined, record());
  for (const change of [
    (project) => {
      project.missions[0].name = 'Renamed mission';
    },
    (project) => {
      project.missions[0].design.lesson += ' Additional lesson.';
    },
    (project) => {
      project.missions[0].presentation.themeId = 'different-theme';
    },
  ]) {
    const revised = structuredClone(source);
    change(revised);
    const next = missionEvidenceTarget(revised, id, options);
    assert.equal(next.simulationIdentity, target.simulationIdentity);
    assert.notEqual(next.experienceIdentity, target.experienceIdentity);
    assert.deepEqual(
      inspectMissionAcceptance(revised, id, { ...options, ledger }).staleEvidenceIds,
      ['synthetic-contract-test'],
    );
  }
});

test('unknown fields, invalid timestamps, duplicate checks, mismatched modes and oversized inputs fail closed', () => {
  for (const candidate of [
    record({ approval: true }),
    record({ observedAt: '2026-02-30T10:00:00.000Z' }),
    record({ observedAt: 'tomorrow' }),
    record({ method: ' ' }),
    record({ checks: [record().checks[0], record().checks[0]] }),
    record({ checks: [{ id: 'versus-parity', outcome: 'pass', detail: 'Wrong mode.' }] }),
    record({ checks: [{ id: 'invented-approval', outcome: 'pass', detail: 'Unknown check.' }] }),
    record({
      artifacts: [{ sha256: 'f'.repeat(64), bytes: 0, mediaType: 'image/png', label: 'Empty' }],
    }),
    record({
      artifacts: [
        {
          sha256: 'f'.repeat(64),
          bytes: 1,
          mediaType: 'image/png',
          label: 'No executable URL field',
          url: 'javascript:alert(1)',
        },
      ],
    }),
  ])
    assert.throws(() => readPlaytestEvidence(candidate));
  assert.throws(() => readPlaytestEvidence(record({ method: 'x'.repeat(2001) })), /budget/);
  assert.throws(
    () => readPlaytestLedger({ format: PLAYTEST_LEDGER_FORMAT, records: [record(), record()] }),
    /unique/,
  );
  assert.throws(
    () =>
      readPlaytestLedger({ format: PLAYTEST_LEDGER_FORMAT, records: Array(1025).fill(record()) }),
    /budget/,
  );
});

test('physics and immutable artwork pins invalidate old evidence without loading or verifying asset bytes', () => {
  const revised = structuredClone(source);
  revised.missions[0].coverage = 0.65;
  assert.notEqual(
    missionEvidenceTarget(revised, id, options).simulationIdentity,
    target.simulationIdentity,
  );
  const illustrated = structuredClone(source);
  illustrated.assets = [
    {
      format: 'AssetRevisionV1',
      id: 'synthetic-art',
      revision: '1',
      kind: 'reveal-background',
      path: 'content-design/assets/synthetic-unloaded.png',
      sha256: 'f'.repeat(64),
      bytes: 100,
      width: 10,
      height: 10,
      alt: 'Synthetic metadata only, not real artwork.',
      review: 'candidate',
    },
  ];
  illustrated.missions[0].presentation.backgroundAssetId = 'synthetic-art';
  const first = missionEvidenceTarget(illustrated, id, options);
  illustrated.assets[0].sha256 = 'e'.repeat(64);
  const second = missionEvidenceTarget(illustrated, id, options);
  assert.equal(first.simulationIdentity, second.simulationIdentity);
  assert.notEqual(first.experienceIdentity, second.experienceIdentity);
  const ledger = appendPlaytestEvidence(undefined, record({ target: first }));
  assert.deepEqual(
    inspectMissionAcceptance(illustrated, id, { ...options, ledger }).staleEvidenceIds,
    ['synthetic-contract-test'],
  );
});

test('Team coordination applies only to Team; a different evidence kind cannot supersede a record', () => {
  const team = createTeamOpeningCandidates();
  const result = inspectMissionAcceptance(team, team.missions[0].id, { ...options, mode: 'team' });
  assert.equal(status(result, 'team-coordination'), 'missing');
  assert.equal(
    result.checks.some((check) => check.id === 'versus-parity'),
    false,
  );
  const native = record({
    kind: 'native',
    checks: [{ id: 'keyboard', outcome: 'fail', detail: 'Synthetic native failure.' }],
  });
  const ledger = appendPlaytestEvidence(undefined, native);
  assert.throws(
    () =>
      appendPlaytestEvidence(ledger, {
        ...native,
        id: 'human-correction',
        kind: 'human',
        supersedes: native.id,
      }),
    /exact target and kind/,
  );
});

test('evidence and inspection options never invoke getters or toJSON', () => {
  let calls = 0;
  const getter = {
    get ledger() {
      calls++;
      return readPlaytestLedger();
    },
  };
  assert.throws(() => inspectMissionAcceptance(source, id, getter), /accessors/);
  assert.throws(
    () =>
      readPlaytestEvidence({
        ...record(),
        get method() {
          calls++;
          return 'No';
        },
      }),
    /accessors/,
  );
  assert.throws(
    () =>
      readPlaytestEvidence({
        ...record(),
        toJSON() {
          calls++;
          return {};
        },
      }),
    /plain JSON/,
  );
  assert.equal(calls, 0);
});
