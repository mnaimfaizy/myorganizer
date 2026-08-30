# MyOrganizer

MyOrganizer is a personal organization app with end-to-end encrypted storage for sensitive user data. The server never stores or processes plaintext — all encryption and decryption happens on the client.

## Domain

**Vault**:
A single User's end-to-end encrypted storage. Exactly one Vault per User. The server stores only its Ciphertext; it never sees plaintext values. A Vault is owned by a User on every surface it appears on — a device holding a Local Vault does not own it.
_Avoid_: Encrypted storage, secure store, lockbox

**Local Vault**:
The on-device copy of one User's Vault, holding that User's Ciphertext and wrapped Master Key. It is owned by the User, not by the device: one browser or device may hold several Local Vaults, at most one per User who has signed in there, and a Local Vault is never adopted by a User other than its owner. May diverge from the server's Ciphertext until reconciled.
_Avoid_: the local vault (as a device-wide singleton), browser vault, device vault, cached vault

**Ciphertext**:
The encrypted blob format produced by the Vault for all vault-backed data types.
_Avoid_: Encrypted data, encrypted blob

**Task**:
A structured work item the user creates to track personal or professional goals. Can have a status, priority, context, due date, effort estimate, and can be archived.
_Avoid_: Todo, to-do, item, reminder

**Subscription**:
A recurring financial commitment the user monitors.
_Avoid_: Recurring payment, recurring task, bill

**User**:
A person's account in MyOrganizer. Authentication is a state a User may be in, not part of what a User is — a Disabled User and an Unverified User are both Users.
_Avoid_: Account, member, customer, person

**Platform Admin**:
A User with elevated privilege to manage other Users' account metadata across the MyOrganizer service. Cannot access Vault plaintext or Master Keys.
_Avoid_: Admin, superuser, staff, operator, system admin

**Disabled User**:
A User blocked from authenticating. Disabling also ends their existing Sessions; re-enabling restores the ability to sign in but does not bring those Sessions back. Their Vault Ciphertext and profile remain until separately deleted or purged.
_Avoid_: Banned user, suspended user, deactivated account, soft-deleted user

**Admin Audit Log**:
A durable record of Platform Admin actions on Users (who acted, what changed, which User was affected, when).
_Avoid_: Activity log, admin history, audit trail, event log

**Organization**:
A group that allows multiple Users to share resources. Emerging — not fully implemented.
_Avoid_: Team, group, workspace

**Grocery List**:
A named trip-oriented collection of grocery lines the User shops against on the web Groceries experience.
_Avoid_: Shopping list (as the product name), cart, basket

**Checked Item**:
A grocery line marked bought on the current trip; it remains on the Grocery List and can be unchecked.
_Avoid_: Completed item (ambiguous with remove/clear), purchased row, done item

**Uncheck All**:
The Grocery List action that turns every Checked Item back to unchecked so the same list can be reused for another trip. Does not remove lines.
_Avoid_: Reset trip, clear checked, keep for next shop

**Remove Checked From List**:
The Grocery List action that drops Checked Items from that list only. Does not destroy the Catalog Item.
_Avoid_: Clear checked, finish trip, delete purchased, clear list

**Delete List Line**:
Removing one grocery line from a Grocery List (checked or not). Does not destroy the Catalog Item.
_Avoid_: Delete item (ambiguous with catalog), remove forever, trash item

**Delete From Catalog**:
Permanently destroying a durable grocery item identity so it is gone from the catalog and from every Grocery List that referenced it. Requires strong confirmation.
_Avoid_: Clear, remove checked, delete list line

**Catalog Item**:
A durable, user-owned grocery identity in the vault catalog (name, category, default price, notes, image, links). Grocery Lists reference it; it is not owned by a single list.
_Avoid_: Pool item, master item, product, favorite (unless UI label), template

**List Line**:
A Grocery List’s reference to a Catalog Item for a trip, carrying trip-local state such as checked and quantity/amount. The same Catalog Item may appear on multiple Grocery Lists at once.
_Avoid_: Embedded item, list-owned item, row (as domain name)

**Usage Location**:
An organisation the User must notify when an Address or Mobile Number changes, together with whether that notification has been made yet. It is not a place — it is one line on a change-of-address checklist, carrying the organisation, how it is reached, how urgent it is, and whether it has been updated.
_Avoid_: Location, place, address usage, linked organisation, contact

**Address**:
A postal address the User keeps in their Vault, and the anchor for the Usage Locations that must be notified when it changes.
_Avoid_: Location, place, residence

**Mobile Number**:
A phone number the User keeps in their Vault, and the anchor for the Usage Locations that must be notified when it changes.
_Avoid_: Phone, contact number, mobile

## Identity & Session

**Session**:
The period during which a User's client can act on their behalf without re-entering credentials. Independent of Vault Unlock — a User can hold a Session while their Vault is still locked, and unlocking the Vault does not extend the Session.
_Avoid_: Login, sign-in, auth session, logged-in state

**Access Token**:
The short-lived proof of identity a client presents with each request. Held in browser storage, so it is treated as exposed and given a deliberately short life.
_Avoid_: JWT, bearer token, auth token, API token

**Refresh Token**:
The longer-lived credential that obtains a new Access Token without asking the User for anything. How it reaches the client differs by platform — the web client never handles it directly, the Mobile App does (see ADR 0006).
_Avoid_: Renewal token, long-lived token, session token

**Verification Token** / **Reset Token**:
Single-use, purpose-bound credentials delivered by email to prove control of an address or authorise a passphrase change. Each is signed for its own purpose only and cannot be presented in place of an Access Token or Refresh Token.
_Avoid_: Email token, magic link, one-time password

**Restorable Session**:
The state where a client's Access Token is gone but it still holds enough to obtain a new one without credentials. A User in this state has not been signed out, and should not be shown a sign-in prompt.
_Avoid_: Expired session, stale session, half-logged-in, partial session

**Guest**:
A visitor with no Session and no means of restoring one. The only state that warrants a sign-in prompt.
_Avoid_: Anonymous user, logged-out user, visitor, unauthenticated user

**Unverified User**:
A User who has registered but not yet proven control of their email address. Cannot obtain a Session, and is refused at sign-in with a distinct reason rather than a credential failure.
_Avoid_: Pending user, inactive user, new user, unconfirmed account

**Force Logout**:
The Platform Admin action that ends a User's existing Sessions while leaving them free to sign in again immediately. Distinct from disabling: Force Logout answers "this User's device is compromised", disabling answers "this User should not be here".
_Avoid_: Kick, revoke access, sign out user, terminate session, ban

**Resend Cooldown**:
The interval during which a repeat request for a verification or reset email is refused. It is not a separate timer — the still-valid outstanding token _is_ the cooldown, so the wait always equals that token's remaining life.
_Avoid_: Rate limit, throttle, spam guard, backoff

## Email

**Transactional Email**:
Mail a User receives because an action of theirs requires it — verifying an address, resetting a passphrase. It carries no unsubscribe option, because opting out of it would lock the User out of their own account. Delivery is a correctness requirement, not a preference.
_Avoid_: system email, auth email, automated email, notification

**Notification Email**:
Mail a User receives because they opted in to being told about something, the Weekly Digest being the only one today. It always offers a way to stop receiving it, and a User who never opens one loses nothing they are entitled to.
_Avoid_: marketing email, newsletter, alert, transactional email

**Email Shell**:
The shared frame every MyOrganizer email is rendered inside — logo, brand colours, typography, and footer. Each email supplies only its body and declares whether it is a Transactional Email or a Notification Email; the declaration is what decides the footer, so the shell can never put an unsubscribe link on mail a User must not opt out of.
_Avoid_: email template, layout, wrapper, base template

## YouTube (focused watching)

**Followed Channel**:
A YouTube channel the User follows, imported from their connected YouTube account.
_Avoid_: Subscription, YouTube subscription, channel subscription

**Enabled Channel**:
A Followed Channel the User has turned on for metadata sync and focused watching surfaces.
_Avoid_: Active channel, selected channel, subscribed channel

**Cached Upload**:
Metadata MyOrganizer stores for one upload from an Enabled Channel (ids, title, thumb, published time, duration). Never the media file.
_Avoid_: Video (as the domain name alone), synced video, YouTube video row

**Watched**:
The binary completion/seen state of a Cached Upload for a User. Reversible by the User; not a viewing-analytics history.
_Avoid_: Viewed, seen, played, completed

**New**:
A Cached Upload that is not Watched.
_Avoid_: Unwatched, unread, unseen

**Weekly Digest**:
The weekly email of long-form Cached Uploads that are still New and inside the Digest Window. Shorts are never part of it.
_Avoid_: notification email, YouTube newsletter, catch-up mail, sync-and-notify

**Digest Window**:
The open interval of publish times that makes a New Cached Upload eligible for a Weekly Digest. It starts at the last successful send, otherwise when the User opted in, otherwise when they connected YouTube.
_Avoid_: lookback, became-New window, since last sync

**Digest Period**:
The User's local ISO week (Monday-start) during which at most one Weekly Digest may be attempted.
_Avoid_: digest week, calendar week, Sunday-start week, interval

**Digest Delivery**:
One attempt to send a Weekly Digest to one User for one Digest Period.
_Avoid_: delivery ledger, notification log, send receipt, mail record

**Shorts Daily Budget**:
The User’s configurable daily cap on time spent in the Shorts lane (default one hour), measured as wall-clock while a Short is active and the document is visible.
_Avoid_: Shorts quota, daily Shorts timer (as the product name), playtime limit

**Shorts Hard Stop**:
The locked state when the Shorts Daily Budget is exhausted for the User’s local calendar day: in-app Shorts playback and navigation are unavailable until local midnight or the User raises the limit enough to unlock.
_Avoid_: Soft lock, cooldown, Shorts ban, timeout

## Frontend Architecture

**UI Primitive**:
A reusable React component in `libs/web-ui/` with no knowledge of domain state, vault data, or route context. It must be fully expressible with mock props — that expressibility is required, not optional. Stateful interaction (checked, open, a mount point that fires a toast) does not disqualify it; domain knowledge does.
_Avoid_: Shared component, base component, core component, common component, stateless component (as the definition)

**Feature Component**:
A React component in `libs/web/pages/<route>/src/components/` that composes UI Primitives with domain logic and route-specific state. Never imported by other routes.
_Avoid_: Page component, route component, smart component

**Vault UI Component**:
A presentational component in `libs/web-vault-ui` that shows vault-adjacent state from mockable props. It knows the vault domain, so it is not a UI Primitive; it is reused across routes, so it is not a Feature Component.
_Avoid_: UI Primitive (wrong scope), Feature Component, vault widget, vault card (as the scope name)

**Structured Spec**:
The handoff document the main agent passes to ComponentBuilder. Contains: component name, target path, scope (UI Primitive or Feature Component), props interface, state ownership, Zod schema if applicable, and relevant guideline references.
_Avoid_: Component brief, component plan, design spec

## Mobile

**Mobile App**:
The React Native client in `apps/mobile`, sharing domain logic with the web app through cross-platform libraries. Feature code lives under `libs/mobile/*`.
_Avoid_: native app, RN app, the app

**Platform Adapter**:
A thin implementation of a shared abstract interface (e.g. `VaultCrypto`, token storage) that supplies platform-specific behavior to otherwise platform-agnostic code. An interface earns the name once a platform implements it; a shape written ahead of its implementors is not a Platform Adapter, it is a guess.
_Avoid_: shim, wrapper, provider

**Vault Unlock**:
The client-side action of deriving the Master Key from the User's passphrase so vault Ciphertext can be decrypted for the session. No plaintext or key leaves the device. Unlock is a plaintext-access boundary, not a network one: a locked Vault can still send and receive its own Ciphertext, because moving bytes that are already encrypted needs no Master Key. What a lock withholds is the ability to read them.
_Avoid_: vault login, decrypt vault, open vault

**Unclaimed Local Vault**:
A Local Vault on a device with no recorded owner. It predates per-User scoping, so ownership cannot be read from it and must be established by Vault Claim Evidence. It is never removed on anyone's behalf, and a claim copies it into the claiming User's entry rather than moving it, so the slot survives a claim unchanged. It is never resolved implicitly: a User who cannot produce evidence for it sees a device that holds no Vault, and the Vault is not offered, not unlockable, and not guessable at. Offering it on a passphrase alone is what made a shared passphrase enough to open somebody else's Vault.
_Avoid_: orphan vault, legacy vault, unowned vault, shared vault

**Vault Claim**:
The act of recording an ownership that already held, assigning an owner to an Unclaimed Local Vault on evidence that the Vault is that User's. Claiming never moves a Vault between Users. It is separate from Vault Unlock: ownership says whose Vault it is, unlocking says whether it can be read, and a Vault can be claimed while still locked. A claim by a User who already holds a Local Vault of their own replaces that Vault, so it is an explicit, acknowledged act rather than a one-click one.
_Avoid_: adopt vault, take over vault, assign vault, link vault

**Vault Claim Evidence**:
What proves an Unclaimed Local Vault belongs to the signed-in User. A matching server Vault Meta is the strongest and needs nothing from the User: only that authenticated User can have written it. Failing that, a recovery key is proof, because it is minted per Vault and cannot collide. A passphrase unwrap is deliberately not proof on its own — it establishes knowledge of a string, and two people who share a passphrase would each unwrap the other's Vault, which is a Vault handed to the wrong User rather than merely a failed unlock.
_Avoid_: vault proof, ownership check, claim credential

**Claim Offer**:
The interface through which a User establishes Vault Claim Evidence for an Unclaimed Local Vault. It does not lead with unlock, because unlocking is not the claim: it is offered whether or not a Vault is present, so that it discloses nothing about what this device holds, and a credential matching nothing is indistinguishable from a device holding nothing. Where the User already holds a Local Vault, the offer also carries the acknowledgement and the export that make replacing one survivable.
_Avoid_: claim prompt, vault chooser, ownership dialog, migration prompt

**Vault Meta**:
What a Vault needs to be opened rather than read: the key-derivation parameters and the Master Key as wrapped by the passphrase and by the recovery key. It travels with the Vault but is not part of its contents, and it changes for reasons the contents never see — changing a passphrase rewraps the same Master Key, leaving every Vault Blob readable exactly as before. Two Vault Metas differing therefore says nothing about whether their Vault Blobs can be merged.
_Avoid_: vault header, key material, vault config, vault settings

**Vault Blob**:
The unit of Ciphertext the server stores and the client synchronises: one per Vault Blob Type per User, holding every record of that type together. It is the whole of `tasks`, not one Task. Two devices editing different records of the same type are still editing the same Vault Blob, which is why convergence cannot be decided by the Vault Blob alone.
_Avoid_: vault record, encrypted blob, blob (unqualified), vault entry

**Vault Push**:
Sending one changed Vault Blob to the server. Distinct from Vault Reconcile: a push is the ordinary consequence of a single edit, carries no comparison, and asks the User nothing. Reconcile compares two whole Vaults on sign-in and is the backstop for what push did not carry.
_Avoid_: vault sync (unqualified), upload, save to server, backup

**Vault Pull**:
Taking one Vault Blob from the server and converging it with the Local Vault. The complement of Vault Push, and never a replacement: an arriving Vault Blob is merged against what the device already holds, so a pull cannot discard a local edit the server has not seen.
_Avoid_: fetch, download, refresh, sync down

**Deletion Log**:
The record a Vault Blob keeps of which of its records were deleted, and when. It exists because absence cannot be merged: a device that has not yet seen a deletion holds the record and would otherwise reintroduce it on the next merge. A deletion beats a record that was last changed before it. Entries are kept, not expired — an entry that is dropped while some device is still behind resurrects the record it was there to bury.
_Avoid_: tombstone log, graveyard, trash, deleted items

**Sync Bookmark**:
What one device records, per User and per Vault Blob Type, about the Ciphertext it and the server last agreed on: which Ciphertext that was, and the identity the server gave it. A successful Vault Push sets it; so does taking the server's copy, since both leave the device holding exactly what the server holds. A Vault Blob has unpushed changes when it no longer matches its Sync Bookmark — the state is derived from the Vault rather than flagged alongside it, so no edit can be stranded by a flag nobody set. The recorded identity is also what makes the next push conditional, so a device cannot overwrite Ciphertext it has never seen.
_Avoid_: dirty flag, sync state, pending queue, last-synced marker

**Vault Converge**:
Deciding what one Vault Blob Type's Ciphertext and the server's copy of it should become, and carrying that out: sending, taking, merging, asking, or doing nothing. Vault Push, Vault Pull and Vault Reconcile are three entries into the one convergence, not three convergences — a decision made in more than one place is a decision that disagrees with itself, which is how a keep-server reconcile destroyed grocery Ciphertext. How a given Vault Blob Type converges is pinned per type, and whether two sides may be merged at all is answered by decrypting the server's copy, never by comparing Vault Meta.
_Avoid_: sync, resolve, merge (as the name of the whole act), two-way sync

**Vault Meta Converge**:
Deciding whether this device starts using a wrapping set on another device, and carrying that out. Separate from Vault Converge and never an input to it: a Vault Meta that diverges leaves every Vault Blob exactly as mergeable as it was. It is the one convergence that cannot check its own answer — a wrapping cannot be verified without the passphrase it was derived from — so it never replaces a local wrapping without the User saying so, and adopting one is returned for the caller to save rather than written where it was decided.
_Avoid_: meta sync, key sync, passphrase sync, vault meta reconcile

**Vault Meta Change**:
Which wrapping in a Vault Meta moved — the passphrase or the recovery key — and the thing a User is actually asked about when Vault Meta diverges. It is named rather than reduced to a boolean because "your vault differs" is not something a User can act on, while "your passphrase was changed on another device" is, and because a User whose passphrase changed elsewhere without their doing needs to hear which one to stop using.
_Avoid_: meta conflict, key conflict, vault divergence, credential change

**Vault Reconcile**:
The sign-in pass that converges every Vault Blob Type of one User's Local Vault against that User's server Ciphertext. It is not a migration and has no one-time character: a User with no server Vault yet is having an ordinary first sync, and a User with no Vault on either side has nothing to reconcile. It carries no convergence of its own — each type goes through Vault Converge, so a Vault Blob Type cannot be reconciled on terms the rest of the product does not use. Non-conflicting divergence therefore converges without asking anything, and what asks is what the pinned strategy says asks. One question is still whole-Vault, because it was never per-record: the server's Ciphertext will not decrypt under this device's Master Key, so the two sides are not the same Vault at all. It decides Ciphertext only: no answer given here adopts a wrapping or reverts a passphrase change made elsewhere, and a Vault Meta is never an input to what it decides. It writes one, and only where there is none to overwrite — a server holding no Vault Meta at all is having a first sync.
_Avoid_: vault migration, phase-1 migration, vault upgrade, sync migration

**Master Key**:
The symmetric key derived from the passphrase (PBKDF2 → AES-GCM) that decrypts vault Ciphertext. Never sent to the server.
_Avoid_: vault key, encryption key, secret key

**Vault Handle**:
The object a caller holds to reach a Vault, bound at construction to one owner and one Master Key. Vault access is obtained, not invoked: there is no unbound vault function to call, so a Vault cannot be resolved without saying whose it is ([ADR 0047](docs/adr/0047-vault-access-is-obtained-through-an-owner-bound-handle.md)). Page libraries receive a handle and never learn who the User is.
_Avoid_: vault client, vault service, vault accessor, vault context

**Vault Sync Sink**:
Where a Vault Handle reports that one Vault Blob Type changed. It belongs to the handle rather than to whoever writes through it: the handle is the only way to reach a Local Vault, so a sink held there cannot be gone around, and no write can forget to synchronise. It is told a Vault Blob Type and never Ciphertext, and nothing it does can fail the save that told it — the Local Vault is already written by then, and an edit reported as failed is a lie the User retypes.
_Avoid_: save listener, push callback, change observer, write hook

**Local Vault Revision**:
What a Vault Handle reports when the whole Local Vault has been replaced under whoever is reading it — convergence taking the server's Ciphertext, an import, a removal. It is the inbound counterpart to the Vault Sync Sink and deliberately not the same thing: the sink is told that one Vault Blob Type changed here so it can be sent, while this says that what a reader already holds is no longer what is stored. Feeding one from the other would be a loop, since convergence writes through the path the sink must not hear. It carries a number and never a Vault Blob Type or Ciphertext, so a reader re-reads what it already knows how to read rather than being told what changed. An edit made on this device does not move it — only a replacement does.
_Avoid_: vault version, change event, invalidation signal, refresh token

**Vault Sync Queue**:
The Vault Blob Types a device has still to converge, held by a Vault Sync Sink. It is a wake-up list rather than the state it wakes for: whether a Vault Blob is unsent is derived from its Sync Bookmark, so a lost queue costs a delay and never an edit. It holds types and never Ciphertext, which is what makes ten saves to one type mark it once while the drain still carries the final state. Not a push queue — a drain converges, so it may equally take the server's copy or merge.
_Avoid_: outbox, dirty queue, pending changes, write buffer, debounce buffer

## Planning & Orchestration

**PRD Issue**:
A GitHub issue containing the full Product Requirements Document for a feature. Created by `to-prd`. Serves as the parent to all Slice Issues for that feature. Never closed or modified by agents.
_Avoid_: Epic, parent ticket, feature issue

**Slice Issue**:
A thin vertical-slice GitHub issue created by `to-issues`. References its PRD Issue as parent. Tagged `type:afk` or `type:hitl` and a `complexity:*` label. Each slice is independently demoable end-to-end.
_Avoid_: Sub-issue, task, child ticket

**AFK Slice**:
A Slice Issue the autonomous agent can implement and merge without human interaction. Picked up by `dispatch-agents`.
_Avoid_: Autonomous issue, agent task

**HITL Slice**:
A Slice Issue requiring a human decision before an agent can proceed. Skipped by `dispatch-agents` until a human unblocks it.
_Avoid_: Blocked issue, human task

**dispatch-agents**:
The `yarn dispatch-agents --prd <issue-number>` command that triggers the sandcastle orchestrator. Reads AFK Slice Issues labelled `ready-for-agent`, creates the feature branch **locally (never pushed)**, and runs one sandcastle agent per slice — one at a time, in Docker isolation — fast-forwarding each finished slice into the local feature branch and closing the slice issue. Integration is local: you push the feature branch and open one PR to `main` by hand.
_Avoid_: Agent runner, orchestrator command, run-agents

**Interrupted Slice**:
An AFK Slice whose agent run ended without a completion signal — quota exhaustion, timeout, or crash — leaving unfinished work on its slice branch. Resumed by the next `dispatch-agents`, never silently discarded.
_Avoid_: Failed slice, crashed slice, partial slice

**Slice Checkpoint**:
The commit capturing an Interrupted Slice's uncommitted work on its slice branch. Unreviewed and ungated — a resuming agent audits it before building on it, and never treats it as finished work.
_Avoid_: WIP commit (as the general name), draft commit, savepoint

**QA Plan**:
The manual verification a human performs for completed work before its Pull Request merges, carrying only what the automated suites do not already prove. Every claim it makes about existing coverage is marked as observed or reconstructed, because a reader trusts it to say what may be skipped. It is composed as an uncommitted working file in `tmp/`, whatever becomes of it afterwards.
_Avoid_: Test plan, test matrix, QA cycle, verification checklist, regression plan

**QA Plan Issue**:
A QA Plan for a PRD Issue, published as a GitHub issue labelled `qa`. Scenarios are checkboxes, closing it is the sign-off, and defects it finds become their own linked issues. A QA Plan for a single issue is not one of these — it stays the uncommitted working file it was composed as.
_Avoid_: QA ticket, test ticket, validation issue

**Issue Orchestration Label**:
A GitHub label in the `orchestration` set of `tools/config/github-labels.json` that coordinates planning tools and dispatch-agents. Applies to Issues only — never to Pull Requests. Includes the ADR 0002 machine contract plus the document-type markers `prd`, `qa`, and `grilling`.
_Avoid_: agent label, workflow label, status label (as the general name)

**Surface Label**:
A GitHub label that names a change's kind (`bug`, `enhancement`, `documentation`, …) or area (`backend`, `web-app`, …). Distinct from Issue Orchestration Labels. Issues may wear both; Pull Requests wear Surface Labels only.
_Avoid_: PR label (as a second vocabulary), topic tag, category

**Gated Pipeline**:
A specialist chain that retries between agents until a reviewer or runner verdict passes, with a cap. Components and Jest use this shape. Hitting the cap is a stop, not another silent retry.
_Avoid_: review loop, QA cycle, writer-reviewer loop

**Gate Coverage**:
The set of projects a gate actually reaches, which is not the set its command appears to name. A project can sit inside a gate's invocation and outside its reach: `nx affected -t lint` selects only projects declaring a target named `lint`, so a project whose ESLint target carries another name passes by being invisible. Asserted by a check; never inferred from a green run.
_Avoid_: test coverage, CI coverage, gate scope

**Assertion Gate**:
A gate that compares two artifacts and fails on a factual mismatch, naming the fact that is wrong. It never fails on the shape of a diff, and editing a file never satisfies it. Every gate in this repo is one (ADR 0043); "surface X changed, therefore doc Y must change" is the shape deliberately not built here.
_Avoid_: drift gate, doc gate, coupling check

**Wired Gate**:
A gate some pipeline actually invokes. A checker that exists, passes, and is referenced by neither Husky nor a workflow asserts nothing — a distinct failure from Gate Coverage, which is about a wired gate's reach across projects. Matched by exact script name, including through an aggregate runner that is itself wired.
_Avoid_: enabled gate, active check, gate coverage (for this sense)

**Meta-Gate**:
The gate whose asserted artifacts are the other gates: `gates:coverage:check` compares the checkers on disk against the ones hooks and workflows invoke, and fails naming each checker that is not a Wired Gate. An ordinary Assertion Gate in shape — its subject is simply the gate set rather than a document. A checker it must not fail is not silently skipped; it carries an entry with a written reason in `tools/config/gate-coverage-optout.json`.
_Avoid_: gate-of-gates, master gate, gate linter

**Enum Fan-Out**:
A place in code that covers every member of a domain enum by hand — an object literal keyed by the members, an if-chain over them, a union of their values. Distinct from the parallel-work sense the word carries elsewhere: an Independent Hop is never called this. A fan-out is judged per scope, not per file, because one module routinely iterates the Pinned Table in one function and hand-enumerates in the next.
_Avoid_: exhaustive switch, member sweep, enum iteration

**Pinned Table**:
The single `as const satisfies Record<EnumType, …>` declaration a Guarded Enum's fan-outs iterate instead of re-enumerating. The `satisfies` clause is the guard: a new member fails to compile until it has a home there, and every branch reading the table gets the member without being edited. Where several hand-maintained lists describe the same set, the table satisfies all of them, so none can be extended alone (ADR 0053).
_Avoid_: lookup map, const map, enum registry

**Guarded Enum**:
A domain enum whose omissions are expensive enough to be gated — for `VaultBlobType`, an omitted member destroys User-owned ciphertext with no error and no recovery. Being an enum does not qualify one; the cost of the omission does. A module that _declares_ the member names rather than consuming them is exempt by written reason, and is tied back through the Pinned Table's own `satisfies` clause.
_Avoid_: checked enum, critical enum, protected type

**One-shot Specialist**:
A sub-agent that performs one assigned job, returns a report of what it did, and stops. The orchestrator does not send the work back for another round.
_Avoid_: writer-reviewer loop, retry cycle, gated hop (when you mean this shape)

**Standing Specialist**:
A Sub-agent declared `user-invocable`, entered directly by a human or the main agent rather than as a hop in a Skill's chain. Belonging to no pipeline is a shape, not a defect.
_Avoid_: orphan agent, unused agent, unreferenced sub-agent, ad-hoc agent

**Orchestrator Patch**:
The main agent's local fix to an obvious miss in a One-shot Specialist's output — an annotation, a field, an import, or a command the report claimed but skipped. Not a re-delegation. If the specialist missed the assignment, the orchestrator stops and surfaces it; it does not open a loop.
_Avoid_: retry, reviewer fix, send-back

**Pipeline Incident**:
A durable note that a specialist or gate wasted a cycle, repeated the same FAIL, or missed something a sibling already solved. Written so the specialist can be improved. Not a retry and not an Orchestrator Patch.
_Avoid_: quality flag, agent bug report, suspicious behavior, loop smell

**API Contract**:
The public HTTP surface for one capability: what a client may send, what it receives, and the meaning of success and failure.
_Avoid_: backend API, endpoint (as the unit of work), REST resource

**Independent Hop**:
A specialist job that does not need another specialist's output. Only Independent Hops may run in parallel. The orchestrator judges this; specialists do not schedule themselves.
_Avoid_: fan-out, parallel pipeline, concurrent by default

**Upstream Brief**:
A dated, cited report of how this repo's instructions and usage compare to official upstream documentation for named languages, frameworks, or libraries. Records future-risk, mismatch, and missed improvement only. Its proposed plan may change instructions and hygiene scripts; application-code findings are follow-on, not part of that plan. Never a package upgrade plan.
_Avoid_: research base, research note, upgrade plan, dependency audit

## Release & Deploy

**Staging**:
The QA deployment target. Its backend is a distinct app root with its own database. Staging is never a second name for Production.
_Avoid_: test production, preview, staging as the live Namecheap host

**Production**:
The live deployment target Users use. Its backend is a distinct app root with its own database, not Staging's.
_Avoid_: live, prod (as the glossary name), staging (when you mean this)

**Release**:
A version of MyOrganizer that is live in Production, identified by a `vX.Y.Z` tag. Not the act of preparing one, and not the GitHub Release page that documents it.
_Avoid_: version, deployment, ship, build

**Cut**:
Creating the Release Branch with its version bump and CHANGELOG entry. Produces a candidate; a Cut that never deploys never becomes a Release.
_Avoid_: release (as a verb), branch off, prepare, bump

**Release Branch**:
`release/vX.Y.Z` — the only ref the `production` GitHub Environment accepts. Its existence lets a deploy be proposed, never lets one proceed.
_Avoid_: version branch, deploy branch, hotfix branch

**Deploy Approval**:
The required-reviewer sign-off on the `production` GitHub Environment. This is the ship decision, and it is distinct from dispatching a deploy run, which automation may do freely. It authorises Production Host Apply; it is not Host Apply itself.
_Avoid_: deploy trigger, manual deploy, production run, workflow dispatch

**Host Apply**:
The on-host work that turns an uploaded backend bundle into that environment's running process. Distinct from the upload that only lands files, and from Deploy Approval, which only authorises this work for Production.
_Avoid_: post-deploy sequence, go-live, activate, restart (as the whole thing)

**Tag**:
An annotated `vX.Y.Z` tag applied after Production Host Apply has succeeded. A receipt that a version shipped — never a trigger that ships it.
_Avoid_: release tag (when you mean a trigger), version marker

## Documentation

**Agent Guide**:
Nested agent instructions colocated with the project they constrain. Under `apps/`, the only instruction document besides an Operational README. Under `libs/`, the only instruction document besides at most one Library README per Nx library.
_Avoid_: project README (when you mean agent rules), local instructions, CLAUDE.md as a second copy of the same rules

**Operational README**:
A human-facing runbook for a deployable app, living next to that app because people run it from there. At most one per app. Not a feature write-up, design note, or ticket close-out.
_Avoid_: feature README, page README, colocated design doc, implementation summary, component breakdown, Library README

**Library README**:
A human-facing package readme for an Nx library: what the package is, how to consume it, and what not to hand-edit. At most one per library. Not a feature write-up, page README, or Agent Guide.
_Avoid_: feature README, page README, Operational README (when you mean a library), Nx scaffold README

**Research Brief**:
A dated, cited investigation in `docs/research/`, frozen at the date in its filename. Records what was true and sourced on that date; never revised afterward. If it must stay current it is not a Research Brief.
_Avoid_: research doc, investigation, internal note, planning doc

## Harness & Instructions

**Harness**:
A coding-agent product that loads this repo's instructions (Cursor, Claude Code, Gemini CLI, GitHub Copilot).
_Avoid_: IDE, vendor, tool (when you mean the product)

**Instruction File**:
Always-on policy markdown a Harness injects into the session. Repo-wide policy has one human-edited Instruction File; other roots are Harness Adapters. Distinct from a Skill, which loads only when the task matches. May include chooser lines (which Skill to load when requests collide); must not restate a Skill's procedure.
_Avoid_: memory file, system prompt, copilot instructions (as the general name)

**Skill**:
An on-demand workflow a Harness loads when the task matches. The repo has one Skill tree; Harnesses discover it natively or via a Harness Adapter and must not copy the body.
_Avoid_: command, rule, workflow file (when you mean the Skill)

**Upstream-Owned Skill**:
A Skill under `.agents/skills/` whose body is authored upstream and refreshed by the Skills CLI, listed in `skills-lock.json`. It is never hand-edited, and tooling must not read it as this repo's routing configuration. Its complement is a repo-native Skill.
_Avoid_: vendored, external, third-party, installed skill

**Harness Adapter**:
A Harness-specific discovery file that exists so that Harness finds an Instruction File or Skill, and that must not restate policy. Distinct from a Platform Adapter.
_Avoid_: Adapter (unqualified), copy, wrapper, sync target

**Sub-agent**:
A named specialist with its own instruction body and model pin, invoked by the main agent for a bounded job. Humans edit one canonical body; each Harness receives a generated Harness Adapter because model pins and tool names are not portable.
_Avoid_: agent (unqualified), custom agent (when you mean the role)

## Agent Roles

**ComponentBuilder**:
The sub-agent responsible for creating or editing a React component from a Structured Spec, following `docs/ui/GUIDELINES.md`.
_Avoid_: Frontend agent, UI agent, component writer

**ComponentReviewer**:
The sub-agent that gates a component produced by ComponentBuilder. Runs `check-component-hygiene.mjs`, `tsc`, and `eslint`, then judges composition, scope placement, concern mixing, the client boundary, Radix usage, and accessibility. `tsc` over the owning project serves as the importer check. Always runs after ComponentBuilder. Produces a report only — no code edits.
_Avoid_: Code reviewer, linter agent, review agent

**DepSync**:
The sub-agent and skill responsible for keeping `TECH_STACK.md` and the fixed set of authoritative files current when dependencies are installed, updated, or removed.
_Avoid_: Dependency agent, package sync, doc updater

**ApiWriter**:
The One-shot Specialist that implements an API Contract from a brief. Returns a report and stops. Not a Gated Pipeline.
_Avoid_: BackendBuilder, API agent, ContractBuilder, backend writer

**PrismaWriter**:
The One-shot Specialist that changes persistence: Prisma schema, generated client types, and the migration produced from that schema. Returns a report and stops. Not folded into ApiWriter.
_Avoid_: schema agent, migration agent, database writer
