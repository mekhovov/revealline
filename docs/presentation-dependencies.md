# Exact compiled presentation dependencies

`inspectPresentationDependencies(runtimeBytes)` uses the same closed manifest
validator as the runtime host. Supply original bounded UTF-8 bytes, not a parsed
and reserialized object. It reports the measured manifest identity plus every
selected file, including lazy picture originals and audio. File descriptors use
only the validator's hash-derived relative paths. Shared files are counted once;
their sorted `slots` preserve all uses. Procedural roles require no external file.
Unselected Studio history is intentionally outside this runtime inventory.

`compilePresentation` exposes this result as `dependencies`; it does not add a
new emitted file or rewrite any compiled bytes. Metadata inspection alone proves
neither availability nor approval, decoding, visual quality, playback or enjoyment.

For offline/restore preflight, call `verifyPresentationDependencies(runtimeBytes,
{read, signal, expectedManifestSha256})`. A retained attempt must supply its exact
reviewed manifest hash. The optional unpinned form is inspection of a new candidate,
never permission to substitute it for a retained release. Wrong/malformed pins
fail before asset reads. The code-owned `read(descriptor, {signal})` adapter must
enforce `descriptor.bytes` while reading and return a `Uint8Array`; it owns the
filesystem/cache/network boundary. Never turn an uploaded inventory into arbitrary
URL fetches or filesystem paths.

The verifier reads one selected file at a time, checks length and SHA-256, and
retains no file bytes in the result. Abort rejects even when a reader ignores its
signal; the reader remains responsible for stopping its underlying work. Successful
results say `verified-bytes`, explicitly `mediaDecoded: false`. They do not imply
that browser codecs accept a file, that sound is enabled, that the current attempt
was changed, or that later cache eviction cannot remove it.

Complete attempt integration must still combine this inventory with external
mission pictures, stories, soundtrack choices and runtime/session identities.
Retain the current attempt until those owners finish preparation, then adopt
atomically; cancellation/failure must release only the staged resources. Saved
attempt, backup and offline schemas remain unchanged in this increment.
