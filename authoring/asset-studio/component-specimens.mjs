import { FIELD_KIT_ICON_IDS, iconForSlot } from '../../game/presentation/icons.mjs';
import { localizedAttribute, localizedText, t } from '../../game/i18n/index.mjs';
let specimenId = 0;
const specimenKind = (kind) => t(`tools:studio.componentSpecimen.kind.${kind}`);
const specimenState = (state) => t(`tools:studio.componentSpecimen.state.${state}`);
const text = (doc, tag, value, className = '', hostRole = null) => {
  const node = doc.createElement(tag);
  if (value !== '') localizedText(node, value);
  node.className = className;
  if (hostRole) node.dataset.studioHost = hostRole;
  return node;
};

/** Native, isolated component samples; no presentation host, telemetry or storage. */
export function componentPreview(surface, slot, options, backgroundImage = null) {
  const doc = surface.ownerDocument,
    node = (tag, value = '', className = '', hostRole = null) =>
      text(doc, tag, value, className, hostRole),
    box = node('div', '', 'recipe-sample component-specimen'),
    state = options.state,
    selected = ['selected', 'pressed'].includes(state),
    inputKind = slot.id.startsWith('ui.input.') ? slot.id.slice(9) : null,
    buttonKind = slot.id.startsWith('ui.button.') ? slot.id.slice(10) : null,
    semantic = FIELD_KIT_ICON_IDS.includes(slot.id);
  box.dataset.state = state;
  box.dataset.specimenSlot = slot.id;
  box.append(node('h3', slot.label));
  let target = box;
  if (inputKind === 'scrollbar') {
    target = node('div', '', 'specimen-scrollbar');
    target.tabIndex = 0;
    target.setAttribute('role', 'region');
    localizedAttribute(target, 'aria-label', () =>
      t('tools:studio.componentSpecimen.scrollableRegion'),
    );
    for (let i = 1; i <= 6; i++)
      target.append(node('p', () => t('tools:studio.componentSpecimen.row', { index: i })));
    box.append(target);
  } else if (inputKind) {
    const label = node('label', () =>
      t('tools:studio.componentSpecimen.previewControl', { kind: specimenKind(inputKind) }),
    );
    target = node(inputKind === 'select' ? 'select' : 'input');
    if (inputKind === 'select') {
      target.append(
        node('option', () => t('interface:display.textSize.standard')),
        node('option', () => t('interface:large')),
      );
    } else {
      target.type =
        { checkbox: 'checkbox', radio: 'radio', toggle: 'checkbox', slider: 'range' }[inputKind] ||
        'text';
      target.setAttribute('type', target.type);
      if (['checkbox', 'radio', 'toggle'].includes(inputKind)) {
        target.checked = selected;
        if (inputKind === 'toggle') target.setAttribute('role', 'switch');
      } else if (inputKind === 'slider') {
        target.min = '0';
        target.max = '100';
        target.value = '62';
      } else
        localizedAttribute(target, 'placeholder', () =>
          t('tools:studio.componentSpecimen.callsignPlaceholder'),
        );
    }
    target.disabled = state === 'disabled';
    localizedAttribute(target, 'aria-label', () =>
      t('tools:studio.componentSpecimen.inputLabel', { kind: specimenKind(inputKind) }),
    );
    if (state === 'error') target.setAttribute('aria-invalid', 'true');
    label.append(target);
    box.append(label);
  } else if (slot.id.startsWith('ui.meter.')) {
    target = node('progress');
    target.max = 100;
    target.value = 62;
    localizedAttribute(target, 'aria-label', () =>
      t('tools:studio.componentSpecimen.meterLabel', { label: slot.label, value: 62, max: 100 }),
    );
    box.append(
      target,
      node(
        'p',
        () => t('tools:studio.componentSpecimen.sampleValue', { value: 62, max: 100 }),
        '',
        'secondary',
      ),
    );
  } else if (slot.id === 'ui.tooltip') {
    const trigger = node('button', () => t('tools:studio.componentSpecimen.tooltipTrigger'));
    trigger.type = 'button';
    target = node(
      'span',
      () => t('tools:studio.componentSpecimen.tooltipText'),
      'specimen-tooltip',
    );
    target.id = `component-tooltip-${++specimenId}`;
    target.setAttribute('role', 'tooltip');
    trigger.setAttribute('aria-describedby', target.id);
    box.append(trigger, target);
  } else if (semantic && /^(hud|reward)\./.test(slot.id)) {
    target = node(
      'p',
      () => t('tools:studio.componentSpecimen.symbolOnly', { label: slot.label }),
      'specimen-semantic',
    );
    box.append(target);
  } else {
    const labels = {
      primary: () => t('tools:studio.componentSpecimen.deploy'),
      secondary: () => t('common:actions.back'),
      danger: () => t('tools:studio.componentSpecimen.discardDraft'),
      icon: '',
      tab: () => t('interface:controls'),
      chip: () => t('tools:studio.componentSpecimen.filterChip'),
    };
    target = node(
      'button',
      state === 'loading'
        ? () => t('tools:studio.componentSpecimen.loading')
        : semantic
          ? () => t('tools:studio.componentSpecimen.semantic', { label: slot.label })
          : (labels[buttonKind] ?? (() => t('tools:studio.componentSpecimen.action'))),
      `button ${buttonKind === 'icon' ? 'icon-button specimen-icon' : buttonKind || 'secondary'}`,
    );
    target.type = 'button';
    target.disabled = state === 'disabled';
    if (state === 'loading') target.setAttribute('aria-busy', 'true');
    if (buttonKind === 'icon') {
      localizedAttribute(target, 'aria-label', () =>
        t('tools:studio.componentSpecimen.pauseLabel'),
      );
      const glyph = node('span', 'Ⅱ');
      glyph.setAttribute('aria-hidden', 'true');
      target.append(glyph);
    }
    if (buttonKind === 'chip') {
      target.setAttribute('aria-pressed', String(selected));
      target.onclick = () =>
        target.setAttribute('aria-pressed', String(target.getAttribute('aria-pressed') !== 'true'));
    }
    if (buttonKind === 'tab') {
      const tabs = node('div', '', 'specimen-tabs'),
        other = node('button', () => t('interface:audio'), 'button tab'),
        controls = [target, other],
        panels = controls.map((control, index) => {
          control.id = `component-tab-${++specimenId}`;
          control.type = 'button';
          control.setAttribute('role', 'tab');
          const panel = node('div', () =>
            t('tools:studio.componentSpecimen.tabPanel', {
              category: t(index ? 'interface:audio' : 'interface:controls'),
            }),
          );
          panel.id = `${control.id}-panel`;
          panel.setAttribute('role', 'tabpanel');
          panel.setAttribute('aria-labelledby', control.id);
          control.setAttribute('aria-controls', panel.id);
          return panel;
        }),
        choose = (control, focus = false) => {
          if (control.disabled) return;
          for (const [index, button] of controls.entries()) {
            const active = control === button;
            button.setAttribute('aria-selected', String(active));
            button.tabIndex = active ? 0 : -1;
            panels[index].hidden = !active;
          }
          if (focus) control.focus();
        };
      tabs.setAttribute('role', 'tablist');
      localizedAttribute(tabs, 'aria-label', () =>
        t('tools:studio.componentSpecimen.tabListLabel'),
      );
      for (const control of controls) {
        control.onclick = () => choose(control);
        control.onkeydown = (event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const enabled = controls.filter((button) => !button.disabled),
            index = enabled.indexOf(control),
            next =
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? enabled.length - 1
                  : (index + (event.key === 'ArrowRight' ? 1 : -1) + enabled.length) %
                    enabled.length;
          choose(enabled[next], true);
        };
      }
      choose(selected ? target : other);
      tabs.append(...controls);
      box.append(tabs, ...panels);
    } else box.append(target);
  }
  target.dataset.specimenControl = 'true';
  if (semantic && !backgroundImage) {
    const art = iconForSlot(slot.id, { tokens: options.tokens }),
      canvas = node('canvas');
    canvas.width = art.width;
    canvas.height = art.height;
    canvas.style.width = `${art.width}px`;
    canvas.style.height = `${art.height}px`;
    canvas.setAttribute('aria-hidden', 'true');
    const ctx = canvas.getContext('2d'),
      image = ctx.createImageData(art.width, art.height);
    image.data.set(art.rgba);
    ctx.putImageData(image, 0, 0);
    target.prepend(canvas);
  }
  if (backgroundImage) {
    if (slot.group === 'screens') {
      box.classList.add('background-specimen');
      box.dataset.presentationScreen =
        slot.id === 'screen.studio.background' ? 'studio' : 'specimen';
      box.style.backgroundImage = `linear-gradient(#070b1255, #070b12cc), url("${backgroundImage}")`;
    } else if (options.assetGeometry?.nineSlice) {
      const slice = options.assetGeometry.nineSlice,
        emptyCenter =
          ['checkbox', 'radio', 'toggle'].includes(inputKind) ||
          (slot.id.startsWith('ui.button.') && state !== 'default'),
        frame = /^ui\.(panel|dialog|toast|tooltip)$/.test(slot.id)
          ? slot.id === 'ui.tooltip'
            ? target
            : box
          : target;
      frame.style.borderImageSource = `url("${backgroundImage}")`;
      frame.style.borderImageSlice = `${slice.top} ${slice.right} ${slice.bottom} ${slice.left}${emptyCenter ? '' : ' fill'}`;
      frame.style.borderImageWidth = `${slice.top}px ${slice.right}px ${slice.bottom}px ${slice.left}px`;
      frame.style.borderStyle = 'solid';
      frame.dataset.fileFrame = 'true';
    } else {
      const image = node('img');
      image.src = backgroundImage;
      image.width = slot.dimensions?.width || 24;
      image.height = slot.dimensions?.height || 24;
      image.alt = '';
      image.style.imageRendering = 'pixelated';
      target.prepend(image);
    }
  }
  box.append(
    node(
      'p',
      state === 'error'
        ? () => t('tools:studio.componentSpecimen.validationError')
        : () => t('tools:studio.componentSpecimen.unsavedNotice'),
      '',
      state === 'error' ? null : 'secondary',
    ),
  );
  box.append(
    node(
      'small',
      () => t('tools:studio.componentSpecimen.disclaimer', { state: specimenState(state) }),
      'bounded-label',
      'secondary',
    ),
  );
  surface.append(box);
}
