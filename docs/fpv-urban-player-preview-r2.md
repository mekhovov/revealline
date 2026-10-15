# Urban regional player preview — revision 2

This increment offers the reviewed loading court, workshop openings, roof passages
and connected parking ramps through the normal regional Library. It remains a
bounded 384 × 384 m unscored preview, not the planned large Urban region.

## Content and compatibility

- Immutable source: `622fade3a7a4e70021cab9c509c1116d0378ad2b`, merged in #1312.
- Delivery identity: `urban-earthworks-study`, `review-r2`.
- Descriptor: 6,603 bytes; SHA-256
  `9a7d157d2d5fd197c632b870bd9b9ebacd62015ad0084605712185064c8ae73a`.
- 38 payloads: 2,268,846 bytes; total with descriptor: 2,275,449 bytes.
- Both source manifests retain the verified `mixed-r4` revision.
- The trusted presentation adapter enables Urban ground surfaces only for this
  exact descriptor and matching region identity. Existing `review-r1` installations
  retain their previous plain presentation and remain separately selectable.
- No world geometry, collision, physics, scoring, package limit or descriptor
  schema changes are introduced by this catalogue update.

## Verification status

Source qualification is recorded in #1311: fourteen commanded routes in both
flight modes, four authored-start/mode combinations and four deliberate wall/roof
contact cases. The copied immutable delivery produces the same route results.

The actual catalogue row passes immutable descriptor/payload preparation and
all three presentation tiers. Each tier retains the same geometry hash
`10abc94fb8878f2439f6d639e9257acd36fa9517009eed75f54617000ad322e3`;
disposal releases all prepared geometry. The older descriptor still selects its
plain presentation. These checks are separate from browser storage verification below.

Native browser review on the isolated 9051 source host passed the normal
Download → Saved → Fly journey without a retry: Ready to arm at 3.0 m with zero
input, then explicit Arm and keyboard flight, paused at 2.4 m with +3.0 m/s
vertical speed and 0.7 m/s drift. A fresh player load retained the saved review-r2
and the previously installed Railway revision. This review combines the corrected
renderer from #1310 with the cold-preparation guard from #1314; the latter must
merge before claiming reliable first launch. The review host is not a qualified
package. Screenshot: `urban-r2-normal-library-flight.png` in the external archive.

A standalone browser fixture then mounted the actual Library against the same
isolated origin: downloading historical review-r1 preserved review-r2 and Railway;
returning to current pins listed all three. Opening each Urban record hash-verified
its saved scenery and selected plain (r1) versus Urban (r2) presentation. A fresh
page reload retained all three records. This verifies saved-revision coexistence
and loading, not another whole flight or an in-place application upgrade.
Screenshot: `urban-revisions-coexistence.png`.

Package, public deployment and physical-device acceptance remain separate.
Source and delivery identity are preserved; the existing Library storage path is
unchanged. Published as #1316 in native stack #1292, temporarily Draft until the
cross-stack cold-preparation fix #1314 reaches main.
