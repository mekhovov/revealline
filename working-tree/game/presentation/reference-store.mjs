import { canonicalJSON, required } from '../data-json.mjs';
import { FORMATS, validateThemeBundle } from './model.mjs';
import { verifyThemeAssets } from './bundle.mjs';
import { createStudioRecordConnection } from './studio-store.mjs';
import {
  validateReferencedBundle,
  assertReferencedHistory,
  checkReferenceAbort,
} from './reference-model.mjs';
import { verifyReferencedAssets } from './reference-bundle.mjs';

const KEY = 'workspace';
/** Explicit local prototype entry. Never upgrades a document implicitly. */
export function createReferencedStudioStore({ indexedDB = globalThis.indexedDB } = {}) {
  const connection = createStudioRecordConnection({ indexedDB, cancelPendingWrites: true });
  const prepare = async (record, signal) => {
    if (!record) return null;
    required(
      Number.isSafeInteger(record.generation) && record.generation > 0,
      'The stored studio revision is invalid.',
    );
    const legacy = record.document?.format === FORMATS.bundle;
    const document = legacy
      ? validateThemeBundle(record.document)
      : await validateReferencedBundle(record.document, { signal });
    const assets = await (legacy ? verifyThemeAssets : verifyReferencedAssets)(
      document,
      record.assets,
      { signal },
    );
    return { generation: record.generation, document, assets };
  };
  return Object.freeze({
    async load({ signal } = {}) {
      checkReferenceAbort(signal);
      const record = await connection.transaction('readonly', (_store, value) => value);
      const result = await prepare(record, signal);
      checkReferenceAbort(signal);
      return result;
    },
    async save(source, sourceAssets, { expectedGeneration = 0, signal } = {}) {
      required(
        Number.isSafeInteger(expectedGeneration) &&
          expectedGeneration >= 0 &&
          expectedGeneration < Number.MAX_SAFE_INTEGER,
        'Invalid expected studio generation.',
      );
      const document = await validateReferencedBundle(source, { signal });
      const assets = await verifyReferencedAssets(document, sourceAssets, { signal });
      // Read and validate saved closure before the short write transaction.
      const old = await prepare(
        await connection.transaction('readonly', (_store, value) => value),
        signal,
      );
      required(
        (old?.generation ?? 0) === expectedGeneration,
        'This draft changed in another tab. Reload the studio before saving.',
      );
      if (old) assertReferencedHistory(document, old.document, { multiple: true });
      const oldIdentity = old && canonicalJSON(old.document);
      checkReferenceAbort(signal);
      return connection.transaction(
        'readwrite',
        (store, current) => {
          checkReferenceAbort(signal);
          required(
            (current?.generation ?? 0) === expectedGeneration,
            'This draft changed in another tab. Reload the studio before saving.',
          );
          required(
            current ? oldIdentity === canonicalJSON(current.document) : old === null,
            'Stored document changed during verification.',
          );
          const generation = expectedGeneration + 1;
          store.put({ generation, document, assets }, KEY);
          return { generation, document, assets };
        },
        { signal },
      );
    },
    close: connection.close,
  });
}
