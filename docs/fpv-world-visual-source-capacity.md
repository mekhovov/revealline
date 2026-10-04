# World visual source preparation

World Studio has only 552 bytes of source reserve after the qualified Library,
menu and focus integration. The next reviewed rendering changes need room without
raising its 16 MiB or 104-file ceilings. This prerequisite applies the existing
lexical whitespace projection to one module; it changes no visual behavior.

The readable canonical source is
`optional-practice/civilian-fpv/world-visuals-source.mjs`. Its admitted counterpart
remains `world-visuals.mjs` at the same import path. The generator runs pinned
Prettier and the established `projectEditionModuleIndentation` function, which
rejects any change to syntax, tokens, comments or line terminators. Generator
equality is part of `npm run validate`.

Against main `0a1548fd29bd4f4fce741c2917d2c07d8bdbb63b`, the readable file is
byte-identical. Preparation reduces it from 161,171 to 120,145 bytes, recovering
41,026 bytes. Independent Acorn inspection confirms the same normalized AST,
37,754 tokens, 147 comments and 4,229 line terminators. No imported coating hint,
shadow preparation, ghost control, physics, content identity or package-policy
change is part of this source-only prerequisite.

Edit the readable file, then run:

```sh
node scripts/refresh-fpv-world-visuals.mjs
node scripts/refresh-fpv-world-visuals.mjs --check
```

The manual `scripts/qualify-fpv-world-visual-capacity.mjs` receipt binds this
specific preparation to the baseline above. Future semantic changes need their
own verification and must not reuse that historical identity claim.

Frozen candidate `d9ac8ee1937fb473107278ad613d33314ab9dd0d` passed full
`npm run validate` on Node 22.22.2, scoped lint, canonical formatting, generator
equality and all three existing lexical-projection checks. All three optional
packages passed committed-input and ZIP-member admission with two byte-identical
builds. Their runtime memberships remain 48 (Flight), 69 (Academy), and 102
(Worlds); the readable source is not shipped in the explicit runtime closure.

The optional builder emits the prepared module bytes directly. Independent
baseline builds, reconstructed from exact main `0a1548fd` Git input objects,
confirm that all unrelated payload members retain their bytes. Only the prepared
module, generated package descriptor and binding worker differ in Academy and
Worlds. Flight only changes its generated revision bindings. The changed module
has semantic/token/comment/newline identity, not byte equality with its original.

The admitted Worlds original-input total is 16,726,366 bytes (50,850 bytes below
16 MiB) at this older main baseline, before the separately merged Library input
growth. Adding this unchanged 41,026-byte saving to the qualified Library total
would leave 41,578 bytes; that arithmetic is not a new integrated admission.
Evidence and hashes are retained under
`docs/verification/fpv-world-visual-source-capacity/`. No new unit coverage,
hardware performance or public availability is claimed.
