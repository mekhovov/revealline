import { t, localizedText, localizedAttribute, getLocale, onLocaleChange } from '../i18n/index.mjs';
import { BUILTIN_THEME_FAMILIES, resolvePresentation } from '../presentation/theme-system.mjs';
import { mountThemeMaterialPreview } from './theme-material-preview.mjs';
import { mountEnemyAppearanceControls } from './enemy-appearance-controls.mjs';

/** One immediate appearance choice; the host owns atomic loads and flight boundaries. */
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
  const enemyAppearance = mountEnemyAppearanceControls({
    document: doc,
    container: group,
    locale: getLocale,
    applyMilitary: () => host.applyComplete('military-field'),
    applyAuthored: () => host.set({ arcadeArt: 'authored' }),
  });
  release.push(enemyAppearance.dispose, onLocaleChange(enemyAppearance.refresh));
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
  const themeHeading = doc.createElement('h4');
  themeHeading.id = `${prefix}theme-family-heading`;
  text(themeHeading, 'familyId');
  group.append(themeHeading);
  const gallery = doc.createElement('div');
  gallery.className = 'theme-gallery';
  gallery.setAttribute('role', 'group');
  gallery.setAttribute('aria-labelledby', themeHeading.id);
  localizedAttribute(gallery, 'aria-description', () => t('interface:workshop.previewThemes'));
  group.append(gallery);
  const builtinIds = new Set(BUILTIN_THEME_FAMILIES.map((item) => item.id));
  const choose = (id) => host.applyComplete(id);
  const syncChoices = (state) => {
    const choices = host.availableThemeChoices();
    const known = new Set(choices.map((item) => item.id));
    for (const [id, card] of cards) {
      if (known.has(id)) continue;
      card.stop();
      card.button.remove();
      cards.delete(id);
    }
    for (const [index, item] of choices.entries()) {
      let card = cards.get(item.id);
      if (!card) {
        const button = doc.createElement('button'),
          title = doc.createElement('strong'),
          swatches = doc.createElement('span'),
          preview = doc.createElement('span'),
          description = doc.createElement('small');
        button.type = 'button';
        button.id = `${prefix}theme-card-${item.id}`;
        button.className = 'theme-preview-card';
        button.setAttribute('data-theme-preview', item.id);
        swatches.className = 'theme-preview-swatches';
        swatches.setAttribute('aria-hidden', 'true');
        preview.setAttribute('data-theme-card-preview', '');
        button.append(title, preview, swatches, description);
        const material = mountThemeMaterialPreview({
          document: doc,
          root: preview,
          interactive: false,
          compact: true,
        });
        const activate = () => choose(item.id);
        button.addEventListener('click', activate);
        card = {
          button,
          title,
          swatches,
          description,
          material,
          stop: () => {
            button.removeEventListener('click', activate);
            material.dispose();
          },
        };
        cards.set(item.id, card);
      }
      // Stable nodes preserve keyboard/controller focus through loading, status
      // updates and accessibility changes; only changed inventories move nodes.
      if (gallery.children[index] !== card.button)
        gallery.insertBefore(card.button, gallery.children[index] ?? null);
      const label = () =>
        item.id === 'follow-game'
          ? t('interface:workshop.followContext')
          : builtinIds.has(item.id)
            ? t(`interface:workshop.theme.${item.id}`)
            : `${item.family.name} · ${item.family.revision}`;
      localizedText(card.title, label);
      localizedText(card.description, () =>
        builtinIds.has(item.id) || item.id === 'follow-game'
          ? t(`interface:workshop.description.${item.id}`)
          : t('interface:workshop.description.curated', { revision: item.family.revision }),
      );
      card.material.update(
        resolvePresentation({
          themeFamily: item.family,
          interfaceTheme: item.interfaceTheme,
          interfaceBasis: item.basis,
          accessibility: {
            ...host.snapshot()?.accessibility,
            highContrast: state.highContrast,
            opaqueHud: state.opaqueHud,
          },
          ornaments: state.ornaments === 'theme' ? 'subtle' : state.ornaments,
        }),
      );
      const tokens = item.interfaceTheme?.tokens ?? {},
        colors = ['ink', 'panel', 'text', 'accent'].map((role) => tokens[role]);
      if (card.colors !== JSON.stringify(colors)) {
        card.colors = JSON.stringify(colors);
        card.swatches.replaceChildren();
        for (const color of colors) {
          const chip = doc.createElement('span');
          chip.style.setProperty('background-color', color ?? 'currentColor');
          card.swatches.append(chip);
        }
      }
    }
  };
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
    syncChoices(state);
    for (const [id, card] of cards)
      card.button.setAttribute('aria-pressed', String(id === state.familyId));
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
      for (const card of cards.values()) card.stop();
      group.remove();
      hiddenRows.forEach(([label, hidden]) => {
        label.hidden = hidden;
      });
    },
  };
}
