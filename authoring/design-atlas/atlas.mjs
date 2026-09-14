// Original review mockups only. This module never imports the game or writes player storage.
const $ = (selector) => document.querySelector(selector);

const drone = `<svg class="drone-svg" viewBox="0 0 220 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" shape-rendering="crispEdges">
  <path fill="#111a21" d="M31 18h36v9h14v32h-9v12H39V59H24V32h7zm122 0h36v14h7v27h-15v12h-32V59h-9V27h13zM31 89h36v12h14v32H67v9H31v-14h-7v-27h7zm122 0h36v12h7v27h-7v14h-36v-9h-13v-32h13z"/>
  <path fill="#536871" d="M39 25h27v7h7v23H62v8H39v-8H31V32h8zm115 0h27v7h8v23h-8v8h-23v-8h-11V32h7zM39 97h23v8h11v23h-7v7H39v-7h-8v-23h8zm119 0h23v8h8v23h-8v7h-27v-7h-7v-23h11z"/>
  <path fill="#23323b" d="M38 34h19v-8h9v19h-9v12h-9V45H38zm118 0h19v-8h9v19h-9v12h-9V45h-10zM38 107h19v-8h9v19h-9v12h-9v-12H38zm118 0h19v-8h9v19h-9v12h-9v-12h-10z"/>
  <path fill="#6d858c" d="m62 50 10-9 38 33 38-33 10 9-38 31 38 30-10 9-38-31-38 31-10-9 38-30z"/>
  <path fill="#22313a" d="M88 51h44v59H88z"/>
  <path fill="#9caeaa" d="M92 54h36v7H92zm0 49h36v5H92z"/>
  <path fill="#10191f" d="M98 62h24v38H98z"/>
  <path fill="#f4bf62" d="M99 72h22v14H99z"/>
  <path fill="#967849" d="M99 86h22v8H99z"/>
  <path fill="#78dce8" d="M103 43h14v9h-14z"/>
  <path fill="#070b12" d="M106 45h8v5h-8z"/>
  <path fill="#9caeaa" d="M108 110h4v21h-4z"/>
  <path fill="#78dce8" d="M104 128h12v5h-12z"/>
</svg>`;

document.querySelectorAll('[data-drone]').forEach((element) => {
  element.innerHTML = drone;
});

const commands = (back = 'title') =>
  `<div class="mock-command"><button type="button" data-screen="${back}">← Back</button><span class="desktop-hints"><kbd>↑↓</kbd> Move <kbd>Enter</kbd> Choose</span><span>LAYOUT STUDY</span></div>`;
const top = (title, detail = 'FPV / FIRST LIGHT') =>
  `<div class="mock-topline"><strong>${title}</strong><span>${detail}</span></div>`;
const action = (label, screen, primary = false) =>
  `<button type="button" class="action${primary ? ' primary' : ''}" data-screen="${screen}">${label}</button>`;

const missionNames = [
  'First light',
  'River crossing',
  'Open field',
  'Quiet woodland',
  'Relay district',
  'Homeward',
];
function missionCards(count = 6, unknown = false) {
  return `<div class="mission-grid">${missionNames
    .slice(0, count)
    .map((name, i) => {
      const mystery = unknown && i > 0;
      return `<article class="mission-card${i === 0 ? ' selected' : ''}"><div class="mission-art terrain-${i}${mystery ? ' unknown' : ''}"><span class="mission-number">0${i + 1}</span>${mystery ? '<span class="unknown-mark">?</span>' : ''}<span class="medals" aria-label="${i === 0 ? 'Three' : 'One'} of three illustrative medals">${mystery ? '☆☆☆' : i === 0 ? '★★★' : '★☆☆'}</span></div><div class="mission-label"><span>${name}</span><span>${mystery ? 'UNREVEALED' : i === 0 ? '11,450' : '2,380'}</span></div></article>`;
    })
    .join('')}</div>`;
}

function titleScreen(state) {
  const first = state === 'first-visit';
  return `<div class="mock-screen">${top('REVEALLINE', 'SOLO / FIELD KIT')}
    <div class="mock-title-content"><div><p class="mock-logo">REVEAL<br /><span>LINE</span></p><p class="mock-subtitle">MAKE A PATH. REVEAL A WORLD.</p>
    <div class="mock-menu"><button type="button" class="menu-focus" data-screen="${first ? 'missions' : 'briefing'}">${first ? 'Deploy' : 'Continue'}</button><button type="button" data-screen="missions">Missions</button><button type="button" data-screen="collection">Collection</button><button type="button" data-screen="settings">Settings</button><button type="button" data-screen="workshop">Workshop</button></div>
    <p class="menu-destination">${first ? 'Your first route is waiting.' : 'First Light · River crossing · Scout'}</p></div><div class="title-art">${drone}</div></div>
    <div class="mock-command"><span>Original FPV world</span><span class="desktop-hints"><kbd>↑↓</kbd> Move <kbd>Enter</kbd> Choose</span><span>PROPOSED TITLE</span></div></div>`;
}

function missionsScreen(state) {
  const mystery = state === 'unrevealed';
  return `<div class="mock-screen">${top('MISSIONS', 'COLLECTION / 08 STARS')}
    <div class="mock-gallery-head"><div><h3>First Light</h3><p>Six routes into a new day · 01–06 of 12</p></div><div class="pack-tabs" aria-label="Illustrative pack tabs"><span>First Light</span><span>More worlds</span></div></div>
    ${missionCards(6, mystery)}
    <div class="mission-choice"><div><strong>01 / First light</strong><p>Scout · Standard <span aria-hidden="true">/</span> ${mystery ? 'Artwork reveals through play' : 'Three medals earned'}</p></div><div class="mock-actions">${action('Preview', 'collection')}${action('Deploy →', 'briefing', true)}</div></div>${commands()}</div>`;
}

function briefingScreen(state) {
  const gentle = state === 'gentle';
  return `<div class="mock-screen">${top('MISSION BRIEF / 01', 'FIRST LIGHT')}<h3>Choose your route.</h3>
    <div class="brief-grid"><div class="mission-art terrain-0 brief-art"><span class="mission-number">FIRST LIGHT / ORIGINAL LAYOUT STUDY</span></div><dl class="brief-conditions"><div><dt>Craft</dt><dd>Scout / change</dd></div><div><dt>Difficulty</dt><dd>${gentle ? 'Gentle' : 'Standard'} / change</dd></div><div><dt>Coverage target</dt><dd>80%</dd></div><div><dt>Medal opportunity</dt><dd>Finish in 60 seconds</dd></div></dl></div>
    <p class="mock-description">Reconnect your unfinished line to claim the enclosed ground. Keep an eye on moving threats as the frontier changes.</p>
    <div class="mock-actions">${action('Deploy →', 'flight', true)}${action('Field guide', 'settings')}</div><p class="small-note">Proposed preparation screen. Retry reuses your setup without reopening this step.</p>${commands('missions')}</div>`;
}

function arenaMarkup(state) {
  const message =
    state === 'life-loss'
      ? '<div class="arena-message"><strong>LINK LOST</strong><p>Your unfinished line is gone.<br />Previously claimed ground remains.</p></div>'
      : state === 'warning'
        ? '<div class="arena-message"><strong>LINE EXPOSED</strong><p>Choose your next turn.</p></div>'
        : '';
  return `<div class="arena-mock" aria-label="Illustrative arena: amber player, cyan live route, patterned terrain and coral threats"><div class="revealed-land"></div><div class="frontier"></div><div class="live-route"></div><div class="terrain-wall"></div><div class="terrain-slow"></div><div class="terrain-danger"></div><span class="threat one"></span><span class="threat two"></span><span class="threat three"></span><div class="arena-craft">${drone}</div>${message}</div>`;
}

function flightScreen(state, paused = false) {
  if (paused)
    return `<div class="mock-screen"><div class="pause-overlay"><p class="eyebrow">FIRST LIGHT / SCOUT</p><h3>Flight paused</h3><div class="mock-menu"><button type="button" class="menu-focus" data-screen="flight">Resume</button><button type="button" data-screen="flight">Retry mission</button><button type="button" data-screen="settings">Settings</button><button type="button" data-screen="missions">Missions</button></div><p class="small-note">Opaque cover. Resume is the primary action.</p></div></div>`;
  return `<div class="mock-screen mock-flight"><div class="flight-hud"><div class="hud-item"><span>SCOUT / LIVES</span><strong>${state === 'life-loss' ? '02' : '03'}</strong></div><div class="hud-item hud-coverage"><span>COVERAGE / TARGET</span><strong>56 / 80</strong><div class="coverage-track"><span></span></div></div><div class="hud-item"><span>SCORE</span><strong>2,380</strong></div><div class="hud-item"><span>MEDAL TIME</span><strong>00:42</strong></div></div>
    ${arenaMarkup(state)}<div class="flight-bottom"><span class="flight-state">${state === 'life-loss' ? 'RETURNING TO FRONTIER' : 'LIVE LINE / FIND A TURN'}</span><span class="flight-ability">PULSE / READY</span></div>
    <div class="touch-controls" aria-label="Illustrative touch layout; controls are not connected"><div class="touch-dpad" aria-hidden="true"><span>↑</span><span>←</span><span>↓</span><span>→</span></div><span class="touch-action">PULSE</span></div>
    <div class="mock-command"><button type="button" data-screen="pause">Ⅱ Pause</button><span class="desktop-hints">Critical paths stay above artwork</span><span>NO LIVE SIMULATION</span></div>
    ${paused ? `<div class="pause-overlay"><p class="eyebrow">FIRST LIGHT / SCOUT</p><h3>Flight paused</h3><div class="mock-menu"><button type="button" class="menu-focus" data-screen="flight">Resume</button><button type="button" data-screen="flight">Retry mission</button><button type="button" data-screen="settings">Settings</button><button type="button" data-screen="missions">Missions</button></div><p class="small-note">Focus returns to Resume.</p></div>` : ''}</div>`;
}

function resultsScreen(state) {
  const failed = state === 'defeat';
  return `<div class="mock-screen">${top('MISSION / 01', 'FIRST LIGHT')}
    <div class="results-content"><p class="eyebrow">${failed ? 'RETRY THE ROUTE' : 'WORLD REVEALED'}</p><h3>${failed ? 'Signal lost.' : 'First light, found.'}</h3>
    <div class="result-emblem${failed ? ' failure' : ''}" aria-hidden="true">${failed ? '×' : '★ ★ ★'}</div>
    ${failed ? '<p class="mock-description">A threat reached your unfinished line.<br />Try a shorter cut on your next flight.</p>' : '<div class="result-goals"><span><b>★</b>Mission complete</span><span><b>★</b>All lives saved</span><span><b>★</b>Within medal time</span></div><p class="result-score">11,450</p><p class="result-highscore">NEW HIGH SCORE</p>'}
    <div class="mock-actions">${action(failed ? 'Retry →' : 'Next mission →', 'flight', true)}${action(failed ? 'Missions' : 'View picture', failed ? 'missions' : 'collection')}${failed ? '' : action('Retry', 'flight')}</div></div>${commands('missions')}</div>`;
}

function settingsScreen(state) {
  const large = state === 'large-text';
  return `<div class="mock-screen">${top('SETTINGS')}<h3>Make it yours.</h3><div class="settings-layout"><div class="settings-tabs" aria-label="Illustrative settings categories"><span class="selected">Display</span><span>Audio</span><span>Controls</span><span>Language</span><span>Saves</span></div><div class="settings-list"><div class="setting-row"><span>Text size<small>Comfortable at a glance</small></span><span class="setting-value">${large ? 'LARGE' : 'STANDARD'}</span></div><div class="setting-row"><span>Reduced effects</span><span class="setting-value">ON</span></div><div class="setting-row"><span>Background brightness</span><span class="mini-range" aria-hidden="true"></span></div><div class="setting-row"><span>High contrast paths</span><span class="setting-value">ON</span></div><div class="settings-preview"><strong style="font-size:${large ? '25' : '20'}px">56 / 80 · 00:42</strong>Live preview uses the same HUD type and colors. Full input behavior belongs to the game implementation.</div></div></div>${commands()}</div>`;
}

function collectionScreen(state) {
  const picture = state === 'picture';
  return `<div class="mock-screen">${top('COLLECTION', 'FIRST LIGHT / 03 OF 12')}<h3>${picture ? 'A world worth finding.' : 'Your revealed worlds.'}</h3>${picture ? '<div class="mission-art terrain-0 brief-art" style="min-height:300px;margin-bottom:20px" aria-label="Original abstract field illustration"><span class="mission-number">ILLUSTRATIVE ART / NOT A PRODUCTION BACKGROUND</span></div>' : missionCards(6, true)}<p class="mock-description">${picture ? 'A quiet picture view, separate from achieved coverage. Return to the same selection when you close it.' : 'Collected artwork, earned medals and memorable routes. Unrevealed images remain distinct from mission access.'}</p><div class="mock-actions">${action(picture ? 'Return to collection' : 'View picture', 'collection', true)}${action('Replay mission', 'briefing')}</div>${commands()}</div>`;
}

function workshopScreen(state) {
  const error = state === 'validation';
  return `<div class="mock-screen">${top('WORKSHOP / ASSET STUDIO', 'LOCAL DRAFT')}<h3>Every detail, in your hands.</h3><div class="workshop-layout"><div class="slot-nav"><span class="selected">Player</span><span>Threats</span><span>Terrain</span><span>Interface</span><span>Pictures</span><span>Audio</span></div><div class="slot-art">${drone}</div><div class="slot-meta"><span class="badge ${error ? 'proposed' : 'implemented'}">${error ? 'Draft needs review' : 'Illustrative preview'}</span><h4>FPV / scout body</h4><p>${error ? 'This draft does not match the selected slot. Resolve dimensions and required states before applying.' : 'Inspect at native size, replace an image, or edit a compact sprite. Preserve the original and its slot contract.'}</p><dl class="slot-contract"><dt>Role</dt><dd>Player body</dd><dt>Theme</dt><dd>FPV Field Kit</dd><dt>Bounds</dt><dd>From registry</dd><dt>Source</dt><dd>Original artwork</dd></dl><div class="mock-actions">${action('Preview in field', 'flight')}${action('Asset brief ↓', 'workshop', true)}</div></div></div><p class="mock-description">Single assets and coordinated collections share the same review flow. Applying a collection succeeds only when every required member is valid.</p>${commands()}</div>`;
}

const screens = {
  title: {
    label: 'Title / landing',
    states: [
      ['returning', 'Returning player'],
      ['first-visit', 'First visit'],
    ],
    render: titleScreen,
    purpose: 'One obvious first action',
    rule: 'Continue names the saved destination. Supporting links stay in the game’s visual language; the title never becomes a website navigation page.',
  },
  missions: {
    label: 'Mission gallery',
    states: [
      ['progress', 'With progress'],
      ['unrevealed', 'Unrevealed artwork'],
    ],
    render: missionsScreen,
    purpose: 'Artwork makes the campaign tangible',
    rule: 'Three columns on desktop, two on tablet, one on phone. The number of visible cards is a viewport choice; remaining missions stay reachable in production.',
  },
  briefing: {
    label: 'Mission preparation',
    states: [
      ['standard', 'Standard'],
      ['gentle', 'Gentle'],
    ],
    render: briefingScreen,
    purpose: 'Know the mission before committing',
    rule: 'Show class, difficulty and actual objectives. Retry preserves the setup. A speed-medal opportunity must never masquerade as a failure deadline.',
  },
  flight: {
    label: 'Live arena',
    states: [
      ['running', 'Running'],
      ['warning', 'Exposed-line message'],
      ['life-loss', 'Life lost'],
    ],
    render: flightScreen,
    purpose: 'The player and live route lead',
    rule: 'The grid and simulation stay fixed across viewport changes. This diagram demonstrates hierarchy, not tested gameplay density. Touch controls stay outside the board.',
  },
  pause: {
    label: 'Contextual pause',
    states: [['paused', 'Paused']],
    render: (state) => flightScreen(state, true),
    purpose: 'Keep the player’s place',
    rule: 'Conceal the arena, artwork and actors with an opaque pause surface; pause simulation, default to Resume and restore focus when closing. Settings and the Field Guide return to the paused context.',
  },
  results: {
    label: 'Results / retry',
    states: [
      ['victory', 'Victory'],
      ['defeat', 'Defeat'],
    ],
    render: resultsScreen,
    purpose: 'Celebrate clearly, recover quickly',
    rule: 'Separate artwork, medals and score. Make Next and Retry directly reachable. Finishing an animation must not also start the next attempt.',
  },
  settings: {
    label: 'Settings',
    states: [
      ['standard', 'Standard text'],
      ['large-text', 'Large text specimen'],
    ],
    render: settingsScreen,
    purpose: 'Comfort belongs inside the game',
    rule: 'Use the same focus, text and controls. Preview relevant changes in context. Language readiness includes Ukrainian glyphs and expansion, not only a language selector.',
  },
  collection: {
    label: 'Collection / picture',
    states: [
      ['gallery', 'Gallery'],
      ['picture', 'Picture view'],
    ],
    render: collectionScreen,
    purpose: 'Let the revealed artwork breathe',
    rule: 'Offer a quiet full-picture view and an explicit return. Remember the selected image. An unrevealed picture is not a mission lock.',
  },
  workshop: {
    label: 'Asset Studio concept',
    states: [
      ['draft', 'Inspect a slot'],
      ['validation', 'Invalid replacement'],
    ],
    render: workshopScreen,
    purpose: 'A complete replacement workflow',
    rule: 'This is a proposed layout only. The framework must provide slot contracts, native/context previews, prompts, validation, drafts and atomic collection application.',
  },
};

let currentScreen = 'title';
let currentState = 'returning';

function renderScreen() {
  const screen = screens[currentScreen];
  $('#screen-preview').innerHTML = screen.render(currentState);
  $('#study-purpose').innerHTML =
    `<strong>${screen.purpose}</strong>${screen.label} / ${screen.states.find(([id]) => id === currentState)[1]}`;
  $('#study-rule').textContent = screen.rule;
  $('#review-status').textContent =
    `${screen.label}, ${screen.states.find(([id]) => id === currentState)[1]} study shown.`;
}

function chooseScreen(name, state) {
  if (!Object.hasOwn(screens, name)) return;
  currentScreen = name;
  currentState = screens[name].states.some(([id]) => id === state)
    ? state
    : screens[name].states[0][0];
  $('#screen-select').value = name;
  $('#state-select').replaceChildren(
    ...screens[name].states.map(([value, label]) => new Option(label, value)),
  );
  $('#state-select').value = currentState;
  renderScreen();
}

$('#screen-select').replaceChildren(
  ...Object.entries(screens).map(([value, { label }]) => new Option(label, value)),
);
$('#screen-select').addEventListener('change', (event) => chooseScreen(event.target.value));
$('#state-select').addEventListener('change', (event) => {
  currentState = event.target.value;
  renderScreen();
});
$('#screen-preview').addEventListener('click', (event) => {
  const button = event.target.closest('[data-screen]');
  if (!button) return;
  if (button.textContent === 'Asset brief ↓') {
    $('.prompt-example').open = true;
    $('.prompt-example').scrollIntoView({ block: 'center' });
    $('#copy-prompt').focus({ preventScroll: true });
    return;
  }
  const picture = button.textContent.includes('picture') || button.textContent === 'Preview';
  chooseScreen(button.dataset.screen, picture ? 'picture' : undefined);
  $('#screen-select').focus({ preventScroll: true });
});

document.querySelectorAll('[data-viewport]').forEach((button) => {
  if (button.tagName !== 'BUTTON') return;
  button.addEventListener('click', () => {
    const view = button.dataset.viewport;
    $('#screen-stage').dataset.viewport = view;
    document
      .querySelectorAll('button[data-viewport]')
      .forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
    $('#viewport-label').textContent = {
      desktop: 'Fluid desktop / up to 1120 px',
      tablet: 'Tablet / up to 768 px',
      phone: 'Phone / up to 390 px',
      landscape: 'Short landscape / up to 740 × 370 px',
    }[view];
    $('#review-status').textContent =
      `${view} preview selected. Width is limited by the available window.`;
  });
});

document.querySelectorAll('[data-language]').forEach((button) => {
  button.addEventListener('click', () => {
    const ukrainian = button.dataset.language === 'uk';
    document
      .querySelectorAll('[data-language]')
      .forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
    $('#display-specimen').textContent = ukrainian
      ? 'Обери свій маршрут.'
      : 'Find your next route.';
    $('#ui-specimen').textContent = ukrainian
      ? 'Обери місію. Замкни лінію. Відкрий світ.'
      : 'Choose a mission. Close the line. Reveal the world.';
    $('#display-specimen').lang = ukrainian ? 'uk' : 'en';
    $('#ui-specimen').lang = ukrainian ? 'uk' : 'en';
  });
});

const palette = [
  ['Stage', '#070B12'],
  ['Panel', '#101923'],
  ['Text', '#F3F0DB'],
  ['Navigation', '#78DCE8'],
  ['Player / reward', '#F4BF62'],
  ['Threat', '#F07879'],
  ['Success', '#9DBB7A'],
  ['Secondary', '#A5B2BB'],
];
$('#palette').innerHTML = palette
  .map(
    ([role, hex]) =>
      `<div class="swatch"><div class="swatch-color" style="background:${hex}"></div><strong>${role}</strong><code>${hex}</code></div>`,
  )
  .join('');

const inventory = [
  [
    'player',
    'Launch / landing',
    'First visit; loading; enter; resume destination; startup error',
    'One title shell; one primary action; real loading feedback',
    'Study',
  ],
  [
    'player',
    'Home menu',
    'Returning player; no progress; keyboard, pointer and controller focus',
    'Continue / Deploy, Missions, Collection, Settings; Workshop secondary',
    'Study',
  ],
  [
    'player',
    'Missions / pack picker',
    'Current pack; pagination; selected; earned; unrevealed; locked; empty',
    'Image-led gallery; visible unlock reason; remembered selection',
    'Study',
  ],
  [
    'player',
    'Mission brief / loadout',
    'Class; ability; difficulty; objectives; compatible next mission',
    'Compact setup summary; optional detailed preparation; direct deployment',
    'Study',
  ],
  [
    'player',
    'First Flight / tutorial',
    'Before start; step active; success; retry; skip; already completed',
    'Teach one action in the actual arena; optional help remains reachable',
    'Planned',
  ],
  [
    'player',
    'Arena / HUD',
    'Ready; countdown; safe; cutting; stationary exposed line; warning',
    'Stable coverage/lives/score/timer order; class-specific ability state',
    'Study',
  ],
  [
    'player',
    'Arena events',
    'Capture; life loss; respawn; slowdown; ability; boss warning/open',
    'Semantic cues; visible footprint; preserved geometry; reduced effects',
    'Study',
  ],
  [
    'player',
    'Pause / restart / leave',
    'Resume; settings return; retry confirmation; leave; focus restore',
    'Opaque cover; Resume first; no accidental destructive activation',
    'Study',
  ],
  [
    'player',
    'Victory / defeat',
    'Artwork reveal; medals; score; no medal; record; retry; next; final level',
    'Separate presentation from score state; skip safely; direct repeat',
    'Study',
  ],
  [
    'player',
    'Collection / full picture',
    'Earned; unknown; selection; preview; close; artwork failure',
    'Calm image viewer; earned progress and mission access remain distinct',
    'Study',
  ],
  [
    'support',
    'Hangar / equipment',
    'Class selection; ability; appearance; requirements; disabled choice',
    'Shared slot preview, readable stats and confirmed equipped state',
    'Planned',
  ],
  [
    'support',
    'Field Guide / help',
    'Controls; terrain; threats; abilities; reading mode; return',
    'Short first layer; illustrated role entries; preserve paused context',
    'Planned',
  ],
  [
    'support',
    'Settings / accessibility',
    'Audio; display; text size; motion; input; remapping; language',
    'Category navigation; real preview; Standard/Large; no faux system UI',
    'Study',
  ],
  [
    'support',
    'Story / chapter dialogue',
    'Before mission; after result; next; skip; replay; long copy',
    'Readable dialogue frame; portraits remain subordinate to text',
    'Planned',
  ],
  [
    'support',
    'Scores / achievements',
    'None earned; personal best; filters; earned goals; unlocked cosmetics',
    'Shared gallery/list vocabulary; conditions and progress stated clearly',
    'Planned',
  ],
  [
    'support',
    'Saves / import / export',
    'Empty; local; backup; import preview; conflict; corrupt; restore',
    'Settings / Saves; explicit file feedback and reversibility',
    'Planned',
  ],
  [
    'support',
    'Optional worlds / downloads',
    'Installed; available; fetching; ready; offline; failed; removal',
    'Missions / More worlds; compact art cards with honest availability',
    'Planned',
  ],
  [
    'support',
    'Challenges / mastery',
    'Available; active; progress; earned; practice-only; incompatibility',
    'Reuse mission cards and result conditions; avoid reward ambiguity',
    'Planned',
  ],
  [
    'support',
    'Replay Theater / attempt export',
    'No recording; loaded; play; pause; seek; invalid; incompatible',
    'Same game frame and transport controls; keep read-only review clear',
    'Planned',
  ],
  [
    'support',
    'Controller practice',
    'Join; mapping; reconnect; confirm; cancel; scrolling/reading',
    'Settings / Controls; real active-device prompts and focus continuity',
    'Planned',
  ],
  [
    'support',
    'Couch race',
    'Mode entry; join; setup; two boards; pause; results; rematch; leave',
    'Missions / Play mode; mirrored HUDs, player identity by shape and text',
    'Planned',
  ],
  [
    'system',
    'Boot / offline / update',
    'Preparing; usable offline; stale; new release; verify; repair; failure',
    'Same shell with honest progress and readable recovery actions',
    'Planned',
  ],
  [
    'system',
    'Browser / native edges',
    'Portrait; short landscape; safe areas; resize; gamepad loss; focus loss',
    'Fixed simulation grid; reflow controls; no hidden reachable actions',
    'Planned',
  ],
  [
    'system',
    'Generic UI states',
    'Default; hover; focus; pressed; selected; disabled; busy; empty; error',
    'Shared component contract with shape + contrast, real labels and status',
    'Planned',
  ],
  [
    'system',
    'About / credits / privacy / archive',
    'Current version; notices; source attribution; older releases',
    'Settings / About; game frame, readable document surfaces',
    'Planned',
  ],
  [
    'authoring',
    'Asset Studio / registry',
    'Browse; filter; inspect; native/context preview; slot requirements',
    'Workshop; complete asset categories and exact copyable briefs',
    'Study',
  ],
  [
    'authoring',
    'Asset replacement / collection',
    'Upload; crop; original; draft; validation; apply; revert; export',
    'Original preserved; <=128 single-layer sprite editing; atomic collections',
    'Planned',
  ],
  [
    'authoring',
    'Sprite / rig / animation',
    'Idle; poses; pivot; rig part; frame; timing; playback; constraints',
    'Metadata and rig tooling separate from gameplay footprint',
    'Planned',
  ],
  [
    'authoring',
    'Level Playground / enemy catalog',
    'Inspect; generate; edit; invalid; test; export; role-specific practice',
    'Workshop / levels and threats; actual arena preview and consistent controls',
    'Planned',
  ],
  [
    'authoring',
    'Picture / video poster tools',
    'Original; imported; crop; poster; media validation; source metadata',
    'Workshop / artwork; full picture preview and preserved source',
    'Planned',
  ],
  [
    'authoring',
    'Motion / viewport labs',
    'Preset; preview; timeline; phone; landscape; reduced effects',
    'Workshop / review; retain tools, share frame and type roles',
    'Planned',
  ],
  [
    'authoring',
    'Production / library / prompt tools',
    'Coverage; missing; accepted; previous; prompt copied; theme readiness',
    'Workshop / production; distinguish evidence, draft and shipped content',
    'Planned',
  ],
];

function renderInventory() {
  const filter = $('#inventory-filter').value;
  const rows = inventory.filter(([group]) => filter === 'all' || group === filter);
  $('#screen-matrix-body').innerHTML = rows
    .map(
      ([group, name, states, treatment, status]) =>
        `<tr><td>${name}<small>${group === 'system' ? 'System state' : group === 'authoring' ? 'Authoring' : group === 'support' ? 'Supporting flow' : 'Player journey'}</small></td><td>${states}</td><td>${treatment}</td><td><span class="badge proposed">${status}</span></td></tr>`,
    )
    .join('');
  $('#inventory-count').textContent = `${rows.length} / ${inventory.length} surfaces`;
}
$('#inventory-filter').addEventListener('change', renderInventory);

$('#copy-prompt').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('#prompt-example-text').textContent);
    $('#copy-status').textContent = 'Example brief copied.';
  } catch {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents($('#prompt-example-text'));
    selection.removeAllRanges();
    selection.addRange(range);
    $('#copy-status').textContent = 'Brief selected. Use your device’s Copy action.';
  }
});

async function checkFonts() {
  const required = [
    ['Field Kit Display', 600],
    ['Field Kit UI', 400],
    ['Field Kit Mono', 500],
  ];
  const results = await Promise.allSettled(
    required.map(([family, weight]) =>
      document.fonts.load(`${weight} 20px "${family}"`, 'Ґґ Єє Іі Її RevealLine'),
    ),
  );
  const ready = results.every((result) => result.status === 'fulfilled' && result.value.length > 0);
  $('#font-status').textContent = ready
    ? 'All three local font roles loaded. Glyph coverage is independently documented in the typography specification.'
    : 'One or more local font files are unavailable here. Fallback text is visible; do not approve typography from this rendering.';
}

async function revealLocalReferences() {
  // A published review never requests the source screenshots. Even a local distribution
  // only reveals links whose files really exist, rather than rendering broken images.
  if (!['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) return;
  const links = [...document.querySelectorAll('[data-local-reference]')];
  const results = await Promise.allSettled(
    links.map(async (link) => {
      const source = link.dataset.localReference;
      const response = await fetch(new URL(source, location.href), { method: 'HEAD' });
      if (!response.ok) return false;
      const isImage = /\.(png|jpg)$/.test(source);
      if (isImage && !response.headers.get('content-type')?.startsWith('image/')) return false;
      link.href = source;
      link.hidden = false;
      const image = link.querySelector('[data-local-image]');
      if (image) image.src = image.dataset.localImage;
      return isImage;
    }),
  );
  const count = results.filter((result) => result.status === 'fulfilled' && result.value).length;
  $('#reference-status').textContent = count
    ? `${count} local screenshot previews available from the source research folder. These images are reference evidence, not production assets.`
    : 'Source screenshots are not present in this local build. Review the observations here and the official source links below.';
}

chooseScreen('title');
renderInventory();
checkFonts();
revealLocalReferences();
