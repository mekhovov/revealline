import {
  WORLD_CATALOGUE,
  BEGINNER_CATALOGUE,
} from '../../../optional-practice/civilian-fpv/world-catalogue.mjs';
import { REGIONAL_LIBRARY_PINS } from '../../../optional-practice/civilian-fpv/regional-library.mjs';
import { dataIdentity } from '../../../game/data-json.mjs';

/** Data inventory only: no physics, renderer, downloads, browser or user storage. */
export function catalogueDamageOwnership() {
  const sources = [...WORLD_CATALOGUE, ...BEGINNER_CATALOGUE].map((entry) => {
    const actors = (entry.course.actors ?? []).map((actor) => [
      actor.id,
      actor.type,
      actor.role ?? (actor.type === 'hazard' ? null : 'hostile'),
    ]);
    return {
      id: entry.id,
      source: entry.legacy ? 'legacy' : entry.beginner ? 'learning' : 'native',
      format: entry.course.format,
      sourceIdentity: dataIdentity(entry.course),
      actorCount: actors.length,
      actors,
    };
  });
  const byTypeRole = {};
  for (const source of sources)
    for (const [, type, role] of source.actors) {
      const key = `${type}:${role ?? 'no-role'}`;
      byTypeRole[key] = (byTypeRole[key] ?? 0) + 1;
    }
  return {
    format: 'FPVCatalogueDamageOwnershipAudit.v1',
    scope:
      'Shipped in-memory catalogue definitions and pinned regional delivery identities; no downloaded scene bytes or user storage inspected.',
    actorTuple: ['stableId', 'type', 'effectiveAuthoredRole'],
    summary: {
      entries: sources.length,
      native: sources.filter((row) => row.source === 'native').length,
      learning: sources.filter((row) => row.source === 'learning').length,
      legacy: sources.filter((row) => row.source === 'legacy').length,
      entriesWithActors: sources.filter((row) => row.actorCount).length,
      actorOccurrences: sources.reduce((sum, row) => sum + row.actorCount, 0),
      byTypeRole,
      regionalPins: REGIONAL_LIBRARY_PINS.length,
      regionalIds: new Set(REGIONAL_LIBRARY_PINS.map((row) => row.id)).size,
    },
    sources,
    regions: REGIONAL_LIBRARY_PINS.map((row) => ({
      id: row.id,
      descriptorSha256: row.pin.sha256,
      authoredActorCount: 0,
      owner:
        'Regional presentation course has no authored actors; combat actors come from the admitted encounter definition.',
    })),
    limits: [
      'Actor IDs are unique within a course, not globally across courses.',
      'Civilian/rival are authored behavior roles; new live native rules do not exempt them from damage.',
      'Hazards have no authored role field; null is intentional.',
      'Regional zero counts describe the presentation-course adapter, not visual analysis of every downloaded scenery mesh.',
      'Unannotated imported meshes cannot be recognized as characters by this source inventory.',
      'This inventory does not qualify real obstacle clearance or player hitability.',
    ],
  };
}
