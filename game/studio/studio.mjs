import { createStarterProject } from '../content-design/starter.mjs';
import { createOpeningCandidates } from '../content-design/horizon-candidates.mjs';
import { compileContentProject } from '../content-design/project.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { loadPreviewTheme } from '../content-design/preview-loader.mjs';
import { loadPreviewArtwork } from '../content-design/assets.mjs';
import { createContentDraftBackend, forkMissionMap } from '../content-design/drafts.mjs';
import { createContentDraftSession } from '../content-design/session.mjs';
import {
  inspectDraftCheckpoint,
  createInspectionRequests,
  projectIdFromURL,
} from '../content-design/recovery.mjs';
import { exportJSONFile } from '../platform.mjs';

const $ = (id) => document.getElementById(id);
const backend = createContentDraftBackend();
let session,
  inspected = null,
  sourceChanged = false,
  saveTimer,
  previewTimer,
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
  const canvas = $('board'),
    ctx = canvas.getContext('2d'),
    { geometry, manifest } = preview;
  const size = canvas.width / geometry.width;
  for (let i = 0; i < geometry.cells.length; i++) {
    ctx.fillStyle =
      geometry.cells[i] === 1
        ? '#81b5a0'
        : geometry.cells[i] === 2
          ? '#74786b'
          : geometry.terrain[i] === 2
            ? '#8c4036'
            : geometry.terrain[i] === 1
              ? '#665333'
              : '#102720';
    ctx.fillRect((i % 72) * size, Math.floor(i / 72) * size, size - 1, size - 1);
  }
  for (const actor of manifest.level.enemies) {
    ctx.fillStyle = '#ffae8e';
    ctx.beginPath();
    ctx.arc(actor.x * size, actor.y * size, size * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#f5ffba';
  const { x, y } = manifest.level.spawn;
  ctx.fillRect(x * size - 8, y * size - 2, 16, 4);
  ctx.fillRect(x * size - 2, y * size - 8, 4, 16);
}
function inspectBoard(trailCells = []) {
  const mission = currentMission();
  if (!mission) {
    $('play').disabled = true;
    return;
  }
  const preview = prepareContentPreview(session.current(), mission.id, {
    mode: mission.modes.includes('solo') ? 'solo' : mission.modes[0],
    difficulty: $('difficulty').value,
    trailCells,
  });
  draw(preview);
  const { geometry, manifest, capture } = preview;
  $('map-name').textContent = mission.name;
  $('lesson').textContent = mission.design.routeDecision;
  $('rules').textContent =
    `${manifest.level.rules.lives} lives · ${manifest.level.rules.moveSpeed} cells/s · ${Math.round(mission.coverage * 100)}% earned coverage · ${mission.timeLimitSeconds ? 'Authored countdown (non-failing on Gentle)' : 'No countdown'}`;
  $('geometry').textContent =
    `${geometry.foundationCount} interior foundation cells excluded from score and coverage. ${geometry.eligibleCount} earnable cells; ${geometry.safeComponents.length} reclaimed components. Spawn (${manifest.level.spawn.x}, ${manifest.level.spawn.y}). ${manifest.level.enemies.map((actor) => `${actor.id}: ${actor.type} at (${actor.x}, ${actor.y})`).join('; ')}`;
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
    : 'This candidate has no Solo adapter. Paired-race preview remains separate.';
}
function render() {
  inspections.invalidate();
  const project = session.current(),
    selected = $('mission').value;
  $('project-id').value = project.id;
  $('project-name').textContent = project.name;
  $('mission').replaceChildren(
    ...project.missions.map((m) => {
      const option = document.createElement('option');
      option.value = m.id;
      option.textContent = m.name;
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
  $('undo').disabled = !session.canUndo();
  $('redo').disabled = !session.canRedo();
  inspectBoard();
}
function inspectSource({ head, selectedRevision } = {}) {
  inspections.invalidate();
  inspected = null;
  $('apply').disabled = true;
  const text = $('source').value,
    project = compileContentProject(text).source;
  if (!project.missions.length)
    throw new Error(
      'This workbench needs at least one mission. Keep the empty draft in your backup until a mission is authored.',
    );
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
  if (surface === 'spawn')
    changes = {
      spawns: map.spawns.map((s) =>
        s.id === mission.spawnId ? { ...s, x: x + 0.5, y: y + 0.5 } : s,
      ),
    };
  else if (surface === 'slow' || surface === 'lethal')
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
    const pin = prepareContentPreview(source, missionId, { difficulty }).manifest.background;
    const [theme, artwork] = await Promise.all([
      loadPreviewTheme({ signal: controller.signal }),
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
