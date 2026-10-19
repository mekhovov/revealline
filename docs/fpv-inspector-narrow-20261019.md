# Narrow-screen propulsion inspector — 19 October 2026

The 320 × 640 responsive check reproduced horizontal clipping in the Advanced
practice inspector. Its implicit grid retained the minimum content width of
long controls and fieldsets. Battery labels and inputs extended beyond the
dialog. A first fieldset-only correction did not fix the containing grid; that
failed attempt was retained during the investigation.

The correction gives the practice grid a zero minimum track, allows long text
and nested form controls to wrap, and stacks inspector labels above their
inputs. The physical-tuning grid can now shrink below its usual 220-pixel column
minimum. These changes affect layout only. No aircraft coefficients, rates,
gains, recording identities, saved settings or physics calculations change.

## Evidence and boundaries

- The available Chrome Guest browser was set through its visible responsive
  toolbar to **320 × 640**, without throttling. English Meteor75 and Ukrainian
  Air65 drafts both opened through Settings → workbench → PID → Advanced
  reference practice → bench data. The practice clock remained at zero.
- The original command-axis example correctly left the battery calculation
  unavailable. An explicitly synthetic voltage path with `I(V) = V`, manual
  3 V supply and 0.2 Ω resistance produced **2.5 V**, **2.5 A**, **7.5 W** source
  power, **6.25 W** delivered power and **1.25 W** loss in both locales. No real
  measurements or aircraft changes are implied.
- Labels, checkbox declaration, calculation action and results stayed within
  the narrow dialog. Keyboard Tab moved between the voltage and resistance
  inputs. This is responsive desktop emulation, not physical touchscreen,
  virtual-keyboard, 200% zoom or installed-PWA qualification.
- The Ukrainian draft returned to its original PID section; Revert restored
  **My drone / Legacy feel / zero changes**. No flight, setup save or archive
  deletion occurred. The isolated Guest window and both local test servers were
  closed. The public browser and its archives were untouched.
- The UI check used the existing emitted World artifact at `3949d2f2a` with only
  the two changed layout sources served from a local overlay. It is explicitly
  a source-preview check, not a fresh deployed-package flight. The visible
  browser error indicator was not diagnosed in this narrow check; it is not
  claimed as a console-clean run.
- **9/9 existing inspector UI checks** and **19/19 package checks** pass, with
  no skips. Formatting and whitespace checks pass. No test was added merely
  to mirror these CSS declarations.

Source changes add **828 bytes** (818 CSS, 10 inline grid). The previous exact
Academy original-input margin was 2,195 bytes, so the calculated remaining margin
is **1,367 bytes**, pending a fresh committed-input measurement. Package caps and
admissions remain unchanged. The isolated course-result provenance work exceeds
this margin and must not be silently included in this release.

Local visual receipts are `propulsion-inspector-320-en-before-20261019.png`,
`propulsion-inspector-320-en-fixed-20261019.png` and
`propulsion-inspector-320-uk-fixed-20261019.png` in the task's `sustained-flight`
visualization directory. Test logs are
`/private/tmp/fpv-inspector-narrow-ui-20261019.tap` and
`/private/tmp/fpv-inspector-narrow-package-20261019.tap`.

The source-review, integration and public-release status remains in the
[current completion plan](fpv-current-completion-plan.md). This closes the
observed narrow clipping defect locally; it does not close the wider device
matrix or archive incident.
