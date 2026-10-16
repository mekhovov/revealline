/** Menu navigation only: never loaded into a running simulator. */
export function mountPracticeNavigation({
  document: doc = globalThis.document,
  window: win = globalThis,
  navigator: nav = globalThis.navigator,
} = {}) {
  let timer = null,
    prior = '',
    marked = null;
  const controls = () =>
    [...doc.querySelectorAll('a[href],button,select,summary')].filter(
      (element) =>
        !element.disabled &&
        !element.closest('[hidden],[inert]') &&
        element.getClientRects().length,
    );
  function focus(delta) {
    const items = controls();
    if (!items.length) return;
    const index = items.indexOf(doc.activeElement);
    const target =
      items[
        (index < 0 ? (delta < 0 ? items.length - 1 : 0) : index + delta + items.length) %
          items.length
      ];
    marked?.removeAttribute('data-practice-focus');
    marked = target;
    target.setAttribute('data-practice-focus', '');
    target.focus();
    target.scrollIntoView({ block: 'nearest' });
  }
  function poll() {
    if (!doc.hidden && doc.hasFocus()) {
      let pad;
      try {
        pad = [...(nav?.getGamepads?.() ?? [])].find(
          (pad) => pad?.connected && pad.mapping === 'standard',
        );
      } catch {
        /* Denied gamepad access must not break keyboard/touch navigation. */
      }
      const pressed = (index) => pad?.buttons[index]?.pressed;
      const next =
        pressed(12) || pressed(14)
          ? 'previous'
          : pressed(13) || pressed(15)
            ? 'next'
            : pressed(0)
              ? 'activate'
              : '';
      if (next && next !== prior) {
        if (next === 'activate') {
          const target = doc.activeElement;
          if (controls().includes(target)) {
            if (target.tagName === 'SELECT') {
              target.selectedIndex = (target.selectedIndex + 1) % target.options.length;
              target.dispatchEvent(new Event('change', { bubbles: true }));
            } else target.click();
          } else focus(1);
        } else focus(next === 'next' ? 1 : -1);
      }
      prior = next;
    } else prior = '';
    timer = win.setTimeout(poll, 80);
  }
  const start = () => {
    if (timer === null) poll();
  };
  const stop = () => {
    win.clearTimeout(timer);
    timer = null;
    prior = '';
    marked?.removeAttribute('data-practice-focus');
  };
  win.addEventListener('gamepadconnected', start);
  win.addEventListener('pagehide', stop);
  win.addEventListener('pageshow', start);
  start();
  return () => {
    stop();
    win.removeEventListener('gamepadconnected', start);
    win.removeEventListener('pagehide', stop);
    win.removeEventListener('pageshow', start);
  };
}
