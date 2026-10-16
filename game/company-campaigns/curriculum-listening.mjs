import { required } from '../data-json.mjs';
import { validateCompletionRewardPayload } from '../rewards/model.mjs';
import { validateRewardAudioGroups } from '../rewards/audio-groups.mjs';

export const CURRICULUM_LISTENING_CAMPAIGN = 'social-drone-community-connections';
// Exact existing game recordings and authored instrumental descriptions. These
// pins do not approve assets or add them to any campaign dependency closure.
export const CURRICULUM_LISTENING_FILES = Object.freeze(
  [
    {
      id: 'social-community-listening-jellyfish',
      path: 'game/editions/assets/discovery/audio/3xblast-jellyfish-v1.mp3',
      sha256: 'f03927dbb34fca2946b4d156523e24d8ada69fbf390ed522597b9fbaedbf09a6',
      bytes: 1423569,
    },
    {
      id: 'social-community-listening-jellyfish-en',
      path: 'game/editions/assets/discovery/audio/3xblast-jellyfish-en-v1.txt',
      sha256: 'eeabea4dcee857b57b0b16a18db66634e1a5e60c726889b8d00810024e2fa813',
      bytes: 779,
    },
    {
      id: 'social-community-listening-jellyfish-uk',
      path: 'game/editions/assets/discovery/audio/3xblast-jellyfish-uk-v1.txt',
      sha256: '607565e80f20763ae3ae31e42b9aac372eb84d4015f663970ed0e1fdbb8f8ddb',
      bytes: 1242,
    },
    {
      id: 'social-community-listening-thanks',
      path: 'game/editions/assets/discovery/audio/3xblast-thanks-v1.mp3',
      sha256: 'ecf32b424b78773ba6df4c56a5068ddb0e1674f5c3fdadc47d23c79dde15f5af',
      bytes: 1781342,
    },
    {
      id: 'social-community-listening-thanks-en',
      path: 'game/editions/assets/discovery/audio/3xblast-thanks-en-v1.txt',
      sha256: '964728a066d5761e7e5b69d81662fbce30210eacf67904873d535108dc5fcc9f',
      bytes: 783,
    },
    {
      id: 'social-community-listening-thanks-uk',
      path: 'game/editions/assets/discovery/audio/3xblast-thanks-uk-v1.txt',
      sha256: '269063c609e595b1482573ceb11233d5f5364457aaf4c8a79bdc01325e865237',
      bytes: 1246,
    },
  ].map(Object.freeze),
);
const TRACKS = [
  {
    id: 'social-community-listening-jellyfish',
    title: 'A Band of Jellyfish',
    durationSeconds: 44.4865306122449,
    asset: {
      assetId: 'social-community-listening-jellyfish',
      sha256: 'f03927dbb34fca2946b4d156523e24d8ada69fbf390ed522597b9fbaedbf09a6',
    },
    transcript: {
      en: {
        assetId: 'social-community-listening-jellyfish-en',
        sha256: 'eeabea4dcee857b57b0b16a18db66634e1a5e60c726889b8d00810024e2fa813',
      },
      uk: {
        assetId: 'social-community-listening-jellyfish-uk',
        sha256: '607565e80f20763ae3ae31e42b9aac372eb84d4015f663970ed0e1fdbb8f8ddb',
      },
    },
  },
  {
    id: 'social-community-listening-thanks',
    title: 'Thanks For Listening!',
    durationSeconds: 55.666938775510204,
    asset: {
      assetId: 'social-community-listening-thanks',
      sha256: 'ecf32b424b78773ba6df4c56a5068ddb0e1674f5c3fdadc47d23c79dde15f5af',
    },
    transcript: {
      en: {
        assetId: 'social-community-listening-thanks-en',
        sha256: '964728a066d5761e7e5b69d81662fbce30210eacf67904873d535108dc5fcc9f',
      },
      uk: {
        assetId: 'social-community-listening-thanks-uk',
        sha256: '269063c609e595b1482573ceb11233d5f5364457aaf4c8a79bdc01325e865237',
      },
    },
  },
];
export const CURRICULUM_LISTENING_ASSET_IDS = Object.freeze(
  CURRICULUM_LISTENING_FILES.map((row) => row.id),
);

/** An optional listening corner inside the existing six-win finale. It adds no
 * reward, progress, playback requirement or automatic listening history. */
export function createCurriculumListeningContent(campaignId, assets) {
  if (campaignId !== CURRICULUM_LISTENING_CAMPAIGN) return { payloads: [], audioGroups: [] };
  for (const expected of CURRICULUM_LISTENING_FILES) {
    const actual = assets.find((row) => row.id === expected.id);
    required(
      actual?.approved === true &&
        actual.publication === 'public' &&
        actual.sha256 === expected.sha256 &&
        actual.bytes === expected.bytes &&
        actual.path === expected.path,
      'Community listening needs its exact admitted recording and description assets.',
    );
  }
  const payloads = [
    validateCompletionRewardPayload({
      id: 'social-community-listening-guide',
      type: 'knowledge',
      locales: {
        en: {
          title: 'A listening corner for the celebration',
          paragraphs: [
            'Six connections bring our fictional workshop community together. Take an optional musical pause with two short instrumentals by 3xBlast: A Band of Jellyfish and Thanks For Listening! These are contemporary game recordings chosen for this exhibit, not music recorded by or endorsed by Social Drone UA.',
            'Follow one sound, then another. Compare which part caught your attention in each track. You can enjoy either, both or neither; listening and personal preference do not affect completion. Select a track and press Play when you want to hear it.',
            'Music: 3xBlast, CC0 1.0 Universal. Existing game MP3 derivatives converted from the creator’s OGG files without musical edits. The text descriptions remain available without playback.',
          ],
          sources: [
            {
              title: '3xBlast — original vocalless game-music set',
              url: 'https://opengameart.org/content/7-pop-punk-chiptune-tracks',
            },
            {
              title: 'CC0 1.0 Universal',
              url: 'https://creativecommons.org/publicdomain/zero/1.0/',
            },
          ],
        },
        uk: {
          title: 'Музичний куточок для свята',
          paragraphs: [
            'Шість зв’язків об’єднують нашу вигадану майстерню. За бажанням зробіть музичну паузу з двома короткими інструментальними треками 3xBlast: A Band of Jellyfish і Thanks For Listening! Це сучасні ігрові записи для цієї експозиції, а не музика, записана чи схвалена Social Drone UA.',
            'Простежте за одним звуком, потім за іншим. Порівняйте, яка партія привернула вашу увагу в кожному треку. Можна слухати один, обидва або жодного: слухання та особисті вподобання не впливають на завершення. Виберіть трек і натисніть «Відтворити», коли захочете його почути.',
            'Музика: 3xBlast, CC0 1.0 Universal. Наявні ігрові MP3-файли перетворено з авторських OGG без музичних змін. Текстові описи доступні й без відтворення.',
          ],
          sources: [
            {
              title: '3xBlast — оригінальна добірка ігрової музики без вокалу',
              url: 'https://opengameart.org/content/7-pop-punk-chiptune-tracks',
            },
            {
              title: 'CC0 1.0 Universal',
              url: 'https://creativecommons.org/publicdomain/zero/1.0/',
            },
          ],
        },
      },
    }),
    ...TRACKS.map((track) =>
      validateCompletionRewardPayload({
        id: track.id,
        type: 'audio',
        asset: track.asset,
        transcript: track.transcript,
        locales: {
          en: { title: `${track.title} · 3xBlast` },
          uk: { title: `${track.title} · 3xBlast` },
        },
      }),
    ),
  ];
  const audioGroups = validateRewardAudioGroups(
    [
      {
        format: 'revealline-ordered-audio-group.v1',
        id: 'social-community-listening-pair',
        locales: {
          en: { title: 'A shared pause · two instrumentals' },
          uk: { title: 'Спільна пауза · два інструментальні треки' },
        },
        payloadIds: TRACKS.map((track) => track.id),
      },
    ],
    payloads,
  );
  return { payloads, audioGroups };
}
