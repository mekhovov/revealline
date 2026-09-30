// Browser qualification of the existing static prepared-art review. Production
// actions use the shared virtual pad; fetch/DOM/geometry only observe results.
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const root = 'authoring/library/fpv-field-kit/prepared/reveals/';
const localeKey = 'revealline.locale.v1';
const sourcePins = {
  manifest: {
    path: root + 'reveals.json',
    bytes: 266665,
    sha256: 'fc25cf8c335518bdfd2259e26cb08e99184a9cfcf0c01018063d1b928103f92b',
  },
  guide: {
    path: 'docs/field-kit-reveals.md',
    bytes: 4433,
    sha256: '1ab0e701d5b76b6453db8707ff883319a65c000bad5ec915a8c4ea727f11af0d',
  },
};
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
async function pinned(source, url = '/' + source.path) {
  const response = await fetch(url, { cache: 'no-store' });
  assert(response.ok, `Cannot observe ${source.path}.`);
  const bytes = await response.arrayBuffer(),
    pin = await fingerprint(bytes);
  assert(
    pin.bytes === source.bytes && pin.sha256 === source.sha256,
    `Observed bytes differ from the preserved pin: ${source.path}.`,
  );
  return { bytes, pin };
}
const literal = (bytes) => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
const bounds = (region) => ({
  client: [region.clientWidth, region.clientHeight],
  maxX: Math.max(0, region.scrollWidth - region.clientWidth),
  maxY: Math.max(0, region.scrollHeight - region.clientHeight),
});

export const preparedRevealCurrent = [
  'Current prepared reveals: 44 exact frames, bounded provenance/documents and unchanged-source return',
  '/authoring/library/fpv-field-kit/prepared/reveals/review.html',
  async (p) => {
    const doc = p.doc,
      win = doc.defaultView,
      $ = (selector) => doc.querySelector(selector);
    assert(
      win.location.port === '9008' && ['localhost', '127.0.0.1'].includes(win.location.hostname),
      'Use isolated prepared-reveal qualification origin 9008.',
    );
    await p.wait(
      () =>
        $('#status')?.dataset.state === 'ready' &&
        $('#inventory')?.querySelectorAll('article').length === 44 &&
        $('#reveal-source-dialog') &&
        $('#prepared-reveal-manifest-dialog') &&
        $('.authoring-reference-read'),
      30000,
    );
    await doc.fonts.ready;
    const manifestSource = await pinned(sourcePins.manifest),
      guideSource = await pinned(sourcePins.guide),
      texts = {
        manifest: literal(manifestSource.bytes),
        guide: literal(guideSource.bytes),
      },
      manifest = JSON.parse(texts.manifest),
      assets = manifest.assets,
      initialLocale = doc.documentElement.lang,
      initialLocal = snapshot(win.localStorage),
      initialSession = snapshot(win.sessionStorage),
      href = win.location.href,
      historyLength = win.history.length,
      originalCards = [...$('#inventory').querySelectorAll('article')],
      initialLinks = ['manifest', 'guide'].map((id) => ({
        element: $(`#prepared-reveal-source-${id}`),
        href: $(`#prepared-reveal-source-${id}`)?.getAttribute('href'),
      })),
      sourceClicks = [];
    let localeChosen = false;
    // Observe the actual child frame/pad and ownership transitions. This never
    // wraps the router, alters pulse timing or turns a failed step into a pass.
    const diagnostics = { frames: 0, gamepadObservations: 0, maxFrameGap: 0, events: [] };
    let diagnosticFrame = null,
      diagnosticPrevious = null,
      diagnosticSignature = null,
      diagnosticsStopped = false;
    const note = (kind, detail = {}) => {
      diagnostics.events.push({
        at: Math.round(win.performance.now() * 10) / 10,
        kind,
        focused: doc.activeElement?.id || doc.activeElement?.tagName,
        foreground: doc.hasFocus(),
        hidden: doc.hidden,
        ...detail,
      });
      if (diagnostics.events.length > 120) diagnostics.events.shift();
    };
    const sample = (time) => {
      if (diagnosticsStopped) return;
      diagnostics.frames++;
      const gap = diagnosticPrevious === null ? 0 : time - diagnosticPrevious;
      diagnosticPrevious = time;
      diagnostics.maxFrameGap = Math.max(diagnostics.maxFrameGap, gap);
      const pads = [...win.navigator.getGamepads()].filter(Boolean);
      diagnostics.gamepadObservations++;
      const buttons = pads.flatMap((pad) =>
          pad.buttons.flatMap((button, index) => (button.pressed ? [`${pad.index}:${index}`] : [])),
        ),
        active = doc.activeElement,
        state = {
          buttons,
          editing: active?.getAttribute('data-controller-editing'),
          reading: active?.getAttribute('aria-pressed'),
          dialogs: [...doc.querySelectorAll('dialog[open]')].map(
            (dialog) => dialog.id || dialog.className,
          ),
        },
        signature = JSON.stringify([active?.id, doc.hasFocus(), doc.hidden, state]);
      if (signature !== diagnosticSignature || gap > 80) note('frame', { gap, ...state });
      diagnosticSignature = signature;
      diagnosticFrame = win.requestAnimationFrame(sample);
    };
    const transitions = new win.MutationObserver((changes) => {
      for (const change of changes) {
        if (!change.target.id?.startsWith('prepared-reveal-')) continue;
        note('attribute', {
          target: change.target.id,
          attribute: change.attributeName,
          before: change.oldValue,
          after: change.target.getAttribute(change.attributeName),
        });
      }
    });
    transitions.observe(doc.body, {
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ['data-controller-pressed', 'data-controller-editing', 'aria-pressed'],
    });
    const diagnosticEvents = [
      [win, 'blur'],
      [win, 'focus'],
      [win, 'pagehide'],
      [doc, 'visibilitychange'],
      [doc, 'focusin'],
      [doc, 'focusout'],
    ].map(([target, event]) => {
      const listener = (event) =>
        note(event.type, { target: event.target?.id || event.target?.tagName });
      target.addEventListener(event, listener, true);
      return () => target.removeEventListener(event, listener, true);
    });
    diagnosticFrame = win.requestAnimationFrame(sample);
    const stopDiagnostics = () => {
      diagnosticsStopped = true;
      win.cancelAnimationFrame(diagnosticFrame);
      transitions.disconnect();
      diagnosticEvents.forEach((remove) => remove());
    };
    assert(['en', 'uk'].includes(initialLocale), 'Unsupported initial locale.');
    assert(
      same(manifest.produced, {
        compositions: 38,
        exports: 44,
        owners: 56,
        totalPNGBytes: 2083975,
      }) &&
        assets.length === 44 &&
        new Set(assets.map((asset) => asset.id)).size === 44,
      'The preserved prepared-reveal inventory changed.',
    );
    assert(
      assets.reduce((sum, asset) => sum + asset.file.bytes, 0) === 2083975,
      'Prepared PNG budget changed.',
    );
    const card = (asset) => $(`#prepared-reveal-${asset.id}`)?.closest('article'),
      id = (prefix, asset) => `#prepared-reveal-${prefix}-${asset.id}`;
    const onClick = (event) => {
      const link = event.target.closest?.('a[href]');
      if (!link) return;
      queueMicrotask(() =>
        sourceClicks.push({
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
        'Static review navigated or changed history.',
      );
      assert(
        originalCards.length === $('#inventory').querySelectorAll('article').length &&
          originalCards.every((article, index) => article === card(assets[index])),
        'Review interactions replaced or duplicated stable cards.',
      );
      assert(
        initialLinks.every(
          ({ element, href: initial }) =>
            element?.isConnected && element.getAttribute('href') === initial,
        ),
        'A pinned source action was replaced.',
      );
      const withoutLocale = (entries) =>
        entries.filter(([key]) => !localeChosen || key !== localeKey);
      assert(
        same(withoutLocale(initialLocal), withoutLocale(snapshot(win.localStorage))) &&
          same(initialSession, snapshot(win.sessionStorage)),
        'Read-only review altered unrelated origin storage.',
      );
      assert(
        sourceClicks.every(
          (click) =>
            ['prepared-reveal-source-manifest', 'prepared-reveal-source-guide'].includes(
              click.id,
            ) &&
            click.prevented &&
            !click.download,
        ),
        'A review action left the owned source surface or dispatched a download.',
      );
    };
    const enterReader = async (selector) => {
      note('reader-confirm-start', { selector });
      await p.choose(selector);
      note('reader-confirm-finished', {
        selector,
        reading: $(selector).getAttribute('aria-pressed'),
        editing: $(selector).getAttribute('data-controller-editing'),
      });
      assert(
        $(selector).getAttribute('aria-pressed') === 'true',
        `Reader did not own ${selector}.`,
      );
    };
    const exitReader = async (selector, command = 'back') => {
      await p.pulse(command);
      assert(
        doc.activeElement === $(selector) && $(selector).getAttribute('aria-pressed') === 'false',
        `Reader exit lost its exact opener: ${selector}.`,
      );
    };
    const pan = async (region) => {
      const geometry = bounds(region);
      for (let i = 0; i < 80 && region.scrollLeft < geometry.maxX - 1; i++) await p.pulse('right');
      for (let i = 0; i < 80 && region.scrollTop < geometry.maxY - 1; i++) await p.pulse('down');
      assert(
        region.scrollLeft >= geometry.maxX - 1 && region.scrollTop >= geometry.maxY - 1,
        'Bounded reader cannot reach its far edges.',
      );
      const far = [region.scrollLeft, region.scrollTop];
      for (let i = 0; i < 80 && region.scrollLeft > 1; i++) await p.pulse('left');
      for (let i = 0; i < 80 && region.scrollTop > 1; i++) await p.pulse('up');
      assert(
        region.scrollLeft <= 1 && region.scrollTop <= 1,
        'Reader cannot return to its origin.',
      );
      return { ...geometry, far, start: [region.scrollLeft, region.scrollTop] };
    };
    const decode = async (image, pin, { specimen = false } = {}) => {
      const url = image?.currentSrc || image?.src;
      assert(url?.startsWith('blob:'), 'Prepared image did not use its verified Blob.');
      await image.decode();
      assert(
        image.complete && image.naturalWidth === pin.width && image.naturalHeight === pin.height,
        'Displayed decode differs from the preserved dimensions.',
      );
      const result = await pinned(pin, url),
        rect = image.getBoundingClientRect();
      assert(
        specimen
          ? Math.abs(rect.width - 240) <= 1
          : Math.abs(rect.width - pin.width) <= 1 && Math.abs(rect.height - pin.height) <= 1,
        specimen ? 'Specimen lost its real 240px width.' : 'Native pixels no longer render at 1:1.',
      );
      return {
        ...result.pin,
        width: image.naturalWidth,
        height: image.naturalHeight,
        css: [rect.width, rect.height],
        url,
      };
    };
    const viewer = {
      dialog: $('#reveal-source-dialog'),
      region: $('#reveal-source-region'),
      read: '#reveal-read-source',
      back: '#reveal-source-close',
      retry: '#reveal-source-retry',
      start: '#reveal-source-start',
      end: '#reveal-source-end',
      title: '#reveal-source-title',
    };
    const manifestViewer = {
      dialog: $('#prepared-reveal-manifest-dialog'),
      region: $('#prepared-reveal-manifest-region'),
      ...Object.fromEntries(
        ['read', 'back', 'retry', 'start', 'end', 'title'].map((key) => [
          key,
          `#prepared-reveal-manifest-${key}`,
        ]),
      ),
    };
    const openSource = async (sourceId) => {
      await p.pageActions();
      const selector = `#prepared-reveal-source-${sourceId}`,
        opener = $(selector),
        surface = sourceId === 'manifest' ? manifestViewer : viewer;
      await p.choose(selector);
      await p.wait(() => surface.dialog.open && surface.dialog.dataset.state === 'ready', 30000);
      assert(doc.activeElement === $(surface.back), 'Ready source lost its initial Back owner.');
      assert(
        surface.region.children.length === 1 &&
          surface.region.querySelector('pre')?.textContent === texts[sourceId] &&
          surface.region.querySelector('pre').children.length === 0,
        `The ${sourceId} document did not remain full literal UTF-8 text.`,
      );
      unchanged();
      return { opener, surface };
    };
    const closeSource = async (surface, opener) => {
      await p.pulse('back');
      await p.wait(() => !surface.dialog.open);
      assert(
        doc.activeElement === opener && surface.region.children.length === 0,
        'Modal Back lost its exact opener or retained content.',
      );
      unchanged();
    };
    try {
      unchanged();
      await p.pageActions();
      assert(doc.activeElement === $('[data-language-select]'), 'Page actions missed the header.');
      const visits = [];
      for (const [index, asset] of assets.entries()) {
        await p.section(`#prepared-reveal-${asset.id}`);
        assert(
          doc.activeElement === $(id('read', asset)) &&
            !$(id('native-details', asset)).open &&
            !$(id('provenance-details', asset)).open,
          'Sections did not reach the specimen safely without opening another view.',
        );
        if ([0, 21, 43].includes(index)) {
          const opener = doc.activeElement;
          await p.pulse('menu');
          await p.wait(() => $('.authoring-sections-dialog').open);
          await p.pulse('back');
          assert(doc.activeElement === opener, 'Canceled Sections lost its exact card.');
        }
        const specimen = $(id('specimen', asset)),
          image = specimen.querySelector('img'),
          observed = await decode(image, asset.file, { specimen: true });
        await enterReader(id('read', asset));
        const reading = await pan(specimen);
        await exitReader(id('read', asset), index % 2 ? 'confirm' : 'back');
        visits.push({ id: asset.id, ...observed, reading });
        unchanged();
      }
      p.record(
        'All 44 stable Sections reach their real 240px specimens; every displayed Blob matches preserved bytes and fully decodes, with bounded reader exits and canceled Sections',
        '#status',
        {
          viewport: [win.innerWidth, win.innerHeight],
          produced: manifest.produced,
          visits,
          boundary:
            'No art generation/adoption or runtime quality approval. Zero-overflow readers are not scrolling evidence.',
        },
      );

      const nativeVisits = [],
        representative = new Set(),
        provenance = [];
      for (const [index, asset] of assets.entries()) {
        await p.section(`#prepared-reveal-${asset.id}`);
        await p.choose(id('native-toggle', asset));
        assert($(id('native-details', asset)).open, 'Native disclosure did not open.');
        const native = $(id('native', asset)),
          image = native.querySelector('img'),
          displayed = await decode(image, asset.file);
        assert(
          displayed.url === $(id('specimen', asset)).querySelector('img').src,
          'Native inspection diverged from its verified specimen Blob.',
        );
        await enterReader(id('native-read', asset));
        const size = `${asset.file.width}x${asset.file.height}`,
          reading = representative.has(size) ? bounds(native) : await pan(native);
        const firstSize = !representative.has(size);
        representative.add(size);
        await exitReader(id('native-read', asset), index % 2 ? 'back' : 'confirm');
        await p.choose(id('native-toggle', asset));
        assert(!$(id('native-details', asset)).open, 'Native disclosure retained its open state.');
        nativeVisits.push({ id: asset.id, ...displayed, reading, panned: firstSize });
        if (firstSize) {
          await p.choose(id('provenance-toggle', asset));
          assert($(id('provenance-details', asset)).open, 'Provenance disclosure did not open.');
          const region = $(id('provenance', asset)),
            pre = region.querySelector('pre'),
            content = JSON.parse(pre?.textContent ?? region.textContent);
          assert(
            content.prompt === asset.provenance.prompt &&
              same(content.source, asset.provenance.source) &&
              same(content.owners, asset.slotIds) &&
              same(content.crop, asset.preparation.sourceCrop),
            'Provenance reader omitted original prompt, identity or owners.',
          );
          assert(
            !region.querySelector('textarea,input'),
            'Provenance review exposed an editing surface.',
          );
          await enterReader(id('provenance-read', asset));
          const readBounds = await pan(region);
          await exitReader(id('provenance-read', asset));
          assert(
            $(id('provenance-details', asset)).open,
            'Reader Back closed its parent disclosure.',
          );
          await p.choose(id('provenance-toggle', asset));
          provenance.push({
            id: asset.id,
            promptCharacters: asset.provenance.prompt.length,
            ...readBounds,
          });
        }
        unchanged();
      }
      const retainedNodes = assets.map((asset) => ({
        specimen: $(id('specimen', asset)),
        native: $(id('native', asset)),
        provenance: $(id('provenance', asset)),
        image: $(id('specimen', asset)).querySelector('img'),
      }));
      await p.pageActions();
      await p.choose('#prepared-reveal-retry');
      await p.wait(
        () =>
          $('#status').dataset.state === 'ready' &&
          $(id('specimen', assets[0])).querySelector('img') !== retainedNodes[0].image,
        30000,
      );
      assert(
        doc.activeElement === $('#prepared-reveal-retry'),
        'Page Retry completion lost ownership.',
      );
      for (const [index, asset] of assets.entries()) {
        const retained = retainedNodes[index];
        assert(
          retained.specimen === $(id('specimen', asset)) &&
            retained.native === $(id('native', asset)) &&
            retained.provenance === $(id('provenance', asset)) &&
            !$(id('native-details', asset)).open &&
            !$(id('provenance-details', asset)).open,
          'Retry replaced a reading destination or changed a disclosure.',
        );
      }
      unchanged();
      p.record(
        'All 44 native disclosures retain exact 1:1 frames; three dimension families and provenance readers reach bounded edges and return, while Retry preserves every destination',
        '#status',
        {
          nativeVisits,
          provenance,
          retry: { focus: doc.activeElement.id, stableCards: assets.length },
        },
      );

      const documents = [];
      for (const sourceId of ['manifest', 'guide']) {
        const { surface, opener } = await openSource(sourceId),
          geometry = bounds(surface.region);
        assert(geometry.maxX <= 1, 'Literal source has horizontal overflow.');
        await enterReader(surface.read);
        await p.pulse('down');
        if (geometry.maxY > 1) assert(surface.region.scrollTop > 0, 'Source Down did not scroll.');
        await exitReader(surface.read);
        assert(surface.dialog.open, 'Reader Back closed the document.');
        await p.choose(surface.end);
        const end = surface.region.scrollTop;
        assert(end >= geometry.maxY - 1, 'End missed the full literal document.');
        await p.choose(surface.start);
        assert(surface.region.scrollTop <= 1, 'Start missed the first lines.');
        const previous = surface.region.querySelector('pre');
        await p.choose(surface.retry);
        await p.wait(
          () =>
            surface.dialog.dataset.state === 'ready' &&
            surface.region.querySelector('pre') !== previous,
          30000,
        );
        assert(
          doc.activeElement === $(surface.retry) &&
            surface.region.querySelector('pre').textContent === texts[sourceId],
          'Document Retry changed literal text or took focus.',
        );
        await closeSource(surface, opener);
        documents.push({
          id: sourceId,
          ...sourcePins[sourceId],
          lines: texts[sourceId].split('\n').length,
          ...geometry,
          end,
          start: 0,
        });
      }
      const originalAsset = assets[0],
        original = originalAsset.provenance.source;
      await p.section(`#prepared-reveal-${originalAsset.id}`);
      const originalButton = $(id('original', originalAsset));
      assert(
        originalButton?.tagName === 'BUTTON',
        'Local original lost its explicit owned action.',
      );
      await p.choose(id('original', originalAsset));
      await p.wait(() => viewer.dialog.open && viewer.dialog.dataset.state === 'ready', 30000);
      assert(doc.activeElement === $(viewer.back), 'Original open lost initial Back ownership.');
      const originalImage = viewer.region.querySelector('img');
      await originalImage.decode();
      const actualOriginal = await pinned(original, originalImage.currentSrc || originalImage.src);
      assert(
        originalImage.naturalWidth === original.width &&
          originalImage.naturalHeight === original.height,
        'Original decode differs from its provenance dimensions.',
      );
      const originalDimensions = [originalImage.naturalWidth, originalImage.naturalHeight];
      await p.choose('#reveal-source-actual');
      await enterReader(viewer.read);
      const originalBounds = await pan(viewer.region);
      await exitReader(viewer.read);
      await p.choose('#reveal-source-fit');
      const fit = originalImage.getBoundingClientRect();
      assert(
        fit.width <= viewer.region.clientWidth + 1 && fit.height <= viewer.region.clientHeight + 1,
        'Fit does not contain the original.',
      );
      await closeSource(viewer, originalButton);
      assert(
        originalButton.isConnected,
        'Inspecting an original replaced the stable source button.',
      );
      p.record(
        'Both exact literal documents, including the 266665-byte manifest, retain bounded reading/Retry/two-step Back; an explicit localhost original fully decodes unchanged and returns exactly',
        '#status',
        {
          documents,
          original: {
            path: original.path,
            ...actualOriginal.pin,
            width: originalDimensions[0],
            height: originalDimensions[1],
            ...originalBounds,
            fit: [fit.width, fit.height],
          },
          boundary:
            'One original is exercised; this is not all 38 originals, public fallback, network-fault, timed cancellation, installed-offline, or downloaded-artifact acceptance.',
        },
      );

      await p.pageActions();
      const language = $('[data-language-select]'),
        beforeCancel = snapshot(win.localStorage),
        headingBefore = $('h1').textContent;
      await p.choose('[data-language-select]');
      await p.pulse(initialLocale === 'en' ? 'down' : 'up');
      await p.pulse('back');
      assert(
        language.value === initialLocale &&
          doc.documentElement.lang === initialLocale &&
          $('h1').textContent === headingBefore &&
          doc.activeElement === language &&
          same(beforeCancel, snapshot(win.localStorage)),
        'Canceled language changed the study or lost its opener.',
      );
      localeChosen = true;
      const localeVisits = [];
      for (const locale of ['uk', 'en', ...(initialLocale === 'uk' ? ['uk'] : [])]) {
        await p.select('[data-language-select]', locale);
        await p.wait(() => doc.documentElement.lang === locale);
        const documents = [];
        for (const sourceId of ['manifest', 'guide']) {
          const { surface, opener } = await openSource(sourceId),
            title = $(surface.title)?.textContent;
          assert(
            title && title === opener.textContent.trim(),
            'Source title trails the visible localized opener.',
          );
          assert(
            $(surface.read).getAttribute('aria-label') ===
              `${locale === 'uk' ? 'Читати й прокручувати' : 'Read and scroll'}: ${title}`,
            'Source Read name trails its live title or locale.',
          );
          await enterReader(surface.read);
          await exitReader(surface.read);
          await closeSource(surface, opener);
          documents.push({ id: sourceId, title });
        }
        localeVisits.push({ locale, heading: $('h1').textContent.trim(), documents });
      }
      assert(doc.documentElement.lang === initialLocale, 'Initial locale was not restored.');
      assert(
        localeVisits[0].heading !== localeVisits[1].heading,
        'Review heading did not change between Ukrainian and English.',
      );
      unchanged();
      doc.removeEventListener('click', onClick, true);
      stopDiagnostics();
      const returnSelector = '.authoring-reference-rail > a',
        destination = new URL($(returnSelector).href);
      assert(
        destination.origin === win.location.origin &&
          destination.pathname === '/authoring/asset-studio/',
        'Direct-entry Return does not point to Asset Studio.',
      );
      await p.follow(returnSelector, '/authoring/asset-studio/');
      await p.wait(
        () =>
          p.doc.querySelector('.authoring-input-rail') && p.doc.querySelector('#save-workspace'),
        30000,
      );
      assert(p.doc !== doc, 'Return did not load the real authoring owner.');
      p.record(
        'Canceled/live UK–EN choices preserve source text and exact Back; initial locale is restored before actual Asset Studio Return',
        'h1',
        {
          localeVisits,
          beforeReturn: {
            localKeys: initialLocal.length,
            sessionKeys: initialSession.length,
            allowedChange: 'Only explicitly chosen locale preference',
          },
          destination: win.location.href,
          boundary:
            'No editor action follows arrival. No Save/import/export, art adoption/approval, game state, physical controller, reciprocal reentry, or translated source-prose claim.',
        },
      );
    } catch (error) {
      throw new Error(
        `${error.message}\nObservation-only child-frame/ownership diagnostics: ${JSON.stringify(diagnostics)}`,
        { cause: error },
      );
    } finally {
      doc.removeEventListener('click', onClick, true);
      stopDiagnostics();
    }
  },
];
