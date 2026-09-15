/** Fit the whole board, reserving real space for navigation and telemetry.
 * A side rail often uses only the letterbox space of a wide phone. Compare
 * both fits instead of assuming that every landscape device has that space. */
export function fitFlightLayout({
  width,
  height,
  aspect = 4 / 3,
  largeText = false,
  railSide = 'left',
  portraitControlHeight = 0,
  taskHeight = 0,
}) {
  if (!(width > 0 && height > 0 && aspect > 0 && Number.isFinite(aspect))) return null;
  const fit = (x, y, w, h) => {
    const boardWidth = Math.max(0, Math.min(w, h * aspect));
    const boardHeight = boardWidth / aspect;
    return {
      x: x + Math.max(0, w - boardWidth) / 2,
      y: y + Math.max(0, h - boardHeight) / 2,
      width: boardWidth,
      height: boardHeight,
    };
  };
  if (width <= height) {
    const stripHeight = (largeText ? 144 : 120) + taskHeight;
    const board = fit(
      0,
      stripHeight,
      width,
      Math.max(0, height - stripHeight - portraitControlHeight),
    );
    board.y = stripHeight;
    return { mode: 'portrait', board, chromeX: 0, railWidth: 0, stripHeight };
  }
  const stripHeight = (largeText ? 88 : 72) + taskHeight;
  const railWidth = largeText ? 132 : 112;
  const strip = fit(0, stripHeight, width, height - stripHeight);
  const rail = fit(railSide === 'right' ? 0 : railWidth + 8, 0, width - railWidth - 8, height);
  const useRail = !taskHeight && height >= (largeText ? 340 : 304) && rail.width >= strip.width;
  return {
    mode: useRail ? 'rail' : 'strip',
    board: useRail ? rail : strip,
    railWidth,
    chromeX: useRail && railSide === 'right' ? width - railWidth : 0,
    stripHeight,
  };
}

/** CSS owns safe areas/dvh; observing a fixed probe also follows Safari chrome
 * changes without polling or resizing the simulation's logical board. */
export function attachFlightLayout({
  document: doc = globalThis.document,
  window: win = globalThis.window,
} = {}) {
  if (!win?.ResizeObserver || !win?.MutationObserver || !win?.matchMedia) return null;
  const root = doc.documentElement;
  const body = doc.body;
  const coursePanel = doc.getElementById('first-flight-panel');
  const courseTask = doc.getElementById('first-flight-task');
  const courseParent = coursePanel?.parentElement;
  const courseNext = coursePanel?.nextSibling;
  const overlayCard = doc.querySelector('#game-overlay .overlay-card');
  const restoreCourse = () => {
    if (courseParent && coursePanel.parentElement !== courseParent)
      courseParent.insertBefore(coursePanel, courseNext);
  };
  const probe = doc.createElement('div');
  probe.className = 'flight-viewport';
  probe.setAttribute('aria-hidden', 'true');
  body.append(probe);
  const compact = win.matchMedia(
    '(orientation: landscape) and (max-height: 600px), (orientation: landscape) and (any-pointer: coarse)',
  );
  const compactMenus = win.matchMedia('(max-width: 680px), (max-height: 600px)');
  const displayMode = win.matchMedia('(display-mode: fullscreen), (display-mode: standalone)');
  let frame = 0;
  const update = () => {
    frame = 0;
    const rect = probe.getBoundingClientRect();
    const immersive =
      !!doc.fullscreenElement ||
      displayMode.matches ||
      win.navigator?.standalone === true ||
      root.dataset.gameFullscreen === 'true';
    // Course navigation must share the overlay's scroll surface on a short
    // screen. Moving the existing nodes preserves handlers and focus targets.
    if (
      (compact.matches || compactMenus.matches || immersive) &&
      body.classList.contains('first-flight-session') &&
      coursePanel &&
      overlayCard
    ) {
      if (coursePanel.parentElement !== overlayCard) overlayCard.append(coursePanel);
    } else restoreCourse();
    if (!compact.matches && !immersive) {
      delete body.dataset.flightLayout;
      return;
    }
    const style = win.getComputedStyle(probe);
    const left = parseFloat(style.paddingLeft) || 0;
    const top = parseFloat(style.paddingTop) || 0;
    const width = rect.width - left - (parseFloat(style.paddingRight) || 0);
    const height = rect.height - top - (parseFloat(style.paddingBottom) || 0);
    const largeText = body.dataset.textSize === 'large';
    const portraitControlHeight =
      body.dataset.screenControls === 'shown'
        ? (body.dataset.touchSize === 'large' ? 192 : 156) + 36
        : 0;
    const baseStrip = width <= height ? (largeText ? 144 : 120) : largeText ? 88 : 72;
    // Long lesson/respawn instructions can wrap after text or viewport changes.
    // Keep a visible board even if the instruction itself needs to scroll.
    const taskBudget = Math.max(
      0,
      height - baseStrip - (width <= height ? portraitControlHeight : 0) - 48,
    );
    const layout = fitFlightLayout({
      width,
      height,
      aspect: parseFloat(win.getComputedStyle(root).getPropertyValue('--board-aspect')) || 4 / 3,
      largeText,
      railSide: body.dataset.touchSide === 'left' ? 'right' : 'left',
      taskHeight: body.classList.contains('first-flight-session')
        ? Math.min(taskBudget, Math.max(largeText ? 72 : 48, courseTask?.scrollHeight || 0))
        : 0,
      portraitControlHeight,
    });
    if (!layout) return;
    body.dataset.flightLayout = layout.mode;
    const values = {
      x: left + layout.board.x,
      y: top + layout.board.y,
      width: layout.board.width,
      height: layout.board.height,
      left: left + layout.chromeX,
      top,
      'usable-width': width,
      'usable-height': height,
      'rail-width': layout.railWidth,
      'strip-height': layout.stripHeight,
    };
    for (const [key, value] of Object.entries(values))
      body.style.setProperty(`--flight-${key}`, `${value}px`);
  };
  const schedule = () => {
    if (!frame) frame = win.requestAnimationFrame(update);
  };
  const resize = new win.ResizeObserver(schedule);
  resize.observe(probe);
  if (courseTask) resize.observe(courseTask);
  const attributes = new win.MutationObserver(schedule);
  attributes.observe(root, {
    attributes: true,
    attributeFilter: ['style', 'data-game-fullscreen'],
  });
  attributes.observe(body, {
    attributes: true,
    attributeFilter: [
      'class',
      'data-text-size',
      'data-touch-side',
      'data-screen-controls',
      'data-touch-size',
    ],
  });
  if (courseTask)
    attributes.observe(courseTask, { childList: true, characterData: true, subtree: true });
  compact.addEventListener('change', schedule);
  compactMenus.addEventListener('change', schedule);
  displayMode.addEventListener('change', schedule);
  doc.addEventListener('fullscreenchange', schedule);
  update();
  return () => {
    resize.disconnect();
    attributes.disconnect();
    compact.removeEventListener('change', schedule);
    compactMenus.removeEventListener('change', schedule);
    displayMode.removeEventListener('change', schedule);
    doc.removeEventListener('fullscreenchange', schedule);
    if (frame) win.cancelAnimationFrame(frame);
    probe.remove();
    restoreCourse();
    delete body.dataset.flightLayout;
  };
}
