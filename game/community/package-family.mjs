import { required } from '../data-json.mjs';
import { importCreatorBundle } from '../creator/bundle.mjs';
import { creatorSHA256, ownCreatorBlob } from '../creator/bytes.mjs';
import {
  importClassicSnakePackage,
  classicSnakePackageIdentity,
  CLASSIC_PACKAGE_MAX_BYTES,
} from '../snake/classic-community.mjs';
import {
  OVERFLIGHT_PACKAGE_FORMAT,
  importOverflightPackage,
  overflightPackageIdentity,
} from '../overflight/community.mjs';

import {
  OVERFLIGHT_HUNT_PACKAGE_FORMAT,
  importOverflightHuntPackage,
  overflightHuntPackageIdentity,
} from '../overflight/raid-community.mjs';

/** Native validators own each format. Family detection never trusts a file extension. */
export async function inspectCommunityPackage(source, options = {}) {
  const blob = ownCreatorBlob(source, 256 * 1024 * 1024, 'Community package');
  const prefix = new TextDecoder().decode(await blob.slice(0, 8).arrayBuffer());
  if (prefix === 'RLCNB1\r\n') {
    const prepared = await importCreatorBundle(blob, options);
    return {
      family: 'creator',
      prepared,
      editionId: prepared.editionId,
      title: prepared.review.name,
      missions: prepared.review.missions,
    };
  }
  if (prefix === 'RLTMC1\r\n') {
    const { importCreatorTeamMediaCampaign, exportCreatorTeamMediaCampaign } = await import(
      '../creator/team-media.mjs'
    );
    const prepared = await importCreatorTeamMediaCampaign(blob, options),
      editionId = await creatorSHA256(await blob.arrayBuffer());
    required(
      (await creatorSHA256(await exportCreatorTeamMediaCampaign(prepared).arrayBuffer())) ===
        editionId,
      'Re-export this Team media campaign from its native Studio before publishing.',
    );
    return {
      family: 'team',
      prepared,
      editionId,
      runtimeIdentity: editionId,
      title: prepared.pack.name,
      missions: prepared.pack.levels.length,
    };
  }
  if (prefix === 'RLFPV2\r\n') {
    const { inspectPack, preparePack } = await import(
      '../../optional-practice/civilian-fpv/world-content.mjs'
    );
    const { validateWorldCourse } = await import(
      '../../optional-practice/civilian-fpv/world-model.mjs'
    );
    const prepared = await inspectPack(blob);
    required(
      prepared.project.courses.length > 0,
      'Publish an FPV world with at least one playable course.',
    );
    for (const course of prepared.project.courses) validateWorldCourse(course);
    required(
      (await creatorSHA256(
        await (await preparePack(prepared.project, { assets: prepared.assets })).arrayBuffer(),
      )) === prepared.sha256,
      'Re-export this FPV world from its native Studio before publishing.',
    );
    return {
      family: 'fpv',
      prepared,
      editionId: prepared.sha256,
      runtimeIdentity: prepared.project.id,
      title: prepared.project.title,
      missions: prepared.project.courses.length,
    };
  }
  required(blob.size <= CLASSIC_PACKAGE_MAX_BYTES, 'Unsupported community package family or size.');
  // Fatal UTF-8 decoding preserves exact bytes for installed recovery exports.
  const bytes = await blob.arrayBuffer();
  new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if ([OVERFLIGHT_PACKAGE_FORMAT, OVERFLIGHT_HUNT_PACKAGE_FORMAT].includes(json?.format)) {
    const raid = json.format === OVERFLIGHT_HUNT_PACKAGE_FORMAT;
    const pack = await (raid ? importOverflightHuntPackage : importOverflightPackage)(blob),
      text = await blob.text(),
      editionId = await creatorSHA256(bytes);
    required(
      (await creatorSHA256(new TextEncoder().encode(text))) === editionId,
      'Overflight packages must use plain UTF-8 without a byte-order marker.',
    );
    return {
      family: raid ? 'overflight-hunt' : 'overflight',
      pack,
      text,
      editionId,
      runtimeIdentity: (raid ? overflightHuntPackageIdentity : overflightPackageIdentity)(pack),
      title: pack.project.title.en,
      missions: 1,
    };
  }
  if (
    ['revealline-creator-team-portable.v1', 'revealline-creator-team-portable.v2'].includes(
      json?.format,
    )
  ) {
    const { importCreatorTeamCampaign, exportCreatorTeamCampaign } = await import(
      '../creator/team.mjs'
    );
    const prepared = await importCreatorTeamCampaign(blob, options),
      editionId = await creatorSHA256(bytes);
    required(
      (await creatorSHA256(await exportCreatorTeamCampaign(prepared).arrayBuffer())) === editionId,
      'Re-export this Team campaign from its native Studio before publishing.',
    );
    return {
      family: 'team',
      prepared,
      editionId,
      runtimeIdentity: editionId,
      title: prepared.pack.name,
      missions: prepared.pack.levels.length,
    };
  }
  const pack = await importClassicSnakePackage(blob);
  const text = await blob.text();
  required(
    (await creatorSHA256(new TextEncoder().encode(text))) === (await creatorSHA256(bytes)),
    'Classic packages must use plain UTF-8 without a byte-order marker.',
  );
  return {
    family: 'classic',
    pack,
    text,
    editionId: await creatorSHA256(bytes),
    runtimeIdentity: classicSnakePackageIdentity(pack),
    title: pack.title.en,
    missions: pack.entries.length,
  };
}
