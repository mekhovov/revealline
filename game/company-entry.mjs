/** Preserve old company URLs and installed-app entry identities while using
 * the exact same document and runtime as ordinary Solo. */
export function companyEntryHref(href, compiledEdition) {
  const source = new URL(href);
  const target = new URL('index.html', source);
  target.search = source.search;
  target.hash = source.hash;
  if (compiledEdition) target.searchParams.set('edition', compiledEdition);
  else if (!target.searchParams.has('edition')) target.searchParams.set('company', '1');
  return target.href;
}
if (globalThis.document && globalThis.location) {
  const href = companyEntryHref(location.href, document.documentElement.dataset.editionId);
  document.getElementById('company-entry-link').href = href;
  location.replace(href);
}
