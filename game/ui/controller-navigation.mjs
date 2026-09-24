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
  getReadingPrompt = null,
  accept = () => true,
  onBack = () => {},
  onMenu = () => {},
  onHint = () => {},
  onReadingChange = () => {},
  onNativeInput = () => {},
  keyboard = false,
  ownsKeyboardEvent = () => false,
  onTabBoundary = () => false,
  nativeReadingScroll = false,
} = {}) {
  let scope = null,
    root = null,
    engaged = false,
    focused = null,
    editing = null,
    reading = null,
    nativeScroll = null,
    readingInvalidated = false,
    destroyed = false,
    focusing = false;
  const listeners = [];
  const readingContent = new WeakMap();
  const listen = (type, fn) => {
    doc.addEventListener(type, fn, true);
    listeners.push(() => doc.removeEventListener(type, fn, true));
  };
  const hint = (message, metadata) => (metadata ? onHint(message, metadata) : onHint(message));
  const readingMessage = (message, owner) =>
    hint(message, { kind: 'reading', regionId: owner.regionId });
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
    nativeScroll = null;
    if (!reading) return false;
    const previous = reading;
    reading = null;
    previous.region.removeAttribute('data-controller-reading');
    if (focused === previous.region || focused === previous.exit) mark(null);
    readingInvalidated ||= invalidated;
    onReadingChange(null);
    if (message) readingMessage(message, previous);
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
    const scrollable = !!readingMetrics(reading.region)?.max;
    if (getReadingPrompt) return `${reading.label}: ${getReadingPrompt({ scrollable })}`;
    const labels = getControlLabels();
    return `${reading.label}: ${scrollable ? 'Up/Down scroll' : 'All text is visible'} · ${labels.confirm} or ${labels.back} returns`;
  }
  function readingCurrent(owner = reading) {
    return (
      owner &&
      visible(owner.region) &&
      owner.region.id === owner.regionId &&
      visible(owner.origin) &&
      (doc.activeElement === owner.region ||
        (keyboard && owner.exit && doc.activeElement === owner.exit && visible(owner.exit))) &&
      owner.region.textContent === owner.text &&
      owner.region.hasAttribute('data-game-reading') &&
      (owner.region.getAttribute('aria-label') || owner.region.getAttribute('aria-labelledby')) &&
      !(owner.region.tabIndex < 0) &&
      readingMetrics(owner.region) &&
      reading === owner
    );
  }
  function refreshReadingHint() {
    // A modality change can follow the current key's reading action. Republish
    // only its still-current text; do not sync, refocus or enter another reader.
    if (
      destroyed ||
      doc.hidden ||
      doc.hasFocus?.() === false ||
      scope !== getScope() ||
      root !== getRoot() ||
      !readingCurrent()
    )
      return false;
    const owner = reading;
    readingMessage(readingHint(), owner);
    return true;
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
    nativeScroll = null;
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
    if (reading) {
      const owner = reading;
      readingMessage(readingHint(), owner);
    }
    return !!reading;
  }
  function relinquish() {
    cancelEdit('Controller edit cancelled.');
    cancelReading({ invalidated: true });
    engaged = false;
    mark(null);
  }
  function nativeReaderCurrent(owner, event) {
    if (
      !nativeReadingScroll ||
      !owner ||
      reading !== owner ||
      destroyed ||
      doc.hidden ||
      doc.hasFocus?.() === false ||
      getScope() !== owner.scope ||
      getRoot() !== owner.root ||
      !owner.region.contains(event.target) ||
      !readingCurrent(owner)
    )
      return false;
    // Visibility/acceptance reads can synchronously retire this exact owner.
    return (
      getScope() === owner.scope &&
      getRoot() === owner.root &&
      !doc.hidden &&
      doc.hasFocus?.() !== false &&
      !destroyed &&
      reading === owner &&
      doc.activeElement === owner.region
    );
  }
  listen('pointerdown', (event) => {
    nativeScroll = null;
    const owner = reading;
    if (
      (event.button === undefined || event.button === 0) &&
      event.isPrimary !== false &&
      event.cancelable !== false &&
      !event.defaultPrevented &&
      nativeReaderCurrent(owner, event)
    ) {
      // Preserve the browser's native pan/selection default and the stable Done
      // action. Only this pointer and exact reader can survive scroll adoption.
      nativeScroll = { owner, pointerId: event.pointerId };
      onNativeInput(event);
      if (!nativeReaderCurrent(owner, event)) {
        nativeScroll = null;
        if (reading === owner) relinquish();
      }
      return;
    }
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
  if (nativeReadingScroll)
    listen('pointerup', (event) => {
      if (nativeScroll?.pointerId === event.pointerId) nativeScroll = null;
    });
  listen('pointercancel', (event) => {
    const gesture = nativeScroll;
    nativeScroll = null;
    if (
      gesture &&
      gesture.pointerId === event.pointerId &&
      event.isPrimary !== false &&
      !event.defaultPrevented &&
      nativeReaderCurrent(gesture.owner, event)
    )
      return;
    if (reading) relinquish();
  });
  listen('keydown', (event) => {
    // Explicit host capture owns these keys before document-level menu navigation.
    // Relinquish stale previews without consuming the event or moving focus.
    if (keyboard && ownsKeyboardEvent(event)) {
      relinquish();
      onNativeInput(event);
      return;
    }
    // Shift arrives before a real Shift+Tab. Preserve only its current reader;
    // it is not itself a navigation action and must keep native modifier behavior.
    const reader = reading;
    if (
      keyboard &&
      event.key === 'Shift' &&
      !event.defaultPrevented &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey &&
      readingCurrent(reader) &&
      !destroyed &&
      !doc.hidden &&
      doc.hasFocus?.() !== false &&
      getScope() === reader.scope &&
      getRoot() === reader.root &&
      reading === reader
    ) {
      onNativeInput(event);
      return;
    }
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
    if (
      reading &&
      event.target !== reading.region &&
      !(event.target === reading.exit && readingCurrent())
    )
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
    if (reading && !readingCurrent()) {
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
    const journeyGrid = current.closest('#journey-cards');
    if (journeyGrid) {
      // Read the rendered rows on every edge: filtering, zoom and rotation may
      // change columns without replacing the focused mission. Card heights are
      // not reliable row markers because their authored text can differ.
      const entries = items
        .filter((element) => journeyGrid.contains(element))
        .map((element) => ({ element, rect: element.getBoundingClientRect() }))
        .sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
      const rows = [];
      for (const entry of entries) {
        const row = rows.at(-1);
        if (row && Math.abs(row[0].rect.y - entry.rect.y) <= 1) row.push(entry);
        else rows.push([entry]);
      }
      const rowIndex = rows.findIndex((row) => row.some(({ element }) => element === current)),
        row = rows[rowIndex],
        from = row.find(({ element }) => element === current).rect,
        cx = from.x + from.width / 2;
      const horizontal = direction === 'left' || direction === 'right',
        step = direction === 'down' || direction === 'right' ? 1 : -1,
        candidates = horizontal ? row : rows[rowIndex + step];
      if (candidates) {
        const next = candidates
          .map(({ element, rect }) => ({ element, dx: rect.x + rect.width / 2 - cx }))
          .filter(({ element, dx }) => element !== current && (!horizontal || dx * step > 1))
          .sort((a, b) => Math.abs(a.dx) - Math.abs(b.dx))[0];
        if (next) focus(next.element);
      } else if (!horizontal) {
        // Top/bottom exits reach adjacent menu controls without wrapping to a
        // different mission. Left/right row edges always retain the selection.
        const gridItems = items.filter((element) => journeyGrid.contains(element)),
          edge = step < 0 ? gridItems[0] : gridItems.at(-1),
          next = items[items.indexOf(edge) + step];
        if (next && !journeyGrid.contains(next)) focus(next);
      }
      return;
    }
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
    const owner = reading;
    if (direction !== 'up' && direction !== 'down') {
      readingMessage(readingHint(), owner);
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
      readingMessage(
        `${boundary === 'all' ? 'All text is visible.' : boundary === 'start' ? 'Start of details.' : 'End of details.'} ${readingHint()}`,
        owner,
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
    const leavingReader = !!reading && event.key === 'Tab';
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
      // A focused Done keeps native button activation; its host click is end-only.
      if (doc.activeElement === reading.exit && ['Enter', ' '].includes(event.key)) return true;
      if (['Enter', ' ', 'Escape'].includes(event.key)) {
        event.preventDefault();
        endReading();
        return true;
      }
      if (event.key === 'Tab') {
        const owner = reading;
        if (owner.exit && visible(owner.exit)) {
          const stops = [...root.querySelectorAll(`${CONTROLS},[tabindex]`)]
            .filter((element) => element.tabIndex >= 0 && visible(element))
            .sort((a, b) => (a.tabIndex || Infinity) - (b.tabIndex || Infinity));
          const current = stops.indexOf(doc.activeElement),
            next = stops[current + (event.shiftKey ? -1 : 1)],
            paired = doc.activeElement === owner.region ? owner.exit : owner.region;
          // Preserve only adjacent text/Done traversal. Other controls retain
          // native order and leave reading; this is neither a trap nor a launch.
          if (
            current >= 0 &&
            next === paired &&
            !destroyed &&
            !doc.hidden &&
            doc.hasFocus?.() !== false &&
            getScope() === owner.scope &&
            getRoot() === owner.root &&
            readingCurrent(owner)
          ) {
            event.preventDefault();
            focus(next);
            return true;
          }
          if (reading !== owner) {
            event.preventDefault();
            return true;
          }
          if (doc.activeElement === owner.exit && current >= 0 && next) {
            // Ending disables Done. Capture its real neighbor first so this
            // Tab cannot skip a control after the native focus owner disappears.
            event.preventDefault();
            endReading({ restoreFocus: false });
            if (
              !reading &&
              !destroyed &&
              !doc.hidden &&
              doc.hasFocus?.() !== false &&
              getScope() === owner.scope &&
              getRoot() === owner.root &&
              (doc.activeElement === owner.exit || doc.activeElement === doc.body)
            )
              focus(next);
            return true;
          }
        }
        endReading({ restoreFocus: false });
      } else return false;
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
      // Roving tab lists expose only their selected item to sequential keys.
      // Spatial and controller traversal still uses every visible control.
      const tabStops = items.filter((element) => element.tabIndex >= 0),
        currentTab = tabStops.indexOf(doc.activeElement);
      if (!tabStops.length) return false;
      // Only a registered embedded host may transfer focus at a nonmodal edge.
      // Interior traversal, native modal containment and ordinary games retain
      // their existing behavior. A reader exits through its own path above.
      const boundary = event.shiftKey ? 0 : tabStops.length - 1;
      if (!leavingReader && currentTab === boundary) {
        const exit = onTabBoundary({ backward: !!event.shiftKey });
        if (exit === true || exit === 'native') {
          if (exit === true) event.preventDefault();
          relinquish();
          // A registered Playground frame uses browser sequential traversal.
          // Controller practice retains its synchronous, consumed handoff.
          return exit === true;
        }
      }
      event.preventDefault();
      relinquish();
      // An arrow/controller may have focused a tabindex=-1 item. Continue from
      // its actual position before wrapping to an eligible sequential stop.
      const remaining = event.shiftKey
        ? items.slice(0, current < 0 ? items.length : current).reverse()
        : items.slice(current + 1);
      const next =
        remaining.find((element) => element.tabIndex >= 0) ||
        (event.shiftKey ? tabStops.at(-1) : tabStops[0]);
      focus(next);
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
    refreshReadingHint,
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
