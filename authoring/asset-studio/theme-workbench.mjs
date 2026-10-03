import { localizedText, localizedAttribute, t, formatNumber } from '../../game/i18n/index.mjs';
import { installThemeHost } from '../../game/presentation/theme-host.mjs';
import {
  applyResolvedPresentation,
  resolvePresentation as resolveInterface,
  BUILTIN_THEME_FAMILIES,
  COMPONENT_ROLES,
  getThemeFamily,
  getInterfaceTheme,
} from '../../game/presentation/theme-system.mjs';
import { createThemeCandidate } from '../../game/presentation/theme-preview.mjs';
import { inspectStudioTheme } from '../../game/presentation/studio-inspection.mjs';
import { createStudioDownload } from './download.mjs';
import { mountArcadeSpecimen } from './arcade-specimen.mjs';

const copy = (key, values) => t(`tools:studio.themes.${key}`, values);
/** Editor chrome follows the accepted global choice. Candidate materials are
 * scoped to the specimen, never installed as player preferences. */
export function mountThemeWorkbench({ document, window, onAction, onWarning }) {
  let current = null,
    inspection = null,
    closeArcadeSpecimen = null,
    removeSpecimen = null,
    disposed = false;
  const node = (tag, key, className = '') => {
    const element = document.createElement(tag);
    element.className = className;
    if (key) localizedText(element, () => copy(key));
    return element;
  };
  const label = (key, control) => {
    const item = node('label');
    item.append(node('span', key), control);
    return item;
  };
  const select = (entries, id) => {
    const element = node('select');
    element.id = id;
    for (const [value, key] of entries) {
      const option = node('option', key);
      option.value = value;
      element.append(option);
    }
    return element;
  };
  const familySelect = (id, first = []) => {
    const input = select(first, id);
    for (const family of BUILTIN_THEME_FAMILIES) {
      const option = node('option');
      option.value = family.id;
      localizedText(option, () =>
        t(`interface:workshop.theme.${family.id}`, { defaultValue: family.name }),
      );
      input.append(option);
    }
    return input;
  };
  const button = (key, action) => {
    const element = node('button', key);
    element.type = 'button';
    element.onclick = action;
    return element;
  };
  const section = node('details', null, 'theme-workbench');
  section.id = 'theme-workbench';
  section.append(node('summary', 'title'));
  document.querySelector('.studio-header').after(section);
  const library = node('div', null, 'theme-library-controls');
  const workspaces = select([], 'theme-workspace');
  const name = node('input');
  name.id = 'theme-workspace-name';
  name.maxLength = 80;
  localizedAttribute(name, 'placeholder', () => copy('untitled'));
  const create = (duplicate) =>
    onAction(duplicate ? 'duplicate' : 'create', {
      name: name.value.trim() || copy('untitled'),
      ...candidateOptions(),
    });
  library.append(
    label('workspace', workspaces),
    label('name', name),
    button('create', () => create(false)),
    button('duplicate', () => create(true)),
  );
  workspaces.onchange = () => onAction('select', { id: workspaces.value });
  const importing = node('div', null, 'theme-library-controls');
  const mode = select(
    [
      ['new', 'importNew'],
      ['duplicate', 'importDuplicate'],
      ['replace', 'importReplace'],
    ],
    'theme-workspace-import-mode',
  );
  const file = node('input');
  file.type = 'file';
  file.accept = '.rltheme,application/vnd.revealline.theme';
  file.id = 'theme-workspace-import';
  file.onchange = () => {
    const incoming = file.files[0];
    file.value = '';
    if (incoming) onAction('import', { file: incoming, mode: mode.value, name: name.value.trim() });
  };
  importing.append(label('importMode', mode), label('import', file));
  section.append(library, importing, node('p', 'libraryHelp', 'support-copy'));
  const candidateFamily = familySelect('theme-candidate-family');
  candidateFamily.value = 'industrial-workshop';
  for (const option of candidateFamily.options) {
    const family = getThemeFamily(option.value);
    localizedText(
      option,
      () =>
        `${t(`interface:workshop.theme.${family.id}`, { defaultValue: family.name })} (${family.revision})`,
    );
  }
  const basisStatus = node('p', null, 'support-copy');
  basisStatus.id = 'theme-candidate-basis-status';
  basisStatus.setAttribute('role', 'status');
  const basisLabel = node('label');
  const basisTitle = node('span', 'candidateFamily');
  basisLabel.append(basisTitle, candidateFamily);
  section.append(basisLabel, basisStatus);
  const runtimeExport = button('exportRuntime', () =>
    onAction('export-runtime', candidateOptions()),
  );
  runtimeExport.id = 'theme-export-runtime';
  section.append(runtimeExport, node('p', 'runtimeExportHelp', 'support-copy'));
  const defaults = node('button');
  defaults.type = 'button';
  defaults.id = 'theme-community-defaults';
  localizedText(defaults, () => copy('defaults'));
  defaults.onclick = () => onAction('configure-defaults', candidateOptions());
  section.append(defaults);
  const interfaceRow = node('div', null, 'theme-library-controls');
  const family = select([], 'studio-theme-family');
  const editorChoices = new Map();
  const contrast = node('input');
  contrast.type = 'checkbox';
  const opaque = node('input');
  opaque.type = 'checkbox';
  const notice = node('p', null, 'support-copy');
  notice.setAttribute('role', 'status');
  const host = installThemeHost({ document, window, studio: true });
  const syncEditorThemes = () => {
    const choices = host.availableThemeChoices(),
      ids = new Set(choices.map((item) => item.id));
    for (const [id, option] of editorChoices) {
      if (ids.has(id)) continue;
      option.remove();
      editorChoices.delete(id);
    }
    for (const [index, item] of choices.entries()) {
      let option = editorChoices.get(item.id);
      if (!option) {
        option = node('option');
        option.value = item.id;
        editorChoices.set(item.id, option);
      }
      localizedText(option, () =>
        item.id === 'follow-game'
          ? t('interface:workshop.followContext')
          : BUILTIN_THEME_FAMILIES.some((value) => value.id === item.id)
            ? t(`interface:workshop.theme.${item.id}`, { defaultValue: item.family.name })
            : `${item.family.name} · ${item.family.revision}`,
      );
      if (family.children[index] !== option)
        family.insertBefore(option, family.children[index] ?? null);
    }
    family.value = host.preferences.snapshot().familyId;
  };
  syncEditorThemes();
  const stopHostStatus = host.subscribeStatus((message) => {
    notice.textContent = message;
    if (message) onWarning?.(message);
  });
  const stopHost = host.subscribe((resolved) => {
    syncEditorThemes();
    contrast.checked = host.preferences.snapshot().highContrast;
    opaque.checked = host.preferences.snapshot().opaqueHud;
    renderSpecimen();
  });
  const change = (patch) => {
    try {
      host.set(patch);
    } catch (error) {
      notice.textContent = error.message;
    }
  };
  family.onchange = () => {
    try {
      host.applyComplete(family.value);
    } catch (error) {
      notice.textContent = error.message;
    }
  };
  contrast.onchange = () => change({ highContrast: contrast.checked });
  opaque.onchange = () => change({ opaqueHud: opaque.checked });
  interfaceRow.append(
    label('editorTheme', family),
    label('highContrast', contrast),
    label('opaqueHud', opaque),
  );
  section.append(interfaceRow, node('p', 'editorHelp', 'support-copy'), notice);

  const specimen = node('details');
  specimen.append(node('summary', 'specimen'));
  const fixture = familySelect('theme-specimen-family', [['workspace', 'workspaceCandidate']]);
  specimen.append(label('specimenTheme', fixture), node('p', 'specimenHelp', 'support-copy'));
  const surface = node('div', null, 'theme-specimen field-kit');
  surface.id = 'theme-specimen';
  const mission = node('section', null, 'theme-specimen-mission');
  mission.dataset.component = 'panel';
  mission.append(
    node('p', 'missionLabel', 'theme-specimen-eyebrow'),
    node('h2', 'missionTitle'),
    node('p', 'missionDescription'),
  );
  const toolbar = node('div', null, 'button-row');
  const primary = button('continue', () => {});
  primary.className = 'primary';
  primary.dataset.component = 'button';
  const back = button('back', () => {});
  back.dataset.component = 'button';
  toolbar.append(primary, back);
  mission.append(toolbar);
  const meter = node('progress');
  meter.max = 100;
  meter.value = 68;
  meter.dataset.component = 'progress';
  localizedAttribute(meter, 'aria-label', () => copy('progress'));
  mission.append(meter);
  surface.append(mission);
  const states = node('div', null, 'theme-state-grid');
  for (const state of [
    'default',
    'hover',
    'focus',
    'pressed',
    'selected',
    'disabled',
    'loading',
    'error',
  ]) {
    const card = node('div', null, 'theme-state-card');
    const control = button(`state.${state}`, () => {});
    control.dataset.component = 'button';
    control.dataset.state = state;
    if (state === 'disabled') control.disabled = true;
    if (state === 'selected') control.setAttribute('aria-pressed', 'true');
    if (state === 'loading') control.setAttribute('aria-busy', 'true');
    if (state === 'error') control.setAttribute('aria-invalid', 'true');
    card.append(control);
    states.append(card);
  }
  surface.append(states);
  const input = node('input');
  input.type = 'text';
  input.dataset.component = 'input';
  localizedAttribute(input, 'placeholder', () => copy('inputPlaceholder'));
  surface.append(label('input', input));
  const recipeControls = node('div', null, 'theme-library-controls'),
    recipeRole = select([], 'theme-recipe-role'),
    recipeState = select(
      ['default', 'hover', 'focus', 'pressed', 'selected', 'disabled', 'loading', 'error'].map(
        (state) => [state, `state.${state}`],
      ),
      'theme-recipe-state',
    ),
    recipePreview = node('div', null, 'theme-state-card');
  recipePreview.id = 'theme-recipe-preview';
  for (const role of COMPONENT_ROLES) {
    const option = node('option');
    option.value = role;
    option.textContent = role;
    recipeRole.append(option);
  }
  localizedAttribute(recipeRole, 'aria-label', () => copy('componentRecipe'));
  localizedAttribute(recipeState, 'aria-label', () => copy('componentState'));
  recipeControls.append(recipeRole, recipeState);
  surface.append(recipeControls, recipePreview);
  recipeRole.onchange = renderSpecimen;
  recipeState.onchange = renderSpecimen;
  specimen.append(surface);
  const previewLinks = node('div', null, 'button-row');
  previewLinks.append(button('runtimePreview', () => onAction('preview')));
  const arcadePreview = node('div');
  const arcadeButton = button('arcadePreview', () => {
    if (!current) return;
    closeArcadeSpecimen?.();
    closeArcadeSpecimen = mountArcadeSpecimen({
      document,
      target: arcadePreview,
      source: current.document,
      assets: current.assets,
      interfacePresentation: candidateInterface(),
      ...candidateOptions(),
    });
  });
  previewLinks.append(arcadeButton);
  const sim = node('a', 'simPreview');
  sim.href = '../fpv-worlds/calibration.html';
  sim.onclick = (event) => {
    event.preventDefault();
    if (!basisAvailable()) return;
    onAction('preview-sim', candidateOptions());
  };
  previewLinks.append(sim);
  specimen.append(previewLinks, node('p', 'simHelp', 'support-copy'));
  specimen.append(arcadePreview);
  section.append(specimen);

  const report = node('details');
  report.append(node('summary', 'report'));
  const facts = node('p');
  const contrastReport = node('p');
  const role = node('pre', null, 'theme-role-report');
  const reportDownload = node('div');
  const download = createStudioDownload({ document, target: reportDownload });
  report.append(
    facts,
    contrastReport,
    node('p', 'reportHelp', 'support-copy'),
    role,
    button('exportReport', () => {
      if (inspection)
        download.offer(
          new Blob([JSON.stringify(inspection, null, 2)], { type: 'application/json' }),
          `${inspection.document.id}-inspection.json`,
        );
    }),
    reportDownload,
  );
  section.append(report);
  fixture.onchange = renderSpecimen;
  candidateFamily.onchange = () => {
    const family = getThemeFamily(candidateFamily.value);
    if (!family) return;
    onAction('set-basis', {
      familyId: family.id,
      familyRevision: family.revision,
      interfaceId: family.interface.id,
      interfaceRevision: family.interface.revision,
    });
  };
  let inspectedDocument = null,
    inspectedSlot = null;
  function candidateInterface() {
    const candidate = createThemeCandidate(current.document, candidateOptions());
    return resolveInterface({
      themeFamily: candidate.family,
      interfaceTheme: candidate.interfaceTheme,
      interfaceBasis: candidate.basis,
      density: 'player',
      accessibility: host.snapshot()?.accessibility ?? {},
    });
  }
  function candidateOptions() {
    return current?.document.appearanceBasis ?? { familyId: candidateFamily.value };
  }
  function basisAvailable() {
    const basis = candidateOptions();
    const family = getThemeFamily(basis.familyId, basis.familyRevision);
    return !!(
      family &&
      getInterfaceTheme(
        basis.interfaceId ?? family.interface.id,
        basis.interfaceRevision ?? family.interface.revision,
      )
    );
  }
  function showBasis(source) {
    for (const option of [...candidateFamily.options])
      if (option.dataset.savedBasis) option.remove();
    const basis = source.appearanceBasis;
    if (basis) {
      const currentFamily = getThemeFamily(basis.familyId);
      if (
        currentFamily?.revision === basis.familyRevision &&
        currentFamily.interface.id === basis.interfaceId &&
        currentFamily.interface.revision === basis.interfaceRevision
      ) {
        candidateFamily.value = basis.familyId;
      } else {
        const option = node('option');
        option.dataset.savedBasis = 'true';
        option.value = `${basis.familyId}@${basis.familyRevision}`;
        option.textContent = `${getThemeFamily(basis.familyId, basis.familyRevision)?.name ?? basis.familyId} (${basis.familyRevision}; ${basis.interfaceId}@${basis.interfaceRevision})`;
        candidateFamily.append(option);
        candidateFamily.value = option.value;
      }
    } else candidateFamily.value = 'industrial-workshop';
    const available = basisAvailable();
    runtimeExport.disabled = defaults.disabled = arcadeButton.disabled = !available;
    sim.setAttribute('aria-disabled', String(!available));
    localizedText(basisStatus, () =>
      available
        ? basis
          ? copy('basisSaved', {
              family: basis.familyId,
              revision: basis.familyRevision,
              interface: basis.interfaceId,
              interfaceRevision: basis.interfaceRevision,
            })
          : ''
        : copy('basisUnavailable'),
    );
    return available;
  }
  function renderSpecimen() {
    if (!current || disposed) return;
    const choice = fixture.value;
    const accepted = host.snapshot();
    if (choice === 'workspace' && !basisAvailable()) {
      removeSpecimen?.();
      removeSpecimen = null;
      recipePreview.replaceChildren(node('p', 'basisUnavailable'));
      return;
    }
    const resolved =
      choice === 'workspace'
        ? candidateInterface()
        : resolveInterface({
            familyId: choice,
            density: 'player',
            accessibility: accepted?.accessibility ?? {},
          });
    removeSpecimen?.();
    removeSpecimen = applyResolvedPresentation(surface, resolved);
    renderRecipe();
  }
  function renderRecipe() {
    const role = recipeRole.value || COMPONENT_ROLES[0],
      state = recipeState.value || 'default',
      preserveFocus = recipePreview.contains(document.activeElement);
    const kind = ['button', 'primary', 'danger', 'tab'].includes(role)
      ? 'button'
      : ['input', 'checkbox', 'radio', 'slider'].includes(role)
        ? 'input'
        : role === 'progress'
          ? 'progress'
          : role === 'table'
            ? 'table'
            : 'section';
    const sample = node(kind);
    sample.dataset.component = role;
    sample.dataset.state = state;
    if (kind === 'input') {
      sample.type = { checkbox: 'checkbox', radio: 'radio', slider: 'range' }[role] ?? 'text';
      if (role === 'input') sample.value = copy('inputPlaceholder');
      if (['checkbox', 'radio'].includes(role)) sample.checked = state === 'selected';
      if (role === 'slider') {
        sample.min = '0';
        sample.max = '100';
        sample.value = '68';
      }
    } else if (kind === 'progress') {
      sample.max = 100;
      sample.value = 68;
    } else if (kind === 'table') {
      const row = node('tr'),
        cell = node('td');
      cell.textContent = `${role} · ${copy(`state.${state}`)}`;
      if (state === 'selected') row.setAttribute('aria-selected', 'true');
      row.append(cell);
      sample.append(row);
    } else sample.textContent = `${role} · ${copy(`state.${state}`)}`;
    sample.setAttribute('aria-label', `${role} · ${copy(`state.${state}`)}`);
    if (state === 'disabled') {
      if (['button', 'input'].includes(kind)) sample.disabled = true;
      else sample.setAttribute('aria-disabled', 'true');
    }
    if (state === 'loading') sample.setAttribute('aria-busy', 'true');
    if (state === 'error') sample.setAttribute('aria-invalid', 'true');
    if (kind === 'button') {
      sample.type = 'button';
      sample.dataset.uiAction = ['primary', 'danger'].includes(role) ? role : 'secondary';
      sample.setAttribute('aria-pressed', String(state === 'selected'));
    } else if (kind === 'section') {
      sample.dataset.uiSurface =
        { dialog: 'dialog', toolbar: 'toolbar', slot: 'inset', scrollbar: 'inset' }[role] ??
        'panel';
      if (role === 'hud') sample.className = 'hud';
      if (role === 'inspector') sample.className = 'creator-inspector';
      if (role === 'notification') sample.setAttribute('role', 'status');
      if (role === 'tooltip') sample.setAttribute('role', 'tooltip');
      if (role === 'scrollbar') {
        sample.tabIndex = 0;
        sample.style.maxHeight = '88px';
        sample.style.overflow = 'auto';
        for (let index = 0; index < 6; index++) {
          const line = node('p');
          line.textContent = `${role} · ${index + 1}`;
          sample.append(line);
        }
      }
    }
    let preview = sample;
    if (['checkbox', 'radio'].includes(role)) {
      preview = node('label');
      const caption = node('span');
      caption.textContent = `${role} · ${copy(`state.${state}`)}`;
      preview.append(sample, caption);
    } else if (role === 'tab') {
      preview = node('div');
      preview.setAttribute('role', 'tablist');
      sample.setAttribute('role', 'tab');
      sample.removeAttribute('aria-pressed');
      sample.setAttribute('aria-selected', String(state === 'selected'));
      preview.append(sample);
    }
    // The runtime stylesheet owns colors, material finish, state lighting and
    // focus. Uploaded asset/frame inspection is a separate component specimen.
    recipePreview.replaceChildren(preview);
    if (preserveFocus && !sample.disabled) sample.focus();
  }
  function refreshInspection(source, selected) {
    if (!basisAvailable()) {
      inspection = null;
      facts.textContent = contrastReport.textContent = '';
      role.textContent = JSON.stringify({ appearanceBasis: source.appearanceBasis }, null, 2);
      download.dispose();
      return;
    }
    inspection = inspectStudioTheme(source, selected, candidateOptions());
    const counts = inspection.coverage.counts;
    localizedText(facts, () =>
      copy('facts', {
        reviewed: counts.reviewed,
        total: source.slots.length,
        produced: counts.produced,
        source: counts.source,
        metadata: formatNumber(inspection.bytes.metadata),
        selected: formatNumber(inspection.bytes.selectedFiles),
        history: formatNumber(inspection.bytes.historyFiles),
      }),
    );
    localizedText(contrastReport, () =>
      copy('contrastFacts', {
        count: inspection.contrast.filter((row) => row.passes).length,
        total: inspection.contrast.length,
      }),
    );
    role.textContent = JSON.stringify(
      { candidate: inspection.candidate, role: inspection.role, contrast: inspection.contrast },
      null,
      2,
    );
    download.dispose();
  }
  return Object.freeze({
    update({ library: index, activeId, document: source, assets, selected }) {
      if (disposed) return;
      if (current && (current.document !== source || current.assets !== assets)) {
        closeArcadeSpecimen?.();
        closeArcadeSpecimen = null;
      }
      current = { document: source, assets };
      showBasis(source);
      const before = [...workspaces.options]
        .map((option) => `${option.value}:${option.textContent}`)
        .join('|');
      const after = index.entries.map((entry) => `${entry.id}:${entry.name}`).join('|');
      if (before !== after)
        workspaces.replaceChildren(
          ...index.entries.map((entry) => {
            const option = node('option');
            option.value = entry.id;
            option.textContent = entry.name;
            return option;
          }),
        );
      workspaces.value = activeId ?? '';
      if (inspectedDocument !== source || inspectedSlot !== selected) {
        inspectedDocument = source;
        inspectedSlot = selected;
        refreshInspection(source, selected);
        renderSpecimen();
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      removeSpecimen?.();
      closeArcadeSpecimen?.();
      stopHost();
      stopHostStatus();
      host.dispose();
      download.dispose();
      section.remove();
    },
  });
}
