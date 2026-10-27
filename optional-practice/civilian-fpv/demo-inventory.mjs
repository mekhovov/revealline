import { WORLD_CATALOGUE, BEGINNER_CATALOGUE } from './world-catalogue.mjs';
import { worldCourseRequiresAcro, validateWorldCourse } from './world-model.mjs';
import { dataIdentity } from '../../game/data-json.mjs';

/** The installed authored catalogue is the authority; no fixed counts or custom setups. */
export function simDemoInventory(catalogue = [...WORLD_CATALOGUE, ...BEGINNER_CATALOGUE]) {
  return catalogue
    .filter((entry) => !entry.freeFlight && !entry.regional && !entry.projectId && !entry.prototype)
    .flatMap((entry) =>
      ['self-level', 'acro']
        .filter(
          (mode) =>
            entry.course.steps[mode]?.length &&
            (entry.legacy || !worldCourseRequiresAcro(entry.course) || mode === 'acro'),
        )
        .map((mode) => {
          const sourceIdentity = dataIdentity(
            entry.legacy ? entry.course : validateWorldCourse(entry.course),
          );
          return {
            id: `${entry.id}:${mode}:${sourceIdentity}`,
            modeId: 'sim',
            levelId: entry.id,
            levelKey: `${entry.id}:${sourceIdentity}`,
            sourceIdentity,
            variantId: mode,
            entry,
          };
        }),
    );
}
