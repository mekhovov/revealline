import { FIELD_KIT_ICON_IDS, iconForSlot } from '../../game/presentation/icons.mjs';
let specimenId = 0;
const text = (doc, tag, value, className = '') => {
  const node = doc.createElement(tag);
  node.textContent = value;
  node.className = className;
  return node;
};

/** Native, isolated component samples; no presentation host, telemetry or storage. */
export function componentPreview(surface, slot, options, backgroundImage = null) {
  const doc = surface.ownerDocument,
    node = (tag, value = '', className = '') => text(doc, tag, value, className),
    box = node('div', '', 'recipe-sample component-specimen'),
    state = options.state,
    selected = ['selected', 'pressed'].includes(state),
    inputKind = slot.id.startsWith('ui.input.') ? slot.id.slice(9) : null,
    semantic = FIELD_KIT_ICON_IDS.includes(slot.id);
  box.dataset.state = state;
  box.dataset.specimenSlot = slot.id;
  box.append(node('h3', slot.label));
  let target = box;
  if (inputKind === 'scrollbar') {
    target = node('div', '', 'specimen-scrollbar');
    target.tabIndex = 0;
    target.setAttribute('role', 'region');
    target.setAttribute('aria-label', 'Scrollable component specimen');
    for (let i = 1; i <= 6; i++) target.append(node('p', `Specimen row ${i}`));
    box.append(target);
  } else if (inputKind) {
    const label = node('label', `Preview ${inputKind} · sample control`);
    target = node(inputKind === 'select' ? 'select' : 'input');
    if (inputKind === 'select') {
      target.append(node('option', 'Standard'), node('option', 'Large'));
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
      } else target.placeholder = 'Pilot callsign · Позивний';
    }
    target.disabled = state === 'disabled';
    target.setAttribute('aria-label', `Component specimen ${inputKind}`);
    if (state === 'error') target.setAttribute('aria-invalid', 'true');
    label.append(target);
    box.append(label);
  } else if (slot.id.startsWith('ui.meter.')) {
    target = node('progress');
    target.max = 100;
    target.value = 62;
    target.setAttribute('aria-label', `${slot.label} specimen: 62 of 100`);
    box.append(target, node('p', 'Sample value 62 / 100 · not live telemetry'));
  } else if (slot.id === 'ui.tooltip') {
    const trigger = node('button', 'Tooltip specimen');
    trigger.type = 'button';
    target = node('span', 'A short explanation stays readable.', 'specimen-tooltip');
    target.id = `component-tooltip-${++specimenId}`;
    target.setAttribute('role', 'tooltip');
    trigger.setAttribute('aria-describedby', target.id);
    box.append(trigger, target);
  } else if (semantic && /^(hud|reward)\./.test(slot.id)) {
    target = node('p', `${slot.label} · symbol specimen only`, 'specimen-semantic');
    box.append(target);
  } else {
    target = node(
      'button',
      state === 'loading'
        ? 'Loading specimen…'
        : semantic
          ? `${slot.label} specimen`
          : slot.id === 'ui.button.chip'
            ? 'Filter chip specimen'
            : 'Deploy · Почати',
    );
    target.type = 'button';
    target.disabled = state === 'disabled';
    target.setAttribute('aria-pressed', String(selected));
    if (slot.id === 'ui.button.chip') target.classList.add('chip');
    box.append(target);
  }
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
        ? 'Sample validation error: review this value.'
        : 'Interactive sample only; changes are not saved.',
    ),
  );
  box.append(
    node(
      'small',
      `${state} · component library specimen. This is not a live game control, telemetry, earned reward or production review.`,
      'bounded-label',
    ),
  );
  surface.append(box);
}
