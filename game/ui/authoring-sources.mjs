import { setMenuIcon } from './native-menu-icons.mjs';
import { authoringLabel, authoringText } from './authoring-copy.mjs';

const MAX_SOURCE_BYTES = 32 * 1024 * 1024;
const candidates = [
  {
    key: 'samplePicture',
    path: '../../authoring/shared/samples/dawn-signal.png',
    type: 'image/png',
  },
  { key: 'sampleVideo', path: '../../authoring/shared/samples/dawn-signal.mp4', type: 'video/mp4' },
  {
    key: 'sampleMediaBundle',
    path: '../../authoring/still-media/examples/dawn-signal/Dawn-Signal-originals.rlmedia',
    type: 'application/vnd.revealline.media',
  },
  {
    key: 'sampleStoryBundle',
    path: '../../authoring/still-media/examples/dawn-signal/Dawn-Signal-stories.rlstory',
    type: 'application/vnd.revealline.story',
  },
];

export function acceptsAuthoringFile(accept, file) {
  if (!accept?.trim()) return true;
  return accept.split(',').some((value) => {
    const type = value.trim().toLowerCase();
    return type.startsWith('.')
      ? file.name.toLowerCase().endsWith(type)
      : type.endsWith('/*')
        ? file.type.toLowerCase().startsWith(type.slice(0, -1))
        : file.type.toLowerCase() === type;
  });
}

/** Uses the same file/change boundary as an explicit native file selection.
 * Every receiving editor retains validation, review and commit ownership. */
export function deliverAuthoringFile(input, file, win = input.ownerDocument.defaultView) {
  if (input.disabled || !input.isConnected || !acceptsAuthoringFile(input.accept, file))
    return false;
  const transfer = new win.DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  input.dispatchEvent(new win.Event('change', { bubbles: true }));
  return true;
}

export function createAuthoringSourcePicker({
  document: doc,
  window: win,
  onOpen = () => {},
  onClose = () => {},
}) {
  const recent = [],
    dialog = doc.createElement('dialog');
  dialog.className = 'authoring-source-dialog';
  dialog.setAttribute('aria-label', authoringText('chooseSource'));
  doc.body.append(dialog);
  let sheet = null;
  if (!doc.querySelector('link[data-authoring-input-style]')) {
    sheet = doc.createElement('link');
    sheet.rel = 'stylesheet';
    sheet.href = new URL('./authoring-input.css', import.meta.url).href;
    sheet.setAttribute('data-authoring-input-style', 'true');
    doc.head.append(sheet);
  }
  let opener = null,
    generation = 0,
    controller = null;
  const remember = (event) => {
    if (event.target?.type !== 'file') return;
    for (const file of event.target.files ?? []) {
      if (file.size > MAX_SOURCE_BYTES || recent.includes(file)) continue;
      recent.unshift(file);
      while (
        recent.length > 12 ||
        recent.reduce((sum, item) => sum + item.size, 0) > MAX_SOURCE_BYTES
      )
        recent.pop();
    }
  };
  doc.addEventListener('change', remember, true);
  function close() {
    generation++;
    controller?.abort();
    controller = null;
    if (dialog.open) dialog.close();
    const target = opener;
    opener = null;
    onClose();
    if (target?.isConnected && !target.disabled && !doc.hidden) target.focus();
  }
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  function open(input) {
    if (input.disabled || input.type !== 'file') return false;
    close();
    opener = input;
    const visit = ++generation;
    dialog.replaceChildren();
    const title = doc.createElement('h2');
    authoringLabel(title, 'chooseSource');
    const status = doc.createElement('p');
    status.setAttribute('role', 'status');
    const button = (label, action, parent = dialog) => {
      const value = doc.createElement('button');
      value.type = 'button';
      setMenuIcon(value, label === authoringText('close') ? 'back' : 'collection');
      value.textContent = label;
      value.onclick = action;
      parent.append(value);
      return value;
    };
    dialog.append(title, status);
    button(authoringText('close'), close);
    const choose = async (source) => {
      controller?.abort();
      const operation = new AbortController();
      controller = operation;
      authoringLabel(status, 'loading');
      try {
        let file = source.file;
        if (!file) {
          const response = await win.fetch(source.url, { signal: operation.signal });
          if (!response.ok || Number(response.headers.get('content-length')) > MAX_SOURCE_BYTES)
            throw new Error('Source unavailable.');
          const blob = await response.blob();
          if (blob.size > MAX_SOURCE_BYTES) throw new Error('Source too large.');
          file = new win.File([blob], source.name, { type: source.type || blob.type });
        }
        if (operation.signal.aborted || visit !== generation || opener !== input) return;
        close();
        deliverAuthoringFile(input, file, win);
      } catch (error) {
        if (error.name !== 'AbortError' && visit === generation)
          authoringLabel(status, 'unavailable');
      }
    };
    const addSection = (key, rows) => {
      if (!rows.length) return;
      const heading = doc.createElement('h3');
      authoringLabel(heading, key);
      dialog.append(heading);
      rows.forEach((source) => button(source.label, () => choose(source)));
    };
    addSection(
      'samples',
      candidates
        .map((source) => ({
          ...source,
          name: source.path.split('/').at(-1),
          url: new URL(source.path, import.meta.url).href,
          label: authoringText(source.key),
        }))
        .filter((source) => acceptsAuthoringFile(input.accept, source)),
    );
    addSection(
      'recent',
      recent
        .filter((file) => acceptsAuthoringFile(input.accept, file))
        .map((file) => ({ file, label: file.name })),
    );
    const seen = new Set();
    const assets = [...doc.querySelectorAll('img[src],video[src],audio[src]')]
      .flatMap((element) => {
        const url = new URL(element.currentSrc || element.src, win.location.href);
        if ((url.origin !== win.location.origin && url.protocol !== 'blob:') || seen.has(url.href))
          return [];
        seen.add(url.href);
        const name = url.pathname.split('/').at(-1) || 'asset',
          ext = name.split('.').at(-1)?.toLowerCase(),
          type =
            {
              png: 'image/png',
              jpg: 'image/jpeg',
              jpeg: 'image/jpeg',
              webp: 'image/webp',
              mp4: 'video/mp4',
              webm: 'video/webm',
              mp3: 'audio/mpeg',
              wav: 'audio/wav',
            }[ext] ||
            element.type ||
            '';
        return acceptsAuthoringFile(input.accept, { name, type })
          ? [{ name, type, url: url.href, label: element.alt || element.title || name }]
          : [];
      })
      .slice(0, 64);
    addSection('existing', assets);
    button(authoringText('disk'), () => {
      close();
      try {
        if (typeof input.showPicker === 'function') input.showPicker();
        else input.click();
      } catch {
        /* Browser-owned picker needs a native keyboard/touch activation. */
      }
    });
    const help = doc.createElement('p');
    authoringLabel(help, 'diskHelp');
    dialog.append(help);
    dialog.showModal();
    onOpen(dialog);
    dialog.querySelector('button')?.focus();
    return true;
  }
  return {
    open,
    close,
    dialog,
    destroy() {
      close();
      doc.removeEventListener('change', remember, true);
      dialog.remove();
      sheet?.remove();
      recent.length = 0;
    },
  };
}

/** Existing input hosts keep their single poller and can add this chooser to
 * their own active-dialog scope. */
export function attachAuthoringSourceButtons({ document: doc, window: win, picker }) {
  const buttons = new Map();
  const refresh = () => {
    for (const input of doc.querySelectorAll('input[type="file"]')) {
      if (buttons.has(input)) continue;
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'authoring-source-open';
      authoringLabel(button, 'chooseSource');
      setMenuIcon(button, 'collection');
      button.onclick = () => picker.open(input);
      input.after(button);
      buttons.set(input, button);
    }
    for (const [input, button] of buttons) {
      if (!input.isConnected) {
        button.remove();
        buttons.delete(input);
        continue;
      }
      const hidden = !!input.closest('[hidden],[inert]') || input.getClientRects().length === 0;
      if (button.hidden !== hidden) button.hidden = hidden;
      if (button.disabled !== input.disabled) button.disabled = input.disabled;
    }
  };
  const observer = new win.MutationObserver(refresh);
  observer.observe(doc.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['hidden', 'disabled', 'open'],
  });
  refresh();
  return () => {
    observer.disconnect();
    buttons.forEach((button) => button.remove());
  };
}
