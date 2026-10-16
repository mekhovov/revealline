// Source-only gallery qualification. Application actions use the shared standard
// virtual pad; fetch, decode, geometry and storage operations only observe.
import { COUNTERCURRENT_SOURCES } from '../../../authoring/library/countercurrent-art/sources.mjs';

const assert = (value, message) => {
  if (!value) throw new Error(message);
};
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const root = 'authoring/library/countercurrent-art/';
const themes = ['fpv', 'ukraine', 'retro', 'coupa'];
const slots = ['offset-docks', 'sandbar-braid', 'crossing-watch'];
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
  assert(response.ok, `Cannot observe gallery source: ${url}.`);
  const bytes = await response.arrayBuffer();
  return { bytes, pin: await fingerprint(bytes) };
}
async function pinned(source, url = `/${source.path}`) {
  const result = await observe(url);
  assert(
    result.pin.bytes === source.bytes && result.pin.sha256 === source.sha256,
    `Displayed source differs from the declared original: ${source.id}.`,
  );
  return result;
}

export const countercurrentGalleryCurrent = [
  'Current Countercurrent gallery: twelve originals, guide reading, exact Back and real return',
  '/authoring/library/countercurrent-art/index.html',
  async (p) => {
    const doc = p.doc,
      win = doc.defaultView,
      $ = (selector) => doc.querySelector(selector);
    assert(
      win.location.port === '9000' && ['localhost', '127.0.0.1'].includes(win.location.hostname),
      'Use the isolated Countercurrent qualification origin on port 9000.',
    );
    await p.wait(
      () =>
        $('.authoring-reference-read') &&
        $('#reveal-source-dialog') &&
        $('#countercurrent-source-guide') &&
        themes.every((theme) => $(`#countercurrent-${theme}`)),
      30000,
    );
    const images = COUNTERCURRENT_SOURCES.filter((source) => source.kind === 'image'),
      guide = COUNTERCURRENT_SOURCES.find((source) => source.id === 'guide'),
      dialog = $('#reveal-source-dialog'),
      region = $('#reveal-source-region'),
      read = $('#reveal-read-source'),
      href = win.location.href,
      historyLength = win.history.length,
      initialLocale = doc.documentElement.lang,
      beforeLocal = snapshot(win.localStorage),
      beforeSession = snapshot(win.sessionStorage),
      originalFigures = [...doc.querySelectorAll('main figure')],
      originalLinks = [...doc.querySelectorAll('[data-countercurrent-source]')].map((element) => ({
        element,
        href: element.getAttribute('href'),
        source: element.dataset.countercurrentSource,
      })),
      clicks = [],
      metadata = new Map();
    let explicitLocaleChoice = false;
    assert(['en', 'uk'].includes(initialLocale), 'Unsupported initial gallery locale.');
    assert(
      same(
        images.map(({ id }) => id),
        themes.flatMap((theme) => slots.map((slot) => `${theme}-${slot}`)),
      ),
      'Countercurrent source inventory no longer matches the twelve declared cells.',
    );
    assert(
      guide?.kind === 'text' && COUNTERCURRENT_SOURCES.length === 13,
      'Expected twelve images and one guide.',
    );
    assert(
      originalFigures.length === 12 && originalLinks.length === 13,
      'Gallery visible inventory changed.',
    );
    for (const file of ['manifest.json', 'provenance.json', 'derivatives.json']) {
      const value = await observe(`/${root}${file}`);
      metadata.set(file, value.pin);
      if (file === 'manifest.json') {
        const manifest = JSON.parse(new TextDecoder().decode(value.bytes));
        for (const source of images) {
          const original = manifest.images.find(
            (entry) => `${entry.themeId}-${entry.missionSlot}` === source.id,
          );
          assert(
            original &&
              source.path === `${root}${original.path}` &&
              source.bytes === original.bytes &&
              source.sha256 === original.sha256 &&
              source.width === original.width &&
              source.height === original.height,
            'Gallery source diverges from historical manifest identity.',
          );
        }
      }
    }
    const onClick = (event) => {
      const link = event.target.closest?.('a[href]');
      if (!link) return;
      queueMicrotask(() =>
        clicks.push({
          href: link.href,
          source: link.dataset.countercurrentSource || null,
          download: link.hasAttribute('download'),
          prevented: event.defaultPrevented,
        }),
      );
    };
    doc.addEventListener('click', onClick, true);
    const unchanged = () => {
      assert(
        p.doc === doc && win.location.href === href && win.history.length === historyLength,
        'Source viewing navigated or changed gallery history.',
      );
      assert(
        originalFigures.every((figure) => figure.isConnected) &&
          originalFigures.length === doc.querySelectorAll('main figure').length,
        'Source viewing replaced gallery records.',
      );
      assert(
        originalLinks.every(
          ({ element, href: previous, source }) =>
            element.isConnected &&
            element.getAttribute('href') === previous &&
            element.dataset.countercurrentSource === source,
        ),
        'Source viewing rewrote a gallery destination.',
      );
      assert(
        same(
          beforeLocal.filter(([key]) => !explicitLocaleChoice || key !== localeKey),
          snapshot(win.localStorage).filter(([key]) => !explicitLocaleChoice || key !== localeKey),
        ) && same(beforeSession, snapshot(win.sessionStorage)),
        'Read-only gallery interaction changed origin storage.',
      );
      assert(
        clicks.every((row) => row.source && row.prevented && !row.download),
        'Viewing dispatched a raw source navigation or download.',
      );
    };
    const reading = () => read.getAttribute('aria-pressed') === 'true';
    const open = async (source) => {
      if (source.kind === 'image') await p.section(`#countercurrent-${source.id.split('-')[0]}`);
      else await p.pageActions();
      const opener = $(`#countercurrent-source-${source.id}`);
      assert(
        opener && new URL(opener.href).pathname === `/${source.path}`,
        'Original gallery link disagrees with its source path.',
      );
      await p.choose(`#countercurrent-source-${source.id}`);
      await p.wait(() => dialog.open && dialog.dataset.state === 'ready', 30000);
      assert(
        dialog.dataset.path === source.path && dialog.dataset.kind === source.kind,
        'Viewer selected another source.',
      );
      assert(
        doc.activeElement === $('#reveal-source-close'),
        'Source completion took focus from the initial Back action.',
      );
      assert(
        !reading() && region.scrollTop <= 1 && region.scrollLeft <= 1,
        'Open retained an earlier reading owner or position.',
      );
      unchanged();
      return opener;
    };
    const close = async (opener, explicit = false) => {
      assert(!reading(), 'End reading before closing its modal.');
      if (explicit) await p.choose('#reveal-source-close');
      else await p.pulse('back');
      await p.wait(() => !dialog.open);
      assert(doc.activeElement === opener, 'Modal Back did not restore the exact source opener.');
      assert(
        region.children.length === 0 && !reading(),
        'Closed viewer retained source content or input ownership.',
      );
      unchanged();
    };
    const enterRead = async () => {
      await p.choose('#reveal-read-source');
      assert(reading(), 'Read did not enter the current source reader.');
    };
    const stopRead = async (command = 'back') => {
      await p.pulse(command);
      assert(
        dialog.open && !reading() && doc.activeElement === read,
        'Reader exit failed to preserve the modal and its exact Read opener.',
      );
    };
    const decodeDisplayed = async (source) => {
      const image = region.querySelector('img'),
        url = image?.currentSrc || image?.src;
      assert(url?.startsWith('blob:'), 'The viewer is not showing its checked original Blob.');
      await image.decode();
      assert(
        image.complete &&
          image.naturalWidth === source.width &&
          image.naturalHeight === source.height,
        'Browser decode differs from declared original dimensions.',
      );
      const { pin } = await pinned(source, url);
      return { image, url, pin };
    };
    const bounds = () => ({
      width: region.clientWidth,
      height: region.clientHeight,
      maxX: Math.max(0, region.scrollWidth - region.clientWidth),
      maxY: Math.max(0, region.scrollHeight - region.clientHeight),
    });
    try {
      const destinations = [];
      for (const theme of themes) {
        await p.section(`#countercurrent-${theme}`);
        const heading = $(`#countercurrent-${theme}`),
          section = heading.closest('section');
        assert(
          section?.contains(doc.activeElement) &&
            doc.activeElement.matches('[data-countercurrent-source]'),
          'Sections did not focus a safe gallery source action.',
        );
        assert(!dialog.open, 'Section movement activated its source.');
        const opener = doc.activeElement;
        await p.pulse('menu');
        await p.wait(() => $('.authoring-sections-dialog').open);
        await p.pulse('back');
        assert(
          doc.activeElement === opener && !dialog.open,
          'Canceled Sections lost the exact gallery action.',
        );
        destinations.push({ theme, heading: heading.textContent.trim(), focused: opener.id });
      }
      await p.choose('.authoring-reference-read');
      const pageRead = $('.authoring-reference-read'),
        page = doc.scrollingElement,
        maxY = Math.max(0, page.scrollHeight - page.clientHeight),
        step = Math.max(80, Math.round(win.innerHeight * 0.6)),
        budget = Math.ceil(maxY / step) + 3;
      assert(
        pageRead.getAttribute('aria-pressed') === 'true' && budget <= 100,
        'Gallery page reader did not enter a bounded page.',
      );
      for (let n = 0; n < budget && page.scrollTop < maxY - 1; n++) await p.pulse('down');
      assert(page.scrollTop >= maxY - 1, 'Page reader cannot reach the final gallery row.');
      const end = page.scrollTop;
      for (let n = 0; n < budget && page.scrollTop > 1; n++) await p.pulse('up');
      assert(page.scrollTop <= 1, 'Page reader cannot return to the gallery heading.');
      await p.pulse('back');
      assert(
        pageRead.getAttribute('aria-pressed') === 'false' && doc.activeElement === pageRead,
        'Page reader exit lost its exact entry.',
      );
      unchanged();
      p.record(
        'All four world Sections focus a source without opening it; canceled Sections and bounded whole-page reading restore exact controls',
        'h1',
        { destinations, page: { maxY, end, start: page.scrollTop, scrolled: maxY > 1 } },
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
          assert(doc.activeElement === $('#reveal-source-retry'), 'Retry completion stole focus.');
          assert(retried.url !== displayed.url, 'Retry retained the old image URL.');
          row.retry = { ...retried.pin, newImage: true, focus: doc.activeElement.id };
        }
        await close(opener, index % 2 === 1);
        visits.push(row);
      }
      p.record(
        'Every one of the twelve original-image actions fully decodes its displayed Blob and matches historical bytes, hash and dimensions; both reader exits and exact modal return work, including a real Retry',
        'h1',
        { sources: visits },
      );

      let opener = await open(images[0]);
      const displayed = await decodeDisplayed(images[0]);
      await p.choose('#reveal-source-actual');
      const actualRect = displayed.image.getBoundingClientRect();
      assert(
        Math.abs(actualRect.width - images[0].width) <= 1 &&
          Math.abs(actualRect.height - images[0].height) <= 1,
        'Actual size does not render native image dimensions.',
      );
      const actualBounds = bounds();
      assert(
        actualBounds.maxX > 1 && actualBounds.maxY > 1,
        'Representative actual-size image has no two-axis reading surface.',
      );
      await enterRead();
      for (let n = 0; n < 80 && region.scrollLeft < actualBounds.maxX - 1; n++)
        await p.pulse('right');
      for (let n = 0; n < 80 && region.scrollTop < actualBounds.maxY - 1; n++)
        await p.pulse('down');
      assert(
        region.scrollLeft >= actualBounds.maxX - 1 && region.scrollTop >= actualBounds.maxY - 1,
        'Image far edges cannot be reached.',
      );
      const far = [region.scrollLeft, region.scrollTop];
      for (let n = 0; n < 80 && region.scrollLeft > 1; n++) await p.pulse('left');
      for (let n = 0; n < 80 && region.scrollTop > 1; n++) await p.pulse('up');
      assert(
        region.scrollLeft <= 1 && region.scrollTop <= 1,
        'Image pan cannot return to its origin.',
      );
      const panStart = [region.scrollLeft, region.scrollTop];
      await stopRead();
      await p.choose('#reveal-source-fit');
      const fit = displayed.image.getBoundingClientRect();
      assert(
        fit.width <= region.clientWidth + 1 &&
          fit.height <= region.clientHeight + 1 &&
          displayed.image.src === displayed.url,
        'Fit did not contain the same complete image.',
      );
      await close(opener);
      const expectedGuide = await pinned(guide),
        text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
          expectedGuide.bytes,
        );
      opener = await open(guide);
      const pre = region.querySelector('pre');
      assert(
        pre?.textContent === text && pre.children.length === 0 && region.children.length === 1,
        'README is not exact inert source text.',
      );
      const textBounds = bounds();
      assert(textBounds.maxX <= 1 && textBounds.maxY > 1, 'Expected long wrapped README text.');
      await enterRead();
      await p.pulse('down');
      assert(region.scrollTop > 0, 'README reader Down did not scroll.');
      await p.pulse('up');
      assert(region.scrollTop <= 1, 'README reader Up did not restore the start.');
      await stopRead();
      await p.choose('#reveal-source-end');
      const textEnd = region.scrollTop;
      assert(textEnd >= textBounds.maxY - 1, 'End of details cannot reach the complete README.');
      await enterRead();
      await p.pulse('up');
      assert(region.scrollTop < textEnd, 'README reader cannot leave its final lines.');
      await p.pulse('down');
      assert(
        region.scrollTop >= textBounds.maxY - 1,
        'README reader cannot return to its final lines.',
      );
      await stopRead('confirm');
      await p.choose('#reveal-source-start');
      assert(region.scrollTop <= 1, 'Start of details cannot return to the beginning.');
      const textStart = region.scrollTop;
      await close(opener);
      opener = await open(guide);
      assert(
        region.querySelector('pre').textContent === text && region.scrollTop <= 1 && !reading(),
        'README reopening changed content or retained old input.',
      );
      await close(opener, true);
      for (const [file, pin] of metadata)
        assert(
          same((await observe(`/${root}${file}`)).pin, pin),
          `Gallery interaction changed ${file}.`,
        );
      await p.wait(() => $('[data-language-select]'));
      const language = $('[data-language-select]'),
        localBeforeCancel = snapshot(win.localStorage),
        headingBeforeCancel = $('h1').textContent;
      await p.choose('[data-language-select]');
      await p.pulse(initialLocale === 'en' ? 'down' : 'up');
      await p.pulse('back');
      assert(
        language.value === initialLocale &&
          doc.documentElement.lang === initialLocale &&
          $('h1').textContent === headingBeforeCancel &&
          doc.activeElement === language &&
          same(localBeforeCancel, snapshot(win.localStorage)),
        'Canceled language choice changed the gallery or lost its exact selector.',
      );
      const copies = new Map(
          await Promise.all(
            ['en', 'uk'].map(async (locale) => {
              const response = await fetch(`/game/locales/${locale}/tools.json`, {
                cache: 'no-store',
              });
              assert(response.ok, `Cannot observe authoritative ${locale} gallery labels.`);
              return [locale, await response.json()];
            }),
          ),
        ),
        localeVisits = [];
      explicitLocaleChoice = true;
      for (const locale of ['uk', 'en', ...(initialLocale === 'uk' ? ['uk'] : [])]) {
        await p.select('[data-language-select]', locale);
        await p.wait(() => doc.documentElement.lang === locale);
        opener = await open(guide);
        const title = copies.get(locale).countercurrentGuideAndCaveats,
          readName = locale === 'uk' ? 'Читати й прокручувати' : 'Read and scroll',
          status = copies
            .get(locale)
            .revealSourceReady.replace(
              '{{bytes}}',
              new Intl.NumberFormat(locale, { maximumFractionDigits: 20 }).format(guide.bytes),
            );
        assert(
          $('#reveal-source-title').textContent === title &&
            read.getAttribute('aria-label') === `${readName}: ${title}` &&
            $('#reveal-source-status').textContent === status,
          'Localized guide title, reader name or ready status trails the selected locale.',
        );
        assert(
          region.querySelector('pre').textContent === text,
          'Locale changed original README text.',
        );
        await enterRead();
        await stopRead();
        await close(opener);
        opener = await open(images[0]);
        assert(
          $('#reveal-source-title').textContent === images[0].title &&
            region.querySelector('img').alt === images[0].title,
          'Locale changed the original image title.',
        );
        await close(opener);
        localeVisits.push({ locale, title, reader: readName, status });
      }
      assert(
        doc.documentElement.lang === initialLocale,
        'The initial visible locale was not restored.',
      );
      unchanged();
      p.record(
        'Actual-size original pans both axes and Fit contains the same image; exact inert README supports directional reading, Start/End, fresh reopening and two-step Back',
        'h1',
        {
          image: {
            ...actualBounds,
            far,
            start: panStart,
            fit: { width: fit.width, height: fit.height },
          },
          guide: {
            path: guide.path,
            ...expectedGuide.pin,
            lines: text.split('\n').length,
            ...textBounds,
            end: textEnd,
            start: textStart,
          },
          metadata: [...metadata].map(([path, pin]) => ({ path, ...pin })),
          locales: localeVisits,
          boundary:
            'Original candidate artwork and metadata remain unchanged. Only explicit language choices may persist the locale preference. This is viewing, not Save, import, export, runtime adoption, artwork approval or animation. Start/End are real product controls; no Home/End keyboard synthesis, fault injection or physical-controller qualification is claimed.',
        },
      );

      const returnSelector = '.authoring-reference-rail > a',
        returnLink = $(returnSelector),
        returnURL = new URL(returnLink.href);
      assert(
        returnURL.pathname === '/authoring/asset-studio/' &&
          returnURL.origin === win.location.origin,
        'Direct gallery entry does not return to its actual Asset Studio owner.',
      );
      const galleryLocal = snapshot(win.localStorage),
        gallerySession = snapshot(win.sessionStorage);
      await p.follow(returnSelector, '/authoring/asset-studio/');
      await p.wait(
        () =>
          p.doc.querySelector('.authoring-input-rail') && p.doc.querySelector('#save-workspace'),
        30000,
      );
      assert(p.doc !== doc, 'Return did not load the real Asset Studio document.');
      assert(
        clicks.filter((row) => !row.prevented).length === 1 &&
          clicks.at(-1).href === returnURL.href,
        'Return activated an unexpected outbound destination.',
      );
      p.record(
        'The real reference Return action opens Asset Studio; no editor action is issued after arrival',
        'h1',
        {
          gallery: href,
          destination: win.location.href,
          parentStartupStorage: {
            local: delta(galleryLocal, snapshot(win.localStorage)),
            session: delta(gallerySession, snapshot(win.sessionStorage)),
          },
          boundary:
            'The inspected Asset Studio exposes no reciprocal Countercurrent link, so gallery reentry is not claimed. Ordinary parent startup is outside read-only gallery storage acceptance. No editor Save, draft inspection, source adoption, runtime gameplay, OS download, full Ukrainian, offline or physical-device qualification.',
        },
      );
    } finally {
      doc.removeEventListener('click', onClick, true);
    }
  },
];
