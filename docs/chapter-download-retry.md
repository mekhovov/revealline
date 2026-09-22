# Retry a chapter download without reloading

HTTP and unreadable-response failures now tell the player to choose the same chapter again while online. The host already starts a new request for every explicit uninstalled-chapter selection; a reload is not required. Keep the current flight and installed library usable while showing the failed chapter and HTTP status where available.

This correction changes recovery instructions only. It does not add automatic retry, weaken pack validation, suppress aborts, change saved-flight ownership or install partial content. Request failures retain their diagnostic cause. Aborted work keeps its existing cancellation behavior.

Verify an unavailable response, preserved selection, a second deliberate selection after the server recovers, and successful installation without navigation or reload. The final source still requires ordinary release gates and public verification; local controlled HTTP faults are separate evidence.
