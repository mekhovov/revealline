// Original review studies only. Real shared pad commands operate Atlas controls;
// there is no game simulation, authoring save/import or domain validator here.
import { canonicalJSON } from '../../data-json.mjs';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const same = (a, b) => canonicalJSON(a) === canonicalJSON(b);
const snapshot = (storage) =>
  Array.from({ length: storage.length }, (_, index) => storage.key(index))
    .sort()
    .map((key) => [key, storage.getItem(key)]);
const screenStates = Object.freeze({
  title: ['returning', 'first-visit'],
  missions: ['progress', 'unrevealed'],
  briefing: ['standard', 'gentle'],
  flight: ['running', 'warning', 'life-loss'],
  pause: ['paused'],
  results: ['victory', 'defeat'],
  settings: ['standard', 'large-text'],
  collection: ['gallery', 'picture'],
  workshop: ['draft', 'validation'],
});
async function textReceipt(text) {
  const bytes = new TextEncoder().encode(text);
  return {
    bytes: bytes.length,
    sha256: [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join(''),
  };
}

export const atlasCurrent = [
  'Current Design Atlas: review studies, viewports, specimens, inventory and illustrative brief',
  '/authoring/design-atlas/',
  async (p) => {
    const win = p.doc.defaultView,
      $ = (selector) => p.doc.querySelector(selector),
      text = (selector) => $(selector).textContent.trim(),
      selection = () => [$('#screen-select').value, $('#state-select').value];
    assert(
      win.location.port === '8991' && ['127.0.0.1', 'localhost'].includes(win.location.hostname),
      'Use the dedicated local qualification origin on port 8991.',
    );
    await p.wait(
      () =>
        $('#screen-select')?.options.length === 9 &&
        $('#screen-matrix-body')?.rows.length === 32 &&
        $('.authoring-input-rail'),
      30000,
    );
    assert(
      p.doc.documentElement.lang.startsWith('en'),
      'This bounded Atlas case qualifies English controls and both EN/UK specimens.',
    );
    const originalLocal = snapshot(win.localStorage),
      originalSession = snapshot(win.sessionStorage),
      originalDownloads = p.downloads.length,
      originalLocation = win.location.pathname;
    const readRegion = async (openerSelector, regionSelector) => {
      const opener = $(openerSelector),
        region = $(regionSelector);
      assert(opener && region, `Missing Atlas reading controls for ${regionSelector}`);
      await p.choose(openerSelector);
      assert(
        opener.getAttribute('aria-pressed') === 'true' && region.dataset.atlasReading === 'true',
        `Reading did not claim ${regionSelector}`,
      );
      const axes = [];
      for (const [direction, scroll, extent, viewport] of [
        ['right', 'scrollLeft', 'scrollWidth', 'clientWidth'],
        ['down', 'scrollTop', 'scrollHeight', 'clientHeight'],
      ]) {
        const maximum = Math.max(0, region[extent] - region[viewport]),
          before = region[scroll];
        if (maximum > 1) {
          for (let step = 0; step < 64 && region[scroll] < maximum - 1; step++)
            await p.pulse(direction);
          assert(
            region[scroll] >= maximum - 1,
            `${regionSelector} could not reach its ${direction} edge`,
          );
        }
        axes.push({ direction, maximum, before, after: region[scroll], exercised: maximum > 1 });
      }
      await p.pulse('back');
      assert(
        opener.getAttribute('aria-pressed') === 'false' &&
          !region.hasAttribute('data-atlas-reading') &&
          p.doc.activeElement === opener,
        `Reading Back did not release ${regionSelector} and restore its exact entry`,
      );
      return { region: regionSelector, axes };
    };
    const readPageSection = async (openerSelector, regionSelector) => {
      const opener = $(openerSelector),
        region = $(regionSelector);
      assert(opener && region, `Missing page reading controls for ${regionSelector}`);
      await p.choose(openerSelector);
      assert(
        opener.getAttribute('aria-pressed') === 'true' && region.dataset.atlasReading === 'true',
        `Page reading did not claim ${regionSelector}`,
      );
      const rect = region.getBoundingClientRect(),
        pageMaximum = Math.max(0, p.doc.scrollingElement.scrollHeight - win.innerHeight),
        first = Math.max(0, Math.min(pageMaximum, win.scrollY + rect.top)),
        last = Math.max(first, Math.min(pageMaximum, win.scrollY + rect.bottom - win.innerHeight)),
        before = win.scrollY;
      for (let step = 0; step < 64 && win.scrollY < last - 1; step++) await p.pulse('down');
      assert(Math.abs(win.scrollY - last) <= 1, 'Page reading could not reach its lower boundary');
      await p.pulse('down');
      assert(Math.abs(win.scrollY - last) <= 1, 'Page reading escaped its lower boundary');
      for (let step = 0; step < 64 && win.scrollY > first + 1; step++) await p.pulse('up');
      assert(Math.abs(win.scrollY - first) <= 1, 'Page reading could not return to its start');
      await p.pulse('confirm');
      assert(
        opener.getAttribute('aria-pressed') === 'false' &&
          !region.hasAttribute('data-atlas-reading') &&
          p.doc.activeElement === opener,
        `Reading Confirm did not release ${regionSelector} and restore its exact entry`,
      );
      return { region: regionSelector, first, last, before, exercised: last - first > 1 };
    };
    assert(same(selection(), ['title', 'returning']), 'Atlas did not start on its returning study');
    assert(
      same(
        [...$('#screen-select').options].map((option) => option.value),
        Object.keys(screenStates),
      ),
      'Atlas screen inventory differs from the expected nine studies',
    );
    const beforeDraft = text('#screen-preview');
    await p.choose('#screen-select');
    await p.pulse('down');
    await p.pulse('back');
    assert(same(selection(), ['title', 'returning']), 'Canceled screen draft changed the study');
    await p.choose('#state-select');
    await p.pulse('down');
    await p.pulse('back');
    assert(
      same(selection(), ['title', 'returning']) && text('#screen-preview') === beforeDraft,
      'Canceled state draft replaced the illustration',
    );
    const visited = [];
    for (const [screen, states] of Object.entries(screenStates)) {
      await p.select('#screen-select', screen);
      assert(
        same(
          [...$('#state-select').options].map((option) => option.value),
          states,
        ),
        `Wrong allowed states for ${screen}`,
      );
      const rendered = new Set();
      for (const state of states) {
        await p.select('#state-select', state);
        assert(same(selection(), [screen, state]), `Wrong selected study ${screen}/${state}`);
        assert(
          $('#screen-preview .mock-screen') && text('#study-purpose strong') && text('#study-rule'),
          `Study ${screen}/${state} did not render its illustration and review notes`,
        );
        const screenLabel = $('#screen-select').selectedOptions[0].textContent,
          stateLabel = $('#state-select').selectedOptions[0].textContent;
        assert(
          text('#review-status').includes(screenLabel) &&
            text('#review-status').includes(stateLabel),
          `Study ${screen}/${state} did not announce its selected labels`,
        );
        const illustration = text('#screen-preview');
        assert(!rendered.has(illustration), `State ${screen}/${state} did not change its study`);
        rendered.add(illustration);
        visited.push(`${screen}/${state}`);
      }
    }
    const chooseStudy = async (screen, state = screenStates[screen][0]) => {
      await p.select('#screen-select', screen);
      if ($('#state-select').value !== state) await p.select('#state-select', state);
    };
    const routes = [];
    const mockRoute = async (selector, screen, state = screenStates[screen][0]) => {
      await p.choose(`#screen-preview ${selector}`);
      assert(same(selection(), [screen, state]), `Mock link did not open ${screen}/${state}`);
      assert(
        p.doc.activeElement.id === 'screen-select',
        'Mock link did not restore screen selector',
      );
      assert(
        win.location.pathname === originalLocation,
        'Mock navigation left the read-only Atlas',
      );
      routes.push(`${screen}/${state}`);
    };
    await chooseStudy('title', 'first-visit');
    await mockRoute('.mock-menu button:first-child', 'missions');
    await mockRoute('[data-intent="picture"]', 'collection', 'picture');
    await mockRoute('[data-screen="collection"][data-intent=""]', 'collection');
    await mockRoute('[data-screen="briefing"]', 'briefing');
    await mockRoute('.primary[data-screen="flight"]', 'flight');
    await mockRoute('[data-screen="pause"]', 'pause');
    await mockRoute('.mock-menu button:first-child', 'flight');
    await chooseStudy('results', 'defeat');
    await mockRoute('.primary[data-screen="flight"]', 'flight');
    await chooseStudy('results', 'victory');
    await mockRoute('[data-intent="picture"]', 'collection', 'picture');
    await chooseStudy('settings');
    await mockRoute('.mock-command [data-screen="title"]', 'title');
    await chooseStudy('workshop', 'validation');
    await mockRoute('[data-screen="flight"]', 'flight');
    p.record(
      'Canceled selector drafts retained the illustration; all nine screens/eighteen allowed states rendered with their review notes. Representative mock links reached the expected studies and restored the screen selector without launching gameplay',
      '#review-status',
      { states: visited, mockDestinations: routes },
    );

    await chooseStudy('settings', 'large-text');
    const widths = [];
    let previewReading;
    for (const viewport of ['tablet', 'phone', 'landscape', 'desktop']) {
      await p.choose(`button[data-viewport="${viewport}"]`);
      assert(
        $('#screen-stage').dataset.viewport === viewport,
        'Preview-width state did not change',
      );
      const pressed = [...p.doc.querySelectorAll('button[data-viewport][aria-pressed="true"]')];
      assert(
        pressed.length === 1 && pressed[0].dataset.viewport === viewport,
        'Preview-width pressed state is ambiguous',
      );
      const expectedMaxWidth = { desktop: 1120, tablet: 768, phone: 390, landscape: 740 }[viewport],
        stage = $('#screen-stage');
      await p.wait(
        () =>
          Math.abs(parseFloat(win.getComputedStyle(stage).maxWidth) - expectedMaxWidth) < 0.05 &&
          !stage.getAnimations().some((animation) => animation.playState === 'running'),
        5000,
      );
      widths.push({
        mode: viewport,
        label: text('#viewport-label'),
        width: stage.getBoundingClientRect().width,
        settledMaxWidth: expectedMaxWidth,
      });
      if (viewport === 'landscape')
        previewReading = await readRegion('#atlas-read-preview', '#screen-preview .mock-screen');
    }
    await p.section('#direction-title');
    const pageReading = await readPageSection('#atlas-read-direction', '#direction');
    await p.section('#type-title');
    const specimens = [];
    for (const [lang, display, ui] of [
      ['uk', 'Обери свій маршрут.', 'Обери місію. Замкни лінію. Відкрий світ.'],
      ['en', 'Find your next route.', 'Choose a mission. Close the line. Reveal the world.'],
    ]) {
      await p.choose(`button[data-language="${lang}"]`);
      assert(
        text('#display-specimen') === display && text('#ui-specimen') === ui,
        `Wrong ${lang} specimens`,
      );
      assert(
        $('#display-specimen').lang === lang && $('#ui-specimen').lang === lang,
        `Missing ${lang} specimen language metadata`,
      );
      const pressed = [...p.doc.querySelectorAll('button[data-language][aria-pressed="true"]')];
      assert(
        pressed.length === 1 && pressed[0].dataset.language === lang,
        'Specimen language pressed state is ambiguous',
      );
      specimens.push({ lang, display, ui });
    }
    assert(
      p.doc.documentElement.lang.startsWith('en'),
      'Specimen choice unexpectedly changed the application locale',
    );
    p.record(
      'All four CSS preview widths exposed one selected state; Ukrainian and English specimens updated their exact text and language attributes. These are Atlas review specimens, not physical-device viewport or full localized gameplay checks',
      '#display-specimen',
      {
        widths,
        specimens,
        previewReading,
        pageReading,
        actualFrameViewport: {
          width: win.innerWidth,
          height: win.innerHeight,
          documentClientWidth: p.doc.documentElement.clientWidth,
        },
        widthBoundary:
          'Stage widths measured after the CSS max-width transition settled, within this actual iframe viewport. The outer browser viewport or a preset label is not proof of the iframe dimensions or physical-device fit.',
      },
    );

    await p.section('#coverage-title');
    await p.select('#inventory-filter', 'all');
    const rows = () =>
        [...$('#screen-matrix-body').rows].map((row) =>
          [...row.cells].map((cell) => cell.textContent.trim()),
        ),
      allRows = rows(),
      groups = [
        ['player', 0, 10, 'Player journey'],
        ['support', 10, 21, 'Supporting flow'],
        ['system', 21, 25, 'System state'],
        ['authoring', 25, 32, 'Authoring'],
      ],
      filtered = [];
    assert(
      allRows.length === 32 && allRows.every((row) => row.length === 4),
      'Inventory is not the complete 32-row/four-column review matrix',
    );
    for (const [group, start, end, caption] of groups) {
      await p.select('#inventory-filter', group);
      assert(
        same(rows(), allRows.slice(start, end)),
        `Filter ${group} returned wrong inventory rows`,
      );
      assert(
        text('#inventory-count') === `${end - start} / 32 surfaces`,
        `Filter ${group} has wrong counts`,
      );
      assert(
        [...$('#screen-matrix-body').rows].every(
          (row) => row.querySelector('td small').textContent === caption,
        ),
        `Filter ${group} displayed a wrong group label`,
      );
      filtered.push({ group, rows: end - start });
    }
    await p.select('#inventory-filter', 'all');
    assert(
      same(rows(), allRows) && text('#inventory-count') === '32 / 32 surfaces',
      'Every surface did not restore complete inventory',
    );
    const matrixReading = await readRegion('#atlas-read-matrix', '.matrix-wrap');
    p.record(
      'The complete 32-row review inventory filtered to the exact ten player, eleven support, four system and seven authoring rows, then restored Every surface. Controller reading reached each overflowing matrix edge and Back returned to its entry. Planned/study rows remain review information, not runtime acceptance',
      '#inventory-count',
      {
        filtered,
        matrixReading,
        horizontalQualified: matrixReading.axes.find(({ direction }) => direction === 'right')
          .exercised,
        readingBoundary:
          'Only axes with measured overflow were exercised. A right maximum of zero is no virtual horizontal-scrolling qualification; any separate native narrow-viewport result needs its own receipt.',
      },
    );

    await p.section('#studies-title');
    await chooseStudy('workshop', 'validation');
    assert(
      $('#screen-preview .slot-meta .badge.proposed'),
      'Workshop validation illustration is missing',
    );
    await p.choose('#screen-preview [data-intent="asset-brief"]');
    assert(
      $('.prompt-example').open && p.doc.activeElement.id === 'copy-prompt',
      'Asset brief did not expand details and focus Copy',
    );
    assert(same(selection(), ['workshop', 'validation']), 'Asset brief replaced the chosen study');
    const brief = $('#prompt-example-text').textContent,
      briefReceipt = await textReceipt(brief);
    assert(
      brief.includes('FPV / LINE') && brief.includes('Preserve gameplay bounds.'),
      'Visible illustrative brief is incomplete',
    );
    const briefReading = await readRegion('#atlas-read-brief', '#prompt-example-text');
    // This is the one deliberate clipboard mutation in the case. The fixture
    // never reads or replaces navigator.clipboard; native clipboard proof is separate.
    await p.choose('#copy-prompt');
    // The product bounds a pending Clipboard API write at two seconds. Give
    // its existing foreground text-selection fallback time to settle.
    await p.wait(() => ['ready', 'error'].includes($('#copy-status').dataset.state), 10000);
    const copyStatus = text('#copy-status'),
      copied = copyStatus === 'Example brief copied.',
      selected = copyStatus === 'Brief selected. Use your device’s Copy action.';
    assert(
      copied || selected,
      'Copy did not report success or its explicit text-selection fallback',
    );
    if (selected)
      assert(win.getSelection().toString() === brief, 'Copy fallback selected different text');
    assert($('#prompt-example-text').textContent === brief, 'Copy changed the visible brief');
    await p.wait(() => $('#download-prompt')?.href.startsWith('blob:'));
    const downloadLink = $('#download-prompt'),
      downloadHref = downloadLink.href,
      downloadName = downloadLink.download,
      prepared = p.downloads.find(({ url }) => url === downloadHref),
      expectedBytes = new TextEncoder().encode(brief),
      downloadClicks = [];
    // Atlas prepares this URL during module startup, before the runner may
    // install its passive allocation observer. Read that existing Blob URL;
    // do not invoke a product handler or create a replacement export.
    const preparedBlob =
      prepared?.blob ??
      (await (async () => {
        const response = await win.fetch(downloadHref);
        assert(response.ok, 'The prepared brief Blob URL could not be read');
        return response.blob();
      })());
    assert(
      downloadName === 'fpv-line-atlas-example-brief-en.txt' &&
        preparedBlob.type === 'text/plain;charset=utf-8',
      'The brief download has the wrong locale filename or UTF-8 text MIME type',
    );
    const exportedBytes = new Uint8Array(await preparedBlob.arrayBuffer());
    assert(
      exportedBytes.length === expectedBytes.length &&
        exportedBytes.every((byte, index) => byte === expectedBytes[index]) &&
        (await preparedBlob.text()) === brief,
      'The prepared download differs from the exact visible UTF-8 brief',
    );
    const observeDownload = (event) => {
      if (event.target?.closest?.('a') !== downloadLink) return;
      const row = { href: downloadLink.href, name: downloadLink.download };
      // Passive post-dispatch evidence only; the real pad activates the anchor.
      queueMicrotask(() => downloadClicks.push({ ...row, prevented: event.defaultPrevented }));
    };
    p.doc.addEventListener('click', observeDownload, true);
    try {
      await p.choose('#download-prompt');
      await p.choose('#download-prompt');
      await p.wait(() => downloadClicks.length === 2);
      assert(
        downloadClicks.every(
          (row) => !row.prevented && row.href === downloadHref && row.name === downloadName,
        ),
        'The two explicit brief downloads did not dispatch the exact prepared anchor',
      );
      assert(
        downloadLink.href === downloadHref && (await preparedBlob.text()) === brief,
        'Repeated brief download changed its URL or prepared text',
      );
    } finally {
      p.doc.removeEventListener('click', observeDownload, true);
    }
    assert(same(snapshot(win.localStorage), originalLocal), 'Atlas changed local storage');
    assert(same(snapshot(win.sessionStorage), originalSession), 'Atlas changed session storage');
    assert(
      p.downloads.slice(originalDownloads).every(({ url }) => url === downloadHref),
      'Atlas prepared an unrelated downloadable file during its review workflow',
    );
    p.record(
      'Illustrated Workshop validation opened its visible asset brief and focused Copy. Explicit Copy reported success or selected the exact text as fallback. Two real Download anchor activations referenced unchanged UTF-8 bytes matching the visible brief; storage stayed unchanged',
      '#copy-status',
      {
        brief: briefReceipt,
        briefReading,
        copyOutcome: copied ? 'reported-copied' : 'selected-fallback',
        download: {
          name: downloadName,
          type: preparedBlob.type,
          ...briefReceipt,
          activations: downloadClicks.length,
          newBlobURLs: p.downloads.length - originalDownloads,
          samePreparedURL: true,
          readMethod: prepared ? 'passive-allocation-observer' : 'existing-blob-url-read',
        },
        retainedStorageKeys: { local: originalLocal.length, session: originalSession.length },
        boundary:
          'Original design review with an explicit illustrative-brief text download. No project Save, import, domain validation, JSON export or gameplay exists here. The validation screen is an illustration. Clipboard result is a UI report/selection check; actual clipboard bytes, OS download files and native Workshop return require separate receipts. This English-control case tests EN/UK specimens, not a full-page locale switch. No physical controller, native-device or release-delivery qualification.',
      },
    );
  },
];
