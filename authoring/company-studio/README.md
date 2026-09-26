# Company Studio

Serve the repository and open `/authoring/company-studio/`. The seven steps edit the same data formats used by the edition compiler: identity, artwork roles, actors and atmosphere, campaigns, learning, preview, and delivery.

The browser keeps changes in memory. JSON editor buffers survive step and campaign changes; apply them before export. Export creates a complete `revealline-company-source-draft.v1` packet containing the catalog and every declared JSON source. Binary media remains in the source workspace. Asset Studio prepares original media; the source catalog records its exact bytes, SHA-256, ownership dependencies and publication decision.

Import the packet into a new directory and compile an edition:

```sh
node scripts/company-studio.mjs import-draft --file coupa-adventure-draft.json --workspace .cache/coupa-source
node scripts/company-studio.mjs validate --workspace .cache/coupa-source --edition coupa-adventure
node scripts/company-studio.mjs preview --workspace .cache/coupa-source --edition coupa-adventure --out dist/company-previews/coupa-preview
```

The CLI copies only approved media whose actual bytes match the catalog. Use `--media-root PATH` when the original assets are in another source workspace.

Import `dist/company-previews/coupa-preview.report.json` in step 06. The studio compares the compiled catalog and every selected JSON source with the applied draft before opening the game in an iframe. A report with a different edition or an external preview URL is rejected. The “Source reference” link always opens the saved repository game and is explicitly separate from the draft preview. Preview output must use a visible directory: the development server intentionally does not serve `.cache` or other hidden directories.

The report lists admitted files, excluded companies/editions/campaigns/assets, and checks still requiring review. Schema validation does not prove a new route is playable or that a lesson is factually correct. Route proofs, visual/accessibility checks and human playtesting remain release evidence; the studio does not publish a release.

For a new company, start with the neutral workspace:

```sh
node scripts/company-studio.mjs init --brand acme --edition acme-public --name 'Acme' --workspace .cache/acme-source
```

Import that workspace’s `source-draft.json` to work entirely from its JSON. A catalog-only import is also supported when its declared source paths are available from the development server.
