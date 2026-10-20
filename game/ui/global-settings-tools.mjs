import { getLocale, localizedAttribute, localizedText, t } from '../i18n/index.mjs';
import { attachProfileRecoveryDialog } from './profile-recovery-dialog.mjs';
import { attachStorageRetention } from './storage-retention.mjs';
import { attachInstallOfflinePanel } from './install-offline-panel.mjs';
import { setMenuIcon } from './native-menu-icons.mjs';
import { restoreSettingsPanelFocus } from './settings-panels.mjs';

const owners = new WeakMap();
const radioBridgeKey = Symbol.for('revealline.page-radio-menu');
export const globalSettingsToolsRoot = (doc = globalThis.document) =>
  owners.get(doc)?.root() ?? null;
export const globalSettingsToolFrameFocused = (doc = globalThis.document) =>
  owners.get(doc)?.frameFocused() === true;
export const closeGlobalSettingsTool = (doc = globalThis.document) =>
  owners.get(doc)?.back() === true;

/** Child tools belong to this paused host; unrelated frames still suspend it. */
export function guardGlobalSettingsToolBlur(callback, doc = globalThis.document) {
  return (...args) => {
    if (!globalSettingsToolsRoot(doc)) return callback(...args);
    queueMicrotask(() => {
      if (!globalSettingsToolFrameFocused(doc)) callback(...args);
    });
  };
}

function recoveryMarkup(doc) {
  const dialog = doc.createElement('dialog');
  dialog.id = 'profile-recovery-dialog';
  dialog.setAttribute('aria-labelledby', 'profile-recovery-title');
  const root = doc.createElement('section');
  root.id = 'profile-recovery-root';
  dialog.append(root);
  const add = (tag, id, key, options = {}) => {
    const node = doc.createElement(tag);
    if (id) node.id = `profile-recovery-${id}`;
    if (tag === 'button') node.type = 'button';
    if (key) localizedText(node, () => t(`interface:${key}`));
    Object.assign(node, options);
    if (tag === 'label') node.setAttribute('for', `profile-recovery-${id.slice(0, -6)}`);
    root.append(node);
    return node;
  };
  add('button', 'back', 'backToSettings');
  add('h2', 'title', 'storedProfileRecovery');
  add('p', null, 'reviewStoredProfilesFromThisSiteWithoutChangingThemExact');
  add('p', null, 'readStoredValuesOrVerifyOneSelectedOriginalImageFlight');
  add('button', 'find', 'findProfiles', { disabled: true });
  add('button', 'cancel', 'cancelCheck', { hidden: true });
  add('label', 'channel-label', 'storedProfile');
  add('select', 'channel', null, { disabled: true });
  add('button', 'review', 'review', { disabled: true });
  add('button', 'export', 'prepareStoredDataExport', { disabled: true });
  const status = add('p', 'status', 'openRecoveryFromSettingsToInspectStoredProfiles');
  status.setAttribute('role', 'status');
  add('p', 'summary');
  add('a', 'download', 'downloadStoredProfileSnapshot', { hidden: true });
  add('h2', null, 'selectedOriginalImages');
  add('p', 'catalog-status');
  add('p', null, 'originalFilesAreSharedByProfilesOnThisSiteListing');
  add('button', 'originals-review', 'reviewOriginals', { disabled: true });
  add('label', 'original-label', 'sharedOriginal');
  add('select', 'original', null, { disabled: true });
  add('p', 'original-summary');
  for (const [id, key] of [
    ['original-verify', 'verifyImage'],
    ['original-file', 'prepareOriginalFile'],
    ['original-report', 'prepareIdentityReport'],
  ])
    add('button', id, key, { disabled: true });
  add('a', 'original-download', 'downloadOriginalImage', { hidden: true });
  add('a', 'report-download', 'downloadIdentityReport', { hidden: true });
  add('p', null, 'storedDataExportsExcludeOriginalFilesSelectedImageDownloadsExclude');
  doc.body.append(dialog);
  return dialog;
}

/** Real global tools with no gameplay/profile writer. Hosts retain their attempt
 * and inject their existing download authority and Settings visit identity. */
export function mountGlobalSettingsTools({
  document: doc = globalThis.document,
  window: win = globalThis.window,
  settingsRoot,
  panels,
  existing = {},
  prefix = 'global',
  getSettingsOpen = () =>
    !!settingsRoot &&
    (settingsRoot.tagName !== 'DIALOG' || settingsRoot.open) &&
    !settingsRoot.closest('[hidden],[inert],[aria-hidden="true"]'),
  getOwner = () => null,
  isOwnerCurrent = () => true,
  onOpen = () => {},
  currentVersion = doc.documentElement.dataset.buildVersion,
  resolveSourceVersion,
  packaged = !!currentVersion && !currentVersion.includes('__'),
  editionId,
  heldWriter,
  offlinePanel,
  coreURL = new URL('../', import.meta.url),
  loadRecovery,
  createRadioNavigation,
} = {}) {
  if (owners.has(doc)) return owners.get(doc);
  const controls = { ...existing },
    created = [],
    cleanups = [];
  let disposed = false,
    recovery,
    retention,
    toolDialog,
    toolFrame,
    toolOpener,
    toolOwner,
    releaseToolKeyboard = () => {},
    radioNavigation = null,
    radioDocument = null,
    radioNativeOwner = null,
    radioToken = null,
    radioHint = null;
  const releaseToolRadio = () => {
    radioNativeOwner?.release(radioToken);
    radioNavigation?.dispose();
    radioHint?.remove();
    radioNavigation = radioDocument = radioNativeOwner = radioToken = radioHint = null;
  };
  const valid = (owner) => !disposed && getSettingsOpen() && isOwnerCurrent(owner);
  const make = (tag, key, copy) => {
    const node = doc.createElement(tag);
    if (key) node.id = `${prefix}-${key}`;
    if (tag === 'button') node.type = 'button';
    if (copy) localizedText(node, () => t(copy));
    return node;
  };
  const row = (key, category, copy, icon) => {
    const section = make('section', `${key}-row`),
      button = make('button', key, copy);
    section.dataset.globalToolRow = key;
    button.dataset.globalTool = key;
    setMenuIcon(button, icon);
    section.append(button);
    panels[category]?.append(section);
    controls[key] = section;
    created.push(section);
    return { section, button };
  };
  const stylesheet = (file) => {
    const href = new URL(file, import.meta.url).href;
    if ([...doc.querySelectorAll('link[rel="stylesheet"]')].some((node) => node.href === href))
      return;
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    doc.head.append(link);
    created.push(link);
  };
  stylesheet('global-settings-tools.css');
  if (!controls.profileRecovery && panels.data && !doc.getElementById('profile-recovery-dialog')) {
    const { section, button } = row(
      'profileRecovery',
      'data',
      'interface:storedProfileRecovery',
      'collection',
    );
    button.id = 'profile-recovery-open';
    const entryStatus = make('p');
    entryStatus.id = 'profile-recovery-entry-status';
    entryStatus.setAttribute('role', 'status');
    section.append(entryStatus);
    const dialog = recoveryMarkup(doc);
    created.push(dialog);
    stylesheet('profile-recovery-dialog.css');
    recovery = attachProfileRecoveryDialog({
      document: doc,
      window: win,
      currentVersion,
      editionId,
      heldWriter,
      packaged,
      resolveSourceVersion:
        resolveSourceVersion ??
        (async () => {
          const response = await (win.fetch ?? globalThis.fetch)(
            new URL('build-config.json', coreURL),
          );
          if (!response.ok) throw new Error(t('interface:recoveryLoadingTimedOut'));
          return (await response.json()).version;
        }),
      isSettingsOpen: getSettingsOpen,
      getOwner,
      isOwnerCurrent,
      onOpen,
      ...(loadRecovery ? { load: loadRecovery } : {}),
    });
  }
  if (!controls.storageRetention && panels.content) {
    const { section, button } = row(
      'storageRetention',
      'content',
      'interface:keepDownloadsOnThisDevice',
      'content',
    );
    const status = make('p', 'retention-status', 'interface:retentionHasNotBeenChecked');
    status.setAttribute('role', 'status');
    section.append(status);
    retention = attachStorageRetention({
      button,
      status,
      isOpen: getSettingsOpen,
      navigator: win.navigator,
    });
    // Capture refresh establishes a live visit before the explicit click asks
    // for persistence. Its browser prompt stays inside the player's gesture.
    const refresh = () => {
      void retention.refresh();
    };
    button.addEventListener('click', refresh, true);
    cleanups.push(() => button.removeEventListener('click', refresh, true));
  }
  const ownsOffline = !offlinePanel;
  if (!offlinePanel && coreURL)
    offlinePanel = attachInstallOfflinePanel({
      document: doc,
      window: win,
      downloadsURL: new URL('downloads.html', coreURL),
      onOpen,
      canActivate: () => false,
    });
  if (!controls.offlineTools && panels.content && offlinePanel) {
    const { button } = row(
      'offlineTools',
      'content',
      'interface:installAppGameAndSoundtrackDownloads',
      'content',
    );
    button.onclick = () => {
      if (getSettingsOpen()) offlinePanel.open();
    };
  }
  const closeTool = () => {
    releaseToolRadio();
    if (toolDialog?.open) toolDialog.close();
  };
  const openTool = (button, title, url) => {
    if (!getSettingsOpen() || disposed) return;
    toolOwner = getOwner();
    onOpen();
    if (!valid(toolOwner)) return;
    toolOpener = button;
    if (!toolDialog) {
      toolDialog = make('dialog', 'tool-dialog');
      toolDialog.className = 'global-settings-tool-dialog';
      const header = make('header'),
        back = make('button', 'tool-back', 'interface:backToSettings'),
        enter = make('button', 'tool-enter'),
        heading = make('h2', 'tool-title');
      toolDialog.setAttribute('aria-labelledby', heading.id);
      back.onclick = closeTool;
      setMenuIcon(back, 'back');
      localizedText(enter, () => (getLocale() === 'uk' ? 'Перейти до інструмента' : 'Enter tool'));
      enter.disabled = true;
      enter.onclick = () => {
        if (enter.disabled || !valid(toolOwner)) return;
        releaseToolRadio();
        toolFrame.focus({ preventScroll: true });
        try {
          toolFrame.contentWindow?.focus?.();
        } catch {
          // The outer Back button remains available for opaque child pages.
        }
      };
      header.append(back, heading, enter);
      toolFrame = make('iframe', 'tool-frame');
      toolFrame.tabIndex = 0;
      toolFrame.addEventListener('load', () => {
        releaseToolRadio();
        enter.disabled = false;
        releaseToolKeyboard();
        releaseToolKeyboard = () => {};
        // Native key events stop at an iframe boundary. Leave inner dialogs and
        // practice gameplay with their own Back action, and route an unclaimed
        // Escape in the tool page to its paused Settings parent.
        try {
          const childWindow = toolFrame.contentWindow,
            childDocument = toolFrame.contentDocument;
          if (!childDocument || childWindow.location.origin !== win.location.origin) return;
          const escape = (event) => {
            if (
              event.key !== 'Escape' ||
              event.defaultPrevented ||
              !toolDialog.open ||
              !valid(toolOwner) ||
              doc.hidden ||
              doc.activeElement !== toolFrame ||
              childDocument.querySelector('dialog[open]')
            )
              return;
            event.preventDefault();
            event.stopPropagation();
            closeTool();
          };
          childWindow.addEventListener('keydown', escape);
          releaseToolKeyboard = () => childWindow.removeEventListener('keydown', escape);
        } catch {
          // A navigation to an opaque origin retains the outer native Back control.
        }
      });
      const external = make('a', 'tool-open-page', 'interface:globalSettings.openToolPage');
      external.target = '_blank';
      external.rel = 'noopener';
      header.append(external);
      toolDialog.append(header, toolFrame);
      doc.body.append(toolDialog);
      created.push(toolDialog);
      toolDialog.addEventListener('cancel', (event) => {
        event.preventDefault();
        closeTool();
      });
      toolDialog.addEventListener('close', () => {
        releaseToolRadio();
        releaseToolKeyboard();
        releaseToolKeyboard = () => {};
        toolFrame.removeAttribute('src');
        if (valid(toolOwner) && !doc.hidden && doc.hasFocus?.() !== false) {
          if (restoreSettingsPanelFocus(settingsRoot, toolOpener)) return;
          if (
            toolOpener?.isConnected &&
            !toolOpener.disabled &&
            !toolOpener.closest('[hidden],[inert],[aria-hidden="true"]') &&
            toolOpener.getClientRects().length
          )
            toolOpener.focus({ preventScroll: true });
        }
      });
    }
    localizedText(doc.getElementById(`${prefix}-tool-title`), () => t(title));
    localizedAttribute(toolFrame, 'title', () => t(title));
    releaseToolRadio();
    doc.getElementById(`${prefix}-tool-enter`).disabled = true;
    toolFrame.src = url.href;
    doc.getElementById(`${prefix}-tool-open-page`).href = url.href;
    toolDialog.showModal();
    doc.getElementById(`${prefix}-tool-back`).focus({ preventScroll: true });
  };
  if (coreURL)
    for (const [key, category, title, route, icon] of [
      [
        'controllerTools',
        'controls',
        'interface:controllerPractice2',
        'controller-lab/',
        'controls',
      ],
      ['creatorTools', 'extras', 'interface:nativeMenu.creatorTools', 'creator/', 'content'],
      ['about', 'extras', 'common:navigation.aboutCredits', '../site/about.html#versions', 'info'],
    ]) {
      if (controls[key] || !panels[category]) continue;
      const { button } = row(key, category, title, icon);
      button.onclick = () => openTool(button, title, new URL(route, coreURL));
    }
  const ownsToolFrame = () =>
    !disposed &&
    !doc.hidden &&
    doc.hasFocus?.() !== false &&
    toolDialog?.open &&
    valid(toolOwner) &&
    doc.activeElement === toolFrame;
  const nativeRadioOwner = (document) => {
    const candidate = document?.[radioBridgeKey];
    return candidate &&
      ['claim', 'handle', 'release'].every((key) => typeof candidate[key] === 'function')
      ? candidate
      : null;
  };
  const pollToolRadio = ({ radio, now }) => {
    if (
      !ownsToolFrame() ||
      typeof createRadioNavigation !== 'function' ||
      !radio ||
      typeof radio.key !== 'string' ||
      !Number.isInteger(radio.index) ||
      radio.index < 0 ||
      (radio.verified !== true && radio.provisional !== true)
    ) {
      releaseToolRadio();
      return false;
    }
    let childDocument, childWindow;
    const route = [];
    try {
      childWindow = toolFrame.contentWindow;
      childDocument = toolFrame.contentDocument;
      if (
        !childDocument?.body ||
        childWindow.location.origin !== win.location.origin ||
        childDocument.hidden
      ) {
        releaseToolRadio();
        return false;
      }
      route.push({ frame: toolFrame, document: childDocument, parent: doc, back: closeTool });
      // Follow only a deliberately entered authoring preview with its own
      // native menu owner. Running games keep their existing input authority.
      for (let depth = 0; depth < 4; depth++) {
        const preview = nativeRadioOwner(childDocument)?.preview?.();
        if (
          !preview?.frame ||
          typeof preview.back !== 'function' ||
          childDocument.activeElement !== preview.frame
        )
          break;
        try {
          const nestedDocument = preview.frame.contentDocument,
            nestedWindow = preview.frame.contentWindow;
          if (
            !nestedDocument?.body ||
            nestedDocument.hidden ||
            nestedWindow.location.origin !== win.location.origin ||
            !nativeRadioOwner(nestedDocument)
          )
            break;
          route.push({
            frame: preview.frame,
            document: nestedDocument,
            parent: childDocument,
            back: preview.back,
          });
          childDocument = nestedDocument;
          childWindow = nestedWindow;
        } catch {
          break;
        }
      }
    } catch {
      releaseToolRadio();
      return false;
    }
    const childCurrent = () => {
      try {
        return (
          ownsToolFrame() &&
          !childDocument.hidden &&
          route.every(
            (entry) =>
              entry.parent.activeElement === entry.frame &&
              entry.frame.contentDocument === entry.document,
          )
        );
      } catch {
        return false;
      }
    };
    const backToParent = () => {
      if (!childCurrent()) return;
      const back = route.at(-1).back;
      releaseToolRadio();
      back();
    };
    if (radioDocument !== childDocument) {
      releaseToolRadio();
      radioDocument = childDocument;
      radioToken = {};
      radioHint = childDocument.createElement('p');
      radioHint.setAttribute('role', 'status');
      radioHint.dataset.radioMenuHint = '';
      radioHint.style.cssText =
        'position:fixed;bottom:4px;left:8px;right:8px;z-index:10000;margin:0;padding:6px;background:#101820;color:#edf2ff;font:13px system-ui;pointer-events:none;';
      childDocument.body.append(radioHint);
      radioNavigation = createRadioNavigation({
        document: childDocument,
        window: childWindow,
        keyboard: false,
        getContext: () => {
          if (!childCurrent()) return null;
          const nestedFrame = childDocument.activeElement?.tagName === 'IFRAME',
            root = [...childDocument.querySelectorAll('dialog[open]')].at(-1) ?? childDocument.body;
          return {
            root,
            key: nestedFrame ? 'tool-preview' : root,
            frameFocused: nestedFrame,
            handleFrameCommand: (command) => {
              if (command.source === 'radio') return false;
              if (command.back) {
                const preview = radioNativeOwner?.preview?.();
                if (preview?.back) {
                  releaseToolRadio();
                  preview.back();
                } else backToParent();
              }
              return true;
            },
          };
        },
        onDeviceJoin: () => radioNativeOwner?.handle(radioToken, 'join') === true,
        onCommand: (action) => {
          if (!radioNativeOwner) return false;
          radioNativeOwner.handle(radioToken, action);
          return true;
        },
        onBack: () => {
          const dialog = [...childDocument.querySelectorAll('dialog[open]')].at(-1);
          if (dialog) {
            const event = new childWindow.Event('cancel', { cancelable: true });
            if (dialog.dispatchEvent(event)) dialog.close();
          } else backToParent();
        },
        onHint: (message) => {
          if (radioHint)
            radioHint.textContent =
              childDocument.activeElement?.tagName === 'IFRAME'
                ? getLocale() === 'uk'
                  ? 'Перегляд має власне керування. Увімкніть і вимкніть Зброя, щоб повернутися до редактора.'
                  : 'The preview uses its own controls. Turn Weapon on then off to return to the editor.'
                : message;
        },
      });
    }
    const bridge = nativeRadioOwner(childDocument);
    if (bridge !== radioNativeOwner) {
      radioNativeOwner?.release(radioToken);
      radioNativeOwner = bridge;
      radioNavigation.reset({ leaveDevice: true });
    }
    if (
      radio &&
      (radio.verified === true || radio.provisional === true) &&
      Number.isInteger(radio.index) &&
      radio.index >= 0
    ) {
      radioNativeOwner?.claim({
        token: radioToken,
        index: radio.index,
        isCurrent: childCurrent,
        onBack: backToParent,
      });
    } else radioNativeOwner?.release(radioToken);
    radioNavigation.poll({ radio, now, gamepads: [] });
    return true;
  };
  const api = {
    controls,
    root() {
      const dialog = doc.getElementById('profile-recovery-dialog');
      return toolDialog?.open
        ? toolDialog
        : recovery && dialog?.open
          ? dialog
          : (offlinePanel?.root() ?? null);
    },
    frameFocused() {
      const focused = ownsToolFrame();
      if (!focused) releaseToolRadio();
      return focused || offlinePanel?.frameFocused() === true;
    },
    // A focused child owns ordinary input. Handle only the outer Back/Menu
    // boundary before controller navigation tries to repair its missing root.
    handleFrameCommand(command = {}) {
      if (command.source === 'radio') return pollToolRadio(command);
      if (!toolDialog?.open || doc.activeElement !== toolFrame) return false;
      if (command.back || command.menu) closeTool();
      return true;
    },
    back() {
      if (toolDialog?.open) {
        closeTool();
        return true;
      }
      if (recovery && doc.getElementById('profile-recovery-dialog')?.open) {
        void recovery.close();
        return true;
      }
      if (offlinePanel?.root()) {
        offlinePanel.close();
        return true;
      }
      return false;
    },
    refresh() {
      recovery?.refresh();
      void retention?.refresh();
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      if (owners.get(doc) === api) owners.delete(doc);
      cleanups.forEach((fn) => fn());
      retention?.destroy();
      closeTool();
      if (ownsOffline) offlinePanel?.dispose();
      await recovery?.dispose();
      created.reverse().forEach((node) => node.remove());
    },
  };
  owners.set(doc, api);
  return api;
}
