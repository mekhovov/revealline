# P16: direct Build information entry — integration candidate

Base: `4bb553d06d62f7a8cce301c77b245573838bfdcb`. This is a separate later-release candidate; it does not modify PR202, reserve a version or certify public deployment.

The existing game link to `site/about.html#versions` now opens its requested disclosure immediately, without an extra click or a catalogue wait. Ordinary About stays compact. Focus, Escape-to-Return, manual closure on cached restoration and owner cleanup remain intact. The four-file patch includes the navigation owner, its real-host regression file, user-facing maintenance documentation and an appended AI maintenance prompt. Existing skill prefix bytes are preserved; no unrelated formatting changes are included.

## Evidence

- Publicv0.69.3: exact requested section was still collapsed after its112-build catalogue loaded. Three affected/surrounding public modules matched the pinned source.
- Baseline: four new cases fail as expected; original failures retained.
- Final: all43 cases in three complete affected files pass on Node20.19.5 and Node22.22.2. All43 pass again through the sealed-patch reconstruction on Node20.
- Runtime/test/doc targeted formatting and runtime/test lint pass. The pre-existing skill prefix is unchanged rather than globally reformatted.
- Actual `git apply` and SHA-256 checks reproduce all four postimages; syntax/build inclusion verifies the runtime module. Native served bytes match its pinned postimage.
- Actual local desktop browser at1280×720: deep-link panel visibly open, Tab to summary, Escape to Return to game, ordinary About still collapsed. The unavailable local archive displayed its existing fallback. Native screenshot visually inspected; no screenshot file retained.
- Owned browser tab and localhost server are closed. Server exit130 records intentional SIGINT cleanup, not a product failure.

The new cases explicitly cover current/release/archive URL forms while the archive fetch is held, a later hash visit, no focus/navigation/progress changes, cached manual closure and terminal listener removal. Existing controller, disconnection, lifecycle and URL-safety cases remain in the complete cohort. This is not physical-controller, touch, mobile, offline or public-fix acceptance. Final integrated six gates, version/commit, immutable freeze, Pages publication and actual public check remain with the release coordinator.

## Reproduction

From repository root:

```sh
node .cache/p16-about-deep-link-4bb-r2/verify-source.mjs
node --experimental-loader ./.cache/p16-about-deep-link-4bb-r2/loader.mjs --test .cache/p16-about-deep-link-4bb-r2/suite.test.mjs
```

The virtual loader reads unchanged files from the exact Git base with lazy fetching disabled, and reconstructs only the four hash-checked postimages. It does not use dirty root checkout files. `source.patch.gz` is the integration patch; all original failure/pass logs are retained in `qualification-logs.json.xz`.
