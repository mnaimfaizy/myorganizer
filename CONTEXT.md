# MyOrganizer

MyOrganizer is a personal organization app with end-to-end encrypted storage for sensitive user data. The server never stores or processes plaintext — all encryption and decryption happens on the client.

## Domain

**Vault**:
Client-side encrypted storage. The server stores only ciphertext; it never sees plaintext values.
_Avoid_: Encrypted storage, secure store, lockbox

**Ciphertext**:
The encrypted blob format produced by the Vault for all vault-backed data types.
_Avoid_: Encrypted data, encrypted blob

**Todo**:
A discrete task or reminder the user tracks.
_Avoid_: Task, item, reminder

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
