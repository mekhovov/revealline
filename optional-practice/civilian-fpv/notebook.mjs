import { dataIdentity } from '../../game/data-json.mjs';
import { validateCompletionRewards } from '../../game/rewards/model.mjs';
import { createRewardBackend, createRewardStore } from '../../game/rewards/store.mjs';
import { mountRewardKnowledge } from '../../game/ui/reward-knowledge.mjs';
import { FLIGHT_MODEL } from './model.mjs';
import { createFlightAttemptStore, FLIGHT_EDITION_ID } from './attempts.mjs';
const CAMPAIGN = 'civilian-flight-learning';
const BRAND = 'fpv-learning';
const COPY = {
  en: {
    title: 'Flight notebook',
    progress: 'distinct drills completed',
    acro: 'in Acro',
    contacts: 'contacts',
    locked: 'Complete this drill to keep its discovery here.',
    read: 'Open discovery',
    replay: 'Review verified attempt',
    next: 'Practise next unfinished drill',
    finale: 'Your flight-learning notebook',
    finaleTeaser: 'Complete all twelve distinct drills in either mode.',
    finaleText:
      'You connected throttle, attitude, momentum, heading and approach judgement across twelve different exercises. Revisit any drill and its verified attempt; this fictional model does not certify real-aircraft skills.',
    acroTitle: 'Acro distinction',
    acroTeaser: 'Complete all twelve distinct drills in Acro.',
    acroText:
      'Your notebook now includes twelve Acro completions. Centring the sticks commands zero rotation; it does not level the aircraft or stop its travel.',
    cosmetic: 'Flight notebook wings',
    saved: 'Saved on this device',
    session: 'Session only — export before leaving',
    export: 'Export verified flight proofs',
    import: 'Import and reverify proofs',
    cancel: 'Cancel import',
    cancelled: 'Import cancelled. Completed saves are kept.',
    backup: 'Flight proof backup JSON',
    backupPart: (part, total) =>
      `Backup part ${part} of ${total}. Copy and save every part; import each part to restore all proofs.`,
    previousPart: 'Previous backup part',
    nextPart: 'Next backup part',
    retry: 'Retry saving',
    busy: 'Verifying flight proofs…',
    empty: 'No completed attempt yet. Every drill remains available for free practice.',
    missing:
      'Some exact saved proofs are unavailable. Earned discoveries remain in your collection.',
    failed: 'Could not verify or save this attempt.',
  },
  uk: {
    title: 'Нотатник польотів',
    progress: 'різних вправ завершено',
    acro: 'в Acro',
    contacts: 'контактів',
    locked: 'Завершіть вправу, щоб зберегти її відкриття тут.',
    read: 'Відкрити знання',
    replay: 'Переглянути перевірену спробу',
    next: 'Наступна незавершена вправа',
    finale: 'Ваш навчальний нотатник польотів',
    finaleTeaser: 'Завершіть усі дванадцять різних вправ у будь-якому режимі.',
    finaleText:
      'Ви поєднали газ, нахил, імпульс, курс і оцінку підходу у дванадцяти різних вправах. Повертайтесь до вправ і перевірених спроб; ця вигадана модель не засвідчує навички керування реальним апаратом.',
    acroTitle: 'Відзнака Acro',
    acroTeaser: 'Завершіть усі дванадцять різних вправ в Acro.',
    acroText:
      'У нотатнику є дванадцять завершень в Acro. Центрування стіків задає нульову кутову швидкість; воно не вирівнює апарат і не зупиняє його рух.',
    cosmetic: 'Крила нотатника польотів',
    saved: 'Збережено на цьому пристрої',
    session: 'Лише цей сеанс — експортуйте перед виходом',
    export: 'Експортувати перевірені спроби',
    import: 'Імпортувати й перевірити спроби',
    cancel: 'Скасувати імпорт',
    cancelled: 'Імпорт скасовано. Завершені збереження залишаються.',
    backup: 'Резервна копія спроб у JSON',
    backupPart: (part, total) =>
      `Частина резервної копії ${part} із ${total}. Скопіюйте й збережіть кожну частину; імпортуйте їх усі для відновлення спроб.`,
    previousPart: 'Попередня частина копії',
    nextPart: 'Наступна частина копії',
    retry: 'Повторити збереження',
    busy: 'Перевірка записів польоту…',
    empty: 'Завершених спроб ще немає. Усі вправи доступні для вільної практики.',
    missing: 'Деякі точні записи недоступні. Зароблені відкриття залишаються у колекції.',
    failed: 'Не вдалося перевірити чи зберегти спробу.',
  },
};
export function flightRewardDefinitions(courses) {
  const requirement = (course, modes) => ({
    model: FLIGHT_MODEL,
    course: course.id,
    courseIdentity: dataIdentity(course),
    modes,
    responseIdentities: null,
  });
  const make = (id, scope, selected, modes, copy) => ({
    format: 'revealline-completion-reward.v2',
    id,
    revision: 'r1',
    brandId: BRAND,
    campaignId: CAMPAIGN,
    scope,
    locales: Object.fromEntries(
      ['en', 'uk'].map((lang) => [lang, { title: copy[lang].title, teaser: copy[lang].teaser }]),
    ),
    requirements: {
      missions: [],
      learning: [],
      mastery: [],
      practice: selected.map((course) => requirement(course, modes)),
    },
    payloads: [
      {
        id: id + '-knowledge',
        type: 'knowledge',
        locales: Object.fromEntries(
          ['en', 'uk'].map((lang) => [
            lang,
            { title: copy[lang].title, paragraphs: [copy[lang].lesson] },
          ]),
        ),
      },
    ],
  });
  const definitions = courses.map((course) =>
    make(
      course.id + '-discovery',
      { kind: 'practice', id: course.id },
      [course],
      ['self-level', 'acro'],
      Object.fromEntries(
        ['en', 'uk'].map((lang) => [lang, { ...course.locales[lang], teaser: COPY[lang].locked }]),
      ),
    ),
  );
  definitions.push(
    make(
      'flight-notebook-finale',
      { kind: 'campaign', id: CAMPAIGN },
      courses,
      ['self-level', 'acro'],
      Object.fromEntries(
        ['en', 'uk'].map((lang) => [
          lang,
          {
            title: COPY[lang].finale,
            teaser: COPY[lang].finaleTeaser,
            lesson: COPY[lang].finaleText,
          },
        ]),
      ),
    ),
  );
  definitions.push(
    make(
      'flight-all-acro',
      { kind: 'campaign', id: CAMPAIGN },
      courses,
      ['acro'],
      Object.fromEntries(
        ['en', 'uk'].map((lang) => [
          lang,
          {
            title: COPY[lang].acroTitle,
            teaser: COPY[lang].acroTeaser,
            lesson: COPY[lang].acroText,
          },
        ]),
      ),
    ),
  );
  definitions.at(-2).payloads.push({
    id: 'notebook-wings',
    type: 'cosmetic',
    recipeId: 'flight-notebook-wings',
    recipeRevision: 'r1',
    locales: { en: { title: COPY.en.cosmetic }, uk: { title: COPY.uk.cosmetic } },
  });
  return validateCompletionRewards(definitions);
}
/** Registered cosmetic presentation. This only decorates the notebook/airframe. */
export const FLIGHT_COSMETICS = Object.freeze({
  'flight-notebook-wings': Object.freeze({
    id: 'flight-notebook-wings',
    revision: 'r1',
    color: '#ffd06e',
    label: '✦',
  }),
});
export function createFlightNotebook({
  courses,
  indexedDB = globalThis.indexedDB,
  onStatus = () => {},
}) {
  let closed = false,
    closing = null;
  const ensureOpen = (signal) => {
    if (closed) throw new DOMException('Flight notebook is closed', 'AbortError');
    signal?.throwIfAborted();
  };
  const definitions = flightRewardDefinitions(courses);
  const attempts = createFlightAttemptStore({ courses, indexedDB, onStatus });
  const rewards = createRewardStore({
    editionId: FLIGHT_EDITION_ID,
    backend: createRewardBackend({ editionId: FLIGHT_EDITION_ID, indexedDB }),
    onStatus,
  });
  const context = (practice) => ({
    editionId: FLIGHT_EDITION_ID,
    brandId: BRAND,
    campaignIds: [CAMPAIGN],
    clears: {},
    learning: [],
    mastery: [],
    practice,
  });
  const reconcile = async () => {
    ensureOpen();
    rewards.reconcile(definitions, context(attempts.records()), {
      persist: true,
      persistenceContext: context(attempts.durableRecords()),
    });
    await rewards.settled();
  };
  const ready = (async () => {
    await attempts.load();
    ensureOpen();
    await rewards.load();
    ensureOpen();
    await reconcile();
  })();
  // The exposed ready promise still rejects for callers. Attach a handler now
  // because disposal may cancel hydration before the view starts awaiting it.
  void ready.catch(() => {});
  return {
    ready,
    async accept(proof, options = {}) {
      ensureOpen(options.signal);
      await ready;
      ensureOpen(options.signal);
      const accepted = await attempts.accept(proof, options);
      ensureOpen(options.signal);
      await reconcile();
      ensureOpen(options.signal);
      return accepted;
    },
    async import(input, options = {}) {
      ensureOpen(options.signal);
      await ready;
      ensureOpen(options.signal);
      const status = await attempts.import(input, options);
      ensureOpen(options.signal);
      await reconcile();
      ensureOpen(options.signal);
      return status;
    },
    export: () => attempts.export(),
    exportParts: () => attempts.exportParts(),
    async retry(options = {}) {
      ensureOpen(options.signal);
      await ready;
      ensureOpen(options.signal);
      await attempts.retry(options);
      ensureOpen(options.signal);
      await reconcile();
    },
    snapshot: () => ({
      definitions,
      rewards: rewards.snapshot(),
      attempts: attempts.summaries(),
      storage: attempts.status(),
      rewardStorage: rewards.status(),
    }),
    proof: (hash) => attempts.proof(hash),
    close() {
      if (closing) return closing;
      closed = true;
      // Cancel attempts before awaiting ready: hydration itself may be the
      // operation waiting for verification or an IndexedDB request.
      const stopped = attempts.close();
      closing = Promise.allSettled([stopped, ready]).then(() => rewards.close());
      return closing;
    },
  };
}
export function mountFlightNotebook({
  container,
  window: win,
  courses,
  locale = 'en',
  onReview = () => {},
  onPractice = () => {},
  onCosmetic = () => {},
}) {
  let copy = COPY[locale] ?? COPY.en;
  const doc = container.ownerDocument,
    book = createFlightNotebook({ courses, indexedDB: win.indexedDB });
  let disposed = false,
    reader = null,
    selectedDefinition = null,
    activeImport = null,
    activity = null,
    backupParts = [],
    backupPart = 0;
  const make = (tag, text, parent = container) => {
    const node = doc.createElement(tag);
    if (text !== undefined) node.textContent = text;
    parent.append(node);
    return node;
  };
  const heading = make('h2', copy.title);
  const status = make('p', copy.busy);
  status.setAttribute('role', 'status');
  const progress = make('p'),
    next = make('button', copy.next),
    grid = make('div'),
    detail = make('section');
  grid.className = 'flight-notebook-grid';
  detail.setAttribute('aria-live', 'polite');
  const transferLabel = make('label'),
    transferTitle = make('span', copy.backup, transferLabel),
    transfer = make('textarea', undefined, transferLabel);
  transfer.rows = 4;
  transfer.maxLength = 32 * 1024 * 1024;
  const exportButton = make('button', copy.export),
    importButton = make('button', copy.import),
    cancelImport = make('button', copy.cancel),
    retry = make('button', copy.retry),
    backupStatus = make('p'),
    previousPart = make('button', copy.previousPart),
    nextPart = make('button', copy.nextPart);
  backupStatus.setAttribute('role', 'status');
  const backupButtons = [previousPart, nextPart];
  for (const button of [next, exportButton, importButton, cancelImport, retry, ...backupButtons])
    button.type = 'button';
  cancelImport.hidden = true;
  const safe = async (operation) => {
    if (disposed) throw new DOMException('Flight notebook is closed', 'AbortError');
    activity = { kind: 'busy' };
    status.textContent = copy.busy;
    try {
      const result = await operation();
      activity = null;
      if (!disposed) render();
      return result;
    } catch (error) {
      activity = {
        kind: error.name === 'AbortError' ? 'cancelled' : 'failed',
        error: error.message,
      };
      if (!disposed) render();
      throw error;
    }
  };
  function renderBackup() {
    backupStatus.hidden = !backupParts.length;
    backupStatus.textContent = backupParts.length
      ? copy.backupPart(backupPart + 1, backupParts.length)
      : '';
    for (const button of backupButtons) button.hidden = backupParts.length <= 1;
    previousPart.disabled = backupPart === 0;
    nextPart.disabled = backupPart >= backupParts.length - 1;
  }
  function showBackupPart(part) {
    if (disposed || part < 0 || part >= backupParts.length) return;
    backupPart = part;
    transfer.value = backupParts[part];
    renderBackup();
  }
  exportButton.onclick = () =>
    safe(() => {
      backupParts = book.exportParts().map((part) => JSON.stringify(part));
      showBackupPart(0);
    }).catch(() => {});
  previousPart.onclick = () => showBackupPart(backupPart - 1);
  nextPart.onclick = () => showBackupPart(backupPart + 1);
  transfer.oninput = () => {
    // An edited/pasted import must not be overwritten by stale export navigation.
    backupParts = [];
    backupPart = 0;
    renderBackup();
  };
  renderBackup();
  importButton.onclick = () => {
    if (disposed || activeImport) return;
    const controller = new AbortController(),
      input = transfer.value;
    activeImport = controller;
    importButton.disabled = retry.disabled = true;
    cancelImport.hidden = false;
    return safe(() => book.import(input, { signal: controller.signal }))
      .catch(() => {})
      .finally(() => {
        if (activeImport === controller) activeImport = null;
        if (disposed) return;
        importButton.disabled = retry.disabled = false;
        const restoreFocus = doc.activeElement === cancelImport;
        cancelImport.hidden = true;
        if (restoreFocus) importButton.focus();
      });
  };
  cancelImport.onclick = () =>
    activeImport?.abort(new DOMException('Import cancelled', 'AbortError'));
  retry.onclick = () => safe(() => book.retry()).catch(() => {});
  function render() {
    if (disposed) return;
    const state = book.snapshot(),
      earned = new Map(state.rewards.receipts.map((receipt) => [receipt.definition.id, receipt]));
    const completed = courses.filter((course) => earned.has(course.id + '-discovery')).length,
      acro = new Set(
        state.attempts.filter((item) => item.mode === 'acro').map((item) => item.course),
      ).size;
    progress.textContent = `${completed}/${courses.length} ${copy.progress} · ${acro}/${courses.length} ${copy.acro}`;
    status.textContent = state.storage.error
      ? `${copy.session}: ${state.storage.error}`
      : state.rewardStorage.error
        ? `${copy.session}: ${state.rewardStorage.error}`
        : state.storage.saved && state.rewardStorage.durable
          ? copy.saved
          : copy.session;
    if (
      !state.attempts.length &&
      !state.rewards.receipts.length &&
      !state.storage.error &&
      !state.rewardStorage.error
    )
      status.textContent = copy.empty;
    if (activity?.kind === 'busy') status.textContent = copy.busy;
    else if (activity?.kind === 'cancelled') status.textContent = copy.cancelled;
    else if (activity?.kind === 'failed') status.textContent = `${copy.failed} ${activity.error}`;
    const nextCourse =
      courses.find((course) => !earned.has(course.id + '-discovery')) ?? courses[0];
    next.onclick = () => onPractice(nextCourse.id);
    grid.replaceChildren();
    for (const definition of state.definitions) {
      const receipt = earned.get(definition.id),
        shown = receipt?.definition ?? definition,
        article = make('article', undefined, grid);
      make('h3', shown.locales[locale].title, article);
      make('p', receipt ? '✓' : shown.locales[locale].teaser, article);
      if (receipt) {
        const open = make('button', copy.read, article);
        open.type = 'button';
        open.onclick = () => {
          selectedDefinition = shown;
          reader?.dispose();
          detail.replaceChildren();
          make('h3', shown.locales[locale].title, detail);
          reader = mountRewardKnowledge({
            container: detail,
            payload: shown.payloads.find((item) => item.type === 'knowledge'),
            locale,
          });
          detail.tabIndex = -1;
          detail.focus();
        };
      }
      const matching = state.attempts.filter((item) =>
        shown.requirements.practice.some(
          (req) =>
            req.model === item.model &&
            req.course === item.course &&
            req.courseIdentity === item.courseIdentity &&
            req.modes.includes(item.mode) &&
            (req.responseIdentities === null ||
              req.responseIdentities.includes(item.responseIdentity)),
        ),
      );
      if (matching.length) {
        const attempt = matching.at(-1),
          review = make('button', copy.replay, article);
        review.type = 'button';
        review.onclick = () => onReview(book.proof(attempt.hash));
        make(
          'p',
          `${(attempt.ticks / 50).toFixed(1)} s · ${attempt.mode} · ${attempt.contacts} ${copy.contacts}`,
          article,
        );
      }
    }
    const cosmetic = earned
      .get('flight-notebook-finale')
      ?.definition.payloads.find((item) => item.type === 'cosmetic');
    if (cosmetic) {
      const recipe = FLIGHT_COSMETICS[cosmetic.recipeId];
      if (recipe?.revision === cosmetic.recipeRevision) {
        container.style.setProperty('--notebook-accent', recipe.color);
        onCosmetic(recipe);
      }
    }
  }
  const ready = book.ready
    .then(() => {
      if (!disposed) render();
    })
    .catch((error) => {
      if (!disposed) status.textContent = error.message;
    });
  return {
    ready,
    accept: (proof) => safe(() => book.accept(proof)),
    snapshot: book.snapshot,
    setLocale(nextLocale) {
      if (disposed) return;
      locale = Object.hasOwn(COPY, nextLocale) ? nextLocale : 'en';
      copy = COPY[locale];
      heading.textContent = copy.title;
      next.textContent = copy.next;
      transferTitle.textContent = copy.backup;
      exportButton.textContent = copy.export;
      importButton.textContent = copy.import;
      cancelImport.textContent = copy.cancel;
      retry.textContent = copy.retry;
      previousPart.textContent = copy.previousPart;
      nextPart.textContent = copy.nextPart;
      renderBackup();
      reader?.dispose();
      detail.replaceChildren();
      if (selectedDefinition) {
        make('h3', selectedDefinition.locales[locale].title, detail);
        reader = mountRewardKnowledge({
          container: detail,
          payload: selectedDefinition.payloads.find((item) => item.type === 'knowledge'),
          locale,
        });
      }
      render();
    },
    async dispose() {
      if (disposed) return book.close();
      disposed = true;
      activeImport?.abort(new DOMException('Flight notebook is closed', 'AbortError'));
      reader?.dispose();
      for (const button of [next, exportButton, importButton, cancelImport, retry, ...backupButtons])
        button.onclick = null;
      transfer.oninput = null;
      backupParts = [];
      transfer.value = '';
      container.replaceChildren();
      await book.close();
    },
  };
}
