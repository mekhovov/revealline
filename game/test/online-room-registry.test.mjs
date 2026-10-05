// Authored admission regressions. Automated suites remain waived and unrun.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ROOM_REGISTRY_FORMAT,
  validateRoomRegistryManifest,
  inspectPinnedRoomPackage,
  loadRoomContentRegistry,
} from '../../services/rooms/content-registry.mjs';
import { createRoomService } from '../../services/rooms/server.mjs';
import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
import { CLASSIC_PACKAGE_FORMAT, exportClassicSnakePackage } from '../snake/classic-community.mjs';
import { createPursuitPilotCandidates } from '../content-design/pursuit-pilot-candidates.mjs';
import { prepareCreatorTeamSourceCampaign, exportCreatorTeamCampaign } from '../creator/team.mjs';
import { prepareClassicSnakeLevel } from '../snake/classic-setup.mjs';
import { canonicalJSON } from '../data-json.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const title = { en: 'Private workshop', uk: 'Приватна майстерня' };
function pinFor(bytes, changes = {}) {
  return {
    id: 'workshop',
    kind: 'community',
    path: 'workshop.json',
    sha256: digest(bytes),
    bytes: bytes.length,
    editionId: `ed_${'a'.repeat(64)}`,
    version: '1.0.0',
    title,
    ...changes,
  };
}
async function classicBytes() {
  const entry = CLASSIC_SNAKE_LEVELS[0];
  return new Uint8Array(
    await exportClassicSnakePackage({
      format: CLASSIC_PACKAGE_FORMAT,
      title,
      entries: [{ title: entry.title, description: entry.description, level: entry.level }],
    }).arrayBuffer(),
  );
}
const manifest = (packages) => ({ format: ROOM_REGISTRY_FORMAT, packages });
async function localFixture(t, bytes, changes = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'revealline-room-registry-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const pin = pinFor(bytes, changes);
  const path = join(directory, 'registry.json');
  await writeFile(join(directory, pin.path), bytes);
  await writeFile(path, JSON.stringify(manifest([pin])));
  return { directory, path, pin };
}

test('registry configuration is bounded, data-only and rejects network/traversal paths', () => {
  const row = pinFor(Buffer.from('{}'));
  for (const path of [
    '../outside.json',
    '/tmp/file.json',
    'https://host/a.json',
    'folder\\file.json',
  ])
    assert.throws(() => validateRoomRegistryManifest(manifest([{ ...row, path }])));
  assert.throws(() => validateRoomRegistryManifest(manifest([{ ...row, validator: 'file.mjs' }])));
  assert.throws(() => validateRoomRegistryManifest(manifest([row, row])));
  assert.throws(() => validateRoomRegistryManifest(manifest([{ ...row, bytes: 8 * 1024 * 1024 }])));
});

test('native Classic entries retain raw publication pins and namespace both multiplayer modes', async () => {
  const bytes = await classicBytes(),
    pin = pinFor(bytes);
  const admitted = await inspectPinnedRoomPackage(pin, bytes);
  assert.equal(admitted.unavailable, undefined);
  assert.deepEqual(
    admitted.entries.map((entry) => entry.mode),
    ['versus', 'team'],
  );
  for (const entry of admitted.entries) {
    assert.match(entry.level.id, /^custom-snake-/);
    assert.equal(entry.content.source.id, pin.editionId);
    assert.equal(entry.content.source.sha256, digest(bytes));
    assert.equal(entry.content.catalogueId, entry.id);
    assert.equal(entry.content.presentation, 'shared-runtime');
  }
  const anotherOwner = await inspectPinnedRoomPackage(
    { ...pin, editionId: `ed_${'b'.repeat(64)}` },
    bytes,
  );
  assert.notEqual(anotherOwner.entries[0].id, admitted.entries[0].id);
  assert.deepEqual(anotherOwner.entries[0].level, admitted.entries[0].level);
});

test('native source-backed Team keeps its exact authored rules without inventing other modes', async () => {
  const source = createPursuitPilotCandidates({ team: true });
  const prepared = await prepareCreatorTeamSourceCampaign(source, {
    sourcePackId: source.packs[0].id,
    campaignId: source.campaigns[0].id,
    difficulty: 'standard',
  });
  const bytes = new Uint8Array(await exportCreatorTeamCampaign(prepared).arrayBuffer());
  const admitted = await inspectPinnedRoomPackage(pinFor(bytes), bytes);
  assert.equal(admitted.unavailable, undefined);
  assert.ok(admitted.entries.length > 0);
  assert.ok(admitted.entries.every((entry) => entry.family === 'capture' && entry.mode === 'team'));
  assert.deepEqual(
    admitted.entries.map((entry) => entry.level),
    prepared.pack.levels,
  );
});

test('changed bytes, self-attested policies and media packages cannot enter gameplay', async () => {
  const bytes = await classicBytes();
  const badHash = await inspectPinnedRoomPackage(
    { ...pinFor(bytes), sha256: '0'.repeat(64) },
    bytes,
  );
  assert.equal(badHash.unavailable.code, 'PIN_MISMATCH');
  const source = JSON.parse(new TextDecoder().decode(bytes));
  source.entries[0].level.aiModule = 'https://untrusted.invalid/actor.mjs';
  const altered = Buffer.from(JSON.stringify(source));
  const untrusted = await inspectPinnedRoomPackage(pinFor(altered), altered);
  assert.equal(untrusted.unavailable.code, 'NATIVE_VALIDATION_FAILED');
  for (const prefix of ['RLCNB1\r\n', 'RLTMC1\r\n']) {
    const media = Buffer.from(prefix + 'not executed or decoded');
    assert.equal(
      (await inspectPinnedRoomPackage(pinFor(media), media)).unavailable.code,
      'MEDIA_UNSUPPORTED',
    );
  }
});

test('a hash-pinned Company catalogue reports Solo capability without authorizing a room', async () => {
  const bytes = await readFile(new URL('../editions/catalog.json', import.meta.url));
  const catalog = JSON.parse(bytes);
  const pin = pinFor(bytes, { kind: 'company-catalog', editionId: catalog.editions[0].id });
  const result = await inspectPinnedRoomPackage(pin, bytes);
  assert.deepEqual(result.entries, []);
  assert.equal(result.unavailable.code, 'COMPANY_SOLO_ONLY');
  assert.deepEqual(result.unavailable.declaredModes, ['solo']);
});

test('filesystem admission refuses an external symlink and preserves a loaded immutable snapshot', async (t) => {
  const bytes = await classicBytes();
  const local = await localFixture(t, bytes);
  const accepted = await loadRoomContentRegistry(local.path);
  await writeFile(join(local.directory, local.pin.path), '{}');
  assert.equal(accepted.entries.length, 2);
  assert.equal(accepted.entries[0].content.source.sha256, digest(bytes));
  const outside = await mkdtemp(join(tmpdir(), 'revealline-room-external-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await writeFile(join(outside, 'payload.json'), bytes);
  await rm(join(local.directory, local.pin.path));
  await symlink(join(outside, 'payload.json'), join(local.directory, local.pin.path));
  const blocked = await loadRoomContentRegistry(local.path);
  assert.equal(blocked.entries.length, 0);
  assert.equal(blocked.report.unavailablePackages, 1);
  assert.equal(blocked.unavailable[0].code, 'LOCAL_FILE_UNAVAILABLE');
  assert.ok(!JSON.stringify(blocked).includes(outside));
});

test('HTTP admission serves exact registry recipes and rejects client-supplied levels or owners', async (t) => {
  const bytes = await classicBytes();
  const local = await localFixture(t, bytes);
  const server = await createRoomService({ catalogue: [], contentManifestPath: local.path });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(
    () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  );
  const base = `http://127.0.0.1:${server.address().port}`;
  const api = async (path, body, token) => {
    const response = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Origin: 'http://127.0.0.1:8779',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, value: await response.json() };
  };
  const catalog = (await api('/catalogue')).value;
  assert.equal(catalog.entries.length, 2);
  assert.equal(catalog.registry.admittedPackages, 1);
  assert.ok(!JSON.stringify(catalog).includes(local.directory));
  assert.ok(!Object.hasOwn(catalog.entries[0], 'level'));
  const selection = { id: catalog.entries[0].id, pace: 'slow', targets: 'moving', seed: 17 };
  assert.equal((await api('/rooms', { ...selection, recipe: { family: 'capture' } })).status, 400);
  assert.equal(
    (await api('/rooms', { ...selection, content: { source: { kind: 'builtin' } } })).status,
    400,
  );
  const created = await api('/rooms', selection);
  assert.equal(created.status, 201);
  const snapshot = (await api('/snapshot', undefined, created.value.token)).value;
  const admitted = await loadRoomContentRegistry(local.path);
  assert.deepEqual(
    snapshot.recipe.level,
    prepareClassicSnakeLevel(admitted.entries[0], { pace: 'slow', targetRules: 'moving' }),
  );
  assert.equal(snapshot.recipe.content.source.sha256, digest(bytes));
  assert.equal(snapshot.recipe.content.mission.revision, String(snapshot.recipe.level.revision));
  assert.equal(snapshot.contentHash, digest(canonicalJSON(snapshot.recipe)));
});
