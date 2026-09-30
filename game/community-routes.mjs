import { editionIdentityId } from './edition-context.mjs';

/** Public navigation aliases never replace edition, save or presentation identities. */
export const COMMUNITY_ROUTES = Object.freeze(
  [
    ...['social-drone-ua', 'victory-drones', 'ukraine-culture', 'fpv-learning'].map((id) => ({
      slug: id,
      brandId: id,
      editionId: id,
      editionIds: [id],
    })),
    {
      slug: 'coupa',
      brandId: 'coupa',
      editionId: 'coupa-all',
      editionIds: [
        'coupa-all',
        'coupa-adventure',
        'coupa-culture',
        'coupa-foundations',
        'coupa-operations',
        'coupa-developers',
      ],
    },
    {
      slug: 'droneaid',
      brandId: 'droneaid-nl',
      editionId: 'droneaid-nl-community',
      editionIds: [
        'droneaid-nl-community',
        'droneaid-nl-workshop-lights',
        'droneaid-nl-parts-in-motion',
        'droneaid-nl-makers-together',
        'droneaid-nl-careful-handoff',
        'droneaid-nl-signals-of-support',
        'droneaid-nl-shared-horizon',
      ],
    },
    {
      slug: 'droneaid-community',
      brandId: 'droneaid',
      editionId: 'droneaid-community',
      editionIds: ['droneaid-community'],
    },
  ].map((route) => Object.freeze({ ...route, editionIds: Object.freeze(route.editionIds) })),
);

export function communityRouteFromURL(href) {
  const url = new URL(href);
  const match = /^(.*\/game\/)communities\/([^/]+)(?:\/(?:index\.html)?)?$/.exec(url.pathname);
  if (!match) return null;
  const route = COMMUNITY_ROUTES.find((item) => item.slug === match[2]);
  if (!route) throw new TypeError('Unknown public community address.');
  return Object.freeze({
    ...route,
    gamePath: match[1],
    pathname: `${match[1]}communities/${route.slug}/`,
  });
}

/** Resource base only. Callers must separately authenticate edition selection. */
export function gameDocumentURL(href) {
  const source = new URL(href);
  const route = communityRouteFromURL(source);
  const target = new URL(route ? `${route.gamePath}index.html` : 'index.html', source);
  target.search = source.search;
  target.hash = source.hash;
  return target;
}

/** A friendly path owns its company, including before the shared host is loaded. */
export function communityEntryURL(href) {
  const source = new URL(href);
  const route = communityRouteFromURL(source);
  if (!route) throw new TypeError('Expected a public community address.');
  const selectors = source.searchParams.getAll('edition');
  if (selectors.length > 1) throw new TypeError('A community address needs one edition selector.');
  const editionId = selectors.length ? editionIdentityId(selectors[0]) : route.editionId;
  if (!route.editionIds.includes(editionId))
    throw new TypeError('This community address cannot open another company edition.');
  const target = gameDocumentURL(source);
  target.searchParams.set('edition', editionId);
  return target;
}

/** The provider authenticates catalogue ownership before constructing navigation. */
export function communityHref(href, { brandId, editionId }) {
  const route = COMMUNITY_ROUTES.find((item) => item.brandId === brandId);
  if (!route) return null;
  if (!route.editionIds.includes(editionId))
    throw new TypeError('This community address does not contain the selected edition.');
  const target = new URL(`communities/${route.slug}/`, gameDocumentURL(href));
  if (editionId !== route.editionId) target.searchParams.set('edition', editionId);
  return target;
}
