import { localizedText, t } from '../i18n/index.mjs';
import { authoringError } from '../content-design/authoring-error.mjs';

export function editorMessageError(key, values) {
  return authoringError(t(key, values), key, values);
}
export function editorErrorText(error) {
  return error.localization ? t(error.localization.key, error.localization.values) : error.message;
}
export function showEditorFailure(element, error) {
  localizedText(element, () =>
    t('tools:studio.editor.notApplied', {
      message: editorErrorText(error),
    }),
  );
}
