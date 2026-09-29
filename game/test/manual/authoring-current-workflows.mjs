// Current qualification cases; legacy cases in the parent runner remain attributed
// to their historical receipts. Every edit below uses the real controller owner.
import { importThemeBundle } from '../../presentation/bundle.mjs';
import { validateScenario } from '../../content.mjs';
import { validateEnemyCatalogDraft } from '../../enemy-catalog.mjs';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
async function fingerprint(blob) {
  const bytes = await blob.arrayBuffer();
  return {
    bytes: bytes.byteLength,
    sha256: [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join(''),
  };
}
const value = (p, css) => p.doc.querySelector(css).value;

export const currentAuthoringCases = {
  enemyCurrent: [
    'Current Enemy Workshop: edit, cancel, validate, save, preview return, export',
    '/authoring/enemy-catalog/',
    async (p) => {
      const win = p.doc.defaultView,
        savedKey = 'revealline.authoring.enemy-catalog.v1',
        practiceKey = 'revealline.playground.current',
        originalSaved = win.localStorage.getItem(savedKey),
        originalPractice = win.sessionStorage.getItem(practiceKey);
      try {
        await p.wait(() => !p.doc.querySelector('#open-catalog').disabled);
        if (!p.doc.querySelector('#enemy-catalog-dialog').open) await p.choose('#open-catalog');
        await p.select('#enemy-catalog-role', 'eroder');
        const initialSkin = value(p, '#enemy-catalog-skin'),
          editedSkin = initialSkin === 'ukraine' ? 'retro' : 'ukraine',
          initialStyle = value(p, '#enemy-catalog-style');
        await p.choose('#enemy-catalog-style');
        await p.pulse('down');
        await p.pulse('back');
        assert(value(p, '#enemy-catalog-style') === initialStyle, 'Canceled style changed choices');
        await p.select('#enemy-catalog-skin', editedSkin);
        await p.select('#enemy-catalog-style', initialStyle === 'props' ? 'hybrid' : 'props');
        if (p.doc.querySelector('#enemy-catalog-enabled').checked)
          await p.choose('#enemy-catalog-enabled');
        assert(p.doc.querySelector('#enemy-catalog-play').disabled, 'Disabled role can launch');
        await p.choose('#enemy-catalog-enabled');
        assert(!p.doc.querySelector('#enemy-catalog-play').disabled, 'Enabled role cannot launch');
        await p.expand('#enemy-catalog-json-section');
        await p.choose('#enemy-catalog-show-json');
        const editedText = value(p, '#enemy-catalog-json'),
          edited = validateEnemyCatalogDraft(JSON.parse(editedText));
        assert(
          edited.entries.find((entry) => entry.type === 'eroder').skinId ===
            `eroder.${editedSkin}.v1`,
          'Registered skin selection was not applied to the actual catalog',
        );
        await p.edit('#enemy-catalog-json', ['end', 'q'], { cancel: true });
        assert(value(p, '#enemy-catalog-json') === editedText, 'Canceled JSON changed the source');
        await p.edit('#enemy-catalog-json', ['end', 'q']);
        await p.choose('#enemy-catalog-apply-json');
        await p.wait(() => p.doc.querySelector('#enemy-catalog-status').dataset.state === 'error');
        assert(win.localStorage.getItem(savedKey) === originalSaved, 'Invalid JSON saved choices');
        await p.choose('#enemy-catalog-show-json');
        assert(value(p, '#enemy-catalog-json') === editedText, 'Invalid JSON replaced the model');
        await p.choose('#enemy-catalog-apply-json');
        await p.wait(() => !p.doc.querySelector('#enemy-catalog-apply').disabled);
        assert(win.localStorage.getItem(savedKey) === originalSaved, 'Import implicitly saved');
        p.record(
          'Registered role/skin/style and availability edited; canceled select/JSON unchanged; invalid JSON rejected without replacing catalog or saving',
          '#enemy-catalog-status',
        );
        await p.choose('#enemy-catalog-apply');
        await p.wait(() => !p.doc.querySelector('#enemy-catalog-apply').disabled);
        const stored = win.localStorage.getItem(savedKey);
        assert(
          JSON.stringify(JSON.parse(stored)) === JSON.stringify(edited),
          'Save differs from draft',
        );
        await p.select('#enemy-catalog-skin', initialSkin);
        await p.choose('#enemy-catalog-undo');
        assert(value(p, '#enemy-catalog-skin') === editedSkin, 'Reload lost saved skin');
        await p.pulse('back');
        assert(!p.doc.querySelector('#enemy-catalog-dialog').open, 'Back did not close workshop');
        await p.choose('#open-catalog');
        await p.choose('#enemy-catalog-show-json');
        assert(value(p, '#enemy-catalog-json') === editedText, 'Reopening changed saved choices');
        p.record(
          'Explicit Save persisted exact choices; Reload and close/reopen retained them',
          '#enemy-catalog-status',
        );
        await p.choose('#enemy-catalog-play');
        await p.wait(() => !p.doc.querySelector('#catalog-practice').hidden);
        await p.wait(() => !p.doc.querySelector('#enemy-catalog-dialog').open);
        await p.wait(
          () =>
            p.doc
              .querySelector('#catalog-practice')
              .contentDocument?.querySelector('#enemy-workshop-return'),
          30000,
        );
        await p.choose('.authoring-preview-enter');
        await p.returnPreview('#catalog-practice', '#enemy-workshop-return');
        await p.wait(() => p.doc.querySelector('#enemy-catalog-dialog').open);
        assert(p.doc.querySelector('#catalog-practice').hidden, 'Practice still owns input');
        assert(p.doc.activeElement.id === 'enemy-catalog-role', 'Return lost catalog focus');
        assert(value(p, '#enemy-catalog-skin') === editedSkin, 'Practice return changed the draft');
        const scenario = JSON.parse(win.sessionStorage.getItem(practiceKey));
        assert(validateScenario(scenario).valid, 'Practice scenario is invalid');
        assert(scenario.level.id === 'catalog-eroder', 'Wrong role was prepared for practice');
        assert(
          win.localStorage.getItem(savedKey) === stored,
          'Preview/return rewrote saved choices',
        );
        await p.choose('#enemy-catalog-export');
        await p.wait(() => p.downloads.some(({ blob }) => blob.type === 'application/json'));
        const blob = p.downloads.filter(({ blob }) => blob.type === 'application/json').at(-1).blob,
          exported = validateEnemyCatalogDraft(JSON.parse(await blob.text()));
        assert(
          JSON.stringify(exported) === JSON.stringify(edited),
          'Export lost exact saved choices',
        );
        p.record(
          'Explicit practice/secure Return restored same catalog; actual export passed strict production validation and matches saved choices',
          '#enemy-catalog-status',
          {
            artifact: {
              name: 'fpv-line-enemy-catalog.json',
              ...(await fingerprint(blob)),
              roles: exported.entries.length,
              version: exported.version,
            },
            boundary:
              'Registered availability/presentation choices only; behavior/geometry are immutable here. OS receipt and physical controller remain separate.',
          },
        );
      } finally {
        // Fixture cleanup only, after observing real Save/export. Never use storage
        // substitution to drive the authoring workflow or alter player progress.
        for (const [storage, key, previous] of [
          [win.localStorage, savedKey, originalSaved],
          [win.sessionStorage, practiceKey, originalPractice],
        ]) {
          if (previous === null) storage.removeItem(key);
          else storage.setItem(key, previous);
          assert(storage.getItem(key) === previous, `Fixture cleanup failed: ${key}`);
        }
        p.record(
          'Fixture cleanup restored exact pre-run catalog and Playground storage bytes',
          '#catalog-host-status',
        );
      }
    },
  ],
  assetCurrent: [
    'Current Asset Studio: cancel, validate, save, reopen, export',
    '/authoring/asset-studio/',
    async (p) => {
      await p.wait(() => !p.doc.querySelector('#save-workspace').disabled);
      await p.section('#slot-title');
      await p.expand('#sprite-panel');
      await p.choose('#new-sprite');
      await p.select('#sprite-tool', 'line');
      await p.choose('#sprite-canvas');
      await p.pulse('confirm');
      const anchored = p.doc.querySelector('#sprite-cursor').textContent;
      await p.pulse('right');
      const pending = p.doc.querySelector('#sprite-cursor').textContent;
      await p.pulse('back');
      assert(p.doc.activeElement.id === 'sprite-canvas', 'First Back left a pending line');
      assert(p.doc.querySelector('#sprite-undo').disabled, 'Canceled line entered Undo history');
      assert(
        p.doc.querySelector('#sprite-cursor').textContent !== pending && anchored.length > 0,
        'Canceled anchor feedback remained visible',
      );
      await p.pulse('confirm');
      assert(p.doc.querySelector('#sprite-undo').disabled, 'New anchor committed a canceled line');
      await p.pulse('down');
      await p.pulse('confirm');
      assert(!p.doc.querySelector('#sprite-undo').disabled, 'Confirmed line was not recorded');
      await p.pulse('back');
      await p.choose('#sprite-undo');
      assert(
        p.doc.querySelector('#sprite-undo').disabled &&
          !p.doc.querySelector('#sprite-redo').disabled,
        'Undo did not restore the blank sprite',
      );
      await p.choose('#sprite-redo');
      p.record(
        'Pending line canceled without editing; fresh line committed and Undo/Redo restored it',
        '#sprite-cursor',
      );
      await p.choose('#use-sprite');
      await p.wait(() => !p.doc.querySelector('#stage-asset').disabled);
      await p.section('#slot-title');
      const summary = p.doc.querySelector('#workspace-summary').textContent;
      await p.choose('#stage-asset');
      await p.wait(() => p.doc.querySelector('#studio-status').dataset.state === 'error');
      assert(
        !p.doc.querySelector('#stage-asset').disabled,
        'Invalid provenance discarded the candidate',
      );
      assert(
        p.doc.querySelector('#workspace-summary').textContent === summary,
        'Invalid provenance staged a revision',
      );
      await p.section('#slot-title');
      const creator = value(p, '#asset-creator');
      await p.edit('#asset-creator', ['q'], { cancel: true });
      assert(value(p, '#asset-creator') === creator, 'Canceled text draft changed provenance');
      await p.edit('#asset-creator', ['all', 'q', 'a']);
      await p.edit('#asset-license', ['all', 'o', 'w', 'n']);
      await p.choose('#stage-asset');
      await p.wait(() => p.doc.querySelector('#stage-asset').disabled);
      assert(!p.doc.querySelector('#reset-draft').disabled, 'Valid replacement was not staged');
      p.record(
        'Missing provenance rejected without revision; canceled text stayed unchanged; valid provenance staged',
        '#studio-status',
      );
      await p.pageActions();
      await p.choose('#save-workspace');
      await p.wait(
        () =>
          p.doc.querySelector('#reset-draft').disabled &&
          !p.doc.querySelector('#save-workspace').disabled,
      );
      const savedSummary = p.doc.querySelector('#workspace-summary').textContent;
      await p.choose('#reload-workspace');
      await p.wait(() => !p.doc.querySelector('#reload-workspace').disabled);
      assert(
        p.doc.querySelector('#workspace-summary').textContent === savedSummary,
        'Reopened workspace changed the saved revision',
      );
      await p.pageActions();
      await p.choose('#export-workspace');
      await p.wait(() => p.visible(p.doc.querySelector('#prepared-download a')), 30000);
      const link = p.doc.querySelector('#prepared-download a'),
        blob = await (await fetch(link.href)).blob(),
        accepted = await importThemeBundle(blob),
        receipt = await fingerprint(blob);
      assert(
        accepted.imagesDecoded && accepted.assets.size > 0,
        'Theme export did not pass actual image verification',
      );
      assert(
        accepted.document.assets.some(
          (asset) => asset.provenance.creator === 'qa' && asset.provenance.license === 'own',
        ),
        'Export lost the edited asset provenance',
      );
      p.record(
        'Saved revision reopened; requested theme download passed the actual bundle/hash/image validator',
        '#studio-status',
        {
          artifact: {
            name: link.download,
            ...receipt,
            assets: accepted.assets.size,
            revision: accepted.document.revision,
          },
          boundary:
            'Prepared export bytes verified; OS download receipt and physical pad remain separate.',
        },
      );
    },
  ],
  playgroundCurrent: [
    'Current Mission Playground: edit, invalid JSON, reopen, preview return, export',
    '/game/playground/',
    async (p) => {
      await p.wait(
        () =>
          !p.doc.querySelector('#preview-button').disabled &&
          p.doc.querySelector('#level-json').value,
      );
      const original = value(p, '#level-json'),
        preview = p.doc.querySelector('#preview-frame').src;
      await p.choose('#map-editor');
      await p.pulse('right');
      await p.pulse('down');
      await p.pulse('confirm');
      await p.pulse('back');
      assert(value(p, '#level-json') !== original, 'Map paint did not change the level');
      await p.choose('#undo-button');
      assert(value(p, '#level-json') === original, 'Undo did not restore the exact level');
      await p.choose('#map-editor');
      await p.pulse('confirm');
      await p.pulse('back');
      const edited = value(p, '#level-json');
      assert(edited !== original, 'Second map edit was not recorded');
      await p.choose('#export-button');
      await p.wait(() => p.downloads.some(({ blob }) => blob.type === 'application/json'));
      const complete = value(p, '#pack-json');
      await p.edit('#pack-json', ['end', 'a'], { cancel: true });
      assert(value(p, '#pack-json') === complete, 'Canceled JSON draft changed the source');
      await p.edit('#pack-json', ['end', 'a']);
      await p.choose('#apply-pack');
      await p.wait(() => p.doc.querySelector('#editor-status').classList.contains('error'));
      assert(value(p, '#level-json') === edited, 'Invalid JSON replaced the edited model');
      assert(
        p.doc.querySelector('#preview-frame').src === preview,
        'Rejected JSON launched or replaced the preview',
      );
      await p.choose('#show-pack');
      assert(
        value(p, '#pack-json') === complete,
        'Rejected JSON changed the authoritative complete pack',
      );
      await p.choose('#apply-pack');
      await p.wait(
        () =>
          !p.doc.querySelector('#apply-pack').disabled &&
          !p.doc.querySelector('#editor-status').classList.contains('error'),
      );
      assert(
        value(p, '#level-json') === edited,
        'Validated complete JSON did not reopen the exact edit',
      );
      p.record(
        'Map edit/Undo restored exact state; canceled JSON stayed unchanged; invalid JSON rejected; complete pack reopened through validation',
        '#editor-status',
      );
      await p.choose('#preview-button');
      await p.wait(() => p.doc.querySelector('#preview-frame').src !== preview);
      await p.choose('.authoring-preview-enter');
      await p.wait(() => p.doc.activeElement.id === 'preview-frame');
      // The runner returns through the child's actual Return action while finding
      // this parent target; no direct parent focus or domain call is made.
      await p.choose('#export-button');
      assert(
        p.doc.activeElement.tagName !== 'IFRAME',
        'Preview retained keyboard/controller ownership',
      );
      const exports = p.downloads.filter(({ blob }) => blob.type === 'application/json'),
        blob = exports.at(-1).blob,
        json = JSON.parse(await blob.text()),
        accepted = validateScenario(json);
      assert(accepted.valid, `Final scenario invalid: ${accepted.errors.join('; ')}`);
      assert(
        exports.length >= 2 && json.level.id === JSON.parse(edited).id,
        'Final export lost the edited scenario',
      );
      assert(
        JSON.stringify(json) === JSON.stringify(JSON.parse(value(p, '#pack-json'))),
        'Actual downloaded JSON differs from visible complete source',
      );
      p.record(
        'Explicit practice preview entered and Return restored parent ownership; final download bytes passed the scenario validator',
        '#editor-status',
        {
          artifact: {
            ...(await fingerprint(blob)),
            level: json.level.id,
            format: json.format,
          },
          boundary:
            'JSON re-open uses the visible complete pack. OS file picker, OS download receipt, and physical pad remain separate.',
        },
      );
    },
  ],
};
