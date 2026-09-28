// Classic-script compatible: launch recovery must also work without ES modules.
(() => {
  const host = globalThis;
  if (host.RevealLineI18n) return;
  const engine = host.i18next.createInstance();
  const storageKey = 'revealline.locale.v1';
  const locales = ['en', 'uk'];
  const listeners = new Set();
  const bindings = new WeakMap();
  const richBindings = new WeakMap();
  const elements = new Set();
  let explicit = null;
  const normalizeLocale = (value) => {
    if (typeof value !== 'string') return null;
    try {
      const language = Intl.getCanonicalLocales(value)[0]?.split('-')[0];
      return locales.includes(language) ? language : null;
    } catch {
      return null;
    }
  };
  function detectLocale(navigatorRef = host.navigator) {
    const preferred = Array.isArray(navigatorRef?.languages) ? navigatorRef.languages : [];
    for (const value of [...preferred, navigatorRef?.language]) {
      const locale = normalizeLocale(value);
      if (locale) return locale;
    }
    return 'en';
  }
  function savedLocale() {
    try {
      const value = host.localStorage?.getItem(storageKey);
      return locales.includes(value) ? value : null;
    } catch {
      return null;
    }
  }
  explicit = savedLocale();
  engine.use({
    type: 'formatter',
    init() {},
    format: (value, _format, locale) => typeof value === 'number' && Number.isFinite(value)
      ? new Intl.NumberFormat(locale, { maximumFractionDigits: 20 }).format(value) : value,
  });
  engine.init({
    lng: explicit || detectLocale(),
    fallbackLng: 'en',
    supportedLngs: locales,
    resources: host.RevealLineTranslations,
    defaultNS: 'interface',
    keySeparator: false,
    initAsync: false,
    returnNull: false,
    returnEmptyString: false,
    // All values are written to text nodes/attributes, never interpreted as HTML.
    interpolation: {
      escapeValue: false,
      alwaysFormat: true,
    },
  });
  const t = (key, values = {}) => engine.t(key, values);
  const getLocale = () => engine.resolvedLanguage || engine.language || 'en';
  const messageTag = Symbol('localized-message');
  const message = (key, values = {}) => ({
    [messageTag]: true, key, values,
    toString: () => t(key, values),
    [Symbol.toPrimitive]: () => t(key, values),
  });
  const render = (value) => {
    if (typeof value === 'function') return render(value());
    if (value?.[messageTag]) return t(value.key, value.values);
    return value == null ? '' : String(value);
  };
  function bind(element, field, value) {
    if (!element) return '';
    let fields = bindings.get(element);
    if (!fields) {
      fields = new Map();
      bindings.set(element, fields);
      elements.add(new WeakRef(element));
    }
    fields.set(field, value);
    return apply(element, field, value);
  }
  function apply(element, field, value) {
    const text = render(value);
    if (field === 'textContent') {
      if (element.textContent !== text) element.textContent = text;
    } else if (element.getAttribute(field) !== text) element.setAttribute(field, text);
    return text;
  }
  const localizedText = (element, value) => bind(element, 'textContent', value);
  const localizedAttribute = (element, name, value) => bind(element, name, value);
  function localizedOption(label, ...args) {
    const option = new host.Option('', ...args);
    localizedText(option, label);
    return option;
  }
  function translateDOM(root = host.document) {
    if (!root?.querySelectorAll) return;
    const nodes = [...(root.matches?.('[data-i18n]') ? [root] : []), ...root.querySelectorAll('[data-i18n]')];
    for (const node of nodes) {
      const key = node.getAttribute('data-i18n');
      const attribute = node.getAttribute('data-i18n-attribute');
      if (attribute) localizedAttribute(node, attribute, () => t(key));
      else localizedText(node, () => t(key));
    }
    for (const attribute of ['aria-label', 'title', 'placeholder', 'alt', 'content', 'data-menu-label']) {
      for (const node of root.querySelectorAll(`[data-i18n-${attribute}]`))
        localizedAttribute(node, attribute, () => t(node.getAttribute(`data-i18n-${attribute}`)));
    }
    for (const node of root.querySelectorAll('[data-i18n-rich]')) {
      if (richBindings.has(node)) continue;
      const key = node.getAttribute('data-i18n-rich');
      const slots = new Map([...node.children].map(child => [child.getAttribute('data-i18n-slot'), new WeakRef(child)]));
      const reference = new WeakRef(node);
      const update = () => {
        const node = reference.deref();
        if (!node) { unsubscribe(); return; }
        const parts = t(key).split(/(\[\[[a-zA-Z0-9]+\]\])/g);
        node.replaceChildren(...parts.map(part => slots.get(part.slice(2, -2))?.deref() || node.ownerDocument.createTextNode(part)));
      };
      const unsubscribe = onLocaleChange(update);
      richBindings.set(node, unsubscribe);
      update();
    }
  }
  function refresh() {
    const document = host.document;
    const focus = document?.activeElement;
    const selection = focus && typeof focus.selectionStart === 'number'
      ? [focus.selectionStart, focus.selectionEnd, focus.selectionDirection] : null;
    const scroll = [...(document?.querySelectorAll('*') || [])]
      .filter(node => node.scrollTop || node.scrollLeft)
      .map(node => [node, node.scrollTop, node.scrollLeft]);
    if (host.document) host.document.documentElement.lang = getLocale();
    for (const ref of elements) {
      const element = ref.deref();
      if (!element) { elements.delete(ref); continue; }
      for (const [field, value] of bindings.get(element) || []) apply(element, field, value);
    }
    for (const callback of listeners) callback(getLocale());
    for (const select of host.document?.querySelectorAll('[data-language-select]') || []) select.value = getLocale();
    if (focus?.isConnected && document.activeElement !== focus) focus.focus({ preventScroll: true });
    if (selection && focus?.setSelectionRange) focus.setSelectionRange(...selection);
    for (const [node, top, left] of scroll) { node.scrollTop = top; node.scrollLeft = left; }
  }
  function setLocale(locale, { persist = true } = {}) {
    if (!locales.includes(locale)) throw new RangeError('Unsupported locale.');
    let saved = false;
    if (persist) {
      explicit = locale;
      try {
        host.localStorage.setItem(storageKey, locale);
        saved = host.localStorage.getItem(storageKey) === locale;
      } catch { /* A session choice remains usable even when persistence is unavailable. */ }
    }
    engine.changeLanguage(locale);
    refresh();
    return { locale, saved };
  }
  function onLocaleChange(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
  }
  function attachLanguageControls(root = host.document) {
    if (!root?.querySelectorAll) return;
    for (const mount of root.querySelectorAll('[data-language-control]')) {
      if (mount.querySelector('[data-language-select]')) continue;
      const doc = mount.ownerDocument;
      const label = doc.createElement('label');
      const caption = doc.createElement('span');
      localizedText(caption, () => t('common:language.label'));
      const select = doc.createElement('select');
      select.setAttribute('data-language-select', '');
      for (const [value, name] of [['en', 'English'], ['uk', 'Українська']]) {
        const option = doc.createElement('option');
        option.value = value;
        option.textContent = name;
        option.lang = value;
        select.append(option);
      }
      select.value = getLocale();
      const status = doc.createElement('span');
      status.setAttribute('role', 'status');
      status.className = 'locale-storage-status';
      select.addEventListener('change', () => {
        const result = setLocale(select.value);
        localizedText(status, () => result.saved ? '' : t('common:language.sessionOnly'));
      });
      label.append(caption, select);
      mount.append(label, status);
    }
  }
  host.addEventListener?.('storage', (event) => {
    if (event.key !== storageKey && event.key !== null) return;
    explicit = savedLocale();
    setLocale(explicit || detectLocale(), { persist: false });
  });
  host.addEventListener?.('languagechange', () => {
    if (!explicit) setLocale(detectLocale(), { persist: false });
  });
  host.RevealLineI18n = Object.freeze({
    t, message, render, getLocale, setLocale, onLocaleChange, normalizeLocale, detectLocale,
    localizedText, localizedAttribute, localizedOption, translateDOM, attachLanguageControls,
    formatNumber: (value, options) => new Intl.NumberFormat(getLocale(), options).format(value),
    formatDate: (value, options) => new Intl.DateTimeFormat(getLocale(), options).format(value),
  });
  const mount = () => { translateDOM(); attachLanguageControls(); refresh(); };
  if (host.window === host && host.document?.readyState === 'loading') {
    host.document.documentElement.lang = getLocale();
    host.document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else if (host.window === host && host.document) mount();
})();
