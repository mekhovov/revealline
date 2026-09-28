import { contentText } from '../i18n/content.mjs';
import { localizedMessage, localizedText, t, localizedAttribute } from '../i18n/index.mjs';
import {
  ENEMY_CATALOG,
  ENEMY_THEMES,
  ENEMY_STYLES,
  emptyEnemyCatalogDraft,
  validateEnemyCatalogDraft,
  enemySkinId,
  resolveEnemySkin,
} from '../enemy-catalog.mjs';
import { createActorPresentation, drawPresentedActor } from './actor-presentation.mjs';

/** Standalone authoring dialog. Apply returns choices, never a run or rewritten scored map. */
export function attachEnemyCatalogPanel({
  document: doc = globalThis.document,
  initialDraft = emptyEnemyCatalogDraft(),
  onApplyDraft = () => {},
  onPreview = () => {},
  onExport = () => {},
  onError = () => {},
  onClose = () => {},
  onRead = ({ region }) => region.focus(),
} = {}) {
  let saved = validateEnemyCatalogDraft(initialDraft),
    draft = structuredClone(saved),
    busy = false,
    disposed = false,
    returnFocus = null,
    time = 0;
  const poses = createActorPresentation(),
    listeners = [];
  const node = (tag, id, text) => {
    const el = doc.createElement(tag);
    if (id) el.id = `enemy-catalog-${id}`;
    if (text) localizedText(el, () =>text);
    return el;
  };
  const button = (id, label, action) => {
    const el = node('button', id, label);
    el.type = 'button';
    el.onclick = action;
    return el;
  };
  const select = (id, label, entries) => {
    const wrap = node('label', null, label),
      el = node('select', id);
    for (const [value, text] of entries) {
      const option = node('option', null, text);
      option.value = value;
      el.append(option);
    }
    wrap.append(el);
    return { wrap, el };
  };
  const dialog = node('dialog', 'dialog');
  dialog.className = 'enemy-catalog-dialog';
  dialog.setAttribute('aria-labelledby', 'enemy-catalog-title');
  const title = node('h2', 'title', localizedMessage("interface:enemyWorkshop")),
    note = node(
      'p',
      null,
      localizedMessage("interface:theseChoicesConfigureFutureAuthoringExistingMapsSavesAndRated"),
    ),
    status = node('p', 'status');
  status.setAttribute('role', 'status');
  const role = select(
    'role',
    t("interface:role"),
    ENEMY_CATALOG.map((r) => [r.type, r.label]),
  );
  const skin = select(
    'skin',
    t("interface:presentation"),
    ENEMY_THEMES.map((theme) => [theme, theme]),
  );
  const style = select(
    'style',
    t("interface:detailTreatment"),
    ENEMY_STYLES.map((id) => [id, id]),
  );
  const enableLabel = node('label', null, localizedMessage("interface:availableToFutureMapGenerators")),
    enabled = node('input', 'enabled');
  enabled.type = 'checkbox';
  enableLabel.prepend(enabled);
  const preview = node('canvas', 'preview');
  preview.width = 192;
  preview.height = 128;
  localizedAttribute(preview, "aria-label", () => t("interface:animatedSelectedEnemyPresentationTheSmallCenterMarksTheContact"),
  );
  const detail = node('p', 'detail'),
    risk = node('p', 'risk'),
    form = node('p', 'form');
  const reading = node('div', 'details');
  reading.tabIndex = 0;
  reading.setAttribute('role', 'region');
  localizedAttribute(reading, "aria-label", () => t("interface:selectedEnemyRoleDetails"));
  reading.setAttribute('data-game-reading', '');
  reading.append(form, detail, risk);
  const read = button('read', localizedMessage("interface:readRoleDetails"), () =>
    onRead({ region: reading, origin: read, label: t("interface:selectedEnemyRoleDetails") }),
  );
  const fields = node('div');
  fields.className = 'enemy-catalog-fields';
  fields.append(role.wrap, skin.wrap, style.wrap, enableLabel);
  const context = preview.getContext?.('2d');
  const current = () => draft.entries.find((entry) => entry.type === role.el.value);
  const chosen = () =>
    ENEMY_CATALOG.find((entry) => entry.type === role.el.value) ?? ENEMY_CATALOG[0];
  function render() {
    const record = chosen(),
      entry = current();
    skin.el.value = resolveEnemySkin(record.type, entry.skinId);
    style.el.value = draft.style;
    enabled.checked = entry.enabled;
    localizedText(detail, () =>`${contentText(record, 'label')} · ${contentText(record, 'domain')}. ${contentText(record, 'motion')}`);
    localizedText(risk, () =>contentText(record, 'risk'));
    localizedText(form, () =>t("gameplay:artSlotBadge", { value1: record.forms[ENEMY_THEMES.indexOf(skin.el.value)], value2: record.role, value3: record.badge }));
    play.disabled = busy || !entry.enabled;
    update(0);
  }
  function changed() {
    localizedText(status, () =>t("interface:draftChangedApplySavesOnlyThisAuthoringCatalog"));
    render();
  }
  role.el.onchange = () => {
    poses.reset();
    render();
  };
  skin.el.onchange = () => {
    current().skinId = enemySkinId(role.el.value, skin.el.value);
    poses.reset();
    changed();
  };
  style.el.onchange = () => {
    draft.style = style.el.value;
    changed();
  };
  enabled.onchange = () => {
    current().enabled = enabled.checked;
    changed();
  };
  async function perform(action, message) {
    if (busy || disposed) return false;
    busy = true;
    syncBusy();
    try {
      await action();
      if (disposed) return false;
      localizedText(status, () =>message);
      return true;
    } catch (error) {
      if (!disposed) {
        localizedText(status, () =>error.message);
        onError(error);
      }
      return false;
    } finally {
      busy = false;
      if (!disposed) {
        syncBusy();
        render();
      }
    }
  }
  const apply = button('apply', localizedMessage("interface:applyAuthoringChoices"), () =>
    perform(async () => {
      const next = validateEnemyCatalogDraft(draft);
      await onApplyDraft(next);
      saved = next;
      draft = structuredClone(next);
    }, t("interface:authoringChoicesSavedExistingGamesRemainUnchanged")),
  );
  const undo = button('undo', localizedMessage("interface:reloadSavedChoices"), () => {
    if (!busy) {
      draft = structuredClone(saved);
      localizedText(status, () =>t("interface:savedAuthoringChoicesRestored"));
      render();
    }
  });
  const play = button('play', localizedMessage("interface:trySelectedRole"), () =>
    perform(
      () => onPreview(role.el.value, validateEnemyCatalogDraft(draft)),
      t("interface:practiceOpenedWithTheSelectedRoleAndThemeItCannot"),
    ),
  );
  const exportButton = button('export', localizedMessage("interface:exportCatalogJson"), () =>
    perform(
      () => onExport(validateEnemyCatalogDraft(draft)),
      t("interface:catalogChoicesPreparedForDownloadThisFileContainsChoicesNot"),
    ),
  );
  const upload = node('input', 'import');
  upload.type = 'file';
  upload.accept = '.json,application/json';
  localizedAttribute(upload, "aria-label", () => t("interface:importCatalogChoicesJson"));
  upload.onchange = () =>
    perform(async () => {
      const file = upload.files?.[0];
      if (!file) throw new Error(t("interface:chooseACatalogJsonFile"));
      if (file.size > 65536) throw new Error(t("interface:catalogChoicesAreLimitedTo64Kib"));
      draft = structuredClone(validateEnemyCatalogDraft(JSON.parse(await file.text())));
    }, t("interface:importedIntoTheDraftApplyWhenReady"));
  const back = button('back', localizedMessage("common:actions.back"), close),
    actions = node('div');
  actions.className = 'enemy-catalog-actions';
  actions.append(apply, undo, play, exportButton, upload, back);
  dialog.append(title, note, fields, preview, read, reading, status, actions);
  doc.body.append(dialog);
  function syncBusy() {
    for (const el of dialog.querySelectorAll('button,input,select')) el.disabled = busy;
  }
  const cancel = (event) => {
    event.preventDefault();
    if (!busy) close();
  };
  dialog.addEventListener('cancel', cancel);
  listeners.push(() => dialog.removeEventListener('cancel', cancel));
  function update(dt = 0, { paused = false, reduced = false } = {}) {
    if (disposed || !dialog.open || !context) return;
    if (!paused) time += Math.max(0, Math.min(0.1, Number.isFinite(dt) ? dt : 0));
    const entry = current(),
      record = chosen(),
      frame = poses
        .sample(
          [
            {
              id: 'preview',
              type: record.type,
              x: record.role === 'boss' ? 6 : 6 + Math.sin(time * 2) * 0.7,
              y: record.role === 'boss' ? 4 : 4 + Math.cos(time * 2) * 0.7,
              vx: 0,
              vy: -2,
              radius: 0.25,
            },
          ],
          {
            tick: Math.floor(time * 120),
            time,
            dt,
            paused,
            reduced,
            themeId: resolveEnemySkin(entry.type, entry.skinId),
            style: draft.style,
            scale: 1.5,
          },
        )
        .get('preview');
    context.clearRect(0, 0, 192, 128);
    context.fillStyle = '#080d19';
    context.fillRect(0, 0, 192, 128);
    drawPresentedActor(context, frame, {
      danger: '#ff7299',
      accent: '#91d6d8',
      paper: '#e6e9e2',
      muted: '#687b91',
    });
  }
  function open({ draft: next } = {}) {
    if (disposed || busy) return false;
    if (next) {
      saved = validateEnemyCatalogDraft(next);
      draft = structuredClone(saved);
    }
    returnFocus = doc.activeElement;
    if (!dialog.open) dialog.showModal();
    role.el.value ||= ENEMY_CATALOG[0].type;
    render();
    role.el.focus();
    return true;
  }
  function close() {
    if (disposed || busy) return false;
    if (dialog.open) dialog.close();
    if (returnFocus?.isConnected) returnFocus.focus();
    onClose();
    return true;
  }
  return {
    dialog,
    open,
    close,
    update,
    snapshot: () => validateEnemyCatalogDraft(draft),
    dispose() {
      disposed = true;
      listeners.forEach((off) => off());
      dialog.remove();
    },
  };
}
