/** Serialized with an exact package identity by the optional builder. */
export function installOptionalLauncher(
  { packageId, root, description },
  {
    optionalInstallationKey,
    validateOptionalInstallationReference,
    inspectOptionalOffline,
    prepareOptionalOffline,
    removeOptionalOffline,
    mountPracticeNavigation,
  },
) {
  const $ = (id) => document.getElementById(id);
  const copy = {
    en: {
      title: 'Flight practice',
      check: 'Check available practice',
      open: 'Open prepared practice',
      prepare: 'Play available version',
      previous: 'Open previous practice',
      status: 'Optional practice uses separate installation storage.',
      ready:
        'Open the available version, then choose Prepare offline. Your existing version stays available.',
      error: 'This version is unavailable. Previously prepared practice remains available.',
      offline: 'Ready offline',
      repair:
        'Needs repair: a saved installation has missing files or no owning worker. Open online and download again.',
      available: 'Available online. Choose Download for offline use to prepare this version.',
      update:
        'Update available. Your prepared version remains available; no running flight will reload.',
      guide: 'Player guide',
      directory: 'Back to directory',
      game: 'Main game',
      install: 'Add to home screen',
      download: 'Download for offline use',
      remove: 'Remove this offline copy (keep records)',
      support: 'Support / report a problem',
      'storage-note':
        'Offline files and home-screen installation are separate. Apps own separate caches but share this site’s browser quota. Removing an offline app shell does not delete records or imported worlds. Export backups before clearing site data.',
      'install-note':
        'If no install button appears, use your browser’s Install app menu, or on iPhone/iPad use Share → Add to Home Screen. Online play needs neither installation nor offline download.',
    },
    uk: {
      title: 'Практика польоту',
      check: 'Перевірити доступну практику',
      open: 'Відкрити підготовлену практику',
      prepare: 'Грати в доступну версію',
      previous: 'Відкрити попередню практику',
      status: 'Додаткова практика має окреме сховище встановлення.',
      ready:
        'Відкрийте доступну версію та виберіть підготовку офлайн. Попередня версія залишається доступною.',
      error: 'Ця версія недоступна. Раніше підготовлена практика залишається доступною.',
      offline: 'Готово офлайн',
      repair:
        'Потрібне відновлення: у збереженій версії бракує файлів або власного воркера. Відкрийте онлайн і завантажте знову.',
      available:
        'Доступно онлайн. Виберіть «Завантажити для роботи офлайн» для підготовки цієї версії.',
      update:
        'Доступне оновлення. Підготовлена версія залишається доступною; поточний політ не перезавантажиться.',
      guide: 'Посібник гравця',
      directory: 'Назад до каталогу',
      game: 'Основна гра',
      install: 'На початковий екран',
      download: 'Завантажити для роботи офлайн',
      remove: 'Видалити цю офлайн-копію (зберегти записи)',
      support: 'Підтримка / повідомити про проблему',
      'storage-note':
        'Офлайн-файли й установлення на екран — різні дії. Застосунки мають окремі кеші, але спільну квоту цього сайту. Видалення офлайн-оболонки не стирає записи й імпортовані світи. Експортуйте резервні копії перед очищенням даних сайту.',
      'install-note':
        'Якщо кнопки встановлення немає, скористайтеся меню браузера, а на iPhone/iPad — «Поділитися → На початковий екран». Для гри онлайн установлення й офлайн-завантаження не потрібні.',
    },
  };
  const query = new URL(location.href).searchParams;
  let locale = ['en', 'uk'].includes(query.get('lang'))
    ? query.get('lang')
    : navigator.language?.startsWith('uk')
      ? 'uk'
      : 'en';
  let prepared = null,
    available = null,
    repairReference = null,
    launcherReady = false,
    stateKey = 'status';
  const entryURL = (value) => {
    const url = new URL(value.entry, value.scope);
    url.searchParams.set('lang', locale);
    return url.href;
  };
  function render() {
    document.documentElement.lang = locale;
    document.title = copy[locale].title;
    for (const name of [
      'title',
      'check',
      'open',
      'prepare',
      'previous',
      'guide',
      'directory',
      'game',
      'install',
      'download',
      'remove',
      'support',
      'storage-note',
      'install-note',
    ])
      if ($(name)) $(name).textContent = copy[locale][name];
    $('status').textContent = copy[locale][stateKey];
    if (description) {
      $('title').textContent = description.copy[locale].name;
      for (const name of ['description', 'purpose', 'inputs', 'requirements', 'firstFlight'])
        if ($(name)) $(name).textContent = description.copy[locale][name];
      if ($('changelog')) $('changelog').textContent = description.changelog[locale];
      if ($('support')) $('support').href = description.support;
    }
    if (prepared) $('open').href = entryURL(prepared);
    if (available) $('prepare').href = entryURL(available);
    if ($('download')) $('download').hidden = !available;
    if ($('remove')) $('remove').hidden = !prepared && stateKey !== 'repair';
    if ($('directory'))
      $('directory').href = new URL('../?lang=' + locale, new URL(root, location.href)).href;
    if ($('game'))
      $('game').href = new URL('../../game/?lang=' + locale, new URL(root, location.href)).href;
    const guideVersion = available ?? prepared;
    if ($('guide') && guideVersion) {
      $('guide').href = new URL(
        `optional-practice/${packageId}/guide.html?lang=` + locale,
        guideVersion.scope,
      ).href;
      $('guide').hidden = false;
    }
  }
  const validate = (value) =>
    validateOptionalInstallationReference(value, { packageId, root, baseURL: location.href });
  async function restore() {
    prepared = null;
    repairReference = null;
    $('open').hidden = true;
    $('previous').hidden = true;
    stateKey = available ? 'available' : 'status';
    try {
      const state = JSON.parse(
        localStorage.getItem(optionalInstallationKey(packageId, root)) ?? '{}',
      );
      for (const [key, element] of [
        ['active', 'open'],
        ['previous', 'previous'],
      ])
        if (state[key]) {
          const value = validate(state[key]);
          const ready = await inspectOptionalOffline?.(
            new URL('./', new URL(value.entry, value.scope)),
          );
          if (!ready) {
            stateKey = 'repair';
            repairReference ??= value;
            continue;
          }
          if (key === 'active') {
            prepared = value;
            stateKey = 'offline';
          }
          $(element).href = entryURL(value);
          $(element).hidden = false;
        }
    } catch {
      /* Bad storage leaves all launch actions hidden. */
    }
    if (prepared) {
      launcherReady = await inspectOptionalOffline?.(new URL('./', location.href));
      if (!launcherReady) stateKey = 'repair';
    }
    render();
  }
  $('locale').value = locale;
  $('locale').onchange = () => {
    locale = $('locale').value === 'uk' ? 'uk' : 'en';
    render();
  };
  let busy = false,
    activeRequest = null,
    hidden = false;
  globalThis.addEventListener?.('pagehide', () => {
    hidden = true;
    activeRequest?.abort();
  });
  globalThis.addEventListener?.('pageshow', () => {
    hidden = false;
  });
  const check = async (play = false) => {
    if (busy) return;
    busy = true;
    $('check').disabled = true;
    const controller = new AbortController();
    activeRequest = controller;
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('./current.json', {
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('Unavailable');
      const advertised = response.headers?.get('content-length');
      if (advertised && (!/^\d+$/.test(advertised) || Number(advertised) > 4096))
        throw new Error('Oversized');
      const reader = response.body?.getReader();
      if (!reader) throw new Error('A bounded response is required');
      const chunks = [];
      let size = 0;
      try {
        while (true) {
          if (controller.signal.aborted) throw new Error('Cancelled');
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 4096) throw new Error('Oversized');
          chunks.push(value);
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      if (hidden || controller.signal.aborted) return;
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      const value = validate(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
      available = value;
      $('prepare').href = entryURL(value);
      $('prepare').hidden = false;
      stateKey =
        prepared && !launcherReady
          ? 'repair'
          : prepared
            ? prepared.version !== value.version
              ? 'update'
              : 'offline'
            : 'available';
      render();
      if (play) location.assign(entryURL(value));
    } catch {
      if (!hidden) {
        stateKey = prepared ? (launcherReady ? 'offline' : 'repair') : 'error';
        render();
        if (play && prepared) location.assign(entryURL(prepared));
      }
    } finally {
      clearTimeout(timer);
      busy = false;
      activeRequest = null;
      $('check').disabled = false;
    }
  };
  $('check').onclick = async () => {
    await restore();
    return check(false);
  };
  if ($('download'))
    $('download').onclick = async () => {
      if (!available || busy) return;
      busy = true;
      $('download').disabled = true;
      try {
        await prepareOptionalOffline({ packageId, location: { href: entryURL(available) } });
        await prepareOptionalOffline({ packageId, location });
        await restore();
      } catch (error) {
        $('status').textContent =
          (locale === 'uk'
            ? 'Завантаження не завершено. Повторіть або відкрийте попередню версію. '
            : 'Download not completed. Retry or open the previous version. ') + error.message;
      } finally {
        busy = false;
        $('download').disabled = false;
      }
    };
  if ($('remove'))
    $('remove').onclick = async () => {
      const value = repairReference ?? prepared;
      if (!value || busy) return;
      busy = true;
      try {
        await removeOptionalOffline({ packageId, location: { href: entryURL(value) } });
        prepared = null;
        $('open').hidden = true;
        $('previous').hidden = true;
        stateKey = 'available';
        await restore();
      } catch {
        stateKey = 'repair';
        render();
      } finally {
        busy = false;
      }
    };
  let installPrompt;
  globalThis.addEventListener?.('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    if ($('install')) {
      $('install').hidden = false;
      $('install').onclick = async () => {
        await installPrompt.prompt();
        $('install').hidden = true;
      };
    }
  });
  navigator.serviceWorker
    ?.register('./worker.js', { scope: './', updateViaCache: 'none' })
    .catch(() => {});
  render();
  mountPracticeNavigation?.();
  // Unknown query parameters cannot select a route or arm a flight.
  return restore().then(() => {
    if (query.get('action') === 'play') {
      globalThis.history?.replaceState(null, '', '?lang=' + locale);
      return check(true);
    }
    return check(false);
  });
}
