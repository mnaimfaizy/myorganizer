# Graphify Evaluation — Independent Test Notes

**Date**: 2026-06-19  
**Tool version**: graphify 0.8.42  
**Graph commit**: f960e96a (HEAD — fresh)  
**Graph stats**: 2072 nodes · 4083 edges · 177 communities (99% EXTRACTED, 1% INFERRED)  
**Evaluator**: Claude Sonnet 4.6 (independent run — prior notes read AFTER verdict)

---

## Setup Verification

| Step                  | Result                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tool installed        | `graphify 0.8.42` via `uv tool install graphifyy --with mcp`                                                                                                        |
| Graph freshness       | Built from `f960e96a` = HEAD ✓                                                                                                                                      |
| Multigraph diagnostic | 0 edge collapse, 0 dangling endpoints, 58 suppression sites (normal dedup) ✓                                                                                        |
| `.graphifyignore`     | node_modules, build outputs, configs, Android/iOS trees, OpenAPI specs. README/AGENTS.md NOT excluded (minor noise leak). `libs/app-api-client` intentionally kept. |
| MCP server config     | `.mcp.json` → `graphify-mcp graphify-out/graph.json`                                                                                                                |
| LLM API keys          | None set in env. `--backend claude-cli` used for extraction.                                                                                                        |

---

## Bar 1 — Vault Data-Flow Accuracy + Safety

### Ground Truth (grep + reads)

The vault has three layers:

1. **Client encryption** (`web-vault/src/lib/vault/vault.ts`):
   - `saveEncryptedData()` at L252: calls `importAesGcmKey(masterKeyBytes)` → `encryptJsonWithMasterKey()` → `aesGcmEncrypt()` → stores `EncryptedBlob {iv, ciphertext}` to localStorage via `saveVault()`
   - `masterKeyBytes` is derived from passphrase via PBKDF2 (`crypto.ts:44`), lives only in memory, never transmitted.

2. **Client→server sync** (`web-vault/src/lib/vault/serverVaultSync.ts`):
   - `putServerVaultBlobEtagAware()` at L181: takes `EncryptedBlobV1 {iv, ciphertext, alg}`, calls `api.putVaultBlob()` — only the opaque blob reaches the wire.

3. **Server** (`apps/backend/src/controllers/VaultController.ts`):
   - `.putVaultBlob()` accepts `EncryptedBlobV1` via VaultService. No decryption occurs. Server stores and retrieves opaque blobs only.

**Security property**: Server never sees plaintext or masterKeyBytes. This is provably true from the code.

### Graphify Commands + Outputs

```
shortest_path("saveEncryptedData", "VaultController")
→ No path found

shortest_path("deriveKeyFromPassphrase", "putVaultBlob")
→ No path found

get_node("Ciphertext")
→ No node matching 'ciphertext' found.

query_graph("EncryptedBlobV1 ciphertext server vault plaintext", depth=3)
→ 75 nodes: serverVaultSync.ts, vaultExportImport.ts, vaultShapes.ts,
  EncryptedBlobV1 [app-api-client/src/api.ts L144],
  EncryptedBlobV1 [backend/src/services/VaultService.ts L21],
  putServerVaultBlobEtagAware(), normalizeEncryptedBlobV1(), etc.
```

### Analysis

- **Path queries fail entirely**: There is no graph path from `saveEncryptedData` to `VaultController` because the HTTP call boundary is invisible to AST extraction. A path-based security assertion is impossible.
- **Domain vocabulary absent**: "Ciphertext" (the preferred domain term per CONTEXT.md) does not exist as a node. The graph uses code identifiers: `EncryptedBlob`, `EncryptedBlobV1`.
- **Nodes ARE present**: `query_graph` surfaces both the client-side `EncryptedBlobV1` (api-client) and server-side `EncryptedBlobV1` (VaultService), plus all sync functions. An agent with domain knowledge can INFER the security property from these nodes, but cannot PROVE it via a single traversal.
- **Community labels are accurate**: "Encrypted Vault Storage Crypto", "Server Vault Sync", "Vault REST Controller" correctly segment the three layers.

### Verdict: **PARTIAL**

The relevant nodes exist and their community placement is correct. But Graphify cannot trace a data-flow path across the HTTP boundary (fundamental AST limitation), cannot speak domain vocabulary ("Ciphertext", "Master Key"), and therefore cannot independently assert the security invariant. An agent using Graphify for vault safety analysis would need to combine it with manual reads.

---

## Bar 2 — PR/Slice Triage vs `nx affected`

### Ground Truth (nx)

Three realistic file changes:

| File                                              | nx affected projects                                                                                                                                                                                                                                          | Count |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `libs/design-tokens/src/index.ts`                 | design-tokens, web-pages-home, myorganizer, myorganizer-e2e, mobile-ui, mobile-screens, mobile                                                                                                                                                                | 7     |
| `apps/backend/src/controllers/VaultController.ts` | backend                                                                                                                                                                                                                                                       | 1     |
| `libs/web-vault/src/lib/vault/vault.ts`           | web-vault, web-pages-mobile-numbers, myorganizer, myorganizer-e2e, web-pages-vault-settings, web-pages-account, web-pages-subscriptions, web-pages-vault-export, web-pages-addresses, web-pages-dashboard, web-pages-groceries, web-pages-tasks, web-vault-ui | 13    |

### Graphify Commands + Outputs

**File 1: design-tokens/src/index.ts**

```
get_node("design-tokens")
→ No node matching 'design-tokens' found.

query_graph("design tokens CSS variables token values imported NativeWind tailwind colors spacing")
→ 3 nodes: tailwind-preset.native.js, tailwind-preset.js, TokenStorageMode (from auth.ts — WRONG)
```

Graphify finds the two generated JS preset files inside the package but NOT the two external consumers:

- `libs/mobile/ui/src/theme.ts` (imports via `@myorganizer/design-tokens`) — **MISSED**
- `libs/web/pages/home/src/components/LandingContent.tsx` (imports via `@myorganizer/design-tokens`) — **MISSED**

The root cause: design-tokens is consumed via the TypeScript path alias `@myorganizer/design-tokens`, not a relative import. Graphify's AST extractor resolves relative imports but NOT monorepo path aliases in this configuration.

**File 2: VaultController.ts**

```
get_neighbors("VaultController")
→ Methods (.putVaultBlob, .getVaultMeta, etc.) + routes.ts import
→ No cross-package links
```

Consistent with nx: only `backend` is affected. ✓

**File 3: vault.ts**

```
get_neighbors("vault.ts")
→ 18 internal function nodes (contains),
  5 internal imports (vaultExportImport, vaultMigration, etc.)
  + index.ts [re_exports]

get_neighbors("saveEncryptedData()")
→ 15 downstream consumers across addresses, mobile-numbers, subscriptions, tasks, groceries
```

At the FUNCTION level, Graphify correctly identifies the 15 downstream page-client callers of `saveEncryptedData()` (ground truth grep: 22 call-site lines across those same files ✓). But at the FILE level, `get_neighbors("vault.ts")` only returns the internal vault module files — the cross-package consumers are only reachable via the exported function nodes.

### Analysis

- **Alias import gap is critical**: The most compelling use case for triage (thin-but-widely-depended-on barrels like design-tokens) completely fails. Any library consumed via `@myorganizer/*` aliases is invisible to Graphify's impact analysis.
- **Graphify's impact is at function granularity, not project granularity**: For hub files like vault.ts, you need to query the exported symbols (e.g., `saveEncryptedData`) rather than the file node itself. This is richer than nx (you see WHICH functions are consumed) but less reliable (you might miss alias consumers).
- **Leaf-node impact (VaultController) is correct and useful**: Graphify correctly shows VaultController is backend-only with no cross-package links.

### Verdict: **PARTIAL**

Correct for server-side leaf nodes. Provides RICHER (function-level) impact data for vault.ts hub. **Fails completely** for alias-resolved barrel imports (design-tokens), which is exactly the class of file where triage is most valuable. Cannot replace `nx affected` for cross-package blast radius.

---

## Bar 3 — Noise / Navigability

### Community Quality Assessment

Total: 177 communities (136 shown, 41 thin omitted)

**Noisy communities** (docs/config that leaked past `.graphifyignore`):

- "Library Agent Guides" — AGENTS.md files
- "Core Library Docs" — README/doc files
- "Account & Subscriptions READMEs" — README files
- "App Documentation Guides" — docs
- "Dashboard Page Guide" — docs
- "Addresses Page README" — docs
- "Dashboard Page README" — docs
- "Home Page README" — docs
- "Mobile Numbers Page README" — docs
- "Vault Export Page README" — docs
- "Git Push Script" — shell script, entirely non-domain
- "Storybook Preview Config" — config file

**Count**: ~12 noisy communities / 136 shown = **~9% noise**

Root cause: `.graphifyignore` excludes `*.config.*` but not `*.md` and shell scripts. README files, AGENTS.md, and shell scripts were indexed.

**Signal communities** (correctly labeled real domains):

- "Vault REST Controller", "Vault Session Provider", "Vault Migration & HTTP Status", "Encrypted Vault Storage Crypto", "Server Vault Sync" — correctly segments the vault subsystem
- "Subscriptions Pages", "Task Form Components", "Groceries Vault Hook & Detail" — correct feature domains
- "Authentication API Client", "Auth API Client & Tokens", "Token Generation & Auth" — correctly clusters auth

**God Nodes assessment** (top 10):

1. Button (43), cn() (42), useToast() (35), Card/CardTitle/CardContent (27) — UI noise
2. `loadDecryptedData()` (27 edges) — DOMAIN SIGNAL ✓ vault read path is a core abstraction
3. `saveEncryptedData()` (20 edges) — DOMAIN SIGNAL ✓ vault write path
4. `getApiBaseUrl()` (17), `randomId()` (17) — utility signal

The vault operations appearing at #7/#10 correctly identifies them as central to the codebase. A newcomer would immediately know these 20-edge functions are high-risk change points.

**Surprising Connections** section: Found real cross-file coupling:

- `GroceryItem → EditItemDialogProps` (core constants referencing a page component type) — genuine unexpected dependency worth knowing about.

### Verdict: **PASS**

~91% of shown communities are genuine domain areas with accurate labels. The God Nodes correctly surface the vault read/write functions as the most-connected domain abstractions. The GRAPH_REPORT.md is navigable — a newcomer could scan the community list in 5 minutes and understand the feature domains. ~9% documentation noise is manageable and fixable by adding `*.md` to `.graphifyignore`.

---

## Bar 4 — Onboarding / Domain Language

### CONTEXT.md Domain Terms vs. Graph Presence

| CONTEXT.md term   | In graph?   | Graph representation                                                     |
| ----------------- | ----------- | ------------------------------------------------------------------------ |
| Vault             | YES         | Community names: "Vault REST Controller", "Vault Session Provider", etc. |
| Ciphertext        | **NO NODE** | Uses code identifier `EncryptedBlob`/`EncryptedBlobV1`                   |
| Task              | YES         | "Task Form Components", "Task Item & List"                               |
| Subscription      | YES         | "Subscriptions Pages", "Subscription Manager"                            |
| Master Key        | **NO**      | Only appears as `masterKeyBytes`, `masterKey` identifiers                |
| Vault Unlock      | **NO**      | Function `unlockVaultWithPassphrase()` exists but concept not labeled    |
| Platform Adapter  | **NO**      | Interface `VaultCrypto` exists but "Platform Adapter" concept absent     |
| UI Primitive      | PARTIAL     | "UI Component Primitives" community ✓                                    |
| Feature Component | **NO**      | Not as a labeled concept                                                 |

**What the graph adds vs. DEVELOPMENT.md/CONTEXT.md:**

- GRAPH_REPORT.md gives: which files are most connected (God Nodes), which code units cluster together, surprising cross-file dependencies
- DEVELOPMENT.md gives: setup, workflow, how to run things
- CONTEXT.md gives: domain vocabulary, preferred terms, business concepts

These are complementary. GRAPH_REPORT.md is a **code navigation map**, not a domain dictionary. A newcomer benefits from both, not one instead of the other.

**Quantitative**: The labeling pass used Claude to name communities from code content. This produced accurate code-level labels ("Encrypted Vault Storage Crypto") but did NOT match CONTEXT.md vocabulary. The label "Vault" appears frequently but "Ciphertext", "Master Key", "Vault Unlock" never appear.

### Verdict: **PARTIAL**

The graph provides real onboarding value as a code navigation map — community segmentation is accurate, God Nodes highlight change-risk abstractions, Surprising Connections expose hidden couplings. However, it speaks code-identifier language, not domain language. It cannot substitute for CONTEXT.md and would not speed up understanding domain intent (only code structure). Value to a newcomer: medium, complementary to existing docs.

---

## Bar 5 — Agent Retrieval: Accuracy + Latency vs. Baseline

### Q1: "What directly consumes function `saveEncryptedData()`?" (neighborhood)

**Ground truth** (grep): 22 call-site lines across addresses/mobile-numbers/subscriptions/tasks/groceries page clients.

**Graphify** (`get_neighbors("saveEncryptedData()")`):

```
--> AddressDetailPageClient.tsx [imports] [EXTRACTED]
--> AddressDetailsInner() [calls] [EXTRACTED]
--> AddressesPageClient.tsx [imports] [EXTRACTED]
--> MobileNumberDetailPageClient.tsx [imports] [EXTRACTED]
--> MobileNumberDetailsInner() [calls] [EXTRACTED]
--> MobileNumbersPageClient.tsx [imports] [EXTRACTED]
--> SubscriptionDetailPageClient.tsx [imports] [EXTRACTED]
--> SubscriptionsPageClient.tsx [imports] [EXTRACTED]
--> SubscriptionsInner() [calls] [EXTRACTED]
--> TasksPageClient.tsx [imports] [EXTRACTED]
--> useGroceriesVault.ts [imports] [EXTRACTED]
--> AddLocationPageClient.tsx [imports] [EXTRACTED] (x2: addresses + mobile)
--> AddLocationInner() [calls] [EXTRACTED]
(+ internal callers: importAesGcmKey, vault.ts, loadVault, saveVault, encryptJsonWithMasterKey)
```

**Score**: PRECISION HIGH, RECALL HIGH. Graphify correctly identifies all downstream consumers and distinguishes imports vs. call edges. Missing: `vault-core/src/lib/interfaces.ts` interface definition (minor — it's the abstract declaration, not a caller).

**Latency**: MCP tool call ~instant (<0.3s). grep on same codebase: also instant. **PARITY**.

### Q2: "What is affected if backend `VaultController` changes?" (cross-package impact)

**Ground truth** (nx): Only `backend` project affected (1 project).

**Graphify** (`query_graph("VaultController", depth=3)`):

```
VaultController → routes.ts → RegisterRoutes()
All nodes stay within backend/src/. No cross-package edges.
```

**Score**: PASS — consistent with nx. Correctly bounded. No false positives.

**Latency**: MCP ~instant vs. nx: ~8-15s (project graph computation). **GRAPHIFY WINS on latency for leaf-node queries.**

### Q3: "What is affected if `EncryptedBlob`/`EncryptedBlobV1` schema changes?" (type blast radius)

**Ground truth** (grep — excluding generated): serverVaultSync.ts, vaultExportImport.ts, serverVaultSync.test.ts, vaultShapes.ts, vaultMigration.ts. Plus backend VaultService.ts and VaultController.ts.

**Graphify** (`query_graph("EncryptedBlobV1 schema", depth=3)`, 75 nodes):
Correctly found: serverVaultSync.ts, vaultExportImport.ts, vaultShapes.ts, vaultMigration.ts, ImportVaultCard.tsx, ExportVaultCard.tsx, serverVaultSync.test.ts, backend EncryptedBlobV1 node.

But: `get_node("EncryptedBlobV1")` returned the BACKEND definition (Degree: 3) and `get_neighbors` then showed only 3 backend-side nodes — missing the entire client-side usage. `query_graph` was required to get the full picture.

**Score**: PARTIAL — `query_graph` gives 75-node BFS result that's comprehensive but noisy. Point lookups via `get_node`/`get_neighbors` hit node collision (picked backend EncryptedBlobV1, not app-api-client one) and MISS all client-side consumers.

### Q4: "What consumes `@myorganizer/design-tokens`?" (dependency, cross-check with nx)

**Ground truth** (grep + nx):

- `libs/mobile/ui/src/theme.ts` — imports `from '@myorganizer/design-tokens'`
- `libs/web/pages/home/src/components/LandingContent.tsx` — imports `from '@myorganizer/design-tokens'`
- nx affected: 7 projects transitively

**Graphify**:

```
get_node("design-tokens")
→ No node matching 'design-tokens' found.

query_graph("design tokens CSS variables imported NativeWind", depth=2)
→ 3 nodes: tailwind-preset.native.js, tailwind-preset.js, TokenStorageMode (IRRELEVANT)
```

**COMPLETE MISS**: Both actual consumers (theme.ts, LandingContent.tsx) are absent. Graphify's AST extractor does not resolve `@myorganizer/*` TypeScript path aliases, so imports via the package alias are dropped.

**Score**: **FAIL** — returns 0 of 2 real consumers, includes 1 false positive (TokenStorageMode).

### Q5 (control): "Where is `deriveKeyFromPassphrase` defined?" (grep should win)

**Ground truth** (grep): 3 definitions:

1. `vault-core/src/lib/interfaces.ts:14` — abstract interface
2. `web-vault/src/lib/vault/crypto.ts:44` — web implementation
3. `mobile/feat/vault/src/crypto.ts:96` — mobile implementation

**Graphify**:

```
get_node("deriveKeyFromPassphrase()")
→ Node: .deriveKeyFromPassphrase()
   ID: libs::src_crypto_mobilevaultcrypto_derivekeyfrompassphrase
   Source: mobile/feat/vault/src/crypto.ts L96
   Community: Vault Session Provider
   Degree: 2
```

**WRONG IMPLEMENTATION returned**. The mobile implementation was found; the primary web vault implementation (`web-vault/src/lib/vault/crypto.ts:44`) was silently missed. The abstract interface (`vault-core/src/lib/interfaces.ts:14`) was also missed.

`get_neighbors` on this node returned only mobile-internal relationships (MobileVaultCrypto, deriveKeyFromPassphraseSync), missing the 3 call sites in vault.ts.

`query_graph` with expanded vocabulary DID correctly find the web vault node, but this requires a second query after the `get_node` failure.

**Score**: **FAIL for `get_node`, PARTIAL for `query_graph`**. grep wins unambiguously: one command, three correct definitions, no ambiguity.

### Bar 5 Summary

| Question                           | Type              | Ground Truth              | Graphify Result                         | Score       |
| ---------------------------------- | ----------------- | ------------------------- | --------------------------------------- | ----------- |
| saveEncryptedData() callers        | neighborhood      | 7 files, 22 call sites    | 13-15 neighbors, all correct            | **PASS**    |
| VaultController blast radius       | cross-package     | backend only (1 proj)     | backend only, consistent                | **PASS**    |
| EncryptedBlobV1 schema blast       | type blast radius | 7 files across 3 packages | 75-node BFS correct, point lookup wrong | **PARTIAL** |
| design-tokens consumers            | alias import      | 2 files, 7 nx projects    | 0 found, 1 false positive               | **FAIL**    |
| deriveKeyFromPassphrase definition | symbol lookup     | 3 definitions             | 1 wrong (mobile), 2 missed              | **FAIL**    |

---

## Scorecard

| Bar   | Description                        | Verdict     | Key Evidence                                                                                                        |
| ----- | ---------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------- |
| Bar 1 | Vault data-flow accuracy + safety  | **PARTIAL** | Correct nodes, can't trace HTTP boundary, no domain vocabulary ("Ciphertext" absent)                                |
| Bar 2 | PR/slice triage vs nx affected     | **PARTIAL** | VaultController correct; alias imports (design-tokens) completely invisible; hub files require symbol-level queries |
| Bar 3 | Noise / navigability               | **PASS**    | ~91% real domains, God Nodes correctly surface vault ops, GRAPH_REPORT navigable, ~9% docs noise fixable            |
| Bar 4 | Onboarding / domain language       | **PARTIAL** | Useful code map, missing domain vocabulary (Ciphertext, Master Key, Vault Unlock), complementary not substitute     |
| Bar 5 | Agent retrieval accuracy + latency | **PARTIAL** | 2/5 PASS, 1/5 PARTIAL, 2/5 FAIL; node collisions and alias imports are critical failure modes                       |

**Overall: 1 PASS · 4 PARTIAL · embedded FAILs in Bar 2 and Bar 5**

---

## Go / No-Go Recommendation

### **Conditional NO-GO for autonomous agent adoption in this repo**

Graphify is not ready to be trusted as an autonomous agent's primary code-exploration tool for this monorepo. The two critical failure modes each affect common, important use cases:

1. **Monorepo alias import blindness** (design-tokens, any `@myorganizer/*` import): impact analysis for cross-package dependencies is incorrect. An agent relying on Graphify's blast radius would under-estimate impact for the most widely-consumed shared libraries.

2. **Node collision on polymorphic symbols** (`deriveKeyFromPassphrase`, `EncryptedBlobV1`): `get_node` and `get_neighbors` return the wrong implementation when multiple nodes share a name. A fast wrong answer is worse than grep.

### Where Graphify genuinely wins (narrow use cases)

| Use case                                                                | Graphify advantage                                  |
| ----------------------------------------------------------------------- | --------------------------------------------------- |
| "What calls function X?" (concrete, non-aliased, single implementation) | Fast, correct, shows import+call granularity        |
| Community navigation (which files belong to which domain)               | Good community names, GRAPH_REPORT is scannable     |
| God Nodes for newcomer orientation                                      | Correctly highlights vault ops as core abstractions |
| Intra-package impact for backend leaf controllers                       | Consistent with nx, faster than nx                  |

### Where existing tools are better

| Task                          | Better tool       | Why                                                                       |
| ----------------------------- | ----------------- | ------------------------------------------------------------------------- |
| Cross-package blast radius    | `nx affected`     | Authoritative; resolves all tsconfig paths; Graphify misses alias imports |
| Symbol definition lookup      | `grep`            | No node collisions; finds all implementations; instant                    |
| HTTP/service boundary tracing | Manual code reads | Static AST cannot model HTTP calls (fundamental)                          |
| Domain vocabulary queries     | CONTEXT.md + grep | Graph doesn't know "Ciphertext", "Master Key"                             |

---

## Limitation Classification

### Fundamental (inherent to AST extraction, not fixable by config)

- **HTTP boundaries are invisible**: No static AST can trace a data-flow path that crosses an HTTP call. `saveEncryptedData → VaultController` will never have a graph path. Any claim about server-side security properties requires manual verification.
- **Dynamic imports / runtime dispatch**: Anything resolved at runtime is absent from the graph.

### Configurable (fixable by setup)

- **TypeScript path alias resolution** (HIGH IMPACT): `@myorganizer/*` aliases must be configured in graphify's tsconfig.json resolution. Without this, all inter-library imports via package aliases are dropped — which in an Nx monorepo means most cross-library edges. This is fixable by providing `tsconfig.base.json` paths to the extractor.
- **README/AGENTS.md noise** (LOW IMPACT): Add `*.md` and `*.sh` to `.graphifyignore` to remove ~12 documentation communities.
- **Node collision on shared names** (MEDIUM IMPACT): The `get_node` API needs disambiguation (e.g., filter by package/path). Currently picks an arbitrary match. This may be a product gap rather than a user-configurable issue.

---

## Prior Notes Comparison

_(Now read — see comparison below)_

### Comparison with Prior Evaluation (`graphify-eval-notes.md`)

The prior notes document three runs: a misconfigured Run 1, a corrected Run 2 (with `--backend claude-cli`, app-api-client included, proper query flow), and a final adoption step with the tuned `.graphifyignore`.

**Where we AGREE:**

| Finding                                                                  | Prior                     | Mine            | Match    |
| ------------------------------------------------------------------------ | ------------------------- | --------------- | -------- |
| "Ciphertext" absent from graph                                           | ✓ confirmed               | ✓ confirmed     | **Full** |
| HTTP boundary invisible, path queries fail                               | ✓ "fundamental AST limit" | ✓ "fundamental" | **Full** |
| saveEncryptedData neighborhood accurate and fast                         | 🟢 "STRONG"               | PASS            | **Full** |
| VaultController blast radius correct (backend-only)                      | 🟢 consistent             | PASS            | **Full** |
| Design-tokens impact wrong/missing                                       | wrong granularity         | FAIL            | **Full** |
| Doc labeling: no real domain concepts ("Ciphertext")                     | 🔴 3 swagger nodes        | ✗ absent        | **Full** |
| Node collision for duplicate-label symbols                               | "dup nodes"               | ✓ documented    | **Full** |
| Community labeling is accurate once config noise excluded                | 🟡 accurate               | PASS            | **Full** |
| Overall verdict: no-go for impact analysis, narrow win for neighborhoods | no-go                     | no-go           | **Full** |

**Where prior notes go deeper than mine:**

1. **`compute_pr_impact` root cause** (Bar 2): Prior inspected the actual source (`prs.py:243`) and found that "blast_radius" sums the changed file's own community membership — it does NOT reverse-traverse to dependents. This explains why thin barrels like design-tokens (7 downstream projects) score blast_radius=1 while they're actually the highest-risk change. I found the symptom (design-tokens invisible) but not the code-level cause. Their finding is stronger.

2. **Run 1 vs Run 2 comparison**: Prior documented that three config errors caused Run 1 to fail (wrong entry point, excluded app-api-client, wrong query method). My evaluation ran on the already-corrected final graph, so I'm testing the best version. Prior proved the failures reproduce even with correct config.

3. **TS type reference gap**: Prior explicitly found that TS type usages are not call/import edges, so `affected` cannot trace type-level blast radius. I found the same symptom (EncryptedBlobV1 point lookup wrong) but attributed it to node collision rather than the deeper AST model limitation (type annotations aren't AST edges).

**Where my notes add to prior:**

1. **Node collision mechanism documented**: I explicitly showed that `get_node("deriveKeyFromPassphrase()")` returns the mobile implementation (ID: `libs::src_crypto_mobilevaultcrypto_derivekeyfrompassphrase`), silently missing the web vault version and the abstract interface. This is a concrete, reproducible MCP-surface failure not in the prior notes.

2. **`get_neighbors` directional gap for `EncryptedBlobV1`**: `get_neighbors` on the resolved (backend) node returns only 3 neighbors, missing the entire client-side usage. `query_graph` at depth=3 is required. Prior noted the `affected` failure but didn't document the point-lookup/neighborhood mismatch specifically.

3. **`@myorganizer/*` alias imports as a distinct failure mode**: Prior attributed design-tokens failure to "wrong granularity." I identified the mechanism more precisely: path alias imports are dropped by the AST extractor, making ANY `@myorganizer/*` import boundary invisible. This affects ALL inter-library imports in this monorepo, not just design-tokens.

**Verdict comparison**: Both evaluations converge on the same go/no-go: **no-go for autonomous agent use, narrow win for in-package symbol neighborhoods**. The prior notes are more thorough (3 runs, source code inspection), mine independently replicate the core findings and add the node-collision and alias-import mechanisms as distinct documented failure modes.
