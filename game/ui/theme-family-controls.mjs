import { t, localizedText, localizedAttribute } from '../i18n/index.mjs';
import { BUILTIN_THEME_FAMILIES, getInterfaceTheme } from '../presentation/theme-system.mjs';

/** One appearance choice; previews never write preferences or restart a flight. */
export function attachThemeFamilyControls({
  document: doc,
  root,
  host,
  prefix = '',
  legacyPalette,
  legacyOrnaments,
}) {
  if (!root || !host) return { dispose() {} };
  const group = doc.createElement('section');
  group.className = 'theme-family-controls';
  group.setAttribute('data-theme-controls', '');
  const release = [],
    controls = new Map(),
    cards = new Map(),
    hiddenRows = [];
  const text = (node, key) => localizedText(node, () => t(`interface:workshop.${key}`));
  const heading = doc.createElement('h3');
  text(heading, 'appearance');
  group.append(heading);
  const row = (key, parent = group) => {
    const label = doc.createElement('label'),
      title = doc.createElement('span');
    text(title, key);
    label.append(title);
    parent.append(label);
    return label;
  };
  const select = (key, entries, parent = group) => {
    const label = row(key, parent),
      title = label.querySelector('span'),
      input = doc.createElement('select');
    title.id = `${prefix}theme-${key}-label`;
    input.id = `${prefix}theme-${key}`;
    input.setAttribute('aria-labelledby', title.id);
    input.setAttribute('data-theme-preference', key);
    for (const [value, labelKey] of entries) {
      const option = doc.createElement('option');
      option.value = value;
      text(option, labelKey);
      input.append(option);
    }
    label.append(input);
    controls.set(key, input);
    return input;
  };
  const family = select('familyId', [
    ['follow-game', 'followContext'],
    ...BUILTIN_THEME_FAMILIES.map((value) => [value.id, `theme.${value.id}`]),
  ]);
  const gallery = doc.createElement('div');
  gallery.className = 'theme-gallery';
  gallery.setAttribute('role', 'group');
  localizedAttribute(gallery, 'aria-label', () => t('interface:workshop.previewThemes'));
  group.append(gallery);
  let committed = host.preferences.snapshot().familyId,
    draft = committed;
  const renderDraft = () => {
    family.value = draft;
    for (const [id, card] of cards) card.setAttribute('aria-pressed', String(id === draft));
  };
  for (const item of BUILTIN_THEME_FAMILIES.filter((value) => value.id !== 'legacy')) {
    const source = getInterfaceTheme(item.interface.id, item.interface.revision),
      button = doc.createElement('button');
    button.type = 'button';
    button.id = `${prefix}theme-card-${item.id}`;
    button.className = 'theme-preview-card';
    button.setAttribute('data-theme-preview', item.id);
    const title = doc.createElement('strong');
    text(title, `theme.${item.id}`);
    const swatches = doc.createElement('span');
    swatches.className = 'theme-preview-swatches';
    swatches.setAttribute('aria-hidden', 'true');
    for (const role of ['ink', 'panel', 'text', 'accent']) {
      const chip = doc.createElement('span');
      chip.style.setProperty('background-color', source.tokens[role]);
      swatches.append(chip);
    }
    const description = doc.createElement('small');
    text(description, `description.${item.id}`);
    button.append(swatches, title, description);
    gallery.append(button);
    cards.set(item.id, button);
    const choose = () => {
      draft = item.id;
      renderDraft();
    };
    button.addEventListener('click', choose);
    release.push(() => button.removeEventListener('click', choose));
  }
  const chooseFamily = () => {
    draft = family.value;
    renderDraft();
  };
  family.addEventListener('change', chooseFamily);
  release.push(() => family.removeEventListener('change', chooseFamily));
  const apply = doc.createElement('button');
  apply.type = 'button';
  apply.id = `${prefix}theme-apply`;
  apply.className = 'primary';
  text(apply, 'applyComplete');
  group.append(apply);
  const applyChoice = () => {
    host.applyComplete(draft);
  };
  apply.addEventListener('click', applyChoice);
  release.push(() => apply.removeEventListener('click', applyChoice));
  const customization = doc.createElement('details'),
    summary = doc.createElement('summary');
  summary.id = `${prefix}theme-customize`;
  text(summary, 'customize');
  customization.append(summary);
  group.append(customization);
  for (const [key, entries] of [
    [
      'arcadeArt',
      [
        ['follow-game', 'followGame'],
        ['authored', 'authored'],
      ],
    ],
    [
      'ornaments',
      [
        ['theme', 'themeDetail'],
        ['off', 'detailOff'],
        ['subtle', 'detailSubtle'],
        ['rich', 'detailRich'],
      ],
    ],
  ]) {
    const input = select(key, entries, customization),
      change = () => host.set({ [key]: input.value });
    input.addEventListener('change', change);
    release.push(() => input.removeEventListener('change', change));
  }
  const accessibility = doc.createElement('div');
  accessibility.className = 'theme-accessibility';
  group.append(accessibility);
  for (const key of ['highContrast', 'opaqueHud']) {
    const label = row(key, accessibility),
      input = doc.createElement('input');
    input.type = 'checkbox';
    input.id = `${prefix}theme-${key}`;
    input.setAttribute('data-theme-preference', key);
    label.prepend(input);
    controls.set(key, input);
    const change = () => host.set({ [key]: input.checked });
    input.addEventListener('change', change);
    release.push(() => input.removeEventListener('change', change));
  }
  const hint = doc.createElement('p');
  hint.className = 'micro-note';
  text(hint, 'help');
  const status = doc.createElement('p');
  status.className = 'micro-note';
  status.setAttribute('role', 'status');
  group.append(hint, status);
  for (const input of [legacyPalette, legacyOrnaments]) {
    const label = input?.closest?.('label');
    if (label) {
      hiddenRows.push([label, label.hidden]);
      label.hidden = true;
    }
  }
  const legacyRow = legacyPalette?.closest?.('label');
  if (legacyRow?.parentElement === root && root.insertBefore) root.insertBefore(group, legacyRow);
  else root.append(group);
  const render = (state) => {
    const known = new Set(BUILTIN_THEME_FAMILIES.map((item) => item.id));
    for (const option of [...family.options]) if (option.dataset.curatedTheme) option.remove();
    for (const item of host.availableFamilies?.() ?? []) {
      if (known.has(item.id)) continue;
      const option = doc.createElement('option');
      option.value = item.id;
      option.dataset.curatedTheme = 'true';
      option.textContent = `${item.name} · ${item.revision}`;
      family.append(option);
    }
    if (state.familyId !== committed) draft = state.familyId;
    committed = state.familyId;
    renderDraft();
    for (const [key, input] of controls)
      if (key !== 'familyId') {
        if (input.type === 'checkbox') input.checked = state[key];
        else input.value = state[key];
      }
    const customized = state.arcadeArt !== 'follow-game' || state.ornaments !== 'theme';
    localizedText(summary, () =>
      t(`interface:workshop.${customized ? 'customized' : 'customize'}`),
    );
    localizedText(status, () => host.getWarning());
  };
  release.push(host.preferences.subscribe(render));
  release.push(host.subscribe(() => render(host.preferences.snapshot())));
  release.push(host.subscribeStatus((message) => localizedText(status, () => message)));
  return {
    dispose() {
      release.forEach((stop) => stop());
      group.remove();
      hiddenRows.forEach(([label, hidden]) => {
        label.hidden = hidden;
      });
    },
  };
}
