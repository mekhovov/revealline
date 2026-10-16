import { t } from '../i18n/index.mjs';

/** Shared thumb controls. Hosts own placement and input; no game rules live here. */
export function mountTouchControlsView({
  document: doc = globalThis.document,
  mount,
  idPrefix,
  actionLabel = null,
}) {
  const element = (tag, className) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    return node;
  };
  const root = element('div', 'shared-touch-controls');
  root.id = `${idPrefix}-controls`;
  const surface = element('div', 'shared-touch-surface');
  surface.id = `${idPrefix}-surface`;
  surface.setAttribute('role', 'group');
  const compass = element('span');
  compass.textContent = '✥';
  compass.setAttribute('aria-hidden', 'true');
  const instruction = element('span', 'shared-touch-instruction');
  surface.append(compass, instruction);
  const pad = element('div', 'shared-touch-pad');
  pad.id = `${idPrefix}-pad`;
  pad.setAttribute('role', 'group');
  const directionButtons = {};
  for (const [direction, glyph] of [
    ['up', '↑'],
    ['left', '←'],
    ['down', '↓'],
    ['right', '→'],
  ]) {
    const button = element('button');
    button.type = 'button';
    button.dataset.direction = direction;
    button.textContent = glyph;
    directionButtons[direction] = button;
    pad.append(button);
  }
  const indicator = element('span', 'shared-touch-indicator');
  indicator.id = `${idPrefix}-indicator`;
  indicator.hidden = true;
  indicator.setAttribute('aria-hidden', 'true');
  indicator.append(element('i'));
  let actionButton = null;
  if (actionLabel !== null) {
    actionButton = element('button', 'shared-touch-action');
    actionButton.id = `${idPrefix}-action`;
    actionButton.type = 'button';
    actionButton.textContent = actionLabel;
    root.append(actionButton);
  }
  root.append(surface, pad, indicator);
  mount.append(root);
  return {
    root,
    pad,
    surface,
    indicator,
    directionButtons,
    actionButton,
    apply(settings) {
      root.dataset.touchMode = settings.mode;
      root.dataset.touchSide = settings.side;
      root.dataset.touchSize = settings.size;
      root.style.setProperty('--touch-opacity', String(settings.opacity));
      surface.hidden = settings.mode === 'dpad';
      pad.hidden = settings.mode !== 'dpad';
      surface.setAttribute('aria-label', t('interface:touchSteeringDragToFlyAndTurn'));
      pad.setAttribute('aria-label', t('interface:directionControls'));
      instruction.textContent =
        settings.mode === 'swipe' ? t('interface:swipeToTurn') : t('interface:dragToSteer');
      for (const [direction, button] of Object.entries(directionButtons))
        button.setAttribute(
          'aria-label',
          t(`interface:move${direction[0].toUpperCase()}${direction.slice(1)}`),
        );
      indicator.hidden = true;
    },
    setVisible(value) {
      root.hidden = !value;
    },
    dispose() {
      root.remove();
    },
  };
}

/** The same shared preference used by Solo, Team and VS; changes persist across modes. */
export function mountTouchPresentationSettings({
  document: doc = globalThis.document,
  mount,
  preferences,
  idPrefix,
}) {
  const root = doc.createElement('section');
  root.className = 'shared-touch-settings';
  const fields = [];
  for (const [key, title, choices] of [
    [
      'mode',
      'touchSteering',
      [
        ['stick', 'floatingStickDragFromAnywhere'],
        ['swipe', 'swipeFlickToTurn'],
        ['dpad', 'dPadTapOrSlideBetweenDirections'],
      ],
    ],
    [
      'side',
      'steeringHand',
      [
        ['right', 'right'],
        ['left', 'left'],
      ],
    ],
    [
      'size',
      'touchControlSize',
      [
        ['regular', 'regular'],
        ['large', 'large'],
      ],
    ],
    ['opacity', 'touchControlOpacity', null],
  ]) {
    const row = doc.createElement('label'),
      caption = doc.createElement('span');
    const input = doc.createElement(choices ? 'select' : 'input');
    input.id = `${idPrefix}-touch-${key}`;
    input.dataset.touchSetting = key;
    row.htmlFor = input.id;
    if (!choices) {
      input.type = 'range';
      input.min = '0.2';
      input.max = '1';
      input.step = '0.05';
    }
    const options = (choices ?? []).map(([value, label]) => {
      const option = doc.createElement('option');
      option.value = value;
      input.append(option);
      return { option, label };
    });
    const change = () => {
      preferences.set({
        ...preferences.snapshot(),
        [key]: choices ? input.value : Number(input.value),
      });
      refresh();
    };
    input.addEventListener('change', change);
    row.append(caption, input);
    root.append(row);
    fields.push({ key, title, input, caption, options, change });
  }
  const status = doc.createElement('p');
  status.setAttribute('role', 'status');
  root.append(status);
  function refresh() {
    const settings = preferences.snapshot();
    for (const field of fields) {
      field.caption.textContent = t(`interface:${field.title}`);
      for (const { option, label } of field.options) option.textContent = t(`interface:${label}`);
      field.input.value = String(settings[field.key]);
    }
    status.textContent = preferences.warning?.() ?? '';
    status.hidden = !status.textContent;
  }
  mount.append(root);
  refresh();
  return {
    root,
    refresh,
    dispose() {
      for (const field of fields) field.input.removeEventListener('change', field.change);
      root.remove();
    },
  };
}
