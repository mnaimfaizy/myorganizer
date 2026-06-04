# Vault Integration for Groceries Feature

## Overview

This document describes the vault persistence pattern implemented in Iteration 2 of the Groceries feature. Vault provides end-to-end encrypted (E2EE) storage for sensitive user data.

## Architecture

### Vault Storage Model

The groceries feature uses the vault blob type `'groceries'` to store:

- All grocery lists (array of GroceryList objects)
- Each list contains items, name, and metadata
- Data is encrypted client-side; server stores only ciphertext

**Key Principle:** The server never has access to plaintext grocery data. All encryption/decryption happens on the client.

### Data Flow

```
User Action (create/rename/delete)
    ↓
Handler (createList, renameList, deleteList)
    ↓
persistLists() - Encrypts and saves to vault
    ↓
Vault Storage (encrypted blob)
    ↓
On Next Load:
    loadDecryptedData() - Decrypts and validates
    normalizeGroceries() - Normalizes structure
    setLists() - Updates component state
```

## Implementation Details

### 1. Custom Hook: `useGroceriesVault`

**Location:** `libs/web/pages/groceries/src/hooks/useGroceriesVault.ts`

**Purpose:** Encapsulates all vault operations and state management for grocery lists.

**API:**

```typescript
const vault = useGroceriesVault({ masterKeyBytes });

// State
vault.lists           // GroceryList[]
vault.loading         // boolean
vault.error          // string | null
vault.selectedListId  // string | null

// Actions
await vault.createList(name: string)           // Create a new list
await vault.renameList(id: string, name: string) // Rename a list
await vault.deleteList(id: string)             // Delete a list
await vault.persistLists(lists: GroceryList[]) // Direct save (low-level)

// Utilities
vault.setError(msg)        // Clear or set error message
vault.setSelectedListId(id) // Change selected list
```

**Error Handling:**

- Errors are caught internally and stored in `vault.error`
- User sees friendly error messages in the UI
- Errors include loading failures and save failures
- Handlers re-throw after setting error state

### 2. Component: `GroceriesPageClient`

**Location:** `libs/web/pages/groceries/src/components/GroceriesPageClient.tsx`

**Responsibilities:**

- Uses `useGroceriesVault` for all state management
- Manages dialog state (create, rename, delete modals)
- Renders list selector and handles user interactions
- Displays error banner when operations fail
- Shows loading skeleton during initial load

**Key Features:**

- Error banner with dismiss action
- Prevents UI interactions during loading/saving
- Dialog state management separate from vault state
- Clean prop passing to child components

### 3. Utilities: `vault.ts`

**Location:** `libs/web/pages/groceries/src/utils/vault.ts`

**Provides:**

```typescript
getVaultErrorMessage(error); // Convert errors to user-friendly messages
validateGroceryListName(name); // Validate list name (1-100 chars)
createEmptyGroceryList(name); // Factory function for new lists
```

### 4. Error Boundary: `GroceriesErrorBoundary`

**Location:** `libs/web/pages/groceries/src/components/GroceriesErrorBoundary.tsx`

**Purpose:** Catch React component errors and display fallback UI

**Usage:**

```tsx
<GroceriesErrorBoundary>
  <GroceriesPage />
</GroceriesErrorBoundary>
```

## Vault Integration Points

### Loading Data

1. Component mounts → `useGroceriesVault` hook runs
2. Hook calls `loadDecryptedData` with `type: 'groceries'`
3. Data returned as unknown, passed to `normalizeGroceries()`
4. Normalization validates and coerces data structure
5. If data was migrated, re-save normalized version
6. Set loading state to false

### Saving Data

1. User action (create/rename/delete) → handler called
2. Handler updates list array
3. Handler calls `persistLists(updatedLists)`
4. `persistLists` calls `saveEncryptedData()` with type `'groceries'`
5. Vault encrypts and stores data
6. Component state updated on success
7. Error state set on failure

### Error Recovery

- Load errors: Show error message, user can retry by refreshing
- Save errors: Show error message, previous state preserved
- Users can dismiss error banner manually
- All operations are idempotent (safe to retry)

## Type Definitions

### GroceryList (from @myorganizer/core)

```typescript
interface GroceryList {
  id: string; // UUID v4
  name: string; // Required, 1-100 chars
  items: GroceryItem[]; // Array of grocery items
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
}

interface GroceryItem {
  id: string;
  name: string;
  amount?: string;
  price?: number;
  category: GroceryCategoryType;
  checked: boolean;
  notes?: string;
  imageUrl?: string;
  links?: string[];
  createdAt: string;
  updatedAt: string;
}
```

## Normalization Strategy

The `normalizeGroceries()` function (from `@myorganizer/web-vault`) handles:

1. **Shape validation** - Ensures data is an array
2. **Item validation** - Each item must have a non-empty name
3. **Category coercion** - Invalid categories default to 'other'
4. **URL validation** - Links and images must be valid URLs
5. **ID generation** - Missing IDs are generated
6. **Timestamp defaults** - Missing timestamps use current time
7. **Migration tracking** - Returns `changed: true` if data was modified

This ensures data consistency and graceful handling of schema changes.

## Security Considerations

### What's Encrypted

- Entire grocery list structure (including item names, prices, notes)
- User-created data never stored in plaintext on server
- Encryption key derives from user's master password

### What's Not Encrypted

- Blob type identifier (`'groceries'`) - server knows user has this feature
- Blob size - server can see approximate data volume
- Update timestamps - server knows when user last modified groceries

### Best Practices

1. **Never send plaintext to server** - Always encrypt through vault API
2. **Always decrypt with correct key** - Wrong key will corrupt data
3. **Validate all loaded data** - `normalizeGroceries` catches corruption
4. **Handle key rotation** - Vault handles automatic re-encryption

## Testing Strategy (Phase 4)

### Unit Tests

- Test `useGroceriesVault` hook in isolation
- Mock `loadDecryptedData` and `saveEncryptedData`
- Verify state updates on load/save
- Test error handling
- Test handlers (create/rename/delete)

### Integration Tests

- Test vault operations with real encryption (if available)
- Test data migration/normalization
- Test error recovery

### E2E Tests

- Test user flows: create list → add items → save → reload
- Test error scenarios: network failure, key issues
- Test UI: error banner, loading states, dialogs

## Related Components

- **VaultGate** (`@myorganizer/web-vault-ui`) - Wraps page with vault auth
- **web-vault** (`@myorganizer/web-vault`) - Encryption/decryption utilities
- **web-vault-core** - Lower-level vault APIs
- **web-ui** - UI components (Dialog, Button, Skeleton)

## Migration & Schema Evolution

If the GroceryList schema changes in the future:

1. Update `GroceryList` type in `@myorganizer/core`
2. Update `GroceryListSchema` in `groceriesNormalization.ts`
3. Add migration logic to `normalizeGroceries` if needed
4. Data will auto-migrate on next load

## References

- [Vault Architecture](../../../docs/vault-cloud-backup-google-drive.md)
- [Authentication & Session](../../../docs/authentication/README.md)
- [Core Types](../../../libs/core/src/lib/constants/grocery.ts)
- [Web Vault Library](../../../libs/web-vault/README.md)
