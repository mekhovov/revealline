(async () => {
  const host = globalThis;
  const doc = host.document;
  if (!doc || host.RevealLineAccess) return;

  // This entry runs before the protected localization/application scripts. Keep
  // its small vocabulary self-contained and use the ordinary locale preference.
  const localeKey = 'revealline.locale.v1';
  const messages = {
    en: {
      title: 'Password required',
      description:
        'Enter the password once on this device. This browser will remember a successful unlock.',
      language: 'Language',
      password: 'Password',
      unlock: 'Unlock',
      checking: 'Checking…',
      incorrect: 'That password is not correct.',
      unavailable: 'Password protection is unavailable in this browser.',
      failed: 'The app could not be unlocked. Try again.',
      unlocked: 'Unlocked.',
      loadFailed: 'The page could not load. Reload to try again.',
    },
    uk: {
      title: 'Потрібен пароль',
      description:
        'Введіть пароль один раз на цьому пристрої. Браузер запам’ятає успішне розблокування.',
      language: 'Мова',
      password: 'Пароль',
      unlock: 'Розблокувати',
      checking: 'Перевіряємо…',
      incorrect: 'Неправильний пароль.',
      unavailable: 'Захист паролем недоступний у цьому браузері.',
      failed: 'Не вдалося розблокувати застосунок. Спробуйте ще раз.',
      unlocked: 'Розблоковано.',
      loadFailed: 'Не вдалося завантажити сторінку. Оновіть її, щоб спробувати ще раз.',
    },
  };
  const supportedLocale = (value) => {
    if (typeof value !== 'string') return null;
    try {
      const language = Intl.getCanonicalLocales(value)[0]?.split('-')[0];
      return language === 'en' || language === 'uk' ? language : null;
    } catch {
      return null;
    }
  };
  let savedLocale;
  try {
    savedLocale = host.localStorage?.getItem(localeKey);
  } catch {
    // Language selection remains available when preferences cannot be stored.
  }
  const languages = Array.isArray(host.navigator?.languages) ? host.navigator.languages : [];
  let locale =
    (['en', 'uk'].includes(savedLocale) && savedLocale) ||
    [...languages, host.navigator?.language].map(supportedLocale).find(Boolean) ||
    'en';
  const translate = (key) => messages[locale][key];
  let unlocked = false;

  const meta = (name) => doc.querySelector(`meta[name="${name}"]`)?.content || '';
  const config = Object.freeze({
    id: meta('revealline-access-id'),
    title: meta('revealline-access-title') || 'RevealLine',
    salt: meta('revealline-access-salt'),
    verifier: meta('revealline-access-verifier'),
    iterations: 150000,
  });
  const storageKey = `revealline.access.${config.id}.v1`;
  let resolveReady;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });
  let resolveScriptsReady;
  const scriptsReady = new Promise((resolve) => {
    resolveScriptsReady = resolve;
  });
  host.RevealLineAccess = Object.freeze({ ready, scriptsReady, storageKey });

  const storage = {
    read() {
      try {
        return host.localStorage?.getItem(storageKey) || '';
      } catch {
        return '';
      }
    },
    write(value) {
      try {
        host.localStorage?.setItem(storageKey, value);
      } catch {
        // Private browsing and hardened storage policies may make remembering unavailable.
      }
    },
  };
  // Protected HTML keeps executable scripts inert until the shared unlock succeeds.
  // Restore attributes (including currentScript data) and parser order; modules and
  // deferred classics run after the ordinary classics, once the document is ready.
  const startPage = async () => {
    const scripts = [...doc.querySelectorAll('script[data-access-type]')];
    const deferred = (node) => node.dataset.accessType === 'module' || node.hasAttribute('defer');
    const ordered = [...scripts.filter((node) => !deferred(node)), ...scripts.filter(deferred)];
    for (const original of ordered) {
      const script = doc.createElement('script');
      for (const { name, value } of original.attributes) {
        if (!['type', 'data-access-type'].includes(name)) script.setAttribute(name, value);
      }
      if (original.dataset.accessType) script.type = original.dataset.accessType;
      script.async = false;
      script.textContent = original.textContent;
      const loaded =
        script.src || script.type === 'module'
          ? new Promise((resolve, reject) => {
              script.onload = resolve;
              script.onerror = () =>
                reject(new Error('The page could not load. Reload to try again.'));
            })
          : Promise.resolve();
      original.replaceWith(script);
      await loaded;
    }
    resolveScriptsReady(true);
  };
  const unlock = () => {
    if (unlocked) return;
    unlocked = true;
    doc.documentElement.dataset.accessState = 'unlocked';
    resolveReady(true);
    doc.dispatchEvent(new CustomEvent('revealline-access-unlocked', { detail: { id: config.id } }));
    startPage().catch(() => {
      doc.documentElement.dataset.accessState = 'failed';
      const message = doc.createElement('p');
      message.id = 'access-gate';
      message.className = 'access-gate';
      message.setAttribute('role', 'alert');
      message.lang = locale;
      message.textContent = translate('loadFailed');
      doc.body.prepend(message);
    });
  };

  if (doc.readyState === 'loading')
    await new Promise((resolve) =>
      doc.addEventListener('DOMContentLoaded', resolve, { once: true }),
    );

  if (config.id && config.salt && config.verifier && storage.read() === config.verifier) {
    unlock();
    return;
  }

  const gate = doc.createElement('section');
  gate.id = 'access-gate';
  gate.className = 'access-gate';
  gate.setAttribute('role', 'dialog');
  gate.setAttribute('aria-modal', 'true');
  gate.setAttribute('aria-labelledby', 'access-gate-title');
  const form = doc.createElement('form');
  form.className = 'access-gate-card';
  const eyebrow = doc.createElement('p');
  eyebrow.className = 'access-gate-eyebrow';
  eyebrow.textContent = config.title;
  const title = doc.createElement('h1');
  title.id = 'access-gate-title';
  const copy = doc.createElement('p');
  const languageLabel = doc.createElement('label');
  const languageName = doc.createElement('span');
  const language = doc.createElement('select');
  language.id = 'access-gate-language';
  for (const [value, name] of [
    ['en', 'English'],
    ['uk', 'Українська'],
  ]) {
    const option = doc.createElement('option');
    option.value = value;
    option.textContent = name;
    language.append(option);
  }
  languageLabel.append(languageName, language);
  const label = doc.createElement('label');
  const passwordName = doc.createElement('span');
  const input = doc.createElement('input');
  input.type = 'password';
  input.name = 'password';
  input.required = true;
  input.autocomplete = 'current-password';
  input.autocapitalize = 'none';
  input.spellcheck = false;
  label.append(passwordName, input);
  const button = doc.createElement('button');
  button.type = 'submit';
  button.dataset.uiAction = 'primary';
  const status = doc.createElement('p');
  status.className = 'access-gate-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  let statusKey = '';
  const render = () => {
    gate.lang = locale;
    title.textContent = translate('title');
    copy.textContent = translate('description');
    languageName.textContent = translate('language');
    language.value = locale;
    passwordName.textContent = translate('password');
    button.textContent = translate('unlock');
    status.textContent = statusKey ? translate(statusKey) : '';
  };
  const setStatus = (key) => {
    statusKey = key;
    render();
  };
  language.addEventListener('change', () => {
    if (!['en', 'uk'].includes(language.value)) return;
    locale = language.value;
    try {
      host.localStorage?.setItem(localeKey, locale);
    } catch {
      // The current entry can still change language without persistent storage.
    }
    render();
  });
  render();
  form.append(eyebrow, title, copy, languageLabel, label, button, status);
  gate.append(form);
  doc.body.prepend(gate);
  gate.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return;
    const controls = [language, input, button];
    const current = controls.indexOf(doc.activeElement);
    event.preventDefault();
    controls[(current + (event.shiftKey ? -1 : 1) + controls.length) % controls.length].focus();
  });

  const decode = (value) => {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    return Uint8Array.from(host.atob(padded), (character) => character.charCodeAt(0));
  };
  const matches = (actual, expected) => {
    if (actual.length !== expected.length) return false;
    let difference = 0;
    for (let index = 0; index < actual.length; index++)
      difference |= actual[index] ^ expected[index];
    return difference === 0;
  };
  const derive = async (password) => {
    const key = await host.crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits'],
    );
    return new Uint8Array(
      await host.crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          hash: 'SHA-256',
          salt: decode(config.salt),
          iterations: config.iterations,
        },
        key,
        256,
      ),
    );
  };

  let checking = false;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (checking || unlocked) return;
    checking = true;
    // Retain the focused control while verification runs. The submission guard
    // owns activation; disabling both controls would drop keyboard focus.
    input.readOnly = true;
    button.setAttribute('aria-disabled', 'true');
    form.setAttribute('aria-busy', 'true');
    setStatus('checking');
    try {
      if (!config.id || !config.salt || !config.verifier || !host.crypto?.subtle) {
        setStatus('unavailable');
        return;
      }
      if (!matches(await derive(input.value), decode(config.verifier))) {
        input.value = '';
        setStatus('incorrect');
        return;
      }
      storage.write(config.verifier);
      input.value = '';
      setStatus('unlocked');
      unlock();
      gate.remove();
    } catch {
      setStatus('failed');
    } finally {
      checking = false;
      input.readOnly = false;
      button.setAttribute('aria-disabled', 'false');
      form.setAttribute('aria-busy', 'false');
      if (
        !unlocked &&
        doc.hasFocus?.() !== false &&
        (doc.activeElement === input || doc.activeElement === button)
      )
        input.focus();
    }
  });
  input.focus();
})();
