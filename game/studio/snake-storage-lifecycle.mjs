/** Retire database connections while a Studio page is frozen or in history.
 * A restored page gets fresh lazy owners; old async operations never acquire
 * the new page's authority merely because the browser made it visible again. */
export function createSnakeStudioStorageLifecycle({ window, document, create, retire }) {
  let owners = create(),
    suspended = false,
    disposed = false,
    generation = 0;
  const suspend = () => {
    if (disposed || suspended) return;
    suspended = true;
    generation++;
    retire();
    for (const owner of Object.values(owners)) owner.close();
  };
  const resume = () => {
    if (disposed || !suspended) return;
    owners = create();
    suspended = false;
  };
  const hide = (event) => {
    suspend();
    if (!event.persisted) dispose();
  };
  const show = (event) => {
    if (event.persisted) resume();
  };
  function dispose() {
    if (disposed) return;
    suspend();
    disposed = true;
    window.removeEventListener('pagehide', hide);
    window.removeEventListener('pageshow', show);
    document.removeEventListener('freeze', suspend);
    document.removeEventListener('resume', resume);
  }
  window.addEventListener('pagehide', hide);
  window.addEventListener('pageshow', show);
  document.addEventListener('freeze', suspend);
  document.addEventListener('resume', resume);
  return {
    capture() {
      if (disposed || suspended) throw new Error('Snake Studio storage is suspended.');
      const original = generation;
      return {
        ...owners,
        current: () => !disposed && !suspended && original === generation,
      };
    },
    dispose,
  };
}
