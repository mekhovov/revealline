import { t } from '../../game/i18n/index.mjs';

export function assetStudioErrorText(error) {
  if (error?.localization?.key)
    return t(error.localization.key, error.localization.values ?? Object.create(null));
  return error?.message || String(error);
}

export const assetStudioErrorMessage = (error) => () => assetStudioErrorText(error);
