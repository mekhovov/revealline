# Desktop candidate verification — 12 September 2026

This historical candidate was built before native branding integration and retains Electron's default application icon. Later packaging requires the original Reveal Line ICNS; that does not change this preserved artifact or imply its replacement has been tested.

The local macOS ARM64 candidate was packaged successfully with Electron 44.3.0, Electron Packager 20.3.0 and Electron Fuses 2.1.3 under Node 22.22.2. This is an unsigned local foundation with an ad-hoc macOS binary signature, not a notarized or publicly certified native release.

```sh
mise exec node@22.22.2 -- npm test --prefix platforms/desktop
mise exec node@22.22.2 -- npm audit --prefix platforms/desktop --registry=https://registry.npmjs.org --json
mise exec node@22.22.2 -- npm run package --prefix platforms/desktop -- --label v0.3.0-candidate-01
npm exec -- eslint 'platforms/desktop/**/*.mjs' --max-warnings 0
npm exec -- prettier --check 'platforms/desktop/*.mjs' 'platforms/desktop/test/*.mjs' 'platforms/desktop/test/helpers/*.mjs'
```

All 21 pure tests passed, lint and formatting passed, and the isolated npm audit reported zero known vulnerabilities. Tests include failed fuse readback preventing publication, candidate output isolation, resource integrity checks, local navigation and download policy. Audit results apply to the observed dependency lock and date.

Generated artifact: `out/v0.3.0-candidate-01/Reveal Line-darwin-arm64/Reveal Line.app`. The complete artifact directory occupies approximately 314 MiB and retains Electron/Chromium licenses plus `game/vendor/PHASER-LICENSE.md` inside the verified site. The accompanying `native-package.json` records the exact package settings. All nine configured fuse values were read back from the packaged binary before publication. The resulting site passed all 94 inventory file checks again; its local entry handler returned HTTP-style status 200 in Node without executing the renderer.

The staged and source manifest SHA-256 are both `72403ba0d6d3f5854a603b8fc3662d78049719430fa24087e778b27acfd93da5`. The candidate manifest has `sourceRevision: null`; this artifact is deliberately separate from a later frozen source release and cannot be overwritten by the packaging command.

The development Electron process started, but the authorized native UI observation tool reported pending macOS Accessibility/Screen Recording permissions on two attempts. Therefore no native gameplay, IndexedDB persistence, Web Locks acquisition, native imports/exports, async backup user-gesture handling, fullscreen or restart-persistence success is claimed. No renderer JavaScript execution, storage injection or operating-system permission bypass was used. Those visible-control checks remain required before recommending a public native distribution.
