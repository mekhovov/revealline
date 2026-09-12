# v0.7.0 release candidate browser check

The working source that passed the [902-test gate set](source-gates.md) was built with:

```sh
mise exec node@22.22.2 -- node scripts/game-cli.mjs build --out .cache/round-17/candidate --version v0.7.0-rc1
```

This working-tree candidate has no claimed committed source revision. The CLI reported 115 assets and distribution SHA-256 `dece5abc80df579c8b4d022b26173c43d12230a9b17fd3aa4cec4008323619f8`. Its owned server used port 8806; an HTTP header check confirmed the build's CSP, same-origin resource policy, nosniff, no-referrer and restricted permissions header. This is a packaging smoke test, not a security audit.

Through the normal UI, Homeward Skies installed and decoded. The existing legal Grid + buffer near-finish Copper Orchard session was loaded, Tap steering enabled, and Resume plus Right completed the last closure. The build displayed v0.7.0-rc1, 74.1% coverage and “Steady Signal seal earned and saved.” Collection then showed Copper Orchard, its gold result and the seal; River Switchyard was unlocked. The newly wired collection-update method produced no warning or error in sampled browser logs.

The imported prefix is a named replay-derived QA fixture; this was a browser completion of a restored attempt, not an entirely manual fresh run. No user release collection was imported into or modified by this test. The final tagged archive, independent rebuild and server-stopped offline checks are separate evidence.
