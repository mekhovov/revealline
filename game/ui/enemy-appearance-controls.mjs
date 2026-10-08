import { sharedEnemyArtwork, sharedActorAppearance } from '../hunt/preferences.mjs';
import { ACTOR_CASTS } from '../hunt/actor-catalog.mjs';
import { actorArtReviewRevision, nativeArtReviewURL } from './art-review-navigation.mjs';

const COPY = {
  en: {
    label: 'Enemy appearance preset',
    authored: 'Original level artwork',
    military: 'Military Field · soldiers and vehicles',
    uniform: 'Soldier uniform',
    castAuthored: 'As designed',
    about: 'What changes?',
    help: 'Military Field applies the matching game appearance and detailed military artwork. Choose a uniform under Character appearance. It uses the level’s existing enemies; Running enemies adds optional humanoids. Snake targets stay humanoid.',
    next: 'Applies when starting a new attempt. Retry and Continue keep accepted artwork. Creator-owned custom artwork is retained.',
    preview: 'Preview artwork is active. Choosing a preset ends this preview.',
    saving: 'This choice applies here, but could not be saved for another page.',
    failure: 'The appearance could not be prepared. Select it again to retry.',
  },
  uk: {
    label: 'Набір оформлення ворогів',
    authored: 'Початкове оформлення рівня',
    military: 'Військове поле · солдати й техніка',
    uniform: 'Форма солдатів',
    castAuthored: 'За задумом',
    about: 'Що змінюється?',
    help: 'Військове поле застосовує відповідне оформлення гри та детальні військові образи. Форму можна вибрати в розділі «Вигляд персонажів». Використовуються наявні вороги рівня; «Рухливі вороги» додають необов’язкових гуманоїдів. Цілі Snake залишаються гуманоїдами.',
    next: 'Діє з початком нової спроби. Повтор і продовження зберігають прийняте оформлення. Власні авторські зображення зберігаються.',
    preview: 'Активний попередній перегляд зображень. Вибір набору завершує цей перегляд.',
    saving: 'Вибір діє тут, але його не вдалося зберегти для іншої сторінки.',
    failure: 'Не вдалося підготувати оформлення. Виберіть його знову, щоб повторити.',
  },
};
let sequence = 0;

export function clearExplicitReviewPin(location, history) {
  if (!actorArtReviewRevision(location)) return;
  const source = new URL(location.href),
    target = new URL(source);
  target.searchParams.delete('artReview');
  // Use the same fixed native-route contract as review-link propagation. An
  // unrelated URL, unsupported protocol or ambiguous pin is never rewritten.
  if (nativeArtReviewURL(target.href, source.href) === target.href) return;
  if (typeof history?.replaceState !== 'function')
    throw new Error('The current review appearance cannot be replaced.');
  history.replaceState(history.state, '', target.href);
}

/** Shared explicit preset, not a gameplay/population switch. Each native host
 * retains ownership of the current attempt and its next preparation boundary. */
export function mountEnemyAppearanceControls({
  document: doc = globalThis.document,
  location = doc.defaultView?.location ?? globalThis.location,
  history = doc.defaultView?.history ?? globalThis.history,
  container,
  preferences = sharedEnemyArtwork(),
  locale = () => doc.documentElement?.lang ?? 'en',
  includeUniform = false,
  applyMilitary,
  applyAuthored,
} = {}) {
  if (!container || typeof applyMilitary !== 'function' || typeof applyAuthored !== 'function')
    throw new TypeError('Enemy appearance controls require native appearance actions.');
  const root = doc.createElement('div'),
    label = doc.createElement('label'),
    title = doc.createElement('span'),
    select = doc.createElement('select'),
    details = doc.createElement('details'),
    summary = doc.createElement('summary'),
    help = doc.createElement('p'),
    status = doc.createElement('p');
  root.className = 'enemy-appearance-controls';
  root.dataset.enemyAppearanceControls = 'true';
  label.className = 'settings-row';
  select.id = `enemy-appearance-${++sequence}`;
  select.name = 'enemy-appearance';
  select.dataset.enemyAppearance = 'true';
  help.id = `${select.id}-help`;
  help.className = status.className = 'micro-note';
  status.setAttribute('role', 'status');
  select.setAttribute('aria-describedby', help.id);
  for (const value of ['authored', 'military']) {
    const option = doc.createElement('option');
    option.value = value;
    select.append(option);
  }
  label.append(title, select);
  details.append(summary, help);
  root.append(label, status, details);
  const cast = includeUniform ? sharedActorAppearance() : null;
  let uniform;
  if (cast) {
    const uniformLabel = doc.createElement('label');
    uniform = { title: doc.createElement('span'), select: doc.createElement('select') };
    uniformLabel.className = 'settings-row';
    uniform.select.name = 'soldier-uniform';
    for (const value of ['authored', ...ACTOR_CASTS.map((entry) => entry.id)]) {
      const option = doc.createElement('option');
      option.value = value;
      uniform.select.append(option);
    }
    uniformLabel.append(uniform.title, uniform.select);
    root.insertBefore(uniformLabel, status);
  }
  container.append(root);
  let disposed = false,
    failed = false,
    generation = 0;
  function refresh() {
    if (disposed) return;
    const words = COPY[locale()] ?? COPY.en,
      state = preferences.snapshot(),
      reviewing = actorArtReviewRevision(location) !== null;
    title.textContent = words.label;
    for (const option of select.options) option.textContent = words[option.value];
    select.value = reviewing ? 'military' : state.style;
    help.textContent = words.help;
    summary.textContent = words.about;
    if (uniform) {
      uniform.title.textContent = words.uniform;
      uniform.select.value = cast.snapshot().cast;
      for (const option of uniform.select.options)
        option.textContent =
          ACTOR_CASTS.find((entry) => entry.id === option.value)?.name[
            locale() === 'uk' ? 'uk' : 'en'
          ] ?? words.castAuthored;
    }
    status.textContent = failed
      ? words.failure
      : reviewing
        ? words.preview
        : state.durable === false
          ? words.saving
          : words.next;
  }
  const change = async () => {
    const ticket = ++generation,
      style = select.value;
    if (!['authored', 'military'].includes(style)) return;
    failed = false;
    try {
      // An explicit preset supersedes only this page's supported cosmetic review
      // pin. Do this before notifying preferences so native subscribers observe
      // the new intent; visiting settings or receiving another tab's choice
      // must preserve the current review link.
      clearExplicitReviewPin(location, history);
      preferences.set({ style });
      await (style === 'military' ? applyMilitary() : applyAuthored());
    } catch {
      if (!disposed && generation === ticket) failed = true;
    }
    if (!disposed && generation === ticket) refresh();
  };
  select.addEventListener('change', change);
  const changeUniform = () => cast.set({ cast: uniform.select.value });
  uniform?.select.addEventListener('change', changeUniform);
  const unsubscribe = preferences.subscribe(refresh);
  const unsubscribeCast = cast?.subscribe(refresh);
  return Object.freeze({
    element: root,
    refresh,
    dispose() {
      if (disposed) return;
      disposed = true;
      generation++;
      unsubscribe();
      unsubscribeCast?.();
      select.removeEventListener('change', change);
      uniform?.select.removeEventListener('change', changeUniform);
      root.remove();
    },
  });
}
