import { t } from '../i18n/index.mjs';
const TAB_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  t('common:navigation.home'),
  t('interface:end'),
]);
const owns = (root, doc, list, { tab, panel }) =>
  root?.ownerDocument === doc &&
  doc?.contains(root) &&
  root.contains(list) &&
  list.contains(tab) &&
  tab.closest('.field-kit-settings-tabs') === list &&
  tab.ownerDocument === doc &&
  !!tab.id &&
  panel?.ownerDocument === doc &&
  panel !== root &&
  root.contains(panel) &&
  !panel.contains(list) &&
  doc.getElementById(tab.getAttribute('aria-controls')) === panel;
const enabled = ({ tab }) =>
  !tab.disabled && !tab.hidden && tab.getAttribute('aria-disabled') !== 'true';

/** Document-level menu adapters yield these keys to the tab's native listener. */
export function settingsTabOwnsKey(event, root) {
  if (
    !TAB_KEYS.has(event?.key) ||
    event.defaultPrevented ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey
  )
    return false;
  const tab = event.target?.closest?.('[role="tab"]'),
    doc = root?.ownerDocument,
    list = root?.querySelector?.('.field-kit-settings-tabs'),
    panel = tab && doc?.getElementById(tab.getAttribute('aria-controls')),
    record = { tab, panel };
  return !!(
    tab &&
    list &&
    owns(root, doc, list, record) &&
    enabled(record) &&
    !tab.closest('[hidden],[inert],[aria-hidden="true"]') &&
    tab.getClientRects().length &&
    doc.defaultView?.getComputedStyle(tab)?.visibility !== 'hidden'
  );
}

/** Category presentation only. Hosts retain all preference, input and save ownership. */
export function attachSettingsPanels({
  root,
  document: doc = globalThis.document,
  beforeSelect = () => false,
} = {}) {
  const list = root?.querySelector?.('.field-kit-settings-tabs'),
    records = [...(list?.querySelectorAll('[role="tab"]') ?? [])].map((tab) => ({
      tab,
      panel: doc?.getElementById(tab.getAttribute('aria-controls')),
    })),
    removers = [];
  let destroyed = false,
    current = null,
    generation = 0;
  const owned = (record) => !destroyed && owns(root, doc, list, record);
  const available = () => records.filter((record) => owned(record) && enabled(record));
  function paint(next) {
    for (const record of records.filter(owned)) {
      const selected = record === next;
      record.tab.setAttribute('aria-selected', String(selected));
      record.tab.setAttribute('tabindex', selected ? '0' : '-1');
      record.panel.hidden = !selected;
      record.panel.inert = !selected;
    }
    current = next;
  }
  function select(id, { focus = false } = {}) {
    const next = available().find(({ tab }) => tab.id === id);
    if (!next) return false;
    const ticket = ++generation,
      returnFocus = beforeSelect(next.tab) === true;
    // A host hook may retire this surface, disable the target or start a newer selection.
    if (ticket !== generation || !owned(next) || !enabled(next)) return false;
    paint(next);
    if (focus || returnFocus) next.tab.focus();
    return true;
  }
  const initial = available();
  if (initial.length)
    paint(initial.find(({ tab }) => tab.getAttribute('aria-selected') === 'true') || initial[0]);
  for (const record of records) {
    const { tab } = record;
    const click = () => select(tab.id);
    const keydown = (event) => {
      if (!owned(record) || !settingsTabOwnsKey(event, root)) return;
      const tabs = available(),
        index = tabs.indexOf(record),
        direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0,
        next =
          event.key === 'Home'
            ? tabs[0]
            : event.key === 'End'
              ? tabs.at(-1)
              : direction
                ? tabs[(index + direction + tabs.length) % tabs.length]
                : null;
      if (!next) return;
      event.preventDefault();
      event.stopPropagation();
      select(next.tab.id, { focus: true });
    };
    tab.addEventListener('click', click);
    tab.addEventListener('keydown', keydown);
    removers.push(() => {
      tab.removeEventListener('click', click);
      tab.removeEventListener('keydown', keydown);
    });
  }
  return Object.freeze({
    select,
    selected: () => (current && owned(current) ? current.tab.id : null),
    primary: () => (current && owned(current) ? current.tab : null),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      generation++;
      removers.forEach((remove) => remove());
    },
  });
}
