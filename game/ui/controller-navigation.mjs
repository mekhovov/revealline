const CONTROLS = 'button,a[href],select,input:not([type="hidden"]),textarea,summary';
const DIRECTIONS = new Set(['up', 'right', 'down', 'left']);

/** Controller edges operate existing DOM controls; this adapter never polls a
 * device, changes game state, or bypasses a host's guarded Back operation. */
export function attachControllerNavigation({
  document: doc = globalThis.document,
  getScope = () => 'ui',
  getRoot = () => doc,
  getDefaultFocus = () => null,
  getControlLabels = () => ({ directions: 'D-pad', confirm: 'South', back: 'East' }),
  accept = () => true,
  onBack = () => {},
  onMenu = () => {},
  onHint = () => {},
  onReadingChange = () => {},
  onNativeInput = () => {},
  keyboard = false,
} = {}) {
  let scope = null,
    root = null,
    engaged = false,
    focused = null,
    editing = null,
    reading = null,
    readingInvalidated = false,
    destroyed = false,
    focusing = false;
  const listeners = [];
  const readingContent = new WeakMap();
  const listen = (type, fn) => {
    doc.addEventListener(type, fn, true);
    listeners.push(() => doc.removeEventListener(type, fn, true));
  };
  const hint = (message) => onHint(message);
  function visible(element) {
    return visibleInScope(element, false);
  }
  function visibleInScope(element, allowDisabled) {
    if (
      !element ||
      !element.isConnected ||
      (!allowDisabled && element.disabled) ||
      !root?.contains(element)
    )
      return false;
    if (element.closest('[hidden],[inert],[aria-hidden="true"]')) return false;
    for (let parent = element; parent && parent !== doc; parent = parent.parentElement) {
      if (parent.tagName === 'DETAILS' && !parent.open) {
        const summary = parent.querySelector('summary');
        if (element !== summary && !summary?.contains(element)) return false;
      }
      const style = doc.defaultView?.getComputedStyle(parent);
      if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
    }
    return element.getClientRects().length > 0 && accept(element);
  }
  const controls = () => [...(root?.querySelectorAll(CONTROLS) || [])].filter(visible);
  function mark(element) {
    if (focused !== element) focused?.classList.remove('controller-focus');
    focused = element;
    focused?.classList.add('controller-focus');
  }
  function focus(element) {
    if (!visible(element)) return false;
    focusing = true;
    try {
      element.focus({ preventScroll: true });
      element.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
    } finally {
      focusing = false;
    }
    mark(element);
    return true;
  }
  function cancelEdit(message = '') {
    if (!editing) return;
    editing.element.removeAttribute('data-controller-editing');
    editing.preview.remove();
    editing = null;
    if (message) hint(message);
  }
  const readingState = () =>
    reading ? { regionId: reading.regionId, label: reading.label } : null;
  function readingMetrics(region) {
    const { clientHeight, scrollHeight, scrollTop } = region;
    if (
      ![clientHeight, scrollHeight, scrollTop].every(Number.isFinite) ||
      clientHeight <= 0 ||
      scrollHeight < 0
    )
      return null;
    return {
      max: Math.max(0, scrollHeight - clientHeight),
      step: Math.min(48, Math.max(1, Math.floor(clientHeight / 2))),
    };
  }
  function cancelReading({ restoreFocus = false, message = '', invalidated = false } = {}) {
    if (!reading) return false;
    const previous = reading;
    reading = null;
    previous.region.removeAttribute('data-controller-reading');
    if (focused === previous.region) mark(null);
    readingInvalidated ||= invalidated;
    onReadingChange(null);
    if (message) hint(message);
    if (
      restoreFocus &&
      !destroyed &&
      getScope() === previous.scope &&
      getRoot() === previous.root
    ) {
      if (!focus(previous.origin)) ensureFocus();
    }
    return true;
  }
  function endReading({ restoreFocus = true } = {}) {
    return cancelReading({ restoreFocus, message: 'Reading ended. Choose an action when ready.' });
  }
  function readingHint() {
    const labels = getControlLabels();
    return `${reading.label}: ${readingMetrics(reading.region)?.max ? 'Up/Down scroll' : 'All text is visible'} · ${labels.confirm} or ${labels.back} returns`;
  }
  function beginReading({ region, origin, label: name, exit = null } = {}) {
    if (destroyed) return false;
    sync();
    if (
      scope === 'flight' ||
      !visible(region) ||
      !region.id ||
      !region.hasAttribute('data-game-reading') ||
      !(region.getAttribute('aria-label') || region.getAttribute('aria-labelledby')) ||
      region.tabIndex < 0 ||
      !readingMetrics(region) ||
      !controls().includes(origin) ||
      origin === region ||
      (exit !== null &&
        (exit.tagName !== 'BUTTON' ||
          !visibleInScope(exit, true) ||
          exit === origin ||
          region.contains(exit))) ||
      typeof name !== 'string' ||
      !name.trim() ||
      name.length > 160
    )
      return false;
    if (
      reading?.region === region &&
      reading.origin === origin &&
      reading.label === name.trim() &&
      reading.exit === exit
    )
      return true;
    cancelEdit();
    if (reading) {
      reading.region.removeAttribute('data-controller-reading');
      mark(null);
    }
    if (readingContent.has(region) && readingContent.get(region) !== region.textContent)
      region.scrollTop = 0;
    readingContent.set(region, region.textContent);
    reading = {
      region,
      regionId: region.id,
      origin,
      exit,
      label: name.trim(),
      text: region.textContent,
      scope,
      root,
      boundary: null,
    };
    readingInvalidated = false;
    engaged = true;
    region.setAttribute('data-controller-reading', 'true');
    focus(region);
    onReadingChange(readingState());
    // A host may deliberately clear navigation during the callback.
    if (reading) hint(readingHint());
    return !!reading;
  }
  function relinquish() {
    cancelEdit('Controller edit cancelled.');
    cancelReading({ invalidated: true });
    engaged = false;
    mark(null);
  }
  listen('pointerdown', (event) => {
    const exit = reading?.exit;
    if (
      exit &&
      visible(exit) &&
      (event.target === exit || exit.contains(event.target)) &&
      (event.button === undefined || event.button === 0) &&
      event.isPrimary !== false &&
      event.cancelable !== false &&
      !event.defaultPrevented
    ) {
      // Keep focus/reader alive for this button's ordinary click. Cancelling it
      // now would disable Done before its click can restore the reading origin.
      // No action runs on pointerdown, so dragging away may still cancel a click.
      event.preventDefault();
      onNativeInput(event);
      return;
    }
    relinquish();
    onNativeInput(event);
  });
  listen('pointercancel', () => {
    if (reading) relinquish();
  });
  listen('keydown', (event) => {
    if (keyboard && keyboardNavigation(event)) {
      onNativeInput(event);
      return;
    }
    if ((reading || editing) && event.key === 'Escape' && !event.defaultPrevented) {
      event.preventDefault();
      if (reading) endReading();
      else cancelEdit('Choice cancelled.');
    } else relinquish();
    onNativeInput(event);
  });
  listen('focusin', (event) => {
    if (focusing) return;
    if (reading && event.target !== reading.region)
      cancelReading({ invalidated: true, message: 'Reading ended.' });
    if (editing && event.target !== editing.element) cancelEdit('Controller edit cancelled.');
    if (engaged) mark(visible(event.target) ? event.target : null);
  });
  const selectOptions = (element) =>
    [...element.options].filter((option) => !option.disabled && !option.parentElement?.disabled);
  const signature = (element) =>
    element.tagName === 'SELECT'
      ? JSON.stringify(selectOptions(element).map((option) => [option.value, option.label]))
      : JSON.stringify([element.min, element.max, element.step]);
  function ensureFocus() {
    const items = controls();
    const current = items.includes(doc.activeElement) ? doc.activeElement : null;
    const preferred = getDefaultFocus();
    const target = current || (items.includes(preferred) ? preferred : null) || items[0];
    if (target) focus(target);
    return target || null;
  }
  function sync() {
    if (destroyed) return;
    let invalidated = readingInvalidated;
    readingInvalidated = false;
    const nextScope = getScope(),
      nextRoot = getRoot();
    if (scope !== nextScope || root !== nextRoot) {
      invalidated = scope !== null;
      cancelEdit();
      cancelReading();
      scope = nextScope;
      root = nextRoot;
      mark(null);
      if (engaged && scope !== 'flight') ensureFocus();
    }
    if (
      reading &&
      (!visible(reading.region) ||
        reading.region.id !== reading.regionId ||
        !visible(reading.origin) ||
        doc.activeElement !== reading.region ||
        reading.region.textContent !== reading.text ||
        !reading.region.hasAttribute('data-game-reading') ||
        !(
          reading.region.getAttribute('aria-label') ||
          reading.region.getAttribute('aria-labelledby')
        ) ||
        reading.region.tabIndex < 0 ||
        !readingMetrics(reading.region))
    ) {
      invalidated = true;
      cancelReading({ message: 'The reading region changed. Choose it again to read.' });
    }
    if (reading) {
      const max = readingMetrics(reading.region).max;
      if (reading.region.scrollTop < 0 || reading.region.scrollTop > max)
        reading.region.scrollTop = Math.max(0, Math.min(max, reading.region.scrollTop));
    }
    if (
      editing &&
      (!visible(editing.element) ||
        doc.activeElement !== editing.element ||
        editing.element.value !== editing.original ||
        signature(editing.element) !== editing.signature)
    ) {
      invalidated = true;
      cancelEdit('The control changed. Choose it again to edit.');
    }
    if (scope === 'flight') {
      cancelEdit();
      cancelReading();
      mark(null);
    } else if (
      engaged &&
      !reading &&
      (!visible(doc.activeElement) || !controls().includes(doc.activeElement))
    ) {
      invalidated = true;
      ensureFocus();
    }
    return invalidated;
  }
  const label = (element) =>
    element.getAttribute('aria-label') ||
    [...(element.labels?.[0]?.childNodes || [])]
      .filter((node) => node.nodeType === 3)
      .map((node) => node.textContent)
      .join('')
      .trim() ||
    element.id ||
    'Value';
  function paintEdit() {
    if (!editing) return;
    const value =
      editing.kind === 'select' ? editing.options[editing.index].label : String(editing.draft);
    const controls = getControlLabels();
    editing.preview.textContent = `${editing.label}: ${value} · ${controls.directions} changes · ${controls.confirm} confirms · ${controls.back} cancels`;
    hint(editing.preview.textContent);
  }
  function beginEdit(element) {
    const kind = element.tagName === 'SELECT' ? 'select' : 'range';
    let state;
    if (kind === 'select') {
      const options = selectOptions(element);
      if (!options.length) return hint('No enabled choices are available.');
      state = {
        options,
        index: Math.max(
          0,
          options.findIndex((option) => option.value === element.value),
        ),
      };
    } else {
      const min = Number(element.min || 0),
        max = Number(element.max || 100),
        step = Number(element.step || 1),
        draft = Number(element.value);
      if (![min, max, step, draft].every(Number.isFinite) || max < min || step <= 0)
        return hint('Use keyboard or touch for this value.');
      state = { min, max, step, draft: Math.max(min, Math.min(max, draft)) };
    }
    const preview = doc.createElement('div');
    preview.className = 'controller-editor';
    preview.setAttribute('role', 'status');
    (element.closest('label') || element).insertAdjacentElement('afterend', preview);
    element.setAttribute('data-controller-editing', 'true');
    editing = {
      ...state,
      kind,
      element,
      original: element.value,
      signature: signature(element),
      label: label(element),
      preview,
    };
    paintEdit();
  }
  function editDirection(direction) {
    const delta = direction === 'right' || direction === 'down' ? 1 : -1;
    if (editing.kind === 'select')
      editing.index = Math.max(0, Math.min(editing.options.length - 1, editing.index + delta));
    else
      editing.draft = Number(
        Math.max(editing.min, Math.min(editing.max, editing.draft + delta * editing.step)).toFixed(
          8,
        ),
      );
    paintEdit();
  }
  function commitEdit() {
    const edit = editing;
    const next = edit.kind === 'select' ? edit.options[edit.index].value : String(edit.draft);
    cancelEdit();
    if (next !== edit.original) {
      edit.element.value = next;
      const EventType = doc.defaultView?.Event || Event;
      if (edit.kind === 'range')
        edit.element.dispatchEvent(new EventType('input', { bubbles: true }));
      edit.element.dispatchEvent(new EventType('change', { bubbles: true }));
    }
    hint('Choice applied.');
  }
  function move(direction) {
    const items = controls(),
      current = ensureFocus();
    if (!current || items.length < 2) return;
    const grid = current.closest('#gallery-grid,#missions');
    if (grid) {
      const from = current.getBoundingClientRect();
      const cx = from.x + from.width / 2,
        cy = from.y + from.height / 2;
      const candidates = items
        .filter((element) => element !== current && grid.contains(element))
        .map((element) => {
          const rect = element.getBoundingClientRect(),
            dx = rect.x + rect.width / 2 - cx,
            dy = rect.y + rect.height / 2 - cy,
            horizontal = direction === 'left' || direction === 'right';
          const forward =
            direction === 'left' ? -dx : direction === 'right' ? dx : direction === 'up' ? -dy : dy;
          return { element, forward, score: forward + Math.abs(horizontal ? dy : dx) * 3 };
        })
        .filter((item) => item.forward > 1)
        .sort((a, b) => a.score - b.score);
      if (candidates.length) return focus(candidates[0].element);
    }
    const step = direction === 'down' || direction === 'right' ? 1 : -1;
    focus(items[(items.indexOf(current) + step + items.length) % items.length]);
  }
  function activate(element) {
    if (!visible(element)) return;
    if (element.tagName === 'SELECT' || (element.tagName === 'INPUT' && element.type === 'range'))
      return beginEdit(element);
    if (
      element.tagName === 'TEXTAREA' ||
      (element.tagName === 'INPUT' &&
        !['checkbox', 'radio', 'button', 'submit'].includes(element.type))
    )
      return hint(
        'Use keyboard or touch for text, dates and file pickers. Other controls remain available.',
      );
    element.click();
  }
  function readDirection(direction) {
    if (direction !== 'up' && direction !== 'down') {
      hint(readingHint());
      return;
    }
    const { region } = reading;
    const { max, step } = readingMetrics(region);
    const top = Math.max(
      0,
      Math.min(max, region.scrollTop + (direction === 'down' ? step : -step)),
    );
    if (typeof region.scrollTo === 'function')
      region.scrollTo({ top, left: 0, behavior: 'instant' });
    else {
      region.scrollTop = top;
      region.scrollLeft = 0;
    }
    const boundary = max === 0 ? 'all' : top === 0 ? 'start' : top === max ? 'end' : null;
    if (boundary && reading.boundary !== boundary)
      hint(
        `${boundary === 'all' ? 'All text is visible.' : boundary === 'start' ? 'Start of details.' : 'End of details.'} ${readingHint()}`,
      );
    reading.boundary = boundary;
  }
  function keyboardNavigation(event) {
    if (
      event.defaultPrevented ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      ![
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'Tab',
        'Escape',
        'Enter',
        ' ',
        'PageUp',
        'PageDown',
        'Home',
        'End',
      ].includes(event.key)
    )
      return false;
    sync();
    if (scope === 'flight' || root === doc || !root) return false;
    // Holding the key that opened a panel must not activate its new primary
    // action (or immediately resume a flight just paused by Escape).
    if (
      event.repeat &&
      (event.key === 'Escape' ||
        (['Enter', ' '].includes(event.key) &&
          !event.target?.closest?.(
            'input,select,textarea,[contenteditable]:not([contenteditable="false"])',
          )))
    ) {
      event.preventDefault();
      return true;
    }
    if (reading) {
      if (['ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        readDirection(event.key === 'ArrowUp' ? 'up' : 'down');
        return true;
      }
      if (['Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) {
        event.preventDefault();
        const metrics = readingMetrics(reading.region);
        const target =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? metrics.max
              : reading.region.scrollTop +
                (event.key === 'PageUp' ? -1 : 1) * reading.region.clientHeight;
        reading.region.scrollTop = Math.max(0, Math.min(metrics.max, target));
        return true;
      }
      if (['Enter', ' ', 'Escape'].includes(event.key)) {
        event.preventDefault();
        endReading();
        return true;
      }
      if (event.key === 'Tab') endReading({ restoreFocus: false });
      else return false;
    }
    if (editing && event.key === 'Escape') {
      event.preventDefault();
      cancelEdit('Choice cancelled.');
      return true;
    }
    if (event.key === 'Escape') {
      // Native dialogs keep their cancellable Escape lifecycle.
      if (root.tagName === 'DIALOG') return false;
      event.preventDefault();
      relinquish();
      onBack();
      return true;
    }
    const items = controls(),
      current = items.indexOf(doc.activeElement);
    if (event.key === 'Tab') {
      if (root.tagName === 'DIALOG') {
        // Keep native traversal inside the current modal. Intercept only its
        // first/last boundary; native inputs still own all interior Tab keys.
        const tabStops = [...root.querySelectorAll(`${CONTROLS},[tabindex]`)]
          .filter((element) => element.tabIndex >= 0 && visible(element))
          .sort((a, b) => (a.tabIndex || Infinity) - (b.tabIndex || Infinity));
        if (!root.open || !tabStops.length) return false;
        const boundary = event.shiftKey ? tabStops[0] : tabStops.at(-1);
        if (doc.activeElement !== boundary) return false;
        event.preventDefault();
        relinquish();
        focus(event.shiftKey ? tabStops.at(-1) : tabStops[0]);
        return true;
      }
      if (!items.length) return false;
      event.preventDefault();
      relinquish();
      const next =
        current < 0
          ? event.shiftKey
            ? items.length - 1
            : 0
          : (current + (event.shiftKey ? -1 : 1) + items.length) % items.length;
      focus(items[next]);
      return true;
    }
    if (['Enter', ' '].includes(event.key)) {
      if (current >= 0) return false; // Native activation owns actual controls.
      event.preventDefault();
      ensureFocus(); // A first key from outside the panel only restores focus.
      return true;
    }
    if (!event.key.startsWith('Arrow')) return false;
    const nativeEditor = event.target?.closest?.(
      'input,select,textarea,[contenteditable]:not([contenteditable="false"])',
    );
    if (nativeEditor && visible(nativeEditor)) return false;
    event.preventDefault();
    relinquish();
    if (current < 0) ensureFocus();
    else
      move({ ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[event.key]);
    return true;
  }
  function handle(command = {}) {
    if (destroyed) return;
    if (sync()) return;
    if (scope === 'flight') return;
    if (!command.confirm && !command.back && !command.menu && !DIRECTIONS.has(command.direction))
      return;
    engaged = true;
    if (reading) {
      if (command.back || command.menu || command.confirm) endReading();
      else readDirection(command.direction);
      return;
    }
    const element = ensureFocus();
    if (command.back) {
      if (editing) cancelEdit('Choice cancelled.');
      else onBack();
    } else if (command.menu) {
      if (editing) cancelEdit('Choice cancelled.');
      else onMenu();
    } else if (command.confirm) {
      if (editing) commitEdit();
      else if (element) activate(element);
    } else if (editing) editDirection(command.direction);
    else move(command.direction);
  }
  return {
    handle,
    sync,
    beginReading,
    endReading,
    readingState,
    // One focus handoff; callers own readiness/foreground/intent checks.
    // Unlike engage(), this does not enable later controller scope refocusing.
    focusAvailable() {
      if (destroyed) return null;
      sync();
      return scope === 'flight' ? null : ensureFocus();
    },
    engage() {
      if (destroyed) return;
      sync();
      if (scope === 'flight') return;
      engaged = true;
      if (reading) focus(reading.region);
      else ensureFocus();
    },
    clear: relinquish,
    destroy() {
      if (destroyed) return;
      relinquish();
      destroyed = true;
      listeners.forEach((remove) => remove());
    },
  };
}
