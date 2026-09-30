# Pin a next mission

The shared Mission Library in Solo, Versus and Team offers **Pin focused mission**,
**Find goal**, and **Clear goal**. Pinning remembers the most recently focused
visible mission. Find removes incompatible browsing filters and focuses that
exact registered card. It never starts a run, downloads a pack, awards progress
or changes the selected gameplay difficulty. Another deliberate Play action
still belongs to the existing launch authority.

The preference stores a single bounded opaque Mission Library ID under
`revealline.mission-goal.v1.<logical-edition>.<mode>`. It is separate from Journey,
reward receipts and session-only chooser browsing state. Same-origin hub and
standalone views share the logical edition key across engine releases. Ordinary
non-company modes use `default`; company Solo supplies its selected edition ID.
Switching the chooser's mode switches the preference, without copying goals
across modes or editions.

Missing, removed or omitted IDs remain stored and appear unavailable. Restoring
the exact permitted source makes Find available again; the preference cannot
reintroduce omitted content. Corrupt or future-format records remain intact.
Failed reads, writes or readback leave an in-memory choice with an explicit
session-only notice and retry action. Valid cross-tab changes update the visible
choice, while a pending unsaved local choice is preserved until explicit retry.
Studio game previews use their existing isolated storage and never write player
preferences.

Native buttons support the shared keyboard and controller navigation. Pin/Find
retire older preparation intent, so a stale download cannot start behind the new
action. Destroying the chooser retires its listeners. No streak, currency, XP,
completion flag or automatic launch is introduced.
