// Pure cosmetic collection preview. No simulation, storage, clock, random rewards or stats.
export const COLLECTION_VERSION = "1.0.0";
export const SCOPE_KEYS = Object.freeze(["gameId", "themeId", "caseId", "challengeId", "levelId", "mapId"]);
const MAX_EVENTS = 2000;
const MAX_SAVE_LENGTH = 2_000_000;
const clone = value => structuredClone(value);
const fail = message => {throw new Error(`Collection: ${message}`);};
const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const idOK = value => typeof value === "string" && /^[a-z0-9][a-z0-9._-]{0,95}$/.test(value);
const id = (value, name) => {if (!idOK(value)) fail(`${name} must be a stable ID`);};
const label = (value, name) => {if (typeof value !== "string" || !value.trim() || value.length > 500) fail(`${name} must be readable text`);};
const keys = (value, allowed, name) => {
  if (!isObject(value)) fail(`${name} must be an object`);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${name}.${key} is unsupported`);
};
const array = (value, name, min = 0, max = 500) => {if (!Array.isArray(value) || value.length < min || value.length > max) fail(`${name} has invalid length`);};
const integer = (value, min, max, name) => {if (!Number.isInteger(value) || value < min || value > max) fail(`${name} is out of range`);};
const unique = (values, name) => {if (new Set(values).size !== values.length) fail(`${name} contains duplicates`);};

export function validateScope(scope) {
  keys(scope, SCOPE_KEYS, "scope");
  for (const [key, value] of Object.entries(scope)) id(value, key);
  return scope;
}

export function scopeKey(scope) {
  validateScope(scope);
  return SCOPE_KEYS.filter(key => Object.hasOwn(scope, key)).map(key => `${key}=${scope[key]}`).join("|");
}

export function matchesScope(scope, context) {
  return SCOPE_KEYS.every(key => !Object.hasOwn(scope, key) || scope[key] === context[key]);
}

// More constraints win; equal specificity: map > level > challenge > case > theme > game.
function compareScopes(a, b) {
  const count = Object.keys(b.scope).length - Object.keys(a.scope).length;
  if (count) return count;
  for (const key of [...SCOPE_KEYS].reverse()) {
    const difference = Number(Object.hasOwn(b.scope, key)) - Number(Object.hasOwn(a.scope, key));
    if (difference) return difference;
  }
  const left = scopeKey(a.scope), right = scopeKey(b.scope);
  return left < right ? -1 : left > right ? 1 : 0;
}

export function validateResult(event) {
  keys(event, ["version", "id", "runId", "type", "simulated", "context", "result"], "event");
  if (event.version !== COLLECTION_VERSION || event.type !== "run.completed.v1") fail("unsupported result event version or type");
  id(event.id, "event.id"); id(event.runId, "event.runId");
  if (typeof event.simulated !== "boolean") fail("event.simulated must be explicit");
  validateScope(event.context);
  for (const key of ["gameId", "themeId", "levelId", "mapId"]) id(event.context[key], `event.context.${key}`);
  keys(event.result, ["outcome", "stars", "coverage", "livesLost", "durationMs", "objectives"], "result");
  const result = event.result;
  if (!["won", "lost"].includes(result.outcome)) fail("result.outcome must be won or lost");
  integer(result.stars, 0, 3, "result.stars");
  if (result.outcome === "lost" && result.stars !== 0) fail("a lost run cannot award stars");
  if (!Number.isFinite(result.coverage) || result.coverage < 0 || result.coverage > 1) fail("result.coverage must be a fraction");
  integer(result.livesLost, 0, 999, "result.livesLost");
  integer(result.durationMs, 0, 86_400_000, "result.durationMs");
  array(result.objectives, "result.objectives", 0, 100);
  result.objectives.forEach(value => id(value, "objective")); unique(result.objectives, "objectives");
  return event;
}

export function createProfile({mode = "lab", profileId = "local-preview"} = {}) {
  if (!["lab", "game"].includes(mode)) fail("unknown profile mode");
  id(profileId, "profileId");
  return {version: COLLECTION_VERSION, mode, profileId, events: [], equipped: []};
}

function validateProfile(profile) {
  keys(profile, ["version", "mode", "profileId", "events", "equipped"], "profile");
  if (profile.version !== COLLECTION_VERSION) fail("unsupported profile version; migration required");
  if (!["lab", "game"].includes(profile.mode)) fail("profile mode must be explicit");
  id(profile.profileId, "profile.profileId");
  array(profile.events, "profile.events", 0, MAX_EVENTS);
  const ids = [], runs = [];
  for (const event of profile.events) {
    validateResult(event);
    if (event.simulated !== (profile.mode === "lab")) fail("profile mixes simulated and game results");
    ids.push(event.id); runs.push(event.runId);
  }
  unique(ids, "event IDs"); unique(runs, "run IDs");
  array(profile.equipped, "profile.equipped", 0, 500);
  for (const entry of profile.equipped) {keys(entry, ["scope", "characterId"], "equipped entry"); validateScope(entry.scope); id(entry.characterId, "characterId");}
  unique(profile.equipped.map(entry => scopeKey(entry.scope)), "equipped scopes");
  return profile;
}

export function restoreProfile(serialized, options = {}) {
  const empty = createProfile(options);
  if (serialized === null || serialized === undefined || serialized === "") return {profile: empty, warning: null};
  try {
    if (typeof serialized !== "string" || serialized.length > MAX_SAVE_LENGTH) fail("saved profile is too large or not text");
    const profile = validateProfile(JSON.parse(serialized));
    if (profile.mode !== empty.mode || profile.profileId !== empty.profileId) fail("saved profile belongs to a different mode or profile");
    return {profile: clone(profile), warning: null};
  } catch (error) {
    return {profile: empty, warning: `Progress was not loaded: ${error.message}. A fresh ${empty.mode} preview is shown; keep the old save for recovery.`};
  }
}

export function serializeProfile(profile) {validateProfile(profile); return JSON.stringify(profile);}

// Compare payloads independent of JSON property order. Objective IDs represent a set.
function eventSignature(event) {
  const result = event.result;
  return JSON.stringify([event.version, event.runId, event.type, event.simulated, scopeKey(event.context), result.outcome, result.stars, result.coverage, result.livesLost, result.durationMs, [...result.objectives].sort()]);
}

export function applyResult(profile, event) {
  try {validateProfile(profile); validateResult(event);} catch (error) {return {profile, accepted: false, reason: error.message};}
  if (event.simulated !== (profile.mode === "lab")) return {profile, accepted: false, reason: "profile-mode-mismatch"};
  const byID = profile.events.find(previous => previous.id === event.id);
  if (byID) return {profile, accepted: false, reason: eventSignature(byID) === eventSignature(event) ? "duplicate-event" : "event-id-conflict"};
  const byRun = profile.events.find(previous => previous.runId === event.runId);
  if (byRun) return {profile, accepted: false, reason: eventSignature(byRun) === eventSignature(event) ? "duplicate-run" : "run-id-conflict"};
  if (profile.events.length >= MAX_EVENTS) return {profile, accepted: false, reason: "profile-event-limit; export before migration"};
  return {profile: {...clone(profile), events: [...clone(profile.events), clone(event)]}, accepted: true, reason: "result-recorded"};
}

function validateCriterion(criterion) {
  keys(criterion, ["id", "label", "type", "scope", "target", "minStars", "maxLivesLost", "maxDurationMs", "objectivesAll"], "criterion");
  id(criterion.id, "criterion.id"); label(criterion.label, "criterion.label"); validateScope(criterion.scope);
  if (!["completed-levels", "stars"].includes(criterion.type)) fail("unsupported criterion type");
  integer(criterion.target, 1, MAX_EVENTS * (criterion.type === "stars" ? 3 : 1), "criterion.target");
  if (criterion.minStars !== undefined) integer(criterion.minStars, 0, 3, "criterion.minStars");
  if (criterion.maxLivesLost !== undefined) integer(criterion.maxLivesLost, 0, 999, "criterion.maxLivesLost");
  if (criterion.maxDurationMs !== undefined) integer(criterion.maxDurationMs, 0, 86_400_000, "criterion.maxDurationMs");
  if (criterion.objectivesAll !== undefined) {array(criterion.objectivesAll, "criterion.objectivesAll", 0, 100); criterion.objectivesAll.forEach(value => id(value, "objective")); unique(criterion.objectivesAll, "criterion objectives");}
}

export function validateCollection(definitions, visualCharacterIds) {
  keys(definitions, ["version", "id", "description", "fallbackId", "contexts", "defaults", "characters", "fixtures"], "definitions");
  if (definitions.version !== COLLECTION_VERSION) fail("unsupported definitions version");
  id(definitions.id, "definitions.id"); label(definitions.description, "description");
  array(definitions.characters, "characters", 1, 100);
  unique(definitions.characters.map(character => character.id), "character IDs");
  const known = new Set(definitions.characters.map(character => character.id));
  const visuals = visualCharacterIds === undefined ? null : new Set(visualCharacterIds);
  for (const character of definitions.characters) {
    keys(character, ["id", "label", "family", "description", "availableIn", "unlock"], "character");
    id(character.id, "character.id"); id(character.family, "character.family"); label(character.label, "character.label"); label(character.description, "character.description");
    if (visuals && !visuals.has(character.id)) fail(`missing visual character ${character.id}`);
    array(character.availableIn, "availableIn", 1, 50); character.availableIn.forEach(validateScope);
    const unlock = character.unlock;
    keys(unlock, ["starter", "anyOf"], "unlock");
    if (unlock.starter === true) {if (Object.hasOwn(unlock, "anyOf")) fail("starter cannot also have criteria");}
    else {
      if (Object.hasOwn(unlock, "starter")) fail("starter must be true or omitted");
      array(unlock.anyOf, "unlock.anyOf", 1, 10);
      const ids = [];
      for (const group of unlock.anyOf) {keys(group, ["allOf"], "unlock group"); array(group.allOf, "allOf", 1, 10); group.allOf.forEach(criterion => {validateCriterion(criterion); ids.push(criterion.id);});}
      unique(ids, "criterion IDs within a character");
    }
  }
  const fallback = definitions.characters.find(character => character.id === definitions.fallbackId);
  if (!fallback || fallback.unlock.starter !== true || !fallback.availableIn.some(scope => Object.keys(scope).length === 0)) fail("fallback must be a globally available starter");
  array(definitions.defaults, "defaults", 0, 100);
  unique(definitions.defaults.map(entry => scopeKey(entry.scope)), "default scopes");
  for (const entry of definitions.defaults) {keys(entry, ["scope", "characterId"], "default"); validateScope(entry.scope); if (!known.has(entry.characterId)) fail("unknown default character");}
  array(definitions.contexts, "contexts", 1, 100); unique(definitions.contexts.map(context => context.id), "context IDs");
  for (const context of definitions.contexts) {keys(context, ["id", "label", "scope"], "context"); id(context.id, "context.id"); label(context.label, "context.label"); validateScope(context.scope);}
  array(definitions.fixtures, "fixtures", 0, 100); unique(definitions.fixtures.map(fixture => fixture.id), "fixture IDs");
  for (const fixture of definitions.fixtures) {
    keys(fixture, ["id", "label", "description", "event"], "fixture"); id(fixture.id, "fixture.id"); label(fixture.label, "fixture.label"); label(fixture.description, "fixture.description"); validateResult(fixture.event);
    if (!fixture.event.simulated) fail("test fixtures must be explicitly simulated");
  }
  unique(definitions.fixtures.map(fixture => fixture.event.id), "fixture event IDs");
  unique(definitions.fixtures.map(fixture => fixture.event.runId), "fixture run IDs");
  return definitions;
}

function evaluateCriterion(criterion, events) {
  const bestByLevel = new Map();
  for (const event of events) {
    const result = event.result;
    if (result.outcome !== "won" || !matchesScope(criterion.scope, event.context) || result.stars < (criterion.minStars ?? 0) || result.livesLost > (criterion.maxLivesLost ?? Infinity) || result.durationMs > (criterion.maxDurationMs ?? Infinity) || !(criterion.objectivesAll ?? []).every(objective => result.objectives.includes(objective))) continue;
    // A level's replays, maps and challenge variants never inflate total collection progress.
    const level = JSON.stringify([event.context.gameId, event.context.themeId, event.context.levelId]);
    bestByLevel.set(level, Math.max(bestByLevel.get(level) ?? 0, result.stars));
  }
  const current = criterion.type === "stars" ? [...bestByLevel.values()].reduce((sum, stars) => sum + stars, 0) : bestByLevel.size;
  return {id: criterion.id, label: criterion.label, type: criterion.type, scope: clone(criterion.scope), current, target: criterion.target, met: current >= criterion.target};
}

export function evaluateCollection(definitions, profile, context) {
  validateCollection(definitions); validateProfile(profile); validateScope(context);
  return definitions.characters.map(character => {
    const available = character.availableIn.some(scope => matchesScope(scope, context));
    const alternatives = (character.unlock.anyOf ?? []).map(group => {
      const conditions = group.allOf.map(criterion => evaluateCriterion(criterion, profile.events));
      return {met: conditions.every(condition => condition.met), conditions};
    });
    const unlocked = character.unlock.starter === true || alternatives.some(group => group.met);
    const conditions = alternatives.flatMap(group => group.conditions);
    return {id: character.id, label: character.label, family: character.family, description: character.description, available, unlocked, status: !available ? "unavailable" : unlocked ? "unlocked" : "locked", conditions, alternatives, unmet: unlocked ? [] : alternatives.map(group => group.conditions.filter(condition => !condition.met).map(condition => `${condition.label} (${condition.current}/${condition.target})`).join(" AND ")), availabilityReason: available ? null : "Available in a different authored theme or context."};
  });
}

export function equipCharacter(definitions, profile, characterId, scope, context = scope) {
  let rows;
  try {validateScope(scope); rows = evaluateCollection(definitions, profile, context);} catch (error) {return {profile, accepted: false, reason: error.message};}
  if (!matchesScope(scope, context)) return {profile, accepted: false, reason: "scope-does-not-match-current-context"};
  const character = rows.find(row => row.id === characterId);
  if (!character) return {profile, accepted: false, reason: "unknown-character"};
  if (!character.unlocked) return {profile, accepted: false, reason: "character-locked"};
  if (!character.available) return {profile, accepted: false, reason: "character-unavailable-in-context"};
  const key = scopeKey(scope);
  const equipped = profile.equipped.filter(entry => scopeKey(entry.scope) !== key);
  if (equipped.length >= 500) return {profile, accepted: false, reason: "equipped-scope-limit"};
  equipped.push({scope: clone(scope), characterId});
  return {profile: {...clone(profile), equipped: clone(equipped)}, accepted: true, reason: "character-equipped"};
}

export function resolveCharacter(definitions, profile, context) {
  const rows = evaluateCollection(definitions, profile, context);
  const eligible = new Set(rows.filter(row => row.unlocked && row.available).map(row => row.id));
  for (const [source, entries] of [["equipped", profile.equipped], ["default", definitions.defaults]]) {
    const chosen = entries.filter(entry => matchesScope(entry.scope, context) && eligible.has(entry.characterId)).sort(compareScopes)[0];
    if (chosen) return {characterId: chosen.characterId, source, scope: clone(chosen.scope), reason: source === "equipped" ? "Most specific eligible saved choice." : "Most specific eligible authored default."};
  }
  return {characterId: definitions.fallbackId, source: "fallback", scope: {}, reason: "Global neutral starter; no eligible saved choice or authored default matched."};
}

export function applyFixture(definitions, profile, fixtureId) {
  try {validateCollection(definitions); validateProfile(profile);} catch (error) {return {profile, accepted: false, reason: error.message};}
  if (profile.mode !== "lab") return {profile, accepted: false, reason: "fixtures-are-lab-only"};
  const fixture = definitions.fixtures.find(entry => entry.id === fixtureId);
  if (!fixture) return {profile, accepted: false, reason: "unknown-fixture"};
  return applyResult(profile, fixture.event);
}
