import { createOperationStatus } from '../../game/ui/operation-status.mjs';

const cancelled = () => new DOMException('Studio operation cancelled.', 'AbortError');

/** Studio work ownership. The presenter owns text only; this host owns locks and commits. */
export function createStudioOperations({
  target,
  cancelButton,
  setBusy,
  presenter = createOperationStatus(target),
}) {
  let active = null;
  let disposed = false;
  function unlock(owner) {
    if (active !== owner) return;
    active = null;
    cancelButton.hidden = true;
    setBusy(false, { restoreFocus: !owner.detached && !disposed });
  }
  function message(text, kind = '') {
    const result = { message: text, state: kind === 'error' ? 'error' : 'ready' };
    if (active) active.result = result;
    else presenter.begin({ message: text }).finish(result);
    target.dataset.kind = kind;
  }
  function cancel() {
    const owner = active;
    if (!owner) return false;
    if (owner.committing) {
      owner.detached = true;
      owner.lease.finish({
        message:
          'Stopped waiting. The local save is still running; workspace changes stay locked until it finishes.',
        state: 'detached',
      });
      cancelButton.hidden = true;
      return true;
    }
    owner.controller.abort();
    owner.lease.finish({
      message: 'Cancelled. The workspace and pixel edits are unchanged.',
      state: 'cancelled',
    });
    unlock(owner);
    return true;
  }
  cancelButton.onclick = cancel;
  return {
    message,
    cancel,
    get busy() {
      return !!active;
    },
    async run(label, fn) {
      if (active || disposed) return;
      const owner = {
        controller: new AbortController(),
        committing: false,
        detached: false,
        result: null,
      };
      active = owner;
      target.dataset.kind = '';
      owner.lease = presenter.begin({
        message: label,
        isCurrent: () => active === owner && !disposed,
      });
      cancelButton.textContent = 'Cancel';
      cancelButton.hidden = false;
      setBusy(true);
      const check = () => {
        if (active !== owner || disposed || owner.controller.signal.aborted) throw cancelled();
      };
      const task = {
        signal: owner.controller.signal,
        check,
        update(message, stage = 'preparing') {
          check();
          if (!owner.detached) owner.lease.update({ message, stage });
        },
        commit(message = 'Verifying and saving the local revision…') {
          check();
          owner.committing = true;
          owner.lease.update({ message, stage: 'saving' });
          cancelButton.textContent = 'Stop waiting';
        },
      };
      try {
        await fn(task);
        check();
        owner.lease.finish(
          owner.result || { message: 'Studio operation complete.', state: 'ready' },
        );
      } catch (error) {
        if (active === owner && !disposed) {
          const wasCancelled = owner.controller.signal.aborted || error.name === 'AbortError';
          target.dataset.kind = wasCancelled ? '' : 'error';
          owner.lease.finish({
            message: wasCancelled
              ? 'Cancelled. The workspace is unchanged.'
              : error.message || String(error),
            state: wasCancelled ? 'cancelled' : 'error',
          });
        }
      } finally {
        unlock(owner);
      }
    },
    dispose() {
      disposed = true;
      active?.controller.abort();
      if (active) unlock(active);
      presenter.dispose();
    },
  };
}
