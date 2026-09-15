// Intentionally loaded as a classic script. Even file:// and failed ES-module
// downloads must retain the static launch screen and ordinary working links.
(() => {
  const host = globalThis;
  const doc = host.document;
  if (!doc || host.RevealLineBoot) return;
  const appURL = new URL('./app.mjs', doc.currentScript.src).href;
  let state = 'loading';
  let failure = null;
  let mounted = false;
  let slowTimer = null;
  let frame = null;
  let padNeutral = false;
  let padCommand = null;
  const styleCleanups = new Set();
  const $ = (id) => doc.getElementById(id);

  function stop() {
    host.clearTimeout(slowTimer);
    host.cancelAnimationFrame(frame);
    host.removeEventListener('error', resourceError, true);
    doc.removeEventListener('keydown', keydown);
    for (const cleanup of styleCleanups) cleanup();
    styleCleanups.clear();
  }
  function renderFailure() {
    if (!mounted) return;
    doc.documentElement.dataset.bootState = state;
    $('boot-screen').hidden = false;
    $('boot-status').hidden = false;
    doc.querySelectorAll('[data-boot-inert]').forEach((element) => {
      element.inert = true;
    });
    $('boot-title').textContent = state === 'file' ? 'Open your arcade.' : 'Flight on hold.';
    $('boot-status').textContent =
      state === 'file'
        ? 'This is a downloaded file. Choose Play online, or start a local server to play this copy.'
        : 'The game could not start. Reload to try again, or open the online game. Your saved progress has not been changed by this launch screen.';
    $('boot-retry').hidden = state === 'file';
    $('boot-local').open = state === 'file';
    const detail = $('boot-detail');
    detail.hidden = !failure || state === 'file';
    detail.textContent = failure ? String(failure.message || failure).slice(0, 320) : '';
    for (const dialog of doc.querySelectorAll('dialog[open]')) dialog.close();
    // Errors must not focus a control inside the still-inert game.
    (state === 'file' ? $('boot-online') : $('boot-retry')).focus({ preventScroll: true });
  }
  function fail(error) {
    if (state === 'ready' || state === 'file' || state === 'failed') return false;
    failure = error;
    state = 'failed';
    host.clearTimeout(slowTimer);
    renderFailure();
    return true;
  }
  function ready() {
    if (state !== 'loading') return false;
    state = 'ready';
    stop();
    doc.querySelectorAll('[data-boot-inert]').forEach((element) => {
      element.inert = false;
      element.removeAttribute('aria-busy');
    });
    $('boot-screen').hidden = true;
    doc.documentElement.dataset.bootState = 'ready';
    return true;
  }
  function resourceError(event) {
    if (state !== 'loading') return;
    const target = event.target;
    if (target?.id === 'boot-phaser') fail(new Error('The game renderer did not load.'));
    else if (target?.tagName === 'LINK' && target.rel === 'stylesheet')
      fail(new Error('A game stylesheet did not load.'));
  }
  function progress(message) {
    if (state !== 'loading' || !mounted) return false;
    $('boot-status').textContent = message;
    return true;
  }
  function prepareStyles() {
    // The HTML carries URLs without starting render-blocking requests. Install
    // listeners before requesting them, including when a cached load is instant.
    return Promise.all(
      [...doc.querySelectorAll('link[data-boot-href]')].map(
        (link) =>
          new Promise((resolve, reject) => {
            const cleanup = () => {
              link.removeEventListener('load', loaded);
              link.removeEventListener('error', failed);
              styleCleanups.delete(cleanup);
            };
            const loaded = () => {
              cleanup();
              link.media = 'all';
              resolve();
            };
            const failed = () => {
              cleanup();
              reject(new Error(`A game stylesheet did not load: ${link.dataset.bootHref}`));
            };
            styleCleanups.add(cleanup);
            link.addEventListener('load', loaded, { once: true });
            link.addEventListener('error', failed, { once: true });
            link.media = 'print';
            link.href = link.dataset.bootHref;
          }),
      ),
    );
  }
  function actions() {
    return [...$('boot-screen').querySelectorAll('a,button,summary')].filter(
      (element) =>
        !element.hidden &&
        !element.disabled &&
        !element.closest('[hidden]') &&
        (element.tagName === 'SUMMARY' || !element.closest('details:not([open])')),
    );
  }
  function moveFocus(direction) {
    const controls = actions();
    if (!controls.length) return;
    const index = controls.indexOf(doc.activeElement);
    controls[(index + direction + controls.length) % controls.length].focus();
  }
  function keydown(event) {
    if (state === 'ready' || event.altKey || event.ctrlKey || event.metaKey) return;
    // Native keyboard/pointer interaction wins until a held pad returns neutral.
    padNeutral = false;
    if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(event.key)) {
      event.preventDefault();
      if (!event.repeat) moveFocus(['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : -1);
    }
  }
  function pollPad() {
    if (state === 'ready') return;
    frame = host.requestAnimationFrame(pollPad);
    if (doc.hidden || !doc.hasFocus()) {
      padNeutral = false;
      padCommand = null;
      return;
    }
    let pads;
    try {
      pads = host.navigator.getGamepads?.() || [];
    } catch {
      return;
    }
    const pad = [...pads].find((item) => item?.connected && item.mapping === 'standard');
    const pressed = (index) => Boolean(pad?.buttons[index]?.pressed);
    const axis = Number(pad?.axes[1]) || 0;
    const command = pressed(0)
      ? 'confirm'
      : pressed(12) || axis < -0.55
        ? 'up'
        : pressed(13) || axis > 0.55
          ? 'down'
          : null;
    if (!command) {
      padNeutral = true;
      padCommand = null;
      return;
    }
    if (!padNeutral || command === padCommand) return;
    padCommand = command;
    if (command === 'confirm') {
      const controls = actions();
      if (controls.includes(doc.activeElement)) doc.activeElement.click();
      else controls[0]?.focus();
    } else moveFocus(command === 'down' ? 1 : -1);
  }
  function mount() {
    if (mounted) return;
    mounted = true;
    doc.addEventListener('keydown', keydown);
    $('boot-screen').addEventListener('pointerdown', () => {
      padNeutral = false;
    });
    frame = host.requestAnimationFrame(pollPad);
    if (host.location.protocol === 'file:') {
      state = 'file';
      renderFailure();
      return;
    }
    if (state === 'failed') {
      renderFailure();
      return;
    }
    if (!host.Phaser) {
      fail(new Error('The game renderer is unavailable.'));
      return;
    }
    slowTimer = host.setTimeout(() => {
      if (state === 'loading')
        $('boot-status').textContent =
          'Still preparing your arcade. You can wait, reload, or use Play online. No flight has started.';
    }, 15000);
    progress('Loading game styles…');
    prepareStyles()
      .then(() => {
        if (state !== 'loading') return;
        progress('Loading flight systems…');
        return import(appURL);
      })
      .then(() => {
        if (state === 'loading')
          fail(new Error('The game did not confirm startup. Open the current online edition.'));
      })
      .catch(fail);
  }
  host.RevealLineBoot = Object.freeze({ ready, fail, progress });
  host.addEventListener('error', resourceError, true);
  if (doc.readyState !== 'complete')
    doc.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
