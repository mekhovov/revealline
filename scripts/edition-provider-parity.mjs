import { loadRuntimeContentProvider } from '../game/runtime-content-provider.mjs';

/** Exercise the real provider against the exact source/player byte inventories.
 * No ambient network or unselected source file is available to this check. */
export async function validateEditionProviderParity({ sourceFiles, catalog, compiled }) {
  if (
    !(sourceFiles instanceof Map) ||
    !(compiled?.files instanceof Map) ||
    compiled.runtimeCatalog?.editions?.length !== 1
  )
    throw new Error('Provider parity needs one selected edition and exact input bytes.');
  const editionId = compiled.runtimeCatalog.editions[0].id;
  const source = new Map(sourceFiles);
  source.set('game/editions/catalog.json', Buffer.from(JSON.stringify(catalog)));
  const load = async (files, selected) => {
    const prefix = selected ? '/compiled/' : '/source/';
    return loadRuntimeContentProvider({
      locationRef: { href: `https://edition.invalid${prefix}game/index.html?edition=${editionId}` },
      documentRef: { documentElement: { dataset: selected ? { editionId } : {} } },
      fetcher: async (request) => {
        const url = new URL(request);
        if (
          url.origin !== 'https://edition.invalid' ||
          !url.pathname.startsWith(prefix) ||
          url.search ||
          url.hash
        )
          throw new Error('Provider requested content outside the selected input root.');
        const name = url.pathname.slice(prefix.length),
          bytes = files.get(name);
        if (!bytes) throw new Error(`Provider requested an undeclared input: ${name}`);
        return new Response(bytes, { headers: { 'content-length': String(bytes.length) } });
      },
    });
  };
  const original = await load(source, false),
    player = await load(compiled.files, true);
  if (original.authoredPresentationSha256 !== player.authoredPresentationSha256)
    throw new Error('Source and compiled edition presentation receipts differ.');
  return { editionId, authoredPresentationSha256: player.authoredPresentationSha256 };
}
