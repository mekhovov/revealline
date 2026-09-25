import { editorMessageError, editorErrorText } from './editor-copy.mjs';
import { platformExportText } from '../ui/export-copy.mjs';
import { localizedMessage, localizedText, onLocaleChange, t } from '../i18n/index.mjs';
import { contentText } from '../i18n/content.mjs';
import { createStarterProject } from '../content-design/starter.mjs';
import { createOpeningCandidates } from '../content-design/horizon-candidates.mjs';
import { createBorderCandidates } from '../content-design/border-candidates.mjs';
import { createTimedBorderCandidates } from '../content-design/timed-border-candidates.mjs';
import { TIMED_BONUS_TRAIL_VERSION } from '../core/timed-bonuses.mjs';
import { createCulturalWorkshopCandidates } from '../content-design/cultural-workshop-candidates.mjs';
import { createPursuitInterceptCandidates } from '../content-design/pursuit-intercept-candidates.mjs';
import { createCombatCandidates } from '../content-design/combat-candidates.mjs';
import { createSpatialBalanceCandidates } from '../content-design/spatial-balance-candidates.mjs';
import { createSignalCandidates } from '../content-design/signal-candidates.mjs';
import { createNeonCandidates } from '../content-design/neon-candidates.mjs';
import { createRoverTeachingCandidates } from '../content-design/rover-teaching-candidates.mjs';
import { createRoverSpatialCandidates } from '../content-design/rover-spatial-candidates.mjs';
import { createFractureCandidates } from '../content-design/fracture-candidates.mjs';
import { createFractureSpatialCandidates } from '../content-design/fracture-spatial-candidates.mjs';
import { createPhaseCandidates } from '../content-design/phase-candidates.mjs';
import { createPhaseSpatialCandidates } from '../content-design/phase-spatial-candidates.mjs';
import { createLivewireCandidates } from '../content-design/livewire-candidates.mjs';
import { createRelayCandidates } from '../content-design/relay-candidates.mjs';
import { createCrosswindCandidates } from '../content-design/crosswind-candidates.mjs';
import { createSentinelCandidates } from '../content-design/sentinel-candidates.mjs';
import { createSentinelSpatialCandidates } from '../content-design/sentinel-spatial-candidates.mjs';
import { createSentinelInnerCandidates } from '../content-design/sentinel-inner-candidates.mjs';
import {
  withPressureDifficulty,
  inspectEffectiveGameplay,
} from '../content-design/pressure-candidates.mjs';
import { createGameplayTuningController } from '../gameplay-tuning.mjs';
import { createApexCandidates } from '../content-design/apex-candidates.mjs';
import { createApexSpatialCandidates } from '../content-design/apex-spatial-candidates.mjs';
import { createApexFieldCandidates } from '../content-design/apex-field-candidates.mjs';
import { createWholeJourneyCandidates } from '../content-design/whole-journey-candidates.mjs';
import {
  createWholeSpatialCandidates,
  createWholeFieldCandidates,
  createWholeTimedCandidates,
  createWholeVarietyCandidates,
  createWholeSortingCandidates,
  createWholeImpactCandidates,
  createWholePressureCandidates,
  createWholeCulturalPressureCandidates,
  createWholeErosionReviewCandidates,
} from '../content-design/whole-spatial-candidates.mjs';
import { createSpatialNextBatchCandidates } from '../content-design/spatial-next-batch-candidates.mjs';
import { createHorizonNextBatchCandidates } from '../content-design/horizon-next-batch-candidates.mjs';
import { createUkrainianOrnamentJourney } from '../content-design/ukrainian-ornament-candidates.mjs';
import { createUkrainianOrnamentAtlasJourney } from '../content-design/ukrainian-ornament-atlas.mjs';
import { withCampaignPresentation } from '../content-design/campaign-presentation.mjs';
import { createTeamSignalCandidates } from '../content-design/team-signal-candidates.mjs';
import { createTeamJourneyCandidates } from '../content-design/team-journey-candidates.mjs';
import { createTeamPressureOriginalCandidates } from '../content-design/team-pressure-originals.mjs';
import { createTeamSpatialOriginalCandidates } from '../content-design/team-spatial-originals.mjs';
import { createTeamTimedCandidates } from '../content-design/team-timed-candidates.mjs';
import { createTeamTimedOriginalCandidates } from '../content-design/team-timed-originals.mjs';
import { createTeamWindowSpatialCandidates } from '../content-design/team-window-spatial-candidates.mjs';
import { createTeamDepotSpatialCandidates } from '../content-design/team-depot-spatial-candidates.mjs';
import { compileContentProject } from '../content-design/project.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { paintContentMap } from '../content-design/map-view.mjs';
import {
  bindStudioPreviewCopy,
  studioGameplayText,
  studioPreviewLoadingText,
  studioPreviewFailureText,
} from './preview-copy.mjs';
import {
  studioItemCaption,
  studioStructureSummary,
  studioStructureOutline,
  studioRemovalText,
  studioStructureResult,
  studioDiagnosticText,
} from './structure-copy.mjs';
import { loadPreviewTheme } from '../content-design/preview-loader.mjs';
import { loadPreviewArtwork } from '../content-design/assets.mjs';
import { createContentDraftBackend, forkMissionMap } from '../content-design/drafts.mjs';
import { createContentDraftSession } from '../content-design/session.mjs';
import { editContentStructure, inspectContentRemoval } from '../content-design/structure.mjs';
import {
  inspectDraftCheckpoint,
  createInspectionRequests,
  projectIdFromURL,
} from '../content-design/recovery.mjs';
import { exportJSONFile } from '../platform.mjs';
import { setBoardAvailability } from './board-state.mjs';
import { tuneContentMission } from '../content-design/tuning.mjs';
import { createImageWorkbench } from './image-workbench.mjs';
import { createTraceRecovery } from './trace-recovery.mjs';
import { freezeDesign } from '../content-design/catalogs.mjs';
import { syncStudioDifficulty } from './difficulty-view.mjs';
import { createTeamTestPack, createTeamCampaignTestPack } from '../content-design/team-export.mjs';
import { createActorEditor } from './actor-editor.mjs';
import { createCombatEditor } from './combat-editor.mjs';
import { createGeometryEditor } from './geometry-editor.mjs';
import { createBonusEditor } from './bonus-editor.mjs';
import { createTimedBonusEditor } from './timed-bonus-editor.mjs';
import { createObjectiveEditor } from './objective-editor.mjs';
import { createRelayEditor } from './relay-editor.mjs';
import { createDirectionalEditor } from './directional-editor.mjs';
import { createEncounterEditor } from './encounter-editor.mjs';
import { createPacingInspector } from './pacing-inspector.mjs';
import { createAcceptanceInspector } from './acceptance-inspector.mjs';
import { observePreviewReadiness } from './preview-readiness.mjs';
import { createCandidateLibrary } from './candidate-library.mjs';

const $ = (id) => document.getElementById(id);
const creatorDraftId = new URLSearchParams(location.search).get('creator-draft');
if (creatorDraftId && /^[a-z][a-z0-9-]{0,59}$/.test(creatorDraftId)) {
  const back = document.createElement('a');
  back.href = `../creator/?draft=${encodeURIComponent(creatorDraftId)}`;
  localizedText(back, localizedMessage('tools:studio.returnToPictureCreator'));
  document.querySelector('header').append(back);
}
const candidateLibrary = createCandidateLibrary({ document });
const backend = createContentDraftBackend();
const pacingInspector = createPacingInspector({ document, getSource: () => session.current() });
const acceptanceInspector = createAcceptanceInspector({
  document,
  getSource: () => session.current(),
  getMission: () => currentMission(),
  getDifficulty: () => $('difficulty').value,
});
let session,
  inspected = null,
  paintedPreview = null,
  sourceChanged = false,
  saveTimer,
  stopPreviewReadiness = () => {},
  inspectedTrail = [],
  tuningRevision = null,
  previewRevision = 0,
  previewController = null;
const gameplayTuning = createGameplayTuningController();
const stopGameplayTuning = gameplayTuning.subscribe(() => {
  if (session) guarded(() => inspectBoard(inspectedTrail))();
});
const inspections = createInspectionRequests(() =>
  JSON.stringify([
    session?.export(),
    $('source').value,
    $('project-id').value,
    $('checkpoint').value,
  ]),
);
const imageWorkbench = createImageWorkbench({
  document,
  getSource: () => session.current(),
  getMission: () => currentMission(),
  getDifficulty: () => $('difficulty').value,
  redraw: () => inspectBoard(inspectedTrail),
  apply: (candidate) => {
    if (!discardSource()) return false;
    session.replace(candidate);
    render();
    queueSave();
    return true;
  },
  play: (source, missionId, difficulty) => launchPreview(source, missionId, difficulty),
  onChange: () => traceRecovery.changed(),
});
const traceRecovery = createTraceRecovery({
  document,
  workbench: imageWorkbench,
  getSource: () => session.current(),
  getMission: () => currentMission(),
});
const actorEditor = createActorEditor({
  document,
  getSource: () => session.current(),
  getMission: currentMission,
  getDifficulty: () => $('difficulty').value,
  apply: (candidate) => {
    if (!discardSource()) return false;
    session.replace(candidate);
    render();
    queueSave();
    return true;
  },
});
const combatEditor = createCombatEditor({
  document,
  getSource: () => session.current(),
  getMission: currentMission,
  apply: (candidate) => {
    if (!discardSource()) return false;
    session.replace(candidate);
    render();
    queueSave();
    return true;
  },
});
const geometryEditor = createGeometryEditor({
  document,
  getSource: () => session.current(),
  getMission: currentMission,
  apply: (candidate) => {
    if (!discardSource()) return false;
    session.replace(candidate);
    render();
    queueSave();
    return true;
  },
});
const bonusEditor = createBonusEditor({
  document,
  getSource: () => session.current(),
  getMission: currentMission,
  apply: (candidate) => {
    if (!discardSource()) return false;
    session.replace(candidate);
    render();
    queueSave();
    return true;
  },
});
const timedBonusEditor = createTimedBonusEditor({
  document,
  getSource: () => session.current(),
  getMission: currentMission,
  apply: (candidate) => {
    if (!discardSource()) return false;
    session.replace(candidate);
    render();
    queueSave();
    return true;
  },
});
const objectiveEditor = createObjectiveEditor({
  document,
  getSource: () => session.current(),
  getMission: currentMission,
  apply: (candidate) => {
    if (!discardSource()) return false;
    session.replace(candidate);
    render();
    queueSave();
    return true;
  },
});
const relayEditor = createRelayEditor({
  document,
  getSource: () => session.current(),
  getMission: currentMission,
  apply: (candidate) => {
    if (!discardSource()) return false;
    session.replace(candidate);
    render();
    queueSave();
    return true;
  },
});
const directionalEditor = createDirectionalEditor({
  document,
  getSource: () => session.current(),
  getMission: currentMission,
  apply: (candidate) => {
    if (!discardSource()) return false;
    session.replace(candidate);
    render();
    queueSave();
    return true;
  },
});
const encounterEditor = createEncounterEditor({
  document,
  getSource: () => session.current(),
  getMission: currentMission,
  apply: (candidate) => {
    if (!discardSource()) return false;
    session.replace(candidate);
    render();
    queueSave();
    return true;
  },
});
function status(text, error = false) {
  localizedText($('status'), text);
  $('status').dataset.error = String(error);
}
function guarded(action) {
  return async (event) => {
    try {
      await action(event);
    } catch (error) {
      if (error.name === 'AbortError') return;
      status(() => editorErrorText(error), true);
    }
  };
}
function showStorage(state) {
  if (state.error)
    status(
      () => t('tools:studio.storage.sessionOnly', { message: editorErrorText(state.error) }),
      true,
    );
  else if (state.saving) status(localizedMessage('tools:studio.storage.saving'));
  else
    status(
      state.dirty
        ? localizedMessage('tools:studio.storage.unsaved')
        : localizedMessage('tools:studio.storage.saved', { revision: state.revision }),
    );
  $('undo').disabled = !session?.canUndo();
  $('redo').disabled = !session?.canRedo();
}
function setSession(project, revision = null) {
  inspections.invalidate();
  const owner = createContentDraftSession(project, {
    backend,
    revision,
    onStatus: (state) => {
      if (session === owner) showStorage(state);
    },
  });
  session = owner;
  $('mission').value = '';
  $('checkpoint').value = '';
  const address = new URL(location.href);
  address.searchParams.set('project', project.id);
  history.replaceState(null, '', address);
  showStorage(session.status());
}
function queueSave() {
  clearTimeout(saveTimer);
  const owner = session;
  saveTimer = setTimeout(() => {
    owner.save().catch(() => {});
  }, 300);
}
function discardSource() {
  return !sourceChanged || window.confirm(t('tools:studio.source.discard'));
}
function currentMission() {
  return session.current().missions.find((m) => m.id === $('mission').value);
}
// Locale changes repaint the accepted snapshot only. They never inspect or
// recompile a draft, reset an editor, write a checkpoint, or launch gameplay.
const stopMapLocale = onLocaleChange(() => {
  if (paintedPreview) draw(paintedPreview);
});
function draw(preview) {
  paintedPreview = preview;
  const canvas = $('board');
  const summary = paintContentMap(canvas.getContext('2d'), preview, {
    width: canvas.width,
    showCapture: $('show-capture').checked,
    underlay: imageWorkbench.underlay(),
  });
  $('capture-legend').hidden = !$('show-capture').checked;
  $('capture-summary').textContent = summary;
  canvas.setAttribute('aria-describedby', 'geometry capture-summary');
}
function inspectBoard(trailCells = []) {
  const project = freezeDesign(session.current());
  const mission = project.missions.find((entry) => entry.id === $('mission').value);
  syncStudioDifficulty($('difficulty'), project.difficultyCatalogId, {
    team: !!mission && !mission.modes.includes('solo') && mission.modes[0] === 'team',
  });
  acceptanceInspector.sync();
  actorEditor.sync();
  combatEditor.sync();
  geometryEditor.sync();
  bonusEditor.sync();
  timedBonusEditor.sync();
  objectiveEditor.sync();
  relayEditor.sync();
  directionalEditor.sync();
  encounterEditor.sync();
  imageWorkbench.sync();
  traceRecovery.sync();
  setBoardAvailability(document, !!mission);
  if (!mission) {
    paintedPreview = null;
    $('export-team').hidden = true;
    $('team-sequence-tools').hidden = true;
    $('team-test-help').hidden = true;
    inspectedTrail = [];
    tuningRevision = null;
    return;
  }

  const compiledProject = compileContentProject(project);
  const preview = prepareContentPreview(compiledProject, mission.id, {
    mode: mission.modes.includes('solo') ? 'solo' : mission.modes[0],
    difficulty: $('difficulty').value,
    trailCells,
  });
  inspectedTrail = [...trailCells];
  $('trail').value = inspectedTrail.join(', ');
  draw(preview);
  const { manifest, capture, authoredTerrain } = preview;
  const tuningKey = JSON.stringify([mission.id, mission.revision]);
  if (tuningRevision !== tuningKey) {
    $('target-coverage').value = Number((mission.coverage * 100).toFixed(8));
    $('countdown-seconds').value = mission.timeLimitSeconds;
    for (const [facet, rating] of Object.entries(mission.design.difficulty))
      $(`rating-${facet}`).value = rating;
    tuningRevision = tuningKey;
  }
  const tuningStatus = gameplayTuning.status();
  const effectiveGameplay = inspectEffectiveGameplay(compiledProject, mission.id, {
    mode: manifest.mode,
    difficulty: manifest.difficulty,
    overrides: tuningStatus.overrides,
  });
  bindStudioPreviewCopy(document, project, mission, preview);
  localizedText($('current-gameplay'), () => studioGameplayText(effectiveGameplay, tuningStatus));
  $('effective').textContent = JSON.stringify(
    {
      policy: manifest.policyId,
      simulationIdentity: manifest.simulationIdentity,
      rules: manifest.level.rules,
      actors: manifest.level.enemies,
      effectiveGameplay,
      ...(manifest.level.classic?.combatPatrols
        ? { combatPatrols: manifest.level.classic.combatPatrols }
        : {}),
      objectives: mission.objectives,
      terrain: authoredTerrain,
      ...(manifest.level.directionalFields
        ? { directionalFields: manifest.level.directionalFields }
        : {}),
    },
    null,
    2,
  );
  $('capture').textContent = JSON.stringify(
    {
      assumption: capture.assumption,
      securedCells: capture.securedTrail.length,
      wouldFillCells: capture.filledCells.length,
      affectedObjectives: capture.affectedObjectiveIds,
      ...(capture.affectedCombatIds ? { affectedCombatActors: capture.affectedCombatIds } : {}),
      components: capture.components.map((c) => ({
        id: c.id,
        cells: c.cells.length,
        retained: c.retained,
        anchors: c.enemyIds,
      })),
    },
    null,
    2,
  );
  $('diagnostics').replaceChildren(
    ...manifest.diagnostics.map((item) => {
      const li = document.createElement('li');
      localizedText(li, () => studioDiagnosticText(item, manifest));
      return li;
    }),
  );
  $('play').disabled = !mission.modes.includes('solo') || !!mission.combat?.enabled;
  $('export-team').hidden = !mission.modes.includes('team');
  $('team-sequence-tools').hidden = !mission.modes.includes('team');
  const selectedTeamCampaign = $('team-test-campaign').value;
  const teamDraft = project;
  const activeTeamIds = new Set(
    teamDraft.missions
      .filter((item) => !item.archived && item.modes.includes('team'))
      .map((item) => item.id),
  );
  $('team-test-campaign').replaceChildren(
    ...[
      { id: '', name: '' },
      ...teamDraft.campaigns.filter(
        (campaign) => !campaign.archived && campaign.missionIds.some((id) => activeTeamIds.has(id)),
      ),
    ].map((campaign) => {
      const option = document.createElement('option');
      option.value = campaign.id;
      localizedText(option, () =>
        campaign.id
          ? studioItemCaption(project, campaign, { identity: false })
          : t('tools:studio.structure.chooseCampaign'),
      );
      return option;
    }),
  );
  if ([...$('team-test-campaign').options].some((option) => option.value === selectedTeamCampaign))
    $('team-test-campaign').value = selectedTeamCampaign;
  $('team-test-help').hidden = !mission.modes.includes('team');
}
function render(selected = $('mission').value) {
  inspections.invalidate();
  pacingInspector.sync();
  tuningRevision = null;
  const project = freezeDesign(session.current());
  $('pressure-edition').disabled = project.difficultyCatalogId === 'journey-difficulty-v2';
  $('project-id').value = project.id;
  localizedText($('project-name'), () => contentText(project, 'name'));
  const nameCounts = new Map();
  for (const mission of project.missions)
    nameCounts.set(mission.name, (nameCounts.get(mission.name) ?? 0) + 1);
  $('mission').replaceChildren(
    ...project.missions.map((m) => {
      const option = document.createElement('option');
      option.value = m.id;
      localizedText(option, () =>
        studioItemCaption(project, m, { identity: nameCounts.get(m.name) > 1 }),
      );
      return option;
    }),
  );
  if (project.missions.some((m) => m.id === selected)) $('mission').value = selected;
  localizedText($('structure'), () => studioStructureSummary(project));
  $('source').value = session.export();
  sourceChanged = false;
  inspected = null;
  candidateLibrary.clearInspection();
  $('apply').disabled = true;
  localizedText(
    $('validation'),
    localizedMessage('tools:studio.source.current', {
      maps: project.maps.length,
      missions: project.missions.length,
    }),
  );
  $('undo').disabled = !session.canUndo();
  $('redo').disabled = !session.canRedo();
  localizedText($('structure-result'), localizedMessage('tools:studio.structure.current'));
  syncStructure();
  inspectBoard();
}
function syncStructure() {
  const project = freezeDesign(session.current()),
    kind = $('item-kind').value,
    action = $('item-action').value;
  const creating = action === 'create' || action === 'duplicate';
  const fill = (id, rows, blank) => {
    const selected = $(id).value;
    $(id).replaceChildren(
      ...[...(blank ? [{ id: '', name: blank }] : []), ...rows].map((row) => {
        const option = document.createElement('option');
        option.value = row.id;
        localizedText(option, () => (row.id ? studioItemCaption(project, row) : t(blank)));
        return option;
      }),
    );
    if ([...$(id).options].some((option) => option.value === selected)) $(id).value = selected;
  };
  fill('item-target', project[`${kind}s`]);
  fill(
    'item-parent',
    kind === 'mission' ? project.campaigns : kind === 'campaign' ? project.packs : [],
    'tools:studio.structure.unassigned',
  );
  for (const [id, visible] of [
    ['item-target-row', action !== 'create'],
    ['item-id-row', creating],
    ['item-name-row', creating || action === 'rename'],
    ['item-template-row', kind === 'mission' && action === 'create'],
    ['item-band-row', kind === 'campaign' && ['create', 'set-band'].includes(action)],
    [
      'item-parent-row',
      kind !== 'pack' && !['rename', 'set-band', 'delete', 'archive', 'restore'].includes(action),
    ],
    ['item-confirm-row', action === 'delete'],
  ])
    $(id).hidden = !visible;
  $('item-id').required = creating;
  $('item-name').required = creating || action === 'rename';
  $('item-band').required = kind === 'campaign' && ['create', 'set-band'].includes(action);
  if (kind === 'campaign' && action === 'set-band')
    $('item-band').value =
      project.campaigns.find((entry) => entry.id === $('item-target').value)?.band ?? 1;
  $('item-target').required = action !== 'create';
  $('item-parent').required =
    kind !== 'pack' && ['place', 'detach', 'earlier', 'later'].includes(action);
  $('item-confirm').required = action === 'delete';
  const removal =
    action === 'delete' && $('item-target').value
      ? inspectContentRemoval(project, kind, $('item-target').value)
      : null;
  $('item-dependencies').hidden = action !== 'delete';
  localizedText($('item-dependencies'), () => studioRemovalText(project, removal));
  localizedText($('structure-order'), () => studioStructureOutline(project));
  $('item-apply').disabled =
    (action === 'set-band' && kind !== 'campaign') ||
    (['place', 'detach'].includes(action) && kind === 'pack') ||
    (action === 'delete' && !removal?.deletable);
}
for (const id of ['item-kind', 'item-action', 'item-target'])
  $(id).onchange = () => {
    $('item-confirm').value = '';
    syncStructure();
  };
$('create-first-mission').onclick = () => {
  $('structure-editor').open = true;
  $('item-kind').value = 'mission';
  $('item-action').value = 'create';
  syncStructure();
  $('item-id').focus();
};
$('structure-form').onsubmit = guarded((event) => {
  event.preventDefault();
  if (!discardSource()) return;
  const action = $('item-action').value,
    kind = $('item-kind').value;
  const creating = action === 'create' || action === 'duplicate';
  const command = {
    action: ['earlier', 'later'].includes(action) ? 'reorder' : action,
    kind,
    id: creating ? $('item-id').value.trim() : $('item-target').value,
    ...(creating || action === 'rename' ? { name: $('item-name').value.trim() } : {}),
    ...(action === 'duplicate' ? { sourceId: $('item-target').value } : {}),
    ...(kind === 'mission' && action === 'create' ? { template: $('item-template').value } : {}),
    ...(kind === 'campaign' && ['create', 'set-band'].includes(action)
      ? { band: Number($('item-band').value) }
      : {}),
    ...(kind !== 'pack' &&
    !['rename', 'set-band', 'delete', 'archive', 'restore'].includes(action) &&
    $('item-parent').value
      ? { parentId: $('item-parent').value }
      : {}),
    ...(['earlier', 'later'].includes(action) ? { offset: action === 'earlier' ? -1 : 1 } : {}),
    ...(action === 'delete' ? { confirmationId: $('item-confirm').value.trim() } : {}),
  };
  const candidate = editContentStructure(session.current(), command);
  session.replace(candidate);
  $('item-confirm').value = '';
  render(kind === 'mission' ? command.id : $('mission').value);
  $('item-target').value = command.id;
  localizedText($('structure-result'), () => studioStructureResult(action, kind, command.id));
  queueSave();
});
function inspectSource({ head, selectedRevision } = {}) {
  inspections.invalidate();
  inspected = null;
  candidateLibrary.clearInspection();
  $('apply').disabled = true;
  const text = $('source').value,
    project = compileContentProject(text).source;
  inspected = { text, project, head };
  localizedText($('validation'), () =>
    t(head ? 'tools:studio.source.checkpointInspected' : 'tools:studio.source.inspected', {
      name: contentText(project, 'name'),
      maps: project.maps.length,
      missions: project.missions.length,
      selectedRevision,
      latestRevision: head?.revision,
    }),
  );
  $('apply').disabled = false;
  candidateLibrary.reportInspection(() =>
    t('tools:studio.library.inspected', {
      name: contentText(project, 'name'),
      count: project.missions.length,
    }),
  );
}
$('source').addEventListener('input', () => {
  inspections.invalidate();
  sourceChanged = true;
  inspected = null;
  candidateLibrary.clearInspection();
  $('apply').disabled = true;
  localizedText($('validation'), localizedMessage('tools:studio.source.unapplied'));
});
$('validate').onclick = guarded(() => inspectSource());
$('apply').onclick = guarded(async () => {
  if (!inspected || inspected.text !== $('source').value)
    throw editorMessageError('errors:studio.source.inspectFirst');
  const pending = inspected;
  if (session.status().saving) throw editorMessageError('errors:studio.source.savePending');
  clearTimeout(saveTimer);
  if (pending.head) {
    setSession(pending.head.project, pending.head.revision);
    if (JSON.stringify(pending.project) !== JSON.stringify(pending.head.project))
      session.replace(pending.project);
  } else if (pending.project.id !== session.current().id) setSession(pending.project);
  else session.replace(pending.project);
  render();
  queueSave();
});
$('load').onclick = guarded(async () => {
  if (!discardSource()) return;
  const current = inspections.begin();
  let loaded;
  try {
    loaded = await inspectDraftCheckpoint(
      backend,
      $('project-id').value.trim(),
      $('checkpoint').value === '' ? null : Number($('checkpoint').value),
    );
  } catch (error) {
    if (current()) throw error;
    return;
  }
  if (!current()) return;
  $('source').value = JSON.stringify(loaded.selected.project, null, 2);
  sourceChanged = true;
  inspectSource({ head: loaded.head, selectedRevision: loaded.selected.revision });
});
$('new').onclick = guarded(() => {
  if (!discardSource()) return;
  const id = $('project-id').value.trim();
  if (id === session.current().id) throw editorMessageError('errors:studio.source.newId');
  $('source').value = JSON.stringify(createStarterProject(id), null, 2);
  sourceChanged = true;
  inspectSource();
});
$('pressure-edition').onclick = guarded(() => {
  if (!discardSource()) return;
  inspections.invalidate();
  inspected = null;
  candidateLibrary.clearInspection();
  $('apply').disabled = true;
  $('source').value = JSON.stringify(withPressureDifficulty(session.current()), null, 2);
  sourceChanged = true;
  inspectSource();
});
$('opening').onclick = guarded(() => {
  if (!discardSource()) return;
  $('source').value = JSON.stringify(createOpeningCandidates({ artwork: true }), null, 2);
  sourceChanged = true;
  inspectSource();
});
$('border').onclick = guarded(() => {
  if (!discardSource()) return;
  $('source').value = JSON.stringify(createBorderCandidates({ artwork: true }), null, 2);
  sourceChanged = true;
  inspectSource();
});
$('timed-border').onclick = guarded(() => {
  if (!discardSource()) return;
  $('source').value = JSON.stringify(
    withCampaignPresentation(
      createTimedBorderCandidates({ artwork: true, version: TIMED_BONUS_TRAIL_VERSION }),
      'border',
    ),
    null,
    2,
  );
  sourceChanged = true;
  inspectSource();
});
$('cultural-workshop').onclick = guarded(() => {
  if (!discardSource()) return;
  $('source').value = JSON.stringify(
    $('spatial-edition').value === 'spatial-2'
      ? createSpatialBalanceCandidates()
      : createCulturalWorkshopCandidates(),
    null,
    2,
  );
  sourceChanged = true;
  inspectSource();
});
$('pursuit-intercept').onclick = guarded(() => {
  if (!discardSource()) return;
  $('source').value = JSON.stringify(
    $('spatial-edition').value === 'spatial-2'
      ? createSpatialBalanceCandidates({ pressure: true })
      : createPursuitInterceptCandidates(),
    null,
    2,
  );
  sourceChanged = true;
  inspectSource();
});
$('combat-study').onclick = guarded(() => {
  if (!discardSource()) return;
  $('source').value = JSON.stringify(createCombatCandidates(), null, 2);
  sourceChanged = true;
  inspectSource();
});
$('signal').onclick = guarded(() => {
  if (!discardSource()) return;
  $('source').value = JSON.stringify(createSignalCandidates({ campaignTheme: true }), null, 2);
  sourceChanged = true;
  inspectSource();
});
$('neon').onclick = guarded(() => {
  if (!discardSource()) return;
  $('source').value = JSON.stringify(
    withCampaignPresentation(createNeonCandidates({ artwork: true }), 'neon'),
    null,
    2,
  );
  sourceChanged = true;
  inspectSource();
});
$('rover').onclick = guarded(() => {
  if (!discardSource()) return;
  const create =
    $('rover-edition').value === 'sorting-spatial-1'
      ? createRoverSpatialCandidates
      : createRoverTeachingCandidates;
  $('source').value = JSON.stringify(
    withCampaignPresentation(create({ artwork: true }), 'rover'),
    null,
    2,
  );
  sourceChanged = true;
  inspectSource();
});
$('fracture').onclick = guarded(() => {
  if (!discardSource()) return;
  $('source').value = JSON.stringify(
    withCampaignPresentation(createFractureCandidates({ artwork: true }), 'fracture'),
    null,
    2,
  );
  sourceChanged = true;
  inspectSource();
});
$('fracture-spatial').onclick = guarded(() => {
  if (!discardSource()) return;
  $('source').value = JSON.stringify(createFractureSpatialCandidates(), null, 2);
  sourceChanged = true;
  inspectSource();
});
$('phase').onclick = guarded(() => {
  if (!discardSource()) return;
  $('source').value = JSON.stringify(
    withCampaignPresentation(createPhaseCandidates({ artwork: true }), 'phase'),
    null,
    2,
  );
  sourceChanged = true;
  inspectSource();
});
$('phase-spatial').onclick = guarded(() => {
  if (!discardSource()) return;
  $('source').value = JSON.stringify(createPhaseSpatialCandidates(), null, 2);
  sourceChanged = true;
  inspectSource();
});
$('livewire').onclick = guarded(() => {
  if (!discardSource()) return;
  $('source').value = JSON.stringify(
    withCampaignPresentation(createLivewireCandidates({ artwork: true }), 'livewire'),
    null,
    2,
  );
  sourceChanged = true;
  inspectSource();
});
$('relay').onclick = guarded(() => {
  if (!discardSource()) return;
  $('source').value = JSON.stringify(
    withCampaignPresentation(createRelayCandidates({ artwork: true }), 'relay'),
    null,
    2,
  );
  sourceChanged = true;
  inspectSource();
});
$('team-signal').onclick = guarded(() => {
  if (!discardSource()) return;
  $('source').value = JSON.stringify(createTeamSignalCandidates({ campaignTheme: true }), null, 2);
  sourceChanged = true;
  inspectSource();
});
$('team-journey').onclick = guarded(() => {
  if (!discardSource()) return;
  $('source').value = JSON.stringify(
    $('team-journey-edition').value === 'spatial-originals-1'
      ? createTeamSpatialOriginalCandidates()
      : $('team-journey-edition').value === 'pressure-originals-1'
        ? createTeamPressureOriginalCandidates()
        : createTeamJourneyCandidates({ artwork: true }),
    null,
    2,
  );
  sourceChanged = true;
  inspectSource();
});
$('team-timed').onclick = guarded(() => {
  if (!discardSource()) return;
  $('source').value = JSON.stringify(createTeamTimedCandidates(), null, 2);
  sourceChanged = true;
  inspectSource();
});
$('team-timed-originals').onclick = guarded(() => {
  if (!discardSource()) return;
  $('source').value = JSON.stringify(
    $('team-window-edition').value === 'depot-spatial-1'
      ? createTeamDepotSpatialCandidates({ artwork: true })
      : $('team-window-edition').value === 'window-spatial-1'
        ? createTeamWindowSpatialCandidates({ artwork: true })
        : createTeamTimedOriginalCandidates(),
    null,
    2,
  );
  sourceChanged = true;
  inspectSource();
});
$('crosswind').onclick = guarded(() => {
  if (!discardSource()) return;
  $('source').value = JSON.stringify(
    withCampaignPresentation(createCrosswindCandidates({ artwork: true }), 'crosswind'),
    null,
    2,
  );
  sourceChanged = true;
  inspectSource();
});
$('sentinel').onclick = guarded(() => {
  if (!discardSource()) return;
  $('source').value = JSON.stringify(
    withCampaignPresentation(createSentinelCandidates({ artwork: true }), 'sentinel'),
    null,
    2,
  );
  sourceChanged = true;
  inspectSource();
});
$('sentinel-spatial').onclick = guarded(() => {
  if (!discardSource()) return;
  $('source').value = JSON.stringify(
    $('sentinel-spatial-edition').value === 'inner'
      ? createSentinelInnerCandidates()
      : createSentinelSpatialCandidates(),
    null,
    2,
  );
  sourceChanged = true;
  inspectSource();
});
$('apex').onclick = guarded(() => {
  if (!discardSource()) return;
  $('source').value = JSON.stringify(
    withCampaignPresentation(createApexCandidates({ artwork: true }), 'apex'),
    null,
    2,
  );
  sourceChanged = true;
  inspectSource();
});
$('apex-spatial').onclick = guarded(() => {
  if (!discardSource()) return;
  $('source').value = JSON.stringify(createApexSpatialCandidates(), null, 2);
  sourceChanged = true;
  inspectSource();
});
$('apex-field').onclick = guarded(() => {
  if (!discardSource()) return;
  $('source').value = JSON.stringify(createApexFieldCandidates(), null, 2);
  sourceChanged = true;
  inspectSource();
});
$('whole-journey').onclick = guarded(() => {
  if (!discardSource()) return;
  $('source').value = JSON.stringify(
    createWholeJourneyCandidates({
      artwork: true,
      roverTeaching: true,
      campaignPresentation: true,
    }),
    null,
    2,
  );
  sourceChanged = true;
  inspectSource();
});
$('whole-journey-actors').onclick = guarded(() => {
  if (!discardSource()) return;
  $('source').value = JSON.stringify(
    createWholeJourneyCandidates({
      artwork: true,
      roverTeaching: true,
      campaignPresentation: true,
      campaignActors: true,
    }),
    null,
    2,
  );
  sourceChanged = true;
  inspectSource();
});
$('whole-spatial').onclick = guarded(() => {
  if (!discardSource()) return;
  $('source').value = JSON.stringify(createWholeSpatialCandidates({ artwork: true }), null, 2);
  sourceChanged = true;
  inspectSource();
});
$('whole-field').onclick = guarded(() => {
  if (!discardSource()) return;
  $('source').value = JSON.stringify(createWholeFieldCandidates({ artwork: true }), null, 2);
  sourceChanged = true;
  inspectSource();
});
$('whole-timed').onclick = guarded(() => {
  if (!discardSource()) return;
  $('source').value = JSON.stringify(createWholeTimedCandidates({ artwork: true }), null, 2);
  sourceChanged = true;
  inspectSource();
});
$('whole-variety').onclick = guarded(() => {
  if (!discardSource()) return;
  const create =
    {
      'variety-1': createWholeVarietyCandidates,
      'sorting-lanes-1': createWholeSortingCandidates,
      'global-impact-1': createWholeImpactCandidates,
      'pressure-arcs-1': createWholePressureCandidates,
      'cultural-pressure-1': createWholeCulturalPressureCandidates,
      'erosion-counterplay-1': createWholeErosionReviewCandidates,
      'cultural-spatial-triptych-1': createSpatialNextBatchCandidates,
      'horizon-cultural-joins-1': createHorizonNextBatchCandidates,
      'ukrainian-ornament-study-1': createUkrainianOrnamentJourney,
      'ukrainian-ornament-atlas-1': createUkrainianOrnamentAtlasJourney,
    }[$('whole-variety-edition').value] ?? createWholeVarietyCandidates;
  $('source').value = JSON.stringify(create({ artwork: true }), null, 2);
  sourceChanged = true;
  inspectSource();
});
$('import').onchange = guarded(async () => {
  const file = $('import').files[0];
  if (!file || !discardSource()) return;
  if (file.size > 4 * 1024 * 1024) throw editorMessageError('errors:studio.source.importSize');
  const current = inspections.begin();
  let text;
  try {
    text = await file.text();
  } catch (error) {
    if (current()) throw error;
    return;
  }
  if (!current()) return;
  $('source').value = text;
  sourceChanged = true;
  inspectSource();
  $('import').value = '';
});
$('export').onclick = guarded(async () => {
  const result = await exportJSONFile(session.current(), `${session.current().id}-backup.json`);
  status(() => platformExportText(result));
});
$('export-team').onclick = guarded(async () => {
  if (sourceChanged) throw editorMessageError('errors:studio.source.exportMission');
  const mission = currentMission();
  if (!mission) throw editorMessageError('errors:studio.chooseTeam');
  const difficulty = $('difficulty').value;
  const pack = createTeamTestPack(session.current(), mission.id, difficulty);
  const result = await exportJSONFile(pack, `${mission.id}-${difficulty}-team-test.json`);
  status(() => t('tools:studio.export.teamMission', { message: platformExportText(result) }));
});
$('save').onclick = guarded(() => session.save());
$('export-team-campaign').onclick = guarded(async () => {
  if (sourceChanged) throw editorMessageError('errors:studio.source.exportCampaign');
  const campaignId = $('team-test-campaign').value;
  const difficulty = $('difficulty').value;
  const pack = createTeamCampaignTestPack(session.current(), campaignId, difficulty);
  const result = await exportJSONFile(pack, `${campaignId}-${difficulty}-team-test.json`);
  status(() =>
    t('tools:studio.export.teamCampaign', {
      message: platformExportText(result),
      count: pack.levels.length,
    }),
  );
});
for (const action of ['undo', 'redo'])
  $('' + action).onclick = guarded(() => {
    if (!discardSource()) return;
    session[action]();
    render();
    queueSave();
  });
for (const id of ['mission', 'difficulty']) $(id).onchange = guarded(() => inspectBoard());
$('show-capture').onchange = guarded(() => inspectBoard(inspectedTrail));
$('clear-inspection').onclick = guarded(() => inspectBoard());
$('tuning-form').onsubmit = guarded((event) => {
  event.preventDefault();
  if (!discardSource()) return;
  const mission = currentMission();
  if (!mission) throw editorMessageError('errors:studio.chooseMission');
  const candidate = tuneContentMission(session.current(), mission.id, {
    coverage: Number($('target-coverage').value) / 100,
    timeLimitSeconds: Number($('countdown-seconds').value),
    difficulty: Object.fromEntries(
      Object.keys(mission.design.difficulty).map((facet) => [
        facet,
        Number($(`rating-${facet}`).value),
      ]),
    ),
  });
  session.replace(candidate);
  render();
  queueSave();
});
$('geometry-form').onsubmit = guarded((event) => {
  event.preventDefault();
  if (!discardSource()) return;
  const project = session.current(),
    mission = currentMission();
  if (!mission) throw editorMessageError('errors:studio.chooseMission');
  const map = project.maps.find(
    (m) => m.id === mission.map.id && m.revision === mission.map.revision,
  );
  const [x, y, w, h] = ['x', 'y', 'w', 'h'].map((id) => Number($(id).value)),
    surface = $('surface').value;
  if (![x, y, w, h].every(Number.isInteger))
    throw editorMessageError('errors:studio.geometry.wholeCells');
  let changes;
  if (surface === 'spawn' || surface === 'spawn-team-two') {
    const spawnId = surface === 'spawn-team-two' ? mission.team?.spawnIds[1] : mission.spawnId;
    if (!spawnId) throw editorMessageError('errors:studio.geometry.secondSpawn');
    changes = {
      spawns: map.spawns.map((s) => (s.id === spawnId ? { ...s, x: x + 0.5, y: y + 0.5 } : s)),
    };
  } else if (surface === 'slow' || surface === 'lethal')
    changes = {
      terrain: [
        ...map.terrain,
        { id: `terrain-${crypto.randomUUID()}`, kind: surface, x, y, w, h },
      ],
    };
  else changes = { [surface]: [...map[surface], { x, y, w, h }] };
  const candidate = forkMissionMap(project, mission.id, changes);
  compileContentProject(candidate);
  session.replace(candidate);
  render();
  queueSave();
});
$('board').onclick = (event) => {
  if (!currentMission()) return;
  const rect = $('board').getBoundingClientRect();
  $('x').value = Math.min(
    71,
    Math.max(0, Math.floor(((event.clientX - rect.left) * 72) / rect.width)),
  );
  $('y').value = Math.min(
    35,
    Math.max(0, Math.floor(((event.clientY - rect.top) * 36) / rect.height)),
  );
};
$('inspect').onclick = guarded(() => {
  const text = $('trail').value.trim();
  if (text.length > 16000) throw editorMessageError('errors:studio.trail.inputBudget');
  const cells = text
    ? text.split(',').map((cell) => {
        if (!/^\s*\d+\s*$/.test(cell)) throw editorMessageError('errors:studio.trail.indexes');
        return Number(cell);
      })
    : [];
  if (cells.length > 2592) throw editorMessageError('errors:studio.trail.cellBudget');
  inspectBoard(cells);
});
$('play').onclick = guarded(() =>
  launchPreview(session.current(), $('mission').value, $('difficulty').value),
);
async function launchPreview(source, missionId, difficulty) {
  previewController?.abort();
  const controller = new AbortController();
  previewController = controller;
  const ticket = ++previewRevision;
  stopPreviewReadiness();
  $('preview').src = 'about:blank';
  $('preview-panel').hidden = false;
  localizedText($('preview-status'), localizedMessage('tools:studio.preview.preparing'));
  let result, previewProject;
  try {
    // Own one immutable edition across asynchronous media loading and reuse its
    // validated projections; never compile the whole library twice per launch.
    const project = compileContentProject(source);
    previewProject = project.source;
    const manifest = prepareContentPreview(project, missionId, { difficulty }).manifest;
    const pin = manifest.background;
    const [theme, artwork] = await Promise.all([
      loadPreviewTheme({ themeId: manifest.presentation.themeId, signal: controller.signal }),
      pin
        ? (async () => {
            const creatorDraft = new URLSearchParams(location.search).get('creator-draft');
            if (!creatorDraft) return loadPreviewArtwork(pin, { signal: controller.signal });
            const { loadCreatorDraftArtwork } = await import('../creator/draft-artwork.mjs');
            return loadCreatorDraftArtwork(creatorDraft, pin, { signal: controller.signal });
          })()
        : null,
    ]);
    if (ticket !== previewRevision) return;
    result = prepareContentPreview(project, missionId, { difficulty, theme, artwork });
    sessionStorage.setItem('revealline.playground.current', JSON.stringify(result.scenario));
  } catch (error) {
    if (ticket === previewRevision && error.name !== 'AbortError')
      localizedText($('preview-status'), () => studioPreviewFailureText(error));
    return;
  }
  const url = new URL(`../?practice=1&revision=studio-${ticket}`, location.href).href;
  $('preview').src = url;
  localizedText($('preview-status'), () =>
    studioPreviewLoadingText(previewProject, missionId, difficulty),
  );
  $('preview-panel').scrollIntoView({ block: 'start' });
  stopPreviewReadiness = observePreviewReadiness({
    expectedURL: url,
    readDocument: () => $('preview').contentDocument,
    isCurrent: () => ticket === previewRevision,
    notify: (state) => {
      localizedText(
        $('preview-status'),
        localizedMessage(
          state === 'ready'
            ? 'tools:studio.preview.ready'
            : state === 'failed'
              ? 'tools:studio.preview.failed'
              : 'tools:studio.preview.slow',
        ),
      );
    },
  });
}
function closePreview() {
  previewRevision++;
  previewController?.abort();
  stopPreviewReadiness();
  $('preview').src = 'about:blank';
  $('preview-panel').hidden = true;
  $('play').focus();
}
$('close-preview').onclick = closePreview;
$('preview-return').onclick = closePreview;
window.addEventListener('beforeunload', (event) => {
  if (sourceChanged || session?.status().dirty || traceRecovery.hasUnsaved()) {
    event.preventDefault();
    event.returnValue = '';
  }
});
window.addEventListener('pagehide', (event) => {
  if (!event.persisted) {
    stopGameplayTuning();
    gameplayTuning.dispose();
    stopMapLocale();
    paintedPreview = null;
  }
  imageWorkbench.dispose();
  previewController?.abort();
  clearTimeout(saveTimer);
  stopPreviewReadiness();
});
async function boot() {
  let saved = null,
    storageError = null;
  try {
    saved = await backend.read(projectIdFromURL(location.href));
  } catch (error) {
    storageError = error;
  }
  let projectId = 'my-journey';
  try {
    projectId = projectIdFromURL(location.href);
  } catch {
    /* Truthful warning below. */
  }
  setSession(saved?.project ?? createStarterProject(projectId), saved?.revision ?? null);
  render();
  if (storageError)
    status(
      () => t('tools:studio.storage.recovery', { message: editorErrorText(storageError) }),
      true,
    );
  else if (!saved) queueSave();
  document.documentElement.dataset.toolState = 'ready';
}
boot().catch((error) => {
  status(() => t('tools:studio.storage.openFailed', { message: editorErrorText(error) }), true);
  document.documentElement.dataset.toolState = 'failed';
});
