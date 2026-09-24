# Visible actor bounds

Status: source candidate; frozen-build and human board review pending.

Prepared FPV actor sprites now use their declared occupied pixels plus the complete rotor sweep when
resolving cosmetic display size. Transparent frame padding no longer makes a correctly sized source
look undersized in Solo, Versus or Team. Legacy images without occupied-bound metadata retain their
exact full-frame sizing.

Current prepared actors target at least 24 CSS pixels on desktop boards and 20 CSS pixels on compact
boards; ordinary actors remain capped at 32 CSS pixels, with the existing larger boss allowance.

The same bounded calculation is shared by the Journey player, Journey enemies and Team actors. Team
edge placement reserves the enlarged complete source frame so transparent pixels, rotors and the
heading marker remain on the board at every corner, heading and bank angle.

This change is presentation-only. Contact rings remain at their existing simulation coordinates and
radii, replay checkpoints do not change, movement and difficulty are unchanged, and prepared image
leases keep their existing ownership and lifetime.

Focused automated checks cover rectangular frames, rotor sweep, transparent padding, phone/desktop
sizes, Team corners and banking, source pivots, exact contact radii and unchanged replay authority.
They do not establish real-device readability or visual preference; those remain public-build and
human review gates.
