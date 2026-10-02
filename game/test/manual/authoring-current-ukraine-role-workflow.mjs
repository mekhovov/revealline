// Current source-study qualification. Only shared virtual-pad commands operate
// the application. Source bytes, canvas pixels, geometry and storage are observers.
import { UKRAINE_ROLE_SOURCES } from '../../../authoring/library/ukraine-role-presentations/sources.mjs';

const assert = (value, message) => {
  if (!value) throw new Error(message);
};
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const root = 'authoring/library/ukraine-role-presentations/';
const roles = ['scout', 'bomber', 'carrier', 'interceptor', 'fiber', 'impact', 'trapper'];
const choices = {
  role: ['all', ...roles],
  board: ['72', '48'],
  width: ['294', '390', '600', '1152'],
  heading: ['0', '90', '180', '270'],
  speed: ['0', '1'],
  background: ['dark', 'light', 'checker'],
};
const toggles = ['wings', 'guides', 'reduced'];
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
  assert(response.ok, `Cannot observe role-study source: ${url}.`);
  const bytes = await response.arrayBuffer();
  return { bytes, pin: await fingerprint(bytes) };
}
const decodeText = (bytes) =>
  new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
const settle = (ms = 180) => new Promise((resolve) => setTimeout(resolve, ms));

export const ukraineRoleGalleryCurrent = [
  'Current Ukraine role study: all controls, seven canvas readers, exact documents, motion and real return',
  '/authoring/library/ukraine-role-presentations/index.html',
  async (p) => {
    const doc = p.doc,
      win = doc.defaultView,
      $ = (selector) => doc.querySelector(selector);
    assert(
      win.location.port === '9005' && ['localhost', '127.0.0.1'].includes(win.location.hostname),
      'Use the isolated Ukraine role qualification origin on port 9005.',
    );
    await p.wait(
      () =>
        $('.authoring-reference-read') &&
        $('#reveal-source-dialog') &&
        $('#status')?.dataset.state === 'ready' &&
        $('[data-language-select]') &&
        roles.every(
          (role) =>
            $(`#ukraine-role-${role}`) &&
            $(`#ukraine-role-read-${role}`) &&
            $(`#ukraine-role-canvas-${role} canvas`),
        ) &&
        ['guide', 'records', 'prompts'].every((id) => $(`#ukraine-role-source-${id}`)),
      30000,
    );
    await doc.fonts.ready;
    const dialog = $('#reveal-source-dialog'),
      region = $('#reveal-source-region'),
      read = $('#reveal-read-source'),
      motion = $('#ukraine-role-motion-status'),
      href = win.location.href,
      historyLength = win.history.length,
      initialLocale = doc.documentElement.lang,
      initialPause = $('#pause').getAttribute('aria-pressed') === 'true',
      beforeLocal = snapshot(win.localStorage),
      beforeSession = snapshot(win.sessionStorage),
      originalCards = [...doc.querySelectorAll('#cards > article')],
      canvases = roles.map((role) => $(`#ukraine-role-canvas-${role} canvas`)),
      originalLinks = UKRAINE_ROLE_SOURCES.map(({ id }) => {
        const element = $(`#ukraine-role-source-${id}`);
        return { element, id, href: element?.getAttribute('href') };
      }),
      currentControls = () => ({
        ...Object.fromEntries(Object.keys(choices).map((id) => [id, $(`#${id}`).value])),
        ...Object.fromEntries(toggles.map((id) => [id, $(`#${id}`).checked])),
      }),
      initialControls = currentControls(),
      clicks = [],
      sources = new Map(),
      metadata = new Map();
    let explicitLocaleChoice = false;
    assert(['en', 'uk'].includes(initialLocale), 'Unsupported initial role-study locale.');
    assert(
      same(
        UKRAINE_ROLE_SOURCES.map(({ id }) => id),
        ['guide', 'records', 'prompts'],
      ) &&
        UKRAINE_ROLE_SOURCES.every(({ kind }) => kind === 'text') &&
        originalLinks.every(({ element }) => element) &&
        originalCards.length === 7 &&
        doc.querySelectorAll('#cards canvas').length === 7,
      'Expected seven role canvases and three literal source-document actions.',
    );
    for (const [id, values] of Object.entries(choices))
      assert(
        same(
          [...$(`#${id}`).options].map(({ value }) => value),
          values,
        ),
        `The ${id} study choices changed.`,
      );
    for (const source of UKRAINE_ROLE_SOURCES) {
      const value = await observe(`/${source.path}`);
      assert(
        value.pin.bytes === source.bytes && value.pin.sha256 === source.sha256,
        `The ${source.id} source does not match its exact descriptor.`,
      );
      sources.set(source.id, value);
      metadata.set(source.path, value.pin);
    }
    const records = JSON.parse(decodeText(sources.get('records').bytes));
    assert(
      records.format === 'ukraine-role-presentations.v1' &&
        records.stage === 'source-candidate' &&
        records.runtimeBinding === null &&
        same(
          records.roles.map(({ classId }) => classId),
          roles,
        ),
      'The retained candidate record identity changed.',
    );
    for (const role of records.roles) {
      const value = await observe(`/${root}${role.provenance}`),
        provenance = JSON.parse(decodeText(value.bytes));
      metadata.set(`${root}${role.provenance}`, value.pin);
      assert(
        provenance.classId === role.classId &&
          provenance.original.path === role.body.src &&
          provenance.original.sha256 === role.sha256 &&
          same(provenance.actualDimensions, [role.width, role.height]),
        `Candidate and original provenance differ for ${role.classId}.`,
      );
    }
    const copies = new Map(
      await Promise.all(
        ['en', 'uk'].map(async (locale) => {
          const response = await fetch(`/game/locales/${locale}/tools.json`, { cache: 'no-store' });
          assert(response.ok, `Cannot observe authoritative ${locale} study labels.`);
          return [locale, await response.json()];
        }),
      ),
    );
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
        'Role study navigated or changed browser history.',
      );
      assert(
        originalCards.every((node) => node.isConnected) &&
          originalCards.every(
            (node, index) => doc.querySelectorAll('#cards > article')[index] === node,
          ) &&
          canvases.every((canvas) => canvas.isConnected) &&
          doc.querySelectorAll('#cards > article').length === 7 &&
          doc.querySelectorAll('#cards canvas').length === 7,
        'Interaction replaced the original role-card or canvas inventory.',
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
        'Role study changed unrelated origin storage.',
      );
      assert(
        clicks.every((row) => row.source && row.prevented && !row.download),
        'Document reading dispatched raw navigation or a download.',
      );
      for (const canvas of canvases) {
        const bounds = canvas.getBoundingClientRect(),
          shown = !canvas.closest('article').hidden;
        assert(
          canvas.width === 600 &&
            canvas.height === 190 &&
            (!shown ||
              (Math.abs(bounds.width - 600) <= 0.1 && Math.abs(bounds.height - 190) <= 0.1)),
          'The 600 × 190 CSS/intrinsic source-study canvas changed dimensions.',
        );
      }
    };
    const pixels = async () => {
      const result = [];
      for (const [index, canvas] of canvases.entries()) {
        const rgba = canvas.getContext('2d').getImageData(0, 0, 600, 190).data;
        assert(
          rgba.some((value) => value !== 0),
          'The study canvas is empty.',
        );
        result.push({ role: roles[index], ...(await fingerprint(rgba)) });
      }
      return {
        canvases: result,
        sha256: (await fingerprint(new TextEncoder().encode(JSON.stringify(result)))).sha256,
      };
    };
    const choosePaused = async (paused) => {
      if (($('#pause').getAttribute('aria-pressed') === 'true') !== paused)
        await p.choose('#pause');
      assert(
        ($('#pause').getAttribute('aria-pressed') === 'true') === paused,
        'Pause did not follow its explicit action.',
      );
    };
    const chooseToggle = async (id, checked) => {
      if ($(`#${id}`).checked !== checked) await p.choose(`#${id}`);
      assert($(`#${id}`).checked === checked, `The ${id} toggle did not follow its action.`);
    };
    const reading = () => read.getAttribute('aria-pressed') === 'true';
    const sourceTitle = (source, locale = doc.documentElement.lang) =>
      copies.get(locale)[
        `ukraineRoleReview.${{ guide: 'replacementGuide', records: 'candidateRecords', prompts: 'promptRigContract' }[source.id]}`
      ];
    const open = async (source) => {
      await p.pageActions();
      const opener = $(`#ukraine-role-source-${source.id}`),
        title = sourceTitle(source);
      assert(
        new URL(opener.href).pathname === `/${source.path}` && opener.textContent.trim() === title,
        'Source action disagrees with its pinned path or localized title.',
      );
      await p.choose(`#ukraine-role-source-${source.id}`);
      await p.wait(() => dialog.open && dialog.dataset.state === 'ready', 30000);
      assert(
        dialog.dataset.path === source.path &&
          dialog.dataset.kind === 'text' &&
          $('#reveal-source-title').textContent === title &&
          doc.activeElement === $('#reveal-source-close') &&
          !reading() &&
          region.scrollTop <= 1 &&
          region.scrollLeft <= 1,
        'Opening changed source identity, title, initial ownership or position.',
      );
      const pre = region.querySelector('pre');
      assert(
        pre?.textContent === decodeText(sources.get(source.id).bytes) &&
          pre.children.length === 0 &&
          region.children.length === 1,
        'Source is not the complete literal original document.',
      );
      assert(
        motion.dataset.state === 'suspended',
        'Source modal did not suspend presentation motion.',
      );
      unchanged();
      return { opener, title };
    };
    const close = async (opener, explicit = false) => {
      assert(!reading(), 'Stop reading before closing the source.');
      if (explicit) await p.choose('#reveal-source-close');
      else await p.pulse('back');
      await p.wait(() => !dialog.open);
      assert(
        doc.activeElement === opener && region.children.length === 0 && !reading(),
        'Source Back lost its exact opener or retained content/ownership.',
      );
      unchanged();
    };
    const enterRead = async () => {
      await p.choose('#reveal-read-source');
      assert(reading(), 'Source reader did not acquire its document.');
    };
    const stopRead = async (command = 'back') => {
      await p.pulse(command);
      assert(
        dialog.open && !reading() && doc.activeElement === read,
        'Reader exit did not preserve its modal and exact Read action.',
      );
    };
    try {
      await choosePaused(true);
      await settle();
      const baseline = await pixels();
      await settle();
      assert(
        (await pixels()).sha256 === baseline.sha256,
        'Paused preview pixels continued changing.',
      );
      await p.pageActions();
      assert(
        doc.activeElement === $('[data-language-select]'),
        'Page actions did not reach the first header control.',
      );
      const canceled = [];
      for (const id of Object.keys(choices)) {
        const element = $(`#${id}`),
          original = element.value,
          controls = currentControls(),
          paint = await pixels();
        await p.choose(`#${id}`);
        await p.pulse(element.selectedIndex < element.options.length - 1 ? 'down' : 'up');
        await p.pulse('back');
        assert(
          element.value === original &&
            same(currentControls(), controls) &&
            doc.activeElement === element &&
            (await pixels()).sha256 === paint.sha256,
          `Canceled ${id} changed the visible source study or lost its selector.`,
        );
        canceled.push(id);
      }
      const roleVisits = [];
      for (const role of choices.role) {
        await p.select('#role', role);
        const visibleRoles = roles.filter(
          (entry) => !$(`#ukraine-role-${entry}`).closest('article').hidden,
        );
        assert(
          same(visibleRoles, role === 'all' ? roles : [role]),
          'Role filtering did not preserve the exact requested source cards.',
        );
        unchanged();
        roleVisits.push({ role, visible: visibleRoles, rgbaSha256: (await pixels()).sha256 });
      }
      await p.select('#role', 'all');
      const matrix = [];
      for (const board of choices.board)
        for (const width of choices.width) {
          await p.select('#board', board);
          await p.select('#width', width);
          unchanged();
          matrix.push({
            board: Number(board),
            width: Number(width),
            rgbaSha256: (await pixels()).sha256,
          });
        }
      const visualChoices = [];
      for (const id of ['heading', 'speed', 'background'])
        for (const value of choices[id]) {
          await p.select(`#${id}`, value);
          assert($(`#${id}`).value === value, `The ${id} choice did not settle.`);
          unchanged();
          visualChoices.push({ id, value, rgbaSha256: (await pixels()).sha256 });
        }
      const toggleChoices = [];
      for (const id of toggles) {
        for (const checked of [!initialControls[id], initialControls[id]]) {
          await chooseToggle(id, checked);
          unchanged();
          toggleChoices.push({ id, checked, rgbaSha256: (await pixels()).sha256 });
        }
      }
      for (const [id, values] of Object.entries(choices)) {
        assert(
          values.includes(initialControls[id]),
          `Initial ${id} value is not a retained study choice.`,
        );
        await p.select(`#${id}`, initialControls[id]);
      }
      const retryControls = currentControls();
      await p.choose('#ukraine-role-retry');
      await p.wait(() => $('#status').dataset.state === 'ready', 30000);
      assert(
        doc.activeElement === $('#ukraine-role-retry') &&
          same(currentControls(), retryControls) &&
          $('#pause').getAttribute('aria-pressed') === 'true',
        'Page Retry lost its owned focus or changed preview controls.',
      );
      unchanged();
      p.record(
        'All board/arena pairs, heading/motion/background choices and toggles use the real controller; canceled choices preserve exact pixels, and Retry keeps the seven canvas nodes and settings',
        '#status',
        {
          canceled,
          roleVisits,
          matrix,
          visualChoices,
          toggleChoices,
          baseline: baseline.canvases,
          pageRetry: { state: $('#status').dataset.state, focus: doc.activeElement.id },
          boundary:
            'RGBA hashes observe the current rendering, not an independent visual oracle or runtime adoption of the size samples.',
        },
      );

      await p.select('#role', 'all');
      const canvasReaders = [];
      for (const [index, role] of roles.entries()) {
        const button = $(`#ukraine-role-read-${role}`),
          canvasRegion = $(`#ukraine-role-canvas-${role}`);
        await p.section(`#ukraine-role-${role}`);
        assert(
          doc.activeElement === button && button.getAttribute('aria-pressed') !== 'true',
          'Sections did not focus the exact inactive canvas reader.',
        );
        await p.pulse('menu');
        await p.wait(() => $('.authoring-sections-dialog').open);
        await p.pulse('back');
        assert(doc.activeElement === button, 'Canceled Sections lost its exact canvas reader.');
        await p.choose(`#ukraine-role-read-${role}`);
        assert(
          button.getAttribute('aria-pressed') === 'true' &&
            canvasRegion.dataset.ukraineRoleReading === 'true',
          'Canvas reader did not acquire its bounded region.',
        );
        const maxX = Math.max(0, canvasRegion.scrollWidth - canvasRegion.clientWidth),
          maxY = Math.max(0, canvasRegion.scrollHeight - canvasRegion.clientHeight);
        assert(
          win.innerWidth > 500 || maxX > 1,
          'Portrait preview must retain the true-width canvas in its bounded horizontal reader.',
        );
        for (let n = 0; n < 20 && canvasRegion.scrollLeft < maxX - 1; n++) await p.pulse('right');
        for (let n = 0; n < 20 && canvasRegion.scrollTop < maxY - 1; n++) await p.pulse('down');
        assert(
          canvasRegion.scrollLeft >= maxX - 1 && canvasRegion.scrollTop >= maxY - 1,
          'The bounded canvas far edges cannot be reached.',
        );
        const far = [canvasRegion.scrollLeft, canvasRegion.scrollTop];
        for (let n = 0; n < 20 && canvasRegion.scrollLeft > 1; n++) await p.pulse('left');
        for (let n = 0; n < 20 && canvasRegion.scrollTop > 1; n++) await p.pulse('up');
        assert(
          canvasRegion.scrollLeft <= 1 && canvasRegion.scrollTop <= 1,
          'The bounded canvas reader cannot return to its origin.',
        );
        await p.pulse(index % 2 ? 'confirm' : 'back');
        assert(
          doc.activeElement === button &&
            button.getAttribute('aria-pressed') === 'false' &&
            canvasRegion.dataset.ukraineRoleReading !== 'true',
          'Canvas reader exit lost its exact entry or retained ownership.',
        );
        canvasReaders.push({
          role,
          clientWidth: canvasRegion.clientWidth,
          clientHeight: canvasRegion.clientHeight,
          maxX,
          maxY,
          far,
          start: [canvasRegion.scrollLeft, canvasRegion.scrollTop],
          scrolled: maxX > 1 || maxY > 1,
        });
        unchanged();
      }
      await chooseToggle('reduced', false);
      await chooseToggle('wings', true);
      await p.select('#speed', '1');
      await choosePaused(false);
      await settle();
      const osReduced = win.matchMedia('(prefers-reduced-motion: reduce)').matches,
        movingBefore = await pixels();
      await settle(250);
      const movingAfter = await pixels();
      assert(
        motion.dataset.state === (osReduced ? 'reduced' : 'playing'),
        'Motion status does not reflect the effective system preference.',
      );
      assert(
        (movingBefore.sha256 === movingAfter.sha256) === osReduced,
        'Observed motion does not follow the current effective reduced-motion state.',
      );
      await chooseToggle('wings', false);
      const wingsOff = await pixels();
      await settle(250);
      assert(
        motion.dataset.state === (osReduced ? 'reduced' : 'static') &&
          (await pixels()).sha256 === wingsOff.sha256,
        'Hidden procedural wings did not leave a static source comparison.',
      );
      await chooseToggle('wings', true);
      await choosePaused(true);
      const paused = await pixels();
      await settle(250);
      assert(
        motion.dataset.state === (osReduced ? 'reduced' : 'paused') &&
          (await pixels()).sha256 === paused.sha256,
        'Explicit Pause did not hold the actual canvas pixels.',
      );
      await chooseToggle('reduced', true);
      await choosePaused(false);
      const reduced = await pixels();
      await settle(250);
      assert(
        motion.dataset.state === 'reduced' && (await pixels()).sha256 === reduced.sha256,
        'Manual reduced motion did not hold the actual canvas pixels.',
      );
      const previousBackground = $('#background').value,
        changedBackground = previousBackground === 'dark' ? 'light' : 'dark';
      await p.select('#background', changedBackground);
      const changed = await pixels();
      assert(
        changed.sha256 !== reduced.sha256 && motion.dataset.state === 'reduced',
        'Reduced motion prevented a deliberate visible-control repaint.',
      );
      await p.select('#background', previousBackground);
      await choosePaused(true);
      for (const id of toggles) await chooseToggle(id, initialControls[id]);
      for (const id of Object.keys(choices)) await p.select(`#${id}`, initialControls[id]);
      unchanged();
      p.record(
        'Seven Sections targets, canceled navigation and bounded canvas readers retain 600 × 190 CSS pixels; real Pause and manual reduced motion hold the observed pixels while explicit changes still repaint',
        '#ukraine-role-motion-status',
        {
          viewport: { width: win.innerWidth, height: win.innerHeight },
          readers: canvasReaders,
          motion: {
            osReduced,
            before: movingBefore.sha256,
            after: movingAfter.sha256,
            wingsOff: wingsOff.sha256,
            paused: paused.sha256,
            reduced: reduced.sha256,
            deliberatelyChanged: changed.sha256,
          },
          boundary:
            'Scroll evidence is limited to the recorded overflow. Pixel stability does not measure CPU work, frame scheduling, mobile performance or motion comfort. The OS preference is observed, never overridden.',
        },
      );

      const textVisits = [];
      for (const [index, source] of UKRAINE_ROLE_SOURCES.entries()) {
        const { opener } = await open(source),
          observed = sources.get(source.id),
          maxX = Math.max(0, region.scrollWidth - region.clientWidth),
          maxY = Math.max(0, region.scrollHeight - region.clientHeight),
          beforeModal = await pixels();
        await settle(250);
        assert(
          (await pixels()).sha256 === beforeModal.sha256 && motion.dataset.state === 'suspended',
          'Owned document reading did not hold the presentation pixels.',
        );
        assert(maxX <= 1 && maxY > 1, 'Expected bounded, wrapped source text.');
        await enterRead();
        await p.pulse('down');
        assert(region.scrollTop > 0, 'Source Down did not scroll.');
        await p.pulse('up');
        assert(region.scrollTop <= 1, 'Source Up did not return to the start.');
        await stopRead();
        await p.choose('#reveal-source-end');
        const end = region.scrollTop;
        assert(end >= maxY - 1, 'End of details did not reach the last source line.');
        await enterRead();
        await p.pulse('up');
        assert(region.scrollTop < end, 'The source reader cannot leave its final lines.');
        await p.pulse('down');
        assert(region.scrollTop >= maxY - 1, 'The source reader cannot regain its final lines.');
        await stopRead('confirm');
        await p.choose('#reveal-source-start');
        assert(region.scrollTop <= 1, 'Start of details did not restore the first source line.');
        let retry = null;
        if (index === 0) {
          const previous = region.querySelector('pre');
          await p.choose('#reveal-source-retry');
          await p.wait(
            () => dialog.dataset.state === 'ready' && region.querySelector('pre') !== previous,
            30000,
          );
          assert(
            doc.activeElement === $('#reveal-source-retry') &&
              region.querySelector('pre').textContent === decodeText(observed.bytes),
            'Source Retry changed exact text or lost its owned focus.',
          );
          retry = { state: dialog.dataset.state, focus: doc.activeElement.id };
        }
        await close(opener, index % 2 === 1);
        const reopened = await open(source);
        await enterRead();
        await stopRead();
        await close(reopened.opener);
        textVisits.push({
          id: source.id,
          path: source.path,
          ...observed.pin,
          lines: decodeText(observed.bytes).split('\n').length,
          maxX,
          maxY,
          end,
          start: 0,
          retry,
          suspendedRgbaSha256: beforeModal.sha256,
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
          $('h1').textContent.trim() === copy['ukraineRoleReview.roles.heading'],
          'Role-study heading trails its selected locale.',
        );
        for (const role of roles) {
          assert(
            $(`#ukraine-role-${role}`).textContent.trim() ===
              copy[`ukraineRoleInput.roles.${role}`],
            `The ${role} section heading trails its selected locale.`,
          );
          assert(
            [...$('#role').options].find((option) => option.value === role)?.textContent ===
              copy[`ukraineRoleInput.roles.${role}`],
            `The ${role} selector choice trails its selected locale.`,
          );
        }
        assert(
          $('#status').textContent === copy['ukraineRoleInput.ready'] &&
            motion.textContent ===
              copy[
                `ukraineRoleInput.${motion.dataset.state === 'reduced' ? 'reducedState' : motion.dataset.state}`
              ],
          'Ready or motion status trails the selected locale.',
        );
        for (const node of doc.querySelectorAll(
          '[data-i18n^="tools:ukraineRoleInput."],[data-i18n^="tools:ukraineRoleReview."]',
        )) {
          const key = node.dataset.i18n.slice('tools:'.length),
            expected = copy[key];
          assert(typeof expected === 'string', `Missing live ${key} translation.`);
          if (expected.includes('{{')) continue;
          assert(
            node.textContent === expected,
            `The live ${key} label trails its selected locale.`,
          );
        }
        const titles = [];
        for (const source of UKRAINE_ROLE_SOURCES) {
          const { opener, title } = await open(source),
            readName = locale === 'uk' ? 'Читати й прокручувати' : 'Read and scroll',
            format = new Intl.NumberFormat(locale, { maximumFractionDigits: 20 }),
            status = copies
              .get(locale)
              .revealSourceReady.replace('{{bytes}}', format.format(source.bytes));
          assert(
            read.getAttribute('aria-label') === `${readName}: ${title}` &&
              $('#reveal-source-status').textContent === status &&
              region.querySelector('pre').textContent === decodeText(sources.get(source.id).bytes),
            'Localized source-reader labels trail their actual title or changed original source bytes.',
          );
          await enterRead();
          await stopRead();
          await close(opener);
          titles.push({ id: source.id, title });
        }
        localeVisits.push({
          locale,
          heading: $('h1').textContent.trim(),
          pause: $('#pause').textContent.trim(),
          readers: roles.map((role) => $(`#ukraine-role-read-${role}`).getAttribute('aria-label')),
          sources: titles,
        });
      }
      assert(
        localeVisits[0].heading !== localeVisits[1].heading &&
          localeVisits[0].pause !== localeVisits[1].pause &&
          localeVisits[0].sources.every(
            (entry, index) => entry.title !== localeVisits[1].sources[index].title,
          ),
        'The study heading, Pause action or source labels did not follow live EN/UK selection.',
      );
      await choosePaused(initialPause);
      assert(
        doc.documentElement.lang === initialLocale &&
          same(currentControls(), initialControls) &&
          ($('#pause').getAttribute('aria-pressed') === 'true') === initialPause,
        'Initial visible locale, motion choice or source-study controls were not restored.',
      );
      for (const [path, pin] of metadata)
        assert(same((await observe(`/${path}`)).pin, pin), `Source viewing changed ${path}.`);
      unchanged();
      p.record(
        'All three original documents remain literal and pinned through bounded reading, Start/End, Retry, exact Back, reopening and live EN/UK; owned modals suspend the observed canvas output',
        '#status',
        {
          sources: textVisits,
          locales: localeVisits,
          metadata: [...metadata].map(([path, pin]) => ({ path, ...pin })),
          boundary:
            'The study is read-only: no project Save/import/export, validation approval, source-art edits, candidate adoption or gameplay changes. Source-language prose remains unchanged. Only explicit locale choice can persist its preference. No network faults or timed cancellation were injected.',
        },
      );

      const returnSelector = '.authoring-reference-rail > a',
        returnURL = new URL($(returnSelector).href),
        galleryLocal = snapshot(win.localStorage),
        gallerySession = snapshot(win.sessionStorage);
      assert(
        returnURL.pathname === '/authoring/asset-studio/' &&
          returnURL.origin === win.location.origin,
        'Direct-entry role study does not return to its real Asset Studio owner.',
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
      p.record('Reference Return loads real Asset Studio; no editor action follows arrival', 'h1', {
        gallery: href,
        destination: win.location.href,
        parentStartupStorage: {
          local: delta(galleryLocal, snapshot(win.localStorage)),
          session: delta(gallerySession, snapshot(win.sessionStorage)),
        },
        boundary:
          'No reciprocal role-study link was established, so reentry is not claimed. Parent startup is outside read-only study storage acceptance. No editor draft inspection, source adoption, OS export, installed-offline or physical-controller qualification.',
      });
    } finally {
      doc.removeEventListener('click', onClick, true);
    }
  },
];
