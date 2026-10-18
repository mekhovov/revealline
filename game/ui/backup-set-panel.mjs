import { t, localizedText, localizedMessage } from '../i18n/index.mjs';
import { createOperationStatus } from './operation-status.mjs';
import { prepareBackupSet } from '../backup-set.mjs';
import { prepareBackupArchive } from '../backup-archive.mjs';
import { attachBackupArchiveReview } from './backup-archive-review.mjs';

const PURPOSES = {
  game: 'game data',
  media: 'pictures',
  story: 'stories',
  audio: 'music',
  coverage: 'coverage report',
};

/** Uses the existing Library dialog and native links. Owns only its operation
 * and Blob URLs, never the borrowed game/media adapters or profile writer. */
export function attachBackupSetPanel({
  document,
  dialog,
  root,
  source,
  busy,
  setBusy,
  refresh,
  presentFeedback = () => {},
  URLImpl = URL,
}) {
  const node = (tag, id, text) => {
    const element = document.createElement(tag);
    element.id = id;
    localizedText(element, () => text);
    return element;
  };
  const prepareArchive = node(
      'button',
      'prepare-backup-archive',
      localizedMessage('interface:backupArchive.prepare'),
    ),
    archiveHelp = node(
      'p',
      'backup-archive-help',
      localizedMessage('interface:backupArchive.help'),
    ),
    prepare = node(
      'button',
      'prepare-backup-set',
      localizedMessage('interface:prepareGameAndOriginalsBackup'),
    ),
    cancelButton = node(
      'button',
      'cancel-backup-set',
      localizedMessage('common:actions.cancelPreparation'),
    ),
    status = node(
      'p',
      'backup-set-status',
      localizedMessage('interface:prepareSeparateGameDataPictureStoryAndSavedMusicFiles'),
    ),
    list = node('ul', 'backup-set-files', ''),
    filenames = node('details', 'backup-set-filenames', ''),
    filenameSummary = node(
      'summary',
      'backup-set-filename-summary',
      localizedMessage('interface:fileNames'),
    ),
    filenameList = node('dl', 'backup-set-filename-list', '');
  prepareArchive.type = prepare.type = cancelButton.type = 'button';
  prepareArchive.className = 'button primary';
  prepareArchive.setAttribute('aria-describedby', archiveHelp.id);
  prepare.className = 'button primary';
  cancelButton.className = 'button secondary';
  cancelButton.hidden = true;
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  filenames.hidden = true;
  filenames.open = false;
  filenames.append(filenameSummary, filenameList);
  root.append(prepareArchive, archiveHelp, prepare, cancelButton, status, list, filenames);
  const presenter = createOperationStatus(status);
  const showStatus = (message, state = 'ready') =>
    presenter.begin({ message }).finish({ message, state });
  showStatus(t('interface:prepareSeparateGameDataPictureStoryAndSavedMusicFiles'));
  let operation = null,
    prepared = null;
  const urls = new Set();
  function release() {
    for (const url of urls) URLImpl.revokeObjectURL(url);
    urls.clear();
    prepared = null;
    list.replaceChildren();
    filenameList.replaceChildren();
    filenames.open = false;
    filenames.hidden = true;
  }
  function finish(op) {
    if (operation !== op) return false;
    const hadCancelFocus = document.activeElement === cancelButton;
    operation = null;
    cancelButton.hidden = true;
    for (const [element, disabled] of op.controls)
      if (element.isConnected) element.disabled = disabled;
    setBusy(false);
    refresh();
    return hadCancelFocus;
  }
  function cancel({
    focus = true,
    message = t('interface:preparationCancelledYourDataIsUnchanged'),
  } = {}) {
    const op = operation,
      returnTo = op?.opener ?? (prepared?.archiveReport ? prepareArchive : prepare);
    if (!op && !prepared) return false;
    if (op) {
      op.controller.abort();
      op.restoreFocus = focus;
    }
    release();
    showStatus(message, op ? 'cancelled' : 'ready');
    if (!op && focus && dialog.open && !document.hidden) returnTo.focus({ preventScroll: true });
    return true;
  }
  function checkCurrent() {
    if (!prepared) return;
    try {
      prepared.assertGameCurrent();
    } catch {
      cancel({ message: t('interface:gameDataChangedPrepareTheBackupSetAgain') });
    }
  }
  const archiveScope = (result) =>
    t('interface:backupArchive.scope', {
      journey: t(`interface:backupArchive.journey.${result.archiveReport.journey}`),
    }) +
    (result.archiveReport.gameData === 'excluded-authored'
      ? ' ' + t('interface:backupArchive.authoredExclusions')
      : '') +
    (result.coverage.detachedStories.length || result.coverage.referenceOnlyMusic?.length
      ? ' ' + t('interface:backupArchive.incompleteOriginals')
      : '');
  async function prepareFiles(archive) {
    if (busy() || !dialog.open || !root.getClientRects().length) return false;
    archiveReview.invalidate({ quiet: true });
    release();
    const op = {
      opener: archive ? prepareArchive : prepare,
      controller: new AbortController(),
      controls: [...dialog.querySelectorAll('button,input,select,textarea')].map((element) => [
        element,
        element.disabled,
      ]),
    };
    operation = op;
    presentFeedback();
    op.lease = presenter.begin({
      message: t('interface:readingSavedInventoriesForTheBackupSet'),
      isCurrent: () => operation === op && !op.controller.signal.aborted,
    });
    setBusy(true);
    for (const [element] of op.controls) {
      // The existing Close button stays usable while asynchronous reads settle.
      if (!element.hasAttribute('data-close')) element.disabled = true;
    }
    cancelButton.hidden = false;
    cancelButton.disabled = false;
    cancelButton.focus({ preventScroll: true });
    try {
      const result = await (archive ? prepareBackupArchive : prepareBackupSet)(source, {
        signal: op.controller.signal,
        onProgress: (text) => {
          op.lease.update({ message: text });
        },
      });
      if (operation !== op || !dialog.open || op.controller.signal.aborted) return false;
      result.assertGameCurrent();
      prepared = result;
      for (const file of result.files) {
        const row = node('li', `backup-set-${file.id}`, ''),
          link = node(
            'a',
            `download-backup-${file.id}`,
            archive
              ? localizedMessage('interface:backupArchive.download')
              : `Download ${PURPOSES[file.id]}`,
          ),
          state = node(
            'span',
            `backup-set-state-${file.id}`,
            archive
              ? localizedMessage('interface:backupArchive.preparedBytes', { bytes: file.bytes })
              : `Prepared · ${file.bytes} bytes`,
          ),
          url = URLImpl.createObjectURL(file.blob);
        urls.add(url);
        link.href = url;
        link.download = file.filename;
        link.className = 'button secondary';
        link.setAttribute('aria-describedby', state.id);
        link.onclick = (event) => {
          if (prepared !== result || !dialog.open || busy()) {
            event?.preventDefault();
            return false;
          }
          try {
            result.assertGameCurrent();
          } catch (error) {
            event?.preventDefault();
            cancel({ message: error.message });
            return false;
          }
          presentFeedback();
          localizedText(state, () =>
            archive
              ? t('interface:backupArchive.requestedBytes', { bytes: file.bytes })
              : `Download requested · ${file.bytes} bytes`,
          );
          showStatus(
            archive
              ? () => t('interface:backupArchive.requested') + ' ' + archiveScope(result)
              : 'Download requested. Check your browser destination; this does not confirm a disk write. Keep this five-file set in a separate folder with the shown filenames. Prepared files remain available to retry.' +
                  (result.coverage.musicRecoveryNotice
                    ? ` ${result.coverage.musicRecoveryNotice}`
                    : ''),
          );
          return true; // Native default action, no async or synthetic click.
        };
        row.append(link, state);
        list.append(row);
        filenameList.append(
          node('dt', `backup-set-purpose-${file.id}`, link.textContent),
          node('dd', `backup-set-filename-${file.id}`, file.filename),
        );
      }
      filenames.hidden = false;
      showStatus(
        archive
          ? () =>
              t('interface:backupArchive.prepared', { count: result.archiveReport.files.length }) +
              ' ' +
              archiveScope(result)
          : result.coverage.musicRecoveryNotice
            ? `Prepared music recovery references. ${result.coverage.musicRecoveryNotice}${result.coverage.detachedStories.length ? ` ${result.coverage.detachedStories.length} detached story original(s) are also unavailable.` : ''} Read the coverage report. No file has been saved to disk.`
            : result.coverage.detachedStories.length
              ? `Prepared an incomplete set: ${result.coverage.detachedStories.length} detached story original(s) are unavailable. Read the coverage report. No file has been saved to disk.`
              : t('interface:preparedAllFourSavedInventoriesAndTheirCoverageReportDownload'),
      );
      const hadCancelFocus = finish(op);
      if (!document.hidden && document.hasFocus?.() !== false && hadCancelFocus)
        list.querySelector('a')?.focus({ preventScroll: true });
      return true;
    } catch (error) {
      if (operation === op && !op.controller.signal.aborted) {
        release();
        showStatus(`Backup set was not prepared: ${error.message}`, 'error');
      }
      return false;
    } finally {
      if (operation === op) {
        const hadCancelFocus = finish(op);
        if (
          op.restoreFocus !== false &&
          dialog.open &&
          !document.hidden &&
          document.hasFocus?.() !== false &&
          hadCancelFocus
        )
          op.opener.focus({ preventScroll: true });
      }
    }
  }
  prepare.onclick = () => prepareFiles(false);
  prepareArchive.onclick = () => prepareFiles(true);
  const archiveReview = attachBackupArchiveReview({
    document,
    dialog,
    root,
    edition: source.edition,
    busy,
    setBusy,
    refresh,
    presenter,
    showStatus,
    cancelButton,
    presentFeedback,
    onStart: release,
    URLImpl,
  });
  cancelButton.onclick = () => archiveReview.cancelPending() || cancel();
  dialog.addEventListener('close', () => {
    if (!dialog.open) cancel({ focus: false });
  });
  globalThis.addEventListener?.('pagehide', (event) => {
    if (!event.persisted || operation || !prepared?.archiveReport) cancel({ focus: false });
  });
  document.addEventListener('visibilitychange', () => {
    // A prepared ZIP remains available across a Files-app round trip. Its native
    // link rechecks ownership before every activation; close/unload still releases it.
    if (document.hidden && (operation || !prepared?.archiveReport)) cancel({ focus: false });
  });
  return {
    cancel: () => {
      if (archiveReview.cancelPending()) return true;
      if (operation) return cancel();
      if (!dialog.open || filenames.hidden || !filenames.open || !root.getClientRects().length)
        return false;
      // Both native dialog cancellation and controller Back use the Library's
      // existing cancellation seam. Consume this level without releasing files.
      filenames.open = false;
      if (!document.hidden) filenameSummary.focus({ preventScroll: true });
      return true;
    },
    invalidate: () => {
      const cancelled = cancel({ focus: false });
      return archiveReview.invalidate() || cancelled;
    },
    checkCurrent,
  };
}
