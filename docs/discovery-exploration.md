# Interactive discovery atlases

The `exploration` completion-reward payload uses the registered
`inspect-compare-atlas` recipe at revision `1`. It presents two selected cards
side by side and optional prediction questions with authored causal feedback.
The same component serves earned Collection rewards and isolated Studio previews.
Its reading and interaction are untimed. It never changes arcade mechanics,
scores, reward requirements or verified learning/mastery evidence.

## Author and preview

In Level/Campaign Studio or Company Studio, open the **Discovery** controls and
the **Interactive discovery atlas** panel. Import or author a reward with explicit
completion requirements first. Select that reward, load its current atlas or use
the small **video-role example**, and edit the bilingual payload JSON.

**Preview exploration** mounts the real player component without a player store.
Use the discovery language selector to preview English or Ukrainian. Card images
without an available exact-media resolver show a useful text alternative; they
are not fetched from guessed filenames. The example has no image dependencies.

**Apply atlas revision** validates the recipe, creates an immutable reward
revision and updates references to the exact previous revision. Requirements,
campaign/mission gameplay identities and accepted clears remain unchanged. Company
Studio also rebinds existing exact translation records without changing their
English or Ukrainian wording; changed English still fails validation. A concurrent
authoring-context change cancels application. Export the project and reward sidecar
together, or use the full Company Studio source draft. Compiling checks exact
selected asset pins and keeps unrelated campaign data out of the artifact.

## Data contract

The payload contains `id`, `type: "exploration"`, `locales` and `recipe`.
Both English and Ukrainian payload locales require `title` and `intro`.

The recipe contains:

- `id: "inspect-compare-atlas"` and numeric `revision: 1`.
- `cards`: two to eight unique cards. Each has `id`, `sourceIds`, and bilingual
  `title`, `body` and `sourceNote`. An optional `asset` uses the existing exact
  `{assetId, sha256}` reference and requires bilingual `alt` text.
- `predictions`: zero to four unique prompts. Each names known `cardIds`, provides
  bilingual `prompt` and `explanation`, contains two to four uniquely identified
  `choices` with bilingual `label` and `feedback`, and declares an existing
  `expectedChoiceId`. Feedback explains the consequence of each choice; a wrong
  prediction can be reconsidered immediately.
- `sources`: zero to twelve `{id, title, url}` references. Source IDs must resolve,
  and URLs must use HTTPS without credentials. Fictional fixtures identify their
  limits in the visible source notes. A source link does not license its images.

The recipe is limited to 48 KiB, the complete exploration payload to 52 KiB, and
the enclosing reward retains its existing 64 KiB limit. Image dependencies retain
the existing supported raster formats, byte budgets and exact-media recovery.
No scripts, arbitrary recipes, embeds, reading timers or earning predicates are
accepted. Links open only through a player's explicit action.

## Player behavior and evidence

The earned reward viewer mounts the atlas only after the normal accepted reward
transition. Locked rewards expose their public teaser, not cards or media.
Buttons support normal Tab/Enter/Space navigation and arrow/Home/End navigation
between card buttons. Selection is expressed by visible checks and `aria-pressed`;
prediction feedback has a polite live region. Reduced motion needs no alternative
sequence because the component has no motion or timers.

The bounded actions are `inspect`, `predict` and `reset`. State is local to the
mount and contains only selected cards and known chosen answer IDs. Closing and
reopening starts fresh. A prediction answer is recomputed from the declared
fixture; it is **optional practice**, not a persisted learning completion, an
assessment of practical skill or proof that the player learned the topic.

Card changes abort removed media requests and release their owned resources.
Repeated selection preserves already mounted cards. The component's `dispose()`
removes its listeners, aborts remaining requests and releases pending or acquired
image owners. Host image adapters must honor the supplied signal and return a
cleanup function for each owned image.

The editable example compares the high-level roles of a camera and video
transmitter using [Betaflight's VTX documentation](https://betaflight.com/docs/wiki/getting-started/hardware/vtx),
reviewed on 2026-09-28. Its transfer question uses a fictional classroom diagram;
it contains no wiring or aircraft-configuration procedure. The example is an
authoring aid and is not automatically installed into every company edition.
