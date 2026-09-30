// Application actions use only the shared virtual pad. Fetches, hashes, image
// decoding, DOM geometry and storage snapshots are read-only observations.
import {
  RESERVE_MANIFEST,
  RESERVE_README,
} from '../../../authoring/library/reserve-illustrations-catalog/sources.mjs';

const assert = (value, message) => {
  if (!value) throw new Error(message);
};
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const localeKey = 'revealline.locale.v1';
const themes = ['fpv', 'ukraine', 'retro', 'coupa'];
const snapshot = (storage) =>
  Array.from({ length: storage.length }, (_, index) => storage.key(index))
    .sort()
    .map((key) => [key, storage.getItem(key)]);
const fingerprint = async (bytes) => ({
  bytes: bytes.byteLength,
  sha256: [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join(''),
});
const text = (bytes) => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
async function pinned(file, url = `/${file.path}`) {
  const response = await fetch(url, { cache: 'no-store' });
  assert(response.ok, `Cannot observe reserve source: ${file.path}.`);
  const bytes = await response.arrayBuffer(),
    pin = await fingerprint(bytes);
  assert(
    pin.bytes === file.bytes && pin.sha256 === file.sha256,
    `Reserve source differs from its pinned bytes: ${file.path}.`,
  );
  return { bytes, pin };
}

export const reserveCatalogCurrent = [
  'Current Reserve catalog: forty verified originals, source readers, exact Back and download',
  '/authoring/library/reserve-illustrations-catalog/index.html',
  async (p) => {
    const doc = p.doc,
      win = doc.defaultView,
      $ = (selector) => doc.querySelector(selector);
    assert(
      win.location.port === '9004' && ['localhost', '127.0.0.1'].includes(win.location.hostname),
      'Use the isolated ordinary Reserve qualification origin on port 9004.',
    );
    await p.wait(
      () =>
        $('#catalog-status')?.dataset.state === 'ready' &&
        $('#image-slot img') &&
        $('#reveal-source-dialog') &&
        $('.authoring-reference-read') &&
        $('[data-language-select]'),
      30000,
    );
    await doc.fonts.ready;
    const manifestBytes = await pinned(RESERVE_MANIFEST),
      manifest = JSON.parse(text(manifestBytes.bytes)),
      entries = manifest.entries,
      initialId = $('#selection').value,
      initialTheme = $('#theme').value,
      initialLocale = doc.documentElement.lang,
      href = win.location.href,
      historyLength = win.history.length,
      beforeLocal = snapshot(win.localStorage),
      beforeSession = snapshot(win.sessionStorage),
      dialog = $('#reveal-source-dialog'),
      region = $('#reveal-source-region'),
      read = $('#reveal-read-source'),
      clicks = [];
    let explicitLocaleChoice = false;
    assert(
      entries.length === 40 &&
        manifest.selectedOriginalBytes === 92797189 &&
        manifest.excludedRetainedOriginals.length === 2 &&
        ['en', 'uk'].includes(initialLocale),
      'The historical forty-work inventory or qualification locale changed.',
    );
    const onClick = (event) => {
      const link = event.target.closest?.('a[href]');
      if (!link) return;
      queueMicrotask(() =>
        clicks.push({
          id: link.id,
          href: link.href,
          download: link.hasAttribute('download'),
          prevented: event.defaultPrevented,
        }),
      );
    };
    doc.addEventListener('click', onClick, true);
    const unchanged = () => {
      assert(
        p.doc === doc && win.location.href === href && win.history.length === historyLength,
        'Read-only source inspection navigated the catalog or changed history.',
      );
      assert(
        same(
          beforeLocal.filter(([key]) => !explicitLocaleChoice || key !== localeKey),
          snapshot(win.localStorage).filter(([key]) => !explicitLocaleChoice || key !== localeKey),
        ) && same(beforeSession, snapshot(win.sessionStorage)),
        'Read-only catalog actions changed unrelated origin storage.',
      );
      assert(
        clicks.every((row) => row.prevented || (row.id === 'download' && row.download)),
        'Source inspection dispatched unowned raw navigation.',
      );
      assert(
        $('#image-slot').querySelectorAll('img').length === 1,
        'More than one original is mounted.',
      );
    };
    const ready = async (id = $('#selection').value) => {
      await p.wait(
        () =>
          $('#catalog-status').dataset.state === 'ready' &&
          $('#selection').value === id &&
          !$('#image-read').disabled &&
          $('#image-slot img')?.complete,
        30000,
      );
    };
    const chooseEntry = async (entry) => {
      await p.select('#selection', entry.id);
      await ready(entry.id);
      assert(
        $('#title').textContent === entry.title &&
          $('#sha').textContent === entry.original.sha256 &&
          $('#blob').textContent === entry.original.gitBlob &&
          $('#path').textContent === entry.original.path,
        'Selected title and source identity disagree.',
      );
    };
    const decodeImage = async (entry, image) => {
      const url = image.currentSrc || image.src;
      assert(url.startsWith('blob:'), 'The original is not the verified displayed Blob.');
      await image.decode();
      assert(
        image.complete && image.naturalWidth === 1774 && image.naturalHeight === 887,
        'A displayed original did not fully decode to the recorded dimensions.',
      );
      const { pin } = await pinned(entry.original, url);
      return { ...pin, width: image.naturalWidth, height: image.naturalHeight };
    };
    const reading = () => read.getAttribute('aria-pressed') === 'true';
    const enterRead = async () => {
      await p.choose('#reveal-read-source');
      assert(reading(), 'The source reader did not acquire its region.');
    };
    const stopRead = async (command = 'back') => {
      await p.pulse(command);
      assert(
        dialog.open && !reading() && doc.activeElement === read,
        'Reader exit lost the current modal or its exact Read action.',
      );
    };
    const open = async (id, file, kind = 'text') => {
      const opener = $(`#${id}`);
      assert(opener && !opener.hidden, `Source action ${id} is unavailable.`);
      await p.choose(`#${id}`);
      await p.wait(() => dialog.open && dialog.dataset.state === 'ready', 30000);
      assert(
        dialog.dataset.path === file.path &&
          dialog.dataset.kind === kind &&
          doc.activeElement === $('#reveal-source-close') &&
          !reading() &&
          region.scrollTop <= 1 &&
          region.scrollLeft <= 1,
        'Source open lost the pinned identity, initial focus or clean reading position.',
      );
      unchanged();
      return opener;
    };
    const close = async (opener) => {
      assert(!reading(), 'Stop the reader before closing its modal.');
      await p.pulse('back');
      await p.wait(() => !dialog.open);
      assert(
        doc.activeElement === opener && region.children.length === 0,
        'Modal Back lost its exact opener or retained content.',
      );
      unchanged();
    };
    const bounds = () => ({
      width: region.clientWidth,
      height: region.clientHeight,
      maxX: Math.max(0, region.scrollWidth - region.clientWidth),
      maxY: Math.max(0, region.scrollHeight - region.clientHeight),
    });
    try {
      await p.select('#theme', 'all');
      await ready();
      const imageVisits = [];
      for (const entry of entries) {
        await chooseEntry(entry);
        const image = $('#image-slot img'),
          pin = await decodeImage(entry, image);
        assert(
          $('#download').href === image.src &&
            $('#download').download === entry.original.path.split('/').at(-1),
          'Download does not preserve the current verified original.',
        );
        unchanged();
        imageVisits.push({ id: entry.id, path: entry.original.path, ...pin });
      }
      assert(
        imageVisits.reduce((sum, file) => sum + file.bytes, 0) === manifest.selectedOriginalBytes,
        'The full displayed image inventory has a different total byte count.',
      );
      p.record(
        'All forty illustrations are selected through the shared controller editor; every displayed Blob matches historical bytes/SHA and fully decodes to 1774 × 887',
        '#catalog-status',
        {
          sources: imageVisits,
          totalOriginalBytes: manifest.selectedOriginalBytes,
          boundary:
            'The fixture observes current source originals; it does not install art, adopt it into gameplay or measure memory/performance. The runner retains Blob observations independently of the one-image product surface.',
        },
      );

      const canceled = [];
      for (const id of ['theme', 'selection']) {
        const select = $(`#${id}`),
          value = select.value,
          image = $('#image-slot img'),
          selected = $('#selection').value;
        await p.choose(`#${id}`);
        await p.pulse(select.selectedIndex < select.options.length - 1 ? 'down' : 'up');
        await p.pulse('back');
        assert(
          select.value === value &&
            $('#selection').value === selected &&
            $('#image-slot img') === image &&
            doc.activeElement === select,
          `Canceled ${id} changed the selected illustration or lost its selector.`,
        );
        canceled.push(id);
      }
      const filterVisits = [];
      for (const theme of themes) {
        await p.select('#theme', theme);
        await ready();
        const ids = [...$('#selection').options].map(({ value }) => value),
          expected = entries.filter((entry) => entry.themeId === theme).map(({ id }) => id);
        assert(ids.length === 10 && same(ids, expected), 'Theme filtering lost its ten originals.');
        filterVisits.push({ theme, ids, selected: $('#selection').value });
      }
      await p.select('#theme', 'all');
      await ready();
      const representative = entries.find((entry) => entry.prompts.length === 2);
      assert(representative, 'The cleanup-prompt example is missing.');
      await chooseEntry(representative);
      const selectedIndex = entries.indexOf(representative);
      if (selectedIndex < entries.length - 1) {
        await p.choose('#next');
        await ready(entries[selectedIndex + 1].id);
        await p.choose('#previous');
        await ready(representative.id);
      }
      const beforeRetry = $('#image-slot img');
      await p.choose('#reserve-retry');
      await ready(representative.id);
      assert(
        $('#theme').value === 'all' &&
          doc.activeElement === $('#reserve-retry') &&
          $('#image-slot img') !== beforeRetry,
        'Real catalog Retry lost its selection, fresh image or owned focus.',
      );
      const sections = [];
      for (const [heading, target] of [
        ['#chooser-title', 'theme'],
        ['#title', 'image-read'],
        ['#identity-title', 'identity-toggle'],
      ]) {
        await p.section(heading);
        assert(
          doc.activeElement.id === target && !dialog.open,
          'Section focus activated or missed its target.',
        );
        await p.pulse('menu');
        await p.wait(() => $('.authoring-sections-dialog').open);
        await p.pulse('back');
        assert(doc.activeElement.id === target, 'Canceled Sections lost its exact target.');
        sections.push({ heading, target });
      }
      const details = $('#identity-toggle').parentElement;
      if (!details.open) await p.choose('#identity-toggle');
      assert(details.open, 'Source identity cannot expand through the controller.');
      await p.choose('#identity-toggle');
      assert(!details.open, 'Source identity cannot close through the controller.');
      await p.pageActions();
      assert(doc.activeElement === $('[data-language-select]'), 'Page actions missed Language.');
      unchanged();
      p.record(
        'Four ten-work theme filters, canceled selector drafts, Previous/Next, Retry and three stable Sections preserve exact selection and owned focus',
        '#catalog-status',
        {
          canceled,
          filters: filterVisits,
          sections,
          retry: { selected: representative.id, focus: 'reserve-retry' },
        },
      );

      let opener = await open('image-read', representative.original, 'image');
      const displayed = region.querySelector('img'),
        imagePin = await decodeImage(representative, displayed),
        displayURL = displayed.src;
      await p.choose('#reveal-source-actual');
      const actualRect = displayed.getBoundingClientRect(),
        actual = bounds();
      assert(
        Math.abs(actualRect.width - 1774) <= 1 &&
          Math.abs(actualRect.height - 887) <= 1 &&
          actual.maxX > 1 &&
          actual.maxY > 1,
        'Actual-size original does not expose a bounded two-axis region.',
      );
      await enterRead();
      for (let n = 0; n < 60 && region.scrollLeft < actual.maxX - 1; n++) await p.pulse('right');
      for (let n = 0; n < 60 && region.scrollTop < actual.maxY - 1; n++) await p.pulse('down');
      assert(
        region.scrollLeft >= actual.maxX - 1 && region.scrollTop >= actual.maxY - 1,
        'Original far edges cannot be reached.',
      );
      const far = [region.scrollLeft, region.scrollTop];
      for (let n = 0; n < 60 && region.scrollLeft > 1; n++) await p.pulse('left');
      for (let n = 0; n < 60 && region.scrollTop > 1; n++) await p.pulse('up');
      assert(
        region.scrollLeft <= 1 && region.scrollTop <= 1,
        'Original reader cannot return to zero.',
      );
      await stopRead();
      await p.choose('#reveal-source-fit');
      const fit = displayed.getBoundingClientRect();
      assert(
        fit.width <= region.clientWidth + 1 &&
          fit.height <= region.clientHeight + 1 &&
          displayed.src === displayURL,
        'Fit does not contain the same complete original.',
      );
      await close(opener);
      const documentSources = [
        ['prompt', representative.prompts[0]],
        ['cleanup', representative.prompts[1]],
        ['provenance', representative.provenance],
        ['notes', representative.notes],
        ['catalog-manifest', RESERVE_MANIFEST],
        ['catalog-readme', RESERVE_README],
      ];
      const documentVisits = [];
      for (const [id, file] of documentSources) {
        const observed = await pinned(file),
          expected = text(observed.bytes);
        opener = await open(id, file);
        const pre = region.querySelector('pre'),
          limits = bounds();
        assert(
          pre?.textContent === expected &&
            pre.children.length === 0 &&
            region.children.length === 1,
          'Source document is not complete inert original text.',
        );
        assert(limits.maxX <= 1, 'Literal source text overflows horizontally.');
        await enterRead();
        await p.pulse('down');
        assert(
          limits.maxY <= 1 || region.scrollTop > 0,
          'Source Down did not scroll overflowing text.',
        );
        await p.pulse('up');
        assert(region.scrollTop <= 1, 'Source Up did not return to its start.');
        await stopRead();
        await p.choose('#reveal-source-end');
        const end = region.scrollTop;
        assert(end >= limits.maxY - 1, 'End did not reach the complete source.');
        await p.choose('#reveal-source-start');
        assert(region.scrollTop <= 1, 'Start did not return to the first source line.');
        if (id === 'catalog-readme') {
          await p.choose('#reveal-source-retry');
          await p.wait(
            () => dialog.dataset.state === 'ready' && region.querySelector('pre') !== pre,
            30000,
          );
          assert(
            doc.activeElement === $('#reveal-source-retry') &&
              region.querySelector('pre').textContent === expected,
            'Source Retry changed original text or focus.',
          );
        }
        await enterRead();
        await stopRead('confirm');
        await close(opener);
        documentVisits.push({
          id,
          path: file.path,
          ...observed.pin,
          lines: expected.split('\n').length,
          ...limits,
          end,
          start: 0,
        });
      }
      p.record(
        'Original Inspect supports actual-size pan, Fit and exact two-step Back; six source types remain byte-exact literal text through bounded reading, Start/End and Retry',
        '#catalog-status',
        {
          image: {
            ...imagePin,
            ...actual,
            far,
            start: [0, 0],
            fit: { width: fit.width, height: fit.height },
          },
          documents: documentVisits,
        },
      );

      const copies = new Map(
        await Promise.all(
          ['en', 'uk'].map(async (locale) => {
            const response = await fetch(`/game/locales/${locale}/tools.json`, {
              cache: 'no-store',
            });
            assert(response.ok, 'Cannot observe authoritative locale labels.');
            return [locale, await response.json()];
          }),
        ),
      );
      const beforeCancel = snapshot(win.localStorage),
        language = $('[data-language-select]');
      await p.choose('[data-language-select]');
      await p.pulse(initialLocale === 'en' ? 'down' : 'up');
      await p.pulse('back');
      assert(
        language.value === initialLocale &&
          doc.documentElement.lang === initialLocale &&
          same(beforeCancel, snapshot(win.localStorage)) &&
          doc.activeElement === language,
        'Canceled language changed the catalog or lost its selector.',
      );
      explicitLocaleChoice = true;
      const localeVisits = [];
      for (const locale of ['uk', 'en', ...(initialLocale === 'uk' ? ['uk'] : [])]) {
        await p.select('[data-language-select]', locale);
        await p.wait(() => doc.documentElement.lang === locale);
        const copy = copies.get(locale);
        for (const node of doc.querySelectorAll('[data-i18n^="tools:reserveCatalog."]')) {
          // The operation label keeps its initial loading annotation but owns a
          // live status binding after loading, checked separately below.
          if (node.closest('#catalog-status')) continue;
          const key = node.dataset.i18n.slice('tools:'.length),
            expected = copy[key];
          assert(typeof expected === 'string', `Missing ${locale} catalog label ${key}.`);
          if (!expected.includes('{{'))
            assert(node.textContent === expected, `Live ${key} label trails its locale.`);
        }
        assert(
          $('#catalog-status .operation-status-label').textContent === copy['reserveCatalog.ready'],
          'Ready status trails the selected locale.',
        );
        opener = await open('catalog-readme', RESERVE_README);
        const title = $('#reveal-source-title').textContent,
          readerName = locale === 'uk' ? 'Читати й прокручувати' : 'Read and scroll';
        assert(
          title.startsWith(copy['reserveCatalog.readme']) &&
            read.getAttribute('aria-label') === `${readerName}: ${title}`,
          'Localized source title/Read name trails the actual locale.',
        );
        await enterRead();
        await stopRead();
        await close(opener);
        localeVisits.push({
          locale,
          title: $('h1').textContent,
          reader: title,
          inspect: $('#image-read').getAttribute('aria-label'),
        });
      }
      await p.select('#theme', initialTheme);
      await ready();
      await chooseEntry(entries.find((entry) => entry.id === initialId));
      assert(
        doc.documentElement.lang === initialLocale,
        'Initial visible locale was not restored.',
      );
      const download = $('#download'),
        downloadPin = await pinned(
          entries.find((entry) => entry.id === initialId).original,
          download.href,
        );
      await p.choose('#download');
      await p.wait(() =>
        clicks.some((row) => row.id === 'download' && row.download && !row.prevented),
      );
      unchanged();
      const returnSelector = '.authoring-reference-rail > a',
        returnURL = new URL($(returnSelector).href);
      assert(
        returnURL.origin === win.location.origin &&
          returnURL.pathname === '/authoring/asset-studio/',
        'Ordinary catalog Return lost the reference host contract.',
      );
      const downloadName = download.download;
      await p.follow(returnSelector, '/authoring/asset-studio/');
      await p.wait(
        () =>
          p.doc.querySelector('.authoring-input-rail') && p.doc.querySelector('#save-workspace'),
        30000,
      );
      assert(p.doc !== doc, 'Reference Return did not load the actual Asset Studio document.');
      p.record(
        'Live UK/EN labels and canceled language preserve source identity; original PNG Download is explicitly activated with exact prepared bytes, and real reference Return loads Asset Studio',
        'h1',
        {
          locales: localeVisits,
          download: { filename: downloadName, ...downloadPin.pin, activated: true },
          returnURL: returnURL.href,
          restored: { selection: initialId, theme: initialTheme, locale: initialLocale },
          boundary:
            'Download activation and exact prepared Blob are not OS receipt. No editor action follows the actual Studio arrival; parent startup is outside catalog storage acceptance. No Save/import/adoption, translated source prose, controlled faults, sparse-server return, installed offline, physical-controller or performance acceptance. Sparse behavior and actual OS files require separate native qualification.',
        },
      );
    } finally {
      doc.removeEventListener('click', onClick, true);
    }
  },
];
