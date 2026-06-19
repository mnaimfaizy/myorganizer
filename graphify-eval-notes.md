# Graphify pilot — working notes (issue #158)

Branch: `research/graphify-eval-158`. Throwaway. Nothing here merges to main.

## Environment

- Installed `graphifyy` 0.8.42 via `uv tool install` (executables: `graphify`, `graphify-mcp`).
- No LLM API keys present in env (only `CLAUDE_CODE_*`) → hard zero-egress guarantee for Run 1; semantic + community-naming steps auto-skip, leaving a pure-AST graph.
- `.graphifyignore` excludes deps, build output, coverage, generated `app-api-client`, OpenAPI artifacts.

## Run 1 — code-only extraction

### BLOCKER: `graphify extract .` at repo root ingests node_modules

- `graphify extract .` scanned **44,175 code + 3,194 docs + 298 images** and FAILED after **~20 min** (1188s) demanding an LLM key for node_modules READMEs/assets.
- Git tracks only **930 files** (~490 code, 189 md, 12 png). node_modules = **187,810 files** on disk.
- `node_modules` is a hardcoded skip in graphify (`_SKIP_DIRS`, detect.py:654) AND in `.gitignore` AND my `.graphifyignore` — yet it was walked anyway. The root-level prune misfired on this Windows/Nx setup. **Real adoption friction.**

### Workaround that produced a usable graph: scoped, code-only, many `--exclude`

- Keyless guard trips on ANY doc/image (`DOC_EXTENSIONS = .md/.mdx/.qmd/.txt/.rst/.html/.yaml/.yml`, detect.py:30). Reaching a pure-code corpus took iterative discovery: md, html, toml, ico, yaml/yml, openapi artifacts, RN manifests (Gemfile/Podfile).
- `libs/` (scoped): **349 code → 1455 nodes / 3239 edges / 128 communities in 32.8s.** Fast, correct corpus, zero-egress (no key used).
- `apps/` (backend+web, mobile+e2e excluded): **104 code → 396 nodes / 662 edges / 52 communities in 7.9s.**
- merged: **1851 nodes / 3901 edges.**

### Findings against the bars (Run 1, in progress)

- ✅ AST extraction is genuinely local, fast, zero-egress. Crypto layer extracted well: `AesGcmKey`, `deriveKeyFromPassphrase`, `aesGcmEncrypt/Decrypt`, `EncryptedBlob`, `EncryptedBlobSchema`, `VaultCrypto`, `wrapMasterKeyWithKey`, `MobileVaultCrypto`.
- ⚠️ **Bar 1 — graph speaks code, not domain language.** No `Ciphertext` node exists (`path … "Ciphertext"` → "No node found"). Must know code identifiers (`EncryptedBlob`). Undercuts domain-term querying / onboarding (bars 1, 4).
- ⚠️ **Bar 1 — `path` traverses structural import/re-export edges, not data flow.** `Task → EncryptedBlob` routed through barrel `index.ts` re-exports + irrelevant `vaultImportErrorMessages.ts`. Misleading as an architecture trace.
- ⚠️ Duplicate nodes (EncryptedBlob ×N across vault-core/mobile/web-vault-ui) → ambiguous `path` matches.
- ⚠️ Community fragmentation: 128 communities / 349 libs files (~11 nodes each) — bar-3 signal, pending report/viz.

### Build cost (for bar 5 break-even)

- libs 32.8s + apps 7.9s + merge ≈ **~41s build** for the scoped code-only corpus (excludes the failed 20-min root run). Per-query (`query`/`path`) is sub-second, local, zero-token. Caveat: graph goes stale on every code change (needs `graphify update`).

## Bar 5 — REFRAMED: agent finds correct + related context in <1s (graphify vs CodeExplorer)

**Reframe (user, 2026-06-19):** grep is a retrieval tool, not a comparison peer — it returns matches, not relationships. Graphify's differentiator is the RELATIONAL layer (communities, neighbors, reverse-impact, similarity). Goal = fastest + most accurate way for an AI agent (small OR large context) to find what it needs AND what it relates to, in <1s.

**Baseline = CodeExplorer** (the agent's real current method: wraps grep/glob/read + structured summary). NOT raw grep (strawman).

**Primary metric = relational accuracy + latency.** Per question, vs independent ground truth:

- Accuracy: precision + recall of the returned related set (missing a neighbor = failure).
- Latency: is it actually sub-second?
- Cost/tokens = secondary tiebreaker only.
  Secondary observations: relational completeness; one-shot-ness (usable in one call vs needs follow-ups).

**Ground truth (independent of CodeExplorer):** `nx graph` / `project.json` for dependency questions; direct file reads for flow/neighbor questions.

**Scope fairness:** graphify graph = libs/ + apps/(backend,web) only (mobile, e2e, generated app-api-client excluded). Keep questions within that scope; note where CodeExplorer's whole-repo reach is an unfair advantage/disadvantage.

### Question set (relational-weighted; literal controls marked [CTRL])

R1. What is affected if the vault blob schema (`EncryptedBlob`) changes? (reverse-impact)
R2. What consumes `@myorganizer/design-tokens`? (dep — nx authoritative)
R3. What is directly related to `saveEncryptedData()` (vault encryption)? (neighborhood)
R4. What depends on the auth library / what does it touch? (dep — nx authoritative)
R5. What is affected if `VaultController` changes? (reverse-impact)
R6. What symbols/files group with the Task feature? (community/similarity)
C7. [CTRL] Where is `deriveKeyFromPassphrase` defined? (literal — grep should win)
C8. [CTRL] List the functions defined in `vault.ts`. (literal — grep should win)

### RESULTS — graphify (CLI) vs CodeExplorer

| Q                               | Ground truth                                                                         | graphify                                                                                         | CodeExplorer                                                                     | Winner                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| R1 EncryptedBlob blast radius   | ~20 files vault-core→web-vault→api-client→backend                                    | **FAIL** "no unique node match" (dup nodes)                                                      | full, accurate, grouped (81s, 60k tok)                                           | **CodeExplorer**                                                   |
| R2 design-tokens consumers      | web-pages-home, mobile-ui (nx)                                                       | both found but buried in ~21 noise nodes; "token" matched auth `TokenStorageMode` (false friend) | accurate + caught CSS consumer + transitive (228s, 67k tok)                      | **CodeExplorer** (graphify wrong granularity; nx is the real tool) |
| R3 saveEncryptedData consumers  | ~13 sites (addresses/mobile-numbers/subs/tasks/groceries)                            | **19 edges, accurate set** (~1s, 0 tok)                                                          | same set + line cites (137s, 33k tok)                                            | **graphify** (≈equal accuracy, ~100× faster, free)                 |
| R5 VaultController blast radius | client via generated VaultApi → serverVaultSync → migration → mobile → HTTP boundary | **FAIL** "no affected nodes" (HTTP/generated-client boundary invisible)                          | excellent; correctly reasons across HTTP boundary + OpenAPI regen (87s, 53k tok) | **CodeExplorer**                                                   |
| R6 Task grouping                | Task feature surface                                                                 | accurate (10 conns, ~1s)                                                                         | (not run)                                                                        | graphify ok                                                        |
| C7/C8 controls (literal)        | —                                                                                    | partial / 217-node dump (wrong tool)                                                             | n/a                                                                              | grep/read                                                          |

**Latency:** graphify CLI ~0.8–1.2s, **0 tokens**. CodeExplorer **81–228s, 33–67k tokens**.

### Bar 5 verdict: FAIL (does not meet reframed goal)

- graphify's headline pitch — **"show ripple/what's affected if X changes"** (issue value-prop #5) — is exactly where it **FAILED** (R1, R5): duplicate-node ambiguity breaks `affected`, and it is **blind to the HTTP/generated-client boundary** that carries this monorepo's most important contract ripple.
- Its one genuine win (R3/R6: instant consumers of a single _unambiguous_ symbol, ~100× faster, free) is a question shape **already served by a plain grep-for-importers or `nx affected`** — the relational graph adds little there.
- Where the graph's relational layer _should_ shine (transitive R2, impact R1/R5) it was noisy, wrong-granularity, or empty.
- For an autonomous agent, a **fast wrong/empty answer (R1,R5 returned nothing) is worse than a slow correct one**, and the agent can't predict in advance whether a question lands in graphify's narrow sweet spot.
- Accuracy is the primary metric; graphify loses 3 of 4 relational questions to the incumbent. Speed advantage doesn't rescue it.

## Bar 1 — vault flow accuracy + safety → MIXED (safety PASS, accuracy FAIL)

- **Safety: PASS.** Backend vault surface = `VaultController.putVaultBlob/getVaultBlob`, `VaultService`, `EncryptedBlobV1`, `VaultBlobType` — server touches encrypted blobs only. Edge scan backend↔(DecryptedTask/Task plaintext) = EMPTY. Graph asserts NO false "plaintext crosses server" relationship.
- **Accuracy: FAIL as an end-to-end flow trace.** No `Ciphertext` node (domain term absent). `path "Task" "EncryptedBlob"` returns a structural route through barrel `index.ts` re-exports + irrelevant `vaultImportErrorMessages.ts`, not the real flow. `query` BFS surfaced the right neighborhood (`saveEncryptedData`, `taskNormalization`, `loadDecryptedData`) but as a flat list, not a directed flow. Pieces present; flow not assembled.

## Bar 3 — noise / navigability → FAIL in zero-egress mode

- merged: 1851 nodes / 3901 edges / **187 communities (~10 nodes each)** — heavy fragmentation.
- `--no-label` (zero-egress) report = wall of unnamed `Community 0..186` links. Not navigable for onboarding WITHOUT the LLM labeling pass (= Run 2, egress).
- Good: 97% EXTRACTED / 3% INFERRED (conf 0.8) / **token cost 0** confirms hard AST edges + true zero-egress.
- Verdict: code-only graph is structurally sound but semantically unlabeled → onboarding value (bars 3,4) depends on Run 2.

## Internet recon + "are we missing config?" — RESOLVED (2026-06-19)

- Guides confirm: monorepos >5k files should run graphify PER SUB-PACKAGE, not root. Our libs/+apps/ scoping IS the recommended setup — we configured it right; root node_modules ingestion is the known misuse.
- Famous "49×/71.5× fewer tokens" claim = self-reported, mixed-corpora, NO published precision/recall benchmark (independent reviewers flag accuracy concerns). Adoption is driven by cheap compact retrieval + docs/multimodal + visual graph, NOT code-impact accuracy.
- **Graphify NEVER runs an LLM over code** (by design: `needs_llm = bool(docs/papers/images)`; code is always tree-sitter AST). Verified: `--mode deep --backend claude-cli` on vault-core = 2.2s, 0 LLM calls. The Claude/`claude-cli` backend only enriches DOCS/images (→ bar 4 onboarding), not code edges.
- `claude-cli` backend exists (routes through local Claude Code CLI, billed to Pro/Max plan, no API key) — relevant only for a doc/onboarding pass, not bar 5.
- **`--mode deep` rebuild = byte-identical graph (1851/3901), added ZERO edges. R1/R5 still fail identically.** => code-relational accuracy is AST-bounded; R1/R5 impact failures are FUNDAMENTAL, not fixable by config/backend. Bar 5 verdict stands and is now airtight.

## Bar 2 — PR triage vs nx affected (deferred to after Run 1 code bars)

- Throwaway draft PRs from slices 120–124 → feat/task-management.
- `graphify prs` (if available) / graph-community overlap vs `nx affected`.

## RERUN 2 (2026-06-19) — clean slate, by-the-book documented config

User asked to wipe everything and re-test following graphify's OWN shipped skill
(`site-packages/graphify/skill.md` + `references/`), to rule out our misconfiguration.
Found and corrected THREE first-pass config errors:

1. **Wrong entry point.** First pass used headless `graphify extract` which tripped the
   "no LLM API key" guard on docs. The documented zero-API-key backend is `--backend
claude-cli` (routes doc/image semantic extraction through the local Claude CLI, no
   egress, billed to plan, $0). This WORKS and was never exercised before.
2. **We excluded `libs/app-api-client`** (the generated API client) in `.graphifyignore`
   — but that is exactly the package R5's impact chain runs through. Self-inflicted.
   Removed the exclusion this run.
3. **We queried with raw `affected`**, skipping the REQUIRED query-expansion flow in
   `references/query.md`. This run used `affected` + `explain` + `path` properly, plus
   the `diagnose multigraph` collapse check we never ran.

### Rebuilt graph (documented monorepo flow: per-package extract + merge-graphs)

- `graphify extract apps --backend claude-cli`: 147 code + 12 docs + 16 images →
  **800 nodes / 1080 edges / 86 communities** (was 396/662 code-only). 184k in/7k out, $0.
- `graphify extract libs --backend claude-cli`: 454 code (incl. app-api-client now) +
  36 docs → **2655 nodes / 4254 edges / 251 communities** (was 1455/3239). 47k in/9k out, $0.
- `merge-graphs` → **3455 nodes / 5334 edges** (was 1851/3901). Richer, fuller graph.
- `diagnose multigraph`: **ZERO collapse** (same_endpoint_collapsed_edges=0). Graph is clean;
  the old "no unique node match" was never edge corruption — it's `affected` refusing to
  pick among duplicate-label nodes.

### Re-test against the deciding bars — CORE FAILURES REPRODUCE under correct config

| Q                                 | Documented method                                                           | Result                                                                                                                                                                                    | Verdict                                                                                                                                                                                                                |
| --------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R5 VaultController blast radius   | `affected` + `path VaultController→VaultApi`/`→serverVaultSync` + `explain` | `affected`=empty; **NO path** to VaultApi or serverVaultSync; `explain` shows VaultController links only to `routes.ts` + its own methods                                                 | 🔴 **BLIND across HTTP/codegen boundary** — nodes now present but in DISCONNECTED components; client↔server is an HTTP contract + OpenAPI codegen, not a code import, so AST has no edge. **Fundamental, NOT config.** |
| R1 EncryptedBlob/V1 blast radius  | `affected EncryptedBlob`, `affected EncryptedBlobV1`, `explain`             | `affected`=**"No unique node match"** (label in >1 file); `explain EncryptedBlob`→degree **1**                                                                                            | 🔴 `affected` unusable for any cross-cutting symbol; TS _type_ references aren't edges                                                                                                                                 |
| R3 saveEncryptedData neighborhood | `explain`                                                                   | degree **20**, every consumer (Subscriptions/Tasks/Addresses/MobileNumbers/groceries) + callers (loadVault/saveVault/encryptJsonWithMasterKey), instant, $0                               | 🟢 **STRONG** — graphify's real value                                                                                                                                                                                  |
| Bar 3 navigability                | `cluster-only` report                                                       | God Nodes accurate & useful out of the box (Button, cn, useToast, loadDecryptedData, saveEncryptedData); communities still `Community N` (low cohesion 0.03–0.09) until host-LLM labeling | 🟡 better than first-pass FAIL; hub map usable, clusters need labeling                                                                                                                                                 |
| Bar 1/4 domain terms from docs    | node scan                                                                   | 36 docs + 16 images via claude-cli produced only **3 concept nodes** (all from swagger.yaml: EncryptedBlobV1/VaultBlobType/User Schema). **No `Ciphertext`, no domain glossary**          | 🔴 doc pass is shallow; onboarding domain-language still absent                                                                                                                                                        |

### Bottom line of rerun 2

- We DID mis-configure it the first time, and fixing that (claude-cli docs, include
  app-api-client, proper query flow) produced a materially richer, cleaner graph and
  a more useful onboarding map. The user's instinct was right to demand the redo.
- BUT the two failures that drove the no-go — **cross-HTTP-boundary impact (R5)** and
  **type-level blast radius (R1)** — reproduce IDENTICALLY under the correct config,
  because they are inherent to AST extraction (no edge spans the codegen/HTTP seam;
  TS type usages aren't call/import edges; `affected` can't disambiguate duplicate labels).
- graphify's genuine, repeatable strength is now well-established: **instant, accurate,
  free function-call/import neighborhoods within a package** (R3) and a useful God-Nodes
  hub map. It is NOT a reliable cross-boundary impact-analysis engine for this monorepo.

### MCP surface (how an agent really consumes it) — `python -m graphify.serve`

Tools exposed: `query_graph`, `get_node`, `get_neighbors`, `get_community`, `god_nodes`,
`graph_stats`, `shortest_path`, `list_prs`, `get_pr_impact`, `triage_prs`. These wrap the
exact CLI capabilities, so an agent via MCP inherits the same strengths (get_neighbors/
god_nodes strong) and the same limits (shortest_path/get_pr_impact blind across the
HTTP/codegen seam). No new capability beyond the CLI.

### Bar 2 — PR/slice triage vs `nx affected` (TESTED via compute_pr_impact, 2026-06-19)

Bypassed the "no open PRs" blocker by calling `graphify.prs.compute_pr_impact(files, G)`
directly on realistic single-file changesets and comparing to `nx affected --files`.

| Changed file               | `nx affected` (authoritative, project-level)                     | graphify blast_radius    |
| -------------------------- | ---------------------------------------------------------------- | ------------------------ |
| web-vault/…/vault.ts       | **13 projects** (web-vault + 8 page consumers + e2e + root)      | 2 communities / 19 nodes |
| backend/VaultController.ts | 1 (backend)                                                      | 1 community / 15 nodes   |
| design-tokens/index.ts     | **7 projects** (design-tokens, home, mobile-ui/screens/app, e2e) | **1 community / 1 node** |

**Root cause (serve.py / prs.py:243 `compute_pr_impact`):** it sums the communities/nodes of
the nodes that live INSIDE the changed files only — it does **NOT** reverse-traverse to find
dependents. So "blast_radius" = the changed file's own community span, not downstream impact.
A thin barrel (`design-tokens/index.ts`) consumed by 7 projects scores blast_radius=1 (lowest)
when it is actually the highest-risk change. **`triage_prs` therefore inverts merge risk for
hub/barrel files.** `nx affected` traverses the real dep graph (incl. implicit/build deps),
is authoritative, fast, and already integrated.

**Bar 2 verdict: 🔴 `nx affected` wins decisively.** graphify's PR-impact is a file-membership
proxy, not a dependency-impact analysis, and is unsafe for ranking review priority here.

### Bar 3/4 — community labeling + onboarding (TESTED, 2026-06-19)

Ran `graphify label . --backend claude-cli` (skill Step 5, automated via local Claude CLI,
zero-egress, $0). Labeling SUCCEEDS and is accurate: domain communities get correct names —
"Vault Controller API", "Vault Session Provider", "Vault Export/Import Logic", "Cloud Backup
Coordinator", "Google Drive Provider", "Generated API Client Base", "Contact Record
Normalization", "YouTube Token Encryption", etc.

BUT signal-to-noise is poor out of the box. Of **216** labeled communities:

- **122 (57%) are config/boilerplate**: "TypeScript Config" ×29, "TypeScript Lib Config" ×25,
  "TypeScript Spec Config" ×15, "Nx Test Project Config" ×14, "Nx Project Config" ×14, lint/
  webpack/babel/gradle/manifest clusters. Every package's tsconfig/project.json becomes its
  own community.
- The real DOMAIN communities are each singletons — accurate but buried under the 57% config sludge.

**Bar 3/4 verdict: 🟡 Mixed.** Labeling works and names are accurate; the God-Nodes hub list is
useful. But the community map is majority config noise → onboarding value is diluted unless you
aggressively exclude config files (tsconfig/project.json/lint) in `.graphifyignore`. A navigation
aid, not a knowledge base. Did NOT build `--wiki` — it is one article per community, so it would
inherit the same 57% config-noise dilution.

## OVERALL VERDICT (after fully-corrected, by-the-book rerun) — 2026-06-19

The redo was worth it and corrected our 3 config errors. Net scorecard:
| Use case | Verdict |
|---|---|
| In-package symbol neighborhood (callers/consumers) — R3 | 🟢 Strong, instant, free |
| God-nodes / core-abstraction hub map | 🟢 Useful out of the box |
| Cross-HTTP/codegen-boundary impact — R5 | 🔴 Blind (fundamental AST limit) |
| Type-level / cross-cutting symbol blast radius — R1 | 🔴 affected can't disambiguate; type refs aren't edges |
| PR/slice triage — bar 2 | 🔴 inverts hub-file risk; `nx affected` superior |
| Onboarding / domain language — bar 3/4 | 🟡 accurate labels but 57% config noise; needs heavy ignore tuning |
| Docs→domain concepts (Ciphertext glossary) | 🔴 shallow (3 swagger nodes) |

**Recommendation unchanged: No-go for the impact-analysis / PR-triage / domain-onboarding use
cases that motivated #158.** Residual narrow value: fast free in-package symbol neighborhoods
(MCP `get_neighbors`/`god_nodes`) as a supplement to CodeExplorer — NOT a replacement, and NOT
for cross-package impact. `nx affected` remains the authoritative impact tool.

## ADOPTED THE NARROW WIN (2026-06-19, branch research/graphify-eval-158)

Per decision to adopt the proven in-package-neighborhood win as a CodeExplorer supplement:

1. **Cut config noise** — `.graphifyignore` now excludes tsconfig/project.json/_.config._/
   eslint/babel/native build trees. Clean rebuild: **2072 nodes / 4083 edges / 84 communities**
   (was 3455/5334/355). Config-noise communities dropped from **122/216 (57%) → 1/84 (1.2%)**.
   The labeled community map is now almost all real domains ("Vault REST Controller",
   "Encrypted Vault Storage Crypto", "Google Drive Provider", "Contact Record Normalization").
2. **MCP server** — `.mcp.json` runs `graphify-mcp graphify-out/graph.json` (stdio). Verified
   end-to-end: handshake + tools/list returns query_graph/get_neighbors/get_node/god_nodes/etc.
   Requires `uv tool install graphifyy --with mcp` (the `mcp` extra; server crashes without it).
3. **CodeExplorer wired** — `.claude/agents/explore.md` gains the read-only graphify MCP tools
   plus guardrails: use for "who calls/consumes X" + god-nodes; NEVER for cross-boundary impact
   (use `nx affected`) or duplicate-name/type-ref symbols; treat results as [inferred] until
   confirmed by file read (graph can be stale).
4. **Build/refresh doc** — `docs/graphify.md` (one-command rebuild, incremental refresh, scope
   limits, maintenance reality: no commit hook, manual rebuild).
5. **gitignore** — `graphify-out/` artifacts are generated, not committed; `.mcp.json` +
   `.graphifyignore` + `docs/graphify.md` are committed.

Smoke test on clean graph: `saveEncryptedData` still degree 20, community now nicely labeled
"Encrypted Vault Storage Crypto". The win survives the config-pruned rebuild.

Tracked footprint: M .claude/agents/explore.md, M .gitignore, + .graphifyignore, .mcp.json,
docs/graphify.md (and this notes file). Everything on the research branch.

## REAL-WORKFLOW STRESS TEST (2026-06-19) — spike: alter Subscriptions + new mobile screen

A separate clean-session agent (unaware Graphify was under test) implemented a small spike:
add a `notes` field to Subscriptions (backend + web) and a new mobile screen. Its tooling retro:

- **Graphify was NOT directly used.** The agent loaded the MCP tool schemas but defaulted to
  CodeExplorer (×2) + grep + direct Reads. It never invoked a graphify tool itself.
- **Value is now UNOBSERVABLE.** Because we wired Graphify _into_ CodeExplorer, the agent could
  only say CodeExplorer "may have used them internally." The accurate cross-layer map it got
  (blob type → page lib → mobile lib) is indistinguishable from plain grep+read output — no
  evidence Graphify contributed. Wiring it inside CodeExplorer hid whether it adds value.
- **Main friction was CodeExplorer's format, not Graphify:** prose + _approximate_ line numbers
  meant the agent re-read every target file anyway. Flagged as a bottleneck for 20+ file refactors.
  (Graphify's coarse `source_location` would feed the same imprecision.)
- **Architectural nuance missed:** the mobile navigator uses conditional rendering, not a push
  stack — a _pattern_, not a symbol edge, so structurally outside Graphify's AST model. Consistent
  with the blind-spot findings.
- **Caveat — boundary not exercised:** the agent chose a Vault-blob-backed feature
  (`VaultBlobType.Subscriptions`), so data flowed through the encrypted blob, NOT a generated
  REST endpoint. The spike sidestepped the HTTP/codegen seam (Graphify's worst case); the
  "no wrong answers" outcome does not clear it there.

**Implication for the adoption:** a "narrow win" that the main agent never invokes, and whose
contribution inside CodeExplorer is unmeasurable, is close to dead weight in practice. Either make
its use deliberate + logged (call graphify first for "who consumes X", record hits) to prove value,
or concede the adoption isn't earning its maintenance cost (manual rebuilds + staleness). Verdict
on the tool itself is unchanged; the integration design is the open question.

### DECISION (2026-06-19): put it on probation — deliberate + measurable

Chose to make the integration prove itself rather than concede yet:

- `.claude/agents/explore.md`: for relationship/consumer Goals, CodeExplorer MUST query Graphify
  FIRST (before grep), and MUST emit a `Graphify Usage` block every run with a verdict of
  `helped` / `redundant` / `wrong/missed` vs verified file evidence. Makes the value observable.
- `docs/graphify.md`: documented the "on probation — usage is measured" stance and the kill
  criterion (consistent `redundant`/`wrong/missed` → drop it).
- Spike (`spike/notes-field`) reverted: discarded the uncommitted notes-field + mobile-screen
  edits, deleted the branch. It was always throwaway.
  Next: gather a few CodeExplorer `Graphify Usage` logs from real tasks, then keep-or-kill on evidence.
