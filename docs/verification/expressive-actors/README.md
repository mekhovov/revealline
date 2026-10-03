# Expressive actors: implementation verification

This is a local preview and draft implementation, not a public-release qualification.
The full online roadmap is not complete. The inventory marks human completion routes
as pending rather than treating structural admission as proof of playability.

## Frozen source and build

The ordinary committed-source build was attempted from clean commit
`125bde7d77dbc982681419f828fcdb262f8a4cd2` (tree
`4f548900a3a3579a0180b3d5444a9fab7eca9549`), including Theme Studio main
`cf0b62e53d352c620f1793a3539c251e8932674b`.

```sh
node scripts/game-cli.mjs release-snapshot --ref HEAD --version v0.143.0 --source-format manifest
```

**Archive generation is blocked by disk capacity.** The normal output writer
returned `ENOSPC: no space left on device, write`; no completed archive or successful
release snapshot is claimed. The CLI removed its failed staging directory.
Raw build inputs alone total 783,224,901 bytes, before generated bodies and the
mandatory deterministic uncompressed ZIP. Approximately 949 MiB remained free
after cleanup. The final prepared-output inventory below is distinct from a
completed archive.

Normal `prepareBuildProject` completed against that exact committed source, with
all production validation and admission: 2,962 prepared files / 995,179,397 bytes.
The unchanged stored ZIP requires 995,683,591 bytes (about 950 MiB) by exact ZIP
header/member arithmetic; expanded files plus ZIP total 1,990,862,988 bytes
(about 1.85 GiB), before small source/marker/checksum metadata. The ZIP alone
exceeds the available disk. Allow at least 2.5 GB free for another ordinary
snapshot attempt. The [prepared inventory](prepared-distribution.json) records
core limits, full payload, largest entries, voice packs and exact provenance.

The final documentation-only commit follows this frozen runtime source. It adds
verification evidence; it does not change gameplay or emitted runtime files.

## Completed checks

- Full configured ESLint plus explicit room-service lint passed. Final packaging
  and build-writer additions also passed scoped ESLint.
- EN/UK localization passed: 12,910 messages and 8,978 references.
- Distribution validation passed: 2,781 files, valid literal references, and
  seven existing navigation warnings recorded in the JSON receipt.
- Presentation metadata remained pinned to field-kit revision 104, SHA-256
  `c905cab9ce4519379d57bdecf3ef02146b44d5a2ad82430a3939b2d2fc00f617`.
- Native content admission accepted all 84 new layouts and 36 actor variants.
  The [inventory](../../qualification/expressive-content-inventory.md) records
  exact identities, modes, paces, ownership and pending qualification routes.
- The optional SIM projection reproduces its checked-in bytes. All three native
  optional packages pass build, candidate and independent admission guards.
- Changed-file formatting and whitespace checks passed. Full formatting still
  flags 23 unchanged files; each is byte-identical to main `cf0b62e53` and also
  fails on that baseline. The JSON receipt lists them individually.
- The default offline core passes its unchanged 64 MiB guard. The final core contains 1,335 files / 67,034,483 bytes, leaving 74,381 bytes. All 48 actor recordings remain hosted and
  join the optional per-locale downloads. Metadata projections preserve exact
  data and pinned recovery descriptors; source files are unchanged.

Build output uses independent copy-on-write files when supported, with source
and target byte verification and an ordinary-write fallback. It never uses
hardlinks or changes emitted bytes. This reduces duplicated asset blocks, but the complete archive still needs more
free disk on this checkout. No other workspaces or user artifacts were deleted.

## Browser observations

The main navigation and Living Routes hub launch all four streams. EN/UK links
honor their requested locale. Retro Field Team started and paused with humanoid
art, the FPV head and connected body. Snake Studio loaded all 96 templates.

At 320×740, the Team layout had no horizontal overflow; all four turn buttons
measured 56×56 CSS pixels and both controls and Pause were visible. The layout
also fit 390px portrait and 740×360 landscape. These observations do not replace
physical-device, simultaneous-touch, controller or enlarged-text qualification.

A local private Team room required both seats to be ready. A player pause reached
both seats. No console errors were observed. This is a local interaction review,
not an automated suite or a completed network reliability qualification.

## Explicitly deferred

Automated suites were **not run**, following the explicit user waiver and
`publishing/test-policy.json`. Relevant regressions were authored. The final
documentation commit carries `[skip ci]` so pushing the draft does not trigger
automated suites. Required GitHub checks may remain pending; no release guard
or merge qualification has been waived.

The latest measured Company edition exceeds its unchanged 64 MiB cap by
484,000 bytes (67,592,864 bytes at merge commit `1592b7fea`, before the final
cosmetic campaign-link correction; the older main `66d83c424` measured 67,423,717). Its declared adapter preserves
captions and custom recordings but awaits an admitted optional package for the
new built-in actor voices. See [capacity details](../../fpv-world-package-closure.md).

Human completion routes for the six pilots and 84 drafts, physical phones and
controllers, listening review, low-end performance, real-account Community
round-trips and real-network qualification remain pending. Later online stages
need hosted authentication and abuse controls, durable recovery, qualified
community/Company rooms, asynchronous challenges/ghosts, public discovery and
SIM networking. No public deployment or main merge was performed.

See the [implementation report](../../expressive-enemies-implementation.md) and
[machine-readable verification](verification.json) for exact scope and receipts.
