# Deliver creator content and framework releases

## Current manual content handoff

The new single-image workflow is documented in [Create and share a picture campaign](image-campaign-guide.md), with [format/API contracts](creator-bundle-reference.md) and [pending release acceptance](phase1-acceptance.md). Its strict `.rlpack` path does not turn arbitrary Studio JSON into an approved installed campaign.

1. Collect the exact editable source, runtime expansion if available, required media and their provenance. Keep private originals and player backups out of a shareable content artifact.
2. For a Playground expansion, run the production `preparePack` reader and test the actual exported file through the compatibility player's **Settings → Game data → Installed chapters → Install a pack file**. For a Studio project, use `compile-content-project.mjs` and the exact preview. Arbitrary Studio source does not have a general ordinary-Custom installer; the new creator supports its explicitly verified template scope.
3. Review content rights, pictures, objective clarity and advertised modes/presets. Record legal completions, Retry/Next, save recovery and exact earned artwork. A decoder pass, uploaded flag or compiler success is not creator playtesting.
4. To include content in a maintained distribution, integrate its source and required runtime dependencies using the corresponding existing catalog/compiler. Keep immutable old editions. Do not merely rename a project into `xonix-pack`, change its version label, or give community content official Journey eligibility.
5. Prepare a scoped PR, update examples and compatibility declarations, then follow the framework release procedure below. Public availability follows deployed acceptance, not a local import.

Creators can already exchange supported expansion files without a game release. The future community service will publish validated immutable `.rlpack` editions independently of software releases. Accounts, uploads and a public catalog are Phase 4 work; do not direct creators to a nonexistent service.

## One release per framework phase

Start from then-current reviewed `main` in an isolated checkout. Preserve a dirty development checkout and other tasks' worktrees. Coordinate the next unused version with the existing publication owner before changing version fields; do not infer availability from a stale document or move existing tags.

1. Implement the phase, its guide/examples, compatibility rules and meaningful focused tests.
2. Reproduce the actual user journey through native file selection, downloads, import, ordinary play and recovery. Keep local, modeled, physical-device and public evidence separately labeled.
3. Open and review the scoped PR. Run the repository's currently applicable preflight, build, release-readiness and feature gates on the exact candidate. Record any policy-authorized waived suite as deferred, never passed.
4. Freeze the committed source under its allocated immutable version through the current publication coordinator. Use the exact original source/artifact and its current qualification workflow; do not rebuild a historical edition with newer code.
5. Publish original release assets, review the Pages selection and verify deployed identity, hashes, public file paths and actual behavior. Keep failure records and corrected retests. The [repository release skill](https://github.com/mekhovov/revealline/blob/main/.cursor/skills/deploy-release-pages/SKILL.md) and [delivery workflow](../../docs/feature-delivery-workflow.md) own the detailed procedure.
6. Record PR, source SHA, release/tag, publisher revision/run, public URL and phase acceptance. Only accept the phase after its own gate passes. A merged PR, container image or successful deployment alone does not establish playable acceptance.

Consult the [current delivery plan](delivery-plan.md) for dependency order. Chromium, Firefox and Safari desktop checks are required by the approved plan; unavailable engines stay explicitly open. Physical mobile support requires physical qualification. Hosting, domain, mail delivery and AWS provisioning remain separate deployment decisions.

## Acceptance record template

```text
Phase / scope:
Source SHA / PR:
Tests and exact results:
Native input, browser version and viewport:
Actual downloaded/imported file SHA-256:
Win / Retry / Next / reload / unfinished restore observations:
Failure and recovery observations:
Release tag / original artifact hashes:
Qualification and publication run:
Public identity / byte verification / public play:
Deferred or unavailable checks:
Acceptance: pending | scoped | complete (with evidence)
```

Public publication in Phase 4 must independently validate actual bounded bytes, hashes, schemas, media, compiler output and applicable route evidence. Creator approval binds an exact local snapshot; it never grants server trust. Immutable uploaded editions publish automatically only after successful validation. Report/removal controls and ownership/restore tests are part of that phase, not optional launch polish.
