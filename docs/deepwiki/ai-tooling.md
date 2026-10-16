---
id: ai-tooling
title: AI authoring and automation tooling
importance: medium
filePaths:
  - authoring/README.md
  - authoring/prompt.py
  - authoring/prompts/catalog.json
  - .cursor/skills/deploy-release-pages/SKILL.md
  - scripts/inventory-ai-tooling.mjs
  - docs/deepwiki/ai-tooling.json
  - package.json
relatedPages:
  - content-and-authoring
  - getting-started
  - testing
  - operations-and-configuration
---

# AI authoring and automation tooling

RevealLine keeps its project-specific AI authoring material in the repository: skill manifests, reusable prompt catalogs, a local prompt renderer, and release/automation helpers. The authoring guide describes skills as guidance for distinct content and runtime roles; their inclusion does not execute a model or change game content. [authoring/README.md:20](../../authoring/README.md#L20), [authoring/README.md:32](../../authoring/README.md#L32)

## Complete tracked inventory

[`ai-tooling.json`](ai-tooling.json) is a checked-in, machine-readable inventory. At generation it lists 17 repository-local skill manifests and every file within their skill directories, 10 JSON prompt catalogs, helper/tool/prompt modules, 365 executable automation scripts below `scripts/`, 17 workflow definitions, and 60 npm package commands. It deliberately inventories the complete paths rather than reducing the result to a curated sample. [ai-tooling.json:2](ai-tooling.json#L2), [ai-tooling.json:5](ai-tooling.json#L5), [ai-tooling.json:15](ai-tooling.json#L15), [ai-tooling.json:34](ai-tooling.json#L34), [ai-tooling.json:89](ai-tooling.json#L89), [ai-tooling.json:110](ai-tooling.json#L110)

The inventory excludes per-user and plugin-installed skills outside the checkout. Those files are environment tooling rather than a versioned RevealLine dependency, and copying them would make a repository revision depend on an individual developer's local configuration. [ai-tooling.json:3](ai-tooling.json#L3)

Run this after adding or removing an included asset:

```sh
npm run ai:inventory
```

The generator recursively reads the tracked authoring/Cursor skill roots, prompt catalogs, helper/tool/prompt modules, `scripts/` executable extensions, workflow definitions, and script blocks from five package manifests. It writes stable sorted JSON and does not call any model provider. [scripts/inventory-ai-tooling.mjs:12](../../scripts/inventory-ai-tooling.mjs#L12), [scripts/inventory-ai-tooling.mjs:24](../../scripts/inventory-ai-tooling.mjs#L24), [scripts/inventory-ai-tooling.mjs:31](../../scripts/inventory-ai-tooling.mjs#L31), [package.json:13](../../package.json#L13)

## Prompt helper

`authoring/prompt.py` is a local browser and renderer for the base prompt catalog plus eight supplemental JSON catalogs. The base catalog labels itself as reusable authoring prompts and distinguishes templates from executed work. The helper validates duplicate IDs and that declared variables match template tokens; rendering rejects missing or unknown assignments. It explicitly does not call a model provider. [authoring/prompt.py:1](../../authoring/prompt.py#L1), [authoring/prompt.py:9](../../authoring/prompt.py#L9), [authoring/prompts/catalog.json:1](../../authoring/prompts/catalog.json#L1), [authoring/prompt.py:21](../../authoring/prompt.py#L21), [authoring/prompt.py:37](../../authoring/prompt.py#L37)

## Cursor release helper

The cursor-local release skill is tracked under `.cursor/skills/`. It documents a policy and procedure for tagged GitHub Pages releases, and disables automatic model invocation. It is guidance for a user-requested release process; it is not a deployment trigger. [.cursor/skills/deploy-release-pages/SKILL.md:1](../../.cursor/skills/deploy-release-pages/SKILL.md#L1), [.cursor/skills/deploy-release-pages/SKILL.md:17](../../.cursor/skills/deploy-release-pages/SKILL.md#L17)

## Evidence

- [ai-tooling.json:15](ai-tooling.json#L15): every repository-local skill manifest.
- [ai-tooling.json:110](ai-tooling.json#L110): complete `scripts/` automation inventory.
- [scripts/inventory-ai-tooling.mjs:66](../../scripts/inventory-ai-tooling.mjs#L66): deterministic JSON schema and output.
- [authoring/prompt.py:56](../../authoring/prompt.py#L56): prompt helper command interface.

## Coverage and limitations

Retrieval terms: `SKILL.md`, `prompt`, `tool`, `scripts`, `workflows`, `package.json`. The inventory is exhaustive for its declared repository paths, not a classification of every application module as “AI.” It does not evaluate whether an individual script is safe to run, whether a prompt is appropriate for a specific task, or whether a release procedure has completed.

## Related

[Content and authoring](content-and-authoring.md) · [Getting started](getting-started.md) · [Testing](testing.md) · [Operations and configuration](operations-and-configuration.md)
