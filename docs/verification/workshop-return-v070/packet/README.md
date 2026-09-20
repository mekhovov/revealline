# P03/P16 — shared Workshop return and Playground keyboard exit

Unmerged candidate on `8a9f37f3635f972d3482823aff22536b3e4e1d39`; coordinator owns version, integration, six release gates, freeze and Pages. Do not fold into the narrower v0.69.3 story/Replace release.

`source.patch.gz` holds31 related text-file diffs, including the earlier reviewed Studio correction. `source-manifest.json` pins all pre/postimages. Gunzip for hunk review. `patch-source.mjs` reconstructs source from those diffs and exact local Git blobs, never the dirty workspace. Do not also apply the older Studio packet.

Run from repository root using Node20 or22:

```sh
node .cache/p16-workshop-return-8a9f-r2/verify-source.mjs
node --experimental-loader ./.cache/p16-workshop-return-8a9f-r2/loader.mjs --test .cache/p16-workshop-return-8a9f-r2/navigation.test.mjs
node --experimental-loader ./.cache/p16-workshop-return-8a9f-r2/loader.mjs --test .cache/p16-workshop-return-8a9f-r2/boundary-cohort.test.mjs
node --experimental-loader ./.cache/p16-workshop-return-8a9f-r2/loader.mjs --test .cache/p16-workshop-return-8a9f-r2/team-boundary.test.mjs
node .cache/p16-workshop-return-8a9f-r2/run-protocols.mjs
```

Use a disposable copy for reproduction. The protocol runner temporarily materializes the unchanged video fixture generator for its subprocess and removes that owned file in finally. Other source stays virtual. Compressed JSON logs include complete TAP; iterations retain failure identities and corrections. Native evidence and runtime byte receipts are separate from modeled tests.

This closes nine standalone tool returns and the named Playground frame's keyboard trap. It does not complete themes, Studio authoring, maps, campaigns, offline or physical-device qualification. No main/worktree/version mutations were made. Public acceptance follows integration and release gates.
