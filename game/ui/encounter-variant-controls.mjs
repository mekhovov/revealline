import { snakeText } from '../snake/copy.mjs';
import { localizedText } from '../i18n/index.mjs';
import { ENCOUNTER_VARIANTS } from '../hunt/preferences.mjs';
import { huntText } from '../hunt/copy.mjs';
import { attachHuntRecordControls } from './hunt-record-controls.mjs';

/** Selection changes only prospective intent. The host stages a new immutable
 * attempt; this component never replaces a running level or its checkpoint. */
export function attachEncounterVariantControls({
  document: doc = globalThis.document,
  container,
  preferences,
  getAvailable = () => ENCOUNTER_VARIANTS,
  onChange = () => {},
  getStorage,
  records,
} = {}) {
  const root = doc.createElement('div');
  root.className = 'encounter-variant-controls';
  const label = doc.createElement('label');
  label.className = 'field';
  const heading = doc.createElement('span');
  localizedText(heading, () => huntText('variant'));
  const select = doc.createElement('select');
  select.name = 'encounter-variant';
  for (const variant of ENCOUNTER_VARIANTS) {
    const option = doc.createElement('option');
    option.value = variant;
    localizedText(option, () => huntText(variant));
    select.append(option);
  }
  label.append(heading, select);
  root.append(label);
  const help = doc.createElement('p');
  help.className = 'micro-note';
  localizedText(help, () => huntText('variantHelp'));
  root.append(help);
  const hint = doc.createElement('p');
  hint.className = 'micro-note';
  localizedText(hint, () => huntText('hint'));
  root.append(hint);
  const status = doc.createElement('p');
  status.className = 'micro-note';
  status.setAttribute('role', 'status');
  root.append(status);
  const retry = doc.createElement('button');
  retry.type = 'button';
  localizedText(retry, () => huntText('retry'));
  root.append(retry);
  const lessons = doc.createElement('a');
  lessons.href = '?journey=humanoid-hunt-v1';
  const startLessons = () => preferences.set({ variant: 'authored' });
  lessons.addEventListener('click', startLessons);
  localizedText(lessons, () => huntText('lessons'));
  root.append(lessons);
  const snakes = doc.createElement('a');
  snakes.href = new URL('../snake/', import.meta.url).href;
  localizedText(snakes, () => snakeText('campaigns'));
  root.append(doc.createElement('br'), snakes);
  container?.append(root);
  const recordControls = attachHuntRecordControls({
    document: doc,
    container: root,
    getStorage,
    records,
  });
  let disposed = false,
    busy = false,
    operationError = '';
  const refresh = () => {
    if (disposed) return;
    const choices = getAvailable() ?? ['authored'],
      state = preferences.snapshot();
    for (const option of select.options) option.disabled = !choices.includes(option.value);
    select.value = state.variant;
    select.disabled = busy;
    hint.hidden = !['bonus', 'capture-quota', 'hunt'].includes(state.variant);
    const unavailable = !choices.includes(state.variant);
    localizedText(
      status,
      () =>
        operationError ||
        (unavailable ? huntText('unavailable') : !state.durable ? huntText('saving') : ''),
    );
    status.hidden = !operationError && !unavailable && state.durable;
    retry.hidden = state.durable;
  };
  const choose = async () => {
    const variant = select.value;
    if (!(getAvailable() ?? ['authored']).includes(variant)) {
      refresh();
      return;
    }
    operationError = '';
    preferences.set({ variant });
    busy = true;
    refresh();
    try {
      await onChange(variant);
    } catch (error) {
      if (!disposed) {
        operationError = error.message;
      }
    } finally {
      busy = false;
      refresh();
    }
  };
  const save = () => preferences.retry();
  const unsubscribe = preferences.subscribe(refresh);
  select.addEventListener('change', choose);
  retry.addEventListener('click', save);
  return Object.freeze({
    refresh,
    element: root,
    dispose() {
      disposed = true;
      unsubscribe();
      select.removeEventListener('change', choose);
      retry.removeEventListener('click', save);
      lessons.removeEventListener('click', startLessons);
      recordControls.dispose();
      root.remove();
    },
  });
}
