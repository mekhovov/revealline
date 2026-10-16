import { localizedText, t } from '../i18n/index.mjs';
import { applyResolvedPresentation } from '../presentation/theme-system.mjs';

/** The same material specimen serves the chooser and Theme Studio. Chooser
 * samples are inert phrasing content inside one real selection button. Studio
 * uses native controls, without writing any gameplay or appearance preference. */
export function mountThemeMaterialPreview({
  document: doc,
  root,
  resolved,
  interactive = true,
  compact = false,
}) {
  const tag = interactive ? 'div' : 'span';
  const node = (tagName, key, className = '') => {
    const item = doc.createElement(tagName);
    item.className = className;
    if (key) localizedText(item, () => t(`interface:workshop.materialPreview.${key}`));
    return item;
  };
  root.classList.add('theme-material-preview');
  root.dataset.previewCompact = String(compact);
  if (!interactive) {
    root.setAttribute('aria-hidden', 'true');
    root.setAttribute('inert', '');
  }
  const panel = node(tag, null, 'theme-material-panel');
  panel.dataset.uiSurface = 'panel';
  const actions = node(tag, null, 'theme-material-actions');
  const states = node(tag, null, 'theme-material-states');
  const action = (key, state, primary = false) => {
    const item = node(interactive ? 'button' : 'span', key, 'button theme-material-action');
    if (interactive) item.type = 'button';
    item.dataset.materialPreviewControl = key;
    if (primary) item.dataset.uiAction = 'primary';
    if (state === 'disabled') {
      if (interactive) item.disabled = true;
      else item.setAttribute('aria-disabled', 'true');
    } else if (state === 'loading') item.setAttribute('aria-busy', 'true');
    else if (state) item.dataset.state = state;
    return item;
  };
  actions.append(action('mission'), action('launch', null, true));
  for (const state of compact
    ? ['hover', 'pressed', 'focus']
    : ['hover', 'pressed', 'focus', 'loading', 'disabled'])
    states.append(action(state, state));
  const field = node(interactive ? 'label' : 'span', null, 'theme-material-field');
  field.append(node('span', 'detail'));
  if (interactive) {
    const select = node('select');
    select.dataset.materialPreviewControl = 'select';
    for (const key of ['balanced', 'detailed']) {
      const option = node('option', key);
      option.value = key;
      select.append(option);
    }
    field.append(select);
  } else {
    const select = node('span', 'balanced', 'theme-material-select');
    select.dataset.materialPreviewControl = 'select';
    field.append(select);
  }
  const check = node(interactive ? 'label' : 'span', null, 'theme-material-check');
  const checkbox = node(interactive ? 'input' : 'span', null, 'theme-material-checkbox');
  if (interactive) {
    checkbox.type = 'checkbox';
    checkbox.setAttribute('type', 'checkbox');
    checkbox.checked = true;
  } else checkbox.textContent = '✓';
  checkbox.dataset.materialPreviewControl = 'checkbox';
  check.append(checkbox, node('span', 'telemetry'));
  panel.append(actions, states, field, check);
  root.append(panel);
  let release = null,
    identity = null;
  const update = (next) => {
    if (!next || identity === next.identity) return;
    release?.();
    identity = next.identity;
    release = applyResolvedPresentation(root, next);
  };
  update(resolved);
  return {
    update,
    dispose() {
      release?.();
      release = null;
      panel.remove();
    },
  };
}
