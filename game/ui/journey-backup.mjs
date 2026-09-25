import { t, localizedText, localizedMessage } from '../i18n/index.mjs';
import { JOURNEY_MODES } from '../journey/catalog.mjs';
import { exportJSONFile } from '../platform.mjs';

/** Optional recovery surface. It never launches a mission or changes a live run. */
export function attachJourneyBackup({
  document: doc = globalThis.document,
  profile,
  onRestore = () => {},
  exportFile = exportJSONFile,
}) {
  const element = (tag, text, id) => {
    const node = doc.createElement(tag);
    if (text) localizedText(node, () =>text);
    if (id) node.id = id;
    return node;
  };
  const dialog = element('dialog', '', 'journey-backup');
  dialog.className = 'journey-backup';
  dialog.setAttribute('aria-labelledby', 'journey-backup-title');
  const title = element('h2', localizedMessage("interface:keepYourJourney"), 'journey-backup-title');
  const copy = element(
    'p',
    'Export a local backup or inspect one before restoring. Restore adds missing progress; current clears and Continue positions win. It includes earned-picture references, not image bytes. Keep the matching game edition to view those originals. It never replaces this attempt, awards scores or unlocks content.',
  );
  const exportButton = element('button', localizedMessage("interface:exportProgress"), 'journey-backup-export');
  const label = element('label', localizedMessage("interface:inspectJourneyBackup"));
  const input = element('input', '', 'journey-backup-file');
  input.type = 'file';
  input.accept = 'application/json,.json';
  label.append(input);
  const status = element(
    'p',
    localizedMessage("interface:chooseABackupToInspectNothingIsRestoredAutomatically"),
    'journey-backup-status',
  );
  status.setAttribute('role', 'status');
  const apply = element('button', localizedMessage("interface:restoreInspectedProgress"), 'journey-backup-apply');
  const back = element('button', localizedMessage("interface:backToMissions"), 'journey-backup-back');
  for (const button of [exportButton, apply, back]) {
    button.type = 'button';
    button.className = 'button secondary';
  }
  apply.disabled = true;
  const content = element('div');
  content.className = 'journey-backup-content';
  content.append(copy, exportButton, label, status);
  const actions = element('div');
  actions.className = 'journey-backup-actions';
  actions.append(apply, back);
  dialog.append(title, content, actions);
  doc.body.append(dialog);
  let revision = 0,
    inspected = null,
    opener = null;
  function reset() {
    revision++;
    inspected = null;
    input.value = '';
    apply.disabled = true;
  }
  function close() {
    reset();
    dialog.close();
    opener?.focus({ preventScroll: true });
  }
  input.onchange = async () => {
    const file = input.files?.[0],
      ticket = ++revision;
    inspected = null;
    apply.disabled = true;
    if (!file) {
      localizedText(status, () =>t("interface:noBackupSelectedProgressIsUnchanged"));
      return;
    }
    try {
      if (file.size > 16 * 1024 * 1024) throw new Error('Backup exceeds the 16 MiB file limit.');
      localizedText(status, () => t("interface:inspectingTheLocalBackup"));
      const { backup, merged, pictures } = profile.inspectBackup(await file.text());
      const addedPictures = pictures
        ? pictures.records.length - (profile.pictures?.().records.length ?? 0)
        : 0;
      if (ticket !== revision) return;
      const current = profile.snapshot();
      const counts = JOURNEY_MODES.map((mode) => {
        const added =
          Object.keys(merged.clears[mode]).length - Object.keys(current.clears[mode]).length;
        const skips = merged.skipped[mode].filter(
          (id) => !current.skipped[mode].includes(id),
        ).length;
        const conflicts = Object.entries(backup.profile.clears[mode]).filter(
          ([id, receipt]) =>
            Object.hasOwn(current.clears[mode], id) &&
            JSON.stringify(current.clears[mode][id]) !== JSON.stringify(receipt),
        ).length;
        return `${mode}: ${added} missing clears, ${skips} missing skips, ${conflicts} receipt conflicts kept as current`;
      });
      inspected = backup;
      apply.disabled = false;
      localizedText(
        status,
        () =>
          `${counts.join('. ')}. ${addedPictures} earned-picture references added; image bytes are not included. Existing Continue positions are kept; an empty position may be restored. Unknown mission IDs are retained for other editions. Restore is still required.`,
      );
    } catch (error) {
      if (ticket === revision)
        localizedText(status, () =>`Cannot inspect: ${error.message} Progress is unchanged.`);
    }
  };
  apply.onclick = async () => {
    if (!inspected) return;
    const backup = inspected,
      ticket = revision;
    inspected = null;
    // Disabling the focused action drops native keyboard focus to the page.
    // Hand it off only during this deliberate activation, never after saving.
    if (dialog.open && doc.activeElement === apply) back.focus();
    apply.disabled = true;
    try {
      profile.restore(backup);
      onRestore();
      const durable = await profile.flush();
      if (ticket !== revision) return;
      localizedText(status, () =>durable
        ? t("interface:mergedAndSavedLocallyCurrentAttemptAndExistingProgressAre")
        : t("interface:mergedInThisSessionOnlyStorageFailedExportNowOr"));
    } catch (error) {
      if (ticket === revision)
        localizedText(status, () =>`Restore failed: ${error.message}. Existing progress is retained.`);
    }
  };
  exportButton.onclick = async () => {
    const ticket = revision;
    try {
      const result = await exportFile(JSON.parse(profile.export()), profile.backupFilename);
      if (ticket === revision) localizedText(status, () =>result.message);
    } catch (error) {
      if (ticket === revision)
        localizedText(status, () =>`Export failed: ${error.message}. Your progress remains in this session.`);
    }
  };
  back.onclick = close;
  dialog.addEventListener('cancel', (event) => {
    if (event.target === dialog) {
      event.preventDefault();
      close();
    }
  });
  return {
    open(origin = doc.activeElement) {
      reset();
      opener = origin;
      localizedText(status, () =>t("interface:chooseABackupToInspectNothingIsRestoredAutomatically"));
      dialog.showModal();
      exportButton.focus({ preventScroll: true });
    },
    close,
  };
}
