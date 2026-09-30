// Current source-study qualification. Only shared virtual-pad commands operate
// the application; byte, decode, DOM, geometry and storage reads are observers.
import { FPV_ENEMY_SOURCES } from '../../../authoring/library/fpv-enemy-presentations/sources.mjs';

const assert = (value, message) => {
  if (!value) throw new Error(message);
};
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const root = 'authoring/library/fpv-enemy-presentations/';
const roles = [
  ['bouncer', 'trackedHunter'],
  ['border-patrol', 'borderQuad'],
  ['contour-patrol', 'frontierTwinRotor'],
  ['claimed-rover', 'sixWheelRover'],
  ['eroder', 'territoryDrill'],
  ['lane-boss', 'tripodLaneEmitter'],
  ['relay-sentinel', 'relaySentinel'],
];
const types = roles.map(([type]) => type);
const localeKey = 'revealline.locale.v1';
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
const fingerprint = async (bytes) => ({
  bytes: bytes.byteLength,
  sha256: [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join(''),
});
async function observe(url) {
  const response = await fetch(url, { cache: 'no-store' });
  assert(response.ok, `Cannot observe source-study data: ${url}.`);
  const bytes = await response.arrayBuffer();
  return { bytes, pin: await fingerprint(bytes) };
}
async function pinned(source, url = `/${source.path}`) {
  const value = await observe(url);
  assert(
    value.pin.bytes === source.bytes && value.pin.sha256 === source.sha256,
    `Source identity differs from its pin: ${source.id}.`,
  );
  return value;
}
const decodeText = (bytes) =>
  new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);

export const fpvEnemyGalleryCurrent = [
  'Current FPV enemy study: seven bodies, controls, exact sources, reading and real return',
  '/authoring/library/fpv-enemy-presentations/index.html',
  async (p) => {
    const doc = p.doc,
      win = doc.defaultView,
      $ = (selector) => doc.querySelector(selector);
    assert(
      win.location.port === '9001' && ['localhost', '127.0.0.1'].includes(win.location.hostname),
      'Use the isolated FPV enemy qualification origin on port 9001.',
    );
    await p.wait(
      () =>
        $('.authoring-reference-read') &&
        $('#reveal-source-dialog') &&
        $('#fpv-enemy-source-guide') &&
        $('#fpv-enemy-source-inspection') &&
        $('#status')?.dataset.state === 'ready' &&
        $('[data-language-select]') &&
        $('#role')?.options.length === 7 &&
        types.every((type) => $(`#fpv-enemy-${type}`) && $(`#fpv-enemy-source-${type}`)) &&
        [...doc.querySelectorAll('#grid .metric')].filter((node) => node.textContent.trim())
          .length === 7,
      30000,
    );
    const images = FPV_ENEMY_SOURCES.filter((source) => source.kind === 'image'),
      texts = ['guide', 'inspection'].map((id) =>
        FPV_ENEMY_SOURCES.find((source) => source.id === id),
      ),
      dialog = $('#reveal-source-dialog'),
      region = $('#reveal-source-region'),
      read = $('#reveal-read-source'),
      href = win.location.href,
      historyLength = win.history.length,
      initialLocale = doc.documentElement.lang,
      beforeLocal = snapshot(win.localStorage),
      beforeSession = snapshot(win.sessionStorage),
      originalCards = [...doc.querySelectorAll('#grid > article')],
      originalSamples = [...doc.querySelectorAll('.frame img')],
      originalLinks = FPV_ENEMY_SOURCES.map(({ id }) => {
        const element = $(`#fpv-enemy-source-${id}`);
        return { element, id, href: element?.getAttribute('href') };
      }),
      initialControls = {
        role: $('#role').value,
        heading: $('#heading').value,
        pivots: $('#pivots').checked,
      },
      clicks = [],
      metadata = new Map(),
      observedTexts = new Map();
    let explicitLocaleChoice = false;
    assert(['en', 'uk'].includes(initialLocale), 'Unsupported initial source-study locale.');
    assert(
      same(
        images.map(({ id }) => id),
        types,
      ) &&
        texts.every((source) => source?.kind === 'text') &&
        FPV_ENEMY_SOURCES.length === 9,
      'Expected seven original images and two source documents.',
    );
    assert(
      originalCards.length === 7 &&
        originalSamples.length === 57 &&
        originalLinks.every(({ element }) => element),
      'Expected seven cards, fifty-seven image samples and nine source actions.',
    );
    for (const file of ['provenance.json', 'inspection.json']) {
      const value = await observe(`/${root}${file}`),
        report = JSON.parse(decodeText(value.bytes));
      metadata.set(file, value.pin);
      const rows = file === 'provenance.json' ? report.items : report.images;
      assert(
        same(
          rows.map(({ type }) => type),
          types,
        ),
        `The ${file} source identity order changed.`,
      );
      for (const source of images) {
        const row = rows.find(({ type }) => type === source.id),
          dimensions = row.actualDimensions || row.dimensions;
        assert(
          source.bytes === row.bytes &&
            source.sha256 === row.sha256 &&
            source.width === dimensions[0] &&
            source.height === dimensions[1],
          `Source descriptor differs from retained ${file}: ${source.id}.`,
        );
        if (file === 'provenance.json')
          assert(
            source.path === `${root}${row.original}`,
            'Original path differs from retained provenance.',
          );
      }
    }
    for (const source of texts) observedTexts.set(source.id, await pinned(source));
    const copies = new Map(
      await Promise.all(
        ['en', 'uk'].map(async (locale) => {
          const response = await fetch(`/game/locales/${locale}/tools.json`, { cache: 'no-store' });
          assert(response.ok, `Cannot observe authoritative ${locale} source-study labels.`);
          return [locale, await response.json()];
        }),
      ),
    );
    const format = (locale, value) =>
      new Intl.NumberFormat(locale, { maximumFractionDigits: 20 }).format(value);
    const label = (source, locale = doc.documentElement.lang) => {
      const key =
        source.kind === 'image'
          ? `fpvEnemySourceReview.roles.${roles.find(([type]) => type === source.id)[1]}`
          : `fpvEnemySourceReview.${source.id === 'guide' ? 'sourceQualifications' : 'measurements'}`;
      return copies.get(locale)[key];
    };
    const onClick = (event) => {
      const link = event.target.closest?.('a[href]');
      if (!link) return;
      queueMicrotask(() =>
        clicks.push({
          href: link.href,
          source: originalLinks.find(({ element }) => element === link)?.id || null,
          download: link.hasAttribute('download'),
          prevented: event.defaultPrevented,
        }),
      );
    };
    doc.addEventListener('click', onClick, true);
    const unchanged = () => {
      assert(
        p.doc === doc && win.location.href === href && win.history.length === historyLength,
        'Source study navigated or changed browser history.',
      );
      assert(
        originalCards.every((node) => node.isConnected) &&
          doc.querySelectorAll('#grid > article').length === 7 &&
          originalSamples.every((node) => node.isConnected) &&
          doc.querySelectorAll('.frame img').length === 57,
        'Interaction replaced the original card/sample inventory.',
      );
      assert(
        originalLinks.every(
          ({ element, href: previous }) =>
            element.isConnected && element.getAttribute('href') === previous,
        ),
        'Interaction changed a source destination.',
      );
      assert(
        same(
          beforeLocal.filter(([key]) => !explicitLocaleChoice || key !== localeKey),
          snapshot(win.localStorage).filter(([key]) => !explicitLocaleChoice || key !== localeKey),
        ) && same(beforeSession, snapshot(win.sessionStorage)),
        'Source study changed unrelated origin storage.',
      );
      assert(
        clicks.every((row) => row.source && row.prevented && !row.download),
        'Viewing dispatched a raw-source navigation or download.',
      );
    };
    const currentControls = () => ({
      role: $('#role').value,
      heading: $('#heading').value,
      pivots: $('#pivots').checked,
    });
    const rotation = (degrees) => {
      const angle = (Number(degrees) * Math.PI) / 180,
        expected = [Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle)];
      for (const image of originalSamples) {
        const matrix = new win.DOMMatrixReadOnly(win.getComputedStyle(image).transform);
        assert(
          [matrix.a, matrix.b, matrix.c, matrix.d].every(
            (value, index) => Math.abs(value - expected[index]) < 0.00001,
          ),
          `Sample heading does not match ${degrees} degrees.`,
        );
      }
    };
    const reading = () => read.getAttribute('aria-pressed') === 'true';
    const open = async (source) => {
      if (source.kind === 'image') await p.section(`#fpv-enemy-${source.id}`);
      else await p.pageActions();
      const opener = $(`#fpv-enemy-source-${source.id}`);
      assert(
        new URL(opener.href).pathname === `/${source.path}`,
        'Source action disagrees with its pinned path.',
      );
      await p.choose(`#fpv-enemy-source-${source.id}`);
      await p.wait(() => dialog.open && dialog.dataset.state === 'ready', 30000);
      assert(
        dialog.dataset.path === source.path && dialog.dataset.kind === source.kind,
        'Viewer opened another source.',
      );
      assert(
        doc.activeElement === $('#reveal-source-close'),
        'Ready source stole focus from the initial Back control.',
      );
      assert(
        $('#reveal-source-title').textContent === label(source),
        'Source title does not match its selected identity and locale.',
      );
      assert(
        !reading() && region.scrollTop <= 1 && region.scrollLeft <= 1,
        'Opening retained an old reader or position.',
      );
      unchanged();
      return opener;
    };
    const close = async (opener, explicit = false) => {
      assert(!reading(), 'End reading before requesting modal Back.');
      if (explicit) await p.choose('#reveal-source-close');
      else await p.pulse('back');
      await p.wait(() => !dialog.open);
      assert(
        doc.activeElement === opener && region.children.length === 0 && !reading(),
        'Closing lost its exact opener or retained content/ownership.',
      );
      unchanged();
    };
    const enterRead = async () => {
      await p.choose('#reveal-read-source');
      assert(reading(), 'Read did not acquire the selected source.');
    };
    const stopRead = async (command = 'back') => {
      await p.pulse(command);
      assert(
        dialog.open && !reading() && doc.activeElement === read,
        'Reader exit did not preserve the modal and exact Read control.',
      );
    };
    const decodeDisplayed = async (source) => {
      const image = region.querySelector('img'),
        url = image?.currentSrc || image?.src;
      assert(url?.startsWith('blob:'), 'The source viewer is not displaying its checked Blob.');
      await image.decode();
      assert(
        image.complete &&
          image.naturalWidth === source.width &&
          image.naturalHeight === source.height,
        'Decoded source dimensions changed.',
      );
      const value = await pinned(source, url);
      return { image, url, pin: value.pin };
    };
    const bounds = () => ({
      width: region.clientWidth,
      height: region.clientHeight,
      maxX: Math.max(0, region.scrollWidth - region.clientWidth),
      maxY: Math.max(0, region.scrollHeight - region.clientHeight),
    });
    const textReading = async () => {
      const geometry = bounds();
      assert(geometry.maxX <= 1 && geometry.maxY > 1, 'Expected long, wrapped source text.');
      await enterRead();
      await p.pulse('down');
      assert(region.scrollTop > 0, 'Source Down did not scroll.');
      await p.pulse('up');
      assert(region.scrollTop <= 1, 'Source Up did not restore the start.');
      await stopRead();
      await p.choose('#reveal-source-end');
      const end = region.scrollTop;
      assert(end >= geometry.maxY - 1, 'End of details did not reach the complete text.');
      await enterRead();
      await p.pulse('up');
      assert(region.scrollTop < end, 'Reading cannot leave the final text lines.');
      await p.pulse('down');
      assert(region.scrollTop >= geometry.maxY - 1, 'Reading cannot regain the final text lines.');
      await stopRead('confirm');
      await p.choose('#reveal-source-start');
      assert(region.scrollTop <= 1, 'Start of details did not restore the first text lines.');
      return { ...geometry, end, start: region.scrollTop };
    };
    try {
      await Promise.all(originalSamples.map((image) => image.decode()));
      assert(
        originalSamples.every(
          (image) => image.naturalWidth === 1254 && image.naturalHeight === 1254,
        ),
        'The original sample set has unexpected dimensions.',
      );
      const sampleSizes = [16, 24, 32, 64];
      for (const card of originalCards)
        for (const tone of ['dark', 'light'])
          assert(
            same(
              [...card.querySelectorAll(`.${tone} .frame`)].map((frame) => [
                frame.clientWidth,
                frame.clientHeight,
              ]),
              sampleSizes.map((size) => [size, size]),
            ),
            `The ${tone} source samples do not retain their labeled CSS sizes.`,
          );
      assert(
        $('#large').parentElement.clientWidth === 128 &&
          $('#large').parentElement.clientHeight === 128,
        'The enlarged body does not retain its labeled 128 CSS pixel frame.',
      );
      const metricsBeforeRetry = [...doc.querySelectorAll('#grid .metric')].map(
        (node) => node.textContent,
      );
      await p.choose('#fpv-enemy-retry');
      await p.wait(() => $('#status').dataset.state === 'ready', 30000);
      assert(
        doc.activeElement === $('#fpv-enemy-retry') &&
          same(currentControls(), initialControls) &&
          same(
            [...doc.querySelectorAll('#grid .metric')].map((node) => node.textContent),
            metricsBeforeRetry,
          ),
        'Page Retry lost owned focus or changed the controls and retained measurements.',
      );
      unchanged();
      const pageRetry = {
        state: $('#status').dataset.state,
        focused: doc.activeElement.id,
        retainedSamples: originalSamples.length,
        retainedMeasurements: metricsBeforeRetry.length,
      };
      await p.pageActions();
      assert(
        doc.activeElement === $('[data-language-select]'),
        'Page actions did not reach the first real header control.',
      );
      for (const selector of ['#heading', '#role']) {
        const element = $(selector),
          original = element.value,
          controls = currentControls(),
          source = $('#large').src;
        await p.choose(selector);
        await p.pulse(element.selectedIndex < element.options.length - 1 ? 'down' : 'up');
        await p.pulse('back');
        assert(
          element.value === original &&
            same(currentControls(), controls) &&
            $('#large').src === source &&
            doc.activeElement === element,
          `Canceled ${selector} changed the displayed study or lost its selector.`,
        );
      }
      const matrix = [];
      for (const [type] of roles) {
        await p.select('#role', type);
        await p.wait(
          () =>
            $('#large').complete &&
            $('#large').naturalWidth === 1254 &&
            new URL($('#large').src).pathname === `/${root}originals/${type}.png`,
        );
        await $('#large').decode();
        for (const heading of ['0', '90', '180', '270']) {
          await p.select('#heading', heading);
          rotation(heading);
          assert($('#role').value === type, 'Heading change selected a different body.');
          matrix.push({ type, heading: Number(heading), image: new URL($('#large').src).pathname });
        }
      }
      await p.choose('#pivots');
      assert(
        $('#pivots').checked !== initialControls.pivots &&
          doc.body.classList.contains('pivots') === $('#pivots').checked,
        'Pivot overlay did not follow its explicit toggle.',
      );
      await p.choose('#pivots');
      assert(
        $('#pivots').checked === initialControls.pivots &&
          doc.body.classList.contains('pivots') === initialControls.pivots,
        'Pivot overlay did not restore its initial value.',
      );
      await p.select('#role', initialControls.role);
      await p.select('#heading', initialControls.heading);
      const destinations = [];
      for (const type of types) {
        await p.section(`#fpv-enemy-${type}`);
        const expected = $(`#fpv-enemy-source-${type}`);
        assert(
          doc.activeElement === expected && !dialog.open,
          'Sections failed to focus its exact inactive source action.',
        );
        await p.pulse('menu');
        await p.wait(() => $('.authoring-sections-dialog').open);
        await p.pulse('back');
        assert(
          doc.activeElement === expected && !dialog.open,
          'Canceled Sections lost its exact source action.',
        );
        destinations.push({ type, focused: expected.id });
      }
      await p.choose('.authoring-reference-read');
      const page = doc.scrollingElement,
        pageRead = $('.authoring-reference-read'),
        maxY = Math.max(0, page.scrollHeight - page.clientHeight),
        step = Math.max(80, Math.round(win.innerHeight * 0.6)),
        budget = Math.ceil(maxY / step) + 3;
      assert(
        pageRead.getAttribute('aria-pressed') === 'true' && budget <= 100,
        'Page reader did not own a bounded study.',
      );
      for (let n = 0; n < budget && page.scrollTop < maxY - 1; n++) await p.pulse('down');
      assert(
        page.scrollTop >= maxY - 1,
        'Page reader cannot reach the final source qualifications.',
      );
      const pageEnd = page.scrollTop;
      for (let n = 0; n < budget && page.scrollTop > 1; n++) await p.pulse('up');
      assert(page.scrollTop <= 1, 'Page reader cannot return to the first controls.');
      await p.pulse('back');
      assert(
        pageRead.getAttribute('aria-pressed') === 'false' && doc.activeElement === pageRead,
        'Page reading lost its exact entry.',
      );
      unchanged();
      p.record(
        'All seven bodies and four headings, canceled selectors, pivot restoration, seven exact Sections targets and bounded whole-page reading use the real shared controller',
        '#status',
        {
          matrix,
          destinations,
          controlsRestored: same(currentControls(), initialControls),
          samples: originalSamples.length,
          sampleSizes,
          pageRetry,
          page: { maxY, end: pageEnd, start: page.scrollTop, scrolled: maxY > 1 },
        },
      );

      const visits = [];
      for (const [index, source] of images.entries()) {
        const opener = await open(source),
          displayed = await decodeDisplayed(source);
        await enterRead();
        await stopRead(index % 2 ? 'confirm' : 'back');
        const row = {
          id: source.id,
          path: source.path,
          ...displayed.pin,
          width: displayed.image.naturalWidth,
          height: displayed.image.naturalHeight,
        };
        if (index === 0) {
          await p.choose('#reveal-source-retry');
          await p.wait(
            () =>
              dialog.dataset.state === 'ready' && region.querySelector('img') !== displayed.image,
            30000,
          );
          const retried = await decodeDisplayed(source);
          assert(
            doc.activeElement === $('#reveal-source-retry') && retried.url !== displayed.url,
            'Retry failed to retain focus and prepare a new owned image.',
          );
          row.retry = { ...retried.pin, newImage: true, focus: doc.activeElement.id };
        }
        await close(opener, index % 2 === 1);
        visits.push(row);
      }
      let opener = await open(images[0]);
      const displayed = await decodeDisplayed(images[0]);
      await p.choose('#reveal-source-actual');
      const actual = displayed.image.getBoundingClientRect(),
        actualBounds = bounds();
      assert(
        Math.abs(actual.width - images[0].width) <= 1 &&
          Math.abs(actual.height - images[0].height) <= 1 &&
          actualBounds.maxX > 1 &&
          actualBounds.maxY > 1,
        'Actual size did not expose both original axes.',
      );
      await enterRead();
      for (let n = 0; n < 80 && region.scrollLeft < actualBounds.maxX - 1; n++)
        await p.pulse('right');
      for (let n = 0; n < 80 && region.scrollTop < actualBounds.maxY - 1; n++)
        await p.pulse('down');
      assert(
        region.scrollLeft >= actualBounds.maxX - 1 && region.scrollTop >= actualBounds.maxY - 1,
        'Original far edges are not reachable.',
      );
      const far = [region.scrollLeft, region.scrollTop];
      for (let n = 0; n < 80 && region.scrollLeft > 1; n++) await p.pulse('left');
      for (let n = 0; n < 80 && region.scrollTop > 1; n++) await p.pulse('up');
      assert(
        region.scrollLeft <= 1 && region.scrollTop <= 1,
        'Original panning cannot return to its origin.',
      );
      const start = [region.scrollLeft, region.scrollTop];
      await stopRead();
      await p.choose('#reveal-source-fit');
      const fit = displayed.image.getBoundingClientRect();
      assert(
        fit.width <= region.clientWidth + 1 &&
          fit.height <= region.clientHeight + 1 &&
          displayed.image.src === displayed.url,
        'Fit did not contain the same complete original.',
      );
      await close(opener);
      p.record(
        'Every original-view action fully decodes exact retained PNG bytes; Retry, both reader exits, exact Back and representative two-axis Actual Size/Fit work',
        '#status',
        {
          sources: visits,
          pan: { ...actualBounds, far, start, fit: { width: fit.width, height: fit.height } },
        },
      );

      const textVisits = [];
      for (const source of texts) {
        const observed = observedTexts.get(source.id),
          text = decodeText(observed.bytes);
        opener = await open(source);
        const pre = region.querySelector('pre');
        assert(
          pre?.textContent === text && pre.children.length === 0 && region.children.length === 1,
          'Document is not the complete inert original text.',
        );
        const readingBounds = await textReading();
        await close(opener);
        opener = await open(source);
        assert(
          region.querySelector('pre').textContent === text && region.scrollTop <= 1 && !reading(),
          'Document reopening retained earlier content or reader state.',
        );
        await close(opener, true);
        textVisits.push({
          id: source.id,
          path: source.path,
          ...observed.pin,
          lines: text.split('\n').length,
          ...readingBounds,
        });
      }
      const language = $('[data-language-select]'),
        beforeCancel = snapshot(win.localStorage),
        titleBeforeCancel = $('h1').textContent;
      await p.choose('[data-language-select]');
      await p.pulse(initialLocale === 'en' ? 'down' : 'up');
      await p.pulse('back');
      assert(
        language.value === initialLocale &&
          doc.documentElement.lang === initialLocale &&
          $('h1').textContent === titleBeforeCancel &&
          doc.activeElement === language &&
          same(beforeCancel, snapshot(win.localStorage)),
        'Canceled language draft changed the study or lost its selector.',
      );
      const localeVisits = [];
      explicitLocaleChoice = true;
      for (const locale of ['uk', 'en', ...(initialLocale === 'uk' ? ['uk'] : [])]) {
        await p.select('[data-language-select]', locale);
        await p.wait(() => doc.documentElement.lang === locale);
        const copy = copies.get(locale);
        assert(
          $('h1').textContent.trim() === copy['fpvEnemySourceReview.heading'],
          'Study heading trails its locale.',
        );
        const loaded = copy['fpvEnemySourceReview.loaded']
          .replace('{{frames}}', format(locale, 57))
          .replace('{{ratio}}', format(locale, win.devicePixelRatio));
        assert(
          $('#status').dataset.state === 'ready' && $('#status').textContent === loaded,
          'Ready study status trails its actual state or locale.',
        );
        const measurements = JSON.parse(decodeText(observedTexts.get('inspection').bytes));
        for (const row of measurements.images) {
          const expected = copy['fpvEnemySourceReview.metric']
            .replace(
              '{{width}}',
              format(locale, Number((row.substantialWidthFraction * 100).toFixed(1))),
            )
            .replace('{{colors}}', format(locale, row.actualVisibleRGBColorsAlpha128))
            .replace('{{transparent}}', format(locale, row.alpha.zero));
          assert(
            $(`#grid .metric[data-type="${row.type}"]`).textContent === expected,
            `Displayed retained measurements trail the ${locale} locale or source: ${row.type}.`,
          );
        }
        for (const [type, key] of roles) {
          const expected = copy[`fpvEnemySourceReview.roles.${key}`];
          assert(
            $(`#fpv-enemy-${type}`).textContent.trim() === expected &&
              [...$('#role').options].find(({ value }) => value === type).textContent === expected,
            'A role heading or selector option trails its locale.',
          );
        }
        for (const source of [images[0], ...texts]) {
          opener = await open(source);
          const title = label(source, locale),
            readName = locale === 'uk' ? 'Читати й прокручувати' : 'Read and scroll',
            status = copy.revealSourceReady.replace('{{bytes}}', format(locale, source.bytes));
          assert(
            read.getAttribute('aria-label') === `${readName}: ${title}` &&
              $('#reveal-source-status').textContent === status,
            'Source reader name or ready status trails its locale.',
          );
          if (source.kind === 'image')
            assert(
              region.querySelector('img').alt === title,
              'Image alternative text trails its source title.',
            );
          else
            assert(
              region.querySelector('pre').textContent ===
                decodeText(observedTexts.get(source.id).bytes),
              'Locale changed original source-document bytes.',
            );
          await enterRead();
          await stopRead();
          await close(opener);
        }
        localeVisits.push({
          locale,
          title: $('h1').textContent.trim(),
          roles: [...$('#role').options].map((option) => option.textContent),
        });
      }
      assert(
        doc.documentElement.lang === initialLocale && same(currentControls(), initialControls),
        'Visible locale or study controls were not restored.',
      );
      for (const [file, pin] of metadata)
        assert(
          same((await observe(`/${root}${file}`)).pin, pin),
          `Source viewing changed ${file}.`,
        );
      unchanged();
      p.record(
        'Exact README and inspection JSON stay literal through bounded reading, Start/End, reopening and EN/UK source labels; canceled language editing changes nothing and initial visible state is restored',
        '#status',
        {
          sources: textVisits,
          locales: localeVisits,
          metadata: [...metadata].map(([path, pin]) => ({ path, ...pin })),
          boundary:
            'Source-language documents, source pixels, retained measurements and provenance are unchanged. Only explicit locale selection can persist its preference. Source controls do not Save, import, approve, export or adopt artwork. CSS headings/sizes and decoded source files do not establish gameplay, collision, animation, physical pixel size or device acceptance. Network failures and timed cancellation are not injected.',
        },
      );

      const returnSelector = '.authoring-reference-rail > a',
        returnURL = new URL($(returnSelector).href),
        galleryLocal = snapshot(win.localStorage),
        gallerySession = snapshot(win.sessionStorage);
      assert(
        returnURL.pathname === '/authoring/asset-studio/' &&
          returnURL.origin === win.location.origin,
        'Direct-entry source study does not return to its real Asset Studio owner.',
      );
      await p.follow(returnSelector, '/authoring/asset-studio/');
      await p.wait(
        () =>
          p.doc.querySelector('.authoring-input-rail') && p.doc.querySelector('#save-workspace'),
        30000,
      );
      assert(
        p.doc !== doc &&
          clicks.filter((row) => !row.prevented).length === 1 &&
          clicks.at(-1).href === returnURL.href,
        'Return did not load exactly the real Asset Studio destination.',
      );
      p.record(
        'The reference Return action loads real Asset Studio; no editor action follows arrival',
        'h1',
        {
          gallery: href,
          destination: win.location.href,
          parentStartupStorage: {
            local: delta(galleryLocal, snapshot(win.localStorage)),
            session: delta(gallerySession, snapshot(win.sessionStorage)),
          },
          boundary:
            'No reciprocal FPV source-study link was established in Asset Studio, so reentry is not claimed. Parent startup is outside read-only source-study storage acceptance. No editor draft inspection, save/import, source adoption, gameplay, OS download, installed-offline or physical-controller qualification.',
        },
      );
    } finally {
      doc.removeEventListener('click', onClick, true);
    }
  },
];
