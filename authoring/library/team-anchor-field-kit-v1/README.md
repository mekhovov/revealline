# Original Field Kit Team relay radios

A matched pair for `team.anchor.available` and `team.anchor.captured`: 24×24 PNGs with binary transparency, centred pivots and five shared Field Kit colours. Available shows separated connector jaws; captured closes the connector and joins its centre. The mast, twin receiver ears, outlined field-radio case and feet distinguish these objectives from diamond pickups, Support and Scan. The runtime retains authoritative anchor letters/checks, capture boundaries and timing.

These are original integer-pixel drawings, not sampled reference artwork or AI output. `source.mjs` is the editable master. Prepared files and their exact hashes, occupied bounds, palette, provenance and copyable variation/edit prompts are in [the manifest](prepared/manifest.json). [Review the pair](review.html) at native and enlarged size on dark/light backgrounds, including grayscale.

## Reproduce and validate

From the repository root, after the registered Team anchor family is integrated:

```sh
node scripts/produce-team-anchor-art.mjs --check
node --test scripts/test-team-anchor-art.mjs
```

Without `--check`, the producer creates missing files but refuses to overwrite different existing outputs. It checks all known output conflicts before writing. Use a new versioned family for a changed drawing. Do not erase an old reviewed or published family to force the generator through. The producer captures its imported source bytes once and rejects a project root with a different source; generated pixels must not be credited to another file revision.

## Inspect and replace through Studio

1. Open Asset Studio and **Prepare Team anchor slots**. Search for `team.anchor`.
2. Select available, upload `prepared/available.png`, and enter the corresponding description and provenance from the manifest. Validate and stage. Repeat for captured with `prepared/captured.png`. Each upload preserves original bytes and creates a separate derivative.
3. Select **Field context → Couch Team → Relay Yard**. Inspect available in **Initial field**, then captured in **Anchors captured** with Paused and Reduced effects. First Connection must explain that the role is inactive.
4. Select both inventory checkboxes. Under **Build a coordinated collection**, use a unique collection ID and name; stage the pair together. Save the local revision, wait for completion, then export `.rltheme`. The exported collection must require both slots.
5. Import the export and verify both roles together. Undo must restore the previous collection and revision. Preserve the original bundle while preparing any new variation.
6. Before runtime adoption, inspect imported multi-stronghold maps, near-edge and crowded objective placements, light/dark reveal pictures, phone/handheld sizes and live capture transitions. Record actual asset revisions and decoded images. Compile and qualify the release through the normal workflow; a browser save or upload alone does not publish anything.

## Quality boundary

The manifest intentionally says **produced**. Native Studio observations verify both Relay Yard states, Reduced effects, inactive First Connection, coordinated collection save/export/import/Undo, and original/derivative byte preservation. They do not certify every imported map, physical device, live runtime collection or public release. No collision, simulation, campaign identity, saved flight or earned original changes accompany these icons.

The recorded authoring export is collection `fpv-relay-radios-v1@1`, document r42; its 7,251,142 bytes include the inherited Field Kit collection and original history, not merely these two 386-byte PNGs. Export size must not be presented as runtime download cost: runtime adoption must bind only the required prepared assets and dependencies.
