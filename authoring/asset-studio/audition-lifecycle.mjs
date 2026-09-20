/** Authoring auditions are disposable previews, not a continuous music session.
 * A focus change (for example a file picker) does not imply a hidden document. */
export function attachStudioAuditionLifecycle({ document, isAudition, stop, restore }) {
  let disposed = false,
    interrupted = false;
  const changed = () => {
    if (disposed) return;
    if (document.hidden) {
      if (interrupted || !isAudition()) return;
      interrupted = true;
      stop();
    } else if (interrupted) {
      interrupted = false;
      // A changed selection owns its own previews; never recreate a retired slot.
      if (isAudition()) restore();
    }
  };
  document.addEventListener('visibilitychange', changed);
  return Object.freeze({
    dispose() {
      if (disposed) return;
      disposed = true;
      interrupted = false;
      document.removeEventListener('visibilitychange', changed);
    },
  });
}
