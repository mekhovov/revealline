(async () => {
  const response = await fetch(new URL('../build-info.json', location.href), { cache: 'no-store' });
  if (!response.ok) throw new Error('Cannot derive actual Team release channel.');
  const build = await response.json(), channel = `release-${build.version}`;
  const storage = {};
  for (const domain of ['suspended', 'library', 'packs']) {
    const key = `revealline.${domain}.${channel}.v1`, raw = localStorage.getItem(key), bytes = raw === null ? null : new TextEncoder().encode(raw);
    const hash = bytes === null ? null : await crypto.subtle.digest('SHA-256', bytes);
    storage[domain] = { key, raw, bytes: bytes?.byteLength ?? null, sha256: hash === null ? null : Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('') };
  }
  const ids = ['coop-boot','coop-stage','coop-clock','coop-coverage','coop-reserves','coop-objective','coop-message','coop-state-0','coop-state-1','coop-charge-0','coop-charge-1','coop-support-0','coop-support-1','coop-overlay-title'];
  return { observedAt: new Date().toISOString(), href: location.href, timeOrigin: performance.timeOrigin, build, channel,
    toolState: document.documentElement.dataset.toolState, level: document.getElementById('coop-level')?.value,
    menuHidden: document.getElementById('coop-menu')?.hidden, playHidden: document.getElementById('coop-play')?.hidden, overlayHidden: document.getElementById('coop-overlay')?.hidden,
    controller: navigator.serviceWorker.controller?.scriptURL ?? null, focusedId: document.activeElement?.id,
    text: Object.fromEntries(ids.map(id => [id, document.getElementById(id)?.textContent?.trim() ?? null])), storage };
})()
