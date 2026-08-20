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
A thin implementation of a shared abstract interface (e.g. `VaultCrypto`, `VaultStorage`, token storage) that supplies platform-specific behavior to otherwise platform-agnostic code.
_Avoid_: shim, wrapper, provider

**Vault Unlock**:
The client-side action of deriving the Master Key from the User's passphrase so vault Ciphertext can be decrypted for the session. No plaintext or key leaves the device.
_Avoid_: vault login, decrypt vault, open vault

**Vault Claim**:
The act of a User proving a Local Vault is theirs by unlocking it — a successful Master Key unwrap is the proof, since a failed unwrap means the Vault belongs to someone else. Used to assign an owner to a Local Vault that has none. Claiming never moves a Vault between Users; it only records an ownership that already held.
_Avoid_: adopt vault, take over vault, assign vault, link vault

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

**Issue Orchestration Label**:
A GitHub label from the ADR 0002 vocabulary that coordinates planning tools and dispatch-agents. Applies to Issues only — never to Pull Requests.
_Avoid_: agent label, workflow label, status label (as the general name)

**Surface Label**:
A GitHub label that names a change's kind (`bug`, `enhancement`, `documentation`, …) or area (`backend`, `web-app`, …). Distinct from Issue Orchestration Labels. Issues may wear both; Pull Requests wear Surface Labels only.
_Avoid_: PR label (as a second vocabulary), topic tag, category

**Gated Pipeline**:
A specialist chain that retries between agents until a reviewer or runner verdict passes, with a cap. Components and Jest use this shape. Hitting the cap is a stop, not another silent retry.
_Avoid_: review loop, QA cycle, writer-reviewer loop

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

**Release**:
A version of MyOrganizer that is live in production, identified by a `vX.Y.Z` tag. Not the act of preparing one, and not the GitHub Release page that documents it.
_Avoid_: version, deployment, ship, build

**Cut**:
Creating the Release Branch with its version bump and CHANGELOG entry. Produces a candidate; a Cut that never deploys never becomes a Release.
_Avoid_: release (as a verb), branch off, prepare, bump

**Release Branch**:
`release/vX.Y.Z` — the only ref the `production` GitHub Environment accepts. Its existence lets a deploy be proposed, never lets one proceed.
_Avoid_: version branch, deploy branch, hotfix branch

**Deploy Approval**:
The required-reviewer sign-off on the `production` GitHub Environment. This is the ship decision, and it is distinct from dispatching a deploy run, which automation may do freely.
_Avoid_: deploy trigger, manual deploy, production run, workflow dispatch

**Tag**:
An annotated `vX.Y.Z` tag applied after production is confirmed live. A receipt that a version shipped — never a trigger that ships it.
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
