import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Document, Element, Events } from './helpers/couch-dom.mjs';
import { rewardAudioFixture } from './helpers/reward-audio-fixture.mjs';
import { createAudioMaster } from '../ui/audio-master.mjs';
import { mountRewardAudioGroup } from '../ui/reward-audio-group.mjs';
import {
  REWARD_AUDIO_GROUP_FORMAT,
  validateRewardAudioGroups,
  rewardPresentationItems,
} from '../rewards/audio-groups.mjs';
import { validateCompletionReward, completionRewardAssetReferences } from '../rewards/model.mjs';
import { createPrintableReward } from '../rewards/printable.mjs';
import { mountLocalRewardMediaPreview } from '../studio/reward-media-preview.mjs';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const settle = async () => {
  for (let i = 0; i < 12; i++) await new Promise((resolve) => setTimeout(resolve, 2));
};
function fixture() {
  const audio = rewardAudioFixture(),
    texts = [Buffer.from('First recording.'), Buffer.from('Другий запис.')],
    files = new Map(),
    payloads = ['first', 'second'].map((id, index) => {
      const asset = (suffix, bytes, extension) => {
        const assetId = id + suffix,
          hash = sha(bytes);
        files.set(assetId, {
          asset: {
            id: assetId,
            sha256: hash,
            path: `${assetId}.${extension}`,
            bytes: bytes.length,
          },
          bytes,
        });
        return { assetId, sha256: hash };
      };
      return {
        id,
        type: 'audio',
        locales: { en: { title: `${id} recording` }, uk: { title: `${id} запис` } },
        asset: asset('-audio', audio, 'wav'),
        transcript: {
          en: asset('-en', texts[index], 'txt'),
          uk: asset('-uk', texts[index], 'txt'),
        },
      };
    }),
    group = {
      format: REWARD_AUDIO_GROUP_FORMAT,
      id: 'listening',
      locales: { en: { title: 'Listening room' }, uk: { title: 'Кімната прослуховування' } },
      payloadIds: ['second', 'first'],
    },
    reward = {
      format: 'revealline-completion-reward.v1',
      id: 'listen',
      revision: 'one',
      brandId: 'sample',
      campaignId: 'sample',
      scope: { kind: 'campaign', id: 'sample' },
      locales: {
        en: { title: 'Listening', teaser: 'Two recordings' },
        uk: { title: 'Слухання', teaser: 'Два записи' },
      },
      requirements: {
        missions: [
          {
            missionId: 'mission',
            bindings: [{ gameplayId: 'exact-gameplay', difficulty: 'standard' }],
          },
        ],
        learning: [],
        mastery: [],
      },
      payloads,
    };
  return { payloads, group, files, reward };
}
test('ordered audio recipes are bounded, exact-local and omitted legacy rewards remain byte identical', () => {
  const f = fixture(),
    before = JSON.stringify(f.reward);
  assert.equal(JSON.stringify(validateCompletionReward(f.reward)), before);
  assert.deepEqual(
    rewardPresentationItems(f.reward).map((item) => item.payload.id),
    ['first', 'second'],
  );
  const grouped = { ...f.reward, audioGroups: [f.group] };
  assert.deepEqual(
    completionRewardAssetReferences([grouped]),
    completionRewardAssetReferences([f.reward]),
  );
  assert.deepEqual(
    rewardPresentationItems(grouped)[0].payloads.map((p) => p.id),
    ['second', 'first'],
  );
  for (const mutate of [
    (g) => {
      g[0].format = 'unknown';
    },
    (g) => {
      g[0].autoplay = true;
    },
    (g) => {
      g[0].payloadIds = ['first'];
    },
    (g) => {
      g[0].payloadIds = ['first', 'foreign'];
    },
    (g) => {
      g[0].payloadIds = ['first', 'first'];
    },
    (g) => {
      g[0].locales.uk.title = '';
    },
    (g) => {
      g.push({ ...g[0], id: 'overlap' });
    },
    (g) => {
      g[0].payloadIds = Array(9).fill('first');
    },
  ]) {
    const groups = structuredClone([f.group]);
    mutate(groups);
    assert.throws(() => validateRewardAudioGroups(groups, f.payloads));
  }
  assert.throws(() =>
    validateRewardAudioGroups([f.group], [{ ...f.payloads[0], type: 'video' }, f.payloads[1]]),
  );
});
test('playlist uses one native audio owner, explicit Play per track, keyboard selection and bounded cleanup', async () => {
  const f = fixture(),
    document = new Document(),
    window = new Events(),
    container = document.createElement('section'),
    urls = new Set(),
    reads = [],
    media = [],
    audioMaster = createAudioMaster({ muted: false, volume: 0.4 });
  document.body.append(container);
  let ducks = 0;
  class Native extends Element {
    constructor() {
      super(document, 'audio');
      this.duration = 1;
      this.paused = true;
      this.playCalls = 0;
    }
    load() {
      if (this.src) queueMicrotask(() => this.emit('loadedmetadata'));
    }
    play() {
      this.playCalls++;
      this.paused = false;
      this.emit('play');
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
      this.emit('pause');
    }
    removeAttribute(key) {
      super.removeAttribute(key);
      if (key === 'src') this.src = '';
    }
  }
  const options = {
    container,
    group: f.group,
    payloads: f.payloads,
    document,
    window,
    audioMaster,
    musicDucker: {
      acquire() {
        ducks++;
        return () => {
          ducks--;
        };
      },
    },
    createMedia() {
      const element = new Native();
      media.push(element);
      return element;
    },
    URLImpl: {
      createObjectURL() {
        const url = `blob:${urls.size}`;
        urls.add(url);
        return url;
      },
      revokeObjectURL(url) {
        urls.delete(url);
      },
    },
    readLocalAsset: async (reference, { signal }) => {
      signal.throwIfAborted();
      reads.push(reference.assetId);
      return f.files.get(reference.assetId);
    },
  };
  const view = mountRewardAudioGroup(options);
  await settle();
  assert.deepEqual(reads, ['second-en']);
  assert.equal(media.length, 0);
  const choices = container.querySelectorAll('[data-playlist-track]');
  const key = choices[0].emit('keydown', { key: 'ArrowDown' });
  assert(key.defaultPrevented);
  assert.equal(document.activeElement, choices[1]);
  assert.equal(
    choices[0].getAttribute('aria-pressed'),
    'true',
    'focus alone does not select or play',
  );
  container.querySelector('[data-reward-media-action="play"]').emit('click');
  await settle();
  assert.equal(media[0].playCalls, 1);
  assert.equal(media[0].volume, 0.4);
  assert.equal(ducks, 1);
  media[0].emit('ended');
  assert.equal(choices[0].getAttribute('aria-pressed'), 'true');
  assert.equal(media.length, 1, 'ending does not advance');
  choices[1].emit('click');
  await settle();
  assert.equal(media[0].paused, true);
  assert.equal(media[0].src, '');
  assert.equal(ducks, 0);
  assert.equal(urls.size, 0);
  assert.equal(media.length, 1, 'selecting next does not play or load audio');
  container.querySelector('[data-reward-media-action="play"]').emit('click');
  await settle();
  assert.equal(media[1].playCalls, 1);
  view.dispose();
  assert.equal(ducks, 0);
  assert.equal(urls.size, 0);
  assert.equal(container.children.length, 0);
  for (let i = 0; i < 20; i++) {
    const v = mountRewardAudioGroup(options);
    container.querySelector('[data-playlist-action="next"]').emit('click');
    v.dispose();
  }
  await settle();
  assert.equal(urls.size, 0);
  assert.equal(ducks, 0);
  for (const listeners of window.listeners.values()) assert.equal(listeners.size, 0);
});
test('printable playlist follows authored track order and verifies the same exact transcript pins', async () => {
  const f = fixture();
  f.reward.audioGroups = [f.group];
  const result = await createPrintableReward(f.reward, {
    getTranscript: async (ref) => f.files.get(ref.assetId).bytes,
  });
  assert(result.html.includes('Listening room'));
  assert(result.html.indexOf('second recording') < result.html.indexOf('first recording'));
  assert.equal((result.html.match(/first recording/g) ?? []).length, 1);
  assert.deepEqual(result.missingAssetIds, []);
});

test('local Studio playlist chooses only exact originals and switching keeps every transcript available without playback', async () => {
  const f = fixture(),
    document = new Document(),
    window = new Events(),
    container = document.createElement('section');
  document.body.append(container);
  window.URL = {
    createObjectURL() {
      throw new Error('No automatic audio URL');
    },
    revokeObjectURL() {},
  };
  const viewer = mountLocalRewardMediaPreview({
    container,
    group: f.group,
    payloads: f.payloads,
    window,
  });
  const input = container.querySelector('[data-reward-media-files]');
  input.files = [...f.files.values()].map(
    ({ asset, bytes }) => new File([bytes], asset.path.split('/').at(-1)),
  );
  input.emit('change');
  await settle();
  assert(container.querySelector('[data-reward-audio-group]'));
  assert(container.querySelector('details').textContent.includes('Другий запис.'));
  container.querySelector('[data-playlist-action="next"]').emit('click');
  await settle();
  assert(container.querySelector('details').textContent.includes('First recording.'));
  assert.equal(container.querySelector('audio'), null);
  input.files = [new File(['wrong exact original'], 'wrong.txt')];
  input.emit('change');
  await settle();
  assert.equal(container.querySelector('[data-reward-audio-group]'), null);
  assert(container.textContent.includes('differs from every authored reward pin'));
  viewer.dispose();
  assert.equal(container.children.length, 0);
  for (const listeners of window.listeners.values()) assert.equal(listeners.size, 0);
});
