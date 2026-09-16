/** Text only: callers own input modality, bindings and reading behavior. */
export function readingInputPrompt({
  modality,
  scrollable,
  controls = { confirm: 'South', back: 'East' },
} = {}) {
  const scroll = !scrollable
    ? 'All text is visible'
    : modality === 'controller' || modality === 'keyboard'
      ? 'Up/Down scroll'
      : 'Scroll to read';
  const exit =
    modality === 'controller'
      ? `${controls.confirm} or ${controls.back}`
      : modality === 'keyboard'
        ? 'Enter, Space or Escape'
        : 'Done reading';
  return `${scroll} · ${exit} returns`;
}
