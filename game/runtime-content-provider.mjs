import { loadEditionBootstrap } from './editions/bootstrap.mjs';
import { verifyEditionAssets } from './editions/assets.mjs';
import { resolveEditionContext } from './edition-context.mjs';
import { required } from './data-json.mjs';
import { projectEditionThemeSelection } from './editions/selected-presentation.mjs';
import {
  editionPresentationSha256,
  loadRetainedPresentation,
} from './editions/retained-presentation.mjs';

/** Content and presentation are inputs to the ordinary Solo host. An edition
 * never owns an update loop, difficulty implementation or input controller. */
export async function loadRuntimeContentProvider({
  locationRef = globalThis.location,
  documentRef = globalThis.document,
  fetcher = globalThis.fetch,
  verifyAssets = verifyEditionAssets,
} = {}) {
  const url = new URL(locationRef.href);
  const compiled = documentRef.documentElement.dataset.editionId;
  const requested = url.searchParams.get('edition') ?? compiled;
  if (!requested && url.searchParams.get('company') !== '1') return null;
  if (compiled)
    required(requested === compiled, 'This installed edition cannot load another audience.');
  const rootURL = new URL('../', url);
  const currentBootstrap = await loadEditionBootstrap({
    fetcher,
    catalogURL: new URL(compiled ? '../edition-catalog.json' : 'editions/catalog.json', url).href,
    contentBaseURL: rootURL.href,
    editionId: requested ?? undefined,
    campaignId: url.searchParams.get('campaign') ?? undefined,
    allowMissing: false,
  });
  const retainedPresentationId = url.searchParams.get('presentation');
  const history = currentBootstrap.selection.edition.presentationHistory ?? [];
  const retained = retainedPresentationId
    ? history.find((record) => record.id === retainedPresentationId)
    : null;
  required(
    !retainedPresentationId || retained,
    'This exact presentation is not registered for the selected edition. Your original save is preserved.',
  );
  const bootstrap = retained
    ? (
        await loadRetainedPresentation(retained, {
          edition: currentBootstrap.selection.edition,
          baseURL: rootURL,
          fetcher,
        })
      ).bootstrap
    : currentBootstrap;
  required(bootstrap.boot, 'This edition is missing its Solo startup catalogs.');
  await verifyAssets(bootstrap, { baseURL: rootURL, fetcher });
  const { route } = bootstrap;
  const projected = projectEditionThemeSelection({
    brand: bootstrap.selection.brand,
    projects: [bootstrap.source],
    themes: bootstrap.boot.themes,
  });
  const selection = { ...bootstrap.selection, brand: projected.brand };
  const catalog = {
    ...bootstrap.catalog,
    brands: bootstrap.catalog.brands.map((brand) =>
      brand.id === projected.brand.id ? projected.brand : brand,
    ),
  };
  const theme = projected.themes.themes.find((item) => item.id === selection.brand.themeId);
  required(theme, 'This edition is missing its selected presentation.');
  const authoredPresentationSha256 = await editionPresentationSha256(bootstrap);
  const assetURL = (id) => {
    const asset = catalog.assets.find((item) => item.id === id);
    required(asset, 'This edition does not contain the requested artwork.');
    return new URL(asset.path, rootURL).href;
  };
  return Object.freeze({
    kind: 'edition',
    editionId: selection.edition.id,
    authoredPresentationSha256,
    retainedPresentationId,
    presentationHistory: history,
    currentCatalog: currentBootstrap.catalog,
    selection,
    catalog,
    // Keep the preview host's incompatible envelope untouched. Canonical Solo
    // uses its own versioned save reader while logical Journey progress stays
    // on the existing edition profile key.
    route: Object.freeze({ ...route, sessionKey: `${route.sessionKey}.solo-v2` }),
    legacySessionKey: route.sessionKey,
    theme,
    bootstrap,
    rootURL: rootURL.href,
    themes: projected.themes.themes,
    lessons: Object.values(bootstrap.lessons).flat(),
    // The canonical host owns and augments its boot data; the immutable source
    // registry must remain untouched for session/presentation identities.
    boot: ['campaign', 'themes', 'presets', 'classes', 'packs', 'archives'].map((name) =>
      structuredClone(name === 'themes' ? projected.themes : bootstrap.boot[name]),
    ),
    missionIndex: Object.freeze({ format: 'revealline-mission-library-index.v1', missions: [] }),
    context(version) {
      return resolveEditionContext({
        editionId: selection.edition.id,
        version: version === 'dev' ? 'DEV' : version,
      });
    },
    assetURL,
    href(parameters = {}) {
      const target = new URL('index.html', url);
      target.search = '';
      target.searchParams.set('edition', selection.edition.id);
      if (
        retainedPresentationId &&
        (!parameters.edition || parameters.edition === selection.edition.id)
      )
        target.searchParams.set('presentation', retainedPresentationId);
      for (const [key, value] of Object.entries(parameters))
        if (value != null) target.searchParams.set(key, value);
        else target.searchParams.delete(key);
      return target.href;
    },
  });
}
