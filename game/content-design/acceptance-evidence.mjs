import {
  boundedJSON,
  canonicalJSON,
  dataIdentity,
  exactKeys,
  required,
  stableId,
} from '../data-json.mjs';
import { compileContentProject, resolveMission } from './project.mjs';
import { freezeDesign } from './catalogs.mjs';

export const PLAYTEST_EVIDENCE_FORMAT = 'PlaytestEvidenceV1';
export const PLAYTEST_LEDGER_FORMAT = 'PlaytestLedgerV1';
const modes = ['solo', 'versus', 'team'];
const kinds = ['automated', 'native', 'human'];
const checks = [
  ['capture-contract', 'Capture and collision rules', ['automated'], modes],
  ['route-feasibility', 'Legal ordinary and optional-goal routes', ['automated'], modes],
  ['native-play', 'Actual browser play and recovery', ['native', 'human'], modes],
  ['keyboard', 'Keyboard operation', ['native', 'human'], modes],
  ['touch', 'Physical touch operation', ['human'], modes],
  ['controller', 'Physical controller operation and recovery', ['human'], modes],
  ['muted-audio', 'Threats understandable with audio muted', ['native', 'human'], modes],
  ['reduced-effects', 'Readable reduced-effects presentation', ['native', 'human'], modes],
  ['contrast', 'Functional contrast and role readability', ['native', 'human'], modes],
  ['small-screen', 'Usable small-screen layout', ['native', 'human'], modes],
  ['artwork', 'Original artwork bytes and reveal inspected', ['native', 'human'], modes],
  ['capture-understanding', 'Players predict and explain capture outcomes', ['human'], modes],
  ['failure-understanding', 'Players explain why they failed', ['human'], modes],
  ['mission-distinction', 'Players distinguish this spatial problem', ['human'], modes],
  ['voluntary-retry', 'Voluntary retry observed, not automatic restart', ['human'], modes],
  ['pacing', 'Observed challenge, duration and cleanup quality', ['human'], modes],
  ['team-coordination', 'Both partners have useful contributions', ['human'], ['team']],
  ['versus-parity', 'Equal race conditions', ['automated'], ['versus']],
];
export const MISSION_ACCEPTANCE_CHECKS = freezeDesign(
  checks.map(([id, label, kinds, modes]) => ({ id, label, kinds, modes })),
);
const checkById = new Map(MISSION_ACCEPTANCE_CHECKS.map((check) => [check.id, check]));
const identity = (value) => typeof value === 'string' && /^[a-f0-9]{16}$/.test(value);
const commit = (value) => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const text = (value, max = 2000) =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max;

function validateTarget(target) {
  exactKeys(
    target,
    [
      'projectId',
      'missionId',
      'mode',
      'difficulty',
      'simulationIdentity',
      'experienceIdentity',
      'sourceCommit',
    ],
    'evidence target',
  );
  required(
    stableId(target.projectId) && stableId(target.missionId),
    'Evidence requires stable project and mission IDs.',
  );
  required(
    modes.includes(target.mode) && ['gentle', 'standard', 'expert'].includes(target.difficulty),
    'Evidence requires an explicit mode and preset.',
  );
  required(
    identity(target.simulationIdentity) && identity(target.experienceIdentity),
    'Evidence identities must pin the resolved mission.',
  );
  required(commit(target.sourceCommit), 'Evidence requires an exact 40-character source commit.');
  return target;
}

/** Same compiler as Studio, gameplay and CLI. This is a local partition identity,
 * not a signature, a verified build, asset-byte verification or release approval. */
export function missionEvidenceTarget(source, missionId, options = {}) {
  const selected = boundedJSON(options, { maxBytes: 4096, maxNodes: 30, maxDepth: 2 });
  exactKeys(selected, ['mode', 'difficulty', 'sourceCommit'], 'evidence selection');
  required(commit(selected.sourceCommit), 'Choose an exact source commit for evidence inspection.');
  const project = compileContentProject(source),
    manifest = resolveMission(project, missionId, {
      mode: selected.mode ?? 'solo',
      difficulty: selected.difficulty ?? 'standard',
    });
  return freezeDesign(
    validateTarget({
      projectId: project.source.id,
      missionId: manifest.missionId,
      mode: manifest.mode,
      difficulty: manifest.difficulty,
      simulationIdentity: manifest.simulationIdentity,
      experienceIdentity: dataIdentity({
        format: manifest.format,
        level: manifest.level,
        design: manifest.design,
        presentation: manifest.presentation,
        background: manifest.background,
      }),
      sourceCommit: selected.sourceCommit,
    }),
  );
}

function validateRecord(record) {
  exactKeys(
    record,
    ['format', 'id', 'target', 'kind', 'observedAt', 'method', 'checks', 'artifacts', 'supersedes'],
    'playtest evidence',
  );
  required(
    record.format === PLAYTEST_EVIDENCE_FORMAT && stableId(record.id),
    'Unsupported evidence format or ID.',
  );
  validateTarget(record.target);
  required(
    kinds.includes(record.kind),
    'Evidence must distinguish automated, native and human observations.',
  );
  required(
    typeof record.observedAt === 'string' &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(record.observedAt) &&
      Number.isFinite(Date.parse(record.observedAt)) &&
      new Date(record.observedAt).toISOString() === record.observedAt,
    'Evidence requires a valid UTC observation timestamp.',
  );
  required(
    text(record.method),
    'Describe the observation method; do not infer evidence from a label.',
  );
  required(
    Array.isArray(record.checks) &&
      record.checks.length > 0 &&
      record.checks.length <= MISSION_ACCEPTANCE_CHECKS.length,
    'Evidence requires a bounded list of observations.',
  );
  const seen = new Set();
  for (const result of record.checks) {
    exactKeys(result, ['id', 'outcome', 'detail'], 'evidence check');
    const check = checkById.get(result.id);
    required(
      check && !seen.has(result.id) && check.modes.includes(record.target.mode),
      'Check IDs must be unique and applicable to this mode.',
    );
    required(
      check.kinds.includes(record.kind),
      'This observation cannot be supplied by this evidence kind.',
    );
    required(
      ['pass', 'fail', 'not-run'].includes(result.outcome) && text(result.detail),
      'Each observation requires its result and concrete details.',
    );
    seen.add(result.id);
  }
  required(
    Array.isArray(record.artifacts) && record.artifacts.length <= 16,
    'Evidence requires a bounded artifact-reference list.',
  );
  const hashes = new Set();
  for (const artifact of record.artifacts) {
    exactKeys(artifact, ['sha256', 'bytes', 'mediaType', 'label'], 'evidence artifact');
    required(
      typeof artifact.sha256 === 'string' &&
        /^[a-f0-9]{64}$/.test(artifact.sha256) &&
        !hashes.has(artifact.sha256),
      'Artifact references need unique SHA-256 values.',
    );
    required(
      Number.isSafeInteger(artifact.bytes) &&
        artifact.bytes > 0 &&
        artifact.bytes <= 128 * 1024 * 1024,
      'Artifact byte size is outside the evidence-reference budget.',
    );
    required(
      text(artifact.label, 160) &&
        typeof artifact.mediaType === 'string' &&
        /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(artifact.mediaType),
      'Artifact references need a label and media type.',
    );
    hashes.add(artifact.sha256);
  }
  required(
    record.supersedes === null || stableId(record.supersedes),
    'Superseded evidence must be explicitly identified.',
  );
  return record;
}

/** Imported data is untrusted, not proof that a person tested a build. No getters,
 * executable instructions, remote reads, personal identity or automatic approval. */
export function readPlaytestEvidence(source) {
  return freezeDesign(
    validateRecord(
      boundedJSON(source, {
        maxBytes: 65536,
        maxNodes: 1000,
        maxDepth: 6,
        maxArray: 64,
        maxString: 2000,
      }),
    ),
  );
}

export function readPlaytestLedger(source = { format: PLAYTEST_LEDGER_FORMAT, records: [] }) {
  const ledger = boundedJSON(source, {
    maxBytes: 8 * 1024 * 1024,
    maxNodes: 100000,
    maxDepth: 9,
    maxArray: 1024,
    maxString: 2000,
  });
  exactKeys(ledger, ['format', 'records'], 'playtest ledger');
  required(
    ledger.format === PLAYTEST_LEDGER_FORMAT &&
      Array.isArray(ledger.records) &&
      ledger.records.length <= 1024,
    'Unsupported or oversized playtest ledger.',
  );
  const seen = new Map();
  for (const record of ledger.records) {
    validateRecord(record);
    required(!seen.has(record.id), 'Evidence IDs are immutable and unique.');
    if (record.supersedes) {
      const previous = seen.get(record.supersedes);
      required(
        previous &&
          previous.kind === record.kind &&
          canonicalJSON(previous.target) === canonicalJSON(record.target),
        'Supersession requires earlier evidence for this exact target and kind.',
      );
    }
    seen.set(record.id, record);
  }
  return freezeDesign(ledger);
}

/** Copy-on-write append. Reimport is idempotent; changed bytes under an existing
 * ID fail atomically. A later pass cannot silently erase an earlier failure. */
export function appendPlaytestEvidence(source, evidence) {
  const ledger = readPlaytestLedger(source),
    record = readPlaytestEvidence(evidence),
    previous = ledger.records.find((item) => item.id === record.id);
  if (previous) {
    required(
      canonicalJSON(previous) === canonicalJSON(record),
      'An immutable evidence ID cannot be overwritten.',
    );
    return ledger;
  }
  return readPlaytestLedger({
    format: PLAYTEST_LEDGER_FORMAT,
    records: [...ledger.records, record],
  });
}

export function inspectMissionAcceptance(source, missionId, options = {}) {
  const selected = boundedJSON(options, {
    maxBytes: 8 * 1024 * 1024 + 4096,
    maxNodes: 110000,
    maxDepth: 12,
    maxArray: 1024,
    maxString: 2000,
  });
  exactKeys(selected, ['ledger', 'mode', 'difficulty', 'sourceCommit'], 'acceptance inspection');
  const { ledger: evidence, ...selection } = selected;
  const target = missionEvidenceTarget(source, missionId, selection),
    ledger = readPlaytestLedger(evidence),
    exact = (record) => canonicalJSON(record.target) === canonicalJSON(target),
    matching = ledger.records.filter(exact),
    superseded = new Set(matching.map((record) => record.supersedes).filter(Boolean)),
    active = matching.filter((record) => !superseded.has(record.id));
  const results = MISSION_ACCEPTANCE_CHECKS.filter((check) =>
    check.modes.includes(target.mode),
  ).map((check) => {
    const observations = active.flatMap((record) =>
      record.checks
        .filter((item) => item.id === check.id)
        .map((item) => ({ evidenceId: record.id, kind: record.kind, ...item })),
    );
    return {
      id: check.id,
      label: check.label,
      permittedKinds: check.kinds,
      observations,
      status: observations.some((item) => item.outcome === 'fail')
        ? 'reported-fail'
        : observations.some((item) => item.outcome === 'pass')
          ? 'reported-pass'
          : observations.length
            ? 'not-run'
            : 'missing',
    };
  });
  return freezeDesign({
    format: 'MissionAcceptanceInspectionV1',
    target,
    checks: results,
    currentEvidenceIds: active.map((record) => record.id),
    supersededEvidenceIds: matching
      .filter((record) => superseded.has(record.id))
      .map((record) => record.id),
    staleEvidenceIds: ledger.records
      .filter(
        (record) =>
          record.target.projectId === target.projectId &&
          record.target.missionId === target.missionId &&
          record.target.mode === target.mode &&
          !exact(record),
      )
      .map((record) => record.id),
    qualification: 'local-evidence-claims-require-review-not-release-approval',
    releaseEligible: false,
    limitations: [
      'Records are declared observations, not authenticated human testing or verified artifact bytes.',
      'Automated checks, native browser checks and genuine human observations are distinct.',
      'Source, preset, simulation, design or artwork changes require exact-edition evidence; old records remain visible.',
      'This mission report does not qualify whole-Journey flow, performance, storage rollback, release composition or deployment.',
      'No report publishes content, awards progress, infers enjoyment or grants release approval.',
    ],
  });
}
