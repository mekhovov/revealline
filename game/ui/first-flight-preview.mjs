import { t } from '../i18n/index.mjs';
import { resolveCourseRequest } from '../first-flight.mjs';

/** A finite local destination, never an arbitrary preview URL or storage write. */
export function firstFlightPreviewURL({
  lessonId = 'close-line',
  turnPolicy = 'immediate',
  controllerSession = null,
} = {}) {
  if (typeof lessonId !== 'string' || typeof turnPolicy !== 'string')
    throw new TypeError(t("interface:chooseAFirstFlightLessonAndSteeringPolicy"));
  const query = new URLSearchParams({
    course: 'first-flight',
    lesson: lessonId,
    'turn-policy': turnPolicy,
  });
  resolveCourseRequest(query);
  if (controllerSession !== null) {
    if (typeof controllerSession !== 'string' || !/^[a-f0-9]{32}$/.test(controllerSession))
      throw new TypeError(t("interface:controllerCoursePreviewNeedsItsOwnSessionToken"));
    query.set('controller-preview', '1');
    query.set('controller-session', controllerSession);
  }
  return `../?${query}`;
}
