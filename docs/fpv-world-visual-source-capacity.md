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

Scoped lint, canonical formatting, generator equality and all three existing
lexical-projection checks pass. Full validation, package admission and runtime
member comparison remain pending at this checkpoint. No new unit coverage,
hardware performance or public availability is claimed.
