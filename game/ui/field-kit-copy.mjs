/** New surface copy has stable keys. Add a Ukrainian catalog here when translated;
 * language variants fall back to English without changing game state or saves. */
export const FIELD_KIT_ENGLISH = Object.freeze({
  'navigation.continue': 'Continue',
  'navigation.deploy': 'Deploy',
  'navigation.missions': 'Missions',
  'navigation.collection': 'Collection',
  'navigation.settings': 'Settings',
  'navigation.workshop': 'Workshop',
  'workshop.motion': 'Motion lab',
  'workshop.pictures': 'Pictures & stories',
  'workshop.poster': 'Video poster workshop',
  'workshop.atlas': 'Design atlas',
  'navigation.back': 'Back',
  'navigation.singlePlayer': 'Single player',
  'navigation.couch': 'Couch play',
  'navigation.previousPage': '← Previous',
  'navigation.nextPage': 'Next →',
  'missions.pages': 'Mission pages',
  'missions.chooseAvailable': 'Choose an available mission',
  'missions.locked': 'Locked',
  'missions.earned': 'Picture earned',
  'missions.unavailable': 'Preview unavailable',
  'missions.concealed': 'Picture concealed',
  'missions.loading': 'Loading picture…',
  'missions.brief': 'Mission brief',
  'missions.briefContext': '{edition} · MISSION BRIEF',
  'missions.currentFlight': 'CURRENT FLIGHT',
  'title.trainingDestination': 'Training · Your current lesson',
  'title.continueDestination': 'Continue · {destination}',
  'title.deployDestination': 'Deploy · Pressure Lines / Arcade',
  'title.preparing': 'Preparing…',
  'settings.categories': 'Settings categories',
  'settings.title': 'Flight settings.',
  'settings.couchTitle': 'Flight settings',
  'settings.controls': 'Controls',
  'settings.audio': 'Audio',
  'settings.display': 'Display & accessibility',
  'settings.data': 'Game data',
  'settings.controlsDescription': 'Keyboard, controller and touch.',
  'settings.audioDescription': 'Music, effects and your soundtrack library.',
  'settings.displayDescription': 'Readable text, terrain and comfortable motion.',
  'settings.dataDescription': 'Saves, recovery, installed chapters and offline play.',
  'settings.touchHeading': 'Touch & on-screen steering',
  'settings.saves': 'Saves & recovery',
  'settings.packs': 'Installed chapters',
  'settings.libraryDescription':
    'Manage saved flights, game-data backups and installed chapters in your flight library.',
  'results.picture': 'The picture revealed in this flight',
  'collection.title': 'Your collection.',
  'collection.records': 'Flight records',
  'library.title': 'Flight library.',
  'library.records': 'Records',
  'display.textSize': 'Text size',
  'display.standard': 'Standard',
  'display.large': 'Large',
  'about.eyebrow': 'FIELD KIT / GAME GUIDE',
});

const catalogs = new Map([['en', FIELD_KIT_ENGLISH]]);

export function fieldKitCopy(key, locale = 'en', values = {}) {
  const language = String(locale).toLowerCase().split('-')[0];
  const catalog = catalogs.get(language) ?? FIELD_KIT_ENGLISH;
  const copy = Object.hasOwn(catalog, key)
    ? catalog[key]
    : Object.hasOwn(FIELD_KIT_ENGLISH, key)
      ? FIELD_KIT_ENGLISH[key]
      : null;
  return (
    copy?.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (match, name) =>
      Object.hasOwn(values, name) ? String(values[name]) : match,
    ) ?? null
  );
}

export function applyFieldKitCopy(doc, locale = doc.documentElement?.lang || 'en') {
  for (const element of doc.querySelectorAll('[data-field-kit-copy]')) {
    const copy = fieldKitCopy(element.getAttribute('data-field-kit-copy'), locale);
    if (copy !== null) element.textContent = copy;
  }
  for (const element of doc.querySelectorAll('[data-field-kit-copy-aria-label]')) {
    const copy = fieldKitCopy(element.getAttribute('data-field-kit-copy-aria-label'), locale);
    if (copy !== null) element.setAttribute('aria-label', copy);
  }
}
