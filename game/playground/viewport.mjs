import { t } from '../i18n/index.mjs';
export const PREVIEW_SIZE_LIMITS = Object.freeze({ min: 240, max: 2560 });

/** Dimensions affect only the existing preview viewport, never scenario or run data. */
export function resolvePreviewSize(width, height) {
  const dimension = (value, name) => {
    if (typeof value === 'string' && /^\d+$/.test(value.trim())) value = Number(value.trim());
    if (
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value < PREVIEW_SIZE_LIMITS.min ||
      value > PREVIEW_SIZE_LIMITS.max
    )
      throw new Error(t("tools:mustBeAWholeNumberFrom240To2560Css", { value1: name }));
    return value;
  };
  return { width: dimension(width, t("tools:width")), height: dimension(height, t("tools:height")) };
}
