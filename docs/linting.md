# Static JavaScript checks

Run `npm run lint` before behavior tests and packaging. It checks every maintained `.mjs` module under `game/` and `scripts/`, plus [eslint.config.mjs](../eslint.config.mjs), for undefined names and unreachable statements. Both rules are errors; warnings also produce a failing exit status. Formatting remains Prettier's separate job, and linting does not replace simulation or browser tests.

The flat configuration uses browser globals for the browser shell and presentation modules, Node's ESM globals for scripts/tests, and only the shared `structuredClone` API for the deterministic core. `Phaser` is declared read-only solely in `game/app.mjs`, where the vendored classic script supplies it. CommonJS `require`, `module` and `__dirname` are not silently allowed in `.mjs` files. Undefined names inside `typeof` are checked too.

Vendored code, installed dependencies, distributions and historical releases are excluded. The command intentionally targets maintained `.mjs` sources; generated worker JavaScript, JSON content, and historical authoring scripts retain their existing dedicated validators/tests.

ESLint **10.10.0** and globals **17.12.0** are exact development dependencies in the lockfile. Official npm metadata was checked before installation: ESLint requires `^20.19.0 || ^22.13.0 || >=24`, while globals requires Node 18 or newer. The project engine declaration matches the stricter toolchain requirement. These ranges agree with [ESLint's current prerequisites](https://eslint.org/docs/latest/use/getting-started) and the [official registry entry](https://registry.npmjs.org/eslint/10.10.0).

The installation used `npm install --save-dev --save-exact --ignore-scripts eslint@10.10.0 globals@17.12.0` against the official npm registry. Use `npm ci --ignore-scripts` to restore the recorded versions. The initial lint run passed 69 modules on Node 20.19.5 with zero errors or warnings. Seven in-memory configuration probes also confirmed that an undeclared `selectedSeed`, a DOM reference in Node/core code, and unreachable statements fail, while supported browser/Node/Phaser globals pass. No production code was changed to silence a lint finding.
