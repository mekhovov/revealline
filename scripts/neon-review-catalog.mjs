import { readFileSync } from 'node:fs';
import { classicLibrarySources } from '../game/mission-library/classic-source.mjs';
import { createMissionLibrary } from '../game/mission-library/library.mjs';
import { playedLevelHref } from '../game/mission-library/played-level-link.mjs';

/** Derive review links from the same exact owner identities as the player catalog. */
export function classicReviewCatalog() {
  const index = JSON.parse(
    readFileSync(new URL('../game/content/mission-library-index.json', import.meta.url), 'utf8'),
  );
  const library = createMissionLibrary(
    classicLibrarySources(index, {
      availability: () => ({ state: 'unavailable', reason: 'Review metadata only' }),
      launch: () => {
        throw new Error('Review metadata cannot launch a mission.');
      },
    }),
  );
  const rows = library.missions.filter((row) => row.lifecycle === 'current');
  const result = rows.map((row) => {
    const href = playedLevelHref(row, { baseURL: 'https://mekhovov.github.io/revealline/game/' });
    if (!href) throw new Error(`Missing public mission link: ${row.name}`);
    return { ...row, publicHref: href, href: `../../../game/${new URL(href).search}` };
  });
  library.dispose();
  return result;
}

export function neonReviewCatalog() {
  return classicReviewCatalog().filter((row) =>
    ['neon-reference-pack', 'neon-mosaic-pack'].includes(JSON.parse(row.ownerId)[2]),
  );
}

export function neonReviewMission(rows, packId, name) {
  const matches = rows.filter((row) => JSON.parse(row.ownerId)[2] === packId && row.name === name);
  if (matches.length !== 1) throw new Error(`Expected one exact Neon mission: ${packId}/${name}`);
  return matches[0];
}
