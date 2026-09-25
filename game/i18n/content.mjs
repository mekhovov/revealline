import { dataIdentity } from '../data-json.mjs';
import registry from './content-registry.mjs';
import { t } from './index.mjs';

/** Resolve only an exact shipped record and field. Never mutate content or use
 * a display name alone as identity: edited/imported variants keep authored text.
 * Mutable authoring drafts are rechecked on every read. */
const immutable = new WeakMap();
export function contentText(record, field) {
  if (record == null) return undefined;
  const original = field.split('.').reduce((value, key) => value?.[key], record);
  if (typeof original !== 'string' || typeof record !== 'object') return original;
  let entry = immutable.get(record);
  if (entry === undefined) {
    try { entry = registry[dataIdentity(record)] || null; } catch { return original; }
    if (Object.isFrozen(record)) immutable.set(record, entry);
  }
  const registered = entry?.fields[field];
  return registered?.source === original ? t(registered.key) : original;
}
export function contentList(record, field) {
  return record?.[field]?.map((_, index) => contentText(record, `${field}.${index}`)) || [];
}
