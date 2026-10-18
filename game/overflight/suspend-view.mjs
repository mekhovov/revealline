/** A native dialog keeps keyboard/controller focus and confirmation in the
 * existing menu owner. Changing a save or replacing live play is explicit. */
export function createSurvivalSuspendView({
  document: doc,
  text,
  inspect,
  save,
  restore,
  recover,
  canSave,
  onOpen,
}) {
  const el = (tag, key) => {
    const node = doc.createElement(tag);
    if (key) node.dataset.suspendCopy = key;
    return node;
  };
  const opener = el('button', 'suspendOpen');
  opener.type = 'button';
  opener.id = 'overflight-suspend-open';
  const dialog = el('dialog');
  dialog.id = 'overflight-suspend-dialog';
  dialog.className = 'overflight-suspend-dialog';
  const title = el('h2', 'suspendTitle'),
    help = el('p', 'suspendHelp'),
    status = el('p'),
    confirm = el('p'),
    actions = el('div');
  title.id = 'overflight-suspend-title';
  dialog.setAttribute('aria-labelledby', title.id);
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const buttons = Object.fromEntries(
    ['check', 'save', 'restore', 'recover', 'confirm', 'cancel', 'close'].map((name) => {
      const button = el('button');
      button.type = 'button';
      button.dataset.suspendAction = name;
      actions.append(button);
      return [name, button];
    }),
  );
  dialog.append(title, help, status, confirm, actions);
  doc.body.append(dialog);
  let busy = false,
    state = null,
    confirmation = null,
    statusKey = 'suspendChecking',
    detail = '',
    closed = false;
  const paint = () => {
    for (const node of [opener, title, help]) node.textContent = text(node.dataset.suspendCopy);
    status.textContent = `${text(statusKey)}${detail ? ` ${detail}` : ''}`;
    confirm.hidden = !confirmation;
    confirm.textContent = confirmation
      ? text(confirmation === 'save' ? 'suspendReplaceHelp' : 'suspendRestoreHelp')
      : '';
    const phase = state?.phase;
    const pendingResult = phase === 'finishing' || state?.resultPending === true;
    for (const [name, button] of Object.entries(buttons)) {
      button.textContent = text(`suspend${name[0].toUpperCase()}${name.slice(1)}`);
      button.disabled = busy;
      button.hidden =
        name === 'confirm' || name === 'cancel'
          ? !confirmation
          : name !== 'close' && !!confirmation;
    }
    buttons.save.disabled ||= !state || !canSave() || pendingResult;
    buttons.restore.disabled ||= phase !== 'saved' || pendingResult;
    buttons.recover.disabled ||= !pendingResult;
  };
  const work = async (action, success) => {
    if (busy || closed) return;
    busy = true;
    confirmation = null;
    statusKey = 'suspendWorking';
    detail = '';
    paint();
    try {
      state = await action();
      statusKey =
        success ??
        (state.phase === 'finishing' || state.resultPending
          ? 'suspendPendingResult'
          : state.phase === 'saved'
            ? 'suspendAvailable'
            : 'suspendEmpty');
    } catch (error) {
      statusKey = 'suspendFailed';
      detail = error?.playerMessage ?? text('suspendRetryHelp');
    } finally {
      busy = false;
      if (!closed) {
        paint();
        buttons.close.focus({ preventScroll: true });
      }
    }
  };
  const onClick = (event) => {
    const action = event.target?.dataset?.suspendAction;
    if (busy || !action) return;
    if (action === 'close') dialog.close();
    else if (action === 'check') void work(inspect);
    else if (action === 'cancel') {
      confirmation = null;
      paint();
      buttons.close.focus();
    } else if (action === 'save') {
      if (state?.phase === 'saved') {
        confirmation = 'save';
        paint();
        buttons.cancel.focus();
      } else void work(() => save(false), 'suspendSaved');
    } else if (action === 'restore') {
      confirmation = 'restore';
      paint();
      buttons.cancel.focus();
    } else if (action === 'recover') void work(recover, 'suspendRecovered');
    else if (action === 'confirm') {
      if (confirmation === 'save') void work(() => save(true), 'suspendSaved');
      else if (confirmation === 'restore') void work(restore, 'suspendRestored');
    }
  };
  const open = () => {
    onOpen();
    confirmation = null;
    paint();
    dialog.showModal();
    void work(inspect);
  };
  const cancel = (event) => {
    if (busy) event.preventDefault();
  };
  const close = () => {
    confirmation = null;
    opener.focus({ preventScroll: true });
  };
  opener.addEventListener('click', open);
  dialog.addEventListener('click', onClick);
  dialog.addEventListener('cancel', cancel);
  dialog.addEventListener('close', close);
  paint();
  return {
    opener,
    dialog,
    refresh: paint,
    dispose() {
      closed = true;
      opener.removeEventListener('click', open);
      dialog.removeEventListener('click', onClick);
      dialog.removeEventListener('cancel', cancel);
      dialog.removeEventListener('close', close);
      dialog.remove();
      opener.remove();
    },
  };
}
