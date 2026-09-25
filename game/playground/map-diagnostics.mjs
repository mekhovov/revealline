import { getLocale, localizedText } from '../i18n/index.mjs';
import { fieldKitCopy } from '../ui/field-kit-copy.mjs';

/** Readable host text for map details that must not shrink with the canvas.
 * The caller supplies its validated working level; inspection never mutates it. */
export function mapDiagnosticDescriptions(level, { locale = 'en' } = {}) {
  const copy = (key, values) => fieldKitCopy(`playground.${key}`, locale, values);
  const zones = level.signalZones ?? [];
  const descriptions = zones.length
    ? zones.map((zone) =>
        copy('signalZone', {
          id: zone.id,
          x: zone.x,
          y: zone.y,
          width: zone.w,
          height: zone.h,
          speed: Math.round(zone.speedFactor * 100),
          boost: copy(zone.disableBoost ? 'boostBlocked' : 'boostAllowed'),
          ability: copy(zone.lockAbility ? 'abilityLocked' : 'abilityAllowed'),
        }),
      )
    : [copy('noSignalZones')];
  if (level.hangars === undefined) {
    descriptions.push(copy('defaultHangar', level.spawn));
  } else if (level.hangars.length) {
    for (const hangar of level.hangars) {
      descriptions.push(copy('hangar', { ...hangar, radius: hangar.radius ?? 2 }));
    }
  } else {
    descriptions.push(copy('noHangars'));
  }
  return descriptions;
}

export function renderMapDiagnostics(list, level) {
  const doc = list.ownerDocument;
  let locale = getLocale();
  let descriptions = mapDiagnosticDescriptions(level, { locale });
  const description = (index) => {
    if (locale !== getLocale()) {
      locale = getLocale();
      descriptions = mapDiagnosticDescriptions(level, { locale });
    }
    return descriptions[index];
  };
  list.replaceChildren(
    ...descriptions.map((_, index) => {
      const item = doc.createElement('li');
      localizedText(item, () => description(index));
      return item;
    }),
  );
}
