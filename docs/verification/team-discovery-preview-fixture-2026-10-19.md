# Team picture-preview fixture scope

The eight native Team picture-preview tests assumed two starter Classic arenas
and twelve retained Journey missions. Team Expeditions added 96 missions
(`f167987b97`), and Hunt lessons added six (`5bd9cc795d`). The current built-in
inventory is therefore 116; a local two-arena import raises it to 118. Updating a
fixed total would leave missing, duplicate or substituted identities undetected.

The fixture now builds its expected opaque identities from the independent Team
metadata adapter and mission registry. It checks the complete built-in inventory,
uniqueness and absence of unexpected rows. Imported Custom identities must match
the exact authored pack, edition, level and revision, with one distinct visit-local
owner. Expected inventory and imported identities do not come from the chooser DOM.

It then changes the real collection filter to Classic, or Custom for the local
import case, and checks the exact scoped identities. These are starter-picture
preview tests. Expedition schematic canvases are legitimate, so the tests do not
claim that every mission card avoids Canvas. The original zero-Canvas assertion
remains in the scoped collection, together with all original image hash/pixel,
no-awards, paused-state, URL lifetime, focus, cancellation, recovery and Next
assertions. Classic/Custom filter context is also checked after returning.

On captured main `a94f2a6c3dac43ebeead58036a7b890414dfff37`, the complete unchanged
file failed all eight cases at its old count. An inventory-only repair then
exposed all eight failures at the original global zero-Canvas assertion: the
bounded preview fallback correctly paints up to twelve Expedition schematics.
Those failed attempts are retained as evidence. The explicit native-filter scope
passes all eight complete cases, with no skipped tests or changed timeouts.

The fixture retains its existing finite DOM, image-decode and Canvas boundaries.
It does not qualify physical pixels, human play, device behavior or every mission
preview. This is a test-reliability delivery dependency, not an additional feature
group in the 113-deliverable improvement plan.
