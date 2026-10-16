// Current single-picture qualification. Commands use real controller owners;
// store/bundle calls below only observe and validate their actual outcomes.
import { importCreatorBundle } from '../../creator/bundle.mjs';
import { createCreatorStore, installedCreatorManifests } from '../../creator/installed.mjs';
import { createCreatorDraftBackend } from '../../creator/drafts.mjs';
import { canonicalJSON } from '../../data-json.mjs';
import { hydrateStoredStillMedia } from '../../media-storage-record.mjs';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const webStorage = (storage) =>
  Array.from({ length: storage.length }, (_, index) => storage.key(index)).map((key) => [
    key,
    storage.getItem(key),
  ]);
async function fingerprint(blob) {
  return {
    bytes: blob.size,
    sha256: [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join(''),
  };
}
const packDownloads = (p) =>
  p.downloads.filter(({ blob }) => blob.type === 'application/vnd.revealline.content');

export const creatorCurrent = [
  'Current Picture Creator: cancel, validate, generate, approve, install, return, export',
  '/game/creator/',
  async (p) => {
    const win = p.doc.defaultView;
    assert(
      win.location.port === '8986' && ['127.0.0.1', 'localhost'].includes(win.location.hostname),
      'Use the dedicated local qualification origin on port 8986; this case retains a new draft and installed pack.',
    );
    await p.wait(() => !p.doc.querySelector('#image').disabled);
    const originalLocal = webStorage(win.localStorage),
      originalSession = webStorage(win.sessionStorage),
      store = createCreatorStore(),
      drafts = createCreatorDraftBackend(store);
    try {
      const beforeMedia = hydrateStoredStillMedia(
          (await store.readDomainMetadata('media')).library,
        ),
        beforeInstalled = await installedCreatorManifests(store),
        draftId = new URL(win.location.href).searchParams.get('draft'),
        originalName = p.doc.querySelector('#name').value;
      assert(
        draftId && !(await drafts.read(draftId)),
        'Fixture must begin with a new draft identity',
      );
      await p.choose('#image');
      await p.pulse('back');
      assert(
        !p.doc.querySelector('.authoring-source-dialog').open,
        'Source chooser did not cancel',
      );
      assert(!p.doc.querySelector('#image').files.length, 'Canceled chooser selected a file');
      assert(p.doc.querySelector('#generate').disabled, 'Canceled chooser enabled generation');
      await p.edit('#name', ['end', 'q'], { cancel: true });
      assert(
        p.doc.querySelector('#name').value === originalName,
        'Canceled name changed the source',
      );
      await p.choose('#image');
      await p.choose('.authoring-source-dialog button', 'Dawn Signal picture');
      await p.wait(() => !p.doc.querySelector('#generate').disabled);
      const selected = p.doc.querySelector('#image').files[0],
        sourceReceipt = await fingerprint(selected);
      await p.edit('#description', ['all', 'backspace']);
      await p.choose('#generate');
      await p.wait(() => p.doc.querySelector('#status').classList.contains('error'));
      assert(
        p.doc.querySelector('#image').files[0] === selected,
        'Rejected metadata lost the selected source',
      );
      assert(p.doc.querySelector('#review').hidden, 'Invalid description produced a review');
      assert(p.doc.querySelector('#approve').disabled, 'Invalid description enabled approval');
      assert(p.doc.querySelector('#install').disabled, 'Invalid description enabled installation');
      assert(!(await drafts.read(draftId)), 'Invalid description saved an invalid checkpoint');
      p.record(
        'Source chooser and name drafts canceled; blank description rejected without losing selected picture, saving a checkpoint or enabling approval',
        '#status',
        { source: { name: selected.name, ...sourceReceipt } },
      );
      await p.edit('#description', ['all', 'q', 'a']);
      await p.choose('#generate');
      await p.wait(
        () =>
          p.visible(p.doc.querySelector('#approve')) && !p.doc.querySelector('#approve').disabled,
        30000,
      );
      const checkpoint = await drafts.read(draftId);
      assert(checkpoint?.revision >= 1, 'Generated source was not saved as a real checkpoint');
      assert(
        checkpoint.source.document.content.project.missions.length === 1,
        'Single picture generated the wrong mission count',
      );
      assert(
        checkpoint.source.document.content.project.assets[0].alt === 'qa',
        'Generated source lost corrected description',
      );
      assert(p.doc.querySelector('#approved').hidden, 'Generation implicitly approved the pack');
      await p.section('#review-title');
      await p.choose('#creator-review-read-0');
      const reading = p.doc.querySelector('#creator-review-reading-0');
      await p.wait(() => reading.getAttribute('data-controller-reading') === 'true');
      const picture = reading.querySelector('img'),
        map = reading.querySelector('canvas');
      await p.wait(() => picture.complete && picture.naturalWidth > 0);
      assert(map.width > 0 && map.height > 0, 'Generated review has no rendered map');
      const reviewTop = reading.scrollTop,
        reviewOverflow = Math.max(0, reading.scrollHeight - reading.clientHeight);
      for (let step = 0; step < 50 && reading.scrollTop < reviewOverflow - 1; step++)
        await p.pulse('down');
      assert(
        reading.scrollTop >= reviewOverflow - 1,
        'Controller reading did not expose the complete generated review',
      );
      await p.pulse('back');
      assert(
        p.doc.activeElement.id === 'creator-review-read-0' &&
          !reading.hasAttribute('data-controller-reading'),
        'Back did not leave reading at its explicit entry',
      );
      assert(p.doc.querySelector('#approved').hidden, 'Reading implicitly approved the pack');
      await p.choose('#approve');
      await p.wait(() => !p.doc.querySelector('#install').disabled, 30000);
      await p.choose('#download');
      await p.wait(() => packDownloads(p).length === 1);
      const firstBlob = packDownloads(p)[0].blob,
        first = await importCreatorBundle(firstBlob),
        firstReceipt = await fingerprint(firstBlob),
        edition = first.editionId;
      assert(
        first.manifest.content.project.missions.length === 1,
        'Export did not retain one mission',
      );
      assert(
        first.manifest.content.project.assets[0].alt === 'qa',
        'Export lost validated picture metadata',
      );
      assert(
        first.manifest.content.project.id === checkpoint.source.document.content.project.id,
        'Export changed the source project identity',
      );
      p.record(
        'Corrected source generated and saved; controller exposed the decoded picture/rendered map and left reading before explicit approval; first export passed actual image/hash/completion-evidence verification',
        '#status',
        {
          review: {
            picture: [picture.naturalWidth, picture.naturalHeight],
            map: [map.width, map.height],
            scrollTopBefore: reviewTop,
            scrollTopAfter: reading.scrollTop,
            overflow: reviewOverflow,
          },
          artifact: { edition, project: first.manifest.content.project.id, ...firstReceipt },
        },
      );
      await p.choose('#install');
      await p.wait(
        () => p.visible(p.doc.querySelector('#play')) && !p.doc.querySelector('#download').disabled,
        30000,
      );
      assert(
        p.doc.activeElement.id === 'play',
        'Successful installation did not restore focus to Play',
      );
      assert(
        new URL(p.doc.querySelector('#play').href).searchParams.get('edition') === edition,
        'Play does not target the exact approved edition',
      );
      const installed = await installedCreatorManifests(store);
      assert(
        installed.some((manifest) => manifest.editionId === edition),
        'Exact edition missing from installed storage',
      );
      await p.follow('#play', '/game/creator/player.html');
      await p.wait(
        () =>
          p.doc.body.dataset.creatorPlayerState === 'menu' &&
          !p.doc.querySelector('#start').disabled,
        30000,
      );
      assert(
        new URL(p.doc.defaultView.location.href).searchParams.get('edition') === edition,
        'Player opened another installed edition',
      );
      assert(
        !p.doc.querySelector('#creator-home').hidden && p.doc.querySelector('#creator-game').hidden,
        'Opening the installed player implicitly started gameplay',
      );
      await p.choose('#creator-open-settings');
      await p.choose('#creator-tab-help');
      // Desktop categories form a vertical rail; Right enters the selected
      // panel. Compact Confirm already drills into it. Down remains in the
      // category group and must not be treated as a universal Tab substitute.
      if (p.doc.activeElement.id === 'creator-tab-help') await p.pulse('right');
      await p.follow('#creator-back-library', '/game/creator/');
      await p.wait(() => !p.doc.querySelector('#image').disabled, 30000);
      const exactRow = `#installed-list .installed-item:has(a[href="./player.html?edition=${edition}"])`;
      await p.section('#installed h2');
      await p.choose(`${exactRow} button`);
      await p.wait(
        () =>
          p.visible(p.doc.querySelector('#approve')) && !p.doc.querySelector('#approve').disabled,
        30000,
      );
      assert(
        p.doc.querySelector('#description').value === 'qa',
        'Installed-source reopen lost picture metadata',
      );
      await p.choose('#approve');
      await p.wait(() => !p.doc.querySelector('#download').disabled, 30000);
      await p.choose('#download');
      await p.wait(() => packDownloads(p).length === 2);
      const finalBlob = packDownloads(p).at(-1).blob,
        final = await importCreatorBundle(finalBlob),
        finalReceipt = await fingerprint(finalBlob);
      assert(
        final.editionId === edition,
        'Reopened export changed the approved installed identity',
      );
      assert(
        finalReceipt.sha256 === firstReceipt.sha256,
        'Reopened export is not the exact same portable pack',
      );
      const afterMedia = hydrateStoredStillMedia((await store.readDomainMetadata('media')).library),
        afterInstalled = await installedCreatorManifests(store),
        retained = new Map(afterMedia.legacy.items.map((row) => [row.id, row]));
      for (const row of beforeMedia.legacy.items)
        assert(
          canonicalJSON(retained.get(row.id)) === canonicalJSON(row),
          `Existing media reference changed: ${row.id}`,
        );
      for (const manifest of beforeInstalled)
        assert(
          afterInstalled.some((next) => canonicalJSON(next) === canonicalJSON(manifest)),
          `Existing installed edition changed: ${manifest.editionId}`,
        );
      for (const [storage, original] of [
        [win.localStorage, originalLocal],
        [win.sessionStorage, originalSession],
      ])
        for (const [key, value] of original)
          assert(storage.getItem(key) === value, `Existing browser storage changed: ${key}`);
      p.record(
        'Installed exact edition, opened paused player, returned through real Settings/My creations, reopened installed source and exported identical validated bytes; prior storage retained',
        '#status',
        {
          artifact: {
            name: `${final.manifest.content.project.id}.rlpack`,
            edition,
            missions: final.manifest.content.project.missions.length,
            ...finalReceipt,
          },
          retainedExisting: {
            installedEditions: beforeInstalled.length,
            mediaReferences: beforeMedia.legacy.items.length,
            localKeys: originalLocal.length,
            sessionKeys: originalSession.length,
          },
          boundary:
            'New qualification drafts and installed edition retained on isolated port 8986 origin. No gameplay or OS file-picker import; OS download and physical-pad receipts are separate.',
        },
      );
    } finally {
      store.close();
    }
  },
];
