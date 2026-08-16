# A Weekly Digest Period is claimed before SMTP; an empty Window does not create a Digest Delivery

A Weekly Digest must not go out twice for the same User and Digest Period. The Digest Delivery is claimed before the message reaches SMTP so a worker that dies mid-send cannot retry that Period — losing one week of mail is the accepted cost of never double-sending.

An empty Digest Window is not a send attempt. No Digest Delivery is written, so a later tick the same local day (for example after sync catches up) can still send.

## Considered Options

- **Claim even on empty** (shipped in slice #271): rejected because a Sunday tick that races ahead of sync burns the Period and the User gets no mail that week.
- **Retry after a failed SMTP send**: rejected; the unique claim is what makes resume safe. Retrying a `failed` Period would need a different idempotency story.
- **Sunday-start Period keys**: rejected. The Period stays the User's local ISO week; preferred weekday stays the due-day filter.

## Consequences

- `skipped_empty` is a worker outcome, not a Digest Delivery that occupies the unique key.
- A failed send still occupies the Period.
