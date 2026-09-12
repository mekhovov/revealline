// Boot as .js so a missing .mjs MIME mapping can be reported on this page.
const output = document.querySelector('#result');
let moduleHeaders;
try {
  const response = await fetch(new URL('../game/core/index.mjs', location.href), {
    cache: 'no-store',
  });
  const contentType = response.headers.get('content-type');
  moduleHeaders = {
    url: response.url,
    status: response.status,
    contentType,
    passed: response.ok && /^(text|application)\/javascript(?:\s*;|$)/i.test(contentType ?? ''),
  };
} catch (error) {
  moduleHeaders = { passed: false, error: error.message };
}
output.textContent = JSON.stringify({ moduleHeaders }, null, 2);
let probe;
try {
  probe = await import('./probe.mjs');
} catch (error) {
  output.textContent = JSON.stringify({ moduleHeaders, moduleImportError: error.message }, null, 2);
  document.querySelectorAll('button').forEach((button) => {
    button.disabled = true;
  });
  throw error;
}
const { capabilities, probeRuntime, FILE_FIXTURE } = probe;
const fixture = JSON.stringify(FILE_FIXTURE, null, 2) + '\n';
output.textContent = JSON.stringify({ ...capabilities(), moduleHeaders }, null, 2);
document.querySelector('#fixture').value = fixture;
document.querySelector('#run').addEventListener('click', async (event) => {
  event.currentTarget.disabled = true;
  try {
    output.textContent = JSON.stringify({ ...(await probeRuntime()), moduleHeaders }, null, 2);
  } finally {
    document.querySelector('#run').disabled = false;
  }
});
document.querySelector('#download').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([fixture], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'revealline-ios-file-check.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  document.querySelector('#file-result').textContent =
    'Download requested. Verify a real file in Files before selecting it; no success is assumed.';
});
document.querySelector('#upload').addEventListener('change', async (event) => {
  const file = event.currentTarget.files?.[0];
  if (!file) return;
  try {
    if (file.size > 16384) throw new Error('Use the tiny fixture file, up to 16 KiB.');
    const value = JSON.parse(await file.text());
    if (value?.format !== FILE_FIXTURE.format || value?.message !== FILE_FIXTURE.message)
      throw new Error('Selected JSON is not the expected fixture.');
    document.querySelector('#file-result').textContent =
      'The selected fixture was read correctly. Record whether its preceding download actually reached Files.';
  } catch (error) {
    document.querySelector('#file-result').textContent = error.message;
  }
});
