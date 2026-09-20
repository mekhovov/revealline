// Native Back must work while the large mode module is still preparing or fails.
// These finite routes match authored-mode-routes.mjs; bootstrap tests cover both.
(() => {
  const doc = document,
    mode = doc.currentScript?.dataset.mode;
  const params = new URL(doc.baseURI).searchParams;
  const values = params.getAll(mode === 'team' ? 'journey-return' : 'journey');
  if (
    !['versus', 'team'].includes(mode) ||
    values.length !== 1 ||
    !['opening', 'authored'].includes(values[0])
  )
    return;
  const route = values[0];
  const set = (id, href) => doc.getElementById(id)?.setAttribute('href', href);
  if (mode === 'versus') {
    set('boot-return', `../?journey=${route}`);
    return;
  }
  const origins = params.getAll('return');
  if (
    origins.length !== 1 ||
    !['solo', 'versus'].includes(origins[0]) ||
    [
      'journey',
      'practice',
      'return-token',
      'return-token-v2',
      'mode-return',
      'mode-return-v2',
    ].some((key) => params.has(key))
  )
    return;
  const solo = `../?journey=${route}`,
    versus = `./?journey=${route}`;
  set('coop-home', solo);
  set('coop-solo', solo);
  set('coop-versus', versus);
  set('coop-race', origins[0] === 'solo' ? solo : versus);
  const back = doc.getElementById('coop-race');
  if (back) back.textContent = origins[0] === 'solo' ? 'Back to Solo' : 'Race mode ↗';
})();
