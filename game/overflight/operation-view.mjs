// Native atlas illustrations share the prepared renderer; no extra game or clock.
export const OVERFLIGHT_OPERATIONS = Object.freeze([
  {
    id: 'overflight',
    group: 'survival',
    path: './play.html',
    key: 'survivorOperation',
    detail: 'survivorOperationHelp',
  },
  {
    id: 'overflight-riy',
    group: 'survival',
    path: './play.html?operation=riy',
    key: 'riyOperation',
    detail: 'riyOperationHelp',
  },
  {
    id: 'overflight-hunt',
    group: 'raid',
    path: './raid.html',
    key: 'raidOperation',
    detail: 'raidOperationHelp',
  },
  {
    id: 'time-attack',
    group: 'raid',
    path: './raid.html?operation=time-attack',
    key: 'timeAttackOperation',
    detail: 'timeAttackOperationHelp',
  },
  {
    id: 'marathon',
    group: 'raid',
    path: './raid.html?operation=marathon',
    key: 'marathonOperation',
    detail: 'marathonOperationHelp',
  },
]);

export const OVERFLIGHT_FAMILY_PREFERENCE = 'revealline.overflight.family-operation.v1';

export function overflightOperation(id) {
  return OVERFLIGHT_OPERATIONS.find((operation) => operation.id === id) ?? OVERFLIGHT_OPERATIONS[0];
}

export function overflightOperationContext(id, text) {
  const operation = overflightOperation(id);
  return `FPV Survivals · ${text(`${operation.group}Group`)} · ${text(operation.key)}`;
}

/** Only the generic family entry restores a choice; old explicit URLs stay exact. */
export function overflightRememberedOperationURL(href, stored) {
  const source = new URL(href);
  if (
    source.searchParams.get('family') !== '1' ||
    !source.pathname.endsWith('/overflight/play.html') ||
    ['community', 'studio', 'operation', 'prototype'].some((key) => source.searchParams.has(key))
  )
    return null;
  const operation = OVERFLIGHT_OPERATIONS.find(({ id }) => id === stored);
  if (!operation) return null;
  const target = new URL(operation.path, source);
  for (const [key, value] of source.searchParams)
    if (
      ![
        'family',
        'operation',
        'prototype',
        'reviewBuild',
        'reviewStopAt',
        'autoplay',
        'fixture',
        'benchmark',
        'trial',
        'measureAt',
      ].includes(key)
    )
      target.searchParams.set(key, value);
  return target.href;
}

export function paintOverflightOperation(context, kind, paintSprite = () => {}) {
  context.clearRect(0, 0, 320, 132);
  context.fillStyle = '#11251f';
  context.fillRect(0, 0, 320, 132);
  context.fillStyle = '#1d352b';
  for (let x = 0; x < 320; x += 24) context.fillRect(x, 0, 1, 132);
  for (let y = 0; y < 132; y += 24) context.fillRect(0, y, 320, 1);
  if (kind === 'overflight' || kind === 'overflight-riy') {
    for (let index = 0; index < 30; index++) {
      const side = index % 2 ? 1 : -1;
      const x = 160 + side * (65 + (index % 5) * 17);
      const y = 14 + ((index * 31) % 105);
      paintSprite(context, 'enemy', x, y, 20, 0);
    }
    context.strokeStyle = '#e6bd62';
    context.lineWidth = 3;
    for (const radius of [15, 28]) {
      context.beginPath();
      context.arc(132, 89, radius, 0, Math.PI * 2);
      context.stroke();
    }
    paintSprite(context, 'drone', 164, 49, 62, 0);
    if (kind === 'overflight-riy') {
      paintSprite(context, 'drone', 116, 80, 36, 0);
      paintSprite(context, 'drone', 212, 80, 36, 0);
    }
  } else {
    context.strokeStyle = '#9aebda';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(28, 95);
    context.lineTo(136, 62);
    context.lineTo(265, 62);
    context.stroke();
    for (let index = 0; index < 6; index++)
      paintSprite(context, 'enemy', 55 + index * 29, 96 - index * 7, 23, 0);
    paintSprite(context, 'machine', 263, 58, 62, 0);
    context.fillStyle = '#e6bd62';
    for (let index = 0; index < 3; index++) context.fillRect(243 + index * 15, 18, 11, 4);
    paintSprite(context, 'drone', 153, 63, 60, 0);
  }
}

export function createOverflightOperationCards({
  document,
  current,
  text,
  destination,
  onSelect = () => {},
  onLeave = () => {},
}) {
  const root = document.createElement('section');
  root.className = 'overflight-operation-grid';
  root.setAttribute('aria-label', text('chooseOperation'));
  const groups = ['survival', 'raid'].map((id) => {
    const section = document.createElement('section');
    section.className = 'overflight-operation-group';
    const title = document.createElement('h2');
    title.id = `operation-group-${id}`;
    section.setAttribute('aria-labelledby', title.id);
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 132;
    canvas.setAttribute('aria-hidden', 'true');
    section.append(canvas, title);
    root.append(section);
    return { id, section, title, canvas };
  });
  const cards = OVERFLIGHT_OPERATIONS.map((operation, index) => {
    const selected = operation.id === current;
    const card = document.createElement(selected ? 'button' : 'a');
    if (selected) card.type = 'button';
    else card.setAttribute('href', destination(operation.path));
    card.id = `operation-${operation.id}`;
    card.className = 'overflight-operation-card';
    card.dataset.operation = operation.id;
    card.dataset.homeChoice = 'true';
    for (const direction of ['left', 'right'])
      card.setAttribute(
        `data-menu-${direction}`,
        Array.from({ length: OVERFLIGHT_OPERATIONS.length - 1 }, (_, offset) => {
          const step = (offset + 1) * (direction === 'left' ? -1 : 1);
          const next = (index + step + OVERFLIGHT_OPERATIONS.length) % OVERFLIGHT_OPERATIONS.length;
          return `operation-${OVERFLIGHT_OPERATIONS[next].id}`;
        }).join(' '),
      );
    if (selected) card.setAttribute('aria-current', 'true');
    const title = document.createElement('strong');
    const detail = document.createElement('span');
    const status = document.createElement('small');
    card.append(title, detail, status);
    card.addEventListener('click', (event) => {
      if (!selected) {
        card.setAttribute('href', destination(operation.path));
        onLeave(operation, event);
        onSelect(operation, event);
      }
    });
    groups.find(({ id }) => id === operation.group).section.append(card);
    return { operation, card, title, detail, status, selected };
  });
  return {
    root,
    refresh(paintSprite) {
      root.setAttribute('aria-label', text('chooseOperation'));
      for (const { id, title, canvas } of groups) {
        title.textContent = text(`${id}Group`);
        const context = canvas.getContext('2d');
        if (context)
          paintOverflightOperation(
            context,
            id === 'survival' ? 'overflight-riy' : 'overflight-hunt',
            paintSprite,
          );
      }
      for (const { operation, card, title, detail, status, selected } of cards) {
        if (!selected) card.setAttribute('href', destination(operation.path));
        title.textContent = text(operation.key);
        detail.textContent = text(operation.detail);
        status.textContent = text(selected ? 'selectedOperation' : 'switchOperation');
      }
    },
  };
}

/** A native, controller-navigable confirmation; cancelling leaves the run paused. */
export function createOverflightRunChangeDialog({ document, text, releaseInput = () => {} }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'mode-play-dialog overflight-change-dialog';
  dialog.id = 'overflight-change-dialog';
  const title = document.createElement('h2');
  title.id = 'overflight-change-title';
  dialog.setAttribute('aria-labelledby', title.id);
  const detail = document.createElement('p');
  const actions = document.createElement('div');
  actions.className = 'overflight-result-actions';
  const cancel = document.createElement('button');
  const accept = document.createElement('button');
  cancel.type = accept.type = 'button';
  cancel.id = 'overflight-change-cancel';
  accept.id = 'overflight-change-accept';
  actions.append(cancel, accept);
  dialog.append(title, detail, actions);
  document.body.append(dialog);
  let resolve = null;
  function finish(accepted) {
    if (!resolve) return;
    const done = resolve;
    resolve = null;
    if (dialog.open) dialog.close();
    releaseInput();
    done?.(accepted);
  }
  cancel.addEventListener('click', () => finish(false));
  accept.addEventListener('click', () => finish(true));
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    finish(false);
  });
  dialog.addEventListener('close', () => finish(false));
  return {
    root: dialog,
    ask() {
      if (resolve) return Promise.resolve(false);
      title.textContent = text('endSortieTitle');
      detail.textContent = text('endSortieHelp');
      cancel.textContent = text('keepSortie');
      accept.textContent = text('endSortie');
      return new Promise((done) => {
        resolve = done;
        dialog.showModal();
        cancel.focus({ preventScroll: true });
      });
    },
    cancel: () => finish(false),
    dispose() {
      finish(false);
      dialog.remove();
    },
  };
}

export function paintOverflightRole(context, role, paintSprite = () => {}) {
  context.clearRect(0, 0, 240, 100);
  context.fillStyle = '#11251f';
  context.fillRect(0, 0, 240, 100);
  paintSprite(
    context,
    role === 'armor' ? 'machine' : role === 'shield' ? 'shield' : 'enemy',
    156,
    50,
    role === 'armor' ? 55 : 34,
    0,
  );
  paintSprite(context, 'drone', 62, role === 'shield' ? 76 : 50, 47, 0);
  context.strokeStyle = '#9aebda';
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(84, role === 'shield' ? 76 : 50);
  context.lineTo(130, role === 'shield' ? 76 : 50);
  if (role === 'shield') context.lineTo(170, 76);
  context.stroke();
  context.fillStyle = '#e6bd62';
  if (role === 'shield') context.fillRect(140, 28, 4, 38);
  if (role === 'armor') {
    for (let index = 0; index < 3; index++) context.fillRect(136 + index * 15, 13, 10, 4);
    context.fillStyle = '#9aebda';
    context.fillRect(123, 31, 3, 38);
    context.fillRect(187, 31, 3, 38);
  }
}
