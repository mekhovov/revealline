import { createImageTraceBackend } from '../content-design/image-trace-storage.mjs';
import { createImageTraceSession } from '../content-design/image-trace-session.mjs';
import { readImageTraceFile } from '../content-design/image-trace.mjs';
import { exportJSONFile } from '../platform.mjs';

export function createTraceRecovery({
  document,
  workbench,
  getSource,
  getMission,
  backend = createImageTraceBackend(),
  exportFile = exportJSONFile,
}) {
  const $ = (id) => document.getElementById(id);
  let imported = null,
    importTicket = 0,
    ownerKey = null;
  const message = (text) => {
    $('trace-status').textContent = text;
  };
  const guard = (action) => async () => {
    try {
      await action();
    } catch (error) {
      message(error.message);
    }
  };
  const session = createImageTraceSession({
    backend,
    restore: (trace) => workbench.restore(trace),
    onStatus(state) {
      $('trace-restore').disabled = !state?.saved || state.saving;
      $('trace-replace').disabled = !state?.needsChoice || !!state.error || state.saving;
      $('trace-export-saved').disabled = !state?.saved;
      $('trace-session-restore').disabled = !state?.dirty || !session.pending() || state.saving;
      if (!state) return message('Choose a mission to open tracing recovery.');
      if (state.error)
        return message(
          `Tracing is session-only: ${state.error.message} Export a tracing backup, then Read saved tracing to retry. Your project saves separately.`,
        );
      if (!state.loaded) return message('Reading this mission’s local tracing draft…');
      if (state.saving) return message('Saving reference, accepted crop and queue locally…');
      if (state.needsChoice)
        return message(
          `Current tracing is unsaved. Saved revision ${state.revision ?? 'none'} has ${state.saved?.rectangles.length ?? 0} rectangle(s). Export either draft, Restore saved, or explicitly Replace saved with current.`,
        );
      if (state.saved)
        return message(
          `Local tracing revision ${state.revision} · ${state.saved.reference.name} · ${state.saved.rectangles.length} rectangle(s). Restore saved tracing after reopening. Geometry still requires Inspect and Apply. Project backups do not contain this picture.`,
        );
      message(
        'No saved tracing for this mission. New references and accepted crop/queue edits save locally, separately from project checkpoints.',
      );
    },
  });
  $('trace-read').onclick = guard(() => session.reload());
  $('trace-restore').onclick = guard(() => session.restore());
  $('trace-session-restore').onclick = guard(() => session.restore(session.pending()));
  $('trace-replace').onclick = guard(() => session.replace());
  async function exportTrace(trace, suffix) {
    if (!trace) throw new Error('No tracing draft to export.');
    const result = await exportFile(trace, `${trace.projectId}-${trace.missionId}-${suffix}.json`);
    message(
      `${result.message} Keep the matching project backup too; neither file publishes content.`,
    );
  }
  $('trace-export').onclick = guard(() =>
    exportTrace(workbench.snapshot() ?? session.pending(), 'tracing'),
  );
  $('trace-export-saved').onclick = guard(() =>
    exportTrace(session.status()?.saved, 'saved-tracing'),
  );
  $('trace-import').onchange = guard(async () => {
    const file = $('trace-import').files[0];
    imported = null;
    $('trace-import-restore').disabled = true;
    const ticket = ++importTicket;
    if (!file) return;
    const candidate = await readImageTraceFile(file);
    if (ticket !== importTicket) return;
    imported = candidate;
    $('trace-import-restore').disabled = false;
    message(
      `Inspected backup: ${candidate.projectId} / ${candidate.missionId}, ${candidate.reference.name}, ${candidate.rectangles.length} rectangle(s). Restore backup tracing explicitly; the exact matching map is required. No geometry has changed.`,
    );
  });
  $('trace-import-restore').onclick = guard(async () => {
    if (!imported) throw new Error('Inspect a tracing backup first.');
    await session.restore(imported);
    imported = null;
    $('trace-import-restore').disabled = true;
  });
  return {
    sync() {
      const key = JSON.stringify([getSource().id, getMission()?.id]);
      if (key !== ownerKey) {
        ownerKey = key;
        importTicket++;
        imported = null;
        $('trace-import').value = '';
        $('trace-import-restore').disabled = true;
      }
      session.select(getSource().id, getMission()?.id);
    },
    changed: () => session.change(workbench.snapshot()),
    hasUnsaved: () => session.hasUnsaved(),
  };
}
