import { localizedText, t, localizedAttribute } from '../../game/i18n/index.mjs';
const targets = Object.freeze({
  couch: Object.freeze({ name: 'Couch', path: '../../game/couch/' }),
  solo: Object.freeze({ name: 'Solo', path: '../../game/' }),
});
const presets = Object.freeze({
  '390x844': [390, 844],
  '844x390': [844, 390],
  '768x1024': [768, 1024],
  '1280x720': [1280, 720],
  '1280x800': [1280, 800],
});

const form = document.querySelector('#target-form');
const target = document.querySelector('#target');
const preset = document.querySelector('#preset');
const load = document.querySelector('#load-target');
const frame = document.querySelector('#game-frame');
const viewport = document.querySelector('#viewport');
const empty = document.querySelector('#empty-preview');
const dimensions = document.querySelector('#dimensions');
const loadedLabel = document.querySelector('#loaded-target');
const status = document.querySelector('#status');
const direct = document.querySelector('#direct-open');
let loadedTarget = null;

function selectionChanged() {
  const selected = targets[target.value];
  direct.href = selected.path;
  localizedText(direct, () =>t("tools:openDirectly", { value1: selected.name }));
  load.disabled = target.value === loadedTarget;
  localizedText(load, () =>load.disabled ? t("tools:isLoaded", { value1: selected.name }) : t("tools:loadSelectedGame"));
  if (loadedTarget && !load.disabled) {
    localizedText(status, () =>t("tools:remainsLoadedLoadExplicitlyToReplaceItSaveAndPause", { value1: targets[loadedTarget].name, value2: selected.name }));
  } else {
    localizedText(status, () =>loadedTarget
      ? t("tools:sizeChangesKeepThisGameLoadedResumeExplicitlyInsideThe")
      : t("tools:chooseAGameThenLoadItSizeChangesKeepThe"));
  }
}

function resize() {
  const [width, height] = presets[preset.value];
  viewport.style.setProperty('--viewport-width', `${width}px`);
  viewport.style.setProperty('--viewport-height', `${height}px`);
  frame.width = String(width);
  frame.height = String(height);
  dimensions.value = `${width} × ${height} CSS px`;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (target.value === loadedTarget) return;
  const selected = targets[target.value];
  loadedTarget = target.value;
  localizedAttribute(frame, "title", () => t("tools:viewportPreview", { value1: selected.name }));
  frame.src = selected.path;
  frame.hidden = false;
  empty.hidden = true;
  localizedText(loadedLabel, () =>t("tools:preview3", { value1: selected.name }));
  const returnToSelector = document.activeElement === load;
  selectionChanged();
  if (returnToSelector) target.focus();
  localizedText(status, () =>t("tools:requestedEnterThePreviewToUseTheGameSOwn", { value1: selected.name }));
});

target.addEventListener('change', selectionChanged);
preset.addEventListener('change', resize);
resize();
target.disabled = false;
preset.disabled = false;
selectionChanged();
const startupStatus = document.querySelector('#viewport-load-status');
// The shared launcher inserts its temporary Reload anchor immediately after
// this status. Retire only that action's focus when the real controls are ready.
const reload = startupStatus?.nextElementSibling;
const retiringFocus = reload?.tagName === 'A' && document.activeElement === reload;
if (startupStatus) startupStatus.hidden = true;
globalThis.RevealLineToolLaunch?.attached?.();
if (
  retiringFocus &&
  !document.hidden &&
  document.hasFocus() &&
  reload.hidden &&
  (document.activeElement === reload || document.activeElement === document.body)
)
  target.focus();
