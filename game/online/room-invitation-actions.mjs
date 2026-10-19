import { getLocale, localizedAttribute, localizedText } from '../i18n/index.mjs';
import { createRoomInvitationQr, roomInvitationAddress } from './room-invitation-qr.mjs';

const COPY = {
  actions: ['Invitation actions', 'Дії із запрошенням'],
  copy: ['Copy invitation', 'Копіювати запрошення'],
  share: ['Share invitation', 'Поділитися запрошенням'],
  select: ['Select invitation', 'Виділити запрошення'],
  showQr: ['Show QR', 'Показати QR'],
  hideQr: ['Hide QR', 'Сховати QR'],
  qrAlt: [
    'Room invitation QR code. The same invitation is in the link field.',
    'QR-код запрошення до кімнати. Те саме запрошення є в полі посилання.',
  ],
  copied: ['Invitation copied.', 'Запрошення скопійовано.'],
  manual: [
    'Copying is unavailable. Select the invitation and use your device’s Copy action.',
    'Копіювання недоступне. Виділіть запрошення й скористайтеся дією «Копіювати» на пристрої.',
  ],
  selected: [
    'Invitation selected. Use your device’s Copy action.',
    'Запрошення виділено. Скористайтеся дією «Копіювати» на пристрої.',
  ],
  shared: ['Share request completed.', 'Запит на поширення завершено.'],
  cancelled: [
    'Sharing cancelled. The invitation is still available.',
    'Поширення скасовано. Запрошення залишається доступним.',
  ],
  shareUnavailable: [
    'Sharing is unavailable here. Use Copy invitation or Show QR.',
    'Поширення тут недоступне. Скористайтеся копіюванням запрошення або QR-кодом.',
  ],
  shareTitle: ['Private room invitation', 'Запрошення до приватної кімнати'],
  qrReady: [
    'Scan to open the invitation on another device.',
    'Відскануйте, щоб відкрити запрошення на іншому пристрої.',
  ],
  qrUnavailable: [
    'QR is unavailable. You can still copy the invitation.',
    'QR-код недоступний. Ви можете скопіювати запрошення.',
  ],
};

/** The host supplies only its accepted invitation. This view cannot join or play. */
export function mountRoomInvitationActions({
  document: doc = globalThis.document,
  window: win = globalThis.window,
  field,
  after,
  getVisible = () => true,
  locale = getLocale,
  createQr = createRoomInvitationQr,
}) {
  const root = doc.createElement('section');
  root.className = 'room-invitation-actions';
  root.setAttribute('role', 'group');
  const row = doc.createElement('div');
  row.className = 'actions';
  const buttons = {};
  for (const name of ['copy', 'share', 'qr', 'select']) {
    const button = doc.createElement('button');
    button.id = `${field.id}-${name}`;
    button.type = 'button';
    row.append(button);
    buttons[name] = button;
  }
  const image = doc.createElement('img');
  image.id = `${field.id}-qr-image`;
  image.hidden = true;
  buttons.qr.setAttribute('aria-controls', image.id);
  buttons.qr.setAttribute('aria-expanded', 'false');
  const status = doc.createElement('p');
  status.id = `${field.id}-share-status`;
  status.setAttribute('role', 'status');
  root.append(row, image, status);
  after.after(root);
  let address = null,
    generation = 0,
    pending = null,
    disposed = false,
    manualAvailable = false,
    statusKey = '';
  const words = (key) => COPY[key]?.[locale() === 'uk' ? 1 : 0] ?? '';
  const statusText = () => words(statusKey);
  localizedAttribute(root, 'aria-label', () => words('actions'));
  localizedAttribute(image, 'alt', () => words('qrAlt'));
  for (const key of ['copy', 'share', 'select']) localizedText(buttons[key], () => words(key));
  const qrText = () => words(image.hidden ? 'showQr' : 'hideQr');
  localizedText(buttons.qr, qrText);
  function visible() {
    return !disposed && !doc.hidden && field.isConnected && getVisible();
  }
  function usable() {
    return visible() && address !== null && field.value === address;
  }
  function paint() {
    if (disposed) return;
    root.hidden = address === null;
    for (const button of Object.values(buttons)) button.disabled = !usable() || pending !== null;
    buttons.select.hidden = !manualAvailable;
    root.setAttribute('aria-busy', String(pending !== null));
    localizedText(buttons.qr, qrText);
    localizedText(status, statusText);
  }
  function say(key) {
    statusKey = key;
    localizedText(status, statusText);
  }
  function hideQr() {
    image.hidden = true;
    image.removeAttribute('src');
    buttons.qr.setAttribute('aria-expanded', 'false');
  }
  function invalidate() {
    if (disposed) return;
    generation++;
    statusKey = '';
    hideQr();
    // An OS share/clipboard request cannot be cancelled. Keep its single owner
    // until settlement even when its presentation generation has retired.
    paint();
  }
  function begin() {
    if (!usable() || pending !== null) return null;
    const request = { generation, address };
    pending = request;
    paint();
    return request;
  }
  function current(request) {
    return request.generation === generation && request.address === address && usable();
  }
  function finish(request) {
    if (pending === request) pending = null;
    paint();
  }
  function selectInvitation() {
    if (!usable() || pending !== null) return;
    try {
      field.focus();
      field.select();
      say('selected');
    } catch {
      say('manual');
    }
  }
  buttons.select.onclick = selectInvitation;
  buttons.copy.onclick = async () => {
    const request = begin();
    if (!request) return;
    try {
      if (!current(request)) return;
      const clipboard = win.navigator?.clipboard;
      if (win.isSecureContext === false || typeof clipboard?.writeText !== 'function') {
        manualAvailable = true;
        say('manual');
        finish(request);
        selectInvitation();
        return;
      }
      await clipboard.writeText(request.address);
      if (current(request)) {
        manualAvailable = false;
        say('copied');
      }
    } catch {
      if (current(request)) {
        manualAvailable = true;
        say('manual');
      }
    } finally {
      finish(request);
    }
  };
  buttons.share.onclick = async () => {
    const request = begin();
    if (!request) return;
    try {
      if (!current(request)) return;
      const navigator = win.navigator;
      const data = { title: words('shareTitle'), url: request.address };
      if (
        win.isSecureContext === false ||
        typeof navigator?.share !== 'function' ||
        (typeof navigator.canShare === 'function' && !navigator.canShare(data))
      ) {
        if (current(request)) say('shareUnavailable');
        return;
      }
      // Invoke before the first await, on the original user gesture and receiver.
      await navigator.share(data);
      if (current(request)) say('shared');
    } catch (error) {
      if (current(request)) say(error?.name === 'AbortError' ? 'cancelled' : 'shareUnavailable');
    } finally {
      finish(request);
    }
  };
  buttons.qr.onclick = async () => {
    if (!usable() || pending !== null) return;
    if (!image.hidden) {
      hideQr();
      say('');
      paint();
      return;
    }
    const request = begin();
    if (!request) return;
    try {
      if (!current(request)) return;
      const result = await createQr(request.address);
      if (!current(request)) return;
      image.src = result.src;
      image.width = result.size;
      image.height = result.size;
      image.hidden = false;
      buttons.qr.setAttribute('aria-expanded', 'true');
      say('qrReady');
    } catch {
      if (current(request)) say('qrUnavailable');
    } finally {
      finish(request);
    }
  };
  const visibility = () => {
    if (doc.hidden) invalidate();
    else paint();
  };
  doc.addEventListener('visibilitychange', visibility);
  paint();
  return {
    root,
    update(value) {
      if (disposed) return;
      let next = null;
      try {
        if (value) next = roomInvitationAddress(value);
      } catch {
        // Invalid projections expose neither sharing actions nor raw errors.
      }
      if (next === address) {
        paint();
        return;
      }
      address = next;
      manualAvailable = false;
      invalidate();
    },
    invalidate,
    refresh: paint,
    dispose() {
      if (disposed) return;
      invalidate();
      disposed = true;
      doc.removeEventListener('visibilitychange', visibility);
      for (const button of Object.values(buttons)) button.onclick = null;
      root.remove();
    },
  };
}
