// Fresh-process recovery harness. Only committed IndexedDB values cross the
// process boundary; no run objects, WeakMaps, callbacks or session caches do.
// fake-indexeddb supplies transaction semantics. This is not browser durability
// or physical power-loss qualification.
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createSurvivalSuspend } from '../../overflight/suspend.mjs';
import { createOverflightRecords } from '../../overflight/records.mjs';
import { createOverflightMastery } from '../../overflight/mastery.mjs';
import { JOURNEY_PROFILE_DATABASE } from '../../profile-database.mjs';
import { createOverflightProject, compileOverflightProject } from '../../overflight/project.mjs';
import {
  createOverflightRun,
  startOverflight,
  stepOverflight,
  pauseOverflight,
  resumeOverflight,
  chooseOverflightUpgrade,
} from '../../overflight/core.mjs';
import { assessmentDigest } from './survival-roundtrip.mjs';

const { IDBFactory } = createRequire(
  new URL('../../../authoring/fpv-worlds/package.json', import.meta.url),
)('fake-indexeddb');
const indexedDB = new IDBFactory();
const [file, action, stop] = process.argv.slice(2);
const packageIdentity = {
  manifestSha256: 'a'.repeat(64),
  runtimeSha256: 'b'.repeat(64),
  sourceRevision: 'c'.repeat(40),
};
const db = await new Promise((resolve, reject) => {
  const request = indexedDB.open(JOURNEY_PROFILE_DATABASE, 1);
  request.onupgradeneeded = () => request.result.createObjectStore('profiles');
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
let previous = null;
if (action !== 'seed') {
  previous = JSON.parse(await readFile(file, 'utf8'));
  await new Promise((resolve, reject) => {
    const tx = db.transaction('profiles', 'readwrite'),
      store = tx.objectStore('profiles');
    for (const [key, value] of previous.values) store.put(value, key);
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
  });
}
async function dump(summary) {
  const values = await new Promise((resolve, reject) => {
    const tx = db.transaction('profiles', 'readonly'),
      store = tx.objectStore('profiles');
    const keys = store.getAllKeys(),
      rows = store.getAll();
    tx.oncomplete = () => resolve(keys.result.map((key, index) => [key, rows.result[index]]));
    tx.onabort = () => reject(tx.error);
  });
  await writeFile(file, JSON.stringify({ values, summary }));
}
const records = createOverflightRecords({ indexedDB }),
  mastery = createOverflightMastery({ indexedDB });
const interruption = () => {
  throw new Error('simulated interruption');
};
const coordinator = createSurvivalSuspend({
  indexedDB,
  packageIdentity,
  canWrite: () => true,
  randomUUID: () => '12345678-1234-4123-8123-123456789abc',
  records: {
    async record(...args) {
      if (action === 'interrupt' && stop === 'journal') interruption();
      const result = await records.record(...args);
      if (action === 'interrupt' && stop === 'records') interruption();
      return result;
    },
  },
  mastery: {
    async record(...args) {
      const result = await mastery.record(...args);
      if (action === 'interrupt' && stop === 'mastery') interruption();
      return result;
    },
  },
});
try {
  if (action === 'seed') {
    const project = createOverflightProject({ rulesVersion: 4, world: 'field-crossing', seed: 7 });
    const run = createOverflightRun(compileOverflightProject(project), { airframes: 1 });
    startOverflight(run);
    for (let i = 0; i < 120; i++) stepOverflight(run, {});
    pauseOverflight(run);
    await coordinator.save(run, project);
    await dump({ phase: 'saved', digest: assessmentDigest(run) });
  } else if (action === 'interrupt') {
    const restored = await coordinator.prepareRestore();
    if (assessmentDigest(restored.run) !== previous.summary.digest)
      throw new Error('Cross-process restored state differs');
    await coordinator.admitRestore(restored);
    const run = restored.run;
    resumeOverflight(run);
    let ticks = 0;
    while (['playing', 'upgrade'].includes(run.phase) && ticks++ < 30000) {
      if (run.phase === 'upgrade') chooseOverflightUpgrade(run, run.offers[0].id);
      else stepOverflight(run, {});
    }
    if (run.phase !== 'lost') throw new Error('Legal process flight did not complete');
    try {
      await coordinator.finish(run);
      throw new Error('Interruption was not reached');
    } catch (error) {
      if (error.message !== 'simulated interruption') throw error;
    }
    await dump({ phase: (await coordinator.read()).phase, digest: assessmentDigest(run) });
  } else if (action === 'recover') {
    const result = await coordinator.recoverResults();
    if (assessmentDigest(result.run) !== previous.summary.digest)
      throw new Error('Terminal journal state differs across processes');
    await dump({
      phase: (await coordinator.read()).phase,
      recordsPrevious: result.records.previous,
      masteryPrevious: result.mastery.previous,
    });
  } else if (action === 'consumed') {
    let refused = false;
    try {
      await coordinator.prepareRestore();
    } catch {
      refused = true;
    }
    if (!refused) throw new Error('A consumed checkpoint resumed');
    await dump({ phase: (await coordinator.read()).phase, refused });
  } else throw new Error('Unknown process test action');
} finally {
  coordinator.close();
  records.dispose();
  mastery.dispose();
  db.close();
}
