/** Serialized with an exact package identity by the optional builder. */
export function installOptionalLauncher(
  { packageId, root },
  { optionalInstallationKey, validateOptionalInstallationReference },
) {
  const $ = (id) => document.getElementById(id);
  const copy = {
    en: {
      title: 'Flight practice',
      check: 'Check available practice',
      open: 'Open prepared practice',
      prepare: 'Open practice to prepare offline',
      previous: 'Open previous practice',
      status: 'Optional practice uses separate installation storage.',
      ready:
        'Open the available version, then choose Prepare offline. Your existing version stays available.',
      error: 'This version is unavailable. Previously prepared practice remains available.',
    },
    uk: {
      title: 'Практика польоту',
      check: 'Перевірити доступну практику',
      open: 'Відкрити підготовлену практику',
      prepare: 'Відкрити практику для роботи офлайн',
      previous: 'Відкрити попередню практику',
      status: 'Додаткова практика має окреме сховище встановлення.',
      ready:
        'Відкрийте доступну версію та виберіть підготовку офлайн. Попередня версія залишається доступною.',
      error: 'Ця версія недоступна. Раніше підготовлена практика залишається доступною.',
    },
  };
  let locale = navigator.language?.startsWith('uk') ? 'uk' : 'en';
  function render() {
    document.documentElement.lang = locale;
    document.title = copy[locale].title;
    for (const name of ['title', 'check', 'open', 'prepare', 'previous', 'status'])
      $(name).textContent = copy[locale][name];
  }
  const validate = (value) =>
    validateOptionalInstallationReference(value, { packageId, root, baseURL: location.href });
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
        $(element).href = new URL(value.entry, value.scope).href;
        $(element).hidden = false;
      }
  } catch {
    /* Bad storage leaves all launch actions hidden. */
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
  $('check').onclick = async () => {
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
      $('prepare').href = new URL(value.entry, value.scope).href;
      $('prepare').hidden = false;
      $('status').textContent = copy[locale].ready;
    } catch {
      if (!hidden) $('status').textContent = copy[locale].error;
    } finally {
      clearTimeout(timer);
      busy = false;
      activeRequest = null;
      $('check').disabled = false;
    }
  };
  navigator.serviceWorker
    ?.register('./worker.js', { scope: './', updateViaCache: 'none' })
    .catch(() => {});
  render();
}
