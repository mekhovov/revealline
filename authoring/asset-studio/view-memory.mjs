export const STUDIO_VIEW_KEY = 'reveallineAssetStudioView';
const fields = { query: 160, screen: 80, state: 40, kind: 16, quality: 32 };
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function checked(value) {
  if (
    !record(value) ||
    value.version !== 1 ||
    Object.keys(value).some((key) => !['version', 'selected', 'filters'].includes(key)) ||
    typeof value.selected !== 'string' ||
    !value.selected.length ||
    value.selected.length > 160 ||
    !record(value.filters) ||
    Object.keys(value.filters).length !== Object.keys(fields).length ||
    Object.entries(fields).some(
      ([key, limit]) => typeof value.filters[key] !== 'string' || value.filters[key].length > limit,
    )
  )
    return null;
  return { version: 1, selected: value.selected, filters: { ...value.filters } };
}

/** Per-history-entry inspection position. Never stores assets, themes or player data. */
export function createStudioViewMemory(getHistory) {
  return {
    read() {
      try {
        return checked(getHistory()?.state?.[STUDIO_VIEW_KEY]);
      } catch {
        return null;
      }
    },
    write(selected, filters) {
      const view = checked({ version: 1, selected, filters });
      if (!view) return false;
      try {
        const history = getHistory(),
          current = history?.state;
        if (!history || (current !== null && current !== undefined && !record(current)))
          return false;
        const previous = current?.[STUDIO_VIEW_KEY];
        if (previous?.version !== undefined && previous.version !== 1) return false;
        history.replaceState({ ...current, [STUDIO_VIEW_KEY]: view }, '');
        return true;
      } catch {
        return false;
      }
    },
  };
}

/** Reconcile remembered choices against the loaded document and current filter options. */
export function resolveStudioView(value, slotIds, allowedFilters) {
  const view = checked(value);
  if (!view) return null;
  return {
    selected: slotIds.includes(view.selected) ? view.selected : null,
    filters: Object.fromEntries(
      Object.keys(fields).map((key) => [
        key,
        key === 'query' || allowedFilters[key]?.includes(view.filters[key])
          ? view.filters[key]
          : '',
      ]),
    ),
  };
}
