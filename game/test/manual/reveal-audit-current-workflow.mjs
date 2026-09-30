// Historical review only. Real shared pad commands operate every control below;
// DOM/source/storage observations never update the audit or call app handlers.
const assert = (value, message) => {
  if (!value) throw new Error(message);
};
const auditPath = '/authoring/design-atlas/reveal-audit.json';
const historicalPin = Object.freeze({
  bytes: 75088,
  sha256: 'f0952cdfaae60d8bed364a9cf2293aa036fe802a9551b55743e863712ff09eda',
});
const storage = (store) =>
  Array.from({ length: store.length }, (_, index) => store.key(index))
    .sort()
    .map((key) => [key, store.getItem(key)]);
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
async function readHistoricalAudit() {
  const response = await fetch(auditPath, { cache: 'no-store' });
  assert(response.ok, `Historical audit unavailable (${response.status}).`);
  const bytes = await response.arrayBuffer(),
    sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  assert(
    bytes.byteLength === historicalPin.bytes && sha256 === historicalPin.sha256,
    'The historical source JSON changed; this fixture does not authorize rewriting its pin.',
  );
  const audit = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  assert(
    audit.format === 'fpv-reveal-art-audit.v1' &&
      audit.date === '2026-09-14' &&
      audit.status === 'design audit; no production approval',
    'Historical date/format/approval boundary changed.',
  );
  assert(
    audit.counts.fpvOwners === 56 &&
      audit.counts.rasterOwners === 39 &&
      audit.counts.uniqueRasterHashes === 21 &&
      audit.counts.proceduralOwners === 17 &&
      audit.images.length === 21 &&
      audit.procedural.length === 17,
    'Historical owner and source counts changed.',
  );
  return audit;
}

export const revealAuditCurrent = [
  'Current Reveal Audit: historical owners, bounded reading, detail Back and Atlas return',
  '/authoring/design-atlas/reveal-audit.html',
  async (p) => {
    const $ = (selector) => p.doc.querySelector(selector),
      win = p.doc.defaultView;
    assert(
      win.location.port === '8996' && ['localhost', '127.0.0.1'].includes(win.location.hostname),
      'Use the dedicated local Reveal Audit qualification origin on port8996.',
    );
    const ready = async () => {
      await p.wait(
        () =>
          $('#reveal-reload')?.disabled === false &&
          $('#rasters')?.querySelectorAll(':scope > article').length === 21 &&
          $('#procedures')?.querySelectorAll(':scope > article').length === 17 &&
          $('#reveal-read-rasters') &&
          $('#reveal-read-procedures') &&
          $('.authoring-input-rail'),
        30000,
      );
      assert($('#status').dataset.error !== 'true', 'The historical review reports an error.');
      assert(p.doc.documentElement.lang.startsWith('en'), 'This bounded case requires English.');
      const status = $('#status').textContent;
      for (const value of ['56', '21', '17'])
        assert(status.includes(value), `Historical status omits count ${value}.`);
      assert(
        /no production approval/i.test($('.eyebrow').textContent),
        'The historical review lost its no-approval boundary.',
      );
    };
    await ready();
    const audit = await readHistoricalAudit(),
      originalLocal = storage(win.localStorage),
      originalSession = storage(win.sessionStorage);
    const card = (kind, index) => $(`#reveal-owners-${kind}-${index}`).closest('article');
    const verifyOwnerRows = () => {
      let owners = 0;
      for (const [kind, entries] of [
        ['raster', audit.images],
        ['procedural', audit.procedural],
      ]) {
        entries.forEach((entry, index) => {
          const article = card(kind, index + 1),
            expected = kind === 'raster' ? entry.owners : [entry],
            rows = [...article.querySelectorAll('.owners li')];
          assert(rows.length === expected.length, `Wrong owner count for${kind}${index + 1}.`);
          expected.forEach((owner, n) => {
            const code = rows[n].querySelector('code')?.textContent || '';
            for (const value of [
              owner.id,
              `${owner.owner.baseCampaignKey} / ${owner.owner.levelId} / ${owner.owner.levelRevision}`,
            ])
              assert(code.includes(value), `Exact historical owner changed:${owner.id}.`);
          });
          owners += rows.length;
          if (kind === 'raster') {
            const link = [...article.querySelectorAll('a[href]')].find(
              (node) => new URL(node.href).pathname === `/${entry.path}`,
            );
            assert(link, `Original source path changed:${entry.path}.`);
          } else {
            const canvas = article.querySelector('.image canvas');
            assert(
              canvas &&
                canvas.width === entry.dimensions.width &&
                canvas.height === entry.dimensions.height &&
                canvas.getAttribute('aria-label')?.includes('seed 0'),
              `Procedural source preview missing or incorrectly sized:${entry.id}.`,
            );
          }
        });
      }
      assert(owners === 56, 'The rendered historical owner inventory is incomplete.');
      return owners;
    };
    verifyOwnerRows();
    const read = async (buttonSelector, regionSelector, exit = 'back') => {
      const button = $(buttonSelector),
        region = $(regionSelector);
      assert(button && region, `Missing current reader:${buttonSelector}.`);
      await p.choose(buttonSelector);
      assert(
        region.dataset.controllerReading === 'true',
        `Reader did not enter:${buttonSelector}.`,
      );
      const maxX = Math.max(0, region.scrollWidth - region.clientWidth),
        maxY = Math.max(0, region.scrollHeight - region.clientHeight),
        // This page uses shared beginReading (48px maximum), not the Atlas
        // surface adapter's larger viewport-relative step. One finite traversal
        // allowance covers the entire observed region plus two boundary pulses.
        step = Math.min(48, Math.max(1, Math.floor(region.clientHeight / 2))),
        budget = Math.ceil(maxY / step) + 2;
      assert(budget <= 600, `Unexpectedly large historical region: ${regionSelector}.`);
      for (let n = 0; n < budget && region.scrollTop < maxY - 1; n++) await p.pulse('down');
      assert(region.scrollTop >= maxY - 1, `Last text unreachable:${regionSelector}.`);
      const end = region.scrollTop;
      for (let n = 0; n < budget && region.scrollTop > 1; n++) await p.pulse('up');
      assert(region.scrollTop <= 1, `First text unreachable:${regionSelector}.`);
      await p.pulse(exit);
      assert(
        region.dataset.controllerReading !== 'true',
        `Reader retained ownership:${buttonSelector}.`,
      );
      assert(p.doc.activeElement === button, `Reader lost its exact opener:${buttonSelector}.`);
      return {
        region: regionSelector,
        maxX,
        maxY,
        step,
        pulseBudget: budget,
        end,
        start: region.scrollTop,
        exit,
        scrolled: maxY > 1,
      };
    };
    const ownerDetail = async (kind, index, exit) => {
      const selector = `#reveal-owners-${kind}-${index}`,
        details = $(selector),
        summary = details.querySelector('summary');
      assert(!details.open, 'Historical owner details unexpectedly persisted open.');
      await p.choose(`${selector} > summary`);
      assert(details.open, 'Explicit disclosure activation did not open owner details.');
      const metrics = await read(
        `#reveal-read-${kind}-${index}-owners`,
        `#reveal-${kind}-${index}-owners-region`,
        exit,
      );
      assert(details.open, 'Ending owner reading also closed the disclosure.');
      await p.pulse('back');
      assert(!details.open, 'Second Back failed to close owner details.');
      assert(p.doc.activeElement === summary, 'Closing owner details lost the exact summary.');
      await p.choose(`${selector} > summary`);
      assert(details.open, 'Owner details could not reopen.');
      await p.choose(`${selector} > summary`);
      assert(!details.open, 'Explicit disclosure activation did not close owner details.');
      return metrics;
    };
    const raster = await read('#reveal-read-rasters', '#rasters');
    const rasterOwners = await ownerDetail('raster', 1, 'back'),
      first = card('raster', 1),
      firstBox = first.querySelector('.image');
    await p.wait(() => {
      const image = firstBox.querySelector('img');
      return image
        ? image.complete && image.naturalWidth > 0
        : /unavailable/i.test(firstBox.textContent);
    }, 30000);
    const firstImage = firstBox.querySelector('img'),
      rasterPreview = firstImage
        ? { state: 'decoded', width: firstImage.naturalWidth, height: firstImage.naturalHeight }
        : { state: 'unavailable', message: firstBox.textContent.trim() };
    if (firstImage) {
      await firstImage.decode();
      assert(
        firstImage.naturalWidth === audit.images[0].image.width &&
          firstImage.naturalHeight === audit.images[0].image.height,
        'Observed first raster dimensions differ from its historical record.',
      );
    }
    p.record(
      'All 56 exact historical owners and 21 raster paths remained pinned; raster section and owner disclosure reading/Back used real controls',
      '#status',
      {
        historical: {
          ...historicalPin,
          date: audit.date,
          status: audit.status,
          counts: audit.counts,
        },
        raster,
        rasterOwners,
        rasterPreview,
      },
    );

    const procedural = await read('#reveal-read-procedures', '#procedures', 'confirm'),
      proceduralOwners = await ownerDetail('procedural', 1, 'confirm');
    verifyOwnerRows();
    p.record(
      'All 17 procedural previews retain their native dimensions and seed 0 labels; section and owner readers return to exact controls, then details close and reopen',
      '#status',
      {
        procedural,
        proceduralOwners,
        boundary:
          'Canvas dimensions and accessible seed labels are observed; no pixel-exact historical-renderer or production-approval claim.',
      },
    );

    const previous = p.doc;
    await p.follow('#reveal-audit-home', '/authoring/design-atlas/index.html');
    await p.wait(() => $('#screen-select')?.options.length === 9 && $('#reveal-audit-link'), 30000);
    assert(p.doc !== previous, 'Atlas return did not navigate the real document.');
    await p.follow('#reveal-audit-link', '/authoring/design-atlas/reveal-audit.html');
    await ready();
    assert(p.doc !== previous, 'Reveal reentry reused the former document.');
    verifyOwnerRows();
    assert(
      !$('#reveal-owners-raster-1').open && !$('#reveal-owners-procedural-1').open,
      'Ephemeral disclosures did not reset on real reentry.',
    );
    assert(
      equal(audit, await readHistoricalAudit()),
      'Historical source changed across navigation.',
    );
    assert(
      equal(originalLocal, storage(win.localStorage)),
      'Read-only review changed local storage.',
    );
    assert(
      equal(originalSession, storage(win.sessionStorage)),
      'Read-only review changed session storage.',
    );
    p.record(
      'Real Atlas return and explicit Reveal reentry reached fresh complete review; historical JSON and origin local/session storage stayed unchanged',
      '#status',
      {
        owners: 56,
        source: historicalPin,
        storage: {
          localKeys: originalLocal.length,
          sessionKeys: originalSession.length,
          unchanged: true,
        },
        boundary:
          'Read-only historical source review, not a current production register or approval. Original PNG/source links are inspected as destinations, not browser-qualified handoffs. No project Save/import/export, OS download, domain mutation, forced image failure, physical controller or installed-offline qualification.',
      },
    );
  },
];
