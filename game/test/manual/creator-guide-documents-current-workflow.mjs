// Only standard virtual-pad commands operate the Guide. Source, DOM and storage
// reads observe results; a download click is not an OS-artifact validation.
import { CREATOR_GUIDE_DOCUMENTS } from '../../../authoring/community/creator-guide-documents.mjs';

const assert = (value, message) => {
  if (!value) throw new Error(message);
};
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const localeKey = 'revealline.locale.v1';
const snapshot = (store) =>
  Array.from({ length: store.length }, (_, index) => store.key(index))
    .sort()
    .map((key) => [key, store.getItem(key)]);
const fingerprint = async (bytes) => ({
  bytes: bytes.byteLength,
  sha256: [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join(''),
});
async function observeSource(source) {
  const response = await fetch(`/${source.path}`, { cache: 'no-store' });
  assert(response.ok, `Cannot observe declared Guide source: ${source.path}.`);
  const bytes = await response.arrayBuffer(),
    pin = await fingerprint(bytes);
  assert(
    pin.bytes === source.bytes && pin.sha256 === source.sha256,
    `Guide source differs from its declared pin: ${source.path}.`,
  );
  return { ...pin, text: new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) };
}
async function readyGuide(p) {
  const win = p.doc.defaultView;
  assert(
    win.location.port === '8999' && ['localhost', '127.0.0.1'].includes(win.location.hostname),
    'Use the isolated Guide-document qualification origin on port 8999.',
  );
  await p.wait(
    () =>
      p.doc.querySelector('.authoring-input-rail') &&
      p.doc.querySelector('#creator-guide-document-dialog') &&
      p.doc.querySelector('[data-language-select]') &&
      CREATOR_GUIDE_DOCUMENTS.every((source) =>
        p.doc.querySelector(`#creator-guide-document-${source.id}`),
      ),
    30000,
  );
}

export const creatorGuideDocumentsCurrent = [
  'Current Creator Guide documents: ten exact sources, bounded reading, locale and return',
  '/authoring/community/index.html',
  async (p) => {
    await readyGuide(p);
    const doc = p.doc,
      win = doc.defaultView,
      $ = (selector) => doc.querySelector(selector),
      dialog = $('#creator-guide-document-dialog'),
      region = $('#creator-guide-document-region'),
      read = $('#creator-guide-document-read'),
      href = win.location.href,
      historyLength = win.history.length,
      initialLocale = doc.documentElement.lang,
      beforeLocal = snapshot(win.localStorage),
      beforeSession = snapshot(win.sessionStorage),
      beforeDownloads = p.downloads.length,
      sections = [...doc.querySelectorAll('main section')],
      originalLinks = [...doc.querySelectorAll('main a[href]')].map((link) => ({
        element: link,
        href: link.getAttribute('href'),
        download: link.hasAttribute('download'),
      })),
      clicks = [];
    assert(['en', 'uk'].includes(initialLocale), 'Unsupported initial Guide language.');
    const observeClick = (event) => {
      const link = event.target.closest?.('a[href]');
      if (!link) return;
      queueMicrotask(() =>
        clicks.push({
          href: link.href,
          download: link.hasAttribute('download'),
          prevented: event.defaultPrevented,
        }),
      );
    };
    doc.addEventListener('click', observeClick, true);
    const reading = () => read.getAttribute('aria-pressed') === 'true';
    const unchanged = () => {
      assert(p.doc === doc && win.location.href === href, 'Document viewing navigated the Guide.');
      assert(win.history.length === historyLength, 'Document viewing changed browser history.');
      assert(
        sections.every((section) => section.isConnected) &&
          sections.length === doc.querySelectorAll('main section').length,
        'Document viewing replaced the Guide sections.',
      );
      assert(
        originalLinks.every(
          ({ element, href: originalHref, download }) =>
            element.isConnected &&
            element.getAttribute('href') === originalHref &&
            element.hasAttribute('download') === download,
        ),
        'Viewing or translation changed a Guide destination.',
      );
      assert(
        same(
          beforeLocal.filter(([key]) => key !== localeKey),
          snapshot(win.localStorage).filter(([key]) => key !== localeKey),
        ),
        'Guide viewing changed unrelated local storage.',
      );
      assert(
        same(beforeSession, snapshot(win.sessionStorage)),
        'Guide viewing changed session storage.',
      );
      assert(p.downloads.length === beforeDownloads, 'The text viewer allocated an export.');
      assert(
        clicks.every(
          (row) => !row.download && row.prevented && new URL(row.href).pathname.endsWith('.md'),
        ),
        'Document viewing dispatched an outbound link or example download.',
      );
    };
    const observed = new Map();
    const open = async (source) => {
      const selector = `#creator-guide-document-${source.id}`,
        opener = $(selector),
        section = opener.closest('section'),
        heading = section.querySelector('h2'),
        parentRegion = opener.closest('.creator-guide-reading-region');
      assert(
        new URL(opener.href).pathname === `/${source.path}`,
        'Guide document link does not match its source identity.',
      );
      await p.section(`#${heading.id}`);
      await p.navigate(selector);
      const parentTop = parentRegion.scrollTop;
      await p.pulse('confirm');
      await p.wait(() => dialog.open && dialog.dataset.state === 'ready', 30000);
      assert(
        dialog.dataset.documentId === source.id && dialog.dataset.path === source.path,
        'Guide viewer opened another document.',
      );
      assert(
        doc.activeElement === $('#creator-guide-document-back'),
        'Source completion stole focus from the initial Back control.',
      );
      assert(
        !reading() && region.scrollTop <= 1,
        'Opening retained an earlier reader or position.',
      );
      const pre = region.querySelector('pre'),
        expected = observed.get(source.id);
      assert(pre?.textContent === expected.text, 'Source text differs from its exact UTF-8 bytes.');
      assert(
        pre.children.length === 0 && region.children.length === 1,
        'Source text was interpreted as active links or markup.',
      );
      unchanged();
      return { opener, parentRegion, parentTop };
    };
    const close = async (origin, explicit = false) => {
      assert(!reading(), 'Stop the reader before modal Back.');
      if (explicit) await p.choose('#creator-guide-document-back');
      else await p.pulse('back');
      await p.wait(() => !dialog.open);
      assert(doc.activeElement === origin.opener, 'Modal Back lost the exact source opener.');
      assert(
        region.children.length === 0 && !reading(),
        'Closed viewer retained text or reading ownership.',
      );
      assert(
        Math.abs(origin.parentRegion.scrollTop - origin.parentTop) <= 1,
        'Modal Back changed the source section reading position.',
      );
      unchanged();
    };
    const enterRead = async () => {
      await p.choose('#creator-guide-document-read');
      assert(reading(), 'Read did not enter the owned document region.');
    };
    const stopRead = async (command = 'back') => {
      await p.pulse(command);
      assert(dialog.open && !reading(), 'Reader exit also closed the modal or retained ownership.');
      assert(doc.activeElement === read, 'Reader exit lost its Read control.');
    };
    const readBounded = async () => {
      const maxY = Math.max(0, region.scrollHeight - region.clientHeight),
        maxX = Math.max(0, region.scrollWidth - region.clientWidth);
      assert(maxY > 1 && maxX <= 1, 'Expected long, horizontally wrapped Guide source.');
      await enterRead();
      await p.pulse('down');
      const down = region.scrollTop;
      assert(down > 0, 'Document reader Down did not scroll.');
      await p.pulse('up');
      assert(region.scrollTop <= 1, 'Document reader Up did not return to its start.');
      await stopRead();
      await p.choose('#creator-guide-document-end');
      const end = region.scrollTop;
      assert(end >= maxY - 1, 'End of details did not reach the complete document.');
      await enterRead();
      await p.pulse('up');
      assert(region.scrollTop < end, 'Reader cannot leave the final source lines.');
      await p.pulse('down');
      assert(region.scrollTop >= maxY - 1, 'Reader cannot regain the final source lines.');
      await stopRead('confirm');
      await p.choose('#creator-guide-document-start');
      assert(region.scrollTop <= 1, 'Start of details did not return to the first source lines.');
      return {
        maxX,
        maxY,
        width: region.clientWidth,
        height: region.clientHeight,
        down,
        end,
        start: region.scrollTop,
      };
    };
    try {
      for (const source of CREATOR_GUIDE_DOCUMENTS)
        observed.set(source.id, await observeSource(source));
      const visits = [];
      for (const [index, source] of CREATOR_GUIDE_DOCUMENTS.entries()) {
        const origin = await open(source),
          value = observed.get(source.id);
        await enterRead();
        await stopRead();
        await close(origin, index % 2 === 1);
        visits.push({
          id: source.id,
          path: source.path,
          bytes: value.bytes,
          sha256: value.sha256,
          lines: value.text.split('\n').length,
        });
      }
      p.record(
        'All ten pinned Markdown links open exact inert UTF-8 text; reader Back and modal Back remain separate and restore every exact opener',
        'h1',
        {
          sources: visits,
          sameDocument: true,
          sameHistory: true,
          sourceLinksPrevented: clicks.length,
        },
      );

      const readers = [];
      for (const source of [CREATOR_GUIDE_DOCUMENTS[0], CREATOR_GUIDE_DOCUMENTS.at(-1)]) {
        let origin = await open(source);
        readers.push({ id: source.id, ...(await readBounded()) });
        await close(origin);
        origin = await open(source);
        assert(
          region.scrollTop <= 1 && !reading(),
          'Reopening retained prior scrolling or ownership.',
        );
        await close(origin, true);
      }
      p.record(
        'Representative documents support directional reading, exact Start/End, Confirm exit and fresh reopening without retained text position',
        'h1',
        { readers },
      );

      const copies = new Map(
          await Promise.all(
            ['en', 'uk'].map(async (locale) => {
              const response = await fetch(`/game/locales/${locale}/tools.json`, {
                cache: 'no-store',
              });
              assert(response.ok, `Cannot inspect authoritative ${locale} Guide labels.`);
              return [locale, await response.json()];
            }),
          ),
        ),
        localeVisits = [];
      for (const locale of ['uk', 'en', ...(initialLocale === 'uk' ? ['uk'] : [])]) {
        await p.select('[data-language-select]', locale);
        await p.wait(() => doc.documentElement.lang === locale);
        const source = CREATOR_GUIDE_DOCUMENTS[0],
          origin = await open(source),
          copy = copies.get(locale),
          title = copy[source.titleKey.replace(/^tools:/, '')],
          status = copy['creatorGuide.documentReady'].replace(
            '{{bytes}}',
            new Intl.NumberFormat(locale, { maximumFractionDigits: 20 }).format(source.bytes),
          ),
          readName = locale === 'uk' ? 'Читати й прокручувати' : 'Read and scroll';
        assert(
          $('#creator-guide-document-title').textContent === title,
          'Viewer title trails its locale.',
        );
        assert(
          $('#creator-guide-document-status').textContent === status,
          'Viewer status trails its locale.',
        );
        assert(
          read.getAttribute('aria-label') === `${readName}: ${title}`,
          'Reader name trails its locale.',
        );
        await enterRead();
        await stopRead();
        await close(origin);
        localeVisits.push({ locale, title, status, reader: readName });
      }
      assert(
        doc.documentElement.lang === initialLocale,
        'The initial visible language was not restored.',
      );
      unchanged();
      p.record(
        'Real Ukrainian and English choices update document title, status and reader names while preserving original source bytes; the initial visible language is restored',
        'h1',
        {
          locales: localeVisits,
          localKeysBefore: beforeLocal.length,
          localKeysAfter: win.localStorage.length,
          sessionKeys: beforeSession.length,
          boundary:
            'Only explicit language choices may persist the locale preference. Guide documentation is read-only: no Save, import, domain validation, project export, source approval or OS download is activated. Source documents keep their original language. Network faults, timed cancellation, physical controllers and installed-offline availability remain separate.',
        },
      );
    } finally {
      doc.removeEventListener('click', observeClick, true);
    }
  },
];

const staticDownloadCase = (name, source, section) => [
  name,
  '/authoring/community/index.html',
  async (p) => {
    await readyGuide(p);
    const doc = p.doc,
      win = doc.defaultView,
      selector = `a[download][href="${source.path.slice('authoring/community/'.length)}"]`,
      link = doc.querySelector(selector),
      href = win.location.href,
      history = win.history.length,
      beforeLocal = snapshot(win.localStorage),
      beforeSession = snapshot(win.sessionStorage),
      beforeDownloads = p.downloads.length,
      observed = await observeSource(source),
      clicks = [];
    assert(link && !link.target, 'The original same-document download anchor is unavailable.');
    const onClick = (event) => {
      const clicked = event.target.closest?.('a[download]');
      if (!clicked) return;
      queueMicrotask(() =>
        clicks.push({
          href: clicked.href,
          download: clicked.download,
          prevented: event.defaultPrevented,
        }),
      );
    };
    doc.addEventListener('click', onClick, true);
    try {
      await p.section(`#${section}`);
      await p.choose(selector);
      assert(
        clicks.length === 1 && clicks[0].href === link.href && !clicks[0].prevented,
        'The real static download anchor was not activated exactly once.',
      );
      assert(
        p.doc === doc && win.location.href === href && win.history.length === history,
        'Download activation navigated the Guide.',
      );
      assert(
        same(beforeLocal, snapshot(win.localStorage)) &&
          same(beforeSession, snapshot(win.sessionStorage)),
        'Static download activation changed origin storage.',
      );
      assert(
        p.downloads.length === beforeDownloads,
        'Static download unexpectedly allocated a generated export.',
      );
      p.record(
        'The real static JSON download anchor was reached and activated once as the terminal controller action',
        'h1',
        {
          source: { path: source.path, bytes: observed.bytes, sha256: observed.sha256 },
          activation: clicks[0],
          foregroundAfterActivation: doc.hasFocus(),
          boundary:
            'This records the standard-pad activation and separately observed source bytes. Actual OS file receipt, exact downloaded-byte validation and production compilation are separate evidence. The fixture makes no controller import, browser installation, saved-draft or gameplay claim, and sends no further input after the browser download handoff.',
        },
      );
    } finally {
      doc.removeEventListener('click', onClick, true);
    }
  },
];

export const creatorGuidePackDownloadCurrent = staticDownloadCase(
  'Current Creator Guide: terminal expansion-example download',
  {
    path: 'authoring/community/examples/two-crossings.expansion.json',
    bytes: 6275,
    sha256: '701e53e5e1e344b5a4f4ff879f1a9a3530d6542e478ad13ebe77426636d23093',
  },
  'try',
);
export const creatorGuideProjectDownloadCurrent = staticDownloadCase(
  'Current Creator Guide: terminal Studio-example download',
  {
    path: 'authoring/community/example-project.json',
    bytes: 2649,
    sha256: 'c1c51cd83ce3a20aa1d7030951442ac60de2aa33d523ea2586b7968531e10e5a',
  },
  'campaign',
);
