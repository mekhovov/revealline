import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { parse } from 'acorn';
import { canonicalJSON } from '../data-json.mjs';
import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
import {
  ROOM_CONTENT_FORMAT,
  validateRoomContent,
  publicRoomCatalogueEntry,
  validateRoomCatalogue,
  roomRecipeSHA256,
  assertRoomRecipeBinding,
  roomSelectionLink,
  roomInvitationLink,
  readRoomSelection,
  readRoomInvitation,
} from '../online/room-content.mjs';
import {
  ROOM_PROTOCOL,
  createAuthoritativeRoom,
  joinAuthoritativeRoom,
  readyAuthoritativeRoom,
  stepAuthoritativeRoom,
  snapshotAuthoritativeRoom,
  restoreTrustedRoomSnapshot,
  checkpointAuthoritativeRoom,
  restoreAuthoritativeRoomCheckpoint,
  rematchAuthoritativeRoom,
  exportAuthoritativeRoomResult,
  verifyAuthoritativeRoomResult,
  verifyBoundAuthoritativeRoomResult,
} from '../online/room-core.mjs';

const title = { en: 'Two returns', uk: 'Два повернення' };
const recipe = () => {
  const level = structuredClone(CLASSIC_SNAKE_LEVELS[0].level);
  return {
    family: 'snake',
    mode: 'versus',
    seed: 17,
    level,
    content: {
      format: ROOM_CONTENT_FORMAT,
      catalogueId: 'community:snake:two-returns:versus',
      source: {
        kind: 'community',
        id: `ed_${'a'.repeat(64)}`,
        sha256: 'b'.repeat(64),
        version: '1.0',
        title,
      },
      mission: { id: level.id, revision: String(level.revision), title },
      presentation: 'shared-runtime',
    },
  };
};
const digest = (value) => createHash('sha256').update(canonicalJSON(value)).digest('hex');
const engineVersion = 'e'.repeat(64);

test('room content is bounded data and public projection does not disclose registry internals', () => {
  const accepted = recipe();
  const entry = {
    id: accepted.content.catalogueId,
    family: 'snake',
    mode: 'versus',
    title,
    level: accepted.level,
    content: accepted.content,
    registryPath: '/private/packages/example.json',
    payload: { secret: true },
  };
  const publicEntry = publicRoomCatalogueEntry(entry);
  assert.equal('registryPath' in publicEntry, false);
  assert.equal('payload' in publicEntry, false);
  assert.equal('level' in publicEntry, false);
  assert.deepEqual(publicEntry.content, accepted.content);
  for (const mutate of [
    (value) => {
      value.source.sha256 = 'short-hash';
    },
    (value) => {
      value.source.id = 'latest';
    },
    (value) => {
      value.source.assetURL = 'https://untrusted.example/image.png';
    },
    (value) => {
      value.mission.title.en = 'x'.repeat(121);
    },
    (value) => {
      value.presentation = 'external';
    },
    (value) => {
      value.mission.id = 'another-level';
    },
  ]) {
    const candidate = structuredClone(accepted.content);
    mutate(candidate);
    assert.throws(() => validateRoomContent(candidate, accepted));
  }
  assert.throws(() => validateRoomCatalogue([publicEntry, publicEntry]));
  assert.throws(() =>
    validateRoomCatalogue([publicEntry], [{ id: publicEntry.id, title, reason: title }]),
  );
});

test('full canonical SHA256 binds accepted geometry and provenance even when titles and native IDs match', async () => {
  const first = recipe(),
    second = recipe();
  second.content.source.id = `ed_${'c'.repeat(64)}`;
  second.content.source.sha256 = 'd'.repeat(64);
  const firstHash = await roomRecipeSHA256(first);
  assert.equal(firstHash, digest(first));
  assert.notEqual(await roomRecipeSHA256(second), firstHash);
  await assertRoomRecipeBinding(first, firstHash);
  await assert.rejects(assertRoomRecipeBinding(second, firstHash));
  await assert.rejects(assertRoomRecipeBinding(second, await roomRecipeSHA256(second), first));
  const altered = structuredClone(first);
  altered.level.width++;
  await assert.rejects(assertRoomRecipeBinding(altered, firstHash));
});

test('imported source pins survive full snapshots, checkpoints, rematches and replay receipts', async () => {
  const accepted = recipe(),
    contentHash = await roomRecipeSHA256(accepted);
  const room = createAuthoritativeRoom(accepted, {
    id: 'a'.repeat(32),
    contentHash,
    engineVersion,
  });
  joinAuthoritativeRoom(room, 0);
  readyAuthoritativeRoom(room, 0, 0);
  readyAuthoritativeRoom(room, 1, 0);
  assert.deepEqual(restoreTrustedRoomSnapshot(snapshotAuthoritativeRoom(room)).recipe, accepted);
  assert.deepEqual(
    restoreAuthoritativeRoomCheckpoint(checkpointAuthoritativeRoom(room), {
      contentHash,
      engineVersion,
    }).recipe,
    accepted,
  );
  for (let tick = 0; tick < 6000 && room.status === 'playing'; tick++)
    stepAuthoritativeRoom(room, 0);
  assert.equal(room.status, 'finished');
  const receipt = exportAuthoritativeRoomResult(room);
  assert.deepEqual(
    await verifyBoundAuthoritativeRoomResult(receipt, {
      acceptedRecipe: accepted,
      contentHash,
      engineVersion,
    }),
    room.result,
  );
  assert.throws(
    () => verifyAuthoritativeRoomResult(receipt, { contentHash, engineVersion }),
    /accepted room recipe/,
  );
  const relabelled = structuredClone(receipt);
  relabelled.recipe.content.source.title.en = 'Official challenge';
  relabelled.contentHash = await roomRecipeSHA256(relabelled.recipe);
  await assert.rejects(
    verifyBoundAuthoritativeRoomResult(relabelled, {
      acceptedRecipe: accepted,
      contentHash: relabelled.contentHash,
      engineVersion,
    }),
  );
  rematchAuthoritativeRoom(room, 0, 0);
  rematchAuthoritativeRoom(room, 1, 0);
  assert.equal(room.generation, 2);
  assert.deepEqual(room.recipe, accepted);
  assert.equal(room.contentHash, contentHash);
});

test('mission links and invitations retain only server keys and immutable pins, never alternate endpoints or payload URLs', () => {
  const accepted = recipe(),
    contentHash = digest(accepted);
  const base =
    'https://game.example/game/online/?lang=uk&endpoint=https://bad.example&package=https://bad.example/pkg#invite=obsolete';
  const selection = new URL(
    roomSelectionLink(base, { id: accepted.content.catalogueId, pace: 'slow', targets: 'varied' }),
  );
  assert.equal(selection.searchParams.get('recipe'), accepted.content.catalogueId);
  assert.equal(selection.searchParams.get('pace'), 'slow');
  assert.equal(selection.searchParams.get('targets'), 'varied');
  assert.equal(selection.searchParams.get('lang'), 'uk');
  assert.equal(selection.searchParams.has('endpoint'), false);
  assert.equal(selection.searchParams.has('package'), false);
  assert.equal(selection.hash, '');
  assert.deepEqual(readRoomSelection(selection.href), {
    id: accepted.content.catalogueId,
    pace: 'slow',
    targets: 'varied',
    seed: 17,
  });
  assert.throws(() => readRoomSelection('https://game.example/?recipe=missing&pace=turbo'));
  assert.throws(() => readRoomSelection('https://game.example/?recipe=one&recipe=two'));
  const invitation = new URL(
    roomInvitationLink(base, { invite: 'f'.repeat(64), contentHash, recipe: accepted }),
  );
  const pins = new URLSearchParams(invitation.hash.slice(1));
  assert.equal(pins.get('recipe'), accepted.content.catalogueId);
  assert.equal(pins.get('content'), contentHash);
  assert.equal(pins.get('invite'), 'f'.repeat(64));
  assert.equal(invitation.search, '?lang=uk');
  assert.deepEqual(readRoomInvitation(invitation.href), {
    invite: 'f'.repeat(64),
    catalogueId: accepted.content.catalogueId,
    expectedHash: contentHash,
  });
  assert.throws(() => readRoomInvitation(`${invitation.href}&content=${'c'.repeat(64)}`));
});

async function pageFunctions(names, globals) {
  const source = await readFile(new URL('../online/rooms.mjs', import.meta.url), 'utf8');
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const functions = ast.body.filter(
    (node) => node.type === 'FunctionDeclaration' && names.includes(node.id.name),
  );
  assert.equal(functions.length, names.length);
  return runInNewContext(
    `${functions.map((node) => source.slice(node.start, node.end)).join('\n')}\n({${names.join(',')}})`,
    globals,
  );
}

test('accepted mission UI uses snapshot provenance while an unavailable link never selects a replacement silently', async () => {
  const accepted = recipe();
  accepted.content.source.title.en = '<img src=x onerror=attack()> Imported';
  const nodes = Object.fromEntries(
    [
      'accepted-mission',
      'accepted-source',
      'identity',
      'recipe',
      'create',
      'public',
      'share-selection',
      'pace',
      'targets',
      'selection-source',
      'share',
    ].map((id) => [id, { textContent: '', value: '' }]),
  );
  const globals = {
    $: (id) => nodes[id],
    uk: false,
    say: (en) => en,
    setText: (id, value) => {
      nodes[id].textContent = value;
    },
    catalogueEntries: [],
    unavailableEntries: [
      {
        id: 'import:missing-company',
        title: { en: 'Company edition', uk: 'Видання компанії' },
        reason: { en: 'This edition supports Solo only.', uk: 'Це видання підтримує лише соло.' },
      },
    ],
    roomSelectionLink,
    selectedSeed: 17,
    location: { href: 'https://game.example/game/online/' },
  };
  const functions = await pageFunctions(
    ['sourceLabel', 'showAcceptedMission', 'updateSelection', 'selection'],
    globals,
  );
  functions.showAcceptedMission({ recipe: accepted, contentHash: digest(accepted), engineVersion });
  assert.match(nodes['accepted-mission'].textContent, /Two returns/);
  assert.match(nodes['accepted-source'].textContent, /<img src=x onerror=attack\(\)> Imported/);
  assert.match(nodes.identity.textContent, new RegExp(accepted.content.source.id));
  assert.match(nodes.identity.textContent, new RegExp(accepted.content.source.sha256));
  assert.equal(
    Object.values(nodes).some((node) => 'innerHTML' in node),
    false,
  );
  functions.updateSelection('import:missing-company:team:previous-immutable-recipe');
  assert.equal(nodes.create.disabled, true);
  assert.equal(nodes['share-selection'].hidden, true);
  assert.match(nodes['selection-source'].textContent, /Solo only/);
  assert.equal(nodes.recipe.value, '');
});

test('saving a result rejects a changed recipe and a late result from a previous rematch', async () => {
  const source = await readFile(new URL('../online/rooms.mjs', import.meta.url), 'utf8');
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const handler = ast.body.find(
    (node) =>
      node.type === 'ExpressionStatement' &&
      node.expression.callee?.property?.name === 'addEventListener' &&
      node.expression.callee.object?.callee?.name === '$' &&
      node.expression.callee.object.arguments[0]?.value === 'receipt',
  ).expression.arguments[1];
  const accepted = recipe(),
    contentHash = digest(accepted);
  const owner = { roomId: 'a'.repeat(32), contentHash, engineVersion };
  let exports = 0,
    notice = '';
  const state = {
    status: 'finished',
    generation: 1,
    recipe: accepted,
    tick: 1,
    result: { winner: 'draw' },
  };
  const receipt = {
    protocol: ROOM_PROTOCOL,
    contentHash,
    engineVersion,
    recipe: structuredClone(accepted),
    tick: 1,
    result: state.result,
  };
  const context = {
    credentials: owner,
    state,
    lifecycle: { snapshot: () => ({ phase: 'connected' }) },
    ROOM_PROTOCOL,
    canonicalJSON,
    assertRoomRecipeBinding,
    roomError: (message) => new Error(message),
    api: async () => receipt,
    exportJSONFile: async () => {
      exports++;
      return { status: 'requested' };
    },
    say: (en) => en,
    notice: (value) => {
      notice = value;
    },
  };
  const save = runInNewContext(`(${source.slice(handler.start, handler.end)})`, context);
  receipt.recipe.content.source.sha256 = 'c'.repeat(64);
  await save();
  assert.equal(exports, 0);
  assert.match(notice, /exact accepted room recipe/);
  receipt.recipe = structuredClone(accepted);
  context.api = async () => {
    context.state = { ...state, generation: 2 };
    return receipt;
  };
  await save();
  assert.equal(exports, 0);
  context.state = state;
  context.api = async () => receipt;
  await save();
  assert.equal(exports, 1);
});
