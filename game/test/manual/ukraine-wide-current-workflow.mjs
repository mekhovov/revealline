// Browser-only qualification of a historical source comparison. Application
// actions use only the real shared virtual-pad owner; observations never focus,
// click or invoke handlers. Pixel hashes are observations, not a visual oracle.
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const settle = (ms = 220) => new Promise((resolve) => setTimeout(resolve, ms));
const roles = ['scout', 'interceptor', 'fiber'];
const choices = {
  heading: ['0', '90', '180', '270'],
  background: ['dark', 'light'],
  phase: ['0', '1', '2', '3'],
  speed: ['0', '1'],
};
const toggles = ['wings', 'guides', 'reduced'];
const localeKey = 'revealline.locale.v1';
const sources = [
  {
    id: 'guide',
    path: 'authoring/library/ukraine-role-wide-variants/README.md',
    bytes: 4555,
    sha256: '40e30780e9106d5302f62c80b5969368aad9998fb0bb4fc61a25acbc62b7490d',
    titleKey: 'ukraineRoleReview.lineageLimits',
  },
  {
    id: 'records',
    path: 'authoring/library/ukraine-role-wide-variants/variants.json',
    bytes: 3385,
    sha256: 'b8580d1333b5e10d13a4baa2189bb7c0d1dd24bd3c9d31ec7f5a4325855ff975',
    titleKey: 'ukraineRoleReview.candidateRecords',
  },
];
const snapshot = (storage) =>
  Array.from({ length: storage.length }, (_, i) => storage.key(i))
    .sort()
    .map((key) => [key, storage.getItem(key)]);
const hash = async (bytes) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
const text = (bytes) => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);

export const ukraineWideCurrent = [
  'Current Ukraine wide roles: held phases, comparison readers, exact documents and return',
  '/authoring/library/ukraine-role-wide-variants/index.html',
  async (p) => {
    const doc = p.doc,
      win = doc.defaultView,
      $ = (selector) => doc.querySelector(selector);
    assert(
      win.location.port === '9007' && ['127.0.0.1', 'localhost'].includes(win.location.hostname),
      'Use isolated Ukraine wide-role qualification origin 9007.',
    );
    await p.wait(
      () =>
        $('#status')?.dataset.state === 'ready' &&
        $('#reveal-source-dialog') &&
        $('.authoring-reference-read') &&
        roles.every(
          (role) => $(`#ukraine-wide-read-${role}`) && $(`#ukraine-wide-canvas-${role} canvas`),
        ),
      30000,
    );
    await doc.fonts.ready;
    const motion = $('#ukraine-wide-motion-status'),
      dialog = $('#reveal-source-dialog'),
      region = $('#reveal-source-region'),
      read = $('#reveal-read-source'),
      href = win.location.href,
      historyLength = win.history.length,
      initialLocale = doc.documentElement.lang,
      initialLocal = snapshot(win.localStorage),
      initialSession = snapshot(win.sessionStorage),
      originalRows = [...$('#rows').children],
      canvases = roles.map((role) => $(`#ukraine-wide-canvas-${role} canvas`)),
      links = sources.map((source) => $(`#ukraine-wide-source-${source.id}`)),
      values = () => ({
        ...Object.fromEntries(Object.keys(choices).map((id) => [id, $(`#${id}`).value])),
        ...Object.fromEntries(toggles.map((id) => [id, $(`#${id}`).checked])),
      }),
      initialValues = values(),
      sourceTexts = new Map(),
      copies = new Map(),
      clicks = [];
    let localeChosen = false;
    assert(['en', 'uk'].includes(initialLocale), 'Expected an English or Ukrainian study.');
    assert($('#play').getAttribute('aria-pressed') === 'false', 'The wide study started playing.');
    assert(
      originalRows.length === 3 && canvases.length === 3 && links.every(Boolean),
      'Expected three comparisons and two source links.',
    );
    for (const [id, options] of Object.entries(choices))
      assert(
        same(
          [...$(`#${id}`).options].map((option) => option.value),
          options,
        ),
        `The ${id} comparison choices changed.`,
      );
    for (const source of sources) {
      const response = await fetch(`/${source.path}`, { cache: 'no-store' });
      assert(response.ok, `Cannot observe ${source.id}.`);
      const bytes = await response.arrayBuffer();
      assert(
        bytes.byteLength === source.bytes && (await hash(bytes)) === source.sha256,
        `The ${source.id} document differs from its pinned historical bytes.`,
      );
      sourceTexts.set(source.id, text(bytes));
    }
    for (const locale of ['en', 'uk']) {
      const response = await fetch(`/game/locales/${locale}/tools.json`, { cache: 'no-store' });
      assert(response.ok, `Cannot observe authoritative ${locale} labels.`);
      copies.set(locale, await response.json());
    }
    const onClick = (event) => {
      const link = event.target.closest?.('a[href]');
      if (link)
        queueMicrotask(() =>
          clicks.push({
            source: links.indexOf(link),
            href: link.href,
            prevented: event.defaultPrevented,
            download: link.hasAttribute('download'),
          }),
        );
    };
    doc.addEventListener('click', onClick, true);
    const unchanged = () => {
      assert(
        p.doc === doc && win.location.href === href && win.history.length === historyLength,
        'Source review navigated or changed history.',
      );
      assert(
        originalRows.every((row, i) => $('#rows').children[i] === row) &&
          $('#rows').children.length === 3,
        'An interaction replaced or duplicated comparison rows.',
      );
      for (const canvas of canvases) {
        const rect = canvas.getBoundingClientRect();
        assert(
          canvas.isConnected &&
            canvas.width === 780 &&
            canvas.height === 215 &&
            Math.abs(rect.width - 780) < 0.1 &&
            Math.abs(rect.height - 215) < 0.1,
          'The labeled comparison lost its true 780 × 215 CSS/intrinsic dimensions.',
        );
      }
      assert(
        links.every(
          (link, i) => link.isConnected && new URL(link.href).pathname === `/${sources[i].path}`,
        ),
        'Source identities changed or their real links were replaced.',
      );
      assert(
        clicks.every((click) => click.source >= 0 && click.prevented && !click.download),
        'Source review dispatched raw navigation or a download.',
      );
      const withoutLocale = (entries) =>
        entries.filter(([key]) => !localeChosen || key !== localeKey);
      assert(
        same(withoutLocale(initialLocal), withoutLocale(snapshot(win.localStorage))) &&
          same(initialSession, snapshot(win.sessionStorage)),
        'Source review changed unrelated origin storage.',
      );
    };
    const pixels = async () => {
      const rows = [];
      for (const [i, canvas] of canvases.entries()) {
        const bytes = canvas.getContext('2d').getImageData(0, 0, 780, 215).data;
        assert(
          bytes.some((value) => value !== 0),
          'A comparison canvas is empty.',
        );
        rows.push({ role: roles[i], rgbaSha256: await hash(bytes) });
      }
      return { rows, sha256: await hash(new TextEncoder().encode(JSON.stringify(rows))) };
    };
    const toggle = async (id, checked) => {
      if ($(`#${id}`).checked !== checked) await p.choose(`#${id}`);
      assert($(`#${id}`).checked === checked, `Toggle ${id} did not settle.`);
    };
    const play = async (playing) => {
      if (($('#play').getAttribute('aria-pressed') === 'true') !== playing) await p.choose('#play');
      assert(
        ($('#play').getAttribute('aria-pressed') === 'true') === playing,
        'Play/Pause did not follow its explicit command.',
      );
    };
    const open = async (source) => {
      await p.pageActions();
      const opener = $(`#ukraine-wide-source-${source.id}`),
        title = copies.get(doc.documentElement.lang)[source.titleKey];
      assert(opener.textContent.trim() === title, 'Source link trails the selected locale.');
      await p.choose(`#ukraine-wide-source-${source.id}`);
      await p.wait(() => dialog.open && dialog.dataset.state === 'ready', 30000);
      assert(
        dialog.dataset.path === source.path &&
          dialog.dataset.kind === 'text' &&
          $('#reveal-source-title').textContent === title &&
          doc.activeElement === $('#reveal-source-close'),
        'Source open lost its identity, localized title or modal ownership.',
      );
      assert(
        region.querySelector('pre')?.textContent === sourceTexts.get(source.id) &&
          region.querySelector('pre').children.length === 0 &&
          region.children.length === 1,
        'Source reader did not render the full original literally.',
      );
      assert(motion.dataset.state === 'suspended', 'Source modal did not suspend cosmetic motion.');
      unchanged();
      return { opener, title };
    };
    const close = async (opener) => {
      assert(
        read.getAttribute('aria-pressed') !== 'true',
        'Leave reading before closing the source.',
      );
      await p.pulse('back');
      await p.wait(() => !dialog.open);
      assert(
        doc.activeElement === opener && region.children.length === 0,
        'Source Back lost the exact opener or retained its content.',
      );
      unchanged();
    };
    try {
      unchanged();
      const initialPaint = await pixels();
      await settle();
      assert((await pixels()).sha256 === initialPaint.sha256, 'Initial stopped pixels changed.');
      await p.pageActions();
      assert(
        doc.activeElement === $('[data-language-select]'),
        'Page actions missed the header controls.',
      );
      const canceled = [];
      for (const id of Object.keys(choices)) {
        const element = $(`#${id}`),
          original = values(),
          before = await pixels();
        await p.choose(`#${id}`);
        await p.pulse(element.selectedIndex < element.options.length - 1 ? 'down' : 'up');
        await p.pulse('back');
        assert(
          same(values(), original) &&
            doc.activeElement === element &&
            (await pixels()).sha256 === before.sha256 &&
            $('#play').getAttribute('aria-pressed') === 'false',
          `Canceled ${id} changed the held comparison or lost focus.`,
        );
        canceled.push(id);
      }
      await toggle('wings', true);
      await toggle('guides', false);
      await toggle('reduced', false);
      await p.select('#speed', '1');
      await p.select('#background', 'dark');
      const matrix = [];
      for (const heading of choices.heading) {
        await p.select('#heading', heading);
        for (const phase of choices.phase) {
          await p.select('#phase', phase);
          assert(
            $('#play').getAttribute('aria-pressed') === 'false',
            'Held phase allowed playback.',
          );
          const before = await pixels();
          await settle(130);
          assert(
            (await pixels()).sha256 === before.sha256,
            'Held phase pixels continued advancing.',
          );
          matrix.push({ heading, phase, ...before });
          unchanged();
        }
      }
      const edits = [];
      for (const id of ['background', 'speed'])
        for (const value of choices[id]) {
          await p.select(`#${id}`, value);
          edits.push({ id, value, rgbaSha256: (await pixels()).sha256 });
        }
      for (const id of toggles)
        for (const checked of [!initialValues[id], initialValues[id]]) {
          await toggle(id, checked);
          edits.push({ id, checked, rgbaSha256: (await pixels()).sha256 });
        }
      // A real phase change during playback must stop and reproduce the earlier
      // held view. Browser pulse timing cannot qualify the instant first-frame dt.
      await p.select('#heading', '0');
      await p.select('#background', 'dark');
      await p.select('#speed', '1');
      await toggle('wings', true);
      await toggle('guides', false);
      await toggle('reduced', false);
      await p.select('#phase', '0');
      await play(true);
      await settle(150);
      const osReduced = win.matchMedia('(prefers-reduced-motion: reduce)').matches,
        movingBefore = await pixels();
      await settle(270);
      const movingAfter = await pixels();
      assert(
        motion.dataset.state === (osReduced ? 'reduced' : 'playing') &&
          (movingBefore.sha256 === movingAfter.sha256) === osReduced,
        'Cosmetic playback disagrees with the effective system motion preference.',
      );
      await p.select('#phase', '1');
      assert(
        $('#play').getAttribute('aria-pressed') === 'false',
        'Phase change did not stop playback.',
      );
      const heldAgain = await pixels(),
        earlier = matrix.find((row) => row.heading === '0' && row.phase === '1');
      assert(
        heldAgain.sha256 === earlier.sha256,
        'Phase change did not reproduce its original held composition.',
      );
      await play(true);
      await toggle('wings', false);
      const noWings = await pixels();
      await settle();
      assert(
        (await pixels()).sha256 === noWings.sha256,
        'Wings-off composition changed with time.',
      );
      await toggle('wings', true);
      await toggle('reduced', true);
      const reduced = await pixels();
      await settle();
      assert(
        motion.dataset.state === 'reduced' && (await pixels()).sha256 === reduced.sha256,
        'Manual reduced motion did not retain static pixels.',
      );
      await p.select('#background', 'light');
      assert(
        (await pixels()).sha256 !== reduced.sha256,
        'Reduced mode prevented explicit repaint.',
      );
      await play(false);
      for (const id of toggles) await toggle(id, initialValues[id]);
      for (const id of Object.keys(choices)) await p.select(`#${id}`, initialValues[id]);
      const retryValues = values();
      await p.choose('#ukraine-wide-retry');
      await p.wait(() => $('#status').dataset.state === 'ready', 30000);
      assert(
        doc.activeElement === $('#ukraine-wide-retry') &&
          same(values(), retryValues) &&
          $('#play').getAttribute('aria-pressed') === 'false',
        'Retry changed controls or lost its owner.',
      );
      unchanged();
      p.record(
        'All 16 heading/held-phase pairs remain static; canceled selectors, cosmetic playback/phase-stop, toggles and Retry retain the source comparison',
        '#status',
        {
          canceled,
          matrix,
          edits,
          osReduced,
          motion: {
            movingBefore: movingBefore.sha256,
            movingAfter: movingAfter.sha256,
            heldAgain: heldAgain.sha256,
            wingsOff: noWings.sha256,
            reduced: reduced.sha256,
          },
          boundary:
            'RGBA hashes observe actual canvas output, not independent original-image decoding, exact internal phase values, first-frame timing, scheduler/CPU work or motion comfort. OS reduced motion is observed, never overridden.',
        },
      );

      const readers = [];
      for (const [index, role] of roles.entries()) {
        const button = $(`#ukraine-wide-read-${role}`),
          canvasRegion = $(`#ukraine-wide-canvas-${role}`);
        await p.section(`#ukraine-wide-${role}`);
        assert(doc.activeElement === button, 'Sections did not reach the exact reader.');
        await p.pulse('menu');
        await p.wait(() => $('.authoring-sections-dialog').open);
        await p.pulse('back');
        assert(doc.activeElement === button, 'Canceled Sections lost its reader opener.');
        await p.choose(`#ukraine-wide-read-${role}`);
        assert(button.getAttribute('aria-pressed') === 'true', 'Comparison did not enter reading.');
        const maxX = Math.max(0, canvasRegion.scrollWidth - canvasRegion.clientWidth),
          maxY = Math.max(0, canvasRegion.scrollHeight - canvasRegion.clientHeight);
        for (let n = 0; n < 20 && canvasRegion.scrollLeft < maxX - 1; n++) await p.pulse('right');
        for (let n = 0; n < 20 && canvasRegion.scrollTop < maxY - 1; n++) await p.pulse('down');
        assert(
          canvasRegion.scrollLeft >= maxX - 1 && canvasRegion.scrollTop >= maxY - 1,
          'Comparison far edges are unreachable.',
        );
        const far = [canvasRegion.scrollLeft, canvasRegion.scrollTop];
        for (let n = 0; n < 20 && canvasRegion.scrollLeft > 1; n++) await p.pulse('left');
        for (let n = 0; n < 20 && canvasRegion.scrollTop > 1; n++) await p.pulse('up');
        assert(
          canvasRegion.scrollLeft <= 1 && canvasRegion.scrollTop <= 1,
          'Comparison origin is unreachable.',
        );
        await p.pulse(index % 2 ? 'confirm' : 'back');
        assert(
          doc.activeElement === button && button.getAttribute('aria-pressed') === 'false',
          'Reader exit lost the exact entry or retained reading.',
        );
        readers.push({
          role,
          client: [canvasRegion.clientWidth, canvasRegion.clientHeight],
          maxX,
          maxY,
          far,
          start: [canvasRegion.scrollLeft, canvasRegion.scrollTop],
          scrolled: maxX > 1 || maxY > 1,
        });
        unchanged();
      }
      p.record(
        'Three stable Sections and bounded readers preserve true 780 × 215 comparisons and exact Back',
        '#status',
        {
          viewport: [win.innerWidth, win.innerHeight],
          readers,
          boundary:
            'Scroll qualification is limited to recorded overflow; a zero-overflow reader is not panning evidence.',
        },
      );

      // Keep cosmetic Play requested while each source modal owns input.
      await play(true);
      const documents = [];
      for (const [index, source] of sources.entries()) {
        const { opener } = await open(source),
          maxX = Math.max(0, region.scrollWidth - region.clientWidth),
          maxY = Math.max(0, region.scrollHeight - region.clientHeight),
          before = await pixels();
        await settle();
        assert(
          (await pixels()).sha256 === before.sha256,
          'Source modal allowed changing canvas pixels.',
        );
        assert(maxX <= 1, 'Literal source text has horizontal overflow.');
        await p.choose('#reveal-read-source');
        assert(read.getAttribute('aria-pressed') === 'true', 'Source Read did not own the region.');
        await p.pulse('down');
        if (maxY > 1) assert(region.scrollTop > 0, 'Source Down did not scroll.');
        await p.pulse('back');
        assert(
          dialog.open &&
            doc.activeElement === read &&
            read.getAttribute('aria-pressed') === 'false',
          'Reader Back closed the source or lost Read.',
        );
        await p.choose('#reveal-source-end');
        const end = region.scrollTop;
        assert(end >= maxY - 1, 'Source End missed the final lines.');
        await p.choose('#reveal-source-start');
        assert(region.scrollTop <= 1, 'Source Start missed the beginning.');
        if (index === 0) {
          const previous = region.querySelector('pre');
          await p.choose('#reveal-source-retry');
          await p.wait(
            () => dialog.dataset.state === 'ready' && region.querySelector('pre') !== previous,
            30000,
          );
          assert(
            doc.activeElement === $('#reveal-source-retry') &&
              region.querySelector('pre').textContent === sourceTexts.get(source.id),
            'Source Retry lost text or focus.',
          );
        }
        await close(opener);
        documents.push({
          ...source,
          lines: sourceTexts.get(source.id).split('\n').length,
          maxX,
          maxY,
          end,
          start: 0,
        });
      }
      await play(false);
      const language = $('[data-language-select]');
      await p.choose('[data-language-select]');
      await p.pulse(initialLocale === 'en' ? 'down' : 'up');
      await p.pulse('back');
      assert(
        language.value === initialLocale &&
          doc.documentElement.lang === initialLocale &&
          doc.activeElement === language,
        'Canceled language selection changed locale or focus.',
      );
      const locales = [];
      localeChosen = true;
      for (const locale of ['uk', 'en', ...(initialLocale === 'uk' ? ['uk'] : [])]) {
        await p.select('[data-language-select]', locale);
        await p.wait(() => doc.documentElement.lang === locale);
        assert(
          $('h1').textContent.trim() === copies.get(locale)['ukraineRoleReview.wide.heading'],
          'Wide-study heading trails the live locale.',
        );
        for (const role of roles) {
          const title = $(`#ukraine-wide-${role}`).textContent.trim();
          assert(
            $(`#ukraine-wide-read-${role}`).getAttribute('aria-label') ===
              `${locale === 'uk' ? 'Читати й прокручувати' : 'Read and scroll'}: ${title}`,
            'Canvas Read accessible name trails its title/locale.',
          );
        }
        const names = [];
        for (const source of sources) {
          const { opener, title } = await open(source);
          assert(
            read.getAttribute('aria-label') ===
              `${locale === 'uk' ? 'Читати й прокручувати' : 'Read and scroll'}: ${title}`,
            'Source Read accessible name trails its title/locale.',
          );
          await p.choose('#reveal-read-source');
          await p.pulse('back');
          assert(
            dialog.open && doc.activeElement === read,
            'Localized reader Back lost its owner.',
          );
          await close(opener);
          names.push({ id: source.id, title });
        }
        locales.push({
          locale,
          heading: $('h1').textContent.trim(),
          play: $('#play').textContent.trim(),
          names,
        });
      }
      assert(
        doc.documentElement.lang === initialLocale && same(values(), initialValues),
        'Study controls or initial locale were not restored.',
      );
      unchanged();
      p.record(
        'Both pinned documents remain literal through bounded reading, Retry, exact two-step Back and live UK/EN; unrelated storage stays unchanged',
        '#status',
        {
          documents,
          locales,
          boundary:
            'Source prose keeps its original language. Only explicit locale selection can persist its preference; no source edits, project Save/import/export, installation, approval or gameplay. No network faults or timed cancellation injected.',
        },
      );

      const returnSelector = '.authoring-reference-rail > a',
        destination = new URL($(returnSelector).href);
      assert(
        destination.origin === win.location.origin &&
          destination.pathname === '/authoring/asset-studio/',
        'Direct-entry Return does not point to the real Asset Studio owner.',
      );
      await p.follow(returnSelector, '/authoring/asset-studio/');
      await p.wait(
        () =>
          p.doc.querySelector('.authoring-input-rail') && p.doc.querySelector('#save-workspace'),
        30000,
      );
      assert(p.doc !== doc, 'Return did not load the real parent document.');
      p.record(
        'Actual Reference Return reaches Asset Studio; no editor action follows arrival',
        'h1',
        {
          gallery: href,
          destination: win.location.href,
          boundary:
            'Editor startup is outside read-only study storage acceptance. No reciprocal link/reentry, saved draft, runtime adoption, OS export, physical controller or offline acceptance is claimed.',
        },
      );
    } finally {
      doc.removeEventListener('click', onClick, true);
    }
  },
];
