# Groceries List Keeper

## Overview

The Groceries List Keeper lets you manage multiple encrypted grocery lists directly
in MyOrganizer. All data is end-to-end encrypted — the server stores only ciphertext
and cannot access your grocery information.

## Getting Started

1. Navigate to **Groceries** in the dashboard sidebar.
2. Enter your vault password to unlock.
3. Click **+ New List** to create your first grocery list.
4. Type an item name in the quick-add field and press **Enter**.

## Features

### Multiple Lists

Create unlimited independent grocery lists (e.g. "Weekly Shop", "Costco Run").

### Item Fields

| Field     | Description                             |
| --------- | --------------------------------------- |
| Name      | Required. The item name.                |
| Amount    | Optional. e.g. "2", "500g", "1 dozen"   |
| Price     | Optional. For budget tracking.          |
| Category  | One of 12 predefined categories.        |
| Notes     | Optional free text.                     |
| Image URL | Optional external image (display only). |
| Links     | Up to 10 external URLs.                 |

### Categories

Items can be assigned to one of these predefined categories:

**Produce** · **Dairy** · **Meat** · **Seafood** · **Bakery** · **Frozen** · **Beverages** · **Snacks** · **Condiments** · **Household** · **Personal Care** · **Other**

Use the **category filter bar** above the item list to show only items in a given category.

### Checking Items Off

Click the checkbox next to any item to mark it as collected. Use **Clear Checked** to
remove all checked items at once.

### Vault Backup

Grocery data is included in vault export/import. Go to **Settings → Vault Export** to
download a backup.

## Security Model

- All grocery data is encrypted with AES-GCM before leaving the browser.
- The server stores `EncryptedVaultBlob` records with `type = 'groceries'`.
- The server never has access to plaintext grocery data.
- Vault blob type: `groceries`

### What the server can see

Despite E2EE, the server retains limited metadata: the blob type identifier (`'groceries'`), the approximate blob size, and the last-updated timestamp. Item names, amounts, prices, and notes are never exposed.

## Vault Blob Schema (developer reference)

```typescript
// Stored as an encrypted GroceryList[] array
interface GroceryList {
  id: string; // UUID v4
  name: string; // Required, user-defined list name
  items: GroceryItem[];
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

interface GroceryItem {
  id: string; // UUID v4
  name: string; // Required
  amount?: string; // Free text, e.g. "2", "500g", "1 dozen"
  price?: number; // Optional — for budget tracking (in user's local currency)
  category: GroceryCategoryType; // Defaults to 'other'
  checked: boolean; // Shopping-list checked state
  notes?: string; // Optional free text notes
  imageUrl?: string; // Optional external image URL (display only, no uploads)
  links?: string[]; // Optional array of external links
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

type GroceryCategoryType = 'produce' | 'dairy' | 'meat' | 'seafood' | 'bakery' | 'frozen' | 'beverages' | 'snacks' | 'condiments' | 'household' | 'personal-care' | 'other';
```

## Architecture

- **Page library**: `@myorganizer/web-pages/groceries` ([libs/web/pages/groceries/](../../libs/web/pages/groceries/))
- **Shared types**: `@myorganizer/core` → `GroceryList`, `GroceryItem`, `GroceryCategoryType`
- **Vault normalization**: `@myorganizer/web-vault` → `normalizeGroceries` ([libs/web-vault/src/lib/vault/groceriesNormalization.ts](../../libs/web-vault/src/lib/vault/groceriesNormalization.ts))
- **Vault blob type**: `'groceries'` (registered in `VaultRecordType`, `VaultBlobType`)
- **Route**: `/groceries` ([apps/myorganizer/src/app/groceries/page.tsx](../../apps/myorganizer/src/app/groceries/page.tsx))

## Implementation Details

### Data Flow

1. User creates or edits a grocery list in the browser.
2. The list is serialized as JSON and encrypted client-side using WebCrypto (AES-GCM).
3. The encrypted blob is stored in the vault under `type: 'groceries'`.
4. On load, encrypted blobs are decrypted and normalized via `normalizeGroceries()`.
5. Normalization validates the schema and coerces invalid data to safe defaults (e.g., bad categories → 'other').

### Normalization

The `normalizeGroceries()` function:

- Accepts unknown data (e.g., from vault export or recovery).
- Validates each `GroceryList` and `GroceryItem` against their schemas.
- Filters out invalid items and lists.
- Coerces categories to known values ('produce', 'dairy', etc.) or 'other'.
- Validates image URLs and drops invalid ones.
- Returns `{ value: GroceryList[], changed: boolean }` to signal if the blob was migrated.

### Vault Blob Type Registration

The `'groceries'` blob type is registered in:

- `libs/core/src/lib/types/vault.ts` → `VaultBlobType` enum/union
- `libs/web-vault/src/lib/vault/vaultShapes.ts` → blob handling in `serverEncryptedBlobToLocal()`

---

## Component Reference

### GroceriesPageClient

Main page container. Manages dialog state and composes all sub-components. Receives `masterKeyBytes` via `VaultGate` context — no external props.

```typescript
interface DialogState {
  type: 'create' | 'rename' | 'delete' | null;
  listId?: string;
  listName?: string;
  itemCount?: number;
}
```

### GroceryListSelector

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

### CreateListDialog

```typescript
interface CreateListDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
  isLoading?: boolean;
}
```

Validation: name required, 1–100 characters, whitespace trimmed.

### RenameListDialog

```typescript
interface RenameListDialogProps {
  isOpen: boolean;
  currentName: string;
  onClose: () => void;
  onSubmit: (newName: string) => Promise<void>;
  isLoading?: boolean;
}
```

Submit is disabled when the value is unchanged from `currentName`.

### DeleteListConfirmDialog

```typescript
interface DeleteListConfirmDialogProps {
  isOpen: boolean;
  listName: string;
  itemCount: number;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isLoading?: boolean;
}
```

### GroceriesErrorBoundary

Wraps the groceries page to catch React render errors and show a fallback UI.

---

## `useGroceriesVault` Hook

**Location:** `@myorganizer/web-pages/groceries` → `src/groceries-page/hooks/useGroceriesVault.ts`

```typescript
const vault = useGroceriesVault({ masterKeyBytes });
```

**Return type:**

```typescript
interface UseGroceriesVaultReturn {
  lists: GroceryList[];
  loading: boolean;
  error: string | null;
  selectedListId: string | null;

  createList: (name: string) => Promise<void>;
  renameList: (id: string, newName: string) => Promise<void>;
  deleteList: (id: string) => Promise<void>;
  persistLists: (lists: GroceryList[]) => Promise<void>; // low-level direct save

  setError: (error: string | null) => void;
  setSelectedListId: (id: string | null) => void;
}
```

Errors are caught internally and stored in `vault.error`. All mutations are idempotent — safe to retry. On load error the user can retry by refreshing; on save error the previous state is preserved.

---

## Vault Utilities

**Location:** `src/groceries-page/utils/vault.ts`

| Function                        | Description                                                                |
| ------------------------------- | -------------------------------------------------------------------------- |
| `getVaultErrorMessage(error)`   | Converts caught errors to user-friendly strings                            |
| `validateGroceryListName(name)` | Validates 1–100 chars with whitespace trimming                             |
| `createEmptyGroceryList(name)`  | Factory: returns a new `GroceryList` with a UUID v4 id and empty `items[]` |

---

## Schema Migration

When the `GroceryList` or `GroceryItem` shape needs to change:

1. Update the types in `libs/core/src/lib/types/` (`GroceryList`, `GroceryItem`, `GroceryCategoryType`)
2. Update `GroceryListSchema` in `libs/web-vault/src/lib/vault/groceriesNormalization.ts`
3. Add a migration step inside `normalizeGroceries()` for the shape change
4. Existing vault blobs auto-migrate on next load — `normalizeGroceries()` returns `changed: true` and the hook re-persists the updated blob

---

## Troubleshooting

### Lists not loading (vault locked)

If the empty state appears but the user expects data: confirm the VaultGate unlock screen was completed. Verify `localStorage` contains `myorganizer_vault_v1`.

### Form submission hangs

If a dialog shows "Creating…" indefinitely: check the browser console for errors and inspect the network tab for a failed request to `/api/v1/vault/blob/groceries`. Dismiss the error banner and retry.

### List disappears after creation

If a newly created list appears briefly then vanishes: a page refresh will restore it if the data was saved. If not saved, the error banner shows the failure reason.

### Dialog won't close

If Escape or the close button has no effect: confirm a form submission is not still in progress. Clicking outside the dialog should dismiss it. Refresh if stuck.

### Characters don't appear in the name input

Confirm the input is not disabled (look for reduced opacity). Try clicking to re-focus. In Safari, clear the browser cache if autofocus misbehaves.
