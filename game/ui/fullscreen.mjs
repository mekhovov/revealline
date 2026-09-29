import { onLocaleChange, t } from '../i18n/index.mjs';
function iosBrowser(navigator) {
  if (!navigator) return false;
  const platform = navigator.platform ?? '';
  return (
    /iPad|iPhone|iPod/.test(platform || navigator.userAgent || '') ||
    (platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

const owners = new WeakMap();

/** Fullscreen remains an explicit browser gesture. All controls in a document
 * share one pending request and browser-state owner, including mirrored menus. */
export function attachFullscreen(
  button,
  doc = globalThis.document,
  { onState = null, escapeRoot = null, allowInstallHelp = true } = {},
) {
  if (!button) return () => {};
  let owner = owners.get(doc);
  if (!owner) {
    owner = fullscreenOwner(doc, () => owners.delete(doc));
    owners.set(doc, owner);
  }
  return owner.attach(button, onState, escapeRoot, allowInstallHelp);
}

function fullscreenOwner(doc, retired) {
  let active = true,
    pending = false,
    denied = false,
    exitRequested = false,
    escapeOwner = null;
  const buttons = new Map();
  const clickHandlers = new Map();
  const root = doc.documentElement;
  // A launched PWA does not set document.fullscreenElement, but its standalone
  // or fullscreen display mode should use the same arena-fit presentation.
  const displayMode = doc.defaultView?.matchMedia?.(
    '(display-mode: fullscreen), (display-mode: standalone)',
  );
  const navigator = doc.defaultView?.navigator;
  const iosStandalone = navigator?.standalone === true;
  const supported = !!doc.fullscreenEnabled && !!doc.documentElement?.requestFullscreen;
  const installDialog = doc.getElementById?.('ios-home-screen-dialog');
  const offersInstallHelp =
    !supported && !iosStandalone && iosBrowser(navigator) && !!installDialog;
  const helpAllowed = (registrations) =>
    offersInstallHelp && [...registrations].every((entry) => entry.allowInstallHelp);
  const sync = () => {
    if (!active) return;
    const immersive = !!doc.fullscreenElement || !!displayMode?.matches || iosStandalone;
    if (immersive) root?.dataset && (root.dataset.gameFullscreen = 'true');
    else if (root?.dataset) delete root.dataset.gameFullscreen;
    for (const [button, registrations] of buttons) {
      const buttonHelp = helpAllowed(registrations);
      const state = Object.freeze({
        hidden: !supported && !buttonHelp,
        label: buttonHelp
          ? t('interface:useFullScreenOnIphoneOrIpad')
          : doc.fullscreenElement
            ? t('interface:exitFullscreen')
            : t('interface:enterFullscreen'),
        pressed: buttonHelp ? null : String(!!doc.fullscreenElement),
        message: denied ? t('interface:fullscreenIsUnavailableInThisBrowserTheBoardFitsThe') : '',
      });
      button.hidden = state.hidden;
      button.setAttribute('aria-label', state.label);
      if (state.pressed === null) button.removeAttribute('aria-pressed');
      else button.setAttribute('aria-pressed', state.pressed);
      button.title = state.message;
      if (button.hasAttribute?.('data-fullscreen-label'))
        button.textContent = buttonHelp
          ? t('interface:fullScreenHelp')
          : doc.fullscreenElement
            ? t('interface:exitFullScreen')
            : t('interface:fullScreen');
      for (const registration of registrations) registration.onState?.(state);
    }
  };
  const request = async (exitOnly = false, allowHelp = false) => {
    if (!active || pending) return;
    if (exitOnly && !doc.fullscreenElement) return;
    if (!supported && !allowHelp) return;
    if (offersInstallHelp && allowHelp) {
      if (!installDialog.open) installDialog.showModal();
      doc.getElementById?.('ios-home-screen-close')?.focus?.({ preventScroll: true });
      return;
    }
    pending = true;
    try {
      if (doc.fullscreenElement) await doc.exitFullscreen();
      // Browsers own transient activation; a controller click cannot bypass it.
      else await doc.documentElement.requestFullscreen({ navigationUI: 'hide' });
      if (active) denied = false;
    } catch {
      if (active) denied = true;
    } finally {
      pending = false;
    }
    sync();
    if (exitRequested) {
      exitRequested = false;
      if (active && doc.fullscreenElement) void request(true);
    }
  };
  const landingOwnsFocus = (landing) => {
    if (
      !landing?.isConnected ||
      doc.hidden ||
      doc.hasFocus?.() === false ||
      !landing.contains(doc.activeElement)
    )
      return false;
    for (let node = landing; node; node = node.parentElement) {
      if (
        node.hidden ||
        node.inert ||
        node.getAttribute('aria-hidden') === 'true' ||
        (node.tagName === 'DIALOG' && !node.open)
      )
        return false;
      const style = doc.defaultView?.getComputedStyle?.(node);
      if (style?.display === 'none' || style?.visibility === 'hidden') return false;
    }
    return true;
  };
  const escape = (event) => {
    if (event.key !== 'Escape') return;
    if (escapeOwner && !landingOwnsFocus(escapeOwner)) escapeOwner = null;
    if (event.type === 'keyup') {
      if (!escapeOwner) return;
      escapeOwner = null;
    } else {
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey
      )
        return;
      if (!escapeOwner && doc.fullscreenElement) {
        escapeOwner =
          [...buttons.values()]
            .flatMap((entries) => [...entries])
            .map((entry) => entry.escapeRoot)
            .find(landingOwnsFocus) || null;
      }
      if (!escapeOwner) return;
      if (doc.fullscreenElement && !event.repeat) {
        if (pending) exitRequested = true;
        else void request(true);
      }
    }
    // Some embedded browsers forward Escape without leaving fullscreen. Claim
    // only the visible landing, before document-level Back or native cancel.
    // Retain the same key through release so auto-repeat cannot close the menu.
    event.preventDefault();
    event.stopPropagation();
  };
  doc.defaultView?.addEventListener?.('keydown', escape, true);
  doc.defaultView?.addEventListener?.('keyup', escape, true);
  if (displayMode?.addEventListener) displayMode.addEventListener('change', sync);
  else displayMode?.addListener?.(sync);
  if (supported || offersInstallHelp) doc.addEventListener('fullscreenchange', sync);
  const stopLocale = onLocaleChange(sync);
  const dispose = () => {
    if (!active) return;
    active = false;
    for (const [button, click] of clickHandlers) button.removeEventListener('click', click);
    clickHandlers.clear();
    buttons.clear();
    doc.removeEventListener('fullscreenchange', sync);
    if (displayMode?.removeEventListener) displayMode.removeEventListener('change', sync);
    else displayMode?.removeListener?.(sync);
    stopLocale();
    escapeOwner = null;
    exitRequested = false;
    doc.defaultView?.removeEventListener?.('keydown', escape, true);
    doc.defaultView?.removeEventListener?.('keyup', escape, true);
    doc.defaultView?.removeEventListener?.('pagehide', pagehide);
    retired();
  };
  const pagehide = (event) => {
    if (!event.persisted) dispose();
  };
  doc.defaultView?.addEventListener?.('pagehide', pagehide);
  return {
    attach(button, onState, escapeRoot, allowInstallHelp) {
      let registrations = buttons.get(button);
      if (!registrations) {
        registrations = new Set();
        buttons.set(button, registrations);
        if (supported || offersInstallHelp) {
          const click = () => request(false, helpAllowed(registrations));
          clickHandlers.set(button, click);
          button.addEventListener('click', click);
        }
      }
      const registration = { onState, escapeRoot, allowInstallHelp };
      registrations.add(registration);
      sync();
      return () => {
        if (!registrations.delete(registration)) return;
        if (registrations.size) {
          sync();
          return;
        }
        button.removeEventListener('click', clickHandlers.get(button));
        clickHandlers.delete(button);
        buttons.delete(button);
        if (buttons.size) return;
        dispose();
      };
    },
  };
}
