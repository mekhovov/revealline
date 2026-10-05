import { boundedJSON, canonicalJSON, plainObject, required } from '../data-json.mjs';

export const ROOM_CONTENT_FORMAT = 'revealline-room-content.v1';
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const text = (value, limit) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= limit &&
  !/[\u0000-\u001f\u007f]/.test(value);
const id = (value) => text(value, 240) && /^[a-zA-Z0-9][a-zA-Z0-9_.:@-]*$/.test(value);
const fields = (value, names) =>
  required(
    plainObject(value) && Object.keys(value).every((key) => names.includes(key)),
    'Invalid room content fields.',
  );
function title(value) {
  fields(value, ['en', 'uk']);
  required(
    text(value.en, 120) && text(value.uk, 120),
    'Room titles require bounded English and Ukrainian text.',
  );
  return { en: value.en, uk: value.uk };
}

/** Data only. Registry approval and native package admission belong to the service,
 * never to a browser install receipt or a self-declared source label. */
export function validateRoomContent(value, recipe = null) {
  const content = boundedJSON(value, { maxBytes: 4096, maxNodes: 40, maxDepth: 4, maxString: 240 });
  fields(content, ['format', 'catalogueId', 'source', 'mission', 'presentation']);
  required(
    content.format === ROOM_CONTENT_FORMAT && id(content.catalogueId),
    'Invalid exact room catalogue identity.',
  );
  required(
    content.presentation === 'shared-runtime',
    'This room requires an unsupported presentation adapter.',
  );
  const source = content.source;
  fields(source, ['kind', 'id', 'sha256', 'version', 'revision', 'title']);
  required(
    ['builtin', 'community', 'company'].includes(source.kind) && id(source.id),
    'Invalid immutable room source.',
  );
  title(source.title);
  required(
    source.kind === 'builtin' || hash(source.sha256),
    'Imported rooms require the full source package SHA256.',
  );
  if (source.sha256 !== undefined) required(hash(source.sha256), 'Invalid source package SHA256.');
  if (source.kind === 'community')
    required(
      /^ed_[a-f0-9]{64}$/.test(source.id),
      'Community rooms require an immutable published edition ID.',
    );
  if (source.version !== undefined)
    required(text(source.version, 64), 'Invalid room source version.');
  if (source.revision !== undefined)
    required(text(source.revision, 160), 'Invalid room source revision.');
  const mission = content.mission;
  fields(mission, ['id', 'revision', 'title']);
  required(
    id(mission.id) && text(mission.revision, 160),
    'Invalid accepted room mission identity.',
  );
  title(mission.title);
  if (recipe)
    required(
      mission.id === recipe.level?.id && mission.revision === String(recipe.level?.revision),
      'Room provenance does not identify the accepted mission.',
    );
  return content;
}

/** Explicit public projection: registry files, payloads and internal approval
 * fields must never leak through the catalogue endpoint. */
export function publicRoomCatalogueEntry(entry) {
  required(
    id(entry.id) &&
      ['snake', 'capture'].includes(entry.family) &&
      ['versus', 'team'].includes(entry.mode),
    'Invalid room catalogue entry.',
  );
  const revision = String(entry.level?.revision ?? entry.revision);
  required(text(revision, 160) && revision !== 'undefined', 'Room catalogue revision is required.');
  const result = {
    id: entry.id,
    family: entry.family,
    mode: entry.mode,
    title: title(entry.title),
    revision,
  };
  if (entry.content !== undefined) {
    result.content = validateRoomContent(entry.content);
    required(result.content.catalogueId === result.id, 'Room catalogue provenance mismatch.');
  }
  return result;
}

export function validateRoomCatalogue(entries, unavailable = []) {
  required(
    Array.isArray(entries) &&
      entries.length <= 1024 &&
      Array.isArray(unavailable) &&
      unavailable.length <= 1024,
    'Room catalogue is unbounded.',
  );
  const ids = new Set();
  const unique = (value) => {
    required(id(value) && !ids.has(value), 'Duplicate or invalid room catalogue identity.');
    ids.add(value);
  };
  const accepted = entries.map((entry) => {
    const projected = publicRoomCatalogueEntry(entry);
    unique(projected.id);
    return projected;
  });
  const rejected = unavailable.map((entry) => {
    unique(entry.id);
    return { id: entry.id, title: title(entry.title), reason: title(entry.reason) };
  });
  return { entries: accepted, unavailable: rejected };
}

/** Exact hashing matches the service canonical JSON hash. This is content
 * integrity, not a signature or proof that a server ran the match. */
export async function roomRecipeSHA256(recipe) {
  const json = canonicalJSON(boundedJSON(recipe));
  return Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json))),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');
}

export async function assertRoomRecipeBinding(recipe, contentHash, acceptedRecipe = null) {
  required(hash(contentHash), 'A full immutable room recipe SHA256 is required.');
  if (recipe.content !== undefined) validateRoomContent(recipe.content, recipe);
  if (acceptedRecipe)
    required(
      canonicalJSON(recipe) === canonicalJSON(acceptedRecipe),
      'The receipt does not contain the exact accepted room recipe.',
    );
  required(
    (await roomRecipeSHA256(recipe)) === contentHash,
    'The room recipe does not match its immutable SHA256.',
  );
  return true;
}

/** Links select a server catalogue key; they never supply a level, package URL,
 * endpoint or replacement provenance. An unavailable key remains unavailable. */
export function roomSelectionLink(base, selection) {
  required(id(selection.id), 'Invalid shared room selection.');
  const url = new URL(base);
  url.hash = '';
  for (const name of [...url.searchParams.keys()])
    if (name !== 'lang') url.searchParams.delete(name);
  url.searchParams.set('recipe', selection.id);
  for (const [name, choices] of [
    ['pace', ['slow', 'normal', 'fast']],
    ['targets', ['authored', 'moving', 'varied']],
  ]) {
    required(choices.includes(selection[name]), 'Invalid shared room rules.');
    url.searchParams.set(name, selection[name]);
  }
  const seed = selection.seed ?? 17;
  required(
    Number.isSafeInteger(seed) && seed >= 0 && seed <= 0xffffffff,
    'Invalid shared room seed.',
  );
  url.searchParams.set('seed', String(seed));
  return url.href;
}

export function readRoomSelection(base) {
  const query = new URL(base).searchParams;
  const result = {
    id: query.get('recipe'),
    pace: query.get('pace') ?? 'normal',
    targets: query.get('targets') ?? 'authored',
    seed: query.has('seed') ? Number(query.get('seed')) : 17,
  };
  required(result.id === null || id(result.id), 'Invalid shared room catalogue identity.');
  for (const name of ['recipe', 'pace', 'targets', 'seed'])
    required(query.getAll(name).length <= 1, 'Duplicate shared room selection.');
  // Reuse output validation without changing a requested selection.
  roomSelectionLink(base, { ...result, id: result.id ?? 'unselected' });
  return result;
}

export function readRoomInvitation(base) {
  const url = new URL(base),
    pins = new URLSearchParams(url.hash.slice(1));
  if (!pins.has('invite')) return null;
  required(
    url.hash.length <= 1024 &&
      [...pins.keys()].every((key) => ['invite', 'recipe', 'content'].includes(key)) &&
      [...pins.keys()].every((key) => pins.getAll(key).length === 1),
    'Invalid room invitation fields.',
  );
  const result = {
    invite: pins.get('invite'),
    catalogueId: pins.get('recipe'),
    expectedHash: pins.get('content'),
  };
  required(
    hash(result.invite) &&
      (result.catalogueId === null || id(result.catalogueId)) &&
      (result.expectedHash === null || hash(result.expectedHash)),
    'Invalid room invitation pins.',
  );
  return result;
}

export function roomInvitationLink(base, { invite, contentHash, recipe }) {
  required(hash(invite) && hash(contentHash), 'Invalid room invitation pins.');
  const url = new URL(base);
  for (const name of [...url.searchParams.keys()])
    if (name !== 'lang') url.searchParams.delete(name);
  const fragment = new URLSearchParams({ invite, content: contentHash });
  if (recipe.content)
    fragment.set('recipe', validateRoomContent(recipe.content, recipe).catalogueId);
  url.hash = fragment.toString();
  return url.href;
}
