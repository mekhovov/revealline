import { t } from '../../game/i18n/index.mjs';
import { contentText, isRegisteredContent } from '../../game/i18n/content.mjs';

/** The lab edits separate selections, recipe overrides and simulation state.
 * Its validated JSON definitions are immutable for the lifetime of this mount.
 * Freezing them also lets presentation identity checks avoid rehashing per frame. */
export function freezeMotionPresets(value, seen = new WeakSet()) {
  if (value && typeof value === 'object' && !seen.has(value)) {
    seen.add(value);
    for (const child of Object.values(value)) freezeMotionPresets(child, seen);
    Object.freeze(value);
  }
  return value;
}

/** A custom definition file retains every authored field, even when an individual
 * child happens to match a shipped record. No translated value enters the model. */
export function motionText(source, record, field) {
  if (isRegisteredContent(source)) return contentText(record, field);
  return field.split('.').reduce((value, part) => value?.[part], record);
}

export function motionTargetText(config, target) {
  const source = config.stage.targets.find((entry) => entry.id === target.id);
  return source?.label === target.label ? motionText(config, source, 'label') : target.label;
}

const COLLECTION_REASON_KEYS = Object.freeze({
  'profile-mode-mismatch': 'tools:motionLab.collectionReason.profileModeMismatch',
  'duplicate-event': 'tools:motionLab.collectionReason.duplicateEvent',
  'event-id-conflict': 'tools:motionLab.collectionReason.eventConflict',
  'duplicate-run': 'tools:motionLab.collectionReason.duplicateRun',
  'run-id-conflict': 'tools:motionLab.collectionReason.runConflict',
  'profile-event-limit; export before migration': 'tools:motionLab.collectionReason.eventLimit',
  'scope-does-not-match-current-context': 'tools:motionLab.collectionReason.scopeMismatch',
  'unknown-character': 'tools:motionLab.collectionReason.unknownCharacter',
  'character-locked': 'tools:motionLab.collectionReason.characterLocked',
  'character-unavailable-in-context': 'tools:motionLab.collectionReason.characterUnavailable',
  'equipped-scope-limit': 'tools:motionLab.collectionReason.scopeLimit',
  'fixtures-are-lab-only': 'tools:motionLab.collectionReason.labOnly',
  'unknown-fixture': 'tools:motionLab.collectionReason.unknownFixture',
});

/** Keep model reason codes stable; render complete explanations only at the UI. */
export function motionCollectionReason(reason) {
  return t(COLLECTION_REASON_KEYS[reason] || 'tools:motionLab.collectionReason.invalid');
}
