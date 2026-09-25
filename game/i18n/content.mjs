import { canonicalJSON, dataIdentity } from '../data-json.mjs';
import registry from './content-registry.mjs';
import { getLocale, t } from './index.mjs';

/** Resolve only an exact shipped record and field. Never mutate content or use
 * a display name alone as identity: edited/imported variants keep authored text.
 * Mutable authoring drafts are rechecked on every read. */
const records = new WeakMap();
function deeplyFrozen(value, visited = new WeakSet()) {
  if (!value || typeof value !== 'object' || visited.has(value)) return true;
  if (!Object.isFrozen(value)) return false;
  visited.add(value);
  return Object.values(value).every((child) => deeplyFrozen(child, visited));
}
export function contentText(record, field) {
  if (record == null) return undefined;
  const original = field.split('.').reduce((value, key) => value?.[key], record);
  if (typeof original !== 'string' || typeof record !== 'object') return original;
  if (getLocale() === 'en') return original;
  let cached = records.get(record);
  if (!cached?.immutable) {
    try {
      // Mutable editor records must be checked after edits, including nested
      // geometry changes. Reuse the digest when their exact JSON is unchanged:
      // hashing an entire campaign again for every HUD label is prohibitively slow.
      const json = canonicalJSON(record);
      if (!cached || cached.json !== json) {
        cached = {
          json,
          entry: registry[dataIdentity(record)] || null,
          immutable: deeplyFrozen(record),
        };
        records.set(record, cached);
      }
    } catch {
      return original;
    }
  }
  const registered = cached.entry?.fields[field];
  return registered?.source === original ? t(registered.key) : original;
}
export function contentList(record, field) {
  return record?.[field]?.map((_, index) => contentText(record, `${field}.${index}`)) || [];
}
