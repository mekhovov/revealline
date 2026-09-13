---
name: xonix-native-packager
description: Stage, build and verify Reveal Line's Electron desktop or Capacitor iOS wrappers, preserving release integrity and player collections. Use for native app packaging, file sharing or native lifecycle changes.
---

# Xonix Native Packager

Locate the Reveal Line project and read [native distribution](../../../docs/native-distribution.md). The game remains in `game/`; wrappers are isolated in `platforms/desktop/` and `platforms/ios/`. Use their locked Node/tool versions. Native dependencies do not belong in the browser root package.

## Preserve the content and storage contracts

Stage a reviewed first-party generated site with `scripts/native-cli.mjs`; it checks every manifest byte before copying. Keep `game/`, sibling artwork and nested pages together. Only unchanged, verified native stages can be replaced with `--replace`. Do not modify an archived release in place. Hash agreement establishes integrity, not the authorship of an unknown pack or app.

The desktop origin is `revealline://app`, with `persist:revealline`; the iOS origin is `capacitor://localhost`. Keep native bundle identity, origin and profile namespace stable. The shared game uses `release-${buildVersion}` for versioned saves, so transfer a collection between releases or origins through the complete-backup UI. Do not clear profiles, disable Web Locks or force incompatible schemas as an upgrade workaround.

Renderer isolation, strict bundled-resource routing and request/navigation restrictions live in the desktop shell. Game content cannot register native handlers or run arbitrary scripts. On iOS, `bridge-entry.mjs` is bundled from the pinned official App, Filesystem and Share plugins; staging adds its ESM output and the explicit diagnostic assets to a native inventory. A generated project is not a working device build.

## Validate the actual host behavior

Read [native compatibility](../../../docs/native-compatibility.md) for platform-specific evidence and the active source before changing contracts. The shared `game/platform.mjs` owns export selection and native inactivity. The deterministic core and replay inputs remain unchanged. Keep native exports asynchronous and distinguish requested, shared, cancelled and failed outcomes; a closed Save/Share dialog is not proof a backup exists.

Run relevant wrapper, staging and game tests, then perform UI checks on the actual executable or device when the environment supports them: clear a map, inspect its picture reward, suspend and reload, transfer a known complete backup, verify installed maps, cancel and save an export, and interrupt an active mission. Record which actions were observed. Capability probes, static screenshots and CSS fixture sizes cannot establish physical iPhone/controller support, durable storage or audio quality.

Keep iOS module MIME checks and the Web Locks/IndexedDB diagnostic route usable even when `.mjs` loading fails. Keep the 15.4 feature floor and current toolchain requirements explicit. Missing Xcode, signing identity or OS automation permissions limit the evidence; they do not justify bypassing operating-system protections or claiming a successful device test.

Package locally within the user's authorized scope. Retain the source revision, web manifest, native manifest, dependency locks and artifact hashes in the verification report. Do not invent store credentials, signing identities or a publication destination. Signing, notarization, Steam integration and public distribution remain separate work until actually performed.

## Useful requests

- “Package the frozen release for this Mac. Verify the manifest, preserve my current collection, test the actual app, and retain an independently runnable artifact with its source hash.”
- “Transfer a completed-picture collection and installed expansion from the browser into the desktop build using the full-backup UI. Verify the result after restart.”
- “Update the iOS wrapper after a game change. Bundle the official plugin bridge, stage diagnostics, sync the project, and report executable/device checks separately from scaffold checks.”
- “Investigate a cancelled native export. Preserve the prepared JSON, reproduce cancellation through the Save/Share UI, and fix the status without claiming an unsaved file is a backup.”

## Deliver the completed feature

For implemented changes, follow the shared [feature delivery workflow](../../../docs/feature-delivery-workflow.md): related commit, exact-source verification, immutable playable version, reviewed/merged PR, GitHub Release and verified Pages deployment. The current project request authorizes that sequence. Update the roadmap with actual evidence; keep planned assets, modeled input checks and physical-device qualification distinct. Design-only work remains a reviewable design artifact.
