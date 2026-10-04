# Optional world discovery — implementation draft

The Library gains an explicit **Browse optional worlds** action. It reads a small
first-party catalog and downloads only the chosen data pack. The existing native
pack inspection, course validation and transactional world store remain the
installation boundary. A download does not open a course, change an editor draft,
arm a drone, install executable packages or prepare the simulator offline.

The current source continuation `a6e5ffbfe` normally integrates main `f3764070e`
and the separate worker source-capacity prerequisite. It routes requests through
a genuine dedicated Worker loaded from the existing generated verified worker;
it does not register a service worker or cache the runtime merely to browse.
Its [frozen manual fixture](../authoring/fpv-worlds/library/prepare-browser.mjs)
adds worker-side request refusals, response faults, cancellation, transfer and
owner cleanup checks. The actual source browser passed **208/208** checks;
the [complete receipt and frozen fixture](../authoring/fpv-worlds/library/evidence/worker-source-r1-provenance.json)
are preserved losslessly. All 45 native dedicated Workers terminated once after
their terminal reply; the page made no catalogue or pack requests. Three successful
pack responses used the real immutable HTTPS asset. Named worker-response faults,
timeout injection and native IndexedDB abort controls are disclosed in the receipt.
Full source validation, seven applicable existing installation/worker checks,
scoped lint and all-three source-bound admission passed at `01fc6ad20`, with
two identical builds and all committed inputs/ZIP members verified. The
[qualification receipt](../authoring/fpv-worlds/library/evidence/worker-qualification.json)
binds those results. The new exact 102-member Worlds and 69-member Academy players
are staged; admitted-player and changed-worker offline checks remain pending.
The production catalogue remains empty.

The first admitted fixture run passed 119 controls, then timed out waiting for
the selected flight's exact Ready text. Its [failure receipt](../authoring/fpv-worlds/library/evidence/worker-package-r1-failure-provenance.json)
is preserved. The coordinator subsequently observed the same frame paused at
tick zero with Arm enabled and no graphics errors. The runtime and helper files
match the source fixture; a focus pause is a hypothesis because that run retained
no focus trace. A controlled repeat is required; no guard or timeout was relaxed.

### Historical page-transport evidence

The prior draft integrated main `ade4bfc2dd` and the
separately qualified shell capacity prerequisite [#1065](https://github.com/mekhovov/revealline/pull/1065).
The first source candidate `f33d01d62c` passed 189 actual browser controls;
its [full receipt and frozen harness](../authoring/fpv-worlds/library/evidence/source-r1-provenance.json)
are preserved losslessly. The corrected source `74bd1b1a53` separately passes
**192/192** actual browser checks, including three observed rejected-body
cancellations. Its [receipt and frozen fixture](../authoring/fpv-worlds/library/evidence/source-r2-provenance.json)
retain the exact source and all 102 baseline members with two explicit overlays.
The subsequent labelled-count/readable-size candidate `ef770faff` passed
**195/195** actual source controls and full source validation. Its
[full receipt and frozen fixture](../authoring/fpv-worlds/library/evidence/source-r3-provenance.json)
are preserved. Admission then rejected the application-thread fetch with
`Optional practice network requests belong only to its generated verified worker`,
before producing an artifact. This failure remains part of the record; the guard
is unchanged and those 195 checks do not qualify the new Worker transport.

Mountain Reservoir's eight challenges and sixteen
demonstrations are separately qualified in [#1066](https://github.com/mekhovov/revealline/pull/1066),
now merged; its quality follow-up and a production catalog row remain separate.

## Download contract

- The sole index is
  `https://raw.githubusercontent.com/mekhovov/revealline/main/authoring/fpv-worlds/published/index.json`.
  Pages does not copy the source authoring tree. No new Pages publisher or launcher
  package is introduced.
- The index is at most 8,192 bytes and four rows. `FPVWorldLibrary.v1` contains
  `worlds`, whose rows contain only `id`, `title` (English/Ukrainian pair), authored
  `revision`, full `commit`, repository `path`, `sha256`, exact `bytes`, and
  `courses`. Paths must stay under `authoring/fpv-worlds/` and end in `.rlpack`.
  Runtime constructs each URL from the fixed raw repository origin and full commit.
- A dedicated Worker owns each explicit read. It permits only the fixed bounded
  catalogue or a full-commit first-party pack request with an exact byte count
  and digest. Requests omit credentials and reject redirects. The worker closes
  its reader before replying, transfers successful bytes and is then terminated
  by its page owner. Cancellation reaches its AbortController; no application
  fetch allowance or executable world content is added.
- Streaming reads enforce the declared byte bound. Pack length and SHA-256 must
  match before native pack inspection; all imported courses are validated, and
  the inspected project ID/course count must match the catalog row.
- One operation owns the controls. Cancel or timeout before the atomic save
  preserves existing revisions. The world-store generation is captured before
  downloading, so concurrent library writes cannot silently be overwritten.
  Once validation finishes, Cancel is disabled for the native atomic save.
- Saved state is derived from the native revision list. Exact saved revisions are
  not downloaded again; removal refreshes the controls. A committed save whose
  later storage refresh fails stays labelled saved and asks for a reload.
  Unmount aborts any pending
  fetch and removes owned UI. Network, content, quota and conflict errors retain
  a retry action instead of activating partial content.
- Saving a pack does not establish runtime cache readiness or durable storage.
  The existing **Prepare simulator offline** and persistent-storage controls keep
  their separate explicit contracts; users should retain exported backups.

The authored revision is descriptive metadata pinned by the pack hash. It is not
assumed to be identical to every individual course revision in a multi-course pack.

## Capacity checkpoint

The current integrated Worker draft measures **16,776,298 bytes across 95 original
inputs**, leaving **918 bytes** below the unchanged 16 MiB bound. The separate
menu candidate `9fbe03fe3` projects 286 bytes across this actual input inventory;
with the focus change (28 bytes), that would leave **604 bytes**. The earlier
429-byte menu estimate counted its canonical CSS as well as the generated input;
the canonical CSS is outside these 95 original inputs.
The current 918-byte reserve is confirmed by admission; combined menu/focus
figures are projections until integration. Relative to
the admitted worker prerequisite `b452a0cac`, only the host adapter (+710),
generated reaction module (+6,880), and generated worker (+1,682) change. The
projected worker is 6,494 bytes; its readable canonical transport remains separate.

### Historical source estimates

The draft adds one readable canonical `world-library.mjs` entry to the established
generated reaction/presentation projection. Pinned Prettier and the existing
AST/token/comment/line-preserving lexical projection prepare it; no handwritten
minification or source-policy change is used. The 24 existing audio recordings
and existing package file count are retained. A fresh admission is still required.

The first complete draft measured **6,720 source bytes** beyond main: 659 bytes in
the host adapter and 6,061 in the generated projection. Concise UI wording plus
strict string guards reduced that historical draft to 6,684 bytes. Live language
repainting and bounded dot-separated filenames brought source `74bd1b1a53` to
7,167 bytes, including honest reporting of a committed save followed by a refresh
failure. The subsequent visual review adds labelled challenge counts, readable
KiB/MiB sizes and existing card typography: **7,431 bytes** total, 710 in the host
and 6,721 in the generated projection. After the independent 3,562-byte shell
recovery, this leaves **1,159 bytes** beneath the unchanged source ceiling.
The separate 116-byte draw-readiness candidate would leave 1,043 bytes. These
are source measurements, not fresh admission.
Limits and integrity checks are unchanged.

The separately published prerequisite prepares
only the generated shared-mode-shell section of `flight-fullscreen.mjs` with the
same existing lexical projection after its pinned Prettier step. That section
shrinks from 16,954 to 13,392 bytes (3,562 recovered), without changing the readable
canonical `game/ui/mode-play-shell.mjs`. Its independent identity, full validation,
all-three admission and actual Worlds/Academy shell checks passed. Its protected
publication remains separate from this unqualified feature.

## Bounded qualification plan

Use the accepted industrial split-level starter as a verification fixture, not as
a finished-world production catalog row. Its original `.rlpack` is 17,072 bytes,
SHA-256 `311b04890037f6b5681dd1fd0067f72292a888bfd2e8cb5b605e8de707aa8711`.
Publish these exact verification bytes at an immutable first-party commit/path
before testing an actual remote download. The shipped catalog stays empty.

The verification asset is now pinned at commit
`1120b649456b2f20f134558a4f736fe515484f4c`, path
`authoring/fpv-worlds/library/fixtures/industrial-split-level.r1.rlpack`.
The first actual browser run verified its real HTTPS download, exact native
installation, revision retention, removal/reopen, generation-conflict refusal,
native write abort, and truthful post-commit refresh-failure status. The ready
unarmed flight and dirty editor text remained unchanged. All 189 checks passed;
86 manual canonical/generated parser boundary checks and scoped lint also pass.
The first reader rejected bad status/oversized headers before acquiring its
reader, so a later audit moved those checks under the same cancellation `finally`.
The corrected qualifier explicitly observes cancellation of those rejected bodies;
all 192 checks pass, with three actual HTTP-200 responses from the pinned raw
repository URL. Native write and readonly refresh aborts are recorded separately
from those HTTPS requests. The historical pass is not relabelled as evidence for
this correction.

The first native visual review found that the Library entry fits a 390-pixel
viewport without horizontal overflow, but the unlabelled count and raw byte
display needed clearer metadata. The next source fixture checks the improved
labels and existing typography. Its preview-only EN/UK buttons dispatch the
host's existing language-select change; they do not establish that native
language navigation is exposed. Three shared-shell observations remain separate:
the native Settings view did not expose that language control, sticky navigation
overlapped other scrolled content, and the mobile Missions footer label/icon
overlapped Expert. These are not repaired by this discovery change.

Archives use gzip with zero modification time. Decompress each file with
`gzip -dc <archive>`, then verify its raw SHA-256 and size from the provenance
receipt. The fixture's replacement pack and timeout callback are explicit
diagnostics, not a published second revision or two-minute endurance claim.

Functional fixtures must cover empty/valid/malformed index, path and revision
rejection, wrong/truncated/overlong bytes, digest mismatch, cancellation, timeout,
retry, duplicate action, native IDB install/reopen, saved/replaced/removed revision,
concurrent generation conflict, unchanged active flight/editor and disposal.
Qualify the final admitted player as well as source. The actual browser belongs
to the coordinating agent; no simulated offline flag substitutes for a stopped
local origin and real reload if an offline claim is added later.

The design follows the explicit response checking and abortable streams described
in [MDN's Fetch guidance](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)
and [readable-stream guidance](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams).
The distinction between saved data and durable offline readiness follows
[WebKit's origin storage/eviction policy](https://webkit.org/blog/14403/updates-to-storage-policy/).

Normal cancellation waits for the Worker's terminal reply after its reader cleanup.
This follows the [immediate termination contract](https://developer.mozilla.org/en-US/docs/Web/API/Worker/terminate):
terminating first would give the Worker no opportunity to finish that cleanup.
Successful replies use the [transfer list](https://developer.mozilla.org/en-US/docs/Web/API/Worker/postMessage)
for the returned byte buffer; the manual native-Worker fixture observes both that
list and the exact received bytes.
