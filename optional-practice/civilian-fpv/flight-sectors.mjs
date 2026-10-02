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
