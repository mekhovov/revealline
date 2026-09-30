// Guide qualification only: shared standard-pad commands operate the page.
// Source/DOM/storage reads observe results; they never invoke an app handler.
import { CONTENT_DRAFT_DATABASE } from '../../content-design/drafts.mjs';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const sections = ['automatic', 'meaning', 'try', 'picture', 'campaign', 'recover', 'more'];
const localeKey = 'revealline.locale.v1';
const snapshot = (store) =>
  Array.from({ length: store.length }, (_, index) => store.key(index))
    .sort()
    .map((key) => [key, store.getItem(key)]);
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const changes = (before, after) => {
  const old = new Map(before),
    next = new Map(after);
  return {
    added: [...next.keys()].filter((key) => !old.has(key)),
    changed: [...old.keys()].filter((key) => next.has(key) && next.get(key) !== old.get(key)),
    removed: [...old.keys()].filter((key) => !next.has(key)),
  };
};
const rawMarkdown = [
  'image-campaign-guide.md',
  'phase1-acceptance.md',
  'batch-image-campaign-guide.md',
  'phase2-acceptance.md',
  'creator-guide.md',
  'framework-reference.md',
  'media-editor-guide.md',
  'maintainer-guide.md',
  'README.md',
  'delivery-plan.md',
];
const exampleDownloads = ['examples/two-crossings.expansion.json', 'example-project.json'];
async function readDrafts(win) {
  assert(
    typeof win.indexedDB.databases === 'function',
    'Read-only draft enumeration is unavailable.',
  );
  const databases = await win.indexedDB.databases();
  if (!databases.some(({ name }) => name === CONTENT_DRAFT_DATABASE))
    return { exists: false, heads: [], revisions: [] };
  const db = await new Promise((resolve, reject) => {
    const request = win.indexedDB.open(CONTENT_DRAFT_DATABASE);
    request.onupgradeneeded = () => {
      request.transaction.abort();
      reject(new Error('The read-only observer must not create or upgrade the Studio database.'));
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(['heads', 'revisions'], 'readonly'),
        output = { exists: true };
      for (const name of ['heads', 'revisions']) {
        const store = transaction.objectStore(name),
          keys = store.getAllKeys(),
          values = store.getAll();
        values.onsuccess = () => {
          output[name] = keys.result.map((key, index) => [key, values.result[index]]);
        };
      }
      transaction.oncomplete = () => resolve(JSON.parse(JSON.stringify(output)));
      transaction.onerror = transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export const creatorGuideCurrent = [
  'Current Creator Guide: seven sections, bounded reading, language cancellation and real return',
  '/authoring/community/index.html',
  async (p) => {
    const $ = (selector) => p.doc.querySelector(selector),
      win = p.doc.defaultView;
    assert(
      win.location.port === '8998' && ['localhost', '127.0.0.1'].includes(win.location.hostname),
      'Use the isolated Creator Guide qualification origin on port 8998.',
    );
    const ready = async () => {
      await p.wait(
        () =>
          $('.authoring-reference-read') &&
          $('#creator-guide-return') &&
          $('[data-language-select]') &&
          sections.every((id) => $(`#creator-guide-read-${id}`)?.hasAttribute('aria-pressed')),
        30000,
      );
      assert(
        same(
          [...p.doc.querySelectorAll('main section > h2')].map((node) => node.id),
          sections,
        ),
        'The guide section inventory changed; review the intended qualification scope.',
      );
    };
    await ready();
    const initialDocument = p.doc,
      initialURL = win.location.href,
      initialHistory = win.history.length,
      initialLocale = p.doc.documentElement.lang,
      beforeLocal = snapshot(win.localStorage),
      beforeSession = snapshot(win.sessionStorage),
      beforeDrafts = await readDrafts(win),
      downloadAllocations = p.downloads.length,
      clicks = [],
      removers = [];
    assert(['en', 'uk'].includes(initialLocale), 'Unsupported initial guide locale.');
    const observeLinks = (doc) => {
      const onClick = (event) => {
        const link = event.target?.closest?.('a[href]');
        if (!link) return;
        const row = { document: doc.URL, href: link.href, download: link.hasAttribute('download') };
        queueMicrotask(() => clicks.push({ ...row, prevented: event.defaultPrevented }));
      };
      doc.addEventListener('click', onClick, true);
      removers.push(() => doc.removeEventListener('click', onClick, true));
    };
    observeLinks(p.doc);
    const destinations = () =>
      [...p.doc.querySelectorAll('main a[href]')].map((link) => ({
        href: link.getAttribute('href'),
        download: link.hasAttribute('download'),
      }));
    const originalDestinations = destinations();
    const verifyDestinations = () => {
      const links = [...p.doc.querySelectorAll('main a[href]')];
      assert(
        same(
          links
            .filter((link) => link.getAttribute('href').endsWith('.md'))
            .map((link) => link.getAttribute('href')),
          rawMarkdown,
        ),
        'The ten raw documentation destinations changed.',
      );
      assert(
        same(
          links
            .filter((link) => link.hasAttribute('download'))
            .map((link) => link.getAttribute('href')),
          exampleDownloads,
        ),
        'The two static example download destinations changed.',
      );
      assert(
        same(destinations(), originalDestinations),
        'Reading or translation rewrote a guide link.',
      );
    };
    const verifyNoHandoff = () => {
      assert(
        p.doc === initialDocument && win.location.href === initialURL,
        'Guide-only interaction navigated or changed the fragment.',
      );
      assert(
        win.history.length === initialHistory,
        'Guide-only interaction added browser history.',
      );
      assert(
        clicks.every((row) => {
          const url = new URL(row.href);
          return (
            !row.download &&
            url.pathname === new URL(initialURL).pathname &&
            url.hash &&
            row.prevented
          );
        }),
        'A guide-only stage activated an outbound link or example download.',
      );
      assert(
        p.downloads.length === downloadAllocations,
        'The read-only guide allocated an export.',
      );
      verifyDestinations();
    };
    const verifyGuideStorage = () => {
      assert(
        same(
          beforeLocal.filter(([key]) => key !== localeKey),
          snapshot(win.localStorage).filter(([key]) => key !== localeKey),
        ),
        'Guide-only interaction changed an unrelated local-storage value.',
      );
      assert(
        same(beforeSession, snapshot(win.sessionStorage)),
        'Guide-only interaction changed session storage.',
      );
    };
    const inactive = (id) => {
      assert(
        $(`#creator-guide-${id}-region`).dataset.controllerReading !== 'true',
        `Section ${id} unexpectedly entered reading.`,
      );
      assert(
        $(`#creator-guide-read-${id}`).getAttribute('aria-pressed') === 'false',
        `Section ${id} retains a reading indicator.`,
      );
    };
    const readSection = async (id, exit) => {
      const button = $(`#creator-guide-read-${id}`),
        region = $(`#creator-guide-${id}-region`);
      await p.choose(`#creator-guide-read-${id}`);
      await p.wait(
        () =>
          region.dataset.controllerReading === 'true' &&
          button.getAttribute('aria-pressed') === 'true',
      );
      const maxX = Math.max(0, region.scrollWidth - region.clientWidth),
        maxY = Math.max(0, region.scrollHeight - region.clientHeight),
        step = Math.min(48, Math.max(1, Math.floor(region.clientHeight / 2))),
        budget = Math.ceil(maxY / step) + 2;
      assert(maxX <= 1, `Section ${id} has unqualified horizontal text overflow.`);
      assert(budget <= 600, `Section ${id} exceeded the bounded reader budget.`);
      for (let n = 0; n < budget && region.scrollTop < maxY - 1; n++) await p.pulse('down');
      assert(region.scrollTop >= maxY - 1, `Section ${id} cannot reach its final text.`);
      const end = region.scrollTop;
      for (let n = 0; n < budget && region.scrollTop > 1; n++) await p.pulse('up');
      assert(region.scrollTop <= 1, `Section ${id} cannot return to its first text.`);
      await p.pulse(exit);
      await p.wait(() => button.getAttribute('aria-pressed') === 'false');
      inactive(id);
      assert(p.doc.activeElement === button, `Section ${id} lost its exact reading opener.`);
      return {
        id,
        width: region.clientWidth,
        height: region.clientHeight,
        maxX,
        maxY,
        end,
        start: region.scrollTop,
        exit,
        scrolled: maxY > 1,
      };
    };
    const readPage = async (exit) => {
      const button = $('.authoring-reference-read');
      await p.choose('.authoring-reference-read');
      assert(button.getAttribute('aria-pressed') === 'true', 'Whole-page reader did not enter.');
      const page = p.doc.scrollingElement,
        max = Math.max(0, page.scrollHeight - page.clientHeight),
        step = Math.max(80, Math.round(win.innerHeight * 0.6)),
        budget = Math.ceil(max / step) + 3;
      assert(budget <= 100, 'Guide page exceeded its bounded scroll allowance.');
      for (let n = 0; n < budget && page.scrollTop < max - 1; n++) await p.pulse('down');
      assert(page.scrollTop >= max - 1, 'Whole-page reader cannot reach the footer.');
      const end = page.scrollTop;
      for (let n = 0; n < budget && page.scrollTop > 1; n++) await p.pulse('up');
      assert(page.scrollTop <= 1, 'Whole-page reader cannot return to the header.');
      await p.pulse(exit);
      assert(
        button.getAttribute('aria-pressed') === 'false' && p.doc.activeElement === button,
        'Whole-page reader did not restore its exact entry.',
      );
      return { maxY: max, end, start: page.scrollTop, step, exit, scrolled: max > 1 };
    };
    try {
      verifyDestinations();
      await p.navigate('#creator-guide-read-automatic');
      const beforeCancel = p.doc.activeElement;
      await p.pulse('menu');
      await p.wait(() => $('.authoring-sections-dialog')?.open);
      assert(
        $('.authoring-sections-dialog button:nth-of-type(1)') === p.doc.activeElement,
        'Sections did not default to its Back control.',
      );
      await p.pulse('back');
      assert(
        !$('.authoring-sections-dialog').open && p.doc.activeElement === beforeCancel,
        'Canceled Sections lost the exact previous control.',
      );
      const visited = [];
      for (const id of sections) {
        await p.section(`#${id}`);
        assert(
          p.doc.activeElement === $(`#creator-guide-read-${id}`),
          `Sections did not focus the safe ${id} Read entry.`,
        );
        inactive(id);
        await p.choose(`#creator-guide-contents-${id}`);
        assert(
          p.doc.activeElement === $(`#creator-guide-read-${id}`),
          `Contents did not focus the ${id} Read entry.`,
        );
        inactive(id);
        visited.push({
          id,
          heading: $(`#${id}`).textContent.trim(),
          focused: p.doc.activeElement.id,
        });
      }
      verifyNoHandoff();
      verifyGuideStorage();
      p.record(
        'All seven Sections and contents destinations focus their exact inactive Read controls; canceled Sections preserves focus without activating documentation or downloads',
        'h1',
        { sections: visited, destinations: originalDestinations },
      );

      const readers = [];
      for (let index = 0; index < sections.length; index++)
        readers.push(await readSection(sections[index], index % 2 ? 'confirm' : 'back'));
      const wholePage = [await readPage('back'), await readPage('confirm')];
      verifyNoHandoff();
      verifyGuideStorage();
      p.record(
        'All seven bounded readers and the shared whole-page reader reach actual endpoints and restore exact entries through Back or Confirm',
        'h1',
        { readers, wholePage },
      );

      const catalogues = await Promise.all(
        ['en', 'uk'].map(async (locale) => {
          const response = await fetch(`/game/locales/${locale}/tools.json`, { cache: 'no-store' });
          assert(response.ok, `Cannot inspect authoritative ${locale} guide labels.`);
          return [locale, await response.json()];
        }),
      );
      const copy = new Map(catalogues),
        language = $('[data-language-select]'),
        headingBeforeCancel = $('h1').textContent,
        localBeforeCancel = snapshot(win.localStorage);
      await p.choose('[data-language-select]');
      await p.pulse(initialLocale === 'en' ? 'down' : 'up');
      await p.pulse('back');
      assert(
        language.value === initialLocale &&
          p.doc.documentElement.lang === initialLocale &&
          $('h1').textContent === headingBeforeCancel,
        'Canceled language draft changed the guide language.',
      );
      assert(
        same(localBeforeCancel, snapshot(win.localStorage)),
        'Canceled language draft persisted a preference.',
      );
      assert(p.doc.activeElement === language, 'Canceled language draft lost its select.');
      const locales = [];
      for (const locale of ['uk', 'en', ...(initialLocale === 'uk' ? ['uk'] : [])]) {
        await p.select('[data-language-select]', locale);
        await p.wait(() => p.doc.documentElement.lang === locale && language.value === locale);
        for (const element of [$('h1'), ...sections.map((id) => $(`#${id}`))]) {
          const key = element.dataset.i18n.replace(/^tools:/, '');
          assert(
            element.textContent.trim() === copy.get(locale)[key],
            `Incorrect ${locale} guide label: ${key}.`,
          );
        }
        const readName = locale === 'uk' ? 'Читати й прокручувати' : 'Read and scroll';
        for (const id of sections) {
          assert(
            $(`#creator-guide-read-${id}`).getAttribute('aria-label') ===
              `${readName}: ${$(`#${id}`).textContent.trim()}`,
            `Section ${id} reader name trails its ${locale} heading.`,
          );
        }
        assert(
          $('.authoring-reference-read').textContent.trim() === readName,
          'Whole-page reader label did not follow the locale.',
        );
        await p.pulse('menu');
        await p.wait(() => $('.authoring-sections-dialog').open);
        const sectionNames = [...$('.authoring-sections-dialog').querySelectorAll('button')]
          .slice(2)
          .map((node) => node.textContent.trim());
        assert(
          same(
            sectionNames,
            sections.map((id) => $(`#${id}`).textContent.trim()),
          ),
          'Sections contains stale translated heading names.',
        );
        await p.pulse('back');
        assert(
          p.doc.activeElement === language,
          'Localized Sections cancellation lost the language select.',
        );
        verifyNoHandoff();
        verifyGuideStorage();
        locales.push({
          locale,
          title: $('h1').textContent.trim(),
          sections: sectionNames,
          reader: readName,
        });
      }
      assert(
        p.doc.documentElement.lang === initialLocale,
        'The original visible locale was not restored.',
      );
      const guideLocal = snapshot(win.localStorage),
        guideSession = snapshot(win.sessionStorage);
      p.record(
        'Canceled language editing leaves content and storage unchanged; real EN/UK choices update headings and reader/Sections names, then restore the initial visible language',
        'h1',
        {
          locales,
          initialLocale,
          storage: {
            local: changes(beforeLocal, guideLocal),
            session: changes(beforeSession, guideSession),
          },
          boundary:
            'Only explicit language choices may persist revealline.locale.v1; an initially absent preference can become explicit. The fixture never writes storage to erase that user action.',
        },
      );

      // Content Studio is the actual parent; its ordinary startup may create
      // its initial checkpoint. Observe that separately from guide-only reads.
      const returnURL = new URL($('#creator-guide-return').href);
      assert(
        returnURL.pathname === '/game/studio/' && !returnURL.search,
        'Direct Creator Guide return does not identify its real Content Studio parent.',
      );
      await p.follow('#creator-guide-return', '/game/studio/');
      await p.wait(
        () =>
          p.doc.documentElement.dataset.toolState === 'ready' &&
          $('.authoring-input-rail') &&
          $('.community-guide > summary'),
        30000,
      );
      const savedPrefix = copy.get(initialLocale)['studio.storage.saved'].split('{{revision}}')[0];
      await p.wait(
        () =>
          $('#status').textContent.startsWith(savedPrefix) &&
          /[1-9]\d*/.test($('#status').textContent),
        15000,
      );
      const studio = {
          url: win.location.href,
          projectId: $('#project-id').value,
          status: $('#status').textContent.trim(),
          sourceId: JSON.parse($('#source').value).id,
        },
        afterDrafts = await readDrafts(win);
      assert(
        studio.projectId === studio.sourceId,
        'Studio displayed a different project identity from its source.',
      );
      for (const name of ['heads', 'revisions']) {
        const current = new Map(afterDrafts[name]),
          prior = new Map(beforeDrafts[name]);
        for (const [key, value] of prior)
          assert(
            current.has(key) && same(current.get(key), value),
            `Parent return changed an existing Studio ${name} record: ${key}.`,
          );
        for (const [key, value] of current)
          if (!prior.has(key))
            assert(
              name === 'heads' ? key === studio.projectId : value.projectId === studio.projectId,
              `Parent return created an unrelated Studio ${name} record: ${key}.`,
            );
      }
      assert(
        afterDrafts.heads.some(
          ([key, value]) => key === studio.projectId && Number.isSafeInteger(value) && value > 0,
        ),
        'Studio did not report its actual saved checkpoint.',
      );
      observeLinks(p.doc);
      await p.expand('.community-guide');
      await p.follow(
        '.community-guide a[href="../../authoring/community/"]',
        '/authoring/community/',
      );
      await ready();
      observeLinks(p.doc);
      assert(p.doc !== initialDocument, 'Guide reentry did not load a real fresh document.');
      assert(
        p.doc.documentElement.lang === initialLocale,
        'Guide reentry lost the restored locale.',
      );
      assert(
        $('#creator-guide-return').href === studio.url,
        'Reentered guide did not preserve its exact same-origin Studio referrer.',
      );
      for (const id of sections) inactive(id);
      assert(
        $('.authoring-reference-read').getAttribute('aria-pressed') !== 'true',
        'Reentry retained old page-reader ownership.',
      );
      verifyDestinations();
      assert(
        !clicks.some((row) => row.download || new URL(row.href).pathname.endsWith('.md')),
        'The reader workflow activated a raw-document handoff or static example download.',
      );
      const handoffs = clicks.filter((row) => !row.prevented);
      assert(
        handoffs.length === 2 &&
          handoffs[0].href === returnURL.href &&
          new URL(handoffs[1].href).pathname === '/authoring/community/',
        'The guide workflow activated an unexpected outbound destination.',
      );
      assert(
        p.downloads.length === downloadAllocations,
        'The reader/return workflow allocated an export.',
      );
      assert(
        same(afterDrafts, await readDrafts(win)),
        'Guide reentry changed the parent checkpoint.',
      );
      const newDraftRows = Object.fromEntries(
        ['heads', 'revisions'].map((name) => {
          const oldKeys = new Set(beforeDrafts[name].map(([key]) => key));
          return [name, afterDrafts[name].filter(([key]) => !oldKeys.has(key)).map(([key]) => key)];
        }),
      );
      p.record(
        'Real Content Studio return and its existing guide disclosure/link reopen a fresh guide with inactive readers and the restored locale; all older drafts survive and any initial parent checkpoint is reported separately',
        'h1',
        {
          returnURL: returnURL.href,
          studio,
          drafts: {
            previousHeads: beforeDrafts.heads.length,
            previousRevisions: beforeDrafts.revisions.length,
            currentHeads: afterDrafts.heads.length,
            currentRevisions: afterDrafts.revisions.length,
            newRows: newDraftRows,
            previousRowsPreserved: true,
          },
          guideURL: win.location.href,
          rawMarkdownLinks: rawMarkdown,
          exampleDownloads,
          activatedLinks: clicks,
          storageAfterStudioReturn: {
            local: changes(guideLocal, snapshot(win.localStorage)),
            session: changes(guideSession, snapshot(win.sessionStorage)),
          },
          boundary:
            'Guide reading is separate from Community account/catalog and Studio editing acceptance. No Save/import/export/validation or OS download was activated. Content Studio can autosave its initial project on ordinary startup; new checkpoint rows are reported and retained, not falsely labeled storage-free. Raw Markdown handoffs, downloaded examples, physical controllers and offline/publication remain separate.',
        },
      );
    } finally {
      removers.forEach((remove) => remove());
    }
  },
];
