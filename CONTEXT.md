# MyOrganizer

MyOrganizer is a personal organization app with end-to-end encrypted storage for sensitive user data. The server never stores or processes plaintext — all encryption and decryption happens on the client.

## Domain

**Vault**:
Client-side encrypted storage. The server stores only ciphertext; it never sees plaintext values.
_Avoid_: Encrypted storage, secure store, lockbox

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

**Shorts Daily Budget**:
The User’s configurable daily cap on time spent in the Shorts lane (default one hour), measured as wall-clock while a Short is active and the document is visible.
_Avoid_: Shorts quota, daily Shorts timer (as the product name), playtime limit

**Shorts Hard Stop**:
The locked state when the Shorts Daily Budget is exhausted for the User’s local calendar day: in-app Shorts playback and navigation are unavailable until local midnight or the User raises the limit enough to unlock.
_Avoid_: Soft lock, cooldown, Shorts ban, timeout

## Frontend Architecture

**UI Primitive**:
A reusable, stateless React component in `libs/web-ui/`. Built on Radix UI with Tailwind CSS and CVA variants. Has no knowledge of domain state, vault data, or route context.
_Avoid_: Shared component, base component, core component, common component

**Feature Component**:
A React component in `libs/web/pages/<route>/src/components/` that composes UI Primitives with domain logic and route-specific state. Never imported by other routes.
_Avoid_: Page component, route component, smart component

**Structured Spec**:
The handoff document the main agent passes to ComponentBuilder. Contains: component name, target path, scope (UI Primitive or Feature Component), props interface, state ownership, Zod schema if applicable, and relevant guideline references.
_Avoid_: Component brief, component plan, design spec

## Mobile

**Mobile App**:
The React Native client in `apps/mobile`, sharing domain logic with the web app through cross-platform libraries. Feature code lives under `libs/mobile/*`.
_Avoid_: native app, RN app, the app

**Platform Adapter**:
A thin implementation of a shared abstract interface (e.g. `VaultCrypto`, `VaultStorage`, token storage) that supplies platform-specific behavior to otherwise platform-agnostic code.
_Avoid_: shim, wrapper, provider

**Vault Unlock**:
The client-side action of deriving the Master Key from the User's passphrase so vault Ciphertext can be decrypted for the session. No plaintext or key leaves the device.
_Avoid_: vault login, decrypt vault, open vault

**Master Key**:
The symmetric key derived from the passphrase (PBKDF2 → AES-GCM) that decrypts vault Ciphertext. Never sent to the server.
_Avoid_: vault key, encryption key, secret key

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
