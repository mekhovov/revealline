// Native atlas illustrations share the prepared renderer; no extra game or clock.
export const OVERFLIGHT_OPERATIONS = Object.freeze([
  {
    id: 'overflight',
    path: './play.html',
    key: 'survivorOperation',
    detail: 'survivorOperationHelp',
  },
  { id: 'overflight-hunt', path: './raid.html', key: 'raidOperation', detail: 'raidOperationHelp' },
]);

export function paintOverflightOperation(context, kind, paintSprite = () => {}) {
  context.clearRect(0, 0, 320, 132);
  context.fillStyle = '#11251f';
  context.fillRect(0, 0, 320, 132);
  context.fillStyle = '#1d352b';
  for (let x = 0; x < 320; x += 24) context.fillRect(x, 0, 1, 132);
  for (let y = 0; y < 132; y += 24) context.fillRect(0, y, 320, 1);
  if (kind === 'overflight') {
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
  onSelect,
  onLeave,
}) {
  const root = document.createElement('section');
  root.className = 'overflight-operation-grid';
  root.setAttribute('aria-label', text('chooseOperation'));
  const cards = OVERFLIGHT_OPERATIONS.map((operation) => {
    const selected = operation.id === current;
    const card = document.createElement(selected ? 'button' : 'a');
    if (selected) card.type = 'button';
    else card.href = destination(operation.path);
    card.id = `operation-${operation.id}`;
    card.className = 'overflight-operation-card';
    card.dataset.operation = operation.id;
    if (selected) card.setAttribute('aria-current', 'true');
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 132;
    canvas.setAttribute('aria-hidden', 'true');
    const title = document.createElement('strong');
    const detail = document.createElement('span');
    const status = document.createElement('small');
    card.append(canvas, title, detail, status);
    card.addEventListener('click', () => {
      if (selected) onSelect();
      else {
        card.href = destination(operation.path);
        onLeave();
      }
    });
    root.append(card);
    return { operation, canvas, title, detail, status, selected };
  });
  return {
    root,
    refresh(paintSprite) {
      root.setAttribute('aria-label', text('chooseOperation'));
      for (const { operation, canvas, title, detail, status, selected } of cards) {
        title.textContent = text(operation.key);
        detail.textContent = text(operation.detail);
        status.textContent = text(selected ? 'selectEncounter' : 'switchOperation');
        const context = canvas.getContext('2d');
        if (context) paintOverflightOperation(context, operation.id, paintSprite);
      }
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
