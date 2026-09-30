// Current Team Creator qualification. Only real controller commands change the
// tool; store reads and the production importer verify their actual outcomes.
import { canonicalJSON } from '../../data-json.mjs';
import { createCreatorStore } from '../../creator/installed.mjs';
import { createInstalledTeamCampaignStore } from '../../creator/team-installed.mjs';
import {
  CREATOR_TEAM_MEDIA_MIME,
  exportCreatorTeamMediaCampaign,
  importCreatorTeamMediaCampaign,
} from '../../creator/team-media.mjs';
import { CREATOR_TEAM_TEMPLATES } from '../../creator/team.mjs';
import { MISSION_LIBRARY_STATE_PREFIX } from '../../mission-library/handoff.mjs';
import { libraryMissionId } from '../../mission-library/library.mjs';
import { hydrateStoredStillMedia } from '../../media-storage-record.mjs';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const snapshotStorage = (storage) =>
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
const downloads = (p) => p.downloads.filter(({ blob }) => blob.type === CREATOR_TEAM_MEDIA_MIME);
const card = (index) => `#team-levels .team-level-card:nth-child(${index + 1})`;
const pictureInput = (index) => `${card(index)} input[accept^="image"]`;
const altInput = (index) => `${card(index)} input[type="text"]`;
const editionRecord = ({ payload: _payload, ...record }) => record;

export const teamCreatorCurrent = [
  'Current Team Creator: cancel, review, install, reopen, export and find missions',
  '/game/creator/team.html',
  async (p) => {
    const win = p.doc.defaultView;
    assert(
      win.location.port === '8987' && ['127.0.0.1', 'localhost'].includes(win.location.hostname),
      'Use the dedicated local qualification origin on port 8987; this case retains a new installed Team pack.',
    );
    await p.wait(() => !p.doc.querySelector('#generate').disabled);
    // The inspection store has no managed-ledger writer. Only the production
    // UI installs; inventory/load validate persisted bytes without reconciling.
    const store = createInstalledTeamCampaignStore({ managedStore: null }),
      shared = createCreatorStore(),
      originalLocal = snapshotStorage(win.localStorage),
      originalSession = snapshotStorage(win.sessionStorage),
      libraryKey = `${MISSION_LIBRARY_STATE_PREFIX}.team`,
      originalLibrary = win.sessionStorage.getItem(libraryKey);
    const restoreLibrary = () => {
      // Fixture cleanup of browsing state, not an application input command.
      if (originalLibrary === null) win.sessionStorage.removeItem(libraryKey);
      else win.sessionStorage.setItem(libraryKey, originalLibrary);
    };
    try {
      const before = await store.inventory(),
        beforeMedia = hydrateStoredStillMedia((await shared.readDomainMetadata('media')).library),
        initialName = p.doc.querySelector('#campaign-name').value,
        id = `teamqa${[...crypto.getRandomValues(new Uint8Array(8))]
          .map((byte) => String.fromCharCode(97 + (byte % 26)))
          .join('')}`;
      await p.edit('#campaign-name', ['end', 'q'], { cancel: true });
      assert(
        p.doc.querySelector('#campaign-name').value === initialName,
        'Canceled campaign name changed the input',
      );
      await p.choose('#seed');
      await p.choose('[data-editor-action="+1"]');
      await p.pulse('back');
      assert(p.doc.querySelector('#seed').value === '0', 'Canceled seed draft changed generation');
      await p.edit('#campaign-id', ['all', ...id]);
      await p.edit('#campaign-name', ['all', 'backspace']);
      await p.choose('#generate');
      await p.wait(() => p.doc.querySelector('#status').classList.contains('error'));
      assert(
        p.doc.querySelector('#media-panel').hidden,
        'Invalid campaign exposed generated levels',
      );
      assert(p.doc.querySelector('#approval-panel').hidden, 'Invalid campaign exposed approval');
      await p.edit('#campaign-name', ['all', ...id]);
      await p.field('#seed', '+1');
      assert(
        p.doc.querySelector('#seed').value === '1',
        'Seed did not commit through number editor',
      );
      await p.choose('#generate');
      await p.wait(
        () =>
          !p.doc.querySelector('#media-panel').hidden && !p.doc.querySelector('#review').disabled,
        30000,
      );
      assert(
        p.doc.querySelectorAll('#team-levels .team-level-card').length === 2,
        'Expected two verified Team levels',
      );
      await p.choose(pictureInput(0));
      await p.pulse('back');
      assert(
        !p.doc.querySelector(pictureInput(0)).files.length,
        'Canceled picture chooser assigned a file',
      );
      await p.choose('#review');
      await p.wait(() => p.doc.querySelector('#status').classList.contains('error'));
      assert(
        p.doc.querySelector('#approval-panel').hidden,
        'Missing pictures produced an approvable package',
      );
      assert(p.doc.querySelector('#download').disabled, 'Missing pictures enabled export');
      for (let index = 0; index < 2; index++) {
        await p.choose(pictureInput(index));
        await p.choose('.authoring-source-dialog button', 'Dawn Signal picture');
        await p.wait(() => p.doc.querySelector(pictureInput(index)).files.length === 1);
      }
      const selected = [0, 1].map((index) => p.doc.querySelector(pictureInput(index)).files[0]);
      await p.choose(`${card(0)} select`);
      await p.pulse('down');
      await p.pulse('back');
      assert(
        p.doc.querySelector(`${card(0)} select`).value === 'contain',
        'Canceled fit changed picture processing',
      );
      await p.select(`${card(0)} select`, 'cover');
      await p.edit(altInput(0), ['all', 'backspace']);
      await p.choose('#review');
      await p.wait(() => p.doc.querySelector('#status').classList.contains('error'));
      assert(
        p.doc.querySelector('#approval-panel').hidden,
        'Blank picture description was approved',
      );
      assert(p.doc.querySelector('#download').disabled, 'Invalid review enabled export');
      for (let index = 0; index < 2; index++)
        assert(
          p.doc.querySelector(pictureInput(index)).files[0] === selected[index],
          'Rejected description replaced an assigned picture',
        );
      p.record(
        'Campaign/seed/source/fit drafts canceled; invalid campaign, missing pictures and blank description rejected without publishing approval or replacing selected media',
        '#status',
        { campaign: id, seed: 1, generatedLevels: 2 },
      );

      await p.edit(altInput(0), ['all', 'q', 'a']);
      await p.choose('#review');
      await p.wait(
        () =>
          !p.doc.querySelector('#approval-panel').hidden &&
          !p.doc.querySelector('#approve').disabled,
        30000,
      );
      assert(p.doc.querySelector('#download').disabled, 'Preparing review implicitly approved it');
      // Reader selectors are supplied by the shared production review adapter.
      const review = [];
      for (let index = 0; index < 2; index++) {
        await p.choose(`#creator-review-read-${index}`);
        const region = p.doc.querySelector(`#creator-review-reading-${index}`);
        await p.wait(() => region.getAttribute('data-controller-reading') === 'true');
        const image = region.querySelector('img');
        await p.wait(() => image.complete && image.naturalWidth > 0);
        assert(
          image.naturalWidth === 1152 && image.naturalHeight === 576,
          'Team review image has incorrect decoded dimensions',
        );
        const max = Math.max(0, region.scrollHeight - region.clientHeight);
        for (let step = 0; step < 50 && region.scrollTop < max - 1; step++) await p.pulse('down');
        assert(region.scrollTop >= max - 1, 'Controller could not expose the complete Team review');
        await p.pulse('back');
        assert(
          p.doc.activeElement.id === `creator-review-read-${index}`,
          'Review Back lost its entry',
        );
        assert(!region.hasAttribute('data-controller-reading'), 'Review remained owned after Back');
        review.push({
          image: [image.naturalWidth, image.naturalHeight],
          overflow: max,
          scrollTop: region.scrollTop,
        });
      }
      assert(
        p.doc.querySelector('#download').disabled,
        'Reading implicitly approved the Team package',
      );
      await p.choose('#approve');
      await p.wait(() => !p.doc.querySelector('#download').disabled);
      await p.choose('#download');
      await p.wait(() => downloads(p).length === 1);
      const blob = downloads(p)[0].blob,
        prepared = await importCreatorTeamMediaCampaign(blob),
        artifact = await fingerprint(blob),
        edition = artifact.sha256;
      assert(
        prepared.pack.id === id && prepared.pack.levels.length === 2,
        'Export changed generated Team identity',
      );
      assert(prepared.provenance.generationSeed === 1, 'Export lost the edited generation seed');
      assert(
        canonicalJSON(prepared.provenance.levels.map((level) => level.templateId)) ===
          canonicalJSON([...CREATOR_TEAM_TEMPLATES].reverse().map((template) => template.id)),
        'Seed edit did not preserve the reversed cooperative template order',
      );
      assert(
        prepared.evidence.length === 12,
        'Export lacks the twelve verified difficulty/preset routes',
      );
      assert(
        prepared.manifest.bindings.length === 2 &&
          prepared.manifest.bindings.every((binding) => !binding.story),
        'Picture-only export changed level bindings or added video',
      );
      p.record(
        'Both reviewed pictures decoded and controller reading returned without approval; separate approval exported a production-validated two-level pack with edited template order and twelve replay-verified routes',
        '#status',
        { review, artifact: { name: `${id}.rlteammedia`, edition, ...artifact } },
      );

      await p.choose('#install');
      await p.wait(
        () => p.visible(p.doc.querySelector('#play')) && !p.doc.querySelector('#download').disabled,
        30000,
      );
      assert(p.doc.activeElement.id === 'play', 'Successful Team installation did not focus Play');
      const installed = await store.load(edition);
      assert(
        installed.media && installed.editionId === edition,
        'Exact installed media edition could not be reopened',
      );
      const reopened = await fingerprint(exportCreatorTeamMediaCampaign(installed.media));
      assert(
        reopened.sha256 === edition && reopened.bytes === artifact.bytes,
        'Reopened installed pack differs from the exported bytes',
      );
      await p.choose('#refresh-installed');
      await p.wait(() => !p.doc.querySelector('#refresh-installed').disabled, 30000);
      await p.choose(`[data-team-edition="${edition}"]`);
      await p.wait(() => !p.doc.querySelector('#review').disabled, 30000);
      assert(
        p.doc.querySelector('#campaign-id').value === id &&
          p.doc.querySelector('#seed').value === '1',
        'Installed campaign reopened a different identity or seed',
      );
      for (let index = 0; index < 2; index++)
        assert(
          !p.doc.querySelector(pictureInput(index)).files.length,
          'Installed reopening falsely populated a private source File',
        );
      assert(p.doc.querySelector('#download').disabled, 'Reopening implicitly approved export');
      await p.choose('#review');
      await p.wait(() => !p.doc.querySelector('#approve').disabled, 30000);
      assert(p.doc.querySelector('#download').disabled, 'Re-review implicitly approved export');
      await p.choose('#approve');
      await p.choose('#download');
      await p.wait(() => downloads(p).length === 2);
      const secondBlob = downloads(p)[1].blob,
        second = await fingerprint(secondBlob),
        secondPrepared = await importCreatorTeamMediaCampaign(secondBlob);
      assert(
        second.sha256 === edition &&
          second.bytes === artifact.bytes &&
          secondPrepared.pack.id === id,
        'Actual installed UI reopening/export changed the verified portable bytes',
      );
      p.record(
        'Install focused Play; the exact installed row restored public fields and runtime pictures with empty source inputs; separate review and approval exported identical production-validated bytes',
        '#status',
        { artifact: { name: `${id}.rlteammedia`, edition, ...artifact }, secondExport: second },
      );

      // Reinstalling the exact approved edition is idempotent and restores the
      // real Open Team action after the explicit installed-package review.
      await p.choose('#install');
      await p.wait(() => p.visible(p.doc.querySelector('#play')), 30000);
      assert(p.doc.activeElement.id === 'play', 'Reinstallation did not retain Play ownership');
      await p.follow('#play', '/game/couch/relay-rescue.html');
      await p.wait(
        () =>
          p.doc.documentElement.dataset.toolState === 'ready' &&
          !p.doc.querySelector('#coop-discovery-open')?.disabled,
        60000,
      );
      // The existing Team router consumes its first Confirm as a join edge.
      await p.pulse('confirm');
      assert(!p.doc.querySelector('#coop-menu').hidden, 'Opening Team implicitly started a run');
      await p.choose('#coop-discovery-open');
      await p.wait(() => p.doc.querySelector('#journey-chooser')?.open, 60000);
      await p.expand('#journey-filter-details');
      await p.select('#journey-mode', 'team');
      await p.select('#journey-collection', 'Custom');
      await p.select('#journey-lifecycle', '');
      await p.select('#journey-campaign', '');
      await p.edit('#journey-search', ['all', ...id]);
      const missionId = libraryMissionId({
        owner: `team-installed:${edition}`,
        edition,
        campaign: id,
        mission: prepared.pack.levels[0].id,
        revision: prepared.pack.revision,
      });
      await p.navigate(`[data-mission-id="${win.CSS.escape(missionId)}"]`);
      assert(
        p.doc.activeElement.dataset.missionId === missionId &&
          p.doc.activeElement.dataset.availabilityState === 'ready',
        'The exact installed Team mission is not ready and selected',
      );
      assert(
        !p.doc.querySelector('#coop-menu').hidden,
        'Selecting a card implicitly started a run',
      );
      await p.pulse('back');
      await p.wait(() => !p.doc.querySelector('#journey-chooser').open);
      assert(
        !p.doc.querySelector('#coop-menu').hidden &&
          p.doc.activeElement.id === 'coop-discovery-open',
        'Library Back did not restore the unchanged Team landing and its opener',
      );
      restoreLibrary();
      const after = await store.inventory(),
        afterMedia = hydrateStoredStillMedia((await shared.readDomainMetadata('media')).library);
      for (const old of before.editions) {
        const current = after.editions.find((row) => row.editionId === old.editionId);
        assert(
          current && canonicalJSON(editionRecord(current)) === canonicalJSON(editionRecord(old)),
          `Existing Team edition or progress changed: ${old.editionId}`,
        );
      }
      // Team bytes live in their own database/managed usage ledger. This
      // journey must leave the complete shared media document unchanged,
      // including rich still owners/assignments and retained byte references.
      assert(
        canonicalJSON(afterMedia) === canonicalJSON(beforeMedia),
        'Existing shared media owners, assets, assignments or retained references changed',
      );
      for (const [storage, original] of [
        [win.localStorage, originalLocal],
        [win.sessionStorage, originalSession],
      ])
        for (const [key, value] of original)
          assert(storage.getItem(key) === value, `Existing browser storage changed: ${key}`);
      p.record(
        'Open Team stayed on its landing; Select Mission found the exact installed card without starting it, Back restored Select Mission, and prior editions, progress, media and browser state were retained',
        '#coop-start',
        {
          artifact: { name: `${id}.rlteammedia`, edition, ...artifact },
          selectedMission: missionId,
          retainedExisting: {
            teamEditions: before.editions.length,
            mediaReferences: beforeMedia.legacy.items.length,
            stillAssets: beforeMedia.library.assets.length,
            stillAssignments: beforeMedia.library.assignments.length,
            localKeys: originalLocal.length,
            sessionKeys: originalSession.length,
          },
          boundary:
            'Installed reopening restores public fields and verified runtime media, not private original images or crop history. No dedicated Team-to-Creator return exists. Video, gameplay, OS file-picker import and physical-controller input remain separate gates.',
        },
      );
    } finally {
      restoreLibrary();
      store.close();
      shared.close();
    }
  },
];
