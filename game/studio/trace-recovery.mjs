import { localizedMessage, localizedText, t } from '../i18n/index.mjs';
import { editorMessageError, editorErrorText } from './editor-copy.mjs';
import { platformExportText } from '../ui/export-copy.mjs';
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
    localizedText($('trace-status'), text);
  };
  const guard = (action) => async () => {
    try {
      await action();
    } catch (error) {
      message(() => editorErrorText(error));
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
      if (!state) return message(localizedMessage('tools:studio.trace.chooseMission'));
      if (state.error)
        return message(() =>
          t('tools:studio.trace.sessionOnly', { message: editorErrorText(state.error) }),
        );
      if (!state.loaded) return message(localizedMessage('tools:studio.trace.reading'));
      if (state.saving) return message(localizedMessage('tools:studio.trace.saving'));
      if (state.needsChoice)
        return message(() =>
          t('tools:studio.trace.unsaved', {
            revision: state.revision ?? t('tools:studio.capture.none'),
            count: state.saved?.rectangles.length ?? 0,
          }),
        );
      if (state.saved)
        return message(
          localizedMessage('tools:studio.trace.saved', {
            revision: state.revision,
            name: state.saved.reference.name,
            count: state.saved.rectangles.length,
          }),
        );
      message(localizedMessage('tools:studio.trace.empty'));
    },
  });
  $('trace-read').onclick = guard(() => session.reload());
  $('trace-restore').onclick = guard(() => session.restore());
  $('trace-session-restore').onclick = guard(() => session.restore(session.pending()));
  $('trace-replace').onclick = guard(() => session.replace());
  async function exportTrace(trace, suffix) {
    if (!trace) throw editorMessageError('errors:studio.trace.noExport');
    const result = await exportFile(trace, `${trace.projectId}-${trace.missionId}-${suffix}.json`);
    message(() => t('tools:studio.trace.exported', { message: platformExportText(result) }));
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
      localizedMessage('tools:studio.trace.imported', {
        project: candidate.projectId,
        mission: candidate.missionId,
        name: candidate.reference.name,
        count: candidate.rectangles.length,
      }),
    );
  });
  $('trace-import-restore').onclick = guard(async () => {
    if (!imported) throw editorMessageError('errors:studio.trace.inspectBackup');
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
