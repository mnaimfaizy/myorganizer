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
