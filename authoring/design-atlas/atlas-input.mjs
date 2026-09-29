import { localizedAttribute, onLocaleChange } from '../../game/i18n/index.mjs';
import { authoringLabel, authoringText } from '../../game/ui/authoring-copy.mjs';
import { registerAuthoringEditor } from '../../game/ui/authoring-editors.mjs';
import { mountAuthoringInputHost } from '../../game/ui/authoring-input-host.mjs';
import { setMenuIcon } from '../../game/ui/native-menu-icons.mjs';

const owners = new WeakMap();
const clamp = (value, max) => Math.max(0, Math.min(max, value));
const visible = (element) =>
  element?.isConnected &&
  !element.closest('[hidden],[inert],details:not([open])') &&
  element.getClientRects().length > 0;

/** A read-only scroll surface, entered through a real button. It never forwards
 * commands to mock screen actions, changes content, or opens a second poller. */
export function createAtlasReadAdapter({
  element,
  resolveTarget,
  window: win = element.ownerDocument.defaultView,
  document: doc = element.ownerDocument,
  mode = 'window',
}) {
  let active = false,
    target = null,
    nested = false;
  const foreground = () => !doc.hidden && doc.hasFocus?.() !== false;
  const current = () =>
    active &&
    foreground() &&
    doc.activeElement === element &&
    visible(element) &&
    visible(target) &&
    resolveTarget() === target &&
    !doc.querySelector('dialog[open]');
  const exit = () => {
    active = false;
    element.setAttribute('aria-pressed', 'false');
    target?.removeAttribute('data-atlas-reading');
    target = null;
  };
  const move = (dx, dy, edge) => {
    if (!current()) return;
    if (nested) {
      const maxX = Math.max(0, target.scrollWidth - target.clientWidth),
        maxY = Math.max(0, target.scrollHeight - target.clientHeight);
      target.scrollLeft = clamp(
        target.scrollLeft + dx * Math.max(80, target.clientWidth * 0.6),
        maxX,
      );
      target.scrollTop =
        edge === 'start'
          ? 0
          : edge === 'end'
            ? maxY
            : clamp(target.scrollTop + dy * Math.max(80, target.clientHeight * 0.6), maxY);
    } else {
      const top = win.scrollY || 0,
        rect = target.getBoundingClientRect(),
        page = doc.scrollingElement || doc.documentElement,
        pageMax = Math.max(0, page.scrollHeight - win.innerHeight),
        first = clamp(top + rect.top, pageMax),
        last = Math.max(first, clamp(top + rect.bottom - win.innerHeight, pageMax)),
        next =
          edge === 'start'
            ? first
            : edge === 'end'
              ? last
              : top + dy * Math.max(80, win.innerHeight * 0.6);
      // Keep the requested section in view; horizontal commands are reserved
      // for the explicit matrix/brief nested scrollers.
      if (dy || edge)
        win.scrollTo({
          left: win.scrollX || 0,
          top: Math.max(first, Math.min(last, next)),
          behavior: 'instant',
        });
    }
  };
  return {
    enter() {
      const next = resolveTarget();
      if (
        !foreground() ||
        doc.activeElement !== element ||
        !visible(element) ||
        !visible(next) ||
        doc.querySelector('dialog[open]')
      )
        return false;
      target = next;
      nested =
        mode === 'element' ||
        (mode === 'preview' && /auto|scroll/.test(win.getComputedStyle(target).overflowY));
      active = true;
      element.setAttribute('aria-pressed', 'true');
      target.setAttribute('data-atlas-reading', 'true');
      target.scrollIntoView({
        block: nested ? 'nearest' : 'start',
        inline: 'nearest',
        behavior: 'instant',
      });
      return true;
    },
    isCurrent: current,
    focus: () => element.focus({ preventScroll: true }),
    handle(command) {
      if (!current()) return 'cancel';
      if (command.back || command.menu) return 'cancel';
      if (command.confirm || command.confirmCommit) return 'done';
      const vector = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[command.direction];
      if (vector) move(...vector);
    },
    keydown(event) {
      if (
        !current() ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        !['Home', 'End', 'PageUp', 'PageDown'].includes(event.key)
      )
        return false;
      event.preventDefault();
      if (event.key === 'Home' || event.key === 'End')
        move(0, 0, event.key === 'Home' ? 'start' : 'end');
      else move(0, event.key === 'PageUp' ? -1 : 1);
      return true;
    },
    exit,
  };
}

export function attachAtlasInput({
  document: doc = globalThis.document,
  window: win = doc.defaultView ?? globalThis.window,
  host = mountAuthoringInputHost({ document: doc, window: win }),
} = {}) {
  if (owners.has(doc)) return owners.get(doc);
  const entries = [],
    targets = new Map(),
    headings = new Map(),
    tabStops = new Map();
  let disposed = false;
  const add = ({
    id,
    label,
    region,
    before,
    after,
    mode = 'window',
    resolveTarget = () => region,
  }) => {
    const button = doc.createElement('button'),
      help = doc.createElement('span');
    button.id = id;
    button.type = 'button';
    button.className = 'atlas-read-control';
    button.setAttribute('aria-pressed', 'false');
    help.id = `${id}-help`;
    help.className = 'atlas-read-help';
    authoringLabel(help, 'readHelp');
    button.setAttribute('aria-describedby', help.id);
    authoringLabel(button, 'readPage');
    localizedAttribute(
      button,
      'aria-label',
      () => `${authoringText('readPage')} — ${label().trim()}`,
    );
    setMenuIcon(button, 'content');
    if (before) before.before(button);
    else after.after(button);
    button.after(help);
    const adapter = createAtlasReadAdapter({
      element: button,
      resolveTarget,
      document: doc,
      window: win,
      mode,
    });
    const unregister = registerAuthoringEditor(button, adapter);
    // This is already a native button, so ordinary menu arrows must remain
    // available before entering. The WeakMap registration still resolves its
    // controller adapter; the canvas-only native-key marker is unnecessary.
    button.removeAttribute('data-controller-editor');
    // Native Enter/Space first dispatch the button's own click. Registering the
    // generic keyboard editor would enter and immediately confirm/exit instead.
    button.onclick = () => {
      if (!disposed && !doc.hidden && doc.hasFocus?.() !== false && doc.activeElement === button)
        host.navigation.handle({ confirm: true });
    };
    entries.push({ button, help, adapter, unregister, label });
    targets.set(region, button);
    return button;
  };
  for (const section of doc.querySelectorAll('main .atlas-section')) {
    const heading = section.querySelector('h2');
    if (!heading) continue;
    const key = section.id || heading.id.replace(/-title$/, '');
    if (key === 'studies') {
      const preview = doc.getElementById('screen-preview');
      const button = add({
        id: 'atlas-read-preview',
        label: () => preview.getAttribute('aria-label') || heading.textContent,
        region: section,
        before: doc.getElementById('screen-stage'),
        mode: 'preview',
        resolveTarget: () => preview.querySelector('.mock-screen'),
      });
      targets.set(section, button);
    } else if (key === 'coverage') {
      const matrix = section.querySelector('.matrix-wrap');
      add({
        id: 'atlas-read-matrix',
        label: () => matrix.getAttribute('aria-label') || heading.textContent,
        region: section,
        before: matrix,
        mode: 'element',
        resolveTarget: () => matrix,
      });
      matrix.classList.add('atlas-read-scroll');
      // The explicit reader owns both axes; avoid a second inert Tab stop.
      tabStops.set(matrix, matrix.getAttribute('tabindex'));
      matrix.removeAttribute('tabindex');
    } else
      add({
        id: `atlas-read-${key}`,
        label: () => heading.textContent,
        region: section,
        after: heading,
      });
  }
  for (const [index, article] of [...doc.querySelectorAll('#direction article')].entries()) {
    const heading = article.querySelector('h3');
    if (heading)
      add({
        id: `atlas-read-direction-${index + 1}`,
        label: () => heading.textContent,
        region: article,
        after: heading,
      });
  }
  const brief = doc.getElementById('prompt-example-text');
  if (brief) {
    const details = brief.closest('details'),
      summary = details.querySelector('summary');
    add({
      id: 'atlas-read-brief',
      label: () => summary.textContent,
      region: details,
      before: brief,
      mode: 'element',
      resolveTarget: () => brief,
    });
    brief.classList.add('atlas-read-scroll');
  }
  function refresh() {
    if (disposed) return;
    for (const heading of headings.keys()) if (!heading.isConnected) headings.delete(heading);
    for (const heading of doc.querySelectorAll('main h2,main h3')) {
      const region = heading.closest('section,fieldset,details,article'),
        target = targets.get(region);
      if (!target) continue;
      if (!headings.has(heading))
        headings.set(heading, heading.getAttribute('data-authoring-target'));
      heading.setAttribute('data-authoring-target', target.id);
    }
    for (const { button, label } of entries)
      button.setAttribute('aria-label', `${authoringText('readPage')} — ${label().trim()}`);
  }
  const invalidate = () => entries.forEach(({ adapter }) => adapter.exit());
  const locale = onLocaleChange(() => () => refresh(), { before: true });
  const hidden = () => {
    if (doc.hidden) invalidate();
  };
  const hide = (event) => {
    if (event.persisted) invalidate();
    else owner.destroy();
  };
  win.addEventListener('blur', invalidate);
  win.addEventListener('pagehide', hide);
  doc.addEventListener('visibilitychange', hidden);
  const owner = {
    refresh,
    invalidate,
    destroy() {
      if (disposed) return;
      disposed = true;
      invalidate();
      locale();
      win.removeEventListener('blur', invalidate);
      win.removeEventListener('pagehide', hide);
      doc.removeEventListener('visibilitychange', hidden);
      for (const { button, help, unregister } of entries) {
        unregister();
        button.onclick = null;
        button.remove();
        help.remove();
      }
      for (const [heading, previous] of headings) {
        if (previous === null) heading.removeAttribute('data-authoring-target');
        else heading.setAttribute('data-authoring-target', previous);
      }
      for (const [element, previous] of tabStops) {
        if (previous === null) element.removeAttribute('tabindex');
        else element.setAttribute('tabindex', previous);
      }
      for (const element of doc.querySelectorAll('.atlas-read-scroll'))
        element.classList.remove('atlas-read-scroll');
      owners.delete(doc);
    },
  };
  owners.set(doc, owner);
  refresh();
  return owner;
}
