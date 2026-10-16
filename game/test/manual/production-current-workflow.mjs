// Read-only product workflow. Only shared virtual-pad pulses operate controls;
// metadata/image inspection below cannot edit the register or game storage.
import { canonicalJSON } from '../../data-json.mjs';
import { listProductionSlots } from '../../../authoring/production/model.mjs';

const assert = (value, message) => {
  if (!value) throw new Error(message);
};
const storage = (store) =>
  Array.from({ length: store.length }, (_, index) => store.key(index))
    .sort()
    .map((key) => [key, store.getItem(key)]);
const same = (a, b) => canonicalJSON(a) === canonicalJSON(b);
const fingerprint = async (blob) => ({
  bytes: blob.size,
  sha256: [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join(''),
});

export const productionCurrent = [
  'Current Content Production: filter, read, verified preview, cancel and snapshot return',
  '/authoring/production/',
  async (p) => {
    const $ = (selector) => p.doc.querySelector(selector),
      win = p.doc.defaultView,
      row = (id) => `button[data-production-slot="${id}"]`,
      ready = (revision) =>
        $('#production-search') &&
        $('#production-reload') &&
        $('.authoring-input-rail') &&
        $('#production-panel').textContent.includes(`Register revision ${revision}.`) &&
        count() === '116',
      count = () => $('#production-panel').textContent.match(/(\d+) matching slots/)?.[1];
    assert(
      win.location.port === '8994' && ['127.0.0.1', 'localhost'].includes(win.location.hostname),
      'Use dedicated qualification origin 8994.',
    );
    await p.wait(() => ready(1), 30000);
    assert(p.doc.documentElement.lang.startsWith('en'), 'This bounded workflow requires English.');
    const originalLocal = storage(win.localStorage),
      originalSession = storage(win.sessionStorage),
      seed = await (await fetch('/authoring/production/register.json')).json(),
      pictures = listProductionSlots(seed).filter((slot) => slot.kind === 'picture');
    const read = async (name) => {
      const region = $(`#production-${name}-region`),
        opener = $(`#production-read-${name}`);
      assert(region && opener, `Missing ${name} reader`);
      const disclosure = region.closest('details');
      if (disclosure && !disclosure.open) {
        assert(disclosure.id, `Missing stable ${name} disclosure`);
        await p.expand(`#${disclosure.id}`);
      }
      await p.choose(`#production-read-${name}`);
      assert(region.dataset.controllerReading === 'true', `${name} did not claim reading`);
      const maximum = Math.max(0, region.scrollHeight - region.clientHeight);
      for (let n = 0; n < 80 && region.scrollTop < maximum - 1; n++) await p.pulse('down');
      assert(region.scrollTop >= maximum - 1, `${name} could not reach final text`);
      const end = region.scrollTop;
      await p.pulse('back');
      assert(region.dataset.controllerReading !== 'true', `${name} reader retained ownership`);
      assert(p.doc.activeElement === opener, `${name} Back lost its exact entry`);
      assert(!$('#production-detail').hidden, `${name} Back also closed the slot`);
      return { name, maximum, end, exercised: maximum > 1 };
    };
    assert(count() === '116', 'Baseline picture count changed');
    const theme = $('#production-theme').value;
    await p.choose('#production-theme');
    await p.pulse('down');
    await p.pulse('back');
    assert($('#production-theme').value === theme, 'Canceled theme changed filter');
    await p.edit('#production-search', ['q'], { cancel: true });
    assert($('#production-search').value === '', 'Canceled search changed filter');
    await p.edit('#production-search', ['all', 'z', 'z', 'z']);
    assert(count() === '0', 'Empty search result was not retained');
    await p.edit('#production-search', ['all', ...'sentinel']);
    await p.select('#production-theme', 'ukraine');
    await p.choose('#production-missing');
    assert(count() === '3', 'Baseline missing Sentinel coverage changed');
    const unbound = 'picture.sentinel-listening.ukraine';
    await p.choose(row(unbound));
    assert(p.doc.activeElement.id === 'production-back', 'Slot entry lost reachable focus');
    assert(!$('#production-preview'), 'Unbound slot unexpectedly has preview');
    const unboundReaders = [await read('checklist'), await read('history')];
    await p.pulse('back');
    assert($('#production-detail').hidden, 'Controller Back failed to close detail');
    assert(p.doc.activeElement === $(row(unbound)), 'Controller Back lost the exact unbound row');
    p.record(
      'Canceled filters preserved values; empty result and missing Sentinel inspection stayed read-only',
      '#production-panel',
      { unboundReaders },
    );

    await p.choose('#production-missing');
    await p.select('#production-theme', '');
    await p.edit('#production-search', ['all', 'backspace']);
    await p.select('#production-stage', 'produced');
    assert(count() === '27', 'Produced stage did not select the existing bound originals');
    await p.select('#production-stage', '');
    await p.choose('#production-next');
    assert(p.doc.activeElement.matches('button[data-production-slot]'), 'Next page lost row focus');
    const secondPageFirst = p.doc.activeElement.dataset.productionSlot;
    assert(
      secondPageFirst === 'picture.route-switchback.fpv' &&
        $('#production-panel').textContent.includes('Page 2 of 6'),
      'Next did not advance to the exact second page',
    );
    for (let page = 3; page <= 6; page++) {
      await p.choose('#production-next');
      assert(
        p.doc.activeElement.dataset.productionSlot === pictures[(page - 1) * 20].id,
        `Page ${page} lost its first slot`,
      );
    }
    assert($('#production-next').disabled, 'Final page still permits Next');
    for (let page = 5; page >= 1; page--) await p.choose('#production-previous');
    assert($('#production-previous').disabled, 'First page still permits Previous');
    await p.choose('#production-next');
    await p.choose('#production-previous');
    assert(
      p.doc.activeElement.dataset.productionSlot === 'picture.pressure-orchard.fpv',
      'Previous page lost first row',
    );
    await p.choose(row('picture.pressure-orchard.fpv'));
    const readers = [await read('checklist'), await read('history'), await read('provenance')];
    await p.choose('#production-preview');
    await p.choose('#production-clear-preview');
    assert(!$('#production-detail img'), 'Clear retained an image');
    await p.choose('#production-preview');
    await p.wait(() => $('#production-detail img')?.naturalWidth > 0, 30000);
    const image = $('#production-detail img'),
      observed = p.downloads.findLast(({ url }) => url === image.src),
      work = seed.works.find((entry) => entry.id === 'picture-orchard-crossing'),
      source = work.files.find((entry) => entry.role === 'original');
    assert(observed && source, 'Verified PNG blob/source identity missing');
    const bytes = await fingerprint(observed.blob),
      decoded = await globalThis.createImageBitmap(observed.blob);
    assert(
      bytes.bytes === source.file.bytes && bytes.sha256 === source.file.sha256,
      'Preview bytes differ from immutable original',
    );
    assert(
      decoded.width === source.width && decoded.height === source.height,
      'Full PNG decode dimensions changed',
    );
    decoded.close();
    await p.choose('#production-clear-preview');
    assert(!$('#production-detail img'), 'Clear failed after successful preview');
    await p.pulse('back');
    assert(
      p.doc.activeElement === $(row('picture.pressure-orchard.fpv')),
      'Preview return lost source row',
    );
    await p.choose('#production-reload');
    await p.wait(() => $('#production-panel').textContent.includes('Register revision 1.'));
    assert(count() === '116', 'Reload changed the baseline view');
    p.record(
      'Both page directions retained reachable focus; long records read to their bounds; explicit PNG verified, cleared and returned',
      '#production-panel',
      {
        secondPageFirst,
        readers,
        preview: { ...bytes, width: source.width, height: source.height },
        boundary:
          'Object URL is a transient preview, not a product export or OS download. Delayed/error cancellation is separately tested with injected host services.',
      },
    );

    await p.follow('#snapshot-sentinel', '/authoring/production/');
    await p.wait(() => ready(2), 30000);
    assert(
      win.location.search === '?snapshot=sentinel-themes',
      'Snapshot link lost its exact route',
    );
    await p.edit('#production-search', ['all', ...'sentinel']);
    await p.select('#production-theme', 'ukraine');
    await p.choose('#production-missing');
    assert(count() === '0', 'Revision 2 still reports missing Sentinel pictures');
    await p.choose('#production-missing');
    assert(count() === '3', 'Revision 2 lost Sentinel picture slots');
    await p.choose(row(unbound));
    assert(
      $('#production-preview') && $('#production-detail').textContent.includes('Binding revision'),
      'Snapshot did not bind the existing exact slot',
    );
    await p.choose('#production-preview');
    await p.wait(() => $('#production-detail img')?.naturalWidth > 0, 30000);
    const sentinel = await (
        await fetch('/authoring/production/register-sentinel-themes.json')
      ).json(),
      sentinelSlot = listProductionSlots(sentinel).find((slot) => slot.id === unbound),
      sentinelSource = sentinelSlot.work.files.find(
        (entry) =>
          ['original', 'poster', 'concept'].includes(entry.role) &&
          entry.file.path.endsWith('.png'),
      ),
      sentinelImage = $('#production-detail img'),
      sentinelBlob = p.downloads.findLast(({ url }) => url === sentinelImage.src)?.blob;
    assert(sentinelBlob, 'Sentinel preview object URL was not observed');
    const sentinelBytes = await fingerprint(sentinelBlob),
      sentinelDecoded = await globalThis.createImageBitmap(sentinelBlob);
    assert(
      sentinelBytes.bytes === sentinelSource.file.bytes &&
        sentinelBytes.sha256 === sentinelSource.file.sha256,
      'Sentinel PNG bytes changed',
    );
    assert(
      sentinelDecoded.width === sentinelSource.width &&
        sentinelDecoded.height === sentinelSource.height,
      'Sentinel PNG decode dimensions changed',
    );
    sentinelDecoded.close();
    await p.choose('#production-clear-preview');
    assert(!$('#production-detail img'), 'Sentinel Clear retained the image');
    await p.pulse('back');
    await p.follow('#snapshot-baseline', '/authoring/production/');
    await p.wait(() => ready(1), 30000);
    assert(
      win.location.search === '' && count() === '116',
      'Actual Baseline return retained temporary filters',
    );
    for (const [domain, expected] of [
      ['presentation', '56'],
      ['story', '12'],
      ['reserve', '40'],
      ['track', '24'],
      ['picture', '116'],
    ]) {
      await p.select('#production-domain', domain);
      assert(count() === expected, `Unexpected ${domain} inventory`);
    }
    assert(
      same(storage(win.localStorage), originalLocal),
      'Register workflow changed local storage',
    );
    assert(
      same(storage(win.sessionStorage), originalSession),
      'Register workflow changed session storage',
    );
    assert(
      same(await (await fetch('/authoring/production/register.json')).json(), seed),
      'Register source changed',
    );
    p.record(
      'Actual snapshot links reopened distinct immutable registers; Sentinel PNG decoded exactly; all five domains remained inspectable; storage and original source unchanged',
      '#production-panel',
      {
        sentinelPreview: sentinelBytes,
        boundary:
          'No Save/import/approval/export exists in this read-only product. CLI mutation paths and physical controllers remain separate.',
      },
    );
  },
];
