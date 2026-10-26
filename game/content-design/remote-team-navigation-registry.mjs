/** Display-only registered projections. No executable route or native-row admission.
 * Regenerate with the dedicated remote Team display authoring workflow; locale
 * references remain live. Source receipt/commit belongs outside deterministic data. */
import { freezeDesign } from './catalogs.mjs';

export const REMOTE_TEAM_NAVIGATION = freezeDesign([
  {
    target: 'cultural',
    path: 'runtime/remote-team-cultural.json',
    bytes: 84323,
    sha256: '82119923f38d819050ae0ffb6ee4682edaa5bc2a30dfc3ee93a2491a1ad8753d',
    editionId: 'team-cultural-specialist-originals-2',
    factory: 'createTeamCulturalSpecialistV2OriginalCandidates',
    project: {
      id: 'team-cultural-specialist-originals-v2-review',
      revision: 'team-cultural-routes-2',
      sha256: '2f368b4d12c68d81dd5f42d58d2549dfd1925935a2f703688786603d2f369fae',
    },
  },
  {
    target: 'expedition',
    path: 'runtime/remote-team-expedition.json',
    bytes: 552216,
    sha256: 'e0f42cdff0fbeaf968f71a95bc73d44d0283d5810be10a3e80784a71939c0dd9',
    editionId: 'team-expedition-v1',
    factory: 'createTeamExpansionCandidates',
    project: {
      id: 'team-expedition',
      revision: '1',
      sha256: '75499ecdfe15aadb2fefd38ef06a46d2ea88347d4cad3374322fd39d5c9e58ec',
    },
  },
  {
    target: 'hunt',
    path: 'runtime/remote-team-hunt.json',
    bytes: 33416,
    sha256: '583a70c396ef26ea1a53b72d8c2fb86f02bfdbe16e8e36bb1e26bf112bbf9340',
    editionId: 'humanoid-hunt-v1',
    factory: 'createTeamHuntTrainingCandidates',
    project: {
      id: 'team-humanoid-hunt-training-project',
      revision: 'team-hunt-training-1',
      sha256: '957aa8d912aa42b4969fbcc153abe1e7b271cd99157e574ceb9e300883190319',
    },
  },
]);
