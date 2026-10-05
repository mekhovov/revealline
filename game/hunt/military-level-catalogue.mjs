import { createPursuitCampaignCandidates } from '../content-design/pursuit-campaign-candidates.mjs';
import { createHuntTrainingCandidates } from '../content-design/hunt-training-candidates.mjs';
import { createTeamHuntTrainingCandidates } from '../content-design/team-hunt-training-candidates.mjs';
import { createApexCulturalRoutesCandidates } from '../content-design/apex-cultural-routes-candidates.mjs';
import { createTeamCulturalSpecialistV2OriginalCandidates } from '../content-design/team-cultural-specialist-v2-originals.mjs';
import { journeyActors } from '../content-design/catalogs.mjs';
import { CLASSIC_SNAKE_LEVELS, CLASSIC_SNAKE_CHAPTERS } from '../snake/classic-catalogue.mjs';
import { militaryVehicleRole } from '../presentation/military-field-art.mjs';
import { nativeArtReviewURL } from '../ui/art-review-navigation.mjs';

const family = (kind) =>
  ({
    refuge: 'refuge-seeker',
    pair: 'rendezvous-pair',
    shield: 'shield-bearer',
    brace: 'brace-trooper',
  })[kind] ?? kind;
const unique = (items) => [...new Set(items)];
const recommended = new Set([
  'crossing-post',
  'pincer-yard',
  'relay-rendezvous',
  'hunt-first-contact',
  'classic-living-cable-cutoff',
  'classic-living-shield-window',
  'native-pursuit-runner-court',
  'native-pursuit-burst-lanes',
  'native-pursuit-refuge-return',
  'native-pursuit-switchback-crossing',
  'native-pursuit-meeting-yard',
  'native-pursuit-armor-windows',
]);

function captureRows(source, journey, modes, prototype = false) {
  const roles = journeyActors(source.actorCatalogId).roles;
  return source.missions.map((mission) => {
    const humanoids = mission.actors.filter((actor) =>
      ['optional-scout', 'optional-sentry'].includes(actor.role),
    );
    const families = unique([
      ...(mission.pursuit?.actors ?? []).map((actor) => family(actor.behavior)),
      ...humanoids.map((actor) => (actor.role === 'optional-sentry' ? 'guard' : 'runner')),
    ]);
    const vehicles = unique(
      mission.actors.flatMap((actor) => {
        if (humanoids.includes(actor)) return [];
        // Native Team compilation maps ordinary authored actors to drifters;
        // reclaimed rovers retain their own art, not a cargo-truck alias.
        const slot =
          modes[0] === 'team'
            ? actor.role === 'reclaimed-roamer'
              ? null
              : 'team.enemy.drifter'
            : `enemy.${roles[actor.role]?.type}`;
        return slot ? (militaryVehicleRole(slot) ?? []) : [];
      }),
    );
    return {
      key: `capture:${modes[0]}:${mission.id}`,
      engine: 'capture',
      id: mission.id,
      title: { en: mission.name, uk: mission.name },
      chapter:
        source.campaigns.find((chapter) => chapter.missionIds.includes(mission.id))?.name ?? '',
      modes,
      families,
      vehicles,
      prototype,
      recommended: recommended.has(mission.id),
      journey: ['crossing-post', 'pincer-yard', 'relay-rendezvous'].includes(mission.id)
        ? 'pursuit-pilots-v1'
        : journey,
      exact: false,
    };
  });
}

let coreRows;
/** Current source catalogues are authoritative. This directory does not install,
 * promote, prepare a run, grant progression or change a preference. */
export function militaryCoreLevels() {
  if (coreRows) return coreRows;
  coreRows = [
    ...captureRows(
      createPursuitCampaignCandidates(),
      'pursuit-campaigns-v1',
      ['solo', 'versus'],
      true,
    ),
    ...captureRows(
      createPursuitCampaignCandidates({ team: true }),
      'pursuit-campaigns-v1',
      ['team'],
      true,
    ),
    ...captureRows(createHuntTrainingCandidates({ artwork: false }), 'humanoid-hunt-v1', [
      'solo',
      'versus',
    ]),
    ...captureRows(createTeamHuntTrainingCandidates(), 'humanoid-hunt-v1', ['team']),
    ...captureRows(createApexCulturalRoutesCandidates(), 'whole-spatial-v25', ['solo', 'versus']),
    ...captureRows(
      createTeamCulturalSpecialistV2OriginalCandidates(),
      'team-cultural-specialist-originals-2',
      ['team'],
    ),
    ...CLASSIC_SNAKE_LEVELS.map((entry) => ({
      key: `snake:${entry.id}`,
      engine: 'snake',
      id: entry.id,
      title: entry.title,
      chapter:
        CLASSIC_SNAKE_CHAPTERS.find((chapter) => chapter.id === entry.chapterId)?.title.en ?? '',
      modes: ['solo', 'versus', 'team'],
      families: unique(
        (
          entry.level.targets?.required ?? [
            { kind: entry.level.targetMovement === 'flee' ? 'runner' : 'lookout' },
          ]
        ).map((target) => family(target.kind)),
      ),
      vehicles: [],
      prototype: entry.level.version === 'classic-snake-level.v3',
      recommended: recommended.has(entry.id),
      exact: true,
    })),
  ].map((row) =>
    Object.freeze({
      ...row,
      modes: Object.freeze(row.modes),
      families: Object.freeze(row.families),
      vehicles: Object.freeze(row.vehicles),
    }),
  );
  return Object.freeze(coreRows);
}

export function militaryFlightLevels(catalogue) {
  const seen = new Set();
  return catalogue
    .filter((entry) => {
      if (entry.activity !== 'hunt' || seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    })
    .map(({ id, course }) => {
      const targets = new Set([
        ...(course.steps['self-level'] ?? [])
          .filter((step) => step.type === 'hunt-contact-v1')
          .flatMap((step) => step.targets),
        ...(course.pursuit?.actors ?? [])
          .filter((actor) => actor.family === 'courier')
          .map((actor) => actor.id),
      ]);
      return {
        key: `sim:${id}`,
        engine: 'sim',
        id,
        title: { en: course.locales.en.title, uk: course.locales.uk.title },
        chapter: 'FPV SIM',
        modes: ['sim'],
        exact: true,
        prototype: true,
        recommended: recommended.has(id),
        families: unique(
          course.actors
            .filter((actor) => targets.has(actor.id) && actor.type !== 'vehicle')
            .map(
              (actor) =>
                course.pursuit?.actors.find((policy) => policy.id === actor.id)?.family ??
                (actor.speed > 0 ? 'patroller' : 'lookout'),
            ),
        ),
        vehicles: unique(
          course.actors
            .filter((actor) => actor.type === 'vehicle')
            .map(
              (actor) =>
                ({
                  'field-utility': 'utility-car',
                  'field-tank': 'tracked-tank',
                  'relay-truck': 'radar-truck',
                })[actor.vehicleModel] ??
                actor.vehicleModel ??
                'utility-car',
            ),
        ),
      };
    });
}

/** Optional course data is loaded independently: its absence never hides core
 * Capture/Snake entries or turns into a broken import of the directory itself. */
export async function loadMilitaryFlightLevels() {
  const [native, snake] = await Promise.all([
    import('../../optional-practice/civilian-fpv/native-pursuit-courses.mjs'),
    import('../../optional-practice/civilian-fpv/snake-hunt-catalogue.mjs'),
  ]);
  return militaryFlightLevels([
    ...native.NATIVE_PURSUIT_V2_CATALOGUE,
    ...native.NATIVE_PURSUIT_CATALOGUE,
    ...snake.SNAKE_HUNT_CATALOGUE,
  ]);
}

export function filterMilitaryLevels(
  rows,
  { query = '', mode = 'all', vehicles = 'all', featured = false, locale = 'en' } = {},
) {
  const search = String(query)
    .trim()
    .toLocaleLowerCase(locale === 'uk' ? 'uk' : 'en');
  return rows.filter(
    (row) =>
      (!featured || row.recommended) &&
      (mode === 'all' || row.modes.includes(mode)) &&
      (vehicles === 'all' || Boolean(row.vehicles.length) === (vehicles === 'yes')) &&
      (!search ||
        [row.title.en, row.title.uk, row.id, row.chapter].some((value) =>
          value.toLocaleLowerCase(locale === 'uk' ? 'uk' : 'en').includes(search),
        )),
  );
}

/** Routes are fixed local game entries. Capture exposes collection navigation;
 * never invent an unsupported per-mission query parameter. */
export function militaryLevelURL(row, mode, href, locale = 'en') {
  if (!row.modes.includes(mode)) throw new TypeError('Choose an available level mode.');
  const path =
    row.engine === 'snake'
      ? '../snake/play.html'
      : row.engine === 'sim'
        ? '../../optional-practice/fpv-worlds/index.html'
        : mode === 'team'
          ? '../couch/relay-rescue.html'
          : mode === 'versus'
            ? '../couch/'
            : '../';
  const url = new URL(path, href);
  url.searchParams.set('lang', locale === 'uk' ? 'uk' : 'en');
  if (row.engine === 'snake') {
    url.searchParams.set('mode', mode);
    url.searchParams.set('level', row.id);
    url.searchParams.set('targets', 'authored');
  } else if (row.engine === 'sim') url.searchParams.set('snake-course', row.id);
  else url.searchParams.set('journey', row.journey);
  return nativeArtReviewURL(url.href, href);
}
