> Retained historical excerpt after an ownership migration. Exact originals are preserved separately. This excerpt is not the original complete record or a release qualification.

# Company Studio

Serve the repository and open `/authoring/company-studio/`. The seven steps edit the same data formats used by the edition compiler: identity, artwork roles, actors and atmosphere, campaigns, learning, preview, and delivery.

The browser keeps changes in memory. JSON editor buffers survive step and campaign changes; apply them before export. Export creates a complete `revealline-company-source-draft.v1` packet containing the catalog and every declared JSON source. Binary media remains in the source workspace. Asset Studio prepares original media; the source catalog records its exact bytes, SHA-256, ownership dependencies and publication decision.

Import the packet into a new directory and compile an edition:


The CLI copies only approved media whose actual bytes match the catalog. Use `--media-root PATH` when the original assets are in another source workspace.


The report lists admitted files, excluded companies/editions/campaigns/assets, and checks still requiring review. Schema validation does not prove a new route is playable or that a lesson is factually correct. Route proofs, visual/accessibility checks and human playtesting remain release evidence; the studio does not publish a release.

For a new company, start with the neutral workspace:

```sh
node scripts/company-studio.mjs init --brand acme --edition acme-public --name 'Acme' --workspace .cache/acme-source
```

Import that workspace’s `source-draft.json` to work entirely from its JSON. A catalog-only import is also supported when its declared source paths are available from the development server.
