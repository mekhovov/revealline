import { resolveControllerBoostMode } from '../controller-boost.mjs';

/** This select is an independent preference, outside the button-map draft.
 * applyMode adopts synchronously and returns its actual persistence result. */
export function attachControllerBoostSettings({ select, status, getMode, applyMode }) {
  let destroyed = false;
  const refresh = () => {
    if (destroyed) return;
    const mode = resolveControllerBoostMode(getMode());
    select.value = mode;
    status.textContent = `Controller Boost: ${mode === 'hold' ? 'Hold' : 'Toggle'}.`;
  };
  const changed = () => {
    if (destroyed) return;
    try {
      const result = applyMode(resolveControllerBoostMode(select.value));
      refresh();
      status.textContent += result?.ok
        ? ' Saved on this device.'
        : ` Session only. ${result?.warning || 'Export your player library to keep this preference.'}`;
    } catch (error) {
      refresh();
      status.textContent = `Controller Boost unchanged. ${error.message}`;
    }
  };
  select.addEventListener('change', changed);
  refresh();
  return {
    refresh,
    destroy() {
      destroyed = true;
      select.removeEventListener('change', changed);
    },
  };
}

/** Update only changed text, so the live region does not announce every frame. */
export function renderControllerBoostCue(element, state, buttonLabel, canToggle = false) {
  const hidden = state.mode !== 'toggle';
  const text = hidden
    ? ''
    : `Controller Boost ${state.latched ? 'on' : 'off'}${canToggle ? ` · ${buttonLabel} to turn ${state.latched ? 'off' : 'on'}` : ''}`;
  if (element.hidden !== hidden) element.hidden = hidden;
  if (element.textContent !== text) element.textContent = text;
}
