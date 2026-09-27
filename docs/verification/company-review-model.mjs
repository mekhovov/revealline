// Development review data only; no game state, player input or persistent storage.
export function reviewTarget(value, base) {
  if (typeof value !== 'string' || value.length > 2048)
    throw new TypeError('Choose a bounded company player URL.');
  const url = new URL(value, base);
  if (
    !/^https?:$/.test(url.protocol) ||
    url.origin !== new URL(base).origin ||
    url.username ||
    url.password ||
    !/\/game\/(?:company|index)\.html$/.test(url.pathname)
  )
    throw new TypeError('Choose a company player on this review server.');
  return url.href;
}

export function reviewViewport(width, height) {
  const values = [width, height].map((value) => Number(value));
  if (!values.every((value) => Number.isInteger(value) && value >= 240 && value <= 2560))
    throw new TypeError('Choose viewport dimensions between 240 and 2560 pixels.');
  return { width: values[0], height: values[1] };
}

/** Viewport overflow is a review hint, not proof of inaccessible content. A
 * visible native scroll port can make an offscreen control reachable. Fixed
 * descendants are not bounded by arbitrary DOM ancestors such as the arena. */
export function reviewControlViewport(node, win) {
  const rect = node.getBoundingClientRect(),
    outsideX = rect.left < -1 || rect.right > win.innerWidth + 1,
    outsideY = rect.top < -1 || rect.bottom > win.innerHeight + 1;
  if (!outsideX && !outsideY) return { outsideViewport: false, scrollableOffscreen: false };
  let reachableX = !outsideX,
    reachableY = !outsideY;
  const style = (element) => win.getComputedStyle?.(element) ?? {};
  const scrollReaches = (parent, axis) => {
    const css = style(parent),
      horizontal = axis === 'X';
    if (!['auto', 'scroll'].includes(css[`overflow${axis}`])) return false;
    const bounds = parent.getBoundingClientRect(),
      start = Math.max(0, horizontal ? bounds.left : bounds.top),
      end = Math.min(
        horizontal ? win.innerWidth : win.innerHeight,
        horizontal ? bounds.right : bounds.bottom,
      ),
      current = horizontal ? parent.scrollLeft : parent.scrollTop,
      maximum = horizontal
        ? parent.scrollWidth - parent.clientWidth
        : parent.scrollHeight - parent.clientHeight;
    if (!Number.isFinite(current) || !Number.isFinite(maximum) || maximum <= 0 || end <= start)
      return false;
    const first = horizontal ? rect.left : rect.top,
      last = horizontal ? rect.right : rect.bottom;
    return Math.max(-current, last - end) <= Math.min(maximum - current, first - start) + 1;
  };
  if (style(node).position !== 'fixed')
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      if (outsideX && scrollReaches(parent, 'X')) reachableX = true;
      if (outsideY && scrollReaches(parent, 'Y')) reachableY = true;
      if (style(parent).position === 'fixed') break;
    }
  return {
    outsideViewport: outsideX || outsideY,
    scrollableOffscreen: (outsideX || outsideY) && reachableX && reachableY,
  };
}

/** Public DOM adapters for the shared Solo host and retained historical builds.
 * Never inspect simulation globals or change the player's input or lifecycle. */
export function reviewPlayerSurface(doc, visible) {
  const get = (id) => doc.getElementById(id);
  if (get('game-canvas') && get('shell-home')) {
    const boot = doc.documentElement.dataset.bootState;
    const running =
      boot === 'ready' &&
      doc.body.dataset.flightState === 'running' &&
      doc.body.dataset.pictureState === 'ready' &&
      visible(get('game-canvas')) &&
      get('game-overlay')?.hidden === true &&
      ![...doc.querySelectorAll('dialog[open]')].some(visible);
    const readyControl = ['shell-continue', 'shell-featured', 'start-button'].some(
      (id) => visible(get(id)) && !get(id).disabled,
    );
    const selection = get('level-select');
    return {
      host: 'solo',
      ready: boot === 'ready' && (readyControl || running),
      failed: boot === 'failed' || boot === 'file',
      running,
      prepared: running,
      preparedOutcome: 'Running flight observed after activation',
      mission:
        selection?.selectedOptions?.[0]?.textContent ?? get('overlay-eyebrow')?.textContent ?? '',
    };
  }
  const state = doc.documentElement.dataset.companyState;
  return {
    host: 'historical-company',
    ready:
      (state === undefined || state === 'ready') &&
      get('campaigns')?.childElementCount > 0 &&
      !get('start-campaign')?.disabled &&
      get('notice')?.dataset.error !== 'true' &&
      !/Preparing|Checking/.test(get('notice')?.textContent ?? '') &&
      visible(get('start-campaign')),
    failed: state === 'failed' || get('notice')?.dataset.error === 'true',
    running:
      visible(get('play-screen')) &&
      get('play-overlay')?.hidden === true &&
      get('pause-button')?.textContent === 'Pause',
    prepared:
      visible(get('play-screen')) &&
      visible(get('resume-button')) &&
      !/Preparing/.test(get('notice')?.textContent ?? ''),
    preparedOutcome: 'Mission prepared; explicit start available',
    mission: get('mission-title')?.textContent ?? '',
  };
}

export function frameSummary(samples) {
  const sorted = samples.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const percentile = (p) => sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
  return {
    frames: sorted.length,
    p50Ms: percentile(0.5),
    p95Ms: percentile(0.95),
    maxMs: sorted.at(-1),
    over33ms: sorted.filter((n) => n > 33.34).length,
  };
}

export function resourceSummary(entries) {
  return {
    resourceTimingEntries: entries.length,
    resourceTimingMayBeIncomplete: true,
    transferBytes: entries.reduce(
      (n, r) => n + (Number.isFinite(r.transferSize) && r.transferSize >= 0 ? r.transferSize : 0),
      0,
    ),
    decodedBytes: entries.reduce(
      (n, r) =>
        n + (Number.isFinite(r.decodedBodySize) && r.decodedBodySize >= 0 ? r.decodedBodySize : 0),
      0,
    ),
    zeroTransferEntries: entries.filter((r) => r.transferSize === 0).length,
  };
}
