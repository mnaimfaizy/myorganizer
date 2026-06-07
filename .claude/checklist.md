# Task Classification & Delegation Checklist

**CRITICAL:** Use this checklist BEFORE making ANY file edits.

## Step 1: Pre-Action Decision Tree

Before editing ANY file, answer these questions:

### Q1: What file type am I modifying?

- **`*.spec.ts` (Playwright E2E tests)** → Go to "E2E Tests" section
- **`*.test.ts` (Jest unit/integration tests)** → Go to "Jest Tests" section
- **`*.stories.tsx` (Storybook stories)** → Go to "Storybook Stories" section
- **Component in `libs/web-ui/` (UI Primitives)** → Go to "React Components" section
- **Component in `libs/web/pages/` (Feature Components)** → Go to "React Components" section
- **Other files** → Proceed to Step 2

### Q2: Am I UPDATING existing code or CREATING new code?

- **Updating test behavior or fixing test logic** → DELEGATE (even small fixes)
- **Creating new test files** → DELEGATE
- **Updating component implementation** → DELEGATE
- **Other infrastructure/config** → Check "Red Flags" section

---

## Step 2: Red Flags — Stop and Delegate If You See Any

Before calling `replace_string_in_file` or `create_file`, check for these patterns:

- ☐ The file extension is `.spec.ts` or `.test.ts`
- ☐ The file path contains `/helpers/` within an E2E test directory
- ☐ The code contains `setupBackend()`, `setupVault*()`, test fixtures, or mock helpers
- ☐ The word "fixture", "setup", "mock", "beforeEach", "afterEach", "test.describe" appears
- ☐ Playwright page object or browser automation code (`page.goto()`, `page.click()`, etc.)
- ☐ Jest mock configuration or test structure (`jest.mock()`, `.mock()`)
- ☐ Storybook story definition (`export const MyStory`)
- ☐ React component JSX in `libs/web-ui/` or `libs/web/pages/`
- ☐ UI behavior changes (styling, interactivity, props)
- ☐ Test assertions being added or changed

**If ANY of these apply: STOP → READ SKILL FILE → DELEGATE to sub-agent**

---

## Step 3: Task Classification Matrix

| File Pattern               | Operation         | Skill/Agent                                                                    | Delegated?                                  |
| -------------------------- | ----------------- | ------------------------------------------------------------------------------ | ------------------------------------------- |
| `*.spec.ts` (E2E)          | Create/Update/Fix | `.github/skills/playwright-e2e-workflow/SKILL.md` → E2EPlanner + TestScaffold  | ✅ **Always**                               |
| `*.test.ts` (Jest)         | Create/Update/Fix | `.github/skills/unit-test-delegation-workflow/SKILL.md` → TestScaffold         | ✅ **Always**                               |
| `*.stories.tsx`            | Create/Update     | `.github/skills/storybook-delegation-workflow/SKILL.md` → StorybookCurator     | ✅ **Always**                               |
| Component (libs/web-ui)    | Create/Edit       | `.claude/commands/component-builder.md` → ComponentBuilder → ComponentReviewer | ✅ **Always**                               |
| Component (libs/web/pages) | Create/Edit       | `.claude/commands/component-builder.md` → ComponentBuilder → ComponentReviewer | ✅ **Always**                               |
| Config/Infrastructure      | Edit              | Direct edit OK                                                                 | ⚠️ Only if no test/component files involved |
| Docs/README                | Create/Update     | Direct edit OK                                                                 | ⚠️ Can delegate to Docs agent if complex    |
| Type definitions           | Create/Update     | Direct edit OK                                                                 | ⚠️ Unless tests need updating too           |

---

## Step 4: Mandatory Delegation Rules

### **NO EXCEPTIONS** — These tasks ALWAYS require delegation:

1. **E2E Test Changes** (`.spec.ts` files)
   - Skill: `.github/skills/playwright-e2e-workflow/SKILL.md`
   - Agent flow: E2EPlanner → TestScaffold
   - What this means: Even a one-line bug fix in an E2E test must go through delegation

2. **Jest Test Changes** (`.test.ts` files)
   - Skill: `.github/skills/unit-test-delegation-workflow/SKILL.md`
   - Agent flow: TestScaffold (with behavior matrix)
   - What this means: Any test creation, update, or fix uses TestScaffold

3. **Storybook Stories** (`*.stories.tsx` files)
   - Skill: `.github/skills/storybook-delegation-workflow/SKILL.md`
   - Agent flow: StorybookCurator
   - What this means: New or updated story files go through StorybookCurator

4. **React Components** (libs/web-ui/_, libs/web/pages/_)
   - Workflow: ComponentBuilder → ComponentReviewer (no exceptions)
   - What this means: Component creation/edits follow the compound pattern via agents

---

## Step 5: Common Failure Pattern (What We're Preventing)

### ❌ **Anti-Pattern to Avoid:**

```
"I see a bug in the E2E tests. Let me:
1. Read the similar test file to find the pattern
2. Understand what needs fixing
3. Apply the fix directly with replace_string_in_file"
```

### ✅ **Correct Pattern:**

```
"I see a bug in the E2E tests. This is an E2E test UPDATE, so I need to:
1. Read .github/skills/playwright-e2e-workflow/SKILL.md
2. Use E2EPlanner to outline the fix (flow matrix + issues)
3. Delegate to TestScaffold with a precise E2E brief
4. TestScaffold executes the changes
5. I verify the result"
```

---

## Step 6: Tool-Level Gatekeeping

**BEFORE calling these tools on test/component files:**

- `replace_string_in_file` on `*.spec.ts`, `*.test.ts`, `*.stories.tsx`, or component files → DELEGATE FIRST
- `create_file` for test or story files → DELEGATE FIRST
- `read_file` (if 3+ consecutive reads needed for exploration) → Use CodeExplorer instead

---

## Quick Reference: What to Do Next

| Scenario                         | Action                                                                                  |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| "Fix a bug in an E2E test"       | → Read `.github/skills/playwright-e2e-workflow/SKILL.md`, use E2EPlanner + TestScaffold |
| "Update a Jest test"             | → Read `.github/skills/unit-test-delegation-workflow/SKILL.md`, use TestScaffold        |
| "Create a new Storybook story"   | → Read `.github/skills/storybook-delegation-workflow/SKILL.md`, use StorybookCurator    |
| "Edit a React component"         | → Build Structured Spec, use ComponentBuilder → ComponentReviewer                       |
| "Explore codebase for a pattern" | → Use CodeExplorer (not 3+ manual reads)                                                |
| "Fix a config file"              | → Direct edit OK (but check for tests that might break)                                 |
| "Update documentation"           | → Direct edit OK (or use Docs agent for complex docs)                                   |

---

## How to Use This Checklist

1. **Before starting work:** Run through Step 1 & 2 mentally
2. **If any red flag triggers:** Skip to Step 3, find your file type, follow the delegation flow
3. **If no red flags:** Proceed with direct edit (but still verify with Step 4)
4. **If you're ever unsure:** Re-read Step 4 — if it's a test/component/story file, delegate

---

## Reference Links

- E2E Workflow: `.github/skills/playwright-e2e-workflow/SKILL.md`
- Jest Workflow: `.github/skills/unit-test-delegation-workflow/SKILL.md`
- Storybook Workflow: `.github/skills/storybook-delegation-workflow/SKILL.md`
- Component Workflow: `CLAUDE.md` → "UI Component Workflows"
- This checklist: `.claude/checklist.md`
