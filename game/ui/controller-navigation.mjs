const CONTROLS = 'button,a[href],select,input:not([type="hidden"]),textarea,summary';
const DIRECTIONS = new Set(['up', 'right', 'down', 'left']);

/** Controller edges operate existing DOM controls; this adapter never polls a
 * device, changes game state, or bypasses a host's guarded Back operation. */
export function attachControllerNavigation({
  document: doc = globalThis.document,
  getScope = () => 'ui',
  getRoot = () => doc,
  getDefaultFocus = () => null,
  accept = () => true,
  onBack = () => {},
  onMenu = () => {},
  onHint = () => {},
} = {}) {
  let scope = null,
    root = null,
    engaged = false,
    focused = null,
    editing = null,
    destroyed = false,
    focusing = false;
  const listeners = [];
  const listen = (type, fn) => {
    doc.addEventListener(type, fn, true);
    listeners.push(() => doc.removeEventListener(type, fn, true));
  };
  const hint = (message) => onHint(message);
  function visible(element) {
    if (!element || !element.isConnected || element.disabled || !root?.contains(element))
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
  function relinquish() {
    cancelEdit('Controller edit cancelled.');
    engaged = false;
    mark(null);
  }
  listen('pointerdown', relinquish);
  listen('keydown', relinquish);
  listen('focusin', (event) => {
    if (focusing) return;
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
    let invalidated = false;
    const nextScope = getScope(),
      nextRoot = getRoot();
    if (scope !== nextScope || root !== nextRoot) {
      invalidated = scope !== null;
      cancelEdit();
      scope = nextScope;
      root = nextRoot;
      mark(null);
      if (engaged && scope !== 'flight') ensureFocus();
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
      mark(null);
    } else if (
      engaged &&
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
    editing.preview.textContent = `${editing.label}: ${value} · D-pad changes · South confirms · East cancels`;
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
  function handle(command = {}) {
    if (destroyed) return;
    if (sync()) return;
    if (scope === 'flight') return;
    if (!command.confirm && !command.back && !command.menu && !DIRECTIONS.has(command.direction))
      return;
    engaged = true;
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
    engage() {
      if (destroyed) return;
      sync();
      if (scope === 'flight') return;
      engaged = true;
      ensureFocus();
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
