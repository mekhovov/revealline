import { t, localizedText } from '../i18n/index.mjs';
import { inspectBackupArchive } from '../backup-archive-inspection.mjs';

const order = ['media', 'story', 'audio', 'game', 'journey'];
const copy = (key, values) => t(`interface:backupReview.${key}`, values);

/** Read-only ZIP inspection and native component downloads. The Library lends
 * its single operation slot/status; existing import owners remain independent. */
export function attachBackupArchiveReview({
  document: doc,
  dialog,
  root,
  edition,
  busy,
  setBusy,
  refresh,
  presenter,
  showStatus,
  cancelButton,
  presentFeedback,
  onStart,
  URLImpl = URL,
  inspect = inspectBackupArchive,
}) {
  const node = (tag, id, text) => {
    const element = doc.createElement(tag);
    if (id) element.id = `backup-review-${id}`;
    if (text) localizedText(element, text);
    return element;
  };
  const section = node('section', 'section'),
    heading = node('h3', 'title', () => copy('title')),
    help = node('p', 'help', () => copy('help')),
    label = node('label', 'label'),
    input = node('input', 'file'),
    button = node('button', 'inspect', () => copy('inspect')),
    results = node('div', 'results');
  input.type = 'file';
  input.accept = '.zip,application/zip';
  input.setAttribute('aria-describedby', help.id);
  label.append(
    node('span', null, () => copy('choose')),
    input,
  );
  button.type = 'button';
  button.className = 'button secondary';
  results.hidden = true;
  section.setAttribute('aria-labelledby', heading.id);
  section.append(heading, help, label, button, results);
  root.append(section);
  let operation = null,
    reviewed = null;
  const urls = new Set();
  function release() {
    for (const url of urls) URLImpl.revokeObjectURL(url);
    urls.clear();
    reviewed = null;
    results.replaceChildren();
    results.hidden = true;
  }
  function finish(op) {
    if (operation !== op) return false;
    const hadFocus = doc.activeElement === cancelButton;
    operation = null;
    cancelButton.hidden = true;
    for (const [element, disabled] of op.controls)
      if (element.isConnected) element.disabled = disabled;
    setBusy(false);
    refresh();
    return hadFocus;
  }
  function invalidate({ focus = false, quiet = false } = {}) {
    const owned = !!operation || !!reviewed;
    if (operation) {
      operation.controller.abort();
      operation.restoreFocus = focus;
    }
    release();
    input.value = '';
    if (owned && !quiet) showStatus(() => copy('cleared'), operation ? 'cancelled' : 'ready');
    if (!operation && owned && focus && dialog.open && !doc.hidden)
      button.focus({ preventScroll: true });
    return owned;
  }
  function fileLink(file, owner, text) {
    const link = node('a', `download-${file.id ?? file.filename.replace(/\./g, '-')}`, text),
      state = node('p', null, () => copy('checkedFile', { bytes: file.bytes })),
      url = URLImpl.createObjectURL(file.blob);
    urls.add(url);
    link.href = url;
    link.download = file.filename;
    link.className = 'button secondary';
    link.onclick = (event) => {
      if (reviewed !== owner || !dialog.open || busy() || input.files?.[0] !== owner.file) {
        event?.preventDefault();
        return false;
      }
      presentFeedback();
      localizedText(state, () => copy('requestedFile'));
      showStatus(() => copy('requested'));
      return true;
    };
    const name = node('p', null, () => file.filename);
    name.style.overflowWrap = 'anywhere';
    return [link, state, name];
  }
  function render(owner) {
    const { manifest, files, instructions } = owner.inspection;
    const summary = node('p', null, () =>
      copy('summary', {
        count: files.length,
        version: manifest.edition.version,
        channel: manifest.edition.channel,
      }),
    );
    results.append(
      summary,
      node('p', null, () => copy('notRestored')),
    );
    if (
      manifest.edition.version !== edition.version ||
      manifest.edition.channel !== edition.channel
    )
      results.append(node('p', null, () => copy('differentEdition')));
    if (manifest.gameData === 'excluded-authored')
      results.append(node('p', null, () => t('interface:backupArchive.authoredExclusions')));
    results.append(
      node('p', null, () =>
        t('interface:backupArchive.scope', {
          journey: t(`interface:backupArchive.journey.${manifest.journey}`),
        }),
      ),
    );
    results.append(node('h4', null, () => copy('exclusions')));
    const exclusions = node('ul');
    for (const message of manifest.exclusions) exclusions.append(node('li', null, () => message));
    results.append(
      exclusions,
      node('h4', null, () => copy('order')),
    );
    const steps = node('ol');
    for (const id of order) {
      const file = files.find((item) => item.id === id);
      if (!file) continue;
      const row = node('li', `step-${id}`);
      row.append(
        node('h4', null, () => copy(`name.${id}`)),
        node('p', null, () => copy(`step.${id}`)),
        ...fileLink(file, owner, () => copy('download', { name: copy(`name.${id}`) })),
      );
      steps.append(row);
    }
    results.append(
      steps,
      node('h4', null, () => copy('reports')),
    );
    const reports = node('ul');
    for (const file of [files.find((item) => item.id === 'coverage'), ...instructions]) {
      const row = node('li');
      row.append(...fileLink(file, owner, () => copy('downloadReport', { name: file.filename })));
      reports.append(row);
    }
    results.append(reports);
    results.hidden = false;
  }
  button.onclick = async () => {
    if (busy() || !dialog.open || !section.getClientRects().length) return false;
    release();
    const file = input.files?.[0];
    if (!file) {
      presentFeedback();
      showStatus(() => copy('noFile'), 'error');
      input.focus();
      return false;
    }
    onStart();
    const op = {
      file,
      controller: new AbortController(),
      controls: [...dialog.querySelectorAll('button,input,select,textarea')].map((element) => [
        element,
        element.disabled,
      ]),
    };
    operation = op;
    presentFeedback();
    const lease = presenter.begin({
      message: copy('checking'),
      isCurrent: () => operation === op && !op.controller.signal.aborted,
    });
    setBusy(true);
    for (const [element] of op.controls)
      if (!element.hasAttribute('data-close')) element.disabled = true;
    cancelButton.hidden = false;
    cancelButton.disabled = false;
    cancelButton.focus({ preventScroll: true });
    try {
      const inspection = await inspect(file, {
        signal: op.controller.signal,
        onProgress: (progress) => lease.update({ message: copy('checking'), progress }),
      });
      if (
        operation !== op ||
        op.controller.signal.aborted ||
        !dialog.open ||
        input.files?.[0] !== file
      )
        return false;
      reviewed = { file, inspection };
      render(reviewed);
      showStatus(() => copy('ready', { count: inspection.files.length }));
      const hadFocus = finish(op);
      if (hadFocus && !doc.hidden && doc.hasFocus?.() !== false)
        results.querySelector('a')?.focus({ preventScroll: true });
      return true;
    } catch (error) {
      if (operation === op && !op.controller.signal.aborted) {
        release();
        const code = ['unsupported', 'structure', 'manifest', 'size', 'integrity'].includes(
          error.archiveCode,
        )
          ? error.archiveCode
          : 'read';
        showStatus(() => copy(`error.${code}`), 'error');
      }
      return false;
    } finally {
      if (operation === op) {
        const hadFocus = finish(op);
        if (
          hadFocus &&
          op.restoreFocus !== false &&
          dialog.open &&
          !doc.hidden &&
          doc.hasFocus?.() !== false
        )
          button.focus({ preventScroll: true });
      }
    }
  };
  input.onchange = () => {
    operation?.controller.abort();
    release();
    showStatus(() => copy('selectionChanged'));
  };
  dialog.addEventListener('close', () => {
    if (!dialog.open) invalidate();
  });
  globalThis.addEventListener?.('pagehide', (event) => {
    if (!event.persisted || operation) invalidate();
  });
  doc.addEventListener('visibilitychange', () => {
    if (doc.hidden && operation) invalidate();
  });
  return {
    invalidate,
    cancelPending: () => (operation ? invalidate({ focus: true }) : false),
  };
}
