import { t, onLocaleChange } from '../i18n/index.mjs';
import { KEY_ACTION_LABELS, keyCodeForEvent, keyLabel } from '../key-bindings.mjs';
import { COUCH_KEYBOARD_ACTIONS } from './keyboard-bindings.mjs';

const tr = (key, values = {}) => t(`interface:couchKeyboard.${key}`, values);
const actionLabel = (action) => KEY_ACTION_LABELS[action === 'action' ? 'ability' : action];
/** Settings owns capture; the host owns accepted input and the preference store. */
export function mountCouchKeyboardSettings({
  root,
  preferences,
  isOpen,
  document: doc = globalThis.document,
  window: win = globalThis.window,
}) {
  const area = doc.createElement('section');
  area.className = 'multiplayer-keyboard';
  root.append(area);
  const node = (tag, parent = area) => {
    const element = doc.createElement(tag);
    parent.append(element);
    return element;
  };
  const heading = node('h3'),
    intro = node('p'),
    seats = [],
    rows = [],
    removers = [];
  let capturing = null,
    message = null,
    disposed = false,
    lastChanged = null;
  const listen = (element, type, handler, options) => {
    element.addEventListener(type, handler, options);
    removers.push(() => element.removeEventListener(type, handler, options));
  };
  const available = () => !disposed && isOpen() && !area.closest('[hidden],[inert]');
  for (let player = 0; player < 2; player++) {
    const group = node('fieldset'),
      legend = node('legend', group);
    seats.push(legend);
    for (const action of COUCH_KEYBOARD_ACTIONS) {
      const row = node('div', group),
        label = node('span', row),
        button = node('button', row);
      row.className = 'couch-keyboard-row';
      button.type = 'button';
      button.className = 'button secondary';
      button.id = `race-key-${player}-${action}`;
      const entry = { player, action, label, button };
      rows.push(entry);
      listen(button, 'click', () => {
        if (!available()) return;
        capturing = entry;
        message = () => tr('capture', { player: player + 1, action: actionLabel(action) });
        render();
      });
    }
  }
  const status = node('p'),
    persistence = node('p'),
    actions = node('div'),
    cancel = node('button', actions),
    reset = node('button', actions),
    retry = node('button', actions);
  actions.className = 'couch-keyboard-actions';
  status.id = 'race-key-capture-status';
  persistence.id = 'race-key-save-status';
  for (const element of [status, persistence]) {
    element.setAttribute('role', 'status');
    element.setAttribute('aria-live', 'polite');
    element.setAttribute('aria-atomic', 'true');
  }
  for (const [button, id] of [
    [cancel, 'cancel'],
    [reset, 'reset'],
    [retry, 'retry'],
  ]) {
    button.type = 'button';
    button.className = 'button secondary';
    button.id = `race-key-${id}`;
  }
  function render() {
    if (disposed) return;
    const state = preferences.snapshot();
    heading.textContent = tr('title');
    intro.textContent = tr('intro');
    seats.forEach((seat, player) => {
      seat.textContent = tr('player', { player: player + 1 });
    });
    for (const row of rows) {
      const keys = keyLabel(state.bindings.seats[row.player][row.action]);
      row.label.textContent = actionLabel(row.action);
      row.button.textContent = capturing === row ? tr('listening') : tr('change', { keys });
      row.button.setAttribute(
        'aria-label',
        tr(capturing === row ? 'capture' : 'changeLabel', {
          player: row.player + 1,
          action: actionLabel(row.action),
          keys,
        }),
      );
      row.button.setAttribute('aria-describedby', `${status.id} ${persistence.id}`);
    }
    status.textContent = message?.() ?? tr('ready');
    persistence.textContent =
      state.status === 'session'
        ? `${tr('session')} ${tr(`save.${state.reason || 'unconfirmed'}`)}`
        : state.status === 'saved'
          ? tr('saved')
          : state.status === 'external'
            ? tr('external')
            : '';
    cancel.textContent = tr('cancel');
    cancel.hidden = !capturing;
    retry.textContent = tr('retry');
    retry.hidden = state.status !== 'session';
    reset.textContent = tr('reset');
  }
  function stopCapture(focus = false) {
    if (!capturing) return;
    const previous = capturing;
    capturing = null;
    message = () => tr('cancelled');
    render();
    if (focus && available()) previous.button.focus({ preventScroll: true });
  }
  listen(cancel, 'click', () => stopCapture(true));
  listen(reset, 'click', () => {
    if (!available()) return;
    capturing = null;
    lastChanged = reset;
    message = () => tr('resetDone');
    preferences.reset();
  });
  listen(retry, 'click', () => {
    if (!available()) return;
    preferences.retry();
    if (retry.hidden && available()) (lastChanged ?? reset).focus({ preventScroll: true });
  });
  listen(
    win,
    'keydown',
    (event) => {
      if (!capturing || !available()) return;
      const row = capturing,
        code = keyCodeForEvent(event);
      if (event.isComposing || event.keyCode === 229 || ['Dead', 'Process'].includes(event.key)) {
        message = () => tr('composition');
        render();
        return;
      }
      if (code === 'Tab' || event.key === 'Tab') {
        stopCapture();
        return;
      }
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (event.shiftKey && !['ShiftLeft', 'ShiftRight'].includes(code))
      ) {
        message = () => tr('modifier');
        render();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (code === 'Escape' || event.key === 'Escape') {
        stopCapture(true);
        return;
      }
      if (event.repeat) return;
      try {
        preferences.set(row.player, row.action, code);
        capturing = null;
        lastChanged = row.button;
        message = () =>
          tr('changed', {
            player: row.player + 1,
            action: actionLabel(row.action),
            key: keyLabel(code),
          });
        render();
        row.button.focus({ preventScroll: true });
      } catch (error) {
        message = () =>
          error.reason === 'conflict'
            ? tr('conflict', { ...error.values, action: actionLabel(error.values.action) })
            : tr('reserved', { key: keyLabel(code) || tr('unknownKey') });
        render();
      }
    },
    true,
  );
  listen(doc, 'focusin', (event) => {
    if (capturing && event.target !== capturing.button && event.target !== cancel) stopCapture();
  });
  listen(win, 'blur', () => stopCapture());
  listen(win, 'pagehide', () => stopCapture());
  const stop = preferences.subscribe(render),
    stopLocale = onLocaleChange(render);
  return {
    cancel: stopCapture,
    refresh() {
      stopCapture();
      preferences.refresh();
      render();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      capturing = null;
      stop();
      stopLocale();
      removers.forEach((remove) => remove());
      area.remove();
    },
  };
}
