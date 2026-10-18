// Observations of objective completion only. Never part of simulation or proof identity.
const MAX_SECTORS = 64;
const MAX_TICKS = 36000;
const tick = (value) => Number.isSafeInteger(value) && value >= 0 && value <= MAX_TICKS;

function validSectors(value) {
  if (!Array.isArray(value) || value.length > MAX_SECTORS) return false;
  let end = 0;
  for (let index = 0; index < value.length; index++) {
    const row = value[index];
    if (
      !row ||
      typeof row !== 'object' ||
      Array.isArray(row) ||
      Object.keys(row).length !== 3 ||
      !['index', 'ticks', 'endTick'].every((key) => Object.hasOwn(row, key)) ||
      row.index !== index ||
      !tick(row.ticks) ||
      !tick(row.endTick) ||
      row.endTick !== end + row.ticks
    )
      return false;
    end = row.endTick;
  }
  return true;
}

/** Feed every consumed simulation tick. Prefixes must come from verified replay;
 * validation establishes their shape, never their provenance or compatibility. */
export function createSectorTracker(prefix = []) {
  let sectors, last, observed;
  const reset = (initial = []) => {
    if (!validSectors(initial)) throw new TypeError('Invalid completed sector prefix');
    sectors = initial.map((row) => ({ ...row }));
    last = sectors.at(-1)?.endTick ?? 0;
    observed = last;
  };
  reset(prefix);
  return {
    consume(state) {
      if (
        !state ||
        !tick(state.ticks) ||
        state.ticks < observed ||
        !Number.isSafeInteger(state.step) ||
        state.step < sectors.length ||
        state.step > MAX_SECTORS
      )
        throw new TypeError(
          'Sector observations must advance monotonically; reset for a new flight',
        );
      for (let index = sectors.length; index < state.step; index++) {
        sectors.push({ index, ticks: state.ticks - last, endTick: state.ticks });
        // Several objectives at one tick share one boundary: only the first has elapsed time.
        last = state.ticks;
      }
      observed = state.ticks;
    },
    snapshot: () => sectors.map((row) => ({ ...row })),
    reset,
    latest(reference = []) {
      const sector = sectors.at(-1);
      if (!sector) return null;
      // Reference validation fails closed. The caller also verifies its proof and identity.
      const compared = validSectors(reference) ? reference[sector.index] : null;
      return {
        ...sector,
        referenceTicks: compared?.ticks ?? null,
        referenceEndTick: compared?.endTick ?? null,
        sectorDelta: compared ? sector.ticks - compared.ticks : null,
        cumulativeDelta: compared ? sector.endTick - compared.endTick : null,
      };
    },
  };
}

/** Unscored observations, never replay evidence. Recovery starts unknown history. */
export function createPracticeSectorObserver() {
  let origin = null,
    current = null,
    boundary = null,
    rows = [];
  const valid = (state) =>
    state &&
    ['ticks', 'step', 'total'].every(
      (key) => Number.isSafeInteger(state[key]) && state[key] >= 0,
    ) &&
    state.step <= state.total &&
    state.total <= MAX_SECTORS;
  return {
    reset(state) {
      if (!valid(state)) return false;
      origin = current = { ticks: state.ticks, step: state.step, total: state.total };
      boundary = state.ticks === 0 && state.step === 0 ? 0 : null;
      rows = [];
      return true;
    },
    consume(state) {
      if (
        !current ||
        !valid(state) ||
        state.total !== current.total ||
        state.ticks - current.ticks !== 1 ||
        state.step < current.step
      )
        return false;
      for (let index = current.step; index < state.step; index++) {
        rows.push({
          index,
          endTick: state.ticks,
          ticks: boundary === null ? null : state.ticks - boundary,
        });
        boundary = state.ticks;
      }
      current = { ticks: state.ticks, step: state.step, total: state.total };
      return true;
    },
    snapshot: () =>
      current && {
        ...current,
        originTick: origin.ticks,
        originStep: origin.step,
        partial: origin.ticks !== 0 || origin.step !== 0,
        rows: rows.map((row) => ({ ...row })),
      },
  };
}

/** Pause-panel presentation; updates only when observations or language change. */
export function mountPracticeSplits({ parent, locale = () => 'en' }) {
  const doc = parent.ownerDocument,
    root = doc.createElement('section');
  root.dataset.practiceSplits = 'true';
  root.hidden = true;
  const heading = doc.createElement('h3'),
    help = doc.createElement('p'),
    list = doc.createElement('ol');
  root.append(heading, help, list);
  parent.append(root);
  let owner = null,
    observer = null,
    reference = null,
    noCourse = false,
    disposed = false,
    painted = '';
  const t = (en, uk) => (locale() === 'uk' ? uk : en);
  const paint = () => {
    if (disposed || root.hidden) return;
    try {
      const state = observer?.snapshot();
      const key = JSON.stringify([
        locale(),
        noCourse,
        state?.originTick,
        state?.originStep,
        state?.rows,
        reference,
      ]);
      if (key === painted) return;
      painted = key;
      heading.textContent = t('Practice splits · unscored', 'Час ділянок практики · без заліку');
      help.textContent = noCourse
        ? t('No course splits in free flight.', 'У вільному польоті немає ділянок курсу.')
        : !state
          ? t('Observed timing unavailable.', 'Спостережуваний час недоступний.')
          : t(
              'Observed at 50 Hz mission steps. No record or score.',
              'Спостереження за кроками місії 50 Гц. Без рекордів чи балів.',
            ) +
            (state.partial
              ? ` ${t('Earlier timings are unavailable after recovery or interrupted observation.', 'Попередній час недоступний після відновлення чи перерваного спостереження.')}`
              : '');
      if (reference)
        help.textContent += ` ${t('Split reference', 'Орієнтир часу')}: ${reference.name}.`;
      list.replaceChildren();
      list.hidden = noCourse || !state;
      if (!noCourse && state) {
        const rows = reference
          ? reference.rows.map(
              (entry) =>
                state.rows.find((row) => row.index === entry.index) ?? { index: entry.index },
            )
          : state.rows.length
            ? state.rows
            : [null];
        for (const row of rows) {
          const item = doc.createElement('li');
          item.textContent = row
            ? `${t('Objective', 'Завдання')} ${row.index + 1}: ${row.ticks === undefined ? t('not observed', 'ще не спостерігалося') : row.ticks === null ? t('start time unavailable', 'час початку недоступний') : `${(row.ticks / 50).toFixed(2)} ${t('s', 'с')}`}`
            : t('No observed splits yet.', 'Ще немає спостережуваних ділянок.');
          const compared = row && reference?.rows[row.index];
          if (compared) {
            item.textContent += ` · ${t('reference', 'орієнтир')} ${(compared.ticks / 50).toFixed(2)} ${t('s', 'с')}`;
            if (Number.isSafeInteger(row.ticks)) {
              const delta = (row.ticks - compared.ticks) / 50;
              item.textContent += ` · Δ ${delta > 0 ? '+' : ''}${delta.toFixed(2)} ${t('s', 'с')}`;
            }
          }
          list.append(item);
        }
      }
    } catch {
      unavailable();
    }
  };
  const unavailable = () => {
    observer = null;
    reference = null;
    painted = '';
    try {
      help.textContent = t('Observed timing unavailable.', 'Спостережуваний час недоступний.');
      list.hidden = true;
    } catch {
      /* Optional presentation has no simulation authority. */
    }
  };
  const guard =
    (operation, fallback = null) =>
    (...args) => {
      if (disposed) return fallback;
      try {
        return operation(...args);
      } catch {
        unavailable();
        return fallback;
      }
    };
  const reset = (session, state) => {
    if (disposed || session !== owner || noCourse) return;
    observer = createPracticeSectorObserver();
    reference = null;
    observer.reset(state);
    painted = '';
    paint();
  };
  return {
    root,
    update: guard((session, state, { enabled = false, freeFlight = false } = {}) => {
      if (disposed) return;
      freeFlight ||= state?.total === 0;
      root.hidden = !enabled;
      if (!enabled) {
        owner = observer = reference = null;
        painted = '';
        return;
      }
      if (owner !== session || noCourse !== freeFlight) {
        owner = session;
        noCourse = freeFlight;
        observer = null;
        reference = null;
        reset(session, state);
        painted = '';
      }
      const previous = observer?.snapshot();
      if (
        !noCourse &&
        (!previous || ['ticks', 'step', 'total'].some((key) => previous[key] !== state[key]))
      )
        reset(session, state);
      paint();
    }),
    consume: guard(
      (session, state) => session === owner && Boolean(observer?.consume(state)),
      false,
    ),
    restored: guard(reset),
    setReference: guard((session, value) => {
      if (session !== owner || noCourse || !observer?.snapshot()) return false;
      if (value !== null) {
        if (
          typeof value?.name !== 'string' ||
          value.name.length > 120 ||
          !Array.isArray(value.rows) ||
          value.rows.length !== observer.snapshot().total ||
          value.rows.length === 0 ||
          value.rows.length > MAX_SECTORS
        )
          return false;
        let end = 0;
        for (const [index, row] of value.rows.entries()) {
          if (
            row?.index !== index ||
            !Number.isSafeInteger(row.ticks) ||
            row.ticks < 0 ||
            !Number.isSafeInteger(row.endTick) ||
            row.endTick !== end + row.ticks
          )
            return false;
          end = row.endTick;
        }
      }
      reference = value && {
        name: value.name,
        rows: value.rows.map(({ index, ticks, endTick }) => ({ index, ticks, endTick })),
      };
      paint();
      return true;
    }, false),
    snapshot: guard(() => observer?.snapshot() ?? null),
    dispose: guard(() => {
      disposed = true;
      owner = observer = reference = null;
      root.remove();
    }),
  };
}
