import {
  KEY_BINDING_ACTIONS,
  KEY_ACTION_LABELS,
  KEY_BINDING_PRESETS,
  KEY_BINDING_PRESET_LABELS,
  resolveKeyBindings,
  replaceKeyBinding,
  keyCodeForEvent,
  keyLabel,
  bindingLabels,
} from '../key-bindings.mjs';

/** Settings-only key capture. The host applies validated preferences and owns
 * persistence; a failed disk save may still apply the map to this session.
 */
export function attachKeySettings({ getBindings, setBindings, onChanged = () => {} }) {
  const required = (id) => {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Keyboard settings need #${id}.`);
    return element;
  };
  const list = required('key-binding-list'),
    preset = required('key-preset'),
    reset = required('reset-key-bindings'),
    status = required('key-capture-status'),
    cancelButton = required('cancel-key-capture'),
    dialog = required('settings-dialog'),
    buttons = new Map(),
    listeners = [];
  let capturing = null,
    destroyed = false;
  const listen = (target, type, fn, options) => {
    target.addEventListener(type, fn, options);
    listeners.push(() => target.removeEventListener(type, fn, options));
  };
  const announce = (message) => {
    status.textContent = message;
  };
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  const sameBindings = (a, b) =>
    KEY_BINDING_ACTIONS.every(
      (action) =>
        a.bindings[action].length === b.bindings[action].length &&
        a.bindings[action].every((code) => b.bindings[action].includes(code)),
    );
  function render() {
    if (destroyed) return;
    const config = resolveKeyBindings(getBindings()),
      labels = bindingLabels(config);
    for (const action of KEY_BINDING_ACTIONS) {
      const button = buttons.get(action),
        active = capturing === action;
      button.textContent = active ? 'Press a key…' : `${labels[action]} · Change`;
      button.setAttribute('aria-pressed', String(active));
      button.setAttribute(
        'aria-label',
        active
          ? `Listening for ${KEY_ACTION_LABELS[action]}. Escape or Tab cancels.`
          : `Change ${KEY_ACTION_LABELS[action]} key binding. Current keys: ${labels[action]}.`,
      );
    }
    preset.value =
      Object.entries(KEY_BINDING_PRESETS).find(([, value]) => sameBindings(config, value))?.[0] ||
      'custom';
    const custom = [...preset.options].find((option) => option.value === 'custom');
    if (custom) custom.disabled = true;
    cancelButton.hidden = capturing === null;
    cancelButton.disabled = capturing === null;
  }
  function cancel({ focus = false, message = true } = {}) {
    if (capturing === null) return;
    const action = capturing;
    capturing = null;
    render();
    if (message) announce(`${KEY_ACTION_LABELS[action]} unchanged. Key capture cancelled.`);
    if (focus && dialog.open) buttons.get(action).focus({ preventScroll: true });
  }
  function apply(config, message) {
    // Resolve before calling the host: duplicate/reserved keys never reach it.
    const candidate = config === null ? null : resolveKeyBindings(config);
    const result = setBindings(candidate);
    capturing = null;
    render();
    onChanged();
    announce(
      `${message}${result?.ok === false ? ` ${result.warning || 'This keyboard map applies to this session only.'}` : ''}`,
    );
  }
  list.replaceChildren();
  for (const action of KEY_BINDING_ACTIONS) {
    const row = document.createElement('div'),
      label = document.createElement('span'),
      button = document.createElement('button');
    row.className = 'key-binding-row';
    label.className = 'key-binding-label';
    label.textContent = KEY_ACTION_LABELS[action];
    button.type = 'button';
    button.className = 'button secondary';
    button.dataset.keyAction = action;
    button.setAttribute('aria-describedby', 'key-capture-status');
    buttons.set(action, button);
    listen(button, 'click', () => {
      if (destroyed || !dialog.open) return;
      capturing = action;
      render();
      announce(
        `Choose one physical key for ${KEY_ACTION_LABELS[action]}. Escape or Tab cancels. Existing bindings remain unchanged until a valid key is chosen.`,
      );
    });
    row.append(label, button);
    list.append(row);
  }
  listen(
    dialog,
    'keydown',
    (event) => {
      if (capturing === null || destroyed || !dialog.open) return;
      const code = keyCodeForEvent(event);
      if (event.isComposing || event.keyCode === 229 || ['Dead', 'Process'].includes(event.key)) {
        announce(
          `Text composition cannot be a game key. ${KEY_ACTION_LABELS[capturing]} is unchanged. Finish composition, then press one physical key, or cancel.`,
        );
        return; // Composition owns its own Escape/candidate keys.
      }
      if (code === 'Tab' || event.key === 'Tab') {
        cancel(); // Let the browser move focus normally.
        return;
      }
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (event.shiftKey && !['ShiftLeft', 'ShiftRight'].includes(code))
      ) {
        announce(
          `Cannot bind a modifier combination. ${KEY_ACTION_LABELS[capturing]} is unchanged. Press one key; Shift alone is allowed. Escape or Tab cancels.`,
        );
        return; // Preserve browser and operating-system shortcuts.
      }
      if (code === 'Escape' || event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        cancel({ focus: true });
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) return;
      const action = capturing;
      try {
        const candidate = replaceKeyBinding(getBindings(), action, code);
        apply(
          candidate,
          `${KEY_ACTION_LABELS[action]} changed to ${bindingLabels(candidate)[action]}. Escape always pauses the game.`,
        );
        buttons.get(action).focus({ preventScroll: true });
      } catch (error) {
        announce(
          `${keyLabel(code) || 'This key'} was not assigned. ${error.message} ${KEY_ACTION_LABELS[action]} is unchanged. Choose another key, or press Escape or Tab to cancel.`,
        );
      }
    },
    true,
  );
  listen(cancelButton, 'click', () => cancel({ focus: true }));
  listen(dialog, 'focusin', (event) => {
    if (
      capturing !== null &&
      event.target !== buttons.get(capturing) &&
      event.target !== cancelButton
    )
      cancel();
  });
  listen(dialog, 'cancel', (event) => {
    if (capturing !== null) {
      event.preventDefault();
      cancel({ focus: true });
    }
  });
  listen(dialog, 'close', () => cancel());
  listen(window, 'blur', () => cancel());
  listen(preset, 'change', () => {
    const id = preset.value;
    cancel({ message: false });
    if (!Object.hasOwn(KEY_BINDING_PRESETS, id)) {
      render();
      return;
    }
    try {
      apply(
        id === 'default' ? null : KEY_BINDING_PRESETS[id],
        `${KEY_BINDING_PRESET_LABELS[id]} keyboard preset applied. Escape always pauses the game.`,
      );
    } catch (error) {
      render();
      announce(`Keyboard preset was not applied. ${error.message}`);
    }
  });
  listen(reset, 'click', () => {
    cancel({ message: false });
    try {
      apply(null, 'Default keyboard bindings restored. Escape always pauses the game.');
    } catch (error) {
      render();
      announce(`Keyboard bindings were not reset. ${error.message}`);
    }
  });
  function refresh() {
    if (destroyed) return;
    cancel();
    render();
  }
  render();
  announce('Choose Change to assign one physical key. Escape always pauses the game.');
  return {
    refresh,
    destroy() {
      if (destroyed) return;
      cancel({ message: false });
      destroyed = true;
      for (const remove of listeners) remove();
      list.replaceChildren();
      cancelButton.hidden = true;
      cancelButton.disabled = true;
      announce('');
    },
  };
}
