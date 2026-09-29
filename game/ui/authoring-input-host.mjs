import { attachControllerNavigation } from './controller-navigation.mjs';
import { createControllerRouter } from './controller-router.mjs';
import { attachControllerConfirmGuard } from './controller-confirm-guard.mjs';
import { createControllerConfirmLifecycle } from './controller-confirm-lifecycle.mjs';
import { resolveAuthoringEditor } from './authoring-editors.mjs';
import { createAuthoringSourcePicker } from './authoring-sources.mjs';
import { setMenuIcon } from './native-menu-icons.mjs';
import { authoringLabel, authoringText } from './authoring-copy.mjs';

const hosts = new WeakMap();
const visible = (element) =>
  element?.isConnected &&
  !element.closest('[hidden],[inert]') &&
  element.getClientRects().length > 0;
const focusable =
  'button:not(:disabled),a[href],select:not(:disabled),input:not(:disabled),textarea:not(:disabled),summary,[data-controller-editor]';

/** Explicit focus transfer. The parent never polls while its child owns focus.
 * Same-origin child menus receive a real Return button; no child game commands
 * or synthetic keys are issued by the editor. */
export function attachAuthoringPreview(frame, { document: doc, window: win }) {
  const enter = doc.createElement('button');
  enter.type = 'button';
  enter.className = 'authoring-preview-enter';
  authoringLabel(enter, 'enterPreview');
  setMenuIcon(enter, 'play');
  frame.before(enter);
  let observer = null,
    returnButton = null,
    entered = false;
  const cleanupChild = () => {
    observer?.disconnect();
    observer = null;
    returnButton?.remove();
    returnButton = null;
  };
  const loaded = () => {
    cleanupChild();
    let child;
    try {
      child = frame.contentDocument;
    } catch {
      return;
    }
    if (!child?.body) return;
    const button = child.createElement('button');
    returnButton = button;
    button.type = 'button';
    button.className = 'authoring-preview-return button secondary';
    button.setAttribute('data-menu-scope', 'authoring-preview');
    authoringLabel(button, 'returnEditor');
    setMenuIcon(button, 'back');
    button.style.cssText =
      'position:relative;z-index:30;min-height:44px;margin:8px;padding:8px 16px;font:inherit;';
    button.onclick = () => {
      entered = false;
      win.focus();
      enter.focus();
    };
    const place = () => {
      const dialogs = [...child.querySelectorAll('dialog[open]')];
      const root =
        dialogs.at(-1) ||
        child.querySelector('#game-overlay:not([hidden]),#coop-overlay:not([hidden])') ||
        child.querySelector('.race-screen:not([hidden]):not([inert]),#coop-menu:not([hidden])') ||
        child.body;
      const target =
        (root.id === 'game-overlay' && root.querySelector('.overlay-actions')) ||
        (root.id === 'coop-overlay' && root.querySelector('.overlay-card')) ||
        root;
      if (button.parentNode !== target) target.append(button);
    };
    place();
    observer = new win.MutationObserver(place);
    observer.observe(child.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['open', 'hidden'],
    });
    // Child boot code may focus its own menu. Loading a preview must not
    // transfer input ownership before the explicit Enter preview action.
    if (!entered && doc.activeElement === frame) {
      win.focus();
      enter.focus();
    }
  };
  enter.onclick = () => {
    if (!visible(frame)) return;
    entered = true;
    frame.focus();
    try {
      frame.contentWindow?.focus();
      const child = frame.contentDocument;
      const root = [...child.querySelectorAll('dialog[open]')].at(-1) || child;
      [...root.querySelectorAll(focusable)].find(visible)?.focus();
    } catch {
      /* Cross-origin previews retain their own input boundary. */
    }
  };
  frame.addEventListener('load', loaded);
  loaded();
  return {
    refresh() {
      const hidden = !visible(frame);
      if (enter.hidden !== hidden) enter.hidden = hidden;
    },
    destroy() {
      frame.removeEventListener('load', loaded);
      cleanupChild();
      enter.remove();
    },
  };
}

export function mountAuthoringInputHost({
  document: doc = globalThis.document,
  window: win = doc.defaultView ?? globalThis.window,
  createRouter = createControllerRouter,
  createNavigation = attachControllerNavigation,
  readPads,
  onPageBack,
} = {}) {
  if (hosts.has(doc)) return hosts.get(doc);
  const alreadyStyled = doc.body.classList.contains('authoring-input-page');
  doc.body.classList.add('authoring-input-page');
  const links = doc.createElement('link');
  links.rel = 'stylesheet';
  links.setAttribute('data-authoring-input-style', 'true');
  links.href = new URL('./authoring-input.css', import.meta.url).href;
  doc.head.append(links);
  const rail = doc.createElement('nav'),
    sectionsButton = doc.createElement('button'),
    hint = doc.createElement('p'),
    sections = doc.createElement('dialog');
  rail.className = 'authoring-input-rail';
  rail.setAttribute('aria-label', authoringText('navigation'));
  sectionsButton.type = 'button';
  authoringLabel(sectionsButton, 'sections');
  setMenuIcon(sectionsButton, 'content');
  authoringLabel(hint, 'hint');
  hint.className = 'authoring-input-hint';
  rail.append(sectionsButton, hint);
  sections.className = 'authoring-sections-dialog';
  sections.setAttribute('aria-label', authoringText('sections'));
  doc.body.prepend(rail);
  doc.body.append(sections);
  let disposed = false,
    animationFrame = null,
    returnFocus = null;
  const fileButtons = new Map(),
    previews = new Map(),
    listeners = [];
  const listen = (target, type, callback) => {
    target.addEventListener(type, callback);
    listeners.push(() => target.removeEventListener(type, callback));
  };
  const now = () => win.performance?.now?.() ?? Date.now();
  const router = createRouter({
    now,
    eventTarget: win,
    autoJoin: true,
    navigationAliases: true,
    ...(readPads ? { readPads } : {}),
  });
  const topDialog = () => [...doc.querySelectorAll('dialog[open]')].at(-1);
  const closeSections = () => {
    if (sections.open) sections.close();
    if (visible(returnFocus)) returnFocus.focus();
    else sectionsButton.focus();
    returnFocus = null;
  };
  function openSections() {
    if (sections.open) return closeSections();
    returnFocus = doc.activeElement;
    sections.replaceChildren();
    const title = doc.createElement('h2'),
      close = doc.createElement('button');
    authoringLabel(title, 'sections');
    authoringLabel(close, 'back');
    setMenuIcon(close, 'back');
    close.type = 'button';
    close.onclick = closeSections;
    sections.append(title, close);
    const pageActions = doc.createElement('button');
    pageActions.type = 'button';
    authoringLabel(pageActions, 'pageActions');
    setMenuIcon(pageActions, 'controls');
    pageActions.onclick = () => {
      sections.close();
      const target =
        [...doc.querySelectorAll(`header ${focusable.split(',').join(',header ')}`)].find(
          visible,
        ) || sectionsButton;
      target.focus();
      target.scrollIntoView({ block: 'nearest' });
      returnFocus = null;
    };
    sections.append(pageActions);
    const headings = [...doc.querySelectorAll('main h2,main h3,section > h2,aside > h2')].filter(
      (heading) => visible(heading) && !heading.closest('dialog'),
    );
    for (const heading of headings.slice(0, 64)) {
      const button = doc.createElement('button');
      button.type = 'button';
      button.textContent = heading.textContent.trim();
      setMenuIcon(button, 'content');
      button.onclick = () => {
        sections.close();
        const region = heading.closest('section,fieldset,details,article') || heading.parentElement;
        const target = [...region.querySelectorAll(focusable)].find(visible) || heading;
        if (!target.matches(focusable)) target.tabIndex = -1;
        target.focus();
        target.scrollIntoView({ block: 'nearest' });
        returnFocus = null;
      };
      sections.append(button);
    }
    sections.showModal();
    close.focus();
  }
  let navigation, lifecycle;
  const active = () =>
    !disposed &&
    !doc.hidden &&
    doc.hasFocus?.() !== false &&
    doc.activeElement?.tagName !== 'IFRAME';
  const guard = attachControllerConfirmGuard({
    document: doc,
    now,
    confirmPressed: () => active() && router.menuConfirmPressed(),
    beforeNativeActivation: (event) => {
      if (active()) lifecycle?.beforeNativeActivation(event);
    },
  });
  const sources = createAuthoringSourcePicker({
    document: doc,
    window: win,
    onOpen: () => navigation?.sync(),
    onClose: () => router.clear(),
  });
  const getScope = () =>
    topDialog()?.id ||
    (sources.dialog.open
      ? 'authoring-sources'
      : sections.open
        ? 'authoring-sections'
        : 'authoring');
  const getRoot = () => topDialog() || doc;
  navigation = createNavigation({
    document: doc,
    keyboard: true,
    getScope,
    getRoot,
    getDefaultFocus: () => [...(topDialog() || doc).querySelectorAll(focusable)].find(visible),
    resolveEditor: resolveAuthoringEditor,
    activateFileInput: (input) => sources.open(input),
    ownsKeyboardEvent: (event) => !!event.target.closest('[data-controller-editor]'),
    activateControl: (element) => guard.activate(element),
    onNativeInput: (event) => {
      lifecycle?.nativeInput(event);
      router.clear();
    },
    onBack: () => {
      const dialog = topDialog();
      if (dialog === sources.dialog) sources.close();
      else if (dialog === sections) closeSections();
      else if (dialog) {
        const event = new win.Event('cancel', { cancelable: true });
        if (dialog.dispatchEvent(event)) dialog.close();
      } else if (onPageBack) onPageBack();
      else openSections();
    },
    onMenu: openSections,
    onHint: (text) => {
      if (hint.textContent !== text) hint.textContent = text;
    },
  });
  lifecycle = createControllerConfirmLifecycle({
    document: doc,
    readConfirm: (options) => router.readMenuConfirm(options),
    getContext: () => ({
      scope: getScope(),
      root: getRoot(),
      focused: doc.activeElement,
      active: active(),
    }),
    navigation,
    guard,
    now,
  });
  sectionsButton.onclick = openSections;
  listen(sections, 'cancel', (event) => {
    event.preventDefault();
    closeSections();
  });
  function discover() {
    for (const input of doc.querySelectorAll('input[type="file"]')) {
      if (fileButtons.has(input)) continue;
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'authoring-source-open';
      authoringLabel(button, 'chooseSource');
      setMenuIcon(button, 'collection');
      button.onclick = () => sources.open(input);
      input.after(button);
      fileButtons.set(input, button);
    }
    for (const [input, button] of fileButtons) {
      if (!input.isConnected) {
        button.remove();
        fileButtons.delete(input);
      } else {
        if (button.disabled !== input.disabled) button.disabled = input.disabled;
        const hidden = !visible(input);
        if (button.hidden !== hidden) button.hidden = hidden;
      }
    }
    for (const frame of doc.querySelectorAll('iframe'))
      if (!previews.has(frame))
        previews.set(frame, attachAuthoringPreview(frame, { document: doc, window: win }));
    for (const [frame, preview] of previews) {
      if (!frame.isConnected) {
        preview.destroy();
        previews.delete(frame);
      } else preview.refresh();
    }
  }
  const observer = new win.MutationObserver(discover);
  observer.observe(doc.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['hidden', 'disabled', 'open'],
  });
  discover();
  const clear = () => {
    router.clear();
    lifecycle.cancel('authoring-input-clear');
    navigation.clear();
  };
  function poll(now) {
    if (disposed) return;
    if (doc.hidden || doc.hasFocus?.() === false || doc.activeElement?.tagName === 'IFRAME')
      clear();
    else {
      const scope = getScope(),
        frame = router.sample({ scope, timeMs: now });
      if (frame.status?.code === 'joined') navigation.engage();
      lifecycle.sample(frame.confirmSnapshot);
      if (scope === getScope()) navigation.handle({ ...frame.ui, confirm: false });
    }
    animationFrame = win.requestAnimationFrame(poll);
  }
  listen(win, 'blur', clear);
  listen(doc, 'visibilitychange', clear);
  listen(win, 'pagehide', (event) => {
    if (!event.persisted) owner.destroy();
    else clear();
  });
  const owner = {
    navigation,
    sources,
    router,
    destroy() {
      if (disposed) return;
      disposed = true;
      win.cancelAnimationFrame(animationFrame);
      observer.disconnect();
      listeners.forEach((remove) => remove());
      lifecycle.destroy();
      navigation.destroy();
      guard.destroy();
      router.destroy();
      sources.destroy();
      previews.forEach((preview) => preview.destroy());
      fileButtons.forEach((button) => button.remove());
      rail.remove();
      sections.remove();
      links.remove();
      if (!alreadyStyled) doc.body.classList.remove('authoring-input-page');
      hosts.delete(doc);
    },
  };
  hosts.set(doc, owner);
  animationFrame = win.requestAnimationFrame(poll);
  return owner;
}
