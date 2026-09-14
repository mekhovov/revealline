# Field Kit typography

Field Kit uses readable interface text over pixel artwork. Handjet is the chosen pixel display face; Exo 2 carries instructions and controls; IBM Plex Mono carries changing numeric readouts. Text remains real text so future Ukrainian localization does not require redrawing artwork.

## Font roles and sizes

| Role      | CSS family / token                        | Standard     | Large        | Use                                                                                    |
| --------- | ----------------------------------------- | ------------ | ------------ | -------------------------------------------------------------------------------------- |
| Display   | `Field Kit Display` / `--fk-font-display` | 40px minimum | 48px minimum | Screen titles, large pause/result labels; Handjet 600, element shape 2, element grid 1 |
| Body      | `Field Kit UI` / `--fk-font-ui`           | 18px / 1.5   | 22px / 1.5   | Instructions, descriptions, help and narrative; Exo 2 400                              |
| Control   | `Field Kit UI` / `--fk-font-ui`           | 16px / 1.35  | 20px / 1.35  | Buttons and form fields; Exo 2 500, primary emphasis 600                               |
| Secondary | `Field Kit UI` / `--fk-font-ui`           | 14px / 1.45  | 18px / 1.45  | Supporting labels, hints and release identity                                          |
| Numeric   | `Field Kit Mono` / `--fk-font-mono`       | 26px         | 30px         | Score, coverage and timer; IBM Plex Mono 500, equal-width digits                       |

The title-screen wordmark is 56–104px. Handjet is instantiated at `ELSH=2`, `ELGR=1`, `wght=600`; its appearance is fixed in the delivered font. Do not simulate other display weights. Exo 2 retains only its 400–600 weight range. Small keycaps and compact counters can use Mono at the secondary size.

Exo 2 lacks `₴ ↑ ↓ ← →`; the UI stack explicitly falls back to the locally hosted IBM Plex Mono for those symbols. All three delivered fonts independently cover the complete Ukrainian and English alphabets and the required punctuation. Font coverage does not depend on an installed system Cyrillic font.

## Integration

Load `game/ui/field-kit-fonts.css`, `game/ui/field-kit-tokens.css`, then `game/ui/field-kit-components.css` **after** legacy game styles. Add `field-kit` to the existing `body.game-shell`; retain `game-shell` and all existing screen/state attributes. A standalone tool can opt in with `body.field-kit`.

The game, landing pages and existing authoring tools now load this stack. Supporting pages add `field-kit-support` for readable paragraph sizes; the game keeps its existing shell layout. Generated credits and privacy pages use the same fonts, and the build rewrites their relative paths for root and versioned GitHub Pages routes. Canvas feedback uses the numeric/interface faces at 14px or larger and gives labels matching background plates.

The existing Text size setting already persists `standard` / `large` through `game/library.mjs`; `game/app.mjs` applies it to `document.body.dataset.textSize`. The new tokens consume that same attribute. Do not introduce a second preference or scale the simulation canvas to increase text size.

New content uses `.field-kit-copy`, `.field-kit-secondary`, `.field-kit-display`, `.field-kit-counter`, `.field-kit-panel`, `.field-kit-control`, `.field-kit-primary`, and `.field-kit-status`. Legacy selectors are bridged for the title, dialog headings, HUD, controls and common supporting labels. Legacy `--pixel-font` resolves to the UI font; Handjet is assigned only to the explicit display roles.

Font URLs are relative to the fonts stylesheet, so subpath deployment on GitHub Pages works without origin-root paths. All assets are local; no Google Fonts stylesheet or font CDN is needed at runtime. The faces use `font-display: swap`. If drawing or measuring text on a canvas, await the relevant `document.fonts.load()` and redraw after it resolves; DOM text can swap naturally. Do not put localized words in sprite sheets.

## Visual roles and interaction states

The canonical palette is ink `#070B12`, panel `#101923`, text `#F3F0DB`, cyan `#78DCE8`, amber `#F4BF62`, hazard `#F07879`, success `#9DBB7A`, and muted `#A5B2BB`. Raised panels and decorative borders use `#182531` and `#425563`. Interactive boundaries use `--fk-control-line: #647786`, which has 3.36:1 contrast against the raised panel. Text on panels is 15.44:1; muted text on raised panels is 7.19:1. Semantic tokens live in `field-kit-tokens.css`; primary action is amber, focus and flight guidance are cyan, and hazard is coral. These roles must be adjusted together by a theme.

Controls have a minimum 44px target height, square borders, and separate hover, active, selected, disabled, invalid and focus treatments. Existing `.controller-focus` uses the same outline as keyboard `:focus-visible`. Selection adds an inset edge; disabled controls use dashed borders and native/ARIA state instead of reduced opacity alone. Error and success messages must include explanatory text; color is additional information. `aria-disabled` describes a state but does not disable activation: the owning component must prevent its action, or use a native disabled control.

The CSS respects reduced-motion and forced-color preferences. Keep visible focus above adjacent surfaces and ensure scroll containers do not clip it. Never use blinking selection, screen noise or text distortion to communicate a required action.

## Provenance and repeatable verification

The three WOFF2 files, original OFL 1.1 notices and `provenance.json` live in `game/ui/fonts/field-kit/`. The manifest records the source commit, exact source and license URLs, source/output SHA-256 hashes, source versions, output weights/axes, byte sizes and toolchain. No glyphs were subsetted; only variation axes were instantiated or restricted.

Sources are pinned to Google Fonts commit `809e4d8b8d7e9364a914909bb777679606c178b8`. Original upstream projects are [Handjet](https://github.com/rosettatype/handjet), [Exo 2](https://github.com/googlefonts/Exo-2.0), and [IBM Plex](https://github.com/IBM/plex). Their font names, copyright and license records remain in the files; the CSS family names are application aliases.

Create a local tool environment when fontTools is unavailable:

```sh
python3 -m venv /tmp/revealline-field-kit-font-tools
/tmp/revealline-field-kit-font-tools/bin/python -m pip install 'fonttools[woff]==4.65.0' 'brotli==1.2.0'
/tmp/revealline-field-kit-font-tools/bin/python scripts/verify-field-kit-fonts.py
```

Normal verification is offline and read-only. It checks the actual WOFF2 binaries for all 178 required codepoints: printable ASCII, 66 Ukrainian letters and punctuation including `ʼ‘’“”«»–—−…•·×÷°€`. It also checks hashes, license notices, weights, remaining variable axes, embedding flags, equal-width telemetry digits and the local fallback for `₴↑↓←→`.

To reproduce the existing binaries from the pinned, checksum-verified source files:

```sh
/tmp/revealline-field-kit-font-tools/bin/python scripts/verify-field-kit-fonts.py --rebuild
```

Rebuild validates all generated files against the committed hashes before replacing any output. An intentional font update needs newly reviewed source hashes and provenance, not a blind rebuild against upstream `main`.

| Delivered file              |       Bytes |
| --------------------------- | ----------: |
| `handjet-display-600.woff2` |      38,120 |
| `exo2-ui-400-600.woff2`     |      76,652 |
| `ibm-plex-mono-500.woff2`   |      40,080 |
| **Total**                   | **154,852** |

## Rendering acceptance

Review actual rendered screens in Standard and Large at desktop, narrow portrait and touch landscape widths. Confirm title wrapping, dropdowns, dialog headings, selected mission rows, timers and all navigation hints stay visible. Check keyboard and controller focus, disabled controls, invalid uploads, forced colors and reduced motion. The binary checks prove glyph availability, not visual quality or screen layout.

Use these strings in the presentation atlas and typography review:

```text
Mission complete / Місію завершено
Continue flight / Продовжити політ
Signal lost / Сигнал втрачено
Ґанок · Єдність · Імпульс · Їжак
І l 1 | О O 0 | 01:24 | 85% | ʼ ’
АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯ
абвгґдеєжзиіїйклмнопрстуфхцчшщьюя
```

Review at browser zoom 100%, 125%, 150% and 200%, with each font loaded and under a cold cache. Test long Ukrainian strings before translation work begins. Use 400/500/600 weights deliberately, retain mixed case for readable controls, and keep display lettering out of dense help text.
