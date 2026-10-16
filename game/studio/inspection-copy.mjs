import { formatNumber, t } from '../i18n/index.mjs';
import { studioContentText } from './preview-copy.mjs';
import { studioDifficultyName } from './difficulty-view.mjs';
import { editorErrorText } from './editor-copy.mjs';

export function studioInspectionError(error) {
  return t('tools:studio.inspection.failed', { message: editorErrorText(error) });
}
export function studioPacingSummary(report) {
  return t('tools:studio.pacing.summary', {
    missions: report.rows.length,
    timed: report.timedMissionOccurrences,
    percent: formatNumber(report.timedFraction * 100, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }),
    findings: report.diagnostics.length,
  });
}
const lessonWarningKeys = {
  'practice-before-selected-introduction': 'tools:studio.pacing.practiceBeforeIntroduction',
  'combination-before-selected-introduction': 'tools:studio.pacing.combinationBeforeIntroduction',
  'combination-before-selected-practice': 'tools:studio.pacing.combinationBeforePractice',
};
/** Preserve occurrence order, including repeated memberships. Associate each
 * warning with its actual row, not the first matching mission ID. */
export function studioPacingWarnings(report) {
  const rows = report.rows.flatMap((row) => row.diagnostics.map((item) => ({ item, row })));
  return [...rows, ...report.diagnostics.slice(rows.length).map((item) => ({ item, row: null }))];
}
export function studioPacingWarning({ item, row }, report) {
  let message;
  if (lessonWarningKeys[item.code])
    message = t(lessonWarningKeys[item.code], { lessons: item.lessons.join(', ') });
  else if (['challenge-band-regression', 'challenge-band-jump'].includes(item.code))
    message = t(
      item.code === 'challenge-band-regression'
        ? 'tools:studio.pacing.bandRegression'
        : 'tools:studio.pacing.bandJump',
      { previous: row.rating.band - row.change.band, current: row.rating.band },
    );
  else if (item.code === 'large-authored-facet-increase')
    message = t('tools:studio.pacing.facetJump', { facets: item.facets.join(', ') });
  else if (item.code === 'countdown-heavy-selection')
    message = t('tools:studio.pacing.countdownHeavy', {
      timed: report.timedMissionOccurrences,
      missions: report.rows.length,
    });
  else message = item.message;
  return row
    ? t('tools:studio.pacing.locatedWarning', {
        pack: row.packId,
        campaign: row.campaignId,
        mission: row.missionId,
        message,
      })
    : message;
}
export function studioPacingRow(project, row) {
  const mission = project.missions.find((m) => m.id === row.missionId);
  return t('tools:studio.pacing.row', {
    name: studioContentText(project, mission, 'name'),
    pack: row.packId,
    campaign: row.campaignId,
    band: row.rating.band,
    planning: row.rating.planning,
    execution: row.rating.execution,
    threat: row.rating.threatDensity,
    time: row.rating.timePressure,
    mechanics: row.rating.mechanicLoad,
    coordination: row.rating.coordination,
    duration: row.authoredDurationSeconds.map((value) => formatNumber(value)).join('–'),
    countdown: row.countdownSeconds
      ? t('tools:studio.pacing.countdown', { seconds: row.countdownSeconds })
      : t('tools:studio.pacing.noCountdown'),
    // These are exact lesson identifiers used by the pacing model, not prose.
    lessons: row.introduces.join(', ') || t('tools:studio.pacing.noNewRule'),
  });
}
const modeKeys = { solo: 'interface:solo2', versus: 'interface:versus2', team: 'interface:team' };
export function studioModeName(mode) {
  return modeKeys[mode] ? t(modeKeys[mode]) : mode;
}
export function studioAcceptanceSelection(project, mission, difficulty) {
  return mission
    ? t('tools:studio.acceptance.selection', {
        name: studioContentText(project, mission, 'name'),
        id: mission.id,
        difficulty: studioDifficultyName(difficulty),
      })
    : t('tools:studio.acceptance.empty');
}
export function studioAcceptanceSummary(report) {
  return t('tools:studio.acceptance.summary', {
    current: report.currentEvidenceIds.length,
    stale: report.staleEvidenceIds.length,
    superseded: report.supersededEvidenceIds.length,
    missing: report.checks.filter((check) => check.status === 'missing').length,
    failed: report.checks.filter((check) => check.status === 'reported-fail').length,
  });
}
const checkKeys = {
  'capture-contract': 'tools:studio.acceptance.checks.captureContract',
  'route-feasibility': 'tools:studio.acceptance.checks.routeFeasibility',
  'native-play': 'tools:studio.acceptance.checks.nativePlay',
  keyboard: 'tools:studio.acceptance.checks.keyboard',
  touch: 'tools:studio.acceptance.checks.touch',
  controller: 'tools:studio.acceptance.checks.controller',
  'muted-audio': 'tools:studio.acceptance.checks.mutedAudio',
  'reduced-effects': 'tools:studio.acceptance.checks.reducedEffects',
  contrast: 'tools:studio.acceptance.checks.contrast',
  'small-screen': 'tools:studio.acceptance.checks.smallScreen',
  artwork: 'tools:studio.acceptance.checks.artwork',
  'capture-understanding': 'tools:studio.acceptance.checks.captureUnderstanding',
  'failure-understanding': 'tools:studio.acceptance.checks.failureUnderstanding',
  'mission-distinction': 'tools:studio.acceptance.checks.missionDistinction',
  'voluntary-retry': 'tools:studio.acceptance.checks.voluntaryRetry',
  pacing: 'tools:studio.acceptance.checks.pacing',
  'team-coordination': 'tools:studio.acceptance.checks.teamCoordination',
  'versus-parity': 'tools:studio.acceptance.checks.versusParity',
};
const kindKeys = {
  automated: 'tools:studio.acceptance.automated',
  native: 'tools:studio.acceptance.native',
  human: 'tools:studio.acceptance.human',
};
const statusKeys = {
  missing: 'tools:studio.acceptance.missing',
  'not-run': 'tools:studio.acceptance.notRun',
  'reported-pass': 'tools:studio.acceptance.reportedPass',
  'reported-fail': 'tools:studio.acceptance.reportedFail',
};
const kindName = (kind) => (kindKeys[kind] ? t(kindKeys[kind]) : kind);
export function studioAcceptanceCheck(check) {
  return t('tools:studio.acceptance.check', {
    label: checkKeys[check.id] ? t(checkKeys[check.id]) : check.label,
    status: statusKeys[check.status] ? t(statusKeys[check.status]) : check.status,
    kinds: check.permittedKinds.map(kindName).join(', '),
    observations: check.observations
      .map((item) =>
        t('tools:studio.acceptance.observation', {
          id: item.evidenceId,
          kind: kindName(item.kind),
          detail: item.detail,
        }),
      )
      .join(''),
  });
}
