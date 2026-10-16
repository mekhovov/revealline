// Test-only current qualification. Application edits, saves and downloads use
// real shared controller commands. Store reads/importers only inspect outcomes.
import { canonicalJSON } from '../../data-json.mjs';
import { createManagedMediaStore } from '../../managed-media-store.mjs';
import { createStillMediaStore } from '../../media-store.mjs';
import { exportMediaBundle, importMediaBundle } from '../../media-bundle.mjs';
import { exportStoryBundle, importStoryBundle } from '../../story-bundle.mjs';
import { snapshotPictureChoice } from '../../presentation-pins.mjs';
import { campaignKey } from '../../library.mjs';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const same = (a, b) => canonicalJSON(a) === canonicalJSON(b);
const storageSnapshot = (storage) =>
  Array.from({ length: storage.length }, (_, index) => storage.key(index)).map((key) => [
    key,
    storage.getItem(key),
  ]);
const retains = (before, after, label) => {
  for (const old of before)
    assert(
      after.some((row) => same(row, old)),
      `Existing ${label} changed or disappeared`,
    );
};
export function assertStillOwnerPreservation(before, after, target) {
  const oldOwners = new Map(before.map((owner) => [campaignKey(owner.campaign), owner])),
    newOwners = new Map(after.map((owner) => [campaignKey(owner.campaign), owner])),
    expectedKeys = new Set([...oldOwners.keys(), target.campaign]);
  assert(
    newOwners.size === after.length && same([...newOwners.keys()].sort(), [...expectedKeys].sort()),
    'Historical campaign owners disappeared or unrelated owners were added',
  );
  for (const [key, owner] of newOwners) {
    const old = oldOwners.get(key),
      expectedThemes = new Set(old?.themeIds ?? []);
    if (old)
      assert(same(owner.campaign, old.campaign), 'Existing historical campaign content changed');
    if (key === target.campaign) expectedThemes.add(target.theme);
    // Saving a new world legitimately expands this owner's validation context.
    // Only that selected theme may be added; every historical theme is retained.
    assert(
      same([...owner.themeIds].sort(), [...expectedThemes].sort()),
      'Historical owner themes were removed or unrelated themes were added',
    );
  }
}
async function fingerprint(blob) {
  return {
    bytes: blob.size,
    sha256: [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join(''),
  };
}

export const stillCurrent = [
  'Current Pictures & Stories: cancel, validate, save, reopen and export exact originals',
  '/authoring/still-media/',
  async (p) => {
    const win = p.doc.defaultView,
      $ = (selector) => p.doc.querySelector(selector),
      field = (name) => `#still-media-${name}`,
      story = (name) => field(`story-${name}`),
      value = (selector) => $(selector).value;
    assert(
      win.location.port === '8989' && ['127.0.0.1', 'localhost'].includes(win.location.hostname),
      'Use the dedicated qualification origin on port 8989; this case retains a new picture assignment and optional story.',
    );
    await p.wait(() => !$('#still-host-open').disabled, 30000);
    if (!$('#still-media-dialog')?.open) await p.choose('#still-host-open');
    await p.wait(() => !$(field('campaign')).disabled && !$(field('reload')).disabled, 30000);
    // The production host creates/opens its own compatible manager first. This
    // independent handle never stages, commits, restores or deletes a domain.
    const manager = createManagedMediaStore({ storyMedia: true, soundtrackCatalogue: true }),
      store = createStillMediaStore({ managedStore: manager }),
      originalLocal = storageSnapshot(win.localStorage),
      originalSession = storageSnapshot(win.sessionStorage);
    try {
      const before = await store.readMetadata(),
        beforeAudio = await manager.readDomainMetadata('audio'),
        beforeStory = await manager.readDomainMetadata('story'),
        initialContext = ['campaign', 'level', 'theme'].map((key) => value(field(key)));
      const mediaUnchanged = async (baseline = before) =>
        assert(same(await store.readMetadata(), baseline), 'Unsaved work changed picture storage');
      const storyUnchanged = async (baseline = beforeStory) =>
        assert(
          same(await manager.readDomainMetadata('story'), baseline),
          'Unsaved work changed story storage',
        );
      // Never replace another test/player assignment, including an in-progress
      // native run on the initially displayed First Signal / FPV selection.
      let target = null;
      const campaignValues = [...$(field('campaign')).options].map((option) => option.value);
      for (const campaign of campaignValues) {
        if (value(field('campaign')) !== campaign) await p.select(field('campaign'), campaign);
        const levels = [...$(field('level')).options].map((option) => option.value).reverse(),
          themes = [...$(field('theme')).options].map((option) => option.value).reverse();
        for (const level of levels) {
          const theme = themes.find(
            (theme) =>
              !same([campaign, level, theme], initialContext) &&
              !before.document.library.presentations.some(
                ({ identity }) =>
                  identity.baseCampaignKey === campaign &&
                  identity.levelId === level &&
                  identity.themeId === theme,
              ),
          );
          if (theme) {
            target = { campaign, level, theme };
            break;
          }
        }
        if (target) break;
      }
      assert(target, 'No unassigned map/world remains for a non-destructive qualification');
      await p.select(field('level'), target.level);
      await p.select(field('theme'), target.theme);
      assert(!$(field('history')).options.length, 'Chosen context already has picture history');
      await p.choose(field('theme'));
      await p.pulse('down');
      await p.pulse('back');
      assert(value(field('theme')) === target.theme, 'Canceled world selection changed context');
      await p.choose(field('file'));
      await p.pulse('back');
      assert(!$(field('file')).files.length, 'Canceled picture source assigned a file');
      await p.choose(field('file'));
      await p.choose('.authoring-source-dialog button', 'Dawn Signal picture');
      await p.wait(() => $(field('file')).files.length === 1);
      const selectedPicture = $(field('file')).files[0],
        pictureSource = await fingerprint(selectedPicture),
        oldCredit = value(field('credit'));
      await p.edit(field('credit'), ['end', 'q'], { cancel: true });
      assert(value(field('credit')) === oldCredit, 'Canceled credit draft changed provenance');
      for (const name of ['credit', 'source', 'description'])
        if (value(field(name))) await p.edit(field(name), ['all', 'backspace']);
      await p.choose(field('preview'));
      await p.wait(() => $(field('status')).dataset.state === 'error');
      assert($(field('save')).disabled, 'Missing provenance produced a savable picture');
      await mediaUnchanged();
      await p.edit(field('credit'), [...'qa']);
      await p.edit(field('source'), [...'bundled']);
      await p.choose(field('preview'));
      await p.wait(() => $(field('status')).dataset.state === 'error');
      assert($(field('save')).disabled, 'Blank picture description produced a savable draft');
      assert($(field('file')).files[0] === selectedPicture, 'Validation replaced the source File');
      await mediaUnchanged();
      await p.edit(field('description'), [...'menuqa']);
      await p.choose(field('preview'));
      await p.wait(() => !$(field('save')).disabled, 30000);
      await mediaUnchanged();
      await storyUnchanged();
      p.record(
        'Canceled world, source and credit drafts retained values; missing provenance and description rejected; verified picture preview remained unsaved',
        field('status'),
        { target, pictureSource, generationBefore: before.generation },
      );

      await p.choose(field('save'));
      await p.wait(() => $(field('save')).disabled && !$(field('reload')).disabled, 30000);
      assert(
        p.doc.activeElement.id === 'still-media-show-saved',
        'Picture Save lost successor focus',
      );
      const saved = await store.readMetadata(),
        presentation = saved.document.library.presentations.find(
          ({ identity }) =>
            identity.baseCampaignKey === target.campaign &&
            identity.levelId === target.level &&
            identity.themeId === target.theme,
        ),
        asset = saved.document.library.assets.find(
          (row) => row.id === presentation?.poster.assetId,
        );
      assert(
        saved.generation === before.generation + 1,
        'Picture Save did not commit one generation',
      );
      assert(presentation?.revision === 1 && asset, 'New exact picture revision is missing');
      assert(
        asset.sha256 === pictureSource.sha256 && asset.bytes === pictureSource.bytes,
        'Picture Save changed original bytes',
      );
      const pin = snapshotPictureChoice({
        kind: 'still',
        identity: presentation.identity,
        presentationId: presentation.id,
        presentationRevision: presentation.revision,
        assetId: asset.id,
        sha256: asset.sha256,
      });
      assert(
        value(field('history')) === JSON.stringify([presentation.id, 1]),
        'Saved history did not select exact revision',
      );

      await p.choose(story('file'));
      await p.pulse('back');
      assert(!$(story('file')).files.length, 'Canceled video source assigned a file');
      await p.choose(story('file'));
      await p.choose('.authoring-source-dialog button', 'Dawn Signal video');
      await p.wait(() => $(story('file')).files.length === 1);
      const selectedVideo = $(story('file')).files[0],
        videoSource = await fingerprint(selectedVideo);
      await p.choose(story('inspect'));
      await p.wait(() => !$(story('prepare')).disabled, 30000);
      const originalStart = value(story('start')),
        originalEnd = value(story('end')),
        originalDescription = value(story('description'));
      await p.choose(story('start'));
      await p.choose('[data-editor-action="+1"]');
      await p.pulse('back');
      assert(value(story('start')) === originalStart, 'Canceled story time changed its segment');
      await p.edit(story('description'), ['end', 'q'], { cancel: true });
      assert(
        value(story('description')) === originalDescription,
        'Canceled story description changed',
      );
      await p.edit(story('description'), ['all', ...'storyqa']);
      const replaceNumber = async (selector, next) => {
        await p.choose(selector);
        await p.choose('[data-editor-action="all"]');
        for (const char of next) await p.choose(`[data-editor-action="${char}"]`);
        await p.choose('[data-editor-action="done"]');
      };
      await replaceNumber(story('end'), '0');
      await p.choose(story('prepare'));
      await p.wait(() => $(story('status')).dataset.state === 'error');
      assert($(story('save')).disabled, 'Empty story segment produced a savable review');
      await storyUnchanged();
      await replaceNumber(story('end'), originalEnd);
      await p.edit(story('description'), ['all', 'backspace']);
      await p.choose(story('prepare'));
      await p.wait(() => $(story('status')).dataset.state === 'error');
      assert($(story('save')).disabled, 'Blank story description produced a savable review');
      assert($(story('file')).files[0] === selectedVideo, 'Story rejection replaced source video');
      await storyUnchanged();
      await p.edit(story('description'), [...'storyqa']);
      await p.choose(story('prepare'));
      await p.wait(() => !$(story('save')).disabled, 30000);
      await storyUnchanged();
      await p.choose(story('save'));
      await p.wait(() => $(story('save')).disabled && !$(field('reload')).disabled, 30000);
      assert(
        p.doc.activeElement.id === 'still-media-story-history',
        'Story Save lost successor focus',
      );
      const savedStory = await manager.readDomainMetadata('story'),
        descriptor = savedStory.library.stories.find((row) => same(row.picturePin, pin));
      assert(
        savedStory.generation === beforeStory.generation + 1,
        'Story Save did not commit one generation',
      );
      assert(
        descriptor &&
          descriptor.source.sha256 === videoSource.sha256 &&
          descriptor.source.bytes === videoSource.bytes,
        'Saved story lost exact original video',
      );
      assert(
        descriptor.segment.startSeconds === Number(originalStart) &&
          descriptor.segment.endSeconds === Number(originalEnd),
        'Saved story lost the corrected segment',
      );
      assert(
        savedStory.library.bindings.some(
          (row) =>
            same(row.picturePin, pin) &&
            row.story?.id === descriptor.id &&
            row.story.revision === descriptor.revision,
        ),
        'Saved story binding targets a different picture revision',
      );
      await mediaUnchanged(saved);
      p.record(
        'Real silent video inspection succeeded; canceled source/time/text and rejected empty segment/description did not save. Separate Prepare then Save retained exact original bytes and the saved picture pin; both Save actions restored enabled successor focus',
        story('status'),
        {
          pin,
          videoSource,
          story: {
            id: descriptor.id,
            revision: descriptor.revision,
            segment: descriptor.segment,
            source: descriptor.source,
          },
          mediaGeneration: saved.generation,
          storyGeneration: savedStory.generation,
        },
      );

      const exportOriginals = async () => {
        const result = {};
        for (const [kind, mime, prepare, download] of [
          [
            'picture',
            'application/vnd.revealline.media',
            field('prepare-originals'),
            field('download-originals'),
          ],
          [
            'story',
            'application/vnd.revealline.story',
            story('prepare-download'),
            story('download'),
          ],
        ]) {
          const prior = p.downloads.length;
          await p.choose(prepare);
          await p.wait(() => p.visible($(download)) && !$(field('reload')).disabled, 30000);
          const observed = p.downloads.slice(prior).find(({ blob }) => blob.type === mime);
          assert(observed, `Prepared ${kind} export did not expose its actual Blob`);
          const name = $(download).download;
          await p.choose(download);
          const parsed =
            kind === 'picture'
              ? await importMediaBundle(observed.blob)
              : await importStoryBundle(observed.blob);
          assert(
            same(parsed.document, kind === 'picture' ? saved.document : savedStory.library),
            `${kind} export changed saved metadata`,
          );
          const canonical =
            kind === 'picture'
              ? await exportMediaBundle(parsed.document, parsed.assets)
              : await exportStoryBundle(parsed.document, parsed.assets, { still: parsed.still });
          const receipt = await fingerprint(observed.blob);
          assert(
            same(receipt, await fingerprint(canonical)),
            `${kind} import/canonical export changed exact bytes`,
          );
          result[kind] = { name, ...receipt, originals: parsed.assets.length };
        }
        return result;
      };
      const first = await exportOriginals();
      const reopen = async () => {
        await p.choose(field('close'));
        await p.wait(() => !$('#still-media-dialog').open);
        assert(p.doc.activeElement.id === 'still-host-open', 'Workshop close lost its opener');
        await p.choose('#still-host-open');
        await p.wait(() => !$(field('campaign')).disabled && !$(field('reload')).disabled, 30000);
        assert(
          same(
            ['campaign', 'level', 'theme'].map((key) => value(field(key))),
            [target.campaign, target.level, target.theme],
          ),
          'Reopening changed selected map/world',
        );
        assert(
          value(field('history')) === JSON.stringify([presentation.id, 1]),
          'Reopening lost the saved picture revision',
        );
      };
      await reopen();
      await mediaUnchanged(saved);
      await storyUnchanged(savedStory);
      await p.choose(field('show-saved'));
      await p.wait(() => !$(field('reload')).disabled, 30000);
      assert(
        $(field('preview-canvas')).width > 0 && $(field('preview-canvas')).height > 0,
        'Reopened original did not produce a picture preview',
      );
      await p.select(story('history'), JSON.stringify([descriptor.id, descriptor.revision]));
      await p.choose(story('prepare-saved'));
      await p.wait(() => !$(story('save')).disabled, 30000);
      await storyUnchanged(savedStory);
      await p.pulse('back');
      await p.wait(() => !$('#still-media-dialog').open);
      await p.choose('#still-host-open');
      await p.wait(() => !$(field('reload')).disabled && !$(field('campaign')).disabled, 30000);
      assert($(story('save')).disabled, 'Closing a staged story left Save enabled after reopening');
      await storyUnchanged(savedStory);
      const second = await exportOriginals();
      assert(same(first, second), 'Reopened downloads differ from the first saved originals');
      const after = await store.readMetadata(),
        afterStory = await manager.readDomainMetadata('story');
      assert(
        same(after, saved) && same(afterStory, savedStory),
        'Reopening, staged cancellation or exporting wrote another generation',
      );
      for (const key of ['assets', 'presentations', 'assignments'])
        retains(before.document.library[key], after.document.library[key], `picture ${key}`);
      assertStillOwnerPreservation(before.document.owners, after.document.owners, target);
      assert(same(before.document.legacy, after.document.legacy), 'Retained generic media changed');
      for (const key of ['stories', 'originals', 'bindings'])
        retains(beforeStory.library[key] ?? [], afterStory.library[key] ?? [], `story ${key}`);
      assert(
        same(await manager.readDomainMetadata('audio'), beforeAudio),
        'Soundtrack storage changed',
      );
      for (const [storage, original] of [
        [win.localStorage, originalLocal],
        [win.sessionStorage, originalSession],
      ])
        for (const [key, entry] of original)
          assert(storage.getItem(key) === entry, `Existing browser state changed: ${key}`);
      p.record(
        'Closed and reopened exact picture/story history, canceled a prepared saved-story binding, then produced two byte-identical .rlmedia and .rlstory exports verified by the production importers and canonical exporters. Prior domain rows and browser keys remain intact',
        story('status'),
        {
          first,
          second,
          retained: {
            pictures: before.document.library.presentations.length,
            assignments: before.document.library.assignments.length,
            stories: beforeStory.library.stories.length,
            localKeys: originalLocal.length,
            sessionKeys: originalSession.length,
          },
          boundary:
            'Shared virtual-pad input, real browser image decoding and silent native video metadata/container/hash inspection; complete video-frame decoding and playback are not exercised. Blob observations prove prepared bytes and explicit download activation; actual OS file receipts, native keyboard, hardware controllers and platform file-picker import are separate gates. New qualification assignment/story are retained; no IndexedDB clearing or restore was performed.',
        },
      );
    } finally {
      store.close();
      manager.close();
    }
  },
];
