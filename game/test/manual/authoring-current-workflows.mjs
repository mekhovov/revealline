// Current qualification cases; legacy cases in the parent runner remain attributed
// to their historical receipts. Every edit below uses the real controller owner.
import { importThemeBundle } from '../../presentation/bundle.mjs';
import { validateScenario } from '../../content.mjs';

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
