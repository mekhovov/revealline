/** Lazy source metadata must not keep a retired native entry alive. Preserve
 * the frozen player's live getters and method closures while owning disposal. */
export function createSoloDemoSourceOwner(metadataLevel) {
  let active = null;
  return {
    get entry() {
      return active?.entry ?? null;
    },
    get level() {
      return active?.level ?? metadataLevel;
    },
    adopt(player, { entry, level, signals = [] }) {
      const watched = [...new Set(signals.filter(Boolean))];
      const lease = { entry, level };
      let disposed = false,
        retirement,
        failed = false,
        failure;
      const dispose = () => {
        if (disposed) {
          if (failed) throw failure;
          return retirement;
        }
        disposed = true;
        for (const signal of watched) signal.removeEventListener('abort', onAbort);
        if (active === lease) active = null;
        lease.entry = null;
        lease.level = null;
        try {
          retirement = player.dispose();
          return retirement;
        } catch (error) {
          failed = true;
          failure = error;
          throw error;
        }
      };
      const onAbort = () => {
        // Event dispatch cannot await retirement. Preserve its result for the
        // explicit scene owner while observing any asynchronous failure here.
        try {
          Promise.resolve(dispose()).catch(() => {});
        } catch {}
      };
      for (const signal of watched) {
        if (signal.aborted) {
          onAbort();
          signal.throwIfAborted();
        }
      }
      active = lease;
      for (const signal of watched) signal.addEventListener('abort', onAbort, { once: true });
      return Object.freeze(
        Object.defineProperties(
          {},
          {
            ...Object.getOwnPropertyDescriptors(player),
            dispose: { value: dispose, enumerable: true },
          },
        ),
      );
    },
  };
}
