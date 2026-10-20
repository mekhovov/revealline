/** A complete live message must fit the actual field, without covering an
 * accepted reward/cache notice or a visible native control. No text estimate. */
export function overflightCaptionFits({ document: doc, panel }) {
  const field = doc.querySelector('#render-host canvas') ?? doc.getElementById('render-host');
  const bounds = field?.getBoundingClientRect();
  const caption = panel.getBoundingClientRect();
  if (!bounds || !caption.width || !caption.height) return false;
  const viewport = { width: doc.defaultView.innerWidth, height: doc.defaultView.innerHeight };
  if (
    caption.left < Math.max(0, bounds.left) ||
    caption.top < Math.max(0, bounds.top) ||
    caption.right > Math.min(viewport.width, bounds.right) ||
    caption.bottom > Math.min(viewport.height, bounds.bottom)
  )
    return false;
  return ![
    ...doc.querySelectorAll(
      '#hud-cache, #hud-reward, #overflight-field-status, .overflight-riy-controls button, .overflight-touch button, .overflight-touch .shared-touch-surface, .overflight-touch .shared-touch-pad',
    ),
  ].some((node) => {
    if (node.closest('[hidden]') || !node.getClientRects().length) return false;
    const rect = node.getBoundingClientRect();
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      caption.left < rect.right &&
      caption.right > rect.left &&
      caption.top < rect.bottom &&
      caption.bottom > rect.top
    );
  });
}

/** Presentation only: retain the accepted nodes and their existing owners.
 * Instruments/actions stay live; persistent copy uses the existing Pause reader. */
export function createOverflightTextScalingView({
  document: doc,
  readingRoot,
  home = null,
  results = null,
  label,
  onLayoutChange = () => {},
}) {
  const game = doc.getElementById('overflight-game');
  const hud = doc.getElementById('overflight-hud');
  const squad = hud.querySelector('.overflight-riy-controls');
  const secondary = doc.createElement('div');
  secondary.id = 'overflight-flight-details';
  secondary.setAttribute('role', 'region');
  secondary.tabIndex = 0;
  const heading = doc.createElement('h3');
  heading.id = 'overflight-flight-details-title';
  secondary.setAttribute('aria-labelledby', heading.id);
  secondary.append(heading);
  const squadCopy = doc.createElement('div');
  squadCopy.className = 'overflight-riy-copy';
  const squadNodes = [squad?.querySelector('strong'), squad?.querySelector('small')].filter(
    Boolean,
  );
  const nodes = [
    ...squadNodes,
    doc.getElementById('hud-build'),
    hud.querySelector('[data-operation-context]'),
    doc.getElementById('overflight-music-now-playing'),
  ].filter(Boolean);
  const remember = (values) =>
    values.map((node) => ({ node, parent: node.parentNode, next: node.nextSibling }));
  const restore = (moves) => {
    for (const { node, parent, next } of [...moves].reverse())
      parent.insertBefore(node, next?.parentNode === parent ? next : null);
  };
  const moves = remember(nodes);
  const noticeNodes = ['hud-cache', 'hud-reward', 'overflight-commentator']
    .map((id) => doc.getElementById(id))
    .filter(Boolean);
  const noticeMoves = remember(noticeNodes);
  const notices = doc.createElement('div');
  notices.id = 'overflight-field-notices';
  notices.setAttribute('aria-live', 'off');
  const boostStatus = doc.getElementById('hud-boost'),
    squadStatus = squad?.querySelector('span');
  const statusNodes = [boostStatus, squadStatus].filter(Boolean);
  const summaryNodes = ['hud-level', 'hud-kills']
    .map((id) => doc.getElementById(id))
    .filter(Boolean);
  const summaryMoves = remember(summaryNodes);
  const status = doc.createElement('div');
  status.id = 'overflight-field-status';
  const win = doc.defaultView;
  const landscape = win.matchMedia?.('(min-width: 700px) and (max-height: 600px)');
  let enabled = false,
    disposed = false,
    statusMode = null,
    activeStatusMoves = [],
    summaryEnabled = false;
  function refreshTouchSummary() {
    const next = enabled && game.classList.contains('has-touch-layout');
    if (next === summaryEnabled) return;
    summaryEnabled = next;
    if (next) secondary.append(...summaryNodes);
    else restore(summaryMoves);
  }
  function refreshStatus() {
    const next =
      enabled && landscape?.matches === true
        ? game.classList.contains('has-touch-controls')
          ? 'touch'
          : 'overlay'
        : null;
    if (next === statusMode) return;
    const focused = doc.activeElement;
    const ownedFocus = squad?.contains(focused) || status.contains(focused);
    restore(activeStatusMoves);
    activeStatusMoves = [];
    status.remove();
    statusMode = next;
    if (next) {
      const current = [boostStatus, next === 'touch' ? squad : squadStatus].filter(Boolean);
      activeStatusMoves = remember(current);
      status.append(...current);
      game.insertBefore(status, doc.getElementById('render-host'));
    }
    if (
      ownedFocus &&
      focused?.isConnected &&
      doc.activeElement !== focused &&
      [doc.body, null].includes(doc.activeElement)
    )
      focused.focus({ preventScroll: true });
  }
  const surfaces = [home, results].filter(Boolean);
  let revealFrame = null,
    revealRevision = 0;
  const cancelReveal = () => {
    revealRevision++;
    if (revealFrame !== null) win.cancelAnimationFrame(revealFrame);
    revealFrame = null;
  };
  const revealFocusedSurface = () => {
    cancelReveal();
    const focused = doc.activeElement;
    const surface = surfaces.find((node) => node.open && node.contains(focused));
    if (!enabled || disposed || typeof win.requestAnimationFrame !== 'function') return;
    const revision = revealRevision;
    revealFrame = win.requestAnimationFrame(() => {
      if (revision !== revealRevision) return;
      revealFrame = null;
      onLayoutChange();
      if (
        enabled &&
        !disposed &&
        surface?.open &&
        surface.isConnected &&
        focused.isConnected &&
        doc.activeElement === focused &&
        surface.contains(focused)
      )
        focused.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  };
  const resized = () => {
    if (disposed) return;
    refreshTouchSummary();
    refreshStatus();
    revealFocusedSurface();
  };
  for (const surface of surfaces) surface.addEventListener('focusin', revealFocusedSurface);
  win.addEventListener('resize', resized);
  landscape?.addEventListener?.('change', resized);
  const observer =
    surfaces.length && typeof win.ResizeObserver === 'function'
      ? new win.ResizeObserver(revealFocusedSurface)
      : null;
  for (const surface of surfaces)
    observer?.observe(surface.querySelector('.landing-layout, .mode-play-content') ?? surface);
  function refresh(next) {
    if (disposed) return;
    heading.textContent = label();
    next = next === true;
    if (next === enabled) {
      refreshTouchSummary();
      refreshStatus();
      revealFocusedSurface();
      return;
    }
    const focused = doc.activeElement;
    const moved = [...nodes, ...noticeNodes, ...statusNodes];
    const retainFocus = moved.some((node) => node === focused || node.contains(focused));
    enabled = next;
    if (enabled) {
      if (squadNodes.length) {
        squadCopy.append(...squadNodes);
        secondary.append(squadCopy);
      }
      secondary.append(...nodes.filter((node) => !squadNodes.includes(node)));
      readingRoot.append(secondary);
      notices.append(...noticeNodes);
      game.append(notices);
    } else {
      // Restore status anchors before the descriptive siblings that reference them.
      refreshTouchSummary();
      refreshStatus();
      restore(moves);
      restore(noticeMoves);
      secondary.remove();
      notices.remove();
    }
    refreshTouchSummary();
    refreshStatus();
    if (retainFocus && focused?.isConnected) focused.focus({ preventScroll: true });
    revealFocusedSurface();
  }
  return {
    refresh,
    refreshCaptionLayout() {
      if (disposed) return;
      refreshTouchSummary();
      refreshStatus();
      revealFocusedSurface();
    },
    dispose() {
      if (disposed) return;
      refresh(false);
      disposed = true;
      cancelReveal();
      for (const surface of surfaces) surface.removeEventListener('focusin', revealFocusedSurface);
      win.removeEventListener('resize', resized);
      landscape?.removeEventListener?.('change', resized);
      observer?.disconnect();
    },
  };
}
