# Current community-authoring documentation maintenance

Prepared from accepted source `0684ddbfe978e95f2b6ddcd02b4f9e0f70a4190d`. This change corrects five demonstrated documentation gaps; it does not implement or accept P17, introduce a pack format, alter game behavior or qualify a new release.

The retained [baseline audit](guide-maintenance-baseline/community-workflow-gap-audit.md) identifies the prior text and actual code paths. Its [16 source pins](guide-maintenance-baseline/source-pins.json) refer to that exact prior commit. They remain historical inspection evidence after these guide edits.

- Current compatibility guidance now distinguishes all five supported runtime pack formats, their exact engines/levels/replays, and the separate Team, Studio and historical draft transports. A reader accepting a format does not prove every mode accepts it.
- Route verification is separated from route generation. The current whole-index discovery path refuses nonlegacy Arcade content before writing; it does not accept an arbitrary community-pack selector. Creators can structurally inspect a candidate and must separately author and exercise legal play routes.
- Compiler guidance now accounts for complete editable Studio history and all retained file revisions. Runtime selection and compiled/download inventory are different sets.
- The old Workshop replacement procedure remains available as a historical receipt-free case. Current saved and first-earned managed still-media pins retain exact originals across new assignments. Independent review clarified the baseline audit: explicit `legacy` receipts still follow authored-pack lookup in current releases, as implemented by `game/ui/earned-picture.mjs:17–32`; embedded pack originals are not made immutable merely by creating a legacy receipt.
- The picture-pin API checkpoint remains historical evidence, while the guide points to the implemented player/Collection adoption and separately recorded release acceptance.

The associated authoring skill and prompt use the actual target format and keep structural checks separate from browser decoding, play, balance and physical-device evidence. The commands were inspected in source during this maintenance, not executed as a new community example. No route fixture, simulation, asset, save, version, release metadata or public site changes.

Independent review found no remaining blocker after the managed-media/legacy clarification. All seven maintained Markdown files pass formatting; all 25 added local links resolve, including their named anchors. The 16 baseline source pins and retained audit bytes match their originals, and the diff has no whitespace errors. Runtime tests and builds were not run for these prose-only edits. P17 still requires its independent fresh-workspace create/install/play/export/recover trial after the relevant presentation/catalogue dependencies ship; full phase qualification and public deployment remain with the release owner.
