# Publishing parser

`acorn-8.18.0.mjs` is the unmodified `dist/acorn.mjs` from the project's already pinned `acorn@8.18.0` dependency. Upstream: https://github.com/acornjs/acorn and https://registry.npmjs.org/acorn/-/acorn-8.18.0.tgz. Its MIT license is retained in `acorn-LICENSE.txt`.

SHA-256: `953573b8fdab71599749ea5f2b33d3e760c2116178f9423ee7458dbe39d59453` (233,301 bytes).

This copy inspects optional archive import graphs and production build references without executing imported code. It belongs to trusted build/publishing tooling, not the shipped simulator or its offline budget. The sparse release publisher and extracted historical source snapshots do not install npm dependencies; keep this file available to `optional-module-closure.mjs` and `scripts/game-cli.mjs` in those source closures. Update the copy, license, hash check and package lock together when changing parser versions.
