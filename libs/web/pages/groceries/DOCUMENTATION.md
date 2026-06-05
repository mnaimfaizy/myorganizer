# Groceries Feature — Comprehensive Documentation

**Version:** 1.0  
**Last Updated:** 2026-06-05  
**Status:** Production Ready  
**Maintainers:** Development Team

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Component Reference](#component-reference)
3. [API Reference](#api-reference)
4. [Hooks & State Management](#hooks--state-management)
5. [Testing Guide](#testing-guide)
6. [Troubleshooting](#troubleshooting)
7. [Deployment Guide](#deployment-guide)
8. [Maintenance & Updates](#maintenance--updates)

---

## Architecture Overview

### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js App Router                        │
│              (apps/myorganizer/src/app)                      │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│              Groceries Page Library                          │
│        (libs/web/pages/groceries/src)                        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         GroceriesPageClient (Main Container)         │  │
│  │  ├─ useGroceriesVault hook (state + vault ops)      │  │
│  │  ├─ GroceryListSelector (list display)              │  │
│  │  ├─ CreateListDialog                                │  │
│  │  ├─ RenameListDialog                                │  │
│  │  └─ DeleteListConfirmDialog                         │  │
│  └──────────────────────────────────────────────────────┘  │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Vault Integration                         │
│           (libs/web-vault + web-vault-ui)                   │
│                                                              │
│  • Encryption/Decryption (client-side only)               │
│  • Blob storage (ciphertext)                              │
│  • VaultGate wrapper (auth boundary)                       │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│              Backend API + Vault Service                    │
│                  (apps/backend)                             │
│                                                              │
│  • POST /api/v1/vault/blob/groceries (create)            │
│  • GET /api/v1/vault/blob/groceries (fetch)              │
│  • PATCH /api/v1/vault/blob/groceries (update)           │
│  • DELETE /api/v1/vault/blob/groceries (delete)          │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Page Load:**

   ```
   User navigates to /dashboard/groceries
   → VaultGate checks auth & vault unlock status
   → GroceriesPageClient mounts
   → useGroceriesVault loads encrypted blob
   → Decrypt blob → Parse JSON → Display lists
   ```

2. **Create List:**

   ```
   User fills form + clicks submit
   → validateListName (Zod schema)
   → vault.createList(name)
   → Decrypt blob → Add item → Re-encrypt → POST to vault
   → Optimistically update UI
   ```

3. **Rename List:**

   ```
   User opens rename dialog + edits name + submits
   → validateListName
   → vault.renameList(id, newName)
   → Update encrypted blob
   → PATCH to vault
   ```

4. **Delete List:**
   ```
   User confirms delete
   → vault.deleteList(id)
   → Remove from encrypted blob
   → PATCH to vault
   → Remove from UI
   ```

---

## Component Reference

### GroceriesPageClient

**Location:** `src/components/GroceriesPageClient.tsx`

**Responsibility:** Main page container, dialog state management

**Props:**
None (uses `VaultGate` wrapper context)

**State:**

```typescript
interface DialogState {
  type: 'create' | 'rename' | 'delete' | null;
  listId?: string; // For rename/delete
  listName?: string; // Pre-filled name
  itemCount?: number; // For delete confirmation
}
```

**Key Features:**

- Loading skeleton during vault load
- Error banner with dismiss button
- Empty state when no lists
- List grid with responsive layout
- Dialog portal system

**Example Usage:**

```typescript
export function GroceriesPage() {
  return (
    <VaultGate title="Groceries">
      {(ctx) => <GroceriesInner masterKeyBytes={ctx.masterKeyBytes} />}
    </VaultGate>
  );
}
```

---

### GroceryListSelector

**Location:** `src/components/GroceryListSelector.tsx`

**Responsibility:** Display list of grocery lists with selection & actions

**Props:**

```typescript
interface GroceryListSelectorProps {
  lists: GroceryList[];
  selectedListIds: string[];
  onSelectLists: (ids: string[]) => void;
  onRenameList: (id: string) => void;
  onDeleteList: (id: string) => void;
  isLoading?: boolean;
}
```

**Renders:**

- Grid of list cards (responsive: 1, 2, or 3 columns)
- Checkbox for multi-select (future feature)
- Category emoji badge
- Item count & timestamp
- Progress bar (completion %)
- Context menu (rename, delete)

**Example:**

```tsx
<GroceryListSelector lists={vault.lists} selectedListIds={selectedListIds} onSelectLists={setSelectedListIds} onRenameList={(id) => setDialog({ type: 'rename', listId: id })} onDeleteList={(id) => setDialog({ type: 'delete', listId: id })} />
```

---

### CreateListDialog

**Location:** `src/components/CreateListDialog.tsx`

**Responsibility:** Modal form to create new grocery list

**Props:**

```typescript
interface CreateListDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
  isLoading?: boolean;
}
```

**Validation:**

- Name required (1+ chars)
- Max 100 characters
- Zod schema: `createListSchema`

**Features:**

- Auto-focus input field
- Character counter (live via aria-live)
- Error message display
- Loading state during submission
- Disabled state during async operations

---

### RenameListDialog

**Location:** `src/components/RenameListDialog.tsx`

**Responsibility:** Modal form to rename existing list

**Props:**

```typescript
interface RenameListDialogProps {
  isOpen: boolean;
  currentName: string; // Pre-filled
  onClose: () => void;
  onSubmit: (newName: string) => Promise<void>;
  isLoading?: boolean;
}
```

**Features:**

- Pre-fills input with current name
- Prevents no-op submission (same name)
- Same validation as CreateListDialog
- Rename button disabled when name unchanged

---

### DeleteListConfirmDialog

**Location:** `src/components/DeleteListConfirmDialog.tsx`

**Responsibility:** Confirmation dialog before list deletion

**Props:**

```typescript
interface DeleteListConfirmDialogProps {
  isOpen: boolean;
  listName: string;
  itemCount: number; // Shows count in warning
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isLoading?: boolean;
}
```

**Features:**

- Alert icon + warning styling
- Shows item count impact
- Destructive red delete button
- No-op cancel (closes dialog)

---

## API Reference

### useGroceriesVault Hook

**Location:** `src/hooks/useGroceriesVault.ts`

**Usage:**

```typescript
const vault = useGroceriesVault({ masterKeyBytes });
```

**Returns:**

```typescript
interface UseGroceriesVaultReturn {
  lists: GroceryList[];
  loading: boolean;
  error: string | null;
  selectedListId: string | null;

  // Mutations
  createList: (name: string) => Promise<void>;
  renameList: (id: string, newName: string) => Promise<void>;
  deleteList: (id: string) => Promise<void>;

  // Utilities
  setError: (error: string | null) => void;
}
```

**Internal State:**

- Manages encrypted blob fetch & parse
- Optimistic UI updates
- Error boundary

**Example:**

```typescript
const vault = useGroceriesVault({ masterKeyBytes });

// Create
await vault.createList('Weekly Shopping');

// Rename
await vault.renameList(list.id, 'New Name');

// Delete
await vault.deleteList(list.id);

// Handle errors
if (vault.error) {
  console.error('Vault error:', vault.error);
}
```

---

### Validation Schemas

**Location:** `src/components/*.tsx` (inline Zod schemas)

**Create/Rename List Schema:**

```typescript
const createListSchema = z.object({
  name: z.string().trim().min(1, 'List name is required').max(100, 'List name must be 100 characters or less'),
});
```

**Validation Rules:**

- Whitespace trimmed
- Minimum 1 character (non-whitespace)
- Maximum 100 characters
- Error messages user-friendly

---

## Hooks & State Management

### useGroceriesVault

See [API Reference](#api-reference) above.

**Initialization:**

```typescript
// Called in GroceriesPageClient
const masterKeyBytes = ... // From VaultGate context
const vault = useGroceriesVault({ masterKeyBytes });
```

**Side Effects:**

- Fetches encrypted blob on mount
- Decrypts using master key
- Parses JSON into GroceryList[]
- Sets loading/error state

---

## Testing Guide

### Unit Tests

**Location:** `src/__tests__/`

**Run tests:**

```bash
yarn nx test web-pages-groceries
```

**Coverage:**

```bash
yarn nx test web-pages-groceries -- --coverage
```

**Test Files:**

- `components/GroceriesPageClient.spec.tsx` — Main page logic
- `components/CreateListDialog.spec.tsx` — Create dialog validation
- `components/RenameListDialog.spec.tsx` — Rename dialog behavior
- `components/DeleteListConfirmDialog.spec.tsx` — Delete confirmation
- `components/GroceryListSelector.spec.tsx` — List display & interactions
- `hooks/useGroceriesVault.spec.ts` — Hook state management
- `integration/useGroceriesVault.integration.spec.tsx` — Vault mocking
- `utils/vault.spec.ts` — Vault utility functions

---

### E2E Tests

**Location:** `apps/myorganizer-e2e/src/e2e/groceries.spec.ts`

**Run E2E tests:**

```bash
yarn nx e2e myorganizer-e2e
```

**Test Scenarios:**

1. Create list via dialog
2. Rename list via dialog
3. Delete list with confirmation
4. Keyboard navigation (Escape)
5. Multiple list management
6. Error handling on vault failure

---

### Accessibility Tests

**Location:** Tests within `groceries.spec.ts` (F6 section)

**Tests:**

- Escape key closes dialogs
- Tab navigation between buttons
- Focus management
- Screen reader compatibility

**Manual Audit:**
See `ACCESSIBILITY_AUDIT.md` for detailed findings and fixes.

---

### Performance Tests

**Benchmarks:**

- Page load: <2.5s
- Dialog open: <300ms
- Form submission: <2s
- List render: <100ms per item

**Profiling:**

```bash
# React DevTools Profiler
1. Open React DevTools
2. Go to Profiler tab
3. Start recording
4. Interact with page
5. Stop recording and review
```

---

### Visual Regression Tests

**Location:** `VISUAL_REGRESSION_GUIDE.md`

**Baselines:**

```bash
apps/myorganizer-e2e/src/e2e/__screenshots__/
```

**Update baselines:**

```bash
yarn nx e2e myorganizer-e2e -- --update-snapshots
```

---

## Troubleshooting

### Common Issues

#### 1. Lists not loading (vault locked)

**Symptom:** Empty state shown, but vault is encrypted

**Solution:**

1. Check if VaultGate unlock screen appears
2. If locked, user must enter passphrase
3. Verify localStorage contains `myorganizer_vault_v1`

#### 2. Form submission hangs

**Symptom:** Create/rename dialog shows \"Creating...\" indefinitely

**Solution:**

1. Check browser console for errors
2. Check vault encryption/decryption status
3. Verify backend `/api/v1/vault/blob/groceries` endpoint is responsive
4. Check network tab for failed requests
5. Dismiss error banner and retry

#### 3. List disappears after creation

**Symptom:** Created list appears briefly, then disappears

**Solution:**

- **If data actually saved:** Refresh page to reload from vault
- **If data not saved:** Check error banner for failure reason
- **Backend issue:** Verify vault blob endpoint returns 200 OK

#### 4. Dialog won't close

**Symptom:** Pressing Escape or clicking X doesn't close dialog

**Solution:**

1. Check if form submission is still in progress
2. Try clicking outside dialog (dismisses most Radix dialogs)
3. Refresh page if stuck
4. Check browser console for JavaScript errors

#### 5. Characters don't show in input

**Symptom:** Typing in name field shows nothing

**Solution:**

1. Check if input is disabled (look for opacity-60)
2. Try clicking input to focus
3. Check if browser has autofocus issues (Safari)
4. Clear browser cache and retry

---

### Debug Mode

**Enable verbose logging:**

```typescript
// In useGroceriesVault.ts (temporarily for debugging)
console.log('Loading lists...', { masterKeyBytes });
console.log('Decrypted blob:', decryptedData);
console.log('Parsed lists:', parsedLists);
```

**Use React DevTools:**

1. Install React DevTools extension
2. Inspect component state in DevTools
3. Watch useGroceriesVault hook values

**Use Playwright Inspector:**

```bash
yarn nx e2e myorganizer-e2e -- --debug
```

---

## Deployment Guide

### Pre-Deployment Checklist

- [ ] All unit tests passing: `yarn nx test web-pages-groceries`
- [ ] All E2E tests passing: `yarn nx e2e myorganizer-e2e`
- [ ] No TypeScript errors: `yarn nx build web-pages-groceries`
- [ ] Linting passes: `yarn nx lint web-pages-groceries`
- [ ] Bundle size acceptable: <25KB gzipped
- [ ] Accessibility audit passed: Review `ACCESSIBILITY_AUDIT.md`
- [ ] Performance targets met: Review `PERFORMANCE_OPTIMIZATION.md`
- [ ] Visual regression baselines updated: `__screenshots__/` up to date

### Deployment Steps

1. **Create release branch:**

   ```bash
   git checkout -b release/groceries-v1.0.0
   ```

2. **Update version:**

   ```bash
   yarn nx version bumper web-pages-groceries --semver major
   ```

3. **Generate release notes:**

   ```bash
   yarn release:notes v1.0.0
   ```

4. **Create pull request:**

   ```bash
   yarn ai:create-pr
   ```

5. **Merge to main:**
   - Requires code review approval
   - All CI checks must pass
   - Feature branch must be up to date

6. **Tag release:**

   ```bash
   git tag -a v1.0.0 -m "feat: groceries list management UI"
   git push --tags
   ```

7. **Deploy to production:**
   - GitHub Actions deploys automatically
   - Monitor Vercel deployment logs
   - Verify page loads at `https://myorganizer.app/dashboard/groceries`

---

## Maintenance & Updates

### Code Ownership

**Primary Maintainers:**

- Development Team

**Code Review Requirements:**

- Minimum 2 approvals for any changes
- All tests must pass
- No console errors or warnings

### Update Checklist

When updating the groceries feature:

1. **Update components:**
   - [ ] Run linter: `yarn nx lint --fix web-pages-groceries`
   - [ ] Run tests: `yarn nx test web-pages-groceries`
   - [ ] Verify no regressions

2. **Update tests:**
   - [ ] Add tests for new behavior
   - [ ] Update visual baselines if UI changed: `--update-snapshots`
   - [ ] Verify E2E tests still pass

3. **Update documentation:**
   - [ ] Update relevant .md files in libs/web/pages/groceries/
   - [ ] Update API Reference if hooks changed
   - [ ] Add troubleshooting entries if needed

4. **Performance check:**
   - [ ] Verify bundle size doesn't increase >5KB
   - [ ] Run Lighthouse audit
   - [ ] Test on low-end device (throttled network)

5. **Accessibility check:**
   - [ ] Run accessibility audit: Review ACCESSIBILITY_AUDIT.md
   - [ ] Test with screen reader
   - [ ] Test keyboard navigation

---

### Dependency Updates

**Dependencies:**

- React 18+
- Radix UI (latest)
- Zod (latest)
- Tailwind CSS (latest)

**Update process:**

```bash
# Update dependencies
yarn upgrade-interactive

# Run tests
yarn nx test web-pages-groceries
yarn nx e2e myorganizer-e2e

# Check for breaking changes
git diff package.json

# Commit
git commit -m "chore(deps): update groceries dependencies"
```

---

### Performance Monitoring

**Metrics to track:**

- Page load time (target: <2.5s)
- Dialog interactions (target: <300ms)
- Form submissions (target: <2s)
- API response time (target: <500ms)

**Tools:**

- Google Analytics 4 (dashboard view timings)
- Sentry (error tracking)
- LogRocket (session replay)
- Lighthouse CI (automated audits)

---

### Feature Roadmap

**Future Enhancements:**

1. Item-level CRUD (separate issue #95)
2. List search / filter
3. List sharing & collaboration
4. Mobile app support
5. Offline sync queue
6. Batch operations

---

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Radix UI Documentation](https://www.radix-ui.com/)
- [Zod Documentation](https://zod.dev/)
- [Playwright Testing](https://playwright.dev/)
- [Web Vitals](https://web.dev/vitals/)
- [MyOrganizer Backend API Docs](../../../docs/backend/README.md)

---

**Document Version:** 1.0  
**Last Updated:** 2026-06-05  
**Next Review:** 2026-09-05 (quarterly)
