// Browser-only default/edition qualification. Only virtual gamepad pulses operate
// the page. No direct DOM focus, handler call, storage seeding or game start.
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const snapshot = (storage) =>
  Array.from({ length: storage.length }, (_, index) => storage.key(index))
    .sort()
    .map((key) => [key, storage.getItem(key)]);
const delta = (before, after) => {
  const old = new Map(before),
    next = new Map(after);
  return {
    added: [...next.keys()].filter((key) => !old.has(key)),
    changed: [...old.keys()].filter((key) => next.has(key) && old.get(key) !== next.get(key)),
    removed: [...old.keys()].filter((key) => !next.has(key)),
  };
};
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const moved = {
  'shell-gallery': 'data',
  'shell-help': 'extras',
  'shell-home-fpv': 'extras',
  'shell-home-practice': 'extras',
};

const workflow = (edition) => async (p) => {
  const doc = p.doc,
    win = doc.defaultView,
    $ = (selector) => doc.querySelector(selector);
  assert(
    win.location.port === '9006' && ['127.0.0.1', 'localhost'].includes(win.location.hostname),
    'Use the isolated landing qualification origin on port 9006; normal boot uses origin storage.',
  );
  assert(
    new URL(win.location.href).searchParams.get('edition') === edition,
    'Unexpected edition route.',
  );
  await p.wait(
    () =>
      doc.documentElement.dataset.bootState === 'ready' &&
      $('#shell-home')?.open &&
      $('#shell-home').classList.contains('native-landing'),
    90000,
  );
  await p.wait(() => $('#solo-quick-music-settings-toggle') && $('#solo-landing-song'), 90000);
  await doc.fonts.ready;
  // Observe the real lazy music owner after boot. No fake player state is installed.
  await delay(1800);
  const home = $('#shell-home'),
    settings = $('#settings-dialog'),
    href = win.location.href,
    beforeLocal = snapshot(win.localStorage),
    beforeSession = snapshot(win.sessionStorage),
    expectedModes = edition ? ['solo'] : ['solo', 'versus', 'team'];
  const shown = (element) =>
    !!element?.getClientRects().length &&
    !element.closest('[hidden],[inert],[aria-hidden="true"]') &&
    win.getComputedStyle(element).visibility !== 'hidden';
  const identify = (element) =>
    element?.id ||
    element?.getAttribute('aria-label') ||
    element?.textContent?.trim().slice(0, 80) ||
    element?.tagName;
  const controls = (root) =>
    [
      ...root.querySelectorAll('button,a[href],input,select,textarea,summary,[role="button"]'),
    ].filter(shown);
  const landing = () => {
    assert(home.open && shown(home), 'The landing is no longer the active screen.');
    assert(!settings.open, 'Settings unexpectedly owns the landing inspection.');
    const modes = [...home.querySelectorAll('[data-game-mode]')].filter(shown);
    assert(
      same(
        modes.map((element) => element.dataset.gameMode),
        expectedModes,
      ),
      `Wrong visible modes: ${modes.map((element) => element.dataset.gameMode)}.`,
    );
    assert(modes[0]?.getAttribute('aria-current') === 'page', 'Solo is not the selected mode.');
    assert(
      modes.every((element) => !element.disabled),
      'A visible mode cannot receive focus.',
    );
    const primary = ['shell-featured', 'shell-continue'].map((id) => $(`#${id}`)).filter(shown);
    assert(primary.length === 1, 'Expected exactly one Start/Continue action.');
    const actions = [
      primary[0],
      $('#shell-play'),
      $('#shell-options'),
      $('#shell-sound'),
      $('#solo-fpv-sim'),
    ];
    assert(actions.every(shown), 'A required landing action is missing.');
    if (shown($('#shell-fullscreen'))) actions.push($('#shell-fullscreen'));
    const expected = [...modes, ...actions],
      actual = controls(home);
    assert(
      actual.length === expected.length && actual.every((element) => expected.includes(element)),
      `Unexpected landing controls: ${actual.map(identify).join(', ')}.`,
    );
    assert(
      !home.querySelector('.quick-music-controls'),
      'Lazy music transport reappeared on landing.',
    );
    for (const [id, category] of Object.entries(moved)) {
      assert(
        $(`#${id}`)?.closest('[role="tabpanel"]')?.id === `settings-panel-${category}`,
        `${id} is not in its required Settings category.`,
      );
      assert(doc.querySelectorAll(`#${id}`).length === 1, `${id} has duplicate instances.`);
    }
    assert(
      $('#solo-landing-song').parentElement.closest('.native-menu-footer'),
      'Passive track information is missing from the landing edge.',
    );
    assert(home.querySelector('.native-menu-version'), 'Passive version information is missing.');
    assert(win.location.href === href, 'Menu traversal navigated to another route.');
    assert(doc.body.dataset.flightState !== 'running', 'Menu traversal began gameplay.');
    return {
      controls: actual.map(identify),
      modes: modes.map((element) => element.dataset.gameMode),
      title: $('#shell-title').textContent.trim(),
      primary: primary[0].id,
      fullscreen: shown($('#shell-fullscreen')),
      viewport: { width: win.innerWidth, height: win.innerHeight },
    };
  };
  const initial = landing();
  const navigate = async (selector) => {
    await p.wait(() => p.visible($(selector)));
    const target = $(selector),
      visits = new Map(),
      trajectory = [];
    for (let count = 0; count < 100 && doc.activeElement !== target; count++) {
      assert(doc.hasFocus(), 'The game lost foreground input; the fixture will not refocus it.');
      const active = doc.activeElement,
        prior = visits.get(active) || 0;
      assert(prior < 3, `Controller cannot reach ${selector}: ${JSON.stringify(trajectory)}.`);
      visits.set(active, prior + 1);
      let direction;
      const fromModes = active.closest('.game-mode-choice'),
        toModes = target.closest('.game-mode-choice');
      if (fromModes && fromModes === toModes) {
        direction = active.compareDocumentPosition(target) & 2 ? 'left' : 'right';
      } else if (active.matches('[role="tab"]') && target.closest('[role="tabpanel"]')) {
        direction = 'right';
      } else {
        direction = active.compareDocumentPosition(target) & 2 ? 'up' : 'down';
      }
      await p.pulse(direction);
      trajectory.push({ from: identify(active), direction, to: identify(doc.activeElement) });
    }
    assert(doc.activeElement === target, `Controller traversal exceeded budget: ${selector}.`);
    return target;
  };
  const choose = async (selector) => {
    await navigate(selector);
    await p.pulse('confirm');
  };
  const closeSettings = async () => {
    for (let count = 0; count < 3 && settings.open; count++) await p.pulse('back');
    await p.wait(() => !settings.open && home.open);
    assert(
      doc.activeElement === $('#shell-options'),
      'Settings Back lost its exact landing opener.',
    );
    landing();
  };
  const category = async (name) => {
    // Opening Settings restores its selected category without directly focusing it.
    if (settings.open) await closeSettings();
    await choose('#shell-options');
    await p.wait(() => settings.open);
    await choose(`#settings-tab-${name}`);
    await p.wait(
      () =>
        shown($(`#settings-panel-${name}`)) &&
        $(`#settings-tab-${name}`).getAttribute('aria-selected') === 'true',
    );
  };
  const modalRoundTrip = async (opener, modal) => {
    const button = $(opener);
    await choose(opener);
    await p.wait(() => $(modal)?.open, 30000);
    assert(settings.open, `${modal} discarded its Settings owner.`);
    await p.pulse('back');
    await p.wait(() => !$(modal).open);
    assert(
      settings.open && doc.activeElement === button,
      `${modal} Back did not restore the exact Settings opener (${identify(doc.activeElement)}).`,
    );
    return { opener: button.id, modal, restored: identify(doc.activeElement) };
  };

  // Merely moving between modes must not activate another host or begin play.
  for (const mode of expectedModes) await navigate(`[data-game-mode="${mode}"]`);
  for (const id of [
    initial.primary,
    'shell-play',
    'shell-options',
    'shell-sound',
    ...(initial.fullscreen ? ['shell-fullscreen'] : []),
  ])
    await navigate(`#${id}`);
  assert(
    same(landing().controls, initial.controls),
    'Focus movement altered the landing controls.',
  );
  p.record(
    'Real boot and late music mount retain the exact landing whitelist; every normal action and supported mode receives controller focus without activation',
    '#shell-title',
    initial,
  );

  await category('content');
  const contentActions = ['#solo-communities', '#game-check-updates'];
  for (const selector of contentActions) {
    assert(
      $('#settings-panel-content').contains($(selector)),
      `${selector} escaped Content & Offline.`,
    );
    await navigate(selector);
  }
  await closeSettings();
  p.record(
    'Communities and Check for updates are controller reachable in Content & Offline without opening either destination or adding landing actions',
    '#shell-title',
    { actions: contentActions },
  );

  await category('audio');
  const transport = ['previous', 'toggle', 'next'].map(
    (action) => `#solo-quick-music-settings-${action}`,
  );
  const reachedTransport = [];
  for (const selector of transport) {
    await p.wait(() => p.visible($(selector)), 30000);
    await navigate(selector);
    reachedTransport.push({
      id: $(selector).id,
      label: $(selector).textContent.trim(),
      disabled: $(selector).disabled,
      focused: doc.activeElement === $(selector),
    });
  }
  assert(
    transport.every((selector) => $('#settings-panel-audio').contains($(selector))),
    'Music transport escaped the Audio category.',
  );
  await closeSettings();
  p.record(
    'Audio retains reachable Previous, Play/Pause and Next transport; Settings Back restores its landing opener and leaves the whitelist intact',
    '#shell-title',
    {
      transport: reachedTransport,
      boundary:
        'Reachability only: playback, queue selection and audio preferences were not changed.',
    },
  );

  await category('data');
  const collection = await modalRoundTrip('#shell-gallery', '#collection-dialog');
  await closeSettings();
  p.record(
    'Progress & Collection opens the real collection and nested Back restores Collection; Settings Back returns to its exact landing opener',
    '#shell-title',
    collection,
  );

  await category('extras');
  const help = await modalRoundTrip('#shell-help', '#help-dialog');
  await navigate('#shell-home-fpv');
  const fpv = { id: doc.activeElement.id, label: doc.activeElement.textContent.trim() };
  const practice = await modalRoundTrip('#shell-home-practice', '#optional-practice-dialog');
  await closeSettings();
  const final = landing(),
    local = delta(beforeLocal, snapshot(win.localStorage)),
    session = delta(beforeSession, snapshot(win.sessionStorage));
  assert(same(final.controls, initial.controls), 'Nested tool return changed landing actions.');
  p.record(
    'Help and Flight practice open through Extras and Back restores each exact opener; FPV simulator remains controller reachable; final Settings Back preserves the landing',
    '#shell-title',
    {
      help,
      fpv,
      practice,
      landing: final,
      observedStorageDelta: { local, session },
      boundary:
        'No Start/Continue, mission selection, simulator launch, playback, fullscreen, sound toggle, settings value change or save was performed. Storage deltas are observations, not a persistence guarantee. Physical controller, offline and published-build checks remain separate.',
    },
  );
};

export const nativeLandingDefaultCurrent = [
  'Current default landing whitelist and real Settings destinations',
  '/game/',
  workflow(null),
];
export const nativeLandingDroneAidCurrent = [
  'Current DroneAid landing whitelist and real Settings destinations',
  '/game/?edition=droneaid',
  workflow('droneaid'),
];
