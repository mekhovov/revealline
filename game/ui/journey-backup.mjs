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
    if (text) node.textContent = text;
    if (id) node.id = id;
    return node;
  };
  const dialog = element('dialog', '', 'journey-backup');
  dialog.className = 'journey-backup';
  dialog.setAttribute('aria-labelledby', 'journey-backup-title');
  const title = element('h2', 'Keep your Journey', 'journey-backup-title');
  const copy = element(
    'p',
    'Export a local backup or inspect one before restoring. Restore adds missing progress; current clears and Continue positions win. It never replaces this attempt, awards scores or unlocks content.',
  );
  const exportButton = element('button', 'Export progress', 'journey-backup-export');
  const label = element('label', 'Inspect Journey backup');
  const input = element('input', '', 'journey-backup-file');
  input.type = 'file';
  input.accept = 'application/json,.json';
  label.append(input);
  const status = element(
    'p',
    'Choose a backup to inspect. Nothing is restored automatically.',
    'journey-backup-status',
  );
  status.setAttribute('role', 'status');
  const apply = element('button', 'Restore inspected progress', 'journey-backup-apply');
  const back = element('button', 'Back to missions', 'journey-backup-back');
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
      status.textContent = 'No backup selected. Progress is unchanged.';
      return;
    }
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error('Backup exceeds the 8 MiB file limit.');
      status.textContent = 'Inspecting the local backup…';
      const { backup, merged } = profile.inspectBackup(await file.text());
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
      status.textContent = `${counts.join('. ')}. Existing Continue positions are kept; an empty position may be restored. Unknown mission IDs are retained for other editions. Restore is still required.`;
    } catch (error) {
      if (ticket === revision)
        status.textContent = `Cannot inspect: ${error.message} Progress is unchanged.`;
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
      status.textContent = durable
        ? 'Merged and saved locally. Current attempt and existing progress are unchanged; missing records were added.'
        : 'Merged in this session only. Storage failed; export now or use Retry save. This attempt is unchanged.';
    } catch (error) {
      if (ticket === revision)
        status.textContent = `Restore failed: ${error.message}. Existing progress is retained.`;
    }
  };
  exportButton.onclick = async () => {
    const ticket = revision;
    try {
      const result = await exportFile(JSON.parse(profile.export()), profile.backupFilename);
      if (ticket === revision) status.textContent = result.message;
    } catch (error) {
      if (ticket === revision)
        status.textContent = `Export failed: ${error.message}. Your progress remains in this session.`;
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
      status.textContent = 'Choose a backup to inspect. Nothing is restored automatically.';
      dialog.showModal();
      exportButton.focus({ preventScroll: true });
    },
    close,
  };
}
