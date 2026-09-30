import { AUTHORED_JOURNEY_ROUTE_IDS } from '../content-design/mode-href.mjs';
import { loadAuthoredJourneyRoute } from '../content-design/route-loader.mjs';
import { editorMessageError } from './editor-copy.mjs';
import { onLocaleChange, t } from '../i18n/index.mjs';

// The route registry owns execution. Studio only exposes explicit review
// editions that arrived after its original hand-authored v25 selector.
export const STUDIO_SPATIAL_REVIEW_IDS = Object.freeze(
  AUTHORED_JOURNEY_ROUTE_IDS.filter((id) => {
    const version = /^whole-spatial-v([1-9]\d*)$/.exec(id);
    return version && Number(version[1]) >= 26;
  }),
);

export const isStudioSpatialReview = (id) => STUDIO_SPATIAL_REVIEW_IDS.includes(id);

/** No source construction or asset loading occurs while browsing the selector. */
export function mountStudioSpatialReviews({ document }) {
  const selector = document.getElementById('whole-variety-edition');
  const links = document.getElementById('spatial-review-links');
  for (const id of STUDIO_SPATIAL_REVIEW_IDS) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = id;
    selector.append(option);
  }
  const sync = () => {
    const id = selector.value;
    links.hidden = !isStudioSpatialReview(id);
    if (links.hidden) return;
    document.getElementById('spatial-review-id').textContent = id;
    document.getElementById('spatial-review-solo').href = `../?journey=${id}`;
    document.getElementById('spatial-review-versus').href = `../couch/?journey=${id}`;
    document
      .getElementById('spatial-review-solo')
      .setAttribute('aria-label', t('tools:studio.spatialReview.solo', { id }));
    document
      .getElementById('spatial-review-versus')
      .setAttribute('aria-label', t('tools:studio.spatialReview.versus', { id }));
  };
  selector.addEventListener('change', sync);
  const stopLocale = onLocaleChange(sync);
  sync();
  return () => {
    selector.removeEventListener('change', sync);
    stopLocale();
  };
}

/** Detached editable source; never rewrite a registered/frozen edition. */
export async function loadStudioSpatialReview(id, { loadRoute = loadAuthoredJourneyRoute } = {}) {
  if (!isStudioSpatialReview(id)) throw editorMessageError('errors:studio.source.unknownEdition');
  const route = await loadRoute(id, { fullSource: true });
  if (route?.id !== id || !route.source)
    throw editorMessageError('errors:studio.source.unknownEdition');
  return structuredClone(route.source);
}

/** A later edit, edition change or inspection owns the editable source. */
export async function inspectStudioSpatialReview({
  id,
  inspections,
  getEdition,
  inspect,
  load = loadStudioSpatialReview,
}) {
  const ticket = inspections.begin();
  const current = () => ticket() && getEdition() === id;
  let source;
  try {
    source = await load(id);
  } catch (error) {
    if (current()) throw error;
    return false;
  }
  if (!current()) return false;
  inspect(source);
  return true;
}
