import { getLocale, localizedText, t } from '../i18n/index.mjs';
import { exportJSONFile } from '../platform.mjs';
import { TEAM_HUNT_ATTEMPT_KEY, TEAM_HUNT_ATTEMPT_MAX_BYTES } from '../coop/hunt-attempts.mjs';

const copy = {
  en: {
    title: 'Saved Team hunt',
    help: 'One unfinished Team hunt is saved on this device every five seconds and when paused. Continue keeps the exact mission, difficulty, enemies and shared score. Starting another hunt keeps an existing save until you explicitly discard it.',
    continue: 'Continue saved Team hunt',
    discard: 'Discard saved Team hunt',
    confirm: 'Confirm discard',
    cancel: 'Keep save',
    export: 'Export saved Team hunt',
    import: 'Import saved Team hunt',
    empty: 'No unfinished Team hunt is saved.',
    saved: 'Your unfinished Team hunt is saved.',
    unavailable:
      'Open the original Team mission source and choose its saved difficulty to continue.',
    damaged:
      'The saved data cannot be read by this edition. It has been kept. Export it before discarding it.',
    failed: 'This attempt could not update its save. The previous saved data is kept.',
    busy: 'Checking the exact saved inputs and preparing the arena…',
    error: 'Continue or backup could not finish. The saved data is kept.',
    sourceChanged:
      'This save needs its original mission source and difficulty. The saved data is kept.',
    recipeChanged:
      'The saved encounter recipe is unavailable in this edition. The saved data is kept.',
    rulesChanged:
      'This save uses a different gameplay configuration or rules version. The saved data is kept.',
    inputsEnded:
      'The saved inputs continue after the hunt ended, so this checkpoint cannot continue. The saved data is kept.',
    verificationFailed:
      'The saved inputs did not reproduce this checkpoint exactly. Continue was stopped and the saved data is kept.',
    saveChanged:
      'The saved hunt changed in another tab while preparing the arena. Review the current checkpoint and try Continue again.',
    foregroundLost:
      'Continue paused because this game lost focus. Return to this window and try Continue again. The save is kept.',
    continueInterrupted:
      'Continue was interrupted before the arena opened. The save is kept. Try Continue again.',
    exported: 'Export requested. Check your download or share dialog.',
    imported: 'Saved hunt imported. Continue verifies its inputs before play.',
    leaveSaved:
      'This Team hunt has a saved checkpoint. Leaving or changing setup keeps it under Saved Team hunt. A different hunt cannot replace it until you explicitly discard the save. Stay keeps both pilots paused.',
    retrySaved:
      'Retry starts the same accepted hunt from the beginning and replaces this saved checkpoint once the new attempt starts. Stay keeps both pilots paused and the checkpoint unchanged.',
    replaceSaved:
      'Replace & play starts the selected arena. This hunt checkpoint remains under Saved Team hunt until you explicitly discard it. Stay keeps the current attempt and picture.',
  },
  uk: {
    title: 'Збережене командне полювання',
    help: 'Одне незавершене командне полювання зберігається на пристрої кожні п’ять секунд і під час паузи. Продовження відновлює точну місію, складність, ворогів і спільні бали. Нова спроба не замінює попереднє збереження без явного видалення.',
    continue: 'Продовжити збережене полювання',
    discard: 'Видалити збережене полювання',
    confirm: 'Підтвердити видалення',
    cancel: 'Залишити збереження',
    export: 'Експортувати збережене полювання',
    import: 'Імпортувати збережене полювання',
    empty: 'Немає збереженого незавершеного полювання.',
    saved: 'Незавершене командне полювання збережено.',
    unavailable:
      'Відкрийте початкове джерело командної місії та виберіть збережену складність для продовження.',
    damaged:
      'Ця версія не може прочитати збережені дані. Їх залишено без змін. Експортуйте їх перед видаленням.',
    failed: 'Не вдалося оновити збереження цієї спроби. Попередні дані залишено без змін.',
    busy: 'Перевірка точних збережених команд і підготовка арени…',
    error:
      'Не вдалося завершити продовження або резервне копіювання. Збережені дані залишено без змін.',
    sourceChanged:
      'Для цього збереження потрібні початкове джерело місії та складність. Дані залишено без змін.',
    recipeChanged: 'Збережений склад ворогів недоступний у цій версії. Дані залишено без змін.',
    rulesChanged:
      'Збереження використовує інші налаштування гри або версію правил. Дані залишено без змін.',
    inputsEnded:
      'Збережені команди тривають після завершення полювання, тому цю контрольну точку не можна продовжити. Дані залишено без змін.',
    verificationFailed:
      'Збережені команди не відтворили контрольну точку точно. Продовження зупинено, дані залишено без змін.',
    saveChanged:
      'Під час підготовки арени інша вкладка змінила збережене полювання. Перегляньте поточну контрольну точку та спробуйте продовжити знову.',
    foregroundLost:
      'Продовження зупинено, оскільки вікно гри втратило фокус. Поверніться до нього та повторіть спробу. Збереження залишено без змін.',
    continueInterrupted:
      'Продовження перервано до відкриття арени. Збереження залишено без змін. Повторіть спробу.',
    exported: 'Експорт запитано. Перевірте завантаження або вікно поширення.',
    imported: 'Полювання імпортовано. Перед продовженням команди буде перевірено.',
    leaveSaved:
      'Контрольну точку командного полювання збережено. Вихід або зміна налаштувань залишає її в розділі збереженого полювання. Інше полювання не замінить її без явного видалення. «Залишитися» тримає обох пілотів на паузі.',
    retrySaved:
      'Повтор починає те саме полювання спочатку й замінює контрольну точку після початку нової спроби. «Залишитися» тримає обох пілотів на паузі та не змінює збереження.',
    replaceSaved:
      '«Замінити й грати» відкриває вибрану арену. Контрольна точка полювання залишається в розділі збереженого полювання до явного видалення. «Залишитися» зберігає поточну спробу та зображення.',
  },
};
const text = (key) => (copy[getLocale()] ?? copy.en)[key];
export const teamHuntSaveText = text;

export function attachTeamHuntSave({
  container,
  liveStatus,
  store,
  findRow,
  onContinue,
  onDiscard,
  document: doc = globalThis.document,
  window: win = globalThis.window,
}) {
  const root = doc.createElement('section');
  root.className = 'team-hunt-save';
  const title = doc.createElement('h3');
  localizedText(title, () => text('title'));
  const help = doc.createElement('p');
  help.className = 'micro-note';
  localizedText(help, () => text('help'));
  const status = doc.createElement('p');
  status.className = 'setup-note';
  status.setAttribute('role', 'status');
  const make = (key) => {
    const button = doc.createElement('button');
    button.type = 'button';
    localizedText(button, () => text(key));
    return button;
  };
  const next = make('continue'),
    discard = make('discard'),
    cancel = make('cancel'),
    backup = make('export');
  const importLabel = doc.createElement('label');
  importLabel.className = 'field';
  const importText = doc.createElement('span');
  localizedText(importText, () => text('import'));
  const importInput = doc.createElement('input');
  importInput.type = 'file';
  importInput.accept = 'application/json,.json';
  importLabel.append(importText, importInput);
  root.append(title, help, status, next, discard, cancel, backup, importLabel);
  container.append(root);
  let disposed = false,
    busy = false,
    confirmation = null,
    operation = '',
    failed = false;
  const controller = new AbortController();
  const refresh = () => {
    if (disposed) return;
    const saved = store.read();
    const row = saved.snapshot && findRow(saved.snapshot);
    next.hidden = !saved.snapshot;
    next.disabled = busy || !row;
    discard.hidden = saved.raw === null;
    discard.disabled = busy;
    cancel.hidden = confirmation === null;
    backup.disabled = busy || saved.raw === null;
    importInput.disabled = busy || saved.raw !== null || !!saved.error;
    localizedText(discard, () => text(confirmation === null ? 'discard' : 'confirm'));
    localizedText(status, () =>
      [
        busy ? text('busy') : operation && text(operation),
        failed && text('failed'),
        saved.error
          ? text('damaged')
          : !saved.snapshot
            ? text('empty')
            : row
              ? text('saved')
              : text('unavailable'),
        saved.snapshot &&
          `${row?.title ?? saved.snapshot.levelId} · ${t(`interface:${saved.snapshot.difficulty}`)} · ${Math.floor(saved.snapshot.checkpoint.tick / 120)} s`,
      ]
        .filter(Boolean)
        .join(' '),
    );
    if (liveStatus) {
      liveStatus.hidden = !failed;
      localizedText(liveStatus, () => (failed ? text('failed') : ''));
    }
  };
  async function perform(action) {
    if (busy || disposed) return;
    busy = true;
    operation = '';
    confirmation = null;
    refresh();
    try {
      operation = (await action()) ?? '';
    } catch (error) {
      if (error.name !== 'AbortError')
        operation = [
          'sourceChanged',
          'recipeChanged',
          'rulesChanged',
          'inputsEnded',
          'verificationFailed',
          'saveChanged',
          'foregroundLost',
          'continueInterrupted',
        ].includes(error.code)
          ? error.code
          : 'error';
    } finally {
      busy = false;
      refresh();
    }
  }
  next.onclick = () =>
    perform(async () => {
      const saved = store.read();
      const row = saved.snapshot && findRow(saved.snapshot);
      if (!row) throw new Error('Saved Team Hunt source is unavailable.');
      await onContinue(saved, row, { signal: controller.signal, opener: next });
    });
  discard.onclick = () => {
    if (busy || disposed) return;
    if (confirmation === null) {
      confirmation = store.read().raw;
      refresh();
      return;
    }
    try {
      const discarded = store.read();
      store.discard(confirmation);
      failed = false;
      operation = '';
      onDiscard(discarded);
    } catch {
      operation = 'error';
    }
    confirmation = null;
    refresh();
  };
  cancel.onclick = () => {
    confirmation = null;
    refresh();
  };
  backup.onclick = () =>
    perform(async () => {
      const saved = store.read();
      await exportJSONFile(
        saved.snapshot ?? { format: 'revealline-team-hunt-recovery-bytes.v1', raw: saved.raw },
        'revealline-team-hunt.json',
        { documentRef: doc },
      );
      return 'exported';
    });
  importInput.onchange = () =>
    perform(async () => {
      const file = importInput.files?.[0];
      importInput.value = '';
      if (!file) return;
      if (file.size > TEAM_HUNT_ATTEMPT_MAX_BYTES)
        throw new Error('Team Hunt backup is too large.');
      const source = await file.text();
      if (disposed) return;
      store.save(source, null);
      return 'imported';
    });
  const changed = (event) => {
    if (!event.key || event.key === TEAM_HUNT_ATTEMPT_KEY) refresh();
  };
  win?.addEventListener('storage', changed);
  refresh();
  return Object.freeze({
    refresh,
    failure(value) {
      failed = value;
      refresh();
    },
    dispose() {
      disposed = true;
      controller.abort();
      win?.removeEventListener('storage', changed);
      root.remove();
    },
  });
}
