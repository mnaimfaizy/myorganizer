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

### Catalog Items and List Lines

Every grocery item you create becomes a **Catalog Item** (its identity: name, category,
price, notes, image, links). A **List Line** is a lightweight reference — `catalogItemId`

- `checked`/`amount` — that places a Catalog Item onto a specific Grocery List. The same
  Catalog Item can be a List Line on many lists at once without duplicating its identity.

* **Add From Catalog** on a list lets you pick an existing Catalog Item and add it as a
  List Line to one or many lists in a single action.
* **Delete List Line** removes the item from that one list only; the Catalog Item and its
  lines on other lists are untouched.
* **Delete From Catalog** permanently removes the Catalog Item and every List Line that
  references it, across every list. This requires typing the item's name to confirm.

### Trip Lifecycle (Checking Items Off)

Click the checkbox next to any line to mark it as bought on the current trip (`checked`).
Checked lines stay visible on the list.

- **Uncheck All** clears the checked state on every line without removing any lines or
  Catalog Items — use it to reset a list for a new trip.
- **Remove Checked From List** removes the finished (checked) lines from the current list
  only, with an undo affordance immediately after. It never deletes the underlying Catalog
  Items, and other lists referencing the same items are unaffected.

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
// Stored as an encrypted GroceriesVaultPayload
interface GroceriesVaultPayload {
  catalog: CatalogItem[]; // Item identities, shared across lists
  lists: GroceryList[];
}

interface CatalogItem {
  id: string; // UUID v4
  name: string; // Required
  category: GroceryCategoryType; // Defaults to 'other'
  price?: number; // Optional — for budget tracking (in user's local currency)
  notes?: string; // Optional free text notes
  imageUrl?: string; // Optional external image URL (display only, no uploads)
  links?: string[]; // Optional array of external links
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

interface GroceryList {
  id: string; // UUID v4
  name: string; // Required, user-defined list name
  lines: ListLine[]; // References into `catalog` for this list
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

interface ListLine {
  id: string; // UUID v4
  catalogItemId: string; // References CatalogItem.id
  checked: boolean; // Bought-on-this-trip state
  amount?: string; // Free text, e.g. "2", "500g", "1 dozen"
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

type GroceryCategoryType = 'produce' | 'dairy' | 'meat' | 'seafood' | 'bakery' | 'frozen' | 'beverages' | 'snacks' | 'condiments' | 'household' | 'personal-care' | 'other';
```

A Catalog Item's name/category/price/etc. are resolved by looking up `ListLine.catalogItemId`
in `catalog` — a `ListLine` itself never carries a copy of that data.

## Architecture

- **Page library**: `@myorganizer/web-pages/groceries` ([libs/web/pages/groceries/](../../libs/web/pages/groceries/))
- **Shared types**: `@myorganizer/core` → `GroceriesVaultPayload`, `CatalogItem`, `GroceryList`, `ListLine`, `GroceryCategoryType`
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
  catalog: CatalogItem[]; // resolves each line's category/name for progress + dominant-category display
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

### AddExistingItemDialog

```typescript
interface AddExistingItemDialogProps {
  isOpen: boolean;
  catalog: CatalogItem[];
  lists: GroceryList[];
  currentListId: string;
  onClose: () => void;
  onAdd: (catalogItemId: string, listIds: string[], amount?: string) => Promise<void>;
  isLoading?: boolean;
}
```

Search/select an existing Catalog Item, choose one or many target lists, optionally set an
amount, and add it as a List Line to every selected list (skipping lists that already have
a line for that item).

### DeleteCatalogItemDialog

```typescript
interface DeleteCatalogItemDialogProps {
  isOpen: boolean;
  catalogItem: CatalogItem | null;
  affectedListCount: number; // other lists (besides the current one) with a matching line
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isLoading?: boolean;
}
```

Strong confirmation: the destructive action stays disabled until the user types the Catalog
Item's exact name. Confirming permanently deletes the Catalog Item and every List Line that
references it, across all lists.

---

## `useGroceriesVault` Hook

**Location:** `@myorganizer/web-pages/groceries` → `src/shared/hooks/useGroceriesVault.ts`

```typescript
const vault = useGroceriesVault({ masterKeyBytes });
```

**Key mutations (partial list):**

```typescript
interface UseGroceriesVaultResult {
  catalog: CatalogItem[];
  lists: GroceryList[];
  loading: boolean;
  error: string | null;

  createList: (name: string) => Promise<void>;
  renameList: (id: string, newName: string) => Promise<void>;
  deleteList: (id: string) => Promise<void>;

  // Catalog membership
  addCatalogItemAndLine: (listId: string, item: NewCatalogItemInput) => Promise<void>; // create-or-reuse a Catalog Item by name, add a line to one list
  addItemToLists: (item: NewCatalogItemInput, listIds: string[]) => Promise<void>; // create-or-reuse a Catalog Item, add a line to many lists
  addExistingCatalogItemToLists: (catalogItemId: string, listIds: string[], amount?: string) => Promise<string[]>; // resolves with the ids of lists that actually received a new line
  deleteListLine: (listId: string, lineId: string) => Promise<void>; // list-only removal
  deleteCatalogItem: (catalogItemId: string) => Promise<void>; // cascades off every list

  // Trip lifecycle
  toggleLineChecked: (listId: string, lineId: string) => Promise<void>;
  uncheckAllLines: (listId: string) => Promise<void>;
  removeCheckedLines: (listId: string) => Promise<ListLine[]>; // returns removed lines for undo
  restoreLines: (listId: string, lines: ListLine[]) => Promise<void>; // undo affordance
}
```

Errors are caught internally and stored in `vault.error`. On load error the user can retry
by refreshing; on save error the previous state is preserved. `addItemToLists` and
`addExistingCatalogItemToLists` silently skip any target list that already has a line for
the same Catalog Item (no duplicate identity per list) — callers should surface the actual
added-list count to the user. None of `deleteListLine`, `uncheckAllLines`, or
`removeCheckedLines` ever remove a Catalog Item — only `deleteCatalogItem` does, and it
always cascades to every referencing List Line.

---

## Vault Utilities

**Location:** `src/shared/utils/vault.ts`

| Function                        | Description                                                                |
| ------------------------------- | -------------------------------------------------------------------------- |
| `getVaultErrorMessage(error)`   | Converts caught errors to user-friendly strings                            |
| `validateGroceryListName(name)` | Validates 1–100 chars with whitespace trimming                             |
| `createEmptyGroceryList(name)`  | Factory: returns a new `GroceryList` with a UUID v4 id and empty `lines[]` |

---

## Schema Migration

When the `GroceryList` or `GroceryItem` shape needs to change:

1. Update the types in `libs/core/src/lib/types/` (`GroceriesVaultPayload`, `CatalogItem`, `GroceryList`, `ListLine`, `GroceryCategoryType`)
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
