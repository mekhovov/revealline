/** Assemble original production assets into the existing immutable theme model. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { ASSET_SLOTS, createDefaultThemeBundle } from '../game/presentation/catalog.mjs';
import { FORMATS, LIMITS, presentationCoverage } from '../game/presentation/model.mjs';
import { reviseStudioTheme } from '../game/presentation/studio-session.mjs';
import {
  iconForSlot,
  FIELD_KIT_ICON_IDS,
  FIELD_KIT_ICON_DESCRIPTIONS,
} from '../game/presentation/icons.mjs';
import {
  TEAM_EQUIPMENT_IDS,
  TEAM_EQUIPMENT_DESCRIPTIONS,
  teamEquipmentArt,
} from '../game/presentation/team-equipment-art.mjs';
import { fieldKitTeamRecipeQuality } from './team-recipe-review.mjs';
import { encodeSpritePNG, inspectSprite } from './produce-field-kit-sprites.mjs';
import { compilePresentation } from './compile-presentation.mjs';
import { writePresentation, retainedPresentationPath } from './write-presentation.mjs';
import { readFieldKitRetainedOutput } from './field-kit-retained-runtime.mjs';
import { retainFieldKitProductionHistory } from './team-production-history.mjs';
import { importThemeBundle, exportThemeBundle } from '../game/presentation/bundle.mjs';

import {
  bulkPresentationContinuation,
  readBulkPresentationContinuation,
  BULK_PRESENTATION_REVIEW_PATH,
  BULK_PRESENTATION_REVIEW_SHA256,
} from './bulk-presentation-continuation.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const reference = (asset) => ({ id: asset.id, revision: asset.revision });
const sources = {
  ui: 'game/ui/field-kit-components.css; game/ui/field-kit-compiled.css; game/presentation/host.mjs; game/presentation/team-runtime-slots.mjs; game/ui/operation-status.css; game/ui/operation-status.mjs; game/presentation/dom-ownership.mjs',
  screens:
    'game/ui/field-kit-flow.css; game/ui/field-kit-surfaces.css; game/ui/field-kit-compiled.css; site/release-catalog.css',
  motion:
    'authoring/motion-lab/render-character.mjs; game/ui/actor-presentation.mjs; game/ui/rotor-presentation.mjs; game/presentation/journey-actor-materials.mjs; game/ui/body-backing.mjs; game/ui/body-motion.mjs; game/ui/actor-recipes.mjs; game/ui/fpv-body-recipes.mjs; authoring/motion-lab/animation.mjs; authoring/motion-lab/presets.json; authoring/library/fpv-role-presentations/originals/scout.png; authoring/library/fpv-role-presentations/originals/bomber.png; authoring/library/fpv-role-presentations/originals/carrier.png; authoring/library/fpv-role-presentations/originals/interceptor.png; authoring/library/fpv-role-presentations/originals/fiber.png; authoring/library/fpv-role-presentations/originals/impact.png; authoring/library/fpv-role-presentations/originals/trapper.png',
  effects:
    'game/ui/classic-view.mjs; game/ui/event-feedback.mjs; game/content-design/actor-marker.mjs; game/ui/lane-presentation.mjs; game/ui/render.mjs; game/ui/contact-cue.mjs; game/ui/relay-view.mjs; game/ui/directional-view.mjs; game/ui/enemy-body-assets.mjs; game/ui/enemy-body-motion.mjs; game/enemy-catalog.mjs; game/ui/body-motion.mjs; game/ui/actor-recipes.mjs; game/ui/fpv-body-recipes.mjs; game/ui/body-backing.mjs; authoring/motion-lab/animation.mjs; game/ui/combat-view.mjs; game/ui/combat-presentation.mjs; game/ui/actor-presentation.mjs; game/data-json.mjs; game/core/registry.mjs; game/core/combat-definition.mjs; game/core/geometry.mjs; game/core/classic-motion.mjs; game/core/classic-topology.mjs; game/core/movement.mjs; game/core/versions.mjs',
  team: 'game/couch/coop-view.mjs; game/couch/coop-actor-presentation.mjs; game/couch/coop-pilot-cues.mjs; game/ui/contact-cue.mjs; game/couch/coop-anchor-presentation.mjs; game/couch/coop-core-presentation.mjs; game/couch/coop-support-presentation.mjs; game/couch/coop-emitter-presentation.mjs; game/couch/coop-rescue-presentation.mjs; game/couch/coop-pilot-slots.mjs; game/couch/coop-enemy-slots.mjs; game/couch/coop-outcome-presentation.mjs; game/presentation/team-runtime-slots.mjs; game/ui/actor-presentation.mjs; game/ui/rotor-presentation.mjs; game/presentation/catalog.mjs; game/couch/coop-actor-layout.mjs; game/text-size.mjs; game/couch/coop-terrain-trail.mjs; game/couch/coop-bonus-view.mjs; game/couch/candidate-team-pictures.mjs; game/content-design/material-markers.mjs; game/presentation/journey-actor-materials.mjs; authoring/motion-lab/render-character.mjs; game/ui/classic-view.mjs; game/ui/presentation-draw-image.mjs; game/ui/enemy-body-assets.mjs; game/ui/enemy-body-motion.mjs; authoring/motion-lab/animation.mjs; game/content-design/actor-marker.mjs; game/enemy-catalog.mjs; game/ui/actor-recipes.mjs; game/ui/fpv-body-recipes.mjs; game/ui/body-backing.mjs; game/ui/body-motion.mjs',
  audio:
    'game/app.mjs; game/couch/couch-music-host.mjs; game/opening-soundtrack.mjs; game/ui/audio.mjs; game/ui/published-audio.mjs; game/ui/soundtrack-player.mjs; game/ui/quick-music-controls.mjs; game/ui/quick-music-controls.css; game/ui/music-credits.mjs; game/ui/music-credit.mjs; game/ui/demo-audio.mjs; game/ui/audio-master.mjs; game/soundtrack.mjs; game/soundtrack-style-taxonomy.mjs; game/soundtrack-rights.mjs; game/soundtrack-bundle.mjs; game/soundtrack-share.mjs; game/soundtrack-source.mjs; game/soundtrack-bundled.mjs; game/ui/soundtrack-panel.mjs; game/ui/soundtrack-panel.css; game/soundtrack-albums.mjs; game/soundtrack-portable.mjs; game/content/soundtrack-catalogue.mjs; game/online-soundtrack-catalogue.mjs; game/online-soundtrack-sources.mjs; game/online-soundtrack-source-store.mjs; game/official-downloads.mjs; game/soundtrack-download-volumes.mjs; game/installed-app.mjs; game/managed-media-store.mjs; game/media-storage-record.mjs; game/soundtrack-private-intake.mjs; game/ui/soundtrack-error-copy.mjs; game/journey/campaign-feedback.mjs; game/rewards/audio-original.mjs; game/rewards/media-format.mjs; game/ui/edition-solo.mjs; game/ui/edition-rewards.mjs; game/ui/reward-media.mjs; game/ui/reward-audio-group.mjs; game/rewards/audio-groups.mjs; game/studio-preview-session.mjs; game/audio-preferences.mjs; game/ui/story-dialog.mjs; game/ui/victory-story.mjs; game/ui/music.mjs; game/data-json.mjs; game/mp3.mjs; game/media-audio.mjs; game/video-poster.mjs; game/rewards/model.mjs; game/rewards/media.mjs; game/editions/assets.mjs; game/editions/model.mjs; game/editions/retained-presentation.mjs',
};

// Image review is independent of the 37 Team recipes. Bind original bytes and
// the complete renderer closure so a changed construction or consumer reopens it.
const equipmentSources = [
  'game/presentation/team-equipment-art.mjs',
  'game/presentation/pixel-art.mjs',
  'scripts/produce-field-kit-sprites.mjs',
  ...sources.team.split('; '),
];
const reviewedEquipmentSource = 'b9cbf2db6fe094564a15743c72c45049bf9ee776a22b2599469e0ee1bdc03037';
const reviewedEquipmentSuccessorSource =
  '162d4c737c11d34f8e7e3ed6e76ca5a34fcf06d5fb97303d53eba857feaaf530';
const reviewedTeamSuccessorRecord =
  '45e41eee3cacac251ede3f0304834a1fda311f8bd70f4d0b66aaceb493b8fc05';
const reviewedTeamContinuationRecord =
  'fbc818dcfbbfd2cf1985017417959c82741162842cd3c7293f5be67fc594ef35';
const reviewedEquipmentOriginals = Object.freeze({
  'team.anchor.available': '88e541375c56d4627b80cf6921ca64ed12d5b77d43dcae256177b8577250d9b3',
  'team.anchor.captured': 'a66511c77322beea458be918f6eb35f1ca6acc9f980afa44bc4756162896f466',
  'team.core.shielded': '009d14748f943002091255caebd32e4df1c886569575f512ab0d55d7a3ff637a',
  'team.core.exposed': '6abc4a68192b4d517b22690c43126de34a1c403caf4a24ec57aa8b2ff68f079a',
  'team.core.secured': '28e58f70c759b20798fac07e6f9d1b336e936ee23beea26bb4be30fd5528311d',
});

export async function fieldKitEquipmentSource(read) {
  return hash(Buffer.concat(await Promise.all(equipmentSources.map((name) => read(name)))));
}

export function fieldKitEquipmentQuality(
  slotId,
  source,
  originalHash,
  successorReviewBytes,
  continuationReviewBytes,
  bulkContinuationReviewBytes,
) {
  const successor =
    successorReviewBytes && hash(successorReviewBytes) === reviewedTeamSuccessorRecord
      ? JSON.parse(successorReviewBytes)
      : null;
  const continued =
    source === reviewedEquipmentSuccessorSource &&
    successor?.priorEquipmentReview?.path ===
      'docs/verification/team-equipment-five-review/review.json' &&
    successor.priorEquipmentReview.sha256 ===
      'a5aa095805b39c8a716d5427c54ad594f9261b53adeaf9752b3260ae752024b3' &&
    successor.priorEquipmentReview.priorFingerprintSHA256 === reviewedEquipmentSource &&
    successor.priorEquipmentReview.currentFingerprintSHA256 === reviewedEquipmentSuccessorSource;
  const continuation =
    continuationReviewBytes && hash(continuationReviewBytes) === reviewedTeamContinuationRecord
      ? JSON.parse(continuationReviewBytes)
      : null;
  const currentContinued =
    source === continuation?.fingerprints?.equipment?.currentSHA256 &&
    continuation.priorReviews?.teamSuccessor?.path ===
      'docs/verification/team-specialist-cues-2026-09-24/review.json' &&
    continuation.priorReviews.teamSuccessor.sha256 === reviewedTeamSuccessorRecord &&
    continuation.priorReviews?.equipment?.path ===
      'docs/verification/team-equipment-five-review/review.json' &&
    continuation.priorReviews.equipment.sha256 ===
      'a5aa095805b39c8a716d5427c54ad594f9261b53adeaf9752b3260ae752024b3' &&
    continuation.fingerprints.equipment.priorSHA256 === reviewedEquipmentSuccessorSource;
  const bulk = bulkPresentationContinuation(bulkContinuationReviewBytes);
  const bulkContinued =
    source === bulk?.fingerprints?.equipment?.currentSHA256 &&
    bulk.fingerprints.equipment.slots.includes(slotId) &&
    bulk.priorReviews.equipment.sha256 ===
      'a5aa095805b39c8a716d5427c54ad594f9261b53adeaf9752b3260ae752024b3' &&
    bulk.priorReviews.teamContinuation.sha256 === reviewedTeamContinuationRecord &&
    continuationReviewBytes &&
    hash(continuationReviewBytes) === reviewedTeamContinuationRecord &&
    successorReviewBytes &&
    hash(successorReviewBytes) === reviewedTeamSuccessorRecord;
  if (
    Object.hasOwn(reviewedEquipmentOriginals, slotId) &&
    (source === reviewedEquipmentSource || continued || currentContinued || bulkContinued) &&
    reviewedEquipmentOriginals[slotId] === originalHash
  )
    return {
      stage: 'reviewed',
      evidence: [
        ...(bulkContinued
          ? [
              `Exact current five-image consumer continuation: ${BULK_PRESENTATION_REVIEW_PATH} sha256:${BULK_PRESENTATION_REVIEW_SHA256}`,
            ]
          : []),
        'Five images only: docs/verification/team-equipment-five-review/review.json sha256:a5aa095805b39c8a716d5427c54ad594f9261b53adeaf9752b3260ae752024b3',
        ...(continued
          ? [
              `Unchanged five-image consumer continuation: docs/verification/team-specialist-cues-2026-09-24/review.json sha256:${reviewedTeamSuccessorRecord}`,
            ]
          : []),
        ...(currentContinued
          ? [
              `v0.132.5 unchanged equipment continuation: docs/verification/v0.132.5-presentation-continuation/review.json sha256:${reviewedTeamContinuationRecord}`,
            ]
          : []),
      ],
    };
  return {
    stage: 'produced',
    evidence: [
      'Original authored pixel clusters; complete state and playing-scale review remains required.',
    ],
  };
}

// A recipe stays unreviewed whenever one of its source inputs changes. These
// are deliberate, source-pinned approvals for scoped renderer and loading reviews:
// changing a digest creates a new source-stage revision and re-opens the
// release readiness gate rather than silently inheriting this review.
const REVIEWED_RECIPE_INPUTS = {
  screens: {
    sha256: '52a6145755fc879c7759d8c3845741bb20c7f5009b77b4da66b6987194185f53',
    evidence: [
      `Scoped current screens functional continuation: ${BULK_PRESENTATION_REVIEW_PATH} sha256:${BULK_PRESENTATION_REVIEW_SHA256}; exact source closure and preserved immutable predecessors. Fresh aggregate hosted, frozen/public, device and human acceptance remain separate.`,
      'Scoped UX2 shared-screen continuation: docs/verification/ux2-v0115-screen-continuation/review.json sha256:f0baff0c70c3bb3d3e08b92e8bfdb28c60e77913333640160841f58bc4c5c094; four ordered screen inputs sha256:251d09ba8aa8710a134694874bd7ae87f2e76af0000825f9ad2b97da024d1dbd. Only field-kit-flow.css changes after the prior exact review, retaining full-width Start/Continue while compacting the secondary Home actions with existing Field Kit tokens.',
      'Focused input and continuation checks plus retained local Chromium review at 1440 by 900, 390 by 844 and 844 by 390 cover the compact Home and direct player-shell routes. Board geometry, simulation, mission content, payloads and data ownership remain unchanged.',
      'Bounded functional source continuation only. Complete navigation, forced-colour, screen-reader, every viewport, physical device, frozen/public and human acceptance remain separate. Long suites remain waived and are not represented as passing; historical reviews and payloads remain immutable.',
    ],
  },
  ui: {
    sha256: 'c0038df428a29111169b2e3f852811bd0785410315c58981db2bb869e2639e5e',
    evidence: [
      'Scoped native-menu UI source continuation: docs/verification/native-menu-ui-audio-20260930/review.json sha256:950d4dc78138e5c4ac9c9b529fcc11b0e0b3e631975f0cc44fe3b5ceef2d59c0; exact seven-input UI fingerprint sha256:c0038df428a29111169b2e3f852811bd0785410315c58981db2bb869e2639e5e. Existing24 UI recipes and payloads unchanged; canonical103 retained. Software only; full navigation, player, physical-device and public acceptance remain separate.',
      'Scoped discovery WebP UI software continuation: docs/verification/discovery-webp-ui-continuation-2026-09-29/review.json sha256:2496cbfe4e885a931f22cbf5287efac45344074bb14dc4cf96f09a2d5a0a366f; exact seven-input UI fingerprint sha256:96761947c99f18dda6af25b3eb109e9cee1460991420776822903daa9e465b9a. Only the complete-original MIME allowlist and error copy admit WebP beside PNG/JPEG; all24 UI recipe identities, payloads, input bounds, hash/source checks, decoding and cancellation ownership remain unchanged. Production101/UI23 source-stage checkpoint is retained exactly by oracle sha256:bb8ef5f69c674d36737dcfd8a23267eb5207fd0bc2757965ae841da552b2551c. This is software continuation only; human artwork, full navigation, screen-reader, physical-device, frozen/public, performance and release acceptance remain separate.',
      'Scoped v0.141.8 Steam Deck Confirm continuation: docs/verification/v0.141.8-steamdeck-confirm-presentation-continuation/review.json sha256:15b9ef304ba6e8ec6c2120e4e766fe630af327f2a54325bd0e9043ba875e9867; exact seven-input UI fingerprint sha256:2530c099cf3b9fc0d5d3dbd865a083b76368f51b95b357ece7209111434a3360. Only field-kit-components.css changes, adding bounded pressed feedback through existing Field Kit tokens while preserving all 24 UI recipe identities, DOM ownership and payloads.',
      'v0.131 English/Ukrainian presentation continuation: docs/verification/v0.131.0-localization-presentation-continuation/review.json sha256:92c63ed7f4eb6f79502cae2089836de1fbdabcb1cacd76b55e22596e49492445; exact UI fingerprint sha256:c7ebea5695fe1fbd7c17eafdd0035dcd4d1651b5d3ec91893c6575334da38d3a. Maintained copy and operation status are locale-bound while the24 UI recipes, Field Kit tokens and DOM ownership contracts remain unchanged.',
      'Scoped actor-only UI functional continuation: docs/verification/actor-only-ui-continuation-2026-09-24/review.json sha256:dbde124fb9d24cb26dd901b51f58cf59fc7bfb4df212e47419cdb15581155b73; seven ordered UI inputs sha256:4b7db79dd3f6931dd72c0ae702f15a5a5d8ff2b7044aca5a2e02886e8e61636a. Only presentation host changes after the prior exact review; all24 UI recipe payloads, tokens and DOM ownership contracts remain unchanged.',
      'The actor-only profile uses a fixed registered image-slot set, creates no CSS URLs and refuses page apply, audio and picture operations. Full remains the default profile. Lease, cancellation, retained-runtime and exact source-binding tests cover the functional separation; fresh-origin Team screens retain the full-profile UI while FPV actors use the independent lease.',
      'UI functional continuation only. Complete navigation, forced-colour, screen-reader, every-viewport, physical-device, audio, offline, public and release acceptance remain separate. Prior UI reviews and immutable originals remain preserved; any UI input change reopens this group.',
    ],
  },
  audio: {
    sha256: 'b3ab688c9818ac2d35aff830a0700b0869c8065c08ebd49c0316cefe3faa7e2d',
    evidence: [
      'Radio source continuation: docs/verification/radio-audio-20260929/review.json sha256:93fdb14773e7ef58cdcaebcf1db3d4a3100d77aa13081d25ff799aa0e24c84e3; software only, listening/device pending.\nMerged main/candidate software continuation: docs/verification/discovery-main321-reconciliation/review.json sha256:f2b3a2724cf48455dbe98d5ca12a2b081ef1f982531e91838c0291a64bbed976. Exact50-source approval only; historical branch lineages and runtime pins remain separate. No listening, device, frozen/public approval.\nScoped v0.142.4 mission-selector audio continuation: docs/verification/v0.142.4-selector-audio-continuation/review.json sha256:f2cf0cc93f8de8e959eabf6e6313a0af306dfae87e2cb663bfe7bef805df6fe6; exact28 inputs sha256:fd3d7e347bc3a6e36bd884b508af8bbd8492cc3a4dac19bb745664a7fe90adc6. Only game/app.mjs changes, adding clear-star metadata and mission-card progress adapters; audio implementation, eight procedural recipes, routing and payloads remain unchanged. Exact published production100/audio52 predecessor fixture sha256:db9cc258d79aaa0caaf587fa3c73be5fcc55cea5f6129524c59255f04f3bbeb0 is retained. Selector/save compatibility, final qualification, frozen/public, listening and physical-device acceptance remain separate.\nScoped v0.142.3 Steam Deck Confirm audio continuation: docs/verification/v0.142.3-steamdeck-confirm-audio-continuation/review.json sha256:a059520f6ce0c394c3425355c711b641b4b23f9321e11c7d384317e7f814798c; exact28 inputs sha256:39fe40240f0475e471a52772060899d3e329e4d54d6b2bb6679e76dc745ee9a4. Only game/app.mjs changes, coordinating native and Gamepad Confirm ownership and opt-in local diagnostics; all audio implementation, eight existing procedural recipes, routing and payloads remain unchanged. Exact v0.142.2 production99/audio51 predecessor fixture sha256:528361f4e7823a23b02b261ca1de0c9b3157d1a17cbba643e4ff7e67073bc0a7 is retained. Final qualification, frozen/public, listening and physical Steam Deck acceptance remain separate.',
      'Scoped native-menu audio source continuation: docs/verification/native-menu-ui-audio-20260930/review.json sha256:950d4dc78138e5c4ac9c9b529fcc11b0e0b3e631975f0cc44fe3b5ceef2d59c0; exact50-input fingerprint sha256:b3ab688c9818ac2d35aff830a0700b0869c8065c08ebd49c0316cefe3faa7e2d. Existing eight recipes and payloads unchanged; canonical103 retained. Software only, not listening, device or public acceptance.\nScoped PR #770 Audio playback correction continuation: docs/verification/audio-style-menu-correction-2026-09-28/review.json sha256:62c1dac1be4286acdb8201aab99b6d3c5e2e2b282e1c88cb34d88af527172e09; exact28 inputs sha256:d9650ffde4c938064703de7c1e8ec987ac1efc1b6470ebcad4ca4ab459a32018. Only soundtrack-player.mjs and soundtrack-panel.mjs changed: saved listening preferences are isolated from unsaved Music Studio drafts, newer transport intent wins delayed playback, identity-owned catalogue retry survives close, and queue-capacity copy is corrected. The associated test-evidence repair pins the exact accepted-main production97 predecessor oracle. Exact production98/audio50 predecessor fixture sha256:e397af798928a72502c970276fe212eaad8d2a4889f5afe02587559244496714 is bound separately. Eight existing procedural recipes, routing and payloads remain unchanged; production generation, hosted, frozen/public, listening and physical-device acceptance remain separate.',
      'Scoped v0.142.1 Audio menu and style taxonomy continuation: docs/verification/audio-style-menu-2026-09-28/review.json sha256:bc87031d46ded1ace2cc62c6ca87e2ce90ccbb043db7c5fdb653d262c3b94f49; exact28 inputs sha256:9f0bf41c491a44b4ac585975fd444f7e2e5822534914f36b0213157861173344. Audio settings expose transport and broad style selection, automatically mix matching archive and local music, separate Synth/Electronic, combine UA/Ukrainian and require exact Cyrillic \u0424\u041f\u0412. The dependency closure binds the quick controls and taxonomy modules. Eight existing procedural recipes and payloads remain unchanged; hosted, frozen/public, listening and physical-device acceptance remain separate.',
      'Scoped player-readiness17 ownership source continuation: docs/verification/player-readiness17-audio-continuation-2026-09-28/review.json sha256:0584016a71b220780cc8912666638c468550c7167c2c1084b28b7952f27fa608; exact26 inputs sha256:124a7d186850bd1175bfc45bafba2f19912c89bcb271b5a0c2773e9ad5441b34. Existing eight recipes, routing and payloads unchanged; theme96/audio48 and all predecessors retained. Append-only production and all hosted/frozen/public/listening/device/human acceptance remain separate.',
      'Scoped localization14 Flight Details source continuation: docs/verification/localization14-audio-continuation-2026-09-28/review.json sha256:104e5cb33140537f9234fc26966d4a32f70927c89f1e4bfd1e3955432e1910da; exact26 inputs sha256:81a03fb4791564b775735a1cc977a2c63d492ac8221fb043fa9aa3008fcb9509. Existing eight recipes, routing and payloads unchanged; main95/audio47 and all predecessors retained. Append-only production, hosted/frozen/public/listening/device and human acceptance remain separate.',
      'Scoped main/bulk audio continuation: docs/verification/bulk-main320-audio-continuation-2026-09-28/review.json sha256:afcfcca1612109e117595c424e03ac002271165ccb1a4082697011e16c4c5a75; exact26 inputs sha256:d10dcf448002347b200f9886d0a5f3a23789a7f4fb928bccb4884224359cd575. Fresh canonical-main successors only; all main records and payloads retained, divergent unpublished branch identities preserved as immutable Git evidence without relabelling. Existing recipes only; final production, candidate, hosted, frozen/public and listening/device gates remain separate.',
      'Scoped v0.141.8 Steam Deck Confirm continuation: docs/verification/v0.141.8-steamdeck-confirm-presentation-continuation/review.json sha256:15b9ef304ba6e8ec6c2120e4e766fe630af327f2a54325bd0e9043ba875e9867; exact26 inputs sha256:b4af6423e29eded7ef998d4b8c1713b28e1f7f9dcd9a288a6777a651a6202825. Only game/app.mjs changes, wiring the release-committed controller Confirm transaction and opt-in local trace while preserving all eight procedural recipes, audio routing and payloads. Immutable predecessors retained; frozen/public/listening/device acceptance remains separate.',
      'Scoped bulk queue audio continuation: docs/verification/bulk-queue-audio-effects-2026-09-28/review.json sha256:5ec246c93cf5dfe6d5a3f6538788d618575037a11d2c1890d88d0257f2e7d0b3; exact inputs sha256:5537720994b355021ba876a5122231a0304cdadc6eb861b3a5091556858e7071. Only existing recipes and payloads; immutable reviews and production history retained. Final source, frozen/public, listening/device and human acceptance remain separate.',
      'Scoped canonical soundtrack main-rebase continuation: docs/verification/canonical-soundtrack-main-rebase-2026-09-28/review.json sha256:243ab86179b9bc9d2b2094cd6bacd4f1423659d032b99aec4715f4ebd4d9051f; exact26 inputs sha256:2bf54d1cf0ee90e36284f3782273a0cb62d49a75954b6d9b50b17b5203cdfc87. Four soundtrack catalogue, panel and transport inputs change; the canonical 260-entry catalogue and complete bounded 512-recording playback queue fit their explicit ceilings, and all eight existing procedural recipes and payloads remain unchanged. Exact-head tests, frozen/public, listening and physical-device acceptance remain separate.',
      'Scoped company-startup continuation: docs/verification/v0.141.7-company-startup-audio-continuation/review.json sha256:1d3660001a2ebe7d4d2daf5e68ab745e9e902d5c2f1757a398439de3caedccad; exact26 inputs sha256:f6f89072a29833af077a92f2e2a0eb4174e78edc0f03be1eb04f71daf467967c. Eight existing procedural recipes only; company package admission changes startup timing and consent, not recipe identities, audio routing or payloads. Immutable predecessors retained; final frozen/public/listening/device acceptance remains separate.',
      'Scoped cumulative continuation: docs/verification/bulk-integration-audio-continuation-2026-09-27/review.json sha256:067305195ea075c35f14402d970fb5d2819044720875374b157c9431d9c5d820; exact26 ordered audio inputs sha256:86e0d8771d9ea29e9628e1fd5f779d2d997d54799d71340f7a27319cd6e7b554. Eight existing procedural recipes only; retained records/payloads unchanged. Exact source and child receipts are scoped in the record; final hosted, frozen/public and listening/device acceptance remain separate.',
      'v0.141.0 managed-media continuation: docs/verification/v0.141.0-managed-media-audio-continuation/review.json sha256:16f3eb26f28eae82f6529c8a872438c216a05d7a905e0fee0b3d6b0e9601e998; twenty-four ordered audio inputs sha256:77370fe6fc7a8d376865b05d8ba2020b8683b3922c20cc3dfad260d0a0251f79. Only managed-media-store.mjs and media-storage-record.mjs changed after the prior exact review, adding bounded cross-domain byte accounting and exact reviewed still-byte detachment while preserving audio routing, recipes, rows, blobs, playback and soundtrack bytes.',
      'v0.132.5 locale-refresh continuation: docs/verification/v0.132.5-presentation-continuation/review.json sha256:fbc818dcfbbfd2cf1985017417959c82741162842cd3c7293f5be67fc594ef35; twenty-four ordered audio inputs sha256:301e68a4898cf7d9140abee266195401a69cfca0db2301a12409ec252c882ec9. Only game/app.mjs changed after the prior exact review, asking the shared shell to refresh localized Home copy while preserving audio routing, recipes and bytes.',
      'Scoped v0.132.1 Steam Deck controller continuation: docs/verification/v0.132.1-steamdeck-audio-continuation/review.json sha256:b715c81fa1f86a562d5c195ffc025727fc009d1de6cfe03c403db75fdfbf8d70; twenty-five ordered audio inputs sha256:417ceb75d58709373e1abdb047c26224db06721bd58b3ff8302152c33d2f735a. Only game/app.mjs changed among those inputs, adding a controller Confirm lifecycle filter before menu dispatch while preserving audio routing and bytes.',
      'The prior offline ownership and v0.131 English/Ukrainian reviews remain incorporated. All 8 selected roles retain the same procedural recipes; playback state, volume values, local-only selection, resumable download, shared-byte removal, rights, cancellation and imported-media preservation are unchanged.',
      'No recording, composition, musical suitability, Ukrainian authenticity, full-track listening, physical-device, frozen-build or public game approval. Historical reviews and original payloads remain immutable; any audio dependency or review-byte change reopens this group.',
    ],
  },
  motion: {
    sha256: '5e32f549e39ecdabc7a5449b320f703c40aa23a87889ea27b3594187e69f2f7f',
    evidence: [
      `Scoped current motion functional continuation: ${BULK_PRESENTATION_REVIEW_PATH} sha256:${BULK_PRESENTATION_REVIEW_SHA256}; exact source closure and preserved immutable predecessors. Fresh aggregate hosted, frozen/public, device and human acceptance remain separate.`,
      'Scoped clean-craft motion continuation: docs/verification/couch-craft-v01120/review.json sha256:fa2120613abf06bc578ba8388ba33af415392583e19e83c2297638af8010c305; three ordered motion inputs sha256:03a9b8a5eceb9eee63da578807becbb0f7770713d3eb2bd04affe5a75d3316f4. Prepared FPV bodies can suppress duplicate procedural blades while the active cutting head gains bounded plate, direction and packet cues.',
      'The exact candidate passed 202 focused actor, renderer, trail, controller, Couch and picture-parity checks. Positions, collision radii, authoritative clocks, path cells and role identities remain unchanged.',
      'Bounded functional visual continuation only, not final subjective art, every-state native/device, human balance, frozen/public or release approval. Historical reviews and original payloads remain immutable; changed motion inputs reopen this group.',
    ],
  },
  effects: {
    sha256: 'b7aa3a6b9bc2302df0309e90acddf899766a9b9406f93bd266a94b685940a5eb',
    evidence: [
      'Scoped bulk queue effects continuation: docs/verification/bulk-queue-audio-effects-2026-09-28/review.json sha256:5ec246c93cf5dfe6d5a3f6538788d618575037a11d2c1890d88d0257f2e7d0b3; exact inputs sha256:b7aa3a6b9bc2302df0309e90acddf899766a9b9406f93bd266a94b685940a5eb. Only existing recipes and payloads; immutable reviews and production history retained. Final source, frozen/public, listening/device and human acceptance remain separate.',
      `Scoped current effects functional continuation: ${BULK_PRESENTATION_REVIEW_PATH} sha256:${BULK_PRESENTATION_REVIEW_SHA256}; exact source closure and preserved immutable predecessors. Fresh aggregate hosted, frozen/public, device and human acceptance remain separate.`,
      'v0.131 English/Ukrainian presentation continuation: docs/verification/v0.131.0-localization-presentation-continuation/review.json sha256:92c63ed7f4eb6f79502cae2089836de1fbdabcb1cacd76b55e22596e49492445; exact effects fingerprint sha256:b33868fdd4f6aa898a885043116b939509f4d5b14d4412adb7d71e6e90ed6bbe. Locale-bound descriptions and mechanically formatted renderers preserve actor geometry, trail cells, collision footprints, sprite construction and effect recipe IDs.',
      'Scoped trail, impact and wreck continuation: docs/verification/couch-craft-v01120/review.json sha256:fa2120613abf06bc578ba8388ba33af415392583e19e83c2297638af8010c305; ten ordered effects inputs sha256:e23e228b4bf4ee68bb7cbbd231aaebe66d6e3da8965fbeae9b2c4acc90f9e053. The active cutting head and authoritative travelling fronts gain bounded readable shapes, prepared player bodies suppress duplicate blades, and FPV failure debris uses compact solid fragments.',
      'The exact candidate passed 202 focused actor, renderer, trail, controller, Couch and picture-parity checks. Reduced effects keeps essential state markers; collision footprints, impact coordinates, role identities, mission state and authoritative clocks remain unchanged.',
      'Functional and bounded visual continuation only. Historical reviews and original payloads remain immutable. Team recipes remain source-stage; complete art, final-byte physical-device, human pacing, frozen/public and release acceptance remain separate. Any effects input or review-byte change reopens this group.',
    ],
  },
};

function recipeQuality(group, source) {
  const review = REVIEWED_RECIPE_INPUTS[group];
  if (review && source.endsWith(`sha256:${review.sha256}`))
    return { stage: 'reviewed', evidence: review.evidence };
  return {
    stage: 'source',
    evidence: ['Connected runtime recipe; screen and state review remains required.'],
  };
}

export function verifyFieldKitAudioContinuationReview(reviewBytes, predecessorBytes) {
  return (
    hash(reviewBytes) === '067305195ea075c35f14402d970fb5d2819044720875374b157c9431d9c5d820' &&
    hash(predecessorBytes) === '16f3eb26f28eae82f6529c8a872438c216a05d7a905e0fee0b3d6b0e9601e998'
  );
}

export function verifyFieldKitCompanyAudioContinuationReview(
  currentBytes,
  priorBytes,
  managedBytes,
) {
  return (
    hash(currentBytes) === '1d3660001a2ebe7d4d2daf5e68ab745e9e902d5c2f1757a398439de3caedccad' &&
    verifyFieldKitAudioContinuationReview(priorBytes, managedBytes)
  );
}

export function verifyFieldKitCanonicalSoundtrackReview(
  currentBytes,
  companyBytes,
  branchRebaseBytes,
  externalBytes,
) {
  return (
    hash(currentBytes) === '243ab86179b9bc9d2b2094cd6bacd4f1423659d032b99aec4715f4ebd4d9051f' &&
    hash(companyBytes) === '1d3660001a2ebe7d4d2daf5e68ab745e9e902d5c2f1757a398439de3caedccad' &&
    hash(branchRebaseBytes) ===
      '697c094ae2c1cc0a83b77ad0e647c0967a9c3219b3ed10ba4d42f8691b9d54e7' &&
    hash(externalBytes) === '2b36f81f1afd641bac82334e051f6dc3bac0887329327eb47a10944a8a6d39c6'
  );
}

export function verifyFieldKitBulkQueueReview(currentBytes, predecessors) {
  const expected = {
    canonical: {
      path: 'docs/verification/canonical-soundtrack-main-rebase-2026-09-28/review.json',
      gitBlob: '45b17c09dc1b3e7ecb57329e741c5becc955ca79',
      bytes: 12374,
      sha256: '243ab86179b9bc9d2b2094cd6bacd4f1423659d032b99aec4715f4ebd4d9051f',
    },
    effects: {
      path: 'docs/verification/fpv-family-effects-continuation-2026-09-28/review.json',
      gitBlob: '750801335ed95f52c0fa803f23d4931830e8e872',
      bytes: 9012,
      sha256: '1a72688bfca58ddd75f18b7719f5021972fb1ed88a1c6e043e63abef2e848ba9',
    },
    bulkPresentation: {
      path: 'docs/verification/bulk-integration-presentation-continuation-2026-09-27/review.json',
      gitBlob: '59df49b5f92a28da4d614b1b6a33825b5f73b888',
      bytes: 32234,
      sha256: 'ad469766d926795fddca108b77042b226282cc17b3a130429ad2b548b5e2edf5',
    },
    company: {
      path: 'docs/verification/v0.141.7-company-startup-audio-continuation/review.json',
      gitBlob: 'd0842999eabb1ae09f721fcf925ed43753be25fc',
      bytes: 10565,
      sha256: '1d3660001a2ebe7d4d2daf5e68ab745e9e902d5c2f1757a398439de3caedccad',
    },
    bulkAudio: {
      path: 'docs/verification/bulk-integration-audio-continuation-2026-09-27/review.json',
      gitBlob: '7d05300f80f912fa266dbab303852bbac6657331',
      bytes: 13271,
      sha256: '067305195ea075c35f14402d970fb5d2819044720875374b157c9431d9c5d820',
    },
    managedMedia: {
      path: 'docs/verification/v0.141.0-managed-media-audio-continuation/review.json',
      gitBlob: '5477de5ae94aeb8476b36f693fb4d64f25dca558',
      bytes: 6622,
      sha256: '16f3eb26f28eae82f6529c8a872438c216a05d7a905e0fee0b3d6b0e9601e998',
    },
  };
  return (
    hash(currentBytes) === '5ec246c93cf5dfe6d5a3f6538788d618575037a11d2c1890d88d0257f2e7d0b3' &&
    Array.isArray(predecessors) &&
    predecessors.length === Object.keys(expected).length &&
    Object.values(expected).every((pin, index) => hash(predecessors[index]) === pin.sha256)
  );
}

export function verifyFieldKitSteamDeckPresentationContinuationReview(
  currentBytes,
  actorOnlyBytes,
  localizationBytes,
  companyBytes,
  priorBytes,
  managedBytes,
) {
  return (
    hash(currentBytes) === '15b9ef304ba6e8ec6c2120e4e766fe630af327f2a54325bd0e9043ba875e9867' &&
    hash(actorOnlyBytes) === 'dbde124fb9d24cb26dd901b51f58cf59fc7bfb4df212e47419cdb15581155b73' &&
    hash(localizationBytes) ===
      '92c63ed7f4eb6f79502cae2089836de1fbdabcb1cacd76b55e22596e49492445' &&
    verifyFieldKitCompanyAudioContinuationReview(companyBytes, priorBytes, managedBytes)
  );
}

export function verifyFieldKitMainBulkAudioReview(currentBytes, mainBytes, bulkBytes) {
  return (
    hash(currentBytes) === 'afcfcca1612109e117595c424e03ac002271165ccb1a4082697011e16c4c5a75' &&
    hash(mainBytes) === '15b9ef304ba6e8ec6c2120e4e766fe630af327f2a54325bd0e9043ba875e9867' &&
    hash(bulkBytes) === '5ec246c93cf5dfe6d5a3f6538788d618575037a11d2c1890d88d0257f2e7d0b3'
  );
}

export function verifyFieldKitLocalizationAudioReview(currentBytes, mainBytes) {
  return (
    hash(currentBytes) === '104e5cb33140537f9234fc26966d4a32f70927c89f1e4bfd1e3955432e1910da' &&
    hash(mainBytes) === 'afcfcca1612109e117595c424e03ac002271165ccb1a4082697011e16c4c5a75'
  );
}

export function verifyFieldKitPlayerReadinessAudioReview(currentBytes, priorBytes) {
  return (
    hash(currentBytes) === '0584016a71b220780cc8912666638c468550c7167c2c1084b28b7952f27fa608' &&
    hash(priorBytes) === '104e5cb33140537f9234fc26966d4a32f70927c89f1e4bfd1e3955432e1910da'
  );
}

export function verifyFieldKitAudioStyleMenuReview(currentBytes, priorBytes) {
  return (
    hash(currentBytes) === 'bc87031d46ded1ace2cc62c6ca87e2ce90ccbb043db7c5fdb653d262c3b94f49' &&
    hash(priorBytes) === '0584016a71b220780cc8912666638c468550c7167c2c1084b28b7952f27fa608'
  );
}

export function verifyFieldKitAudioStyleMenuCorrectionReview(
  currentBytes,
  priorBytes,
  predecessorOracleBytes,
) {
  return (
    hash(currentBytes) === '62c1dac1be4286acdb8201aab99b6d3c5e2e2b282e1c88cb34d88af527172e09' &&
    hash(priorBytes) === 'bc87031d46ded1ace2cc62c6ca87e2ce90ccbb043db7c5fdb653d262c3b94f49' &&
    hash(predecessorOracleBytes) ===
      'e397af798928a72502c970276fe212eaad8d2a4889f5afe02587559244496714'
  );
}

export function verifyFieldKitSteamDeckAudioContinuationReview(
  currentBytes,
  priorBytes,
  predecessorOracleBytes,
) {
  return (
    hash(currentBytes) === 'a059520f6ce0c394c3425355c711b641b4b23f9321e11c7d384317e7f814798c' &&
    hash(priorBytes) === '62c1dac1be4286acdb8201aab99b6d3c5e2e2b282e1c88cb34d88af527172e09' &&
    hash(predecessorOracleBytes) ===
      '528361f4e7823a23b02b261ca1de0c9b3157d1a17cbba643e4ff7e67073bc0a7'
  );
}

export function verifyFieldKitDiscoveryAudioContinuationReview(
  currentBytes,
  steamDeckBytes,
  predecessorBytes,
  production100OracleBytes,
) {
  return (
    hash(currentBytes) === 'edeecf9fbafdabd7e4fdb653be58baf8deaa3483a6ee426552d611d2fff768ea' &&
    hash(steamDeckBytes) === 'a059520f6ce0c394c3425355c711b641b4b23f9321e11c7d384317e7f814798c' &&
    hash(predecessorBytes) === '62c1dac1be4286acdb8201aab99b6d3c5e2e2b282e1c88cb34d88af527172e09' &&
    hash(production100OracleBytes) ===
      'cf19ad831cc0347f4f84c2ac310a1168354858e75f40991b35ffec18ea58d0b7'
  );
}

export function verifyFieldKitDiscoveryWebPUIContinuationReview(
  currentBytes,
  priorReviewBytes,
  production101OracleBytes,
) {
  return (
    hash(currentBytes) === '2496cbfe4e885a931f22cbf5287efac45344074bb14dc4cf96f09a2d5a0a366f' &&
    hash(priorReviewBytes) === '15b9ef304ba6e8ec6c2120e4e766fe630af327f2a54325bd0e9043ba875e9867' &&
    hash(production101OracleBytes) ===
      'bb8ef5f69c674d36737dcfd8a23267eb5207fd0bc2757965ae841da552b2551c'
  );
}

export function verifyFieldKitGP4RestoreAudioContinuationReview(
  currentBytes,
  priorReviewBytes,
  production102OracleBytes,
) {
  return (
    hash(currentBytes) === '27c3663b72c1ccf1b78b2bf641952ff5d011e10520f0044d981f5c8166741b0d' &&
    hash(priorReviewBytes) === 'edeecf9fbafdabd7e4fdb653be58baf8deaa3483a6ee426552d611d2fff768ea' &&
    hash(production102OracleBytes) ===
      '88f08a4ed55e2d7a26e491828d808d1a2c6784ab5e811acce7537009a68ad315'
  );
}

export function verifyFieldKitSelectorAudioContinuationReview(
  currentBytes,
  priorBytes,
  predecessorOracleBytes,
) {
  return (
    hash(currentBytes) === 'f2cf0cc93f8de8e959eabf6e6313a0af306dfae87e2cb663bfe7bef805df6fe6' &&
    hash(priorBytes) === 'a059520f6ce0c394c3425355c711b641b4b23f9321e11c7d384317e7f814798c' &&
    hash(predecessorOracleBytes) ===
      'db9cc258d79aaa0caaf587fa3c73be5fcc55cea5f6129524c59255f04f3bbeb0'
  );
}

export function verifyFieldKitMainReconciliationReview(...inputs) {
  const expected = [
    'f2b3a2724cf48455dbe98d5ca12a2b081ef1f982531e91838c0291a64bbed976',
    'f2cf0cc93f8de8e959eabf6e6313a0af306dfae87e2cb663bfe7bef805df6fe6',
    '27c3663b72c1ccf1b78b2bf641952ff5d011e10520f0044d981f5c8166741b0d',
    'aeb03a91c4da24fe300a9312b79ef986265d6bc78ce6f1f3893549d5fb5a8daa',
    '9aac97ef9ded7270148887d8148fc01fec378f5e5ef612ca86b3353015263e91',
    'a11e83533645783b6e35fd815e4494480527febe45d1f3afca86754d5a9a43d6',
    'b4b40e42fc155e8bd7223654a1464332d535b6850de32d8b09b103b0184a9fd9',
  ];
  return (
    inputs.length === expected.length &&
    inputs.every((bytes, index) => hash(bytes) === expected[index])
  );
}

export function verifyFieldKitRadioAudioContinuationReview(currentBytes, priorBytes, oracleBytes) {
  return (
    hash(currentBytes) === '93fdb14773e7ef58cdcaebcf1db3d4a3100d77aa13081d25ff799aa0e24c84e3' &&
    hash(priorBytes) === 'f2b3a2724cf48455dbe98d5ca12a2b081ef1f982531e91838c0291a64bbed976' &&
    hash(oracleBytes) === '83c4153ec97c693526b6d00baf722b4494a107cd48f03a991f7e2de64b7de3d2'
  );
}

export function verifyFieldKitNativeMenuContinuationReview(...inputs) {
  const expected = [
    '950d4dc78138e5c4ac9c9b529fcc11b0e0b3e631975f0cc44fe3b5ceef2d59c0',
    '2496cbfe4e885a931f22cbf5287efac45344074bb14dc4cf96f09a2d5a0a366f',
    '93fdb14773e7ef58cdcaebcf1db3d4a3100d77aa13081d25ff799aa0e24c84e3',
    '21e92eaf18e5ed619c91d47c734ef1602aa8dac5ae859d7c1837d71b0b161257',
  ];
  return (
    inputs.length === expected.length &&
    inputs.every((bytes, index) => hash(bytes) === expected[index])
  );
}

/** Explicit dependency fingerprints; a helper change must reopen its review group. */
export async function fieldKitRecipeSources(read) {
  return Object.fromEntries(
    await Promise.all(
      Object.entries(sources).map(async ([group, paths]) => [
        group,
        `${paths} sha256:${hash(Buffer.concat(await Promise.all(paths.split('; ').map((file) => read(file)))))}`,
      ]),
    ),
  );
}

export async function createFieldKitProduction({
  projectRoot = root,
  read = async (relative) => fs.readFile(path.join(projectRoot, relative)),
} = {}) {
  const json = async (relative) => JSON.parse(await read(relative));
  if (
    !verifyFieldKitNativeMenuContinuationReview(
      await read('docs/verification/native-menu-ui-audio-20260930/review.json'),
      await read('docs/verification/discovery-webp-ui-continuation-2026-09-29/review.json'),
      await read('docs/verification/radio-audio-20260929/review.json'),
      await read('game/test/fixtures/production-native-main1b-fpv103.json'),
    )
  )
    throw new Error(
      'Native menu UI/audio continuation or canonical production103 oracle changed; production approval must reopen.',
    );
  const baseline = createDefaultThemeBundle();
  const recipeSources = await fieldKitRecipeSources(read);
  const bulkContinuationReviewBytes = await readBulkPresentationContinuation(read);
  const companyAudioReviewBytes = await read(
    'docs/verification/v0.141.7-company-startup-audio-continuation/review.json',
  );
  const externalAudioReviewBytes = await read(
    'docs/verification/external-soundtrack-delivery-2026-09-27/review.json',
  );
  const branchRebaseAudioReviewBytes = await read(
    'docs/verification/canonical-soundtrack-rebase-audio-continuation-2026-09-27/review.json',
  );
  if (
    !verifyFieldKitCompanyAudioContinuationReview(
      companyAudioReviewBytes,
      await read('docs/verification/bulk-integration-audio-continuation-2026-09-27/review.json'),
      await read('docs/verification/v0.141.0-managed-media-audio-continuation/review.json'),
    )
  )
    throw new Error('Audio continuation review bytes changed; production approval must reopen.');
  if (
    !verifyFieldKitCanonicalSoundtrackReview(
      await read('docs/verification/canonical-soundtrack-main-rebase-2026-09-28/review.json'),
      companyAudioReviewBytes,
      branchRebaseAudioReviewBytes,
      externalAudioReviewBytes,
    )
  )
    throw new Error(
      'Canonical soundtrack continuation review bytes changed; production approval must reopen.',
    );
  if (
    !verifyFieldKitBulkQueueReview(
      await read('docs/verification/bulk-queue-audio-effects-2026-09-28/review.json'),
      await Promise.all(
        [
          'docs/verification/canonical-soundtrack-main-rebase-2026-09-28/review.json',
          'docs/verification/fpv-family-effects-continuation-2026-09-28/review.json',
          'docs/verification/bulk-integration-presentation-continuation-2026-09-27/review.json',
          'docs/verification/v0.141.7-company-startup-audio-continuation/review.json',
          'docs/verification/bulk-integration-audio-continuation-2026-09-27/review.json',
          'docs/verification/v0.141.0-managed-media-audio-continuation/review.json',
        ].map(read),
      ),
    )
  )
    throw new Error(
      'Bulk queue continuation review bytes changed; production approval must reopen.',
    );
  if (
    !verifyFieldKitSteamDeckPresentationContinuationReview(
      await read(
        'docs/verification/v0.141.8-steamdeck-confirm-presentation-continuation/review.json',
      ),
      await read('docs/verification/actor-only-ui-continuation-2026-09-24/review.json'),
      await read('docs/verification/v0.131.0-localization-presentation-continuation/review.json'),
      await read('docs/verification/v0.141.7-company-startup-audio-continuation/review.json'),
      await read('docs/verification/bulk-integration-audio-continuation-2026-09-27/review.json'),
      await read('docs/verification/v0.141.0-managed-media-audio-continuation/review.json'),
    )
  )
    throw new Error(
      'Steam Deck presentation continuation review bytes changed; production approval must reopen.',
    );
  if (
    !verifyFieldKitMainBulkAudioReview(
      await read('docs/verification/bulk-main320-audio-continuation-2026-09-28/review.json'),
      await read(
        'docs/verification/v0.141.8-steamdeck-confirm-presentation-continuation/review.json',
      ),
      await read('docs/verification/bulk-queue-audio-effects-2026-09-28/review.json'),
    )
  )
    throw new Error(
      'Main/bulk audio continuation review bytes changed; production approval must reopen.',
    );
  if (
    !verifyFieldKitLocalizationAudioReview(
      await read('docs/verification/localization14-audio-continuation-2026-09-28/review.json'),
      await read('docs/verification/bulk-main320-audio-continuation-2026-09-28/review.json'),
    )
  )
    throw new Error(
      'Localization audio continuation review bytes changed; production approval must reopen.',
    );
  if (
    !verifyFieldKitPlayerReadinessAudioReview(
      await read('docs/verification/player-readiness17-audio-continuation-2026-09-28/review.json'),
      await read('docs/verification/localization14-audio-continuation-2026-09-28/review.json'),
    )
  )
    throw new Error(
      'Player readiness audio continuation review bytes changed; production approval must reopen.',
    );
  if (
    !verifyFieldKitSteamDeckAudioContinuationReview(
      await read('docs/verification/v0.142.3-steamdeck-confirm-audio-continuation/review.json'),
      await read('docs/verification/audio-style-menu-correction-2026-09-28/review.json'),
      await read('game/test/fixtures/production-v01422-a585-fpv99.json'),
    )
  )
    throw new Error(
      'Steam Deck audio continuation review or production99 predecessor oracle bytes changed; production approval must reopen.',
    );
  if (
    !verifyFieldKitAudioStyleMenuCorrectionReview(
      await read('docs/verification/audio-style-menu-correction-2026-09-28/review.json'),
      await read('docs/verification/audio-style-menu-2026-09-28/review.json'),
      await read('game/test/fixtures/production-pr770-0d165-audio50.json'),
    )
  )
    throw new Error(
      'Audio style-menu correction review or production98 predecessor oracle bytes changed; production approval must reopen.',
    );
  if (
    !verifyFieldKitAudioStyleMenuReview(
      await read('docs/verification/audio-style-menu-2026-09-28/review.json'),
      await read('docs/verification/player-readiness17-audio-continuation-2026-09-28/review.json'),
    )
  )
    throw new Error(
      'Audio style-menu continuation review bytes changed; production approval must reopen.',
    );
  if (
    !verifyFieldKitDiscoveryAudioContinuationReview(
      await read('docs/verification/discovery-audio-continuation-2026-09-29/review.json'),
      await read('docs/verification/v0.142.3-steamdeck-confirm-audio-continuation/review.json'),
      await read('docs/verification/audio-style-menu-correction-2026-09-28/review.json'),
      await read('game/test/fixtures/production-v01423-6a67-fpv100.json'),
    )
  )
    throw new Error(
      'Discovery audio continuation review or production100 predecessor oracle bytes changed; production approval must reopen.',
    );
  if (
    !verifyFieldKitDiscoveryWebPUIContinuationReview(
      await read('docs/verification/discovery-webp-ui-continuation-2026-09-29/review.json'),
      await read(
        'docs/verification/v0.141.8-steamdeck-confirm-presentation-continuation/review.json',
      ),
      await read('game/test/fixtures/production-discovery-source-ui-fpv101.json'),
    )
  )
    throw new Error(
      'Discovery WebP UI continuation review or production101 predecessor oracle bytes changed; production approval must reopen.',
    );
  if (
    !verifyFieldKitGP4RestoreAudioContinuationReview(
      await read(
        'docs/verification/discovery-gp4-restore-audio-continuation-2026-09-29/review.json',
      ),
      await read('docs/verification/discovery-audio-continuation-2026-09-29/review.json'),
      await read('game/test/fixtures/production-discovery-reviewed-ui-fpv102.json'),
    )
  )
    throw new Error(
      'GP4 restore audio continuation review or production102 predecessor oracle bytes changed; production approval must reopen.',
    );
  if (
    !verifyFieldKitSelectorAudioContinuationReview(
      await read('docs/verification/v0.142.4-selector-audio-continuation/review.json'),
      await read('docs/verification/v0.142.3-steamdeck-confirm-audio-continuation/review.json'),
      await read('game/test/fixtures/production-v01423-b5ab-fpv100.json'),
    )
  )
    throw new Error(
      'Selector audio continuation review or production100 predecessor oracle bytes changed; production approval must reopen.',
    );
  if (
    !verifyFieldKitSteamDeckAudioContinuationReview(
      await read('docs/verification/v0.142.3-steamdeck-confirm-audio-continuation/review.json'),
      await read('docs/verification/audio-style-menu-correction-2026-09-28/review.json'),
      await read('game/test/fixtures/production-v01422-a585-fpv99.json'),
    )
  )
    throw new Error(
      'Steam Deck audio continuation review or production99 predecessor oracle bytes changed; production approval must reopen.',
    );
  if (
    !verifyFieldKitAudioStyleMenuCorrectionReview(
      await read('docs/verification/audio-style-menu-correction-2026-09-28/review.json'),
      await read('docs/verification/audio-style-menu-2026-09-28/review.json'),
      await read('game/test/fixtures/production-pr770-0d165-audio50.json'),
    )
  )
    throw new Error(
      'Audio style-menu correction review or production98 predecessor oracle bytes changed; production approval must reopen.',
    );
  if (
    !verifyFieldKitAudioStyleMenuReview(
      await read('docs/verification/audio-style-menu-2026-09-28/review.json'),
      await read('docs/verification/player-readiness17-audio-continuation-2026-09-28/review.json'),
    )
  )
    throw new Error(
      'Audio style-menu continuation review bytes changed; production approval must reopen.',
    );
  if (
    !verifyFieldKitMainReconciliationReview(
      ...(await Promise.all(
        [
          'docs/verification/discovery-main321-reconciliation/review.json',
          'docs/verification/v0.142.4-selector-audio-continuation/review.json',
          'docs/verification/discovery-gp4-restore-audio-continuation-2026-09-29/review.json',
          'game/test/fixtures/production-v01424-main321-fpv101.json',
          'game/test/fixtures/production-discovery-db4-fpv103.json',
          'docs/verification/discovery-main321-reconciliation/discovery-production103.rltheme.gz',
          'docs/verification/discovery-main321-reconciliation/retained-inputs.json',
        ].map(read),
      )),
    )
  )
    throw new Error(
      'Merged main/candidate continuation or exact lineage inputs changed; production approval must reopen.',
    );
  if (
    !verifyFieldKitRadioAudioContinuationReview(
      await read('docs/verification/radio-audio-20260929/review.json'),
      await read('docs/verification/discovery-main321-reconciliation/review.json'),
      await read('game/test/fixtures/production-radio-head280-fpv102.json'),
    )
  )
    throw new Error('Radio audio continuation or exact production102 predecessor changed.');
  const assets = [],
    bindings = {},
    bytes = new Map();
  const add = (slotId, values, body = null) => {
    const slot = ASSET_SLOTS.find((s) => s.id === slotId);
    if (!slot) throw new Error(`Unknown production slot ${slotId}.`);
    const asset = {
      format: FORMATS.asset,
      id: `${slotId}.field-kit`,
      revision: 1,
      description: slot.label,
      file: null,
      recipe: null,
      geometry: null,
      provenance: {
        creator: 'Reveal Line',
        source: 'Original Field Kit production',
        license: 'Original project artwork and components',
        prompt: slot.prompt,
        parent: { id: `${slotId}.default`, revision: 1 },
      },
      quality: { stage: 'produced', evidence: [] },
      ...values,
    };
    if (body) {
      if (body.length !== asset.file.bytes || hash(body) !== asset.file.sha256)
        throw new Error(`Production bytes changed for ${slotId}.`);
      bytes.set(asset.file.sha256, new Blob([body], { type: asset.file.mime }));
    }
    assets.push(asset);
    bindings[slotId] = reference(asset);
  };
  for (const slot of ASSET_SLOTS) {
    // Team roles cannot inherit a Solo effects approval: their painter and
    // state recipes have a separate fingerprint and require their own review.
    const group = slot.id.startsWith('team.') ? 'team' : slot.group;
    if (!sources[group] || TEAM_EQUIPMENT_IDS.includes(slot.id)) continue;
    add(slot.id, {
      kind: 'recipe',
      recipe: { id: slot.recipes[0] },
      description: `${slot.label}: existing bounded component with Field Kit tokens and state styling.`,
      provenance: {
        creator: 'Reveal Line',
        source: recipeSources[group],
        license: 'Project-authored runtime recipe',
        prompt: slot.prompt,
        parent: { id: `${slot.id}.default`, revision: 1 },
      },
      quality: recipeQuality(group, recipeSources[group]),
    });
  }
  const sprites = await json('game/assets/field-kit/sprites/sprites.json');
  for (const sprite of sprites.assets) {
    const { path: filePath, ...file } = sprite.file;
    add(
      sprite.slotId,
      {
        kind: 'image',
        file,
        geometry: sprite.geometry,
        description: sprite.description,
        provenance: {
          ...sprite.provenance,
          parent: { id: `${sprite.slotId}.default`, revision: 1 },
        },
        quality: sprite.quality,
      },
      await read(`game/assets/field-kit/sprites/${filePath}`),
    );
  }
  const teamReviewBytes = await read('docs/verification/team37/review.json');
  const teamSuccessorReviewBytes = await read(
    'docs/verification/team-specialist-cues-2026-09-24/review.json',
  );
  const teamContinuationReviewBytes = await read(
    'docs/verification/v0.132.5-presentation-continuation/review.json',
  );
  const inheritedAssets = Object.fromEntries(
    assets.filter((asset) => asset.kind === 'image').map((asset) => [asset.id, asset]),
  );
  for (const asset of assets) {
    if (!asset.id.startsWith('team.') || asset.kind !== 'recipe') continue;
    const slotId = asset.id.slice(0, -'.field-kit'.length);
    const defaultAsset = baseline.assets.find(
      (entry) => entry.id === asset.provenance.parent.id && entry.revision === 1,
    );
    asset.quality = fieldKitTeamRecipeQuality({
      slotId,
      source: recipeSources.team,
      recipe: asset.recipe,
      defaultAsset,
      inheritedAssets,
      reviewBytes: teamReviewBytes,
      successorReviewBytes: teamSuccessorReviewBytes,
      continuationReviewBytes: teamContinuationReviewBytes,
      bulkContinuationReviewBytes,
    });
  }
  const equipmentSource = 'game/presentation/team-equipment-art.mjs';
  const equipmentHash = hash(await read(equipmentSource));
  const equipmentReviewSource = await fieldKitEquipmentSource(read);
  for (const slotId of TEAM_EQUIPMENT_IDS) {
    const slot = ASSET_SLOTS.find((entry) => entry.id === slotId);
    const image = teamEquipmentArt(slotId),
      body = encodeSpritePNG(image),
      measured = inspectSprite(image);
    add(
      slotId,
      {
        kind: 'image',
        file: {
          sha256: hash(body),
          bytes: body.length,
          mime: 'image/png',
          width: image.width,
          height: image.height,
        },
        geometry: { ...structuredClone(slot.geometry), occupiedBounds: measured.occupiedBounds },
        description: TEAM_EQUIPMENT_DESCRIPTIONS[slotId],
        provenance: {
          creator: 'Reveal Line',
          source: `${equipmentSource} sha256:${equipmentHash}; consumer-sha256:${equipmentReviewSource}`,
          license: 'Original project integer-pixel equipment artwork',
          prompt: slot.prompt,
          parent: { id: `${slotId}.default`, revision: 1 },
        },
        quality: fieldKitEquipmentQuality(
          slotId,
          equipmentReviewSource,
          hash(body),
          teamSuccessorReviewBytes,
          teamContinuationReviewBytes,
          bulkContinuationReviewBytes,
        ),
      },
      body,
    );
  }
  const iconHash = hash(await read('game/presentation/icons.mjs'));
  for (const slotId of FIELD_KIT_ICON_IDS) {
    const slot = ASSET_SLOTS.find((s) => s.id === slotId);
    const image = iconForSlot(slotId),
      body = encodeSpritePNG(image),
      measured = inspectSprite(image);
    add(
      slotId,
      {
        kind: 'image',
        file: {
          sha256: hash(body),
          bytes: body.length,
          mime: 'image/png',
          width: image.width,
          height: image.height,
        },
        geometry: { ...structuredClone(slot.geometry), occupiedBounds: measured.occupiedBounds },
        description: FIELD_KIT_ICON_DESCRIPTIONS[slotId],
        provenance: {
          creator: 'Reveal Line',
          source: `game/presentation/icons.mjs sha256:${iconHash}`,
          license: 'Original project pixel glyph recipe',
          prompt: slot.prompt,
          parent: { id: `${slotId}.default`, revision: 1 },
        },
      },
      body,
    );
  }
  const fonts = await json('game/ui/fonts/field-kit/provenance.json');
  for (const font of fonts.fonts)
    add(
      `font.${font.role}`,
      {
        kind: 'font',
        file: {
          sha256: font.sha256,
          bytes: font.bytes,
          mime: 'font/woff2',
          width: null,
          height: null,
        },
        description: `${font.family}: self-hosted English/Ukrainian font.`,
        provenance: {
          creator: font.family + ' upstream authors',
          source: font.sourceUrl,
          license: `${font.license}; game/ui/fonts/field-kit/${font.licenseFile}`,
          prompt: ASSET_SLOTS.find((s) => s.id === `font.${font.role}`).prompt,
          parent: { id: `font.${font.role}.default`, revision: 1 },
        },
        quality: {
          stage: 'reviewed',
          evidence: [
            'scripts/verify-field-kit-fonts.py: 178 required codepoints in actual shipped WOFF2; bilingual specimens and 60 typography compatibility checks passed.',
          ],
        },
      },
      await read(`game/ui/fonts/field-kit/${font.file}`),
    );
  const scenes = await json('authoring/library/fpv-field-kit/prepared-scenes-v2.json');
  const portraitPrompt = (await json('authoring/library/fpv-field-kit/title-portrait-source.json'))
    .effectivePrompt;
  const landscapePrompt = (await read('authoring/library/fpv-field-kit/README.md'))
    .toString('utf8')
    .split('## Resolved generation prompt\n\n')[1]
    .split('\n\nPrepared v1 scenes')[0]
    .trim();
  for (const scene of scenes.records) {
    const slotId = scene.id.includes('portrait')
      ? 'screen.title.portrait'
      : 'screen.title.background';
    const slot = ASSET_SLOTS.find((s) => s.id === slotId);
    const { path: filePath, pixelsSha256: _pixels, ...file } = scene.output;
    // Replace the prepared recipe binding while keeping both immutable records.
    add(
      slotId,
      {
        id: `${slotId}.field-kit-scene`,
        kind: 'image',
        file: { ...file, mime: 'image/png' },
        geometry: {
          ...structuredClone(slot.geometry),
          occupiedBounds: { x: 0, y: 0, width: 1, height: 1 },
        },
        provenance: {
          creator: 'Reveal Line via built-in image generation',
          source: `${scene.source.path} sha256:${scene.source.sha256}`,
          license:
            'Original generated project artwork; unchanged source retained in authoring library',
          prompt:
            (scene.id.includes('portrait') ? portraitPrompt : landscapePrompt) +
            `\nPrepared production frame: ${file.width}×${file.height}; original preserved; ${JSON.stringify(scene.preparation)}.`,
          parent: { id: `${slotId}.default`, revision: 1 },
        },
        quality: scene.quality,
      },
      await read(filePath),
    );
  }
  let reveals = null;
  try {
    reveals = await json('authoring/library/fpv-field-kit/prepared/reveals/reveals.json');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (reveals) {
    for (const entry of reveals.assets) {
      const { path: filePath, pixelsSha256: _pixels, ...file } = entry.file;
      const exampleSlot =
        entry.compositionId === 'scene-signal-01' && file.width === 768
          ? 'scene.reveal.legacy'
          : entry.compositionId === 'scene-orchard-window' && file.width === 1152
            ? 'scene.reveal.wide'
            : null;
      for (const slotId of [...entry.slotIds, ...(exampleSlot ? [exampleSlot] : [])])
        add(
          slotId,
          {
            kind: 'image',
            file,
            geometry: entry.geometry,
            description: entry.description ?? entry.compositionId,
            provenance: {
              creator: entry.provenance.creator,
              source: `${entry.provenance.source.path} sha256:${entry.provenance.source.sha256}`,
              license: entry.provenance.license,
              prompt: `${entry.provenance.prompt}\n\nPREPARED PRODUCTION CONTRACT: ${file.width}×${file.height} opaque PNG. Preserve these exact derivative settings for compatible variations:\n${JSON.stringify(entry.preparation, null, 2)}`,
              parent: { id: `${slotId}.default`, revision: 1 },
            },
            quality: entry.quality,
          },
          await read(filePath),
        );
    }
  }
  const document = reviseStudioTheme(baseline, { assets, bindings });
  return { document, assets: bytes, coverage: presentationCoverage(document) };
}
/** Deterministic production output from the ledger and explicit retained inputs.
 * This stage owns no release writes and does not read prior compiled artifacts. */
export async function compileFieldKitProduction(
  production,
  { read = (relative) => fs.readFile(path.join(root, relative)), config = {} } = {},
) {
  const previousOutput = await readFieldKitRetainedOutput({ read, assets: production.assets });
  const result = await compilePresentation(production.document, production.assets, {
    previousOutput,
  });
  // Format current artifacts only; retained runtime names bind original raw bytes.
  for (const [name, body] of result.files) {
    if (!/\.(json|css)$/.test(name) || retainedPresentationPath(name)) continue;
    const formatted = Buffer.from(
      await format(new TextDecoder().decode(body), {
        ...config,
        parser: name.endsWith('.json') ? 'json' : 'css',
      }),
    );
    // Pretty-printing must not make otherwise valid Studio metadata unloadable.
    // The compiler already provided bounded canonical bytes as the fallback.
    if (name !== 'studio.json' || formatted.length <= LIMITS.manifestBytes)
      result.files.set(name, formatted);
  }
  const inventory = [...result.files]
    .filter(([name]) => name !== 'manifest.json')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, body]) => ({ path: name, bytes: body.length, sha256: hash(body) }));
  result.files.set(
    'manifest.json',
    Buffer.from(
      await format(
        JSON.stringify({
          format: 'revealline-presentation-build.v1',
          source: { id: production.document.id, revision: production.document.revision },
          files: inventory,
        }),
        { ...config, parser: 'json' },
      ),
    ),
  );
  return result;
}
async function generate(args) {
  if (args.length !== 1 || !['--write', '--check'].includes(args[0]))
    throw new Error('Use --write to adopt production assets or --check for reproducibility.');
  const production = await createFieldKitProduction();
  const historyPath = path.join(root, 'authoring/library/fpv-field-kit/production.rltheme');
  let history = null;
  try {
    history = await importThemeBundle(new Blob([await fs.readFile(historyPath)]), {
      decodeImage: null,
    });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  production.document = retainFieldKitProductionHistory(production.document, history?.document);
  production.assets = new Map([...(history?.assets ?? []), ...production.assets]);
  production.coverage = presentationCoverage(production.document);
  const historyBytes = Buffer.from(
    await (await exportThemeBundle(production.document, production.assets)).arrayBuffer(),
  );
  if (
    args[0] === '--check' &&
    (!history || hash(await fs.readFile(historyPath)) !== hash(historyBytes))
  )
    throw new Error(
      'Stale production revision ledger. Run --write to append compatible revisions.',
    );
  const config = await resolveConfig(path.join(root, 'game/build-config.json'));
  const result = await compileFieldKitProduction(production, { config });
  const out = path.join(root, 'game/presentation/compiled');
  await writePresentation(result.files, out, { check: args[0] === '--check' });
  if (args[0] === '--write') {
    const temporary = `${historyPath}.tmp-${process.pid}`;
    try {
      await fs.writeFile(temporary, historyBytes, { flag: 'wx' });
      await fs.rename(temporary, historyPath);
    } finally {
      await fs.rm(temporary, { force: true });
    }
  }
  process.stdout.write(
    JSON.stringify({
      source: production.document.id,
      revision: production.document.revision,
      slots: production.document.slots.length,
      files: result.files.size,
      assetBytes: [...production.assets.values()].reduce((n, b) => n + b.size, 0),
      coverage: production.coverage.counts,
      qualification:
        'Production candidate. Review required slots in real screens before publication.',
    }) + '\n',
  );
}
async function main(args) {
  if (args.length === 2 && ['--candidate', '--check-candidate'].includes(args[0])) {
    const { runFieldKitCandidate } = await import('./field-kit-production-candidate.mjs');
    return runFieldKitCandidate({
      destination: args[1],
      check: args[0] === '--check-candidate',
    });
  }
  if (args.length !== 1 || !['--write', '--check'].includes(args[0]))
    throw new Error(
      'Use --candidate NEW_DIRECTORY or --check-candidate DIRECTORY for isolated review; --write/--check target published production.',
    );
  if (args[0] === '--check') return generate(args);
  const lockPath = path.join(root, 'authoring/library/fpv-field-kit/production.rltheme.lock');
  let lock;
  try {
    lock = await fs.open(lockPath, 'wx');
  } catch (error) {
    if (error.code === 'EEXIST')
      throw new Error(
        'Another production writer owns the ledger lock. Inspect it before retrying.',
      );
    throw error;
  }
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid }) + '\n');
    return await generate(args);
  } finally {
    await lock.close();
    await fs.unlink(lockPath);
  }
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(error.message + '\n');
    process.exitCode = 1;
  });
