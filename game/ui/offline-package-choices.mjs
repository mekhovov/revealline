import { gameplaySelection } from '../offline-download-session.mjs';

/** Checkboxes show effective consent, including native modes selected by All. */
export function syncOfflinePackageChoices({ catalogue, selected, allInput, inputs }) {
  const chosen = new Set(
    gameplaySelection(catalogue, { all: allInput.checked, selected: [...selected] }),
  );
  for (const input of inputs) {
    const group = catalogue.groups.find((item) => item.id === input.dataset.group);
    input.checked =
      chosen.has(group.id) ||
      (group.category === 'community' &&
        (allInput.checked || group.requires.every((id) => selected.has(id))));
  }
}

/** Expand All before removing one choice, preserving the other approved games. */
export function attachOfflinePackageChoice(
  input,
  { group, catalogue, selected, allInput, enabled = () => true, onChange = () => {} },
) {
  input.onchange = () => {
    if (!enabled()) return;
    if (input.checked) selected.add(group.id);
    else {
      const effective = gameplaySelection(catalogue, {
        all: allInput.checked,
        selected: [...selected],
      });
      const includedByAll = gameplaySelection(catalogue, { all: true }).includes(group.id);
      if (allInput.checked && (group.category === 'community' || includedByAll)) {
        effective.forEach((id) => selected.add(id));
        allInput.checked = false;
      }
      selected.delete(group.id);
      if (group.category === 'community') group.requires.forEach((id) => selected.delete(id));
    }
    if (!['community', 'experience', 'extra'].includes(group.category)) allInput.checked = false;
    onChange();
  };
}
