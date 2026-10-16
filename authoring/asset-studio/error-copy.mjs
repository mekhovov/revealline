import { t } from '../../game/i18n/index.mjs';

export function assetStudioErrorText(error) {
  const key = error?.localization?.key;
  if (typeof key === 'string') {
    const [namespace, messageKey, extra] = key.split(':');
    const catalog = globalThis.RevealLineTranslations?.en?.[namespace];
    // Accept shared authoring descriptors only when their message actually exists.
    // Unknown keys must not replace authored diagnostics with a key or generic copy.
    if (
      extra === undefined &&
      catalog &&
      Object.hasOwn(catalog, messageKey) &&
      typeof catalog[messageKey] === 'string'
    )
      return t(key, error.localization.values ?? Object.create(null));
  }
  return error?.message || String(error);
}

export const assetStudioErrorMessage = (error) => () => assetStudioErrorText(error);
