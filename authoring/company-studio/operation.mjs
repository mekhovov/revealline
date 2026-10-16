import { setMenuIcon } from '../../game/ui/native-menu-icons.mjs';

/** One bounded page operation. The shared authoring host owns this real dialog. */
export function createCompanyOperation({ document: doc, getContext, onCancel = () => {} }) {
  const win = doc.defaultView,
    dialog = doc.createElement('dialog'),
    title = doc.createElement('h2'),
    message = doc.createElement('p'),
    cancel = doc.createElement('button'),
    confirm = doc.createElement('button');
  dialog.id = 'company-operation';
  title.id = 'company-operation-title';
  dialog.setAttribute('aria-labelledby', title.id);
  message.setAttribute('role', 'status');
  cancel.id = 'company-operation-cancel';
  confirm.id = 'company-operation-confirm';
  cancel.type = confirm.type = 'button';
  cancel.textContent = 'Cancel';
  confirm.textContent = 'Replace current draft';
  setMenuIcon(cancel, 'back');
  setMenuIcon(confirm, 'play');
  dialog.append(title, message, cancel, confirm);
  doc.body.append(dialog);
  let owner = null,
    disposed = false;
  const foreground = () => !doc.hidden && doc.hasFocus?.() !== false;
  const visible = (node) =>
    node?.isConnected &&
    !node.disabled &&
    !node.closest('[hidden],[inert],details:not([open])') &&
    node.getClientRects().length > 0;
  const same = (a, b) =>
    a.catalog === b.catalog && a.files === b.files && a.signature === b.signature;
  const ownsFocus = (operation) =>
    owner === operation && foreground() && dialog.contains(doc.activeElement);
  const close = (operation, target = operation.opener, restore = true) => {
    if (owner !== operation) return;
    const owned = ownsFocus(operation);
    owner = null;
    if (dialog.open) dialog.close();
    if (
      restore &&
      owned &&
      foreground() &&
      visible(target) &&
      (!doc.activeElement ||
        doc.activeElement === doc.body ||
        doc.activeElement === operation.opener ||
        dialog.contains(doc.activeElement))
    ) {
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'nearest' });
    }
  };
  const abort = ({ restore = false, announce = false } = {}) => {
    const operation = owner;
    if (!operation) return;
    const owned = ownsFocus(operation);
    operation.controller.abort();
    operation.approve?.(false);
    close(operation, operation.opener, restore);
    if (announce && owned) onCancel();
  };
  cancel.onclick = () => abort({ restore: true, announce: true });
  const cancelled = (event) => {
    event.preventDefault();
    abort({ restore: true, announce: true });
  };
  dialog.addEventListener('cancel', cancelled);
  const focus = (event) => {
    if (owner && event.target !== doc.body && !dialog.contains(event.target)) abort();
  };
  const blur = (event) => {
    if (event.target === win) abort();
  };
  const hidden = () => {
    if (doc.hidden) abort();
  };
  const pagehide = () => abort();
  doc.addEventListener('focusin', focus);
  doc.addEventListener('visibilitychange', hidden);
  win.addEventListener('blur', blur, true);
  win.addEventListener('pagehide', pagehide);
  return {
    cancel: abort,
    async run({ label, prepare, commit, replacement = false, successFocus = null }) {
      if (disposed || !foreground()) return;
      abort();
      const operation = {
        controller: new AbortController(),
        context: getContext(),
        opener: doc.activeElement,
        approve: null,
      };
      owner = operation;
      const current = () =>
        owner === operation &&
        !operation.controller.signal.aborted &&
        foreground() &&
        same(operation.context, getContext());
      title.textContent = label;
      message.textContent = 'Working on the captured source. Cancel keeps the current draft.';
      confirm.hidden = true;
      dialog.showModal();
      cancel.focus();
      let succeeded = false,
        committing = false;
      try {
        const result = await prepare(operation.controller.signal);
        if (!current()) return;
        if (replacement) {
          message.textContent =
            'Replace the current applied draft and unapplied editor/form changes with this validated source? Nothing is saved persistently.';
          confirm.hidden = false;
          const accepted = await new Promise((resolve) => {
            operation.approve = resolve;
            confirm.onclick = () => {
              if (!current() || doc.activeElement !== confirm) return abort({ restore: true });
              resolve(true);
            };
          });
          operation.approve = null;
          if (owner === operation) confirm.onclick = null;
          if (!accepted || !current()) return;
          confirm.hidden = true;
          cancel.focus();
        }
        // Prepared data is committed synchronously; no asynchronous mutation tail.
        committing = true;
        commit(result);
        succeeded = true;
      } catch (error) {
        if (
          error.name !== 'AbortError' &&
          (current() ||
            (committing &&
              owner === operation &&
              foreground() &&
              !operation.controller.signal.aborted))
        )
          throw error;
      } finally {
        operation.controller.abort();
        if (owner === operation) confirm.onclick = null;
        close(operation, (succeeded && successFocus?.()) || operation.opener);
      }
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      abort();
      dialog.removeEventListener('cancel', cancelled);
      doc.removeEventListener('focusin', focus);
      doc.removeEventListener('visibilitychange', hidden);
      win.removeEventListener('blur', blur, true);
      win.removeEventListener('pagehide', pagehide);
      cancel.onclick = confirm.onclick = null;
      dialog.remove();
    },
  };
}
