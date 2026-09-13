/** Bind the finite first-party reading surfaces. The navigation adapter owns
 * scrolling/focus; this host layer owns visible controls and the pause boundary. */
export function attachControllerReading({
  document: doc = globalThis.document,
  getNavigation,
  getControlLabels,
  getScope,
  pause = () => {},
  onTransition = () => {},
  additionalSurfaces = [],
  compactOverlay = false,
} = {}) {
  const definitions = [
    ['overlay-reading', 'overlay-read', 'Mission details', 'overlay-reading-unit'],
    ['mission-brief-reading', 'mission-brief-read', 'Mission brief', 'mission-brief-unit'],
    ...additionalSurfaces,
  ];
  const surfaces = definitions.map(([id, entryId, label, unitId]) => {
    const surface = {
      id,
      label,
      region: doc.getElementById(id),
      entry: doc.getElementById(entryId),
      done: doc.getElementById(`${id}-done`),
      hint: doc.getElementById(`${id}-hint`),
      unit: doc.getElementById(unitId),
    };
    if (Object.values(surface).some((value) => !value))
      throw new Error(`Missing first-party reading controls: ${id}`);
    return surface;
  });
  let activeId = null,
    destroyed = false;
  const listeners = [];
  const listen = (element, type, handler) => {
    element.addEventListener(type, handler);
    listeners.push(() => element.removeEventListener(type, handler));
  };
  const prompt = () => {
    const labels = getControlLabels();
    return `Up/Down scroll · ${labels.confirm} or ${labels.back} returns.`;
  };
  function refresh() {
    if (destroyed) return;
    for (const surface of surfaces) {
      const active = activeId === surface.id;
      surface.done.disabled = !active;
      surface.entry.setAttribute('aria-pressed', String(active));
      surface.hint.textContent = active
        ? `Reading ${surface.label}. ${prompt()}`
        : 'Read without starting or resuming.';
      if (surface.id === 'overlay-reading' && (compactOverlay || surface.region.hidden)) {
        const { clientHeight, scrollHeight } = surface.region;
        const measured =
          Number.isFinite(clientHeight) && clientHeight > 0 && Number.isFinite(scrollHeight);
        const eligible = !surface.region.hidden && !surface.region.closest('[hidden]');
        const needed = eligible && (active || !measured || scrollHeight > clientHeight + 1);
        surface.entry.hidden = !needed;
        surface.done.hidden = !active;
        surface.hint.hidden = !active;
        surface.region.tabIndex = needed ? 0 : -1;
        const toolbar = surface.entry.closest?.('.reading-toolbar');
        if (toolbar) toolbar.hidden = !needed;
        if (!needed && [surface.entry, surface.done].includes(doc.activeElement))
          getNavigation().engage();
      } else if (surface.id === 'overlay-reading') {
        surface.entry.hidden = false;
        surface.done.hidden = false;
        surface.hint.hidden = false;
        surface.region.tabIndex = 0;
        const toolbar = surface.entry.closest?.('.reading-toolbar');
        if (toolbar) toolbar.hidden = false;
      }
    }
  }
  function changed(state) {
    if (destroyed) return;
    const previous = activeId;
    activeId = surfaces.some((surface) => surface.id === state?.regionId) ? state.regionId : null;
    refresh();
    if (previous && previous !== activeId) {
      surfaces.find((surface) => surface.id === previous).hint.textContent =
        'Reading ended. Choose an action when ready.';
    }
    onTransition();
  }
  function hint(message) {
    if (destroyed || !activeId) return;
    surfaces.find((surface) => surface.id === activeId).hint.textContent = message;
  }
  for (const surface of surfaces) {
    listen(surface.entry, 'click', () => {
      if (destroyed || getNavigation().readingState()?.regionId === surface.id) return;
      if (surface.id === 'mission-brief-reading' && getScope() === 'flight') pause(true);
      if (getScope() === 'flight') return;
      // The navigation adapter validates the exit before entering. Compact
      // panels expose it for this synchronous transition, then refresh from
      // the accepted reading state (or hide it again if entry was rejected).
      if (compactOverlay && surface.id === 'overlay-reading') surface.done.hidden = false;
      if (
        getNavigation().beginReading({
          region: surface.region,
          origin: surface.entry,
          exit: surface.done,
          label: surface.label,
        })
      ) {
        surface.unit.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
      }
      refresh();
    });
    // End-only: a preceding pointerdown may already have relinquished reading.
    // The stable button never becomes a Start/Resume action or toggles back in.
    listen(surface.done, 'click', () => {
      if (!destroyed) getNavigation().endReading({ restoreFocus: true });
    });
  }
  const brief = doc.getElementById('mission-brief');
  if (brief)
    listen(brief, 'toggle', () => {
      if (!brief.open && getNavigation().readingState()?.regionId === 'mission-brief-reading')
        getNavigation().endReading({ restoreFocus: false });
    });
  const overlay = compactOverlay
    ? surfaces.find((surface) => surface.id === 'overlay-reading')
    : null;
  const Resize = doc.defaultView?.ResizeObserver ?? globalThis.ResizeObserver;
  const Mutation = doc.defaultView?.MutationObserver ?? globalThis.MutationObserver;
  const resize = overlay && typeof Resize === 'function' ? new Resize(refresh) : null;
  const mutation = overlay && typeof Mutation === 'function' ? new Mutation(refresh) : null;
  if (overlay) {
    resize?.observe(overlay.region);
    mutation?.observe(overlay.region, { subtree: true, childList: true, characterData: true });
  }
  refresh();
  return {
    changed,
    hint,
    refresh,
    destroy() {
      if (destroyed) return;
      getNavigation().endReading({ restoreFocus: false });
      destroyed = true;
      resize?.disconnect();
      mutation?.disconnect();
      for (const remove of listeners) remove();
    },
  };
}
