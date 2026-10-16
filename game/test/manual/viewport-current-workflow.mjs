// Current Viewport qualification uses only the shared virtual-pad commands for
// interaction. DOM, URL and storage observations below do not operate the game.
const assert = (value, message) => {
  if (!value) throw new Error(message);
};
const presets = ['390x844', '844x390', '768x1024', '1280x720', '1280x800'];
const storageSnapshot = (storage) =>
  new Map(
    Array.from({ length: storage.length }, (_, index) => storage.key(index))
      .sort()
      .map((key) => [key, storage.getItem(key)]),
  );
const storageChanges = (before, after) => ({
  added: [...after.keys()].filter((key) => !before.has(key)),
  changed: [...before.keys()].filter((key) => after.has(key) && before.get(key) !== after.get(key)),
  removed: [...before.keys()].filter((key) => !after.has(key)),
});

export const viewportCurrent = [
  'Current Viewport Lab: cancel, five exact sizes, read both axes and return from real games',
  '/authoring/viewport-lab/',
  async (p) => {
    const $ = (selector) => p.doc.querySelector(selector),
      win = p.doc.defaultView;
    assert(
      win.location.port === '8995' && ['127.0.0.1', 'localhost'].includes(win.location.hostname),
      'Use dedicated qualification origin 8995. Embedded games use their ordinary origin storage.',
    );
    await p.wait(
      () =>
        $('#target')?.disabled === false &&
        $('#preset')?.disabled === false &&
        $('#viewport-read-stage') &&
        $('#viewport-read-notes') &&
        $('.authoring-input-rail'),
      30000,
    );
    assert(p.doc.documentElement.lang.startsWith('en'), 'This bounded workflow requires English.');
    const frame = $('#game-frame'),
      stage = $('#stage'),
      initialDocument = frame.contentDocument,
      beforeLocal = storageSnapshot(win.localStorage),
      beforeSession = storageSnapshot(win.sessionStorage),
      sourceChanges = [],
      frameLoads = [];
    const sourceObserver = new win.MutationObserver((records) => {
      for (const record of records)
        sourceChanges.push({ oldValue: record.oldValue, value: frame.getAttribute('src') });
    });
    sourceObserver.observe(frame, {
      attributes: true,
      attributeFilter: ['src'],
      attributeOldValue: true,
    });
    const loaded = () => frameLoads.push(frame.contentWindow.location.pathname);
    frame.addEventListener('load', loaded);
    const source = () => frame.getAttribute('src');
    const sameChild = (child, href, writes) => {
      assert($('#game-frame') === frame, 'A viewport change replaced the iframe element.');
      assert(frame.contentDocument === child, 'A viewport change navigated the child document.');
      assert(source() === href, 'A viewport change rewrote the game source.');
      assert(sourceChanges.length === writes, 'A viewport change assigned the source again.');
    };
    const waitForGame = async (mode, previous) => {
      const pathname = mode === 'solo' ? '/game/' : '/game/couch/';
      await p.wait(() => {
        const child = frame.contentDocument;
        if (!child || child === previous || frame.contentWindow.location.pathname !== pathname)
          return false;
        const menu = child.querySelector(mode === 'solo' ? '#shell-home' : '#race-main');
        return (
          (mode === 'solo'
            ? child.documentElement.dataset.bootState === 'ready' && menu?.open
            : child.documentElement.dataset.toolState === 'ready') &&
          p.visible(menu) &&
          menu.classList.contains('native-landing') &&
          child.querySelector('.authoring-preview-return') &&
          p.visible($('.authoring-preview-enter'))
        );
      }, 90000);
      assert(
        p.doc.activeElement === $('#target'),
        'Late game boot stole the parent selector focus.',
      );
      assert($('#load-target').disabled, 'Already requested target still offers another Load.');
      return frame.contentDocument;
    };
    const childNavigate = async (child, selector) => {
      await p.wait(() => p.visible(child.querySelector(selector)), 15000);
      const target = child.querySelector(selector),
        visits = new Map(),
        trajectory = [];
      const describe = (element) => {
        const rect = element.getBoundingClientRect(),
          group = element.closest('[data-menu-layout]');
        return {
          id: element.id || element.className || element.tagName,
          rect: [rect.x, rect.y, rect.width, rect.height],
          group: group?.id || group?.className || null,
          layout: group?.dataset.menuLayout || null,
        };
      };
      for (let step = 0; step < 120 && child.activeElement !== target; step++) {
        assert(
          p.doc.activeElement === frame && child.hasFocus(),
          'Child navigation lost ownership; the fixture will not refocus it.',
        );
        const active = child.activeElement;
        visits.set(active, (visits.get(active) || 0) + 1);
        assert(
          visits.get(active) <= 3,
          `Child controller cannot reach ${selector}: ${JSON.stringify({
            target: describe(target),
            trajectory,
            inputMode: child.body.dataset.inputMode,
            status: child.querySelector('#input-status, #race-pad-status')?.textContent,
            childFrame: describe(frame),
            labViewport: [win.innerWidth, win.innerHeight],
            runnerFrame: win.frameElement ? describe(win.frameElement) : null,
            runnerViewport: [win.parent.innerWidth, win.parent.innerHeight],
          })}`,
        );
        const direction = active.compareDocumentPosition(target) & 2 ? 'up' : 'down',
          before = describe(active);
        await p.pulse(direction);
        trajectory.push({ direction, before, after: describe(child.activeElement) });
      }
      assert(
        child.activeElement === target,
        `Child controller traversal exceeded budget: ${selector}.`,
      );
      return target;
    };
    const childSettingsReturn = async (mode, child) => {
      const settingsButton = mode === 'solo' ? '#shell-options' : '#race-options',
        settingsSelector = mode === 'solo' ? '#settings-dialog' : '#race-options-panel',
        homeSelector = mode === 'solo' ? '#shell-home' : '#race-main';
      await p.choose('.authoring-preview-enter');
      await p.wait(() => p.doc.activeElement === frame && child.hasFocus());
      // Couch deliberately consumes a fresh face/Menu edge to join. Solo's
      // existing router auto-joins; neither path receives a synthetic key.
      if (mode === 'couch') {
        await p.pulse('menu');
        assert(
          p.visible(child.querySelector(homeSelector)),
          'Joining Couch activated a game screen.',
        );
      }
      await childNavigate(child, settingsButton);
      await p.pulse('confirm');
      await p.wait(() => p.visible(child.querySelector(settingsSelector)));
      const settings = child.querySelector(settingsSelector);
      let backCount = 0;
      while (p.visible(settings) && backCount < 3) {
        await p.pulse('back');
        backCount++;
      }
      assert(!p.visible(settings), `${mode} Settings did not close through controller Back.`);
      assert(
        p.visible(child.querySelector(homeSelector)),
        `${mode} Back failed to restore its menu.`,
      );
      assert(
        child.activeElement === child.querySelector(settingsButton),
        `${mode} Settings Back lost its exact opener.`,
      );
      await childNavigate(child, '.authoring-preview-return');
      await p.pulse('confirm');
      await p.wait(() => p.doc.activeElement === $('.authoring-preview-enter'));
      assert(frame.contentDocument === child, 'Returning to the lab reloaded the game.');
      assert(
        p.visible(child.querySelector(homeSelector)),
        'Preview handoff implicitly started gameplay.',
      );
      if (mode === 'solo')
        assert(
          child.body.dataset.flightState !== 'running',
          'Solo began gameplay during menu inspection.',
        );
      return { mode, settingsBackCommands: backCount, returnedTo: p.doc.activeElement.className };
    };
    const readRegion = async (name, { requireBothAxes = false } = {}) => {
      const region = name === 'stage' ? stage : $('#viewport-notes-region'),
        button = $(`#viewport-read-${name}`);
      await p.choose(`#viewport-read-${name}`);
      assert(region.dataset.viewportReading === 'true', `${name} did not enter reading.`);
      assert(
        button.getAttribute('aria-pressed') === 'true',
        `${name} entry did not report reading.`,
      );
      const maxX = Math.max(0, region.scrollWidth - region.clientWidth),
        maxY = Math.max(0, region.scrollHeight - region.clientHeight);
      if (requireBothAxes)
        assert(
          maxX > 1 && maxY > 1,
          'Use the normal 1280px fixture viewport to expose both stage axes.',
        );
      for (let step = 0; step < 60 && region.scrollLeft < maxX - 1; step++) await p.pulse('right');
      for (let step = 0; step < 60 && region.scrollTop < maxY - 1; step++) await p.pulse('down');
      assert(
        region.scrollLeft >= maxX - 1 && region.scrollTop >= maxY - 1,
        `${name} final edges unreachable.`,
      );
      const end = [region.scrollLeft, region.scrollTop];
      for (let step = 0; step < 60 && region.scrollLeft > 1; step++) await p.pulse('left');
      for (let step = 0; step < 60 && region.scrollTop > 1; step++) await p.pulse('up');
      assert(region.scrollLeft <= 1 && region.scrollTop <= 1, `${name} first edges unreachable.`);
      await p.pulse('back');
      assert(!region.hasAttribute('data-viewport-reading'), `${name} kept reading after Back.`);
      assert(p.doc.activeElement === button, `${name} Back lost its exact entry.`);
      await p.choose(`#viewport-read-${name}`);
      await p.pulse('confirm');
      assert(
        !region.hasAttribute('data-viewport-reading'),
        `${name} Confirm did not finish reading.`,
      );
      assert(p.doc.activeElement === button, `${name} Confirm lost its entry.`);
      return {
        name,
        maxX,
        maxY,
        reachedEnd: end,
        returnedStart: [region.scrollLeft, region.scrollTop],
      };
    };
    try {
      assert(
        frame.hidden && !frame.hasAttribute('src'),
        'The lab loaded a game before explicit Load.',
      );
      const initialTarget = $('#target').value,
        initialPreset = $('#preset').value,
        initialDimensions = $('#dimensions').value,
        initialDirect = $('#direct-open').href;
      await p.choose('#target');
      await p.pulse('down');
      await p.pulse('back');
      assert($('#target').value === initialTarget, 'Canceled target selection was adopted.');
      assert($('#direct-open').href === initialDirect, 'Canceled target changed direct-open.');
      await p.choose('#preset');
      await p.pulse('up');
      await p.pulse('back');
      assert($('#preset').value === initialPreset, 'Canceled preset was adopted.');
      assert($('#dimensions').value === initialDimensions, 'Canceled preset resized the viewport.');
      await p.select('#target', 'solo');
      assert(frame.hidden && !frame.hasAttribute('src'), 'Selecting Solo implicitly loaded it.');
      assert(
        new URL($('#direct-open').href).pathname === '/game/',
        'Pending Solo direct-open is wrong.',
      );
      await p.choose('#load-target');
      const solo = await waitForGame('solo', initialDocument),
        soloSource = source();
      assert(
        sourceChanges.length === 1,
        'Explicit first Load did not set the source exactly once.',
      );
      p.record(
        'Canceled target/size drafts retained their values; selecting Solo only changed the pending target; explicit Load reached the actual Solo menu without entering it',
        '#status',
        {
          target: $('#target').value,
          source: soloSource,
          bootState: solo.documentElement.dataset.bootState,
          sourceWrites: sourceChanges.length,
        },
      );

      const sizes = [];
      for (const value of presets) {
        await p.select('#preset', value);
        const [width, height] = value.split('x').map(Number);
        await p.wait(() => {
          const bounds = frame.getBoundingClientRect();
          return Math.abs(bounds.width - width) < 0.5 && Math.abs(bounds.height - height) < 0.5;
        });
        sameChild(solo, soloSource, 1);
        assert(
          frame.width === String(width) && frame.height === String(height),
          'Iframe dimensions disagree with the preset.',
        );
        assert(
          $('#dimensions').value === `${width} × ${height} CSS px`,
          'Dimension label disagrees with the preset.',
        );
        for (const node of [frame, $('#viewport')])
          assert(
            win.getComputedStyle(node).transform === 'none',
            'Preview is scaled instead of using its actual viewport dimensions.',
          );
        sizes.push({
          value,
          width: frame.getBoundingClientRect().width,
          height: frame.getBoundingClientRect().height,
        });
      }
      const readers = [
        await readRegion('stage', { requireBothAxes: true }),
        await readRegion('notes'),
      ];
      sameChild(solo, soloSource, 1);
      p.record(
        'All five exact CSS-pixel presets retained the same loaded document and URL; stage reading reached both axes and returned to its entry',
        '#dimensions',
        {
          sizes,
          readers,
          boundary:
            'These are CSS-pixel viewport sizes, not physical-device, safe-area, zoom or GPU qualification.',
        },
      );

      const soloHandoff = await childSettingsReturn('solo', solo);
      await p.select('#target', 'couch');
      sameChild(solo, soloSource, 1);
      assert(
        !$('#load-target').disabled && new URL($('#direct-open').href).pathname === '/game/couch/',
        'Pending Couch target is not an explicit replacement.',
      );
      await p.choose('#target');
      await p.pulse('down');
      await p.pulse('back');
      assert(
        $('#target').value === 'couch',
        'Canceled pending replacement changed the selected target.',
      );
      await p.select('#preset', '844x390');
      sameChild(solo, soloSource, 1);
      assert(
        $('#loaded-target').textContent.includes('Solo'),
        'Pending target changed the loaded-game label.',
      );
      p.record(
        'Explicit Solo entry, Settings/Back and real child Return preserved the loaded game; pending Couch survived target cancellation and resizing without replacement',
        '#status',
        { soloHandoff, pending: $('#target').value, loaded: $('#loaded-target').textContent },
      );

      await p.choose('#load-target');
      const couch = await waitForGame('couch', solo),
        couchSource = source();
      assert(sourceChanges.length === 2, 'Explicit replacement did not set the source once.');
      await p.select('#target', 'couch');
      sameChild(couch, couchSource, 2);
      assert($('#load-target').disabled, 'Already loaded Couch permits a redundant Load.');
      const couchHandoff = await childSettingsReturn('couch', couch);
      sameChild(couch, couchSource, 2);
      p.record(
        'Only explicit Load replaced Solo with the actual Couch menu; Couch Settings/Back and real child Return restored parent ownership without starting a match',
        '#status',
        {
          couchHandoff,
          sourceChanges,
          frameLoads,
          storageChanges: {
            local: storageChanges(beforeLocal, storageSnapshot(win.localStorage)),
            session: storageChanges(beforeSession, storageSnapshot(win.sessionStorage)),
          },
          boundary:
            'No fixture domain calls, storage writes, Save/import/export or OS downloads. Embedded games use their ordinary same-origin storage; observed key deltas are reported, not asserted absent. Full gameplay, history/BFCache, actual Workshop departure/reentry, background fault injection, physical pads/devices and offline publication are separate.',
        },
      );
    } finally {
      sourceObserver.disconnect();
      frame.removeEventListener('load', loaded);
    }
  },
];
