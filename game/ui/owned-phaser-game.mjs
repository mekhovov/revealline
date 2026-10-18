/** Phaser 4.2.1's native visibility setup retains document listeners after Game
 * destruction and overwrites page-wide focus properties. Transient renderers
 * use the same pinned start lifecycle with explicit ownership for these hooks.
 * The source-contract regression must be reviewed when Phaser changes. */
export function createOwnedPhaserGame(Phaser, config, document) {
  const window = document.defaultView ?? globalThis;
  const events = Phaser.Core.Events;
  class OwnedGame extends Phaser.Game {
    start() {
      const cleanup = [];
      let retired = false;
      const retire = () => {
        if (retired) return;
        retired = true;
        let failure;
        for (const release of cleanup.splice(0)) {
          try {
            release();
          } catch (error) {
            failure ??= error;
          }
        }
        if (failure) throw failure;
      };
      const listen = (target, type, handler) => {
        target.addEventListener(type, handler, false);
        cleanup.push(() => target.removeEventListener(type, handler, false));
      };
      try {
        this.isRunning = true;
        this.config.postBoot(this);
        this.loop.start((this.renderer ? this.step : this.headlessStep).bind(this));
        let hiddenEvent = document.hidden !== undefined ? 'visibilitychange' : null;
        if (!hiddenEvent)
          for (const vendor of ['webkit', 'moz', 'ms'])
            if (document[`${vendor}Hidden`] !== undefined)
              hiddenEvent = `${vendor}visibilitychange`;
        const isHidden = () =>
          hiddenEvent === 'visibilitychange'
            ? document.hidden
            : document[hiddenEvent?.replace('visibilitychange', 'Hidden')];
        if (hiddenEvent)
          listen(document, hiddenEvent, (event) =>
            this.events.emit(isHidden() || event.type === 'pause' ? events.HIDDEN : events.VISIBLE),
          );
        listen(window, 'blur', () => this.events.emit(events.BLUR));
        listen(window, 'focus', () => this.events.emit(events.FOCUS));
        this.events.once(events.DESTROY, retire);
        cleanup.push(() => this.events.off(events.DESTROY, retire));
        if (window.focus && this.config.autoFocus) window.focus();
        for (const [event, handler] of [
          [events.HIDDEN, this.onHidden],
          [events.VISIBLE, this.onVisible],
          [events.BLUR, this.onBlur],
          [events.FOCUS, this.onFocus],
        ]) {
          this.events.on(event, handler, this);
          cleanup.push(() => this.events.off(event, handler, this));
        }
      } catch (error) {
        // Startup can throw before the caller receives its Game. Reclaim the
        // started loop/renderer here as well as every page hook, retaining the
        // original failure even if a cleanup attempt also fails.
        try {
          retire();
        } catch {
          /* Continue independent engine cleanup. */
        }
        try {
          this.destroy(true, false);
        } catch {
          /* Public step may still finish destruction. */
        }
        try {
          if (this.pendingDestroy) this.step(performance.now(), 0);
        } catch {
          /* The original startup error remains authoritative. */
        }
        throw error;
      }
    }
  }
  return new OwnedGame(config);
}
