import { registerAuthoringEditor } from '../../../../../game/ui/authoring-editors.mjs';
const clamp = (n, max) => Math.max(0, Math.min(max, n));
const visible = (node) =>
  node?.isConnected && !node.closest('[hidden],[inert]') && node.getClientRects().length > 0;

/** Keep labeled specimens and native images at their true CSS sizes. The reference navigator owns
 * all commands; this adapter moves only its selected, bounded preview region. */
export function attachPreparedRevealReaders({
  document: doc,
  window: win = doc.defaultView,
  navigation,
  targets,
}) {
  const entries = [];
  let disposed = false;
  for (const { read, region } of targets) {
    let active = false;
    const current = () =>
      !disposed &&
      active &&
      !doc.hidden &&
      doc.hasFocus?.() !== false &&
      doc.activeElement === read &&
      visible(region) &&
      !doc.querySelector('dialog[open]');
    const exit = () => {
      active = false;
      read.setAttribute('aria-pressed', 'false');
      region.removeAttribute('data-prepared-reveal-reading');
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
          read.disabled ||
          doc.hidden ||
          doc.hasFocus?.() === false ||
          doc.activeElement !== read ||
          !visible(region) ||
          doc.querySelector('dialog[open]')
        )
          return false;
        active = true;
        read.setAttribute('aria-pressed', 'true');
        region.setAttribute('data-prepared-reveal-reading', 'true');
        region.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
        return true;
      },
      isCurrent: current,
      focus: () => read.focus({ preventScroll: true }),
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
    const unregister = registerAuthoringEditor(read, adapter);
    read.removeAttribute('data-controller-editor');
    const click = () => {
      if (!disposed && !doc.hidden && doc.hasFocus?.() !== false && doc.activeElement === read)
        navigation.handle({ confirm: true });
    };
    read.addEventListener('click', click);
    exit();
    entries.push({ read, click, exit, unregister });
  }
  const invalidate = () => entries.forEach(({ exit }) => exit());
  const hidden = () => {
    if (doc.hidden) invalidate();
  };
  win.addEventListener('blur', invalidate);
  win.addEventListener('pagehide', invalidate);
  doc.addEventListener('visibilitychange', hidden);
  return {
    destroy() {
      if (disposed) return;
      disposed = true;
      invalidate();
      entries.forEach(({ read, click, unregister }) => {
        unregister();
        read.removeEventListener('click', click);
      });
      win.removeEventListener('blur', invalidate);
      win.removeEventListener('pagehide', invalidate);
      doc.removeEventListener('visibilitychange', hidden);
    },
  };
}
