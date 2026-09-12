# Gallery reduced-effects consistency

## Scope amendment and reproduction

The illustrated Workshop plan promises review of the four existing finale families, including reduced effects. A bounded read review on 12 September 2026 identified an existing mismatch at that presentation boundary. This small fix is an explicit amendment to the otherwise content-only increment; it does not change gameplay, stored preferences, pack formats, image bytes or progression identities.

Before this fix, `game/app.mjs` initialized the visible Reduced effects checkbox from `matchMedia('(prefers-reduced-motion: reduce)').matches || library.preferences.reducedEffects`. Live wins and live rendering used that checkbox. The gallery's Play celebration handler in `game/ui/library-panel.mjs` instead passed only `library.preferences.reducedEffects` to both `startCelebration` and subsequent draw frames.

The reproducible code condition is an initial OS reduced-motion preference with saved `reducedEffects: false`: the checkbox and live game use reduced effects, while gallery playback receives false. This finding is based on code-path inspection; no browser OS emulation or physical-device observation is claimed here. The inverse case matters too: an explicit unchecked UI choice must remain false even if a prior stored value is true. The gallery must not permanently force an OS preference over a player's current choice.

## Narrow implementation

The host supplies `getReducedEffects: () => $('reduced-effects').checked` to `attachLibraryPanel`. Gallery Play celebration reads this effective value after image loading and on each animation frame. A caller without this optional getter retains the existing saved-preference fallback. The getter does not persist a transient course/practice choice, inspect operating-system state again, or alter any preference schema.

## Semantic verification

The new `game/test/gallery-reduced-effects.test.mjs` invokes the actual collection-card and Play celebration handlers, uses the real celebration state/clock, and substitutes only DOM, image preparation and pixel drawing. Its six reported tests pass. They cover saved false/effective true, saved true/effective false, a later effective change during playback, a change while artwork preparation is awaiting completion, and both saved-preference fallbacks when the host getter is absent. Every case asserts that the entire supplied player library remains unchanged. The fixture is presentation metadata, not a newly earned reward.

The combined new test, existing gallery-focus suite and audio suite pass **33/33** under Node 22.22.2. This is a scoped count, not an additional whole-project total. ESLint passes for the three changed JavaScript files, and Prettier passes for those files and this note. No old fixture, format or expected gameplay identity was changed.

```sh
node --test game/test/gallery-reduced-effects.test.mjs game/test/gallery-focus.test.mjs game/test/audio.test.mjs
```

Actual browser OS/effective-setting checks remain pending. Mocked image/DOM adapters do not establish browser decoding, OS emulation, rendered animation quality or physical-device behavior.
