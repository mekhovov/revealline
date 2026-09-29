import { localizedAttribute, onLocaleChange } from '../../game/i18n/index.mjs';
import { authoringLabel, authoringText } from '../../game/ui/authoring-copy.mjs';
import { registerAuthoringEditor } from '../../game/ui/authoring-editors.mjs';
import { mountAuthoringInputHost } from '../../game/ui/authoring-input-host.mjs';
import { setMenuIcon } from '../../game/ui/native-menu-icons.mjs';

const owners = new WeakMap();
const visible = (node) =>
  node?.isConnected && !node.closest('[hidden],[inert]') && node.getClientRects().length > 0;
const clamp = (value, max) => Math.max(0, Math.min(max, value));

/** Parent-only scrolling. The shared owner still owns every command and the
 * explicit Enter preview/Return handoff; no input is forwarded to the game. */
export function attachViewportInput({
  document: doc = globalThis.document,
  window: win = doc.defaultView ?? globalThis.window,
  host = mountAuthoringInputHost({ document: doc, window: win }),
} = {}) {
  if (owners.has(doc)) return owners.get(doc);
  const entries = [];
  let disposed = false;
  for (const [key, regionId, headingId] of [
    ['stage', 'stage', 'viewport-preview-title'],
    ['notes', 'viewport-notes-region', 'viewport-notes-title'],
  ]) {
    const region = doc.getElementById(regionId),
      heading = doc.getElementById(headingId);
    if (!region || !heading) continue;
    const button = doc.createElement('button'),
      help = doc.createElement('span');
    button.type = 'button';
    button.id = `viewport-read-${key}`;
    button.className = 'viewport-read-control';
    button.setAttribute('aria-pressed', 'false');
    authoringLabel(button, 'readPage');
    setMenuIcon(button, 'content');
    localizedAttribute(
      button,
      'aria-label',
      () => `${authoringText('readPage')} — ${heading.textContent.trim()}`,
    );
    help.id = `${button.id}-help`;
    help.className = 'viewport-read-help';
    authoringLabel(help, 'readHelp');
    button.setAttribute('aria-describedby', help.id);
    heading.after(button);
    button.after(help);
    const originalTabIndex = region.getAttribute('tabindex');
    region.removeAttribute('tabindex');
    let active = false;
    const current = () =>
      !disposed &&
      active &&
      !doc.hidden &&
      doc.hasFocus?.() !== false &&
      doc.activeElement === button &&
      visible(button) &&
      visible(region) &&
      !doc.querySelector('dialog[open]');
    const exit = () => {
      active = false;
      button.setAttribute('aria-pressed', 'false');
      region.removeAttribute('data-viewport-reading');
    };
    const move = (dx, dy, edge) => {
      if (!current()) return;
      const maxX = Math.max(0, region.scrollWidth - region.clientWidth),
        maxY = Math.max(0, region.scrollHeight - region.clientHeight);
      region.scrollLeft =
        edge === 'start'
          ? 0
          : edge === 'end'
            ? maxX
            : clamp(region.scrollLeft + dx * Math.max(80, region.clientWidth * 0.6), maxX);
      region.scrollTop =
        edge === 'start'
          ? 0
          : edge === 'end'
            ? maxY
            : clamp(region.scrollTop + dy * Math.max(80, region.clientHeight * 0.6), maxY);
    };
    const adapter = {
      enter() {
        if (
          disposed ||
          doc.hidden ||
          doc.hasFocus?.() === false ||
          doc.activeElement !== button ||
          !visible(region) ||
          doc.querySelector('dialog[open]')
        )
          return false;
        active = true;
        button.setAttribute('aria-pressed', 'true');
        region.setAttribute('data-viewport-reading', 'true');
        region.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
        return true;
      },
      isCurrent: current,
      focus: () => button.focus({ preventScroll: true }),
      handle(command) {
        if (!current() || command.back || command.menu) return 'cancel';
        if (command.confirm || command.confirmCommit) return 'done';
        const vector = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[
          command.direction
        ];
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
    const unregister = registerAuthoringEditor(button, adapter);
    // Native buttons enter on their ordinary click. The canvas keyboard marker
    // would treat the first Enter as both entry and completion.
    button.removeAttribute('data-controller-editor');
    button.onclick = () => {
      if (!disposed && !doc.hidden && doc.hasFocus?.() !== false && doc.activeElement === button)
        host.navigation.handle({ confirm: true });
    };
    entries.push({ button, help, heading, region, originalTabIndex, exit, unregister });
  }
  const locale = onLocaleChange(
    () => () => {
      if (!disposed)
        for (const { button, heading } of entries)
          button.setAttribute(
            'aria-label',
            `${authoringText('readPage')} — ${heading.textContent.trim()}`,
          );
    },
    { before: true },
  );
  const invalidate = () => entries.forEach(({ exit }) => exit());
  const hidden = () => {
    if (doc.hidden) invalidate();
  };
  const pagehide = (event) => {
    if (event.persisted) invalidate();
    else owner.destroy();
  };
  win.addEventListener('blur', invalidate);
  win.addEventListener('pagehide', pagehide);
  doc.addEventListener('visibilitychange', hidden);
  const owner = {
    destroy() {
      if (disposed) return;
      disposed = true;
      invalidate();
      locale();
      win.removeEventListener('blur', invalidate);
      win.removeEventListener('pagehide', pagehide);
      doc.removeEventListener('visibilitychange', hidden);
      for (const { button, help, region, originalTabIndex, unregister } of entries) {
        unregister();
        button.onclick = null;
        button.remove();
        help.remove();
        if (originalTabIndex === null) region.removeAttribute('tabindex');
        else region.setAttribute('tabindex', originalTabIndex);
      }
      owners.delete(doc);
    },
  };
  owners.set(doc, owner);
  return owner;
}
