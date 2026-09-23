/** Read-only copies of authenticated Team artwork. Passive surfaces retain a
 * broad concealed teaser; the explicit library action may show the full
 * original without granting gameplay ownership. */
export function paintTeamPicturePreview(
  context,
  image,
  width,
  height,
  { full = false, isCurrent = () => true } = {},
) {
  if (!isCurrent()) return false;
  context.imageSmoothingEnabled = false;
  context.globalAlpha = 1;
  context.globalCompositeOperation = 'source-over';
  if (!isCurrent()) return false;
  context.drawImage(image, 0, 0, width, height);
  if (!isCurrent()) return false;
  if (!full) {
    const border = width / 12;
    context.fillStyle = '#0b1a24';
    if (!isCurrent()) return false;
    context.fillRect(border, border, width - border * 2, height - border * 2);
  }
  return isCurrent();
}

/** Explicit full artwork preview. Browsing remains artwork-lazy, and
 * cancellation keeps the underlying one-at-a-time permit until it settles. */
export function attachTeamLibraryPreview({
  document,
  dialog,
  panel,
  canvas,
  title,
  status,
  retry,
  button,
  selection,
  prepare,
}) {
  let owner = null,
    pending = null,
    disposed = false;
  const close = ({ hide = true } = {}) => {
    const previous = owner;
    owner = null;
    previous?.controller.abort();
    if (hide) panel.hidden = true;
    canvas.hidden = true;
    try {
      canvas.width = canvas.height = 0;
    } catch {
      /* A canvas cannot retain a lease. */
    }
  };
  const refresh = () => {
    if (disposed) return;
    const selected = selection();
    if (owner && owner.row !== selected?.row) close();
    button.disabled = !selected || Boolean(pending);
    button.textContent = selected ? `Preview ${selected.row.title}` : 'Select a mission to preview';
  };
  async function show() {
    const selected = selection();
    if (
      disposed ||
      pending ||
      !dialog.open ||
      !selected ||
      document.hidden ||
      document.hasFocus?.() === false
    )
      return;
    close({ hide: false });
    const ticket = { ...selected, controller: new AbortController() };
    owner = pending = ticket;
    const current = () =>
      !disposed &&
      owner === ticket &&
      dialog.open &&
      !document.hidden &&
      document.hasFocus?.() !== false &&
      !ticket.controller.signal.aborted &&
      selection()?.row === ticket.row;
    panel.hidden = false;
    title.textContent = `${ticket.row.title} · Picture preview`;
    status.textContent = 'Preparing the selected picture… Your current attempt is unchanged.';
    status.dataset.state = 'busy';
    retry.hidden = document.activeElement !== retry;
    retry.setAttribute('aria-disabled', 'true');
    refresh();
    let handle;
    try {
      handle = await prepare(ticket.row, {
        signal: ticket.controller.signal,
        isCurrent: current,
        onStatus: (message) => {
          if (current()) status.textContent = message;
        },
      });
      if (!current()) return;
      const image = handle.confirm();
      if (!current()) return;
      if (image) {
        canvas.width = 1152;
        canvas.height = 576;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Preview canvas unavailable.');
        if (
          !paintTeamPicturePreview(context, image, canvas.width, canvas.height, {
            full: true,
            isCurrent: current,
          })
        )
          return;
        canvas.hidden = false;
      }
      status.textContent = image
        ? 'Full picture preview. Viewing does not complete an arena or earn a picture.'
        : 'Approved procedural scene. Play to explore this arena.';
      status.dataset.state = 'ready';
    } catch {
      if (current()) {
        status.textContent = 'Picture preview unavailable. Retry or choose Play.';
        status.dataset.state = 'error';
      }
    } finally {
      try {
        handle?.release();
      } catch {
        /* A transient decoder cannot strand the preparation permit. */
      }
      if (pending === ticket) pending = null;
      if (current()) {
        retry.hidden = false;
        retry.setAttribute('aria-disabled', 'false');
      }
      refresh();
    }
  }
  const changed = () => queueMicrotask(refresh);
  dialog.addEventListener('focusin', changed);
  dialog.addEventListener('input', changed);
  dialog.addEventListener('change', changed);
  dialog.addEventListener('close', close);
  button.onclick = show;
  retry.onclick = show;
  return {
    close,
    refresh,
    dispose() {
      disposed = true;
      close();
      dialog.removeEventListener('focusin', changed);
      dialog.removeEventListener('input', changed);
      dialog.removeEventListener('change', changed);
      dialog.removeEventListener('close', close);
      button.onclick = retry.onclick = null;
    },
  };
}
