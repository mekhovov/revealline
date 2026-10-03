import { required } from '../data-json.mjs';
import { creatorSHA256 } from '../creator/bytes.mjs';
import { createInstalledTeamCampaignStore } from '../creator/team-installed.mjs';
import { exportCreatorTeamCampaign } from '../creator/team.mjs';
import { exportCreatorTeamMediaCampaign } from '../creator/team-media.mjs';

/** Team and flight keep their existing storage, replay proofs and exact edition keys. */
export function createCommunityNativeInstalled({ indexedDB = globalThis.indexedDB } = {}) {
  const team = createInstalledTeamCampaignStore({ indexedDB });
  let flight = null;
  const world = () =>
    (flight ??= import('../../optional-practice/civilian-fpv/world-store.mjs').then((module) =>
      module.openWorldStore({ indexedDB }),
    ));
  async function storage(linked) {
    if (linked.family === 'team') {
      const inventory = await team.inventory();
      const edition = inventory.editions.find(
        (entry) => entry.editionId === linked.creatorEditionId,
      );
      return edition ? { installed: true, offloaded: false, manifestRetained: true } : null;
    }
    const store = await world(),
      revision = await store.get(linked.runtimeIdentity, { sha256: linked.creatorEditionId });
    return revision ? { installed: true, offloaded: false, manifestRetained: true } : null;
  }
  async function exported(linked) {
    let blob;
    if (linked.family === 'team') {
      const loaded = await team.load(linked.creatorEditionId);
      blob = loaded.media
        ? exportCreatorTeamMediaCampaign(loaded.media)
        : exportCreatorTeamCampaign(loaded.prepared);
    } else {
      const stored = await (
        await world()
      ).get(linked.runtimeIdentity, { sha256: linked.creatorEditionId });
      required(stored, 'This exact FPV world revision is not installed.');
      const { preparePack } = await import(
        '../../optional-practice/civilian-fpv/world-content.mjs'
      );
      blob = await preparePack(stored.project, { assets: stored.assets });
    }
    required(
      (await creatorSHA256(await blob.arrayBuffer())) === linked.creatorEditionId,
      'Native edition differs from its immutable portable bytes.',
    );
    return blob;
  }
  return Object.freeze({
    storage,
    async install(inspected) {
      if (inspected.family === 'team') {
        const review = await team.reviewInstall(inspected.prepared);
        required(review.enoughManagedSpace, 'The Team media library has insufficient space.');
        const installed = await team.install(inspected.prepared);
        required(installed.editionId === inspected.editionId, 'Team installed identity changed.');
      } else {
        const store = await world();
        await store.install({
          ...inspected.prepared,
          expectedGeneration: await store.generation(),
        });
      }
      return {
        family: inspected.family,
        missions: inspected.missions,
        assets: inspected.prepared.assets?.size ?? inspected.prepared.assets?.length ?? 0,
      };
    },
    async list(families = []) {
      const editions = families.includes('team') ? (await team.inventory()).editions : [];
      const revisions = families.includes('fpv')
        ? await (await world()).list({ includeRevisions: true })
        : [];
      return [
        ...editions.map((entry) => entry.editionId),
        ...revisions.map((revision) => revision.sha256),
      ];
    },
    export: exported,
    async reviewOffload(linked) {
      const blob = await exported(linked);
      let generation;
      if (linked.family === 'team') generation = (await team.inventory()).generation;
      else generation = await (await world()).generation();
      return {
        family: linked.family,
        editionId: linked.creatorEditionId,
        runtimeIdentity: linked.runtimeIdentity,
        generation,
        detachableBytes: blob.size,
        detachedAssets: 0,
      };
    },
    async offload(review) {
      if (review.family === 'team')
        await team.offloadEdition(review.editionId, { expectedGeneration: review.generation });
      else
        await (
          await world()
        ).removeRevision(review.runtimeIdentity, review.editionId, {
          expectedGeneration: review.generation,
        });
    },
    close() {
      team.close();
      if (flight) void flight.then((store) => store.close());
    },
  });
}
