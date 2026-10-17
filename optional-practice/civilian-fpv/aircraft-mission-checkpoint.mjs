import { boundedJSON, dataIdentity, exactKeys, required } from '../../game/data-json.mjs';

// Wire-format limits only. Academy checkpoint validation must not import the
// optional World implementation or pull its assets into the Academy package.
const HUNT_TAIL_LIMITS = { links: 64, path: 256 };
const huntContact = (source, mode) =>
  source.steps[mode].find((step) => step.type === 'hunt-contact-v1') ?? null;

const axes = ['x', 'y', 'z'];
const rotationAxes = ['roll', 'pitch', 'yaw'];
const skillTypes = new Set(['rotation-v1', 'attitude-v1', 'path-v1', 'crossing-v1']);
const integer = (n, low = 0, high = Number.MAX_SAFE_INTEGER) =>
  Number.isSafeInteger(n) && n >= low && n <= high;
const text = (s) => typeof s === 'string' && s.length > 0 && s.length <= 128;
function record(value, keys, label, optional = []) {
  exactKeys(value, [...keys, ...optional], label);
  required(
    keys.every((key) => Object.hasOwn(value, key)),
    `Incomplete ${label}`,
  );
}
function vector(value, label, keys = axes, limit = 10000000) {
  record(value, keys, label);
  required(
    keys.every((axis) => integer(value[axis], -limit, limit)),
    `Invalid ${label}`,
  );
}
function quaternion(value) {
  required(
    Array.isArray(value) &&
      value.length === 4 &&
      value.every((v) => integer(v, -1000001, 1000001)) &&
      Math.abs(Math.sqrt(value.reduce((sum, v) => sum + v * v, 0)) - 1000000) < 4,
    'Invalid mission checkpoint attitude',
  );
}
function strings(value, allowed, label, maximum = allowed.length) {
  required(
    Array.isArray(value) &&
      value.length <= maximum &&
      new Set(value).size === value.length &&
      value.every((id) => allowed.includes(id)),
    `Invalid ${label}`,
  );
}
function progressRecord(value, state, steps, kind) {
  const entry = kind === 'skill' ? 'entry' : 'acquire';
  record(
    value,
    ['index', 'status', 'reason', ...(kind === 'actor tracking' ? ['travel'] : [])],
    `${kind} progress`,
    kind === 'skill'
      ? ['ticks', 'dwell', 'entry', 'startAxis', 'rotation', 'path']
      : ['distance', 'relativeSpeed'],
  );
  required(
    integer(value.index, 0, steps.length - 1) &&
      value.index <= state.step &&
      [entry, kind === 'skill' ? 'active' : 'tracking', 'complete'].includes(value.status) &&
      (value.reason === null || text(value.reason)),
    `Invalid ${kind} progress`,
  );
  if (kind === 'actor tracking') {
    required(integer(value.travel, 0, 1000000000), 'Invalid tracked travel');
    for (const key of ['distance', 'relativeSpeed'])
      if (Object.hasOwn(value, key))
        required(integer(value[key], 0, 10000000), 'Invalid tracking measurement');
    if (value.status !== entry) {
      required(
        steps[value.index].type === 'actor-track-v1' &&
          integer(value.distance, 0, 10000000) &&
          integer(value.relativeSpeed, 0, 10000000),
        'Invalid active actor tracking',
      );
    }
    return;
  }
  if (value.status === entry) {
    record(value, ['index', 'status', 'reason'], 'Skill entry');
    return;
  }
  const target = steps[value.index];
  required(skillTypes.has(target.type), 'Skill progress refers to a non-skill objective');
  for (const key of ['ticks', 'dwell'])
    required(integer(value[key], 0, target.maxTicks), 'Invalid skill clock');
  quaternion(value.entry);
  required(integer(value.startAxis, -10000000, 10000000), 'Invalid skill origin');
  record(value.rotation, ['angle', 'reverse', 'other', 'checkpoint'], 'Skill rotation');
  required(
    integer(value.rotation.angle, -1000000, 1000000) &&
      ['reverse', 'other', 'checkpoint'].every((key) => integer(value.rotation[key], 0, 1000000)),
    'Invalid skill rotation',
  );
  record(value.path, ['winding', 'reverse', 'checkpoint', 'sample'], 'Skill path');
  required(
    integer(value.path.winding, -1000000, 1000000) &&
      integer(value.path.reverse, 0, 1000000) &&
      integer(value.path.checkpoint, 0, 1000000),
    'Invalid skill path',
  );
  if (target.type === 'path-v1') {
    record(value.path.sample, ['a', 'b', 'bearing'], 'Skill path sample');
    required(
      integer(value.path.sample.a, -10000000, 10000000) &&
        integer(value.path.sample.b, -10000000, 10000000) &&
        integer(value.path.sample.bearing, -18000, 18000),
      'Invalid skill path sample',
    );
  } else required(value.path.sample === null, 'Unexpected skill path sample');
}
function pursuitActor(value, policy, source, ticks) {
  record(
    value,
    [
      'family',
      'node',
      'next',
      'goal',
      'previous',
      'phase',
      'phaseTicks',
      'decision',
      'cursor',
      'heading',
      'nextHeading',
      'delivered',
    ],
    'Pursuit actor',
    ['arrived', 'meetingUntil'],
  );
  const nodes = source.nodes.map((node) => node.id);
  required(
    value.family === policy.family ||
      (policy.family === 'rendezvous-pair' && value.family === 'runner'),
    'Invalid pursuit family',
  );
  required(
    nodes.includes(value.node) &&
      nodes.includes(value.goal) &&
      (value.next === null || nodes.includes(value.next)) &&
      (value.previous === null || nodes.includes(value.previous)),
    'Pursuit references an unknown route node',
  );
  required(
    [
      'idle',
      'warning',
      'burst',
      'recovering',
      'waiting',
      'committed',
      'turning',
      'notice',
      'flee',
    ].includes(value.phase) &&
      integer(value.phaseTicks, 0, 80) &&
      integer(value.decision, 0, 40) &&
      integer(value.cursor, 0, policy.goals.length - 1) &&
      integer(value.delivered, 0, ticks),
    'Invalid pursuit state',
  );
  vector(value.heading, 'pursuit heading', ['x', 'z'], 1001000);
  if (value.nextHeading !== null)
    vector(value.nextHeading, 'pending pursuit heading', ['x', 'z'], 1001000);
  required(
    value.phase !== 'turning' || (value.family === 'shield-bearer' && value.nextHeading !== null),
    'Missing pending pursuit turn',
  );
  if (Object.hasOwn(value, 'arrived'))
    required(
      value.family === 'rendezvous-pair' && value.arrived === true,
      'Invalid pursuit arrival',
    );
  if (Object.hasOwn(value, 'meetingUntil'))
    required(
      value.arrived === true && integer(value.meetingUntil, 0, ticks + 80),
      'Invalid pursuit meeting clock',
    );
}
function validateWorldState(state, source, mode, steps) {
  const descriptors = new Map(source.actors.map((actor) => [actor.id, actor]));
  const policies = new Map((source.pursuit?.actors ?? []).map((p) => [p.id, p]));
  required(
    Array.isArray(state.actors) &&
      state.actors.length === descriptors.size &&
      new Set(state.actors.map((a) => a?.id)).size === descriptors.size,
    'Invalid mission checkpoint actors',
  );
  const orderedIds = [...descriptors.keys()].sort();
  required(
    state.actors.every((actor, index) => actor.id === orderedIds[index]),
    'Mission actor order changed',
  );
  for (const actor of state.actors) {
    const original = descriptors.get(actor?.id);
    required(original, 'Unknown mission checkpoint actor');
    record(
      actor,
      [
        'id',
        'type',
        'position',
        'radius',
        'height',
        'health',
        'maxHealth',
        'status',
        'pathIndex',
        'cooldown',
        'blocked',
        ...(original.role ? ['role'] : []),
        ...(policies.has(actor.id) ? ['pursuit'] : []),
      ],
      'Mission actor',
    );
    for (const field of ['type', 'role', 'radius', 'height'])
      required(actor[field] === original[field], 'Mission actor geometry or role changed');
    required(
      actor.maxHealth === original.health &&
        integer(actor.health, 0, original.health) &&
        ['active', 'defeated', 'caught'].includes(actor.status) &&
        (actor.status === 'defeated') === (actor.health === 0) &&
        integer(actor.pathIndex, 0, Math.max(0, original.path.length - 1)) &&
        integer(actor.cooldown, 0, original.fireEveryTicks ?? 0) &&
        typeof actor.blocked === 'boolean',
      'Invalid mission actor state',
    );
    vector(actor.position, 'actor position');
    if (policies.has(actor.id))
      pursuitActor(actor.pursuit, policies.get(actor.id), source.pursuit, state.ticks);
  }
  required(
    integer(state.health, 0, source.rules.playerHealth) &&
      (state.status === 'failed') === (state.health === 0),
    'Invalid mission health',
  );
  required(
    integer(state.rng, 0, 0xffffffff) &&
      integer(state.nextProjectileId, 1, 1 + state.ticks * (source.actors.length + 1)) &&
      integer(state.cooldown, 0, source.rules.fireCooldown) &&
      integer(state.contactCooldown, 0, 20) &&
      integer(state.shots, 0, state.ticks) &&
      integer(state.hits, 0, state.shots),
    'Invalid mission world counters',
  );
  required(
    Array.isArray(state.projectiles) &&
      state.projectiles.length <= 64 &&
      new Set(state.projectiles.map((p) => p?.id)).size === state.projectiles.length,
    'Invalid mission projectiles',
  );
  for (const projectile of state.projectiles) {
    record(
      projectile,
      ['id', 'owner', 'position', 'velocity', 'damage', 'ttl'],
      'Mission projectile',
    );
    const owner = projectile.owner === 'player' ? source.rules : descriptors.get(projectile.owner);
    required(
      owner &&
        (projectile.owner === 'player' || (owner.role === 'hostile' && owner.fireEveryTicks > 0)),
      'Invalid projectile owner',
    );
    required(
      integer(projectile.id, 1, state.nextProjectileId - 1) &&
        projectile.damage === (projectile.owner === 'player' ? owner.playerDamage : owner.damage) &&
        integer(projectile.ttl, 1, source.rules.projectileTicks),
      'Invalid mission projectile',
    );
    vector(projectile.position, 'projectile position');
    vector(projectile.velocity, 'projectile velocity');
    const maxSpeed = owner.projectileSpeed;
    required(
      axes.every((axis) => Math.abs(projectile.velocity[axis]) <= maxSpeed + 1),
      'Invalid projectile speed',
    );
  }
  required(Array.isArray(state.events) && state.events.length <= 256, 'Invalid mission events');
  for (const event of state.events) {
    if (event?.type === 'objective') {
      record(event, ['type', 'index'], 'Mission objective event');
      required(integer(event.index, 0, steps.length - 1), 'Invalid objective event');
    } else {
      record(event, ['type', 'actor'], 'Mission event', ['damage', 'optional']);
      required(
        [
          'fire',
          'defeat',
          'impact',
          'catch',
          'hunt-tail',
          'protected-contact',
          'delivery',
        ].includes(event.type) && text(event.actor),
        'Invalid mission event',
      );
      if (event.type !== 'impact' && event.type !== 'hunt-tail')
        required(
          descriptors.has(event.actor) || (event.type === 'fire' && event.actor === 'player'),
          'Unknown event actor',
        );
      if (event.type === 'hunt-tail')
        required(
          /^\$hunt-tail-(?:[0-9]|[1-5][0-9]|6[0-3])$/.test(event.actor),
          'Invalid tail event',
        );
      if (Object.hasOwn(event, 'damage'))
        required(event.type === 'protected-contact' && event.damage === 25, 'Invalid event damage');
      if (Object.hasOwn(event, 'optional'))
        required(event.type === 'catch' && event.optional === true, 'Invalid optional event');
    }
  }
  const criterion = huntContact(source, mode);
  const couriers = [...policies.values()].filter((p) => p.family === 'courier').map((p) => p.id);
  if (source.pursuit) {
    record(state.pursuit, ['bonusCaught'], 'Mission pursuit');
    strings(state.pursuit.bonusCaught, couriers, 'bonus catches');
  }
  if (criterion) {
    const hunt = state.hunt;
    record(hunt, ['caught', 'catches', 'path', 'tail', 'failure'], 'Mission hunt');
    strings(hunt.caught, criterion.targets, 'hunt catches');
    if (criterion.ordered)
      required(
        hunt.caught.every((id, i) => id === criterion.targets[i]),
        'Hunt catches are out of order',
      );
    const caught = [...hunt.caught, ...(state.pursuit?.bonusCaught ?? [])];
    required(
      Array.isArray(hunt.catches) &&
        hunt.catches.length === caught.length &&
        new Set(hunt.catches.map((c) => c?.id)).size === caught.length,
      'Invalid hunt catch history',
    );
    for (const entry of hunt.catches) {
      record(entry, ['id', 'tick', 'position', 'velocity'], 'Hunt catch', ['family', 'optional']);
      required(
        caught.includes(entry.id) &&
          integer(entry.tick, 0, Math.max(0, state.ticks - 1)) &&
          (entry.optional === undefined ||
            (entry.optional === true && couriers.includes(entry.id))),
        'Invalid hunt catch',
      );
      if (policies.has(entry.id))
        required(
          entry.family === state.actors.find((a) => a.id === entry.id).pursuit.family,
          'Invalid caught pursuit family',
        );
      else required(entry.family === undefined, 'Unexpected caught pursuit family');
      vector(entry.position, 'hunt catch position');
      vector(entry.velocity, 'hunt catch velocity');
    }
    required(
      Array.isArray(hunt.path) &&
        hunt.path.length >= 1 &&
        hunt.path.length <= HUNT_TAIL_LIMITS.path &&
        Array.isArray(hunt.tail) &&
        hunt.tail.length <=
          Math.min(criterion.tail.maxLinks, hunt.caught.length * criterion.tail.linksPerCatch) &&
        (hunt.failure === null || hunt.failure === 'echo-tail'),
      'Invalid hunt trail',
    );
    for (const p of [...hunt.path, ...hunt.tail]) vector(p, 'hunt trail position');
    required(
      hunt.tail.every((p) => hunt.path.some((q) => axes.every((axis) => p[axis] === q[axis]))),
      'Hunt tail is outside the recorded trail',
    );
    for (const actor of state.actors)
      required(
        (actor.status === 'caught') === caught.includes(actor.id),
        'Hunt catch status differs',
      );
  } else
    required(
      state.actors.every((a) => a.status !== 'caught'),
      'Unexpected caught actor',
    );
  if (Object.hasOwn(state, 'skill')) progressRecord(state.skill, state, steps, 'skill');
  if (Object.hasOwn(state, 'actorTrack'))
    progressRecord(state.actorTrack, state, steps, 'actor tracking');
}
function feedback(value, state, steps) {
  if (value === null) return;
  const target = steps[value?.index];
  required(target, 'Invalid objective feedback');
  const gate = target.type === 'gate';
  const common = [
    'tick',
    'index',
    'type',
    'accepted',
    'eligible',
    'position',
    'beforePosition',
    'speed',
    'tilt',
    'conditions',
  ];
  record(
    value,
    [
      ...common,
      ...(gate
        ? []
        : [
            'within',
            'hold',
            'requiredHold',
            'headingError',
            'centred',
            'throttle',
            'grounded',
            'landingSpeed',
            'landingTilt',
          ]),
    ],
    'Objective feedback',
  );
  required(
    value.type === target.type &&
      integer(value.tick, 1, state.ticks) &&
      typeof value.accepted === 'boolean' &&
      typeof value.eligible === 'boolean' &&
      integer(value.speed, 0, 10000000) &&
      integer(value.tilt, 0, 18000),
    'Invalid objective feedback',
  );
  vector(value.position, 'feedback position');
  vector(value.beforePosition, 'feedback previous position');
  const conditionKeys = gate
    ? ['crossing']
    : [
        'position',
        'speed',
        'maxTilt',
        'minTilt',
        'heading',
        'centred',
        'grounded',
        'throttle',
        'landingSpeed',
        'landingTilt',
      ];
  record(value.conditions, conditionKeys, 'Objective conditions');
  required(
    conditionKeys.every((key) => typeof value.conditions[key] === 'boolean'),
    'Invalid objective conditions',
  );
  if (!gate)
    required(
      ['within', 'centred', 'grounded'].every((key) => typeof value[key] === 'boolean') &&
        integer(value.hold, 0, state.ticks) &&
        value.requiredHold === target.ticks &&
        integer(value.headingError, 0, 18000) &&
        integer(value.throttle, 0, 1000) &&
        integer(value.landingSpeed, 0, 10000000) &&
        integer(value.landingTilt, 0, 18000),
      'Invalid objective feedback',
    );
}

/** Practice progress is not a scored proof. Validate every resumed algorithm's
 * inputs before a detached mission may adopt them; checksums are not trust. */
export function validateAircraftMissionCheckpoint(
  value,
  { identity, source, mode, world = false },
) {
  const saved = boundedJSON(value, {
    maxBytes: 512 * 1024,
    maxNodes: 30000,
    maxArray: 2048,
    maxDepth: 24,
    maxString: 256,
  });
  record(saved, ['format', 'identity', 'state', 'feedback'], 'Aircraft mission checkpoint');
  required(
    saved.format === 'AircraftMissionCheckpoint.v1' && saved.identity === dataIdentity(identity),
    'Mission checkpoint belongs to another flight',
  );
  const state = saved.state,
    steps = source.steps[mode];
  const allSteps = Object.values(source.steps).flat();
  const hasSkills = world && allSteps.some((step) => skillTypes.has(step.type));
  const hasTracking = world && allSteps.some((step) => step.type === 'actor-track-v1');
  record(
    state,
    [
      'ticks',
      'status',
      'position',
      'velocity',
      'orientation',
      'angular',
      'step',
      'hold',
      'contacts',
      'landingSpeed',
      'landingTilt',
      'lastInput',
      'heightRange',
      ...(world
        ? [
            'health',
            'grounded',
            'support',
            'cooldown',
            'contactCooldown',
            'rng',
            'nextProjectileId',
            'projectiles',
            'actors',
            'events',
            'shots',
            'hits',
          ]
        : []),
      ...(world && huntContact(source, mode) ? ['hunt'] : []),
      ...(world && source.pursuit ? ['pursuit'] : []),
      ...(hasSkills ? ['skill'] : []),
      ...(hasTracking ? ['actorTrack'] : []),
    ],
    'Mission checkpoint state',
    world ? [] : ['grounded', 'support'],
  );
  required(
    integer(state.ticks, 0, Math.floor(Number.MAX_SAFE_INTEGER / 20000)) &&
      integer(state.step, 0, steps.length) &&
      ['active', 'paused', 'disarmed', ...(world ? ['failed'] : [])].includes(state.status),
    'Invalid mission checkpoint progress',
  );
  vector(state.position, 'mission position');
  vector(state.velocity, 'mission velocity');
  vector(state.angular, 'mission angular velocity', rotationAxes);
  quaternion(state.orientation);
  required(
    integer(state.hold, 0, state.ticks) &&
      integer(state.contacts, 0, state.ticks * 1024) &&
      integer(state.landingSpeed, 0, 10000000) &&
      integer(state.landingTilt, 0, 18000),
    'Invalid mission checkpoint counters',
  );
  record(state.heightRange, ['min', 'max'], 'Mission height range');
  required(
    integer(state.heightRange.min, -10000000, 10000000) &&
      integer(state.heightRange.max, state.heightRange.min, 10000000),
    'Invalid mission height range',
  );
  record(
    state.lastInput,
    [...rotationAxes, 'throttle', ...(world ? ['actions'] : [])],
    'Mission input',
  );
  required(
    rotationAxes.every((key) => integer(state.lastInput[key], -1000, 1000)) &&
      integer(state.lastInput.throttle, 0, 1000) &&
      (!world || integer(state.lastInput.actions, 0, 1)),
    'Invalid mission checkpoint input',
  );
  if (world || state.ticks > 0 || Object.hasOwn(state, 'grounded')) {
    required(
      typeof state.grounded === 'boolean' && (state.support === null) === !state.grounded,
      'Invalid mission support',
    );
    if (state.support !== null) {
      record(state.support, ['id', 'normal', 'y'], 'Mission support');
      required(
        text(state.support.id) && integer(state.support.y, -10000000, 10000000),
        'Invalid mission support',
      );
      vector(state.support.normal, 'support normal', axes, 1000001);
      const n = state.support.normal;
      required(
        Math.abs(Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z) - 1000000) < 4 &&
          n.y >= 0.49 * 1000000,
        'Invalid mission support normal',
      );
    }
  }
  if (world) {
    required(saved.feedback === null, 'Unexpected world feedback');
    validateWorldState(state, source, mode, steps);
  } else feedback(saved.feedback, state, steps);
  return saved;
}
