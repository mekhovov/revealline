import {
  CONTROLLER_BINDING_ACTIONS,
  CONTROLLER_ACTION_LABELS,
  CONTROLLER_GLYPH_FAMILIES,
  controllerButtonLabel,
  controllerStickLabel,
  resolveControllerBindings,
  validateControllerBindings,
} from '../controller-bindings.mjs';

const FAMILY_LABELS = {
  generic: 'Position labels',
  xbox: 'Xbox labels',
  playstation: 'PlayStation labels',
};
const CONTEXT_LABELS = { flight: 'Flight', menu: 'Menus' };

/** A complete draft editor. The host owns adoption/persistence and input reset.
 * Async hosts must check signal/isCurrent before committing side effects.
 * {ok:false,warning} means session adoption succeeded but persistence did not.
 */
export function attachControllerSettings({
  container,
  document: doc = globalThis.document,
  getBindings,
  onApply,
  onBeforeEdit = () => {},
  continuousSteering = false,
} = {}) {
  if (
    !container ||
    !doc?.createElement ||
    typeof getBindings !== 'function' ||
    typeof onApply !== 'function' ||
    typeof onBeforeEdit !== 'function'
  )
    throw new TypeError('Controller settings require a container, document and binding callbacks.');
  const listeners = [],
    controls = new Map(),
    buttonSelects = [],
    outputs = new Map();
  let draft = null,
    baseline = '',
    generation = 0,
    destroyed = false,
    busy = false,
    sourceValid = true,
    pending = null;
  const prefix = container.id || 'controller-settings';
  const node = (tag, text, className) => {
    const element = doc.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  const listen = (target, type, callback) => {
    target.addEventListener(type, callback);
    listeners.push(() => target.removeEventListener(type, callback));
  };
  const button = (text, action) => {
    const element = node('button', text, 'button secondary');
    element.type = 'button';
    element.dataset.controllerSettingsAction = action;
    return element;
  };
  const heading = node('h3', 'Controller controls', 'controller-settings-heading'),
    summary = node('p', '', 'controller-settings-summary'),
    note = node(
      'p',
      'Use a complete draft to swap buttons. Your current controller remains active until Apply. Keyboard and touch remain available.',
      'controller-settings-note',
    ),
    edit = button('Edit controller settings', 'edit'),
    editor = node('div', undefined, 'controller-settings-editor'),
    status = node('p', '', 'controller-settings-status'),
    errors = node('ul', undefined, 'controller-settings-errors'),
    actions = node('div', undefined, 'controller-settings-actions'),
    apply = button('Apply controller settings', 'apply'),
    cancel = button('Cancel draft', 'cancel'),
    defaults = button('Restore defaults in draft', 'defaults');
  editor.hidden = true;
  status.id = `${prefix}-status`;
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  errors.hidden = true;
  editor.setAttribute('aria-describedby', status.id);
  actions.append(apply, cancel, defaults);
  const announce = (message) => {
    status.textContent = message;
  };
  function clearErrors() {
    errors.replaceChildren();
    errors.hidden = true;
  }
  function showErrors(messages) {
    errors.replaceChildren(...messages.map((message) => node('li', message)));
    errors.hidden = messages.length === 0;
  }
  const signature = (value) => JSON.stringify(resolveControllerBindings(value));
  const currentSource = () => resolveControllerBindings(getBindings());
  function syncSummary() {
    try {
      const value = currentSource();
      sourceValid = true;
      summary.textContent = `${FAMILY_LABELS[value.glyphFamily]} · Flight: ${controllerStickLabel(value, 'flight')} · Menus: ${controllerStickLabel(value, 'menu')} · Dead zone ${value.deadZone.press.toFixed(2)} / ${value.deadZone.release.toFixed(2)}.`;
    } catch (error) {
      sourceValid = false;
      summary.textContent = 'Current controller settings could not be read.';
      announce(error.message);
    }
  }
  function syncBusy() {
    edit.disabled = destroyed || busy || !sourceValid;
    apply.disabled = busy || !draft;
    cancel.disabled = busy || !draft;
    defaults.disabled = busy || !draft;
    for (const control of controls.values()) control.disabled = busy || !draft;
    editor.setAttribute('aria-busy', String(busy));
  }
  function invalidate(message) {
    generation++;
    pending?.abort();
    draft = null;
    baseline = '';
    editor.hidden = true;
    edit.hidden = false;
    clearErrors();
    syncSummary();
    syncBusy();
    if (sourceValid) announce(message);
  }
  function checkSource() {
    if (!draft || destroyed || busy) return false;
    try {
      if (signature(getBindings()) === baseline) return true;
      invalidate(
        'Controller settings changed elsewhere. Your old draft was discarded; choose Edit to start from the current settings.',
      );
    } catch (error) {
      invalidate(`Draft discarded: ${error.message}`);
    }
    return false;
  }
  const read = (path) => path.split('.').reduce((value, key) => value[key], draft);
  function write(path, value) {
    if (!checkSource()) return;
    const keys = path.split('.'),
      last = keys.pop();
    keys.reduce((object, key) => object[key], draft)[last] = value;
    clearErrors();
    announce('Draft changed. Current controls are unchanged until Apply.');
    if (path === 'glyphFamily') updateButtonLabels();
    if (outputs.has(path)) outputs.get(path).textContent = Number(value).toFixed(2);
  }
  function field(parent, path, labelText, { type = 'select', choices = [], min, max, step } = {}) {
    const label = node('label', undefined, 'controller-settings-field'),
      caption = node('span', labelText),
      control = node(type === 'select' ? 'select' : 'input');
    control.id = `${prefix}-${path.replaceAll('.', '-')}`;
    control.setAttribute('aria-label', labelText);
    control.dataset.controllerSetting = path;
    if (type !== 'select') control.type = type;
    if (min !== undefined) control.min = String(min);
    if (max !== undefined) control.max = String(max);
    if (step !== undefined) control.step = String(step);
    for (const [value, text] of choices) {
      const option = node('option', text);
      option.value = String(value);
      control.append(option);
    }
    controls.set(path, control);
    label.append(caption, control);
    if (type === 'range') {
      const output = node('output');
      output.setAttribute('for', control.id);
      outputs.set(path, output);
      label.append(output);
    }
    parent.append(label);
    const changed = () =>
      write(
        path,
        type === 'checkbox'
          ? control.checked
          : path === 'glyphFamily'
            ? control.value
            : Number(control.value),
      );
    listen(control, 'change', changed);
    if (type === 'range') listen(control, 'input', changed);
    return control;
  }
  function section(title, description, open = false) {
    const details = node('details', undefined, 'controller-settings-section'),
      body = node('div', undefined, 'controller-settings-section-body');
    details.open = open;
    details.append(node('summary', title));
    body.append(node('p', description, 'controller-settings-note'));
    details.append(body);
    editor.append(details);
    return body;
  }
  field(editor, 'glyphFamily', 'Button label family', {
    choices: CONTROLLER_GLYPH_FAMILIES.map((family) => [family, FAMILY_LABELS[family]]),
  });
  editor.append(
    node(
      'p',
      'Choose the names you prefer. Labels do not detect a device or change its physical mapping. Standard Gamepad API mappings only; system/home button 16 is reserved.',
      'controller-settings-note',
    ),
  );
  for (const context of ['flight', 'menu']) {
    const body = section(
      `${CONTEXT_LABELS[context]} button map`,
      'Choose one button per action. A button may be reused in the other context. Temporary conflicts are allowed in the draft, but Apply requires a complete valid map.',
    );
    for (const action of CONTROLLER_BINDING_ACTIONS[context]) {
      const select = field(
        body,
        `${context}.buttons.${action}`,
        `${CONTROLLER_ACTION_LABELS[context][action]} button`,
        {
          choices: Array.from({ length: 16 }, (_, index) => [
            index,
            `${controllerButtonLabel(index)} · ${index}`,
          ]),
        },
      );
      buttonSelects.push(select);
      if (continuousSteering && context === 'flight' && action === 'stop')
        select.parentElement.hidden = true;
    }
  }
  const sticks = section(
    'Stick controls',
    'Flight and menus can use different axis pairs or buttons only. Standard left stick is axes 0/1; right stick is 2/3. Axis changes are settings, not live hardware calibration.',
  );
  for (const context of ['flight', 'menu']) {
    const group = node('fieldset');
    group.append(node('legend', `${CONTEXT_LABELS[context]} stick`));
    field(group, `${context}.stick.enabled`, 'Enable stick input', { type: 'checkbox' });
    for (const [key, label] of [
      ['xAxis', 'Horizontal axis'],
      ['yAxis', 'Vertical axis'],
    ])
      field(group, `${context}.stick.${key}`, label, {
        choices: Array.from({ length: 4 }, (_, i) => [i, `Axis ${i}`]),
      });
    field(group, `${context}.stick.invertX`, 'Invert horizontal direction', { type: 'checkbox' });
    field(group, `${context}.stick.invertY`, 'Invert vertical direction', { type: 'checkbox' });
    sticks.append(group);
  }
  const thresholds = section(
    'Dead zone and release',
    'Press starts stick movement. Release keeps it active above this lower threshold, reducing jitter. Release must not exceed Press. Equal values preserve a single threshold. These values affect both contexts.',
  );
  field(thresholds, 'deadZone.press', 'Press threshold', {
    type: 'range',
    min: 0.1,
    max: 0.6,
    step: 0.01,
  });
  field(thresholds, 'deadZone.release', 'Release threshold', {
    type: 'range',
    min: 0.02,
    max: 0.6,
    step: 0.01,
  });
  editor.append(errors, actions);
  container.replaceChildren(heading, summary, note, edit, editor, status);
  function updateButtonLabels() {
    for (const select of buttonSelects)
      [...select.options].forEach((option, index) => {
        option.textContent = `${controllerButtonLabel(index, draft.glyphFamily)} · ${index}`;
      });
  }
  function renderDraft() {
    for (const [path, control] of controls) {
      const value = read(path);
      if (control.type === 'checkbox') control.checked = value;
      else control.value = String(value);
      if (outputs.has(path)) outputs.get(path).textContent = value.toFixed(2);
    }
    updateButtonLabels();
    syncBusy();
  }
  listen(edit, 'click', () => {
    if (destroyed || busy || draft) return;
    try {
      onBeforeEdit();
      draft = currentSource();
      baseline = signature(draft);
      generation++;
      clearErrors();
      editor.hidden = false;
      edit.hidden = true;
      renderDraft();
      announce(
        'Editing a draft. Apply validates all controls together; Cancel keeps the current map.',
      );
      controls.get('glyphFamily').focus({ preventScroll: true });
    } catch (error) {
      invalidate(`Controller settings could not be edited: ${error.message}`);
    }
  });
  listen(cancel, 'click', () => {
    if (destroyed || busy || !draft) return;
    invalidate('Draft cancelled. Current controller settings are unchanged.');
    edit.focus({ preventScroll: true });
  });
  listen(defaults, 'click', () => {
    if (!checkSource()) return;
    draft = resolveControllerBindings(null);
    renderDraft();
    clearErrors();
    announce(
      'Defaults are in the draft. Apply to use them, or Cancel to keep your current settings.',
    );
  });
  listen(apply, 'click', async () => {
    if (!checkSource()) return;
    const validation = validateControllerBindings(draft);
    if (!validation.valid) {
      showErrors(validation.errors);
      announce(
        `Controller settings were not applied. ${validation.errors[0]} Review the draft and apply again.`,
      );
      return;
    }
    const candidate = resolveControllerBindings(draft),
      expected = signature(candidate),
      ticket = generation,
      abort = new AbortController();
    let focusAfterApply = false;
    pending = abort;
    busy = true;
    syncBusy();
    announce('Applying controller settings…');
    const isCurrent = () => {
      if (destroyed || abort.signal.aborted || generation !== ticket) return false;
      try {
        const actual = signature(getBindings());
        return actual === baseline || actual === expected;
      } catch {
        return false;
      }
    };
    try {
      const result = await onApply(candidate, { signal: abort.signal, isCurrent });
      if (destroyed || generation !== ticket || abort.signal.aborted) return;
      if (signature(getBindings()) !== expected) {
        invalidate(
          'The current controller settings changed before this draft was adopted. Review the current settings and edit again.',
        );
        return;
      }
      draft = null;
      baseline = '';
      editor.hidden = true;
      edit.hidden = false;
      clearErrors();
      syncSummary();
      announce(
        `Controller settings applied.${result?.ok === false ? ` ${result.warning || 'The new map applies to this session only; it could not be saved.'}` : ''}`,
      );
      focusAfterApply = true;
    } catch (error) {
      if (!destroyed && generation === ticket && !abort.signal.aborted) {
        let unchanged = false;
        try {
          unchanged = signature(getBindings()) === baseline;
        } catch {}
        if (!unchanged)
          invalidate(
            'Controller settings changed during this operation. Review the current settings before editing again.',
          );
        else announce(`Controller settings were not applied. ${error.message}`);
      }
    } finally {
      if (pending === abort) {
        pending = null;
        busy = false;
        if (!destroyed) {
          syncBusy();
          if (focusAfterApply && generation === ticket) edit.focus({ preventScroll: true });
        }
      }
    }
  });
  function refresh() {
    if (destroyed) return;
    invalidate('Current controller settings loaded. Choose Edit to make a draft.');
  }
  refresh();
  return {
    refresh,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      generation++;
      pending?.abort();
      for (const remove of listeners) remove();
      container.replaceChildren();
    },
  };
}
