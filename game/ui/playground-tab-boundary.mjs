/** UI-only escape for the named, same-origin Playground preview; no input transport. */
export function playgroundTabBoundary({ window: child = globalThis.window, suspend } = {}) {
  const current = () => {
    const frame = child?.frameElement,
      parent = child?.parent;
    if (!frame || !parent || parent === child || child.name !== 'revealline-playground-preview')
      return false;
    const document = frame.ownerDocument;
    const parentURL = new URL(parent.location.href);
    return (
      child.location.origin !== 'null' &&
      parentURL.origin === child.location.origin &&
      /\/game\/playground\/(?:index\.html)?$/.test(parentURL.pathname) &&
      frame.id === 'preview-frame' &&
      frame.name === child.name &&
      frame.contentWindow === child &&
      document.defaultView === parent &&
      document.activeElement === frame &&
      frame.isConnected &&
      !document.hidden &&
      document.hasFocus?.() !== false &&
      !child.document.hidden &&
      child.document.hasFocus?.() !== false &&
      !frame.closest('[hidden],[inert],[aria-hidden="true"]') &&
      frame.getClientRects().length > 0
    );
  };
  let accepted = false;
  try {
    if (typeof suspend !== 'function' || !current()) return false;
    const focused = child.document.activeElement;
    accepted = true;
    suspend();
    // A callback may retire the frame. Consume that key rather than traversing
    // a replacement document or stealing a newer parent focus choice.
    return current() && child.document.activeElement === focused ? 'native' : true;
  } catch {
    return accepted;
  }
}
