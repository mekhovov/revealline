// Presentation-only motion: no terrain, enemies, collisions, capture, score or game state.
import {moveOnGrid, routeForPolicy} from "./grid-motion.mjs";
export const DIRECTIONS = Object.freeze({up: {x: 0, y: -1, heading: 0}, right: {x: 1, y: 0, heading: Math.PI / 2}, down: {x: 0, y: 1, heading: Math.PI}, left: {x: -1, y: 0, heading: -Math.PI / 2}});
export const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
export const angleDelta = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const approach = (value, target, amount) => value < target ? Math.min(target, value + amount) : Math.max(target, value - amount);

export function createMotionState(route, config = {}) {
  const start = routeForPolicy(route,config.turnPolicy)[0];
  return {x: start.x, y: start.y, heading: 0, bank: 0, speed: 0, visualSpeed: 0, direction: "up", routeIndex: 1, rotorPhase: 0, elapsed: 0, turning: false, mode: "idle", queuedDirection:null,travelDistance:0};
}

export function routeDirection(state, route) {
  let index = state.routeIndex;
  let target = route[index];
  if (Math.hypot(target.x - state.x, target.y - state.y) < 0.001) {
    index = (index + 1) % route.length;
    target = route[index];
  }
  const dx = target.x - state.x;
  const dy = target.y - state.y;
  const direction = Math.abs(dx) > 0.001 ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
  return {direction, index, distance: Math.abs(dx) > 0.001 ? Math.abs(dx) : Math.abs(dy), target};
}

export function stepMotion(previous, input, config, board, route, delta) {
  if (input.paused) return config.turnPolicy === "grid-center" ? {...previous,speed:0,queuedDirection:null} : {...previous};
  const dt = clamp(delta, 0, config.maxStepSeconds);
  let state = {...previous};
  const gridPolicy = config.turnPolicy === "grid-center";
  if (gridPolicy && input.autoplay) route = routeForPolicy(route,config.turnPolicy);
  let requested = input.direction;
  let waypoint = null;
  if (input.autoplay) {
    waypoint = routeDirection(state, route);
    requested = waypoint.direction;
    state.routeIndex = waypoint.index;
  }
  if (requested && (!gridPolicy || input.autoplay)) state.direction = requested;
  let targetSpeed = requested ? config.cruiseSpeed : 0;
  if (input.boost) targetSpeed *= config.boostMultiplier;
  if (input.slow) targetSpeed *= config.slowMultiplier;
  // Movement policy owns cardinal travel. Facing and rotor easing never feed back into it.
  state.speed = targetSpeed;
  let distance = state.speed * dt;
  if (waypoint) {
    state.queuedDirection = null;
    // Keep the leftover distance when crossing a corner; skins and frame rate cannot delay a route turn.
    while (distance > 1e-9) {
      waypoint = routeDirection(state, route);
      state.routeIndex = waypoint.index;
      state.direction = waypoint.direction;
      const direction = DIRECTIONS[state.direction];
      const travel = Math.min(distance, waypoint.distance);
      state.x += direction.x * travel;
      state.y += direction.y * travel;
      state.travelDistance=(state.travelDistance||0)+travel;
      distance -= travel;
    }
  } else if (gridPolicy) {
    state = moveOnGrid(state,requested,distance,board);
  } else {
    state.queuedDirection = null;
    const direction = DIRECTIONS[state.direction];
    state.x = clamp(state.x + direction.x * distance, 0.8, board.columns - 0.8);
    state.y = clamp(state.y + direction.y * distance, 0.8, board.rows - 0.8);
    state.travelDistance=(state.travelDistance||0)+Math.abs(state.x-previous.x)+Math.abs(state.y-previous.y);
  }
  state.visualSpeed = approach(state.visualSpeed, state.speed, (state.speed > state.visualSpeed ? config.visualResponseRise : config.visualResponseFall) * dt);
  const difference = angleDelta(state.heading, DIRECTIONS[state.direction].heading);
  state.turning = Boolean(requested) && Math.abs(difference) > 0.07;
  const turnAmount = config.turnRateDegrees * Math.PI / 180 * dt;
  state.heading += input.reducedMotion ? difference : clamp(difference, -turnAmount, turnAmount);
  const desiredBank = requested ? clamp(difference / (Math.PI / 2), -1, 1) * 0.18 * Math.min(state.speed / config.cruiseSpeed, 1.3) : 0;
  state.bank = input.reducedMotion ? 0 : approach(state.bank || 0, desiredBank, dt * 1.5);
  if (!input.reducedMotion) state.rotorPhase = (state.rotorPhase + dt * (config.rotorIdleRps + config.rotorTravelRps * state.visualSpeed / config.cruiseSpeed) * Math.PI * 2) % (Math.PI * 2);
  state.elapsed += dt;
  state.mode = input.slow ? "slow" : input.boost ? "boost" : state.turning ? "turning" : state.speed > 0.05 ? "cruise" : "idle";
  return state;
}

export function advanceMotion(previous, input, config, board, route, elapsed) {
  if (input.paused) return config.turnPolicy === "grid-center" ? {...previous,speed:0,queuedDirection:null} : {...previous};
  // Consume normal slow frames in bounded substeps. Only a true >250 ms stall loses elapsed time.
  let remaining = Number.isFinite(elapsed) ? clamp(elapsed, 0, 0.25) : 0;
  let state = {...previous};
  if (config.turnPolicy === "grid-center" && !input.autoplay && !input.direction) {state.speed=0;state.queuedDirection=null;}
  while (remaining > 1e-9) {
    const dt = Math.min(remaining, config.maxStepSeconds);
    state = stepMotion(state, input, config, board, route, dt);
    remaining -= dt;
  }
  return state;
}

export function validatePresets(presets) {
  const fail = message => {throw new Error(`Preset error: ${message}`);};
  if (presets.version !== "1.0.0") fail("unsupported version");
  if (presets.board?.columns !== 48 || presets.board?.rows !== 36) fail("this study uses a fixed 48 × 36 board");
  if (presets.motion?.turnPolicy !== undefined && !["immediate","grid-center"].includes(presets.motion.turnPolicy)) fail("turnPolicy must be immediate or grid-center");
  for (const key of ["cruiseSpeed", "visualResponseRise", "visualResponseFall", "boostMultiplier", "slowMultiplier", "turnRateDegrees", "maxStepSeconds", "rotorIdleRps", "rotorTravelRps"]) {
    if (!Number.isFinite(presets.motion?.[key]) || presets.motion[key] <= 0) fail(`motion.${key} must be positive`);
  }
  if (presets.motion.maxStepSeconds < 1 / 240 || presets.motion.maxStepSeconds > 0.1) fail("maxStepSeconds must be between 1/240 and 0.1");
  if (presets.motion.cruiseSpeed > 50 || presets.motion.boostMultiplier > 4 || presets.motion.slowMultiplier > 1) fail("motion speed exceeds this study's supported range");
  if (!Array.isArray(presets.route) || presets.route.length < 2) fail("route needs at least two waypoints");
  presets.route.forEach((point, index) => {
    if (![point.x, point.y].every(Number.isFinite) || point.x < 0.8 || point.x > 47.2 || point.y < 0.8 || point.y > 35.2) fail("route waypoint is outside the arena");
    const next = presets.route[(index + 1) % presets.route.length];
    if ((point.x !== next.x && point.y !== next.y) || Math.hypot(point.x - next.x, point.y - next.y) < 0.5) fail("route segments must be orthogonal and at least half a cell, including the closing segment");
  });
  const centeredRoute = routeForPolicy(presets.route,"grid-center");
  centeredRoute.forEach((point,index) => {const next=centeredRoute[(index+1)%centeredRoute.length]; if (point.x===next.x && point.y===next.y) fail("route segments must reach distinct grid centers in grid-center mode");});
  for (const area of presets.terrain) {
    if (!["wall", "slow", "danger"].includes(area.role)) fail("unknown terrain visual role");
    if (![area.x, area.y, area.width, area.height].every(Number.isInteger) || area.width < 1 || area.height < 1 || area.x < 0 || area.y < 0 || area.x + area.width > 48 || area.y + area.height > 36) fail("terrain footprint is invalid");
  }
  for (const theme of Object.values(presets.themes)) {
    for (const key of ["arena", "grid", "accent", "body", "wall", "slow", "danger", "dim"]) {
      if (!/^#[0-9a-f]{6}$/i.test(theme.colors[key])) fail(`invalid palette color ${key}`);
    }
  }
  for (const style of Object.values(presets.terrainStyles)) {
    if (!Number.isFinite(style.propPitch) || style.propPitch < 0.5 || style.propPitch > 48) fail("terrain propPitch must be finite and between 0.5 and 48 cells");
    if (![style.microOpacity, style.propOpacity].every(value => Number.isFinite(value) && value >= 0 && value <= 1)) fail("terrain opacities must be between 0 and 1");
  }
  for (const layer of Object.values(presets.terrainLayers)) {
    for (const role of ["wall", "slow", "danger"]) if (!layer.roles?.[role] || typeof layer.roles[role].kind !== "string") fail(`missing terrain role ${role}`);
  }
  for (const character of Object.values(presets.characters)) {
    if (![character.widthCells, character.heightCells].every(value => Number.isFinite(value) && value > 0 && value <= 8)) fail("character dimensions must be within 8 cells");
    if (!Number.isFinite(character.headingOffsetDegrees)) fail("character heading offset must be numeric");
    if (!["nearest", "linear"].includes(character.sampling)) fail("invalid character sampling");
    if (!Array.isArray(character.rotors) || character.rotors.some(rotor => Array.isArray(rotor) ? rotor.length !== 3 || !rotor.every(Number.isFinite) || rotor[2] <= 0 : !rotor || ![rotor.x, rotor.y].every(Number.isFinite))) fail("invalid rotor anchors");
    if (character.centerMark && (![character.centerMark.widthCells, character.centerMark.heightCells].every(value => Number.isFinite(value) && value > 0 && value <= 1) || ![character.centerMark.topColor, character.centerMark.bottomColor].every(value => /^#[0-9a-f]{6}$/i.test(value)))) fail("invalid character center mark");
  }
  for (const [key, collection] of [["theme", "themes"], ["terrainLayer", "terrainLayers"], ["terrainStyle", "terrainStyles"], ["character", "characters"]]) {
    if (!Object.hasOwn(presets[collection], presets.defaults[key])) fail(`unknown default ${key}`);
  }
  return presets;
}
