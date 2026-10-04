# RevealLine repository wiki

Agent-native DeepWiki, added to the repository as a source-guided architecture map. This is a comprehension artifact, not a statement of the deployed release.

## Blueprint

| Page id                                                         | Title                               | Importance |
| --------------------------------------------------------------- | ----------------------------------- | ---------- |
| [overview](overview.md)                                         | Overview                            | high       |
| [getting-started](getting-started.md)                           | Getting started                     | high       |
| [architecture](architecture.md)                                 | Architecture                        | high       |
| [runtime-data-flow](runtime-data-flow.md)                       | Runtime data flow                   | high       |
| [content-and-authoring](content-and-authoring.md)               | Content and authoring               | high       |
| [persistence-and-replays](persistence-and-replays.md)           | Persistence and replays             | high       |
| [community-service](community-service.md)                       | Community service                   | medium     |
| [testing](testing.md)                                           | Testing                             | high       |
| [operations-and-configuration](operations-and-configuration.md) | Operations and configuration        | medium     |
| [ai-tooling](ai-tooling.md)                                     | AI authoring and automation tooling | medium     |

## Scope and method

The scan prioritizes current entrypoints, executable modules, package manifests, selected tests, and build/configuration files. Targeted text retrieval uses expanded symbol/path queries, ranked source reads, and one-hop import/caller tracing; no persistent embedding index was created. Each page records its evidence files and related pages. Source links name a file and one-based line, using relative links with GitHub-style line anchors for portability.

Default exclusions from detailed reading: dependency/vendor bundles, generated outputs, release archives, `docs/verification/**`, `docs/research/**`, historical `publishing/pages-controller/evidence/**` and `publishing/pages-controller/delivery/**`, and binary media. Small samples may be followed when needed to explain a current boundary. These exclusions are retrieval filters, not changes to the repository. The [AI tooling inventory](ai-tooling.md) deliberately includes project-local skills, prompt catalogs, scripts, package commands, and workflow definitions.

The repository contains over 23,000 tracked or nonignored files at inventory time. This is a bounded architecture map, not an exhaustive file-by-file audit. Page-specific limitations identify unverified behavior. Focused evidence reads span 7–18 defining files per page; the community page expands the usual 8–15-file budget to cover server, worker, authentication, uploads, and client installation together. Diagrams describe observed imports/calls unless explicitly marked INFERRED. Build, browser, hardware, deployment, and service integration outcomes are not established merely by reading code.

## Documentation checks

All ten pages include `id`, `title`, `importance`, `filePaths`, and `relatedPages` metadata, a cited summary, evidence anchors, and coverage limits. Local links, one-based source line bounds, metadata/source correspondence, sibling links, and Markdown formatting are checked before changes are committed. Mermaid diagrams are reviewed for plausible syntax but are not rendered in a browser. Application tests, builds, services, and deployment commands remain separate verification steps.
