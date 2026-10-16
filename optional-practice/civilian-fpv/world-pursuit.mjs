import { exactKeys, required, stableId } from '../../game/data-json.mjs';
import { isqrt, roundDiv } from './math.mjs';

export const PURSUIT_COURSE = 'FlightCourse.v3';
export const PURSUIT_MODEL = 'civilian-world-pursuit.v1';
export const PURSUIT_FORMAT = 'FlightPursuit.v1';
export const PURSUIT_MODEL_V2 = 'civilian-world-pursuit.v2';
export const PURSUIT_FORMAT_V2 = 'FlightPursuit.v2';
export const pursuitModel = (source) =>
  source.format === PURSUIT_FORMAT_V2 ? PURSUIT_MODEL_V2 : PURSUIT_MODEL;
export const WORLD_VEHICLE_MODELS = Object.freeze([
  'field-utility',
  'cargo-truck',
  'armored-carrier',
  'field-tank',
  'relay-truck',
]);
export const PURSUIT_FAMILIES = Object.freeze([
  'lookout',
  'patroller',
  'runner',
  'sprinter',
  'refuge-seeker',
  'switchback',
  'rendezvous-pair',
  'courier',
  'shield-bearer',
  'brace-trooper',
]);
export const PURSUIT_RULES = Object.freeze({
  nodes: 64,
  edges: 128,
  speed: 1500,
  burstSpeed: 3000,
  range: 6000,
  decisionTicks: 25,
  warningTicks: 40,
  burstTicks: 20,
  recoveryTicks: 80,
  protectedDamage: 25,
  contactCooldown: 20,
});
const axes = ['x', 'y', 'z'];
const integer = (n, low, high) => Number.isSafeInteger(n) && n >= low && n <= high;
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const distance = (a, b) => isqrt(axes.reduce((n, k) => n + (a[k] - b[k]) ** 2, 0));
const horizontal = (a, b) => isqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);
const edgeKey = (a, b) => [a, b].sort(compare).join(':');
const heading = (from, to) => {
  const x = to.x - from.x,
    z = to.z - from.z,
    size = Math.max(1, horizontal(from, to));
  return { x: roundDiv(x * 1000000, size), z: roundDiv(z * 1000000, size) };
};

/** Only accepted graph data controls native pursuit. No imported AI or input prediction. */
export function validateFlightPursuit(value, course) {
  exactKeys(value, ['format', 'nodes', 'edges', 'actors'], 'flight pursuit');
  required(
    [PURSUIT_FORMAT, PURSUIT_FORMAT_V2].includes(value.format),
    'Unsupported flight pursuit policy',
  );
  required(
    Array.isArray(value.nodes) && value.nodes.length >= 2 && value.nodes.length <= 64,
    'Pursuit needs 2–64 graph nodes',
  );
  const nodes = new Map();
  for (const node of value.nodes) {
    exactKeys(node, ['id', 'position'], 'pursuit node');
    exactKeys(node.position, axes, 'pursuit node position');
    required(
      stableId(node.id) &&
        !nodes.has(node.id) &&
        axes.every((k) => integer(node.position[k], course.bounds.min[k], course.bounds.max[k])),
      'Pursuit nodes need distinct IDs and integer coordinates inside the world',
    );
    nodes.set(node.id, node);
  }
  required(
    Array.isArray(value.edges) && value.edges.length >= 1 && value.edges.length <= 128,
    'Pursuit needs 1–128 graph edges',
  );
  const edges = new Set(),
    neighbors = new Map([...nodes.keys()].map((id) => [id, []]));
  for (const edge of value.edges) {
    exactKeys(edge, ['from', 'to'], 'pursuit edge');
    required(
      nodes.has(edge.from) &&
        nodes.has(edge.to) &&
        edge.from !== edge.to &&
        !edges.has(edgeKey(edge.from, edge.to)),
      'Pursuit edges must connect distinct known nodes once',
    );
    const a = nodes.get(edge.from).position,
      b = nodes.get(edge.to).position;
    required(
      horizontal(a, b) >= 600 &&
        distance(a, b) <= 20000 &&
        Math.abs(a.y - b.y) <= Math.floor(horizontal(a, b) * 0.57735) + 200,
      'Pursuit edges need 0.6–20 m clearance routes, slopes up to 30° and steps up to 0.2 m',
    );
    edges.add(edgeKey(edge.from, edge.to));
    neighbors.get(edge.from).push(edge.to);
    neighbors.get(edge.to).push(edge.from);
  }
  const reached = new Set([value.nodes[0].id]);
  for (const id of reached) for (const next of neighbors.get(id)) reached.add(next);
  required(
    reached.size === nodes.size,
    'Every pursuit node must belong to one connected route graph',
  );
  required(
    Array.isArray(value.actors) && value.actors.length >= 1 && value.actors.length <= 12,
    'Pursuit needs 1–12 finite actors',
  );
  const ids = new Set(),
    pairs = new Map();
  for (const policy of value.actors) {
    exactKeys(policy, ['id', 'family', 'start', 'goals', 'pair'], 'pursuit actor policy');
    const actor = course.actors.find((row) => row.id === policy.id);
    required(
      actor &&
        !ids.has(policy.id) &&
        ['patrol', 'sentry'].includes(actor.type) &&
        actor.role === 'hostile' &&
        actor.fireEveryTicks === 0 &&
        actor.path.length === 0 &&
        PURSUIT_FAMILIES.includes(policy.family),
      'Pursuit actors must be distinct unarmed humanoids without a competing waypoint route',
    );
    required(
      nodes.has(policy.start) && distance(actor.position, nodes.get(policy.start).position) <= 30,
      'A pursuit actor must start at its admitted graph node',
    );
    required(
      Array.isArray(policy.goals) &&
        policy.goals.length >= 1 &&
        policy.goals.length <= 64 &&
        policy.goals.every((id) => nodes.has(id)),
      'Pursuit goals must reference admitted graph nodes',
    );
    required(
      policy.family === 'rendezvous-pair' ? stableId(policy.pair) : policy.pair === null,
      'Only rendezvous actors have a pair identity',
    );
    if (policy.pair) pairs.set(policy.pair, [...(pairs.get(policy.pair) ?? []), policy]);
    const requiredModes = ['self-level', 'acro'].filter((mode) =>
      course.steps[mode].some(
        (step) => step.type === 'hunt-contact-v1' && step.targets.includes(policy.id),
      ),
    );
    required(
      policy.family === 'courier' ? requiredModes.length === 0 : requiredModes.length === 2,
      'Ordinary pursuit targets need a Contact Hunt objective in each flight mode; couriers must stay optional',
    );
    required(
      ['self-level', 'acro'].every((mode) =>
        course.steps[mode].every(
          (step) =>
            step.type === 'hunt-contact-v1' ||
            !(step.targets?.includes(policy.id) || step.actorId === policy.id),
        ),
      ),
      'Pursuit actors cannot also be required by a weapon or tracking objective',
    );
    ids.add(policy.id);
  }
  for (const pair of pairs.values())
    required(
      pair.length === 2 &&
        pair.every((actor) => actor.goals.length === 1) &&
        pair[0].goals[0] === pair[1].goals[0],
      'Rendezvous needs exactly two actors sharing one reachable meeting node',
    );
  if (value.format === PURSUIT_FORMAT_V2) pairArrivals(value, course.actors, graphFor(value));
  return value;
}

/** Validate full-height native clearance and ground support in both directions.
 * Runtime preparation calls this with real Rapier proxies, before flight starts. */
export function admitFlightPursuit(course, collision) {
  for (let i = 0; i < course.actors.length; i++)
    for (const other of course.actors.slice(i + 1)) {
      const actor = course.actors[i];
      required(
        horizontal(actor.position, other.position) >= actor.radius + other.radius ||
          actor.position.y + actor.height <= other.position.y ||
          other.position.y + other.height <= actor.position.y,
        'Pursuit actors must start without overlapping another actor',
      );
    }
  const checked = new Set(),
    byId = new Map(course.pursuit.nodes.map((n) => [n.id, n.position]));
  for (const policy of course.pursuit.actors) {
    const original = course.actors.find((a) => a.id === policy.id);
    const shape =
      `${original.type}:${original.radius}:${original.height}` +
      (original.groundMotion ? `:${original.groundMotion}` : '');
    if (checked.has(shape)) continue;
    checked.add(shape);
    const probe = { ...original, position: { ...original.position } };
    try {
      for (const position of byId.values()) {
        probe.position = { ...position };
        collision.placeActor(probe);
        required(
          collision.clearActorSpawn(probe),
          `Pursuit node lacks body clearance for ${policy.id}`,
        );
        const support = collision.moveGroundActor(probe, { x: 0, y: -10, z: 0 });
        required(
          !support.blocked && Math.abs(support.position.y - position.y) <= 220,
          'Pursuit node has no reachable supporting ground',
        );
      }
      for (const edge of course.pursuit.edges)
        for (const [from, to] of [
          [edge.from, edge.to],
          [edge.to, edge.from],
        ]) {
          const start = byId.get(from),
            finish = byId.get(to),
            steps = Math.ceil(distance(start, finish) / 100);
          probe.position = { ...start };
          for (let i = 1; i <= steps; i++) {
            const target = Object.fromEntries(
              axes.map((k) => [k, start[k] + roundDiv((finish[k] - start[k]) * i, steps)]),
            );
            const delta = Object.fromEntries(axes.map((k) => [k, target[k] - probe.position[k]]));
            const moved = collision.moveGroundActor(probe, delta);
            required(
              !moved.blocked &&
                horizontal(moved.position, target) <= 35 &&
                Math.abs(moved.position.y - target.y) <= 220,
              `Pursuit edge ${from} → ${to} lacks native clearance or support`,
            );
            probe.position = moved.position;
          }
        }
    } finally {
      collision.placeActor(original);
    }
  }
}

function graphFor(source) {
  const nodes = new Map(source.nodes.map((n) => [n.id, n.position]));
  const links = new Map([...nodes.keys()].map((id) => [id, []]));
  for (const { from, to } of source.edges) {
    links.get(from).push(to);
    links.get(to).push(from);
  }
  for (const list of links.values()) list.sort(compare);
  function distances(start, excluded = null) {
    const result = new Map([...nodes.keys()].map((id) => [id, id === start ? 0 : Infinity]));
    const remaining = new Set([...nodes.keys()].filter((id) => id !== excluded));
    while (remaining.size) {
      const id = [...remaining].sort((a, b) => result.get(a) - result.get(b) || compare(a, b))[0];
      remaining.delete(id);
      for (const next of links.get(id).filter((next) => next !== excluded))
        result.set(
          next,
          Math.min(result.get(next), result.get(id) + distance(nodes.get(id), nodes.get(next))),
        );
    }
    return result;
  }
  const route = (from, to, excluded = null) => {
    const costs = distances(to, excluded),
      path = [];
    if (from === excluded || !Number.isFinite(costs.get(from))) return null;
    while (from !== to) {
      from = links
        .get(from)
        .filter((id) => id !== excluded)
        .sort(
          (a, b) =>
            costs.get(a) +
              distance(nodes.get(from), nodes.get(a)) -
              costs.get(b) -
              distance(nodes.get(from), nodes.get(b)) || compare(a, b),
        )[0];
      path.push(from);
      if (path.length > nodes.size) return null;
    }
    return path;
  };
  return {
    nodes,
    links,
    distances,
    route,
    nearest: (position) =>
      [...nodes.keys()].sort(
        (a, b) =>
          distance(nodes.get(a), position) - distance(nodes.get(b), position) || compare(a, b),
      )[0],
  };
}

const pointSegmentDistance = (point, start, end) => {
  const dx = end.x - start.x,
    dz = end.z - start.z,
    length = dx * dx + dz * dz;
  const t = length
    ? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / length))
    : 0;
  return Math.hypot(point.x - start.x - t * dx, point.z - start.z - t * dz);
};
const segmentDistance = (a, b, c, d) => {
  const cross = (one, two, three) =>
    (two.x - one.x) * (three.z - one.z) - (two.z - one.z) * (three.x - one.x);
  if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return 0;
  return Math.min(
    pointSegmentDistance(a, c, d),
    pointSegmentDistance(b, c, d),
    pointSegmentDistance(c, a, b),
    pointSegmentDistance(d, a, b),
  );
};
const separateApproaches = (first, second, clearance) => {
  // A stationary participant still owns its body's footprint at the meeting.
  if (first.length === 1) first = [first[0], first[0]];
  if (second.length === 1) second = [second[0], second[0]];
  return first
    .slice(1)
    .every((end, index) =>
      second
        .slice(1)
        .every((other, i) => segmentDistance(first[index], end, second[i], other) >= clearance),
    );
};

/** V2 pairs reserve a meeting node and a separate point on an admitted approach
 * edge. Their complete XZ approach corridors must remain body-separated. Reject unworkable meetings during authoring, not during a flight. */
function pairArrivals(source, actors, graph) {
  const result = new Map(),
    pairs = new Map();
  for (const policy of source.actors)
    if (policy.family === 'rendezvous-pair')
      pairs.set(policy.pair, [...(pairs.get(policy.pair) ?? []), policy]);
  for (const pair of pairs.values()) {
    const meeting = pair[0].goals[0];
    pair.sort(
      (a, b) => Number(b.start === meeting) - Number(a.start === meeting) || compare(a.id, b.id),
    );
    const [first, second] = pair,
      firstPath = new Set([first.start, ...graph.route(first.start, meeting)]);
    const firstBody = actors.find((actor) => actor.id === first.id),
      secondBody = actors.find((actor) => actor.id === second.id),
      separation = firstBody.radius + secondBody.radius + 100,
      firstRoute = [...firstPath].map((id) => graph.nodes.get(id));
    const stoppingPoint = (node) => {
      const from = graph.nodes.get(node),
        target = graph.nodes.get(meeting),
        length = horizontal(from, target);
      return Object.fromEntries(
        axes.map((axis) => [
          axis,
          target[axis] + roundDiv((from[axis] - target[axis]) * separation, length),
        ]),
      );
    };
    const options = graph.links
      .get(meeting)
      .map((node) => ({
        node,
        path: graph.route(second.start, node, meeting),
      }))
      .filter(
        ({ node, path }) =>
          path &&
          !firstPath.has(second.start) &&
          !path.some((id) => firstPath.has(id)) &&
          !firstPath.has(node) &&
          horizontal(graph.nodes.get(node), graph.nodes.get(meeting)) > separation + 60 &&
          separateApproaches(
            firstRoute,
            [second.start, ...path].map((id) => graph.nodes.get(id)).concat(stoppingPoint(node)),
            separation - 40,
          ),
      );
    options.sort(
      (a, b) =>
        graph.distances(a.node, meeting).get(second.start) -
          graph.distances(b.node, meeting).get(second.start) || compare(a.node, b.node),
    );
    required(
      options.length,
      'Rendezvous needs two clear, separate graph approaches to its meeting',
    );
    const approach = options[0].node,
      target = graph.nodes.get(meeting),
      position = stoppingPoint(approach);
    result.set(first.id, { node: meeting, meeting, position: target, excluded: null });
    result.set(second.id, { node: approach, meeting, position, excluded: meeting });
  }
  return result;
}

export function createPursuitActorState(policy, source) {
  const graph = graphFor(source),
    next = graph.links.get(policy.start)[0];
  return {
    family: policy.family,
    node: policy.start,
    next: policy.family === 'brace-trooper' ? next : null,
    goal: policy.start,
    previous: null,
    phase: policy.family === 'brace-trooper' ? 'warning' : 'idle',
    phaseTicks: policy.family === 'brace-trooper' ? 40 : 0,
    decision: 0,
    cursor: 0,
    heading: heading(graph.nodes.get(policy.start), graph.nodes.get(next)),
    nextHeading: null,
    delivered: 0,
  };
}

/** Accepted pre-step facing/phase is the complete vulnerability contract. */
export function pursuitContactProtected(actor, playerPosition) {
  const p = actor.pursuit;
  if (p.family === 'brace-trooper') return ['warning', 'burst'].includes(p.phase);
  if (p.family !== 'shield-bearer') return false;
  return (
    (playerPosition.x - actor.position.x) * p.heading.x +
      (playerPosition.z - actor.position.z) * p.heading.z >
    0
  );
}

export function createPursuitController(source, actors = []) {
  const successor = source.format === PURSUIT_FORMAT_V2;
  const graph = graphFor(source),
    policies = new Map(source.actors.map((p) => [p.id, p])),
    arrivals = successor ? pairArrivals(source, actors, graph) : new Map();
  const allDistances = new Map([...graph.nodes.keys()].map((id) => [id, graph.distances(id)]));
  const toward = (node, goal) => {
    const d = allDistances.get(goal);
    return [...graph.links.get(node)].sort(
      (a, b) =>
        d.get(a) +
          distance(graph.nodes.get(node), graph.nodes.get(a)) -
          d.get(b) -
          distance(graph.nodes.get(node), graph.nodes.get(b)) || compare(a, b),
    )[0];
  };
  function plan(actor, state, collision) {
    const policy = policies.get(actor.id),
      p = actor.pursuit;
    const playerNode = graph.nearest(state.position),
      fromPlayer = allDistances.get(playerNode);
    const near =
      distance(actor.position, state.position) <= 6000 &&
      collision.visible(
        { ...actor.position, y: actor.position.y + actor.height / 2 },
        state.position,
      );
    const flee = () =>
      [...graph.nodes.keys()].sort(
        (a, b) => fromPlayer.get(b) - fromPlayer.get(a) || compare(a, b),
      )[0];
    if (
      p.family === 'rendezvous-pair' &&
      !state.actors.some(
        (other) =>
          other.id !== actor.id &&
          other.status === 'active' &&
          policies.get(other.id)?.pair === policy.pair,
      )
    ) {
      p.family = 'runner';
      p.phase = 'idle';
      p.phaseTicks = 0;
      p.decision = 0;
      if (successor) {
        if (p.arrived && arrivals.get(actor.id).excluded) p.next = arrivals.get(actor.id).meeting;
        delete p.arrived;
        delete p.meetingUntil;
      }
    }
    if (successor && p.family === 'rendezvous-pair') {
      const arrival = arrivals.get(actor.id);
      const partner = state.actors.find(
        (other) =>
          other.id !== actor.id &&
          other.status === 'active' &&
          policies.get(other.id)?.pair === policy.pair,
      );
      if (horizontal(actor.position, arrival.position) <= 30) p.arrived = true;
      if (p.arrived && partner.pursuit.arrived && p.meetingUntil === undefined) {
        p.meetingUntil = state.ticks + 80;
        partner.pursuit.meetingUntil = p.meetingUntil;
      }
      if (p.meetingUntil !== undefined) {
        p.phaseTicks = Math.max(0, p.meetingUntil - state.ticks);
        p.phase = p.phaseTicks ? 'recovering' : 'waiting';
        return 0;
      }
      if (p.arrived) {
        p.phase = 'waiting';
        return 0;
      }
      p.goal = arrival.meeting;
      if (!p.next) {
        if (p.node === arrival.node) p.next = arrival.meeting;
        else p.next = graph.route(p.node, arrival.node, arrival.excluded)[0];
        const target = p.next === arrival.meeting ? arrival.position : graph.nodes.get(p.next);
        p.heading = heading(actor.position, target);
      }
      p.phase = 'committed';
      return 1500;
    }
    if (p.phaseTicks > 0) p.phaseTicks--;
    if (p.decision > 0) p.decision--;
    if (['sprinter', 'brace-trooper'].includes(p.family)) {
      if (p.phase === 'warning' && p.phaseTicks === 0) {
        p.phase = 'burst';
        p.phaseTicks = 20;
        p.next ??= toward(p.node, flee());
        p.goal = p.next;
      } else if (p.phase === 'burst' && p.phaseTicks === 0) {
        p.phase = 'recovering';
        p.phaseTicks = 80;
      } else if (p.phase === 'recovering' && p.phaseTicks === 0) p.phase = 'idle';
      else if (p.phase === 'idle' && near) {
        p.phase = 'warning';
        p.phaseTicks = 40;
        p.next ??= toward(p.node, flee());
        p.goal = p.next;
        p.heading = heading(actor.position, graph.nodes.get(p.next));
      }
      return p.phase === 'burst' ? 3000 : 0;
    }
    if (p.family === 'shield-bearer' && p.phase === 'turning') {
      if (p.phaseTicks > 0) return 0;
      p.heading = p.nextHeading;
      p.nextHeading = null;
      p.phase = 'committed';
      p.decision = 40;
    }
    if (
      (p.family === 'switchback' || (successor && p.family === 'refuge-seeker')) &&
      p.phase === 'warning'
    ) {
      if (p.phaseTicks > 0) return 0;
      p.phase = 'committed';
      p.decision = 25;
    }
    if (p.phase === 'recovering' && p.phaseTicks > 0) return 0;
    if (p.family === 'lookout') {
      p.phase = near ? 'notice' : 'idle';
      return 0;
    }
    if (p.family === 'runner' && p.next && p.decision === 0) {
      p.goal = near ? flee() : p.goal;
      const costs = allDistances.get(p.goal);
      const cost = (id) => distance(actor.position, graph.nodes.get(id)) + costs.get(id);
      if (cost(p.node) < cost(p.next)) [p.node, p.next] = [p.next, p.node];
      p.heading = heading(actor.position, graph.nodes.get(p.next));
      p.phase = near ? 'flee' : 'committed';
      p.decision = 25;
    }
    if (!p.next && p.decision === 0) {
      if (p.family === 'runner')
        p.goal = near
          ? flee()
          : graph.links.get(p.node)[state.ticks % graph.links.get(p.node).length];
      else if (p.family === 'refuge-seeker') {
        const committed = successor && p.phase === 'committed' && p.goal !== p.node;
        const choices = successor ? policy.goals.filter((id) => id !== p.node) : policy.goals;
        if (!committed)
          p.goal = [...(choices.length ? choices : policy.goals)].sort(
            (a, b) => fromPlayer.get(b) - fromPlayer.get(a) || compare(a, b),
          )[0];
      } else if (p.family === 'rendezvous-pair') p.goal = policy.goals[0];
      else if (p.family === 'switchback') {
        const choices = graph.links.get(p.node).filter((id) => id !== p.previous);
        p.goal = (choices.length ? choices : graph.links.get(p.node)).at(-1);
      } else {
        if (p.node === policy.goals[p.cursor]) p.cursor = (p.cursor + 1) % policy.goals.length;
        p.goal = policy.goals[p.cursor];
      }
      p.decision = p.family === 'shield-bearer' ? 40 : 25;
      if (p.goal === p.node) {
        p.phase = 'recovering';
        p.phaseTicks = 80;
        return 0;
      }
      p.next = toward(p.node, p.goal);
      const nextHeading = heading(actor.position, graph.nodes.get(p.next));
      if (
        p.family === 'shield-bearer' &&
        (nextHeading.x !== p.heading.x || nextHeading.z !== p.heading.z)
      ) {
        p.nextHeading = nextHeading;
        p.phase = 'turning';
        p.phaseTicks = 40;
        return 0;
      }
      p.heading = nextHeading;
      if (
        p.family === 'switchback' ||
        (successor && p.family === 'refuge-seeker' && p.phase !== 'committed')
      ) {
        p.phase = 'warning';
        p.phaseTicks = 40;
        return 0;
      }
      p.phase = near && p.family === 'runner' ? 'flee' : 'committed';
    }
    return p.next ? 1500 : 0;
  }
  return {
    move(actor, state, collision) {
      const p = actor.pursuit,
        speed = plan(actor, state, collision);
      actor.blocked = false;
      if (!speed || !p.next) return;
      const arrival = successor && p.family === 'rendezvous-pair' ? arrivals.get(actor.id) : null;
      const target =
          arrival && p.next === arrival.meeting ? arrival.position : graph.nodes.get(p.next),
        delta = Object.fromEntries(axes.map((k) => [k, target[k] - actor.position[k]]));
      const length = Math.max(1, distance(target, actor.position)),
        travel = Math.min(length, speed / 50);
      for (const key of axes) delta[key] = roundDiv(delta[key] * travel, length);
      const moved = collision.moveGroundActor(actor, delta);
      const candidate = moved.position;
      const hits = (other, radius) =>
        horizontal(candidate, other) < actor.radius + radius &&
        candidate.y < other.y + radius * 2 &&
        candidate.y + actor.height > other.y;
      const occupied =
        hits(state.position, state.droneRadius) ||
        state.actors.some(
          (other) =>
            other.id !== actor.id &&
            other.status === 'active' &&
            hits(other.position, other.radius),
        ) ||
        (state.hunt?.tail ?? []).some((point) => hits(point, state.tailRadius));
      actor.blocked = moved.blocked || occupied || horizontal(candidate, actor.position) < 1;
      if (actor.blocked) {
        collision.placeActor(actor);
        return;
      }
      actor.position = candidate;
      if (horizontal(candidate, target) <= 30 && Math.abs(candidate.y - target.y) <= 220) {
        p.previous = p.node;
        if (!arrival?.excluded || p.next !== arrival.meeting) p.node = p.next;
        p.next = null;
        if (arrival && horizontal(target, arrival.position) <= 30) {
          p.arrived = true;
          p.phase = 'waiting';
          return;
        }
        if (p.node === p.goal) {
          if (p.family === 'courier') {
            p.delivered++;
            state.events.push({ type: 'delivery', actor: actor.id });
          }
          if (['refuge-seeker', 'rendezvous-pair'].includes(p.family)) {
            p.phase = 'recovering';
            p.phaseTicks = 80;
          }
        }
      }
    },
  };
}
