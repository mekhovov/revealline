# Journey storage connection recovery

If the browser closes Journey’s database connection, subsequent reads or saves must be able to recover. Previously the backend cached the closed connection indefinitely: a player could retry without ever obtaining a usable handle. A synchronous failure while opening storage could likewise remain cached.

The backend now invalidates only its current connection on unexpected close, version change, or a transaction’s synchronous `InvalidStateError`. Open failures retire only their owning request. Late events from old requests/connections cannot invalidate an accepted replacement. The failed operation is still reported as failed; the next caller opens a fresh connection. There is no automatic transaction replay.

Pending progress remains in the existing profile store and can still be exported while persistence is unavailable. A later flush merges pending events with the durable profile using the existing transaction and validation rules. This change does not create scores, change profile formats, recover browser-deleted data or promise persistence when storage remains unavailable. Quota refusal does not unnecessarily discard a healthy connection.

[MDN’s close-event documentation](https://developer.mozilla.org/en-US/docs/Web/API/IDBDatabase/close_event) distinguishes unexpected closure from normal `close()`. [The transaction API](https://developer.mozilla.org/en-US/docs/Web/API/IDBDatabase/transaction) documents `InvalidStateError` for a closed connection. Both paths therefore need coverage.

Verification uses the actual Journey backend/store with the existing serialized finite IndexedDB fixture. It exercises deliberate retry, pending clear preservation, one successful write, stale owner events, synchronous open failure, concurrent readers, blocked requests and quota refusal. Existing Journey and backup tests remain part of the focused cohort. These are not physical-browser storage-interruption tests or whole-release acceptance.
