# RevealLine repository wiki

Agent-native DeepWiki, generated 2026-10-03 from the local working tree based on `f4545d68a`. Existing modified and untracked source files are part of this snapshot; the base commit alone does not reproduce it. This is a repository comprehension artifact, not a statement of the deployed release.

## Blueprint

| Page id                                                         | Title                        | Importance |
| --------------------------------------------------------------- | ---------------------------- | ---------- |
| [overview](overview.md)                                         | Overview                     | high       |
| [getting-started](getting-started.md)                           | Getting started              | high       |
| [architecture](architecture.md)                                 | Architecture                 | high       |
| [runtime-data-flow](runtime-data-flow.md)                       | Runtime data flow            | high       |
| [content-and-authoring](content-and-authoring.md)               | Content and authoring        | high       |
| [persistence-and-replays](persistence-and-replays.md)           | Persistence and replays      | high       |
| [community-service](community-service.md)                       | Community service            | medium     |
| [testing](testing.md)                                           | Testing                      | high       |
| [operations-and-configuration](operations-and-configuration.md) | Operations and configuration | medium     |

## Scope and method

The scan prioritizes current entrypoints, executable modules, package manifests, selected tests, and build/configuration files. Targeted text retrieval uses expanded symbol/path queries, ranked source reads, and one-hop import/caller tracing; no persistent embedding index was created. Each page records its evidence files and related pages. Source links name a file and one-based line, using relative links with GitHub-style line anchors for portability.

Default exclusions from detailed reading: dependency/vendor bundles, generated outputs, release archives, `docs/verification/**`, `docs/research/**`, historical `publishing/pages-controller/evidence/**` and `publishing/pages-controller/delivery/**`, and binary media. Small samples may be followed when needed to explain a current boundary. These exclusions are retrieval filters, not changes to the repository.

The repository contains over 23,000 tracked or nonignored files at inventory time. This is a bounded architecture map, not an exhaustive file-by-file audit. Page-specific limitations identify unverified behavior. Focused evidence reads span 7–18 defining files per page; the community page expands the usual 8–15-file budget to cover server, worker, authentication, uploads, and client installation together. Diagrams describe observed imports/calls unless explicitly marked INFERRED. Build, browser, hardware, deployment, and service integration outcomes are not established merely by reading code.

## Documentation checks

All nine pages include `id`, `title`, `importance`, `filePaths`, and `relatedPages` metadata, a cited summary, evidence anchors, and coverage limits. Local links, one-based source line bounds, metadata/source correspondence, sibling links, and Markdown formatting were checked. An independent source review checked the overview, architecture, getting-started, testing, and operations pages. Mermaid diagrams were reviewed for plausible syntax but were not rendered in a browser. No application tests, builds, services, or deployment commands were run for this documentation task.
