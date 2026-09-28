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
import { getLocale, onLocaleChange, t } from '../i18n/index.mjs';
import { localizeCompanyLesson } from '../company-campaigns/lesson-localization.mjs';

const STATUS_KEYS = [
  'earlierRevision',
  'checkingBonus',
  'sessionComplete',
  'saved',
  'checkingRecords',
  'tooLarge',
  'foreignEdition',
  'sessionOnly',
  'cannotWrite',
  'imported',
  'importedSession',
];

/** A result-only bonus. This module cannot select a mission, award an arcade
 * clear, change a run, or control the availability of Next. */
export async function mountEditionLessons({
  provider,
  document: doc,
  window: win,
  writer,
  previewSession = null,
  getRun,
  getRecorder,
  getPictureVisible,
  report,
}) {
  if (!provider.lessons.length)
    return {
      rewardEvidence: () => EMPTY_REWARD_EVIDENCE,
      onRewardEvidenceChange: () => () => {},
      refresh() {},
      pictureReady() {
        return null;
      },
      dispose() {},
    };
  const tr = (key, values) => t('interface:learningBonus.' + key, values);
  // Only this host's known messages are translated. External storage/proof
  // diagnostics retain their exact information and never enter saved evidence.
  const localizeStatus = (message) => {
    const key = STATUS_KEYS.find((entry) =>
      ['en', 'uk'].some((lng) => tr(entry, { lng }) === message),
    );
    return key ? tr(key) : message;
  };
  const statusMessages = new Map();
  const showStatus = (element, message) => {
    statusMessages.set(element, message);
    element.textContent = localizeStatus(message);
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
    showStatus(dataStatus, message);
    report(localizeStatus(message));
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
    getStorage: () => previewSession?.storage ?? win.localStorage ?? globalThis.localStorage,
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
  const hydration = await proofs.hydrate({ signal: lifetime.signal });
  if (hydration.rejected)
    reportData(
      'Earlier learning records need their matching revision. They remain available in the learning backup.',
    );
  const button = node('button', tr('open'));
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
    showStatus(lessonStatus, '');
    const current = () => !disposed && lessonVisit === visit && dialog.open;
    const reportLesson = (message) => {
      if (disposed) return;
      const visible = current();
      if (visible) showStatus(lessonStatus, message);
      // The proof still owns a real saved result after its dialog closes. Keep
      // recovery warnings, naming that lesson without replacing a newer modal.
      const rendered = localizeStatus(message);
      report(
        visible ? rendered : `${localizeCompanyLesson(lesson, getLocale()).title}: ${rendered}`,
      );
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
        if (current()) showStatus(lessonStatus, tr('checkingBonus'));
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
            else if (current()) showStatus(lessonStatus, tr('saved'));
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
  const heading = node('h3', tr('recordsTitle')),
    note = node('p', tr('recordsNote'));
  section.append(heading, note);
  const download = node('button', tr('export')),
    upload = node('input');
  download.type = 'button';
  download.className = 'button secondary';
  const label = node('label'),
    labelText = node('span', tr('import'));
  upload.type = 'file';
  upload.accept = 'application/json,.json';
  label.append(labelText, upload);
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
      showStatus(dataStatus, '');
      const file = upload.files?.[0];
      if (!file) return;
      showStatus(dataStatus, tr('checkingRecords'));
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
  const stopLocale = onLocaleChange(() => {
    if (disposed) return;
    // Update existing nodes in place: focused controls, pending file reads and
    // the workbench's canonical attempt remain owned by their existing hosts.
    button.textContent = tr('open');
    heading.textContent = tr('recordsTitle');
    note.textContent = tr('recordsNote');
    download.textContent = tr('export');
    labelText.textContent = tr('import');
    for (const revisit of doc.querySelectorAll('[data-edition-learning-revisit]'))
      revisit.textContent = tr('revisit');
    for (const [element, message] of statusMessages) element.textContent = localizeStatus(message);
  });
  return {
    rewardEvidence: proofs.rewardEvidence,
    onRewardEvidenceChange: proofs.onRewardEvidenceChange,
    pictureReady(record) {
      if (disposed || record.editionId !== provider.editionId) return null;
      const lesson = provider.lessons.find((entry) => entry.missionId === record.missionId);
      if (!lesson) return null;
      const revisit = node('button', tr('revisit'));
      revisit.setAttribute('data-edition-learning-revisit', '');
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
      stopLocale();
      statusMessages.clear();
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

const EMPTY_REWARD_EVIDENCE = Object.freeze({
  revision: 0,
  learning: Object.freeze([]),
  durableLearning: Object.freeze([]),
});
