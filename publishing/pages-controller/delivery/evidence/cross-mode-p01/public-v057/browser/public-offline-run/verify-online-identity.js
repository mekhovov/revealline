(async () => {
  const expected = { version: 'v0.57.0', source: 'b7db0134d4ede3452dc90b5d3f7ffb1491a0579b', buildId: '8b7ab11efc3be749f519b50f4d4299dc2a203a61d4fd970bd3a62278bda7402b', files: 608 };
  const urls = [new URL('build-info.json', location.href), new URL('../offline-cache.json', location.href)];
  const records = [];
  for (const url of urls) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Identity response ${response.status}`);
    const raw = await response.text(), bytes = new TextEncoder().encode(raw), hash = await crypto.subtle.digest('SHA-256', bytes);
    records.push({ url: url.href, bytes: bytes.byteLength, sha256: Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join(''), value: JSON.parse(raw) });
  }
  const build = records[0].value, inventory = records[1].value;
  if (build.version !== expected.version || build.sourceRevision !== expected.source || inventory.buildId !== expected.buildId || inventory.files.length !== expected.files) throw new Error('Actual public frozen identity differs from the authorized identity.');
  return { observedAt: new Date().toISOString(), href: location.href, expected, actualBuild: build,
    channel: `release-${build.version}`, inventory: { version: inventory.version, buildId: inventory.buildId, files: inventory.files.length, bytes: inventory.files.reduce((sum, row) => sum + row.bytes, 0) },
    responsePins: records.map(({ url, bytes, sha256 }) => ({ url, bytes, sha256 })) };
})()
