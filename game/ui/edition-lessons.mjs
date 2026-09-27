import { createLearningAttempt } from '../company-campaigns/learning.mjs';
import { mountCompanyWorkbench } from '../company-campaigns/workbench.mjs';
import { createCompanyLearningProofStore } from '../company-campaigns/learning-proofs.mjs';
import { createCompanyStorage } from '../company-storage.mjs';
import { companySimulationIdentity } from '../company-session.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { journeyDifficultyCatalog } from '../content-design/catalogs.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { createRun } from '../core/index.mjs';
import { exportReplay } from '../replay.mjs';
import { boundedJSON, required } from '../data-json.mjs';

/** A result-only bonus. This module cannot select a mission, award an arcade
 * clear, change a run, or control the availability of Next. */
export async function mountEditionLessons({
  provider,
  document: doc,
  window: win,
  writer,
  getRun,
  getRecorder,
  getPictureVisible,
  report,
}) {
  if (!provider.lessons.length)
    return {
      refresh() {},
      pictureReady() {
        return null;
      },
      dispose() {},
    };
  const node = (tag, text) => {
    const value = doc.createElement(tag);
    if (text !== undefined) value.textContent = text;
    return value;
  };
  const liveStatus = (id) => {
    const status = node('p');
    status.id = id;
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    return status;
  };
  const dataStatus = liveStatus('edition-learning-status'),
    lessonStatus = liveStatus('edition-lesson-status'),
    lifetime = new AbortController();
  let disposed = false,
    lessonVisit = 0,
    importRequest = null;
  const reportData = (message) => {
    if (disposed) return;
    dataStatus.textContent = message;
    report(message);
  };
  // Storage operations are synchronous, but their owning replay/import may
  // finish later. Keep storage failures on that operation's live surface.
  let storageReport = reportData;
  const persistWithReport = (notify, commit) => {
    const previous = storageReport;
    storageReport = notify;
    try {
      return commit();
    } finally {
      storageReport = previous;
    }
  };
  const simulations = new Map(),
    compiled = compileContentProject(provider.route.source);
  for (const lesson of provider.lessons) {
    const identities = new Set();
    for (const difficulty of Object.keys(
      journeyDifficultyCatalog(compiled.source.difficultyCatalogId).presets,
    )) {
      const manifest = resolveMission(compiled, lesson.missionId, { difficulty });
      identities.add(
        companySimulationIdentity(
          createRun(applyGameplayTuning(manifest.level, resolveGameplayTuning(difficulty))),
        ),
      );
    }
    simulations.set(lesson.missionId, identities);
  }
  const storage = createCompanyStorage({
    getStorage: () => win.localStorage ?? globalThis.localStorage,
    onError: (error) => storageReport(error.message),
  });
  const proofs = createCompanyLearningProofStore({
    editionId: provider.editionId,
    lessons: provider.lessons,
    acceptSimulation: (id, identity) => simulations.get(id)?.has(identity) === true,
    storage: {
      getItem: storage.getItem,
      setItem(key, value) {
        required(writer.writable, writer.reason || 'Optional learning is kept in this tab only.');
        storage.setItem(key, value);
      },
    },
  });
  const hydration = await proofs.hydrate();
  if (hydration.rejected)
    reportData(
      'Earlier learning records need their matching revision. They remain available in the learning backup.',
    );
  const button = node('button', 'Optional bonus · explore this connection');
  button.id = 'edition-lesson-open';
  button.type = 'button';
  button.className = 'button secondary';
  button.hidden = true;
  doc.getElementById('view-picture').after(button);
  const dialog = node('dialog');
  dialog.id = 'edition-lesson-dialog';
  dialog.className = 'edition-lesson-dialog';
  const content = node('div');
  content.setAttribute('data-game-reading', '');
  dialog.append(content, lessonStatus);
  doc.body.append(dialog);
  const seen = new WeakSet(),
    attempts = new WeakMap();
  let workbench = null;
  const close = () => {
    lessonVisit++;
    workbench?.destroy();
    workbench = null;
    if (lessonOpener?.isConnected && !lessonOpener.hidden)
      lessonOpener.focus({ preventScroll: true });
  };
  dialog.addEventListener('close', close);
  let lessonOpener = button;
  function openLesson(lesson, run = null) {
    if (disposed) return;
    const visit = ++lessonVisit;
    lessonStatus.textContent = '';
    const current = () => !disposed && lessonVisit === visit && dialog.open;
    const reportLesson = (message) => {
      if (disposed) return;
      const visible = current();
      if (visible) lessonStatus.textContent = message;
      // The proof still owns a real saved result after its dialog closes. Keep
      // recovery warnings, naming that lesson without replacing a newer modal.
      report(visible ? message : `${lesson.title}: ${message}`);
    };
    const recorder = run ? getRecorder() : null;
    const identity = run ? companySimulationIdentity(run) : null;
    const pinned = recorder && simulations.get(lesson.missionId)?.has(identity);
    const attempt =
      (run ? attempts.get(run) : null) ??
      createLearningAttempt(
        lesson,
        pinned
          ? {
              attemptId: `bonus-${crypto.randomUUID()}`,
              simulationIdentity: identity,
              seed: run.seed,
            }
          : {},
      );
    // Snapshot the accepted terminal replay before any asynchronous proof work.
    const replay = pinned ? exportReplay(recorder, run) : null;
    const boundary = run ? { tick: run.tick, kind: 'result' } : null;
    workbench?.destroy();
    workbench = mountCompanyWorkbench(content, {
      lesson,
      attempt,
      evidence: { availableRecordIds: lesson.records.map((record) => record.id), boundary },
      onChange: (next) => {
        if (run) attempts.set(run, next);
        if (next.status !== 'complete' || !replay) return;
        if (current()) lessonStatus.textContent = 'Checking this completed bonus before saving…';
        // Each completed lesson owns its captured replay. Opening or finishing
        // another bonus cannot revoke an earlier independently verified result.
        void proofs
          .prove({ attempt: next, replay, signal: lifetime.signal })
          .then((proof) => {
            if (disposed) return;
            const durable = persistWithReport(reportLesson, () => proofs.saveVerified(proof));
            if (!durable)
              reportLesson(
                'The optional bonus is complete in this tab. Export learning records before leaving.',
              );
            else if (current()) lessonStatus.textContent = 'Optional learning record saved.';
          })
          .catch((error) => {
            reportLesson(error.message);
          });
      },
      onClose: () => dialog.close(),
    });
    const title = content.querySelector('h2');
    dialog.setAttribute('aria-labelledby', title.id);
    dialog.showModal();
  }
  button.onclick = () => {
    const run = getRun();
    if (disposed || run?.status !== 'won' || !seen.has(run)) return;
    const lesson = provider.lessons.find((item) => item.missionId === run.levelId);
    if (!lesson) return;
    lessonOpener = button;
    openLesson(lesson, run);
  };
  const section = node('section');
  section.className = 'edition-learning-data';
  section.append(
    node('h3', 'Optional learning records'),
    node('p', 'Learning is a separate bonus. Missions and pictures never depend on completing it.'),
  );
  const download = node('button', 'Export optional learning'),
    upload = node('input');
  download.type = 'button';
  download.className = 'button secondary';
  const label = node('label', 'Import matching learning records');
  upload.type = 'file';
  upload.accept = 'application/json,.json';
  label.append(upload);
  section.append(download, label, dataStatus);
  doc.getElementById('settings-panel-data').append(section);
  download.onclick = () => {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify({
            format: 'revealline-edition-learning-backup.v1',
            editionId: provider.editionId,
            proofs: proofs.exportProofs(),
            recovery: proofs.exportRecovery(),
          }),
        ],
        { type: 'application/json' },
      ),
    );
    const link = node('a');
    link.href = url;
    link.download = `${provider.editionId}-learning.json`;
    link.click();
    win.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  upload.onchange = async () => {
    if (disposed) return;
    importRequest?.abort();
    const request = new AbortController();
    importRequest = request;
    const current = () => !disposed && importRequest === request && !request.signal.aborted;
    try {
      dataStatus.textContent = '';
      const file = upload.files?.[0];
      if (!file) return;
      dataStatus.textContent = 'Checking learning records…';
      required(file.size <= 48 * 1024 * 1024, 'Learning backup is too large.');
      const text = await file.text();
      if (!current()) return;
      const backup = boundedJSON(text, {
        maxBytes: 48 * 1024 * 1024,
        maxString: 8 * 1024 * 1024,
        maxNodes: 4000000,
        maxArray: 216000,
        maxDepth: 40,
      });
      required(
        backup.format === 'revealline-edition-learning-backup.v1' &&
          backup.editionId === provider.editionId,
        'This learning backup belongs to another edition.',
      );
      const recovery = proofs.inspectRecovery(backup.recovery);
      const checked = await proofs.inspectProofs(backup.proofs, { signal: request.signal });
      if (!current()) return;
      required(writer.writable, writer.reason || 'This tab cannot write learning records.');
      const durable = persistWithReport(reportData, () => {
        proofs.importRecovery(recovery);
        return proofs.importVerified(checked);
      });
      reportData(
        durable
          ? 'Optional learning records imported.'
          : 'Learning records are available in this tab. Export them before leaving.',
      );
    } catch (error) {
      if (current()) reportData(error.message);
    } finally {
      if (current()) {
        upload.value = '';
        importRequest = null;
      }
    }
  };
  return {
    pictureReady(record) {
      if (disposed || record.editionId !== provider.editionId) return null;
      const lesson = provider.lessons.find((entry) => entry.missionId === record.missionId);
      if (!lesson) return null;
      const revisit = node('button', 'Optional bonus · revisit this connection');
      revisit.type = 'button';
      revisit.className = 'button secondary';
      revisit.onclick = () => {
        lessonOpener = revisit;
        openLesson(lesson);
      };
      return revisit;
    },
    refresh() {
      const run = getRun();
      if (run?.status === 'won' && getPictureVisible()) seen.add(run);
      const visible =
        !!run &&
        run.status === 'won' &&
        seen.has(run) &&
        provider.lessons.some((lesson) => lesson.missionId === run.levelId);
      if (button.hidden === visible) button.hidden = !visible;
    },
    dispose() {
      disposed = true;
      lifetime.abort();
      importRequest?.abort();
      workbench?.destroy();
      dialog.removeEventListener('close', close);
      button.remove();
      dialog.remove();
      section.remove();
    },
  };
}
