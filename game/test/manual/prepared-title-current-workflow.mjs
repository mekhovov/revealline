// Static source comparison qualification. Actions use the real virtual pad;
// byte, DOM, decode, geometry and storage access are observation only.
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const localeKey = 'revealline.locale.v1';
const manifestPin = {
  id: 'manifest',
  kind: 'text',
  path: 'authoring/library/fpv-field-kit/prepared-scenes-v2.json',
  bytes: 8116,
  sha256: '199c8b23990af731377560e0f70f1469338ed68239986a47bd852f91dcbbac55',
};
const snapshot = (storage) =>
  Array.from({ length: storage.length }, (_, index) => storage.key(index))
    .sort()
    .map((key) => [key, storage.getItem(key)]);
async function pinned(source, url = `/${source.path}`) {
  const response = await fetch(url, { cache: 'no-store' });
  assert(response.ok, `Cannot observe ${source.path}.`);
  const bytes = await response.arrayBuffer(),
    pin = {
      bytes: bytes.byteLength,
      sha256: [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join(''),
    };
  assert(
    pin.bytes === source.bytes && pin.sha256 === source.sha256,
    `Displayed bytes differ from the preserved ${source.id} pin.`,
  );
  return { bytes, pin };
}

export const preparedTitleCurrent = [
  'Current prepared titles: four exact images, literal manifest, bounded readers and real return',
  '/authoring/library/fpv-field-kit/prepared/titles/review.html',
  async (p) => {
    const doc = p.doc,
      win = doc.defaultView,
      $ = (selector) => doc.querySelector(selector);
    assert(
      win.location.port === '9009' && ['localhost', '127.0.0.1'].includes(win.location.hostname),
      'Use isolated prepared-title qualification origin 9009.',
    );
    await p.wait(
      () =>
        $('.authoring-reference-read') &&
        $('#reveal-source-dialog') &&
        $('#title-language-select') &&
        $('#title-source-manifest'),
      30000,
    );
    await doc.fonts.ready;
    const manifestBytes = await pinned(manifestPin),
      manifestText = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
        manifestBytes.bytes,
      ),
      manifest = JSON.parse(manifestText),
      images = [
        ['landscape-v1', 'title-hangar-v2', 'previous'],
        ['landscape-v2', 'title-hangar-v2', 'output'],
        ['portrait-v1', 'title-hangar-portrait-v2', 'previous'],
        ['portrait-v2', 'title-hangar-portrait-v2', 'output'],
      ].map(([id, recordId, field]) => ({
        ...manifest.records.find((record) => record.id === recordId)?.[field],
        id,
        kind: 'image',
      })),
      sources = [...images, manifestPin],
      dialog = $('#reveal-source-dialog'),
      region = $('#reveal-source-region'),
      read = $('#reveal-read-source'),
      initialLocale = doc.documentElement.lang,
      beforeLocal = snapshot(win.localStorage),
      beforeSession = snapshot(win.sessionStorage),
      href = win.location.href,
      historyLength = win.history.length,
      figures = [...doc.querySelectorAll('main figure')],
      comparison = $('#title-reveal-comparison'),
      comparisonHref = comparison?.getAttribute('href'),
      openers = sources.map((source) => ({
        source,
        element: $(`#title-source-${source.id}`),
        href: $(`#title-source-${source.id}`)?.getAttribute('href'),
      })),
      clicks = [],
      viewport = { width: win.innerWidth, height: win.innerHeight };
    let localeChosen = false;
    assert(['en', 'uk'].includes(initialLocale), 'Unsupported initial comparison locale.');
    assert(
      manifest.format === 'revealline-prepared-scenes.v2' &&
        manifest.records.length === 2 &&
        figures.length === 4 &&
        images.reduce((sum, source) => sum + source.bytes, 0) === 1706455 &&
        images.every((source) => source.width && source.height && source.sha256),
      'The preserved four-source title inventory changed.',
    );
    assert(comparisonHref === '../reveals/review.html', 'The existing comparison link changed.');
    const onClick = (event) => {
      const link = event.target.closest?.('a[href]');
      if (!link) return;
      queueMicrotask(() =>
        clicks.push({
          id: link.id,
          prevented: event.defaultPrevented,
          download: link.hasAttribute('download'),
        }),
      );
    };
    doc.addEventListener('click', onClick, true);
    const unchanged = () => {
      assert(
        p.doc === doc && win.location.href === href && win.history.length === historyLength,
        'Source viewing navigated away from the comparison.',
      );
      assert(
        figures.length === doc.querySelectorAll('main figure').length &&
          figures.every((figure, index) => figure === doc.querySelectorAll('main figure')[index]) &&
          comparison.isConnected &&
          comparison.getAttribute('href') === comparisonHref &&
          openers.every(
            ({ source, element, href: previous }) =>
              element?.isConnected &&
              element.getAttribute('href') === previous &&
              new URL(element.href).pathname === `/${source.path}`,
          ),
        'Source viewing replaced a comparison record or rewrote a destination.',
      );
      const permitted = (entries) => entries.filter(([key]) => !localeChosen || key !== localeKey);
      assert(
        same(permitted(beforeLocal), permitted(snapshot(win.localStorage))) &&
          same(beforeSession, snapshot(win.sessionStorage)),
        'Read-only comparison changed unrelated origin storage.',
      );
      assert(
        clicks.every(
          (click) =>
            sources.some((source) => click.id === `title-source-${source.id}`) &&
            click.prevented &&
            !click.download,
        ),
        'Viewing triggered raw source navigation or a download.',
      );
    };
    const reading = () => read.getAttribute('aria-pressed') === 'true';
    const geometry = () => ({
      client: [region.clientWidth, region.clientHeight],
      maxX: Math.max(0, region.scrollWidth - region.clientWidth),
      maxY: Math.max(0, region.scrollHeight - region.clientHeight),
    });
    const enterRead = async () => {
      await p.choose('#reveal-read-source');
      assert(reading(), 'Read did not acquire the visible source.');
    };
    const exitRead = async (command = 'back') => {
      await p.pulse(command);
      assert(
        dialog.open && !reading() && doc.activeElement === read,
        'Reader exit did not preserve the modal and exact Read action.',
      );
    };
    const open = async (source) => {
      if (source.kind === 'image') {
        await p.section(`#title-${source.id}`);
        assert(
          doc.activeElement === $(`#title-source-${source.id}`) && !dialog.open,
          'Sections did not focus its source without activating it.',
        );
      } else await p.pageActions();
      const opener = $(`#title-source-${source.id}`);
      await p.choose(`#title-source-${source.id}`);
      await p.wait(() => dialog.open && dialog.dataset.state === 'ready', 30000);
      assert(
        dialog.dataset.path === source.path &&
          dialog.dataset.kind === source.kind &&
          doc.activeElement === $('#reveal-source-close') &&
          !reading() &&
          region.scrollTop <= 1 &&
          region.scrollLeft <= 1,
        'Source open selected another file or retained an earlier reader/focus/position.',
      );
      unchanged();
      return opener;
    };
    const close = async (opener) => {
      assert(!reading(), 'Reader must exit before modal Back.');
      await p.pulse('back');
      await p.wait(() => !dialog.open);
      assert(
        doc.activeElement === opener && region.children.length === 0 && !reading(),
        'Modal Back failed to restore its exact source or retained content.',
      );
      unchanged();
    };
    const decode = async (source) => {
      const image = region.querySelector('img'),
        url = image?.currentSrc || image?.src;
      assert(url?.startsWith('blob:'), 'Viewer did not display the verified image Blob.');
      await image.decode();
      assert(
        image.complete &&
          image.naturalWidth === source.width &&
          image.naturalHeight === source.height,
        'Decoded image dimensions differ from historical title metadata.',
      );
      return { image, url, ...(await pinned(source, url)).pin };
    };
    const assertFit = (image) => {
      const rect = image.getBoundingClientRect();
      assert(
        rect.width <= region.clientWidth + 1 &&
          rect.height <= region.clientHeight + 1 &&
          Math.abs(rect.width / rect.height - image.naturalWidth / image.naturalHeight) < 0.01 &&
          geometry().maxX <= 1 &&
          geometry().maxY <= 1,
        'Fit does not contain the complete title with its original aspect ratio.',
      );
      return [rect.width, rect.height];
    };
    try {
      unchanged();
      const sections = [];
      for (const source of images) {
        const heading = $(`#title-${source.id}`),
          preview = heading?.closest('figure')?.querySelector('img');
        await preview?.decode();
        assert(
          preview?.naturalWidth === source.width &&
            preview?.naturalHeight === source.height &&
            preview.getAttribute('width') === String(source.width) &&
            preview.getAttribute('height') === String(source.height),
          'A fitted comparison preview lost its original dimensions or attributes.',
        );
        await p.section(`#title-${source.id}`);
        const opener = doc.activeElement;
        assert(
          opener === $(`#title-source-${source.id}`) && !dialog.open,
          'Sections did not reach the exact safe source action.',
        );
        await p.pulse('menu');
        await p.wait(() => $('.authoring-sections-dialog').open);
        await p.pulse('back');
        assert(doc.activeElement === opener && !dialog.open, 'Canceled Sections lost its opener.');
        sections.push({ id: source.id, heading: heading.textContent.trim(), focused: opener.id });
      }
      await p.pageActions();
      const language = $('#title-language-select'),
        beforeCancel = snapshot(win.localStorage),
        headingBefore = $('h1').textContent;
      assert(doc.activeElement === language, 'Page actions missed the language control.');
      await p.choose('#title-language-select');
      await p.pulse(initialLocale === 'en' ? 'down' : 'up');
      await p.pulse('back');
      assert(
        language.value === initialLocale &&
          doc.documentElement.lang === initialLocale &&
          $('h1').textContent === headingBefore &&
          doc.activeElement === language &&
          same(beforeCancel, snapshot(win.localStorage)),
        'Canceled language changed the comparison or lost its opener.',
      );
      unchanged();
      p.record(
        'Four Sections and canceled Sections focus exact source actions without opening them; fitted preview dimensions and canceled language remain unchanged',
        'h1',
        { viewport, sections, comparisonLink: comparisonHref, language: initialLocale },
      );

      const visits = [];
      for (const [index, source] of images.entries()) {
        const opener = await open(source);
        let displayed = await decode(source);
        const initialFit = assertFit(displayed.image);
        if (index === 0) {
          const previous = displayed.image;
          await p.choose('#reveal-source-retry');
          await p.wait(
            () => dialog.dataset.state === 'ready' && region.querySelector('img') !== previous,
            30000,
          );
          const retried = await decode(source);
          assert(
            doc.activeElement === $('#reveal-source-retry') && retried.url !== displayed.url,
            'Image Retry retained its previous content or took focus.',
          );
          displayed = retried;
        }
        await p.choose('#reveal-source-actual');
        const rect = displayed.image.getBoundingClientRect();
        assert(
          Math.abs(rect.width - source.width) <= 1 && Math.abs(rect.height - source.height) <= 1,
          'Actual Size does not render one CSS pixel per source pixel.',
        );
        const bounds = geometry();
        await enterRead();
        for (let n = 0; n < 80 && region.scrollLeft < bounds.maxX - 1; n++) await p.pulse('right');
        for (let n = 0; n < 80 && region.scrollTop < bounds.maxY - 1; n++) await p.pulse('down');
        assert(
          region.scrollLeft >= bounds.maxX - 1 && region.scrollTop >= bounds.maxY - 1,
          'Actual-size reader cannot reach its far edges.',
        );
        const far = [region.scrollLeft, region.scrollTop];
        for (let n = 0; n < 80 && region.scrollLeft > 1; n++) await p.pulse('left');
        for (let n = 0; n < 80 && region.scrollTop > 1; n++) await p.pulse('up');
        assert(region.scrollLeft <= 1 && region.scrollTop <= 1, 'Reader cannot return to origin.');
        await exitRead(index % 2 ? 'confirm' : 'back');
        await p.choose('#reveal-source-fit');
        const fit = assertFit(displayed.image);
        await close(opener);
        visits.push({
          id: source.id,
          path: source.path,
          bytes: displayed.bytes,
          sha256: displayed.sha256,
          width: source.width,
          height: source.height,
          initialFit,
          fit,
          actual: { ...bounds, far, start: [0, 0], scrolled: [bounds.maxX > 1, bounds.maxY > 1] },
          retried: index === 0,
        });
      }
      p.record(
        'All four displayed image Blobs match historical bytes and fully decode; Fit/Actual Size, bounded readers, Retry and two-step Back preserve each exact source',
        'h1',
        { images: visits, boundary: 'Zero-overflow axes establish containment, not panning.' },
      );

      const opener = await open(manifestPin),
        pre = region.querySelector('pre'),
        bounds = geometry();
      assert(
        pre?.textContent === manifestText && pre.children.length === 0 && bounds.maxX <= 1,
        'Manifest is not the complete literal UTF-8 document or has horizontal overflow.',
      );
      await enterRead();
      await p.pulse('down');
      if (bounds.maxY > 1) assert(region.scrollTop > 0, 'Manifest Down did not scroll.');
      const directional = region.scrollTop;
      await exitRead();
      await p.choose('#reveal-source-end');
      const end = region.scrollTop;
      assert(end >= bounds.maxY - 1, 'End missed the complete manifest.');
      await p.choose('#reveal-source-start');
      assert(region.scrollTop <= 1, 'Start missed the first manifest line.');
      await p.choose('#reveal-source-retry');
      await p.wait(
        () => dialog.dataset.state === 'ready' && region.querySelector('pre') !== pre,
        30000,
      );
      assert(
        doc.activeElement === $('#reveal-source-retry') &&
          region.querySelector('pre')?.textContent === manifestText,
        'Manifest Retry changed literal text or took focus.',
      );
      await close(opener);
      p.record(
        'The pinned 8116-byte manifest remains literal; directional reading, Start/End, real Retry and exact two-step Back pass',
        'h1',
        {
          ...manifestPin,
          lines: manifestText.split('\n').length,
          ...bounds,
          directional,
          end,
          start: 0,
        },
      );

      localeChosen = true;
      const locales = [];
      for (const locale of ['uk', 'en', ...(initialLocale === 'uk' ? ['uk'] : [])]) {
        await p.pageActions();
        await p.select('#title-language-select', locale);
        await p.wait(() => doc.documentElement.lang === locale);
        const names = [];
        for (const source of sources) {
          const opener = await open(source),
            title = $('#reveal-source-title').textContent;
          const expectedTitle =
            source.kind === 'image'
              ? $(`#title-${source.id}`).textContent.trim()
              : opener.textContent.trim();
          assert(title === expectedTitle, 'Live source title trails its named comparison.');
          if (source.kind === 'image')
            assert(
              opener.getAttribute('aria-label') === `${opener.textContent.trim()}: ${title}`,
              'Inspect accessible name does not identify its current title.',
            );
          assert(
            read.getAttribute('aria-label') ===
              `${locale === 'uk' ? 'Читати й прокручувати' : 'Read and scroll'}: ${title}`,
            'Live Read accessible name trails the current title or locale.',
          );
          if (source.kind === 'text')
            assert(
              region.querySelector('pre')?.textContent === manifestText,
              'Locale changed source JSON.',
            );
          await enterRead();
          await exitRead();
          await close(opener);
          names.push({ id: source.id, title });
        }
        locales.push({ locale, heading: $('h1').textContent.trim(), names });
      }
      assert(doc.documentElement.lang === initialLocale, 'Initial locale was not restored.');
      assert(locales[0].heading !== locales[1].heading, 'UK/EN heading did not change.');
      unchanged();
      const beforeReturn = {
        local: snapshot(win.localStorage),
        session: snapshot(win.sessionStorage),
        allowedChange: 'Only explicitly selected locale preference',
      };
      doc.removeEventListener('click', onClick, true);
      const returnSelector = '.authoring-reference-rail > a',
        destination = new URL($(returnSelector).href);
      assert(
        destination.origin === win.location.origin &&
          destination.pathname === '/authoring/asset-studio/',
        'Direct-entry Return does not target Asset Studio.',
      );
      await p.follow(returnSelector, '/authoring/asset-studio/');
      await p.wait(
        () =>
          p.doc.querySelector('.authoring-input-rail') && p.doc.querySelector('#save-workspace'),
        30000,
      );
      assert(p.doc !== doc, 'Return did not load the real authoring owner.');
      p.record(
        'Live UK/EN names remain current for all five source readers; initial locale is restored before actual Asset Studio Return',
        'h1',
        {
          locales,
          beforeReturn,
          destination: win.location.href,
          boundary:
            'Read-only static comparison; no Save/import/export, installation, artwork adoption, animation, physical-device or published acceptance. Source JSON remains original. The preserved Reveal-review link is not activated by this journey.',
        },
      );
    } finally {
      doc.removeEventListener('click', onClick, true);
    }
  },
];
