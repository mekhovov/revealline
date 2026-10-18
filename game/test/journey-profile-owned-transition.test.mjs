import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import {
  applyJourneyEvent,
  emptyJourneyProfile,
  validateJourneyProfile,
  JOURNEY_PROFILE_DATABASE,
  JOURNEY_BACKUP_VERSION,
} from '../journey/profile.mjs';

const root = pathToFileURL(`${process.cwd()}/`);
let serial = 0;
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
async function observedModule() {
  const source = await readFile(
    process.env.REQUIRED_EVENT_SOURCE || new URL('../journey/profile.mjs', import.meta.url),
    'utf8',
  );
  const trackerURL = `data:text/javascript;base64,${Buffer.from(`export const counts={validations:0,inputs:[]};export const id=${++serial};export const freeze=${freeze.toString()};`).toString('base64')}`;
  const tracker = await import(trackerURL);
  const modified = source
    .replace('export function validateJourneyProfile(', 'function actualValidateJourneyProfile(')
    .replace('function applyStateEvent(', 'function actualApplyStateEvent(')
    .replace(
      /from (['"])(\.\.?\/[^'"]+)\1/g,
      (_, q, path) =>
        `from ${JSON.stringify(new URL(path, new URL('game/journey/profile.mjs', root)).href)}`,
    );
  const module = await import(
    `data:text/javascript;base64,${Buffer.from(
      `import {counts,freeze} from ${JSON.stringify(trackerURL)};\n${modified}
export function validateJourneyProfile(...args){counts.validations++;return actualValidateJourneyProfile(...args);}
function applyStateEvent(state,...args){const before=JSON.stringify(state.profile);freeze(state.profile);try{return actualApplyStateEvent(state,...args);}finally{counts.inputs.push({before,after:JSON.stringify(state.profile)});}}
`,
    ).toString('base64')}`
  );
  return { ...module, counts: tracker.counts };
}
async function seeded(model, profile) {
  const request = model.indexedDB.open(JOURNEY_PROFILE_DATABASE, 1);
  request.onupgradeneeded = () => request.result.createObjectStore('profiles');
  const db = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const tx = db.transaction('profiles', 'readwrite');
  tx.objectStore('profiles').put(profile, 'journey');
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
  });
  db.close();
}
const complete = (mode, missionId, runId = 'r') => ({
  type: 'complete',
  mode,
  missionId,
  runId,
  gameplayId: 'execution',
  difficulty: 'standard',
});

test('private backend transitions match public bytes for every mode/event, including idempotency and restore', async () => {
  const m = await observedModule(),
    model = managedIndexedDB(),
    backend = m.createJourneyBackend(model);
  let expected = emptyJourneyProfile();
  const events = [];
  for (const mode of ['solo', 'team', 'versus']) {
    events.push(
      { type: 'select', mode, missionId: 'a' },
      { type: 'skip', mode, missionId: 'a' },
      { type: 'skip', mode, missionId: 'a' },
      complete(mode, 'a'),
      complete(mode, 'a'),
      complete(mode, 'a', 'new'),
      complete(mode, 'another'),
    );
  }
  const restored = applyJourneyEvent(emptyJourneyProfile(), complete('solo', 'restored'));
  events.push({ type: 'restore', backup: { format: JOURNEY_BACKUP_VERSION, profile: restored } });
  for (const event of events) {
    expected = applyJourneyEvent(expected, event);
    const actual = await backend.commit([event]);
    assert.equal(JSON.stringify(actual), JSON.stringify(expected));
  }
  assert(m.counts.inputs.length > events.length - 1);
  assert(
    m.counts.inputs.every(({ before, after }) => before === after),
    'no prior validated profile or receipt was mutated',
  );
});

test('required store record and backend commit each avoid only the redundant input validation', async () => {
  const m = await observedModule(),
    model = managedIndexedDB(),
    backend = m.createJourneyBackend(model);
  const store = m.createJourneyProfileStore({ backend });
  await store.load();
  m.counts.validations = 0;
  store.record({ type: 'select', mode: 'solo', missionId: 'one' });
  assert.equal(
    m.counts.validations,
    1,
    'immediate private transition still performs full output validation',
  );
  await store.flush();
  m.counts.validations = 0;
  await backend.commit([{ type: 'skip', mode: 'solo', missionId: 'two' }]);
  assert.equal(
    m.counts.validations,
    2,
    'loaded backend validation plus full transition output validation',
  );
  m.counts.validations = 0;
  m.applyJourneyEvent(emptyJourneyProfile(), { type: 'select', mode: 'solo', missionId: 'public' });
  assert.equal(m.counts.validations, 2, 'public entry still validates input and output');
  store.performance.dispose();
});

test('failed private transitions isolate prior memory and durable state without weakening public errors', async () => {
  const m = await observedModule(),
    model = managedIndexedDB(),
    backend = m.createJourneyBackend(model);
  await backend.commit([complete('solo', 'one')]);
  const before = await backend.read();
  for (const event of [
    { type: 'bad', mode: 'solo', missionId: 'one' },
    { type: 'skip', mode: 'wrong', missionId: 'one' },
    { ...complete('solo', 'one'), gameplayId: 'different' },
    { ...complete('solo', 'other'), difficulty: 'wrong' },
    complete('solo', '__proto__'),
  ]) {
    let expected;
    try {
      applyJourneyEvent(before, event);
    } catch (error) {
      expected = error;
    }
    assert(expected);
    await assert.rejects(backend.commit([event]), {
      name: expected.name,
      message: expected.message,
    });
    assert.equal(JSON.stringify(await backend.read()), JSON.stringify(before));
  }
  assert(m.counts.inputs.every(({ before, after }) => before === after));
});

test('private transitions retain full final byte, array and generation budget rejection', async () => {
  const m = await observedModule();
  const large = emptyJourneyProfile();
  let bytes = Buffer.byteLength(JSON.stringify(large));
  for (let index = 0; ; index++) {
    const key = `history-${index}-${'x'.repeat(480)}`,
      value = { runId: 'r'.repeat(1024), gameplayId: 'g'.repeat(1024), difficulty: 'standard' };
    const added =
      Buffer.byteLength(JSON.stringify(key)) +
      1 +
      Buffer.byteLength(JSON.stringify(value)) +
      (index ? 1 : 0);
    if (bytes + added > 4 * 1024 * 1024) break;
    large.clears.solo[key] = value;
    bytes += added;
  }
  validateJourneyProfile(large);
  assert(bytes > 4 * 1024 * 1024 - 3000);
  const arrays = emptyJourneyProfile();
  arrays.skipped.solo = Array.from({ length: 4096 }, (_, i) => `s${i}`);
  const nodes = emptyJourneyProfile();
  for (let i = 0; i < 24996; i++)
    nodes.clears.solo[`n${i}`] = { runId: 'r', gameplayId: 'g', difficulty: 'standard' };
  validateJourneyProfile(nodes);
  const generation = emptyJourneyProfile();
  generation.generation = Number.MAX_SAFE_INTEGER;
  for (const [profile, event, reason] of [
    [
      large,
      {
        ...complete('solo', 'm'.repeat(512)),
        runId: 'r'.repeat(1024),
        gameplayId: 'g'.repeat(1024),
      },
      /byte budget/,
    ],
    [nodes, complete('solo', 'next-node'), /structural budget/],
    [arrays, { type: 'skip', mode: 'solo', missionId: 'new' }, /array.*budget/],
    [generation, { type: 'select', mode: 'solo', missionId: 'new' }, /damaged Journey profile/],
  ]) {
    const model = managedIndexedDB();
    await seeded(model, profile);
    const backend = m.createJourneyBackend(model);
    let expected;
    try {
      applyJourneyEvent(profile, event);
    } catch (error) {
      expected = error;
    }
    assert(expected);
    assert.match(expected.message, reason);
    await assert.rejects(backend.commit([event]), {
      name: expected.name,
      message: expected.message,
    });
    assert.equal(JSON.stringify(await backend.read()), JSON.stringify(profile));
  }
  assert(m.counts.inputs.every(({ before, after }) => before === after));
});
