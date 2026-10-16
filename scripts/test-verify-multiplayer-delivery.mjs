import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  multiplayerDeliveryFiles,
  verifyMultiplayerDelivery,
} from './verify-multiplayer-delivery.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
function fixture() {
  const payload = Buffer.from('fixture media bytes; no image-decoding claim');
  const files = ['game/original.png', 'game/alias.png'].map((name) => ({
    path: name,
    bytes: payload.length,
    sha256: hash(payload),
    kind: 'gameplay',
  }));
  const catalogue = {
    format: 'revealline-offline-content.v2',
    version: '1.0.0',
    files,
    groups: [
      { id: 'shared', kind: 'gameplay', files: ['game/alias.png'], requires: [] },
      { id: 'chapter', kind: 'gameplay', files: ['game/original.png'], requires: ['shared'] },
    ],
    missions: [
      {
        id: 'row',
        missionId: 'mission',
        routeId: 'route',
        modes: ['team'],
        current: true,
        groups: ['chapter'],
      },
    ],
    destinations: [{ mode: 'team', routeId: 'route', groups: ['chapter'] }],
  };
  const expectations = [
    {
      mode: 'team',
      routeId: 'route',
      chapters: 1,
      missions: [{ id: 'mission', picture: 'game/original.png', sha256: hash(payload) }],
    },
  ];
  const bodies = new Map(files.map((file) => [file.path, payload]));
  const manifest = { formatVersion: 1, version: '1.0.0', sourceRevision: 'a'.repeat(40), files };
  function bind() {
    const bytes = Buffer.from(JSON.stringify(catalogue));
    manifest.files = [
      ...files,
      { path: 'offline-content.json', bytes: bytes.length, sha256: hash(bytes) },
    ];
    bodies.set('offline-content.json', bytes);
    bodies.set('manifest.json', Buffer.from(JSON.stringify(manifest)));
  }
  bind();
  return {
    catalogue,
    manifest,
    expectations,
    bodies,
    bind,
    read: async (name) => {
      assert(bodies.has(name), `Missing response ${name}`);
      return bodies.get(name);
    },
  };
}

test('delivery verifies every required URL even when byte identities are shared', async () => {
  const f = fixture(),
    reads = [];
  const result = await verifyMultiplayerDelivery({
    expectations: f.expectations,
    read: (name) => {
      reads.push(name);
      return f.read(name);
    },
  });
  assert.equal(result.passed, true);
  assert.deepEqual(
    result.files.map((file) => file.path),
    ['game/alias.png', 'game/original.png'],
  );
  assert(reads.includes('game/alias.png'));
  assert.equal(result.inventory[0].missions, 1);
});

test('an exact dependency closure cannot omit or substitute the authored original', () => {
  const f = fixture();
  f.catalogue.groups[1].files = [];
  assert.throws(
    () => multiplayerDeliveryFiles(f.manifest, f.catalogue, f.expectations),
    /includes its original/,
  );
  f.catalogue.groups[1].files = ['game/original.png'];
  f.expectations[0].missions[0].sha256 = 'b'.repeat(64);
  assert.throws(
    () => multiplayerDeliveryFiles(f.manifest, f.catalogue, f.expectations),
    /authored original bytes/,
  );
});

test('duplicate missions and wrong-mode destinations cannot inflate accepted counts', () => {
  const f = fixture();
  f.catalogue.missions.push(structuredClone(f.catalogue.missions[0]));
  assert.throws(
    () => multiplayerDeliveryFiles(f.manifest, f.catalogue, f.expectations),
    /Exact mission inventory/,
  );
  f.catalogue.missions.pop();
  f.catalogue.destinations[0].mode = 'versus';
  assert.throws(
    () => multiplayerDeliveryFiles(f.manifest, f.catalogue, f.expectations),
    /owned offline destination/,
  );
});

test('missing and corrupt public bytes are retained as failed evidence', async () => {
  const f = fixture();
  f.bodies.delete('game/alias.png');
  f.bodies.set('game/original.png', Buffer.from('bad'));
  const result = await verifyMultiplayerDelivery(f);
  assert.equal(result.passed, false);
  assert.equal(result.failures.length, 2);
  assert(result.failures.every((row) => row.error));
  assert.equal(result.verifiedBytes, 0);
});

test('an offline destination must own the entire mission dependency closure', () => {
  const f = fixture();
  f.catalogue.groups[1].requires = [];
  f.catalogue.missions[0].groups.push('shared');
  f.expectations[0].chapters = null;
  assert.throws(
    () => multiplayerDeliveryFiles(f.manifest, f.catalogue, f.expectations),
    /owned offline destination/,
  );
  // A transitive owner may include all required groups without listing each root.
  f.catalogue.groups.push({
    id: 'whole',
    kind: 'gameplay',
    files: [],
    requires: ['chapter', 'shared'],
  });
  f.catalogue.destinations[0].groups = ['whole'];
  assert.equal(multiplayerDeliveryFiles(f.manifest, f.catalogue, f.expectations).files.length, 2);
});

test('catalogue substitution fails before transferring unbound dependencies', async () => {
  const f = fixture();
  f.bodies.set('offline-content.json', Buffer.from('{}'));
  await assert.rejects(verifyMultiplayerDelivery(f), /Expected values to be strictly equal/);
});

test('a rolling deployment change cannot be reported as one stable artifact', async () => {
  const f = fixture();
  let manifests = 0;
  const result = await verifyMultiplayerDelivery({
    expectations: f.expectations,
    read: async (name) => {
      if (name === 'manifest.json' && ++manifests > 1)
        return Buffer.from(JSON.stringify({ ...f.manifest, sourceRevision: 'b'.repeat(40) }));
      return f.read(name);
    },
  });
  assert.equal(result.sourceStable, false);
  assert.equal(result.passed, false);
  assert.equal(
    result.failures.length,
    0,
    'Byte success does not erase the changing-source boundary',
  );
});
