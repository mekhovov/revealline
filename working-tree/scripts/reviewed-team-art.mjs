import { createHash } from 'node:crypto';

// Exact externally inspected inputs. Changes reopen review for the whole family.
// The generator itself still emits produced assets; this separate adoption step
// carries the bounded decision recorded with its original evidence below.
const reviewedInputs = {
  'authoring/library/team-anchor-field-kit-v1/source.mjs':
    'ee4568b5b44e4efaca1de6f0f5cb700412a22a0da7b40ae2a83fc8b7d8b4f65e',
  'authoring/library/team-anchor-field-kit-v1/prepared/manifest.json':
    'c915eb29bc70307318c72757af604d1625a8eef38f73fbd2590e5e2a629a4778',
  'authoring/library/team-anchor-field-kit-v1/prepared/available.png':
    'e4b2ae934b66821bf1ba9db755a23f11df2470d48ad47f549eb2a2aeebbd0353',
  'authoring/library/team-anchor-field-kit-v1/prepared/captured.png':
    'fad4a744dfdfb9bd328494e9ffff0440c6ed520695d89aa8ca9a5aee3c3ee9d6',
  'authoring/library/team-feedback-field-kit-v1/source.mjs':
    '4728241a5a1fc4b163961ca85a438019da91892d8316f62d46447d354f38ad4f',
  'authoring/library/team-feedback-field-kit-v1/prepared/manifest.json':
    '3b05352f5a59474edeb2dc4da330f183885585512d204b2376f760c65fe994af',
  'authoring/library/team-feedback-field-kit-v1/prepared/support.png':
    'a2d58468a2d56988b6542bf44e74728ab53aa9d5f312d874b60a3de05f9a9def',
  'authoring/library/team-feedback-field-kit-v1/prepared/slowed.png':
    '4cabfd9cbdb4b7d4a3389f466896f0ed134a73f8964a4e5c65578b10b9027fdf',
  'authoring/library/team-feedback-field-kit-v1/prepared/rescue.png':
    '0e1e3a81fb1517f8d9fbea61a139e38118e3dc89f0ce3f2148e17376fcf66b6c',
  'authoring/library/team-feedback-field-kit-v1/prepared/recovery.png':
    '53dc09b7187b54af081994da3e27dfbb31ab229097fae735de1b2b52388c7408',
  'game/presentation/team-anchor-slots.mjs':
    '2dee100af12eec8e5d60eff5bd2e0c2d431d55c6db7c800427bde937e391eb8f',
  'game/presentation/team-effect-slots.mjs':
    '82328525ddb631d33ae70ff24e28dc509356015a2c6d5df69545a60e866ec936',
  'scripts/produce-team-anchor-art.mjs':
    '8e0e2fad42d7fae3974b2230b3c91d595357e291c1c24cc3c81988204f3fadb3',
  'scripts/produce-team-feedback-art.mjs':
    '020ec01cd02fad02f24058abe5f9ab458bc9305a3a6578ea1ac12a87fccc884a',
};
const reviewedAssets = {
  'team.anchor.available': {
    sha256: 'e4b2ae934b66821bf1ba9db755a23f11df2470d48ad47f549eb2a2aeebbd0353',
    bytes: 194,
    width: 24,
    height: 24,
  },
  'team.anchor.captured': {
    sha256: 'fad4a744dfdfb9bd328494e9ffff0440c6ed520695d89aa8ca9a5aee3c3ee9d6',
    bytes: 192,
    width: 24,
    height: 24,
  },
  'team.effect.support': {
    sha256: 'a2d58468a2d56988b6542bf44e74728ab53aa9d5f312d874b60a3de05f9a9def',
    bytes: 271,
    width: 32,
    height: 32,
  },
  'team.effect.slowed': {
    sha256: '4cabfd9cbdb4b7d4a3389f466896f0ed134a73f8964a4e5c65578b10b9027fdf',
    bytes: 220,
    width: 32,
    height: 32,
  },
  'team.effect.rescue': {
    sha256: '0e1e3a81fb1517f8d9fbea61a139e38118e3dc89f0ce3f2148e17376fcf66b6c',
    bytes: 266,
    width: 32,
    height: 32,
  },
  'team.effect.recovery': {
    sha256: '53dc09b7187b54af081994da3e27dfbb31ab229097fae735de1b2b52388c7408',
    bytes: 289,
    width: 32,
    height: 32,
  },
};
const slots = new Set(Object.keys(reviewedAssets));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
export async function applyReviewedTeamArt(prepared, read) {
  const matching = await Promise.all(
    Object.entries(reviewedInputs).map(async ([path, digest]) => {
      try {
        return hash(await read(path)) === digest;
      } catch {
        return false;
      }
    }),
  );
  if (!matching.every(Boolean)) return prepared;
  if (
    prepared.length !== slots.size ||
    new Set(prepared.map((a) => a.slotId)).size !== slots.size ||
    prepared.some((a) => {
      const expected = reviewedAssets[a.slotId];
      return (
        !expected ||
        hash(a.body) !== expected.sha256 ||
        Object.entries(expected).some(([key, value]) => a.values.file?.[key] !== value)
      );
    })
  )
    return prepared;
  return prepared.map((asset) => ({
    ...asset,
    values: {
      ...asset.values,
      quality: {
        stage: 'reviewed',
        evidence: [
          'Scoped six-image decision: docs/verification/team-presentation-integration/six-art-review/FINDINGS.md; exact PNG, source, manifest, producer and slot-contract pins in adjacent audit.json.',
          'Original Studio uploads, available/captured and Support/slowed/rescue/recovery scenes, native-size/grayscale/light inspections and exact round-trips were independently examined. Original prepared manifests remain produced and unchanged.',
          'Artwork semantics and demonstrated contexts only. Keep authoritative labels, targets and timing; omit crowded decoration. Full adopted build, arbitrary maps, normal-motion performance, physical hardware, offline and public qualification remain separate.',
          `Exact adopted PNG SHA-256 ${hash(asset.body)}.`,
        ],
      },
    },
  }));
}
