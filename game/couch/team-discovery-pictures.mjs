import { createOperationStatus } from '../ui/operation-status.mjs';

/** Gallery-owned copies only. One underlying preparation remains in flight until
 * it settles, even if its visit was cancelled or a newer gallery has opened. */
export function attachTeamDiscoveryPictures({
  document,
  dialog,
  list,
  back,
  preview,
  prepare,
  select = () => {},
  onViewChange = () => {},
}) {
  let session = null,
    detail = null,
    active = null,
    queue = [],
    revision = 0,
    disposed = false;
  const feedback = createOperationStatus(preview.status, {
    isCurrent: () => !disposed && Boolean(session && detail),
  });
  const foreground = () => !document.hidden && document.hasFocus?.() !== false;
  const unclaimed = (element) =>
    !element || element === document.body || element === document.documentElement;
  const visible = (element) =>
    element?.isConnected && !element.disabled && !element.closest('[hidden],[inert]');
  const owns = (owner) => !disposed && session === owner;
  const live = (owner) => owns(owner) && owner.started && dialog.open && foreground();
  const current = (job) =>
    live(job.owner) &&
    !job.controller.signal.aborted &&
    !job.owner.busy &&
    (job.detail ? detail === job.detail : !detail);
  const clearCanvas = (canvas) => {
    canvas.hidden = true;
    try {
      canvas.width = canvas.height = 0;
    } catch {
      // Retiring a canvas must not retain its image lease or affect the attempt.
    }
  };
  const describe = (owner, message, state = 'ready') => {
    if (!detail || !owns(owner)) return;
    const shown = detail;
    const operation = feedback.begin({
      message,
      stage: 'preparing',
      isCurrent: () => owns(owner) && detail === shown,
    });
    if (state !== 'preparing' && owns(owner) && detail === shown)
      operation.finish({ message, state });
  };
  function detailReady(job, successful = true) {
    if (!current(job) || !job.detail) return;
    job.detail.loading = false;
    preview.retry.setAttribute('aria-disabled', 'false');
    preview.retry.textContent = successful ? 'Reload preview' : 'Retry preview';
  }
  function cancelJobs(owner) {
    const pending = queue.filter((job) => job.owner === owner),
      running = active?.owner === owner ? active : null;
    queue = queue.filter((job) => job.owner !== owner);
    for (const card of owner?.cards ?? []) {
      if (card.state === 'loading') {
        card.state = 'queued';
        card.message.textContent = 'Artwork teaser paused. Preview prepares the picture.';
      }
    }
    for (const job of pending) job.controller.abort();
    running?.controller.abort();
  }
  function draw(job, handle) {
    if (!current(job)) return;
    handle.confirm?.();
    if (!current(job)) return;
    const canvas = job.detail ? preview.canvas : job.card.canvas;
    if (!handle.image) {
      clearCanvas(canvas);
      if (!current(job)) return;
      if (job.detail) {
        detailReady(job);
        describe(job.owner, 'Approved procedural scene. Play to explore this arena.');
      } else {
        job.card.state = 'ready';
        job.card.message.textContent = 'Approved procedural scene';
      }
      return;
    }
    const width = job.detail ? 1152 : 288,
      height = job.detail ? 576 : 144;
    canvas.width = width;
    canvas.height = height;
    if (!current(job)) return;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Artwork preview is unavailable.');
    context.imageSmoothingEnabled = false;
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
    if (!current(job)) return;
    context.drawImage(handle.image, 0, 0, width, height);
    if (!current(job)) return;
    if (!job.detail) {
      // Show enough of the edges to identify the art while reserving the complete
      // composition for the player's deliberate Preview action.
      context.fillStyle = '#0b1a24';
      context.fillRect(24, 24, width - 48, height - 48);
    }
    if (!current(job)) return;
    canvas.hidden = false;
    if (job.detail) {
      detailReady(job);
      describe(job.owner, 'Full picture preview. Previewing does not award this picture.');
    } else {
      job.card.state = 'ready';
      job.card.message.textContent = 'Artwork teaser';
    }
  }
  function drain() {
    if (disposed || active) return;
    let job;
    while ((job = queue.shift())) {
      if (current(job)) break;
      job = null;
    }
    if (!job) return;
    active = job;
    void (async () => {
      let handle;
      try {
        handle = await prepare(job.card.row, {
          signal: job.controller.signal,
          isCurrent: () => current(job),
          onStatus: (message) => {
            if (current(job) && job.detail && typeof message === 'string')
              describe(job.owner, message, 'preparing');
          },
        });
        if (!current(job)) return;
        if (!handle || typeof handle.release !== 'function')
          throw new Error('Artwork preview has no owner.');
        draw(job, handle);
      } catch (error) {
        if (!current(job)) return;
        const canvas = job.detail ? preview.canvas : job.card.canvas;
        clearCanvas(canvas);
        if (!current(job)) return;
        if (job.detail) {
          detailReady(job, false);
          preview.retry.hidden = false;
          describe(
            job.owner,
            error?.name === 'AbortError'
              ? 'Preview cancelled. Retry preview when ready.'
              : 'Picture preview unavailable. Retry preview or return to the arenas.',
            error?.name === 'AbortError' ? 'ready' : 'error',
          );
        } else {
          job.card.state = 'error';
          job.card.message.textContent = 'Teaser unavailable. Preview can try again.';
        }
      } finally {
        try {
          handle?.release();
        } catch {
          // A release owns only this transient preview, never the accepted run.
        }
        if (active === job) active = null;
        drain();
      }
    })();
  }
  function thumbnails(owner) {
    if (!live(owner) || owner.busy || detail) return;
    for (const card of owner.cards) {
      if (card.state !== 'queued') continue;
      card.state = 'loading';
      card.message.textContent = 'Preparing artwork teaser…';
      queue.push({ owner, card, detail: null, controller: new AbortController() });
    }
    drain();
  }
  function loadDetail(shown) {
    const owner = session;
    if (!shown || shown.loading || detail !== shown || !live(owner) || owner.busy) return;
    cancelJobs(owner);
    if (!live(owner) || detail !== shown) return;
    shown.loading = true;
    clearCanvas(preview.canvas);
    preview.retry.setAttribute('aria-disabled', 'true');
    preview.retry.textContent = 'Preparing preview…';
    describe(
      owner,
      'Preparing picture preview… Your current attempt stays available.',
      'preparing',
    );
    if (detail !== shown || !live(owner)) return;
    queue.unshift({ owner, card: shown.card, detail: shown, controller: new AbortController() });
    drain();
  }
  function show(owner, card) {
    if (!live(owner) || owner.busy || detail) return;
    const shown = { card, owner, loading: false };
    detail = shown;
    select(card.row.key);
    if (!live(owner) || detail !== shown) return;
    cancelJobs(owner);
    if (!live(owner) || detail !== shown) return;
    const prior = document.activeElement;
    list.hidden = true;
    preview.panel.hidden = false;
    preview.retry.hidden = true;
    preview.title.textContent = `${card.row.title} · Preview`;
    back.textContent = 'Back to arenas';
    onViewChange();
    if (!live(owner) || detail !== shown) return;
    if (document.activeElement === prior || unclaimed(document.activeElement))
      back.focus({ preventScroll: true });
    if (live(owner) && detail === shown) loadDetail(shown);
  }
  function returnToCards({ restore = true } = {}) {
    const shown = detail,
      owner = session;
    if (!shown) return false;
    detail = null;
    const prior = document.activeElement,
      ownedFocus = unclaimed(prior) || prior === back || preview.panel.contains(prior);
    cancelJobs(owner);
    if (!owns(owner) || detail) return true;
    preview.panel.hidden = true;
    preview.retry.hidden = true;
    clearCanvas(preview.canvas);
    list.hidden = false;
    back.textContent = 'Back';
    onViewChange();
    if (!live(owner) || detail) return true;
    if (
      restore &&
      ownedFocus &&
      visible(shown.card.button) &&
      (document.activeElement === prior || unclaimed(document.activeElement))
    )
      shown.card.button.focus({ preventScroll: true });
    if (live(owner) && !detail) thumbnails(owner);
    return true;
  }
  function close() {
    const epoch = ++revision;
    const owner = session;
    session = null;
    detail = null;
    cancelJobs(owner);
    if (!session && revision === epoch) {
      preview.panel.hidden = true;
      preview.retry.hidden = true;
      clearCanvas(preview.canvas);
      list.hidden = false;
      back.textContent = 'Back';
    }
    for (const card of owner?.cards ?? []) {
      card.button.onclick = null;
      clearCanvas(card.canvas);
    }
  }
  preview.retry.onclick = () => loadDetail(detail);
  return {
    populate(cards) {
      if (disposed) return;
      const epoch = revision + 1;
      close();
      if (disposed || revision !== epoch) return;
      const owner = { cards: [], started: false, busy: false };
      session = owner;
      for (const source of cards) {
        if (!owns(owner)) return;
        const figure = document.createElement('figure'),
          canvas = document.createElement('canvas'),
          message = document.createElement('figcaption'),
          button = document.createElement('button');
        figure.className = 'team-discovery-teaser';
        canvas.className = 'team-discovery-teaser-canvas';
        canvas.width = 288;
        canvas.height = 144;
        canvas.setAttribute('aria-hidden', 'true');
        canvas.hidden = true;
        message.className = 'team-discovery-teaser-message';
        message.textContent = 'Preparing artwork teaser…';
        button.type = 'button';
        button.className = 'team-discovery-preview-button';
        button.textContent = 'Preview picture';
        button.setAttribute(
          'aria-label',
          `Preview ${source.row.title} · ${source.row.packName} · ${source.row.sourceLabel}`,
        );
        figure.append(canvas, message);
        source.card.append(figure, source.button, button);
        const card = { row: source.row, canvas, message, button, state: 'queued' };
        owner.cards.push(card);
        if (!owns(owner)) return;
        button.onclick = () => show(owner, card);
      }
    },
    start() {
      if (!session || disposed) return;
      session.started = true;
      thumbnails(session);
    },
    setBusy(busy) {
      if (!session) return;
      const owner = session;
      owner.busy = busy;
      for (const card of owner.cards) {
        if (!owns(owner)) return;
        card.button.disabled = busy;
      }
      if (!owns(owner)) return;
      if (busy) cancelJobs(owner);
      else if (owner.started && !detail) thumbnails(owner);
    },
    cancel() {
      if (!session) return;
      const owner = session,
        shown = detail;
      cancelJobs(owner);
      if (owns(owner) && shown && detail === shown) {
        shown.loading = false;
        clearCanvas(preview.canvas);
        preview.retry.hidden = false;
        preview.retry.setAttribute('aria-disabled', 'false');
        preview.retry.textContent = 'Retry preview';
        describe(owner, 'Preview cancelled. Retry preview when ready.');
      }
    },
    back: () => returnToCards(),
    primary: () =>
      detail ? (detail.loading || preview.retry.hidden ? back : preview.retry) : null,
    close,
    dispose() {
      if (disposed) return;
      disposed = true;
      close();
      queue = [];
      preview.retry.onclick = null;
      feedback.dispose();
    },
  };
}
