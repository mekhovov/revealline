import {
  resolvePresentation,
  applyResolvedPresentation,
  getInterfaceTheme,
  resolveThemeFamilySelection,
  BUILTIN_THEME_FAMILIES,
  saveAcceptedAppearance,
  loadAcceptedAppearance,
  ACCEPTED_APPEARANCE_CONTEXT_KEY,
} from './theme-system.mjs';
import { validateThemeCandidate } from './theme-system.mjs';
import { createThemePreferences } from './theme-preferences.mjs';
import { createMenuStylePreferences } from '../menu-style-preferences.mjs';
import { createDisplayPreferences } from '../display-preferences.mjs';
import { onLocaleChange, t } from '../i18n/index.mjs';

const hosts = new WeakMap();
const styleURL = new URL('./industrial-workshop.css', import.meta.url).href;
// Shared contracts retain stable, nonlocalized diagnostics. Translate the
// actionable notices only at the DOM boundary, where the active locale lives.
const noticeKeys = new Map([
  ['Theme stylesheet unavailable.', 'stylesheetUnavailable'],
  ['Theme applies to this session; saving is disabled here.', 'readOnly'],
  ['Theme applies to this session, but could not be saved.', 'saveFailed'],
  ['Theme applies here, but SIM appearance could not be saved.', 'simSaveFailed'],
]);
function presentationNotice(message) {
  const key = noticeKeys.get(message);
  if (key) return t(`interface:workshop.notice.${key}`);
  const missing = /^Theme unavailable: ([a-z][a-z0-9-]{0,63}(?:@r[1-9][0-9]{0,8})?)$/.exec(message);
  return missing ? t('interface:workshop.notice.themeUnavailable', { theme: missing[1] }) : message;
}
function loadStyles(doc) {
  if (!doc.head) return Promise.resolve();
  let found = doc.querySelector('link[data-industrial-workshop]');
  if (found?.sheet) {
    try {
      if (found.sheet.cssRules.length > 0) return Promise.resolve();
    } catch {
      found.remove();
      found = null;
    }
  }
  if (found && doc.readyState === 'complete') {
    found.remove();
    found = null;
  }
  const link = found ?? doc.createElement('link');
  return new Promise((resolve, reject) => {
    let timeout;
    const cleanup = () => {
      clearTimeout(timeout);
      link.removeEventListener('load', loaded);
      link.removeEventListener('error', failed);
    };
    const loaded = () => {
      cleanup();
      resolve();
    };
    const failed = () => {
      cleanup();
      link.remove();
      reject(new Error('Theme stylesheet unavailable.'));
    };
    link.addEventListener('load', loaded);
    link.addEventListener('error', failed);
    timeout = setTimeout(failed, 8000);
    if (!found) {
      link.rel = 'stylesheet';
      link.href = styleURL;
      link.setAttribute('data-industrial-workshop', '');
      doc.head.append(link);
    }
  });
}

/** One document owner, with independent leases for shared tool/page adapters. */
export function installThemeHost({
  document: doc = globalThis.document,
  window: win = doc?.defaultView ?? globalThis.window,
  getStorage = () => win?.localStorage,
  writable = () => true,
  studio = false,
  familyId,
  appearanceDefault,
  appearanceThemes,
  displayPreferences,
  menuPreferences,
  prepareStyles = loadStyles,
  onWarning = () => {},
} = {}) {
  if (!doc?.documentElement) throw new TypeError('Theme host needs a document.');
  const existing = hosts.get(doc);
  if (existing) {
    if (appearanceThemes !== undefined) existing.setThemes(appearanceThemes);
    if (appearanceDefault !== undefined) existing.setDefault(appearanceDefault);
    return existing.lease();
  }
  let disposed = false,
    sequence = 0,
    override = null,
    removePresentation = null;
  let snapshot = null,
    pending = Promise.resolve(null),
    warning = '',
    refs = 0;
  const listeners = new Set(),
    statusListeners = new Set(),
    stops = [];
  const reportWarning = (message) => onWarning(presentationNotice(message));
  const preferences = createThemePreferences({
    window: win,
    getStorage,
    writable,
    onWarning: reportWarning,
  });
  const display =
    displayPreferences ?? createDisplayPreferences({ window: win, getStorage, writable });
  const menu = menuPreferences ?? createMenuStylePreferences({ window: win, getStorage, writable });
  let coarse;
  try {
    coarse = win?.matchMedia?.('(pointer: coarse)');
  } catch {
    /* No media query API. */
  }
  let styles,
    observer,
    contextDefault = appearanceDefault;
  const validateThemes = (value) => {
    if (!Array.isArray(value) || value.length > 64)
      throw new TypeError('Invalid curated theme inventory.');
    const result = value.map(validateThemeCandidate);
    if (new Set(result.map((row) => row.family.id)).size !== result.length)
      throw new TypeError('Duplicate curated theme identity.');
    return Object.freeze(result);
  };
  let customThemes = validateThemes(appearanceThemes ?? []),
    acceptedFamily = null;
  const resolveSelection = (
    appearanceDefault,
    intent = familyId ?? preferences.snapshot().familyId,
  ) => {
    const requested = intent === 'follow-game' ? appearanceDefault : { familyId: intent };
    let custom = customThemes.find(
      (row) =>
        row.family.id === requested?.familyId &&
        (!requested.revision || row.family.revision === requested.revision),
    );
    if (!custom && intent !== 'follow-game') {
      try {
        const accepted = loadAcceptedAppearance(win?.sessionStorage);
        if (
          accepted?.family.id === requested?.familyId &&
          (!requested.revision || accepted.family.revision === requested.revision)
        )
          custom = accepted;
      } catch {
        /* Denied session context keeps the ordinary fallback. */
      }
    }
    return custom
      ? {
          family: custom.family,
          candidate: custom,
          interfaceTheme: custom.interfaceTheme,
          requested,
          source: intent === 'follow-game' ? 'context' : 'personal',
          fallbackReason: null,
        }
      : resolveThemeFamilySelection({ familyId: intent, appearanceDefault });
  };
  const notifyStatus = () => {
    for (const listener of statusListeners) {
      try {
        listener(presentationNotice(warning || preferences.getWarning()));
      } catch {
        /* A status consumer cannot interrupt presentation ownership. */
      }
    }
  };
  const resolveContext = (appearanceDefault = contextDefault) => {
    const intent = preferences.snapshot();
    const body = doc.body?.dataset ?? {};
    const selection = resolveSelection(appearanceDefault);
    const resolved = resolvePresentation({
      themeFamily: selection.family,
      interfaceId: override ?? undefined,
      ...(selection.interfaceTheme && !override
        ? { interfaceTheme: selection.interfaceTheme, interfaceBasis: selection.candidate?.basis }
        : {}),
      accessibility: {
        ...display.snapshot(),
        ...intent,
        coarsePointer: coarse?.matches === true,
        ...(body.textFace ? { textFace: body.textFace } : {}),
        ...(body.textSize ? { textSize: body.textSize } : {}),
        ...(body.effects ? { effectiveReducedEffects: body.effects === 'reduced' } : {}),
      },
      density: studio ? 'studio' : 'player',
      ornaments: intent.ornaments === 'theme' ? 'subtle' : intent.ornaments,
    });
    return { resolved, selection };
  };
  const prepareResources = async (resolved) => {
    // All built-in material data is inline and immutable; only the shared sheet
    // needs fetching. Keep the accepted presentation during failed/late loads.
    styles ??= Promise.resolve()
      .then(() => prepareStyles(doc))
      .catch((error) => {
        styles = null;
        throw error;
      });
    await styles;
    if ((resolved.interfaceId !== 'legacy' || resolved.revision !== 'r1') && doc.fonts?.load) {
      await Promise.all(
        Object.entries(resolved.fonts).map(([role, stack]) =>
          doc.fonts.load(
            `${role === 'display' ? 600 : role === 'mono' ? 500 : 400} 16px ${stack}`,
            'Workshop Майстерня 012345',
          ),
        ),
      );
    }
  };
  const accept = ({ resolved, selection }, ticket) => {
    removePresentation?.();
    removePresentation = applyResolvedPresentation(doc.documentElement, resolved);
    snapshot = resolved;
    acceptedFamily = selection.family;
    try {
      if (selection.candidate) saveAcceptedAppearance(win?.sessionStorage, selection.candidate);
      else win?.sessionStorage?.removeItem(ACCEPTED_APPEARANCE_CONTEXT_KEY);
    } catch {
      /* A cache write cannot affect atomic presentation acceptance. */
    }
    warning = selection.fallbackReason ?? '';
    notifyStatus();
    for (const listener of [...listeners]) {
      if (disposed || ticket !== sequence) break;
      try {
        listener(snapshot);
      } catch (error) {
        reportWarning(error.message);
      }
    }
    return snapshot;
  };
  const refresh = () => {
    if (disposed) return Promise.resolve(null);
    const value = resolveContext(),
      ticket = ++sequence;
    pending = prepareResources(value.resolved)
      .then(() => {
        if (disposed || ticket !== sequence) return snapshot;
        return accept(value, ticket);
      })
      .catch((error) => {
        if (!disposed && ticket === sequence) {
          warning = error.message;
          notifyStatus();
          try {
            reportWarning(warning);
          } catch {
            /* Status is optional. */
          }
        }
        return snapshot;
      });
    return pending;
  };
  const close = () => {
    if (disposed) return;
    disposed = true;
    ++sequence;
    for (const stop of stops) stop();
    preferences.dispose();
    if (!displayPreferences) display.dispose();
    if (!menuPreferences) menu.dispose();
    removePresentation?.();
    listeners.clear();
    statusListeners.clear();
    observer?.disconnect();
    coarse?.removeEventListener?.('change', refresh);
    win?.removeEventListener?.('pagehide', pagehide);
    hosts.delete(doc);
  };
  const pagehide = (event) => {
    if (!event.persisted) close();
  };
  const normalizeDefault = (ref) => {
    if (
      ref !== null &&
      ref !== undefined &&
      (typeof ref.familyId !== 'string' ||
        !/^[a-z][a-z0-9-]{0,63}$/.test(ref.familyId) ||
        !/^r[1-9][0-9]{0,8}$/.test(ref.revision))
    )
      throw new TypeError('Invalid appearance default');
    return ref ? Object.freeze({ familyId: ref.familyId, revision: ref.revision }) : null;
  };
  const setDefault = (ref) => {
    contextDefault = normalizeDefault(ref);
    return refresh();
  };
  // Attempt preparation may fetch/decode ahead of adoption. Nothing is accepted
  // until the caller commits synchronously immediately before latching artwork.
  const prepareDefault = async (ref) => {
    const next = normalizeDefault(ref),
      previous = JSON.stringify(contextDefault);
    const value = resolveContext(next),
      fingerprint = JSON.stringify(value),
      preferenceFingerprint = JSON.stringify(preferences.snapshot());
    await prepareResources(value.resolved);
    let consumed = false;
    return Object.freeze({
      commit() {
        if (consumed || disposed) return false;
        consumed = true;
        if (
          JSON.stringify(contextDefault) !== previous ||
          JSON.stringify(preferences.snapshot()) !== preferenceFingerprint ||
          JSON.stringify(resolveContext(next)) !== fingerprint
        )
          return false;
        contextDefault = next;
        const ticket = ++sequence;
        accept(value, ticket);
        pending = Promise.resolve(snapshot);
        return true;
      },
    });
  };
  const entry = {
    setDefault,
    setThemes(value) {
      customThemes = validateThemes(value);
      return refresh();
    },
    lease() {
      refs++;
      let released = false;
      return Object.freeze({
        preferences,
        get ready() {
          return pending;
        },
        snapshot: () => snapshot,
        effectivePreferences: () => {
          const effective = acceptedFamily ?? resolveSelection(contextDefault).family;
          return {
            ...preferences.snapshot(),
            familyId: snapshot?.familyId ?? effective.id,
            familyRevision: snapshot?.familyRevision ?? effective.revision,
            arcadeCollection: effective.arcade,
          };
        },
        setDefault,
        setThemes: entry.setThemes,
        availableFamilies: () => [
          ...BUILTIN_THEME_FAMILIES,
          ...customThemes.map((row) => row.family),
        ],
        // The controls use the same entries for cards and the native selector.
        // Follow previews its context even while a personal family is active.
        availableThemeChoices: () => {
          const follow = resolveSelection(contextDefault, 'follow-game'),
            active = resolveSelection(contextDefault),
            candidates = [...customThemes];
          if (active.candidate && !candidates.some((row) => row.family.id === active.family.id))
            candidates.push(active.candidate);
          return [
            {
              id: 'follow-game',
              family: follow.family,
              interfaceTheme:
                follow.interfaceTheme ??
                getInterfaceTheme(follow.family.interface.id, follow.family.interface.revision),
            },
            ...BUILTIN_THEME_FAMILIES.map((family) => ({
              id: family.id,
              family,
              interfaceTheme: getInterfaceTheme(family.interface.id, family.interface.revision),
            })),
            ...candidates.map(({ family, interfaceTheme }) => ({
              id: family.id,
              family,
              interfaceTheme,
            })),
          ];
        },
        prepareDefault,
        applyComplete(id) {
          override = null;
          preferences.applyComplete(id);
          const EventType = win?.CustomEvent ?? globalThis.CustomEvent;
          if (EventType)
            win?.dispatchEvent?.(
              new EventType('revealline:complete-theme', { detail: { familyId: id } }),
            );
          return refresh();
        },
        set: (patch) => preferences.set(patch),
        refresh,
        getWarning: () => presentationNotice(warning || preferences.getWarning()),
        setInterface(id) {
          if (disposed) throw new Error('Theme host is disposed.');
          if (id !== null && !getInterfaceTheme(id))
            throw new TypeError('Unknown interface theme.');
          override = id;
          return refresh();
        },
        subscribe(listener) {
          if (disposed || typeof listener !== 'function')
            throw new TypeError('Theme listener required.');
          listeners.add(listener);
          if (snapshot) listener(snapshot);
          return () => listeners.delete(listener);
        },
        subscribeStatus(listener) {
          if (disposed || typeof listener !== 'function')
            throw new TypeError('Theme status listener required.');
          statusListeners.add(listener);
          listener(presentationNotice(warning || preferences.getWarning()));
          return () => statusListeners.delete(listener);
        },
        dispose() {
          if (!released) {
            released = true;
            if (--refs === 0) close();
          }
        },
      });
    },
  };
  hosts.set(doc, entry);
  stops.push(
    preferences.subscribe(refresh),
    display.subscribe(refresh),
    menu.subscribe(refresh),
    onLocaleChange(notifyStatus),
  );
  if (win?.MutationObserver && doc.body) {
    observer = new win.MutationObserver(refresh);
    observer.observe(doc.body, {
      attributes: true,
      attributeFilter: ['data-text-face', 'data-text-size', 'data-effects', 'data-menu-ornaments'],
    });
  }
  coarse?.addEventListener?.('change', refresh);
  win?.addEventListener?.('pagehide', pagehide);
  return entry.lease();
}
