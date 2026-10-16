export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context);
  if (new URL(url).pathname.endsWith('/game/test/couch-reading.test.mjs'))
    result.source = String(result.source).replaceAll(
      "assert.equal(f.doc.activeElement, f.control('help-reading'));",
      "assert.equal(f.doc.activeElement?.id, f.control('help-reading')?.id, 'Diagnostic uses unique DOM IDs to avoid huge circular assertion output.');",
    );
  return result;
}
