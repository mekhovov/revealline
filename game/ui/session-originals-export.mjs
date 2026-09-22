/** A prepared download is an export offer, never proof that the browser saved it.
 * The Library operation owner provides cancellation, locking and live feedback. */
export function attachSessionOriginalsExport({
  registry,
  root,
  note,
  prepare,
  download,
  task,
  setStatus,
  URLImpl = URL,
}) {
  let generation = 0,
    preparedRevision = null,
    url = null,
    disposed = false;
  function invalidate() {
    generation++;
    if (url !== null) URLImpl.revokeObjectURL(url);
    url = null;
    preparedRevision = null;
    download.hidden = true;
    download.removeAttribute('href');
    download.removeAttribute('download');
  }
  function refresh() {
    if (disposed) return;
    const state = registry.status();
    if (preparedRevision !== null && preparedRevision !== state.revision) invalidate();
    root.hidden = state.disposed || state.originals === 0;
    const size =
      state.bytes < 1048576
        ? `${Math.ceil(state.bytes / 1024)} KiB`
        : `${(state.bytes / 1048576).toFixed(1)} MiB`;
    note.textContent = `${state.originals} picture original${state.originals === 1 ? '' : 's'} (${size}) ${state.originals === 1 ? 'exists' : 'exist'} only in this tab. Download these originals and export game data before leaving. Restore the .rlmedia file in Workshop → Pictures & stories before importing game data. A download does not save your progress automatically.`;
  }
  prepare.onclick = () =>
    task(async (operation) => {
      if (disposed) throw new Error('Session originals export is closed.');
      invalidate();
      const own = generation,
        revision = registry.status().revision;
      operation.phase('Verifying the exact session-only picture originals…');
      const blob = await registry.exportBundle({ signal: operation.signal });
      operation.check();
      if (disposed || own !== generation || registry.status().revision !== revision)
        throw new DOMException(
          'Session originals changed; prepare the download again.',
          'AbortError',
        );
      let next = URLImpl.createObjectURL(blob);
      try {
        operation.check();
        if (disposed || own !== generation || registry.status().revision !== revision)
          throw new DOMException(
            'Session originals changed; prepare the download again.',
            'AbortError',
          );
        url = next;
        next = null;
        preparedRevision = revision;
        download.href = url;
        download.download = 'RevealLine-session-originals.rlmedia';
        download.hidden = false;
        setStatus(
          'Session originals verified. Choose Download session originals, then export game data. Keep both files; originals must be restored first.',
        );
      } finally {
        if (next !== null) URLImpl.revokeObjectURL(next);
      }
    });
  download.onclick = (event) => {
    refresh();
    if (disposed || !url || preparedRevision !== registry.status().revision) {
      event.preventDefault();
      setStatus('Prepare the current session originals before downloading.');
      return;
    }
    setStatus(
      'Session originals download requested. Confirm it in your browser, then export game data. This prepared download remains available to retry.',
    );
  };
  refresh();
  return Object.freeze({
    refresh,
    invalidate,
    dispose() {
      if (disposed) return;
      disposed = true;
      invalidate();
      prepare.onclick = null;
      download.onclick = null;
      root.hidden = true;
    },
  });
}
