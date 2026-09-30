import { localizedText, localizedMessage } from '../i18n/index.mjs';
import { setMenuIcon } from '../ui/native-menu-icons.mjs';

/** A synchronous mutation gate with one explicit, snapshot-fenced retry. Editor
 * callbacks keep their existing boolean contract and revalidate on retry. */
export function createSourceDiscardGate({
  document: doc,
  getContext,
  isDirty,
  onStale = () => {},
}) {
  const win = doc.defaultView,
    dialog = doc.createElement('dialog'),
    title = doc.createElement('h2'),
    cancel = doc.createElement('button'),
    confirm = doc.createElement('button');
  dialog.id = 'studio-source-discard';
  dialog.className = 'studio-source-discard';
  title.id = 'studio-source-discard-title';
  dialog.setAttribute('aria-labelledby', title.id);
  localizedText(title, localizedMessage('tools:studio.source.discard'));
  cancel.id = 'studio-source-discard-cancel';
  confirm.id = 'studio-source-discard-confirm';
  cancel.type = confirm.type = 'button';
  localizedText(cancel, localizedMessage('common:actions.cancel'));
  localizedText(confirm, localizedMessage('common:actions.continue'));
  setMenuIcon(cancel, 'back');
  setMenuIcon(confirm, 'play');
  dialog.append(title, cancel, confirm);
  doc.body.append(dialog);
  let pending = null,
    approved = null,
    retry = null,
    disposed = false;
  const foreground = () => !doc.hidden && doc.hasFocus?.() !== false;
  const visible = (node) =>
    node?.isConnected &&
    !node.disabled &&
    !node.closest('[hidden],[inert],details:not([open])') &&
    node.getClientRects().length > 0;
  const equal = (a, b) => a.owner === b.owner && a.signature === b.signature;
  const close = (restore = true) => {
    const owner = pending;
    pending = null;
    const owned = foreground() && dialog.contains(doc.activeElement);
    if (dialog.open) dialog.close();
    if (
      restore &&
      owned &&
      visible(owner?.opener) &&
      foreground() &&
      (!doc.activeElement ||
        doc.activeElement === doc.body ||
        doc.activeElement === owner.opener ||
        dialog.contains(doc.activeElement))
    ) {
      owner.opener.focus({ preventScroll: true });
      if (doc.activeElement === owner.opener) owner.opener.scrollIntoView({ block: 'nearest' });
    }
    return owner;
  };
  function run(action, retryAction) {
    const previous = retry;
    retry = retryAction || (() => run(action));
    try {
      return action();
    } finally {
      retry = previous;
    }
  }
  function allow(explicitRetry) {
    if (!isDirty()) return true;
    const context = getContext();
    if (approved && equal(context, approved.context)) {
      approved = null;
      return true;
    }
    if (disposed || !foreground() || pending) return false;
    const action = explicitRetry || retry;
    if (typeof action !== 'function') return false;
    pending = { context, retry: action, opener: doc.activeElement };
    dialog.showModal();
    cancel.focus();
    return false;
  }
  cancel.onclick = () => close();
  confirm.onclick = () => {
    const owner = pending;
    if (!owner || !dialog.open || !foreground() || doc.activeElement !== confirm) return;
    if (!isDirty() || !equal(owner.context, getContext())) {
      close();
      onStale();
      return;
    }
    close();
    if (!foreground() || !visible(owner.opener) || doc.activeElement !== owner.opener) return;
    approved = owner;
    try {
      owner.retry();
    } finally {
      approved = null;
    }
  };
  const cancelled = (event) => {
    event.preventDefault();
    close();
  };
  const retire = () => close(false);
  const blur = (event) => {
    if (event.target === win) retire();
  };
  const hidden = () => {
    if (doc.hidden) retire();
  };
  const focus = (event) => {
    if (pending && event.target !== doc.body && !dialog.contains(event.target)) retire();
  };
  dialog.addEventListener('cancel', cancelled);
  doc.addEventListener('focusin', focus);
  doc.addEventListener('visibilitychange', hidden);
  win.addEventListener('blur', blur, true);
  win.addEventListener('pagehide', retire);
  return {
    run,
    allow,
    destroy() {
      if (disposed) return;
      disposed = true;
      retire();
      approved = retry = null;
      dialog.removeEventListener('cancel', cancelled);
      doc.removeEventListener('focusin', focus);
      doc.removeEventListener('visibilitychange', hidden);
      win.removeEventListener('blur', blur, true);
      win.removeEventListener('pagehide', retire);
      cancel.onclick = confirm.onclick = null;
      dialog.remove();
    },
  };
}
