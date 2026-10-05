import { actorDefinition } from '../hunt/actor-catalog.mjs';
import {
  OVERFLIGHT_SOLDIERS,
  OVERFLIGHT_MACHINERY,
  OVERFLIGHT_MODULES,
} from '../overflight/project.mjs';
import { required } from '../data-json.mjs';

const machinery = {
  'utility-car': { en: 'Utility car', uk: 'Службова машина' },
  'cargo-truck': { en: 'Cargo truck', uk: 'Вантажівка' },
  'armored-carrier': { en: 'Armored carrier', uk: 'Бронетранспортер' },
  'scout-car': { en: 'Scout car', uk: 'Розвідувальна машина' },
  'tracked-tank': { en: 'Tracked tank', uk: 'Гусеничний танк' },
  'radar-truck': { en: 'Radar truck', uk: 'Радарна машина' },
};
const modules = {
  primary: { en: 'Overflight payload', uk: 'Заряд прольоту' },
  'slow-field': { en: 'Slow field', uk: 'Поле сповільнення' },
  'proximity-pulse': { en: 'Proximity pulse', uk: 'Ближній імпульс' },
  'side-burst': { en: 'Side burst', uk: 'Бічний залп' },
  scanner: { en: 'Salvage scanner', uk: 'Сканер трофеїв' },
  shield: { en: 'Recovery shield', uk: 'Захисний екран' },
  plating: { en: 'Reactive plating', uk: 'Реактивна броня' },
};
export function overflightFamilyOptions(locale = 'en') {
  const language = locale === 'uk' ? 'uk' : 'en';
  return [...OVERFLIGHT_SOLDIERS, ...OVERFLIGHT_MACHINERY].map((id) => ({
    id,
    name: (actorDefinition(id)?.name ?? machinery[id])[language],
  }));
}
export function overflightModuleLabel(id, locale = 'en') {
  required(OVERFLIGHT_MODULES.includes(id), 'Unknown Overflight upgrade.');
  return modules[id][locale === 'uk' ? 'uk' : 'en'];
}
/** Keep authored order: checking a family must not silently reshuffle spawn selection. */
export function toggleOverflightFamily(families, id, selected) {
  const supported = [...OVERFLIGHT_SOLDIERS, ...OVERFLIGHT_MACHINERY];
  required(
    supported.includes(id) && families.every((value) => supported.includes(value)),
    'Unknown Overflight family.',
  );
  return selected
    ? [...families, ...(families.includes(id) ? [] : [id])]
    : families.filter((value) => value !== id);
}
