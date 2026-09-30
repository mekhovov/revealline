import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  ACTOR_CONTINUATION_FORMAT,
  ACTOR_EFFECTS20_REVIEW_PATH,
  ACTOR_EFFECTS20_REVIEW_SHA256,
  readActorPresentationContinuation,
} from './actor-presentation-continuation.mjs';
import {
  BULK_PRESENTATION_REVIEW_PATH,
  BULK_PRESENTATION_REVIEW_SHA256,
} from './bulk-presentation-continuation.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (value) => Buffer.from(JSON.stringify(value));
const groups = ['motion', 'effects', 'team', 'equipment'];
const predecessor = {
  path: BULK_PRESENTATION_REVIEW_PATH,
  sha256: BULK_PRESENTATION_REVIEW_SHA256,
};
const root = new URL('../', import.meta.url);
const currentPredecessor = {
  path: ACTOR_EFFECTS20_REVIEW_PATH,
  sha256: ACTOR_EFFECTS20_REVIEW_SHA256,
};
// The older actor branch lacks five newer main records. Retain exact bytes in a
// test-only fixture, without adding or changing canonical approval documents.
const mainFixtures = JSON.parse(
  await readFile(new URL('./fixtures/actor-effects20-predecessors.json', import.meta.url)),
);
assert.equal(mainFixtures.format, 'revealline.test-only-actor-effects20-predecessors.v1');
assert.equal(mainFixtures.source, '64c8b9d81604984363666abadae236d9f2f76f7f');
assert.equal(mainFixtures.records.length, 5);
const retainedMainBytes = new Map(
  mainFixtures.records.map(({ path, bytes, sha256, text }) => {
    const body = Buffer.from(text);
    assert.equal(body.length, bytes, path);
    assert.equal(hash(body), sha256, path);
    return [path, body];
  }),
);
const ancestors = new Map();
async function loadAncestor(ref, records = ancestors) {
  if (records.has(ref.path)) return;
  let bytes;
  try {
    bytes = await readFile(new URL(ref.path, root));
  } catch (error) {
    if (error.code !== 'ENOENT' || !retainedMainBytes.has(ref.path)) throw error;
    bytes = retainedMainBytes.get(ref.path);
  }
  assert.equal(hash(bytes), ref.sha256, `immutable fixture ${ref.path}`);
  records.set(ref.path, bytes);
  const value = JSON.parse(bytes);
  for (const child of [
    value.priorReview,
    value.priorEquipmentReview,
    ...Object.values(value.priorReviews ?? {}),
  ].filter(Boolean))
    await loadAncestor(child, records);
}
await loadAncestor(predecessor);
const bulk = JSON.parse(ancestors.get(predecessor.path));
const currentAncestors = new Map(ancestors);
await loadAncestor(currentPredecessor, currentAncestors);
const effects20 = JSON.parse(currentAncestors.get(currentPredecessor.path));

// Synthetic review/source fixtures exercise validation plumbing only. These pins
// are test-owned authority and cannot approve any current production source/art.
function fixture({ current = false } = {}) {
  const files = new Map(current ? currentAncestors : ancestors),
    payloads = new Map(),
    fingerprints = {};
  for (const group of groups) {
    const inputs = [Buffer.from('ab'), Buffer.from('c')].map((bytes, index) => {
      const path = `test-only/${group}-${index}.mjs`;
      files.set(path, bytes);
      return { path, bytes: bytes.length, sha256: hash(bytes) };
    });
    const slots = [...bulk.fingerprints[group].slots];
    const values = {};
    for (const slot of slots) {
      // Deliberately alphabetical keys make this independent fixture canonical.
      const payload = {
        defaultAsset: { id: slot, revision: 1 },
        inheritedImages: [],
        recipe: { id: slot },
      };
      payloads.set(slot, payload);
      values[slot] = hash(json(payload));
    }
    fingerprints[group] = {
      group,
      priorSHA256: (current && group === 'effects' ? effects20 : bulk).fingerprints[group]
        .currentSHA256,
      currentSHA256: hash(Buffer.from('abc')),
      paths: inputs.map((v) => v.path).join('; '),
      inputs,
      slots,
      payloads: values,
    };
  }
  const record = {
    format: ACTOR_CONTINUATION_FORMAT,
    status: 'reviewed',
    priorReview: { ...(current ? currentPredecessor : predecessor) },
    fingerprints,
  };
  const pin = { path: 'docs/verification/test-only-actor-continuation/review.json', sha256: '' };
  const reads = [];
  const read = async (path) => {
    reads.push(path);
    if (!files.has(path)) throw new Error(`Missing fixture: ${path}`);
    return Buffer.from(files.get(path));
  };
  const seal = () => {
    const bytes = json(record);
    pin.sha256 = hash(bytes);
    files.set(pin.path, bytes);
  };
  const input = (group = 'team', slotId = fingerprints[group].slots[0]) => ({
    group,
    slotId,
    payload: payloads.get(slotId),
    source:
      group === 'equipment'
        ? fingerprints[group].currentSHA256
        : `${fingerprints[group].paths} sha256:${fingerprints[group].currentSHA256}`,
  });
  seal();
  return {
    files,
    payloads,
    record,
    pin,
    read,
    reads,
    seal,
    input,
    load: () => readActorPresentationContinuation({ read, reviewedRecord: pin }),
  };
}

test('synthetic successor authenticates the actual immutable nine-record chain and exactly 59 slots', async () => {
  const f = fixture(),
    handle = await f.load();
  assert.equal(ancestors.size, 9);
  assert.equal(
    groups.reduce((n, group) => n + bulk.fingerprints[group].slots.length, 0),
    59,
  );
  for (const path of ancestors.keys())
    assert.equal(f.reads.filter((read) => read === path).length, 1, path);
  for (const group of groups)
    for (const slot of bulk.fingerprints[group].slots)
      assert.equal(handle.matches(f.input(group, slot)), true, slot);
  assert(Object.isFrozen(handle));
  assert(Object.isFrozen(handle.record));
  assert.deepEqual(Object.keys(handle).sort(), ['matches', 'record']);
  assert.equal(handle.quality, undefined);
});

test('bounded one-group and multi-group records grant matching only within their declared subset', async () => {
  for (const selected of [['motion'], ['effects', 'team']]) {
    const f = fixture(),
      inputs = Object.fromEntries(groups.map((group) => [group, f.input(group)]));
    for (const group of groups) if (!selected.includes(group)) delete f.record.fingerprints[group];
    f.seal();
    const handle = await f.load();
    for (const group of groups) {
      assert.equal(handle.matches(inputs[group]), selected.includes(group), group);
      assert.equal(
        f.reads.some((path) => path.startsWith(`test-only/${group}-`)),
        selected.includes(group),
        group,
      );
    }
  }
});

test('current effects20 root authenticates exactly17 immutable records while other groups retain their bulk predecessor', async () => {
  const f = fixture({ current: true }),
    handle = await f.load();
  assert.equal(currentAncestors.size, 17);
  assert.equal(ancestors.size, 9, 'historical fixtures and reader behavior stay separate');
  assert.equal(
    f.record.fingerprints.effects.priorSHA256,
    'b7aa3a6b9bc2302df0309e90acddf899766a9b9406f93bd266a94b685940a5eb',
  );
  assert.notEqual(
    f.record.fingerprints.effects.priorSHA256,
    bulk.fingerprints.effects.currentSHA256,
  );
  for (const group of groups) {
    if (group !== 'effects')
      assert.equal(
        f.record.fingerprints[group].priorSHA256,
        bulk.fingerprints[group].currentSHA256,
      );
    for (const slot of bulk.fingerprints[group].slots)
      assert.equal(handle.matches(f.input(group, slot)), true, slot);
  }
  for (const path of currentAncestors.keys())
    assert.equal(f.reads.filter((read) => read === path).length, 1, path);
  assert.equal(handle.matches({ ...f.input('effects'), group: 'audio' }), false);
  assert.deepEqual(Object.keys(handle).sort(), ['matches', 'record']);
  assert.equal(handle.quality, undefined, 'synthetic matching grants no production quality');
});

test('current-root subsets retain exact per-group ownership and never admit its audio recipes', async () => {
  for (const selected of [['effects'], ['effects', 'team'], ['motion'], ['team', 'equipment']]) {
    const f = fixture({ current: true }),
      inputs = Object.fromEntries(groups.map((group) => [group, f.input(group)]));
    for (const group of groups) if (!selected.includes(group)) delete f.record.fingerprints[group];
    f.seal();
    const handle = await f.load();
    for (const group of groups) {
      assert.equal(handle.matches(inputs[group]), selected.includes(group), group);
      assert.equal(
        f.reads.some((path) => path.startsWith(`test-only/${group}-`)),
        selected.includes(group),
      );
    }
    assert.equal(
      handle.matches({ ...inputs.effects, group: 'audio', slotId: 'audio.failure' }),
      false,
    );
  }
  const f = fixture({ current: true });
  f.record.fingerprints.audio = { ...f.record.fingerprints.effects, group: 'audio' };
  f.seal();
  await assert.rejects(f.load(), /invalid renderer groups/);
});

test('current predecessor cannot be fabricated, reached through the old pin or assigned to another subset group', async () => {
  for (const change of [
    (f) => {
      f.record.priorReview = { ...predecessor };
    },
    (f) => {
      f.record.fingerprints.effects.priorSHA256 = bulk.fingerprints.effects.currentSHA256;
    },
    (f) => {
      f.record.fingerprints.team.priorSHA256 = effects20.fingerprints.effects.currentSHA256;
    },
    (f) => {
      f.record.fingerprints.team.slots = [...f.record.fingerprints.effects.slots];
    },
  ]) {
    const f = fixture({ current: true });
    delete f.record.fingerprints.motion;
    delete f.record.fingerprints.equipment;
    change(f);
    f.seal();
    await assert.rejects(f.load(), /wrong group|slot membership/);
  }
  for (const change of [
    (ref) => {
      ref.path = 'docs/verification/test-only-fabricated-current/review.json';
    },
    (ref) => {
      ref.sha256 = '0'.repeat(64);
    },
  ]) {
    const f = fixture({ current: true });
    change(f.record.priorReview);
    f.files.set(f.record.priorReview.path, currentAncestors.get(currentPredecessor.path));
    f.seal();
    await assert.rejects(f.load(), /wrong immutable predecessor/);
    assert.deepEqual(f.reads, [f.pin.path], 'unknown roots are rejected before ancestry reads');
  }
});

test('every current-root ancestor remains required and exact, including records outside the effects group', async () => {
  for (const path of currentAncestors.keys()) {
    const f = fixture({ current: true });
    f.files.set(path, Buffer.concat([f.files.get(path), Buffer.from('\n')]));
    await assert.rejects(f.load(), /ancestor bytes changed/, path);
    f.files.delete(path);
    await assert.rejects(f.load(), /Missing fixture/, path);
  }
});

test('an eighteenth ancestor or a conflicting duplicate cannot extend the exactly pinned current graph', async () => {
  const extraPath = 'docs/verification/test-only-eighteenth/review.json';
  for (const extra of [
    { path: extraPath, sha256: hash(json({ priorReviews: {} })) },
    { path: predecessor.path, sha256: '0'.repeat(64) },
  ]) {
    const f = fixture({ current: true }),
      forgedRoot = JSON.parse(f.files.get(currentPredecessor.path));
    forgedRoot.priorReviews.extra = extra;
    f.files.set(currentPredecessor.path, json(forgedRoot));
    f.files.set(extraPath, json({ priorReviews: {} }));
    // Re-sealing the caller-owned successor cannot re-sign an immutable root.
    f.seal();
    await assert.rejects(f.load(), /ancestor bytes changed/);
    assert.equal(f.reads.includes(extraPath), false);
    assert.deepEqual(f.reads, [f.pin.path, currentPredecessor.path]);
  }
});

test('absence of caller-owned authority cannot be replaced by a bundle or a self-declared reviewed record', async () => {
  const f = fixture();
  await assert.rejects(readActorPresentationContinuation({ read: f.read }), /plain record/);
  await assert.rejects(
    readActorPresentationContinuation({ read: f.read, record: f.record }),
    /plain record/,
  );
  await assert.rejects(
    readActorPresentationContinuation({ read: f.read, reviewedRecord: f.record }),
    /record fields/,
  );
  assert.equal(f.reads.length, 0);
});

test('exact reviewed bytes and captured code pin are required, including during asynchronous reads', async () => {
  const f = fixture();
  f.files.set(f.pin.path, Buffer.concat([f.files.get(f.pin.path), Buffer.from('\n')]));
  await assert.rejects(f.load(), /reviewed record bytes changed/);
  f.seal();
  const before = { ...f.pin };
  const handle = await readActorPresentationContinuation({
    reviewedRecord: f.pin,
    read: async (path) => {
      f.pin.path = 'docs/verification/different/review.json';
      f.pin.sha256 = '0'.repeat(64);
      return f.read(path);
    },
  });
  assert.deepEqual(handle.record, before);
});

for (const [name, change, expected] of [
  [
    'draft with a matching synthetic pin',
    (r) => {
      r.status = 'draft';
    },
    /not reviewed/,
  ],
  [
    'unsupported format',
    (r) => {
      r.format += '.future';
    },
    /not reviewed/,
  ],
  [
    'wrong predecessor path',
    (r) => {
      r.priorReview.path = 'docs/verification/other.json';
    },
    /wrong immutable predecessor/,
  ],
  [
    'wrong predecessor hash',
    (r) => {
      r.priorReview.sha256 = '0'.repeat(64);
    },
    /wrong immutable predecessor/,
  ],
  [
    'wrong group',
    (r) => {
      r.fingerprints.team.group = 'motion';
    },
    /wrong group/,
  ],
  [
    'wrong prior fingerprint',
    (r) => {
      r.fingerprints.team.priorSHA256 = '0'.repeat(64);
    },
    /wrong group/,
  ],
  [
    'unknown group',
    (r) => {
      r.fingerprints.audio = r.fingerprints.team;
    },
    /invalid renderer groups/,
  ],
  [
    'empty group selection',
    (r) => {
      r.fingerprints = {};
    },
    /invalid renderer groups/,
  ],
  [
    'unknown slot',
    (r) => {
      r.fingerprints.team.slots.push('team.unknown');
    },
    /slot membership/,
  ],
  [
    'reordered slots',
    (r) => {
      r.fingerprints.team.slots.reverse();
    },
    /slot membership/,
  ],
  [
    'missing payload',
    (r) => {
      delete r.fingerprints.team.payloads[r.fingerprints.team.slots[0]];
    },
    /record fields/,
  ],
  [
    'cross-group payload',
    (r) => {
      r.fingerprints.team.payloads['effect.capture'] = '0'.repeat(64);
    },
    /record fields/,
  ],
  [
    'reordered sources',
    (r) => {
      r.fingerprints.team.inputs.reverse();
    },
    /source order/,
  ],
  [
    'duplicate source',
    (r) => {
      r.fingerprints.team.inputs[1] = { ...r.fingerprints.team.inputs[0] };
    },
    /source order/,
  ],
  [
    'unsafe source path',
    (r) => {
      r.fingerprints.team.inputs[0].path = '../escape.mjs';
    },
    /invalid source input/,
  ],
  [
    'wrong byte count',
    (r) => {
      r.fingerprints.team.inputs[0].bytes++;
    },
    /source bytes changed/,
  ],
  [
    'wrong per-file hash',
    (r) => {
      r.fingerprints.team.inputs[0].sha256 = '0'.repeat(64);
    },
    /source bytes changed/,
  ],
  [
    'wrong aggregate hash',
    (r) => {
      r.fingerprints.team.currentSHA256 = '0'.repeat(64);
    },
    /source fingerprint changed/,
  ],
])
  test(`fails closed for ${name}`, async () => {
    const f = fixture();
    change(f.record);
    f.seal();
    await assert.rejects(f.load(), expected);
  });

test('every actual immutable ancestor must remain present and byte exact, including nested audio history', async () => {
  for (const path of ancestors.keys()) {
    const f = fixture();
    f.files.set(path, Buffer.concat([f.files.get(path), Buffer.from('\n')]));
    await assert.rejects(f.load(), /ancestor bytes changed/, path);
    f.files.delete(path);
    await assert.rejects(f.load(), /Missing fixture/, path);
  }
});

test('per-file boundaries fail even when changed source bytes retain the same aggregate hash', async () => {
  const f = fixture(),
    inputs = f.record.fingerprints.team.inputs;
  f.files.set(inputs[0].path, Buffer.from('a'));
  f.files.set(inputs[1].path, Buffer.from('bc'));
  assert.equal(
    hash(Buffer.concat(inputs.map((input) => f.files.get(input.path)))),
    f.record.fingerprints.team.currentSHA256,
  );
  await assert.rejects(f.load(), /source bytes changed/);
  f.files.delete(inputs[0].path);
  await assert.rejects(f.load(), /Missing fixture/);
});

test('a shared helper is read once and inconsistent declarations fail even with an unstable reader', async () => {
  const f = fixture(),
    motion = f.record.fingerprints.motion,
    team = f.record.fingerprints.team;
  team.inputs[0] = { ...motion.inputs[0] };
  team.paths = team.inputs.map((v) => v.path).join('; ');
  f.seal();
  const handle = await f.load();
  assert.equal(handle.matches(f.input()), true);
  assert.equal(f.reads.filter((path) => path === motion.inputs[0].path).length, 1);
  team.inputs[0].sha256 = hash(Buffer.from('xy'));
  team.currentSHA256 = hash(Buffer.from('xyc'));
  f.seal();
  let reads = 0;
  await assert.rejects(
    readActorPresentationContinuation({
      reviewedRecord: f.pin,
      read: async (path) => {
        if (path === motion.inputs[0].path) return Buffer.from(++reads === 1 ? 'ab' : 'xy');
        return f.read(path);
      },
    }),
    /source bytes changed/,
  );
  assert.equal(reads, 1);
});

test('matcher refuses other groups, slots, source orders and any altered recipe/default/inherited payload', async () => {
  const f = fixture(),
    handle = await f.load(),
    input = f.input();
  assert.equal(
    handle.matches({
      ...input,
      payload: {
        recipe: input.payload.recipe,
        inheritedImages: [],
        defaultAsset: { revision: 1, id: input.slotId },
      },
    }),
    true,
  );
  for (const change of [
    { group: 'audio' },
    { group: 'effects' },
    { slotId: 'team.unknown' },
    {
      source: `${f.record.fingerprints.team.inputs
        .map((v) => v.path)
        .reverse()
        .join('; ')} sha256:${f.record.fingerprints.team.currentSHA256}`,
    },
    { payload: { ...input.payload, recipe: { id: 'other' } } },
    { payload: { ...input.payload, defaultAsset: { id: input.slotId, revision: 2 } } },
    { payload: { ...input.payload, inheritedImages: [{ sha256: '0'.repeat(64) }] } },
  ])
    assert.equal(handle.matches({ ...input, ...change }), false);
  assert.equal(handle.matches(f.input('equipment')), true);
  assert.equal(handle.matches({ ...f.input('equipment'), source: input.source }), false);
});

test('malformed or non-JSON payloads cannot match and payload accessors are not executed', async () => {
  const f = fixture(),
    handle = await f.load(),
    input = f.input();
  let calls = 0;
  const accessor = { ...input.payload };
  Object.defineProperty(accessor, 'recipe', {
    enumerable: true,
    get() {
      calls++;
      return input.payload.recipe;
    },
  });
  const sparse = new Array(1);
  sparse.extra = 1;
  const cycle = {};
  cycle.self = cycle;
  const hidden = { ...input.payload };
  Object.defineProperty(hidden, 'hidden', { value: true });
  const symbol = { ...input.payload, [Symbol('hidden')]: true };
  for (const payload of [
    undefined,
    () => 1,
    NaN,
    Infinity,
    new Date(),
    accessor,
    sparse,
    cycle,
    hidden,
    symbol,
  ])
    assert.equal(handle.matches({ ...input, payload }), false);
  for (const value of [null, undefined, [], true]) assert.equal(handle.matches(value), false);
  assert.equal(calls, 0);
});
