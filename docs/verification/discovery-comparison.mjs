import { DISCOVERY_OBSERVATION_FORMAT } from './discovery-observer.mjs';

const hash = (value) => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
export function validateDiscoveryObservation(input) {
  const text = typeof input === 'string' ? input : JSON.stringify(input);
  if (typeof text !== 'string' || text.length > 2 * 1024 * 1024)
    throw new TypeError('Observation must be bounded JSON under 2 MiB.');
  const value = JSON.parse(text);
  if (
    value?.format !== DISCOVERY_OBSERVATION_FORMAT ||
    value.qualified !== false ||
    !value.binding ||
    !value.environment ||
    !Array.isArray(value.records) ||
    value.records.length > 500
  )
    throw new TypeError('Expected an unqualified bounded discovery observation.');
  if (
    !['worktree', 'compiled-artifact'].includes(value.binding.sourceKind) ||
    !hash(value.binding.sourceIdentity)
  )
    throw new TypeError('Bind the exact observed source SHA-256.');
  for (const field of [
    'label',
    'deviceLabel',
    'editionId',
    'gameplayId',
    'inputProtocol',
    'settingsIdentity',
  ])
    if (
      typeof value.binding[field] !== 'string' ||
      !value.binding[field].trim() ||
      value.binding[field].length > 256
    )
      throw new TypeError(`Missing observation ${field}.`);
  for (const field of ['userAgent', 'platform'])
    if (
      typeof value.environment[field] !== 'string' ||
      !value.environment[field].trim() ||
      value.environment[field].length > 2048
    )
      throw new TypeError(`Missing browser environment ${field}.`);
  for (const field of ['width', 'height', 'dpr'])
    if (!Number.isFinite(value.environment[field]) || value.environment[field] <= 0)
      throw new TypeError(`Missing browser environment ${field}.`);
  for (const key of ['result', 'rewardViewer', 'collection'])
    if (
      !Number.isInteger(value.cycles?.[key]) ||
      value.cycles[key] < 0 ||
      value.cycles[key] > 500 ||
      value.records.filter((record) => record.kind === 'cycle' && record.surface === key).length !==
        value.cycles[key]
    )
      throw new TypeError('Cycle totals must match the retained observed transitions.');
  for (const record of value.records) {
    if (record.qualified !== false)
      throw new TypeError('Observation records cannot qualify themselves.');
    if (record.kind === 'sample' && record.outcome === 'observed') {
      const stats = record.frameIntervals;
      if (
        !stats ||
        !Number.isInteger(stats.frames) ||
        stats.frames < 1 ||
        !['p50Ms', 'p95Ms', 'maxMs'].every(
          (key) => Number.isFinite(stats[key]) && stats[key] > 0,
        ) ||
        stats.p50Ms > stats.p95Ms ||
        stats.p95Ms > stats.maxMs ||
        !Number.isInteger(record.durationMs) ||
        record.durationMs < 1000 ||
        record.durationMs > 30000 ||
        !Number.isFinite(record.activeElapsedMs) ||
        record.activeElapsedMs < record.durationMs
      )
        throw new TypeError('A completed sample requires ordered actual frame measurements.');
      if (
        !['active-play', 'result-reveal', 'reward-viewer', 'collection'].includes(
          record.scenario,
        ) ||
        !['trusted', 'synthetic'].every(
          (key) => Number.isInteger(record.inputEvents?.[key]) && record.inputEvents[key] >= 0,
        )
      )
        throw new TypeError(
          'A completed sample requires a known scenario and explicit input counts.',
        );
    }
  }
  return value;
}

/** A comparison is an engineering observation, never release admission. It
 * refuses a regression claim when source, device or scenario is ambiguous. */
export function compareDiscoveryObservations(
  baselineInput,
  candidateInput,
  { kind = 'baseline-current' } = {},
) {
  if (!['baseline-current', 'same-build-effects'].includes(kind))
    throw new TypeError('Unsupported comparison kind.');
  const baseline = validateDiscoveryObservation(baselineInput),
    candidate = validateDiscoveryObservation(candidateInput);
  const reasons = [],
    same = (left, right, label) => {
      if (JSON.stringify(left) !== JSON.stringify(right)) reasons.push(label);
    };
  for (const key of ['deviceLabel', 'editionId', 'gameplayId', 'inputProtocol', 'settingsIdentity'])
    same(baseline.binding[key], candidate.binding[key], `Different ${key}.`);
  for (const key of [
    'userAgent',
    'platform',
    'hardwareConcurrency',
    'width',
    'height',
    'dpr',
    'headlessReported',
  ])
    same(baseline.environment[key], candidate.environment[key], `Different browser ${key}.`);
  if (kind === 'baseline-current') {
    if ([baseline, candidate].some((value) => value.binding.sourceKind !== 'compiled-artifact'))
      reasons.push('Baseline/current comparison requires exact compiled artifact identities.');
    if (baseline.binding.sourceIdentity === candidate.binding.sourceIdentity)
      reasons.push('Identical artifacts do not establish a before/after regression comparison.');
  } else
    same(
      baseline.binding.sourceIdentity,
      candidate.binding.sourceIdentity,
      'Effects comparison requires identical source bytes.',
    );
  const cases = (report) =>
    report.records.filter((record) => record.kind === 'sample' && record.outcome === 'observed');
  const before = cases(baseline),
    after = cases(candidate);
  if (!before.length || before.length !== after.length)
    reasons.push('Different or absent completed sample counts.');
  const comparisons = [];
  for (let index = 0; index < Math.min(before.length, after.length); index++) {
    const left = before[index],
      right = after[index];
    for (const key of ['scenario', 'mission', 'durationMs', 'surfaceVisibleWhenArmed'])
      same(left[key], right[key], `Sample ${index + 1} differs in ${key}.`);
    if ([left, right].some((sample) => typeof sample.surfaceVisibleWhenArmed !== 'boolean'))
      reasons.push(
        `Sample ${index + 1} does not distinguish a transition from an already visible surface.`,
      );
    if (
      [left, right].some(
        (sample) =>
          typeof sample.mission !== 'string' ||
          !sample.mission.trim() ||
          sample.mission.length > 256,
      )
    )
      reasons.push(`Sample ${index + 1} has no bounded observed mission.`);
    if ([left, right].some((sample) => !['full', 'reduced'].includes(sample.effects)))
      reasons.push(`Sample ${index + 1} has no explicit observed full/reduced effects.`);
    if (left.durationMs < 20000 || right.durationMs < 20000)
      reasons.push(`Sample ${index + 1} is shorter than 20 seconds.`);
    if (kind === 'baseline-current')
      same(left.effects, right.effects, `Sample ${index + 1} uses different effects.`);
    else if (
      left.effects === right.effects ||
      !['full', 'reduced'].includes(left.effects) ||
      !['full', 'reduced'].includes(right.effects)
    )
      reasons.push(`Sample ${index + 1} needs explicit full/reduced effects.`);
    if (left.inputEvents?.synthetic || right.inputEvents?.synthetic)
      reasons.push(
        `Sample ${index + 1} includes synthetic DOM input; use a separately declared input benchmark.`,
      );
    const percent = (right.frameIntervals.p95Ms / left.frameIntervals.p95Ms - 1) * 100;
    comparisons.push({
      scenario: right.scenario,
      baselineP95Ms: left.frameIntervals.p95Ms,
      candidateP95Ms: right.frameIntervals.p95Ms,
      changePercent: percent,
      withinFivePercentEngineeringTarget: percent <= 5,
    });
  }
  return {
    format: 'revealline-discovery-comparison.v1',
    kind,
    qualified: false,
    comparable: reasons.length === 0,
    reasons,
    comparisons: reasons.length ? [] : comparisons,
    rewardRenderingTaskLimit: {
      verified: false,
      reason: 'Page-wide long tasks cannot isolate reward rendering.',
    },
    lifecycle: {
      baseline: baseline.cycles,
      candidate: candidate.cycles,
      twentyResultCyclesObserved: baseline.cycles.result >= 20 && candidate.cycles.result >= 20,
      retainedResourceStabilityVerified: false,
      reason:
        'Connected DOM/media counts and approximate heap exclude detached owners and decoders.',
    },
  };
}

export function summarizeDiscoverySession(inputs) {
  if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > 100)
    throw new TypeError('Use 1–100 observations.');
  const reports = inputs.map(validateDiscoveryObservation),
    editions = reports.map((r) => r.binding.editionId);
  const cycles = Object.fromEntries(
    ['result', 'rewardViewer', 'collection'].map((kind) => [
      kind,
      reports.reduce((sum, report) => sum + report.cycles[kind], 0),
    ]),
  );
  return {
    format: 'revealline-discovery-session.v1',
    qualified: false,
    documentsObserved: reports.length,
    editionTransitions: editions.slice(1).filter((id, index) => id !== editions[index]).length,
    cycles,
    twentyResultCyclesObserved: cycles.result >= 20,
    twentyEditionTransitionsObserved:
      editions.slice(1).filter((id, index) => id !== editions[index]).length >= 20,
    retainedResourceStabilityVerified: false,
    note: 'Edition transitions are separately observed documents, not proof of same-document cleanup or installation isolation.',
  };
}

/** Connected, closed-view counts are useful repeatability diagnostics, not an
 * assertion about detached owners, JS heap retention or native decoder leaks. */
export function summarizeDiscoveryLifecycle(input) {
  const report = validateDiscoveryObservation(input),
    closed = report.records.filter(
      (record) =>
        record.kind === 'checkpoint' &&
        /^closed result [1-9]\d*$/.test(record.label ?? '') &&
        record.state?.rewardViewer === false,
    ),
    metrics = {};
  for (const key of [
    'connectedNodes',
    'connectedImages',
    'connectedAudio',
    'connectedVideo',
    'connectedBlobMedia',
    'uniqueConnectedBlobURLs',
    'rewardDialogs',
    'rewardShelves',
    'rewardResults',
  ]) {
    const values = closed.map((record) => record.resources?.[key]);
    metrics[key] =
      values.length && values.every((value) => Number.isInteger(value) && value >= 0)
        ? {
            first: values[0],
            last: values.at(-1),
            min: Math.min(...values),
            max: Math.max(...values),
            delta: values.at(-1) - values[0],
          }
        : null;
  }
  let pendingViewer = false,
    pairs = 0;
  for (const record of report.records) {
    if (record.kind !== 'cycle') continue;
    if (record.surface === 'rewardViewer') pendingViewer = true;
    else if (record.surface === 'result') {
      if (pendingViewer) pairs++;
      pendingViewer = false;
    }
  }
  return {
    qualified: false,
    resultViewerPairsObserved: pairs,
    twentyResultViewerPairsObserved: pairs >= 20,
    closedCheckpoints: closed.length,
    connectedMetrics: metrics,
    retainedResourceStabilityVerified: false,
    rewardRenderingTaskLimitVerified: false,
    note: 'Only observed viewer/result exits and connected closed-view counts. Detached owners, outstanding URLs, decoders and isolated reward tasks remain unmeasured.',
  };
}
