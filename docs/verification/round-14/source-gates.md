# v0.4.0 source gate

All five required commands passed on **12 September 2026**, after the briefing, mission focus and playground launch-readout fixes. This checks the working source based on `b7c093de982d9f14cb847ff705b6bde0c4a2ba01`, using Node **22.22.2** through mise. It is not a frozen-release or native-device certificate.

| Command, prefixed with `mise exec node@22.22.2 --` | Result                                                                                        |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `npm test`                                         | **605 passed**, zero failed, skipped, cancelled or pending                                    |
| `npm run lint`                                     | Passed                                                                                        |
| `npm run format:check`                             | Passed                                                                                        |
| `npm run format:native:check`                      | Passed                                                                                        |
| `npm run validate`                                 | Passed: 88 source files, valid literal references, 12 base levels, four themes, seven classes |

The [machine-readable gate record](source-gates.json) includes command durations, log sizes/hashes and the exact validation output. Full logs are retained locally in `.cache/round-14/`. A preliminary 598-test pass, taken before the briefing fix, remains separately in `.cache/round-14/preliminary/` and is not the final result.

The [214-file source inventory](source-inputs.json) had the same SHA-256 before and after the commands: `d3d8a81376105c841f53ea47d6846ffd88702a0df5756c6249b182f05ce1fc7e`. It covers tracked/new runtime, tooling, native-project and relevant authored-source inputs plus package/configuration files. Documentation and verification artifacts are excluded from that hash. No monitored source file changed during the gate.

Validation retains four navigation warnings for routes outside the browser distribution's literal-file inventory: the motion lab, reference atlas, release directory and native diagnostics. These are separately scoped navigation destinations; the exact warnings remain in the JSON record. Passing this structural check does not prove all dynamic browser routes or assets rendered correctly.

The independent [artwork identity audit](art-identity.json) confirms that each of Homeward's three 1448 × 1086 PNGs is embedded byte for byte, with distinct original hashes and corresponding recorded prompts. The generated 11,371,849-byte pack matches its source recipe/originals and has SHA-256 `4793e07a45484238bae483e2a2e9354c6d29e0ad2ba2d8d708169bd9e0250b8b`. All four indexed packs pass their actual structural validator. Current supplied content totals **25 maps, seven classes and five primitives**.

The [documentation audit](document-links.json) records every modified/new Markdown file checked and its hash. All detected local inline-link and reference-definition targets exist; no fragment links occurred in the inspected set. External URLs were outside this filesystem audit. Both changed project skills had also passed the installed skill validator in the existing isolated Python environment.

These results cover automated behavior, file identity and document targets. Actual browser image decoding, visible gameplay/finales, persistence interactions, layout, native builds and physical iOS/controller testing require their separate evidence. No image pixels, source storage, native project files or game implementation were changed by this final audit, and no commit was made.
