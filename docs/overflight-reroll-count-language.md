# Remaining reroll language

F59 replaces the shared Survival/Raid upgrade dialog's count-plus-fragment caption
with the existing canonical i18next count message. English has singular and plural
forms; Ukrainian has one, few, many and other forms. The displayed numeric value
is the existing `run.progression.rerolls` value and uses the existing locale's
number formatting.

Examples are “1 reroll left”, “2 rerolls left”, “Залишилася 1 заміна”,
“Залишилося 2 заміни” and “Залишилося 0 замін”. Counts such as 11, 21, 22, 25 and
111 use the existing language plural rules. Fractional other-form checks are text
boundary evidence, not fractional gameplay tokens or new permitted token caps.

Only this remaining-count caption changes. Native reroll cost, accepted offers,
draft/random streams, cap/availability rules, pending choice, focus restoration,
paused upgrade phase, elapsed time and tick count retain their current owners.
The existing disclosure continues to describe cost and possible repeat cards.
Other card-preview count captions are separate F59 work.

Verification uses the actual upgrade owner and native reroll handler in the
existing DOM fixture for Survival and Raid. The real localization runtime checks
EN → UK → EN, native two-to-one-to-zero token consumption, explicitly staged count
boundaries, unchanged complete model facts and stable focused upgrade identity.
Complete core/host/Raid and catalog test files are retained; the generated bundle
reconstructs all 18 source namespaces and preserves every earlier message.
Browser, physical-device, assistive-technology and public-release checks are
separate. This is one count-language slice, not completion of the full F59 plan.
