/** New surface copy has stable keys. Add a Ukrainian catalog here when translated;
 * language variants fall back to English without changing game state or saves. */
export const FIELD_KIT_ENGLISH = Object.freeze({
  'navigation.continue': 'Continue',
  'navigation.start': 'Start',
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
  'motion.stageLabels': 'Stage labels',
  'motion.stageLabelsHint':
    'Full text for the toy markers. Canvas captions may shorten to fit; hidden notes appear only while revealed.',
  'motion.stageRolesHint':
    'Haze affects the displayed signal only. Enter a supply pad and press R to refill.',
  'motion.stageKind.haze': 'Haze',
  'motion.stageKind.pad': 'Supply pad',
  'motion.stageKind.ground': 'Ground marker',
  'motion.stageKind.air': 'Air marker',
  'motion.stageKind.delivery': 'Delivery marker',
  'motion.stageKind.relay': 'Relay marker',
  'motion.stageKind.note': 'Note',
  'motion.concealedNote': 'Concealed note',
  'motion.noteVisible': 'Visible while the scan lasts',
  'motion.markerReady': 'Ready',
  'motion.markerUpdated': 'Updated',
  'motion.sharedReading':
    'Text size is shared with the game. Theme or Plain text follows game Display settings.',
  'motion.effectsCapped':
    'Shared or system reduced effects are active. The local preview choice is kept; movement and Play/Pause are unchanged.',
  'motion.effectsLocal':
    'Local reduced motion freezes attachment detail and removes particles. Movement and Play/Pause are unchanged.',
  'motion.effectsFull':
    'Full preview effects are available. Window blur or a hidden page pauses the study; use Play to resume.',
  'motion.inspectionLoading': 'Body image loading; the neutral marker is shown.',
  'motion.inspectionUnavailable': 'Body unavailable; the neutral marker is shown.',
  'motion.inspectionNeutral': 'Neutral fallback marker; this body has no image.',
  'display.sharedToolNotice':
    "Text size is shared with the game's Display settings. Plain text and reduced effects follow those settings too.",
  'playground.mapLabel':
    'Click to paint the board. Use Paint by coordinates for keyboard editing. Signal and hangar details follow the map.',
  'playground.mapDetails': 'Signal zones and hangars',
  'playground.mapDetailsLoading': 'Map details appear after the working configuration loads.',
  'playground.mapDetailsHelp':
    "Dashed rectangles mark signal zones; diamond-framed squares mark hangars. Locations use zero-based cell coordinates: x from the left, y from the top. Hangar marker size does not represent its activation radius. Signal effects apply to vulnerable craft; overlapping zones use the lowest speed. Switch within a hangar's radius on safe ground, with no active cut and after the switch cooldown.",
  'playground.paintHelp':
    "Signal speed and optional boost/ability locks apply to vulnerable classes. Edit each zone's flags in Level JSON. Switch class within a hangar's radius on safe ground, with no active cut and after the switch cooldown. Erase removes a whole zone or object.",
  'playground.noSignalZones': 'No signal zones.',
  'playground.signalZone':
    'Signal zone {id}: x {x}, y {y}; {width} × {height} cells; speed {speed}%; boost {boost}; ability {ability}.',
  'playground.boostBlocked': 'blocked',
  'playground.boostAllowed': 'allowed',
  'playground.abilityLocked': 'locked',
  'playground.abilityAllowed': 'allowed',
  'playground.defaultHangar': 'Default start hangar: x {x}, y {y}; radius 2 cells.',
  'playground.hangar': 'Hangar {id}: x {x}, y {y}; radius {radius} cells.',
  'playground.noHangars': 'No hangars; class switching is disabled.',
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
