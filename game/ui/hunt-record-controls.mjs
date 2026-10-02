import { getLocale, localizedText } from '../i18n/index.mjs';
import { createHuntRecords } from '../hunt/records.mjs';
import { exportJSONFile } from '../platform.mjs';

const copy = {
  en: {
    title: 'Hunt records',
    help: 'Back up personal hunt scores and milestones here. These records are separate from campaign progress and its backup.',
    export: 'Export Hunt records',
    import: 'Import Hunt records',
    retry: 'Retry saving Hunt records',
    saved: 'Hunt records are saved on this device.',
    session:
      'Some Hunt records are active only for this session. Export them to keep a copy. Existing unreadable saved data is kept.',
    exported: 'Export requested. Check your download or share dialog.',
    imported: 'Hunt records merged. Existing best scores and milestones are kept.',
    error: 'The Hunt record operation could not be completed. Existing saved data is kept.',
    empty: 'No Hunt records yet.',
  },
  uk: {
    title: 'Рекорди полювання',
    help: 'Зберігайте тут резервну копію особистих балів і досягнень полювання. Ці записи відокремлені від прогресу кампанії та його резервної копії.',
    export: 'Експортувати рекорди полювання',
    import: 'Імпортувати рекорди полювання',
    retry: 'Повторити збереження рекордів',
    saved: 'Рекорди полювання збережено на цьому пристрої.',
    session:
      'Деякі рекорди діють лише протягом цього сеансу. Експортуйте їх, щоб зберегти копію. Наявні нечитабельні дані збережено.',
    exported: 'Експорт запитано. Перевірте завантаження або вікно поширення.',
    imported: 'Рекорди полювання об’єднано. Попередні найкращі результати та досягнення збережено.',
    error: 'Не вдалося завершити операцію з рекордами. Наявні збережені дані не змінено.',
    empty: 'Рекордів полювання ще немає.',
  },
};
const text = (key) => (copy[getLocale()] ?? copy.en)[key];

/** A bounded, separate personal-record backup. Never changes campaign progress. */
export function attachHuntRecordControls({
  document: doc = globalThis.document,
  container,
  getStorage,
  records: sharedRecords = null,
  exportFile = exportJSONFile,
} = {}) {
  const records = sharedRecords ?? createHuntRecords(getStorage ? { getStorage } : {});
  const root = doc.createElement('details');
  root.className = 'hunt-record-controls';
  const heading = doc.createElement('summary');
  localizedText(heading, () => text('title'));
  const help = doc.createElement('p');
  help.className = 'micro-note';
  localizedText(help, () => text('help'));
  const exportButton = doc.createElement('button');
  exportButton.type = 'button';
  localizedText(exportButton, () => text('export'));
  const importLabel = doc.createElement('label');
  importLabel.className = 'field';
  const importHeading = doc.createElement('span');
  localizedText(importHeading, () => text('import'));
  const importInput = doc.createElement('input');
  importInput.type = 'file';
  importInput.accept = 'application/json,.json';
  importLabel.append(importHeading, importInput);
  const retry = doc.createElement('button');
  retry.type = 'button';
  localizedText(retry, () => text('retry'));
  const status = doc.createElement('p');
  status.className = 'micro-note';
  status.setAttribute('role', 'status');
  root.append(heading, help, exportButton, importLabel, retry, status);
  container?.append(root);
  let disposed = false,
    busy = false,
    operation = '';
  const refresh = () => {
    if (disposed) return;
    const state = records.snapshot();
    exportButton.disabled = busy || !state.records.length;
    importInput.disabled = busy;
    retry.disabled = busy;
    retry.hidden = state.durable;
    localizedText(status, () =>
      [
        operation && text(operation),
        !state.durable ? text('session') : state.records.length ? text('saved') : text('empty'),
      ]
        .filter(Boolean)
        .join(' '),
    );
  };
  const perform = async (action) => {
    if (busy || disposed) return;
    busy = true;
    operation = '';
    refresh();
    try {
      operation = await action();
    } catch {
      operation = 'error';
    } finally {
      busy = false;
      refresh();
    }
  };
  const exportRecords = () =>
    perform(async () => {
      await exportFile(records.export(), 'revealline-hunt-records.json', { documentRef: doc });
      return 'exported';
    });
  const importRecords = () =>
    perform(async () => {
      const file = importInput.files?.[0];
      importInput.value = '';
      if (!file) return '';
      if (file.size > 65536) throw new Error('Hunt record file exceeds its byte budget.');
      const source = await file.text();
      if (disposed) return '';
      records.import(source);
      return 'imported';
    });
  const retrySaving = () => {
    operation = '';
    records.retry();
    refresh();
  };
  const unsubscribe = records.subscribe(refresh);
  exportButton.addEventListener('click', exportRecords);
  importInput.addEventListener('change', importRecords);
  retry.addEventListener('click', retrySaving);
  return Object.freeze({
    refresh,
    dispose() {
      disposed = true;
      unsubscribe();
      exportButton.removeEventListener('click', exportRecords);
      importInput.removeEventListener('change', importRecords);
      retry.removeEventListener('click', retrySaving);
      if (!sharedRecords) records.dispose();
      root.remove();
    },
  });
}
