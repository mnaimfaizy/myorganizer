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
The authenticated account holder.
_Avoid_: Account, member, customer, person

**Organization**:
A group that allows multiple Users to share resources. Emerging — not fully implemented.
_Avoid_: Team, group, workspace

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
The sub-agent responsible for creating or editing a React component from a Structured Spec, following `docs/ui/GUIDELINES.md` and `TECH_STACK.md`.
_Avoid_: Frontend agent, UI agent, component writer

**ComponentReviewer**:
The sub-agent that reviews a component produced by ComponentBuilder for side-effects, performance, memory, and design issues, and scans direct importers for breakage. Always runs after ComponentBuilder. Produces a report only — no code edits.
_Avoid_: Code reviewer, linter agent, review agent

**DepSync**:
The sub-agent and skill responsible for keeping `TECH_STACK.md` and the fixed set of authoritative files current when dependencies are installed, updated, or removed.
_Avoid_: Dependency agent, package sync, doc updater
