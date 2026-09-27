import { boundedJSON, canonicalJSON, exactKeys, required, stableId } from '../data-json.mjs';
import { freezeDesign } from '../content-design/catalogs.mjs';
import { validateCompanyLessons } from './learning.mjs';
import { verifyLearningEvidence } from './evidence.mjs';

export const LEARNING_PROOF_FORMAT = 'revealline-learning-proof.v1';
const STORE_FORMAT = 'revealline-learning-proof-store.v1';
const RECOVERY_FORMAT = 'revealline-learning-proof-recovery.v1';
const MEMORY_BYTES = 32 * 1024 * 1024;
const STORAGE_BYTES = 2 * 1024 * 1024;
const TOTAL_TICKS = 216000;
const limits = { maxBytes: MEMORY_BYTES, maxNodes: 3000000, maxArray: 216000, maxDepth: 40 };
const copy = (value) => boundedJSON(value, limits);
async function proofIdentity(value) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonicalJSON(value)),
  );
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Historical mastery owns its replay evidence independently of the current run.
 * Stored JSON is untrusted until replayed against this edition's selected content.
 * This proves local consistency, not a signed or externally certified achievement.
 */
export function createCompanyLearningProofStore({ editionId, storage, lessons, acceptSimulation }) {
  required(stableId(editionId), 'Invalid learning proof edition.');
  required(typeof acceptSimulation === 'function', 'Selected simulation identities are required.');
  const catalog = validateCompanyLessons(lessons);
  const key = `revealline.company-learning-proofs.${editionId}.v1`;
  const recoveryKey = `${key}.recovery`;
  const trusted = new WeakSet();
  const trustedRecovery = new WeakSet();
  let records = new Map();
  let recoverySources = new Set(),
    recoveryBlocked = false;
  const recoveryEnvelope = () => ({
    format: RECOVERY_FORMAT,
    editionId,
    sources: [...recoverySources],
  });
  const recoveryLimits = {
    maxBytes: 8 * 1024 * 1024,
    maxString: 8 * 1024 * 1024,
    maxNodes: 256,
    maxArray: 32,
  };
  const mergeRecovery = (sources) => {
    const merged = new Set([...recoverySources, ...sources]);
    boundedJSON({ format: RECOVERY_FORMAT, editionId, sources: [...merged] }, recoveryLimits);
    return merged;
  };
  const inspectRecovery = (input) => {
    const source = boundedJSON(input, recoveryLimits);
    exactKeys(source, ['format', 'editionId', 'sources'], 'learning proof recovery');
    required(
      source.format === RECOVERY_FORMAT &&
        source.editionId === editionId &&
        Array.isArray(source.sources) &&
        source.sources.length <= 32 &&
        source.sources.every((entry) => typeof entry === 'string'),
      'Invalid learning proof recovery.',
    );
    // Backup admission must include the retained local journal, before the host
    // adopts any profile changes. Never silently discard the last imported row.
    mergeRecovery(source.sources);
    const checked = freezeDesign(source);
    trustedRecovery.add(checked);
    return checked;
  };
  const preserve = (raw) => {
    if (typeof raw !== 'string' || recoverySources.has(raw)) return;
    try {
      const sources = [...recoverySources, raw];
      inspectRecovery({ format: RECOVERY_FORMAT, editionId, sources });
      recoverySources = new Set(sources);
    } catch {
      // Keep the original storage key untouched when recovery exceeds its budget.
      recoveryBlocked = true;
    }
  };
  const envelope = (entries) => ({ format: STORE_FORMAT, editionId, proofs: [...entries] });
  const checkCollection = (source) => {
    const entries = copy(source);
    required(
      Array.isArray(entries) && entries.length <= catalog.length,
      'Too many learning proofs.',
    );
    const ids = new Set();
    let ticks = 0;
    for (const entry of entries) {
      required(!ids.has(entry?.attempt?.missionId), 'Duplicate learning proof mission.');
      ids.add(entry?.attempt?.missionId);
      required(
        Number.isSafeInteger(entry?.replay?.ticks) && entry.replay.ticks >= 0,
        'Invalid learning proof ticks.',
      );
      ticks += entry.replay.ticks;
      required(ticks <= TOTAL_TICKS, 'Learning proof history exceeds its replay budget.');
    }
    return entries;
  };
  const verify = async (input, { signal } = {}) => {
    const source = copy(input);
    exactKeys(source, ['format', 'editionId', 'proofId', 'attempt', 'replay'], 'learning proof');
    required(
      source.format === LEARNING_PROOF_FORMAT && source.editionId === editionId,
      'Wrong learning proof edition.',
    );
    required(
      typeof source.proofId === 'string' && /^[a-f0-9]{64}$/.test(source.proofId),
      'Invalid learning proof identity.',
    );
    const lesson = catalog.find((entry) => entry.missionId === source.attempt?.missionId);
    required(
      lesson && source.attempt.status === 'complete',
      'Historical proof needs a completed selected lesson.',
    );
    required(
      acceptSimulation(lesson.missionId, source.attempt.simulationIdentity),
      'Learning proof needs its selected simulation.',
    );
    const body = {
      format: source.format,
      editionId,
      attempt: source.attempt,
      replay: source.replay,
    };
    required(
      source.proofId === (await proofIdentity(body)),
      'Learning proof identity does not match its bytes.',
    );
    await verifyLearningEvidence({
      lesson,
      attempt: source.attempt,
      replay: source.replay,
      signal,
    });
    const checked = freezeDesign(source);
    trusted.add(checked);
    return checked;
  };
  const persist = () => {
    try {
      if (!storage?.setItem) return false;
      if (recoveryBlocked) return false;
      if (recoverySources.size) storage.setItem(recoveryKey, JSON.stringify(recoveryEnvelope()));
      const serialized = JSON.stringify(envelope(records.values()));
      boundedJSON(serialized, { ...limits, maxBytes: STORAGE_BYTES });
      storage.setItem(key, serialized);
      return true;
    } catch {
      return false;
    }
  };
  const importVerified = (entries) => {
    required(
      Array.isArray(entries) && entries.every((entry) => trusted.has(entry)),
      'Only replay-verified learning proofs may be stored.',
    );
    const next = new Map(records);
    for (const entry of entries) next.set(entry.attempt.missionId, entry);
    checkCollection([...next.values()]);
    records = next;
    return persist();
  };
  return Object.freeze({
    key,
    recoveryKey,
    load: (missionId) => records.get(missionId)?.attempt ?? null,
    exportProofs: () => [...records.values()],
    exportRecovery: () => recoveryEnvelope(),
    inspectRecovery,
    importRecovery(source) {
      required(trustedRecovery.has(source), 'Recovery must be bounded before import.');
      recoverySources = mergeRecovery(source.sources);
      return persist();
    },
    async hydrate({ signal } = {}) {
      let entries, raw;
      const read = (name) => {
        try {
          return storage?.getItem(name);
        } catch (error) {
          // An unavailable read cannot authorize replacement of unseen history.
          recoveryBlocked = true;
          throw error;
        }
      };
      try {
        const recovered = read(recoveryKey);
        if (recovered) {
          try {
            recoverySources = new Set(inspectRecovery(recovered).sources);
          } catch {
            preserve(recovered);
          }
        }
        raw = read(key);
        if (!raw) return { verified: 0, rejected: 0 };
        const data = boundedJSON(raw, { ...limits, maxBytes: STORAGE_BYTES });
        exactKeys(data, ['format', 'editionId', 'proofs'], 'learning proof storage');
        required(
          data.format === STORE_FORMAT && data.editionId === editionId,
          'Wrong learning proof store edition.',
        );
        entries = checkCollection(data.proofs);
      } catch (error) {
        preserve(raw);
        return { verified: 0, rejected: 1, error: error.message };
      }
      let rejected = 0;
      const next = new Map();
      for (const source of entries) {
        try {
          const entry = await verify(source, { signal });
          next.set(entry.attempt.missionId, entry);
        } catch (error) {
          if (signal?.aborted) throw error;
          rejected++;
        }
      }
      records = next;
      if (rejected) preserve(raw);
      return { verified: next.size, rejected };
    },
    async prove({ attempt, replay, signal }) {
      const body = copy({ format: LEARNING_PROOF_FORMAT, editionId, attempt, replay });
      return verify({ ...body, proofId: await proofIdentity(body) }, { signal });
    },
    async inspectProofs(input, { signal } = {}) {
      const entries = checkCollection(input),
        checked = [];
      for (const entry of entries) checked.push(await verify(entry, { signal }));
      const merged = new Map(records);
      checked.forEach((entry) => merged.set(entry.attempt.missionId, entry));
      // Admission checks the merged history before the host changes its profile.
      checkCollection([...merged.values()]);
      return checked;
    },
    saveVerified: (entry) => importVerified([entry]),
    importVerified,
  });
}
