import { getLocale, onLocaleChange, t } from '../i18n/index.mjs';
import { createControlLabModel } from '../learning/control-lab.mjs';

/** Reusable optional educational viewer. Its owner only supplies an input
 * release hook; there is no Journey, reward, simulator or hardware adapter. */
export function mountControlLab({
  document: doc,
  window: win = globalThis,
  fixture,
  beforeOpen = () => {},
  id = 'control-lab',
}) {
  let model = createControlLabModel(fixture),
    disposed = false,
    opener = null;
  const tr = (key, values) => t(`interface:controlLab.${key}`, values);
  const node = (tag, className) => {
    const element = doc.createElement(tag);
    if (className) element.className = className;
    return element;
  };
  const button = (action) => {
    const element = node('button', 'button secondary');
    element.type = 'button';
    element.onclick = action;
    return element;
  };
  const dialog = node('dialog', 'control-lab-dialog');
  dialog.id = id;
  const title = node('h2'),
    summary = node('p'),
    mode = node('p', 'control-lab-notice'),
    limits = node('p', 'control-lab-notice'),
    instructions = node('p');
  title.id = `${id}-title`;
  instructions.id = `${id}-instructions`;
  dialog.setAttribute('aria-labelledby', title.id);
  dialog.setAttribute('aria-describedby', instructions.id);
  const options = node('div', 'control-lab-options'),
    staticLabel = node('label'),
    staticInput = node('input'),
    staticText = node('span');
  staticInput.type = 'checkbox';
  staticInput.id = `${id}-static`;
  staticLabel.append(staticInput, staticText);
  const motionPreference = win.matchMedia?.('(prefers-reduced-motion: reduce)');
  staticInput.checked =
    motionPreference?.matches === true || doc.body.dataset.effects === 'reduced';
  const resetButton = button(reset),
    closeButton = button(() => dialog.close());
  resetButton.id = `${id}-reset`;
  closeButton.id = `${id}-close`;
  options.append(staticLabel, resetButton);
  const grid = node('div', 'control-lab-grid');
  const rows = new Map();
  for (const control of model.snapshot().controls) {
    const row = node('fieldset', 'control-lab-control'),
      legend = node('legend'),
      mapping = node('p', 'control-lab-mapping'),
      explanation = node('p');
    const figure = node('figure', `control-lab-figure control-lab-${control.id}`),
      diagram = node('div', 'control-lab-diagram'),
      craft = node('div', 'control-lab-craft'),
      caption = node('figcaption');
    figure.setAttribute('aria-hidden', 'true');
    for (let index = 0; index < 4; index++)
      craft.append(node('span', `control-lab-rotor rotor-${index}`));
    const arrow = node('span', 'control-lab-thrust-arrow');
    arrow.textContent = '↑ ↑ ↑';
    craft.append(arrow);
    diagram.append(craft);
    figure.append(diagram, caption);
    const label = node('label'),
      input = node('input'),
      output = node('output'),
      direction = node('p', 'control-lab-direction');
    input.id = `${id}-${control.id}`;
    input.type = 'range';
    input.min = String(control.min);
    input.max = String(control.max);
    input.step = '0.05';
    label.setAttribute('for', input.id);
    output.setAttribute('for', input.id);
    output.setAttribute('aria-hidden', 'true');
    explanation.id = `${input.id}-explanation`;
    input.setAttribute('aria-describedby', explanation.id);
    input.addEventListener('input', () => {
      if (disposed || !dialog.open) {
        reset();
        return;
      }
      model.set(control.id, Number(input.value));
      renderValues();
    });
    row.append(legend, mapping, figure, label, input, output, direction, explanation);
    rows.set(control.id, {
      row,
      legend,
      mapping,
      explanation,
      craft,
      caption,
      label,
      input,
      output,
      direction,
    });
    grid.append(row);
  }
  const sources = node('details'),
    sourcesTitle = node('summary'),
    sourceList = node('ul');
  sources.append(sourcesTitle, sourceList);
  const author = node('details', 'control-lab-author'),
    authorTitle = node('summary'),
    fixtureLabel = node('label'),
    fixtureText = node('span'),
    editor = node('textarea'),
    authorStatus = node('p');
  editor.id = `${id}-fixture`;
  editor.rows = 8;
  editor.maxLength = 65536;
  editor.spellcheck = false;
  fixtureLabel.append(fixtureText, editor);
  authorStatus.setAttribute('role', 'status');
  const exportButton = button(() => {
    editor.value = model.export();
    authorStatus.textContent = tr('exported');
    editor.focus();
    editor.select?.();
  });
  exportButton.id = `${id}-export`;
  const importButton = button(() => {
    try {
      const next = createControlLabModel(editor.value);
      model = next;
      render();
      authorStatus.textContent = tr('imported');
    } catch {
      authorStatus.textContent = tr('invalid');
    }
  });
  importButton.id = `${id}-import`;
  author.append(authorTitle, fixtureLabel, exportButton, importButton, authorStatus);
  dialog.append(
    title,
    summary,
    mode,
    limits,
    instructions,
    options,
    grid,
    sources,
    author,
    closeButton,
  );
  doc.body.append(dialog);

  function renderValues() {
    const snapshot = model.snapshot(getLocale(), staticInput.checked);
    dialog.dataset.reducedMotion = String(staticInput.checked);
    for (const control of snapshot.controls) {
      const row = rows.get(control.id);
      const value = Math.round(control.value * 100);
      row.input.value = String(control.value);
      row.input.setAttribute('aria-valuetext', `${tr('value', { value })}. ${control.description}`);
      row.output.textContent = tr('value', { value });
      row.direction.textContent = control.description;
      row.mapping.textContent =
        control.value === 0
          ? tr(control.id === 'throttle' ? 'idle' : 'centered')
          : tr(
              `${control.value > 0 ? 'positive' : 'negative'}${control.id[0].toUpperCase()}${control.id.slice(1)}`,
            );
      row.craft.style.transform = `rotate(${control.diagramAngle}deg)`;
      row.craft.style.setProperty(
        '--control-lab-thrust',
        String(staticInput.checked ? 0 : control.value),
      );
    }
  }
  function render() {
    const snapshot = model.snapshot(getLocale(), staticInput.checked);
    title.textContent = snapshot.title;
    summary.textContent = snapshot.summary;
    mode.textContent = tr('modeNote');
    limits.textContent = tr('limits');
    instructions.textContent = tr('instructions');
    staticText.textContent = tr('static');
    resetButton.textContent = tr('reset');
    closeButton.textContent = tr('close');
    for (const control of snapshot.controls) {
      const row = rows.get(control.id);
      row.legend.textContent = control.copy.title;
      row.label.textContent = tr(`${control.id}Mapping`);
      row.explanation.textContent = control.copy.explanation;
      row.caption.textContent = tr(control.view);
    }
    sourcesTitle.textContent = tr('sources');
    sourceList.replaceChildren(
      ...model.fixture().sources.map((source) => {
        const item = node('li'),
          link = node('a');
        link.href = source.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = source.title;
        item.append(link);
        return item;
      }),
    );
    authorTitle.textContent = tr('author');
    fixtureText.textContent = tr('fixture');
    exportButton.textContent = tr('export');
    importButton.textContent = tr('import');
    renderValues();
  }
  function reset() {
    model.reset();
    renderValues();
  }
  staticInput.onchange = renderValues;
  const preferenceChanged = (event) => {
    staticInput.checked = event.matches;
    renderValues();
  };
  motionPreference?.addEventListener?.('change', preferenceChanged);
  const visibility = () => {
    if (doc.hidden) reset();
  };
  for (const event of ['blur', 'gamepaddisconnected', 'pagehide'])
    win.addEventListener(event, reset);
  doc.addEventListener('visibilitychange', visibility);
  dialog.addEventListener('close', () => {
    reset();
    if (!disposed && !doc.hidden && opener?.isConnected) opener.focus({ preventScroll: true });
  });
  const stopLocale = onLocaleChange(render);
  render();
  return {
    open(from, nextFixture) {
      if (disposed) return false;
      if (nextFixture) model = createControlLabModel(nextFixture);
      beforeOpen();
      opener = from ?? doc.activeElement;
      model.reset();
      if (doc.body.dataset.effects === 'reduced') staticInput.checked = true;
      render();
      if (!dialog.open) dialog.showModal();
      rows.get('throttle').input.focus();
      return true;
    },
    close() {
      if (dialog.open) dialog.close();
    },
    snapshot: () => model.snapshot(getLocale(), staticInput.checked),
    export: () => model.export(),
    dispose() {
      if (disposed) return;
      disposed = true;
      model.reset();
      stopLocale();
      motionPreference?.removeEventListener?.('change', preferenceChanged);
      for (const event of ['blur', 'gamepaddisconnected', 'pagehide'])
        win.removeEventListener(event, reset);
      doc.removeEventListener('visibilitychange', visibility);
      if (dialog.open) dialog.close();
      dialog.remove();
    },
  };
}
