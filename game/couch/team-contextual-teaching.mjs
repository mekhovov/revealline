const FORMAT = 'revealline.team-contextual-teaching.v1';
const DEFAULT_KEY = FORMAT;
const SKILLS = Object.freeze(['cut', 'support', 'rescue']);
const PRIORITY = Object.freeze(['rescue', 'support', 'cut']);
const SUPPORT_CAPABILITIES = new Set(['slow', 'intercept']);
const SUPPORT_ROLES = new Set(['hybrid', 'disruptor', 'interceptor']);

const finiteSkills = (value) =>
  new Set(Array.isArray(value) ? value.filter((skill) => SKILLS.includes(skill)) : []);
const blank = () => ({ acknowledged: new Set(), completed: new Set() });

function readStored(storage, key) {
  if (!storage) return blank();
  const value = storage.getItem(key);
  if (value === null) return blank();
  const parsed = JSON.parse(value);
  if (parsed?.format !== FORMAT) return blank();
  return {
    acknowledged: finiteSkills(parsed.acknowledged),
    completed: finiteSkills(parsed.completed),
  };
}

function teachingContext(value) {
  const ground = value?.ground === 'reclaimed' ? 'reclaimed' : 'safe';
  const capabilities = Array.isArray(value?.supportCapabilities)
    ? [...new Set(value.supportCapabilities.filter((item) => SUPPORT_CAPABILITIES.has(item)))]
    : [];
  const roles = Array.isArray(value?.supportRoles)
    ? value.supportRoles.slice(0, 2).map((role) => (SUPPORT_ROLES.has(role) ? role : 'hybrid'))
    : ['hybrid', 'hybrid'];
  while (roles.length < 2) roles.push('hybrid');
  return { ground, supportCapabilities: capabilities, supportRoles: roles };
}

function descriptor(kind, context) {
  if (kind === 'cut')
    return Object.freeze({
      kind,
      key: 'gameplay:team.teachingCut',
      values: Object.freeze({ context: context.ground === 'reclaimed' ? 'reclaimed' : undefined }),
    });
  if (kind === 'rescue')
    return Object.freeze({
      kind,
      key: 'gameplay:team.teachingRescue',
      values: Object.freeze({ context: context.ground === 'reclaimed' ? 'reclaimed' : undefined }),
    });
  const [first, second] = context.supportRoles;
  if (
    context.supportCapabilities.includes('slow') &&
    context.supportCapabilities.includes('intercept') &&
    first !== second &&
    [first, second].includes('interceptor') &&
    [first, second].includes('disruptor')
  )
    return Object.freeze({
      kind,
      key: 'gameplay:team.teachingSupportSpecialists',
      values: Object.freeze({
        interceptor: first === 'interceptor' ? 1 : 2,
        disruptor: first === 'disruptor' ? 1 : 2,
      }),
    });
  const slow = context.supportCapabilities.includes('slow');
  const intercept = context.supportCapabilities.includes('intercept');
  if (!slow && !intercept) return null;
  return Object.freeze({
    kind,
    key:
      slow && intercept
        ? 'gameplay:team.teachingSupportSlowAndIntercept'
        : intercept
          ? 'gameplay:team.teachingSupportIntercept'
          : 'gameplay:team.teachingSupportSlow',
    values: Object.freeze({}),
  });
}

/**
 * Presentation-only Team teaching. It consumes semantic arena capabilities and
 * authoritative events; it never inspects localized copy or mutates a run.
 */
export function createTeamContextualTeaching({
  getStorage = () => globalThis.localStorage,
  key = DEFAULT_KEY,
  onWarning = () => {},
} = {}) {
  if (typeof getStorage !== 'function' || typeof onWarning !== 'function')
    throw new TypeError('Team teaching needs storage and warning callbacks.');
  let storage = null;
  let state = blank();
  const pending = new Set();
  let context = teachingContext();
  try {
    storage = getStorage();
    state = readStored(storage, key);
  } catch (error) {
    onWarning(`Teaching progress stays on this page: ${error.message}`);
  }

  const save = () => {
    if (!storage) return;
    try {
      storage.setItem(
        key,
        JSON.stringify({
          format: FORMAT,
          acknowledged: SKILLS.filter((skill) => state.acknowledged.has(skill)),
          completed: SKILLS.filter((skill) => state.completed.has(skill)),
        }),
      );
    } catch (error) {
      storage = null;
      onWarning(`Teaching progress stays on this page: ${error.message}`);
    }
  };
  const resolved = (kind) => state.acknowledged.has(kind) || state.completed.has(kind);
  const offer = (kind) => {
    if (!resolved(kind)) pending.add(kind);
  };
  const complete = (kind) => {
    pending.delete(kind);
    if (state.completed.has(kind)) return false;
    state.completed.add(kind);
    return true;
  };
  const current = () => {
    const kind = PRIORITY.find(
      (candidate) =>
        pending.has(candidate) &&
        !resolved(candidate) &&
        (candidate !== 'support' || context.supportCapabilities.length > 0),
    );
    return kind ? descriptor(kind, context) : null;
  };

  return Object.freeze({
    opening(nextContext) {
      context = teachingContext(nextContext);
      offer('cut');
      return current();
    },
    observe(events, nextContext) {
      if (!Array.isArray(events))
        throw new TypeError('Team teaching needs the current event list.');
      context = teachingContext(nextContext);
      let changed = false;
      for (const event of events) {
        if (event?.type === 'cut.closed' || event?.type === 'cut.joint')
          changed = complete('cut') || changed;
        if (
          event?.type === 'support.pulse' &&
          ((event.slowedEnemies?.length ?? 0) > 0 || (event.interceptedImpacts?.length ?? 0) > 0)
        )
          changed = complete('support') || changed;
        if (event?.type === 'rescue.completed') changed = complete('rescue') || changed;
      }
      if (changed) save();
      if (events.some((event) => event?.type === 'player.downed')) offer('rescue');
      if (
        context.supportCapabilities.length &&
        events.some((event) => event?.type === 'cut.closed' || event?.type === 'cut.joint')
      )
        offer('support');
      return current();
    },
    acknowledge(kind = current()?.kind) {
      if (!SKILLS.includes(kind) || !pending.has(kind)) return current();
      pending.delete(kind);
      if (!state.acknowledged.has(kind)) {
        state.acknowledged.add(kind);
        save();
      }
      return current();
    },
    active() {
      return current();
    },
    snapshot() {
      return Object.freeze({
        active: current()?.kind ?? null,
        pending: Object.freeze(PRIORITY.filter((kind) => pending.has(kind))),
        acknowledged: Object.freeze(SKILLS.filter((kind) => state.acknowledged.has(kind))),
        completed: Object.freeze(SKILLS.filter((kind) => state.completed.has(kind))),
      });
    },
  });
}

export const TEAM_CONTEXTUAL_TEACHING_FORMAT = FORMAT;
