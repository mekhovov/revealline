// Read-only source-viewer qualification. Only the shared virtual-pad path
// operates application controls; byte, layout and storage reads are observers.
const assert = (value, message) => {
  if (!value) throw new Error(message);
};
const sources = Object.freeze({
  image: {
    id: 'raster-1',
    path: '/authoring/library/fpv-arcade/backgrounds/orchard-window.png',
    bytes: 3172117,
    sha256: 'e748ccee83cdb51fb9d385c626d6824d37eeef254f1684e27e54b12e42b35823',
    width: 1774,
    height: 887,
  },
  markdown: {
    id: 'audit-markdown',
    path: '/docs/fpv-reveal-art-audit.md',
    bytes: 31687,
    sha256: '0fcc973c82f2c2d1fda02835cd4735595eb6aaef7b5de0da0e8500af9ccf0bd8',
  },
  json: {
    id: 'audit-json',
    path: '/authoring/design-atlas/reveal-audit.json',
    bytes: 75088,
    sha256: 'f0952cdfaae60d8bed364a9cf2293aa036fe802a9551b55743e863712ff09eda',
  },
});
const snapshot = (storage) =>
  Array.from({ length: storage.length }, (_, index) => storage.key(index))
    .sort()
    .map((key) => [key, storage.getItem(key)]);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fingerprint = async (bytes) => ({
  bytes: bytes.byteLength,
  sha256: [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join(''),
});
async function readPinnedSource(source, url = source.path) {
  const response = await fetch(url, { cache: 'no-store' });
  assert(response.ok, `Source observation failed (${response.status}): ${source.path}.`);
  const bytes = await response.arrayBuffer(),
    pin = await fingerprint(bytes);
  assert(
    pin.bytes === source.bytes && pin.sha256 === source.sha256,
    `Observed source bytes differ from the historical pin: ${source.path}.`,
  );
  return { bytes, pin };
}

export const revealAuditSourcesCurrent = [
  'Current Reveal source viewer: exact PNG, Markdown and JSON, reading and return',
  '/authoring/design-atlas/reveal-audit.html',
  async (p) => {
    const $ = (selector) => p.doc.querySelector(selector),
      doc = p.doc,
      win = doc.defaultView;
    assert(
      win.location.port === '8997' && ['localhost', '127.0.0.1'].includes(win.location.hostname),
      'Use the dedicated local source-viewer qualification origin on port 8997.',
    );
    await p.wait(
      () =>
        $('#rasters')?.querySelectorAll(':scope > article').length === 21 &&
        $('#procedures')?.querySelectorAll(':scope > article').length === 17 &&
        $('#reveal-source-raster-1') &&
        $('#reveal-source-audit-markdown') &&
        $('#reveal-source-audit-json') &&
        $('.authoring-input-rail'),
      30000,
    );
    assert(doc.documentElement.lang.startsWith('en'), 'This bounded case requires English.');
    const href = win.location.href,
      historyLength = win.history.length,
      beforeLocal = snapshot(win.localStorage),
      beforeSession = snapshot(win.sessionStorage),
      parentArticles = [...doc.querySelectorAll('#rasters > article, #procedures > article')],
      parentDetails = [...doc.querySelectorAll('details')].map((element) => ({
        element,
        open: element.open,
      })),
      downloadClicks = [];
    const observeClick = (event) => {
      const link = event.target.closest?.('a[download]');
      if (link) downloadClicks.push({ name: link.download, href: link.href });
    };
    doc.addEventListener('click', observeClick, true);
    const unchanged = () => {
      assert(p.doc === doc && win.location.href === href, 'Viewer navigated away from its owner.');
      assert(win.history.length === historyLength, 'Viewer changed browser history.');
      const current = [...doc.querySelectorAll('#rasters > article, #procedures > article')];
      assert(
        current.length === parentArticles.length &&
          current.every((article, index) => article === parentArticles[index]),
        'Viewing a source replaced the published historical review.',
      );
      for (const { element, open } of parentDetails)
        assert(element.isConnected && element.open === open, 'Viewer changed a parent disclosure.');
      assert(same(beforeLocal, snapshot(win.localStorage)), 'Viewer changed local storage.');
      assert(same(beforeSession, snapshot(win.sessionStorage)), 'Viewer changed session storage.');
      assert(downloadClicks.length === 0, 'Read-only viewing dispatched a download action.');
    };
    const dialog = () => $('#reveal-source-dialog'),
      region = () => $('#reveal-source-region'),
      readButton = () => $('#reveal-read-source'),
      reading = () => readButton()?.getAttribute('aria-pressed') === 'true',
      ready = (kind) =>
        dialog()?.open &&
        dialog().dataset.state === 'ready' &&
        readButton()?.disabled === false &&
        (kind === 'image'
          ? region()?.querySelector('img')?.complete &&
            region().querySelector('img').naturalWidth > 0
          : !!region()?.querySelector('pre'));
    const open = async (source) => {
      const selector = `#reveal-source-${source.id}`,
        opener = $(selector);
      assert(opener, `Missing original source control: ${selector}.`);
      if (opener.href)
        assert(
          new URL(opener.href).pathname === source.path,
          'Original source destination changed.',
        );
      await p.choose(selector);
      await p.wait(() => dialog()?.open, 10000);
      unchanged();
      assert(
        dialog().dataset.path === source.path.slice(1),
        'Viewer selected a different source path.',
      );
      assert(
        dialog().dataset.kind === (source.width ? 'image' : 'text'),
        'Viewer selected an unexpected content kind.',
      );
      assert(dialog().contains(doc.activeElement), 'Viewer did not take its modal input scope.');
      return opener;
    };
    const waitReady = async (kind) => {
      try {
        await p.wait(() => ready(kind), 30000);
      } catch (error) {
        throw new Error(`${error.message}: ${$('#reveal-source-status')?.textContent || 'viewer'}`);
      }
      assert(
        $('#reveal-source-status')?.dataset.error !== 'true',
        'Viewer reports a source error.',
      );
      assert(p.visible(region()), 'Ready source is not visibly laid out.');
      unchanged();
    };
    const close = async (opener, action = 'back') => {
      assert(!reading(), 'End reading before requesting modal Back.');
      if (action === 'back') await p.pulse('back');
      else await p.choose('#reveal-source-close');
      await p.wait(() => !dialog().open);
      assert(doc.activeElement === opener, 'Closing the source lost its exact initiating control.');
      assert(
        region().children.length === 0 && !reading(),
        'Closed source kept its content or input owner.',
      );
      unchanged();
    };
    const enterReading = async () => {
      await p.choose('#reveal-read-source');
      assert(reading(), 'Read source did not enter its owned surface.');
    };
    const endReading = async (command = 'back') => {
      await p.pulse(command);
      assert(
        !reading() && dialog().open,
        'Ending source reading also closed or retained the reader.',
      );
      assert(doc.activeElement === readButton(), 'Reader exit lost its exact Read control.');
    };
    const dimensions = () => ({
      width: region().clientWidth,
      height: region().clientHeight,
      maxX: Math.max(0, region().scrollWidth - region().clientWidth),
      maxY: Math.max(0, region().scrollHeight - region().clientHeight),
    });
    const imagePan = async () => {
      await enterReading();
      const bounds = dimensions();
      assert(bounds.maxX > 1 && bounds.maxY > 1, 'Actual-size PNG did not expose both pan axes.');
      for (let n = 0; n < 80 && region().scrollLeft < bounds.maxX - 1; n++) await p.pulse('right');
      for (let n = 0; n < 80 && region().scrollTop < bounds.maxY - 1; n++) await p.pulse('down');
      assert(
        region().scrollLeft >= bounds.maxX - 1 && region().scrollTop >= bounds.maxY - 1,
        'The PNG far edges are not controller reachable.',
      );
      const end = [region().scrollLeft, region().scrollTop];
      for (let n = 0; n < 80 && region().scrollLeft > 1; n++) await p.pulse('left');
      for (let n = 0; n < 80 && region().scrollTop > 1; n++) await p.pulse('up');
      assert(
        region().scrollLeft <= 1 && region().scrollTop <= 1,
        'PNG pan could not return to origin.',
      );
      await endReading();
      return { ...bounds, end, start: [region().scrollLeft, region().scrollTop] };
    };
    const textRead = async () => {
      const bounds = dimensions();
      assert(bounds.width > 0 && bounds.height > 0, 'Text region has no readable area.');
      assert(bounds.maxX <= 1, 'Wrapped source has inaccessible horizontal overflow.');
      assert(bounds.maxY > 1, 'Long source unexpectedly has no scrollable text.');
      await enterReading();
      const initial = region().scrollTop;
      await p.pulse('down');
      assert(region().scrollTop > initial, 'Text reader Down did not scroll.');
      await p.pulse('up');
      assert(region().scrollTop <= initial + 1, 'Text reader Up did not restore its start.');
      await endReading();
      // These are actual accessible controls, not synthesized Home/End keys or
      // a direct scroll write. They keep a 1,990-line JSON inspection bounded.
      await p.choose('#reveal-source-end');
      assert(region().scrollTop >= bounds.maxY - 1, 'End of source was not reachable.');
      const end = region().scrollTop;
      assert(dialog().contains(doc.activeElement), 'End of source lost modal focus.');
      await enterReading();
      await p.pulse('up');
      assert(region().scrollTop < end, 'Reader could not leave the end of source.');
      await p.pulse('down');
      assert(region().scrollTop >= bounds.maxY - 1, 'Reader could not regain the last text.');
      await endReading('confirm');
      await p.choose('#reveal-source-start');
      assert(region().scrollTop <= 1, 'Start of source was not reachable.');
      assert(dialog().contains(doc.activeElement), 'Start of source lost modal focus.');
      return { ...bounds, end, start: region().scrollTop, endsViaRealControls: true };
    };
    try {
      const imageSource = sources.image;
      let opener = await open(imageSource);
      const firstClose = dialog().dataset.state;
      assert(
        ['loading', 'ready'].includes(firstClose),
        'Initial source open failed before its close check.',
      );
      await close(opener);
      opener = await open(imageSource);
      await waitReady('image');
      const image = region().querySelector('img'),
        imageURL = image.currentSrc || image.src;
      assert(imageURL.startsWith('blob:'), 'Viewer is not displaying its verified original Blob.');
      await image.decode();
      assert(
        image.naturalWidth === imageSource.width && image.naturalHeight === imageSource.height,
        'Decoded original dimensions differ from the historical pin.',
      );
      const verifiedImage = await readPinnedSource(imageSource, imageURL);
      await p.choose('#reveal-source-actual');
      const actualRect = image.getBoundingClientRect();
      assert(
        Math.abs(actualRect.width - imageSource.width) <= 1 &&
          Math.abs(actualRect.height - imageSource.height) <= 1,
        'Actual size did not render native PNG dimensions.',
      );
      const pan = await imagePan();
      await p.choose('#reveal-source-fit');
      const fitRect = image.getBoundingClientRect();
      assert(
        fitRect.width <= region().clientWidth + 1 && fitRect.height <= region().clientHeight + 1,
        'Fit did not contain the complete original in its visible region.',
      );
      assert(
        image === region().querySelector('img') && image.src === imageURL,
        'Image sizing replaced source bytes.',
      );
      await enterReading();
      await endReading('confirm');
      await close(opener, 'close');
      p.record(
        'Pinned PNG decoded; actual-size two-axis pan, Fit and both viewer exits restore the original control without navigation',
        '#status',
        {
          source: { ...imageSource, ...verifiedImage.pin },
          firstClose,
          pan,
          fit: { width: fitRect.width, height: fitRect.height },
          boundary:
            'The first close records whether loading or readiness was observed before Back; this does not qualify a controlled delayed-network cancellation.',
        },
      );

      for (const [kind, source] of [
        ['markdown', sources.markdown],
        ['json', sources.json],
      ]) {
        const observed = await readPinnedSource(source),
          text = new TextDecoder('utf-8', { fatal: true }).decode(observed.bytes);
        opener = await open(source);
        await waitReady('text');
        const pre = region().querySelector('pre');
        assert(pre.textContent === text, `${kind} viewer changed the exact UTF-8 source text.`);
        assert(pre.children.length === 0, `${kind} source was interpreted as active markup.`);
        if (kind === 'json') {
          const value = JSON.parse(pre.textContent);
          assert(
            value.counts.fpvOwners === 56 &&
              value.images.length === 21 &&
              value.procedural.length === 17,
            'Historical JSON record identity changed.',
          );
        }
        const metrics = await textRead();
        await close(opener);
        opener = await open(source);
        await waitReady('text');
        assert(
          region().querySelector('pre').textContent === text,
          'Reopened source changed its content.',
        );
        assert(
          region().scrollTop <= 1 && !reading(),
          'Reopened source retained an earlier reading position or owner.',
        );
        await close(opener, 'close');
        p.record(
          `Exact ${kind} source stays inert and complete; bounded reading and Start/End work, modal Back and explicit Close restore the source opener`,
          '#status',
          {
            source: { ...source, ...observed.pin, lines: text.split('\n').length },
            reading: metrics,
            unchanged: {
              document: true,
              url: true,
              history: true,
              parentArticles: parentArticles.length,
              localKeys: beforeLocal.length,
              sessionKeys: beforeSession.length,
            },
            boundary:
              'Read-only source viewing. No Save/import/export, OS download, injected network fault, rewritten historical source or physical-device qualification.',
          },
        );
      }
    } finally {
      doc.removeEventListener('click', observeClick, true);
    }
  },
];
