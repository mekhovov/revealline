import { REACTION_LINES, reactionLine } from '../journey/reactions.mjs';
import { createReactionVoiceLibrary } from '../journey/reaction-voice-library.mjs';
import { getLocale as currentLocale, onLocaleChange } from '../i18n/index.mjs';
import { Soundscape } from '../ui/audio.mjs';
import { acquireStudioRewardAudio } from './reward-audio.mjs';

const words = {
  title: ['Character voice recordings', 'Записи голосів персонажів'],
  help: [
    'Replace a line with a recording of the exact transcript. Originals and earlier revisions are retained. Changes are local; export a voice bundle to move them to another browser.',
    'Замініть репліку записом точного тексту. Оригінали й попередні версії зберігаються. Зміни локальні; експортуйте пакет голосів для іншого браузера.',
  ],
  line: ['Line', 'Репліка'],
  locale: ['Recording language', 'Мова запису'],
  transcript: ['Exact transcript', 'Точний текст'],
  recording: ['Replacement audio, up to 15 seconds / 2 MiB', 'Новий запис, до 15 секунд / 2 МіБ'],
  kind: ['Recording source', 'Джерело запису'],
  human: ['Human performance', 'Людське виконання'],
  generated: ['Generated speech', 'Синтезований голос'],
  credit: [
    'Performer or generator and source notes',
    'Виконавець або генератор і відомості про джерело',
  ],
  versions: ['Retained revision', 'Збережена версія'],
  original: ['Original recording', 'Оригінальний запис'],
  preview: ['Play selected recording', 'Відтворити вибраний запис'],
  stop: ['Stop', 'Зупинити'],
  save: ['Save replacement', 'Зберегти новий запис'],
  restore: ['Restore original', 'Відновити оригінал'],
  select: ['Use selected revision', 'Використати вибрану версію'],
  export: ['Export voice bundle', 'Експортувати пакет голосів'],
  import: ['Import voice bundle', 'Імпортувати пакет голосів'],
  noRecording: [
    'No recording yet; the game uses the caption.',
    'Запису ще немає; гра показує субтитри.',
  ],
  ready: ['Recording ready.', 'Запис готовий.'],
  saved: ['Recording saved locally.', 'Запис збережено локально.'],
  stopped: ['Playback stopped.', 'Відтворення зупинено.'],
  muted: [
    'Preview is muted by the shared audio control.',
    'Попереднє прослуховування вимкнено спільним керуванням звуком.',
  ],
  chooseFile: ['Choose an audio recording first.', 'Спочатку виберіть аудіозапис.'],
  tooLong: [
    'Use an audio recording between 0 and 15 seconds.',
    'Використайте аудіозапис тривалістю до 15 секунд.',
  ],
  error: ['Recording could not be processed. Details: ', 'Не вдалося обробити запис. Подробиці: '],
};
export function createReactionVoiceEditor({
  container,
  getLocale = currentLocale,
  library = null,
  window: target = globalThis.window,
  createSound = (options) => new Soundscape(options),
  onChanged = () => {},
} = {}) {
  if (!container?.ownerDocument)
    throw new TypeError('A Studio voice editor container is required.');
  const ownLibrary = !library;
  library ??= createReactionVoiceLibrary();
  const doc = container.ownerDocument,
    tr = (key) => words[key][getLocale() === 'uk' ? 1 : 0];
  const node = (tag, text = '') => {
    const element = doc.createElement(tag);
    element.textContent = text;
    return element;
  };
  const root = node('fieldset'),
    legend = node('legend', tr('title')),
    help = node('p', tr('help'));
  root.dataset.reactionVoiceEditor = 'true';
  root.append(legend, help);
  const fields = {},
    labels = new Map(),
    buttons = new Map();
  for (const [key, tag] of [
    ['line', 'select'],
    ['locale', 'select'],
    ['transcript', 'textarea'],
    ['recording', 'input'],
    ['kind', 'select'],
    ['credit', 'input'],
    ['versions', 'select'],
  ]) {
    const label = node('label'),
      text = node('span', tr(key)),
      field = node(tag);
    field.dataset.voiceField = key;
    labels.set(key, text);
    fields[key] = field;
    label.style.cssText = 'display:grid;gap:.4rem;margin:.75rem 0;';
    label.append(text, field);
    root.append(label);
  }
  for (const locale of ['en', 'uk']) {
    const option = node('option', locale === 'uk' ? 'Українська' : 'English');
    option.value = locale;
    fields.locale.append(option);
  }
  fields.locale.value = getLocale() === 'uk' ? 'uk' : 'en';
  fields.transcript.readOnly = true;
  fields.transcript.rows = 3;
  fields.recording.type = 'file';
  fields.recording.accept = 'audio/wav,audio/mp4,audio/mpeg,audio/ogg,audio/webm';
  fields.credit.type = 'text';
  fields.credit.maxLength = 240;
  for (const kind of ['human', 'generated']) {
    const option = node('option', tr(kind));
    option.value = kind;
    fields.kind.append(option);
  }
  const status = node('p');
  status.setAttribute('role', 'status');
  const metadata = node('p');
  let disposed = false,
    busy = false,
    revision = 0,
    player = null,
    owner = null,
    playing = null;
  function stop() {
    revision++;
    playing?.stop();
    playing = null;
    player?.dispose();
    player = null;
    owner?.release();
    owner = null;
  }
  function acquire() {
    owner ??= acquireStudioRewardAudio(doc);
    player ??= createSound({ audioMaster: owner.master });
    player.configure({ music: 0, sfx: 0 });
    player.configureDialogue({ enabled: true, volume: 0.8 });
    return player;
  }
  const selection = () => ({ lineId: fields.line.value, locale: fields.locale.value });
  async function sync() {
    if (disposed) return;
    stop();
    const request = revision,
      { lineId, locale } = selection();
    fields.transcript.value = reactionLine(lineId, locale)?.text ?? '';
    const description = await library.describe(lineId, locale);
    if (disposed || request !== revision) return;
    fields.versions.replaceChildren();
    const original = node('option', tr('original'));
    original.value = '';
    fields.versions.append(original);
    for (const entry of description.revisions) {
      const option = node(
        'option',
        `${entry.kind === 'human' ? tr('human') : tr('generated')} · ${entry.createdAt.slice(0, 19)} · ${entry.sha256.slice(0, 10)}`,
      );
      option.value = entry.sha256;
      fields.versions.append(option);
    }
    fields.versions.value = description.active ?? '';
    const active = description.revisions.find((entry) => entry.sha256 === description.active);
    metadata.textContent = active
      ? `${active.credit} · ${active.duration.toFixed(1)} s · ${active.sha256}`
      : description.original
        ? `${description.original.provenance.provider} · ${description.original.provenance.voice} · ${description.original.sha256}`
        : tr('noRecording');
  }
  const button = (key, action) => {
    const value = node('button', tr(key));
    value.type = 'button';
    value.dataset.voiceAction = key;
    value.onclick = async () => {
      if (disposed || (busy && key !== 'stop')) return;
      if (key === 'stop') {
        stop();
        status.textContent = tr('stopped');
        return;
      }
      busy = true;
      try {
        await action();
      } catch (error) {
        stop();
        if (!disposed) status.textContent = `${tr('error')}${error.message}`;
      } finally {
        busy = false;
      }
    };
    buttons.set(key, value);
    root.append(value);
  };
  button('preview', async () => {
    stop();
    const request = revision,
      sound = acquire(),
      { lineId, locale } = selection();
    const enabled = sound.enable();
    // The selected historical revision is not persisted by audition.
    const description = await library.describe(lineId, locale);
    const selected = description.revisions.find((entry) => entry.sha256 === fields.versions.value);
    let bytes;
    if (selected)
      bytes = Uint8Array.from(atob(selected.base64), (character) => character.charCodeAt(0)).buffer;
    else if (fields.versions.value === '') {
      const original = description.original;
      if (original?.base64)
        bytes = Uint8Array.from(atob(original.base64), (character) =>
          character.charCodeAt(0),
        ).buffer;
      else if (original) {
        const response = await fetch(
          new URL(`../audio/reactions/${original.file}`, import.meta.url),
        );
        if (response.ok) bytes = await response.arrayBuffer();
      }
    }
    if (!bytes) {
      status.textContent = tr('noRecording');
      return;
    }
    if (!(await enabled) || disposed || request !== revision) return;
    const buffer = await sound.context.decodeAudioData(bytes.slice(0));
    if (disposed || request !== revision) return;
    playing = sound.playDialogue(buffer);
    status.textContent = sound.audioMaster.muted ? tr('muted') : tr('ready');
  });
  button('stop', stop);
  button('save', async () => {
    stop();
    const request = revision,
      file = fields.recording.files?.[0];
    if (!file) throw new Error(tr('chooseFile'));
    if (file.size > 2 * 1024 * 1024) throw new Error(tr('recording'));
    const selected = selection(),
      kind = fields.kind.value,
      credit = fields.credit.value,
      sound = acquire();
    if (!sound.setup()) throw new Error(tr('noRecording'));
    const decoded = await sound.context.decodeAudioData(await file.arrayBuffer());
    if (disposed || request !== revision) return;
    if (decoded.duration <= 0 || decoded.duration > 15) throw new Error(tr('tooLong'));
    await library.replace({ ...selected, blob: file, kind, credit, duration: decoded.duration });
    if (disposed || request !== revision) return;
    onChanged();
    await sync();
    status.textContent = tr('saved');
  });
  button('restore', async () => {
    const { lineId, locale } = selection();
    stop();
    await library.select(lineId, locale, null);
    onChanged();
    await sync();
    status.textContent = tr('saved');
  });
  button('select', async () => {
    const { lineId, locale } = selection(),
      selected = fields.versions.value || null;
    stop();
    await library.select(lineId, locale, selected);
    onChanged();
    await sync();
    status.textContent = tr('saved');
  });
  button('export', async () => {
    const data = await library.exportBundle(),
      blob = new Blob([data], { type: 'application/json' });
    if (disposed) return;
    const url = URL.createObjectURL(blob),
      link = node('a');
    link.href = url;
    link.download = 'revealline-character-voices.json';
    root.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  const bundle = node('input');
  bundle.type = 'file';
  bundle.accept = 'application/json';
  bundle.hidden = true;
  root.append(bundle);
  button('import', () => bundle.click());
  bundle.onchange = async () => {
    const file = bundle.files?.[0];
    if (!file || disposed || busy) return;
    busy = true;
    stop();
    try {
      if (file.size > 32 * 1024 * 1024) throw new Error('Voice bundle exceeds 32 MiB.');
      await library.importBundle(await file.text());
      onChanged();
      await sync();
      status.textContent = tr('saved');
    } catch (error) {
      if (!disposed) status.textContent = `${tr('error')}${error.message}`;
    } finally {
      busy = false;
      bundle.value = '';
    }
  };
  function localize() {
    const selected = fields.line.value;
    fields.line.replaceChildren();
    for (const entry of REACTION_LINES) {
      const line = reactionLine(entry.id, getLocale()),
        option = node('option', `${line.name} · ${line.text}`);
      option.value = entry.id;
      fields.line.append(option);
    }
    if (selected) fields.line.value = selected;
    legend.textContent = tr('title');
    help.textContent = tr('help');
    for (const [key, label] of labels) label.textContent = tr(key);
    for (const [key, value] of buttons) value.textContent = tr(key);
    for (const option of fields.kind.options) option.textContent = tr(option.value);
  }
  localize();
  for (const [key, field] of Object.entries(fields))
    field.onchange = () => {
      stop();
      if (['line', 'locale'].includes(key))
        void sync().catch((error) => {
          status.textContent = `${tr('error')}${error.message}`;
        });
    };
  const unlocale = onLocaleChange(() => {
    localize();
    void sync().catch(() => {});
  });
  const hidden = () => {
    if (doc.hidden) stop();
  };
  doc.addEventListener('visibilitychange', hidden);
  target?.addEventListener?.('pagehide', stop);
  root.append(metadata, status);
  container.append(root);
  void sync().catch((error) => {
    status.textContent = `${tr('error')}${error.message}`;
  });
  return Object.freeze({
    root,
    library,
    sync,
    suspend: stop,
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      unlocale();
      if (ownLibrary) library.close();
      for (const field of Object.values(fields)) field.onchange = null;
      for (const value of buttons.values()) value.onclick = null;
      bundle.onchange = null;
      doc.removeEventListener('visibilitychange', hidden);
      target?.removeEventListener?.('pagehide', stop);
      root.remove();
    },
  });
}
