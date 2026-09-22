import { isAuthoredJourneyRouteId } from '../content-design/mode-href.mjs';
import { LIBRARY_COLLECTIONS, LIBRARY_MODES } from './library.mjs';

export const MISSION_LIBRARY_HANDOFF_PARAM = 'library-mission';
export const MISSION_LIBRARY_STATE_PREFIX = 'revealline.mission-library.selector.v1';
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;
const UNPAIRED_SURROGATE = /[\ud800-\udfff]/u;

function missionId(value) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > 2048 ||
    CONTROL_CHARACTERS.test(value) ||
    UNPAIRED_SURROGATE.test(value)
  )
    throw new TypeError('Mission handoff needs a nonempty bounded display identity.');
  return value;
}

function modeId(value) {
  if (!LIBRARY_MODES.includes(value)) throw new TypeError('Unknown mission library mode.');
  return value;
}

/** An opaque lookup request, not runtime, installation, progress or award authority.
 * Missing is different from malformed: hosts must show explicit invalid intent
 * instead of silently launching another mission when this reader throws.
 */
export function readMissionLibraryHandoff(params) {
  if (!(params instanceof URLSearchParams))
    throw new TypeError('Mission handoff needs URLSearchParams.');
  const values = params.getAll(MISSION_LIBRARY_HANDOFF_PARAM);
  if (!values.length) return null;
  if (values.length !== 1) throw new TypeError('Duplicate mission handoff parameters.');
  return missionId(values[0]);
}

/** Fixed same-game routes retain the selected release prefix. No inherited query,
 * fragment, arbitrary destination path, save token or historical pack intent is
 * transported. The receiving host must find the exact row and validate its owner.
 */
export function missionLibraryHref({ baseURL, currentMode, mode, journey, missionId: id }) {
  modeId(currentMode);
  modeId(mode);
  missionId(id);
  if (
    !(
      journey === 'legacy' ||
      (mode === 'team' ? journey === 'team-spatial-originals-1' : isAuthoredJourneyRouteId(journey))
    )
  )
    throw new TypeError('Mission handoff needs a registered destination Journey route.');
  const base = new URL(baseURL);
  if (!['http:', 'https:', 'file:'].includes(base.protocol) || base.username || base.password)
    throw new TypeError('Mission handoff needs a same-game HTTP or file URL.');
  const root = new URL(currentMode === 'solo' ? './' : '../', base);
  const target = new URL(
    { solo: './', versus: 'couch/', team: 'couch/relay-rescue.html' }[mode],
    root,
  );
  target.searchParams.set('journey', journey);
  target.searchParams.set(MISSION_LIBRARY_HANDOFF_PARAM, id);
  return target.href;
}

function chooserState(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some(
      (key) => !['search', 'collection', 'campaign', 'mode', 'selectedId', 'scroll'].includes(key),
    )
  )
    throw new TypeError('Invalid mission library chooser state.');
  const boundedText = (text, limit) =>
    typeof text === 'string' && text.length <= limit && !CONTROL_CHARACTERS.test(text);
  if (
    !boundedText(value.search, 512) ||
    !['', ...LIBRARY_COLLECTIONS].includes(value.collection) ||
    !boundedText(value.campaign, 2048) ||
    !boundedText(value.selectedId, 2048) ||
    !LIBRARY_MODES.includes(value.mode) ||
    !Number.isFinite(value.scroll) ||
    value.scroll < 0 ||
    value.scroll > 10000000
  )
    throw new TypeError('Invalid mission library chooser state.');
  return {
    search: value.search,
    collection: value.collection,
    campaign: value.campaign,
    mode: value.mode,
    selectedId: value.selectedId,
    scroll: value.scroll,
  };
}

/** Session-only browsing continuity, scoped by host mode and independent of release.
 * This never reads or writes progress, settings, installed packs or media. Storage
 * failures retain the in-memory copy; malformed existing bytes remain untouched.
 */
export function createMissionLibrarySessionState({ mode, storage } = {}) {
  modeId(mode);
  const key = `${MISSION_LIBRARY_STATE_PREFIX}.${mode}`;
  const resolveStorage = () => (storage === undefined ? globalThis.sessionStorage : storage);
  let memory = null,
    pendingWrite = false;
  return Object.freeze({
    key,
    read() {
      if (pendingWrite) return memory ? { ...memory } : null;
      try {
        const raw = resolveStorage()?.getItem(key);
        if (typeof raw === 'string' && raw.length <= 32768) memory = chooserState(JSON.parse(raw));
      } catch {
        // Browsing remains usable while storage is unavailable or damaged.
      }
      return memory ? { ...memory } : null;
    },
    write(value) {
      memory = chooserState(value);
      pendingWrite = true;
      try {
        const target = resolveStorage();
        if (!target || typeof target.setItem !== 'function') return false;
        target.setItem(key, JSON.stringify(memory));
        pendingWrite = false;
        return true;
      } catch {
        return false;
      }
    },
  });
}
