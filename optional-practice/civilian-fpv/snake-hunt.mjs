import { exactKeys, required } from '../../game/data-json.mjs';
import { isqrt } from './math.mjs';

export const HUNT_CONTACT_CRITERION = 'hunt-contact-v1';
export const HUNT_FLIGHT_MODEL = 'civilian-world-hunt.v1';
export const HUNT_MOMENTUM_MODEL = 'civilian-world-hunt.v2';
export const HUNT_MOMENTUM_CONTACT = 'retain-momentum-v1';
export const HUNT_TAIL_LIMITS = Object.freeze({ links: 64, path: 256, sampleDistance: 250 });
const integer = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max;
const distance = (a, b) => isqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);

export function validateHuntContact(step, course) {
  exactKeys(
    step,
    ['type', 'targets', 'ordered', 'tail', 'contactPolicy'],
    'Hunt contact criterion',
  );
  required(
    step.contactPolicy === undefined ||
      (step.contactPolicy === HUNT_MOMENTUM_CONTACT && course.format === 'FlightCourse.v2'),
    'Unsupported Hunt contact policy; momentum catches require an ordinary FlightCourse.v2',
  );
  required(
    step.type === HUNT_CONTACT_CRITERION &&
      typeof step.ordered === 'boolean' &&
      Array.isArray(step.targets) &&
      step.targets.length >= 1 &&
      step.targets.length <= 12 &&
      new Set(step.targets).size === step.targets.length &&
      step.targets.every((id) =>
        course.actors.some(
          (actor) =>
            actor.id === id &&
            ['patrol', 'sentry'].includes(actor.type) &&
            actor.role === 'hostile' &&
            actor.fireEveryTicks === 0,
        ),
      ),
    'Contact Hunt needs distinct, unarmed fictional humanoid targets',
  );
  exactKeys(step.tail, ['linksPerCatch', 'maxLinks', 'neckDistance', 'radius'], 'Hunt echo tail');
  required(
    integer(step.tail.linksPerCatch, 0, 8) &&
      integer(step.tail.maxLinks, 0, HUNT_TAIL_LIMITS.links) &&
      integer(step.tail.neckDistance, 2500, 12000) &&
      integer(step.tail.radius, 150, 450) &&
      (step.tail.linksPerCatch === 0) === (step.tail.maxLinks === 0),
    'Invalid bounded Hunt echo tail',
  );
}

export const huntContact = (course, mode) =>
  course.steps[mode].find((step) => step.type === HUNT_CONTACT_CRITERION) ?? null;

export function createContactHuntState(position, radius) {
  return {
    caught: [],
    catches: [],
    path: [{ ...position, y: position.y + radius }],
    tail: [],
    failure: null,
  };
}

/** Called only for a physical swept contact from the accepted flight movement.
 * Wrong-order targets stay available; a pulse can never satisfy this criterion. */
export function catchHuntTarget(state, criterion, actor) {
  if (
    !actor ||
    actor.status !== 'active' ||
    !criterion.targets.includes(actor.id) ||
    (criterion.ordered && criterion.targets[state.hunt.caught.length] !== actor.id)
  )
    return false;
  actor.status = 'caught';
  state.hunt.caught.push(actor.id);
  state.hunt.catches.push({
    id: actor.id,
    ...(actor.pursuit ? { family: actor.pursuit.family } : {}),
    tick: state.ticks,
    position: { ...actor.position },
    velocity: { ...state.velocity },
  });
  state.events.push({ type: 'catch', actor: actor.id });
  return true;
}

/** Distance-spaced historical positions form a solid echo trail. Samples are
 * stationary world-space hazards, not teleported actors or steering assistance. */
export function updateHuntTail(hunt, criterion, position, radius) {
  const centre = { ...position, y: position.y + radius };
  if (distance(centre, hunt.path[0]) >= HUNT_TAIL_LIMITS.sampleDistance) {
    hunt.path.unshift(centre);
    if (hunt.path.length > HUNT_TAIL_LIMITS.path) hunt.path.length = HUNT_TAIL_LIMITS.path;
  }
  const length = Math.min(
    criterion.tail.maxLinks,
    hunt.caught.length * criterion.tail.linksPerCatch,
  );
  let travelled = 0;
  let previous = centre;
  hunt.tail = [];
  for (const point of hunt.path) {
    travelled += distance(previous, point);
    previous = point;
    if (travelled < criterion.tail.neckDistance) continue;
    if (hunt.tail.length >= length) break;
    hunt.tail.push({ ...point });
  }
}

export const huntTailId = (index) => `$hunt-tail-${index}`;
