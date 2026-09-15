(async () => {
  const team = location.pathname.endsWith('/couch/relay-rescue.html');
  const response = await fetch(new URL(team ? '../build-info.json' : 'build-info.json', location.href), { cache: 'no-store' });
  if (!response.ok) throw Error('Cannot derive actual release storage channel');
  const build = await response.json(); if (typeof build.version !== 'string') throw Error('Actual build version missing');
  const channel = `release-${build.version}`;
  const keys = [...new Set([...Object.keys(localStorage).filter(key => key.startsWith('revealline.') && key.includes(`.${channel}.`)), ...['suspended','library','packs'].map(domain => `revealline.${domain}.${channel}.v1`)])].sort();
  if (keys.length > 100) throw Error('Unexpected storage key count');
  let total = 0; const values = [];
  for (const key of keys) {
    const raw = localStorage.getItem(key), bytes = raw === null ? null : new TextEncoder().encode(raw); total += bytes?.length ?? 0;
    if (total > 2 * 1024 * 1024) throw Error('Bounded evidence storage size exceeded');
    const digest = bytes === null ? null : await crypto.subtle.digest('SHA-256', bytes);
    values.push({key, raw, bytes: bytes?.length ?? null, sha256: digest === null ? null : [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2,'0')).join('')});
  }
  return {time:new Date().toISOString(),href:location.href,timeOrigin:performance.timeOrigin,build,channel,totalBytes:total,values,limitation:'Read-only release-channel localStorage endpoints; not an IndexedDB write audit or proof against write-and-revert.'};
})()
