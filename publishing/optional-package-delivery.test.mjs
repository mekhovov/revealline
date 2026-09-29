import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  deliverOptionalPackageDraft,
  sameOptionalDeliveryReceipt,
} from './optional-package-delivery.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
function fixture(hook = () => {}) {
  const repository = 'mekhovov/revealline';
  const envelope = {
    version: 'v1.2.3',
    sourceRevision: 'a'.repeat(40),
    sourceTree: 'b'.repeat(40),
  };
  const files = new Map([
    ['review-optional-fixture.txt', Buffer.from('Synthetic test only\n')],
    ['optional-packages.json', Buffer.from(JSON.stringify(envelope))],
  ]);
  const releases = new Map(),
    payloads = new Map(),
    calls = [],
    events = [];
  let tagId = 101,
    nextAssetId = 1000,
    tagRevision = envelope.sourceRevision;
  const release = (id) => ({
    id,
    draft: true,
    prerelease: false,
    tag_name: envelope.version,
    target_commitish: envelope.sourceRevision,
    upload_url: `https://uploads.github.com/repos/${repository}/releases/${id}/assets{?name,label}`,
    assets: [],
  });
  releases.set(101, release(101));
  releases.set(202, release(202));
  const put = (id, name, bytes) => {
    const pin = {
      id: nextAssetId++,
      name,
      size: bytes.length,
      state: 'uploaded',
      digest: `sha256:${hash(bytes)}`,
    };
    releases.get(id).assets.push(pin);
    payloads.set(pin.id, Buffer.from(bytes));
    return structuredClone(pin);
  };
  const context = {
    releases,
    payloads,
    files,
    calls,
    events,
    put,
    rotate: ({ remove = false } = {}) => {
      tagId = 202;
      if (remove) releases.delete(101);
    },
    moveTag: () => {
      tagRevision = 'c'.repeat(40);
    },
  };
  const event = async (type, detail = {}) => {
    calls.push({ type, ...detail });
    await hook(type, context, detail);
  };
  const input = {
    repository,
    releaseId: 101,
    envelope,
    files,
    envelopeBytes: files.get('optional-packages.json'),
    reviewBytes: Buffer.from('Synthetic review'),
    readRelease: async (id) => {
      await event('readRelease', { id });
      return structuredClone(releases.get(id));
    },
    readTagRelease: async () => {
      await event('readTagRelease');
      return structuredClone(releases.get(tagId));
    },
    readTagIdentity: async () => {
      await event('readTagIdentity');
      return { sourceRevision: tagRevision, sourceTree: envelope.sourceTree };
    },
    readAsset: async (id) => {
      await event('readAsset', { id });
      return Buffer.from(payloads.get(id));
    },
    uploadAsset: async (url, name, bytes) => {
      await event('uploadAttempt', { url, name });
      const parsed = new URL(url),
        match = /^\/repos\/mekhovov\/revealline\/releases\/(\d+)\/assets$/.exec(parsed.pathname);
      assert.equal(parsed.origin, 'https://uploads.github.com');
      assert.equal(parsed.searchParams.get('name'), name);
      assert(match);
      const id = Number(match[1]);
      if (!releases.has(id)) throw new Error('404: selected release disappeared');
      assert(!releases.get(id).assets.some((asset) => asset.name === name));
      const result = put(id, name, bytes);
      await event('serverStored', { id, name });
      return result;
    },
    record: async (row) => {
      events.push(row);
      await event('record', row);
    },
  };
  return { ...context, input, deliver: () => deliverOptionalPackageDraft(input) };
}
const posts = (f) => f.calls.filter((c) => c.type === 'uploadAttempt');

test('stable delivery pins destination, uploads envelope last and keeps unrelated assets', async () => {
  const f = fixture();
  const unrelated = f.put(101, 'manifest.json', Buffer.from('original core manifest'));
  const receipt = await f.deliver();
  assert.equal(receipt.releaseId, 101);
  assert.match(receipt.uploadEndpoint, /\/releases\/101\/assets$/);
  assert.equal(receipt.status, 'draft-assets-downloaded-and-verified');
  assert.equal(posts(f).length, 2);
  assert.equal(posts(f).at(-1).name, 'optional-packages.json');
  assert(receipt.assets.every((a) => a.status === 'UPLOADED_VERIFIED'));
  assert.deepEqual(f.releases.get(101).assets[0], unrelated);
  assert.equal(f.releases.get(202).assets.length, 0);
  assert.deepEqual(
    f.events.map((e) => e.status),
    ['POST_STARTED', 'UPLOADED_VERIFIED', 'POST_STARTED', 'UPLOADED_VERIFIED'],
  );
});

test('matching originals are verified without another POST', async () => {
  const f = fixture();
  for (const [name, bytes] of f.files) f.put(101, name, bytes);
  const receipt = await f.deliver();
  assert(receipt.assets.every((a) => a.status === 'EXISTING_VERIFIED'));
  assert.equal(posts(f).length, 0);
});

test('other-envelope originals exceeding the combined budget prevent every optional POST', async () => {
  const f = fixture();
  f.releases.get(101).assets.push({
    id: 555,
    name: 'source-coupa.zip',
    size: 950_000_000,
    state: 'uploaded',
    digest: `sha256:${'a'.repeat(64)}`,
  });
  await assert.rejects(f.deliver(), /exceed byte budget/);
  assert.equal(posts(f).length, 0);
  assert.equal(f.calls.filter((row) => row.type === 'readAsset').length, 0);
  assert.equal(f.events.length, 0);
});

test('shared evidence already present in an edition counts once and is still downloaded', async () => {
  const f = fixture();
  const [name, bytes] = [...f.files][0];
  f.put(101, name, bytes);
  const total = [...f.files.values()].reduce((n, b) => n + b.length, 0);
  f.releases.get(101).assets.push({
    id: 555,
    name: 'source-coupa.zip',
    size: 950_000_000 - total,
    state: 'uploaded',
    digest: `sha256:${'a'.repeat(64)}`,
  });
  const receipt = await f.deliver();
  assert.equal(posts(f).length, 1);
  assert.equal(receipt.assets[0].status, 'EXISTING_VERIFIED');
  assert(f.calls.some((row) => row.type === 'readAsset'));
});

test('every conflicting original is rejected before any upload', async () => {
  const f = fixture();
  f.put(101, 'optional-packages.json', Buffer.from('wrong bytes'));
  await assert.rejects(f.deliver(), /overwrite is forbidden/);
  assert.equal(posts(f).length, 0);
});

test('downloaded original mismatch is rejected before any upload', async () => {
  const f = fixture();
  const pin = f.put(101, 'optional-packages.json', f.files.get('optional-packages.json'));
  f.payloads.set(pin.id, Buffer.from('tampered'));
  await assert.rejects(f.deliver(), /Downloaded optional artifact differs/);
  assert.equal(posts(f).length, 0);
});

for (const mode of [
  'missing-id',
  'wrong-id',
  'foreign-repository',
  'published',
  'prerelease',
  'wrong-target',
  'foreign-endpoint',
  'duplicate-name',
  'duplicate-id',
  'missing-digest',
])
  test(`preflight rejects ${mode} with zero POSTs`, async () => {
    const f = fixture(),
      row = f.releases.get(101);
    if (mode === 'missing-id') delete f.input.releaseId;
    if (mode === 'wrong-id') f.input.releaseId = 202;
    if (mode === 'foreign-repository') f.input.repository = 'other/repository';
    if (mode === 'published') row.draft = false;
    if (mode === 'prerelease') row.prerelease = true;
    if (mode === 'wrong-target') row.target_commitish = 'main';
    if (mode === 'foreign-endpoint') row.upload_url = 'https://example.invalid/upload';
    if (mode === 'duplicate-name' || mode === 'duplicate-id' || mode === 'missing-digest') {
      f.put(101, 'manifest.json', Buffer.from('retained'));
      if (mode === 'duplicate-name') row.assets.push({ ...row.assets[0] });
      else if (mode === 'duplicate-id') row.assets.push({ ...row.assets[0], name: 'other.json' });
      else delete row.assets[0].digest;
    }
    await assert.rejects(f.deliver());
    assert.equal(posts(f).length, 0);
  });

test('replacement before the first POST fails the explicit draft ID guard', async () => {
  let count = 0;
  const f = fixture((type, state) => {
    if (type === 'readTagRelease' && ++count === 2) state.rotate();
  });
  await assert.rejects(f.deliver(), /identity changed/);
  assert.equal(posts(f).length, 0);
});

test('replacement between check and upload cannot redirect the ID-specific POST', async () => {
  const f = fixture((type, state, detail) => {
    if (type === 'record' && detail.status === 'POST_STARTED') state.rotate({ remove: true });
  });
  await assert.rejects(f.deliver(), /requires reconciliation/);
  assert.equal(posts(f).length, 1);
  assert.match(posts(f)[0].url, /\/releases\/101\/assets\?/);
  assert.equal(f.releases.get(202).assets.length, 0);
  assert.equal(f.events.at(-1).status, 'OUTCOME_REQUIRES_RECONCILIATION');
});

test('replacement between files cannot receive the next asset', async () => {
  const f = fixture((type, state, detail) => {
    if (type === 'record' && detail.status === 'UPLOADED_VERIFIED') state.rotate();
  });
  await assert.rejects(f.deliver(), /identity changed/);
  assert.equal(posts(f).length, 1);
  assert.equal(f.releases.get(202).assets.length, 0);
});

test('replacement before final receipt prevents success', async () => {
  const f = fixture((type, state, detail) => {
    if (
      type === 'record' &&
      detail.status === 'UPLOADED_VERIFIED' &&
      detail.name === 'optional-packages.json'
    )
      state.rotate();
  });
  await assert.rejects(f.deliver(), /identity changed/);
  assert.equal(posts(f).length, 2);
  assert.equal(f.releases.get(202).assets.length, 0);
});

for (const mode of ['publication', 'tag-movement', 'foreign-asset'])
  test(`${mode} between assets stops the remaining delivery`, async () => {
    const f = fixture((type, state, detail) => {
      if (type === 'record' && detail.status === 'UPLOADED_VERIFIED') {
        if (mode === 'publication') state.releases.get(101).draft = false;
        if (mode === 'tag-movement') state.moveTag();
        if (mode === 'foreign-asset') state.put(101, 'concurrent.txt', Buffer.from('concurrent'));
      }
    });
    await assert.rejects(f.deliver());
    assert.equal(posts(f).length, 1);
  });

test('ambiguous upload failure records unresolved outcome and never retries', async () => {
  const f = fixture((type) => {
    if (type === 'serverStored') throw new Error('connection lost after server accepted bytes');
  });
  await assert.rejects(f.deliver(), /requires reconciliation/);
  assert.equal(posts(f).length, 1);
  assert.equal(f.releases.get(101).assets.length, 1);
  assert.deepEqual(
    f.events.map((e) => e.status),
    ['POST_STARTED', 'OUTCOME_REQUIRES_RECONCILIATION'],
  );
});

test('attempt journal failure stops before sending a POST', async () => {
  const f = fixture((type, state, detail) => {
    if (type === 'record' && detail.status === 'POST_STARTED')
      throw new Error('journal unavailable');
  });
  await assert.rejects(f.deliver(), /journal unavailable/);
  assert.equal(posts(f).length, 0);
});

test('reconciliation keeps all original receipt pins while allowing only the verified status distinction', async () => {
  const f = fixture();
  const original = await f.deliver();
  const reconciled = await f.deliver();
  assert.equal(posts(f).length, 2);
  assert(sameOptionalDeliveryReceipt(original, reconciled));
  for (const key of ['releaseId', 'sourceRevision', 'uploadEndpoint', 'reviewSha256']) {
    const changed = structuredClone(reconciled);
    changed[key] = 'changed';
    assert.equal(sameOptionalDeliveryReceipt(original, changed), false);
  }
  const changed = structuredClone(reconciled);
  changed.assets[0].id++;
  assert.equal(sameOptionalDeliveryReceipt(original, changed), false);
  changed.assets[0].status = 'OUTCOME_REQUIRES_RECONCILIATION';
  assert.throws(() => sameOptionalDeliveryReceipt(original, changed), /unresolved asset/);
});
