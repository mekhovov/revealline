(async () => {
  const response = await fetch(new URL('build-info.json', location.href), { cache: 'no-store' });
  if (!response.ok) throw new Error('Actual released build-info is unavailable; do not guess save keys.');
  const build = await response.json();
  if (typeof build.version !== 'string' || !build.version) throw new Error('Actual build version is absent.');
  const channel = `release-${build.version}`;
  const storage = {};
  for (const domain of ['suspended', 'library', 'packs']) {
    const key = `revealline.${domain}.${channel}.v1`;
    const raw = localStorage.getItem(key);
    const bytes = raw === null ? null : new TextEncoder().encode(raw);
    const digest = bytes === null ? null : await crypto.subtle.digest('SHA-256', bytes);
    storage[domain] = {
      key, raw, bytes: bytes?.byteLength ?? null,
      sha256: digest === null ? null : Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join(''),
    };
  }
  const registrations = await navigator.serviceWorker.getRegistrations();
  const worker = value => value ? { scriptURL: value.scriptURL, state: value.state } : null;
  const text = id => document.getElementById(id)?.textContent?.trim() ?? null;
  const offline = document.getElementById('offline-status');
  return {
    observedAt: new Date().toISOString(), href: location.href, timeOrigin: performance.timeOrigin,
    navigationType: performance.getEntriesByType('navigation')[0]?.type ?? null,
    build, htmlBuildVersion: document.documentElement.dataset.buildVersion, channel,
    controller: worker(navigator.serviceWorker.controller),
    registrations: registrations.map(r => ({ scope: r.scope, active: worker(r.active), waiting: worker(r.waiting), installing: worker(r.installing) })),
    cacheNames: await caches.keys(), onlineHint: navigator.onLine,
    bootState: document.documentElement.dataset.bootState,
    pictureState: document.body.dataset.pictureState, flightState: document.body.dataset.flightState,
    offline: { state: offline?.dataset.state, stage: offline?.dataset.stage, text: offline?.textContent?.trim(), details: text('offline-details') },
    hud: Object.fromEntries(['coverage', 'lives', 'score', 'flight-state', 'objective-state', 'run-message'].map(id => [id, text(id)])),
    focusedId: document.activeElement?.id ?? null, storage,
  };
})()
