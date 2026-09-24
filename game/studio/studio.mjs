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
import { withPressureDifficulty } from '../content-design/pressure-candidates.mjs';
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
} from '../content-design/whole-spatial-candidates.mjs';
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
import { contentActorDescription } from '../content-design/actor-marker.mjs';
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
import { journeyPreset } from '../content-design/catalogs.mjs';
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
  sourceChanged = false,
  saveTimer,
  stopPreviewReadiness = () => {},
  inspectedTrail = [],
  tuningRevision = null,
  previewRevision = 0,
  previewController = null;
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
  $('status').textContent = text;
  $('status').dataset.error = String(error);
}
function guarded(action) {
  return async (event) => {
    try {
      await action(event);
    } catch (error) {
      if (error.name === 'AbortError') return;
      status(error.message, true);
    }
  };
}
function showStorage(state) {
  if (state.error)
    status(
      `Session only: ${state.error.message} Your edits remain here. Export a backup, then retry or inspect the newer saved draft.`,
      true,
    );
  else if (state.saving) status('Saving an immutable checkpoint…');
  else
    status(
      state.dirty
        ? 'Unsaved edits are in this session. Saving shortly…'
        : `Saved locally · checkpoint ${state.revision}. This is a candidate, not published content.`,
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
  return (
    !sourceChanged ||
    window.confirm('Discard unapplied JSON edits? The applied draft is unchanged.')
  );
}
function currentMission() {
  return session.current().missions.find((m) => m.id === $('mission').value);
}
function draw(preview) {
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
  const mission = currentMission();
  syncStudioDifficulty($('difficulty'), session.current().difficultyCatalogId, {
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
    $('export-team').hidden = true;
    $('team-sequence-tools').hidden = true;
    $('team-test-help').hidden = true;
    inspectedTrail = [];
    tuningRevision = null;
    return;
  }
  const preview = prepareContentPreview(session.current(), mission.id, {
    mode: mission.modes.includes('solo') ? 'solo' : mission.modes[0],
    difficulty: $('difficulty').value,
    trailCells,
  });
  inspectedTrail = [...trailCells];
  $('trail').value = inspectedTrail.join(', ');
  draw(preview);
  const { geometry, manifest, capture, authoredTerrain } = preview;
  const tuningKey = JSON.stringify([mission.id, mission.revision]);
  if (tuningRevision !== tuningKey) {
    $('target-coverage').value = Number((mission.coverage * 100).toFixed(8));
    $('countdown-seconds').value = mission.timeLimitSeconds;
    for (const [facet, rating] of Object.entries(mission.design.difficulty))
      $(`rating-${facet}`).value = rating;
    tuningRevision = tuningKey;
  }
  $('map-name').textContent = mission.name;
  $('lesson').textContent = mission.design.routeDecision;
  const preset = journeyPreset(manifest.difficulty, session.current().difficultyCatalogId);
  $('rules').textContent =
    `${manifest.level.rules.lives ?? preset.lives} ${manifest.mode === 'team' ? 'shared team lives' : 'lives'} · ${manifest.level.rules.moveSpeed} cells/s · ${Math.round(mission.coverage * 100)}% earned coverage · ${mission.timeLimitSeconds ? 'Authored countdown (non-failing on Gentle)' : 'No countdown'} · ${session.current().difficultyCatalogId}: ${preset.description} Player handling and attack warning lengths are unchanged between presets.`;
  $('geometry').textContent =
    `${geometry.foundationCount} interior foundation cells excluded from score and coverage. ${geometry.eligibleCount} earnable cells; ${geometry.safeComponents.length} reclaimed components. ${(preview.markers.spawns ?? [manifest.level.spawn]).map((spawn, index) => `Spawn ${index + 1} (${spawn.x}, ${spawn.y})`).join('; ')}. ${preview.markers.actors.map((actor) => `${actor.id}: ${contentActorDescription(manifest.level, actor)} at (${actor.x}, ${actor.y})`).join('; ')}. Contact bonuses: ${mission.bonuses.map((bonus) => `${bonus.id}: ${bonus.kind} at (${bonus.x}, ${bonus.y})`).join('; ') || 'none'}.`;
  $('geometry').textContent +=
    ` Timed optional pickups: ${(mission.timedBonuses?.schedules ?? []).map((schedule) => `${schedule.id}: ${schedule.anchors.length} possible anchors, ${schedule.announcementTicks / 120}s announcement / ${schedule.availableTicks / 120}s available / ${schedule.cooldownTicks / 120}s cooldown, at most ${schedule.maxCollections} collections`).join('; ') || 'none'}.`;
  $('geometry').textContent +=
    ` Capture objectives: ${mission.objectives.map((objective) => `${objective.id}: ${objective.required ? 'required' : 'optional'}, ${objective.hidden ? 'hidden initially' : 'visible'}, at (${objective.x}, ${objective.y})`).join('; ') || 'none'}.`;
  if (mission.relayLinks)
    $('geometry').textContent +=
      ` Relay gates: ${preview.markers.gates.map((gate) => `${gate.label}: ${gate.id} opens permanently after capturing ${gate.objectiveId}`).join('; ') || 'none'}. Matching numbers show links, not a required order. Closed gates block movement; opened connectors do not earn coverage.`;
  $('geometry').textContent +=
    ` Authored terrain: ${authoredTerrain.map((area) => `${area.kind} at (${area.x}, ${area.y}), ${area.w} × ${area.h}`).join('; ') || 'none'}. Terrain is active only on unclaimed field.`;
  if (manifest.level.directionalFields)
    $('geometry').textContent +=
      ` Directional fields: ${manifest.level.directionalFields.zones.map((zone) => `${zone.id}: ${zone.direction}, (${zone.x}, ${zone.y}), ${zone.w} × ${zone.h}`).join('; ') || 'none'}. Craft speed ×1.25 with the arrow, ×0.8 against, ×1 across; no drift or enemy effect. Capture removes the effect; erosion restores it.`;
  $('effective').textContent = JSON.stringify(
    {
      policy: manifest.policyId,
      simulationIdentity: manifest.simulationIdentity,
      rules: manifest.level.rules,
      actors: manifest.level.enemies,
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
      li.textContent = `${item.severity}: ${item.code}${item.message ? ` — ${item.message}` : ''}`;
      return li;
    }),
  );
  $('play').disabled = !mission.modes.includes('solo') || !!mission.combat?.enabled;
  $('export-team').hidden = !mission.modes.includes('team');
  $('team-sequence-tools').hidden = !mission.modes.includes('team');
  const selectedTeamCampaign = $('team-test-campaign').value;
  const teamDraft = session.current();
  const activeTeamIds = new Set(
    teamDraft.missions
      .filter((item) => !item.archived && item.modes.includes('team'))
      .map((item) => item.id),
  );
  $('team-test-campaign').replaceChildren(
    ...[
      { id: '', name: 'Choose a campaign' },
      ...teamDraft.campaigns.filter(
        (campaign) => !campaign.archived && campaign.missionIds.some((id) => activeTeamIds.has(id)),
      ),
    ].map((campaign) => {
      const option = document.createElement('option');
      option.value = campaign.id;
      option.textContent = campaign.name;
      return option;
    }),
  );
  if ([...$('team-test-campaign').options].some((option) => option.value === selectedTeamCampaign))
    $('team-test-campaign').value = selectedTeamCampaign;
  $('team-test-help').hidden = !mission.modes.includes('team');
  $('play').title = mission.combat?.enabled
    ? 'Enabled combat preview awaits qualified actor/projectile presentation. Static inspection remains available.'
    : mission.modes.includes('solo')
      ? ''
      : 'This candidate has no Solo adapter. Team and paired-race gameplay remain separate.';
}
function render(selected = $('mission').value) {
  inspections.invalidate();
  pacingInspector.sync();
  tuningRevision = null;
  const project = session.current();
  $('pressure-edition').disabled = project.difficultyCatalogId === 'journey-difficulty-v2';
  $('project-id').value = project.id;
  $('project-name').textContent = project.name;
  const nameCounts = new Map();
  for (const mission of project.missions)
    nameCounts.set(mission.name, (nameCounts.get(mission.name) ?? 0) + 1);
  $('mission').replaceChildren(
    ...project.missions.map((m) => {
      const option = document.createElement('option');
      option.value = m.id;
      option.textContent = `${m.name}${nameCounts.get(m.name) > 1 ? ` · ${m.id}` : ''}${m.archived ? ' · Archived' : ''}`;
      return option;
    }),
  );
  if (project.missions.some((m) => m.id === selected)) $('mission').value = selected;
  $('structure').textContent =
    `${project.packs.length} packs / ${project.campaigns.length} campaigns / ${project.missions.length} missions. ${project.campaigns.map((c) => `${c.name}: ${c.missionIds.length}`).join(' · ')}`;
  $('source').value = session.export();
  sourceChanged = false;
  inspected = null;
  candidateLibrary.clearInspection();
  $('apply').disabled = true;
  $('validation').textContent =
    `Current draft: ${project.maps.length} map revisions, ${project.missions.length} missions. Source edits require a new inspection before applying.`;
  $('undo').disabled = !session.canUndo();
  $('redo').disabled = !session.canRedo();
  $('structure-result').textContent =
    'Current draft structure is shown below. All edits are local candidates; nothing is published.';
  syncStructure();
  inspectBoard();
}
function syncStructure() {
  const project = session.current(),
    kind = $('item-kind').value,
    action = $('item-action').value;
  const creating = action === 'create' || action === 'duplicate';
  const fill = (id, rows, blank) => {
    const selected = $(id).value;
    $(id).replaceChildren(
      ...[...(blank ? [{ id: '', name: blank }] : []), ...rows].map((row) => {
        const option = document.createElement('option');
        option.value = row.id;
        option.textContent = `${row.name}${row.id ? ` · ${row.id}` : ''}${row.archived ? ' · Archived' : ''}`;
        return option;
      }),
    );
    if ([...$(id).options].some((option) => option.value === selected)) $(id).value = selected;
  };
  fill('item-target', project[`${kind}s`]);
  fill(
    'item-parent',
    kind === 'mission' ? project.campaigns : kind === 'campaign' ? project.packs : [],
    'Unassigned',
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
  $('item-dependencies').textContent = removal
    ? removal.deletable
      ? `Delete ${removal.name} (${removal.id}) from this draft only. Maps, assets and saved checkpoints stay intact. Type the exact ID to confirm; Undo restores the item.`
      : `Cannot delete ${removal.name}. Remove memberships first: ${removal.dependencies.map((entry) => `${entry.kind} ${entry.id} (${entry.relation})`).join(', ')}. No automatic cascade.`
    : 'Choose an item to inspect its dependencies.';
  $('structure-order').textContent = project.packs
    .map(
      (pack, index) =>
        `${index + 1}. ${pack.name}${pack.archived ? ' [Archived]' : ''}: ${
          pack.campaignIds
            .map((id) => {
              const campaign = project.campaigns.find((entry) => entry.id === id);
              return `${campaign.name} · band ${campaign.band}${campaign.archived ? ' [Archived]' : ''} [${
                campaign.missionIds
                  .map((missionId) => {
                    const mission = project.missions.find((entry) => entry.id === missionId);
                    return `${mission.name}${mission.archived ? ' [Archived]' : ''}`;
                  })
                  .join(' → ') || 'empty'
              }]`;
            })
            .join(' / ') || 'empty'
        }`,
    )
    .join('\n');
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
  $('structure-result').textContent =
    `${action}: ${kind} ${command.id}. Draft only; Undo restores the previous structure.`;
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
  $('validation').textContent =
    `${project.name}: ${project.maps.length} map revisions, ${project.missions.length} missions compile. ${head ? `Inspected checkpoint ${selectedRevision} (latest ${head.revision}). Older versions restore as a new checkpoint. ` : ''}Human playtesting and publication remain pending. Apply to replace the workbench draft.`;
  $('apply').disabled = false;
  candidateLibrary.reportInspection(
    `${project.name}: ${project.missions.length} missions inspected. The applied draft is unchanged. Review the source before Apply.`,
  );
}
$('source').addEventListener('input', () => {
  inspections.invalidate();
  sourceChanged = true;
  inspected = null;
  candidateLibrary.clearInspection();
  $('apply').disabled = true;
  $('validation').textContent =
    'Unapplied JSON edits. Inspect, then apply. These edits are not autosaved.';
});
$('validate').onclick = guarded(() => inspectSource());
$('apply').onclick = guarded(async () => {
  if (!inspected || inspected.text !== $('source').value)
    throw new Error('Inspect the current source before applying.');
  const pending = inspected;
  if (session.status().saving)
    throw new Error('Wait for the current checkpoint save before replacing the project.');
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
  if (id === session.current().id)
    throw new Error('Choose a new project ID; this action does not reset an existing project.');
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
    }[$('whole-variety-edition').value] ?? createWholeVarietyCandidates;
  $('source').value = JSON.stringify(create({ artwork: true }), null, 2);
  sourceChanged = true;
  inspectSource();
});
$('import').onchange = guarded(async () => {
  const file = $('import').files[0];
  if (!file || !discardSource()) return;
  if (file.size > 4 * 1024 * 1024) throw new Error('Project JSON must be no larger than 4 MiB.');
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
  status(result.message);
});
$('export-team').onclick = guarded(async () => {
  if (sourceChanged)
    throw new Error('Inspect and apply source edits before exporting the selected mission.');
  const mission = currentMission();
  if (!mission) throw new Error('Choose a Team mission.');
  const difficulty = $('difficulty').value;
  const pack = createTeamTestPack(session.current(), mission.id, difficulty);
  const result = await exportJSONFile(pack, `${mission.id}-${difficulty}-team-test.json`);
  status(
    `${result.message} Geometry/rules only; Team preview scenery is not authored mission artwork. Your draft is unchanged.`,
  );
});
$('save').onclick = guarded(() => session.save());
$('export-team-campaign').onclick = guarded(async () => {
  if (sourceChanged)
    throw new Error('Inspect and apply source edits before exporting a Team campaign.');
  const campaignId = $('team-test-campaign').value;
  const difficulty = $('difficulty').value;
  const pack = createTeamCampaignTestPack(session.current(), campaignId, difficulty);
  const result = await exportJSONFile(pack, `${campaignId}-${difficulty}-team-test.json`);
  status(
    `${result.message} ${pack.levels.length} ordered Team test missions; use Next after each clear. Geometry/rules only, not authored mission artwork or official progress. Your draft is unchanged.`,
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
  if (!mission) throw new Error('Choose a mission.');
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
  if (!mission) throw new Error('Choose a mission.');
  const map = project.maps.find(
    (m) => m.id === mission.map.id && m.revision === mission.map.revision,
  );
  const [x, y, w, h] = ['x', 'y', 'w', 'h'].map((id) => Number($(id).value)),
    surface = $('surface').value;
  if (![x, y, w, h].every(Number.isInteger)) throw new Error('Geometry uses whole cells.');
  let changes;
  if (surface === 'spawn' || surface === 'spawn-team-two') {
    const spawnId = surface === 'spawn-team-two' ? mission.team?.spawnIds[1] : mission.spawnId;
    if (!spawnId) throw new Error('Choose a Team mission to move its second starting position.');
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
  if (text.length > 16000) throw new Error('Trail input exceeds the board budget.');
  const cells = text
    ? text.split(',').map((cell) => {
        if (!/^\s*\d+\s*$/.test(cell))
          throw new Error('Use comma-separated nonnegative cell indexes.');
        return Number(cell);
      })
    : [];
  if (cells.length > 2592) throw new Error('Too many trail cells.');
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
  $('preview-status').textContent = 'Preparing the exact candidate…';
  let result;
  try {
    // Own one immutable edition across asynchronous media loading and reuse its
    // validated projections; never compile the whole library twice per launch.
    const project = compileContentProject(source);
    const manifest = prepareContentPreview(project, missionId, { difficulty }).manifest;
    const pin = manifest.background;
    const [theme, artwork] = await Promise.all([
      loadPreviewTheme({ themeId: manifest.presentation.themeId, signal: controller.signal }),
      pin ? loadPreviewArtwork(pin, { signal: controller.signal }) : null,
    ]);
    if (ticket !== previewRevision) return;
    result = prepareContentPreview(project, missionId, { difficulty, theme, artwork });
    sessionStorage.setItem('revealline.playground.current', JSON.stringify(result.scenario));
  } catch (error) {
    if (ticket === previewRevision && error.name !== 'AbortError')
      $('preview-status').textContent =
        `${error.message} Close preview and retry. Your draft is intact.`;
    return;
  }
  const url = new URL(`../?practice=1&revision=studio-${ticket}`, location.href).href;
  $('preview').src = url;
  $('preview-status').textContent =
    `Loading ${result.manifest.level.name} · ${difficulty}. Frozen candidate; later edits do not change this run.`;
  $('preview-panel').scrollIntoView({ block: 'start' });
  stopPreviewReadiness = observePreviewReadiness({
    expectedURL: url,
    readDocument: () => $('preview').contentDocument,
    isCurrent: () => ticket === previewRevision,
    notify: (state) => {
      $('preview-status').textContent =
        state === 'ready'
          ? 'Engine ready. Practice only; no campaign awards. Close preview to return to your draft.'
          : state === 'failed'
            ? 'Preview could not start. Check its recovery controls, or close and retry. Your draft is intact.'
            : 'Preview is taking longer than expected. Still checking; you can close and retry. Your draft is intact.';
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
window.addEventListener('pagehide', () => {
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
      `Session only: ${storageError.message} Export your work; Save checkpoint retries storage.`,
      true,
    );
  else if (!saved) queueSave();
  document.documentElement.dataset.toolState = 'ready';
}
boot().catch((error) => {
  status(`Studio could not open: ${error.message}. Saved checkpoints were not changed.`, true);
  document.documentElement.dataset.toolState = 'failed';
});
