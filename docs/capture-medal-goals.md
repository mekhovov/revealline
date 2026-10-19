# Capture medal goals

F23b replaces the generic faster/cleaner retry suggestion in the existing Solo
Capture result with the next medal's accepted time target and remaining
conditions. The existing result summary, stars, picture, actions and record
owners remain in place. English and Ukrainian use the normal live locale binding.
The guidance belongs to the existing scrollable Mission details reader rather
than the optional footer, which compact and short-landscape layouts hide. It
occupies a complete row in the compact result and uses the existing Read details
and Done reading controls; it adds no dialog or focus owner.

The projection reads the terminal core medal and effective `run.rules.timeMedals`.
Bronze targets Silver by time. Silver targets Gold by time and no lost lives.
Gold reports the highest medal. The comparison retains the core's existing EPS
acceptance; it never determines or writes the award. Ordinary rules compare
remaining lives with starting lives, as the core does. Classic rules use
`classic.livesLost`, so an earned replacement life cannot incorrectly satisfy
the clean-play requirement.

Authored fractional time targets remain explicit. The UI says when time already
meets the target. A positive time miss below 0.01 seconds stays visibly positive;
larger shortfalls round upward to hundredths with that qualification. No damage
penalty is introduced into Capture. Missing comparison facts are unavailable,
and nonterminal runs have no medal goal.

Practice keeps its existing no-unlocks footnote, and First Flight retains its
lesson result owner. Administrative tuning keeps the existing no-award result
message and suppressed stars, with no medal goal. This feature does
not change collection, mastery, Journey star or recording eligibility.

The focused tests earn native Gold, Silver and Bronze, verify their recordings,
repeat a legal loss/extra-life route, and distinguish exact EPS acceptance from
a positive miss using identical legal cuts. Actual Solo entry tests complete
normal and administrative flights, preserve the accepted checkpoint, saved
progress and focused Retry through EN/UK refresh, and exercise the real Retry
handler. These are source/finite-browser-model checks; actual browser layout,
physical hardware and comprehension remain separate qualification.

Browser review should complete a normal non-Gold mission, inspect the target
and time/life conditions at compact width, switch EN/UK, then retry using the
existing action. Retain the source revision and earned state; any synthetic
boundary example must be identified separately from the earned flight.
