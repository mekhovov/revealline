import { createStarterProject } from '../content-design/starter.mjs';
import { createOpeningCandidates } from '../content-design/horizon-candidates.mjs';
import { compileContentProject } from '../content-design/project.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { paintContentMap } from '../content-design/map-view.mjs';
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
import { journeyPreset } from '../content-design/catalogs.mjs';

const $ = (id) => document.getElementById(id);
const backend = createContentDraftBackend();
let session,
  inspected = null,
  sourceChanged = false,
  saveTimer,
  previewTimer,
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
  });
  $('capture-legend').hidden = !$('show-capture').checked;
  $('capture-summary').textContent = summary;
  canvas.setAttribute('aria-describedby', 'geometry capture-summary');
}
function inspectBoard(trailCells = []) {
  const mission = currentMission();
  setBoardAvailability(document, !!mission);
  if (!mission) {
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
  const { geometry, manifest, capture } = preview;
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
  $('rules').textContent =
    `${manifest.level.rules.lives ?? journeyPreset(manifest.difficulty).lives} ${manifest.mode === 'team' ? 'shared team lives' : 'lives'} · ${manifest.level.rules.moveSpeed} cells/s · ${Math.round(mission.coverage * 100)}% earned coverage · ${mission.timeLimitSeconds ? 'Authored countdown (non-failing on Gentle)' : 'No countdown'}`;
  $('geometry').textContent =
    `${geometry.foundationCount} interior foundation cells excluded from score and coverage. ${geometry.eligibleCount} earnable cells; ${geometry.safeComponents.length} reclaimed components. ${(preview.markers.spawns ?? [manifest.level.spawn]).map((spawn, index) => `Spawn ${index + 1} (${spawn.x}, ${spawn.y})`).join('; ')}. ${preview.markers.actors.map((actor) => `${actor.id}: ${actor.type} at (${actor.x}, ${actor.y})`).join('; ')}`;
  $('effective').textContent = JSON.stringify(
    {
      policy: manifest.policyId,
      simulationIdentity: manifest.simulationIdentity,
      rules: manifest.level.rules,
      actors: manifest.level.enemies,
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
  $('play').disabled = !mission.modes.includes('solo');
  $('play').title = mission.modes.includes('solo')
    ? ''
    : 'This candidate has no Solo adapter. Team and paired-race gameplay remain separate.';
}
function render(selected = $('mission').value) {
  inspections.invalidate();
  tuningRevision = null;
  const project = session.current();
  $('project-id').value = project.id;
  $('project-name').textContent = project.name;
  $('mission').replaceChildren(
    ...project.missions.map((m) => {
      const option = document.createElement('option');
      option.value = m.id;
      option.textContent = `${m.name}${m.archived ? ' · Archived' : ''}`;
      return option;
    }),
  );
  if (project.missions.some((m) => m.id === selected)) $('mission').value = selected;
  $('structure').textContent =
    `${project.packs.length} packs / ${project.campaigns.length} campaigns / ${project.missions.length} missions. ${project.campaigns.map((c) => `${c.name}: ${c.missionIds.length}`).join(' · ')}`;
  $('source').value = session.export();
  sourceChanged = false;
  inspected = null;
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
    ['item-band-row', kind === 'campaign' && action === 'create'],
    [
      'item-parent-row',
      kind !== 'pack' && !['rename', 'delete', 'archive', 'restore'].includes(action),
    ],
    ['item-confirm-row', action === 'delete'],
  ])
    $(id).hidden = !visible;
  $('item-id').required = creating;
  $('item-name').required = creating || action === 'rename';
  $('item-band').required = kind === 'campaign' && action === 'create';
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
              return `${campaign.name}${campaign.archived ? ' [Archived]' : ''} [${
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
    (action === 'duplicate' && kind !== 'mission') ||
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
    ...(kind === 'campaign' && action === 'create' ? { band: Number($('item-band').value) } : {}),
    ...(kind !== 'pack' &&
    !['rename', 'delete', 'archive', 'restore'].includes(action) &&
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
  $('apply').disabled = true;
  const text = $('source').value,
    project = compileContentProject(text).source;
  inspected = { text, project, head };
  $('validation').textContent =
    `${project.name}: ${project.maps.length} map revisions, ${project.missions.length} missions compile. ${head ? `Inspected checkpoint ${selectedRevision} (latest ${head.revision}). Older versions restore as a new checkpoint. ` : ''}Human playtesting and publication remain pending. Apply to replace the workbench draft.`;
  $('apply').disabled = false;
}
$('source').addEventListener('input', () => {
  inspections.invalidate();
  sourceChanged = true;
  inspected = null;
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
$('opening').onclick = guarded(() => {
  if (!discardSource()) return;
  $('source').value = JSON.stringify(createOpeningCandidates({ artwork: true }), null, 2);
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
$('save').onclick = guarded(() => session.save());
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
$('play').onclick = guarded(async () => {
  const source = session.current(),
    missionId = $('mission').value,
    difficulty = $('difficulty').value;
  previewController?.abort();
  const controller = new AbortController();
  previewController = controller;
  const ticket = ++previewRevision;
  clearInterval(previewTimer);
  $('preview').src = 'about:blank';
  $('preview-panel').hidden = false;
  $('preview-status').textContent = 'Preparing the exact candidate…';
  let result;
  try {
    const manifest = prepareContentPreview(source, missionId, { difficulty }).manifest;
    const pin = manifest.background;
    const [theme, artwork] = await Promise.all([
      loadPreviewTheme({ themeId: manifest.presentation.themeId, signal: controller.signal }),
      pin ? loadPreviewArtwork(pin, { signal: controller.signal }) : null,
    ]);
    if (ticket !== previewRevision) return;
    result = prepareContentPreview(source, missionId, { difficulty, theme, artwork });
    sessionStorage.setItem('revealline.playground.current', JSON.stringify(result.scenario));
  } catch (error) {
    if (ticket === previewRevision && error.name !== 'AbortError')
      $('preview-status').textContent =
        `${error.message} Close preview and retry. Your draft is intact.`;
    return;
  }
  const url = new URL(`../?practice=1&revision=studio-${ticket}`, location.href).href;
  let documentLoaded = false;
  $('preview').onload = () => {
    documentLoaded = ticket === previewRevision && $('preview').contentDocument?.URL === url;
  };
  $('preview').src = url;
  $('preview-status').textContent =
    `Loading ${result.manifest.level.name} · ${difficulty}. Frozen candidate; later edits do not change this run.`;
  $('preview-panel').scrollIntoView({ block: 'start' });
  clearInterval(previewTimer);
  const deadline = Date.now() + 20000;
  previewTimer = setInterval(() => {
    if (ticket !== previewRevision) return;
    const state = documentLoaded
      ? $('preview').contentDocument?.documentElement.dataset.bootState
      : null;
    if (state === 'ready' || state === 'failed' || Date.now() > deadline) {
      clearInterval(previewTimer);
      $('preview-status').textContent =
        state === 'ready'
          ? 'Engine ready. Practice only; no campaign awards. Close preview to return to your draft.'
          : 'Preview has not reported ready. Check its recovery controls, or close and retry. Your draft is intact.';
    }
  }, 250);
});
$('close-preview').onclick = () => {
  previewRevision++;
  previewController?.abort();
  clearInterval(previewTimer);
  $('preview').src = 'about:blank';
  $('preview-panel').hidden = true;
  $('play').focus();
};
window.addEventListener('beforeunload', (event) => {
  if (sourceChanged || session?.status().dirty) {
    event.preventDefault();
    event.returnValue = '';
  }
});
window.addEventListener('pagehide', () => {
  previewController?.abort();
  clearTimeout(saveTimer);
  clearInterval(previewTimer);
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
